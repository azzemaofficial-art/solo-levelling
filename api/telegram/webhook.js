// Telegram Webhook — riceve messaggi, analizza con Nemotron 550B, risponde + deep link al sito
// Setup: GET /api/telegram/webhook?setup=1

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE   = 'https://api.groq.com/openai/v1';
const SITE_URL = 'https://solo-levelling-gold.vercel.app';

// Upstash Redis REST — salva il payload lato server (TTL default 24h)
async function kvSet(key, value, ttl = 86400) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value), 'EX', String(ttl)]]),
    });
  } catch (_) {}
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d?.result == null) return null;
    try { return JSON.parse(d.result); } catch { return d.result; }
  } catch { return null; }
}

// Totale nutrizionale del giorno (per il comando /oggi)
const todayKey = (chatId) => `tg_day:${chatId}:${new Date().toISOString().slice(0, 10)}`;

async function addDaily(chatId, m) {
  const k = todayKey(chatId);
  const cur = (await kvGet(k)) || { kcal: 0, protein: 0, carbs: 0, fat: 0, burn: 0, meals: 0, workouts: 0 };
  const next = {
    kcal: cur.kcal + (m.kcal || 0),
    protein: cur.protein + (m.protein || 0),
    carbs: cur.carbs + (m.carbs || 0),
    fat: cur.fat + (m.fat || 0),
    burn: cur.burn + (m.burn || 0),
    meals: cur.meals + (m.kcal ? 1 : 0),
    workouts: cur.workouts + (m.burn ? 1 : 0),
  };
  await kvSet(k, next, 172800); // 48h: sopravvive al cambio giorno
  return next;
}

// Provider chain: 550B per task complessi, cascata su modelli veloci
const PROVIDERS = [
  { key: () => process.env.NVIDIA_550B_API_KEY, model: 'nvidia/nemotron-3-ultra-550b-a55b', fast: false },
  { key: () => process.env.KIMI_NVIDIA_API_KEY, model: 'moonshotai/kimi-k2.6', fast: true },
  { key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY, model: 'mistralai/mistral-large-3-675b-instruct-2512', fast: true },
  { key: () => process.env.NEMOTRON_SUPER_API_KEY, model: 'nvidia/nemotron-3-super-120b-a12b', fast: true },
  { key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY, model: 'mistralai/mistral-medium-3-instruct', fast: true },
  { key: () => process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', fast: true, baseUrl: GROQ_BASE },
  { key: () => process.env.NVIDIA_API_KEY, model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', fast: true },
];

// Rileva misurazioni corporee nel testo
function detectMeasurement(text) {
  const t = text.toLowerCase();
  const weightMatch = t.match(/(?:peso|pesо|weight|kg|chili)\s*[:=]?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|chili)?/i)
    || t.match(/^(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|chili)$/i);
  const fatMatch = t.match(/(?:grasso|body.?fat|bf|fat)\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)\s*%?/i);
  const heightMatch = t.match(/(?:altezza|height)\s*[:=]?\s*(\d{3})\s*(?:cm)?/i)
    || t.match(/^(\d{3})\s*cm$/i);
  const ageMatch = t.match(/(?:età|eta|age|anni)\s*[:=]?\s*(\d{1,2})/i)
    || t.match(/^(\d{1,2})\s*anni$/i);
  const sexMatch = t.match(/(?:sesso|genere|sex|gender)\s*[:=]?\s*(m|f|maschio|femmina|male|female)/i);
  const targetMatch = t.match(/(?:target|obiettivo|goal)\s*(?:peso|weight)?\s*[:=]?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg)?/i);
  const bodyWaterMatch = t.match(/(?:acqua|body.?water|water)\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)\s*%?/i);
  const visceralMatch = t.match(/(?:viscerale?|visceral)\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)/i);
  const leanMatch = t.match(/(?:massa\s*magra|lean\s*mass|lean)\s*[:=]?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg)?/i);
  const muscleMatch = t.match(/(?:muscolo|massa\s*muscolare|muscle)\s*[:=]?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg)?/i);
  if (!weightMatch && !fatMatch && !heightMatch && !ageMatch && !sexMatch && !targetMatch
      && !bodyWaterMatch && !visceralMatch && !leanMatch && !muscleMatch) return null;
  let sex = null;
  if (sexMatch) {
    const s = sexMatch[1].toLowerCase();
    sex = (s === 'm' || s === 'maschio' || s === 'male') ? 'M' : 'F';
  }
  return {
    weight: weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : null,
    bodyFat: fatMatch ? parseFloat(fatMatch[1].replace(',', '.')) : null,
    height: heightMatch ? parseInt(heightMatch[1], 10) : null,
    age: ageMatch ? parseInt(ageMatch[1], 10) : null,
    sex,
    targetWeight: targetMatch ? parseFloat(targetMatch[1].replace(',', '.')) : null,
    bodyWater: bodyWaterMatch ? parseFloat(bodyWaterMatch[1].replace(',', '.')) : null,
    visceral: visceralMatch ? parseFloat(visceralMatch[1].replace(',', '.')) : null,
    leanMass: leanMatch ? parseFloat(leanMatch[1].replace(',', '.')) : null,
    muscleMass: muscleMatch ? parseFloat(muscleMatch[1].replace(',', '.')) : null,
  };
}

const SYSTEM_PROMPT = `Sei Nemotron 550B, il coach AI del Shadow Hunter System.

Quando l'utente descrive un WORKOUT:
NON calcolare tu le calorie bruciate. Estrai le attività con la durata. Rispondi con questo JSON esatto:
{
  "type": "workout",
  "name": "<descrizione breve del workout>",
  "intensity": <1-10>,
  "activities": [
    { "activity": "<nome attività, es. corsa / palestra / boxe>", "minutes": <durata in minuti>, "kcal": <stima di riserva delle calorie bruciate> }
  ],
  "post": "<consiglio recovery in 1 riga>"
}
Se la durata non è chiara, stimala. La "kcal" di riserva serve solo se l'attività non è in tabella.

Quando l'utente descrive un PASTO:
NON calcolare tu i totali. Il tuo compito è SOLO estrarre gli alimenti.
- Scomponi i piatti composti nei singoli ingredienti con grammi stimati (es. "pollo con verdure 250g" → pollo 200g + verdure 50g; "pasta al ragù 300g" → pasta cotta 220g + ragù di carne 80g).
- Se l'utente dà un peso, usalo. Altrimenti stima una porzione realistica in grammi.
- Includi "cotto"/"cotta" o "crudo"/"cruda" nel nome SOLO se l'utente lo specifica o è ovvio.
- Per ogni alimento dai anche una stima di riserva dei macro (verrà usata solo se l'alimento non è nel database nutrizionale).
Rispondi con questo JSON esatto:
{
  "type": "meal",
  "slot": "<colazione|pranzo|cena|merenda>",
  "name": "<nome breve descrittivo del pasto>",
  "items": [
    { "food": "<nome alimento singolo>", "grams": <numero>, "kcal": <stima>, "protein": <stima>, "carbs": <stima>, "fat": <stima> }
  ],
  "tip": "<1 consiglio breve di miglioramento>"
}

Regole slot: "colazione"/"breakfast"/"mattina" → "colazione". "pranzo"/"lunch"/"mezzogiorno" → "pranzo". "cena"/"dinner"/"sera" → "cena". "merenda"/"spuntino"/"snack" → "merenda". Se non specificato usa "pranzo".

Per /integratori o altri comandi: rispondi con JSON { "type": "info", "text": "..." }

IMPORTANTE: rispondi SOLO con JSON valido. Nessun testo, nessun ragionamento, nessun tag <think> prima o dopo. Sempre in italiano.`;

async function callAI(messages, fast = false) {
  const providers = fast
    ? PROVIDERS.filter((p) => p.fast)
    : PROVIDERS;

  for (const provider of providers) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 28000);
      const res = await fetch(`${provider.baseUrl || NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: provider.model, messages, max_tokens: 1200, temperature: 0.15 }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await res.json();
      if (res.ok && data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

function isSimpleQuery(text) {
  const words = text.trim().split(/\s+/).length;
  return words < 15;
}

function parseAIResponse(raw) {
  if (!raw) return null;
  let cleaned = String(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  // Salta qualsiasi testo di ragionamento prima del primo {
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  cleaned = cleaned.slice(start);
  // Estrae solo fino alla chiusura del JSON radice
  let depth = 0, end = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { return JSON.parse(cleaned.slice(0, end + 1)); } catch { return null; }
}

// ─── Database nutrizionale — valori per 100g (fonte CREA/USDA, forma comune loggata) ───
// La pasta e il riso senza "cotto" si assumono a peso secco (convenzione italiana).
const FOOD_DB = [
  // Proteine animali
  { kw: ['petto di pollo', 'pollo'], v: { kcal: 165, p: 31, c: 0, f: 3.6 } },
  { kw: ['tacchino'], v: { kcal: 135, p: 29, c: 0, f: 1 } },
  { kw: ['fesa'], v: { kcal: 110, p: 24, c: 0, f: 1 } },
  { kw: ['manzo', 'bovino', 'bistecca'], v: { kcal: 250, p: 26, c: 0, f: 15 } },
  { kw: ['vitello'], v: { kcal: 172, p: 24, c: 0, f: 8 } },
  { kw: ['maiale', 'lonza'], v: { kcal: 242, p: 27, c: 0, f: 14 } },
  { kw: ['salmone'], v: { kcal: 208, p: 20, c: 0, f: 13 } },
  { kw: ['tonno al naturale', 'tonno naturale'], v: { kcal: 116, p: 26, c: 0, f: 1 } },
  { kw: ['tonno'], v: { kcal: 184, p: 25, c: 0, f: 9 } },
  { kw: ['merluzzo', 'pesce bianco', 'orata', 'branzino', 'platessa'], v: { kcal: 82, p: 18, c: 0, f: 0.7 } },
  { kw: ['gamberi', 'gambero'], v: { kcal: 99, p: 24, c: 0, f: 0.3 } },
  { kw: ['albume'], v: { kcal: 52, p: 11, c: 0.7, f: 0.2 } },
  { kw: ['uovo', 'uova'], v: { kcal: 155, p: 13, c: 1.1, f: 11 } },
  { kw: ['prosciutto crudo'], v: { kcal: 270, p: 26, c: 0, f: 18 } },
  { kw: ['prosciutto cotto', 'prosciutto'], v: { kcal: 145, p: 20, c: 1, f: 6 } },
  { kw: ['bresaola'], v: { kcal: 151, p: 32, c: 0, f: 2 } },
  { kw: ['speck'], v: { kcal: 280, p: 28, c: 0, f: 18 } },
  // Latticini
  { kw: ['mozzarella'], v: { kcal: 253, p: 18, c: 2, f: 19 } },
  { kw: ['parmigiano', 'grana'], v: { kcal: 392, p: 33, c: 0, f: 29 } },
  { kw: ['ricotta'], v: { kcal: 146, p: 11, c: 3, f: 10 } },
  { kw: ['yogurt greco 0', 'greco magro'], v: { kcal: 59, p: 10, c: 4, f: 0.4 } },
  { kw: ['yogurt greco'], v: { kcal: 97, p: 9, c: 4, f: 5 } },
  { kw: ['skyr'], v: { kcal: 63, p: 11, c: 4, f: 0.2 } },
  { kw: ['yogurt'], v: { kcal: 61, p: 3.5, c: 5, f: 3.3 } },
  { kw: ['latte scremato'], v: { kcal: 35, p: 3.4, c: 5, f: 0.1 } },
  { kw: ['latte'], v: { kcal: 64, p: 3.3, c: 5, f: 3.6 } },
  { kw: ['feta'], v: { kcal: 264, p: 14, c: 4, f: 21 } },
  // Carboidrati
  { kw: ['pasta cotta'], v: { kcal: 158, p: 6, c: 31, f: 0.9 } },
  { kw: ['pasta'], v: { kcal: 360, p: 12, c: 72, f: 1.5 } },
  { kw: ['riso cotto'], v: { kcal: 130, p: 2.7, c: 28, f: 0.3 } },
  { kw: ['riso'], v: { kcal: 360, p: 7, c: 80, f: 0.6 } },
  { kw: ['pane ai cereali', 'pane cereali', 'pane multicereali'], v: { kcal: 270, p: 10, c: 46, f: 4 } },
  { kw: ['pane integrale'], v: { kcal: 247, p: 9, c: 41, f: 3.4 } },
  { kw: ['pane'], v: { kcal: 265, p: 9, c: 49, f: 3.2 } },
  { kw: ['patate dolci', 'patata dolce'], v: { kcal: 86, p: 1.6, c: 20, f: 0.1 } },
  { kw: ['patate', 'patata'], v: { kcal: 77, p: 2, c: 17, f: 0.1 } },
  { kw: ['avena', 'fiocchi'], v: { kcal: 389, p: 13, c: 66, f: 7 } },
  { kw: ['fette biscottate'], v: { kcal: 408, p: 11, c: 75, f: 6 } },
  { kw: ['couscous'], v: { kcal: 112, p: 3.8, c: 23, f: 0.2 } },
  { kw: ['gnocchi'], v: { kcal: 130, p: 3, c: 27, f: 0.5 } },
  { kw: ['farro cotto', 'farro'], v: { kcal: 130, p: 5, c: 26, f: 0.8 } },
  { kw: ['pizza'], v: { kcal: 270, p: 11, c: 33, f: 10 } },
  { kw: ['cornflakes', 'cereali'], v: { kcal: 357, p: 7, c: 84, f: 0.9 } },
  // Legumi
  { kw: ['fagioli'], v: { kcal: 127, p: 9, c: 22, f: 0.5 } },
  { kw: ['ceci'], v: { kcal: 164, p: 9, c: 27, f: 2.6 } },
  { kw: ['lenticchie'], v: { kcal: 116, p: 9, c: 20, f: 0.4 } },
  { kw: ['piselli'], v: { kcal: 81, p: 5, c: 14, f: 0.4 } },
  { kw: ['edamame'], v: { kcal: 121, p: 12, c: 9, f: 5 } },
  // Verdure
  { kw: ['insalata', 'lattuga'], v: { kcal: 15, p: 1.4, c: 2.9, f: 0.2 } },
  { kw: ['pomodori', 'pomodoro'], v: { kcal: 18, p: 0.9, c: 3.9, f: 0.2 } },
  { kw: ['zucchine', 'zucchina'], v: { kcal: 17, p: 1.2, c: 3, f: 0.3 } },
  { kw: ['spinaci'], v: { kcal: 23, p: 2.9, c: 3.6, f: 0.4 } },
  { kw: ['broccoli'], v: { kcal: 34, p: 2.8, c: 7, f: 0.4 } },
  { kw: ['carote', 'carota'], v: { kcal: 41, p: 0.9, c: 10, f: 0.2 } },
  { kw: ['melanzane', 'melanzana'], v: { kcal: 25, p: 1, c: 6, f: 0.2 } },
  { kw: ['peperoni', 'peperone'], v: { kcal: 31, p: 1, c: 6, f: 0.3 } },
  { kw: ['funghi'], v: { kcal: 22, p: 3.1, c: 3.3, f: 0.3 } },
  { kw: ['verdure', 'verdura', 'contorno'], v: { kcal: 30, p: 2, c: 5, f: 0.3 } },
  // Frutta
  { kw: ['avocado'], v: { kcal: 160, p: 2, c: 9, f: 15 } },
  { kw: ['banana'], v: { kcal: 89, p: 1.1, c: 23, f: 0.3 } },
  { kw: ['mela'], v: { kcal: 52, p: 0.3, c: 14, f: 0.2 } },
  { kw: ['arancia'], v: { kcal: 47, p: 0.9, c: 12, f: 0.1 } },
  { kw: ['fragole'], v: { kcal: 32, p: 0.7, c: 8, f: 0.3 } },
  { kw: ['frutti di bosco', 'mirtilli'], v: { kcal: 43, p: 1, c: 10, f: 0.3 } },
  { kw: ['mandorle'], v: { kcal: 579, p: 21, c: 22, f: 50 } },
  { kw: ['noci', 'frutta secca'], v: { kcal: 607, p: 15, c: 20, f: 54 } },
  { kw: ['frutta'], v: { kcal: 55, p: 0.7, c: 14, f: 0.2 } },
  // Grassi / condimenti
  { kw: ['olio'], v: { kcal: 884, p: 0, c: 0, f: 100 } },
  { kw: ['burro di arachidi', 'burro arachidi'], v: { kcal: 588, p: 25, c: 20, f: 50 } },
  { kw: ['burro'], v: { kcal: 717, p: 0.9, c: 0.1, f: 81 } },
  // Dolci / integratori
  { kw: ['gelato'], v: { kcal: 207, p: 3.5, c: 24, f: 11 } },
  { kw: ['cioccolato fondente'], v: { kcal: 546, p: 8, c: 46, f: 31 } },
  { kw: ['cioccolato', 'nutella'], v: { kcal: 539, p: 6, c: 57, f: 31 } },
  { kw: ['biscotti'], v: { kcal: 460, p: 7, c: 65, f: 18 } },
  { kw: ['miele'], v: { kcal: 304, p: 0.3, c: 82, f: 0 } },
  { kw: ['whey', 'proteine in polvere', 'proteine polvere'], v: { kcal: 380, p: 75, c: 8, f: 6 } },
  { kw: ['barretta proteica', 'barretta'], v: { kcal: 350, p: 30, c: 35, f: 12 } },
  { kw: ['ragù', 'ragu'], v: { kcal: 150, p: 10, c: 4, f: 10 } },
  // Extra ad alta frequenza
  { kw: ['quinoa'], v: { kcal: 120, p: 4.4, c: 21, f: 1.9 } },
  { kw: ['polenta'], v: { kcal: 85, p: 2, c: 18, f: 0.4 } },
  { kw: ['tofu'], v: { kcal: 76, p: 8, c: 1.9, f: 4.8 } },
  { kw: ['seitan'], v: { kcal: 121, p: 24, c: 4, f: 0.5 } },
  { kw: ['tempeh'], v: { kcal: 192, p: 20, c: 8, f: 11 } },
  { kw: ['wurstel', 'wurstdel'], v: { kcal: 270, p: 12, c: 3, f: 24 } },
  { kw: ['salsiccia'], v: { kcal: 304, p: 16, c: 1, f: 27 } },
  { kw: ['salame'], v: { kcal: 384, p: 26, c: 1, f: 31 } },
  { kw: ['mortadella'], v: { kcal: 311, p: 16, c: 1, f: 27 } },
  { kw: ['pancetta', 'bacon'], v: { kcal: 458, p: 12, c: 0, f: 45 } },
  { kw: ['sgombro'], v: { kcal: 205, p: 19, c: 0, f: 14 } },
  { kw: ['hummus'], v: { kcal: 177, p: 8, c: 14, f: 10 } },
  { kw: ['philadelphia', 'formaggio spalmabile'], v: { kcal: 253, p: 6, c: 4, f: 24 } },
  { kw: ['piadina'], v: { kcal: 300, p: 8, c: 47, f: 9 } },
  { kw: ['grissini'], v: { kcal: 433, p: 12, c: 71, f: 12 } },
  { kw: ['pesto'], v: { kcal: 450, p: 5, c: 6, f: 45 } },
  { kw: ['maionese'], v: { kcal: 680, p: 1, c: 1, f: 75 } },
  { kw: ['marmellata', 'confettura'], v: { kcal: 250, p: 0.5, c: 60, f: 0.1 } },
  { kw: ['birra'], v: { kcal: 43, p: 0.5, c: 3.6, f: 0 } },
  { kw: ['vino'], v: { kcal: 83, p: 0.1, c: 2.6, f: 0 } },
  { kw: ['cappuccino'], v: { kcal: 38, p: 2, c: 3, f: 1.8 } },
];

// Cache in-memory (persiste finché la lambda è calda) per le query Open Food Facts
const offCache = new Map();

const normalize = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Cerca un alimento nel DB interno (match per parola chiave, dalla più specifica)
function lookupLocal(food) {
  const n = normalize(food);
  for (const entry of FOOD_DB) {
    for (const kw of entry.kw) {
      if (n.includes(normalize(kw))) return { v: entry.v, source: 'db' };
    }
  }
  return null;
}

// Fallback: Open Food Facts (gratis, no API key, buona copertura prodotti italiani)
async function lookupOFF(food) {
  const cacheKey = normalize(food);
  if (offCache.has(cacheKey)) return offCache.get(cacheKey);
  let result = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(food)}`
      + `&search_simple=1&action=process&json=1&page_size=1&lc=it`
      + `&fields=product_name,nutriments`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ShadowMonarchBot/1.0' } });
    clearTimeout(t);
    const data = await res.json();
    const nut = data?.products?.[0]?.nutriments;
    const kcal = nut?.['energy-kcal_100g'];
    if (nut && kcal != null) {
      result = { v: {
        kcal: Number(kcal) || 0,
        p: Number(nut.proteins_100g) || 0,
        c: Number(nut.carbohydrates_100g) || 0,
        f: Number(nut.fat_100g) || 0,
      }, source: 'off' };
    }
  } catch { result = null; }
  offCache.set(cacheKey, result);
  return result;
}

// Calcola i macro reali del pasto: DB interno → Open Food Facts → stima LLM
async function computeMeal(items) {
  const safe = Array.isArray(items) ? items : [];
  const results = await Promise.all(safe.map(async (it) => {
    const grams = Math.max(0, Number(it.grams) || 0);
    const factor = grams / 100;
    let hit = lookupLocal(it.food);
    if (!hit && grams > 0) hit = await lookupOFF(it.food);
    let macro, source;
    if (hit) {
      macro = { kcal: hit.v.kcal * factor, p: hit.v.p * factor, c: hit.v.c * factor, f: hit.v.f * factor };
      source = hit.source;
    } else {
      // stima di riserva fornita dall'LLM (valori già per la porzione indicata)
      macro = { kcal: Number(it.kcal) || 0, p: Number(it.protein) || 0, c: Number(it.carbs) || 0, f: Number(it.fat) || 0 };
      source = 'ai';
    }
    return { food: it.food, grams, ...macro, source };
  }));

  const tot = results.reduce((a, r) => ({
    kcal: a.kcal + r.kcal, p: a.p + r.p, c: a.c + r.c, f: a.f + r.f,
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  const SRC = { db: '', off: ' ⓘ', ai: ' ~' };
  const breakdown = results.map((r) =>
    `• ${r.food}${r.grams ? ` ${Math.round(r.grams)}g` : ''} → ${Math.round(r.kcal)} kcal${SRC[r.source] || ''}`
  );

  return {
    kcal: Math.round(tot.kcal),
    protein: Math.round(tot.p),
    carbs: Math.round(tot.c),
    fat: Math.round(tot.f),
    breakdown,
  };
}

// ─── Download file da Telegram (voce / foto) ───
async function getTelegramFile(token, fileId) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const d = await r.json();
    if (!d.ok) return null;
    const fr = await fetch(`https://api.telegram.org/file/bot${token}/${d.result.file_path}`);
    return Buffer.from(await fr.arrayBuffer());
  } catch { return null; }
}

// ─── Trascrizione vocale — Groq Whisper ───
async function transcribeVoice(buffer) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'voice.ogg');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'it');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
    });
    const d = await r.json();
    return (d.text || '').trim() || null;
  } catch { return null; }
}

// ─── Vision: estrai gli alimenti da una foto del piatto ───
const VISION_MEAL_PROMPT = `Guarda la foto di un pasto. Identifica OGNI alimento visibile e stima i grammi nel piatto.
Scomponi i piatti composti nei singoli ingredienti. Rispondi SOLO con questo JSON valido, niente altro:
{"type":"meal","slot":"<colazione|pranzo|cena|merenda>","name":"<nome breve>","items":[{"food":"<alimento singolo>","grams":<numero>,"kcal":<stima>,"protein":<n>,"carbs":<n>,"fat":<n>}],"tip":"<1 consiglio>"}
In italiano. Nessun testo o ragionamento fuori dal JSON.`;

// NVIDIA NIM vision (il tuo stack) — stesse key del Visual Coach
async function callVisionNvidia(apiKey, model, imageBase64, mimeType, prompt) {
  if (!apiKey) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 22000);
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ]}],
        max_tokens: 500, temperature: 0.2,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const d = await r.json();
    if (r.ok) return d?.choices?.[0]?.message?.content || null;
    return null;
  } catch { return null; }
}

async function callVisionGemini(imageBase64, mimeType, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

async function callVisionGroqScout(imageBase64, mimeType, prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ]}],
        max_tokens: 500, temperature: 0.2,
      }),
    });
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// Catena vision: prima il tuo stack NVIDIA NIM (usa i crediti se disponibili),
// poi Groq llama-4-scout (gratis, sempre attivo), poi Gemini Flash (se key presente)
async function extractMealFromImage(imageBase64, mimeType) {
  const P = VISION_MEAL_PROMPT;
  let raw =
    await callVisionNvidia(process.env.LLAMA_VISION2_API_KEY, 'meta/llama-3.2-90b-vision-instruct', imageBase64, mimeType, P)
    || await callVisionNvidia(process.env.PHI4_NVIDIA_API_KEY, process.env.PHI4_NVIDIA_MODEL || 'microsoft/phi-4-multimodal-instruct', imageBase64, mimeType, P)
    || await callVisionGroqScout(imageBase64, mimeType, P)
    || await callVisionGemini(imageBase64, mimeType, P);
  return parseAIResponse(raw);
}

// ─── Burn workout via tabella MET (kcal = MET × peso × ore) ───
const MET_TABLE = [
  { kw: ['corsa', 'corro', 'running', 'jogging'], met: 9.8 },
  { kw: ['camminata veloce', 'tapis', 'treadmill'], met: 5.0 },
  { kw: ['camminata', 'cammino', 'walk', 'passeggiata'], met: 3.5 },
  { kw: ['spinning'], met: 8.5 },
  { kw: ['bici', 'ciclismo', 'cycling', 'bicicletta'], met: 7.5 },
  { kw: ['nuoto', 'nuotata', 'swim'], met: 8.3 },
  { kw: ['salto con la corda', 'corda', 'jump rope'], met: 11.0 },
  { kw: ['crossfit', 'hiit', 'circuito', 'wod'], met: 8.0 },
  { kw: ['muay', 'kickboxing', 'arti marziali', 'mma', 'sparring', 'thai'], met: 9.0 },
  { kw: ['boxe', 'boxing', 'sacco', 'pugilato'], met: 7.8 },
  { kw: ['bjj', 'grappling', 'lotta', 'wrestling', 'judo', 'jiu'], met: 8.5 },
  { kw: ['calisthenics', 'corpo libero', 'calistenia'], met: 5.5 },
  { kw: ['palestra', 'pesi', 'sala pesi', 'bodybuilding', 'panca', 'squat', 'stacco'], met: 5.0 },
  { kw: ['yoga', 'stretching', 'mobilità', 'pilates'], met: 2.8 },
  { kw: ['calcio', 'football', 'partita'], met: 7.0 },
  { kw: ['tennis', 'padel'], met: 7.3 },
  { kw: ['basket', 'pallacanestro'], met: 6.5 },
];
function metFor(activity) {
  const n = normalize(activity);
  for (const e of MET_TABLE) for (const kw of e.kw) if (n.includes(normalize(kw))) return e.met;
  return null;
}
function computeBurn(activities, weightKg) {
  const w = weightKg || 75;
  const safe = Array.isArray(activities) ? activities : [];
  let total = 0;
  const lines = [];
  for (const a of safe) {
    const min = Math.max(0, Number(a.minutes) || 0);
    const met = metFor(a.activity);
    if (met && min > 0) {
      const kcal = Math.round(met * w * (min / 60));
      total += kcal;
      lines.push(`• ${a.activity} ${min}min → ${kcal} kcal`);
    } else {
      const est = Math.round(Number(a.kcal) || 0);
      total += est;
      lines.push(`• ${a.activity}${min ? ` ${min}min` : ''} → ${est} kcal ~`);
    }
  }
  return { burn: Math.round(total), lines };
}

// ─── Flusso pasto condiviso (testo / voce / foto) ───
const SLOT_EMOJI = { colazione: '🌅', pranzo: '🍽️', cena: '🌙', merenda: '🍎' };

async function processMeal(botToken, chatId, parsed) {
  const slot = parsed.slot || 'pranzo';
  const name = parsed.name || 'Pasto';
  const m = await computeMeal(parsed.items);

  await kvSet(`tg_import:${chatId}`, {
    type: 'meal', ts: Date.now(),
    kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, name, slot,
  });
  const day = await addDaily(chatId, m);

  let reply = `${SLOT_EMOJI[slot] || '🍽️'} <b>${name}</b> — ${slot}\n`;
  if (m.breakdown.length) reply += '\n' + m.breakdown.join('\n') + '\n';
  reply += '━━━━━━━━━━━\n';
  reply += `📊 <b>~${m.kcal} kcal</b> · P ${m.protein}g · C ${m.carbs}g · G ${m.fat}g`;
  if (parsed.tip) reply += `\n💡 ${parsed.tip}`;
  reply += `\n\n📅 Oggi: <b>${day.kcal} kcal</b>${day.burn ? ` · 🔥 ${day.burn} bruciate` : ''} (netto ${day.kcal - day.burn})`;
  reply += '\n🔄 <i>Apri il sito per i dati aggiornati.</i>';
  await sendTelegramMessage(botToken, chatId, reply);
}

function buildDeepLink(parsed) {
  if (!parsed || parsed.type === 'info') return null;
  try {
    const payload = { type: parsed.type, ts: Date.now() };
    if (parsed.type === 'meal') {
      payload.kcal = parsed.kcal || 0;
      payload.protein = parsed.protein || 0;
      payload.carbs = parsed.carbs || 0;
      payload.fat = parsed.fat || 0;
      payload.name = parsed.name || 'Pasto';
      payload.slot = parsed.slot || 'pranzo';
    } else if (parsed.type === 'workout') {
      payload.burn = parsed.burn || 0;
      payload.name = parsed.name || 'Workout';
    }
    // base64url: nessun +/=/ che rompono i query param
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `${SITE_URL}?tg_import=${encoded}`;
  } catch { return null; }
}

async function sendTelegramMessage(token, chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  const botToken = process.env.SHADOW_BOT_TOKEN;
  const chatId = process.env.SHADOW_BOT_CHAT_ID;

  if (!botToken) return res.status(500).json({ error: 'SHADOW_BOT_TOKEN mancante' });

  if (req.method === 'GET' && req.query?.setup === '1') {
    const webhookUrl = `${SITE_URL}/api/telegram/webhook`;
    const r = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const d = await r.json();
    return res.status(200).json({ ok: d.ok, description: d.description, webhookUrl });
  }

  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const update = req.body;
  const message = update?.message;
  if (!message) return res.status(200).json({ ok: true });

  const incomingChatId = message.chat?.id;
  if (chatId && String(incomingChatId) !== String(chatId)) {
    return res.status(200).json({ ok: true });
  }

  let text = String(message.text || '').trim();

  // 🎤 Messaggio vocale → Whisper (Groq)
  if (!text && (message.voice || message.audio)) {
    const fileId = (message.voice || message.audio).file_id;
    const buf = await getTelegramFile(botToken, fileId);
    const transcript = buf ? await transcribeVoice(buf) : null;
    if (!transcript) {
      await sendTelegramMessage(botToken, incomingChatId, '⚠️ Non sono riuscito a trascrivere il vocale. Riprova o scrivi.');
      return res.status(200).json({ ok: true });
    }
    await sendTelegramMessage(botToken, incomingChatId, `🎤 <i>"${transcript}"</i>`);
    text = transcript.trim();
  }

  // 📷 Foto del piatto → Vision (Gemini Flash → Groq llama-4-scout) → pasto
  if (!text && message.photo?.length) {
    const ph = message.photo[message.photo.length - 1]; // risoluzione massima
    const buf = await getTelegramFile(botToken, ph.file_id);
    const parsed = buf ? await extractMealFromImage(buf.toString('base64'), 'image/jpeg') : null;
    if (parsed?.type === 'meal' && parsed.items?.length) {
      await processMeal(botToken, incomingChatId, parsed);
    } else {
      await sendTelegramMessage(botToken, incomingChatId, '⚠️ Non sono riuscito a leggere il piatto. Più luce e inquadratura dall\'alto, oppure scrivi gli alimenti.');
    }
    return res.status(200).json({ ok: true });
  }

  if (!text) return res.status(200).json({ ok: true });

  // Comandi speciali
  if (text === '/start' || text === '/help') {
    await sendTelegramMessage(botToken, incomingChatId,
      '⚡ <b>Shadow Monarch Bot</b>\n\n' +
      'Dimmi cosa hai mangiato o che allenamento hai fatto — anche con 🎤 <b>vocale</b> o 📷 <b>foto del piatto</b>:\n\n' +
      '🍽️ <b>Pasto</b> — "Cena: pollo 200g, riso 100g cotto, insalata"\n' +
      '🏋️ <b>Workout</b> — "45 min corsa + 30 min pesi"\n' +
      '📷 <b>Foto</b> — manda la foto del piatto, stimo io gli alimenti\n' +
      '🎤 <b>Vocale</b> — dimmi a voce cosa hai mangiato\n\n' +
      '📅 /oggi — totale calorie e macro di oggi\n' +
      '💊 /integratori — lista integratori consigliati\n\n' +
      'I macro sono calcolati su database nutrizionale reale, non stimati a caso 📊'
    );
    return res.status(200).json({ ok: true });
  }

  if (text === '/oggi') {
    const day = await kvGet(todayKey(incomingChatId));
    if (!day || (!day.kcal && !day.burn)) {
      await sendTelegramMessage(botToken, incomingChatId, '📅 <b>Oggi</b>\n\nNiente ancora registrato. Mandami un pasto o un allenamento!');
      return res.status(200).json({ ok: true });
    }
    const net = day.kcal - day.burn;
    let reply = '📅 <b>Riepilogo di oggi</b>\n\n';
    reply += `🍽️ Pasti: <b>${day.meals}</b> · 🏋️ Workout: <b>${day.workouts}</b>\n\n`;
    reply += `📊 Assunte: <b>${day.kcal} kcal</b>\n`;
    reply += `   P ${day.protein}g · C ${day.carbs}g · G ${day.fat}g\n`;
    if (day.burn) reply += `🔥 Bruciate: <b>${day.burn} kcal</b>\n`;
    reply += `\n⚖️ Netto: <b>${net} kcal</b>`;
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  if (text === '/integratori') {
    const reply = '💊 <b>Integratori consigliati oggi</b>\n\n' +
      '🌅 <b>Mattino (colazione)</b>\n' +
      '☀️ Vitamina D3 — 2000 IU\n🔵 Creatina monoidrato — 5g\n⚪ Multivitaminico — 1 cps\n🟤 Probiotico — 1 cps a stomaco vuoto\n\n' +
      '⚡ <b>Pre-workout</b>\n' +
      '🔵 Creatina — 3-5g (se non presa mattino)\n🔴 Elettroliti — 1 serving\n🟠 Caffeina — 100-200mg (opzionale)\n\n' +
      '💪 <b>Post-workout</b>\n' +
      '🥛 Whey Protein — 25-35g entro 30 min\n🔴 Elettroliti — recupero\n\n' +
      '🌙 <b>Sera</b>\n' +
      '🟡 Omega-3 — 2g EPA+DHA con cena\n🟣 Magnesio glicin. — 300mg per il sonno\n🌙 Caseina — 25-30g opzionale pre-sonno\n\n' +
      '<i>Profilo: recomp, allenamento frequente.</i>';
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  // Rilevamento misurazioni corporee — bypass AI
  const measurement = detectMeasurement(text);
  if (measurement && Object.values(measurement).some(Boolean)) {
    const payload = { type: 'measurement', ts: Date.now(), ...measurement };
    await kvSet(`tg_import:${incomingChatId}`, payload);
    // Peso persistente per il calcolo MET dei workout (30 giorni)
    if (measurement.weight) await kvSet(`tg_profile:${incomingChatId}`, { weightKg: measurement.weight }, 2592000);
    let lines = [];
    if (measurement.weight) lines.push(`⚖️ Peso: <b>${measurement.weight} kg</b>`);
    if (measurement.bodyFat) lines.push(`💧 Body fat: <b>${measurement.bodyFat}%</b>`);
    if (measurement.bodyWater) lines.push(`💦 Body water: <b>${measurement.bodyWater}%</b>`);
    if (measurement.visceral) lines.push(`🔴 Grasso viscerale: <b>${measurement.visceral}</b>`);
    if (measurement.leanMass) lines.push(`💪 Massa magra: <b>${measurement.leanMass} kg</b>`);
    if (measurement.muscleMass) lines.push(`🏋️ Muscolo: <b>${measurement.muscleMass} kg</b>`);
    if (measurement.height) lines.push(`📏 Altezza: <b>${measurement.height} cm</b>`);
    if (measurement.age) lines.push(`🎂 Età: <b>${measurement.age} anni</b>`);
    if (measurement.sex) lines.push(`👤 Sesso: <b>${measurement.sex === 'M' ? 'Maschio' : 'Femmina'}</b>`);
    if (measurement.targetWeight) lines.push(`🎯 Target peso: <b>${measurement.targetWeight} kg</b>`);
    if (!lines.length) return res.status(200).json({ ok: true });
    const reply = lines.join('\n') + '\n\n📊 Salvato nel profilo — apri il sito per vedere i dati aggiornati.';
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  // Analisi AI
  const useFast = isSimpleQuery(text);
  const raw = await callAI([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text },
  ], useFast);

  if (!raw) {
    await sendTelegramMessage(botToken, incomingChatId, '⚠️ Errore analisi AI. Riprova tra poco.');
    return res.status(200).json({ ok: true });
  }

  const parsed = parseAIResponse(raw);

  // ── PASTO: macro calcolati su database reale ──
  if (parsed && parsed.type === 'meal') {
    await processMeal(botToken, incomingChatId, parsed);
    return res.status(200).json({ ok: true });
  }

  // ── WORKOUT: burn calcolato via tabella MET (peso reale dal profilo) ──
  if (parsed && parsed.type === 'workout') {
    const name = parsed.name || 'Workout';
    const profile = await kvGet(`tg_profile:${incomingChatId}`);
    const weightKg = Number(profile?.weightKg) || 75;
    const b = computeBurn(parsed.activities, weightKg);

    await kvSet(`tg_import:${incomingChatId}`, {
      type: 'workout', ts: Date.now(), burn: b.burn, name,
    });
    const day = await addDaily(incomingChatId, { burn: b.burn });

    let reply = `🏋️ <b>${name}</b>\n`;
    if (b.lines.length) reply += '\n' + b.lines.join('\n') + '\n';
    reply += '━━━━━━━━━━━\n';
    reply += `🔥 <b>~${b.burn} kcal bruciate</b>`;
    if (parsed.intensity) reply += ` · intensità ${parsed.intensity}/10`;
    if (parsed.post) reply += `\n💊 ${parsed.post}`;
    reply += `\n\n📅 Oggi: 🔥 ${day.burn} bruciate · netto ${day.kcal - day.burn} kcal`;
    reply += '\n🔄 <i>Apri il sito per i dati aggiornati.</i>';
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  // ── Altro (info / fallback): rispondi col testo dell'LLM ──
  await sendTelegramMessage(botToken, incomingChatId, parsed?.text || raw);
  return res.status(200).json({ ok: true });
}

// Telegram Webhook — riceve messaggi, analizza con Nemotron 550B, risponde + deep link al sito
// Setup: GET /api/telegram/webhook?setup=1

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const SITE_URL = 'https://solo-levelling-gold.vercel.app';

// Upstash Redis REST — salva il payload lato server per 24h
async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value), 'EX', '86400']]),
    });
  } catch (_) {}
}

// Provider chain: 550B per task complessi, cascata su modelli veloci
const PROVIDERS = [
  { key: () => process.env.NVIDIA_550B_API_KEY, model: 'nvidia/nemotron-3-ultra-550b-a55b', fast: false },
  { key: () => process.env.KIMI_NVIDIA_API_KEY, model: 'moonshotai/kimi-k2.6', fast: true },
  { key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY, model: 'mistralai/mistral-large-3-675b-instruct-2512', fast: true },
  { key: () => process.env.NEMOTRON_SUPER_API_KEY, model: 'nvidia/nemotron-3-super-120b-a12b', fast: true },
  { key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY, model: 'mistralai/mistral-medium-3-instruct', fast: true },
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
Analizza TUTTI gli esercizi/attività menzionati e rispondi con questo JSON esatto (nessun testo fuori dal JSON):
{
  "type": "workout",
  "text": "⚡ Workout analizzato!\\n💪 Burn stimato: X-Y kcal\\n🔥 Intensità: Z/10\\n💊 Post-workout: [consiglio recovery in 1 riga]",
  "burn": <numero intero medio stimato TOTALE di tutti gli esercizi>,
  "intensity": <1-10>,
  "name": "<descrizione breve del workout>"
}

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
      const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: provider.model, messages, max_tokens: 400, temperature: 0.15 }),
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
  // Rimuove blocchi di ragionamento e code fence che sporcano il JSON
  let cleaned = String(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
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
];

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
    if (!nut) return null;
    const kcal = nut['energy-kcal_100g'];
    if (kcal == null) return null;
    return { v: {
      kcal: Number(kcal) || 0,
      p: Number(nut.proteins_100g) || 0,
      c: Number(nut.carbohydrates_100g) || 0,
      f: Number(nut.fat_100g) || 0,
    }, source: 'off' };
  } catch { return null; }
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
  if (!message?.text) return res.status(200).json({ ok: true });

  const incomingChatId = message.chat?.id;
  const text = String(message.text || '').trim();

  if (chatId && String(incomingChatId) !== String(chatId)) {
    return res.status(200).json({ ok: true });
  }

  // Comandi speciali
  if (text === '/start' || text === '/help') {
    await sendTelegramMessage(botToken, incomingChatId,
      '⚡ <b>Shadow Monarch Bot</b> — Nemotron 550B\n\n' +
      'Dimmi cosa hai mangiato o che allenamento hai fatto:\n\n' +
      '🏋️ <b>Workout</b> — es: "60 min palestra, squat 100kg×5, bench 80kg×8"\n' +
      '🍽️ <b>Pasto</b> — es: "Pranzo: pollo 200g, riso 100g cotto, insalata"\n' +
      '💊 /integratori — lista integratori consigliati\n\n' +
      'Dopo l\'analisi ti mando un link per importare i dati nel sito 📲'
    );
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

  // ── PASTO: macro calcolati su database reale, non stimati dall'LLM ──
  if (parsed && parsed.type === 'meal') {
    const slot = parsed.slot || 'pranzo';
    const name = parsed.name || 'Pasto';
    const m = await computeMeal(parsed.items);

    await kvSet(`tg_import:${incomingChatId}`, {
      type: 'meal', ts: Date.now(),
      kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
      name, slot,
    });

    const SLOT_EMOJI = { colazione: '🌅', pranzo: '🍽️', cena: '🌙', merenda: '🍎' };
    let reply = `${SLOT_EMOJI[slot] || '🍽️'} <b>${name}</b> — ${slot}\n`;
    if (m.breakdown.length) reply += '\n' + m.breakdown.join('\n') + '\n';
    reply += '━━━━━━━━━━━\n';
    reply += `📊 <b>~${m.kcal} kcal</b> · P ${m.protein}g · C ${m.carbs}g · G ${m.fat}g`;
    if (parsed.tip) reply += `\n💡 ${parsed.tip}`;
    reply += '\n\n🔄 <i>Apri il sito per vedere i dati aggiornati.</i>';
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  const replyText = parsed?.text || raw;

  // ── WORKOUT / altro: salva e rispondi col testo dell'LLM ──
  let savedToServer = false;
  if (parsed && parsed.type === 'workout') {
    await kvSet(`tg_import:${incomingChatId}`, {
      type: 'workout', ts: Date.now(),
      burn: parsed.burn || 0, name: parsed.name || 'Workout',
    });
    savedToServer = true;
  }

  // Nessun bottone — l'import è automatico quando apri il sito
  const suffix = savedToServer ? '\n\n🔄 <i>Apri il sito per vedere i dati aggiornati.</i>' : '';
  await sendTelegramMessage(botToken, incomingChatId, replyText + suffix);
  return res.status(200).json({ ok: true });
}

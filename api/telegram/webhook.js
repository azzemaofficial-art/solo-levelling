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

Quando l'utente descrive un PASTO (anche con più alimenti):
Stima i macro di OGNI alimento menzionato e sommali. Rispondi con questo JSON esatto:
{
  "type": "meal",
  "slot": "<colazione|pranzo|cena|merenda>",
  "text": "🍽️ [Nome pasto] analizzato!\\n📊 Stima: ~X kcal | P:Xg C:Xg G:Xg\\n✅ Qualità: [valutazione in 3 parole]\\n💡 Tip: [1 miglioramento]",
  "kcal": <totale kcal intero di TUTTI gli alimenti>,
  "protein": <totale proteine intero>,
  "carbs": <totale carboidrati intero>,
  "fat": <totale grassi intero>,
  "name": "<nome descrittivo del pasto>"
}

Regole slot: se l'utente scrive "colazione" o "breakfast" o "mattina" → slot="colazione". "pranzo" o "lunch" o "mezzogiorno" → slot="pranzo". "cena" o "dinner" o "sera" → slot="cena". "merenda" o "spuntino" o "snack" → slot="merenda". Se non specificato, deduci dall'ora o usa "pranzo".

Per /integratori o altri comandi: rispondi con JSON { "type": "info", "text": "..." }

IMPORTANTE: rispondi SOLO con JSON valido. Nessun testo prima o dopo. Sempre in italiano.`;

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
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
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
  const replyText = parsed?.text || raw;

  // Salva payload su Upstash Redis — il sito lo recupera al prossimo avvio (bypass WebView isolation)
  let savedToServer = false;
  if (parsed && parsed.type !== 'info') {
    await kvSet(`tg_import:${incomingChatId}`, {
      type: parsed.type,
      ts: Date.now(),
      ...(parsed.type === 'meal' ? {
        kcal: parsed.kcal || 0, protein: parsed.protein || 0,
        carbs: parsed.carbs || 0, fat: parsed.fat || 0,
        name: parsed.name || 'Pasto', slot: parsed.slot || 'pranzo',
      } : {
        burn: parsed.burn || 0, name: parsed.name || 'Workout',
      }),
    });
    savedToServer = true;
  }

  // Nessun bottone — l'import è automatico quando apri il sito
  const suffix = savedToServer ? '\n\n🔄 <i>Apri il sito per vedere i dati aggiornati.</i>' : '';
  await sendTelegramMessage(botToken, incomingChatId, replyText + suffix);
  return res.status(200).json({ ok: true });
}

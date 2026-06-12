// Telegram Webhook — riceve messaggi, analizza con Nemotron, risponde
// Setup: GET /api/telegram/webhook?setup=1 per registrare il webhook su Telegram

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const NEMOTRON_PROVIDERS = [
  {
    key: () => process.env.KIMI_NVIDIA_API_KEY,
    model: 'moonshotai/kimi-k2.6',
  },
  {
    key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: 'mistralai/mistral-large-3-675b-instruct-2512',
  },
  {
    key: () => process.env.NEMOTRON_SUPER_API_KEY,
    model: 'nvidia/nemotron-3-super-120b-a12b',
  },
  {
    key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: 'mistralai/mistral-small-4-119b-2603',
  },
  {
    key: () => process.env.NVIDIA_API_KEY,
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  },
];

const SYSTEM_PROMPT = `Sei Nemotron, il coach AI del Shadow Hunter System. Analizzi messaggi dell'utente su workout e pasti.

Quando l'utente descrive un WORKOUT:
1. Stima le kcal bruciate (range realistico)
2. Valuta l'intensità (1-10)
3. Dai 1-2 consigli recovery/nutrizione post-workout
4. Rispondi in formato: "⚡ Workout analizzato!\n💪 Burn stimato: X-Y kcal\n🔥 Intensità: Z/10\n💊 Post-workout: [consiglio]"

Quando l'utente descrive un PASTO:
1. Stima kcal e macro principali (proteine/carbs/grassi)
2. Valuta qualità nutrizionale
3. Dai 1 suggerimento miglioramento
4. Rispondi in formato: "🍽️ Pasto analizzato!\n📊 Stima: ~X kcal | P:Xg C:Xg G:Xg\n✅ Qualità: [valutazione]\n💡 Suggerimento: [consiglio]"

Per altri messaggi: rispondi come coach fitness esperto, max 150 parole.
Rispondi SEMPRE in italiano.`;

async function callNemotron(messages) {
  for (const provider of NEMOTRON_PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 22000);
      const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: provider.model, messages, max_tokens: 280, temperature: 0.2 }),
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
  return 'Errore analisi AI. Riprova tra poco.';
}

async function sendTelegramMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN mancante' });

  // Setup webhook via GET ?setup=1
  if (req.method === 'GET' && req.query?.setup === '1') {
    const webhookUrl = `https://solo-levelling-gold.vercel.app/api/telegram/webhook`;
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

  // Permetti solo dal chatId configurato (sicurezza base)
  if (chatId && String(incomingChatId) !== String(chatId)) {
    return res.status(200).json({ ok: true });
  }

  // Comandi speciali
  if (text === '/start' || text === '/help') {
    await sendTelegramMessage(botToken, incomingChatId,
      '⚡ <b>Shadow Monarch Bot</b>\n\n' +
      'Posso analizzare i tuoi:\n' +
      '🏋️ <b>Workout</b> — descrivimi l\'allenamento\n' +
      '🍽️ <b>Pasti</b> — descrivimi cosa hai mangiato\n' +
      '💊 /integratori — lista integratori di oggi\n' +
      '📊 /status — stato giornaliero\n\n' +
      'Esempio: "Ho fatto 60 min palestra, squat 100kg x5, bench 80kg x8"\n' +
      'Esempio: "Pranzo: pollo 200g, riso 100g, insalata"'
    );
    return res.status(200).json({ ok: true });
  }

  if (text === '/integratori') {
    const reply = '💊 <b>Integratori consigliati oggi</b>\n\n' +
      '🔵 Creatina monoidrato — 5g ogni giorno\n' +
      '🟡 Omega-3 (EPA+DHA) — 1000-2000mg a pranzo\n' +
      '🟣 Magnesio — 200-350mg la sera\n' +
      '🟢 Vitamina D3 — 1000-2000 IU a colazione\n' +
      '⚪ Proteine whey — 25-35g post-workout\n' +
      '🔴 Elettroliti — pre/durante/post workout\n\n' +
      '<i>Basato sul tuo profilo recomp + allenamento frequente</i>';
    await sendTelegramMessage(botToken, incomingChatId, reply);
    return res.status(200).json({ ok: true });
  }

  // Analisi AI per tutto il resto
  try {
    const aiReply = await callNemotron([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text }
    ]);
    await sendTelegramMessage(botToken, incomingChatId, aiReply);
  } catch (_) {
    await sendTelegramMessage(botToken, incomingChatId, '⚠️ Errore analisi. Riprova.');
  }

  return res.status(200).json({ ok: true });
}

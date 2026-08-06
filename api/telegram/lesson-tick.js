// ─────────────────────────────────────────────────────────────────────────────
//  Push automatico Gate della Conoscenza — chiamato da un cron esterno 2-3x/giorno.
//  Manda all'utente la "pillola del giorno": una domanda (SRS-aware) con bottoni.
//  Auth: ?secret=<CRON_SECRET> oppure header Authorization: Bearer <CRON_SECRET>.
//  Slot opzionale: ?slot=morning|afternoon|evening (ruota la materia).
// ─────────────────────────────────────────────────────────────────────────────

import { nextQuestion, initLearn, normalize, loadGen } from '../../lib/learn.js';
import { kvGet, kvSet, KvError } from '../../lib/kv.js';

async function sendMessage(token, chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

const SLOT_GATE = { morning: 'english', afternoon: 'prog-ia', evening: 'scienza' }; // sera = Scienza & Biohacking (i ripassi SRS scaduti hanno comunque priorità)

export default async function handler(req, res) {
  try {
    return await dispatch(req, res);
  } catch (err) {
    // KV giù → NON scrivere uno stato fresco sopra quello reale: segnala errore,
    // il cron riproverà al prossimo giro.
    if (err?.name === 'KvError') return res.status(502).json({ ok: false, error: 'kv offline', detail: err.message });
    throw err;
  }
}

async function dispatch(req, res) {
  const secret = process.env.CRON_SECRET;
  const provided = req.query?.secret || (req.headers?.authorization || '').replace('Bearer ', '');
  if (secret && provided !== secret) return res.status(401).json({ error: 'unauthorized' });

  const token = process.env.SHADOW_BOT_TOKEN;
  // Cron personale: solo il primo ID della allow-list (il proprietario).
  const chatId = String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/)[0];
  if (!token || !chatId) return res.status(500).json({ error: 'bot non configurato' });

  const slot = String(req.query?.slot || '').toLowerCase();
  const gateOverride = SLOT_GATE[slot] || undefined;

  const KEY = `tg_learn:${chatId}`;
  let st = normLoad(await kvGet(KEY));
  // idrata il pool generato per i gate coinvolti (override + attivo), così include le domande AI
  for (const g of [gateOverride, st.activeGate].filter(Boolean)) {
    const gen = await kvGet(`tg_genq:${g}`);
    if (gen) loadGen(g, gen);
  }
  const q = nextQuestion(st, gateOverride);
  st.pending = { gate: q.gate, qid: q.qid, review: !!q.review };
  await kvSet(KEY, st, 2592000);

  const intro = slot === 'morning' ? '☀️ <b>Pillola del mattino</b>'
    : slot === 'afternoon' ? '⚡ <b>Quiz del pomeriggio</b>'
    : slot === 'evening' ? '🔬 <b>Scienza della sera</b>'
    : '🧠 <b>Gate della Conoscenza</b>';
  await sendMessage(token, chatId, `${intro}\n\n${q.text}`, q.keyboard);

  return res.status(200).json({ ok: true, slot: slot || 'auto', gate: q.gate, qid: q.qid, review: q.review });
}

function normLoad(s) { return normalize(s || initLearn()); }

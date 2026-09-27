// Promemoria intelligente del Protocollo Cut, servito da api/telegram/remind.js
// (il piano Vercel ammette max 12 funzioni: niente endpoint dedicati).
//   POST remind          → saveCutState: l'app invia due date (ultima creatina, ultima pesata)
//   GET  remind?task=cut-nudge (Vercel Cron serale) → sendCutNudges
// Scrive SOLO se manca qualcosa (a differenza dei consigli fissi di remind.js):
//   • creatina non segnata oggi, ma presa negli ultimi 7 giorni (abitudine attiva)
//   • nessuna pesata da 3+ giorni
// Solo chat nella allow-list SHADOW_BOT_CHAT_ID; niente pesi né misure sul server.
import { guardApi } from './apiGuard.js';
import { kvGet, kvSet, KvError } from './kv.js';

const DAY = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const allowedChats = () => String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/).filter(Boolean);
const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / DAY);

export function nudgeLines(state, today) {
  if (!state) return [];
  const lines = [];
  if (state.creatineDate && state.creatineDate !== today) {
    const gap = daysBetween(state.creatineDate, today);
    if (gap > 0 && gap <= 7) lines.push('💊 Creatina non ancora segnata oggi: 3–5 g, a qualsiasi ora va bene.');
  }
  if (state.lastWeighDate) {
    const gap = daysBetween(state.lastWeighDate, today);
    if (gap >= 3) lines.push(`⚖️ Ultima pesata ${gap} giorni fa: domattina, a digiuno, dopo il bagno.`);
  }
  return lines;
}

export async function saveCutState(req, res) {
  if (!guardApi(req, res, { maxPerMinute: 20 })) return undefined;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const chatId = String(body.chat_id || '');
  if (!allowedChats().includes(chatId)) return res.status(403).json({ error: 'chat non abilitata' });

  const clean = (value) => (typeof value === 'string' && DATE_RE.test(value) ? value : null);
  const state = { creatineDate: clean(body.creatineDate), lastWeighDate: clean(body.lastWeighDate), updatedAt: new Date().toISOString() };
  try {
    await kvSet(`cut_state:${chatId}`, state, 60 * 60 * 24 * 21);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(err instanceof KvError ? 503 : 500).json({ error: err.message });
  }
}

// Chiamare solo dopo il controllo CRON_SECRET.
export async function sendCutNudges(res) {
  const botToken = process.env.SHADOW_BOT_TOKEN;
  const chats = allowedChats();
  if (!botToken || !chats.length) return res.status(500).json({ error: 'SHADOW_BOT_TOKEN o SHADOW_BOT_CHAT_ID mancante' });
  const today = romeToday();
  const results = [];
  for (const chatId of chats) {
    try {
      const lines = nudgeLines(await kvGet(`cut_state:${chatId}`), today);
      if (!lines.length) { results.push({ chatId, sent: false }); continue; }
      const text = `🎯 <b>Protocollo Cut</b>\n\n${lines.join('\n')}\n\n<a href="https://solo-levelling-steel.vercel.app">📱 Apri e segna</a>`;
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      const data = await r.json();
      results.push({ chatId, sent: Boolean(data.ok), error: data.ok ? undefined : data.description });
    } catch (err) {
      // KV giù: meglio saltare un promemoria che mandarne uno sbagliato.
      results.push({ chatId, sent: false, error: err instanceof KvError ? 'kv' : err.message });
    }
  }
  return res.status(200).json({ ok: true, today, results: results.map(({ chatId, ...rest }) => ({ chat: chatId.slice(-3), ...rest })) });
}

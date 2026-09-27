// Promemoria intelligente del Protocollo Cut — Vercel Cron, 1x/giorno la sera.
// Scrive SOLO se manca qualcosa (a differenza di remind.js, che manda consigli fissi):
//   • creatina non segnata oggi, ma presa negli ultimi 7 giorni (è un'abitudine attiva)
//   • nessuna pesata da 3+ giorni
// Lo stato arriva dall'app via cut-state.js. Chi non usa il Cut non riceve nulla.
import { safeEqual } from '../../lib/secrets.js';
import { kvGet, KvError } from '../../lib/kv.js';

const DAY = 86400000;
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

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET non impostato su Vercel' });
  const provided = req.query?.secret || (req.headers?.authorization || '').replace('Bearer ', '');
  if (!safeEqual(String(provided || ''), cronSecret)) return res.status(401).json({ error: 'unauthorized' });

  const botToken = process.env.SHADOW_BOT_TOKEN;
  const chats = String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/).filter(Boolean);
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

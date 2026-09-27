// Stato minimo del Protocollo Cut per i promemoria intelligenti (cut-nudge.js).
// POST /api/telegram/cut-state  { chat_id, creatineDate, lastWeighDate }
// Salviamo solo due date: niente pesi, niente misure. Solo chat nella allow-list
// SHADOW_BOT_CHAT_ID, così nessuno può far scrivere il bot a chat sconosciute.
import { guardApi } from '../../lib/apiGuard.js';
import { kvSet, KvError } from '../../lib/kv.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const allowedChats = () => String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/).filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!guardApi(req, res, { maxPerMinute: 20 })) return;

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

// ─────────────────────────────────────────────────────────────────────────────
//  Ripristino dello stato learn (tg_learn:<chatId>) da uno snapshot noto
//  (es. dataset/learning.csv dell'alveare Obsidian). Nato dopo l'azzeramento
//  del 5/8/2026 causato da un read KV fallito poi sovrascritto.
//
//  SEMPRE merge-only e monotono: prende il MAX tra stato attuale e valori
//  forniti, non riduce mai nulla, non tocca srs/pending/boss. Idempotente.
//
//  Auth: ?secret=<HIVE_SECRET>. Body JSON (o query): { chatId?, xp, streak, gates? }
// ─────────────────────────────────────────────────────────────────────────────
import { GATES, initLearn, normalize, levelOf } from '../../lib/learn.js';
import { kvGet, kvSet, KvError } from '../../lib/kv.js';

const TTL = 2592000; // 30 giorni, come il resto del flusso learn

export default async function handler(req, res) {
  const secret = process.env.HIVE_SECRET;
  if (!secret) return res.status(403).json({ error: 'HIVE_SECRET non impostato su Vercel' });
  const provided = req.query?.secret || (req.headers?.authorization || '').replace('Bearer ', '');
  if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });

  const body = (req.method === 'POST' && req.body && typeof req.body === 'object') ? req.body : req.query;
  const chatId = String(body.chatId || '').split(/[\s,]+/)[0]
    || String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/)[0];
  if (!chatId) return res.status(400).json({ error: 'chat_id mancante' });

  const xpIn = Number(body.xp) || 0;
  const streakIn = Number(body.streak) || 0;
  const gatesIn = (body.gates && typeof body.gates === 'object') ? body.gates : null;

  try {
    const KEY = `tg_learn:${chatId}`;
    const cur = normalize((await kvGet(KEY)) || initLearn());

    cur.xp = Math.max(Number(cur.xp) || 0, xpIn);
    cur.streak = Math.max(Number(cur.streak) || 0, streakIn);

    if (gatesIn) {
      for (const [gate, p] of Object.entries(gatesIn)) {
        if (!GATES[gate] || !p || typeof p !== 'object') continue;
        const prev = cur.prog[gate] || { idx: 0, correct: 0, total: 0, done: 0 };
        const done = Math.max(Number(prev.done) || 0, Number(p.done) || 0);
        const correct = Math.max(Number(prev.correct) || 0, Number(p.correct) || 0);
        const total = Math.max(Number(prev.total) || 0, Number(p.total) || 0);
        cur.prog[gate] = {
          ...prev,
          done, correct, total,
          // riprendi il corso da dove era arrivato (pool esaurito → scelta casuale)
          idx: Math.max(Number(prev.idx) || 0, done),
        };
      }
    }

    await kvSet(KEY, cur, TTL);
    return res.status(200).json({
      ok: true,
      chatId,
      restored: { xp: cur.xp, level: levelOf(cur.xp), streak: cur.streak, gates: Object.keys(cur.prog) },
      note: 'merge-only: nessun valore è stato ridotto',
    });
  } catch (err) {
    if (err?.name === 'KvError') return res.status(502).json({ ok: false, error: 'kv offline', detail: err.message });
    throw err;
  }
}

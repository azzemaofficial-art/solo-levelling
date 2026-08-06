// ─────────────────────────────────────────────────────────────────────────────
//  Export dati per l'Alveare Obsidian — usato dal ponte (tools/obsidian-hive.mjs).
//  Auth: ?secret=<HIVE_SECRET>. Ritorna progresso apprendimento + campioni coach.
// ─────────────────────────────────────────────────────────────────────────────
import { GATES, GATE_IDS, normalize, levelOf } from '../../lib/learn.js';
import { kvGet, KvError } from '../../lib/kv.js';

export default async function handler(req, res) {
  try {
    return await dispatch(req, res);
  } catch (err) {
    // KV irraggiungibile → 503: il ponte Obsidian abortisce invece di scrivere
    // nel vault uno snapshot pieno di zeri (che avvelenerebbe la memoria AI).
    if (err?.name === 'KvError') return res.status(503).json({ ok: false, error: 'kv offline', detail: err.message });
    throw err;
  }
}

async function dispatch(req, res) {
  const secret = process.env.HIVE_SECRET;
  if (!secret) return res.status(403).json({ error: 'HIVE_SECRET non impostato su Vercel' });
  const provided = req.query?.secret || (req.headers?.authorization || '').replace('Bearer ', '');
  if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });

  // SHADOW_BOT_CHAT_ID può contenere più ID (allow-list multi-utente, separati
  // da virgola): senza ?chat_id esplicito, l'alveare Obsidian sincronizza solo
  // il proprietario (primo ID), non la stringa intera come chiave letterale.
  const chatId = req.query?.chat_id || String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/)[0];
  if (!chatId) return res.status(400).json({ error: 'chat_id mancante' });

  const learn = normalize((await kvGet(`tg_learn:${chatId}`)) || {});
  const samples = (await kvGet(`coach_samples:${chatId}`)) || [];
  const sessions = (await kvGet(`coach_sessions:${chatId}`)) || [];
  const meals = (await kvGet(`tg_meals:${chatId}`)) || [];
  const profile = (await kvGet(`tg_profile:${chatId}`)) || {};
  const webPrefs = (await kvGet(`web_prefs:${chatId}`)) || {};

  const gates = GATE_IDS.map((g) => {
    const p = learn.prog?.[g] || { done: 0, correct: 0, total: 0 };
    return { id: g, name: GATES[g].name, emoji: GATES[g].emoji, done: p.done || 0, correct: p.correct || 0, total: p.total || 0, size: GATES[g].course.length };
  });

  return res.status(200).json({
    chatId: String(chatId),
    exportedAt: new Date().toISOString(),
    learn: { xp: learn.xp || 0, level: levelOf(learn.xp), streak: learn.streak || 0, srsDue: (learn.srs || []).length, activeGate: learn.activeGate, gates },
    samples: Array.isArray(samples) ? samples : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    meals: Array.isArray(meals) ? meals : [],
    profile: profile && typeof profile === 'object' ? profile : {},
    webPrefs: webPrefs && typeof webPrefs === 'object' ? webPrefs : {},
  });
}

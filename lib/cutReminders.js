// Promemoria del Protocollo Cut su Telegram, serviti da api/telegram/remind.js
// (il piano Vercel ammette max 12 funzioni: niente endpoint dedicati).
//
//   POST remind                      → saveCutState: l'app invia poche date e i target kcal
//   GET  remind?task=cut-morning     → 07:30 briefing: allenamento, kcal, pesata, [💊]
//   GET  remind?task=cut-training    → 17:30 solo nei giorni con sessione: esercizi, [✅]
//   GET  remind?task=cut-nudge       → 20:30 solo se manca qualcosa: creatina, sessione, pesata
//   bottoni cut|creatine, cut|session → handleCutCallback (da webhook.js): segna sul server
//                                       e accoda l'azione per l'app (tg_queue → XP all'apertura)
//
// Solo chat nella allow-list SHADOW_BOT_CHAT_ID; sul server niente pesi né misure.
import { guardApi } from './apiGuard.js';
import { kvGet, kvSet, kvPush, KvError } from './kv.js';
import { trainingDays } from '../src/data/cutPlan.js';
import { COMBOS } from '../src/data/mmaCombos.js';

const DAY = 86400000;
const STATE_TTL = 60 * 60 * 24 * 21;
const SITE = 'https://solo-levelling-steel.vercel.app';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const stateKey = (chatId) => `cut_state:${chatId}`;
const allowedChats = () => String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/).filter(Boolean);
export const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / DAY);
// 0 = lunedì, come nell'app
export const mondayIndex = (isoDate) => (new Date(`${isoDate}T12:00:00Z`).getUTCDay() + 6) % 7;
const isTrainingDay = (session) => session && session.type !== 'recovery';
const laterDate = (a, b) => ([a, b].filter(Boolean).sort().pop() || null);

// ── Testi (funzioni pure, testate in tests/cutNudge.test.js) ──────────────────
export function nudgeLines(state, today) {
  if (!state) return [];
  const lines = [];
  if (state.creatineDate && state.creatineDate !== today) {
    const gap = daysBetween(state.creatineDate, today);
    if (gap > 0 && gap <= 7) lines.push('💊 Creatina non ancora segnata oggi: 3–5 g, a qualsiasi ora va bene.');
  }
  const session = trainingDays[mondayIndex(today)];
  if (isTrainingDay(session) && session.type !== 'optional' && state.sessionDoneDate !== today) {
    lines.push(`🏋️ ${session.short} di oggi non ancora segnata. Fatta? Premi qui sotto.`);
  }
  if (state.lastWeighDate) {
    const gap = daysBetween(state.lastWeighDate, today);
    if (gap >= 3) lines.push(`⚖️ Ultima pesata ${gap} giorni fa: domattina, a digiuno, dopo il bagno.`);
  }
  return lines;
}

export function morningText(state, today) {
  const dow = mondayIndex(today);
  const session = trainingDays[dow];
  const kcal = Number(state?.kcalTargets?.[dow]) || null;
  const lines = [`☀️ <b>Buongiorno, cacciatore.</b> Oggi è ${session.day.toLowerCase()}.`, ''];
  lines.push(isTrainingDay(session)
    ? `🔥 <b>${session.short}</b>${session.duration !== '—' ? ` · ${session.duration}` : ''}\n${session.detail}`
    : `🌙 <b>${session.short}</b> — ${session.detail}`);
  if (kcal) lines.push(`🍽️ Obiettivo di oggi: circa <b>${kcal.toLocaleString('it-IT')} kcal</b>.`);
  const weighGap = state?.lastWeighDate ? daysBetween(state.lastWeighDate, today) : null;
  if (weighGap === null || weighGap >= 2) lines.push('⚖️ Pesata a digiuno, dopo il bagno: segnala nei Progressi.');
  lines.push(`🥊 Combo del giorno: <b>${comboOfDay(today).name}</b> — MMA → Combo, il coach te la insegna.`);
  return lines.join('\n');
}

// Una combo diversa ogni giorno, a rotazione su tutta la libreria (prima le base).
export function comboOfDay(today) {
  const ordered = [...COMBOS].sort((a, b) => a.level - b.level);
  const dayNumber = Math.floor(new Date(`${today}T12:00:00Z`).getTime() / DAY);
  return ordered[dayNumber % ordered.length];
}

export function trainingText(today) {
  const session = trainingDays[mondayIndex(today)];
  if (!isTrainingDay(session)) return null;
  const list = (session.exercises || []).slice(0, 5).map(([name, dose]) => `• ${name} — ${dose}`).join('\n');
  return [`⚔️ <b>Tra poco: ${session.short}</b> (${session.duration})`, session.detail, list, '', 'Riscaldamento 5 minuti, poi via. Quando hai finito premi ✅: +40 XP.']
    .filter((line) => line !== '').join('\n');
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.SHADOW_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return r.json();
}

const keyboardFor = (state, today, { creatine = true, session = true } = {}) => {
  const row = [];
  if (creatine && state?.creatineDate !== today) row.push({ text: '💊 Creatina presa', callback_data: 'cut|creatine' });
  if (session && isTrainingDay(trainingDays[mondayIndex(today)]) && state?.sessionDoneDate !== today) row.push({ text: '✅ Allenamento fatto', callback_data: 'cut|session' });
  return row.length ? { inline_keyboard: [row, [{ text: '📱 Apri il Protocollo', url: SITE }]] } : { inline_keyboard: [[{ text: '📱 Apri il Protocollo', url: SITE }]] };
};

// ── Stato inviato dall'app ────────────────────────────────────────────────────
export async function saveCutState(req, res) {
  if (!guardApi(req, res, { maxPerMinute: 20 })) return undefined;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const chatId = String(body.chat_id || '');
  if (!allowedChats().includes(chatId)) return res.status(403).json({ error: 'chat non abilitata' });

  const clean = (value) => (typeof value === 'string' && DATE_RE.test(value) ? value : null);
  const kcalTargets = Array.isArray(body.kcalTargets) && body.kcalTargets.length === 7
    ? body.kcalTargets.map((n) => Math.round(Number(n))).map((n) => (n >= 1000 && n <= 6000 ? n : null))
    : null;
  try {
    // Le date si fondono tenendo la più recente: se hai premuto ✅ su Telegram e l'app
    // non ha ancora ritirato la coda, un invio "vecchio" non deve cancellarlo.
    const prev = (await kvGet(stateKey(chatId))) || {};
    const state = {
      creatineDate: laterDate(prev.creatineDate, clean(body.creatineDate)),
      sessionDoneDate: laterDate(prev.sessionDoneDate, clean(body.sessionDoneDate)),
      lastWeighDate: laterDate(prev.lastWeighDate, clean(body.lastWeighDate)),
      kcalTargets: kcalTargets || prev.kcalTargets || null,
      // diagnostica effetti del telefono (solo stringhe corte e booleani)
      client: body.client && typeof body.client === 'object' ? {
        reducedMotion: body.client.reducedMotion === true ? true : body.client.reducedMotion === false ? false : null,
        fxMode: String(body.client.fxMode || '').slice(0, 10),
        dragons: String(body.client.dragons || '').slice(0, 10),
        ua: String(body.client.ua || '').slice(0, 180),
      } : prev.client || null,
      updatedAt: new Date().toISOString(),
    };
    await kvSet(stateKey(chatId), state, STATE_TTL);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(err instanceof KvError ? 503 : 500).json({ error: err.message });
  }
}

// ── Cron (chiamare solo dopo il controllo CRON_SECRET) ─────────────────────────
// `only` (chat id) serve per le prove manuali: il controllo CRON_SECRET resta a monte.
export async function sendCutReminders(task, res, { only } = {}) {
  if (!process.env.SHADOW_BOT_TOKEN || !allowedChats().length) return res.status(500).json({ error: 'SHADOW_BOT_TOKEN o SHADOW_BOT_CHAT_ID mancante' });
  const today = romeToday();
  const results = [];
  for (const chatId of allowedChats().filter((id) => !only || id === String(only))) {
    try {
      // Chi non ha mai aperto il Cut (nessuno stato) non riceve nulla.
      const state = await kvGet(stateKey(chatId));
      let text = null;
      let replyMarkup = null;
      if (state && task === 'cut-morning') {
        text = morningText(state, today);
        replyMarkup = keyboardFor(state, today, { session: false });
      } else if (state && task === 'cut-training' && state.sessionDoneDate !== today) {
        text = trainingText(today);
        replyMarkup = keyboardFor(state, today, { creatine: false });
      } else if (state && task === 'cut-nudge') {
        const lines = nudgeLines(state, today);
        if (lines.length) {
          text = `🎯 <b>Protocollo Cut</b>\n\n${lines.join('\n')}`;
          replyMarkup = keyboardFor(state, today);
        }
      }
      if (!text) { results.push({ chatId, sent: false }); continue; }
      const data = await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: replyMarkup });
      results.push({ chatId, sent: Boolean(data.ok), error: data.ok ? undefined : data.description });
    } catch (err) {
      // KV giù: meglio saltare un promemoria che mandarne uno sbagliato.
      results.push({ chatId, sent: false, error: err instanceof KvError ? 'kv' : err.message });
    }
  }
  return res.status(200).json({ ok: true, task, today, results: results.map(({ chatId, ...rest }) => ({ chat: chatId.slice(-3), ...rest })) });
}

// ── Bottoni (da webhook.js, chat già verificata nella allow-list) ─────────────
export async function handleCutCallback(cbq) {
  const chatId = String(cbq.message?.chat?.id || '');
  const action = String(cbq.data || '').split('|')[1];
  const today = romeToday();
  const field = action === 'creatine' ? 'creatineDate' : action === 'session' ? 'sessionDoneDate' : null;
  if (!field) return tg('answerCallbackQuery', { callback_query_id: cbq.id });

  const prev = (await kvGet(stateKey(chatId))) || {};
  const already = prev[field] === today;
  if (!already) {
    await kvSet(stateKey(chatId), { ...prev, [field]: today, updatedAt: new Date().toISOString() }, STATE_TTL);
    // L'app ritira la coda all'apertura: segna la spunta e assegna gli XP (una volta sola).
    await kvPush(`tg_queue:${chatId}`, { type: action === 'creatine' ? 'cut_creatine' : 'cut_session', date: today, ts: Date.now() }, 60 * 60 * 24 * 7);
  }
  const toast = action === 'creatine'
    ? (already ? 'Già segnata oggi 💊' : '💊 Segnata! +10 XP quando apri l\'app')
    : (already ? 'Già segnato oggi ✅' : '🐉 Allenamento segnato! +40 XP quando apri l\'app');
  await tg('answerCallbackQuery', { callback_query_id: cbq.id, text: toast, show_alert: !already && action === 'session' });
  // Aggiorna i bottoni del messaggio: via quello appena premuto.
  const state = { ...prev, [field]: today };
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cbq.message?.message_id, reply_markup: keyboardFor(state, today) }).catch(() => {});
  return null;
}

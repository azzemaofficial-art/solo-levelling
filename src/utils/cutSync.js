// Azioni del Protocollo Cut arrivate da Telegram (bottoni 💊/✅ dei promemoria,
// lib/cutReminders.js) e ritirate dall'app tramite la coda tg_queue.
// Stesse chiavi XP della pagina: un premio già preso in app non si ripaga.
import { trainingDays } from '../data/cutPlan.js';
import { durationMinutes, kindForSession, logWorkout } from './trainingLog.js';
export const CUT_PLAN_KEY = 'shadow_monarch_cut_plan_v1';
export const CUT_SYNC_EVENT = 'shadow_cut_sync';
export const CUT_XP = { session: 40, creatine: 10, measure: 15 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const mondayIndex = (isoDate) => (new Date(`${isoDate}T12:00:00`).getDay() + 6) % 7;

export function applyCutRemote(payload, grantXp) {
  const date = payload?.date;
  if (!DATE_RE.test(date || '')) return;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CUT_PLAN_KEY) || '{}'); } catch { /* piano corrotto: si riparte */ }

  let xpKey;
  let amount;
  let label;
  if (payload.type === 'cut_creatine') {
    if (!saved.creatineDate || date > saved.creatineDate) saved.creatineDate = date;
    xpKey = `creatine-${date}`; amount = CUT_XP.creatine; label = 'Creatina (da Telegram)';
  } else if (payload.type === 'cut_session') {
    const slot = `${Number(saved.trainingWeek) || 0}-${mondayIndex(date)}`;
    saved.completed = { ...(saved.completed || {}), [slot]: true };
    xpKey = `session-${slot}`; amount = CUT_XP.session; label = 'Allenamento (da Telegram)';
    const session = trainingDays[mondayIndex(date)];
    logWorkout({ date, kind: kindForSession(session.type), title: session.short, minutes: durationMinutes(session.duration), source: 'telegram' });
  } else {
    return;
  }

  const alreadyPaid = Boolean(saved.xpAwarded?.[xpKey]);
  saved.xpAwarded = { ...(saved.xpAwarded || {}), [xpKey]: true };
  try { localStorage.setItem(CUT_PLAN_KEY, JSON.stringify(saved)); } catch { /* storage pieno */ }
  if (!alreadyPaid) grantXp?.(amount, label);
  try { window.dispatchEvent(new CustomEvent(CUT_SYNC_EVENT)); } catch { /* nessun listener */ }
}

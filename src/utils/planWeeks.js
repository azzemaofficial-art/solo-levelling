// Settimane del piano: la settimana 1 parte lunedì 28/09/2026 (Emanuele), 16 in tutto.
import { localDateKey } from './trainingLog.js';

export const PLAN_START = new Date(2026, 8, 28);
export const PLAN_WEEKS = 16;

// Indice (0 = settimana 1) della settimana in cui cade `now`; mai fuori da 0..15.
export const planWeekIndex = (now = new Date(), start = PLAN_START) => {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((midnight - start) / 864e5); // giorni interi: l'ora legale non sposta il conto
  return Math.min(PLAN_WEEKS - 1, Math.max(0, Math.floor(days / 7)));
};
export const weekMonday = (index, start = PLAN_START) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * index);
export const weekDates = (index, start = PLAN_START) => Array.from({ length: 7 }, (_, i) => localDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * index + i)));
export const weekRangeLabel = (index, start = PLAN_START) => {
  const a = weekMonday(index, start); const b = new Date(a); b.setDate(a.getDate() + 6);
  const fmt = (d, month) => d.toLocaleDateString('it-IT', month ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return `${fmt(a, a.getMonth() !== b.getMonth())}–${fmt(b, true)}`;
};

// Forza stimata (formula di Epley: carico × (1 + ripetizioni/30)) in kg totali sollevati.
// Trazioni = tutto il peso del corpo; piegamenti ≈ 64% del peso del corpo. È una stima, non un test.
export const estimateStrength = (entry, bodyKg) => {
  if (!bodyKg) return { pull: null, push: null };
  const epley = (reps, base) => (reps > 0 ? Math.round(base * (1 + reps / 30)) : null);
  return { pull: epley(entry.pullups, bodyKg), push: epley(entry.pushups, bodyKg * 0.64) };
};

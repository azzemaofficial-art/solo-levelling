// ─────────────────────────────────────────────────────────────────────────────
// Diario allenamenti: una voce per ogni allenamento segnato "fatto" (sessioni del
// piano, calcio, lezioni e combo MMA, ✅ da Telegram) o aggiunto a mano.
// Locale al telefono, come il resto del Protocollo Cut.
// ─────────────────────────────────────────────────────────────────────────────
export const TRAINING_LOG_KEY = 'shadow_monarch_training_log_v1';
export const TRAINING_LOG_EVENT = 'shadow_training_log';

export const WORKOUT_KINDS = {
  strength: { label: 'Forza', color: '#ffd184', icon: 'program' },
  football: { label: 'Calcio', color: '#8fb9ff', icon: 'football' },
  mma: { label: 'MMA', color: '#6de2d3', icon: 'mma' },
  cardio: { label: 'Corsa / cardio', color: '#ff8fd8', icon: 'progress' },
  recovery: { label: 'Mobilità / scarico', color: '#b8a4ff', icon: 'recovery' },
  other: { label: 'Altro', color: '#c9cde6', icon: 'cut' },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Data del giorno `dayIndex` (0 = lunedì) nella settimana di calendario corrente.
export const dateOfWeekday = (dayIndex, now = new Date()) => {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);
  return localDateKey(target);
};

export function readTrainingLog() {
  try {
    const list = JSON.parse(localStorage.getItem(TRAINING_LOG_KEY) || '[]');
    return Array.isArray(list) ? list.filter((e) => e && DATE_RE.test(e.date) && e.title) : [];
  } catch { return []; }
}

function write(list) {
  const sorted = [...list].sort((a, b) => (b.date + (b.ts || '')).localeCompare(a.date + (a.ts || ''))).slice(0, 800);
  try { localStorage.setItem(TRAINING_LOG_KEY, JSON.stringify(sorted)); } catch { /* storage pieno */ }
  try { window.dispatchEvent(new CustomEvent(TRAINING_LOG_EVENT)); } catch { /* niente listener */ }
  return sorted;
}

const sameWorkout = (a, b) => a.date === b.date && a.kind === b.kind && a.title === b.title;

// Aggiunge (una sola volta per stesso giorno/tipo/nome). Ritorna true se è nuova.
export function logWorkout({ date = localDateKey(), kind = 'other', title, minutes = null, source = 'app', note = '' }) {
  if (!DATE_RE.test(date) || !title) return false;
  const entry = { id: `${date}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, date, ts: new Date().toISOString(), kind: WORKOUT_KINDS[kind] ? kind : 'other', title: String(title).slice(0, 80), minutes: Number(minutes) > 0 ? Math.min(600, Math.round(Number(minutes))) : null, source, note: String(note || '').slice(0, 140) };
  const list = readTrainingLog();
  if (list.some((e) => sameWorkout(e, entry))) return false;
  write([entry, ...list]);
  return true;
}

// Toglie la voce quando togli la spunta "fatto" dallo stesso allenamento.
export function unlogWorkout({ date, kind, title }) {
  const list = readTrainingLog();
  const next = list.filter((e) => !sameWorkout(e, { date, kind, title }));
  if (next.length !== list.length) write(next);
}

export function deleteWorkout(id) {
  write(readTrainingLog().filter((e) => e.id !== id));
}

// Statistiche per la pagina Progressi.
export function trainingStats(list, now = new Date()) {
  const week = Array.from({ length: 7 }, (_, i) => dateOfWeekday(i, now));
  const thisWeek = list.filter((e) => week.includes(e.date));
  const monthKey = localDateKey(now).slice(0, 7);
  const month = list.filter((e) => e.date.startsWith(monthKey));
  // settimane consecutive (fino a questa o alla scorsa) con almeno 3 allenamenti
  let streak = 0;
  for (let w = 0; w < 104; w += 1) {
    const ref = new Date(now); ref.setDate(now.getDate() - 7 * w);
    const days = Array.from({ length: 7 }, (_, i) => dateOfWeekday(i, ref));
    const count = list.filter((e) => days.includes(e.date)).length;
    if (count >= 3) streak += 1;
    else if (w === 0) continue; // la settimana in corso può essere ancora a metà
    else break;
  }
  const minutes = month.reduce((sum, e) => sum + (e.minutes || 0), 0);
  return { week, thisWeek, month, streak, minutes };
}

// '30–40 min' → 35, '60 min' → 60, '—' → null
export const durationMinutes = (text) => {
  const nums = String(text || '').match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return null;
  return Math.round(nums.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, nums.length));
};
export const kindForSession = (type) => ({ strength: 'strength', football: 'football', optional: 'mma', recovery: 'recovery' }[type] || 'other');

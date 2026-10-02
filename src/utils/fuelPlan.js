// Obiettivo calorie per chi NON segue il menu fisso (es. Alessandro): sceglie cut o
// bulk e inserisce da sé quello che mangia. Mifflin-St Jeor × attività, poi:
// cut  → −20% (deficit tra 300 e 500 kcal: ~0,3–0,5 kg a settimana)
// bulk → +10% (surplus tra 200 e 350 kcal: ~0,25 kg a settimana, poco grasso in più)

export const EMANUELE_CHAT_ID = '264863579';
export const FUEL_GOALS = ['cut', 'bulk'];
export const ACTIVITY = [
  { id: 'low', label: 'Poco', note: '0–2 allenamenti', factor: 1.4 },
  { id: 'mid', label: 'Medio', note: '3–4 a settimana', factor: 1.55 },
  { id: 'high', label: 'Tanto', note: '5+ a settimana', factor: 1.7 },
];

const round50 = (n) => Math.round(n / 50) * 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Il menu settimanale fisso è scritto per Emanuele: solo il suo telefono lo vede.
export const usesFixedMenu = (chatId) => String(chatId || '') === EMANUELE_CHAT_ID;

export function fuelTargets({ sex = 'm', age, heightCm, weightKg, activity = 'mid', goal = 'cut' } = {}) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'f' ? -161 : 5);
  const factor = (ACTIVITY.find((a) => a.id === activity) || ACTIVITY[1]).factor;
  const tdee = bmr * factor;
  const delta = goal === 'bulk' ? clamp(tdee * 0.1, 200, 350) : -clamp(tdee * 0.2, 300, 500);
  const floor = Math.max(bmr * 1.1, sex === 'f' ? 1200 : 1500);
  const kcal = round50(Math.max(floor, tdee + delta));
  const protein = Math.round(weightKg * (goal === 'bulk' ? 1.8 : 2.0) / 5) * 5;
  const fat = Math.round(weightKg * (goal === 'bulk' ? 1.0 : 0.8) / 5) * 5;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
  const weeklyKg = Math.round(((kcal - tdee) * 7 / 7700) * 100) / 100;
  return { bmr: Math.round(bmr), tdee: round50(tdee), kcal, protein, fat, carbs, weeklyKg };
}

// ── Diario dei cibi inseriti a mano (lista per giorno; i totali vanno anche nel diario dell'app) ──
const LOG_KEY = 'shadow_monarch_fuel_log_v1';
export const readFuelLog = (storage = globalThis.localStorage) => {
  try { const v = JSON.parse(storage?.getItem(LOG_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
};
export const writeFuelLog = (log, storage = globalThis.localStorage) => {
  // tiene solo gli ultimi 60 giorni
  const keys = Object.keys(log).sort().slice(-60);
  try { storage?.setItem(LOG_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, log[k]])))); } catch { /* storage pieno */ }
};

// Cibi usati di recente (senza doppioni, il più recente prima) per riaggiungerli con un tocco
export function recentFoods(log, limit = 8) {
  const seen = new Set(), out = [];
  for (const day of Object.keys(log).sort().reverse()) {
    for (const item of [...(log[day] || [])].reverse()) {
      const key = item.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push({ name: item.name, kcal: item.kcal, protein: item.protein || 0 });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export const FUEL_GOAL_KEY = 'shadow_monarch_fuel_goal';
export const readFuelGoal = (profile) => {
  if (profile?.goal === 'bulk' || profile?.goal === 'cut') return profile.goal;
  try { return globalThis.localStorage?.getItem(FUEL_GOAL_KEY) === 'bulk' ? 'bulk' : 'cut'; } catch { return 'cut'; }
};

export const slotForHour = (h) => (h < 11 ? 'colazione' : h < 15 ? 'pranzo' : h < 18.5 ? 'merenda' : 'cena');

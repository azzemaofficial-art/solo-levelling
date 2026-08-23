// ─────────────────────────────────────────────────────────────────────────────
// Maestria 0-100: il livello del combattente. Curva asintotica lentissima —
// il 100 si raggiunge solo con tantissimo tempo e pratica (mesi/anni di XP).
// Formula: 100 * (1 - e^(-xp/K)). K=8000 → ~63 a 8k XP, ~86 a 16k, ~98 a 32k.
// ─────────────────────────────────────────────────────────────────────────────

export const MASTERY_K = 8000;

export function masteryFromXp(xp, k = MASTERY_K) {
  const v = Math.max(0, Number(xp) || 0);
  return Math.min(100, Math.round(100 * (1 - Math.exp(-v / k))));
}

// progress: { disciplina: { xp } } → somma di tutto l'XP coach.
export function totalXp(progress) {
  return Object.values(progress || {}).reduce((a, d) => a + Math.max(0, Number(d?.xp) || 0), 0);
}

export function globalMastery(progress, k = MASTERY_K) {
  return masteryFromXp(totalXp(progress), k);
}

// Titoli in stile Sistema (gradi E→S, poi Monarca) — solo a quota 100.
export const MASTERY_TITLES = [
  { min: 0, title: 'GRADO E', sub: 'Risvegliato da poco' },
  { min: 10, title: 'GRADO D', sub: 'Cacciatore in crescita' },
  { min: 25, title: 'GRADO C', sub: 'Combattente vero' },
  { min: 45, title: 'GRADO B', sub: 'Elite del Sistema' },
  { min: 65, title: 'GRADO A', sub: 'Quasi leggenda' },
  { min: 85, title: 'GRADO S', sub: 'Livello nazionale' },
  { min: 100, title: 'MONARCA', sub: 'Oltre il Sistema' },
];

export function masteryTitle(level) {
  const l = Math.min(100, Math.max(0, Math.round(Number(level) || 0)));
  let pick = MASTERY_TITLES[0];
  for (const t of MASTERY_TITLES) if (l >= t.min) pick = t;
  return pick;
}

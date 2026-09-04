// ─────────────────────────────────────────────────────────────────────────────
// LA SCALATA — motore di progressione epico (100 livelli del combattente).
// Ogni sblocco dipende da TRE pilastri combinati:
//   🎖 ESPERIENZA  (XP accumulato in sessioni/quest/sparring)
//   ⏳ COSTANZA    (giorni reali di allenamento — la scalata dura anni)
//   🥊 COMBATTIMENTO (Fight IQ + voto medio del maestro)
//
// Cancello MORBIDO sul tempo: se combatti molto meglio del richiesto
// (Fight IQ e voti alti), parte dei giorni necessari viene condonata.
// ─────────────────────────────────────────────────────────────────────────────

// ── Costanti della scalata ──
export const XP_CAP = 60000;      // XP per portare ESPERIENZA a 100
export const DAYS_CAP = 600;      // giorni di allenamento per COSTANZA a 100
export const MAX_LEVEL = 100;

// Peso dei pilastri sul livello combattente (somma = 1)
export const WEIGHTS = { esper: 0.4, costanza: 0.3, combat: 0.3 };

// ── Pilastri → 0-100 ──
export function pillarEsperienza(xp) {
  const x = Math.max(0, Number(xp) || 0);
  return Math.min(100, Math.round(100 * Math.sqrt(x / XP_CAP)));
}

export function pillarCostanza(days) {
  const d = Math.max(0, Number(days) || 0);
  return Math.min(100, Math.round((100 * d) / DAYS_CAP));
}

// combat unisce Fight IQ e voto medio del maestro (60% IQ, 40% voto)
export function pillarCombattimento(fightIq, avgScore) {
  const iq = Math.min(100, Math.max(0, Number(fightIq) || 0));
  const sc = Math.min(100, Math.max(0, Number(avgScore) || 0));
  return Math.round(0.6 * iq + 0.4 * sc);
}

// Profilo del combattente: { xp, days, fightIq, avgScore }
export function pillarLevels(profile = {}) {
  return {
    esper: pillarEsperienza(profile.xp),
    costanza: pillarCostanza(profile.days),
    combat: pillarCombattimento(profile.fightIq, profile.avgScore),
  };
}

// LIVELLO COMBATTENTE (1-100): media pesata dei tre pilastri.
export function fighterLevel(profile = {}) {
  const p = pillarLevels(profile);
  const lvl = WEIGHTS.esper * p.esper + WEIGHTS.costanza * p.costanza + WEIGHTS.combat * p.combat;
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(lvl) || 1));
}

// ── Mappatura livello-tecnica → livello combattente richiesto ──
// lvl 1-5 esistente → fighter level; tecniche nuove usano direttamente `fl`.
const LVL_TO_FL = { 1: 1, 2: 12, 3: 28, 4: 50, 5: 75 };
export function lvlToFl(lvl) {
  return LVL_TO_FL[Math.min(5, Math.max(1, Math.round(lvl || 1)))] ?? 1;
}

// ── Cancello per contenuti avanzati (giorni + IQ minimi) ──
// Più sei in alto nella scalata, più servono giorni reali e Fight IQ.
export function gateFor(fl) {
  const f = Math.max(0, Number(fl) || 0);
  if (f >= 95) return { minDays: 365, minIq: 78 };
  if (f >= 80) return { minDays: 180, minIq: 66 };
  if (f >= 60) return { minDays: 90, minIq: 52 };
  if (f >= 40) return { minDays: 30, minIq: 40 };
  return { minDays: 0, minIq: 0 };
}

// Cancello MORBIDO: se il combattimento è molto sopra la soglia,
// condona metà dei giorni richiesti.
export function effectiveMinDays(gate, profile = {}) {
  if (!gate.minDays) return 0;
  const iq = Math.max(0, Number(profile.fightIq) || 0);
  const sc = Math.max(0, Number(profile.avgScore) || 0);
  const overAchieving = iq >= gate.minIq + 15 && sc >= 80;
  return overAchieving ? Math.ceil(gate.minDays / 2) : gate.minDays;
}

// ── Valuta uno sblocco ──
// item: { fl? } oppure { lvl? } (+ eventuali minDays/minIq override)
// Ritorna { unlocked, fl, missing: { level, days, iq } } — missing è ciò che manca.
export function evalUnlock(item = {}, profile = {}) {
  const level = profile.level ?? fighterLevel(profile);
  const fl = item.fl != null ? item.fl : lvlToFl(item.lvl);
  const gate = { ...gateFor(fl), ...(item.minDays != null ? { minDays: item.minDays } : {}), ...(item.minIq != null ? { minIq: item.minIq } : {}) };

  const missing = { level: 0, days: 0, iq: 0 };
  let ok = true;

  if (level < fl) { missing.level = fl - level; ok = false; }

  const needDays = effectiveMinDays(gate, profile);
  const days = Math.max(0, Number(profile.days) || 0);
  if (needDays > 0 && days < needDays) { missing.days = needDays - days; ok = false; }

  const iq = Math.max(0, Number(profile.fightIq) || 0);
  if (gate.minIq > 0 && iq < gate.minIq) { missing.iq = gate.minIq - iq; ok = false; }

  return { unlocked: ok, fl, missing };
}

// ── Titoli del combattente lungo la scalata (stile Solo Leveling) ──
export const LEVEL_TITLES = [
  { min: 1, title: 'RISVEGLIATO', sub: 'Il Sistema ti ha notato' },
  { min: 10, title: 'CACCIA-GRADO E', sub: 'Il primo passo della scalata' },
  { min: 20, title: 'CACCIA-GRADO D', sub: 'Le fondamenta si consolidano' },
  { min: 30, title: 'CACCIA-GRADO C', sub: 'Combattente vero' },
  { min: 40, title: 'ÉLITE', sub: 'Il livello si alza' },
  { min: 50, title: 'CACCIA-GRADO B', sub: 'Pochi arrivano qui' },
  { min: 60, title: 'VETERANO', sub: 'La costanza forgia' },
  { min: 70, title: 'CACCIA-GRADO A', sub: 'A un passo dalla vetta' },
  { min: 80, title: 'GRADO A', sub: 'Quasi leggenda' },
  { min: 90, title: 'GRADO S', sub: 'Livello nazionale' },
  { min: 100, title: 'MONARCA', sub: 'Oltre il Sistema — vetta della scalata' },
];

export function levelTitle(level) {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.round(level) || 1));
  let pick = LEVEL_TITLES[0];
  for (const t of LEVEL_TITLES) if (l >= t.min) pick = t;
  return pick;
}

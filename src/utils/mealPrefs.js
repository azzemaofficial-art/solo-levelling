// Gusti nel menu: 👍 / 👎 su ogni piatto non fisso.
// 👎 = il piatto esce da tutte le settimane del piano; al suo posto entra un piatto dello stesso
// gruppo (colazione, pranzo, spuntino, cena…) con calorie e proteine simili, scelto in modo che
// la dieta resti dieta: ogni giorno entro ±150 kcal, proteine minime, fibre ≥ 25 g, frutta e
// verdura ≥ 400 g; ogni settimana pesce ≥ 3 con il salmone, carne rossa ≤ 3, affettati ≤ 2,
// legumi in almeno 3 giorni, patate dolci ≤ 1, pollo al forno ≤ 1, almeno 3 colazioni dolci.
// 👍 = il piatto non viene mai tolto ed è il primo candidato quando serve un sostituto.
// Le preferenze stanno nel piano salvato sul telefono (CUT_PLAN_KEY → mealPrefs).
import { dayTargets, swapGroup, swapPools } from '../data/cutPlan.js';
import { mealRecipes } from '../data/mealRecipes.js';

// proteine minime del giorno (come i test del piano): 140 col McDonald’s, 135 la domenica
export const MIN_PROTEIN = [150, 150, 140, 150, 150, 150, 135];

const recipe = (meal) => mealRecipes[meal] || {};
const has = (meal, tag) => Boolean(recipe(meal).tags?.includes(tag));
const salmon = (meal) => /salmone/i.test(meal);
const sum = (slots, key) => slots.reduce((a, s) => a + (recipe(s.meal)[key] || 0), 0);

export function dayOk(slots, day) {
  return Math.abs(sum(slots, 'kcal') - dayTargets[day]) <= 150 && sum(slots, 'protein') >= MIN_PROTEIN[day]
    && sum(slots, 'fiber') >= 25 && sum(slots, 'fv') >= 400;
}

// Di quanto la settimana esce dalle regole (0 = tutto a posto): kcal oltre ±150, grammi di
// proteine, fibre e frutta/verdura mancanti, e ogni regola settimanale non rispettata.
export function weekBadness(week) {
  let bad = 0;
  week.forEach((d, day) => {
    bad += Math.max(0, Math.abs(sum(d.slots, 'kcal') - dayTargets[day]) - 150) / 50 + Math.max(0, MIN_PROTEIN[day] - sum(d.slots, 'protein')) / 5
      + Math.max(0, 25 - sum(d.slots, 'fiber')) / 3 + Math.max(0, 400 - sum(d.slots, 'fv')) / 50;
  });
  const meals = week.flatMap((d) => d.slots.map((s) => s.meal));
  const count = (tag) => meals.filter((m) => has(m, tag)).length;
  const legumeDays = week.filter((d) => d.slots.some((s) => has(s.meal, 'legumi'))).length;
  const sweetBreakfasts = week.slice(0, 5).filter((d) => has(d.slots[0].meal, 'dolce')).length;
  bad += Math.max(0, 3 - count('pesce')) + (meals.some(salmon) ? 0 : 1) + Math.max(0, count('carne rossa') - 3) + Math.max(0, count('affettati') - 2)
    + Math.max(0, 3 - legumeDays) + Math.max(0, count('patate dolci') - 1) + Math.max(0, count('pollo al forno') - 1) + Math.max(0, 3 - sweetBreakfasts);
  return bad;
}
export const weekOk = (week) => week.every((d, day) => dayOk(d.slots, day)) && weekBadness(week) === 0;
const problems = weekBadness;

// quanto un candidato si allontana dal piatto tolto (più basso = più simile; i 👍 passano davanti)
function distance(orig, cand, prefs, usedInWeek) {
  const a = recipe(orig), b = recipe(cand.meal);
  let d = Math.abs(a.kcal - b.kcal) / 40 + Math.abs(a.protein - b.protein) / 4 + Math.abs((a.fiber || 0) - (b.fiber || 0)) / 3;
  if (has(orig, 'pesce') && !has(cand.meal, 'pesce')) d += 4;
  if (salmon(orig) && !salmon(cand.meal)) d += 2;
  if (has(orig, 'legumi') !== has(cand.meal, 'legumi')) d += 1.5;
  if (has(orig, 'dolce') !== has(cand.meal, 'dolce')) d += 2;
  if (has(orig, 'fit porn') && !has(cand.meal, 'fit porn')) d += 1;
  if (usedInWeek.has(cand.id)) d += 3;
  if (prefs[cand.id] === 'up') d -= 3;
  return d;
}

// tutte le mosse possibili su un posto: i piatti del suo gruppo, tranne i 👎 e quelli già nel giorno
function moves(week, day, i, prefs) {
  const s = week[day].slots[i], group = swapGroup(day, i);
  if (!group) return [];
  const orig = s.swappedFrom || s.meal;
  const usedInWeek = new Set(week.flatMap((x) => x.slots.map((y) => y.id)));
  const inDay = new Set(week[day].slots.map((y) => y.id));
  return (swapPools[group] || [])
    .filter((c) => prefs[c.id] !== 'down' && !inDay.has(c.id))
    .map((c) => ({ day, i, c, dist: distance(orig, c, prefs, usedInWeek) }));
}
function apply(week, { day, i, c }, reason) {
  return week.map((d, k) => {
    if (k !== day) return d;
    const slots = d.slots.slice(), s = slots[i];
    slots[i] = { ...s, id: c.id, meal: c.meal, image: c.image, swappedFrom: s.swappedFrom || s.meal, swapReason: s.swapReason || reason };
    return { ...d, slots };
  });
}

// Piano con le preferenze applicate. Ogni posto cambiato porta swappedFrom (il piatto tolto) e
// swapReason: 'gusto' (era un 👎) o 'equilibrio' (cambiato per tenere a posto la dieta).
export function applyMealPrefs(weeks, prefs = {}) {
  if (!Object.values(prefs).includes('down')) return weeks;
  return weeks.map((baseWeek) => {
    let week = baseWeek;
    // 1) ogni 👎 prende il sostituto più simile che lascia giorno e settimana a posto
    baseWeek.forEach((d, day) => d.slots.forEach((s, i) => {
      if (prefs[s.id] !== 'down' || !swapGroup(day, i)) return;
      const ranked = moves(week, day, i, prefs).sort((x, y) => x.dist - y.dist || (x.c.id < y.c.id ? -1 : 1));
      const pick = ranked.find((m) => problems(apply(week, m)) === 0) || ranked.find((m) => dayOk(apply(week, m)[day].slots, day)) || ranked[0];
      if (pick) week = apply(week, pick, 'gusto');
    }));
    // 2) se qualcosa non torna (es. senza il bagel manca il salmone), si cambia un altro piatto
    // della settimana, mai uno col 👍: la mossa che toglie più problemi, a parità la più simile
    for (let round = 0; round < 6 && problems(week) > 0; round += 1) {
      const now = problems(week);
      let best = null;
      week.forEach((d, day) => d.slots.forEach((s, i) => {
        if (prefs[s.id] === 'up') return;
        for (const m of moves(week, day, i, prefs)) {
          if (m.c.id === s.id) continue;
          const p = problems(apply(week, m));
          if (p < now - 1e-9 && (!best || p < best.p - 1e-9 || (Math.abs(p - best.p) < 1e-9 && m.dist + (s.swappedFrom ? 0 : 2) < best.cost))) best = { m, p, cost: m.dist + (s.swappedFrom ? 0 : 2) };
        }
      }));
      if (!best) break;
      week = apply(week, best.m, 'equilibrio');
    }
    return week;
  });
}

// 👍 / 👎: premere di nuovo lo stesso pollice toglie la preferenza
export function togglePref(prefs = {}, id, value) {
  const next = { ...prefs };
  if (next[id] === value) delete next[id]; else next[id] = value;
  return next;
}

// Verifica giorno per giorno il calendario di scripts/menu/calendario.json con le regole del menu.
import { readFileSync } from 'node:fs';
import { RECIPES, analyze, cost } from './nutri.mjs';
import { TARGET, PMIN, SWEET, FORNO, FITPORN } from './cerca-calendario.mjs';

const A = Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, analyze(v)]));
const weeks = JSON.parse(readFileSync(new URL('./calendario.json', import.meta.url))).weeks;
const names = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const all = []; let bad = 0;
weeks.forEach((w, wi) => {
  const ts = w.map((m) => { const t = m.map((id) => A[id]).reduce((x, y) => Object.fromEntries(Object.keys(x).map((k) => [k, x[k] + y[k]]))); t.fatPct = (t.fat * 9) / t.kcal * 100; t.m = m; return t; });
  const sum = (k) => ts.reduce((a, t) => a + t[k], 0), ids = w.flat();
  console.log(`Settimana ${wi + 1}: pesce ${sum('fish')}, carne rossa ${sum('red')}, affettati ${sum('processed')}, legumi ${ts.filter((t) => t.legumes > 0).length} giorni, patate dolci ${ids.filter((k) => SWEET.has(k)).length}, pollo al forno ${ids.filter((k) => FORNO.has(k)).length}, fit porn ${ids.filter((k) => FITPORN.has(k)).length}`);
  ts.forEach((t, d) => {
    all.push(t);
    const why = [Math.abs(t.kcal - TARGET[d]) > 150 && 'kcal', t.protein < PMIN[d] - 1 && 'proteine', t.fiber < 25 && 'fibre', t.veg + t.fruit < 400 && 'frutta/verdura', (t.fatPct < 15 || t.fat < 45) && 'grassi bassi', t.fatPct > 35 && 'grassi alti'].filter(Boolean);
    if (why.length) { bad++; console.log(`  S${wi + 1} ${names[d]}: ${why.join(', ')} (${Math.round(t.kcal)} kcal, P${Math.round(t.protein)}, fibre ${Math.round(t.fiber)}, f+v ${Math.round(t.veg + t.fruit)}, grassi ${Math.round(t.fat)} g)`); }
  });
});
const avg = (f) => Math.round(all.reduce((a, t) => a + f(t), 0) / all.length);
const meals = [...new Set(weeks.flat(2))].filter((id) => !['mcd', 'pizza', 'drinks2', 'mamma', 'cavallo', 'piadine', 'cracker'].includes(id));
const cari = meals.map((id) => [id, cost(RECIPES[id])]).filter(([, c]) => c > 4);
console.log(`giorni fuori: ${bad}/42 | media: ${avg((t) => t.kcal)} kcal, proteine ${avg((t) => t.protein)} g, fibre ${avg((t) => t.fiber)} g, frutta+verdura ${avg((t) => t.veg + t.fruit)} g, grassi ${avg((t) => t.fat)} g, frutta secca ${avg((t) => t.nuts)} g, integrali ${avg((t) => t.wholeGrain)} g | ricette oltre 4 €: ${cari.map(([id, c]) => id + ' ' + c).join(', ') || 'nessuna'}`);

// Cerca l'ordine delle 6 settimane che rispetta tutte le regole del menu di Emanuele (v5, ottobre 2026).
// Uso: node scripts/menu/cerca-calendario.mjs  → scrive scripts/menu/calendario.json
// Poi: node scripts/menu/controlla-calendario.mjs (verifica) e si copia il calendario in src/data/cutPlan.js.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { RECIPES, analyze } from './nutri.mjs';

const A = Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, analyze(v)]));
const W = 6;
export const TARGET = [2750, 2250, 2300, 2750, 2200, 2350, 2750];
// proteine minime: 150 g; 140 col McDonald’s; 135 la domenica (latte e Gocciole, pranzo dalla mamma, pizza)
export const PMIN = [155, 150, 141, 155, 150, 150, 136];
export const SWEET = new Set(['d_smash', 'd_loaded', 'd_fishChips']);
// salmone (lo ama, anche crudo): almeno una volta a settimana
export const SALMON = new Set(['l_poke', 'd_chirashi', 'd_salmonTeri', 'b_bagel']);
export const FORNO = new Set(['polloCroccante', 'l_katsu', 'l_crispyBun']);
export const FITPORN = new Set(['waffle', 'b_pancake', 'b_choco', 'oatsCheesecake', 'bananaBread', 'b_tamago', 'b_jianbing', 'b_mango',
  'l_crispyBun', 'l_burrito', 'wrapSmash', 'l_katsu', 'l_oyakodon', 'l_kimbap', 'l_bulgogi', 'l_butadon', 'l_peanutBowl', 'l_tunaDon',
  'd_teriyaki', 'd_bibimbap', 'd_ramen', 'd_padthai', 'd_bulgogiTacos', 'd_loaded', 'd_smash', 'd_meatballs', 'd_cantonese', 'd_okonomiyaki',
  'd_curryJap', 'd_fishTacos', 'd_fishChips', 'd_lemonChicken', 'd_yakitori', 's_pudding', 's_onigiri', 'mon_kor', 'mon_teri', 'l_poke', 'd_chirashi', 'd_salmonTeri', 'd_tataki', 'b_bagel']);
// colazioni dolci (almeno 3 su 5 nei giorni feriali: "non solo salate")
export const DOLCE = new Set(['oatsCheesecake', 'b_choco', 'waffle', 'b_pancake', 'b_toastPB', 'yogurtBowl', 'b_mango', 'b_porridge', 'bananaBread']);
export const POOLS = {
  B: ['oatsCheesecake', 'b_choco', 'waffle', 'b_pancake', 'b_toastPB', 'yogurtBowl', 'b_mango', 'b_porridge', 'bananaBread', 'toast', 'piadina', 'b_omelette', 'b_tamago', 'b_jianbing', 'b_bagel'],
  L: ['riceBowl', 'pastaTonno', 'wrapSmash', 'farro', 'l_beefNoodles', 'l_crispyBun', 'l_coldPasta', 'l_burrito', 'l_butadon', 'l_katsu', 'l_oyakodon', 'l_kimbap', 'l_bulgogi', 'l_peanutBowl', 'l_tunaDon', 'l_poke'],
  S: ['skyrSalato', 'bresaola', 's_pudding', 'fiocchi', 'edamame', 'yogurtCacao', 's_yogurtNoci', 's_onigiri', 's_skyrFruit'],
  D: ['d_teriyaki', 'd_bulgogiTacos', 'd_ramen', 'd_curryJap', 'd_beefBroccoli', 'd_bibimbap', 'd_padthai', 'd_meatballs', 'tacosFit', 'polloCroccante',
    'd_okonomiyaki', 'd_cantonese', 'd_smash', 'd_loaded', 'd_fishTacos', 'd_fishChips', 'd_lemonChicken', 'd_yakitori', 'd_salmonTeri', 'd_chirashi', 'd_tataki'],
  P: ['p_gnocchi', 'p_pasta', 'p_udon'],
  MON: ['mon_kor', 'mon_ginger', 'mon_lemon', 'mon_teri', 'mon_mex', 'mon_thai'],
  FRI: ['s_skyrFruit', 's_pudding', 's_yogurtNoci'],
};
export function build(X) {
  const it = { B: 0, L: 0, S: 0, D: 0 };
  const take = (k) => X[k][it[k]++ % X[k].length];
  const weeks = [];
  for (let w = 0; w < W; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const m = [];
      m.push(d <= 4 ? take('B') : 'b_gocciole');
      if (d === 0) m.push('cracker', 'piadine', X.MON[w % X.MON.length]);
      if (d >= 1 && d <= 4) m.push(take('L'));
      if (d === 5) m.push('cavallo');
      if (d === 6) m.push('mamma');
      if (d === 4) m.push(X.FRI[w % X.FRI.length]); else if (d === 6) m.push('s_skyrPlain'); else if (d !== 0) m.push(take('S'));
      if ([1, 4, 5].includes(d)) m.push(take('D'));
      if (d === 2) m.push('mcd');
      if (d === 3) m.push(X.P[w % X.P.length]);
      if (d === 4) m.push('drinks2');
      if (d === 6) m.push('pizza');
      if (d === 0 || d === 3) { const k = w * 2 + (d === 3 ? 1 : 0); m.push(k % 2 ? 'pre_toast' : 'pre_banana', ['post_banana', 'post_yogurt', 'post_toast'][k % 3]); }
      const t = m.map((id) => A[id]).reduce((x, y) => Object.fromEntries(Object.keys(x).map((k) => [k, x[k] + y[k]])));
      t.fatPct = (t.fat * 9) / t.kcal * 100;
      days.push({ m, t });
    }
    weeks.push(days);
  }
  return weeks;
}
export function weekStats(days) {
  const all = days.flatMap((x) => x.m), sum = (k) => days.reduce((a, x) => a + x.t[k], 0);
  return { fish: sum('fish'), red: sum('red'), processed: sum('processed'), legDays: days.filter((x) => x.t.legumes > 0).length,
    sweet: all.filter((k) => SWEET.has(k)).length, dolci: days.slice(0, 5).filter((x) => DOLCE.has(x.m[0])).length, forno: all.filter((k) => FORNO.has(k)).length, salmon: all.filter((k) => SALMON.has(k)).length, fp: all.filter((k) => FITPORN.has(k)).length };
}
export function score(weeks) {
  let s = 0;
  weeks.forEach((days) => {
    days.forEach(({ t }, d) => {
      s += Math.max(0, Math.abs(t.kcal - TARGET[d]) - 100) ** 2 / 25 + Math.max(0, PMIN[d] - t.protein) * 20 + Math.max(0, 25.5 - t.fiber) * 40
        + Math.max(0, 405 - t.veg - t.fruit) * 2 + Math.max(0, 15 - t.fatPct) * 40 + Math.max(0, 46 - t.fat) * 20 + Math.max(0, t.fatPct - 35) * 40;
    });
    const w = weekStats(days);
    s += Math.max(0, 3 - w.fish) * 400 + Math.max(0, 1 - w.salmon) * 400 + Math.max(0, w.red - 3) * 400 + Math.max(0, w.processed - 2) * 300 + Math.max(0, 3 - w.legDays) * 300
      + Math.max(0, 3 - w.dolci) * 300 + Math.max(0, w.sweet - 1) * 500 + Math.max(0, w.forno - 1) * 400 + Math.max(0, 7 - w.fp) * 300;
  });
  return s;
}

if (process.argv[1]?.endsWith('cerca-calendario.mjs')) {
  const FILE = new URL('./calendario.json', import.meta.url);
  let rnd = 4242; const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
  let best = { s: Infinity };
  for (let restart = 0; restart < 6 && best.s > 0; restart++) {
    // si riparte dal calendario salvato (se c’è), poi tentativi da zero
    const seed = (X) => Object.fromEntries(Object.entries(POOLS).map(([k, v]) => [k, [...(X[k] || []).filter((id) => v.includes(id)), ...v.filter((id) => !(X[k] || []).includes(id))]]));
    let cur = restart === 0 && existsSync(FILE) ? seed(JSON.parse(readFileSync(FILE)).X) : Object.fromEntries(Object.entries(POOLS).map(([k, v]) => [k, v.slice().sort(() => rand() - 0.5)]));
    let curS = score(build(cur));
    const N = 300000;
    for (let i = 0; i < N && best.s > 0; i++) {
      const keys = Object.keys(POOLS), key = keys[Math.floor(rand() * keys.length)];
      const a = cur[key].slice(); const x = Math.floor(rand() * a.length), y = Math.floor(rand() * a.length); [a[x], a[y]] = [a[y], a[x]];
      const nxt = { ...cur, [key]: a }; const s = score(build(nxt)); const T = (restart === 0 && existsSync(FILE) ? 5 : 80) * (1 - i / N) + 0.01;
      if (s <= curS || rand() < Math.exp((curS - s) / T)) { cur = nxt; curS = s; }
      if (curS < best.s) best = { s: curS, X: cur };
    }
    console.log(`tentativo ${restart + 1}: punteggio ${best.s.toFixed(1)}`);
  }
  const weeks = build(best.X);
  weeks.forEach((days, w) => { const s = weekStats(days); console.log(`Settimana ${w + 1}: pesce ${s.fish} (salmone ${s.salmon}), rossa ${s.red}, affettati ${s.processed}, legumi ${s.legDays} giorni, patate dolci ${s.sweet}, pollo al forno ${s.forno}, colazioni dolci ${s.dolci}/5, fit porn ${s.fp}`); });
  writeFileSync(FILE, JSON.stringify({ X: best.X, weeks: weeks.map((d) => d.map((x) => x.m)) }));
  console.log('salvato; punteggio finale', best.s.toFixed(1), existsSync(FILE) ? '' : '(errore)');
}

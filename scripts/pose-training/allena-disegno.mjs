// Allena lo scheletro disegnato sul video V7: prova combinazioni di filtro + disegnatore (seme fisso),
// poi affina un parametro alla volta. Stampa la ricetta migliore da copiare in lib/poseFilter.js
// (DISPLAY_FILTER) e lib/poseView.js (VIEW).
// Uso: node scripts/pose-training/allena-disegno.mjs [prove=300]
import { createPoseFilter, createImageFilter, DISPLAY_FILTER, IMAGE_FILTER } from '../../lib/poseFilter.js';
import { VIEW } from '../../lib/poseView.js';
import { available, loadV7 } from './dati.mjs';
import { measure, fmt } from './misura.mjs';

if (!available()) { console.log('Mancano i dati privati in tests/fixtures/private/ (vedi README).'); process.exit(0); }
const ds = loadV7();
const tries = Number(process.argv[2] || 300);
const clone = (x) => JSON.parse(JSON.stringify(x));
const run = (c) => measure(ds, () => createImageFilter(c.F), c.V);

console.log('com’era (filtro unico, disegno a scatti)'.padEnd(42), fmt(measure(ds, () => createPoseFilter(IMAGE_FILTER), 'step')));
const now = { F: clone(DISPLAY_FILTER), V: clone(VIEW) };
let best = { c: now, r: run(now) };
console.log('ricetta attuale'.padEnd(42), fmt(best.r));

let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
for (let i = 0; i < tries; i += 1) {
  const c = {
    F: { core: [pick([0.5, 0.8, 1.2, 1.6]), pick([5, 10, 20, 30])], elbow: [pick([0.5, 1, 2]), pick([10, 20, 40])], wrist: [pick([1, 2, 3, 4]), pick([10, 20, 30, 40])],
      leg: [pick([0.5, 0.8, 1.2]), pick([5, 10, 20])], dCutoff: pick([1, 2]), visLow: pick([null, 0.4, 0.6, 0.8]), overflow: 0.3, resetMs: 400,
      maxSpeed: pick([null, { core: 2, elbow: 8, wrist: 12, leg: 5 }, { core: 3, elbow: 8, wrist: 12, leg: 5 }]) },
    V: { ...VIEW, hMax: pick([60, 80, 120]), gain: pick([0.4, 0.6, 0.8]), follow: pick([25, 35, 50, 70]) },
  };
  const r = run(c);
  if (r.score < best.r.score) best = { c, r };
}
const set = (c, path, v) => { const k = path.split('.'); let o = c; while (k.length > 1) o = o[k.shift()]; o[k[0]] = v; };
const knobs = [['F.core.0', [0.8, 1.2, 1.6, 2]], ['F.core.1', [10, 20, 30, 40]], ['F.elbow.0', [1, 2, 3]], ['F.elbow.1', [20, 40, 60]],
  ['F.wrist.0', [2, 3, 4, 5]], ['F.wrist.1', [20, 30, 40]], ['F.leg.0', [0.8, 1.2, 1.6]], ['F.leg.1', [10, 20, 30]], ['F.visLow', [null, 0.6, 0.8]],
  ['V.hMax', [60, 80, 120]], ['V.gain', [0.4, 0.5, 0.6, 0.8]], ['V.follow', [35, 40, 50, 60]]];
for (const [path, vals] of knobs) for (const v of vals) {
  const c = clone(best.c); if (!c.F.maxSpeed && path.startsWith('F.maxSpeed')) continue; set(c, path, v);
  const r = run(c);
  if (r.score < best.r.score - 1e-4) best = { c, r };
}
console.log('migliore trovata'.padEnd(42), fmt(best.r));
console.log('DISPLAY_FILTER =', JSON.stringify(best.c.F));
console.log('VIEW =', JSON.stringify(best.c.V));

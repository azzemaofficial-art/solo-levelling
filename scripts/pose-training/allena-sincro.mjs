// Video e scheletro sincronizzati (17/10/2026): confronta la catena di prima (video in diretta +
// scheletro previsto) con quella nuova (si mostra il fotogramma letto col suo scheletro), su tre
// telefoni simulati: il modello impiega 33, 40 o 45 ms a fotogramma. Con "cerca N" prova N ricette
// del filtro del disegno (DISPLAY_FILTER) e del sincronizzatore (SYNC) e stampa la migliore.
// Uso: node scripts/pose-training/allena-sincro.mjs [cerca 40]
import { createImageFilter, DISPLAY_FILTER } from '../../lib/poseFilter.js';
import { SYNC, VIEW } from '../../lib/poseView.js';
import { available, loadV7 } from './dati.mjs';
import { fmt, fmtTime, measureLive, measureSync, schedule } from './misura.mjs';

if (!available()) { console.log('Mancano i dati privati in tests/fixtures/private/ (vedi README).'); process.exit(0); }
const ds = loadV7();
const clone = (x) => JSON.parse(JSON.stringify(x));
const show = (name, r) => console.log(`${name}\n  ${fmt(r)}\n  ${fmtTime(r)}`);

if (process.argv[2] !== 'cerca') {
  for (const inf of [33, 40, 45]) {
    console.log(`\n— telefono simulato: modello ${inf} ms a fotogramma —`);
    show('prima: video in diretta + scheletro previsto', measureLive(ds, schedule(ds, 'raf', { inf }), () => createImageFilter(DISPLAY_FILTER), VIEW));
    show('dopo: fotogramma letto + il suo scheletro', measureSync(ds, schedule(ds, 'subito', { inf }), () => createImageFilter(DISPLAY_FILTER), SYNC, VIEW));
  }
  process.exit(0);
}

// ricerca: si sceglie sul telefono a 40 ms (prima metà dei pugni conta come tutto il resto: seme fisso)
const tries = Number(process.argv[3] || 40);
const sc = schedule(ds, 'subito', { inf: 40 });
const run = (c) => measureSync(ds, sc, () => createImageFilter(c.F), c.S, VIEW);
let best = { c: { F: clone(DISPLAY_FILTER), S: clone(SYNC) } };
best.r = run(best.c);
console.log('ricetta attuale'.padEnd(20), fmt(best.r), '·', fmtTime(best.r));
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
for (let i = 0; i < tries; i += 1) {
  const c = clone(best.c);
  c.F.core = [pick([0.8, 1.2, 1.6, 2.4]), pick([10, 20, 30, 50])];
  c.F.elbow = [pick([1, 2, 3, 4]), pick([20, 40, 60])];
  c.F.wrist = [pick([2, 3, 4, 6]), pick([20, 30, 50, 80])];
  c.F.leg = [pick([0.8, 1.2, 1.6]), pick([10, 20, 30])];
  c.F.visLow = pick([null, 0.6, 0.8]);
  c.F.dCutoff = pick([1, 2, 3]);
  const r = run(c);
  if (r.score < best.r.score - 1e-4) { best = { c, r }; console.log(`prova ${i}`.padEnd(20), fmt(r)); }
}
console.log('migliore trovata'.padEnd(20), fmt(best.r), '·', fmtTime(best.r));
console.log('DISPLAY_FILTER =', JSON.stringify(best.c.F));

// Il giudice dei colpi legge meglio con un altro filtro? Prova sul V7 (195 pugni), divisa in due metà:
// si sceglie sulla prima, si controlla sulla seconda (mai vista). Il 10/10/2026 nessun filtro ha
// migliorato la seconda metà: il giudice resta su IMAGE_FILTER.
// Uso: node scripts/pose-training/prova-giudice.mjs
import { createComboJudge } from '../../lib/mmaComboJudge.js';
import { createPoseFilter, createImageFilter, DISPLAY_FILTER, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';
import { available, loadV7 } from './dati.mjs';
import { schedule } from './misura.mjs';

if (!available()) { console.log('Mancano i dati privati in tests/fixtures/private/ (vedi README).'); process.exit(0); }
const ds = loadV7(), { v7 } = ds;
const ARM = { jab: 'lead', hook: 'lead', uppercut: 'lead', cross: 'rear', rearHook: 'rear', rearUppercut: 'rear' };

// sched: quali fotogrammi legge il telefono e con che tempo ([{ i, t }], da misura.mjs → schedule);
// senza, tutti i fotogrammi col loro tempo vero
export function judge(makeFilter, sched = null) {
  const imgF = makeFilter(), wF = createPoseFilter(WORLD_FILTER), j = createComboJudge({ stance: v7.stance }), gs = [];
  (sched || v7.frames.map((f, i) => ({ i, t: f[0] }))).forEach(({ i: fi, t }, i) => {
    const [, p, w] = v7.frames[fi];
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    v7.j.forEach((jj, k) => {
      points[jj] = { x: p[k * 3] / 1000, y: p[k * 3 + 1] / 1000, visibility: p[k * 3 + 2] / 100 };
      world[jj] = { x: w[k * 3] / 1000, y: w[k * 3 + 1] / 1000, z: w[k * 3 + 2] / 1000, visibility: p[k * 3 + 2] / 100 };
    });
    const pf = imgF.apply(points, t, v7.aspect), wf = wF.apply(world, t);
    if (i < 12) { j.calibrate(wf, pf, v7.aspect); return; }
    const before = j.gestures().length;
    j.push(wf, t, pf, v7.aspect);
    gs.push(...j.gestures().slice(before).filter((g) => g.limb === 'arm' && g.kind !== 'drop'));
  });
  const T0 = v7.frames[0][0], T1 = v7.frames.at(-1)[0], mid = (T0 + T1) / 2;
  const part = (inPart) => {
    const labels = v7.labels.filter((l) => inPart(l.t0)), used = new Set();
    let seen = 0, right = 0;
    for (const l of labels) {
      const c = gs.map((g, i) => ({ g, i })).filter(({ g, i }) => !used.has(i) && g.peakT >= l.t0 - 100 && g.peakT <= l.t1 + 200);
      const m = c.find(({ g }) => g.side === ARM[l.move]) || c[0];
      if (m) { used.add(m.i); seen += 1; if (m.g.side === ARM[l.move]) right += 1; }
    }
    const extra = gs.filter((g, i) => inPart(g.peakT) && !used.has(i) && !v7.labels.some((l) => g.peakT >= l.t0 - 300 && g.peakT <= l.t1 + 400)).length;
    return `visti ${Math.round((seen / labels.length) * 100)}% · braccio giusto ${Math.round((right / labels.length) * 100)}% · inventati ${(extra / ((T1 - T0) / 120000)).toFixed(1)}/min`;
  };
  return `prima metà: ${part((t) => t < mid)} | seconda metà: ${part((t) => t >= mid)}`;
}

console.log('filtro del giudice (IMAGE_FILTER)'.padEnd(34), judge(() => createPoseFilter(IMAGE_FILTER)));
console.log('filtro del disegno (DISPLAY_FILTER)'.padEnd(34), judge(() => createImageFilter(DISPLAY_FILTER)));
console.log('nessun filtro'.padEnd(34), judge(() => ({ apply: (p) => p })));

// 17/10/2026: la catena del telefono cambia l'input del giudice (stesso filtro IMAGE_FILTER):
// prima si leggeva un fotogramma quando lo schermo si aggiornava, col tempo del rAF; ora si legge
// l'ultimo fotogramma appena il modello è libero, col tempo vero del fotogramma.
for (const inf of [33, 40, 45]) {
  console.log(`telefono, modello ${inf} ms · prima`.padEnd(34), judge(() => createPoseFilter(IMAGE_FILTER), schedule(ds, 'raf', { inf })));
  console.log(`telefono, modello ${inf} ms · dopo`.padEnd(34), judge(() => createPoseFilter(IMAGE_FILTER), schedule(ds, 'subito', { inf })));
}

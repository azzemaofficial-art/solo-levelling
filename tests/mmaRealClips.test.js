// Prove sulle clip VERE dell'iPhone (solo punti dello scheletro: "Il coach ha sbagliato" e
// insegnamento). Sono dati personali: stanno in tests/fixtures/private/ (escluso da git,
// il repo è pubblico). Se mancano, i test si saltano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createComboJudge, describeGesture } from '../lib/mmaComboJudge.js';

const FILE = new URL('./fixtures/private/mma-clips-emanuele.json', import.meta.url);
const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE)).Emanuele || [] : [];
const reps = all.filter((c) => c.kind === 'rep');
const skip = reps.length < 4 ? 'clip reali non presenti (sono solo in locale)' : false;

const decode = (c) => c.t.map((t, i) => {
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  c.j.forEach((j, k) => {
    world[j] = { x: c.w[i][k * 3] / 1000, y: c.w[i][k * 3 + 1] / 1000, z: c.w[i][k * 3 + 2] / 1000, visibility: 1 };
    if (c.p[i]) points[j] = { x: c.p[i][k * 3] / 1000, y: c.p[i][k * 3 + 1] / 1000, visibility: c.p[i][k * 3 + 2] / 100 };
  });
  return { t, world, points };
});

// Come MmaComboTrainer: calibrazione, "VIA" all'inizio della clip, chiusura quando la combo è
// completa e c'è calma da 600 ms (o allo scadere del tempo)
function playRep(c) {
  const fr = decode(c), j = createComboJudge({ stance: c.stance });
  let i = 0; while (!j.isCalibrated() && i < fr.length) { j.calibrate(fr[i].world, fr[i].points, 0.75); i++; }
  const start = fr[0].t + 200; let lastActive = 0, lastLive = 0;
  for (; i < fr.length; i++) {
    const t = fr[i].t, info = j.push(fr[i].world, t, fr[i].points, 0.75);
    if (!info) continue;
    if (info.activeKeys.length) lastActive = t;
    if (t - lastLive > 150) {
      lastLive = t;
      const r = j.judgeRep(c.expected, { since: start - 700 });
      const done = r.moves.filter((m) => m.status === 'ok' || m.status === 'partial').length;
      if ((done >= r.moves.length && j.idle() && t - Math.max(lastActive, start) > 600) || t - start > 2600 + c.expected.length * 1100) return { r, j };
    }
  }
  return { r: j.judgeRep(c.expected, { since: start - 700 }), j };
}

test('clip vere 1-2 (4 e 5 ottobre): jab e diretto riconosciuti, niente calci né clinch', { skip }, () => {
  const out = reps.map((c) => ({ c, ...playRep(c) }));
  for (const { r, j, c } of out) {
    // nelle combo di pugni piedi e clinch non contano mai
    assert.ok(r.moves.every((m) => !m.gesture || m.gesture.limb === 'arm'), `${c.ts}: ${j.gestures().map(describeGesture).join(', ')}`);
  }
  // le ripetizioni leggibili (#0, #1, #2 del 4 ottobre) passano; prima prendevano 0, 0 e 6
  const readable = out.slice(0, 3);
  for (const { r, c } of readable) {
    assert.ok(r.moves.every((m) => m.status === 'ok'), `${c.ts}: ${r.moves.map((m) => m.id + ':' + m.status).join(' ')}`);
    assert.ok(r.total >= 80, `${c.ts}: voto ${r.total}`);
  }
});

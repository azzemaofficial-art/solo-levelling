// Prove sulle clip VERE dell'iPhone (solo punti dello scheletro, "Il coach ha sbagliato").
// Le clip sono dati personali: stanno in tests/fixtures/private/ (escluso da git, repo pubblico).
// Se mancano, i test si saltano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createComboJudge, describeGesture, teachSample } from '../lib/mmaComboJudge.js';

const FILE = new URL('./fixtures/private/mma-clips-emanuele.json', import.meta.url);
const clips = existsSync(FILE) ? JSON.parse(readFileSync(FILE)).Emanuele || [] : [];
const skip = clips.length < 3 ? 'clip reali non presenti (sono solo in locale)' : false;

const decode = (c) => c.t.map((t, i) => {
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  c.j.forEach((j, k) => {
    world[j] = { x: c.w[i][k * 3] / 1000, y: c.w[i][k * 3 + 1] / 1000, z: c.w[i][k * 3 + 2] / 1000, visibility: 1 };
    if (c.p[i]) points[j] = { x: c.p[i][k * 3] / 1000, y: c.p[i][k * 3 + 1] / 1000, visibility: c.p[i][k * 3 + 2] / 100 };
  });
  return { t, world, points };
});
const judgeClip = (c, templates = null) => {
  const fr = decode(c), j = createComboJudge({ stance: c.stance, templates });
  fr.slice(0, 14).forEach((f) => j.calibrate(f.world, f.points, 0.75));
  fr.slice(14).forEach((f) => j.push(f.world, f.t, f.points, 0.75));
  return j;
};
// jab e diretto veri, letti dai grafici delle clip (ms dall'inizio della clip)
const TRUTH = { 0: [['jab', 850, 1250], ['cross', 1400, 1800]], 1: [['jab', 880, 1200]], 2: [['jab', 1550, 1750], ['cross', 1950, 2350]] };

test('clip vere 1-2: niente calci né clinch fantasma (caviglie diverse, guardia avanti)', { skip }, () => {
  for (const c of clips) {
    const j = judgeClip(c);
    const ghosts = j.gestures().filter((g) => g.limb === 'leg' || g.kind === 'clinch');
    const r = j.judgeRep(c.expected);
    assert.equal(r.moves.filter((m) => m.status !== 'missing').length >= 1, true, j.gestures().map(describeGesture).join(', '));
    assert.ok(r.extras <= 2, `${r.extras} in più: ${j.gestures().map(describeGesture).join(', ')}`);
    // le gambe si possono vedere muoversi, ma in una 1-2 non contano mai
    assert.ok(ghosts.every((g) => !r.moves.some((m) => m.gesture === g)));
  }
});

test('clip vere: con i TUOI colpi come esempi jab e diretto vengono riconosciuti', { skip }, () => {
  const samplesOf = (ci) => {
    const j = judgeClip(clips[ci]);
    return TRUTH[ci].map(([move, a, b]) => {
      const g = j.gestures().find((x) => x.limb === 'arm' && x.start < b && x.end > a && x.side === (move === 'jab' ? 'lead' : 'rear'));
      return g && teachSample(move, g);
    }).filter(Boolean);
  };
  for (const held of [0, 2]) {
    const items = [0, 1, 2].filter((c) => c !== held).flatMap(samplesOf);
    const j = judgeClip(clips[held], { stance: 'orthodox', items });
    const r = j.judgeRep(['jab', 'cross']);
    assert.ok(r.moves.every((m) => m.status === 'ok'), `clip ${held}: ${j.gestures().filter((g) => g.limb === 'arm').map((g) => g.move || describeGesture(g)).join(', ')}`);
  }
});

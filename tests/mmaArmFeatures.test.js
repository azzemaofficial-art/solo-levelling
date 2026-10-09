// Misure del braccio (v6), jab doppio, il coach che impara dalle combo riuscite, e la prova
// su un video vero di BoxingVI letto da MediaPipe Lite (solo in locale: tests/fixtures/private/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createComboJudge, teachSample } from '../lib/mmaComboJudge.js';
import { ARM_FEATURES, featureDistance, hasFeatures } from '../lib/mmaArmFeatures.js';
import { createPoseFilter, IMAGE_FILTER, WORLD_FILTER } from '../lib/poseFilter.js';
import { LEARN_MAX, forgetRep, learnFromRep } from '../lib/mmaTemplates.js';
import { synthSequence, calibrateJudge, realistic } from './helpers/synthFighter.js';

const armGestures = (ids, seed = 5) => {
  const j = calibrateJudge(createComboJudge());
  for (const f of realistic(synthSequence(ids, { tempo: 0.8 }), { seed })) j.push(f.world, f.t, f.points, 1);
  return j.gestures().filter((g) => g.limb === 'arm' && g.kind !== 'drop');
};
const F = (name) => ARM_FEATURES.indexOf(name);

test('misure del braccio: ogni colpo le porta, e il montante ha l’avambraccio più verticale del jab', () => {
  const [jab] = armGestures(['jab']), [up] = armGestures(['uppercut']);
  assert.ok(hasFeatures(jab?.f) && hasFeatures(up?.f), 'misure mancanti');
  assert.equal(jab.f.length, ARM_FEATURES.length);
  // faV < 0 = pugno sopra il gomito (avambraccio verticale)
  assert.ok(up.f[F('faV')] < jab.f[F('faV')], `montante ${up.f[F('faV')]} jab ${jab.f[F('faV')]}`);
  assert.equal(featureDistance(jab.f, jab.f), 0);
  assert.ok(featureDistance(jab.f, up.f) > 1);
});

test('insegnamento: l’esempio salva anche le misure del braccio', () => {
  const [g] = armGestures(['cross']);
  const s = teachSample('cross', g);
  assert.ok(s && hasFeatures(s.f) && s.arm === 'rear');
});

// risultato di una ripetizione, come lo restituisce judgeRep
const rep = (moves, grade = 'good') => ({ grade, moves: moves.map(([id, status, side, move = null]) => ({ id, status, gesture: { limb: 'arm', side, move, path: [[0, 0], [0.1, 0], [0.2, 0], [0.1, 0]], reach: 0.3, dur: 200, f: ARM_FEATURES.map(() => 0.1) } })) });
const taught = { stance: 'orthodox', items: [{ move: 'jab', arm: 'lead', path: [[0, 0], [0.1, 0], [0.2, 0], [0.1, 0]], reach: 0.3, f: ARM_FEATURES.map(() => 0) }, { move: 'cross', arm: 'rear', path: [[0, 0], [0.1, 0], [0.2, 0], [0.1, 0]], reach: 0.3, f: ARM_FEATURES.map(() => 0) }] };

test('il coach impara dalle combo riuscite, e dimentica se gli dici che ha sbagliato', () => {
  const t1 = learnFromRep(taught, rep([['jab', 'ok', 'lead'], ['cross', 'ok', 'rear']]), { rep: 1, sample: teachSample });
  assert.equal(t1.items.length, 4);
  assert.ok(t1.items.filter((it) => it.src === 'combo').every((it) => it.rep === 1 && hasFeatures(it.f)));
  // ripetizione da rifare, colpo mancante, colpo letto come un altro: non si impara niente
  assert.equal(learnFromRep(taught, rep([['jab', 'ok', 'lead'], ['cross', 'ok', 'rear']], 'redo'), { rep: 2, sample: teachSample }), null);
  assert.equal(learnFromRep(taught, rep([['jab', 'ok', 'lead'], ['cross', 'missing', 'rear']]), { rep: 2, sample: teachSample }), null);
  assert.equal(learnFromRep(taught, rep([['jab', 'ok', 'lead', 'hook']]), { rep: 2, sample: teachSample }), null);
  // senza esempi insegnati non si parte da zero con le combo
  assert.equal(learnFromRep(null, rep([['jab', 'ok', 'lead']]), { rep: 2, sample: teachSample }), null);
  // "Il coach ha sbagliato": via gli esempi di quella ripetizione, restano quelli insegnati
  assert.deepEqual(forgetRep(t1, 1).items, taught.items);
  // al massimo LEARN_MAX esempi imparati per colpo, i più recenti
  let t = taught;
  for (let r = 0; r < LEARN_MAX + 5; r += 1) t = learnFromRep(t, rep([['jab', 'ok', 'lead']]), { rep: 10 + r, sample: teachSample });
  const learned = t.items.filter((it) => it.move === 'jab' && it.src === 'combo');
  assert.equal(learned.length, LEARN_MAX);
  assert.equal(learned.at(-1).rep, 10 + LEARN_MAX + 4);
  assert.ok(t.items.some((it) => it.move === 'jab' && !it.src));
});

// ── Video vero: BoxingVI V7 (istruttore, 8,7 minuti, 195 pugni etichettati), MediaPipe Lite a 25 fps ──
const V7 = new URL('./fixtures/private/boxingvi-v7-lite.json', import.meta.url);
const v7 = existsSync(V7) ? JSON.parse(readFileSync(V7)) : null;
const ARM = { jab: 'lead', hook: 'lead', uppercut: 'lead', cross: 'rear', rearHook: 'rear', rearUppercut: 'rear' };

test('video vero (BoxingVI V7, Lite 25 fps): il coach vede i pugni di un altro atleta', { skip: v7 ? false : 'video di prova non presente (solo in locale)' }, () => {
  const imgF = createPoseFilter(IMAGE_FILTER), wF = createPoseFilter(WORLD_FILTER);
  const j = createComboJudge({ stance: v7.stance });
  const gs = [];
  v7.frames.forEach(([t, p, w], i) => {
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    v7.j.forEach((jj, k) => {
      points[jj] = { x: p[k * 3] / 1000, y: p[k * 3 + 1] / 1000, visibility: p[k * 3 + 2] / 100 };
      world[jj] = { x: w[k * 3] / 1000, y: w[k * 3 + 1] / 1000, z: w[k * 3 + 2] / 1000, visibility: p[k * 3 + 2] / 100 };
    });
    const pf = imgF.apply(points, t), wf = wF.apply(world, t);
    if (i < 12) { j.calibrate(wf, pf, v7.aspect); return; }
    const before = j.gestures().length;
    j.push(wf, t, pf, v7.aspect);
    gs.push(...j.gestures().slice(before).filter((g) => g.limb === 'arm' && g.kind !== 'drop'));
  });
  const used = new Set();
  let seen = 0, right = 0;
  for (const l of v7.labels) {
    const c = gs.map((g, i) => ({ g, i })).filter(({ g, i }) => !used.has(i) && g.peakT >= l.t0 - 100 && g.peakT <= l.t1 + 200);
    const m = c.find(({ g }) => g.side === ARM[l.move]) || c[0];
    if (m) { used.add(m.i); seen += 1; if (m.g.side === ARM[l.move]) right += 1; }
  }
  const minutes = (v7.frames.at(-1)[0] - v7.frames[0][0]) / 60000;
  const extra = gs.filter((g, i) => !used.has(i) && !v7.labels.some((l) => g.peakT >= l.t0 - 300 && g.peakT <= l.t1 + 400)).length / minutes;
  const n = v7.labels.length;
  // motore v5: visti 57%, braccio giusto 34%, 17,5 colpi in più al minuto
  assert.ok(seen / n >= 0.75, `visti ${seen}/${n}`);
  assert.ok(right / n >= 0.55, `braccio giusto ${right}/${n}`);
  assert.ok(extra <= 25, `colpi in più ${extra.toFixed(1)} al minuto`);
});

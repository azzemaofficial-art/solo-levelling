import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge, judgeSequence, coachFeedback, describeGesture, EXPECT } from '../lib/mmaComboJudge.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { MOVES } from '../src/data/mmaMoves.js';
import { synthSequence, calibrationFrames, PEAKS } from './helpers/synthFighter.js';

const run = (moves, opts) => {
  const judge = createComboJudge();
  for (const w of calibrationFrames()) judge.calibrate(w);
  for (const f of synthSequence(moves, opts)) judge.push(f.world, f.t, f.points);
  return judge;
};

test('giudice: calibrazione richiesta prima di giudicare', () => {
  const judge = createComboJudge();
  assert.equal(judge.isCalibrated(), false);
  for (const w of calibrationFrames()) judge.calibrate(w);
  assert.equal(judge.isCalibrated(), true);
});

test('giudice: la guardia ferma non produce colpi', () => {
  const judge = run([]);
  assert.deepEqual(judge.gestures().map(describeGesture), []);
});

// Ogni colpo da solo viene riconosciuto con tipo, lato e livello giusti
const SINGLE = Object.keys(PEAKS);
for (const id of SINGLE) {
  test(`giudice: riconosce ${MOVES[id]?.name || id}`, () => {
    // la ginocchiata della libreria parte sempre dal clinch
    const seq = id === 'rearKnee' ? ['clinch', 'rearKnee'] : [id];
    const judge = run(seq);
    const res = judge.judgeRep(seq);
    const mvIdx = seq.length - 1;
    const mv = res.moves[mvIdx];
    assert.equal(mv.status, 'ok', `${id}: visto ${judge.gestures().map(describeGesture).join(', ') || 'niente'}`);
    assert.equal(res.extras, 0, `${id}: gesti in più ${judge.gestures().map(describeGesture).join(', ')}`);
  });
}

test('giudice: tutte le combo della libreria eseguite pulite → promosse', () => {
  const failed = [];
  for (const combo of COMBOS) {
    const judge = run(combo.moves);
    const res = judge.judgeRep(combo.moves);
    if (res.grade === 'redo' || res.moves.some((mv) => mv.status === 'missing')) failed.push(`${combo.name}: ${res.total} [${judge.gestures().map(describeGesture).join(', ')}]`);
  }
  assert.deepEqual(failed, []);
});

test('giudice: ordine sbagliato (2-1 invece di 1-2) → non è perfetta', () => {
  const judge = run(['cross', 'jab']);
  const res = judge.judgeRep(['jab', 'cross']);
  assert.notEqual(res.grade, 'perfect');
  assert.ok(res.total < 85);
});

test('giudice: colpo mancante segnalato', () => {
  const judge = run(['jab', 'cross']);
  const res = judge.judgeRep(['jab', 'cross', 'hook']);
  assert.equal(res.moves[2].status, 'missing');
  assert.match(coachFeedback(res, ['Jab', 'Diretto', 'Gancio']), /mancato Gancio/);
});

test('giudice: mano avanti che scende durante il diretto → correzione guardia', () => {
  const judge = run(['cross'], { mutate: (id, p) => (id === 'cross' ? { ...p, 15: { x: 0.18, y: -0.05, z: -0.10, visibility: 0.99 } } : p) });
  const res = judge.judgeRep(['cross']);
  assert.ok(res.moves[0].issues.some((it) => it.key === 'guard'), JSON.stringify(res.moves[0].issues));
  assert.equal(res.extras, 0, 'la mano che scende non è un colpo in più');
  assert.notEqual(res.grade, 'perfect', 'con la guardia scesa non è perfetta');
  assert.match(coachFeedback(res, ['Diretto']), /mano è scesa/);
});

test('giudice: diretto senza rotazione → "ruota di più"', () => {
  const judge = run(['cross'], { mutate: (id, p) => (id === 'cross' ? { ...p, 11: { x: 0.17, y: -0.45, z: -0.03, visibility: 0.99 }, 12: { x: -0.17, y: -0.45, z: 0.05, visibility: 0.99 } } : p) });
  const res = judge.judgeRep(['cross']);
  assert.ok(res.moves[0].issues.some((it) => it.key === 'rotate'));
});

test('giudice: colpo in più fuori combo → penalità', () => {
  const judge = run(['jab', 'jab', 'cross']);
  const res = judge.judgeRep(['jab', 'cross']);
  assert.equal(res.extras, 1);
  assert.ok(res.total < 100);
});

test('giudice: low kick lanciato alto viene letto come calcio al corpo', () => {
  const judge = run(['bodyKick']);
  const res = judge.judgeRep(['lowKick']);
  assert.ok(res.moves[0].issues.some((it) => it.key === 'level'));
});

test('giudice: funziona anche a 15 fps (telefono lento)', () => {
  const judge = run(['jab', 'cross', 'hook'], { fps: 15 });
  const res = judge.judgeRep(['jab', 'cross', 'hook']);
  assert.ok(res.moves.every((mv) => mv.status === 'ok'), judge.gestures().map(describeGesture).join(', '));
});

test('giudice: ogni colpo della libreria ha un\'aspettativa', () => {
  assert.deepEqual(Object.keys(MOVES).filter((id) => !EXPECT[id]), []);
});

test('giudice: feedback perfetto quando tutto è pulito', () => {
  const res = judgeSequence(['jab'], [{ kind: 'straight', side: 'lead', level: 'head', start: 0, end: 300, peakT: 150, maxExt: 1, guardRatio: 1, bothGuard: 1, rotation: 20, lean: 5, returnMs: 150, peakElbowGap: 0, dur: 300 }]);
  assert.equal(res.grade, 'perfect');
  assert.match(coachFeedback(res, ['Jab']), /Perfetta/);
});

// Rumore come il MediaPipe vero: tremolio di ~1,5 cm e fotogrammi persi.
function noisy(frames, { sigma = 0.015, drop = 0.1, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return frames.filter(() => rnd() > drop).map((f) => ({ ...f, world: f.world.map((p) => ({ ...p, x: p.x + gauss() * sigma, y: p.y + gauss() * sigma, z: p.z + gauss() * sigma * 1.5 })) }));
}

test('giudice: con tremolio di 1,5 cm e 10% di fotogrammi persi la guardia ferma resta pulita', () => {
  const judge = createComboJudge();
  for (const w of calibrationFrames()) judge.calibrate(w);
  for (const f of noisy(synthSequence([], { start: 0 }).concat(synthSequence([], { start: 3000 })))) judge.push(f.world, f.t, f.points);
  assert.deepEqual(judge.gestures().map(describeGesture), []);
});

test('giudice: con rumore realistico le combo base restano riconosciute', () => {
  const failed = [];
  for (const combo of COMBOS.filter((c) => c.level === 1)) {
    for (const seed of [3, 11, 29]) {
      const judge = createComboJudge();
      for (const w of calibrationFrames()) judge.calibrate(w);
      for (const f of noisy(synthSequence(combo.moves), { seed })) judge.push(f.world, f.t, f.points);
      const res = judge.judgeRep(combo.moves);
      if (res.grade === 'redo') failed.push(`${combo.name} seed ${seed}: ${res.total} [${judge.gestures().map(describeGesture).join(', ')}]`);
    }
  }
  assert.deepEqual(failed, []);
});

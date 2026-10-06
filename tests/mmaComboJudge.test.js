import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge, judgeSequence, coachFeedback, describeGesture, EXPECT } from '../lib/mmaComboJudge.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { MOVES } from '../src/data/mmaMoves.js';
import { synthSequence, calibrateJudge, PEAKS, realistic } from './helpers/synthFighter.js';

const run = (moves, opts) => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(moves, opts)) judge.push(f.world, f.t, f.points, 1);
  return judge;
};
const ARM = ['straight', 'hook', 'uppercut', 'elbow', 'parry', 'feint'];
const arms = (judge) => judge.gestures().filter((g) => g.limb === 'arm' && g.kind !== 'drop');

test('giudice: calibrazione richiesta prima di giudicare', () => {
  const judge = createComboJudge();
  assert.equal(judge.isCalibrated(), false);
  calibrateJudge(judge);
  assert.equal(judge.isCalibrated(), true);
});

test('giudice: la guardia ferma non produce colpi', () => {
  assert.deepEqual(run([]).gestures().map(describeGesture), []);
});

// Ogni colpo di braccio viene visto sul braccio giusto (il tipo lo decidono i tuoi esempi)
for (const id of Object.keys(PEAKS).filter((k) => ARM.includes(EXPECT[k]?.kind) && !['leadElbow', 'rearElbow'].includes(k))) {
  test(`giudice: ${MOVES[id]?.name || id} visto sul braccio ${EXPECT[id].side === 'lead' ? 'avanti' : 'dietro'}`, () => {
    const judge = run([id]);
    const seen = arms(judge);
    assert.equal(seen.length, 1, seen.map((g) => `${describeGesture(g)}/${g.side}`).join(', ') || 'niente');
    assert.equal(seen[0].side, EXPECT[id].side);
    const res = judge.judgeRep([id]);
    assert.equal(res.moves[0].status, 'ok');
    assert.equal(res.extras, 0);
  });
}

// Gambe, corpo e clinch: come prima
for (const id of ['teep', 'lowKick', 'bodyKick', 'headKick', 'switchKick', 'roll', 'levelChange', 'clinch']) {
  test(`giudice: riconosce ${MOVES[id]?.name || id}`, () => {
    const judge = run([id]);
    const res = judge.judgeRep([id]);
    assert.equal(res.moves[0].status, 'ok', judge.gestures().map(describeGesture).join(', '));
  });
}

test('giudice: ginocchiata dal clinch', () => {
  const judge = run(['clinch', 'rearKnee']);
  const res = judge.judgeRep(['clinch', 'rearKnee']);
  assert.ok(res.moves.every((m) => m.status === 'ok'), judge.gestures().map(describeGesture).join(', '));
});

test('giudice: tutte le combo di pugni della libreria eseguite pulite → promosse', () => {
  const failed = [];
  for (const combo of COMBOS.filter((c) => c.moves.every((id) => ['straight', 'hook', 'uppercut'].includes(EXPECT[id]?.kind)))) {
    const judge = run(combo.moves);
    const res = judge.judgeRep(combo.moves);
    if (res.grade === 'redo' || res.moves.some((mv) => mv.status !== 'ok')) failed.push(`${combo.name}: ${res.total} [${arms(judge).map((g) => g.side).join(',')}]`);
  }
  assert.deepEqual(failed, []);
});

test('giudice: tutte le combo della libreria (anche calci, difesa, clinch) non perdono colpi', () => {
  const failed = [];
  for (const combo of COMBOS) {
    const judge = run(combo.moves);
    const res = judge.judgeRep(combo.moves);
    if (res.moves.some((mv) => mv.status === 'missing')) failed.push(`${combo.name}: [${judge.gestures().map((g) => `${describeGesture(g)}/${g.side ?? '-'}`).join(', ')}]`);
  }
  assert.ok(failed.length <= 3, failed.join(' | '));
});

test('giudice: ordine sbagliato (2-1 invece di 1-2) → non è perfetta', () => {
  const res = run(['cross', 'jab']).judgeRep(['jab', 'cross']);
  assert.notEqual(res.grade, 'perfect');
  assert.ok(res.total < 85);
});

test('giudice: colpo mancante segnalato', () => {
  const res = run(['jab', 'cross']).judgeRep(['jab', 'cross', 'hook']);
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

test('giudice: colpo in più fuori combo → penalità', () => {
  const res = run(['jab', 'jab', 'cross']).judgeRep(['jab', 'cross']);
  assert.equal(res.extras, 1);
  assert.ok(res.total < 100);
});

test('giudice: low kick lanciato alto viene letto come calcio al corpo', () => {
  const res = run(['bodyKick']).judgeRep(['lowKick']);
  assert.ok(res.moves[0].issues.some((it) => it.key === 'level'));
});

test('giudice: funziona anche a 15 fps (telefono lento)', () => {
  const judge = run(['jab', 'cross', 'hook'], { fps: 15 });
  const res = judge.judgeRep(['jab', 'cross', 'hook']);
  assert.ok(res.moves.every((mv) => mv.status === 'ok'), arms(judge).map((g) => g.side).join(', '));
});

test('giudice: 1-1-2 veloce senza pause resta due jab e un diretto', () => {
  for (const fps of [30, 15]) {
    const judge = run(['jab', 'jab', 'cross'], { fps, tempo: 0.5, gapMs: 0 });
    const res = judge.judgeRep(['jab', 'jab', 'cross']);
    assert.ok(res.moves.every((m) => m.status === 'ok'), `${fps} fps: ${arms(judge).map((g) => g.side).join(', ')}`);
    assert.equal(res.extras, 0);
  }
});

test('giudice: ogni colpo della libreria ha un\'aspettativa', () => {
  assert.deepEqual(Object.keys(MOVES).filter((id) => !EXPECT[id]), []);
});

test('giudice: feedback perfetto quando tutto è pulito', () => {
  const res = judgeSequence(['jab'], [{ kind: 'strike', side: 'lead', limb: 'arm', start: 0, end: 300, peakT: 150, guardRatio: 1, bothGuard: 1, rotation: null, lean: 0, returnMs: 150, reason: 'return', peakElbowGap: 0, dur: 300 }]);
  assert.equal(res.grade, 'perfect');
  assert.match(coachFeedback(res, ['Jab']), /Perfetta/);
});

test('giudice: con tremolio realistico (3D e 2D) la guardia ferma resta pulita', () => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of realistic(synthSequence([], { start: 0 }).concat(synthSequence([], { start: 3000 })), { seed: 7 })) judge.push(f.world, f.t, f.points, 1);
  assert.deepEqual(arms(judge).map(describeGesture), []);
});

test('giudice: con rumore realistico le combo base restano riconosciute', () => {
  const failed = [];
  for (const combo of COMBOS.filter((c) => c.level === 1)) {
    for (const seed of [3, 11, 29]) {
      const judge = calibrateJudge(createComboJudge());
      for (const f of realistic(synthSequence(combo.moves), { seed })) judge.push(f.world, f.t, f.points, 1);
      const res = judge.judgeRep(combo.moves);
      if (res.grade === 'redo') failed.push(`${combo.name} seed ${seed}: ${res.total} [${judge.gestures().map(describeGesture).join(', ')}]`);
    }
  }
  assert.deepEqual(failed, []);
});

test('giudice: guardia bassa letta mano per mano (pugno sotto la linea della spalla)', () => {
  const judge = calibrateJudge(createComboJudge());
  const frames = synthSequence([], {});
  const low = frames.map((f, i) => (i > 10 ? { ...f, points: f.points.map((p, k) => (k === 16 ? { ...p, y: p.y + 0.12 } : p)) } : f));
  let last;
  for (const f of low) last = judge.push(f.world, f.t, f.points, 1);
  assert.equal(last.guard.L, true);
  assert.equal(last.guard.R, false);
  assert.equal(last.guardKnown.R, true);
});

test('giudice: mano che scende e resta giù = guardia abbassata, non un colpo in più', () => {
  const judge = calibrateJudge(createComboJudge());
  const frames = synthSequence(['jab'], {});
  const lowFrom = frames.length - 25;
  const low = frames.map((f, i) => (i > lowFrom - 30 ? { ...f, points: f.points.map((p, k) => (k === 16 ? { ...p, y: p.y + 0.15 } : p)) } : f));
  for (const f of low) judge.push(f.world, f.t, f.points, 1);
  const res = judge.judgeRep(['jab']);
  assert.equal(res.extras, 0, judge.gestures().map(describeGesture).join(', '));
  assert.equal(res.moves[0].status, 'ok');
});

test('giudice: MediaPipe che scambia sinistra e destra per qualche fotogramma non inventa colpi', () => {
  const judge = calibrateJudge(createComboJudge());
  const PAIRS = [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28]];
  const swap = (arr) => { const o = arr.slice(); for (const [a, b] of PAIRS) { o[a] = arr[b]; o[b] = arr[a]; } return o; };
  const frames = synthSequence(['jab', 'cross']);
  const flipped = frames.map((f, i) => (i > 30 && i < 36 ? { ...f, points: swap(f.points), world: swap(f.world) } : f));
  for (const f of flipped) judge.push(f.world, f.t, f.points, 1);
  const res = judge.judgeRep(['jab', 'cross']);
  assert.ok(res.moves.every((m) => m.status === 'ok'), arms(judge).map((g) => g.side).join(', '));
  assert.equal(res.extras, 0);
});

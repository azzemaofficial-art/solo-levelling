import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { punchInput, INPUT_SIZE } from '../lib/mmaPunchInput.js';
import { kindProbs, hasPunchModel, KINDS } from '../lib/mmaPunchModel.js';
import { createComboJudge, judgeSequence, rateGesture, THRESH } from '../lib/mmaComboJudge.js';
import { synthSequence, calibrateJudge } from './helpers/synthFighter.js';

// Un pugno finto nell'immagine: spalle, fianchi, gomito e polso che vanno fuori e tornano
function fakePunch(S, { mirror = false, hook = false } = {}) {
  const frames = [];
  for (let i = 0; i <= 12; i += 1) {
    const k = Math.sin((Math.PI * i) / 12); // 0 → 1 → 0
    const out = S === 'L' ? -1 : 1;
    const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    const set = (j, x, y) => { p[j] = { x: mirror ? 1 - x : x, y, visibility: 1 }; };
    set(11, 0.42, 0.35); set(12, 0.58, 0.35); set(23, 0.44, 0.65); set(24, 0.56, 0.65);
    const sh = S === 'L' ? 0.42 : 0.58, oth = S === 'L' ? 0.58 : 0.42;
    set(S === 'L' ? 13 : 14, sh + out * 0.04 + out * 0.06 * k, 0.45 - (hook ? 0.08 * k : 0.04 * k));
    set(S === 'L' ? 15 : 16, sh + out * 0.02 + out * (hook ? 0.08 : 0.16) * k, 0.33 - (hook ? 0.02 : 0) * k);
    set(S === 'L' ? 14 : 13, oth - out * 0.04, 0.45);
    set(S === 'L' ? 16 : 15, oth - out * 0.02, 0.33);
    frames.push({ t: i * 40, p });
  }
  return frames;
}

test('punchInput: misure del colpo, uguali per braccio sinistro, destro e video specchiato', () => {
  const a = punchInput(fakePunch('L'), 'L'), b = punchInput(fakePunch('R', { mirror: true }), 'R');
  assert.equal(a.length, INPUT_SIZE);
  assert.ok(a.every(Number.isFinite));
  // lo stesso pugno visto allo specchio (e quindi con l'altro braccio) dà le stesse misure
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `colonna ${i}: ${v} ≠ ${b[i]}`));
  assert.equal(punchInput(fakePunch('L').slice(0, 2), 'L'), null);
});

test('modellino: pesi piccoli, probabilità valide, meno di 1 ms per colpo', () => {
  assert.ok(hasPunchModel(), 'mancano i pesi: lancia scripts/punch-training/esporta.py');
  const kb = fs.statSync(new URL('../lib/mmaPunchWeights.js', import.meta.url)).size / 1024;
  assert.ok(kb <= 150, `pesi troppo grandi: ${kb.toFixed(0)} KB`);
  const x = punchInput(fakePunch('L', { hook: true }), 'L');
  const p = kindProbs(x);
  assert.deepEqual(Object.keys(p), KINDS);
  assert.ok(Math.abs(KINDS.reduce((s, k) => s + p[k], 0) - 1) < 1e-9);
  assert.equal(kindProbs(null), null);
  assert.equal(kindProbs([1, 2, 3]), null);
  const t0 = performance.now();
  for (let i = 0; i < 500; i += 1) kindProbs(x);
  const ms = (performance.now() - t0) / 500;
  assert.ok(ms < 1, `troppo lento: ${ms.toFixed(3)} ms`);
});

test('montante delle sole regole: se il modellino ne dubita, nella combo vale come colpo non deciso', () => {
  const g = { kind: 'uppercut', move: null, side: 'lead', limb: 'arm', start: 0, end: 400, peakT: 200, reach: 0.4, guardRatio: 1 };
  // senza dubbio: un jab letto come montante non vale (diretto e montante non sono parenti)
  assert.notEqual(judgeSequence(['jab'], [g]).moves[0].status, 'ok');
  const doubt = { ...g, probs: { straight: 0.8, hook: 0.1, uppercut: 0.1 }, unsure: true };
  assert.equal(judgeSequence(['jab'], [doubt]).moves[0].status, 'ok');
  // un montante vero resta un montante anche se dubbio (vale come colpo non deciso del braccio giusto)
  assert.equal(judgeSequence(['uppercut'], [doubt]).moves[0].status, 'ok');
  // braccio sbagliato: resta sbagliato
  assert.notEqual(judgeSequence(['cross'], [doubt]).moves[0].status, 'ok');
  // allenamento libero: il nome non cambia
  assert.equal(rateGesture(doubt).id, 'uppercut');
  assert.ok(THRESH.uppercutDoubt > 0 && THRESH.uppercutDoubt < 0.5);
});

test('giudice: ogni colpo di braccio ha il polso (S); probabilità solo per i montanti delle regole', () => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(['jab', 'cross', 'hook', 'uppercut'])) judge.push(f.world, f.t, f.points, 1);
  const arms = judge.gestures().filter((g) => g.limb === 'arm' && g.kind !== 'drop');
  assert.ok(arms.length >= 3);
  for (const g of arms) {
    assert.ok(g.S === 'L' || g.S === 'R');
    assert.equal(typeof g.unsure, 'boolean');
    if (g.probs) {
      assert.equal(g.kind, 'uppercut');
      assert.ok(Math.abs(g.probs.straight + g.probs.hook + g.probs.uppercut - 1) < 1e-9);
      assert.equal(g.unsure, g.probs.uppercut < THRESH.uppercutDoubt);
    }
  }
  // spento: il giudice resta quello di prima
  const off = calibrateJudge(createComboJudge({ punchNet: null }));
  for (const f of synthSequence(['jab', 'uppercut'])) off.push(f.world, f.t, f.points, 1);
  assert.ok(off.gestures().every((g) => g.limb !== 'arm' || (!g.probs && !g.unsure)));
});

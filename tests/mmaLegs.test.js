// Gambe lette in 2D (lib/mmaLegs.js), gesti mostrati (visibleGestures), il segreto del maestro
// e le clip con i piedi (21/10/2026). Il banco con le ripetizioni vere è scripts/punch-training/gambe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge, judgeSequence, masterSecret, visibleGestures, EXPECT } from '../lib/mmaComboJudge.js';
import { createLegEngine } from '../lib/mmaLegs.js';
import { CLIP_JOINTS, encodeClip } from '../lib/mmaClips.js';
import { synthSequence, calibrateJudge } from './helpers/synthFighter.js';

const run = (moves) => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(moves)) judge.push(f.world, f.t, f.points, 1);
  return judge;
};
const legGs = (judge) => judge.gestures().filter((g) => g.limb === 'leg');

for (const id of ['lowKick', 'bodyKick', 'headKick']) {
  test(`gambe: ${id} visto come calcio della gamba dietro, all'altezza giusta`, () => {
    const judge = run([id]);
    const legs = legGs(judge);
    assert.equal(legs.length, 1, legs.map((g) => `${g.kind}/${g.side}/${g.level}`).join(', ') || 'niente');
    assert.equal(legs[0].kind, 'kick');
    assert.equal(legs[0].side, 'rear');
    assert.equal(legs[0].level, EXPECT[id].level);
    assert.equal(judge.judgeRep([id]).moves[0].status, 'ok');
  });
}

// Una persona ferma, in guardia ortodossa, vista di tre quarti (coordinate dell'immagine 0-1)
const STAND = { 0: [0.5, 0.2], 11: [0.45, 0.3], 12: [0.55, 0.3], 13: [0.43, 0.38], 14: [0.57, 0.38], 15: [0.47, 0.27], 16: [0.53, 0.27], 23: [0.47, 0.55], 24: [0.53, 0.55], 25: [0.45, 0.7], 26: [0.56, 0.7], 27: [0.44, 0.85], 28: [0.58, 0.85] };
const pose = (move = {}) => Array.from({ length: 33 }, (_, i) => {
  const xy = move[i] || STAND[i];
  return xy ? { x: xy[0], y: xy[1], visibility: 0.9 } : { x: 0.5, y: 0.5, visibility: 0 };
});
const calibrated = () => {
  const legs = createLegEngine({ stance: 'orthodox' });
  for (let i = 0; i < 12; i += 1) legs.calibrate(pose(), 1);
  return legs;
};

test('gambe: un passo (piede che scivola e si riappoggia) non è un calcio', () => {
  const legs = calibrated();
  let t = 0;
  for (let i = 0; i < 10; i += 1) legs.push(pose(), (t += 33), 1);
  // il piede dietro scivola di 0,15 (più di mezzo busto) in 300 ms, ginocchio insieme: stinco sempre dritto
  for (let k = 1; k <= 9; k += 1) {
    const dx = 0.15 * (k / 9);
    legs.push(pose({ 26: [0.56 + dx, 0.7], 28: [0.58 + dx, 0.85] }), (t += 33), 1);
  }
  for (let i = 0; i < 20; i += 1) legs.push(pose({ 26: [0.71, 0.7], 28: [0.73, 0.85] }), (t += 33), 1);
  assert.deepEqual(legs.events(), []);
});

test('gambe: il telefono scambia per un attimo le due gambe → nessun gesto inventato', () => {
  const legs = calibrated();
  let t = 0;
  for (let i = 0; i < 10; i += 1) legs.push(pose(), (t += 33), 1);
  const swapped = pose({ 25: STAND[26], 26: STAND[25], 27: STAND[28], 28: STAND[27] });
  for (let i = 0; i < 8; i += 1) legs.push(swapped, (t += 33), 1);
  for (let i = 0; i < 20; i += 1) legs.push(pose(), (t += 33), 1);
  assert.deepEqual(legs.events(), []);
  assert.ok(legs.swaps() >= 2, `scambi visti: ${legs.swaps()}`);
});

test('gesti mostrati: in una 1-2 niente gambe; le braccia che bilanciano il calcio non sono pugni', () => {
  const kick = { limb: 'leg', kind: 'kick', side: 'rear', level: 'low', start: 1000, end: 1800 };
  const swing = { limb: 'arm', kind: 'strike', side: 'rear', start: 1200, end: 1500, reach: 0.5 };
  const jab = { limb: 'arm', kind: 'strike', side: 'lead', start: 300, end: 600, reach: 0.6 };
  const after = { ...jab, start: 2500, end: 2800 };
  assert.deepEqual(visibleGestures(['jab', 'cross'], [jab, kick]), [jab]);
  assert.deepEqual(visibleGestures(['jab', 'cross', 'lowKick'], [jab, kick, swing, after]), [jab, kick, after]);
});

test('calcio: conta la mano dell\'altro lato (il braccio che bilancia scende, ed è giusto)', () => {
  const kick = { limb: 'leg', kind: 'kick', side: 'rear', level: 'low', start: 0, end: 700, peakT: 350, typeSure: true };
  const issues = (g) => judgeSequence(['lowKick'], [g]).moves[0].issues.map((it) => it.key);
  assert.ok(!issues({ ...kick, guardRatio: 1, bothGuard: 0.1 }).includes('kickGuard'));
  assert.ok(issues({ ...kick, guardRatio: 0.2, bothGuard: 0.1 }).includes('kickGuard'));
});

test('segreto del maestro: prima l\'errore di tecnica, una volta per serie', () => {
  const result = { moves: [
    { id: 'jab', issues: [{ key: 'return', pts: 8, text: '' }] },
    { id: 'lowKick', issues: [{ key: 'level', pts: 0, text: '' }] },
  ] };
  const first = masterSecret(result);
  assert.equal(first.key, 'level:lowKick');
  assert.match(first.text, /stinco/);
  const second = masterSecret(result, { skip: [first.key] });
  assert.equal(second.key, 'return');
  assert.equal(masterSecret(result, { skip: [first.key, second.key] }), null);
  assert.equal(masterSecret({ moves: [{ id: 'jab', issues: [] }] }), null);
});

test('clip: con 33 punti salva anche talloni e punte; senza resta a 13 articolazioni', () => {
  const frame = (n, t) => ({ t, world: Array.from({ length: n }, () => ({ x: 0.1, y: 0.2, z: 0.3 })), points: Array.from({ length: n }, () => ({ x: 0.4, y: 0.5, visibility: 0.9 })) });
  const full = encodeClip([frame(33, 0), frame(33, 33)]);
  assert.deepEqual(full.j, CLIP_JOINTS);
  assert.equal(full.j.length, 17);
  assert.equal(full.w[0].length, 17 * 3);
  assert.equal(full.p[0].length, 17 * 3);
  const old = encodeClip([frame(29, 0), frame(29, 33)]);
  assert.equal(old.j.length, 13);
  assert.equal(old.w[0].length, 13 * 3);
});

// Trovati dal revisore (21/10): gamba che resta "in movimento" per sempre, calcio di 5 s, nomi sbagliati dopo una pausa
test('gambe: un gesto aperto con la gamba che sparisce si chiude (la ripetizione può finire)', () => {
  const legs = calibrated();
  let t = 0;
  for (let i = 0; i < 10; i += 1) legs.push(pose(), (t += 33), 1);
  // la gamba dietro parte...
  for (let k = 1; k <= 4; k += 1) legs.push(pose({ 26: [0.56 + 0.03 * k, 0.7 - 0.02 * k], 28: [0.58 + 0.06 * k, 0.85 - 0.04 * k] }), (t += 33), 1);
  assert.ok(legs.activeAge(t).rear >= 0, 'la gamba dietro doveva essere in movimento');
  // ...e per 3 s il telefono non la vede più
  const hidden = pose({ 26: [0.68, 0.62], 28: [0.82, 0.69] });
  hidden[26].visibility = 0.1; hidden[28].visibility = 0.1;
  for (let i = 0; i < 90; i += 1) legs.push(hidden, (t += 33), 1);
  assert.deepEqual(legs.activeAge(t), {});
  // torna al suo posto: nessun "calcio" lungo 3 secondi
  for (let i = 0; i < 20; i += 1) legs.push(pose(), (t += 33), 1);
  assert.deepEqual(legs.events(), []);
});

test('gambe: dopo una pausa (VIA) i nomi delle gambe si rileggono dagli appoggi', () => {
  const legs = calibrated();
  let t = 0;
  for (let i = 0; i < 10; i += 1) legs.push(pose(), (t += 33), 1);
  const swapped = pose({ 25: STAND[26], 26: STAND[25], 27: STAND[28], 28: STAND[27] });
  for (let i = 0; i < 5; i += 1) legs.push(swapped, (t += 33), 1);
  legs.abort(); // il VIA: nel frattempo il telefono ha rimesso a posto i nomi
  let r = null;
  for (let i = 0; i < 10; i += 1) r = legs.push(pose(), (t += 33), 1);
  assert.ok(r.disp.L < 0.1 && r.disp.R < 0.1, `gambe lette scambiate: ${JSON.stringify(r.disp)}`);
  // si muove solo il piede dietro (destro): deve risultare la gamba dietro, non quella avanti
  r = legs.push(pose({ 26: [0.6, 0.7], 28: [0.66, 0.85] }), (t += 33), 1);
  assert.ok(r.disp.R > 0.2 && r.disp.L < 0.1, `si è mossa la gamba sbagliata: ${JSON.stringify(r.disp)}`);
});

test('abbinamento: un gesto di braccio poco chiaro non vale come calcio', () => {
  const unclear = { limb: 'arm', kind: 'unclear', side: 'rear', start: 0, end: 300, peakT: 150, guardRatio: 1, bothGuard: 1 };
  assert.equal(judgeSequence(['lowKick'], [unclear]).moves[0].status, 'missing');
});

test('segreto del maestro: "la forma del colpo" solo per i colpi di braccio', () => {
  assert.equal(masterSecret({ moves: [{ id: 'slip', issues: [{ key: 'kind', pts: 0, text: '' }] }] }), null);
  assert.equal(masterSecret({ moves: [{ id: 'cross', issues: [{ key: 'kind', pts: 0, text: '' }] }] }).key, 'kind');
});

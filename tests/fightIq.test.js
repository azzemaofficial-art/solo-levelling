import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACK_TYPES, windowScale, reactionWindow, buildAttackSequence,
  gradeReaction, computeFightIq, longestStreak, nextLevel,
  detectSprawl, detectGuard, detectCounter,
} from '../lib/fightIq.js';

test('attack types coprono punch/kick/takedown', () => {
  const cats = new Set(Object.values(ATTACK_TYPES).map((a) => a.cat));
  assert.ok(cats.has('punch') && cats.has('kick') && cats.has('takedown'));
});

test('windowScale scende con la difficoltà, con cap', () => {
  assert.equal(windowScale(1), 1);
  assert.ok(windowScale(5) < windowScale(1));
  assert.ok(windowScale(10) <= 0.5);
  assert.equal(windowScale(15), windowScale(10)); // cap
});

test('reactionWindow si accorcia salendo di livello', () => {
  const easy = reactionWindow('jab', 1);
  const hard = reactionWindow('jab', 9);
  assert.ok(hard < easy);
  assert.ok(hard > 300); // mai impossibile
});

test('buildAttackSequence: lunghezza, id validi, no doppioni consecutivi', () => {
  const seq = buildAttackSequence(12, 5, 42);
  assert.equal(seq.length, 12);
  for (const id of seq) assert.ok(ATTACK_TYPES[id], `id sconosciuto: ${id}`);
  for (let i = 1; i < seq.length; i += 1) assert.notEqual(seq[i], seq[i - 1]);
});

test('buildAttackSequence è deterministico per lo stesso seed', () => {
  const a = buildAttackSequence(10, 4, 7);
  const b = buildAttackSequence(10, 4, 7);
  assert.deepEqual(a, b);
});

test('gradeReaction: perfect/good/late/missed', () => {
  assert.equal(gradeReaction({ reacted: false }).grade, 'missed');
  assert.equal(gradeReaction({ reacted: true, reactTimeMs: 500, windowMs: 1600 }).grade, 'perfect');
  assert.equal(gradeReaction({ reacted: true, reactTimeMs: 1000, windowMs: 1600 }).grade, 'good');
  assert.equal(gradeReaction({ reacted: true, reactTimeMs: 1400, windowMs: 1600 }).grade, 'late');
});

test('contrattacco dà più punti', () => {
  const noCounter = gradeReaction({ reacted: true, reactTimeMs: 500, windowMs: 1600, countered: false }).points;
  const withCounter = gradeReaction({ reacted: true, reactTimeMs: 500, windowMs: 1600, countered: true }).points;
  assert.ok(withCounter > noCounter);
});

test('computeFightIq: 0 con nessun risultato, cresce con performance e streak', () => {
  assert.equal(computeFightIq([]), 0);
  const bad = Array(6).fill({ grade: 'missed', points: 0 });
  const good = Array(6).fill({ grade: 'perfect', points: 15 });
  assert.ok(computeFightIq(good) > computeFightIq(bad));
  assert.ok(computeFightIq(good) <= 100);
});

test('longestStreak conta solo perfect/good consecutivi', () => {
  const r = [
    { grade: 'perfect' }, { grade: 'good' }, { grade: 'perfect' },
    { grade: 'missed' }, { grade: 'good' }, { grade: 'good' },
  ];
  assert.equal(longestStreak(r), 3);
});

test('nextLevel sale con IQ alto, scende con IQ basso, resta stabile a metà', () => {
  assert.equal(nextLevel(85, 3), 4);
  assert.equal(nextLevel(30, 5), 4);
  assert.equal(nextLevel(60, 4), 4);
});

test('detectSprawl rileva lo scatto di estensione delle ginocchia', () => {
  const samples = [
    { t: 0, kL: 120, kR: 120, hipY: 0.5 },
    { t: 60, kL: 122, kR: 121, hipY: 0.5 },
    { t: 120, kL: 170, kR: 168, hipY: 0.55 }, // scatto: +48° in 60ms = 800°/s
  ];
  const r = detectSprawl(samples, 0, 1500);
  assert.equal(r.detected, true);
  assert.ok(r.timeMs > 0 && r.timeMs <= 1500);
});

test('detectSprawl non scatta su movimento lento', () => {
  const samples = [
    { t: 0, kL: 120, kR: 120, hipY: 0.5 },
    { t: 400, kL: 140, kR: 138, hipY: 0.51 }, // lento: 50°/s
  ];
  assert.equal(detectSprawl(samples, 0, 1500).detected, false);
});

test('detectGuard: mani alte = guardia, mani basse = no', () => {
  assert.equal(detectGuard({ wL: 0.2, wR: 0.2, shL: 0.3, shR: 0.3 }), true);
  assert.equal(detectGuard({ wL: 0.6, wR: 0.2, shL: 0.3, shR: 0.3 }), false); // mano sx bassa
  assert.equal(detectGuard({ wL: 0.55, wR: 0.6, shL: 0.3, shR: 0.3 }), false); // entrambe basse
});

test('detectCounter rileva un pugno esplosivo nella finestra', () => {
  const samples = [
    { t: 0, eL: 90, eR: 90 },
    { t: 50, eL: 150, eR: 90 }, // estensione gomito sx: 60°/50ms = 1200°/s
  ];
  const r = detectCounter(samples, 0, 1600);
  assert.equal(r.detected, true);
});

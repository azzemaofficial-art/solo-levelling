import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp, xpNeededFor, expProgressPct } from '../src/utils/xpLogic.js';

test('xpNeededFor: costo livello corrente (level*100)', () => {
  assert.equal(xpNeededFor(1), 100);
  assert.equal(xpNeededFor(22), 2200);
  assert.equal(xpNeededFor(undefined), 100); // default livello 1
});

test('applyXp: sotto soglia non cambia livello', () => {
  const r = applyXp({ level: 22, exp: 100 }, 50);
  assert.equal(r.level, 22);
  assert.equal(r.exp, 150);
  assert.equal(r.levelsGained, 0);
});

test('applyXp: level-up singolo con resto corretto', () => {
  const r = applyXp({ level: 1, exp: 90 }, 30);
  assert.equal(r.level, 2);
  assert.equal(r.exp, 20);
  assert.equal(r.levelsGained, 1);
});

test('applyXp: level-up multipli in una volta (boss reward)', () => {
  // 600 XP da lv1: 100 (lv2) + 200 (lv3) + 300 (lv4) = 600 esatti
  const r = applyXp({ level: 1, exp: 0 }, 600);
  assert.equal(r.level, 4);
  assert.equal(r.exp, 0);
  assert.equal(r.levelsGained, 3);
});

test('applyXp: coerenza tra guadagni consecutivi (il vecchio drift)', () => {
  // 2126 XP da lv1: 100+200+300+400+500+600 = 2100 porta a lv 7, resto 26.
  const dopoStudio = applyXp({ level: 1, exp: 0 }, 2126);
  assert.equal(dopoStudio.level, 7);
  assert.equal(dopoStudio.exp, 26);
  // un secondo guadagno riprende dal resto, senza salti né regressioni
  const dopoBoss = applyXp(dopoStudio, 300);
  assert.equal(dopoBoss.level, 7);
  assert.equal(dopoBoss.exp, 326);
  assert.ok(dopoBoss.exp < xpNeededFor(dopoBoss.level));
});

test('applyXp: gained negativo/invalido ignorato, stato invariato', () => {
  const r = applyXp({ level: 5, exp: 40 }, -100);
  assert.equal(r.level, 5);
  assert.equal(r.exp, 40);
  const r2 = applyXp(undefined, 'abc');
  assert.equal(r2.level, 1);
  assert.equal(r2.exp, 0);
});

test('expProgressPct per la progress bar', () => {
  assert.equal(expProgressPct({ level: 1, exp: 50 }), 50);
  assert.equal(expProgressPct({ level: 2, exp: 200 }), 100);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { masteryFromXp, totalXp, globalMastery, masteryTitle } from '../lib/mastery.js';

test('masteryFromXp: parte da 0, cresce lentamente, capped a 100', () => {
  assert.equal(masteryFromXp(0), 0);
  assert.ok(masteryFromXp(500) <= 10, 'primi XP crescono piano');
  assert.ok(masteryFromXp(8000) >= 55 && masteryFromXp(8000) <= 70);
  assert.ok(masteryFromXp(32000) >= 95);
  assert.equal(masteryFromXp(1e9), 100);
});

test('masteryFromXp: monotona e robusta a input strani', () => {
  assert.ok(masteryFromXp(1000) < masteryFromXp(2000));
  assert.equal(masteryFromXp(-50), 0);
  assert.equal(masteryFromXp('abc'), 0);
});

test('totalXp/globalMastery sommano tutte le discipline', () => {
  const progress = { muaythai: { xp: 4000 }, boxing: { xp: 4000 }, yoga: { xp: -10 } };
  assert.equal(totalXp(progress), 8000);
  assert.equal(globalMastery(progress), masteryFromXp(8000));
  assert.equal(totalXp(null), 0);
});

test('masteryTitle segue le fasce fino a MONARCA', () => {
  assert.equal(masteryTitle(0).title, 'GRADO E');
  assert.equal(masteryTitle(30).title, 'GRADO C');
  assert.equal(masteryTitle(70).title, 'GRADO A');
  assert.equal(masteryTitle(99).title, 'GRADO S');
  assert.equal(masteryTitle(100).title, 'MONARCA');
});

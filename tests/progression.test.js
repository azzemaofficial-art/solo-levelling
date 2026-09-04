import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pillarEsperienza, pillarCostanza, pillarCombattimento, pillarLevels,
  fighterLevel, lvlToFl, gateFor, effectiveMinDays, evalUnlock,
  levelTitle, MAX_LEVEL, LEVEL_TITLES,
} from '../lib/progression.js';

test('pilastri vanno da 0 a 100 con cap', () => {
  assert.equal(pillarEsperienza(0), 0);
  assert.ok(pillarEsperienza(15000) > 0);
  assert.equal(pillarEsperienza(999999), 100);
  assert.equal(pillarCostanza(0), 0);
  assert.equal(pillarCostanza(600), 100);
  assert.equal(pillarCostanza(1000), 100);
  assert.equal(pillarCombattimento(0, 0), 0);
  assert.equal(pillarCombattimento(100, 100), 100);
});

test('pillarCombattimento pesa 60% Fight IQ e 40% voto', () => {
  assert.equal(pillarCombattimento(100, 0), 60);
  assert.equal(pillarCombattimento(0, 100), 40);
  assert.equal(pillarCombattimento(50, 50), 50);
});

test('fighterLevel cresce con tutti i pilastri e ha cap 100', () => {
  const weak = fighterLevel({ xp: 100, days: 2, fightIq: 20, avgScore: 40 });
  const mid = fighterLevel({ xp: 15000, days: 100, fightIq: 55, avgScore: 65 });
  const strong = fighterLevel({ xp: 999999, days: 9999, fightIq: 100, avgScore: 100 });
  assert.ok(weak < mid && mid < strong);
  assert.equal(strong, MAX_LEVEL);
  assert.ok(weak >= 1);
});

test('lvlToFl mappa i livelli tecnica a fighter level crescenti', () => {
  assert.equal(lvlToFl(1), 1);
  assert.ok(lvlToFl(2) > lvlToFl(1));
  assert.ok(lvlToFl(3) > lvlToFl(2));
  assert.ok(lvlToFl(4) > lvlToFl(3));
  assert.ok(lvlToFl(5) > lvlToFl(4));
});

test('gateFor richiede più giorni e IQ man mano che si sale', () => {
  const low = gateFor(10);
  const high = gateFor(90);
  assert.equal(low.minDays, 0);
  assert.ok(high.minDays > gateFor(45).minDays);
  assert.ok(high.minIq > low.minIq);
});

test('cancello morbido: chi combatte molto bene condona metà giorni', () => {
  const gate = { minDays: 100, minIq: 50 };
  const over = effectiveMinDays(gate, { fightIq: 80, avgScore: 90 }); // iq >= 50+15 e voto>=80
  const normal = effectiveMinDays(gate, { fightIq: 55, avgScore: 70 });
  assert.equal(over, 50);
  assert.equal(normal, 100);
});

test('evalUnlock: tutto sbloccato quando il profilo è forte', () => {
  const profile = { xp: 999999, days: 9999, fightIq: 100, avgScore: 100 };
  const r = evalUnlock({ lvl: 5 }, profile);
  assert.equal(r.unlocked, true);
});

test('evalUnlock: principiante non sblocca tecniche avanzate', () => {
  const profile = { xp: 50, days: 1, fightIq: 10, avgScore: 30 };
  const r = evalUnlock({ lvl: 4 }, profile);
  assert.equal(r.unlocked, false);
  assert.ok(r.missing.level > 0 || r.missing.days > 0 || r.missing.iq > 0);
});

test('evalUnlock: riporta cosa manca (giorni/IQ/livello)', () => {
  // buon livello ma zero giorni di allenamento → manca il tempo
  const profile = { xp: 999999, days: 0, fightIq: 45, avgScore: 50 };
  const r = evalUnlock({ fl: 60 }, profile);
  assert.equal(r.unlocked, false);
  assert.ok(r.missing.days > 0);
});

test('evalUnlock con fl esplicito (tecniche nuove)', () => {
  const profile = { xp: 999999, days: 9999, fightIq: 100, avgScore: 100 };
  const r = evalUnlock({ fl: 95 }, profile);
  assert.equal(r.unlocked, true);
  assert.equal(r.fl, 95);
});

test('levelTitle copre tutta la scalata fino a MONARCA', () => {
  assert.equal(levelTitle(1).title, 'RISVEGLIATO');
  assert.equal(levelTitle(55).title, 'CACCIA-GRADO B');
  assert.equal(levelTitle(95).title, 'GRADO S');
  assert.equal(levelTitle(100).title, 'MONARCA');
  assert.ok(LEVEL_TITLES.length >= 8);
});

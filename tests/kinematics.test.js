import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeKinematics, fatigueFromTrend, detectKicks, kickLevelFromMatch } from '../lib/kinematics.js';

// Campionatore sintetico: un campione ogni `step` ms a partire da t0.
const samples = (vals, step = 33, t0 = 0) => vals.map((eR, i) => ({ t: t0 + i * step, eL: 100, eR, kL: 165, kR: 165 }));

test('analyzeKinematics: corpo fermo → niente azione, niente colpi', () => {
  const r = analyzeKinematics(samples([90, 90, 90, 90, 90, 90]));
  assert.equal(r.active, false);
  assert.equal(r.peakDeg, 0);
  assert.equal(r.strikes.tot, 0);
});

test('analyzeKinematics: colpo esplosivo (uscita e ritorno veloci)', () => {
  // uscita 90→170 in ~100ms (~800°/s), ritorno 170→100 altrettanto veloce
  const r = analyzeKinematics(samples([90, 90, 90, 117, 145, 170, 140, 100, 95, 90]));
  assert.equal(r.active, true);
  assert.ok(r.peakDeg > 480, `picco atteso >480, ottenuto ${r.peakDeg}`);
  assert.equal(r.peakJoint, 'eR');
  assert.equal(r.strikes.tot, 1);
  assert.equal(r.strikes.esplosivi, 1);
  assert.equal(r.strikes.lenti, 0);
});

test('analyzeKinematics: colpo lento al ritorno', () => {
  // uscita veloce 90→170, poi ritorno lentissimo (pochi gradi in 700ms)
  const seq = [90, 90, 90, 120, 150, 170];        // strike a t≈99ms
  const slowRet = [169, 168, 167, 166];           // ritorno ~1°/campione
  const r = analyzeKinematics(samples([...seq, ...slowRet], 60));
  assert.equal(r.strikes.tot, 1);
  assert.equal(r.strikes.lenti, 1);
  assert.equal(r.strikes.esplosivi, 0);
});

test('analyzeKinematics: due colpi distinti non si fondono (refrattario)', () => {
  const punch = [90, 120, 150, 170, 130, 95];     // 1 colpo, ritorno veloce
  const gap = [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90]; // >350ms di pausa
  const r = analyzeKinematics(samples([...punch, ...gap, ...punch]));
  assert.equal(r.strikes.tot, 2);
  assert.equal(r.strikes.esplosivi, 2);
});

test('analyzeKinematics: buchi di tracking non producono velocità folli', () => {
  // salto temporale di 500ms con grande Δ angolare → NON deve contare come picco
  const arr = [
    { t: 0, eL: 100, eR: 90, kL: 165, kR: 165 },
    { t: 500, eL: 100, eR: 170, kL: 165, kR: 165 },
  ];
  const r = analyzeKinematics(arr);
  assert.equal(r.peakDeg, 0);
  assert.equal(r.active, false);
});

test('fatigueFromTrend: stance che si stringe → fatica segnalata', () => {
  const trend = [];
  for (let i = 0; i < 12; i++) {
    trend.push({ t: i * 5000, stanceW: 0.42 - i * 0.008, guardDown: 0.1 });
  }
  const f = fatigueFromTrend(trend);
  assert.equal(f.fatigued, true);
  assert.ok(f.stanceDrift <= -12, `drift atteso <= -12, ottenuto ${f.stanceDrift}`);
  assert.ok(f.reasons.some((r) => /stance/.test(r)));
});

test('fatigueFromTrend: guardia che cede → fatica segnalata', () => {
  const trend = [];
  for (let i = 0; i < 12; i++) {
    trend.push({ t: i * 5000, stanceW: 0.4, guardDown: i < 4 ? 0.1 : 0.5 });
  }
  const f = fatigueFromTrend(trend);
  assert.equal(f.fatigued, true);
  assert.ok(f.reasons.some((r) => /guardia/.test(r)));
});

test('fatigueFromTrend: sessione stabile → nessuna fatica', () => {
  const trend = [];
  for (let i = 0; i < 12; i++) trend.push({ t: i * 5000, stanceW: 0.4, guardDown: 0.1 });
  const f = fatigueFromTrend(trend);
  assert.equal(f.fatigued, false);
  assert.equal(f.reasons.length, 0);
});

test('fatigueFromTrend: pochi campioni → non si esprime', () => {
  const f = fatigueFromTrend([{ t: 0, stanceW: 0.4, guardDown: 0.1 }]);
  assert.equal(f.fatigued, false);
});

test('detectKicks: estensione esplosiva del ginocchio = calcio contato', () => {
  const state = {};
  const prev = { t: 0, kL: 110, kR: 165, eL: 100, eR: 100 };
  const cur = { t: 33, kL: 160, kR: 165, eL: 100, eR: 100 }; // ~1515°/s
  const hits = detectKicks(prev, cur, state);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].side, 'kL');
  assert.ok(hits[0].vel > 500);
});

test('detectKicks: refrattario anti doppio conteggio, ginocchia indipendenti', () => {
  const state = {};
  const base = { kL: 110, kR: 110, eL: 100, eR: 100 };
  assert.equal(detectKicks({ ...base, t: 0 }, { ...base, kL: 160, kR: 160, t: 33 }, state).length, 2); // entrambe le gambe
  assert.equal(detectKicks({ ...base, kL: 110, kR: 160, t: 33 }, { ...base, kL: 160, kR: 160, t: 66 }, state).length, 0); // dentro il refrattario
  assert.equal(detectKicks({ ...base, kL: 110, kR: 110, t: 800 }, { ...base, kL: 160, kR: 110, t: 833 }, state).length, 1); // dopo il refrattario
});

test('detectKicks: movimento lento non conta', () => {
  const state = {};
  const hits = detectKicks({ t: 0, kL: 150, kR: 150 }, { t: 33, kL: 160, kR: 158 }, state);
  assert.equal(hits.length, 0);
});

test('kickLevelFromMatch: zero calci = zero; volume+velocità crescono fino a 100', () => {
  assert.equal(kickLevelFromMatch({ tot: 0, avgPeak: 900 }), 0);
  const low = kickLevelFromMatch({ tot: 5, avgPeak: 500 });
  const mid = kickLevelFromMatch({ tot: 15, avgPeak: 700 });
  const high = kickLevelFromMatch({ tot: 40, avgPeak: 1200 });
  assert.ok(low > 0 && low < mid && mid < high);
  assert.equal(high, 100); // cap
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepCounter, REP_PRESETS } from '../lib/repCounter.js';

// Genera un ciclo: 170° → minAng → 170° in `dur` ms (campioni ogni 33ms)
function cycle(t0, minAng, dur = 900, joints = ['kL', 'kR']) {
  const out = [];
  const steps = Math.max(2, Math.floor(dur / 2 / 33));
  const mk = (t, ang) => { const s = { t }; for (const j of joints) s[j] = ang; return s; };
  for (let i = 0; i <= steps; i += 1) out.push(mk(t0 + i * 33, 170 - (170 - minAng) * (i / steps)));
  for (let i = 1; i <= steps; i += 1) out.push(mk(t0 + dur / 2 + i * 33, minAng + (170 - minAng) * (i / steps)));
  return out;
}

test('squat: due cicli completi = 2 ripetizioni', () => {
  const c = createRepCounter('squat');
  let counted = 0;
  for (const s of [...cycle(0, 90), ...cycle(1100, 90)]) {
    if (c.push(s).counted) counted += 1;
  }
  assert.equal(counted, 2);
  assert.equal(c.count, 2);
});

test('squat: ripetizione poco profonda segnalata bad', () => {
  const c = createRepCounter('squat');
  const results = [];
  for (const s of cycle(0, 112)) results.push(c.push(s));
  const hit = results.find((r) => r.counted);
  assert.ok(hit, 'la rep viene contata');
  assert.equal(hit.bad, true, 'ma è poco profonda');
});

test('squat: ripetizione profonda non è bad', () => {
  const c = createRepCounter('squat');
  const results = [];
  for (const s of cycle(0, 88)) results.push(c.push(s));
  const hit = results.find((r) => r.counted);
  assert.ok(hit);
  assert.equal(hit.bad, false);
});

test('squat: tremolio veloce non conta doppie rep', () => {
  const c = createRepCounter('squat');
  // Oscillazioni rapide attorno alla soglia (sotto minCycleMs)
  const seq = [];
  let t = 0;
  for (let i = 0; i < 12; i += 1) {
    seq.push({ t, kL: 120, kR: 120, eL: 170, eR: 170 });
    seq.push({ t: t + 40, kL: 160, kR: 160, eL: 170, eR: 170 });
    t += 80;
  }
  let counted = 0;
  for (const s of seq) if (c.push(s).counted) counted += 1;
  assert.ok(counted <= 2, `al massimo 2 rep dal tremolio, ottenute ${counted}`);
});

test('push: conta i piegamenti sui gomiti', () => {
  const c = createRepCounter('push');
  const seq = [...cycle(0, 85, 800, ['eL', 'eR']), ...cycle(1000, 85, 800, ['eL', 'eR'])];
  let counted = 0;
  for (const s of seq) if (c.push(s).counted) counted += 1;
  assert.equal(counted, 2);
});

test('kicks: estensioni esplosive del ginocchio = calci', () => {
  const c = createRepCounter('kicks');
  const seq = [
    { t: 0, kL: 110, kR: 165 },
    { t: 33, kL: 162, kR: 165 },   // ~1575°/s → calcio
    { t: 800, kL: 110, kR: 165 },
    { t: 833, kL: 160, kR: 165 },  // altro calcio (fuori refrattario 700ms)
  ];
  let counted = 0;
  let peak = 0;
  for (const s of seq) { const r = c.push(s); if (r.counted) { counted += 1; peak = Math.max(peak, r.peakVel); } }
  assert.equal(counted, 2);
  assert.ok(peak > 500);
});

test('reset azzera il contatore', () => {
  const c = createRepCounter('squat');
  for (const s of cycle(0, 90)) c.push(s);
  assert.equal(c.count, 1);
  c.reset();
  assert.equal(c.count, 0);
});

test('preset esposti per la UI', () => {
  assert.ok(REP_PRESETS.squat && REP_PRESETS.push && REP_PRESETS.kicks);
  assert.equal(REP_PRESETS.squat.label, 'Squat');
});

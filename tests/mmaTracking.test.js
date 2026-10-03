import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoseFilter, WORLD_FILTER } from '../lib/poseFilter.js';
import { createReadiness, readPose } from '../lib/mmaReadiness.js';
import { createComboJudge, describeGesture, rateGesture } from '../lib/mmaComboJudge.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { synthSequence, calibrationFrames, calibrateJudge, BASE3D } from './helpers/synthFighter.js';

const P = (x, y, z = 0) => ({ x, y, z, visibility: 0.99 });
const worldOf = (over = {}) => { const a = Array.from({ length: 33 }, () => P(0, 0)); for (const [k, v] of Object.entries({ ...BASE3D, ...over })) a[k] = { ...v }; return a; };
// 2D di una persona inquadrata bene, di tre quarti
const image = (over = {}) => {
  const a = Array.from({ length: 33 }, () => P(0.5, 0.5));
  const pts = { 0: P(0.5, 0.18), 11: P(0.44, 0.3), 12: P(0.56, 0.3), 13: P(0.42, 0.42), 14: P(0.58, 0.42), 15: P(0.47, 0.22), 16: P(0.54, 0.22), 23: P(0.46, 0.56), 24: P(0.54, 0.56), 25: P(0.45, 0.72), 26: P(0.55, 0.72), 27: P(0.44, 0.9), 28: P(0.56, 0.9) };
  for (const [k, v] of Object.entries({ ...pts, ...over })) a[k] = v;
  return a;
};
function noisy(frames, { sigma = 0.02, drop = 0.1, seed = 7 } = {}) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return frames.filter(() => rnd() > drop).map((f) => ({ ...f, world: f.world.map((p) => ({ ...p, x: p.x + gauss() * sigma, y: p.y + gauss() * sigma, z: p.z + gauss() * sigma * 1.5 })) }));
}

test('filtro: da fermo taglia il tremolio, in movimento segue senza perdere il picco', () => {
  const f = createPoseFilter(WORLD_FILTER);
  let s = 3; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  let rawSq = 0, outSq = 0;
  for (let i = 0; i < 90; i += 1) { const n = rnd() * 0.04; const out = f.apply([P(0.1 + n, 0, 0)], i * 33); if (i > 20) { rawSq += n * n; outSq += (out[0].x - 0.1) ** 2; } }
  assert.ok(Math.sqrt(outSq / rawSq) < 0.6, `tremolio residuo ${Math.sqrt(outSq / rawSq).toFixed(2)} del grezzo`);
  // jab: il polso va avanti di 45 cm in 100 ms e torna
  const g = createPoseFilter(WORLD_FILTER); let peak = 0;
  for (let i = 0; i < 20; i += 1) { const t = i * 33; const x = t < 100 ? 0 : t < 200 ? 0.45 * Math.min(1, (t - 100) / 100) : Math.max(0, 0.45 - 0.45 * (t - 200) / 120); peak = Math.max(peak, g.apply([P(x, 0, 0)], t)[0].x); }
  assert.ok(peak > 0.36, `picco filtrato ${peak}`);
});

test('pronto: guardia in 3D anche con la mano dietro coperta (tre quarti)', () => {
  const pts = image({ 16: { ...P(0.54, 0.22), visibility: 0.1 }, 14: { ...P(0.58, 0.42), visibility: 0.2 } });
  const r = readPose(pts, worldOf(), { aspect: 0.75 });
  assert.equal(r.visible, true); assert.equal(r.guard.both, true); assert.equal(r.ok, true, r.hint);
});

test('pronto: mani basse, troppo vicino, piedi fuori → suggerimento giusto', () => {
  assert.equal(readPose(image({ 15: P(0.43, 0.45), 16: P(0.57, 0.45) }), worldOf({ 15: P(0.2, -0.05, -0.1), 16: P(-0.2, -0.05, 0.05) })).key, 'guard');
  // una sola mano sotto la spalla nell'immagine → ancora "guardia"
  assert.equal(readPose(image({ 16: P(0.57, 0.36) }), worldOf()).key, 'guard');
  assert.equal(readPose(image({ 11: P(0.1, 0.3), 12: P(0.9, 0.3) }), worldOf()).key, 'close');
  assert.equal(readPose(image({ 27: P(0.44, 1.05), 28: P(0.56, 1.05) }), worldOf(), { needFeet: true }).key, 'feet');
  assert.equal(readPose(image({ 23: P(0.46, 1.1), 24: P(0.54, 1.1) }), worldOf()).visible, false);
});

test('pronto: un fotogramma storto non azzera la barra', () => {
  const r = createReadiness({ holdMs: 1000 });
  let t = 0;
  for (; t <= 700; t += 33) r.update(true, t);
  const before = r.progress;
  r.update(false, t += 33);
  assert.ok(r.progress > before - 0.05);
  for (; t <= 1300; t += 33) r.update(true, t);
  assert.equal(r.done, true);
});

test('giudice: 1-1-2 veloce senza pause resta due jab e un diretto (anche a 15 fps)', () => {
  for (const fps of [30, 15]) {
    const j = createComboJudge(); calibrateJudge(j);
    for (const f of synthSequence(['jab', 'jab', 'cross'], { fps, tempo: 0.5, gapMs: 0 })) j.push(f.world, f.t, f.points);
    const r = j.judgeRep(['jab', 'jab', 'cross']);
    assert.ok(r.moves.every((m) => m.status === 'ok'), `${fps} fps: ${j.gestures().map(describeGesture)}`);
    assert.equal(r.extras, 0);
  }
});

test('giudice + filtro: combo della libreria con tremolio di 2 cm restano promosse', () => {
  const failed = [];
  for (const c of COMBOS.filter((x) => !x.moves.includes('clinch'))) {
    const j = createComboJudge(); calibrateJudge(j);
    const f = createPoseFilter(WORLD_FILTER);
    for (const fr of noisy(synthSequence(c.moves, { fps: 24, tempo: 0.7 }), { seed: 5 })) j.push(f.apply(fr.world, fr.t), fr.t, fr.points);
    const r = j.judgeRep(c.moves);
    if (r.grade === 'redo' || r.moves.some((m) => m.status === 'missing')) failed.push(`${c.name}: ${r.total} [${j.gestures().map(describeGesture)}]`);
  }
  assert.ok(failed.length <= 1, failed.join(' | '));
});

test('colpo singolo: riconosce la tecnica e dà la correzione', () => {
  const j = createComboJudge(); calibrateJudge(j);
  for (const f of synthSequence(['jab', 'cross', 'hook'])) j.push(f.world, f.t, f.points);
  assert.deepEqual(j.gestures().map((g) => rateGesture(g)?.id), ['jab', 'cross', 'hook']);
  const k = createComboJudge(); calibrateJudge(k);
  for (const f of synthSequence(['cross'], { mutate: (id, p) => ({ ...p, 15: P(0.18, -0.05, -0.1) }) })) k.push(f.world, f.t, f.points);
  const rate = rateGesture(k.gestures().find((g) => g.kind === 'straight'));
  assert.equal(rate.id, 'cross'); assert.ok(rate.issues.some((it) => it.key === 'guard')); assert.ok(rate.score < 100);
});

test('giudice: abort butta via il gesto a metà (corpo uscito dall’inquadratura)', () => {
  const j = createComboJudge(); calibrateJudge(j);
  const frames = synthSequence(['jab']);
  const half = frames.findIndex((f) => f.world[15].z < -0.5);
  frames.slice(0, half).forEach((f) => j.push(f.world, f.t, f.points));
  j.abort();
  frames.slice(-10).forEach((f) => j.push(f.world, f.t + 2000, f.points));
  assert.deepEqual(j.gestures(), []);
});

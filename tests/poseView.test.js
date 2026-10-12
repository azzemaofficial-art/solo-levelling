// Scheletro disegnato (lib/poseView.js) e filtro del disegno (createImageFilter): fluido a 60 Hz,
// fermo quando sei fermo, niente lampeggi, salti impossibili frenati.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoseView, VIEW } from '../lib/poseView.js';
import { createImageFilter, DISPLAY_FILTER } from '../lib/poseFilter.js';

const pose = (x, y = 0.5, visibility = 0.95) => Array.from({ length: 33 }, (_, i) => ({ x: x + i * 0.001, y, visibility }));

test('disegno: a 60 Hz lo scheletro scivola tra due risultati invece di saltare', () => {
  const v = createPoseView();
  v.push(pose(0.3), 0); v.frame(10);
  v.push(pose(0.5), 40);
  // risultati ogni 40 ms, schermo ogni 16,7 ms: nessun passo deve essere un salto intero
  const xs = [];
  for (let t = 45; t <= 200; t += 1000 / 60) xs.push(v.frame(t)[15].x);
  const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
  assert.ok(Math.max(...steps) < 0.2 * 0.6, `passo massimo ${Math.max(...steps).toFixed(3)}`);
  assert.ok(xs.at(-1) > 0.45, 'arriva vicino alla posizione nuova');
});

test('disegno: da fermo non si muove, e la previsione non va oltre hMax', () => {
  const v = createPoseView();
  for (let t = 0; t <= 400; t += 40) v.push(pose(0.4), t);
  const a = v.frame(420)[11].x, b = v.frame(440)[11].x;
  assert.ok(Math.abs(a - b) < 1e-9);
  // in movimento costante (1 unità/s) la previsione si ferma a hMax × gain
  const p = createPoseView({ follow: 0 });
  p.push(pose(0.1), 0); p.push(pose(0.14), 40);
  const ahead = p.frame(40 + 1000)[11].x - (0.14 + 0.011);
  // oltre staleMs il risultato è troppo vecchio: niente scheletro
  assert.equal(p.frame(40 + VIEW.staleMs + 1), null);
  assert.ok(Math.abs(ahead - (VIEW.hMax * VIEW.gain) / 1000) < 1e-6, `previsione ${ahead}`);
});

test('disegno: la visibilità sfuma (niente lampeggi) e senza persona non si disegna niente', () => {
  const v = createPoseView();
  v.push(pose(0.4, 0.5, 0.9), 0); v.frame(0);
  v.push(pose(0.4, 0.5, 0.1), 40);
  const vis = v.frame(56)[11].visibility;
  assert.ok(vis > 0.5 && vis < 0.9, `visibilità ${vis}`);
  v.push([], 80);
  assert.equal(v.frame(90), null);
});

test('filtro del disegno: leviga il tremolio e frena un salto impossibile del busto', () => {
  const f = createImageFilter(DISPLAY_FILTER);
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  let rawMove = 0, outMove = 0, prev = null, prevRaw = null;
  for (let t = 0; t < 2000; t += 40) {
    const p = pose(0.5).map((q) => ({ ...q, x: q.x + rnd() * 0.01, y: q.y + rnd() * 0.01 }));
    const o = f.apply(p, t, 4 / 3);
    if (prev) { outMove += Math.abs(o[11].x - prev[11].x); rawMove += Math.abs(p[11].x - prevRaw[11].x); }
    prev = o; prevRaw = p;
  }
  assert.ok(outMove < rawMove * 0.6, `tremolio ${outMove.toFixed(3)} vs ${rawMove.toFixed(3)}`);
  // la spalla "teletrasporta" di 0,3 immagini in 40 ms (errore del modello): se ne segue solo una parte;
  // il polso invece può andare veloce (un pugno) e lo si segue quasi tutto
  const g = createImageFilter(DISPLAY_FILTER);
  g.apply(pose(0.3), 0, 1);
  const before = g.apply(pose(0.3), 40, 1);
  const after = g.apply(pose(0.6), 80, 1);
  assert.ok(after[11].x - before[11].x < 0.15, `spalla: salto seguito ${(after[11].x - before[11].x).toFixed(2)}`);
  assert.ok(after[15].x - before[15].x > 0.2, `polso: seguito ${(after[15].x - before[15].x).toFixed(2)}`);
});

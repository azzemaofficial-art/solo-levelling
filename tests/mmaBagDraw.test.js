import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBag } from '../lib/mmaBagDraw.js';
import { bagTargets, bagZones } from '../lib/mmaBag.js';

// contesto finto: registra le chiamate che contano
function mockCtx() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get(target, k) {
      if (k in target) return target[k];
      return (...args) => { calls.push([k, ...args]); };
    },
    set(target, k, v) { calls.push([`=${String(k)}`, v]); return true; },
  });
  return ctx;
}
const BAG = {
  ok: true, box: { x0: 0.3, x1: 0.45, y0: 0.12, y1: 0.62 }, axis: { xTop: 0.375, xBot: 0.375 }, width: 0.15, imgAspect: 0.75,
  outline: Array.from({ length: 13 }, (_, k) => ({ y: 0.12 + (k / 12) * 0.5, l: 0.3, r: 0.45 })),
};
const targets = bagTargets(BAG, bagZones(BAG), ['jab', 'cross', 'hook'], { labels: ['1', '2', '3'] });

test('disegno sacco: senza sacco non disegna niente', () => {
  const ctx = mockCtx();
  drawBag(ctx, 360, 480, { bag: null }, 0);
  drawBag(ctx, 360, 480, null, 0);
  assert.equal(ctx.calls.length, 0);
});

test('disegno sacco: da confermare = solo contorno, niente numeri', () => {
  const ctx = mockCtx();
  drawBag(ctx, 360, 480, { bag: BAG, mode: 'confirm', targets }, 100);
  assert.ok(ctx.calls.some(([k]) => k === 'stroke'));
  assert.ok(ctx.calls.some(([k]) => k === 'fill'), 'contorno riempito');
  assert.ok(!ctx.calls.some(([k]) => k === 'fillText'));
  // save/restore in pari (l'overlay non sporca il canvas)
  assert.equal(ctx.calls.filter(([k]) => k === 'save').length, ctx.calls.filter(([k]) => k === 'restore').length);
});

test('disegno sacco: bersagli numerati, raddrizzati se il canvas è specchiato, colpito pieno', () => {
  assert.equal(targets.length, 3);
  const plain = mockCtx();
  drawBag(plain, 360, 480, { bag: BAG, mode: 'live', targets, next: 1, hits: { 0: 50 }, mirrored: false }, 100);
  assert.deepEqual(plain.calls.filter(([k]) => k === 'fillText').map((c) => c[1]), ['1', '2', '3']);
  assert.ok(!plain.calls.some(([k, a]) => k === 'scale' && a === -1));
  const mir = mockCtx();
  drawBag(mir, 360, 480, { bag: BAG, mode: 'live', targets, next: 1, hits: { 0: 50 }, mirrored: true }, 100);
  assert.equal(mir.calls.filter(([k, a, b]) => k === 'scale' && a === -1 && b === 1).length, 3);
  assert.equal(mir.calls.filter(([k]) => k === 'save').length, mir.calls.filter(([k]) => k === 'restore').length);
  // il colpito ha il disco pieno: almeno un fill col colore del lato
  assert.ok(plain.calls.some(([k, v]) => k === '=fillStyle' && /109,226,211,0\.5/.test(v)));
});

test('disegno sacco: il sacco che oscilla sposta contorno e bersagli', () => {
  const xs = (off) => {
    const ctx = mockCtx();
    drawBag(ctx, 360, 480, { bag: BAG, mode: 'live', targets, offsetX: off }, 0);
    return ctx.calls.filter(([k]) => k === 'arc').map((c) => c[1]);
  };
  const a = xs(0), b = xs(0.05);
  assert.equal(a.length, b.length);
  a.forEach((x, k) => assert.ok(Math.abs(b[k] - x - 0.05 * 360) < 1e-6));
});

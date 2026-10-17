// Video e scheletro sincronizzati (lib/poseView.js → createFrameSync) e tocco → punto dell'immagine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameSync, SYNC, toImagePoint } from '../lib/poseView.js';

const pose = (x, vis = 0.95) => Array.from({ length: 33 }, (_, i) => ({ x: x + i * 0.001, y: 0.5, visibility: vis }));
// simula il telefono: fotogrammi ogni 33 ms, risultati `lag` ms dopo, schermo a 60 Hz.
// analyzed(i) = il modello legge il fotogramma i? Restituisce cosa si vede a ogni aggiornamento.
function run({ frames = 60, lag = 45, analyzed = () => true, xOf = (t) => t / 1000, sync = {} } = {}) {
  const s = createFrameSync(sync), shown = [], pending = [];
  let f = 0;
  for (let now = 0; now < frames * 33 + 300; now += 1000 / 60) {
    while (f < frames && f * 33 <= now) { s.frame(f * 33); if (analyzed(f)) pending.push({ t: f * 33, at: f * 33 + lag }); f += 1; }
    while (pending.length && pending[0].at <= now) { const p = pending.shift(); s.result(p.t, pose(xOf(p.t)), p.at); }
    const out = s.pick(now);
    if (out) shown.push({ now, ...out });
  }
  return shown;
}

test('sincro: ogni fotogramma mostrato ha il SUO scheletro, con un ritardo piccolo e costante', () => {
  const shown = run().filter((o) => o.changed && o.now > 400);
  assert.ok(shown.length > 20);
  for (const o of shown) {
    // lo scheletro è quello del risultato di quel fotogramma: nessuno scarto da previsione
    assert.ok(Math.abs(o.points[0].x - o.t / 1000) < 1e-9, `t=${o.t}: x ${o.points[0].x}`);
    // l'immagine resta indietro di poco più del tempo del modello (45 ms), sotto dMax + un fotogramma
    assert.ok(o.now - o.t >= 45 && o.now - o.t <= SYNC.dMax + 33 + 17, `ritardo ${(o.now - o.t).toFixed(0)} ms`);
  }
  // mai indietro nel tempo
  shown.slice(1).forEach((o, i) => assert.ok(o.t > shown[i].t));
});

test('sincro: un fotogramma saltato dal modello prende lo scheletro a metà tra i due vicini', () => {
  // il modello legge un fotogramma sì e uno no; il ritardo ammesso basta a coprire quelli in mezzo
  const shown = run({ analyzed: (i) => i % 2 === 0, sync: { dMax: 120, q: 0.9, maxGap: 90 } }).filter((o) => o.changed && o.now > 500);
  const middle = shown.filter((o) => (o.t / 33) % 2 === 1);
  assert.ok(middle.length > 5, `fotogrammi in mezzo mostrati: ${middle.length}`);
  // movimento lineare: a metà strada l'interpolazione è esatta
  for (const o of middle) assert.ok(Math.abs(o.points[0].x - o.t / 1000) < 1e-9);
});

test('sincro: se il risultato non è ancora arrivato si tiene l’ultimo fotogramma noto, non si inventa', () => {
  const s = createFrameSync();
  for (let i = 0; i < 7; i += 1) s.frame(i * 33);
  for (const t of [0, 33, 66, 99, 132]) s.result(t, pose(t / 1000), t + 45);
  const a = s.pick(250);
  assert.equal(a.t, 132, 'l’ultimo fotogramma con risultato');
  // il fotogramma 165 non ha ancora un risultato: resta il 132, senza ridisegno
  const b = s.pick(266);
  assert.equal(b.t, 132); assert.equal(b.changed, false);
  s.result(165, pose(0.165), 270);
  const c = s.pick(280);
  assert.equal(c.t, 165); assert.equal(c.changed, true);
  assert.ok(Math.abs(c.points[0].x - 0.165) < 1e-9);
});

test('sincro: modello troppo lento, fermo o senza persona', () => {
  // lezioni a 12 fps (un risultato ogni 80 ms): meglio il video in diretta
  assert.equal(run({ frames: 40, analyzed: (i) => i % 3 === 0 }).filter((o) => o.now > 500).length, 0);
  // al limite (un risultato ogni 66 ms, poi ogni 75) non si salta avanti e indietro: si resta in diretta…
  assert.equal(run({ frames: 60, analyzed: (i) => i % 2 === 0 }).filter((o) => o.now > 500).length, 0);
  // …e chi è già sincronizzato resta sincronizzato finché il modello non rallenta oltre 80 ms
  const near = createFrameSync();
  for (let i = 0; i < 8; i += 1) { near.frame(i * 33); near.result(i * 33, pose(0.3), i * 33 + 45); near.pick(i * 33 + 60); }
  for (let i = 8; i < 30; i += 2) { near.frame(i * 33); near.frame(i * 33 + 33); near.result(i * 33, pose(0.3), i * 33 + 45); }
  assert.ok(near.pick(30 * 33), 'media 66 ms: resta sincronizzato');
  // nessun risultato nuovo da oltre liveAfter (cambio modello): diretta
  const s = createFrameSync();
  for (let i = 0; i < 6; i += 1) { s.frame(i * 33); s.result(i * 33, pose(0.3), i * 33 + 45); }
  assert.ok(s.pick(260));
  assert.equal(s.pick(165 + SYNC.liveAfter + 1), null);
  // nessuno in scena: il fotogramma si mostra, lo scheletro no
  const e = createFrameSync();
  for (let i = 0; i < 6; i += 1) { e.frame(i * 33); e.result(i * 33, [], i * 33 + 45); }
  const out = e.pick(260);
  assert.ok(out && out.points === null);
});

test('sincro: la visibilità sfuma tra un fotogramma e l’altro (niente lampeggi)', () => {
  const s = createFrameSync();
  for (let i = 0; i < 6; i += 1) { s.frame(i * 33); s.result(i * 33, pose(0.3, i < 5 ? 0.9 : 0.1), i * 33 + 45); }
  let last = null;
  for (let now = 100; now < 260; now += 16) { const o = s.pick(now); if (o?.changed) last = o; }
  assert.equal(last.t, 165);
  assert.ok(last.points[11].visibility > 0.4 && last.points[11].visibility < 0.9, `visibilità ${last.points[11].visibility}`);
});

test('tocco → punto dell’immagine: object-fit cover, contain e camera frontale specchiata', () => {
  // riquadro verticale 300×400 a (10, 20) che mostra una camera 960×720
  const rect = { left: 10, top: 20, width: 300, height: 400 };
  const c = toImagePoint(160, 220, rect, 960, 720, 'cover');
  assert.ok(Math.abs(c.x - 0.5) < 1e-9 && Math.abs(c.y - 0.5) < 1e-9);
  // cover: l'immagine è larga 533 px e tagliata ai lati → il bordo sinistro è a x = 0,219
  const left = toImagePoint(10, 220, rect, 960, 720, 'cover');
  assert.ok(Math.abs(left.x - 0.21875) < 1e-6, `x ${left.x}`);
  // specchiata: il bordo sinistro dello schermo è la parte destra dell'immagine
  assert.ok(Math.abs(toImagePoint(10, 220, rect, 960, 720, 'cover', true).x - 0.78125) < 1e-6);
  // contain: immagine 300×225 al centro, bande sopra e sotto
  const top = toImagePoint(10, 20 + 87.5, rect, 960, 720, 'contain');
  assert.ok(Math.abs(top.x) < 1e-9 && Math.abs(top.y) < 1e-9);
  assert.ok(toImagePoint(160, 40, rect, 960, 720, 'contain').y < 0, 'sopra l’immagine: fuori da 0–1');
  // fill (default del canvas): si stira
  const fill = toImagePoint(310, 420, rect, 960, 720, 'fill');
  assert.ok(Math.abs(fill.x - 1) < 1e-9 && Math.abs(fill.y - 1) < 1e-9);
  assert.equal(toImagePoint(0, 0, rect, 0, 0), null);
});

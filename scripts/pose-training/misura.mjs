// Simula lo schermo del telefono a 60 Hz con il codice vero dell'app (filtro + lib/poseView.js).
// Misure, in busti (1 = lunghezza del busto nell'immagine):
// - staccato: distanza tra lo scheletro disegnato e il corpo NELL'IMMAGINE MOSTRATA (solo dentro i pugni)
// - scatti: accelerazione dell'errore a 60 Hz (salti quando arriva un risultato nuovo)
// - fermo: tremolio quando il corpo è fermo, in busti al secondo
// - salti: % di istanti con un punto delle braccia a più di mezzo busto dal posto giusto
// - ritardo: ms tra la diretta e l'immagine mostrata (0 con il video in diretta)
// ref: 'frame' = il corpo nell'ultimo fotogramma della camera, quello che si vede davvero (dal 17/10);
// 'D' = il corpo nell'istante esatto dello schermo, come la misura del 10/10 (il video però cambia
// immagine solo 25–30 volte al secondo, quindi quella misura premiava lo scheletro che scivola)
import { createFrameSync, createPoseView } from '../../lib/poseView.js';
import { GROUPS } from './dati.mjs';

// Quando arrivano i risultati del modello. Restituisce [{ i, t, ready }]: i = fotogramma letto,
// t = tempo che l'app gli dà, ready = quando il risultato arriva alla pagina.
// - 'fisso': tutti i fotogrammi letti, ognuno L ms dopo (la simulazione del 10/10/2026)
// - 'raf': il telefono con la catena fino al 16/10: si guarda il video a ogni aggiornamento dello
//   schermo, createImageBitmap a piena risoluzione (cib ms), il tempo è quello del rAF (non del fotogramma)
// - 'subito': la catena nuova: appena il modello si libera gli si passa l'ultimo fotogramma già
//   copiato (piccolo, ~1 ms), col tempo vero del fotogramma
// inf = ms di calcolo del modello (± jit, seme fisso), msg = ms per passare i messaggi
export function schedule(ds, kind = 'fisso', { L = 45, inf = 33, jit = 8, cib = 6, msg = 2, minInterval = 33, seed = 5 } = {}) {
  const fr = ds.frames;
  if (kind === 'fisso') return fr.map((f, i) => ({ i, t: f.t, ready: f.t + L }));
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cost = () => Math.max(12, inf + jit * (rnd() + rnd() + rnd() - 1.5) * 1.4);
  const out = [], tick = 1000 / 60;
  let free = fr[0].t, lastSent = -Infinity, lastImg = -1, k = 0;
  const newest = (t) => { while (k + 1 < fr.length && fr[k + 1].t <= t) k += 1; return fr[k].t <= t ? k : -1; };
  while (true) {
    if (kind === 'raf') {
      // il prossimo aggiornamento dello schermo dopo che il modello è libero
      let r = Math.ceil((free - fr[0].t) / tick) * tick + fr[0].t, i = -1;
      for (; r < fr.at(-1).t; r += tick) { i = newest(r); if (i > lastImg && r - lastSent >= minInterval) break; }
      if (r >= fr.at(-1).t) break;
      lastSent = r; lastImg = i;
      const ready = r + cib + cost() + msg;
      out.push({ i, t: r, ready }); free = ready;
    } else {
      // l'ultimo fotogramma non ancora letto; se non c'è, si aspetta il prossimo
      let i = newest(free);
      if (i <= lastImg || fr[i].t - lastSent < minInterval - 4) { i = Math.max(i, lastImg) + 1; while (i < fr.length && fr[i].t - lastSent < minInterval - 4) i += 1; }
      if (i >= fr.length) break;
      const start = Math.max(free, fr[i].t) + 1;
      lastSent = fr[i].t; lastImg = i;
      const ready = start + cost() + msg;
      out.push({ i, t: fr[i].t, ready }); free = ready;
    }
  }
  return out;
}

function tracker(ds) {
  const fts = ds.frames.map((f) => f.t);
  let fk = 0;
  // ultimo fotogramma della camera già arrivato all'istante D (= cosa mostra il video in diretta)
  const liveImg = (D) => { while (fk + 1 < fts.length && fts[fk + 1] <= D) fk += 1; return fts[fk]; };
  const { aspect: A, teach } = ds, T = teach.T;
  const acc = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, { e: 0, n: 0, big: 0, jerk: 0, nj: 0, still: 0, ns: 0 }]));
  const hist = {}, lastStill = {}, lag = [];
  let shownN = 0, lastShown = null, ticks = 0, live = 0;
  return {
    liveImg,
    // pts = scheletro disegnato all'istante D; img = istante dell'immagine mostrata
    add(pts, img, D, isLive) {
      ticks += 1; if (isLive) live += 1;
      if (img !== lastShown) { shownN += 1; lastShown = img; }
      lag.push(Math.max(0, liveImg(D) - img));
      if (!pts) return;
      for (const [g, js] of Object.entries(GROUPS)) for (const j of js) {
        const p = pts[j], a = acc[g];
        const sp = ds.still(j, img);
        if (sp) {
          const r = [p.x * A - sp[0], p.y - sp[1]];
          if (lastStill[j]) { a.still += Math.hypot(r[0] - lastStill[j][0], r[1] - lastStill[j][1]) / T; a.ns += 1; }
          lastStill[j] = r;
        } else delete lastStill[j];
        const tp = teach.at(j, img);
        if (!tp) { delete hist[j]; continue; }
        const r = [(p.x * A - tp[0]) / T, (p.y - tp[1]) / T], e = Math.hypot(r[0], r[1]);
        a.e += e; a.n += 1; if (e > 0.5) a.big += 1;
        const h = hist[j] || (hist[j] = []);
        h.push(r); if (h.length > 3) h.shift();
        if (h.length === 3) { a.jerk += Math.hypot(h[2][0] - 2 * h[1][0] + h[0][0], h[2][1] - 2 * h[1][1] + h[0][1]); a.nj += 1; }
      }
    },
    result(results, dur) {
      const res = {};
      for (const [g, a] of Object.entries(acc)) res[g] = { err: a.e / a.n, big: a.big / a.n, jerk: a.jerk / a.nj, still: (a.still / a.ns) * 60 };
      res.score = Object.keys(GROUPS).reduce((s, g) => s + (g === 'braccia' ? 2 : 1) * (res[g].err + 3 * res[g].jerk + 0.5 * res[g].still), 0) + res.braccia.big;
      const sl = [...lag].sort((x, y) => x - y);
      res.delay = lag.reduce((s, x) => s + x, 0) / lag.length; res.delay90 = sl[Math.floor(sl.length * 0.9)];
      res.fps = shownN / (dur / 1000); res.live = live / ticks;
      res.rps = results.length / (dur / 1000);
      res.wait = results.reduce((s, r) => s + r.ready - ds.frames[r.i].t, 0) / results.length;
      return res;
    },
  };
}

// Video in diretta + scheletro previsto (lib/poseView.js). view: opzioni del disegnatore, o 'step' =
// disegno solo all'arrivo dei risultati (com'era fino al 10/10/2026). results: da schedule().
export function measureLive(ds, results, makeFilter, view, ref = 'frame') {
  const { frames, aspect: A } = ds, filter = makeFilter();
  const res = results.map((r) => ({ ...r, points: filter.apply(frames[r.i].points, r.t, A) }));
  const pv = view === 'step' ? null : createPoseView(view), tr = tracker(ds);
  let k = 0, cur = null;
  const D0 = frames[0].t + 100;
  for (let D = D0; D < frames.at(-1).t; D += 1000 / 60) {
    while (k < res.length && res[k].ready <= D) {
      cur = res[k]; k += 1;
      if (pv) { if (k > 1 && cur.t - res[k - 2].t > 400) pv.reset(); pv.push(cur.points, cur.t); }
    }
    const pts = pv ? pv.frame(D) : cur && D - cur.t <= 400 ? cur.points : null;
    if (pts) tr.add(pts, ref === 'frame' ? tr.liveImg(D) : D, D, true);
  }
  return tr.result(results, frames.at(-1).t - D0);
}

// Video e scheletro sincronizzati (createFrameSync): si mostra il fotogramma letto col suo scheletro.
// Quando il sincronizzatore dice "diretta" si torna al disegno di measureLive (view).
export function measureSync(ds, results, makeFilter, sync = {}, view = {}) {
  const { frames, aspect: A } = ds, filter = makeFilter();
  const res = results.map((r) => ({ ...r, points: filter.apply(frames[r.i].points, r.t, A) }));
  const sy = createFrameSync(sync), pv = createPoseView(view), tr = tracker(ds);
  let k = 0, fi = 0;
  const D0 = frames[0].t + 100;
  for (let D = D0; D < frames.at(-1).t; D += 1000 / 60) {
    while (fi < frames.length && frames[fi].t <= D) { sy.frame(frames[fi].t); fi += 1; }
    while (k < res.length && res[k].ready <= D) {
      const r = res[k]; k += 1;
      sy.result(r.t, r.points, r.ready);
      if (k > 1 && r.t - res[k - 2].t > 400) pv.reset();
      pv.push(r.points, r.t);
    }
    const s = sy.pick(D);
    if (s) { if (s.points) tr.add(s.points, s.t, D, false); continue; }
    const pts = pv.frame(D);
    if (pts) tr.add(pts, tr.liveImg(D), D, true);
  }
  return tr.result(results, frames.at(-1).t - D0);
}

// Compatibile con la simulazione del 10/10: tutti i fotogrammi letti, risultati L ms dopo.
export const measure = (ds, makeFilter, view, L = 45) => measureLive(ds, schedule(ds, 'fisso', { L }), makeFilter, view, 'D');

export const fmt = (r) => `staccato braccia ${r.braccia.err.toFixed(3)} busto ${r.busto.err.toFixed(3)} · scatti braccia ${r.braccia.jerk.toFixed(3)} busto ${r.busto.jerk.toFixed(3)} · fermo braccia ${r.braccia.still.toFixed(3)} busto ${r.busto.still.toFixed(3)} · salti ${(r.braccia.big * 100).toFixed(1)}% · punteggio ${r.score.toFixed(3)}`;
export const fmtTime = (r) => `risultati ${r.rps.toFixed(1)}/s (arrivano ${r.wait.toFixed(0)} ms dopo il fotogramma) · immagine ${r.fps.toFixed(1)} fps, ritardo ${r.delay.toFixed(0)} ms (90%: ${r.delay90.toFixed(0)}) · in diretta ${(r.live * 100).toFixed(0)}%`;

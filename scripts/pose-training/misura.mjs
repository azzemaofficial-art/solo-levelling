// Simula lo schermo del telefono a 60 Hz con il codice vero dell'app (filtro + lib/poseView.js):
// ogni risultato del modello arriva L ms dopo il fotogramma letto, il video intanto mostra il presente.
// Misure, in busti (1 = lunghezza del busto nell'immagine):
// - staccato: distanza tra lo scheletro disegnato e il corpo vero (solo dentro i pugni)
// - scatti: accelerazione dell'errore a 60 Hz (salti quando arriva un risultato nuovo)
// - fermo: tremolio quando il corpo è fermo, in busti al secondo
// - salti: % di istanti con un punto delle braccia a più di mezzo busto dal posto giusto
import { createPoseView } from '../../lib/poseView.js';
import { GROUPS } from './dati.mjs';

// filtro: funzione che crea il filtro dei punti 2D; view: opzioni del disegnatore, o 'step' = disegno
// solo all'arrivo dei risultati (com'era fino al 10/10/2026)
export function measure(ds, makeFilter, view, L = 45) {
  const { frames, aspect: A, teach } = ds, T = teach.T;
  const filter = makeFilter();
  const results = frames.map((f) => ({ t: f.t, ready: f.t + L, points: filter.apply(f.points, f.t, A) }));
  const pv = view === 'step' ? null : createPoseView(view);
  const acc = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, { e: 0, n: 0, big: 0, jerk: 0, nj: 0, still: 0, ns: 0 }]));
  const hist = {}, lastStill = {};
  let k = 0, cur = null;
  for (let D = frames[0].t + 100; D < frames.at(-1).t; D += 1000 / 60) {
    while (k < results.length && results[k].ready <= D) {
      cur = results[k]; k += 1;
      if (pv) { if (k > 1 && cur.t - results[k - 2].t > 400) pv.reset(); pv.push(cur.points, cur.t); }
    }
    const pts = pv ? pv.frame(D) : cur && D - cur.t <= 400 ? cur.points : null;
    if (!pts) continue;
    for (const [g, js] of Object.entries(GROUPS)) for (const j of js) {
      const p = pts[j], a = acc[g];
      const sp = ds.still(j, D);
      if (sp) {
        const r = [p.x * A - sp[0], p.y - sp[1]];
        if (lastStill[j]) { a.still += Math.hypot(r[0] - lastStill[j][0], r[1] - lastStill[j][1]) / T; a.ns += 1; }
        lastStill[j] = r;
      } else delete lastStill[j];
      const tp = teach.at(j, D);
      if (!tp) { delete hist[j]; continue; }
      const r = [(p.x * A - tp[0]) / T, (p.y - tp[1]) / T], e = Math.hypot(r[0], r[1]);
      a.e += e; a.n += 1; if (e > 0.5) a.big += 1;
      const h = hist[j] || (hist[j] = []);
      h.push(r); if (h.length > 3) h.shift();
      if (h.length === 3) { a.jerk += Math.hypot(h[2][0] - 2 * h[1][0] + h[0][0], h[2][1] - 2 * h[1][1] + h[0][1]); a.nj += 1; }
    }
  }
  const res = {};
  for (const [g, a] of Object.entries(acc)) res[g] = { err: a.e / a.n, big: a.big / a.n, jerk: a.jerk / a.nj, still: (a.still / a.ns) * 60 };
  res.score = Object.keys(GROUPS).reduce((s, g) => s + (g === 'braccia' ? 2 : 1) * (res[g].err + 3 * res[g].jerk + 0.5 * res[g].still), 0) + res.braccia.big;
  return res;
}

export const fmt = (r) => `staccato braccia ${r.braccia.err.toFixed(3)} busto ${r.busto.err.toFixed(3)} · scatti braccia ${r.braccia.jerk.toFixed(3)} busto ${r.busto.jerk.toFixed(3)} · fermo braccia ${r.braccia.still.toFixed(3)} busto ${r.busto.still.toFixed(3)} · salti ${(r.braccia.big * 100).toFixed(1)}% · punteggio ${r.score.toFixed(3)}`;

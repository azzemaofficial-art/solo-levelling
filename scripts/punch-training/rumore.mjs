// Quanto è "sporco" MediaPipe Lite rispetto ad AlphaPose (lo scheletro del dataset), dentro i pugni:
// ritardo, errore di posizione (busti), quanto l'errore resta simile da un fotogramma al successivo,
// fotogrammi persi e braccia scambiate. Serve a sporcare gli scheletri AlphaPose come il telefono.
// Uso: node scripts/punch-training/rumore.mjs [video...]   (default: tutti quelli letti da Lite)
import { pathToFileURL } from 'node:url';
import { hasStream, loadStream } from './dati.mjs';

const GROUPS = { spalle: [11, 12], gomiti: [13, 14], polsi: [15, 16], fianchi: [23, 24], naso: [0] };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function noiseOf(stream, fpsSrc) {
  const { frames, labels, j, aspect } = stream;
  const ix = (mp) => j.indexOf(mp);
  // AlphaPose al tempo t (interpolato), coordinate con l'aspetto giusto
  const apAt = (l, mp, t) => {
    const u = ((t - l.t0) * fpsSrc) / 1000, i = Math.floor(u), f = u - i, k = ix(mp);
    const a = l.ap[i], b = l.ap[Math.min(i + 1, l.ap.length - 1)];
    if (!a || !b || u < 0) return null;
    return [((a[k * 2] + (b[k * 2] - a[k * 2]) * f) / 1000) * aspect, (a[k * 2 + 1] + (b[k * 2 + 1] - a[k * 2 + 1]) * f) / 1000];
  };
  const torso = (l) => { const a = l.ap[0], m = (p, q) => [((a[ix(p) * 2] + a[ix(q) * 2]) / 2000) * aspect, (a[ix(p) * 2 + 1] + a[ix(q) * 2 + 1]) / 2000]; const s = m(11, 12), h = m(23, 24); return Math.hypot(s[0] - h[0], s[1] - h[1]); };
  const pairsAt = (lag) => {
    const out = [];
    let fi = 0;
    for (const l of labels) {
      if (l.ap.length < 3) continue;
      const T = torso(l);
      while (fi < frames.length && frames[fi].t < l.t0) fi += 1;
      for (let k = fi; k < frames.length && frames[k].t <= l.t1; k += 1) {
        const fr = frames[k];
        out.push({ l, T, t: fr.t, fr, ap: (mp) => apAt(l, mp, fr.t - lag) });
      }
    }
    return out;
  };
  const err = (ps, mp) => ps.map(({ fr, ap, T }) => { const a = ap(mp); if (!fr.points || !a) return null; const p = fr.points[mp]; return [(p.x * aspect - a[0]) / T, (p.y - a[1]) / T]; });
  // ritardo di Lite (modalità video: insegue e leviga): quello che rende minimo l'errore dei polsi
  let best = { lag: 0, rms: Infinity };
  for (let lag = -80; lag <= 160; lag += 20) {
    const e = [...err(pairsAt(lag), 15), ...err(pairsAt(lag), 16)].filter(Boolean);
    const rms = Math.sqrt(e.reduce((s, [x, y]) => s + x * x + y * y, 0) / e.length);
    if (rms < best.rms) best = { lag, rms };
  }
  const ps = pairsAt(best.lag);
  const out = { lag: best.lag, groups: {} };
  for (const [g, js] of Object.entries(GROUPS)) {
    const all = [], ac = [];
    for (const mp of js) {
      const e = err(ps, mp);
      e.forEach((v, i) => { if (v) all.push(v); if (v && e[i - 1] && ps[i - 1].l === ps[i].l) ac.push([v, e[i - 1]]); });
    }
    const mx = all.reduce((s, v) => s + v[0], 0) / all.length, my = all.reduce((s, v) => s + v[1], 0) / all.length;
    const sd = Math.sqrt(all.reduce((s, v) => s + (v[0] - mx) ** 2 + (v[1] - my) ** 2, 0) / all.length / 2);
    // somiglianza dell'errore fra fotogrammi vicini (1 = sempre uguale, 0 = a caso ogni volta)
    const rho = ac.reduce((s, [a, b]) => s + (a[0] - mx) * (b[0] - mx) + (a[1] - my) * (b[1] - my), 0) / ac.reduce((s, [a]) => s + (a[0] - mx) ** 2 + (a[1] - my) ** 2, 0);
    const big = all.filter((v) => Math.hypot(v[0], v[1]) > 0.5).length / all.length;
    out.groups[g] = { bias: [mx, my].map((x) => +x.toFixed(3)), sd: +sd.toFixed(3), rho: +rho.toFixed(2), salti: +big.toFixed(3), med: +median(all.map((v) => Math.hypot(v[0], v[1]))).toFixed(3) };
  }
  // persona persa e polsi scambiati (Lite vede il polso sinistro dove AlphaPose vede il destro)
  out.persi = +(ps.filter((p) => !p.fr.points).length / ps.length).toFixed(3);
  out.scambi = +(ps.filter(({ fr, ap }) => {
    if (!fr.points) return false;
    const L = ap(15), R = ap(16); if (!L || !R) return false;
    const d = (p, a) => Math.hypot(p.x * aspect - a[0], p.y - a[1]);
    return d(fr.points[15], R) + d(fr.points[16], L) < 0.6 * (d(fr.points[15], L) + d(fr.points[16], R));
  }).length / ps.length).toFixed(3);
  out.n = ps.length;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const vids = process.argv.slice(2).map(Number);
  const list = vids.length ? vids : Array.from({ length: 10 }, (_, i) => i + 1).filter(hasStream);
  for (const v of list) {
    const s = loadStream(v);
    console.log(`V${v}`, JSON.stringify(noiseOf(s, s.fpsSrc)));
  }
}

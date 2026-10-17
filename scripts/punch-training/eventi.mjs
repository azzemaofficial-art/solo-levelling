// Esempi per addestrare il modellino dei colpi. Ogni esempio è un colpo trovato dal motore VERO
// (lib/mmaStrikes.js) e abbinato a un pugno etichettato, con le misure che vede l'app.
// Due fonti:
// - 'lite': i video letti da MediaPipe Lite a 25 fps (come il telefono);
// - 'ap': gli scheletri AlphaPose dei pugni, "sporcati" come il telefono (rumore misurato sul V7
//   con rumore.mjs, fotogrammi persi, salti dei polsi) e variati: specchio (mancino), zoom,
//   rotazione nel piano, vista girata attorno al corpo (il telefono davanti invece che di lato).
// Uso: node scripts/punch-training/eventi.mjs <uscita.json> [variazioni AlphaPose per pugno, default 3] [esempi vecchi.json]
// (con un file di esempi vecchi riusa i suoi esempi AlphaPose e rifà solo quelli dei video Lite: molto più veloce)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createStrikeEngine, unflip } from '../../lib/mmaStrikes.js';
import { punchInput } from '../../lib/mmaPunchInput.js';
import { createPoseFilter, IMAGE_FILTER } from '../../lib/poseFilter.js';
import { ARM_OF, KIND_OF, loadPunches, stanceOf, hasStream, loadStream, PARTIAL_LABELS } from './dati.mjs';
import { play, counted, match, phoneFrames } from './banco.mjs';

// fps dei video originali (ffprobe); servono per mettere in tempo gli scheletri AlphaPose
export const FPS_SRC = { 1: 24, 2: 24, 3: 24, 4: 24, 5: 30, 6: 24, 7: 29.97, 8: 30, 9: 24, 10: 25 };
// Rumore di Lite rispetto ad AlphaPose dentro i pugni di V5 e V7 (busti; rho = somiglianza fra fotogrammi)
export const NOISE = { core: { sd: 0.05, rho: 0.8 }, elbow: { sd: 0.11, rho: 0.6 }, wrist: { sd: 0.13, rho: 0.53 }, jump: 0.03, drop: 0.03, gap: 0.004 };
const ZONE = (j) => (j === 15 || j === 16 ? 'wrist' : j === 13 || j === 14 ? 'elbow' : 'core');
const SWAP = [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [2, 5], [7, 8]];

export function rng(seed) {
  let s = seed % 2147483647 || 1;
  const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const n = () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u());
  return { u, n };
}

// Pugni attaccati (combo) → un'unica sequenza di fotogrammi AlphaPose [{ t, P: {j: [x, y]} }]
function chains(video, j, fps) {
  const ps = video.punches.filter((p) => p.ap.length >= 3);
  const out = [];
  for (const p of ps) {
    const last = out.at(-1);
    if (last && p.s - last.e <= 3 && p.s >= last.s) last.items.push(p), (last.e = Math.max(last.e, p.e));
    else out.push({ s: p.s, e: p.e, items: [p] });
  }
  return out.map((c) => {
    const byFrame = new Map();
    for (const p of c.items) p.ap.forEach((f, i) => { if (!byFrame.has(p.s + i)) byFrame.set(p.s + i, f); });
    const frames = [...byFrame.entries()].sort((a, b) => a[0] - b[0]).map(([f, a]) => {
      const P = {};
      j.forEach((jj, k) => { if (a[k * 2] || a[k * 2 + 1]) P[jj] = [a[k * 2] / 1000, a[k * 2 + 1] / 1000]; });
      return { t: ((f - c.s) * 1000) / fps, P };
    });
    const labels = c.items.map((p) => ({ move: p.move, arm: ARM_OF[p.move], kind: KIND_OF[p.move], t0: ((p.s - c.s) * 1000) / fps, t1: ((p.e - c.s) * 1000) / fps }));
    return { frames, labels };
  });
}

// Variazione: specchio, zoom, rotazione nel piano, vista girata (le braccia stimate in profondità
// dalla lunghezza delle ossa: un braccio che sembra corto punta verso la camera)
function transform(frames, aspect, R, { mirror, zoom, roll, yaw }) {
  const bone = {};
  const len = (P, a, b) => (P[a] && P[b] ? Math.hypot((P[a][0] - P[b][0]) * aspect, P[a][1] - P[b][1]) : 0);
  for (const [a, b] of [[11, 13], [13, 15], [12, 14], [14, 16]]) bone[`${a}-${b}`] = Math.max(...frames.map((f) => len(f.P, a, b))) * 1.05;
  return frames.map((f) => {
    const P = {};
    for (const [k, v] of Object.entries(f.P)) P[k] = [v[0] * aspect, v[1]];
    const z = {};
    for (const S of [[11, 13, 15], [12, 14, 16]]) {
      const [s, e, w] = S;
      if (!P[s] || !P[e] || !P[w]) continue;
      const du = Math.sqrt(Math.max(0, bone[`${s}-${e}`] ** 2 - len(f.P, s, e) ** 2));
      const df = Math.sqrt(Math.max(0, bone[`${e}-${w}`] ** 2 - len(f.P, e, w) ** 2));
      z[e] = -du; z[w] = -du - df;
    }
    const c = P[23] && P[24] ? [(P[23][0] + P[24][0]) / 2, (P[11]?.[1] ?? P[23][1])] : [aspect / 2, 0.5];
    const out = {};
    for (const [k, v] of Object.entries(P)) {
      let x = v[0] - c[0], y = v[1] - c[1];
      x = x * Math.cos(yaw) + (z[k] || 0) * Math.sin(yaw);
      [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
      x *= zoom; y *= zoom;
      out[k] = [(c[0] + x) / aspect, c[1] + y];
    }
    if (mirror) {
      for (const k of Object.keys(out)) out[k] = [1 - out[k][0], out[k][1]];
      for (const [a, b] of SWAP) [out[a], out[b]] = [out[b], out[a]];
    }
    return { t: f.t, P: out };
  });
}

// Fotogrammi come li dà il telefono: 25 al secondo (± qualche ms), guardia prima e dopo, rumore di Lite
function phone(frames, aspect, R, { noise = true, pre = 800, post = 700 } = {}) {
  const T = (() => { const P = frames[0].P; return P[11] && P[12] && P[23] && P[24] ? Math.hypot(((P[11][0] + P[12][0]) / 2 - (P[23][0] + P[24][0]) / 2) * aspect, (P[11][1] + P[12][1]) / 2 - (P[23][1] + P[24][1]) / 2) : 0.25; })();
  const end = frames.at(-1).t;
  const at = (t) => {
    if (t <= 0) return frames[0].P;
    if (t >= end) return frames.at(-1).P;
    let i = 0; while (i < frames.length - 2 && frames[i + 1].t < t) i += 1;
    const a = frames[i], b = frames[i + 1], f = (t - a.t) / (b.t - a.t || 1), P = {};
    for (const k of Object.keys(a.P)) if (b.P[k]) P[k] = [a.P[k][0] + (b.P[k][0] - a.P[k][0]) * f, a.P[k][1] + (b.P[k][1] - a.P[k][1]) * f];
    return P;
  };
  const st = {}, jump = {};
  const out = [];
  let gapLeft = 0;
  for (let t = -pre; t <= end + post; t += 40 + (R.u() - 0.5) * 8) {
    const P = at(t);
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    for (const [k, v] of Object.entries(P)) {
      const j = Number(k);
      let dx = 0, dy = 0;
      if (noise) {
        const z = NOISE[ZONE(j)], s = st[j] || (st[j] = [0, 0]);
        const q = Math.sqrt(1 - z.rho * z.rho);
        s[0] = z.rho * s[0] + q * z.sd * R.n(); s[1] = z.rho * s[1] + q * z.sd * R.n();
        dx = s[0]; dy = s[1];
        if (ZONE(j) !== 'core') {
          if (!jump[j] && R.u() < NOISE.jump) { const a = R.u() * 2 * Math.PI, r = 0.5 + R.u() * 0.5; jump[j] = { n: 1 + Math.floor(R.u() * 2), d: [Math.cos(a) * r, Math.sin(a) * r] }; }
          if (jump[j]) { dx += jump[j].d[0]; dy += jump[j].d[1]; if (--jump[j].n <= 0) jump[j] = null; }
        }
      }
      points[j] = { x: v[0] + (dx * T) / aspect, y: v[1] + dy * T, visibility: 0.99 };
    }
    // fotogrammi persi: uno ogni tanto, e qualche buco più lungo
    if (noise && t > -pre + 500) {
      if (gapLeft > 0) { gapLeft -= 40; continue; }
      if (R.u() < NOISE.gap) { gapLeft = 120 + R.u() * 200; continue; }
      if (R.u() < NOISE.drop) continue;
    }
    out.push({ t: Math.round(t + pre), points });
  }
  return out;
}

// Il motore vero sui fotogrammi (stesso filtro dell'app); calibrazione sui primi 10
export function runEngine(frames, stance, aspect) {
  const f = createPoseFilter(IMAGE_FILTER), eng = createStrikeEngine({ stance });
  const evs = [];
  let i = 0;
  for (; i < frames.length && !eng.isCalibrated(); i += 1) eng.calibrate(f.apply(frames[i].points, frames[i].t), aspect);
  for (; i < frames.length; i += 1) {
    const raw = f.apply(frames[i].points, frames[i].t);
    const { points } = unflip(raw, null, eng.order());
    const r = eng.push(points, frames[i].t, aspect);
    for (const ev of r.done) evs.push({ ...ev, side: ev.arm, kind: ev.returned === false ? 'drop' : 'strike', emitT: frames[i].t });
  }
  return evs;
}

const r3 = (x) => Math.round(x * 1000) / 1000;
// Una riga per OGNI colpo trovato: lab = 'right' (pugno vero, braccio giusto), 'wrong' (pugno vero,
// braccio sbagliato), 'near' (un secondo colpo attaccato a un pugno vero), 'extra' (nessun pugno lì).
// combo = dentro una combo etichettata (lì le etichette sono complete: un 'extra' è davvero inventato)
function eventRows(src, athlete, v, aug, labels, evs, { partial = false } = {}) {
  const { pairs } = match(labels, evs);
  const of = new Map(pairs.filter((p) => p.g).map((p) => [p.g, p.l]));
  const sorted = [...labels].sort((a, b) => a.t0 - b.t0), combos = [];
  for (const l of sorted) { const c = combos.at(-1); if (c && l.t0 - c[1] < 1000) c[1] = Math.max(c[1], l.t1); else combos.push([l.t0, l.t1]); }
  return evs.filter((g) => g.input).map((g) => {
    const l = of.get(g);
    const near = labels.some((x) => g.peakT >= x.t0 - 300 && g.peakT <= x.t1 + 400);
    const lab = l ? (g.side === l.arm ? 'right' : 'wrong') : near ? 'near' : 'extra';
    return {
      src, athlete, v, aug, lab, partial, combo: combos.some(([a, b]) => g.peakT >= a - 300 && g.peakT <= b + 400),
      move: l?.move ?? null, arm: l?.arm ?? null, kind: l?.kind ?? null, side: g.side, input: g.input, inputOther: g.inputOther || null,
      f: g.f ?? g.feat ?? null, emitLag: l ? Math.round(g.emitT - l.t1) : null, start: Math.round(g.start), end: Math.round(g.end), peakT: Math.round(g.peakT),
      reach: r3(g.reach), dur: Math.round(g.dur), elbow: Boolean(g.elbow), returned: g.returned !== false, path: g.path,
    };
  });
}

export function apRows(nAug = 3, seed = 7) {
  const all = loadPunches();
  const rows = [];
  for (const video of all.videos) {
    const fps = FPS_SRC[video.v], aspect = 16 / 9, stance0 = stanceOf(video, all.j);
    const R = rng(seed * 100 + video.v);
    for (const c of chains(video, all.j, fps)) {
      for (let a = 0; a < nAug; a += 1) {
        // la prima variazione è il video così com'è (solo rumore); le altre cambiano vista e lato
        const aug = a === 0 ? { mirror: false, zoom: 1, roll: 0, yaw: 0 }
          : { mirror: R.u() < 0.5, zoom: 0.75 + R.u() * 0.5, roll: (R.u() - 0.5) * 0.28, yaw: (R.u() - 0.5) * 1.6 };
        const stance = aug.mirror ? (stance0 === 'orthodox' ? 'southpaw' : 'orthodox') : stance0;
        const fr = phone(transform(c.frames, aspect, R, aug), aspect, R);
        const pre = 800;
        const labels = c.labels.map((l) => ({ ...l, t0: l.t0 + pre, t1: l.t1 + pre }));
        const evs = runEngine(fr, stance, aspect).filter((e) => e.kind !== 'drop');
        rows.push(...eventRows('ap', video.athlete, video.v, a, labels, evs));
      }
    }
  }
  return rows;
}

export function liteRows() {
  const rows = [];
  for (let v = 1; v <= 10; v += 1) {
    if (!hasStream(v)) continue;
    const s = loadStream(v);
    // i fotogrammi che il telefono legge davvero (~25 al secondo, tempo vero del fotogramma)
    rows.push(...eventRows('lite', s.athlete, v, 0, s.labels, counted(play(s, { frames: phoneFrames(s, 'subito') })), { partial: PARTIAL_LABELS.has(v) }));
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dest = process.argv[2], nAug = Number(process.argv[3] ?? 3);
  const t0 = Date.now();
  const ap = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')).rows.filter((r) => r.src === 'ap') : apRows(nAug);
  const n = (rs, lab) => rs.filter((r) => r.lab === lab).length;
  console.log(`AlphaPose: ${n(ap, 'right')} pugni col braccio giusto, ${n(ap, 'wrong')} sbagliato, ${n(ap, 'extra') + n(ap, 'near')} in più (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const lite = liteRows();
  console.log(`Lite: ${n(lite, 'right')} pugni col braccio giusto, ${n(lite, 'wrong')} sbagliato, ${n(lite, 'extra') + n(lite, 'near')} in più`);
  writeFileSync(dest, JSON.stringify({ rows: [...ap, ...lite] }));
}

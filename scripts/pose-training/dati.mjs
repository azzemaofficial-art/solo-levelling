// Dati per allenare lo scheletro: lo "studente" è BoxingVI V7 letto da MediaPipe Lite a 25 fps
// (come il telefono), il "maestro" sono gli scheletri AlphaPose del dataset dentro i 195 pugni
// etichettati, levigati avanti e indietro (cosa possibile solo su un video registrato).
// I file stanno in tests/fixtures/private/ (fuori da git: il repo è pubblico).
import { readFileSync, existsSync } from 'node:fs';

const PRIV = new URL('../../tests/fixtures/private/', import.meta.url);
export const J = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export const GROUPS = { busto: [0, 11, 12, 23, 24], braccia: [13, 14, 15, 16], gambe: [25, 26, 27, 28] };
const COCO2MP = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const GAUSS = [0.054, 0.242, 0.399, 0.242, 0.054];
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export const available = () => existsSync(new URL('boxingvi-v7-lite.json', PRIV)) && existsSync(new URL('boxingvi-v7-alphapose.npy', PRIV));

function readNpy(file) {
  const buf = readFileSync(file);
  const hl = buf.readUInt16LE(8), header = buf.toString('latin1', 10, 10 + hl);
  if (!header.includes("'<f8'")) throw new Error('formato inatteso ' + header);
  const shape = header.match(/\(([^)]*)\)/)[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  return { shape, data: new Float64Array(buf.buffer.slice(buf.byteOffset + 10 + hl, buf.byteOffset + buf.length)) };
}

// Maestro: per ogni pugno k, fotogrammi a 29,97 fps che partono da labels[k].t0
function teacher(labels, aspect) {
  const { shape: [N, F, JJ], data } = readNpy(new URL('boxingvi-v7-alphapose.npy', PRIV));
  const clips = [], torsos = [], dt = 1000 / 29.97;
  for (let k = 0; k < Math.min(N, labels.length); k += 1) {
    const fr = [];
    for (let f = 0; f < F; f += 1) {
      const base = (k * F + f) * JJ * 2, p = {};
      let zero = true;
      for (let j = 0; j < JJ; j += 1) { const x = data[base + j * 2], y = data[base + j * 2 + 1]; if (x || y) zero = false; p[COCO2MP[j]] = x || y ? [x * aspect, y] : null; }
      if (zero) break;
      fr.push(p);
    }
    if (fr.length < 3) continue;
    const S = {};
    for (const j of J) S[j] = fr.map((_, i) => {
      if (!fr[i][j]) return null;
      let sx = 0, sy = 0, sw = 0;
      for (let q = -2; q <= 2; q += 1) { const p = fr[i + q]?.[j]; if (!p) continue; sx += p[0] * GAUSS[q + 2]; sy += p[1] * GAUSS[q + 2]; sw += GAUSS[q + 2]; }
      return [sx / sw, sy / sw];
    });
    fr.forEach((p) => { if (p[11] && p[12] && p[23] && p[24]) torsos.push(Math.hypot((p[11][0] + p[12][0]) / 2 - (p[23][0] + p[24][0]) / 2, (p[11][1] + p[12][1]) / 2 - (p[23][1] + p[24][1]) / 2)); });
    clips.push({ t0: labels[k].t0, t1: labels[k].t0 + (fr.length - 1) * dt, S });
  }
  clips.sort((a, b) => a.t0 - b.t0);
  const at = (j, t) => {
    let lo = 0, hi = clips.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (clips[m].t0 <= t) lo = m; else hi = m - 1; }
    const c = clips[lo];
    if (!c || t < c.t0 || t > c.t1) return null;
    const u = (t - c.t0) / dt, i = Math.floor(u), f = u - i, a = c.S[j][i], b = c.S[j][Math.min(i + 1, c.S[j].length - 1)];
    return a && b ? [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] : null;
  };
  return { at, T: median(torsos), n: clips.length };
}

// Momenti fermi: il movimento vero (media su ±3 fotogrammi) resta sotto 0,3 busti/s per almeno
// mezzo secondo. Restituisce la posizione "vera" da fermo, o null se in quel momento ti muovi.
function stillRef(frames, aspect, T) {
  const n = frames.length, ts = frames.map((f) => f.t), ref = {};
  for (const j of J) {
    const sx = new Float64Array(n).fill(NaN), sy = new Float64Array(n).fill(NaN);
    for (let i = 0; i < n; i += 1) {
      let x = 0, y = 0, c = 0;
      for (let q = -3; q <= 3; q += 1) { const p = frames[i + q]?.points[j]; if (!p) continue; x += p.x * aspect; y += p.y; c += 1; }
      if (c >= 5) { sx[i] = x / c; sy[i] = y / c; }
    }
    const slow = Array.from({ length: n }, (_, i) => i > 0 && Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]) / T / ((ts[i] - ts[i - 1]) / 1000) < 0.3);
    const still = new Uint8Array(n);
    for (let i = 0; i < n;) {
      if (!slow[i]) { i += 1; continue; }
      let k = i; while (k < n && slow[k]) k += 1;
      if (ts[k - 1] - ts[i] >= 500) still.fill(1, i, k);
      i = k;
    }
    ref[j] = { sx, sy, still };
  }
  return (j, t) => {
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ts[m] <= t) lo = m; else hi = m - 1; }
    const r = ref[j];
    if (!r.still[lo] || !r.still[lo + 1]) return null;
    const f = (t - ts[lo]) / (ts[lo + 1] - ts[lo]);
    return [r.sx[lo] + (r.sx[lo + 1] - r.sx[lo]) * f, r.sy[lo] + (r.sy[lo + 1] - r.sy[lo]) * f];
  };
}

export function loadV7() {
  const v7 = JSON.parse(readFileSync(new URL('boxingvi-v7-lite.json', PRIV)));
  const frames = v7.frames.map(([t, p]) => {
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    v7.j.forEach((j, k) => { points[j] = { x: p[k * 3] / 1000, y: p[k * 3 + 1] / 1000, visibility: p[k * 3 + 2] / 100 }; });
    return { t, points };
  });
  const teach = teacher(v7.labels, v7.aspect);
  return { v7, frames, aspect: v7.aspect, teach, still: stillRef(frames, v7.aspect, teach.T) };
}

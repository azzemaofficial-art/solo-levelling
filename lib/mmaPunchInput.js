// ─────────────────────────────────────────────────────────────────────────────
// Il colpo come lo legge il modellino dei colpi (lib/mmaPunchModel.js): 10 istantanee
// del braccio, 6 dalla guardia al picco e 4 dal picco al rientro, tutte relative al
// corpo (centro delle spalle, scala = busto) e girate in modo che "fuori" sia sempre
// il lato del braccio che colpisce (stessa cosa per destri, mancini e video specchiati).
// Per ogni istantanea: pugno, gomito, avambraccio, l'altro pugno, la spalla che colpisce
// e la larghezza delle spalle (quanto ruoti). Più le misure del braccio (mmaArmFeatures).
// ─────────────────────────────────────────────────────────────────────────────

import { ARM_FEATURES, ARM_SCALE } from './mmaArmFeatures.js';

export const INPUT_STEPS = { out: 6, back: 4 };
export const INPUT_PER_STEP = 11;
export const INPUT_SIZE = (INPUT_STEPS.out + INPUT_STEPS.back) * INPUT_PER_STEP + ARM_FEATURES.length + 3;

const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

// frames: [{ t, p }] dalla guardia al rientro; S: 'L' | 'R'; feat: misure del braccio (o null)
// lead: true se è il braccio avanti. Restituisce un array di INPUT_SIZE numeri o null.
export function punchInput(frames, S, aspect = 1, { feat = null, lead = true } = {}) {
  if (!Array.isArray(frames) || frames.length < 3) return null;
  const [W, E, SH, SO, WO] = S === 'L' ? [15, 13, 11, 12, 16] : [16, 14, 12, 11, 15];
  const fs = frames.filter((f) => [W, E, SH, SO, WO, 23, 24].every((j) => ok(f.p?.[j])));
  if (fs.length < 3) return null;
  const g = fs[0].p;
  const T = Math.hypot(((g[11].x + g[12].x) / 2 - (g[23].x + g[24].x) / 2) * aspect, (g[11].y + g[12].y) / 2 - (g[23].y + g[24].y) / 2);
  if (!(T > 0.02)) return null;
  // "fuori" = dal lato della spalla del braccio che colpisce
  const sg = g[SH].x - g[SO].x >= 0 ? 1 : -1;
  const rel = (p, j) => {
    const cx = (p[11].x + p[12].x) / 2, cy = (p[11].y + p[12].y) / 2;
    return [((p[j].x - cx) * aspect * sg) / T, (p[j].y - cy) / T];
  };
  const pts = fs.map((f) => ({ t: f.t, w: rel(f.p, W), e: rel(f.p, E), s: rel(f.p, SH), o: rel(f.p, SO), wo: rel(f.p, WO) }));
  const w0 = pts[0].w;
  let pk = 0;
  pts.forEach((q, i) => { if (Math.hypot(q.w[0] - w0[0], q.w[1] - w0[1]) > Math.hypot(pts[pk].w[0] - w0[0], pts[pk].w[1] - w0[1])) pk = i; });
  // istantanea al tempo t (interpolata fra i fotogrammi)
  const at = (t) => {
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].t < t) i += 1;
    const a = pts[i], b = pts[i + 1], f = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    const mix = (k) => [a[k][0] + (b[k][0] - a[k][0]) * f, a[k][1] + (b[k][1] - a[k][1]) * f];
    return { w: mix('w'), e: mix('e'), s: mix('s'), o: mix('o'), wo: mix('wo') };
  };
  const t0 = pts[0].t, tp = pts[pk].t, t1 = pts[pts.length - 1].t;
  const times = [];
  for (let i = 0; i < INPUT_STEPS.out; i += 1) times.push(t0 + ((tp - t0) * i) / (INPUT_STEPS.out - 1));
  for (let i = 1; i <= INPUT_STEPS.back; i += 1) times.push(tp + ((t1 - tp) * i) / INPUT_STEPS.back);
  const a0 = at(t0);
  const out = [];
  for (const t of times) {
    const q = at(t);
    const fa = [q.w[0] - q.e[0], q.w[1] - q.e[1]], faN = Math.hypot(...fa) || 1e-6;
    out.push(
      q.w[0] - a0.w[0], q.w[1] - a0.w[1],
      q.e[0] - a0.e[0], q.e[1] - a0.e[1],
      fa[0] / faN, fa[1] / faN,
      q.wo[0] - a0.wo[0], q.wo[1] - a0.wo[1],
      q.s[0] - a0.s[0], q.s[1] - a0.s[1],
      Math.abs(q.s[0] - q.o[0]) - Math.abs(a0.s[0] - a0.o[0]),
    );
  }
  // misure del braccio in "deviazioni standard" (quelle dei tuoi esempi), tempi in decimi di secondo
  const f = Array.isArray(feat) && feat.length === ARM_FEATURES.length ? feat : null;
  ARM_FEATURES.forEach((k, j) => out.push(f ? Math.max(-6, Math.min(6, f[j] / ARM_SCALE[k])) : 0));
  out.push(lead ? 1 : -1, (tp - t0) / 300, (t1 - tp) / 300);
  return out.every(Number.isFinite) ? out.map((x) => Math.round(x * 1000) / 1000) : null;
}

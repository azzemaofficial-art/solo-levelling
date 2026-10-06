// Atleta virtuale 3D per testare il giudice delle combo senza camera.
// Coordinate come i "world landmarks" di MediaPipe: metri, origine tra le anche,
// x laterale (lato avanti = +), y verso il basso, z negativa verso la camera.
// Guardia ortodossa: avanti = sinistra (indici 11/13/15/23/25/27).
const P = (x, y, z) => ({ x, y, z, visibility: 0.99 });

export const BASE3D = {
  0: P(0.02, -0.62, -0.10),
  11: P(0.17, -0.45, -0.03), 12: P(-0.17, -0.45, 0.05),
  13: P(0.20, -0.22, -0.12), 14: P(-0.20, -0.22, -0.05),
  15: P(0.10, -0.52, -0.20), 16: P(-0.08, -0.52, -0.12),
  23: P(0.10, 0, 0), 24: P(-0.10, 0, 0),
  25: P(0.14, 0.42, -0.10), 26: P(-0.14, 0.42, 0.10),
  27: P(0.16, 0.85, -0.15), 28: P(-0.16, 0.85, 0.15),
};

const shift = (pts, idx, dy) => Object.fromEntries(idx.map((i) => [i, P(BASE3D[i].x, BASE3D[i].y + dy, BASE3D[i].z)]));
const UPPER = [0, 11, 12, 13, 14, 15, 16];
const ROT_REAR = { 11: P(0.16, -0.45, 0.06), 12: P(-0.12, -0.45, -0.14) }; // spalla dietro avanti

// Picco di ogni gesto: solo le articolazioni che cambiano rispetto alla guardia.
export const PEAKS = {
  jab: [{ 11: P(0.15, -0.45, -0.08), 13: P(0.10, -0.52, -0.45), 15: P(0.05, -0.55, -0.72), 0: P(0.03, -0.62, -0.13) }],
  cross: [{ ...ROT_REAR, 14: P(-0.06, -0.50, -0.40), 16: P(0.0, -0.55, -0.68), 28: P(-0.14, 0.82, 0.13) }],
  // gancio vero: il gomito si alza di lato, il pugno esce largo e poi attraversa davanti al mento
  hook: [
    { 11: P(0.16, -0.45, -0.05), 13: P(0.38, -0.47, -0.12), 15: P(0.34, -0.52, -0.38) },
    { 11: P(0.15, -0.45, -0.08), 13: P(0.30, -0.46, -0.25), 15: P(0.0, -0.50, -0.46) },
  ],
  rearHook: [
    { ...ROT_REAR, 14: P(-0.38, -0.47, -0.10), 16: P(-0.34, -0.52, -0.36) },
    { ...ROT_REAR, 14: P(-0.30, -0.46, -0.20), 16: P(0.02, -0.50, -0.44) },
  ],
  uppercut: [
    { ...shift(null, UPPER, 0.05), 13: P(0.16, -0.10, -0.10), 15: P(0.12, -0.25, -0.25) },
    { 13: P(0.13, -0.35, -0.28), 15: P(0.06, -0.62, -0.38) },
  ],
  rearUppercut: [
    { ...shift(null, UPPER, 0.05), 14: P(-0.16, -0.10, -0.05), 16: P(-0.10, -0.25, -0.2) },
    { ...ROT_REAR, 14: P(-0.10, -0.35, -0.28), 16: P(-0.03, -0.62, -0.38) },
  ],
  bodyHook: [{ ...shift(null, UPPER, 0.12), 13: P(0.28, -0.12, -0.18), 15: P(0.04, -0.09, -0.40) }],
  bodyCross: [{ ...shift(null, UPPER, 0.12), 11: P(0.16, -0.33, 0.06), 12: P(-0.12, -0.33, -0.14), 14: P(-0.08, -0.20, -0.38), 16: P(-0.02, -0.12, -0.66) }],
  leadElbow: [{ 13: P(0.22, -0.52, -0.30), 15: P(0.05, -0.60, -0.12) }],
  rearElbow: [{ ...ROT_REAR, 14: P(-0.20, -0.52, -0.28), 16: P(-0.04, -0.60, -0.10) }],
  clinch: [{ 13: P(0.18, -0.45, -0.30), 15: P(0.08, -0.60, -0.50), 14: P(-0.18, -0.45, -0.28), 16: P(-0.08, -0.60, -0.48) }],
  rearKnee: [{ 13: P(0.18, -0.45, -0.30), 15: P(0.08, -0.60, -0.50), 14: P(-0.18, -0.45, -0.28), 16: P(-0.08, -0.60, -0.48), 24: P(-0.10, -0.02, -0.08), 26: P(-0.10, -0.15, -0.35), 28: P(-0.12, 0.25, -0.10) }],
  teep: [
    { 25: P(0.14, -0.10, -0.35), 27: P(0.15, 0.30, -0.30), 0: P(0.0, -0.62, -0.05) },
    { 25: P(0.14, -0.05, -0.45), 27: P(0.13, -0.10, -0.95), 0: P(-0.01, -0.61, 0.0) },
  ],
  lowKick: [
    { ...ROT_REAR, 26: P(-0.05, 0.28, -0.15), 28: P(-0.10, 0.60, 0.05) },
    { ...ROT_REAR, 26: P(0.0, 0.30, -0.30), 28: P(0.15, 0.50, -0.55) },
  ],
  bodyKick: [
    { ...ROT_REAR, 26: P(-0.02, 0.10, -0.2), 28: P(-0.08, 0.45, 0.0) },
    { ...ROT_REAR, 26: P(0.02, -0.02, -0.32), 28: P(0.20, -0.05, -0.60) },
  ],
  headKick: [
    { ...ROT_REAR, 26: P(0.0, -0.05, -0.25), 28: P(-0.05, 0.30, -0.05) },
    { ...ROT_REAR, 26: P(0.0, -0.25, -0.30), 28: P(0.15, -0.55, -0.50) },
  ],
  switchKick: [
    { 27: P(0.02, 0.85, 0.15), 28: P(-0.02, 0.85, -0.15), 25: P(0.08, 0.42, 0.08), 26: P(-0.08, 0.42, -0.08) },
    { 11: P(0.12, -0.45, 0.12), 12: P(-0.16, -0.45, -0.08), 25: P(0.02, -0.02, -0.30), 27: P(-0.10, -0.05, -0.60), 28: P(-0.02, 0.85, -0.15) },
  ],
  check: [{ 25: P(0.25, 0.20, -0.20), 27: P(0.20, 0.55, -0.15) }],
  slip: [{ 0: P(0.18, -0.56, -0.10), 11: P(0.25, -0.42, -0.03), 12: P(-0.09, -0.44, 0.05), 15: P(0.26, -0.46, -0.20), 16: P(0.08, -0.46, -0.12), 13: P(0.30, -0.18, -0.12), 14: P(-0.10, -0.18, -0.05) }],
  roll: [{ ...shift(null, UPPER, 0.30), 23: P(0.10, 0.08, 0), 24: P(-0.10, 0.08, 0) }],
  parry: [{ 16: P(-0.02, -0.52, -0.40) }],
  feint: [{ 15: P(0.08, -0.54, -0.42) }],
  levelChange: [{ ...shift(null, [0, 11, 12, 13, 14, 15, 16, 23, 24], 0.18), 25: P(0.16, 0.50, -0.25), 26: P(-0.16, 0.50, 0.0) }],
};

const TIMING = { arm: [180, 150, 250], leg: [250, 200, 350], body: [220, 200, 250] };
const LEG = ['rearKnee', 'teep', 'lowKick', 'bodyKick', 'headKick', 'switchKick', 'check'];
const BODY = ['slip', 'roll', 'levelChange', 'clinch'];

const pose = (over) => ({ ...BASE3D, ...over });
const lerp = (a, b, t) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const mixPose = (a, b, t) => Object.fromEntries(Object.keys(BASE3D).map((k) => [k, lerp(a[k], b[k], t)]));
const toArray = (p) => {
  const arr = Array.from({ length: 33 }, () => P(0, 0, 0));
  for (const [k, v] of Object.entries(p)) arr[Number(k)] = v;
  return arr;
};
// camera di default: obliqua (il colpo in avanti si vede di lato nell'immagine).
// view 'front': camera davanti, colpi verso il telefono (com'era il telefono di Emanuele)
const to2d = (w, view = 'oblique') => w.map((p) => ({ x: 0.5 + p.x * 0.5 - (view === 'front' ? 0 : p.z * 0.25), y: 0.5 + p.y * 0.45 + (view === 'front' ? p.z * 0.04 : 0), visibility: 0.99 }));

// Sequenza di fotogrammi {world, points, t} per una lista di gesti, a `fps`.
// opts.mutate(moveId, pose) → posa modificata (per simulare errori).
// opts.tempo < 1 = colpi più veloci (0,5 = un jab vero da ~90 ms di andata).
export function synthSequence(moveIds, { fps = 30, gapMs = 120, mutate, start = 0, tempo = 1, lead = 400, view = 'oblique' } = {}) {
  const dt = 1000 / fps;
  const keys = [{ p: BASE3D, ms: lead }];
  for (const id of moveIds) {
    const [out, hold, back] = (LEG.includes(id) ? TIMING.leg : BODY.includes(id) ? TIMING.body : TIMING.arm).map((ms) => ms * tempo);
    const peaks = PEAKS[id] || [{}];
    peaks.forEach((over, i) => {
      let p = pose({ ...(i > 0 ? peaks.slice(0, i).reduce((acc, o) => ({ ...acc, ...o }), {}) : {}), ...over });
      if (mutate) p = mutate(id, p) || p;
      keys.push({ p, ms: i === 0 ? out : out * 0.8, hold: i === peaks.length - 1 ? (id === 'clinch' ? 450 : hold) : 40 });
    });
    if (id !== 'clinch') keys.push({ p: BASE3D, ms: back, hold: gapMs });
  }
  keys.push({ p: BASE3D, ms: 300, hold: 700 });
  const frames = [];
  let t = start, prev = BASE3D;
  for (const k of keys) {
    for (let e = 0; e < k.ms; e += dt) { const w = toArray(mixPose(prev, k.p, e / k.ms)); frames.push({ world: w, points: to2d(w, view), t }); t += dt; }
    for (let e = 0; e < (k.hold || 0); e += dt) { const w = toArray(k.p); frames.push({ world: w, points: to2d(w, view), t }); t += dt; }
    prev = k.p;
  }
  return frames;
}

export function calibrationFrames(n = 15) {
  const w = toArray(BASE3D);
  return Array.from({ length: n }, () => w);
}

// Calibra un giudice come fa l'app: 3D + 2D dell'immagine
export function calibrateJudge(judge, n = 15, view = 'oblique') {
  const w = toArray(BASE3D), p = to2d(w, view);
  for (let i = 0; i < n; i += 1) judge.calibrate(w, p, 1);
  return judge;
}

// Come MediaPipe su un telefono vero: profondità (z) schiacciata, tremolio 3D e 2D,
// fotogrammi persi. depth 0,4 = un jab verso la camera in 3D sembra lungo meno della metà.
export function realistic(frames, { depth = 0.4, sigma = 0.02, sigma2d = 0.006, drop = 0.1, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return frames.filter(() => rnd() > drop).map((f) => ({
    ...f,
    world: f.world.map((p) => ({ ...p, x: p.x + gauss() * sigma, y: p.y + gauss() * sigma, z: p.z * depth + gauss() * sigma * 1.5 })),
    points: f.points.map((p) => ({ ...p, x: p.x + gauss() * sigma2d, y: p.y + gauss() * sigma2d })),
  }));
}

// Il "tuo" modo di tirare un colpo: ampiezza diversa (k) rispetto all'atleta di riferimento
export const amplitude = (k) => (id, p) => Object.fromEntries(Object.entries(p).map(([j, v]) => {
  const b = BASE3D[j]; return [j, b ? P(b.x + (v.x - b.x) * k, b.y + (v.y - b.y) * k, b.z + (v.z - b.z) * k) : v];
}));

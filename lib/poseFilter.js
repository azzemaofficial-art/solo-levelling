// Filtro "One Euro" (Casiez et al., 2012) sui punti dello scheletro.
// Da fermo leviga il tremolio di MediaPipe (1–2 cm); quando ti muovi veloce
// la frequenza di taglio sale e il filtro quasi sparisce → i colpi non perdono picco.
// minCutoff: Hz a riposo · beta: quanto sale il taglio con la velocità (unità/s).
//
// v2 (ottobre 2026, tarato su video veri: scripts/pose-training/): parametri per zona del
// corpo (busto calmo, polsi reattivi), punti poco visibili più levigati, e salti impossibili
// (un punto che "teletrasporta" più veloce di un pugno) seguiti solo in parte.

const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };

function makeAxis() { return { x: null, dx: 0 }; }

function step(s, value, dt, { minCutoff, beta, dCutoff }) {
  if (s.x == null || !Number.isFinite(s.x)) { s.x = value; s.dx = 0; return value; }
  const dx = (value - s.x) / dt;
  s.dx += alpha(dCutoff, dt) * (dx - s.dx);
  const cutoff = minCutoff + beta * Math.abs(s.dx);
  s.x += alpha(cutoff, dt) * (value - s.x);
  return s.x;
}

// Filtra un array di landmark {x,y,z,visibility}. Dopo una pausa > resetMs riparte da zero.
export function createPoseFilter({ minCutoff = 1.4, beta = 6, dCutoff = 1, resetMs = 400 } = {}) {
  let state = [], lastT = null;
  const opts = { minCutoff, beta, dCutoff };
  return {
    reset() { state = []; lastT = null; },
    apply(points, t) {
      if (!Array.isArray(points) || !points.length) { lastT = null; return points; }
      const gap = lastT == null ? Infinity : t - lastT;
      if (!(gap > 0) || gap > resetMs) state = [];
      lastT = t;
      const dt = Number.isFinite(gap) && gap > 0 ? gap / 1000 : 1 / 30;
      return points.map((p, i) => {
        if (!p) return p;
        const s = state[i] || (state[i] = { x: makeAxis(), y: makeAxis(), z: makeAxis() });
        return { ...p, x: step(s.x, p.x, dt, opts), y: step(s.y, p.y, dt, opts), z: p.z == null ? p.z : step(s.z, p.z, dt, opts) };
      });
    },
  };
}

// Zona del corpo di ogni punto MediaPipe (33): i polsi e le dita vanno veloci, il busto no.
export const ZONE = (i) => (i >= 15 && i <= 22 ? 'wrist' : i === 13 || i === 14 ? 'elbow' : i >= 25 ? 'leg' : 'core');

// Filtro dei punti 2D dell'immagine (v2). Lavora in unità vere (x × aspetto), così la
// velocità è la stessa in orizzontale e in verticale. Parametri: DISPLAY_FILTER.
export function createImageFilter(P = DISPLAY_FILTER) {
  let state = [], lastT = null;
  return {
    reset() { state = []; lastT = null; },
    apply(points, t, aspect = 1) {
      if (!Array.isArray(points) || !points.length) { lastT = null; return points; }
      const gap = lastT == null ? Infinity : t - lastT;
      if (!(gap > 0) || gap > (P.resetMs ?? 400)) state = [];
      lastT = t;
      const dt = Number.isFinite(gap) && gap > 0 && gap <= (P.resetMs ?? 400) ? gap / 1000 : 1 / 30;
      const A = aspect || 1;
      return points.map((p, i) => {
        if (!p) return p;
        const zone = ZONE(i), [minCutoff, beta] = P[zone];
        const s = state[i] || (state[i] = { x: null, y: null, dx: 0, dy: 0 });
        if (s.x == null) { s.x = p.x * A; s.y = p.y; return { ...p }; }
        let vx = p.x * A, vy = p.y;
        // salto impossibile → si segue fino alla velocità massima, oltre solo in parte
        const lim = P.maxSpeed?.[zone] * dt;
        if (lim > 0) {
          const jx = vx - s.x, jy = vy - s.y, j = Math.hypot(jx, jy);
          if (j > lim) { const k = (lim + (j - lim) * P.overflow) / j; vx = s.x + jx * k; vy = s.y + jy * k; }
        }
        const ad = alpha(P.dCutoff ?? 1, dt);
        s.dx += ad * ((vx - s.x) / dt - s.dx); s.dy += ad * ((vy - s.y) / dt - s.dy);
        const vis = p.visibility ?? 1;
        const visK = P.visLow == null ? 1 : P.visLow + (1 - P.visLow) * Math.min(1, Math.max(0, (vis - 0.3) / 0.4));
        const a = alpha((minCutoff + beta * Math.hypot(s.dx, s.dy)) * visK, dt);
        s.x += a * (vx - s.x); s.y += a * (vy - s.y);
        return { ...p, x: s.x / A, y: s.y };
      });
    },
  };
}

// Parametri tarati: world in metri (un pugno ~4–8 m/s), immagine in frazioni del fotogramma.
export const WORLD_FILTER = { minCutoff: 1.4, beta: 6 };
export const IMAGE_FILTER = { minCutoff: 1.4, beta: 12 };
// Filtro per lo scheletro DISEGNATO (il giudice usa IMAGE_FILTER, su cui sono tarate le soglie).
// [minCutoff Hz, beta] per zona; maxSpeed in altezze dell'immagine al secondo. Tarato il 10/10/2026
// su BoxingVI V7 (Lite a 25 fps, 195 pugni) insieme al disegnatore di lib/poseView.js: è leggero
// perché la levigatura la fa il disegnatore a 60 Hz.
export const DISPLAY_FILTER = {
  core: [1.6, 30], elbow: [2, 40], wrist: [4, 30], leg: [1.2, 20],
  dCutoff: 2, visLow: 0.6, maxSpeed: { core: 2, elbow: 8, wrist: 12, leg: 5 }, overflow: 0.3, resetMs: 400,
};

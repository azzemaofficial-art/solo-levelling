// Filtro "One Euro" (Casiez et al., 2012) sui punti dello scheletro.
// Da fermo leviga il tremolio di MediaPipe (1–2 cm); quando ti muovi veloce
// la frequenza di taglio sale e il filtro quasi sparisce → i colpi non perdono picco.
// minCutoff: Hz a riposo · beta: quanto sale il taglio con la velocità (unità/s).

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

// Parametri tarati: world in metri (un pugno ~4–8 m/s), immagine in frazioni del fotogramma.
export const WORLD_FILTER = { minCutoff: 1.4, beta: 6 };
export const IMAGE_FILTER = { minCutoff: 1.4, beta: 12 };

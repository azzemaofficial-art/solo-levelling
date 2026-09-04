// ─────────────────────────────────────────────────────────────────────────────
// CONTATORE RIPETIZIONI LIVE — state machine a isteresi sugli angoli MediaPipe.
// Un ciclo completo (estensione → flessione → estensione) = 1 ripetizione.
// Zero AI, zero rete: gira sui campioni {t, eL, eR, kL, kR} già accumulati.
//
// Modi:
//   squat    → ginocchia (media kL/kR), scendi sotto downBelow e risali
//   push     → gomiti (media eL/eR), piegamento completo
//   kicks    → calci esplosivi (velocità ginocchio, riusa logica detectKicks)
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = {
  squat: { joints: ['kL', 'kR'], downBelow: 115, upAbove: 152, minCycleMs: 450, label: 'Squat' },
  push: { joints: ['eL', 'eR'], downBelow: 102, upAbove: 148, minCycleMs: 400, label: 'Piegamenti' },
  kicks: { joints: ['kL', 'kR'], kickVel: 500, refractMs: 700, label: 'Calci' },
};

export const REP_PRESETS = PRESETS;

// Crea un contatore. push({t, eL, eR, kL, kR}) ritorna:
//   { counted, count, bad, depth, peakVel } — counted=true solo sulla rep valida.
//   bad=true = ripetizione contata ma incompleta/poco profonda.
export function createRepCounter(mode = 'squat') {
  const cfg = PRESETS[mode] || PRESETS.squat;
  let count = 0;
  let phase = 'up';           // si parte estesi
  let lastRepT = -1e9;
  let minAngle = Infinity;    // profondità del ciclo corrente
  let sumVel = 0, velSamples = 0;
  let prev = null;

  const readAngle = (s) => {
    if (!s) return null;
    const vals = cfg.joints.map((j) => s[j]).filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  function push(sample) {
    const out = { counted: false, count, bad: false, depth: minAngle === Infinity ? null : Math.round(minAngle), peakVel: 0 };
    const ang = readAngle(sample);
    if (ang == null) return out;

    if (mode === 'kicks') {
      // Calci = estensione esplosiva del ginocchio (stessa logica detectKicks)
      if (prev && sample.t - prev.t > 0 && sample.t - prev.t <= 250) {
        const dt = sample.t - prev.t;
        for (const j of cfg.joints) {
          if (prev[j] == null || sample[j] == null) continue;
          const v = ((sample[j] - prev[j]) / dt) * 1000;
          if (v > cfg.kickVel && sample.t - lastRepT > cfg.refractMs) {
            lastRepT = sample.t;
            count += 1;
            out.counted = true;
            out.count = count;
            out.peakVel = Math.round(v);
          }
        }
      }
      prev = { ...sample };
      return out;
    }

    // Velocità media della fase (per qualità)
    if (prev && sample.t - prev.t > 0 && sample.t - prev.t <= 250) {
      const pv = readAngle(prev);
      if (pv != null) {
        sumVel += Math.abs(ang - pv) / (sample.t - prev.t) * 1000;
        velSamples += 1;
      }
    }
    prev = { ...sample };

    if (phase === 'up') {
      if (ang < cfg.downBelow) { phase = 'down'; minAngle = ang; }
    } else {
      minAngle = Math.min(minAngle, ang);
      if (ang > cfg.upAbove) {
        // Ciclo chiuso: conta solo se passato il tempo minimo (no tremolii)
        if (sample.t - lastRepT > cfg.minCycleMs) {
          count += 1;
          lastRepT = sample.t;
          out.counted = true;
          out.count = count;
          // Poco profonda = non sei sceso abbastanza sotto la soglia
          out.bad = minAngle > cfg.downBelow - 8;
        }
        phase = 'up';
        minAngle = Infinity;
        sumVel = 0; velSamples = 0;
      }
    }
    out.depth = minAngle === Infinity ? null : Math.round(minAngle);
    out.count = count;
    return out;
  }

  return {
    push,
    reset() { count = 0; phase = 'up'; lastRepT = -1e9; minAngle = Infinity; sumVel = 0; velSamples = 0; prev = null; },
    get count() { return count; },
    get mode() { return mode; },
  };
}

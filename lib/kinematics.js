// ─────────────────────────────────────────────────────────────────────────────
// Cinematica deterministica dallo scheletro (MediaPipe): velocità angolari,
// qualità dei colpi, segnali di fatica. Zero AI, zero rete — gratis per sempre.
//
// L'occhio del coach non vede solo POSE: vede il movimento nel tempo. Questi
// numeri finiscono nel prompt dell'osservatore come "fatti certi" e guidano
// lo skip delle chiamate AI quando non succede nulla (quota free risparmiata).
// ─────────────────────────────────────────────────────────────────────────────

const ARM_JOINTS = ['eL', 'eR'];
const ALL_JOINTS = ['eL', 'eR', 'kL', 'kR'];

// samples: [{ t, eL, eR, kL, kR }] — angoli in gradi, t in ms (null ammessi).
// Ritorna { active, peakDeg, peakJoint, strikes: { tot, esplosivi, lenti } }.
//   active  = c'è azione nella finestra (qualche giunto sopra activeVel)
//   peakDeg = picco di velocità angolare nella finestra (°/s)
//   strikes = rep-quality dei colpi di braccio: esplosivo = uscita E ritorno
//             veloci; lento = uscita veloce ma ritorno sotto retVel.
export function analyzeKinematics(samples, opts = {}) {
  const arr = Array.isArray(samples) ? samples.filter(Boolean) : [];
  const now = opts.now ?? (arr.length ? arr[arr.length - 1].t : 0);
  const winMs = opts.winMs ?? 1500;
  const ACT_VEL = opts.activeVel ?? 120;      // °/s: soglia "c'è azione"
  const STRIKE_VEL = opts.strikeVel ?? 480;   // °/s: uscita = colpo
  const RET_VEL = opts.retVel ?? 240;         // °/s: sotto = ritorno lento
  const RET_WIN = opts.retWinMs ?? 700;       // finestra per misurare il ritorno
  const REFRACT = opts.refractMs ?? 350;      // anti doppi conteggi nello stesso colpo

  const win = arr.filter((s) => s.t >= now - winMs);
  let peakDeg = 0, peakJoint = null, active = false;
  for (let i = 1; i < win.length; i++) {
    const a = win[i - 1], b = win[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > 250) continue; // buco di tracking → non interpolare
    for (const j of ALL_JOINTS) {
      if (a[j] == null || b[j] == null) continue;
      const v = (Math.abs(b[j] - a[j]) / dt) * 1000;
      if (v > ACT_VEL) active = true;
      if (v > peakDeg) { peakDeg = v; peakJoint = j; }
    }
  }

  const strikes = { tot: 0, esplosivi: 0, lenti: 0 };
  for (const j of ARM_JOINTS) {
    const seq = arr.filter((s) => s[j] != null);
    let lastStrikeT = -1e9;
    for (let i = 1; i < seq.length; i++) {
      const dt = seq[i].t - seq[i - 1].t;
      if (dt <= 0 || dt > 250) continue;
      // angolo gomito cresce estendendo: velocità positiva = uscita del colpo
      const v = ((seq[i][j] - seq[i - 1][j]) / dt) * 1000;
      if (v > STRIKE_VEL && seq[i].t - lastStrikeT > REFRACT) {
        strikes.tot++;
        lastStrikeT = seq[i].t;
        // ritorno: massima velocità di flessione nei RET_WIN ms successivi
        let retMax = 0;
        for (let k = i + 1; k < seq.length && seq[k].t - seq[i].t <= RET_WIN; k++) {
          const d2 = seq[k].t - seq[k - 1].t;
          if (d2 <= 0 || d2 > 250) continue;
          const vr = ((seq[k][j] - seq[k - 1][j]) / d2) * 1000;
          if (vr < 0) retMax = Math.max(retMax, -vr);
        }
        if (retMax < RET_VEL) strikes.lenti++; else strikes.esplosivi++;
      }
    }
  }

  return { active, peakDeg: Math.round(peakDeg), peakJoint, strikes };
}

// trend: [{ t, stanceW, guardDown }] campionati ogni ~5s durante la sessione.
// Confronta il primo terzo con l'ultimo terzo → segnali di fatica oggettivi.
export function fatigueFromTrend(trend, opts = {}) {
  const arr = (trend || []).filter(Boolean);
  const minSamples = opts.minSamples ?? 6;
  const stanceTh = opts.stanceDriftPct ?? -12;  // % di restringimento stance
  const guardTh = opts.guardDrift ?? 0.25;      // +25% di tempo con guardia bassa
  if (arr.length < minSamples) return { fatigued: false, stanceDrift: 0, reasons: [] };
  const third = Math.max(2, Math.floor(arr.length / 3));
  const head = arr.slice(0, third), tail = arr.slice(-third);
  const avg = (xs, k) => {
    const v = xs.map((x) => x[k]).filter((y) => y != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const reasons = [];
  let stanceDrift = 0;
  const w0 = avg(head, 'stanceW'), w1 = avg(tail, 'stanceW');
  if (w0 && w1 && w0 > 0) {
    stanceDrift = Math.round(((w1 - w0) / w0) * 100);
    if (stanceDrift <= stanceTh) reasons.push(`stance più stretta del ${Math.abs(stanceDrift)}% rispetto a inizio sessione`);
  }
  const g0 = avg(head, 'guardDown'), g1 = avg(tail, 'guardDown');
  if (g0 != null && g1 != null && g1 - g0 >= guardTh) reasons.push('guardia bassa molto più spesso rispetto a inizio sessione');
  return { fatigued: reasons.length > 0, stanceDrift, reasons };
}

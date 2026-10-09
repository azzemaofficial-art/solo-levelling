// ─────────────────────────────────────────────────────────────────────────────
// Misure del braccio durante un colpo (v6): non solo dove va il pugno, ma come
// si muove TUTTO il braccio. Esempi: l'avambraccio diventa verticale (montante),
// il gomito sale all'altezza del pugno (gancio), il braccio si allunga (diretto).
//
// Perché: provato su 4.741 pugni etichettati del dataset BoxingVI (10 video,
// scheletri AlphaPose, arXiv 2511.16524), insegnando al coach pochi pugni di una
// persona mai vista e riconoscendo tutti gli altri suoi pugni:
//   esempi per tipo      3     5     10    20
//   misure del braccio  64%   70%   74%   79%
//   solo traiettoria    55%   56%   65%   70%   (metodo v5)
// Gli esempi di ALTRE persone da soli non bastano (≈ 50%: ognuno tira a modo
// suo e la camera cambia tutto): il coach impara dai TUOI colpi, e dai pro
// prende solo quanto variano normalmente le misure (ARM_SCALE).
// ─────────────────────────────────────────────────────────────────────────────

// Ordine fisso delle misure (gli esempi salvati sono vettori in quest'ordine)
export const ARM_FEATURES = [
  'dy', 'adx', 'reach',               // spostamento del pugno al picco (busti): verticale, orizzontale, totale
  'faV', 'faH', 'faLen',              // avambraccio al picco: quanto è verticale / orizzontale, lunghezza
  'uaV', 'uaLen',                     // braccio (spalla-gomito) al picco: inclinazione, lunghezza nell'immagine
  'armGrow', 'elbowAboveWrist',       // quanto si allunga il braccio; gomito più alto del pugno
  'dex', 'dey', 'deN',                // spostamento del gomito
  'straight', 'ix', 'iy',             // traiettoria dritta o curva, direzione d'uscita
  'peakMs', 'durMs',                  // tempi
  'swG', 'swD', 'nose',               // vista: spalle in guardia, rotazione delle spalle, testa
  'wristY0', 'wristX0',               // da dove parte il pugno
];
export const ARM_FEATURES_VERSION = 1;

// Quanto varia normalmente ogni misura fra i pugni dei pro (deviazione standard su BoxingVI):
// rende confrontabili gradi, busti e millisecondi
export const ARM_SCALE = {
  dy: 0.371, adx: 0.296, reach: 0.298, faV: 0.478, faH: 0.261, faLen: 0.147, uaV: 0.359, uaLen: 0.119,
  armGrow: 0.315, elbowAboveWrist: 0.223, dex: 0.48, dey: 0.229, deN: 0.302, straight: 0.202, ix: 0.736,
  iy: 0.556, peakMs: 77.2, durMs: 105, swG: 0.192, swD: 0.221, nose: 0.136, wristY0: 0.226, wristX0: 0.338,
};
const SCALE = ARM_FEATURES.map((k) => ARM_SCALE[k]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const nrm = (v) => Math.hypot(v[0], v[1]);

// Verso dove guarda il pugile nell'immagine (+1 / -1): la testa sta avanti rispetto alle spalle
export function facingOf(p) {
  if (!p?.[0] || !p[11] || !p[12]) return 1;
  return p[0].x - (p[11].x + p[12].x) / 2 >= 0 ? 1 : -1;
}

// frames: [{ t, p }] dal fotogramma di guardia (primo) alla fine del colpo; S: 'L' | 'R' (polso che colpisce)
// face: verso dove guarda (fisso per la sessione, dalla calibrazione). Restituisce un vettore (ARM_FEATURES) o null.
export function armFeatures(frames, S, aspect = 1, { face = null, endT = null } = {}) {
  if (!Array.isArray(frames) || frames.length < 3) return null;
  const [W, E, SH, SO] = S === 'L' ? [15, 13, 11, 12] : [16, 14, 12, 11];
  const g = frames[0].p;
  if (![0, 11, 12, 23, 24, W, E].every((j) => g?.[j] && Number.isFinite(g[j].x) && Number.isFinite(g[j].y))) return null;
  const T = Math.hypot(((g[11].x + g[12].x) / 2 - (g[23].x + g[24].x) / 2) * aspect, (g[11].y + g[12].y) / 2 - (g[23].y + g[24].y) / 2);
  if (!(T > 0.02)) return null;
  const f = face ?? facingOf(g);
  const P = (p, j) => { const mx = ((p[11].x + p[12].x) / 2) * aspect, my = (p[11].y + p[12].y) / 2; return [((p[j].x * aspect - mx) / T) * f, (p[j].y - my) / T]; };
  const ps = frames.map((fr) => fr.p);
  const w = ps.map((p) => P(p, W)), e = ps.map((p) => P(p, E)), s = ps.map((p) => P(p, SH)), so = ps.map((p) => P(p, SO));
  const dw = w.map((x) => sub(x, w[0])), de = e.map((x) => sub(x, e[0]));
  let pk = 0;
  dw.forEach((d, i) => { if (nrm(d) > nrm(dw[pk])) pk = i; });
  const chord = dw[pk], reach = nrm(chord) || 1e-6;
  const out = dw.slice(0, pk + 1);
  const len = out.slice(1).reduce((a, d, i) => a + nrm(sub(d, out[i])), 0) || 1e-6;
  const third = dw[Math.max(1, Math.round(pk / 3))] || chord;
  const fa = sub(w[pk], e[pk]), ua = sub(e[pk], s[pk]);
  const armG = nrm(sub(w[0], s[0]));
  const swG = Math.abs(s[0][0] - so[0][0]), swP = Math.abs(s[pk][0] - so[pk][0]);
  const t0 = frames[0].t;
  const v = {
    dy: chord[1], adx: Math.abs(chord[0]), reach,
    faV: fa[1] / (nrm(fa) || 1e-6), faH: Math.abs(fa[0]) / (nrm(fa) || 1e-6), faLen: nrm(fa),
    uaV: ua[1] / (nrm(ua) || 1e-6), uaLen: nrm(ua),
    armGrow: nrm(sub(w[pk], s[pk])) - armG, elbowAboveWrist: w[pk][1] - e[pk][1],
    dex: de[pk][0], dey: de[pk][1], deN: nrm(de[pk]),
    straight: reach / len, ix: third[0] / (nrm(third) || 1e-6), iy: third[1] / (nrm(third) || 1e-6),
    peakMs: frames[pk].t - t0, durMs: (endT ?? frames[frames.length - 1].t) - t0,
    swG, swD: swP - swG, nose: Math.abs(((g[0].x - (g[11].x + g[12].x) / 2) * aspect) / T),
    wristY0: w[0][1], wristX0: w[0][0],
  };
  const vec = ARM_FEATURES.map((k) => Math.round(v[k] * 1000) / 1000);
  return vec.every(Number.isFinite) ? vec : null;
}

export const hasFeatures = (f) => Array.isArray(f) && f.length === ARM_FEATURES.length && f.every(Number.isFinite);

// Distanza fra due colpi: ogni misura divisa per quanto varia normalmente (unità "deviazioni standard")
export function featureDistance(a, b) {
  let s = 0;
  for (let j = 0; j < SCALE.length; j += 1) s += ((a[j] - b[j]) / SCALE[j]) ** 2;
  return Math.sqrt(s);
}

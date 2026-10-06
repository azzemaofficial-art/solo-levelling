// ─────────────────────────────────────────────────────────────────────────────
// Motore dei colpi di braccio, solo 2D e relativo al corpo (v5).
//
// Perché: le clip vere dell'iPhone (4–5 ottobre) hanno mostrato che con un colpo
// tirato verso la camera la stima 3D di MediaPipe è inutilizzabile (il polso
// "va indietro", sparisce, salta a una posa di riposo) e nelle rotazioni
// sinistra e destra si scambiano. Quello che resta affidabile è QUALE braccio
// si muove, QUANDO e QUANTO rispetto al corpo nell'immagine.
//
// - Riferimento: centro delle spalle, scala = busto nell'immagine (passi e
//   avvicinamenti non contano). Ogni polso ha la sua posizione di guardia, che
//   segue piano i tuoi aggiustamenti quando il braccio è fermo.
// - Movimento comune delle due mani (rotazione, testa, passo) tolto.
// - Un colpo inizia sopra ON e finisce sotto OFF (isteresi), o quando il pugno
//   è di nuovo fermo; tra le due braccia conta quella che si muove di più.
// - Tarato sulle clip vere: guardia ferma < 0,10; jab 0,19–0,31; diretto 0,44–0,51.
// ─────────────────────────────────────────────────────────────────────────────

export const STRIKE = {
  on: 0.16,          // inizio colpo (busti, nell'immagine)
  off: 0.09,         // fine colpo: rientrato nel rumore della guardia
  peakMin: 0.18,     // picco minimo perché sia un colpo
  dominance: 1.3,    // con le due mani in movimento parte solo quella che si muove di più…
  growLead: 0.04,    // …o quella che si allunga di più (l'altra torna al viso)
  elbowW: 0.85,      // gomitata: ampiezza = movimento del gomito × 0,85
  elbowOn: 0.3,      // gomito spostato di 0,3 busti con il pugno fermo = gomitata
  minMs: 80,         // un colpo dura almeno 80 ms fuori dalla guardia
  maxMs: 1300,       // …e al massimo 1,3 s
  settleMs: 220,     // pugno fermo da 0,22 s dopo il picco = colpo finito (nuova guardia)
  settleMove: 0.04,  // "fermo" = si sposta meno di 0,04 busti
  refMs: 1500,       // la guardia di riferimento segue piano i tuoi aggiustamenti
  gapMs: 260,        // più di 0,26 s senza fotogrammi = il colpo in corso si chiude lì
  minVis: 0.3,
};

const PAIRS = [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [1, 4], [2, 5], [3, 6], [7, 8], [9, 10]];
const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= STRIKE.minVis;
const norm = (v) => Math.hypot(v[0], v[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

// MediaPipe a volte scambia sinistra e destra (di profilo, nelle rotazioni):
// se spalle E fianchi sono invertiti rispetto alla calibrazione, si raddrizza.
export function unflip(points, world, order) {
  if (!order || !Array.isArray(points) || points.length < 29) return { points, world, flipped: false };
  const sh = Math.sign(points[11].x - points[12].x), hp = Math.sign(points[23].x - points[24].x);
  if (!(sh && hp && sh !== order.sh && hp !== order.hip)) return { points, world, flipped: false };
  const swap = (arr) => {
    if (!Array.isArray(arr) || arr.length < 29) return arr;
    const out = arr.slice();
    for (const [a, b] of PAIRS) { if (a < out.length && b < out.length) { out[a] = arr[b]; out[b] = arr[a]; } }
    return out;
  };
  return { points: swap(points), world: swap(world), flipped: true };
}

function torso2d(p, aspect) {
  if (![11, 12, 23, 24].every((i) => ok(p[i]))) return null;
  return Math.hypot(((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * aspect, (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2);
}

// Polso rispetto al centro delle spalle, in busti
function wristRel(p, S, aspect, T) {
  const wr = S === 'L' ? 15 : 16;
  if (!ok(p[wr]) || !ok(p[11]) || !ok(p[12]) || !(T > 0.02)) return null;
  const cx = (p[11].x + p[12].x) / 2, cy = (p[11].y + p[12].y) / 2;
  return [((p[wr].x - cx) * aspect) / T, (p[wr].y - cy) / T];
}

// Gomito rispetto al centro delle spalle: nella gomitata il pugno resta al viso e si muove il gomito
function elbowRel(p, S, aspect, T) {
  const el = S === 'L' ? 13 : 14;
  if (!ok(p[el]) || !ok(p[11]) || !ok(p[12]) || !(T > 0.02)) return null;
  const cx = (p[11].x + p[12].x) / 2, cy = (p[11].y + p[12].y) / 2;
  return [((p[el].x - cx) * aspect) / T, (p[el].y - cy) / T];
}

// Lunghezza del braccio nell'immagine (polso – SUA spalla), in busti: il braccio che
// colpisce si allunga, quello che para si accorcia (porta la mano al viso)
function armLen(p, S, aspect, T) {
  const [sh, wr] = S === 'L' ? [11, 15] : [12, 16];
  if (!ok(p[wr]) || !ok(p[sh]) || !(T > 0.02)) return null;
  return Math.hypot((p[wr].x - p[sh].x) * aspect, p[wr].y - p[sh].y) / T;
}

// Percorso del pugno ricampionato a n punti (per il confronto con i tuoi esempi)
export function resample(path, n = 16) {
  if (!path.length) return [];
  if (path.length === 1) return Array.from({ length: n }, () => path[0].slice());
  const seg = path.slice(1).map((p, i) => norm(sub(p, path[i])));
  const total = seg.reduce((a, b) => a + b, 0);
  if (total < 1e-6) return Array.from({ length: n }, () => path[0].slice());
  const out = [];
  let acc = 0, k = 0;
  for (let i = 0; i < n; i += 1) {
    const target = (total * i) / (n - 1);
    while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k += 1; }
    const f = seg[k] > 0 ? Math.min(1, (target - acc) / seg[k]) : 0;
    out.push([path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f]);
  }
  return out;
}

export function createStrikeEngine({ stance = 'orthodox' } = {}) {
  const lead = stance === 'southpaw' ? 'R' : 'L';
  const roleOf = (S) => (S === lead ? 'lead' : 'rear');
  const calib = [];
  let base = null, ref = null, refE = null, refLen = null, T = null, lastT = null;
  let active = {}, events = [], lastRel = { L: null, R: null };

  function calibrate(points, aspect = 1) {
    if (!Array.isArray(points) || points.length < 29) return false;
    const Tf = torso2d(points, aspect);
    if (!Tf) return false;
    calib.push({ p: points, aspect, T: Tf });
    if (calib.length < 10) return false;
    const Ts = calib.map((c) => c.T).sort((a, b) => a - b);
    const Tm = Ts[Math.floor(Ts.length / 2)];
    const avg = (S, fn = wristRel) => {
      const rs = calib.map((c) => fn(c.p, S, c.aspect, Tm)).filter(Boolean);
      return rs.length ? [rs.reduce((s, r) => s + r[0], 0) / rs.length, rs.reduce((s, r) => s + r[1], 0) / rs.length] : null;
    };
    const last = calib[calib.length - 1].p;
    const avgLen = (S) => {
      const ls = calib.map((c) => armLen(c.p, S, c.aspect, Tm)).filter((x) => x != null);
      return ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null;
    };
    base = {
      T: Tm, guard: { L: avg('L'), R: avg('R') }, elbow: { L: avg('L', elbowRel), R: avg('R', elbowRel) }, len: { L: avgLen('L'), R: avgLen('R') },
      order: { sh: Math.sign(last[11].x - last[12].x) || 1, hip: Math.sign(last[23].x - last[24].x) || 1 },
    };
    ref = { L: base.guard.L?.slice() || null, R: base.guard.R?.slice() || null };
    refE = { L: base.elbow.L?.slice() || null, R: base.elbow.R?.slice() || null };
    refLen = { L: base.len.L, R: base.len.R };
    T = Tm;
    return true;
  }

  function finish(S, t, reason) {
    const e = active[S];
    if (!e) return null;
    delete active[S];
    const dur = (e.calmSince ?? t) - e.start;
    // gomitata: il gomito si è mosso molto e il pugno poco
    const elbow = e.peak < STRIKE.on && e.peakE > STRIKE.elbowOn;
    const size = elbow ? e.peakE * STRIKE.elbowW : e.peak;
    if (dur < STRIKE.minMs || size < STRIKE.peakMin) return null;
    const pk = e.path[e.peakI];
    const ev = {
      arm: roleOf(S), S, start: e.start, end: e.calmSince ?? t, peakT: e.peakT, dur, elbow,
      reach: size, peakVec: pk.slice(), path: resample(e.path, 16), grow: Number.isFinite(e.growMax) ? e.growMax : 0,
      // altra mano rimasta in guardia durante il colpo
      otherUp: e.frames ? e.otherUp / e.frames : 1,
      returnMs: Math.max(0, (e.calmSince ?? t) - e.peakT), reason,
      // montante: quanto scende sotto la guardia prima del picco, e quanto sale sopra
      dip: Math.max(0, ...e.path.slice(0, e.peakI + 1).map((p) => p[1])), up: Math.max(0, -pk[1]),
      // un colpo va e TORNA: se il pugno resta lontano (mano scesa al petto e ferma) è un cambio di guardia
      // (colpo chiuso da un buco di fotogrammi: il ritorno non si è visto, non è una prova contro)
      returned: reason === 'gap' || (elbow ? e.lastE <= e.peakE * 0.6 : norm(e.path[e.path.length - 1]) <= e.peak * 0.6),
    };
    events.push(ev);
    return ev;
  }

  // posture: { L, R } mano in guardia (dal giudice) — per contare se l'altra mano resta su
  function push(points, t, aspect = 1, posture = null) {
    if (!base || !Array.isArray(points) || points.length < 29) return { done: [], active: {}, disp: {} };
    const done = [];
    const dt = lastT == null ? 0 : t - lastT;
    // buco di fotogrammi: i colpi in corso si chiudono all'ultimo fotogramma buono
    if (lastT != null && dt > STRIKE.gapMs) for (const S of ['L', 'R']) { const ev = active[S] && finish(S, lastT, 'gap'); if (ev) done.push(ev); }
    lastT = t;
    const Tf = torso2d(points, aspect);
    if (Tf) T = T + (Math.max(T * 0.7, Math.min(T * 1.4, Tf)) - T) * Math.min(1, Math.max(0, dt) / 2000);
    const rel = { L: wristRel(points, 'L', aspect, T), R: wristRel(points, 'R', aspect, T) };
    const v = { L: rel.L && ref.L ? sub(rel.L, ref.L) : null, R: rel.R && ref.R ? sub(rel.R, ref.R) : null };
    const relE = { L: elbowRel(points, 'L', aspect, T), R: elbowRel(points, 'R', aspect, T) };
    const dispE = { L: relE.L && refE.L ? norm(sub(relE.L, refE.L)) : 0, R: relE.R && refE.R ? norm(sub(relE.R, refE.R)) : 0 };
    // movimento del braccio = quello del PUGNO (nei pugni verso la camera anche il gomito
    // si muove molto: usarlo confondeva i bracci sulle clip vere)
    const disp = { L: v.L ? norm(v.L) : 0, R: v.R ? norm(v.R) : 0 };
    const wristD = disp;
    const len = { L: armLen(points, 'L', aspect, T), R: armLen(points, 'R', aspect, T) };
    // allungamento del braccio rispetto alla sua guardia (negativo = la mano torna al viso)
    const grow = { L: len.L != null && refLen.L != null ? len.L - refLen.L : 0, R: len.R != null && refLen.R != null ? len.R - refLen.R : 0 };

    for (const S of ['L', 'R']) {
      const O = S === 'L' ? 'R' : 'L';
      const e = active[S];
      if (!e) {
        // parte il braccio che si muove E si allunga più dell'altro (rotazioni e passi
        // spostano entrambe le mani, ma solo quella che colpisce si allunga),
        // oppure quello che si muove molto di più
        const dominant = grow[S] - grow[O] > STRIKE.growLead || disp[S] > disp[O] * STRIKE.dominance;
        // gomitata: il pugno resta vicino al viso e il gomito fa un movimento grande
        const elbowOnly = disp[S] < STRIKE.on * 0.7 && dispE[S] > STRIKE.elbowOn && dispE[S] > dispE[O] * STRIKE.dominance;
        if (((disp[S] > STRIKE.on && dominant && grow[S] > -STRIKE.growLead) || elbowOnly) && v[S]) {
          active[S] = { start: t, path: [v[S].slice()], peak: wristD[S], peakE: dispE[S], lastE: dispE[S], peakI: 0, peakT: t, calmSince: null, frames: 0, otherUp: 0 };
        } else if (v[S] && disp[S] < STRIKE.off && rel[S] && dt > 0) {
          // braccio fermo: la guardia di riferimento lo segue piano
          const k = Math.min(1, dt / STRIKE.refMs);
          ref[S] = ref[S].map((x, i) => x + (rel[S][i] - x) * k);
          if (relE[S] && refE[S]) refE[S] = refE[S].map((x, i) => x + (relE[S][i] - x) * k);
          if (len[S] != null && refLen[S] != null) refLen[S] += (len[S] - refLen[S]) * k;
        }
        continue;
      }
      e.growMax = Math.max(e.growMax ?? -Infinity, grow[S]);
      if (v[S]) {
        e.path.push(v[S].slice());
        if (wristD[S] > e.peak) { e.peak = wristD[S]; e.peakI = e.path.length - 1; e.peakT = t; }
      }
      e.peakE = Math.max(e.peakE, dispE[S]); e.lastE = dispE[S];
      e.frames += 1;
      if (posture && posture[O] !== false) e.otherUp += 1;
      e.calmSince = disp[S] < STRIKE.off && dispE[S] < STRIKE.elbowOn * 0.5 ? (e.calmSince ?? t) : null;
      // pugno di nuovo fermo dopo il picco, anche un po' spostato: colpo finito, nuova guardia
      let settled = false;
      if (e.path.length > 3 && t - e.peakT >= STRIKE.settleMs && wristD[S] < e.peak * 0.75 && rel[S]) {
        const recent = e.path.slice(-Math.max(3, Math.round(STRIKE.settleMs / 33)));
        settled = recent.every((p) => norm(sub(p, v[S])) < STRIKE.settleMove);
        if (settled) { ref[S] = rel[S].slice(); if (relE[S]) refE[S] = relE[S].slice(); }
      }
      if (e.calmSince != null || settled || t - e.start > STRIKE.maxMs) {
        const ev = finish(S, t, settled ? 'settled' : e.calmSince != null ? 'return' : 'long');
        if (ev) done.push(ev);
      }
    }
    lastRel = rel;
    return { done, active: { L: Boolean(active.L), R: Boolean(active.R) }, disp, rel };
  }

  return {
    lead, roleOf, calibrate, push,
    isCalibrated: () => Boolean(base),
    order: () => base?.order || null,
    base: () => base,
    events: () => events.slice(),
    abort() { active = {}; lastT = null; },
    reset() { active = {}; events = []; lastT = null; },
    activeAge: (t) => Object.fromEntries(Object.entries(active).map(([S, e]) => [roleOf(S), t - e.start])),
    lastRel: () => lastRel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Motore delle GAMBE, solo 2D (21/10/2026). Sostituisce le gambe lette in 3D.
//
// Perché (prova del 20/10, 16 ripetizioni vere + BoxingVI): con il 3D del telefono
// - il tallone dietro che ruota nel diretto diventava un calcio o una ginocchiata
//   (33 gesti di gamba inventati in 16 ripetizioni, 46 al minuto nei video di pugilato);
// - il calcio basso vero non veniva visto (3 su 4) o finiva sulla gamba avanti: quando la
//   gamba dietro passa davanti all'altra, MediaPipe ne scambia i nomi.
//
// Come legge le gambe:
// - Il telefono è fermo: un piede appoggiato resta fermo NELL'IMMAGINE. Il riferimento di
//   ogni piede è il punto dove era appoggiato (non l'anca, che si sposta con il colpo).
// - Scala = busto nell'immagine (passi verso la camera non cambiano le misure).
// - Nomi delle gambe per continuità: se scambiando sinistra e destra i punti si muovono molto
//   meno, MediaPipe ha scambiato i nomi e si raddrizzano (lo scambio resta finché non torna).
// - La forma conta più dello spostamento (misurato sui 4 calci veri e sui 952 passi di BoxingVI):
//   nel calcio lo STINCO si mette quasi orizzontale (≥ 55° dalla verticale), la COSCIA si alza
//   (≥ 20°) e la caviglia è veloce (≥ 5 busti al secondo). Nei passi e nel perno del diretto lo
//   stinco resta quasi verticale o la coscia resta giù. Il piede può tornare o atterrare avanti.
// - Ginocchiata (dietro) / check (avanti): coscia alta (≥ 40°), ginocchio salito, stinco giù, e torna.
// - Altezza del calcio dall'angolo della coscia (basso < 60°, corpo < 115°, sopra = testa): dipende
//   poco dalla prospettiva, a differenza della salita della caviglia. Tarato solo sui calci bassi.
//   Teep e calcio della gamba avanti non si distinguono bene da una camera: `typeSure: false`.
// ─────────────────────────────────────────────────────────────────────────────

export const LEG = {
  on: 0.3,           // la caviglia si allontana di 0,3 busti dal suo appoggio = gamba in azione
  peakMin: 0.55,     // una ginocchiata / un check arriva almeno a 0,55 busti dall'appoggio…
  back: 0.45,        // …e torna entro il 45% del picco (o entro `backAbs`) = è tornata
  backAbs: 0.35,
  stillDist: 0.1,    // "fermo" = la caviglia resta entro 0,1 busti…
  calmMs: 140,       // …per 0,14 s, vicina a terra (salita < `ground`): piede appoggiato
  ground: 0.25,
  minMs: 160,        // un colpo di gamba dura almeno 0,16 s…
  maxMs: 1800,       // …e al massimo 1,8 s (un calcio thai va e torna in circa 1 s)
  kickShin: 55,      // calcio: stinco ad almeno 55° dalla verticale nell'immagine…
  kickThigh: 20,     // …coscia alzata di almeno 20°…
  kickSpeed: 5,      // …caviglia veloce (busti al secondo, su ~0,1 s)…
  kickPeak: 0.7,     // …e lontana almeno 0,7 busti dal suo appoggio
  kneeThigh: 40,     // ginocchiata / check: coscia ad almeno 40°…
  otherMax: 0.6,     // l'altro piede si sposta meno del 60% di questo (non è un salto o un passo doppio)
  swapGain: 0.45,    // nomi scambiati se, scambiandoli, il movimento è meno del 45%…
  swapMin: 0.25,     // …e il movimento con i nomi di MediaPipe supera 0,25 busti in un fotogramma
  kneeUp: 0.3,       // …e ginocchio salito di 0,3 busti
  lowThigh: 60,      // altezza del calcio dalla coscia: sotto 60° = basso (calci veri: 28–32°)…
  bodyThigh: 115,    // …sotto 115° (coscia circa orizzontale) = al corpo, sopra = alto
  gapMs: 600,        // più di 0,6 s senza fotogrammi: il gesto in corso si butta (il telefono ne salta fino a 0,3 s)
  minVis: 0.3,
};

const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= LEG.minVis;
const J = { L: { hip: 23, knee: 25, ank: 27 }, R: { hip: 24, knee: 26, ank: 28 } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function torso2d(p, aspect) {
  if (![11, 12, 23, 24].every((i) => ok(p[i]))) return null;
  return Math.hypot(((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * aspect, (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2);
}

// debug(info): per ogni gesto chiuso, anche scartato (perché, picco, durata): serve al banco di prova
export function createLegEngine({ stance = 'orthodox', debug = null } = {}) {
  const lead = stance === 'southpaw' ? 'R' : 'L';
  const roleOf = (S) => (S === lead ? 'lead' : 'rear');
  const calib = [];
  let T = null, legLen = null, ref = null, kneeRef = null, swapped = false;
  let last = null, lastT = null, hist = { L: [], R: [] }, active = {}, events = [], swaps = 0;

  // punti di una gamba nell'immagine, in busti (x corretto per il formato dell'immagine)
  const legOf = (p, S, aspect, sw) => {
    const j = J[sw ? (S === 'L' ? 'R' : 'L') : S];
    if (!ok(p[j.ank]) || !ok(p[j.knee])) return null;
    return { ank: [(p[j.ank].x * aspect) / T, p[j.ank].y / T], knee: [(p[j.knee].x * aspect) / T, p[j.knee].y / T], hip: ok(p[j.hip]) ? [(p[j.hip].x * aspect) / T, p[j.hip].y / T] : null };
  };
  const hipOf = (p, aspect) => (ok(p[23]) && ok(p[24]) ? [((p[23].x + p[24].x) / 2 * aspect) / T, ((p[23].y + p[24].y) / 2) / T] : null);

  function calibrate(points, aspect = 1) {
    if (!Array.isArray(points) || points.length < 29) return false;
    const Tf = torso2d(points, aspect);
    if (!Tf || Tf < 0.02 || ![25, 26, 27, 28].every((i) => ok(points[i]))) return false;
    calib.push({ p: points, aspect, T: Tf });
    if (calib.length < 10) return false;
    const Ts = calib.map((c) => c.T).sort((a, b) => a - b);
    T = Ts[Math.floor(Ts.length / 2)];
    const avg = (fn) => { const v = calib.map(fn); return [v.reduce((s, x) => s + x[0], 0) / v.length, v.reduce((s, x) => s + x[1], 0) / v.length]; };
    ref = {}; kneeRef = {}; legLen = {};
    for (const S of ['L', 'R']) {
      ref[S] = avg((c) => legOf(c.p, S, c.aspect, false).ank);
      kneeRef[S] = avg((c) => legOf(c.p, S, c.aspect, false).knee);
      const hip = avg((c) => hipOf(c.p, c.aspect));
      legLen[S] = Math.max(0.8, dist(hip, ref[S]));
    }
    return true;
  }

  function finish(S, t, why) {
    const e = active[S];
    delete active[S];
    if (!e) return null;
    const dur = t - e.start;
    const endD = dist(e.path[e.path.length - 1], e.from);
    debug?.({ S, side: roleOf(S), why, start: e.start, t, peak: e.peak, dur, rise: e.rise, kneeUp: e.kneeUp, speed: e.speed, endD, shin: e.shin, thigh: e.thigh });
    if (why === 'gap' || why === 'long' || dur < LEG.minMs || dur > LEG.maxMs) return null;
    // calcio: stinco orizzontale, coscia alzata, caviglia veloce e lontana (può atterrare avanti)
    const kick = e.shin >= LEG.kickShin && e.thigh >= LEG.kickThigh && e.speed >= LEG.kickSpeed && e.peak >= LEG.kickPeak;
    // ginocchiata / check: coscia alta e ginocchio salito, e la gamba torna giù dov'era
    const knee = !kick && why === 'back' && e.peak >= LEG.peakMin && e.thigh >= LEG.kneeThigh && e.kneeUp >= LEG.kneeUp;
    // passo, perno del diretto, aggiustamento: nessun colpo
    if (!kick && !knee) return null;
    const L = legLen[S];
    const ext = e.extAtPeak / L;
    const rise = e.rise / L;
    const kind = kick ? 'kick' : roleOf(S) === 'rear' ? 'knee' : 'check';
    const level = kick ? (e.thigh >= LEG.bodyThigh ? 'head' : e.thigh >= LEG.lowThigh ? 'body' : 'low') : undefined;
    const ev = {
      kind, level, side: roleOf(S), S, limb: 'leg', start: e.start, end: t, peakT: e.peakT, dur,
      reach: e.peak, rise, ext, kneeUp: e.kneeUp, shin: Math.round(e.shin), thigh: Math.round(e.thigh), speed: e.speed, landed: why === 'back' ? 'back' : 'forward', swapped: e.swapped,
      // gamba avanti distesa: teep o calcio? Una camera sola non lo dice con sicurezza
      typeSure: !(kind === 'kick' && roleOf(S) === 'lead'),
      path: e.path.filter((_, i) => i % 2 === 0).map(([x, y]) => [x - e.from[0], y - e.from[1]]),
    };
    events.push(ev);
    return ev;
  }

  function push(points, t, aspect = 1) {
    if (!ref || !Array.isArray(points) || points.length < 29) return { done: [], active: {} };
    const done = [];
    const dt = lastT == null ? 0 : t - lastT;
    if (lastT != null && dt > LEG.gapMs) { for (const S of ['L', 'R']) finish(S, lastT, 'gap'); last = null; hist = { L: [], R: [] }; }
    lastT = t;
    const Tf = torso2d(points, aspect);
    // il busto segue piano (ti avvicini o ti allontani), senza salti
    if (Tf) T = T + (Math.max(T * 0.8, Math.min(T * 1.25, Tf)) - T) * Math.min(1, Math.max(0, dt) / 2000);
    // nomi delle gambe per continuità con il fotogramma prima; dopo una pausa (VIA, buco di fotogrammi,
    // fuori inquadratura) il fotogramma prima non c'è: i nomi si decidono dagli appoggi dei piedi
    let cur = { L: legOf(points, 'L', aspect, swapped), R: legOf(points, 'R', aspect, swapped) };
    const prev = last || (active.L || active.R ? null : { L: { ank: ref.L, knee: kneeRef.L }, R: { ank: ref.R, knee: kneeRef.R } });
    if (prev?.L && prev?.R && cur.L && cur.R) {
      const keep = dist(cur.L.ank, prev.L.ank) + dist(cur.R.ank, prev.R.ank) + dist(cur.L.knee, prev.L.knee) + dist(cur.R.knee, prev.R.knee);
      const cross = dist(cur.R.ank, prev.L.ank) + dist(cur.L.ank, prev.R.ank) + dist(cur.R.knee, prev.L.knee) + dist(cur.L.knee, prev.R.knee);
      if (keep > LEG.swapMin && cross < keep * LEG.swapGain) { swapped = !swapped; swaps += 1; cur = { L: cur.R, R: cur.L }; for (const S of ['L', 'R']) if (active[S]) active[S].swapped = true; }
    }
    const hip = hipOf(points, aspect);
    const disp = {};
    for (const S of ['L', 'R']) disp[S] = cur[S] ? dist(cur[S].ank, ref[S]) : 0;
    for (const S of ['L', 'R']) {
      const c = cur[S];
      if (!c) {
        // gamba non vista: un gesto aperto non resta acceso per sempre (bloccherebbe la fine della ripetizione)
        const e = active[S];
        if (e && (t - e.times[e.times.length - 1] > LEG.gapMs || t - e.start > LEG.maxMs)) finish(S, t, 'gap');
        continue;
      }
      const O = S === 'L' ? 'R' : 'L';
      // fermo: negli ultimi `calmMs` la caviglia è rimasta in un cerchio piccolo (il tremolio non conta)
      hist[S] = hist[S].filter((h) => t - h.t <= LEG.calmMs);
      const isStill = hist[S].length >= 2 && t - hist[S][0].t >= LEG.calmMs * 0.7 && hist[S].every((h) => dist(h.ank, c.ank) < LEG.stillDist);
      hist[S].push({ t, ank: c.ank.slice() });
      const e = active[S];
      if (!e) {
        if (disp[S] > LEG.on && disp[O] < disp[S] * LEG.otherMax && !isStill) {
          active[S] = { start: t, from: ref[S].slice(), kneeFrom: kneeRef[S].slice(), path: [c.ank.slice()], times: [t], speed: 0, shin: 0, thigh: 0, peak: disp[S], peakT: t, rise: Math.max(0, ref[S][1] - c.ank[1]), kneeUp: Math.max(0, kneeRef[S][1] - c.knee[1]), extAtPeak: hip ? dist(hip, c.ank) : legLen[S], swapped: false };
        } else if (isStill && ref[S][1] - c.ank[1] < LEG.ground) {
          // piede appoggiato: è il nuovo riferimento (passi, aggiustamenti)
          ref[S] = c.ank.slice(); kneeRef[S] = c.knee.slice();
        }
        continue;
      }
      // velocità della caviglia su ~0,1 s (un calcio è veloce, un passo no)
      const back3 = e.path[Math.max(0, e.path.length - 3)], tb = e.times[Math.max(0, e.times.length - 3)];
      if (t > tb) e.speed = Math.max(e.speed, (dist(c.ank, back3) * 1000) / (t - tb));
      e.path.push(c.ank.slice()); e.times.push(t);
      // angoli dalla verticale nell'immagine: stinco (ginocchio→caviglia) e coscia (anca→ginocchio)
      const ang = (a, b) => (Math.atan2(Math.abs(b[0] - a[0]), b[1] - a[1]) * 180) / Math.PI;
      e.shin = Math.max(e.shin, ang(c.knee, c.ank));
      if (c.hip) e.thigh = Math.max(e.thigh, ang(c.hip, c.knee));
      const d = dist(c.ank, e.from);
      if (d > e.peak) { e.peak = d; e.peakT = t; e.extAtPeak = hip ? dist(hip, c.ank) : e.extAtPeak; }
      e.rise = Math.max(e.rise, e.from[1] - c.ank[1]);
      e.kneeUp = Math.max(e.kneeUp, e.kneeFrom[1] - c.knee[1]);
      const low = e.from[1] - c.ank[1] < LEG.ground;
      // tornato: dopo il picco la caviglia è di nuovo vicina al suo appoggio (e giù) = colpo di gamba
      const back = e.peak >= LEG.peakMin && t > e.peakT && low && d <= Math.max(LEG.backAbs, e.peak * LEG.back);
      // atterrato altrove e fermo = passo; troppo lungo = niente
      const why = back ? 'back' : isStill && low && t - e.start >= 100 ? 'step' : t - e.start > LEG.maxMs ? 'long' : null;
      if (why) {
        const ev = finish(S, t, why);
        if (ev) done.push(ev);
        // dove si è fermato è il nuovo appoggio
        ref[S] = c.ank.slice(); kneeRef[S] = c.knee.slice();
      }
    }
    last = cur;
    return { done, active: { L: Boolean(active.L), R: Boolean(active.R) }, disp };
  }

  return {
    lead, roleOf, calibrate, push,
    isCalibrated: () => Boolean(ref),
    events: () => events.slice(),
    swaps: () => swaps,
    abort() { active = {}; lastT = null; last = null; },
    reset() { active = {}; events = []; lastT = null; last = null; },
    activeAge: (t) => Object.fromEntries(Object.entries(active).map(([S, e]) => [roleOf(S), t - e.start])),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Giudice delle combo MMA dalla camera (MediaPipe Pose, coordinate 3D stimate in
// metri — "world landmarks" — più le 2D per la visibilità).
//
// 1. calibrate(): la tua guardia di riferimento (busto, braccia, spalle, testa, piedi)
//    → tutte le misure diventano relative al TUO corpo.
// 2. push(frame): segmenta ogni gesto (arto che lascia la guardia e ci torna) e lo
//    classifica: diretto, gancio, montante, al corpo, gomito, ginocchiata, teep,
//    calci basso/corpo/testa, switch kick, check, schivata, rotolamento, parata,
//    finta, cambio di livello, clinch.
// 3. judgeRep(expected): allinea i gesti visti con la combo scelta e valuta ogni colpo
//    (guardia dell'altra mano, distensione, ritorno, rotazione, gomito, equilibrio).
//
// Limiti onesti: una camera sola → profondità stimata (errori di qualche cm), niente
// potenza né impatto. Soglie da tarare su persone reali (vedi THRESH).
// ─────────────────────────────────────────────────────────────────────────────

import { buildModel, classify } from './mmaTemplates.js';
import { createStrikeEngine, unflip } from './mmaStrikes.js';

// Indici MediaPipe
const NOSE = 0;
const J = {
  L: { sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27 },
  R: { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28 },
};

export const THRESH = {
  guardSlack: 0.2,      // polso-naso: entro la TUA guardia calibrata + 0,2 busto = in guardia
  activeSlack: 0.25,    // oltre la tua guardia + 0,25 busto = braccio fuori
  elbowNear: 0.45,      // gomito: polso resta vicino alla testa (tua guardia + 0,45)
  elbowUp: -0.14,       // altezza gomito rispetto alle spalle / busto: sopra = gomito alto
  straightExt: 0.8,     // distensione minima di un diretto (polso-spalla / braccio)
  straightAngle: 140,   // gomito quasi disteso
  fullExt: 0.9,         // distensione "completa"
  bodyLevel: -0.45,     // polso sotto le spalle di quasi mezzo busto = colpo al corpo
  uppercutRise: 0.3,    // salita del polso nel montante
  footLift: 0.16,       // caviglia sollevata (busto) = gamba in azione
  kickExtAngle: 140,    // ginocchio disteso = calcio (sotto = ginocchiata / check)
  rotateDeg: 10,        // rotazione minima spalle per colpi posteriori
  returnMs: 600,        // ritorno in guardia "rapido" (misurato fino al rientro nel rumore della guardia)
  slipDisp: 0.28, rollDrop: 0.5, levelDrop: 0.3,
  maxGestureMs: 1600,
  calmMs: 150,          // un gesto finisce solo dopo 150 ms di calma (niente doppi conteggi)
  snapExt: 0.65,        // …oppure subito, se il braccio era lontano ed è tornato in guardia
  out2d: 0.35,          // polso spostato nell'immagine di 0,35 busti dalla tua guardia = braccio fuori
  guardDown: 0.0,       // polso all'altezza della spalla o sotto (immagine) = guardia abbassata
  minVis: 0.35,         // sotto questa visibilità un punto 2D non si usa
  // tarati sulle prime clip vere (iPhone, colpi tirati verso la camera):
  grow2d: 0.1,          // il braccio si allunga di 0,1 busti nell'immagine rispetto alla TUA guardia…
  openExt: 0.15,        // …o in 3D si distende di 0,15 E il gomito si apre di 25°…
  openAng: 25,
  move2d: 0.14,         // …o il polso si sposta di 0,14 busti nell'immagine = colpo (clip vere: fermo ≤ 0,10, jab ≥ 0,17)
  dropDown: 0.15,       // mano 0,15 busti sotto la TUA guardia (immagine) = guardia abbassata
  dropHard: 0.25,       // mano al petto (0,25 sotto la spalla) = abbassata comunque
  refMs: 1500,          // la guardia di riferimento segue piano i tuoi aggiustamenti
  minArmMs: 90,         // un colpo vero resta fuori almeno 90 ms
  settleMs: 200,        // pugno fermo da 0,2 s dopo il colpo…
  settle2d: 0.05,       // …(si muove meno di 0,05 busti) = colpo finito, nuova guardia
};

const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const angleAt = (a, b, c) => {
  const u = sub(a, b), v = sub(c, b);
  const d = len(u) * len(v);
  return d < 1e-6 ? 180 : Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / d))) * 180 / Math.PI;
};
const yawOf = (l, r) => Math.atan2((r.z || 0) - (l.z || 0), r.x - l.x) * 180 / Math.PI;
const yawDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// ruota attorno alla verticale: i fianchi calibrati diventano l'asse x (indipendente dall'angolo della camera)
const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const seen2d = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= THRESH.minVis;
const norm = (v) => Math.hypot(...v);
// ampiezza del colpo dalle caratteristiche: 2D se c'è (più affidabile), altrimenti 3D
const reachOf = (f) => (Number.isFinite(f?.[3]) && Number.isFinite(f?.[4]) ? Math.hypot(f[3], f[4]) : Math.hypot(f?.[0] || 0, f?.[1] || 0, f?.[2] || 0));

// ── Aspettative per ogni colpo della libreria (id di src/data/mmaMoves.js) ──
export const EXPECT = {
  jab: { kind: 'straight', side: 'lead', level: 'head' },
  cross: { kind: 'straight', side: 'rear', level: 'head' },
  hook: { kind: 'hook', side: 'lead', level: 'head' },
  rearHook: { kind: 'hook', side: 'rear', level: 'head' },
  uppercut: { kind: 'uppercut', side: 'lead' },
  rearUppercut: { kind: 'uppercut', side: 'rear' },
  bodyHook: { kind: 'hook', side: 'lead', level: 'body' },
  bodyCross: { kind: 'straight', side: 'rear', level: 'body' },
  leadElbow: { kind: 'elbow', side: 'lead' },
  rearElbow: { kind: 'elbow', side: 'rear' },
  clinch: { kind: 'clinch' },
  rearKnee: { kind: 'knee', side: 'rear' },
  teep: { kind: 'teep', side: 'lead' },
  lowKick: { kind: 'kick', side: 'rear', level: 'low' },
  bodyKick: { kind: 'kick', side: 'rear', level: 'body' },
  headKick: { kind: 'kick', side: 'rear', level: 'head' },
  switchKick: { kind: 'kick', side: 'lead', level: 'body' },
  check: { kind: 'check', side: 'lead' },
  slip: { kind: 'slip' },
  roll: { kind: 'roll' },
  parry: { kind: 'parry', side: 'rear' },
  feint: { kind: 'feint', side: 'lead' },
  levelChange: { kind: 'level' },
  doubleLeg: { kind: 'guided' },
  sprawl: { kind: 'guided' },
};
export const needsFeet = (moveIds) => moveIds.some((id) => ['knee', 'teep', 'kick', 'check', 'level', 'guided'].includes(EXPECT[id]?.kind));

const KIND_NAME = { strike: 'colpo', straight: 'diretto', hook: 'gancio', uppercut: 'montante', elbow: 'gomito', clinch: 'clinch', knee: 'ginocchiata', teep: 'teep', kick: 'calcio', check: 'check', slip: 'schivata', roll: 'rotolamento', parry: 'parata', feint: 'finta', level: 'cambio di livello', unclear: 'colpo non chiaro' };
export const describeGesture = (g) => {
  if (!g) return '';
  const side = g.side === 'lead' ? ' avanti' : g.side === 'rear' ? ' dietro' : '';
  const level = g.level === 'body' ? ' al corpo' : g.level === 'low' ? ' basso' : g.level === 'head' && g.kind === 'kick' ? ' alto' : '';
  return `${KIND_NAME[g.kind] || g.kind}${['strike', 'straight', 'hook', 'uppercut', 'elbow'].includes(g.kind) ? (g.kind === 'strike' ? ` col braccio${side}` : side) : ''}${level}`;
};

export function createComboJudge({ stance = 'orthodox', templates = null } = {}) {
  let model = templates ? buildModel(templates) : null;
  const lead = stance === 'southpaw' ? 'R' : 'L';
  const rear = lead === 'L' ? 'R' : 'L';
  const sideOf = { lead, rear };
  let base = null;           // riferimento della guardia
  const calib = [], calib2d = [];
  let active = {};           // gesti in corso per arto: leadArm, rearArm, leadLeg, rearLeg, body
  let gestures = [];         // gesti conclusi (dall'ultimo reset)
  let frames = [];           // fotogrammi della ripetizione (per il replay)
  let lastT = null;
  // braccia: motore 2D relativo al corpo, tarato sulle clip vere (lib/mmaStrikes.js)
  const engine = createStrikeEngine({ stance });
  let armActive = { L: false, R: false }, armDisp = { lead: 0, rear: 0 };

  // ── Misure per fotogramma ──
  function measure(w, p2, aspect = 1) {
    const shM = mid(w[11], w[12]), hipM = mid(w[23], w[24]);
    const yawRad = base?.hipYawRad || 0;
    // 2D: lunghezza del busto nell'immagine (scala indipendente dalla distanza dalla camera)
    const has2d = Array.isArray(p2) && p2.length > 28 && [11, 12, 23, 24].every((i) => seen2d(p2[i]));
    // scala: il busto misurato in calibrazione (in un rotolamento il busto si accorcia, le mani no)
    const T2 = base?.T2 && has2d ? base.T2 : has2d ? Math.hypot(((p2[11].x + p2[12].x) / 2 - (p2[23].x + p2[24].x) / 2) * aspect, (p2[11].y + p2[12].y) / 2 - (p2[23].y + p2[24].y) / 2) : 0;
    const rel2 = (a, b) => (has2d && T2 > 0.02 && seen2d(p2[a]) && seen2d(p2[b]) ? [((p2[a].x - p2[b].x) * aspect) / T2, (p2[a].y - p2[b].y) / T2] : null);
    const torso = base?.torso || dist(shM, hipM);
    const shoulderW = base?.shoulderW || dist(w[11], w[12]);
    const nose = w[NOSE];
    const arm = (S) => {
      const j = J[S];
      const armLen = base?.armLen?.[S] || (dist(w[j.sh], w[j.el]) + dist(w[j.el], w[j.wr]));
      return {
        ext: dist(w[j.wr], w[j.sh]) / armLen,
        elbowAngle: angleAt(w[j.sh], w[j.el], w[j.wr]),
        toNose: dist(w[j.wr], nose) / torso,
        wristH: (shM.y - w[j.wr].y) / torso,
        elbowH: (shM.y - w[j.el].y) / torso,
        wrist: w[j.wr],
        // polso rispetto alla testa (in guardia le mani seguono la testa, anche ruotando):
        // 3D nel riferimento del corpo, 2D nell'immagine
        rel3: rotY(sub(w[j.wr], nose), yawRad).map((x) => x / torso),
        rel2: rel2(j.wr, NOSE),
        // altezza del polso rispetto alla SUA spalla nell'immagine (>0 = sotto la spalla)
        low2: rel2(j.wr, j.sh)?.[1] ?? null,
        // lunghezza del braccio nell'immagine: nei colpi verso la camera è il segnale più netto
        arm2: rel2(j.wr, j.sh) ? norm(rel2(j.wr, j.sh)) : null,
      };
    };
    const leg = (S) => {
      const j = J[S];
      return {
        kneeH: (hipM.y - w[j.knee].y) / torso,
        ankleRel: (hipM.y - w[j.ank].y) / torso,
        // ogni caviglia rispetto a SE STESSA in guardia: MediaPipe vede i due piedi ad altezze diverse
        lift: base ? ((base.ankleY?.[S] ?? base.ground) - w[j.ank].y) / torso : 0,
        kneeAngle: angleAt(w[j.hip], w[j.knee], w[j.ank]),
        rel3: rotY(sub(w[j.ank], hipM), yawRad).map((x) => x / torso),
        rel2: has2d && seen2d(p2[j.ank]) ? [((p2[j.ank].x - (p2[23].x + p2[24].x) / 2) * aspect) / T2, (p2[j.ank].y - (p2[23].y + p2[24].y) / 2) / T2] : null,
      };
    };
    const yaw = yawOf(w[11], w[12]);
    const shoulderLean = Math.atan2(Math.abs((shM.z || 0) - (hipM.z || 0)), Math.abs(hipM.y - shM.y)) * 180 / Math.PI;
    return {
      torso, shoulderW, yaw, lean: shoulderLean,
      arms: { L: arm('L'), R: arm('R') }, legs: { L: leg('L'), R: leg('R') },
      headDrop: base ? (nose.y - base.noseY) / torso : 0,
      headDisp: base ? Math.hypot(nose.x - base.nose.x, (nose.z || 0) - (base.nose.z || 0), nose.y - base.nose.y) / torso : 0,
      hipDrop: base ? (hipM.y - base.hipY) / torso : 0,
    };
  }

  // vicino alla TUA guardia (3D): serve a capire quando un colpo è finito
  const guardOf = (m, S) => m.arms[S].toNose < base.toNose[S] + THRESH.guardSlack;
  // guardia "giusta" (postura): pugno sopra la linea della spalla nell'immagine.
  // Se il polso non si vede bene si usa il 3D personale.
  const postureOf = (m, S) => {
    const low = m.arms[S].low2;
    if (low == null) return guardOf(m, S);
    // abbassata = sotto la TUA guardia di 0,15 busti, oppure al petto in ogni caso
    const mine = base.low2?.[S];
    return mine != null ? low < Math.min(mine + THRESH.dropDown, THRESH.dropHard) : low < THRESH.guardDown;
  };

  // ── Calibrazione: 1,5 s in guardia ──
  function calibrate(world, points2d, aspect = 1) {
    if (!world || world.length < 29) return false;
    if (Array.isArray(points2d)) engine.calibrate(points2d, aspect);
    calib.push(world); calib2d.push({ p: points2d, aspect });
    if (calib.length < 12) return false;
    const avg = (fn) => calib.reduce((s, w) => s + fn(w), 0) / calib.length;
    const torso = avg((w) => dist(mid(w[11], w[12]), mid(w[23], w[24])));
    base = {
      torso,
      shoulderW: avg((w) => dist(w[11], w[12])),
      armLen: { L: avg((w) => dist(w[11], w[13]) + dist(w[13], w[15])), R: avg((w) => dist(w[12], w[14]) + dist(w[14], w[16])) },
      yaw: avg((w) => yawOf(w[11], w[12])),
      noseY: avg((w) => w[NOSE].y),
      nose: { x: avg((w) => w[NOSE].x), y: avg((w) => w[NOSE].y), z: avg((w) => w[NOSE].z || 0) },
      hipY: avg((w) => mid(w[23], w[24]).y),
      ground: avg((w) => Math.max(w[27].y, w[28].y)),
    };
    // la tua distanza polso-naso in guardia (ognuno tiene i pugni a modo suo)
    base.toNose = { L: avg((w) => dist(w[15], w[NOSE])) / torso, R: avg((w) => dist(w[16], w[NOSE])) / torso };
    // fianchi → asse del corpo; posizione dei polsi e delle caviglie in guardia (3D e 2D)
    const t2s = calib2d.filter((c) => Array.isArray(c.p) && [11, 12, 23, 24].every((i) => seen2d(c.p[i]))).map(({ p, aspect: as }) => Math.hypot(((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * as, (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2));
    base.T2 = t2s.length ? t2s.reduce((x, y) => x + y, 0) / t2s.length : 0;
    base.hipYawRad = Math.atan2(avg((w) => (w[24].z || 0) - (w[23].z || 0)), avg((w) => w[24].x - w[23].x));
    const ms = calib.map((w, i) => measure(w, calib2d[i]?.p, calib2d[i]?.aspect));
    const avgVec = (get) => { const vs = ms.map(get).filter(Boolean); return vs.length ? vs[0].map((_, k) => vs.reduce((s, v) => s + v[k], 0) / vs.length) : null; };
    base.g3 = { L: avgVec((m) => m.arms.L.rel3), R: avgVec((m) => m.arms.R.rel3) };
    const avgOf = (get) => { const vs = ms.map(get).filter((v) => v != null && Number.isFinite(v)); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
    base.low2 = { L: avgOf((m) => m.arms.L.low2), R: avgOf((m) => m.arms.R.low2) };
    base.ext = { L: avgOf((m) => m.arms.L.ext), R: avgOf((m) => m.arms.R.ext) };
    base.ang = { L: avgOf((m) => m.arms.L.elbowAngle), R: avgOf((m) => m.arms.R.elbowAngle) };
    base.ankleY = { L: avg((w) => w[27].y), R: avg((w) => w[28].y) };
    base.arm2 = { L: avgOf((m) => m.arms.L.arm2), R: avgOf((m) => m.arms.R.arm2) };
    base.g2 = { L: avgVec((m) => m.arms.L.rel2), R: avgVec((m) => m.arms.R.rel2) };
    base.f3 = { L: avgVec((m) => m.legs.L.rel3), R: avgVec((m) => m.legs.R.rel3) };
    base.f2 = { L: avgVec((m) => m.legs.L.rel2), R: avgVec((m) => m.legs.R.rel2) };
    return true;
  }

  // ── Braccia: colpo trovato dal motore 2D → che colpo è ──
  // Con i tuoi esempi decide la somiglianza della traiettoria; senza esempi è un "colpo"
  // di quel braccio (tipo non deciso: la camera da sola non distingue bene diretto e gancio).
  function armGesture(ev) {
    let kind = 'strike', move = null, match = null, reachRatio = null;
    // il pugno non è tornato: mano scesa o guardia spostata, non un colpo
    if (ev.returned === false) kind = 'drop';
    else if (model?.[ev.arm]) {
      match = classify(model, ev.arm, ev);
      // due tuoi colpi quasi uguali per questa camera: non si decide fra i due
      const ambiguous = match && match.second && match.margin < 0.04;
      if (match?.accepted && !ambiguous) {
        move = match.move; kind = EXPECT[move]?.kind || 'strike';
        const mine = model[ev.arm].items.filter((it) => it.move === move);
        const refReach = mine.length ? mine.reduce((sum, it) => sum + it.reach, 0) / mine.length : null;
        reachRatio = refReach ? ev.reach / refReach : null;
      } else if (!match?.accepted && ev.reach < 0.24) kind = 'unclear';
    } else if (ev.elbow) kind = 'elbow';
    else if (ev.dip >= 0.08 && ev.up >= 0.05) kind = 'uppercut'; // scende e poi sale sopra la guardia
    return {
      kind, move, match, side: ev.arm, level: move ? EXPECT[move]?.level : undefined, limb: 'arm', reason: ev.reason,
      start: ev.start, end: ev.end, peakT: ev.peakT, dur: ev.dur, reach: ev.reach, path: ev.path, peakVec: ev.peakVec,
      guardRatio: ev.otherUp, bothGuard: ev.otherUp, returnMs: ev.returnMs, rotation: null, lean: 0, peakElbowGap: 0, reachRatio,
    };
  }

  function classifyLeg(g) {
    const S = g.S, role = S === lead ? 'lead' : 'rear';
    const samples = g.samples;
    // gamba in piedi è già distesa: la distensione conta solo a piede ben sollevato
    const maxLift = Math.max(...samples.map((s) => s.l.lift));
    const lifted = samples.filter((s) => s.l.lift >= maxLift * 0.7);
    const pool = lifted.length ? lifted : samples;
    // non il massimo assoluto (un fotogramma rumoroso trasforma un check in calcio):
    // il secondo valore più alto, se c'è
    const knees = pool.map((s) => s.l.kneeAngle).sort((a, b) => b - a);
    const maxKnee = knees.length > 2 ? knees[1] : knees[0];
    const highI = samples.reduce((best, s, i) => (s.l.ankleRel > samples[best].l.ankleRel ? i : best), 0);
    const p = samples[highI].l;
    const rotation = Math.max(...samples.map((s) => s.rot));
    let kind; let level;
    if (maxKnee < THRESH.kickExtAngle) kind = role === 'rear' ? 'knee' : 'check';
    else if (role === 'lead' && rotation < 25 && p.ankleRel > -0.7 && p.ankleRel < 0.35) kind = 'teep';
    else { kind = 'kick'; level = p.ankleRel > 0.7 ? 'head' : p.ankleRel > -0.35 ? 'body' : 'low'; }
    return { kind, side: role, level, peakT: samples[highI].t, peak: p, rotation, dur: (g.calmSince ?? g.end) - g.start };
  }

  function finish(key, t) {
    const g = active[key];
    if (!g) return;
    delete active[key];
    g.end = t;
    const info = key.endsWith('Leg') ? classifyLeg(g) : g.info;
    // qualità: l'altra mano in guardia, rotazione, ritorno, gomito, sbilanciamento
    const other = key === 'leadArm' ? rear : key === 'rearArm' ? lead : null;
    const guardRatio = other ? g.samples.filter((s) => s.guard[other]).length / g.samples.length : 1;
    const bothGuard = g.samples.filter((s) => s.guard[lead] && s.guard[rear]).length / g.samples.length;
    const rot = Math.max(...g.samples.map((s) => s.rot));
    const lean = Math.max(...g.samples.map((s) => s.lean));
    const returnMs = info.holdEndT != null ? (g.calmSince ?? t) - info.holdEndT : 0;
    gestures.push({ ...info, limb: key.endsWith('Arm') ? 'arm' : key.endsWith('Leg') ? 'leg' : 'body', start: g.start, end: t, guardRatio, bothGuard, rotation: rot, lean, returnMs, peakElbowGap: info.peak ? Math.abs((info.peak.elbowH ?? 0) - (info.peak.wristH ?? 0)) : 0 });
  }

  // ── Fotogramma ──
  function push(worldIn, t, points2dIn, aspect = 1) {
    if (!base || !worldIn || worldIn.length < 29) return null;
    // MediaPipe a volte scambia sinistra e destra (rotazioni, quasi di profilo): si raddrizza
    const fixed = engine.isCalibrated() ? unflip(points2dIn, worldIn, engine.order()) : { points: points2dIn, world: worldIn, flipped: false };
    const world = fixed.world, points2d = fixed.points;
    const dt = lastT == null ? 0 : t - lastT; lastT = t;
    const m = measure(world, points2d, aspect);
    const rot = yawDiff(m.yaw, base.yaw);
    const guard = { L: postureOf(m, 'L'), R: postureOf(m, 'R') };
    const guardKnown = { L: m.arms.L.low2 != null, R: m.arms.R.low2 != null };
    frames.push({ t, world, points: points2d, guard });
    if (frames.length > 600) frames.shift();
    const sample = (extra) => ({ t, guard, rot, lean: m.lean, ...extra });

    // braccia: motore 2D relativo al corpo (lib/mmaStrikes.js)
    if (engine.isCalibrated() && Array.isArray(points2d)) {
      const r = engine.push(points2d, t, aspect, guard);
      for (const ev of r.done) gestures.push(armGesture(ev));
      armActive = r.active;
      armDisp = { lead: r.disp?.[lead] || 0, rear: r.disp?.[rear] || 0 };
    }
    // gambe
    for (const [key, S] of [['leadLeg', lead], ['rearLeg', rear]]) {
      const l = m.legs[S];
      const out = l.lift > THRESH.footLift;
      const g = active[key];
      if (out && !g) active[key] = { S, start: t, samples: [sample({ l })], calmSince: null };
      else if (g) {
        g.samples.push(sample({ l }));
        g.calmSince = out ? null : (g.calmSince ?? t);
        if ((g.calmSince != null && t - g.calmSince >= THRESH.calmMs) || t - g.start > THRESH.maxGestureMs) finish(key, t);
      }
    }
    // clinch: entrambe le mani avanti all'altezza della testa, tenute
    // clinch: ENTRAMBE le braccia avanti rispetto alla TUA guardia (una guardia alta e avanti non è un clinch)
    const clinchNow = ['L', 'R'].every((S) => m.arms[S].ext > Math.max(0.6, (base.ext?.[S] ?? 0.4) + 0.18) && m.arms[S].wristH > -0.3 && m.arms[S].elbowAngle < 150);
    if (clinchNow) {
      if (!active.clinch) active.clinch = { start: t, samples: [sample({})], calm: 0, offSince: null, info: { kind: 'clinch', peakT: t } };
      else { active.clinch.samples.push(sample({})); active.clinch.offSince = null; }
    } else if (active.clinch) {
      // un fotogramma "storto" non rompe la presa: serve un'uscita vera (≥ 150 ms)
      active.clinch.offSince ??= t;
      if (t - active.clinch.offSince >= THRESH.calmMs) {
        if (active.clinch.offSince - active.clinch.start > 350) finish('clinch', active.clinch.offSince);
        else delete active.clinch;
      }
    }
    // corpo: schivata, rotolamento, cambio di livello (solo se braccia e gambe sono calme)
    // (le mani seguono la testa nella schivata: contano solo le gambe)
    const limbsBusy = active.leadLeg || active.rearLeg;
    let bodyKind = null;
    if (m.hipDrop > THRESH.levelDrop) bodyKind = 'level';
    else if (m.headDrop > THRESH.rollDrop) bodyKind = 'roll';
    else if (m.headDisp > THRESH.slipDisp && !limbsBusy) bodyKind = 'slip';
    if (bodyKind) {
      if (!active.body) active.body = { start: t, samples: [sample({})], calm: 0, info: { kind: bodyKind, peakT: t } };
      else {
        active.body.samples.push(sample({}));
        const order = ['slip', 'roll', 'level'];
        if (order.indexOf(bodyKind) > order.indexOf(active.body.info.kind)) active.body.info.kind = bodyKind;
      }
    } else if (active.body) {
      if (t - active.body.start > 150) finish('body', t); else delete active.body;
    }
    // da quanto è fuori ogni arto: un colpo dura < 0,6 s, una mano rimasta giù no
    const armAge = engine.activeAge(t);
    const activeAge = { ...Object.fromEntries(Object.entries(active).map(([k, g]) => [k, t - g.start])), ...(armAge.lead != null ? { leadArm: armAge.lead } : {}), ...(armAge.rear != null ? { rearArm: armAge.rear } : {}) };
    const activeKeys = [...Object.keys(active), ...(armActive[lead] ? ['leadArm'] : []), ...(armActive[rear] ? ['rearArm'] : [])];
    return { dt, measure: m, rot, guard, guardKnown, activeKeys, activeAge, armDisp, gestures: gestures.length, flipped: fixed.flipped };
  }

  const reset = () => { active = {}; gestures = []; frames = []; engine.reset(); armActive = { L: false, R: false }; };
  // gesti a metà (corpo uscito dall'inquadratura, pausa): si buttano, non si indovinano
  const abort = () => { active = {}; lastT = null; engine.abort(); armActive = { L: false, R: false }; };
  const idle = () => Object.keys(active).length === 0 && !armActive.L && !armActive.R;

  return {
    lead, rear, sideOf,
    calibrate, isCalibrated: () => Boolean(base), push, reset, abort, idle, engine,
    gestures: () => gestures.slice(),
    frames: () => frames.slice(),
    judgeRep: (expected, { since = -Infinity } = {}) => judgeSequence(expected, gestures.filter((g) => g.start >= since)),
    setTemplates: (t) => { model = t ? buildModel(t) : null; },
    hasTemplates: () => Boolean(model && Object.keys(model).length),
    base: () => base,
  };
}

// ── Allineamento sequenza attesa ↔ gesti visti (distanza di modifica) + voti ──
const ARM_KINDS = ['straight', 'hook', 'uppercut', 'elbow'];
function matchScore(exp, g) {
  if (!g) return 0;
  // riconosciuto per somiglianza con i TUOI colpi: è proprio quel colpo
  if (g.move && exp.id && g.move === exp.id) return 70;
  // colpo del braccio giusto, tipo non deciso dalla camera: vale come quel colpo
  // (anche una "gomitata" letta dalle regole: un gancio verso la camera le somiglia)
  if (g.kind === 'strike' || (g.kind === 'elbow' && !g.move && g.limb === 'arm' && ['straight', 'hook', 'uppercut'].includes(exp.kind))) {
    if (!ARM_KINDS.includes(exp.kind) && !['parry', 'feint'].includes(exp.kind)) return 0;
    return !exp.side || exp.side === g.side ? 75 : 30;
  }
  // c'è un colpo dello stesso arto ma poco chiaro: non è "non visto"
  if (g.kind === 'unclear') return (ARM_KINDS.includes(exp.kind) || ['kick', 'teep', 'knee', 'check'].includes(exp.kind)) && (!exp.side || exp.side === g.side) ? 30 : 0;
  if (exp.kind !== g.kind) {
    // parentele vicine: un gancio corto letto come diretto, una finta come jab…
    const close = (a, b) => [['straight', 'feint'], ['straight', 'parry'], ['straight', 'hook'], ['hook', 'uppercut'], ['hook', 'elbow'], ['kick', 'teep'], ['knee', 'check'], ['slip', 'roll']].some(([x, y]) => (a === x && b === y) || (a === y && b === x));
    return close(exp.kind, g.kind) && (!exp.side || exp.side === g.side) ? 35 : 0;
  }
  let score = 70;
  if (exp.side && g.side && exp.side !== g.side) score -= 30;
  if (exp.level && g.level && exp.level !== g.level) score -= 20;
  return score;
}

function qualityIssues(moveId, exp, g) {
  const issues = [];
  if (['straight', 'hook', 'uppercut', 'elbow'].includes(exp.kind) && g.guardRatio < 0.7) issues.push({ key: 'guard', pts: 12, text: 'l’altra mano è scesa: tienila sulla guancia' });
  // distensione: con i tuoi esempi si confronta con il TUO colpo (il 3D del telefono la sottostima)
  if (exp.kind === 'straight' && (g.reachRatio != null ? g.reachRatio < 0.78 : g.maxExt < THRESH.fullExt)) issues.push({ key: 'extend', pts: 8, text: 'distendi il braccio fino in fondo' });
  // ritorno lento: solo se il rientro in guardia è stato misurato davvero (non un colpo chiuso per buco di fotogrammi)
  if (['straight', 'hook', 'uppercut'].includes(exp.kind) && (g.reason == null || g.reason === 'return') && g.returnMs > THRESH.returnMs) issues.push({ key: 'return', pts: 8, text: 'richiama la mano più veloce' });
  // rotazione: misurata solo per i calci (per i pugni la stima 3D del telefono non è affidabile)
  if (g.rotation != null && exp.side === 'rear' && ['straight', 'hook', 'uppercut', 'kick'].includes(exp.kind) && (g.rotRef != null ? g.rotation < Math.max(3, g.rotRef * 0.55) : g.rotation < THRESH.rotateDeg)) issues.push({ key: 'rotate', pts: 10, text: 'ruota di più anca e spalla' });
  if (exp.kind === 'hook' && g.peakElbowGap > 0.3) issues.push({ key: 'elbow', pts: 8, text: 'gomito all’altezza del pugno' });
  if (['kick', 'teep', 'knee'].includes(exp.kind) && g.bothGuard < 0.5) issues.push({ key: 'kickGuard', pts: 8, text: 'mani alte anche mentre calci' });
  if (g.lean > 35) issues.push({ key: 'lean', pts: 8, text: 'non sbilanciarti in avanti' });
  return issues;
}

export function judgeSequence(moveIds, gestures) {
  const expected = moveIds.map((id) => ({ id, ...(EXPECT[id] || { kind: 'guided' }) }));
  // nel clinch le braccia escono insieme: non sono due pugni in più
  const clinches = gestures.filter((g) => g.kind === 'clinch');
  const armKinds = ['straight', 'hook', 'uppercut', 'elbow', 'parry', 'feint', 'unclear', 'drop', 'strike'];
  const inClinch = (g) => clinches.some((c) => g.start < c.end + 150 && g.end > c.start - 150);
  // si cercano solo gli arti della combo: in una 1-2 un piede che si sposta non è un "calcio in più"
  const kinds = new Set(expected.map((e) => e.kind));
  const wantLegs = ['kick', 'teep', 'knee', 'check'].some((k) => kinds.has(k));
  const wantClinch = kinds.has('clinch') || kinds.has('knee');
  const wantBody = ['slip', 'roll', 'level'].some((k) => kinds.has(k));
  const relevant = (g) => (g.limb === 'leg' ? wantLegs : g.kind === 'clinch' ? wantClinch : ['slip', 'roll', 'level'].includes(g.kind) ? wantBody : true);
  // un piccolo spostamento del braccio dentro una schivata/rotolamento fa parte del movimento del corpo
  // (solo nelle combo con schivate: tirando, la testa si sposta col colpo e sembrerebbe una schivata)
  const bodyMoves = wantBody ? gestures.filter((g) => ['slip', 'roll', 'level'].includes(g.kind)) : [];
  const inBodyMove = (g) => g.limb === 'arm' && (g.reach ?? 1) < 0.4 && bodyMoves.some((b) => g.start < b.end + 100 && g.end > b.start - 150);
  // la mano che SCENDE mentre l'altra tira un colpo più ampio è la guardia che si abbassa
  // (la correzione arriva dal colpo vero: "l'altra mano è scesa"), non un pugno in più
  const armGs = gestures.filter((g) => g.limb === 'arm' && g.peakVec);
  // (dritta verso il basso, quasi senza spostamento laterale: nessun pugno, nemmeno al corpo, fa così)
  const guardDrop = (g) => g.limb === 'arm' && g.peakVec && g.peakVec[1] > 0.85 * Math.hypot(...g.peakVec)
    && armGs.some((o) => o !== g && o.side !== g.side && o.reach >= 0.25 && g.start < o.end && g.end > o.start);
  const seen = gestures
    .filter(relevant)
    .filter((g) => !inBodyMove(g) && !guardDrop(g))
    .filter((g) => !(armKinds.includes(g.kind) && inClinch(g)))
    .filter((g) => g.kind !== 'drop' && (g.kind !== 'unclear' || g.dur > 120))
    .sort((a, b) => a.start - b.start);
  const n = expected.length, m = seen.length;
  // DP: costo = 100 - punteggio; saltare un atteso = 100, un gesto in più = 25
  const cost = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  const from = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  cost[0][0] = 0;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (cost[i][j] === Infinity) continue;
      if (i < n) {
        const guided = expected[i].kind === 'guided';
        const skip = cost[i][j] + (guided ? 0 : 100);
        if (skip < cost[i + 1][j]) { cost[i + 1][j] = skip; from[i + 1][j] = [i, j, 'miss']; }
      }
      if (j < m) {
        // un gesto non chiaro saltato non costa niente: non è un colpo in più
        const extra = cost[i][j] + (seen[j].kind === 'unclear' ? 0 : 25);
        if (extra < cost[i][j + 1]) { cost[i][j + 1] = extra; from[i][j + 1] = [i, j, 'extra']; }
      }
      if (i < n && j < m && expected[i].kind !== 'guided') {
        const s = matchScore(expected[i], seen[j]);
        if (s > 0) {
          const c = cost[i][j] + (100 - s);
          if (c < cost[i + 1][j + 1]) { cost[i + 1][j + 1] = c; from[i + 1][j + 1] = [i, j, 'match']; }
        }
      }
    }
  }
  // ricostruzione
  const steps = []; let i = n, j = m;
  while (i > 0 || j > 0) { const f = from[i][j]; if (!f) break; steps.unshift({ op: f[2], i: f[0], j: f[1] }); i = f[0]; j = f[1]; }
  const moves = expected.map((exp) => ({ id: exp.id, expected: exp, gesture: null, score: 0, issues: [], status: exp.kind === 'guided' ? 'guided' : 'missing' }));
  let extras = 0;
  for (const s of steps) {
    if (s.op === 'extra' && seen[s.j].kind !== 'unclear') extras += 1;
    if (s.op === 'match') {
      const mv = moves[s.i], g = seen[s.j];
      const base = matchScore(mv.expected, g);
      const issues = qualityIssues(mv.id, mv.expected, g);
      if (mv.expected.side && g.side !== mv.expected.side) issues.unshift({ key: 'side', pts: 0, text: `hai usato il braccio/gamba ${g.side === 'lead' ? 'avanti' : 'dietro'}` });
      if (mv.expected.level && g.level && g.level !== mv.expected.level) issues.unshift({ key: 'level', pts: 0, text: mv.expected.level === 'body' ? 'era al corpo: scendi con le gambe' : mv.expected.level === 'low' ? 'era basso: colpisci la coscia' : 'più alto' });
      if (base < 70 && g.kind === 'unclear') issues.unshift({ key: 'kind', pts: 0, text: 'colpo poco chiaro: più deciso e completo' });
      else if (base < 70 && g.kind !== mv.expected.kind) issues.unshift({ key: 'kind', pts: 0, text: `sembrava un ${describeGesture(g)}` });
      const quality = 30 - issues.reduce((sum, it) => sum + it.pts, 0);
      Object.assign(mv, { gesture: g, score: Math.max(0, Math.min(100, base + Math.max(0, quality))), issues, status: base >= 70 ? 'ok' : 'partial' });
    }
  }
  // ritmo: pause lunghe tra i colpi
  const matched = moves.filter((mv) => mv.gesture);
  const gaps = matched.slice(1).map((mv, k) => mv.gesture.start - matched[k].gesture.end);
  const slow = gaps.filter((gap) => gap > 700).length;
  const scored = moves.filter((mv) => mv.status !== 'guided');
  const avg = scored.length ? scored.reduce((s, mv) => s + mv.score, 0) / scored.length : 100;
  const total = Math.max(0, Math.round(avg - extras * 8 - slow * 5));
  // "Perfetta" solo senza errori importanti: guardia, rotazione, colpo sbagliato o mancante
  const major = scored.some((mv) => mv.status !== 'ok' || mv.issues.some((it) => it.pts >= 10 || ['side', 'level', 'kind'].includes(it.key)));
  const grade = total >= 85 && !major ? 'perfect' : total >= 65 ? 'good' : 'redo';
  return { total, grade, moves, extras, slowGaps: slow, durationMs: matched.length ? matched[matched.length - 1].gesture.end - matched[0].gesture.start : 0 };
}

// Frase del coach per la voce: prima cosa va bene, poi al massimo due correzioni.
export function coachFeedback(result, moveNames) {
  const missing = result.moves.filter((mv) => mv.status === 'missing');
  const issues = result.moves.flatMap((mv, i) => mv.issues.map((it) => ({ ...it, name: moveNames[i] })));
  if (result.grade === 'perfect' && !issues.length) return 'Perfetta. Pulita, veloce, guardia sempre su.';
  const parts = [];
  parts.push(result.grade === 'perfect' ? 'Ottima.' : result.grade === 'good' ? 'Buona.' : 'Riproviamo.');
  if (missing.length) parts.push(`Mi è mancato ${missing.map((mv) => moveNames[result.moves.indexOf(mv)]).slice(0, 2).join(' e ')}.`);
  const seenKeys = new Set();
  for (const it of issues) {
    if (seenKeys.has(it.key) || parts.length >= 3) continue;
    seenKeys.add(it.key);
    parts.push(`${it.name}: ${it.text}.`);
  }
  if (result.extras > 0 && parts.length < 3) parts.push('Hai aggiunto colpi in più: resta sulla combo.');
  if (result.slowGaps > 0 && parts.length < 3) parts.push('Collega i colpi senza pause.');
  return parts.join(' ');
}

// ── Colpo singolo (allenamento libero): quale tecnica era e cosa correggere ──
export function identifyMove(g) {
  if (!g) return null;
  const lead = g.side === 'lead';
  switch (g.kind) {
    case 'strike': return lead ? 'jab' : 'cross'; // tipo non deciso: il colpo base di quel braccio
    case 'straight': return g.level === 'body' ? (lead ? 'jab' : 'bodyCross') : lead ? 'jab' : 'cross';
    case 'hook': return g.level === 'body' ? (lead ? 'bodyHook' : 'rearHook') : lead ? 'hook' : 'rearHook';
    case 'uppercut': return lead ? 'uppercut' : 'rearUppercut';
    case 'elbow': return lead ? 'leadElbow' : 'rearElbow';
    case 'knee': return 'rearKnee';
    case 'teep': return 'teep';
    case 'kick': return lead ? 'switchKick' : g.level === 'head' ? 'headKick' : g.level === 'body' ? 'bodyKick' : 'lowKick';
    case 'check': return 'check';
    case 'slip': return 'slip';
    case 'roll': return 'roll';
    case 'parry': return 'parry';
    case 'feint': return 'feint';
    case 'level': return 'levelChange';
    case 'clinch': return 'clinch';
    default: return null;
  }
}

export function rateGesture(g) {
  // la mano che scende dritta (nessun pugno va giù in verticale pura) non è un colpo da contare
  if (g?.limb === 'arm' && (g.kind === 'drop' || (g.peakVec && g.peakVec[1] > 0.75 * Math.hypot(...g.peakVec)))) return null;
  // gomitata "da regole" (senza i tuoi esempi): incerta, conta come il colpo base di quel braccio
  if (g?.limb === 'arm' && g.kind === 'elbow' && !g.move) g = { ...g, kind: 'strike' };
  const id = identifyMove(g);
  if (!id) return null;
  const issues = qualityIssues(id, EXPECT[id], g);
  return { id, issues, score: Math.max(0, 100 - issues.reduce((s, it) => s + it.pts * 2, 0)) };
}

// ── Insegnamento: un gesto fatto su richiesta diventa un tuo esempio ──
export const limbOf = (moveId) => (['kick', 'teep', 'knee', 'check'].includes(EXPECT[moveId]?.kind) ? 'leg' : 'arm');
export const roleOf = (moveId) => EXPECT[moveId]?.side || 'lead';
// Il colpo giusto per l'esempio: braccio giusto, traiettoria dal motore 2D
export function teachSample(moveId, g) {
  if (!g || g.limb !== 'arm' || limbOf(moveId) !== 'arm' || g.side !== roleOf(moveId) || !Array.isArray(g.path) || g.path.length < 4) return null;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return { move: moveId, arm: g.side, path: g.path.map(([x, y]) => [r3(x), r3(y)]), reach: r3(g.reach), dur: Math.round(g.dur || 0) };
}

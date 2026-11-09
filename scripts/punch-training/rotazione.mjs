// Banco di prova della ROTAZIONE dei colpi (09/11/2026, «ROTAZIONE la migliore che puoi fornirmi»).
// Il coach legge la rotazione dalle spalle in 2D (lib/mmaMetrics.js); sulle clip vere i diretti
// uscivano 1, 11 e 62 gradi. Qui ogni misura candidata si prova sui video BoxingVI letti da MediaPipe
// Lite, con gli stessi fotogrammi, lo stesso filtro e lo stesso motore del telefono: la misura riceve
// esattamente la sequenza che riceve punchMetrics (ricostruita e controllata). Si contano solo i
// pugni etichettati trovati col braccio giusto. Per ogni atleta:
//   presa   colpi in cui la misura c'è
//   x/j     AUC diretto dietro contro jab: il diretto ruota di più (0,5 = a caso, 1 = sempre)
//   d/a     AUC tutti i colpi dietro contro tutti quelli avanti
//   accordo Spearman fra Lite e AlphaPose sullo stesso pugno (stessa finestra dell'etichetta):
//           due stimatori di posa diversi devono mettere i colpi nello stesso ordine
//   disp    dispersione sui diretti della stessa persona (scarto interquartile / mediana)
// Regola: si sceglie su B, D, F e si verifica su C, E, G (mai usati per scegliere).
// Uso: node scripts/punch-training/rotazione.mjs [--tutti]   (--tutti = una riga per atleta)
import { createStrikeEngine, unflip, STRIKE } from '../../lib/mmaStrikes.js';
import { punchMetrics } from '../../lib/mmaMetrics.js';
import { createPoseFilter, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';
import { available, hasStream, loadStream, apFrames, PRIV } from './dati.mjs';
import { phoneFrames, match, calibStart } from './banco.mjs';
import { pathToFileURL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { decode, clipsAvailable } from './clip-vere.mjs';
import { dedupe } from './allenamenti-veri.mjs';

export const TUNE = ['B', 'D', 'F'], CHECK = ['C', 'E', 'G'];
const J = { L: { sh: 11, hip: 23, knee: 25, ank: 27, wr: 15 }, R: { sh: 12, hip: 24, knee: 26, ank: 28, wr: 16 } };
const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= 0.3;
const torso = (p, a) => ([11, 12, 23, 24].every((i) => ok(p[i])) ? Math.hypot(((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * a, (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2) : null);
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const q = (a, f) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };

// ── I colpi di un video come li vede il telefono, con la sequenza esatta data a punchMetrics ──
export function collect(stream, frames = phoneFrames(stream, 'subito')) {
  const imgF = createPoseFilter(IMAGE_FILTER), wF = createPoseFilter(WORLD_FILTER);
  const eng = createStrikeEngine({ stance: stream.stance });
  let i = calibStart(frames, stream.labels[0]?.t0 ?? Infinity);
  for (; i < frames.length && !eng.isCalibrated(); i += 1) if (frames[i].points) eng.calibrate(imgF.apply(frames[i].points, frames[i].t), stream.aspect);
  const log = [], evs = [];
  let T = eng.base()?.T, lastT = null;
  for (; i < frames.length; i += 1) {
    const fr = frames[i];
    if (!fr.points) { imgF.reset(); wF.reset(); continue; }
    const raw = fr.points, p = unflip(imgF.apply(raw, fr.t), null, eng.order()).points, w = wF.apply(fr.world, fr.t);
    const Tprev = T;
    // la scala segue il busto come nel motore (mmaStrikes.push)
    const Tf = torso(p, stream.aspect), dt = lastT == null ? 0 : fr.t - lastT;
    if (Tf) T = T + (Math.max(T * 0.7, Math.min(T * 1.4, Tf)) - T) * Math.min(1, Math.max(0, dt) / 2000);
    lastT = fr.t;
    const r = eng.push(p, fr.t, stream.aspect);
    log.push({ t: fr.t, p, raw, w, disp: r.disp, T, gap: dt > STRIKE.gapMs });
    for (const ev of r.done) evs.push({ ev, at: log.length - 1, T: ev.reason === 'gap' ? Tprev : T });
  }
  // un 1-1 spezzato (reason 'again'): il secondo colpo parte dal punto più vicino alla guardia, senza fotogrammi prima
  const split = (e) => evs.some((o) => o.ev.S === e.ev.S && o.ev.reason === 'again' && o.ev.end === e.ev.start);
  return { log, evs: evs.map((e) => ({ ...e, seq: seqOf(log, e, split(e)) })) };
}

// fotogrammi del colpo: dall'ultimo in guardia prima della partenza a quello che lo chiude (come mmaStrikes)
function seqOf(log, { ev, at }, split) {
  const s = log.findIndex((f) => f.t === ev.start);
  let a = s;
  for (let k = s - 1; !split && k >= Math.max(0, s - STRIKE.keepFrames) && !log[k + 1].gap; k -= 1) { a = k; if (log[k].disp[ev.S] < STRIKE.off) break; }
  const endT = ev.reason === 'gap' ? log[at - 1].t : ev.reason === 'again' ? ev.end : log[at].t;
  const seq = [];
  for (let k = a; k < log.length && log[k].t <= endT && seq.length < Math.max(STRIKE.maxFrames, s - a + 1); k += 1) seq.push(log[k]);
  return { seq, pre: log.slice(Math.max(0, a - 8), a) };
}

// ── Misure candidate: (ctx) → numero o null. ctx = { seq, S, leadS, aspect, T, peakT, pre } ──
const peakIdx = (seq, peakT) => { const i = seq.findIndex((f) => f.t >= peakT); return i < 0 ? seq.length - 1 : i; };
const sideRear = (leadS) => (leadS === 'L' ? 'R' : 'L');
const X = (f, i, c) => f.p[i].x * c.aspect / c.T;
// segnali per fotogramma, in busti, nel verso d del bersaglio: quanto il lato dietro è più avanti del lato avanti
const SIG = {
  sh: (f, c, d) => { const L = J[c.leadS].sh, R = J[sideRear(c.leadS)].sh; return ok(f.p[L]) && ok(f.p[R]) ? (X(f, R, c) - X(f, L, c)) * d : null; },
  hip: (f, c, d) => { const L = J[c.leadS].hip, R = J[sideRear(c.leadS)].hip; return ok(f.p[L]) && ok(f.p[R]) ? (X(f, R, c) - X(f, L, c)) * d : null; },
  // separazione anca-spalla: la spalla dietro che va oltre l'anca dietro
  sep: (f, c, d) => { const s = SIG.sh(f, c, d), h = SIG.hip(f, c, d); return s != null && h != null ? s - h : null; },
  // perno del piede dietro visto dallo stinco: il ginocchio dietro va avanti sopra la punta (i talloni 29-32 non ci sono nei dati)
  shin: (f, c, d) => { const R = J[sideRear(c.leadS)]; return ok(f.p[R.knee]) && ok(f.p[R.ank]) ? (X(f, R.knee, c) - X(f, R.ank, c)) * d : null; },
};
const guardW = (c) => { const f = c.seq[0].p, L = J[c.leadS].sh, R = J[sideRear(c.leadS)].sh; return ok(f[L]) && ok(f[R]) ? Math.abs(f[R].x - f[L].x) * c.aspect / c.T : Infinity; };
const upTo = (c, extra = 2) => c.seq.slice(0, Math.min(c.seq.length, peakIdx(c.seq, c.peakT) + 1 + extra));
const deg = (x) => Math.asin(Math.max(-1, Math.min(1, x / 0.85))) * 180 / Math.PI;
// inclinazione della linea fra le caviglie: di lato i piedi sono alla stessa profondità, quindi alla stessa altezza
// nell'immagine; di fronte il piede dietro è più lontano e sta più in alto (NaN = caviglie non visibili)
export const feetAngle = (c) => { const L = J[c.leadS].ank, R = J[sideRear(c.leadS)].ank; return med(c.seq.filter((f) => ok(f.p[L]) && ok(f.p[R])).map((f) => Math.atan2(Math.abs(f.p[L].y - f.p[R].y), Math.abs(f.p[L].x - f.p[R].x) * c.aspect) * 180 / Math.PI)); };
// scelta su B, D, F: il controllo più severo che tiene almeno il 90% dei colpi misurati dalla base (tutti video di lato)
export const ANGLE_MAX = 20;

// verso del bersaglio: dal pugno (come la base), dai piedi (il piede avanti) o dalla guardia (la mano avanti)
function dirOf(c, dir, dx) {
  if (dir === 'wrist') return Math.sign(dx);
  const [a, b] = dir === 'feet' ? ['ank', 'ank'] : ['wr', 'wr'];
  const L = J[c.leadS][a], R = J[sideRear(c.leadS)][b];
  const v = med((dir === 'feet' ? c.seq : c.seq.slice(0, 1)).filter((f) => ok(f.p[L]) && ok(f.p[R])).map((f) => X(f, L, c) - X(f, R, c)));
  return Math.abs(v) >= (dir === 'feet' ? 0.2 : 0.1) ? Math.sign(v) : 0;
}
// controlli della vista e del verso; 0 = la rotazione non si legge
//   view  "di lato" da: spalle strette ('shoulders', la base), spalle strette E piedi in piano ('both')
export function gate(c, { view = 'both', travel = 0.25, dir = 'wrist', angleMax = ANGLE_MAX } = {}) {
  if (!(guardW(c) < 0.72)) return 0;
  if (view === 'both' && !(feetAngle(c) <= angleMax)) return 0;
  const pk = c.seq[peakIdx(c.seq, c.peakT)].p[J[c.S].wr], w0 = c.seq[0].p[J[c.S].wr];
  const dx = (pk.x - w0.x) * c.aspect / c.T;
  return Math.abs(dx) < travel ? 0 : dirOf(c, dir, dx);
}

// escursione di un segnale (le spalle in gradi come la base, gli altri in busti)
//   start partenza: primo fotogramma ('first', la base), minimo prima del massimo ('min'), guardia prima ('pre')
//   peak  arrivo: massimo ('max', la base), secondo valore più alto ('top2')
export function rot(c, { part = 'sh', start = 'first', peak = 'max', ...g } = {}) {
  const d = gate(c, g);
  if (!d) return null;
  const val = (f) => { const x = SIG[part](f, c, d); return x == null ? null : part === 'sh' ? deg(x) : x; };
  const v = upTo(c).map(val).filter((x) => x != null);
  if (v.length < 2) return null;
  const top = peak === 'top2' && v.length >= 3 ? [...v].sort((x, y) => y - x)[1] : Math.max(...v);
  const pre = (c.pre || []).slice(-3).map(val).filter((x) => x != null);
  const s0 = start === 'min' ? Math.min(...v.slice(0, v.indexOf(Math.max(...v)) + 1)) : start === 'pre' && pre.length ? med([...pre, v[0]]) : v[0];
  return Math.round((top - s0) * 10) / 10;
}

// 3D di MediaPipe (coordinate world): di quanti gradi gira la linea spalle (o anche) dalla partenza
function yaw3(c, part) {
  const L = J[c.leadS][part], R = J[sideRear(c.leadS)][part];
  const v = upTo(c).filter((f) => f.w).map((f) => Math.atan2(f.w[R].z - f.w[L].z, f.w[R].x - f.w[L].x) * 180 / Math.PI);
  return v.length >= 2 ? Math.max(...v.map((x) => Math.abs(((x - v[0] + 540) % 360) - 180))) : null;
}

// ── Catena: quando parte l'anca, quando la spalla, quando il pugno (ms, non dipendono dall'angolo della camera) ──
// tempo in cui il segnale fa la frazione `share` della sua escursione (interpolato fra fotogrammi)
function crossT(frames, val, share, minExc) {
  const v = frames.map((f) => ({ t: f.t, x: val(f) })).filter((x) => x.x != null);
  if (v.length < 3) return null;
  const exc = Math.max(...v.map((x) => x.x)) - v[0].x;
  if (!(exc >= minExc)) return null;
  const th = v[0].x + share * exc;
  for (let k = 1; k < v.length; k += 1) if (v[k].x >= th) return v[k - 1].t + (v[k].t - v[k - 1].t) * ((th - v[k - 1].x) / ((v[k].x - v[k - 1].x) || 1));
  return null;
}
// ms fra il segnale a e il segnale b ('wr' = il pugno che si allontana): + = a parte prima di b
export function chain(c, a, b, { share = 0.5, minExc = 0.06, pre = false, raw = false } = {}) {
  const d = gate(c);
  if (!d) return null;
  const P = (f) => (raw ? { ...f, p: f.raw } : f);
  const fr = [...(pre ? c.pre || [] : []), ...upTo(c, 1)].map(P);
  const w0 = P(c.seq[0]).p[J[c.S].wr];
  const val = (s) => (s === 'wr' ? (f) => (ok(f.p[J[c.S].wr]) ? Math.hypot((f.p[J[c.S].wr].x - w0.x) * c.aspect, f.p[J[c.S].wr].y - w0.y) / c.T : null) : (f) => SIG[s](f, c, d));
  const ta = crossT(fr, val(a), share, a === 'wr' ? 0.2 : minExc), tb = crossT(fr, val(b), share, b === 'wr' ? 0.2 : minExc);
  return ta != null && tb != null ? Math.round(tb - ta) : null;
}

export const CANDIDATES = {
  // la formula dell'app fino al 09/11/2026 (spalle strette = di lato), rifatta qui identica
  prima: { f: (c) => rot(c, { view: 'shoulders' }) },
  // quello che fa l'app adesso (lib/mmaMetrics.js)
  app: { f: (c) => punchMetrics(c.seq, c.S, c.aspect, { T: c.T, leadS: c.leadS, peakT: c.peakT })?.rotation ?? null },
  // le spalle con il controllo dei piedi: di fronte o in diagonale niente gradi
  spallePiedi: { f: (c) => rot(c) },
  spallePiediTop2: { f: (c) => rot(c, { peak: 'top2' }) },
  spallePiediMin: { f: (c) => rot(c, { start: 'min' }) },
  anche: { f: (c) => rot(c, { part: 'hip' }) },
  separazione: { f: (c) => rot(c, { part: 'sep' }) },
  stinco: { f: (c) => rot(c, { part: 'shin' }) },
  spalle3d: { f: (c) => yaw3(c, 'sh'), noAP: true },
  anche3d: { f: (c) => yaw3(c, 'hip'), noAP: true },
  catenaAncaSpalla: { f: (c) => chain(c, 'hip', 'sh'), time: true },
  catenaAncaSpalla20: { f: (c) => chain(c, 'hip', 'sh', { share: 0.2, pre: true }), time: true },
  catenaSpallaPugno: { f: (c) => chain(c, 'sh', 'wr'), time: true },
  catenaAncaPugno: { f: (c) => chain(c, 'hip', 'wr'), time: true },
  catenaAncaPugno20: { f: (c) => chain(c, 'hip', 'wr', { share: 0.2, pre: true }), time: true },
  catenaAncaPugnoGrezzo: { f: (c) => chain(c, 'hip', 'wr', { pre: true, raw: true }), time: true, noAP: true },
};

// ── Punteggi ──
export function auc(pos, neg) {
  const a = pos.filter(Number.isFinite), b = neg.filter(Number.isFinite);
  if (a.length < 5 || b.length < 5) return NaN;
  let s = 0;
  for (const x of a) for (const y of b) s += x > y ? 1 : x === y ? 0.5 : 0;
  return s / (a.length * b.length);
}
const ranks = (a) => { const idx = a.map((x, i) => [x, i]).sort((p, r) => p[0] - r[0]); const r = []; idx.forEach(([, i], k) => { r[i] = k; }); return r; };
export function spearman(a, b) {
  const keep = a.map((x, i) => [x, b[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (keep.length < 8) return NaN;
  const ra = ranks(keep.map((k) => k[0])), rb = ranks(keep.map((k) => k[1])), n = keep.length, m = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i += 1) { num += (ra[i] - m) * (rb[i] - m); da += (ra[i] - m) ** 2; db += (rb[i] - m) ** 2; }
  return num / Math.sqrt(da * db);
}

const REAR = new Set(['cross', 'rearHook', 'rearUppercut']);
export function scoreOf(rows, name) {
  const v = (r) => r.vals[name], has = rows.filter((r) => Number.isFinite(v(r)));
  const by = (m) => has.filter((r) => r.move === m).map(v);
  const crosses = by('cross');
  return {
    n: rows.length, cov: has.length / (rows.length || 1),
    xj: auc(crosses, by('jab')),
    rl: auc(has.filter((r) => REAR.has(r.move)).map(v), has.filter((r) => !REAR.has(r.move)).map(v)),
    agree: spearman(rows.map((r) => r.lite[name]), rows.map((r) => r.ap[name])),
    disp: crosses.length >= 5 ? (q(crosses, 0.75) - q(crosses, 0.25)) / Math.abs(med(crosses) || 1) : NaN,
    median: { cross: med(crosses), jab: med(by('jab')) },
  };
}

// misura su una finestra fissa (l'etichetta), per confrontare Lite e AlphaPose sullo stesso pugno
function windowCtx(frames, S, leadS, aspect) {
  if (frames.length < 3) return null;
  const T = med(frames.map((f) => torso(f.p, aspect)));
  const w0 = frames[0].p[J[S].wr];
  let pk = frames[0];
  for (const f of frames) if (ok(f.p[J[S].wr]) && Math.hypot(f.p[J[S].wr].x - w0.x, f.p[J[S].wr].y - w0.y) > Math.hypot(pk.p[J[S].wr].x - w0.x, pk.p[J[S].wr].y - w0.y)) pk = f;
  return Number.isFinite(T) ? { seq: frames, S, leadS, aspect, T, peakT: pk.t, pre: [] } : null;
}

export function rowsOf(stream, cands = CANDIDATES, frames) {
  const { log, evs } = collect(stream, frames);
  const leadS = stream.stance === 'southpaw' ? 'R' : 'L';
  const gs = evs.map((e) => ({ ...e, side: e.ev.arm, peakT: e.ev.peakT }));
  const { pairs } = match(stream.labels, gs);
  let same = 0;
  const rows = [];
  for (const { l, g } of pairs) {
    if (!g || g.side !== l.arm) continue;
    const c = { seq: g.seq.seq, pre: g.seq.pre, S: g.ev.S, leadS, aspect: stream.aspect, T: g.T, peakT: g.ev.peakT };
    // controllo della ricostruzione: punchMetrics sulla sequenza rifatta dà le stesse misure del motore
    const m = punchMetrics(c.seq, c.S, c.aspect, { T: c.T, leadS, peakT: c.peakT });
    if (m?.speed === g.ev.metrics?.speed && m?.impactMs === g.ev.metrics?.impactMs && m?.rotation === g.ev.metrics?.rotation) same += 1;
    const S = l.arm === 'lead' ? leadS : sideRear(leadS);
    const lite = windowCtx(log.filter((f) => f.t >= l.t0 && f.t <= l.t1), S, leadS, stream.aspect);
    const ap = windowCtx(apFrames(l, stream.j, stream.fpsSrc).map((f) => ({ t: f.t, p: f.points })), S, leadS, stream.aspect);
    const vals = {}, liteV = {}, apV = {};
    for (const [name, cand] of Object.entries(cands)) {
      vals[name] = cand.f(c);
      if (!cand.noAP) { liteV[name] = lite ? cand.f(lite) : null; apV[name] = ap ? cand.f(ap) : null; }
    }
    rows.push({ athlete: stream.athlete, v: stream.v, move: l.move, vals, lite: liteV, ap: apV });
  }
  return { rows, same, n: rows.length };
}

const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '  – ');
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : NaN; };
export function report(all, names = Object.keys(CANDIDATES), { perAthlete = false } = {}) {
  const ath = [...new Set(all.map((r) => r.athlete))].sort();
  const per = (name) => Object.fromEntries(ath.map((a) => [a, scoreOf(all.filter((r) => r.athlete === a), name)]));
  const group = (s, set) => ({ cov: mean(set.map((a) => s[a]?.cov)), xj: mean(set.map((a) => s[a]?.xj)), rl: mean(set.map((a) => s[a]?.rl)), agree: mean(set.map((a) => s[a]?.agree)), disp: mean(set.map((a) => s[a]?.disp)), minXj: Math.min(...set.map((a) => s[a]?.xj).filter(Number.isFinite)) });
  console.log('misura                    | TARATURA B,D,F: presa  x/j  (min)  d/a  accordo  disp | VERIFICA C,E,G: presa  x/j  (min)  d/a  accordo  disp');
  for (const name of names) {
    const s = per(name), t = group(s, TUNE), v = group(s, CHECK);
    const fmt = (g) => `${f2(g.cov)} ${f2(g.xj)} (${f2(g.minXj)}) ${f2(g.rl)}   ${f2(g.agree)}  ${f2(g.disp)}`;
    console.log(`${name.padEnd(25)} |                ${fmt(t)} |                ${fmt(v)}`);
    if (perAthlete) for (const a of ath) { const x = s[a]; console.log(`   ${a} n=${String(x.n).padStart(4)} presa ${f2(x.cov)} x/j ${f2(x.xj)} d/a ${f2(x.rl)} accordo ${f2(x.agree)} disp ${f2(x.disp)}  mediana diretto ${f2(x.median.cross)} jab ${f2(x.median.jab)}`); }
  }
}

// ── Le clip vere di Emanuele (iPhone DAVANTI): la rotazione non si legge, i gradi dovrebbero mancare ──
function frontClips() {
  const files = readdirSync(PRIV).filter((f) => /^mma-train-.*\.json$/.test(f));
  const items = files.flatMap((f) => { const d = JSON.parse(readFileSync(new URL(f, PRIV), 'utf8')); return Array.isArray(d) ? d : d.items || []; });
  const clips = [...dedupe(items), ...(clipsAvailable() ? JSON.parse(readFileSync(new URL('mma-clips-emanuele.json', PRIV))).Emanuele || [] : [])];
  const out = [];
  for (const c of clips) {
    const frames = decode(c).map((f) => ({ t: f.t, points: f.points, world: f.world }));
    const st = { frames, labels: [], stance: c.stance || 'orthodox', aspect: c.aspect || 0.75 };
    const leadS = st.stance === 'southpaw' ? 'R' : 'L';
    for (const e of collect(st, frames).evs) if (e.ev.arm === 'rear') out.push({ seq: e.seq.seq, pre: e.seq.pre, S: e.ev.S, leadS, aspect: st.aspect, T: e.T, peakT: e.ev.peakT });
  }
  return out;
}

// ── Il consiglio «ruota di più»: soglia fissa (THRESH.rotateDeg) contro quella personale (rotRef: % dei tuoi primi 5 colpi dietro) ──
// falsi = colpi dietro (dopo i primi 5) segnalati; colti = jab e colpi avanti segnalati (come un diretto tirato solo col braccio)
function verdict(all, name, rule) {
  return [...TUNE, ...CHECK].map((a) => {
    const rows = all.filter((r) => r.athlete === a && Number.isFinite(r.vals[name]));
    const rear = rows.filter((r) => REAR.has(r.move)), lead = rows.filter((r) => !REAR.has(r.move));
    if (rear.length < 10 || lead.length < 5) return `${a} –`;
    const thr = rule(med(rear.slice(0, 5).map((r) => r.vals[name])));
    const share = (xs) => Math.round(xs.filter((r) => r.vals[name] < thr).length / xs.length * 100);
    return `${a} ${Math.round(thr)}°: falsi ${share(rear.slice(5))}% colti ${share(lead)}%`;
  }).join(' · ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!available()) { console.log('Mancano i dati privati (vedi README).'); process.exit(0); }
  const all = [];
  for (const v of [2, 3, 4, 5, 7, 9]) {
    if (!hasStream(v)) continue;
    const r = rowsOf(loadStream(v));
    console.log(`V${v}: ${r.n} pugni col braccio giusto, sequenza rifatta uguale a quella del motore in ${r.same}`);
    all.push(...r.rows);
  }
  report(all, undefined, { perAthlete: process.argv.includes('--tutti') });
  const front = frontClips();
  for (const name of ['prima', 'app', 'spallePiedi']) {
    const v = front.map((c) => CANDIDATES[name].f(c)).filter((x) => x != null);
    console.log(`di fronte (clip di Emanuele) ${name}: gradi su ${v.length} colpi dietro di ${front.length}: ${v.map(Math.round).join(', ') || '—'}`);
  }
  for (const name of ['prima', 'spallePiedi']) {
    console.log(`consiglio con ${name}, soglia fissa 12°:   ${verdict(all, name, () => 12)}`);
    console.log(`consiglio con ${name}, personale 55%:      ${verdict(all, name, (ref) => Math.max(3, ref * 0.55))}`);
  }
}

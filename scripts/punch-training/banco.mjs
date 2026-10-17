// Banco di prova dei colpi: fa "vedere" al coach i video BoxingVI come li vedrebbe il telefono
// (MediaPipe Lite a 25 fps, stesso filtro dell'app, stesso giudice) e conta, per ogni atleta:
//   visti      pugni etichettati trovati dal coach
//   braccio    trovati col braccio giusto (avanti / dietro)
//   tipo       trovati con braccio E tipo giusti (diretto, gancio, montante)
//   inventati  colpi trovati dove non c'è nessun pugno, al minuto (solo mentre l'atleta lavora)
//   ritardo    da quando il pugno finisce (etichetta) a quando il coach lo dice
//   combo ok   pugni che, chiesti da soli in una combo, il giudice segna "ok" (voto da 70 in su)
// Uso: node scripts/punch-training/banco.mjs [k esempi per tipo, default 3] [catena: subito | tutti]
//   subito = la catena del telefono dal 17/10 (~25 risultati al secondo, tempo vero del fotogramma)
//   tutti  = tutti i fotogrammi estratti (25 fps regolari, o quelli del video se meno)
// Con BOXINGVI_PESI=<cartella> il motore nuovo usa, per ogni atleta, il modellino addestrato SENZA
// di lui (pesi-<atleta>.json, da esporta.py --senza): così la prova resta onesta.
import { createComboJudge, identifyMove, judgeSequence, teachSample } from '../../lib/mmaComboJudge.js';
import { schedule } from '../pose-training/misura.mjs';
import { buildModel, classify } from '../../lib/mmaTemplates.js';
import { createPoseFilter, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { available, hasStream, loadStream, PARTIAL_LABELS, MOVE_OF } from './dati.mjs';

const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// Calibrazione: 12 fotogrammi di fila, prima del primo pugno, con i polsi più fermi
function calibStart(frames, t0) {
  let best = -1, bestMove = Infinity;
  for (let i = 0; i + 12 < frames.length && frames[i].t < t0 - 200; i += 1) {
    if (frames[i].t < t0 - 6000) continue;
    const win = frames.slice(i, i + 12);
    if (!win.every((f) => f.points)) continue;
    let mv = 0;
    for (let k = 1; k < win.length; k += 1) for (const j of [15, 16]) mv += Math.hypot(win[k].points[j].x - win[k - 1].points[j].x, win[k].points[j].y - win[k - 1].points[j].y);
    if (mv < bestMove) { bestMove = mv; best = i; }
  }
  return Math.max(0, best);
}

// Il video passa nel giudice come nell'app: filtro dei punti, calibrazione, un fotogramma alla volta
export function play(stream, { frames = stream.frames, judgeOpts = {} } = {}) {
  const imgF = createPoseFilter(IMAGE_FILTER), wF = createPoseFilter(WORLD_FILTER);
  const judge = createComboJudge({ stance: stream.stance, ...judgeOpts });
  let i = calibStart(frames, stream.labels[0]?.t0 ?? Infinity);
  for (; i < frames.length && !judge.isCalibrated(); i += 1) {
    const fr = frames[i];
    if (!fr.points) continue;
    judge.calibrate(wF.apply(fr.world, fr.t), imgF.apply(fr.points, fr.t), stream.aspect);
  }
  const out = [];
  let count = 0;
  for (; i < frames.length; i += 1) {
    const fr = frames[i];
    // nessuna persona: nell'app al giudice non arriva niente e i filtri ripartono
    if (!fr.points) { imgF.reset(); wF.reset(); continue; }
    const info = judge.push(wF.apply(fr.world, fr.t), fr.t, imgF.apply(fr.points, fr.t), stream.aspect);
    if (info && info.gestures !== count) {
      const gs = judge.gestures();
      for (let k = count; k < gs.length; k += 1) if (gs[k].limb === 'arm') out.push({ ...gs[k], emitT: fr.t });
      count = gs.length;
    }
  }
  return out;
}

// Colpi che il coach conta davvero (come judgeSequence): niente mani che scendono
export function counted(gs) {
  return gs.filter((g) => g.kind !== 'drop' && !(g.peakVec && g.peakVec[1] > 0.85 * Math.hypot(...g.peakVec)
    && gs.some((o) => o !== g && o.side !== g.side && o.reach >= 0.25 && g.start < o.end && g.end > o.start)));
}

// Abbina colpi trovati ed etichette: il picco deve cadere dentro il pugno (±)
export function match(labels, gs) {
  const used = new Set(), pairs = [];
  for (const l of labels) {
    const c = gs.map((g, i) => ({ g, i })).filter(({ g, i }) => !used.has(i) && g.peakT >= l.t0 - 100 && g.peakT <= l.t1 + 200);
    const m = c.find(({ g }) => g.side === l.arm) || c[0];
    if (m) used.add(m.i);
    pairs.push({ l, g: m?.g || null });
  }
  const near = (t) => labels.some((l) => t >= l.t0 - 300 && t <= l.t1 + 400);
  // tempo "di lavoro": entro 3 s da un pugno etichettato (niente pause, spiegazioni, acqua)
  const work = [];
  for (const l of [...labels].sort((a, b) => a.t0 - b.t0)) {
    const a = l.t0 - 3000, b = l.t1 + 3000;
    if (work.length && a <= work.at(-1)[1]) work.at(-1)[1] = Math.max(work.at(-1)[1], b); else work.push([a, b]);
  }
  const inWork = (t) => work.some(([a, b]) => t >= a && t <= b);
  const extras = gs.filter((g, i) => !used.has(i) && !near(g.peakT) && inWork(g.peakT));
  const minutes = work.reduce((s, [a, b]) => s + b - a, 0) / 60000;
  return { pairs, extras, minutes };
}

// I fotogrammi che il telefono legge davvero (misura.mjs → schedule), col tempo vero del fotogramma
export function phoneFrames(stream, kind = 'subito') {
  if (kind === 'tutti') return stream.frames;
  return schedule(stream, kind).map(({ i, t }) => ({ ...stream.frames[i], t }));
}

// Tipo del colpo come lo dice l'app: i tuoi esempi (k per tipo, i primi che hai tirato) se
// riconoscono il colpo; altrimenti identifyMove (il modellino se è sicuro, o il colpo base del braccio)
export function typeOf(g, model) {
  if (!model) return identifyMove(g);
  const res = classify(model, g.side, { path: g.path, reach: g.reach, f: g.f });
  return res?.accepted && !res.ambiguous ? res.move : identifyMove(g);
}

export function teachFrom(pairs, k) {
  const items = [], taken = new Set();
  const per = {};
  for (const p of [...pairs].sort((a, b) => a.l.t0 - b.l.t0)) {
    if (!p.g || p.g.side !== p.l.arm) continue;
    if ((per[p.l.move] || 0) >= k) continue;
    const s = teachSample(p.l.move, p.g);
    if (!s) continue;
    per[p.l.move] = (per[p.l.move] || 0) + 1;
    items.push(s); taken.add(p);
  }
  return { items, taken };
}

export function score(results, { k = 3, typer = typeOf } = {}) {
  const r = { n: 0, seen: 0, arm: 0, type: 0, typeN: 0, extras: 0, minutes: 0, lat: [], ok: 0 };
  for (const { stream, gs } of results) {
    const g2 = counted(gs);
    const { pairs, extras, minutes } = match(stream.labels, g2);
    const teach = k ? teachFrom(pairs, k) : { items: [], taken: new Set() };
    const model = teach.items.length ? buildModel({ items: teach.items }) : null;
    for (const p of pairs) {
      r.n += 1;
      if (!p.g) continue;
      r.seen += 1;
      r.lat.push(p.g.emitT - p.l.t1);
      if (p.g.side === p.l.arm) r.arm += 1;
      if (judgeSequence([p.l.move], [p.g]).moves[0].status === 'ok') r.ok += 1;
      if (teach.taken.has(p)) continue;
      r.typeN += 1;
      if (p.g.side === p.l.arm && typer(p.g, model, stream) === p.l.move) r.type += 1;
    }
    if (!PARTIAL_LABELS.has(stream.v)) { r.extras += extras.length; r.minutes += minutes; }
  }
  return {
    n: r.n, seen: r.seen / r.n, arm: r.arm / r.n, type: r.typeN ? r.type / r.typeN : NaN,
    extra: r.minutes ? r.extras / r.minutes : NaN, lat: median(r.lat), minutes: r.minutes, ok: r.ok / r.n,
  };
}

export const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '–');
export function table(rows) {
  const head = 'atleta  pugni  visti  braccio  tipo   inventati/min  ritardo  combo ok';
  const line = (name, s) => `${name.padEnd(7)} ${String(s.n).padStart(5)}  ${pct(s.seen).padStart(5)}  ${pct(s.arm).padStart(7)}  ${pct(s.type).padStart(4)}   ${Number.isFinite(s.extra) ? s.extra.toFixed(1).padStart(8) : '       –'}       ${Math.round(s.lat)} ms   ${pct(s.ok).padStart(4)}`;
  return [head, ...rows.map(([n, s]) => line(n, s))].join('\n');
}

export function loadAll() {
  const out = [];
  for (let v = 1; v <= 10; v += 1) if (hasStream(v)) out.push(loadStream(v));
  return out;
}

// pesi del modellino addestrato senza quell'atleta (per la prova onesta); null = nessun file
export function heldOutNet(athlete, dir = process.env.BOXINGVI_PESI) {
  if (!dir) return undefined;
  const f = path.join(dir, `pesi-${athlete}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).kind : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!available()) { console.log('Mancano i dati privati (vedi README).'); process.exit(0); }
  const k = Number(process.argv[2] ?? 3), chain = process.argv[3] || 'subito';
  const streams = loadAll();
  const ath = [...new Set(streams.map((s) => s.athlete))];
  const run = (net) => streams.map((stream) => ({ stream, gs: play(stream, { frames: phoneFrames(stream, chain), judgeOpts: { punchNet: net(stream.athlete) } }) }));
  const report = (name, results) => {
    const rows = ath.map((a) => [a, score(results.filter((x) => x.stream.athlete === a), { k })]);
    rows.push(['tutti', score(results, { k })]);
    console.log(`${name}, ${k} esempi per tipo, catena ${chain} (${streams.map((s) => 'V' + s.v).join(' ')})`);
    console.log(table(rows));
  };
  report('motore attuale', run(() => null));
  if (process.env.BOXINGVI_PESI) report('motore nuovo (modellino senza l\'atleta provato)', run((a) => heldOutNet(a)));
}
export { MOVE_OF };

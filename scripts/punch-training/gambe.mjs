// Banco di prova delle GAMBE e dei "colpi in più" (21/10/2026).
// Perché: nella prova del 20/10 Emanuele ha votato 👎 tutte le 1-2: il coach vedeva calci,
// ginocchiate e schivate mai fatte (il piede dietro che ruota nel diretto) e non vedeva il calcio basso.
// Due prove, tutte e due fuori da git (il repo è pubblico):
//  1. Ripetizioni vere (tests/fixtures/private/mma-train-*.json): per ogni ripetizione i gesti che
//     il coach mostrerebbe, quelli in più e, nelle combo col calcio, se il calcio c'è (gamba giusta).
//  2. BoxingVI letto da Lite (pugilato: NESSUN calcio): ogni gesto di gamba è inventato → al minuto.
// Uso: node scripts/punch-training/gambe.mjs [--dettagli]
import { readdirSync, readFileSync } from 'node:fs';
import * as judgeLib from '../../lib/mmaComboJudge.js';
import { createPoseFilter, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';
import { decode } from './clip-vere.mjs';
import { dedupe } from './allenamenti-veri.mjs';
import { PRIV, available, hasStream, loadStream } from './dati.mjs';

const { createComboJudge, EXPECT, describeGesture } = judgeLib;
const LEG = ['kick', 'teep', 'knee', 'check'];
const BODY = ['slip', 'roll', 'level', 'clinch'];
const details = process.argv.includes('--dettagli');

// Come nell'app: calibrazione della serie (c.cal), poi la ripetizione un fotogramma alla volta
export function replay(c) {
  const fr = decode(c), aspect = c.aspect || 0.75;
  const j = createComboJudge({ stance: c.stance });
  if (c.cal?.w?.length) for (const f of decode({ j: c.cal.j || c.j, t: c.cal.w.map((_, i) => i * 33), w: c.cal.w, p: c.cal.p || [] })) j.calibrate(f.world, f.points, aspect);
  let i = 0;
  while (!j.isCalibrated() && i < fr.length) { j.calibrate(fr[i].world, fr[i].points, aspect); i += 1; }
  for (; i < fr.length; i += 1) j.push(fr[i].world, fr[i].t, fr[i].points, aspect);
  return j.gestures().filter((g) => g.start >= (c.go ?? 200) - 700);
}

const short = (g) => `${describeGesture(g)}@${Math.round(g.start)}`;

function realReps() {
  const files = readdirSync(PRIV).filter((f) => /^mma-train-.*\.json$/.test(f)).sort();
  if (!files.length) { console.log('Ripetizioni vere: nessun file mma-train-*.json'); return null; }
  const clips = dedupe(files.flatMap((f) => { const d = JSON.parse(readFileSync(new URL(f, PRIV), 'utf8')); return Array.isArray(d) ? d : d.items || []; }))
    .filter((c) => Array.isArray(c.w) && c.w.length && Array.isArray(c.expected));
  const tot = { reps: 0, extraLeg: 0, extraBody: 0, extraArm: 0, kicks: 0, kickFound: 0, kickSide: 0, kickLevel: 0, clean: 0 };
  for (const c of clips) {
    const gs = replay(c);
    const shown = judgeLib.visibleGestures ? judgeLib.visibleGestures(c.expected, gs) : gs.filter((g) => g.kind !== 'drop');
    const exp = c.expected.map((id) => ({ id, ...EXPECT[id] }));
    const wantLeg = exp.filter((e) => LEG.includes(e.kind));
    const legs = shown.filter((g) => g.limb === 'leg');
    const body = shown.filter((g) => BODY.includes(g.kind) && !exp.some((e) => e.kind === g.kind));
    const arms = shown.filter((g) => g.limb === 'arm');
    const wantArms = exp.filter((e) => ['straight', 'hook', 'uppercut', 'elbow'].includes(e.kind)).length;
    // gesti di gamba in più: tutti se la combo non ha gambe, altrimenti quelli oltre gli attesi
    const extraLeg = Math.max(0, legs.length - wantLeg.length);
    const extraArm = Math.max(0, arms.length - wantArms);
    tot.reps += 1; tot.extraLeg += extraLeg; tot.extraBody += body.length; tot.extraArm += extraArm;
    for (const e of wantLeg) {
      tot.kicks += 1;
      const g = legs.find((x) => x.kind === e.kind && x.side === e.side) || legs.find((x) => x.kind === e.kind) || legs[0];
      if (g?.kind === e.kind) tot.kickFound += 1;
      if (g?.kind === e.kind && g.side === e.side) tot.kickSide += 1;
      if (g?.kind === e.kind && g.side === e.side && (!e.level || g.level === e.level)) tot.kickLevel += 1;
    }
    if (!extraLeg && !body.length && !extraArm && legs.length === wantLeg.length) tot.clean += 1;
    if (details) console.log(`  #${c.n} ${c.name}: ${shown.map(short).join(' · ') || '—'}`);
  }
  return tot;
}

// BoxingVI: tutto il video, come lo vedrebbe il telefono. Minuti = da primo a ultimo pugno etichettato.
function boxing() {
  if (!available()) return null;
  const out = { min: 0, leg: 0, body: 0, per: [] };
  for (const v of [2, 3, 4, 5, 7, 9]) {
    if (!hasStream(v)) continue;
    const s = loadStream(v);
    const imgF = createPoseFilter(IMAGE_FILTER), wF = createPoseFilter(WORLD_FILTER);
    const j = createComboJudge({ stance: s.stance });
    const t0 = s.labels[0]?.t0 ?? 0, t1 = s.labels.at(-1)?.t1 ?? 0;
    let i = 0;
    for (; i < s.frames.length && !j.isCalibrated(); i += 1) if (s.frames[i].points && s.frames[i].t >= t0 - 3000) j.calibrate(wF.apply(s.frames[i].world, s.frames[i].t), imgF.apply(s.frames[i].points, s.frames[i].t), s.aspect);
    for (; i < s.frames.length; i += 1) {
      const fr = s.frames[i];
      if (!fr.points) { imgF.reset(); wF.reset(); j.abort(); continue; }
      j.push(wF.apply(fr.world, fr.t), fr.t, imgF.apply(fr.points, fr.t), s.aspect);
    }
    const gs = j.gestures().filter((g) => g.start >= t0 && g.start <= t1);
    const min = (t1 - t0) / 60000;
    const leg = gs.filter((g) => g.limb === 'leg').length, body = gs.filter((g) => ['clinch', 'level'].includes(g.kind)).length;
    out.min += min; out.leg += leg; out.body += body;
    out.per.push(`V${v} ${min.toFixed(1)} min: gambe ${leg} (${(leg / min).toFixed(1)}/min)`);
  }
  return out;
}

const r = realReps();
if (r) {
  console.log(`Ripetizioni vere: ${r.reps}. Pulite (solo i colpi della combo): ${r.clean} su ${r.reps}`);
  console.log(`  in più: gambe ${r.extraLeg} · corpo (schivate, clinch…) ${r.extraBody} · braccia ${r.extraArm}`);
  console.log(`  calci attesi ${r.kicks}: visti come calcio ${r.kickFound} · gamba giusta ${r.kickSide} · anche altezza giusta ${r.kickLevel}`);
}
const b = boxing();
if (b) {
  console.log(`BoxingVI (pugilato, nessun calcio): ${b.min.toFixed(1)} minuti · gesti di gamba inventati ${b.leg} (${(b.leg / b.min).toFixed(1)} al minuto) · clinch/cambi di livello ${b.body}`);
  if (details) b.per.forEach((l) => console.log(`  ${l}`));
}

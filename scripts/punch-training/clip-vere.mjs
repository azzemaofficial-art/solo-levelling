// Prova sulle clip VERE di Emanuele (iPhone davanti, colpi verso il telefono; solo in locale):
// - 4 ripetizioni della 1-2: colpi trovati, braccio giusto, colpi in più;
// - 28 colpi insegnati a comando (8 tipi): trovato, braccio giusto, tipo giusto.
// Il tipo si prova con i SUOI esempi lasciando fuori quello da riconoscere (come "Insegna i colpi").
// Uso: node scripts/punch-training/clip-vere.mjs
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createComboJudge, identifyMove, judgeSequence, teachSample, EXPECT } from '../../lib/mmaComboJudge.js';
import { PRIV } from './dati.mjs';

const FILE = new URL('mma-clips-emanuele.json', PRIV);
export const clipsAvailable = () => existsSync(FILE);

export function decode(c) {
  return c.t.map((t, i) => {
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    c.j.forEach((j, k) => {
      world[j] = { x: c.w[i][k * 3] / 1000, y: c.w[i][k * 3 + 1] / 1000, z: c.w[i][k * 3 + 2] / 1000, visibility: 1 };
      if (c.p[i]) points[j] = { x: c.p[i][k * 3] / 1000, y: c.p[i][k * 3 + 1] / 1000, visibility: c.p[i][k * 3 + 2] / 100 };
    });
    return { t, world, points };
  });
}

// Come nell'app: calibrazione sui primi fotogrammi (guardia), poi un fotogramma alla volta
export function playClip(c, { templates = null, punchNet } = {}) {
  const fr = decode(c), j = createComboJudge({ stance: c.stance, templates, punchNet });
  let i = 0;
  while (!j.isCalibrated() && i < fr.length) { j.calibrate(fr[i].world, fr[i].points, 0.75); i += 1; }
  for (; i < fr.length; i += 1) j.push(fr[i].world, fr[i].t, fr[i].points, 0.75);
  return { j, gestures: j.gestures().filter((g) => g.limb === 'arm') };
}

export function loadClips() {
  const all = JSON.parse(readFileSync(FILE)).Emanuele || [];
  return { reps: all.filter((c) => c.kind === 'rep'), teach: all.filter((c) => c.kind === 'teach') };
}

// Colpo insegnato: il più ampio del braccio giusto partito dopo il "VAI" (come MmaTeach)
export function teachGesture(c, gs) {
  const cue = c.t[0] + (c.cueMs ?? 400);
  const fresh = gs.filter((g) => g.kind !== 'drop' && g.start >= cue - 150);
  const side = EXPECT[c.move]?.side;
  const mine = fresh.filter((g) => g.side === side).sort((a, b) => b.reach - a.reach);
  return { any: fresh.length > 0, g: mine[0] || null, extra: fresh.length - (mine[0] ? 1 : 0) };
}

export function evaluate({ typer = null, punchNet } = {}) {
  const { reps, teach } = loadClips();
  const out = { reps: [], teach: [] };
  for (const c of reps) {
    const { gestures } = playClip(c, { punchNet });
    const gs = gestures.filter((g) => g.kind !== 'drop');
    const lead = gs.filter((g) => g.side === 'lead').length, rear = gs.filter((g) => g.side === 'rear').length;
    out.reps.push({ ts: c.ts, n: gs.length, lead, rear, sides: gs.map((g) => g.side[0]).join(''), moves: gs.map((g) => identifyMove(g) + (g.unsure ? '?' : '')), total: c.expected ? judgeSequence(c.expected, gs).total : null });
  }
  const played = teach.map((c) => ({ c, ...teachGesture(c, playClip(c, { punchNet }).gestures) }));
  for (const p of played) {
    // esempi: tutti gli altri colpi insegnati (lui escluso)
    const items = played.filter((q) => q !== p && q.g).map((q) => teachSample(q.c.move, q.g)).filter(Boolean);
    const type = p.g && typer ? typer(p.g, { items }) : null;
    out.teach.push({ move: p.c.move, any: p.any, arm: Boolean(p.g), type, said: p.g ? identifyMove(p.g) : null, extra: p.extra });
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!clipsAvailable()) { console.log('Clip vere non presenti (solo in locale).'); process.exit(0); }
  // prima senza modellino (motore fino al 17/10), poi con: cosa dice il coach di ogni colpo
  // ('?' = montante delle regole di cui il modellino dubita) e il voto della combo
  for (const [name, punchNet] of [['senza modellino', null], ['con modellino', undefined]]) {
    const q = evaluate({ punchNet });
    console.log(`${name} — 1-2:`, q.reps.map((x) => `${x.moves.join(' ') || '-'} (voto ${x.total ?? '–'})`).join(' | '));
    console.log(`  insegnati trovati: ${q.teach.filter((x) => x.said).map((x) => `${x.move}→${x.said}`).join(', ')}`);
  }
  const r = evaluate();
  console.log('1-2:', r.reps.map((x) => `${x.sides || '-'}`).join(' | '));
  const n = r.teach.length;
  console.log(`insegnati: ${n}, trovati ${r.teach.filter((x) => x.any).length}, braccio giusto ${r.teach.filter((x) => x.arm).length}, colpi in più ${r.teach.reduce((s, x) => s + x.extra, 0)}`);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge, describeGesture, teachSample } from '../lib/mmaComboJudge.js';
import { buildModel, classify, selfCheck, TEACH_GROUPS, loadTemplates, saveTemplates } from '../lib/mmaTemplates.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { synthSequence, calibrateJudge, realistic, amplitude } from './helpers/synthFighter.js';

const PUNCHES = TEACH_GROUPS.find((g) => g.id === 'punches').moves;
const KICKS = TEACH_GROUPS.find((g) => g.id === 'kicks').moves;

// Sessione "insegna i tuoi colpi": 3 esempi per colpo, ognuno un po' diverso
function teach(moves, { depth = 0.4, seed = 1 } = {}) {
  const items = [];
  moves.forEach((id, mi) => {
    [0.9, 1, 1.1].forEach((k, r) => {
      const j = calibrateJudge(createComboJudge());
      const seq = id === 'rearKnee' ? ['clinch', 'rearKnee'] : [id];
      for (const f of realistic(synthSequence(seq, { mutate: amplitude(k), tempo: 0.8 + r * 0.15 }), { depth, seed: seed + mi * 10 + r })) j.push(f.world, f.t, f.points);
      const sample = j.gestures().map((g) => teachSample(id, g)).filter(Boolean).at(-1);
      if (sample) items.push(sample);
    });
  });
  return { stance: 'orthodox', items };
}

function score(combos, { templates, depth = 0.4, seeds = [3, 11] }) {
  let missing = 0, extras = 0, redo = 0, total = 0;
  for (const c of combos) for (const seed of seeds) {
    const j = calibrateJudge(createComboJudge({ templates }));
    for (const f of realistic(synthSequence(c.moves, { tempo: 0.6, mutate: amplitude(0.95) }), { depth, seed })) j.push(f.world, f.t, f.points);
    const r = j.judgeRep(c.moves);
    total += 1; extras += r.extras; if (r.grade === 'redo') redo += 1;
    missing += r.moves.filter((m) => m.status === 'missing').length;
  }
  return { missing, extras, redo, total };
}

const punchCombos = COMBOS.filter((c) => c.moves.every((id) => PUNCHES.includes(id)));

test('insegnamento: 3 esempi per ognuno degli 8 pugni', () => {
  const t = teach(PUNCHES);
  for (const id of PUNCHES) assert.ok(t.items.filter((it) => it.move === id).length >= 2, `${id}: ${t.items.filter((it) => it.move === id).length} esempi`);
});

test('insegnamento: i tuoi pugni si distinguono tra loro (controllo incrociato)', () => {
  const check = selfCheck(teach(PUNCHES));
  assert.ok(check.accuracy >= 0.85, `accuratezza ${check.accuracy} confusioni ${JSON.stringify(check.confusions)}`);
});

test('telefono vero (profondità schiacciata): i tuoi esempi battono le regole fisse', () => {
  const rules = score(punchCombos, { templates: null });
  const mine = score(punchCombos, { templates: teach(PUNCHES) });
  console.log('regole fisse:', rules, '| tuoi esempi:', mine);
  assert.ok(mine.missing + mine.extras <= rules.missing + rules.extras, `tuoi esempi ${JSON.stringify(mine)} vs regole ${JSON.stringify(rules)}`);
  assert.ok(mine.redo <= Math.ceil(mine.total * 0.1), `troppe ripetizioni da rifare: ${JSON.stringify(mine)}`);
});

test('un movimento che non somiglia a nessun tuo colpo non diventa un colpo in più', () => {
  const t = teach(PUNCHES);
  const j = calibrateJudge(createComboJudge({ templates: t }));
  // mano che si sposta piano di lato e torna (sistemare la guardia, grattarsi…)
  const odd = (id, p) => (id === 'feint' ? { ...p, 15: { x: 0.32, y: -0.30, z: -0.05, visibility: 0.99 } } : p);
  for (const f of realistic(synthSequence(['jab', 'feint', 'cross'], { mutate: odd }), { seed: 5 })) j.push(f.world, f.t, f.points);
  const r = j.judgeRep(['jab', 'cross']);
  assert.equal(r.extras, 0, j.gestures().map(describeGesture).join(', '));
  assert.ok(r.moves.every((m) => m.status === 'ok'));
});

test('calci insegnati: riconosciuti anche con la profondità schiacciata', () => {
  const t = teach(KICKS);
  const model = buildModel(t);
  assert.ok(Object.keys(model).some((k) => k.startsWith('leg:')));
  const j = calibrateJudge(createComboJudge({ templates: t }));
  for (const f of realistic(synthSequence(['lowKick', 'teep']), { seed: 21 })) j.push(f.world, f.t, f.points);
  const r = j.judgeRep(['lowKick', 'teep']);
  assert.ok(r.moves.every((m) => m.status === 'ok'), j.gestures().map((g) => `${describeGesture(g)}${g.move ? `(${g.move})` : ''}`).join(', '));
});

test('esempi salvati solo per la stessa guardia; storage rotto → regole', () => {
  let v = null; const st = { getItem: () => v, setItem: (_, x) => { v = x; } };
  saveTemplates({ stance: 'orthodox', items: [{ move: 'jab', limb: 'arm', role: 'lead', f: [0, 0, 0, 0, 0, 1, 0, 0, 1] }] }, st);
  assert.ok(loadTemplates('orthodox', st)); assert.equal(loadTemplates('southpaw', st), null);
  assert.equal(loadTemplates('orthodox', { getItem: () => '{rotto' }), null);
  assert.equal(classify({}, 'arm', 'lead', [1]), null);
});

test('con i tuoi esempi niente correzioni false per la profondità schiacciata (distensione, rotazione)', () => {
  const t = teach(PUNCHES);
  let falseFix = 0;
  for (const seed of [3, 7, 11, 19]) {
    const j = calibrateJudge(createComboJudge({ templates: t }));
    for (const f of realistic(synthSequence(['jab', 'cross', 'hook'], { tempo: 0.7 }), { seed })) j.push(f.world, f.t, f.points);
    const r = j.judgeRep(['jab', 'cross', 'hook']);
    falseFix += r.moves.flatMap((m) => m.issues).filter((it) => ['extend', 'rotate'].includes(it.key)).length;
  }
  assert.equal(falseFix, 0);
  // …ma un jab corto rispetto al tuo viene ancora corretto
  const j = calibrateJudge(createComboJudge({ templates: t }));
  for (const f of realistic(synthSequence(['jab'], { mutate: amplitude(0.6) }), { seed: 4 })) j.push(f.world, f.t, f.points);
  const r = j.judgeRep(['jab']);
  assert.ok(r.moves[0].issues.some((it) => it.key === 'extend') || r.moves[0].status !== 'ok', JSON.stringify(r.moves[0]));
});

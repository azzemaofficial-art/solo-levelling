import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge, describeGesture, teachSample } from '../lib/mmaComboJudge.js';
import { buildModel, classify, selfCheck, cameraCheck, dtw, TEACH_GROUPS, loadTemplates, saveTemplates, TEMPLATE_KEY } from '../lib/mmaTemplates.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { synthSequence, calibrateJudge, realistic, amplitude } from './helpers/synthFighter.js';

const PUNCHES = TEACH_GROUPS.find((g) => g.id === 'punches').moves;

// Insegnamento a comando: per ogni colpo 3 ripetizioni (ampiezza e velocità un po' diverse);
// vale il colpo più ampio del braccio giusto partito al "VAI"
function teach(moves, { view = 'oblique', seed = 1 } = {}) {
  const items = [];
  moves.forEach((id, mi) => {
    [0.9, 1, 1.1].forEach((k, r) => {
      const j = calibrateJudge(createComboJudge(), 15, view);
      for (const f of realistic(synthSequence([id], { mutate: amplitude(k), tempo: 0.8 + r * 0.15, view }), { seed: seed + mi * 10 + r })) j.push(f.world, f.t, f.points, 1);
      const cands = j.gestures().map((g) => teachSample(id, g)).filter(Boolean).sort((a, b) => b.reach - a.reach);
      if (cands[0]) items.push(cands[0]);
    });
  });
  return { stance: 'orthodox', items };
}

function score(combos, { templates, seeds = [3, 11] }) {
  let missing = 0, extras = 0, redo = 0, total = 0, wrongMove = 0;
  for (const c of combos) for (const seed of seeds) {
    const j = calibrateJudge(createComboJudge({ templates }));
    for (const f of realistic(synthSequence(c.moves, { tempo: 0.7, mutate: amplitude(0.95) }), { seed })) j.push(f.world, f.t, f.points, 1);
    const r = j.judgeRep(c.moves);
    total += 1; extras += r.extras; if (r.grade === 'redo') redo += 1;
    missing += r.moves.filter((m) => m.status === 'missing').length;
    wrongMove += r.moves.filter((m) => m.gesture?.move && m.gesture.move !== m.id).length;
  }
  return { missing, extras, redo, total, wrongMove };
}
const punchCombos = COMBOS.filter((c) => c.moves.every((id) => PUNCHES.includes(id)));

test('DTW: stessa traiettoria = 0, traiettorie diverse > 0', () => {
  const line = Array.from({ length: 16 }, (_, i) => [i / 15, 0]);
  const arc = Array.from({ length: 16 }, (_, i) => [Math.sin((i / 15) * Math.PI), Math.cos((i / 15) * Math.PI) - 1]);
  assert.equal(dtw(line, line), 0);
  assert.ok(dtw(line, arc) > 0.2);
});

test('insegnamento: 3 esempi per ognuno degli 8 pugni, dal braccio giusto', () => {
  const t = teach(PUNCHES);
  for (const id of PUNCHES) assert.equal(t.items.filter((it) => it.move === id).length, 3, id);
  assert.ok(t.items.every((it) => (it.move === 'jab' || it.move.startsWith('hook') || it.move === 'uppercut' || it.move === 'bodyHook' ? it.arm === 'lead' : it.arm === 'rear')));
});

test('insegnamento: i tuoi pugni si distinguono tra loro (controllo incrociato)', () => {
  const check = selfCheck(teach(PUNCHES));
  assert.ok(check.accuracy >= 0.85, `accuratezza ${check.accuracy} confusioni ${JSON.stringify(check.confusions)}`);
});

test('con i tuoi esempi: combo di pugni riconosciute colpo per colpo', () => {
  const mine = score(punchCombos, { templates: teach(PUNCHES) });
  assert.equal(mine.missing, 0, JSON.stringify(mine));
  assert.ok(mine.extras <= 1, JSON.stringify(mine));
  assert.ok(mine.redo <= Math.ceil(mine.total * 0.1), JSON.stringify(mine));
  assert.ok(mine.wrongMove <= Math.ceil(mine.total * 0.15), JSON.stringify(mine));
});

test('con i tuoi esempi: un gancio al posto del jab viene riconosciuto come errore', () => {
  const j = calibrateJudge(createComboJudge({ templates: teach(PUNCHES) }));
  for (const f of realistic(synthSequence(['hook', 'cross']), { seed: 9 })) j.push(f.world, f.t, f.points, 1);
  const r = j.judgeRep(['jab', 'cross']);
  assert.notEqual(r.moves[0].status, 'ok', j.gestures().map((g) => g.move || describeGesture(g)).join(', '));
  assert.equal(r.moves[1].status, 'ok');
});

test('camera davanti (colpi verso il telefono): il coach se ne accorge e lo dice', () => {
  const front = cameraCheck(teach(['jab', 'cross'], { view: 'front' }).items);
  const side = cameraCheck(teach(['jab', 'cross']).items);
  assert.equal(side.ok, true, JSON.stringify(side));
  assert.equal(front.ok, false, JSON.stringify(front));
});

test('esempi salvati solo per la stessa guardia; la v1 (esempi rotti) viene ignorata', () => {
  let v = null; const st = { getItem: (k) => (k === TEMPLATE_KEY ? v : null), setItem: (_, x) => { v = x; } };
  saveTemplates({ stance: 'orthodox', items: [{ move: 'jab', arm: 'lead', path: [[0, 0], [0.2, 0], [0.4, 0], [0.2, 0]], reach: 0.4 }] }, st);
  assert.ok(loadTemplates('orthodox', st)); assert.equal(loadTemplates('southpaw', st), null);
  assert.equal(loadTemplates('orthodox', { getItem: () => '{rotto' }), null);
  assert.equal(loadTemplates('orthodox', { getItem: () => JSON.stringify({ v: 1, stance: 'orthodox', items: [{ move: 'jab', f: [1] }] }) }), null);
  assert.equal(classify({}, 'lead', { path: [[0, 0]] }), null);
  assert.deepEqual(buildModel({ items: [] }), {});
});

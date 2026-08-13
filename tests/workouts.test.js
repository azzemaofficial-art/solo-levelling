import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachWorkout, workoutDurationSeconds, VALID_WORKOUT_POSES } from '../lib/workouts.js';
import { DISCIPLINE_IDS } from '../lib/martialKnowledge.js';

test('workout: struttura completa per ogni disciplina', () => {
  for (const id of DISCIPLINE_IDS) {
    const w = buildCoachWorkout(id, 0);
    assert.ok(Array.isArray(w) && w.length >= 3, `${id}: almeno 3 fasi (${w.length})`);
    assert.equal(w[0].name, 'Riscaldamento', `${id}: apre col riscaldamento`);
    assert.equal(w[w.length - 1].name, 'Respiro finale', `${id}: chiude col respiro`);
    assert.equal(w[w.length - 2].name, 'Condizionamento', `${id}: condizionamento prima del respiro`);
    for (const ph of w) {
      assert.ok(ph.name && ph.seconds > 0 && ph.mirror && ph.teach, `${id}: fase completa (${ph.name})`);
      assert.ok(VALID_WORKOUT_POSES.has(ph.mirror), `${id}: mirror valido ${ph.mirror}`);
    }
    // le fasi tecniche portano insegnamento + drill
    const tech = w.slice(1, -2);
    for (const ph of tech) assert.ok(ph.drill, `${id}: drill per ${ph.name}`);
  }
});

test('workout: seed diverso ruota le tecniche, stesso seed riproduce', () => {
  const a = buildCoachWorkout('muaythai', 0).map((p) => p.name).join('|');
  const b = buildCoachWorkout('muaythai', 0).map((p) => p.name).join('|');
  assert.equal(a, b, 'deterministico');
  const c = buildCoachWorkout('muaythai', 3).map((p) => p.name).join('|');
  assert.notEqual(a, c, 'seed diverso cambia il workout');
});

test('workout: durata ragionevole (3-9 minuti)', () => {
  for (const id of DISCIPLINE_IDS) {
    const s = workoutDurationSeconds(id, 0);
    assert.ok(s >= 150 && s <= 540, `${id}: durata ${s}s`);
  }
});

test('workout: disciplina ignota → workout base comunque valido', () => {
  const w = buildCoachWorkout('roba-inventata', 0);
  assert.ok(w.length >= 3);
  assert.equal(w[0].name, 'Riscaldamento');
});

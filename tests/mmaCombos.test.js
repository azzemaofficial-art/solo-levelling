import test from 'node:test';
import assert from 'node:assert/strict';
import { POSES, BASE, sampleKeys, timelineDuration } from '../src/mma/skeleton.js';
import { MOVES, comboKeys } from '../src/data/mmaMoves.js';
import { COMBOS, COMBO_CATEGORIES } from '../src/data/mmaCombos.js';

test('combo: ogni colpo usato esiste e ha spiegazione ed errore', () => {
  for (const combo of COMBOS) {
    for (const id of combo.moves) {
      assert.ok(MOVES[id], `${combo.id}: colpo ${id} mancante`);
      assert.ok(MOVES[id].cue && MOVES[id].mistake, `${id} senza testi`);
    }
    assert.ok(COMBO_CATEGORIES.some((cat) => cat.id === combo.category), combo.id);
  }
});

test('combo: id unici e almeno 5 per categoria', () => {
  assert.equal(new Set(COMBOS.map((c) => c.id)).size, COMBOS.length);
  for (const cat of COMBO_CATEGORIES) assert.ok(COMBOS.filter((c) => c.category === cat.id).length >= 4, cat.id);
});

test('colpi: ogni keyframe punta a una posa esistente con tutte le articolazioni', () => {
  for (const [id, move] of Object.entries(MOVES)) {
    for (const key of move.keys) {
      assert.ok(POSES[key.pose], `${id}: posa ${key.pose} mancante`);
      for (const joint of Object.keys(BASE)) assert.ok(joint in POSES[key.pose], `${key.pose}.${joint}`);
    }
  }
});

test('motore: campionando ogni combo non escono mai coordinate non valide', () => {
  for (const combo of COMBOS) {
    const keys = comboKeys(combo.moves);
    const total = timelineDuration(keys);
    for (let t = 0; t < total; t += 37) {
      const { pose } = sampleKeys(keys, t);
      for (const [joint, value] of Object.entries(pose)) {
        const nums = Array.isArray(value) ? value : [value];
        nums.forEach((n) => assert.ok(Number.isFinite(n) && n > -80 && n < 420, `${combo.id} t=${t} ${joint}=${n}`));
      }
    }
  }
});

test('motore: i tag seguono l’ordine dei colpi nella combo', () => {
  const keys = comboKeys(['jab', 'cross', 'lowKick']);
  const tags = [...new Set(keys.map((k) => k.tag))];
  assert.deepEqual(tags, [-1, 0, 1, 2, 3]);
});

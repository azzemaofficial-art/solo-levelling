import test from 'node:test';
import assert from 'node:assert/strict';
import { TECHNIQUES, techniquesFor, techniquesByCat, CAT_LABEL } from '../lib/techniques.js';

test('MMA ha una libreria tecniche completa (posizioni/prese/combo/proiezioni)', () => {
  const list = techniquesFor('mma');
  assert.ok(list.length >= 20, `tecniche: ${list.length}`);
  const cats = new Set(list.map((t) => t.cat));
  assert.ok(cats.has('posizione') && cats.has('presa') && cats.has('combo') && cats.has('proiezione'));
});

test('ogni tecnica ha campi obbligatori validi', () => {
  for (const [disc, list] of Object.entries(TECHNIQUES)) {
    for (const t of list) {
      assert.ok(t.id && t.name && t.cat, `${disc}/${t.id} manca campo`);
      assert.ok(t.lvl >= 1 && t.lvl <= 5, `${disc}/${t.id} livello non valido`);
      assert.ok(Array.isArray(t.steps) && t.steps.length >= 3, `${disc}/${t.id} ha meno di 3 step`);
      assert.ok(Array.isArray(t.errori) && t.errori.length >= 1, `${disc}/${t.id} senza errori comuni`);
    }
  }
});

test('tecnicheByCat raggruppa per categoria', () => {
  const byCat = techniquesByCat('mma');
  assert.ok(byCat.posizione.length >= 5);
  assert.ok(byCat.presa.length >= 5);
  assert.ok(byCat.combo.length >= 4);
  assert.ok(byCat.proiezione.length >= 4);
});

test('id unici dentro la disciplina', () => {
  for (const [disc, list] of Object.entries(TECHNIQUES)) {
    const ids = list.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, `duplicati in ${disc}`);
  }
});

test('categorie conosciute dalla UI', () => {
  for (const cat of Object.keys(CAT_LABEL)) {
    assert.ok(['posizione', 'presa', 'combo', 'proiezione'].includes(cat));
  }
});

test('disciplina senza libreria ritorna vuoto (non crash)', () => {
  assert.deepEqual(techniquesFor('yoga'), []);
  assert.deepEqual(techniquesByCat('boxe'), {});
});

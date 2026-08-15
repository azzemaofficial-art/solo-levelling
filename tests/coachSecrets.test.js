import test from 'node:test';
import assert from 'node:assert/strict';
import { SECRETS_DB, normalizeDiscipline, secretsFor, pickSecrets, secretOfTheDay, formatSecretsForPrompt } from '../lib/coachSecrets.js';

test('SECRETS_DB copre 30+ discipline con segreti reali', () => {
  const keys = Object.keys(SECRETS_DB);
  assert.ok(keys.length >= 30, `discipline: ${keys.length}`);
  for (const k of keys) {
    assert.ok(SECRETS_DB[k].secrets.length >= 5, `${k} ha troppo pochi segreti`);
    for (const s of SECRETS_DB[k].secrets) {
      assert.ok(s.id && s.text && s.categoria && s.livello >= 1 && s.livello <= 5, `segreto malformato in ${k}: ${s.id}`);
    }
  }
});

test('normalizeDisciplina mappa le mode della UI alla disciplina base', () => {
  assert.equal(normalizeDiscipline('muaythai'), 'muaythai');
  assert.equal(normalizeDiscipline('sparring_muaythai'), 'muaythai');
  assert.equal(normalizeDiscipline('drill_boxing'), 'boxing');
  assert.equal(normalizeDiscipline('roba_nota'), 'general');
});

test('pickSecrets rispetta maxLevel', () => {
  const list = pickSecrets('bjj', { n: 6, maxLevel: 2 });
  assert.ok(list.length > 0);
  for (const s of list) assert.ok(s.livello <= 2, `${s.id} livello ${s.livello} > 2`);
});

test('pickSecrets premia i segreti pertinenti all\'errore osservato', () => {
  const list = pickSecrets('muaythai', { n: 3, errorText: 'gomito sx alto, guardia bassa' });
  assert.ok(list.length >= 1);
  assert.ok(/gomito|guardia/i.test(list[0].text), `atteso pertinenza gomito/guardia, ottenuto: ${list[0].text}`);
});

test('pickSecrets evita i segreti già usati (avoidIds)', () => {
  const prima = pickSecrets('boxing', { n: 3, errorText: 'jab cross gancio' });
  const dopo = pickSecrets('boxing', { n: 3, errorText: 'jab cross gancio', avoidIds: prima.map((s) => s.id), seed: 7 });
  for (const s of dopo) assert.ok(!prima.some((p) => p.id === s.id), `${s.id} doveva essere evitato`);
});

test('secretOfTheDay è deterministico per disciplina+data', () => {
  const a = secretOfTheDay('karate', '2026-08-15');
  const b = secretOfTheDay('karate', '2026-08-15');
  assert.equal(a.id, b.id);
  assert.ok(a.text.length > 10);
});

test('formatSecretsForPrompt produce un blocco compatto con header', () => {
  const list = pickSecrets('taekwondo', { n: 2 });
  const out = formatSecretsForPrompt(list);
  assert.ok(out.startsWith('SEGRETI DEL MAESTRO'));
  assert.ok(out.length <= 700);
  assert.equal(formatSecretsForPrompt([]), '');
});

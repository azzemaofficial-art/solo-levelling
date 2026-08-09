import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARTIAL_DISCIPLINES, DISCIPLINE_IDS, getDiscipline, coachKnowledgePrompt, disciplineOptions,
} from '../lib/martialKnowledge.js';

test('tutte le discipline hanno la struttura completa', () => {
  assert.ok(DISCIPLINE_IDS.length >= 10, `discipline: ${DISCIPLINE_IDS.length}`);
  for (const d of Object.values(MARTIAL_DISCIPLINES)) {
    for (const field of ['name', 'emoji', 'family', 'origin', 'philosophy', 'stance', 'breathing', 'techniques', 'combosSeed', 'ranks']) {
      assert.ok(d[field], `${d.id || '?'}: manca ${field}`);
    }
    assert.ok(Array.isArray(d.etiquette) && d.etiquette.length >= 2, `${d.id}: etiquette`);
    assert.ok(Array.isArray(d.stance.cues) && d.stance.cues.length >= 3, `${d.id}: stance.cues`);
    assert.ok(Array.isArray(d.stance.errors) && d.stance.errors.length >= 2, `${d.id}: stance.errors`);
    assert.ok(Array.isArray(d.breathing.patterns) && d.breathing.patterns.length >= 2, `${d.id}: breathing.patterns`);
    assert.ok(Array.isArray(d.techniques) && d.techniques.length >= 5, `${d.id}: tecniche >= 5`);
    assert.ok(Array.isArray(d.ranks) && d.ranks.length >= 4, `${d.id}: ranks per la progressione`);
  }
});

test('ogni tecnica ha cue, errori con correzione e drill', () => {
  for (const d of Object.values(MARTIAL_DISCIPLINES)) {
    for (const t of d.techniques) {
      assert.ok(t.id && t.it && t.type, `${d.id}.${t?.id}: campi base`);
      assert.ok(Array.isArray(t.how) && t.how.length >= 2, `${d.id}.${t.id}: how`);
      assert.ok(Array.isArray(t.mistakes) && t.mistakes.length >= 1, `${d.id}.${t.id}: mistakes`);
      for (const m of t.mistakes) {
        assert.ok(m.if && m.fix, `${d.id}.${t.id}: mistake if/fix`);
      }
      assert.ok(t.drill, `${d.id}.${t.id}: drill`);
    }
  }
});

test('getDiscipline risolve id e alias', () => {
  assert.equal(getDiscipline('muaythai')?.name, 'Muay Thai');
  assert.equal(getDiscipline('Boxe')?.id, 'boxing');
  assert.equal(getDiscipline('jiu-jitsu')?.id, 'bjj');
  assert.equal(getDiscipline('tkd')?.id, 'taekwondo');
  assert.equal(getDiscipline('krav maga')?.id, 'kravmaga');
  assert.equal(getDiscipline('lotta')?.id, 'wrestling');
  assert.equal(getDiscipline('che-esiste-non')?.id ?? null, null);
  assert.equal(getDiscipline(null), null);
});

test('coachKnowledgePrompt produce prompt maestro non vuoto', () => {
  for (const id of DISCIPLINE_IDS) {
    const p = coachKnowledgePrompt(id);
    assert.ok(p.length > 400, `${id}: prompt troppo corto (${p.length})`);
    assert.ok(p.includes('maestro esperto'), `${id}: incipit maestro`);
    assert.ok(p.includes('Guardia'), `${id}: sezione guardia`);
    assert.ok(p.includes('Respirazione'), `${id}: sezione respirazione`);
    assert.ok(p.includes('Errori tipici'), `${id}: correzioni`);
  }
  assert.equal(coachKnowledgePrompt('inesistente'), '');
});

test('disciplineOptions per la UI', () => {
  const opts = disciplineOptions();
  assert.equal(opts.length, DISCIPLINE_IDS.length);
  for (const o of opts) {
    assert.ok(o.id && o.name && o.emoji && o.family);
  }
});

test('combo seed autentici e senza ripetizioni', () => {
  for (const d of Object.values(MARTIAL_DISCIPLINES)) {
    assert.ok(d.combosSeed.length >= 3, `${d.id}: combo seed`);
    const uniq = new Set(d.combosSeed);
    assert.equal(uniq.size, d.combosSeed.length, `${d.id}: combo duplicate`);
  }
});

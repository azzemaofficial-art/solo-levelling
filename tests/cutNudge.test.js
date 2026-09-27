import test from 'node:test';
import assert from 'node:assert/strict';
import { nudgeLines } from '../lib/cutReminders.js';

test('cut-nudge: nessuno stato → nessun messaggio', () => {
  assert.deepEqual(nudgeLines(null, '2026-09-27'), []);
});

test('cut-nudge: creatina presa oggi e pesata recente → silenzio', () => {
  assert.deepEqual(nudgeLines({ creatineDate: '2026-09-27', lastWeighDate: '2026-09-26' }, '2026-09-27'), []);
});

test('cut-nudge: creatina presa ieri ma non oggi → promemoria', () => {
  const lines = nudgeLines({ creatineDate: '2026-09-26', lastWeighDate: '2026-09-27' }, '2026-09-27');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Creatina/);
});

test('cut-nudge: creatina abbandonata da più di 7 giorni → non insiste', () => {
  assert.deepEqual(nudgeLines({ creatineDate: '2026-09-10' }, '2026-09-27'), []);
});

test('cut-nudge: pesata di 3+ giorni fa → promemoria con i giorni', () => {
  const lines = nudgeLines({ lastWeighDate: '2026-09-23' }, '2026-09-27');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /4 giorni fa/);
});

test('cut-nudge: cambio mese contato correttamente', () => {
  const lines = nudgeLines({ creatineDate: '2026-09-30', lastWeighDate: '2026-09-28' }, '2026-10-01');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /3 giorni fa/);
});

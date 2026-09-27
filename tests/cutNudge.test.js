import test from 'node:test';
import assert from 'node:assert/strict';
import { nudgeLines, morningText, trainingText, mondayIndex, comboOfDay } from '../lib/cutReminders.js';

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

test('cut-nudge: cambio mese contato correttamente (giovedì = calcio)', () => {
  const lines = nudgeLines({ creatineDate: '2026-09-30', lastWeighDate: '2026-09-28' }, '2026-10-01');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /Calcio/);
  assert.match(lines[2], /3 giorni fa/);
});

test('cut-nudge: sessione già segnata oggi → nessuna riga sessione', () => {
  const lines = nudgeLines({ sessionDoneDate: '2026-09-29', lastWeighDate: '2026-09-29' }, '2026-09-29');
  assert.deepEqual(lines, []);
});

test('cut-nudge: mercoledì opzionale non viene sollecitato', () => {
  assert.deepEqual(nudgeLines({ lastWeighDate: '2026-09-30' }, '2026-09-30'), []);
});

test('mondayIndex: lunedì 0, domenica 6', () => {
  assert.equal(mondayIndex('2026-09-28'), 0);
  assert.equal(mondayIndex('2026-09-27'), 6);
});

test('briefing: sessione, kcal del profilo e pesata mancante', () => {
  const text = morningText({ kcalTargets: [2450, 2300, 2300, 2450, 2300, 2450, 2350], lastWeighDate: '2026-09-25' }, '2026-09-29');
  assert.match(text, /Forza A/);
  assert.match(text, /2300 kcal|2\.300 kcal/);
  assert.match(text, /Pesata/);
});

test('briefing: giorno di riposo senza kcal note', () => {
  const text = morningText({}, '2026-09-27');
  assert.match(text, /Riposo/);
  assert.doesNotMatch(text, /kcal/);
});

test('pre-allenamento: esercizi nei giorni di forza, niente nei giorni di riposo', () => {
  assert.match(trainingText('2026-10-03'), /Goblet squat/);
  assert.equal(trainingText('2026-09-27'), null);
});

test('briefing: combo del giorno, diversa tra due giorni consecutivi', () => {
  assert.match(morningText({}, '2026-09-29'), /Combo del giorno/);
  assert.notEqual(comboOfDay('2026-09-29').id, comboOfDay('2026-09-30').id);
});

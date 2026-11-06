import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { massaDishes, massaWeeks } from '../src/data/menuMassa.js';
import { menu16Dishes, menu16Weeks } from '../src/data/menu16.js';
import { massaPhaseOf, massaPhases, massaTrainingDays, massaWeekIndex, massaWeeksSince } from '../src/data/massaPlan.js';
import { trainingDays } from '../src/data/cutPlan.js';
import { videosFor } from '../src/data/exerciseVideos.js';
import { alternativesFor, applyMenu16, pickKey, recipeFor } from '../src/utils/mealPrefs.js';
import { usesFixedMenu, usesMassPlan, ALESSANDRO_CHAT_ID, EMANUELE_CHAT_ID } from '../src/utils/fuelPlan.js';

const days = massaWeeks.flat();
const dishOfSlot = (s) => massaDishes.find((d) => d.id === s.id && d.phase === s.phase) || recipeFor(s.meal);
const sum = (d, key) => d.slots.reduce((tot, s) => tot + (dishOfSlot(s)?.[key] ?? 0), 0);

test('massa: chi vede quale piano', () => {
  assert.equal(usesMassPlan(ALESSANDRO_CHAT_ID), true);
  assert.equal(usesFixedMenu(ALESSANDRO_CHAT_ID), false);
  assert.equal(usesMassPlan(EMANUELE_CHAT_ID), false);
  assert.equal(usesMassPlan(''), false);
});

test('massa: calorie e proteine di ogni giorno restano nell’intervallo voluto', () => {
  assert.equal(days.length, 70);
  const kcal = days.map((d) => sum(d, 'kcal')), prot = days.map((d) => sum(d, 'protein'));
  const media = kcal.reduce((a, b) => a + b) / kcal.length;
  assert.ok(media >= 3000 && media <= 3150, `media ${media}`);
  assert.ok(Math.min(...kcal) >= 2700 && Math.max(...kcal) <= 3500, `${Math.min(...kcal)}–${Math.max(...kcal)}`);
  assert.ok(Math.min(...prot) >= 122, `proteine minime ${Math.min(...prot)}`);
});

test('massa: fibre sempre sufficienti', () => {
  for (const d of days) assert.ok(sum(d, 'fiber') >= 25, `${d.day}: fibre ${sum(d, 'fiber')}`);
});

test('massa: stessi piatti di Emanuele negli stessi giorni (colazione, pranzo, cena)', () => {
  menu16Weeks.forEach((wk, w) => wk.forEach((d, i) => {
    const his = new Set(d.slots.filter((s) => s.family).map((s) => s.id));
    for (const s of massaWeeks[w][i].slots.filter((x) => x.family && x.family !== 'extra')) assert.ok(his.has(s.id), `sett ${w} giorno ${i}: ${s.id}`);
  }));
});

test('massa: niente calcio, partite o cocktail nei testi', () => {
  for (const d of days) for (const s of d.slots) assert.doesNotMatch(`${s.label} ${s.meal}`, /calcio\b|partita|cocktail/i);
  for (const d of massaDishes) assert.doesNotMatch(`${d.title} ${d.why || ''} ${(d.steps || []).join(' ')}`, /\bpartita\b|cocktail|prima del calcio/i);
});

test('massa: testi unici, etichette uniche per giorno, alternative per ogni piatto che si cambia', () => {
  assert.equal(new Set(massaDishes.map((d) => d.meal)).size, massaDishes.length);
  const metaNomi = new Set(menu16Dishes.map((d) => d.meal));
  for (const d of massaDishes) assert.ok(!metaNomi.has(d.meal), `testo uguale al menu di Emanuele: ${d.id}`);
  for (const d of days) {
    assert.equal(new Set(d.slots.map((s) => s.label)).size, d.slots.length, d.day);
    for (const s of d.slots.filter((x) => x.family)) assert.ok(alternativesFor(s).length >= 1, `${s.id}: nessuna alternativa`);
  }
});

test('massa: un’alternativa scelta entra nel giorno, resta nelle dosi massa e il menu di Emanuele non cambia', () => {
  const slot = massaWeeks[0][1].slots.find((s) => s.family);
  const alt = alternativesFor(slot)[0];
  assert.equal(alt.phase, 'a');
  const after = applyMenu16({}, { [pickKey(0, 1, slot.label)]: alt.id }, massaWeeks, 0);
  assert.equal(after[0][1].slots.find((s) => s.label === slot.label).meal, alt.meal);
  assert.deepEqual(applyMenu16()[0], menu16Weeks[0]);
});

test('massa: sedute negli stessi giorni in cui si allena Emanuele, tutte con video e versione leggera', () => {
  const sedute = massaTrainingDays.filter((d) => d.exercises);
  assert.deepEqual(sedute.map((d) => d.day), ['Martedì', 'Giovedì', 'Sabato']);
  for (const d of sedute) {
    assert.notEqual(trainingDays.find((x) => x.day === d.day).type, 'recovery');
    assert.ok(d.exercises.some((e) => e[2]?.light), `${d.day}: lista vuota in versione leggera`);
    for (const [name] of d.exercises) assert.ok(videosFor(name).length > 0, `${name}: nessun video`);
  }
  assert.equal(massaTrainingDays.length, 7);
});

test('massa: il suo menu parte dal 9/11 e gira ogni 10 settimane', () => {
  assert.equal(massaWeekIndex(new Date(2026, 10, 5)), 0, 'prima della partenza');
  assert.equal(massaWeekIndex(new Date(2026, 10, 18)), 1);
  assert.equal(massaWeekIndex(new Date(2027, 0, 20)), 0, 'dopo 10 settimane ricomincia');
  assert.equal(massaWeeksSince(new Date(2027, 0, 20)), 10);
  assert.equal(massaPhaseOf(0).name, 'Primo arco');
  assert.equal(massaPhaseOf(7).name, 'Scarico');
  assert.equal(massaPhaseOf(15).name, 'Il bilancio');
});

test('massa: volume più basso per chi parte da un livello minore, e ogni fase ha la sua copertina', () => {
  const serie = (d) => d.exercises.reduce((n, [, dose]) => n + (Number(dose.match(/^(\d) ×/)?.[1]) || 0), 0);
  assert.deepEqual(massaTrainingDays.filter((d) => d.exercises).map(serie), [19, 19, 17]);
  assert.equal(massaPhaseOf(3).name, 'Primo arco');
  assert.equal(massaPhaseOf(4).name, 'Costruzione');
  for (const f of massaPhases) assert.ok(existsSync(`public${f.art}`), `${f.name}: copertina mancante`);
  for (const f of ['cibo', 'programma', 'progressi']) assert.ok(existsSync(`public/manga/${f}.webp`), f);
});

test('Emanuele: scatti e cose all\'esterno solo lunedì e giovedì', () => {
  const nomi = (giorno) => trainingDays.find((d) => d.day === giorno).exercises.map(([n]) => n);
  assert.ok(nomi('Lunedì').includes('Scatti lanciati'));
  for (const d of trainingDays) {
    if (['Lunedì', 'Giovedì'].includes(d.day)) continue;
    const testo = `${d.detail} ${(d.exercises || []).map(([n]) => n).join(' ')}`;
    assert.doesNotMatch(testo, /Scatti|Salto in lungo|Frenate|Passeggiata|camminata/, d.day);
  }
});

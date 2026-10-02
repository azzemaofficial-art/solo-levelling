import test from 'node:test';
import assert from 'node:assert/strict';
import { fuelTargets, recentFoods, slotForHour, usesFixedMenu, readFuelLog, writeFuelLog } from '../src/utils/fuelPlan.js';

const guy = { sex: 'm', age: 22, heightCm: 178, weightKg: 75, activity: 'mid' };

test('carburante: cut sotto il mantenimento, bulk sopra, con deficit/surplus sensati', () => {
  const cut = fuelTargets({ ...guy, goal: 'cut' }), bulk = fuelTargets({ ...guy, goal: 'bulk' });
  assert.ok(cut.kcal < cut.tdee && bulk.kcal > bulk.tdee);
  assert.ok(cut.tdee - cut.kcal >= 300 && cut.tdee - cut.kcal <= 550, `deficit ${cut.tdee - cut.kcal}`);
  assert.ok(bulk.kcal - bulk.tdee >= 150 && bulk.kcal - bulk.tdee <= 400, `surplus ${bulk.kcal - bulk.tdee}`);
  assert.ok(cut.weeklyKg < 0 && cut.weeklyKg > -0.6);
  assert.ok(bulk.weeklyKg > 0 && bulk.weeklyKg < 0.35);
  assert.equal(cut.protein, 150);
  assert.equal(cut.kcal % 50, 0);
});

test('carburante: i macro tornano con le calorie e i dati mancanti non inventano numeri', () => {
  const t = fuelTargets({ ...guy, goal: 'bulk' });
  const fromMacros = t.protein * 4 + t.fat * 9 + t.carbs * 4;
  assert.ok(Math.abs(fromMacros - t.kcal) <= 30, `${fromMacros} vs ${t.kcal}`);
  assert.equal(fuelTargets({ ...guy, age: null }), null);
  assert.equal(fuelTargets({}), null);
});

test('carburante: il cut non scende mai sotto una soglia sicura', () => {
  const t = fuelTargets({ sex: 'f', age: 40, heightCm: 150, weightKg: 45, activity: 'low', goal: 'cut' });
  assert.ok(t.kcal >= 1200 && t.kcal >= t.bmr);
});

test('carburante: più attività = più calorie', () => {
  const low = fuelTargets({ ...guy, activity: 'low', goal: 'cut' }), high = fuelTargets({ ...guy, activity: 'high', goal: 'cut' });
  assert.ok(high.kcal > low.kcal);
});

test('menu fisso solo per Emanuele', () => {
  assert.equal(usesFixedMenu('264863579'), true);
  assert.equal(usesFixedMenu('546598075'), false);
  assert.equal(usesFixedMenu(''), false);
});

test('cibi recenti: senza doppioni, i più recenti prima', () => {
  const log = { '2026-10-01': [{ name: 'Pasta', kcal: 500 }, { name: 'Mela', kcal: 80 }], '2026-10-02': [{ name: 'pasta ', kcal: 520 }, { name: 'Yogurt', kcal: 120, protein: 17 }] };
  assert.deepEqual(recentFoods(log).map((f) => f.name), ['Yogurt', 'pasta ', 'Mela']);
  assert.equal(slotForHour(8), 'colazione'); assert.equal(slotForHour(13), 'pranzo'); assert.equal(slotForHour(21), 'cena');
});

test('diario: salva al massimo 60 giorni e regge uno storage rotto', () => {
  let saved = '';
  const storage = { getItem: () => saved, setItem: (_, v) => { saved = v; } };
  const log = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, [{ name: 'x', kcal: 1 }]]));
  writeFuelLog(log, storage);
  assert.equal(Object.keys(readFuelLog(storage)).length, 60);
  assert.deepEqual(readFuelLog({ getItem: () => '{rotto' }), {});
});

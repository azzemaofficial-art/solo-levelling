// 👍 / 👎 sui piatti (src/utils/mealPrefs.js): un 👎 toglie il piatto da tutto il piano e la dieta
// resta dieta (giorni e settimane nelle regole); i 👍 non si toccano; i pasti fissi restano fissi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mealWeeks, swapGroup, swapPools } from '../src/data/cutPlan.js';
import { applyMealPrefs, dayOk, togglePref, weekOk } from '../src/utils/mealPrefs.js';

const dishes = [...new Set(Object.values(swapPools).flat().map((d) => d.id))];
const ids = (weeks) => weeks.flat().flatMap((d) => d.slots.map((s) => s.id));

test('gusti: il piano di partenza rispetta già tutte le regole usate per le sostituzioni', () => {
  mealWeeks.forEach((week, w) => {
    week.forEach((d, day) => assert.ok(dayOk(d.slots, day), `settimana ${w + 1}, ${d.day}`));
    assert.ok(weekOk(week), `settimana ${w + 1}`);
  });
});

test('gusti: un 👎 su qualsiasi piatto lo toglie da tutte le settimane e la dieta resta in regola', () => {
  for (const id of dishes) {
    const weeks = applyMealPrefs(mealWeeks, { [id]: 'down' });
    assert.ok(!ids(weeks).includes(id), `${id} è ancora nel piano`);
    weeks.forEach((week, w) => assert.ok(weekOk(week), `👎 ${id}: settimana ${w + 1} fuori dalle regole`));
    // ogni posto cambiato dice cosa c'era prima, ed è un piatto dello stesso gruppo
    weeks.forEach((week, w) => week.forEach((d, day) => d.slots.forEach((s, i) => {
      if (s.id === mealWeeks[w][day].slots[i].id) return;
      assert.equal(s.swappedFrom, mealWeeks[w][day].slots[i].meal);
      assert.ok(swapPools[swapGroup(day, i)].some((x) => x.id === s.id), `${s.id} non è del gruppo ${swapGroup(day, i)}`);
    })));
  }
});

test('gusti: con tanti 👎 insieme quasi sempre tutto in regola, e i 👍 non vengono mai tolti', () => {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let ok = 0;
  for (let k = 0; k < 20; k += 1) {
    const prefs = {};
    while (Object.keys(prefs).length < 8) prefs[dishes[Math.floor(rnd() * dishes.length)]] = 'down';
    const liked = dishes.filter((id) => !prefs[id]).slice(k, k + 4);
    liked.forEach((id) => { prefs[id] = 'up'; });
    const weeks = applyMealPrefs(mealWeeks, prefs);
    const plan = ids(weeks);
    assert.ok(Object.keys(prefs).filter((id) => prefs[id] === 'down').every((id) => !plan.includes(id)), 'un 👎 è rimasto');
    // un piatto col 👍 che era nel piano resta in ogni suo posto
    weeks.forEach((week, w) => week.forEach((d, day) => d.slots.forEach((s, i) => {
      const before = mealWeeks[w][day].slots[i].id;
      if (prefs[before] === 'up') assert.equal(s.id, before, `👍 ${before} tolto`);
    })));
    if (weeks.every(weekOk)) ok += 1;
  }
  assert.ok(ok >= 18, `in regola ${ok}/20`);
});

test('gusti: i pasti fissi non cambiano mai, e senza 👎 il piano è identico', () => {
  assert.equal(applyMealPrefs(mealWeeks, {}), mealWeeks);
  assert.equal(applyMealPrefs(mealWeeks, { [dishes[0]]: 'up' }), mealWeeks);
  const weeks = applyMealPrefs(mealWeeks, Object.fromEntries(dishes.slice(0, 12).map((id) => [id, 'down'])));
  weeks.forEach((week, w) => week.forEach((d, day) => d.slots.forEach((s, i) => {
    if (!swapGroup(day, i)) assert.equal(s.id, mealWeeks[w][day].slots[i].id, `${d.day}: ${s.label} è fisso`);
  })));
});

test('gusti: lo stesso pollice premuto due volte toglie la preferenza', () => {
  let p = togglePref({}, 'waffle', 'up');
  assert.deepEqual(p, { waffle: 'up' });
  p = togglePref(p, 'waffle', 'down');
  assert.deepEqual(p, { waffle: 'down' });
  assert.deepEqual(togglePref(p, 'waffle', 'down'), {});
});

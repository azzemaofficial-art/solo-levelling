import test from 'node:test';
import assert from 'node:assert/strict';
import { menu16Dishes, menu16Weeks } from '../src/data/menu16.js';
import { alternativesFor, applyMenu16, pickKey, recipeFor, weekPrep, weekShopping } from '../src/utils/mealPrefs.js';

const dish = (s) => recipeFor(s.meal);
const families = (week) => week.flatMap((d) => d.slots.map((s) => s.family || ''));

test('dieci settimane da sette giorni, ogni pasto ha la sua ricetta', () => {
  assert.equal(menu16Weeks.length, 10);
  for (const week of menu16Weeks) {
    assert.equal(week.length, 7);
    for (const d of week) for (const s of d.slots) assert.ok(dish(s), s.meal);
  }
});

test('ogni dose ha un testo suo: è la chiave con cui la pagina trova la ricetta', () => {
  assert.equal(new Set(menu16Dishes.map((d) => d.meal)).size, menu16Dishes.length);
});

test('pesce: martedì e venerdì a cena sempre, almeno 3 a settimana, tonno al massimo 1', () => {
  for (const week of menu16Weeks) {
    for (const day of [1, 4]) assert.ok(week[day].slots.some((s) => s.label === 'Cena' && s.family?.startsWith('pesce')));
    const fish = families(week).filter((f) => f.startsWith('pesce'));
    assert.ok(fish.length >= 3);
    assert.ok(fish.filter((f) => f === 'pesce-tonno').length <= 1);
  }
});

test('la whey al cioccolato-wafer è dentro almeno 4 ricette ogni settimana, mai nei piatti salati', () => {
  for (const week of menu16Weeks) assert.ok(week.flatMap((d) => d.slots).filter((s) => dish(s).whey).length >= 4);
  assert.ok(!menu16Dishes.some((d) => d.whey && /piatto|pesce|calcio|pollo-riso/.test(d.family)));
});

test('supercut: dalla 14 si mangia meno, dalla 15 niente sgarri', () => {
  const avg = (w) => menu16Weeks[w].reduce((a, d) => a + d.slots.reduce((b, s) => b + dish(s).kcal, 0), 0) / 7;
  assert.ok(avg(7) < avg(6) - 100);
  assert.ok(avg(8) < avg(7) - 100);
  for (const w of [8, 9]) for (const d of menu16Weeks[w]) for (const s of d.slots) assert.doesNotMatch(s.meal, /McDonald|Pizza|cocktail|Gocciole/);
});

test('prima del calcio niente legumi né grassi pesanti', () => {
  for (const week of menu16Weeks) for (const day of [0, 3]) {
    const dinner = week[day].slots.find((s) => s.label === 'Cena · 18:45');
    assert.doesNotMatch(dinner.family, /legumi/);
    assert.ok(dish(dinner).fat <= 30, dinner.meal);
  }
});

test('ogni piatto ha alternative con gli stessi valori', () => {
  for (const week of menu16Weeks) for (const d of week) for (const s of d.slots) {
    if (!s.family) continue;
    const alts = alternativesFor(s);
    if (s.family === 'spuntino-legumi') continue; // l'hummus ha una sola variante
    assert.ok(alts.length >= 3, `${s.meal}: ${alts.length}`);
    const ref = dish(s);
    for (const a of alts) {
      assert.equal(a.family, s.family);
      assert.ok(Math.abs(a.kcal - ref.kcal) <= 60 && a.protein >= ref.protein - 8);
    }
  }
});

test('scelta e 👎 cambiano il piatto, senza toccare gli altri', () => {
  const slot = menu16Weeks[0][1].slots.find((s) => s.label === 'Cena');
  const alt = alternativesFor(slot)[0];
  const picked = applyMenu16({}, { [pickKey(6, 1, 'Cena')]: alt.id })[0][1].slots.find((s) => s.label === 'Cena');
  assert.equal(picked.id, alt.id);
  assert.equal(picked.swapReason, 'scelta');
  assert.equal(picked.family, slot.family);
  const disliked = applyMenu16({ [slot.id]: 'down' }, {})[0][1].slots.find((s) => s.label === 'Cena');
  assert.notEqual(disliked.id, slot.id);
  assert.equal(disliked.swapReason, 'gusto');
  assert.deepEqual(applyMenu16()[3], menu16Weeks[3]);
});

test('una scelta su un piatto che non esiste più non rompe il piano', () => {
  const plan = applyMenu16({}, { [pickKey(6, 1, 'Cena')]: 'non-esiste' });
  assert.equal(plan[0][1].slots.find((s) => s.label === 'Cena').id, menu16Weeks[0][1].slots.find((s) => s.label === 'Cena').id);
});

test('la spesa scala col numero di persone', () => {
  const one = new Map(weekShopping(menu16Weeks[0], 1));
  const five = new Map(weekShopping(menu16Weeks[0], 5));
  assert.ok(one.size > 20);
  for (const [name, grams] of one) assert.equal(five.get(name), grams * 5);
  assert.ok(weekPrep(menu16Weeks[0]).length > 0);
});

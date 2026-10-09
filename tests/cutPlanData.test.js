import test from 'node:test';
import assert from 'node:assert/strict';
import { dayTargets, mealWeeks, recipes, trainingDays } from '../src/data/cutPlan.js';
import { mealRecipes } from '../src/data/mealRecipes.js';
import { exerciseVideos } from '../src/data/exerciseVideos.js';

const mealsOf = (d) => d.slots.map((s) => s.meal);
const allMeals = mealWeeks.flat().flatMap(mealsOf);
const total = (d, key) => mealsOf(d).reduce((sum, meal) => sum + mealRecipes[meal][key], 0);
const slot = (d, label) => d.slots.find((s) => s.label.startsWith(label));
const tagged = (week, tag) => week.flatMap(mealsOf).filter((meal) => mealRecipes[meal].tags?.includes(tag)).length;

test('piano: ogni pasto delle 6 settimane ha la sua ricetta completa', () => {
  assert.equal(mealWeeks.length, 6);
  const missing = [...new Set(allMeals.filter((meal) => !mealRecipes[meal]))];
  assert.deepEqual(missing, []);
  for (const recipe of Object.values(mealRecipes)) {
    // i cocktail del venerdì non hanno proteine: sono contati solo per le calorie
    assert.ok(recipe.title && recipe.ingredients.length && recipe.steps.length && recipe.kcal > 0 && (recipe.protein > 0 || recipe.title.includes('cocktail')), recipe.title);
  }
});

test('piano: ogni esercizio ha almeno un video YouTube', () => {
  const names = trainingDays.flatMap((d) => (d.exercises || []).map(([name]) => name));
  assert.deepEqual(names.filter((name) => !exerciseVideos[name]?.length), []);
  for (const videos of Object.values(exerciseVideos)) videos.forEach((v) => assert.match(v.id, /^[\w-]{11}$/));
});

test('piano: ogni giorno resta entro ±150 kcal dal suo obiettivo, con proteine sufficienti', () => {
  // proteine minime: 150 g; 140 col McDonald’s (mercoledì), 145 con la pizza (domenica)
  const minProtein = [150, 150, 140, 150, 150, 150, 145];
  mealWeeks.forEach((week, w) => week.forEach((day, d) => {
    const kcal = total(day, 'kcal'), protein = total(day, 'protein');
    assert.ok(Math.abs(kcal - dayTargets[d]) <= 150, `settimana ${w + 1} ${day.day}: ${kcal} kcal vs ${dayTargets[d]}`);
    assert.ok(protein >= minProtein[d], `settimana ${w + 1} ${day.day}: ${protein} g di proteine`);
  }));
});

test('piano: i pasti fissi di Emanuele restano al loro posto', () => {
  for (const week of mealWeeks) {
    const [mon, , wed, thu, fri, sat, sun] = week;
    assert.match(slot(mon, 'Pranzo').meal, /^2 piadine con tacchino e mozzarella light/);
    assert.match(slot(mon, 'Spuntino').meal, /cracker integrali 30 g/);
    assert.match(slot(mon, 'Cena').meal, /^Pollo alla piastra/);
    assert.match(slot(wed, 'Cena').meal, /^McDonald’s/);
    assert.match(slot(sat, 'Pranzo').meal, /carne di cavallo/);
    assert.match(slot(sun, 'Cena').meal, /^Pizza/);
    for (const d of [sat, sun]) assert.match(slot(d, 'Colazione').meal, /12 Gocciole/);
    assert.match(slot(fri, 'Uscita').meal, /cocktail/);
    // calcio 21:30–23:00: cena alle 18:45, spuntino prima e qualcosa di leggero dopo
    for (const d of [mon, thu]) {
      assert.ok(slot(d, 'Cena · 18:45') && slot(d, 'Pre-calcio') && slot(d, 'Dopo calcio'), d.day);
      assert.ok(mealRecipes[slot(d, 'Dopo calcio').meal].kcal <= 450, 'dopo il calcio niente pasto enorme');
    }
  }
});

test('piano: più varietà — colazioni feriali mai ripetute entro 2 settimane, cene tutte diverse', () => {
  const weekdayBreakfasts = mealWeeks.flatMap((week) => week.slice(0, 5).map((d) => slot(d, 'Colazione').meal));
  weekdayBreakfasts.forEach((meal, i) => {
    const next = weekdayBreakfasts.indexOf(meal, i + 1);
    assert.ok(next === -1 || next - i >= 10, `${meal} torna dopo ${next - i} giorni feriali`);
  });
  const dinners = mealWeeks.flatMap((week) => [1, 4, 5].map((d) => slot(week[d], 'Cena').meal));
  assert.equal(new Set(dinners).size, dinners.length, 'le cene di mar/ven/sab si ripetono');
});

test('piano: ogni settimana cucina orientale, patate dolci UNA volta (due erano troppe), proteine in polvere solo dove servono; niente tiramisù', () => {
  mealWeeks.forEach((week, w) => {
    assert.ok(tagged(week, 'orientale') >= 3, `settimana ${w + 1}: orientali ${tagged(week, 'orientale')}`);
    assert.equal(tagged(week, 'patate dolci'), 1, `settimana ${w + 1}: patate dolci ${tagged(week, 'patate dolci')}`);
    // proteine in polvere (chocowafer) solo dove servono: dopo il calcio e nel latte del weekend
    week.forEach((day, d) => day.slots.filter((s) => mealRecipes[s.meal].tags?.includes('proteine in polvere')).forEach((s) => {
      assert.ok(s.label.startsWith('Dopo calcio') || (d >= 5 && s.label === 'Colazione'), `settimana ${w + 1} ${day.day}: proteine in polvere in ${s.label}`);
    }));
    assert.ok(tagged(week, 'proteine in polvere') <= 4, `settimana ${w + 1}: proteine in polvere ${tagged(week, 'proteine in polvere')} volte`);
  });
  const everything = JSON.stringify([mealRecipes, recipes, mealWeeks]);
  assert.doesNotMatch(everything, /tiramis/i);
});

test('piano: la sezione fit porn mostra le ricette golose del menu, con foto e ricetta completa', () => {
  assert.ok(recipes.length >= 15, `solo ${recipes.length} ricette fit porn`);
  for (const r of recipes) assert.ok(r.title && r.image && r.ingredients && r.steps, r.title);
  // e ogni settimana del calendario ne contiene almeno 3
  mealWeeks.forEach((week, w) => assert.ok(tagged(week, 'fit porn') >= 3, `settimana ${w + 1}: fit porn ${tagged(week, 'fit porn')}`));
});

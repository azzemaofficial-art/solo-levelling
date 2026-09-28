import test from 'node:test';
import assert from 'node:assert/strict';
import { mealWeeks, trainingDays } from '../src/data/cutPlan.js';
import { mealRecipes } from '../src/data/mealRecipes.js';
import { exerciseVideos } from '../src/data/exerciseVideos.js';

const mealsOf = (d) => [d.breakfast, d.lunch, d.snack, d.preFootball, d.dinner].filter(Boolean);
const allMeals = mealWeeks.flat().flatMap(mealsOf);

test('piano: ogni pasto dei 28 giorni ha la sua ricetta completa', () => {
  const missing = [...new Set(allMeals.filter((meal) => !mealRecipes[meal]))];
  assert.deepEqual(missing, []);
  for (const recipe of Object.values(mealRecipes)) {
    assert.ok(recipe.title && recipe.ingredients.length && recipe.steps.length && recipe.kcal > 0 && recipe.protein > 0, recipe.title);
  }
});

test('piano: ogni esercizio ha almeno un video YouTube', () => {
  const names = trainingDays.flatMap((d) => (d.exercises || []).map(([name]) => name));
  assert.deepEqual(names.filter((name) => !exerciseVideos[name]?.length), []);
  for (const videos of Object.values(exerciseVideos)) videos.forEach((v) => assert.match(v.id, /^[\w-]{11}$/));
});

test('piano: giornate in un range plausibile per un cut (stime)', () => {
  for (const day of mealWeeks.flat()) {
    const kcal = mealsOf(day).reduce((sum, meal) => sum + mealRecipes[meal].kcal, 0);
    assert.ok(kcal >= 1800 && kcal <= 2700, `${day.day}: ${kcal}`);
  }
});

test('piano: lunedì piadina tacchino e mozzarella light a pranzo, pollo a cena, pre-calcio contato', () => {
  for (const week of mealWeeks) {
    const monday = week[0];
    assert.match(monday.lunch, /^2 piadine con tacchino e mozzarella light/);
    assert.match(monday.snack, /cracker integrali 30 g/);
    assert.match(monday.dinner, /^Pollo alla piastra/);
    assert.ok(monday.preFootball);
    const kcal = mealsOf(monday).reduce((sum, meal) => sum + mealRecipes[meal].kcal, 0);
    assert.ok(Math.abs(kcal - 2450) <= 150, `lunedì ${kcal} kcal vs obiettivo 2450`);
  }
});

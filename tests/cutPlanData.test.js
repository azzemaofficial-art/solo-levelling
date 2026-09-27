import test from 'node:test';
import assert from 'node:assert/strict';
import { mealWeeks, trainingDays } from '../src/data/cutPlan.js';
import { mealRecipes } from '../src/data/mealRecipes.js';
import { exerciseVideos } from '../src/data/exerciseVideos.js';

const allMeals = mealWeeks.flat().flatMap((d) => [d.breakfast, d.lunch, d.snack, d.dinner]);

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
    const kcal = [day.breakfast, day.lunch, day.snack, day.dinner].reduce((sum, meal) => sum + mealRecipes[meal].kcal, 0);
    assert.ok(kcal >= 1800 && kcal <= 2700, `${day.day}: ${kcal}`);
  }
});

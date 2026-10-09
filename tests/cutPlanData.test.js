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
  // proteine minime: 150 g; 140 (1,6 g/kg) col McDonald’s; 135 la domenica (Gocciole, pranzo dalla mamma, pizza)
  const minProtein = [150, 150, 140, 150, 150, 150, 135];
  mealWeeks.forEach((week, w) => week.forEach((day, d) => {
    const kcal = total(day, 'kcal'), protein = total(day, 'protein');
    assert.ok(Math.abs(kcal - dayTargets[d]) <= 150, `settimana ${w + 1} ${day.day}: ${kcal} kcal vs ${dayTargets[d]}`);
    assert.ok(protein >= minProtein[d], `settimana ${w + 1} ${day.day}: ${protein} g di proteine`);
    // longevità: fibre ≥ 25 g (Reynolds 2019) e frutta e verdura ≥ 400 g (OMS) ogni giorno
    assert.ok(total(day, 'fiber') >= 25, `settimana ${w + 1} ${day.day}: fibre ${total(day, 'fiber')} g`);
    assert.ok(total(day, 'fv') >= 400, `settimana ${w + 1} ${day.day}: frutta e verdura ${total(day, 'fv')} g`);
  }));
});

test('piano: i pasti fissi di Emanuele restano al loro posto', () => {
  for (const week of mealWeeks) {
    const [mon, , wed, thu, fri, sat, sun] = week;
    assert.match(slot(mon, 'Pranzo').meal, /^2 piadine con tacchino e mozzarella light/);
    assert.match(slot(mon, 'Spuntino').meal, /cracker integrali 30 g/);
    assert.match(slot(mon, 'Cena').meal, /^Pollo e riso/);
    assert.match(slot(sun, 'Pranzo').meal, /^Pranzo dalla mamma/);
    assert.match(slot(wed, 'Cena').meal, /^McDonald’s/);
    assert.match(slot(sat, 'Pranzo').meal, /carne di cavallo/);
    assert.match(slot(sun, 'Cena').meal, /^Pizza/);
    for (const d of [sat, sun]) assert.match(slot(d, 'Colazione').meal, /8 Gocciole e un frutto/);
    assert.match(slot(fri, 'Uscita').meal, /massimo 2 cocktail/);
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

test('piano: patate dolci al massimo una volta a settimana e solo a patatine, pollo al forno non troppo, colazioni non solo salate, proteine in polvere solo dove servono; niente tiramisù, piccante o fiocchi di latte', () => {
  mealWeeks.forEach((week, w) => {
    assert.ok(tagged(week, 'patate dolci') <= 1, `settimana ${w + 1}: patate dolci ${tagged(week, 'patate dolci')}`);
    assert.ok(tagged(week, 'pollo al forno') <= 1, `settimana ${w + 1}: pollo al forno ${tagged(week, 'pollo al forno')}`);
    // colazioni "non solo salate": almeno 3 dolci su 5 nei giorni feriali
    const dolci = week.slice(0, 5).filter((day) => mealRecipes[slot(day, 'Colazione').meal].tags?.includes('dolce')).length;
    assert.ok(dolci >= 3, `settimana ${w + 1}: colazioni dolci ${dolci}/5`);
    // proteine in polvere (chocowafer) solo dove servono: dopo il calcio e nel latte del weekend
    week.forEach((day, d) => day.slots.filter((s) => mealRecipes[s.meal].tags?.includes('proteine in polvere')).forEach((s) => {
      assert.ok(s.label.startsWith('Dopo calcio') || (d >= 5 && s.label === 'Colazione'), `settimana ${w + 1} ${day.day}: proteine in polvere in ${s.label}`);
    }));
    assert.ok(tagged(week, 'proteine in polvere') <= 4, `settimana ${w + 1}: proteine in polvere ${tagged(week, 'proteine in polvere')} volte`);
  });
  const everything = JSON.stringify([mealRecipes, recipes, mealWeeks]);
  assert.doesNotMatch(everything, /tiramis/i);
  // niente piccante (detto il 9/10): nessun pasto del piano con peperoncino, gochujang, sriracha, curry verde o kimchi
  const planText = JSON.stringify(allMeals.map((meal) => [meal, mealRecipes[meal].ingredients]));
  assert.doesNotMatch(planText, /peperoncino|gochujang|sriracha|curry verde|kimchi|jalape/i);
  // niente fiocchi di latte (li odia, 9/10)
  assert.doesNotMatch(planText, /fiocchi di latte/i);
});

test('piano: la sezione fit porn mostra le ricette golose del menu, con foto e ricetta completa', () => {
  assert.ok(recipes.length >= 15, `solo ${recipes.length} ricette fit porn`);
  for (const r of recipes) assert.ok(r.title && r.image && r.ingredients && r.steps, r.title);
  // e ogni settimana del calendario ne contiene almeno 7 (in media una al giorno)
  mealWeeks.forEach((week, w) => assert.ok(tagged(week, 'fit porn') >= 7, `settimana ${w + 1}: fit porn ${tagged(week, 'fit porn')}`));
});

test('piano: ogni settimana pesce ≥ 3 (salmone almeno 1), carne rossa ≤ 3, affettati ≤ 2, legumi almeno 3 giorni (WCRF, AHA)', () => {
  mealWeeks.forEach((week, w) => {
    assert.ok(tagged(week, 'pesce') >= 3, `settimana ${w + 1}: pesce ${tagged(week, 'pesce')}`);
    // salmone (lo ama, anche crudo) almeno una volta a settimana
    assert.ok(week.flatMap(mealsOf).some((meal) => /salmone/i.test(meal)), `settimana ${w + 1}: niente salmone`);
    assert.ok(tagged(week, 'carne rossa') <= 3, `settimana ${w + 1}: carne rossa ${tagged(week, 'carne rossa')}`);
    assert.ok(tagged(week, 'affettati') <= 2, `settimana ${w + 1}: affettati ${tagged(week, 'affettati')}`);
    const legumeDays = week.filter((day) => mealsOf(day).some((meal) => mealRecipes[meal].tags?.includes('legumi'))).length;
    assert.ok(legumeDays >= 3, `settimana ${w + 1}: legumi in ${legumeDays} giorni`);
  });
});

test('piano: economico e comodo — ogni piatto sotto i 7 € (quasi tutti sotto i 4), pranzi lunghi preparabili la sera prima, lunedì sempre diverso', () => {
  const plan = [...new Set(allMeals)].map((meal) => [meal, mealRecipes[meal]]);
  for (const [meal, r] of plan) {
    // i pasti fissi di Emanuele (piadine del lunedì, pasta e cavallo del sabato) sono abitudini sue, non proposte
    const fisso = /^2 piadine con tacchino|carne di cavallo/.test(meal);
    // i piatti top (salmone, tonno) possono costare di più: limite 7 € a porzione
    if (r.cost != null && !fisso) assert.ok(r.cost <= 7, `${r.title}: ${r.cost} €`);
    if (r.tags?.includes('patate dolci')) assert.match(meal, /patatine/i, `${r.title}: patate dolci solo a patatine`);
  }
  const lunches = new Set(mealWeeks.flat().map((d) => slot(d, 'Pranzo').meal));
  for (const meal of lunches) {
    const r = mealRecipes[meal];
    if (parseInt(r.time, 10) > 30) assert.ok(r.tags?.includes('sera prima'), `${r.title} (${r.time}) va preparato la sera prima`);
  }
  assert.equal(new Set(mealWeeks.map((w) => slot(w[0], 'Cena').meal)).size, mealWeeks.length, 'il pollo e riso del lunedì cambia versione ogni settimana');
  assert.doesNotMatch(JSON.stringify(allMeals), /French toast|Pasta al pesto|Salmone 180 g, riso 80 g crudo, broccoli/);
});

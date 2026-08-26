import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyQuest, questDiscipline, questTarget, questXp, QUEST_DISCIPLINES } from '../lib/quests.js';

test('questDiscipline è deterministica per data', () => {
  assert.equal(questDiscipline('2026-08-26'), questDiscipline('2026-08-26'));
  assert.ok(QUEST_DISCIPLINES.includes(questDiscipline('2026-08-26')));
});

test('dailyQuest genera 3 esercizi distinti e deterministici', () => {
  const a = dailyQuest('2026-08-26', 2);
  const b = dailyQuest('2026-08-26', 2);
  assert.equal(a.disc, b.disc);
  assert.equal(a.exercises.length, 3);
  assert.deepEqual(a.exercises.map((e) => e.name), b.exercises.map((e) => e.name));
  const names = a.exercises.map((e) => e.name);
  assert.equal(new Set(names).size, 3, 'niente duplicati');
  for (const ex of a.exercises) assert.ok(ex.target > 0, `${ex.name} ha target > 0`);
});

test('giorni diversi → quest potenzialmente diverse', () => {
  const seen = new Set();
  for (let d = 1; d <= 20; d += 1) seen.add(questDiscipline(`2026-08-${String(d).padStart(2, '0')}`));
  assert.ok(seen.size >= 3, `in 20 giorni il Sistema varia disciplina (viste ${seen.size})`);
});

test('questTarget scala col livello di maestria', () => {
  const rip = { name: 'x', unit: 'rip' };
  const sec = { name: 'y', unit: 'sec' };
  const min = { name: 'z', unit: 'min' };
  assert.ok(questTarget(rip, 0) < questTarget(rip, 5));
  assert.ok(questTarget(sec, 0) < questTarget(sec, 5));
  assert.ok(questTarget(min, 0) < questTarget(min, 5));
});

test('questXp cresce con livello e streak (con cap)', () => {
  assert.ok(questXp(0, 0) < questXp(3, 0));
  assert.ok(questXp(2, 0) < questXp(2, 10));
  assert.equal(questXp(2, 30), questXp(2, 999), 'streak capped');
});

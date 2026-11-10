import test from 'node:test';
import assert from 'node:assert/strict';
import { planWeekIndex, weekDates, estimateStrength } from '../src/utils/planWeeks.js';
import { nudgeLines } from '../lib/cutReminders.js';

test('settimane: 28/09 = 1, 09/11 = 7, oltre la 16 resta 16', () => {
  assert.equal(planWeekIndex(new Date(2026, 8, 28)), 0);
  assert.equal(planWeekIndex(new Date(2026, 10, 8, 23, 30)), 5); // domenica della sett. 6
  assert.equal(planWeekIndex(new Date(2026, 10, 9, 0, 30)), 6); // lunedì dopo l'ora legale
  assert.equal(planWeekIndex(new Date(2027, 5, 1)), 15);
  assert.equal(weekDates(6)[0], '2026-11-09');
});
test('forza stimata: Epley su peso corpo', () => {
  assert.deepEqual(estimateStrength({ pullups: 6 }, 80), { pull: 96, push: null });
  assert.equal(estimateStrength({ pullups: 6 }, null).pull, null);
});
test('promemoria: la sera prima di una seduta lunga (lunedì sera → Forza A di martedì)', () => {
  assert.ok(nudgeLines({ sessionDoneDate: '2026-11-09', lastWeighDate: '2026-11-09' }, '2026-11-09').some((l) => l.includes('Domani')));
});

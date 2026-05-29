import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReadinessOutcome,
  computeSleepCoach,
  computeWeightTrendGuard,
  computeWeeklyOverview,
  evaluateDataQuality
} from '../src/utils/healthLogic.js';

test('computeReadinessOutcome returns green for strong recovery profile', () => {
  const result = computeReadinessOutcome({ sleepHours: 8, energy: 9, stress: 2, soreness: 2 });
  assert.equal(result.zone, 'green');
  assert.equal(result.intensity, 'alta');
  assert.ok(result.score >= 78);
});

test('computeWeeklyOverview aggregates adherence metrics', () => {
  const logs = [
    { consumed: 2400, waterMl: 2900, protein: 190, burned: 240, sleepHours: 7.5 },
    { consumed: 2000, waterMl: 2300, protein: 150, burned: 80, sleepHours: 6.5 },
    { consumed: 2600, waterMl: 3000, protein: 205, burned: 220, sleepHours: 8 }
  ];
  const overview = computeWeeklyOverview(logs, { dailyGoal: 2400, hydrationGoal: 2800, proteinGoal: 190 });
  assert.equal(overview.daysTracked, 3);
  assert.equal(overview.trainingDays, 2);
  assert.ok(overview.kcalAdherencePct >= 60);
});

test('evaluateDataQuality detects suspicious values', () => {
  const logs = [
    { consumed: 0, waterMl: 1800, burned: 100, sleepHours: 7 },
    { consumed: 0, waterMl: 7600, burned: 2000, sleepHours: 7 },
    { consumed: 0, waterMl: 1600, burned: 80, sleepHours: 15 }
  ];
  const warnings = evaluateDataQuality(logs);
  assert.ok(warnings.some((w) => w.includes('calorie a 0')));
  assert.ok(warnings.some((w) => w.includes('idratazione')));
  assert.ok(warnings.some((w) => w.includes('attività')));
  assert.ok(warnings.some((w) => w.includes('sonno')));
});

test('computeSleepCoach marks low sleep correctly', () => {
  const logs = [
    { sleepHours: 6.2 },
    { sleepHours: 6.5 },
    { sleepHours: 6.1 },
    { sleepHours: 6.4 }
  ];
  const coach = computeSleepCoach(logs, 55);
  assert.equal(coach.status, 'low');
  assert.ok(coach.avgSleep < 7);
});

test('computeWeightTrendGuard detects fast cut', () => {
  const logs = [
    { weight: 83.0 }, { weight: 82.8 }, { weight: 82.7 }, { weight: 82.6 }, { weight: 82.5 }, { weight: 82.4 }, { weight: 82.3 },
    { weight: 81.8 }, { weight: 81.5 }, { weight: 81.3 }, { weight: 81.0 }, { weight: 80.9 }, { weight: 80.6 }, { weight: 80.4 }
  ];
  const trend = computeWeightTrendGuard(logs, 'cut');
  assert.equal(trend.status, 'too_fast_cut');
  assert.ok(trend.kcalAdjustment > 0);
});

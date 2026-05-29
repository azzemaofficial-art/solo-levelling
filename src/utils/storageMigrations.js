const STORAGE_VERSION_KEY = 'shadow_monarch_schema_version';
const CURRENT_STORAGE_VERSION = 8;

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
};

const migrateLogsToV2 = () => {
  const rawLogs = window.localStorage.getItem('shadow_monarch_logs');
  if (!rawLogs) return;
  const logs = safeParse(rawLogs, []);
  if (!Array.isArray(logs)) return;
  const migrated = logs.map((log) => ({
    date: log?.date || '',
    consumed: Number(log?.consumed || 0),
    burned: Number(log?.burned || 0),
    strength: Number(log?.strength || 0),
    fat: Number(log?.fat || 0),
    weight: Number(log?.weight || 0),
    leanMass: Number(log?.leanMass || 0),
    carbs: Number(log?.carbs || 0),
    protein: Number(log?.protein || 0),
    fatMacros: Number(log?.fatMacros || 0),
    fiber: Number(log?.fiber || 0),
    satFat: Number(log?.satFat || 0),
    monoFat: Number(log?.monoFat || 0),
    polyFat: Number(log?.polyFat || 0),
    sugars: Number(log?.sugars || 0),
    sodiumMg: Number(log?.sodiumMg || 0),
    potassiumMg: Number(log?.potassiumMg || 0),
    omega3Mg: Number(log?.omega3Mg || 0),
    waistCm: Number(log?.waistCm || 0),
    waterMl: Number(log?.waterMl || 0),
    steps: Number(log?.steps || 0),
    hrRest: Number(log?.hrRest || 0),
    hrvMs: Number(log?.hrvMs || 0),
    bodyWaterPct: Number(log?.bodyWaterPct || 0),
    muscleMassKg: Number(log?.muscleMassKg || 0),
    bmrKcal: Number(log?.bmrKcal || 0),
    visceralFat: Number(log?.visceralFat || 0),
    metabolicAge: Number(log?.metabolicAge || 0),
    sleepHours: Number(log?.sleepHours || 0),
    sleepQuality: Number(log?.sleepQuality || 0),
    awakenings: Number(log?.awakenings || 0),
    recoveryScore: Number(log?.recoveryScore || 0),
    energyLevel: Number(log?.energyLevel || 0),
    calciumMg: Number(log?.calciumMg || 0),
    ironMg: Number(log?.ironMg || 0),
    magnesiumMg: Number(log?.magnesiumMg || 0),
    bloatingLevel: Number(log?.bloatingLevel || 0),
    digestionRegularity: Number(log?.digestionRegularity || 0),
    mealTolerance: Number(log?.mealTolerance || 0),
    cravingLevel: Number(log?.cravingLevel || 0),
    hungerLevel: Number(log?.hungerLevel || 0),
    mealBreakfastKcal: Number(log?.mealBreakfastKcal || 0),
    mealLunchKcal: Number(log?.mealLunchKcal || 0),
    mealDinnerKcal: Number(log?.mealDinnerKcal || 0),
    skincareMorning: Boolean(log?.skincareMorning),
    skincareEvening: Boolean(log?.skincareEvening)
  }));
  window.localStorage.setItem('shadow_monarch_logs', JSON.stringify(migrated));
};

const migrateStatsToV2 = () => {
  const rawStats = window.localStorage.getItem('shadow_monarch_stats');
  if (!rawStats) return;
  const stats = safeParse(rawStats, {});
  if (!stats || typeof stats !== 'object') return;
  const migrated = {
    ...stats,
    readinessScore: Number(stats.readinessScore || 0),
    readinessZone: typeof stats.readinessZone === 'string' ? stats.readinessZone : 'yellow',
    readinessIntensity: typeof stats.readinessIntensity === 'string' ? stats.readinessIntensity : 'media',
    stressLevel: Number(stats.stressLevel || 4),
    sorenessLevel: Number(stats.sorenessLevel || 4)
  };
  window.localStorage.setItem('shadow_monarch_stats', JSON.stringify(migrated));
};

export const runStorageMigrations = () => {
  if (typeof window === 'undefined') return;
  const current = Number(window.localStorage.getItem(STORAGE_VERSION_KEY) || 1);
  if (current >= CURRENT_STORAGE_VERSION) return;

  if (current < 2) {
    migrateLogsToV2();
    migrateStatsToV2();
  }
  if (current < 3) {
    migrateLogsToV2();
  }
  if (current < 4) {
    migrateLogsToV2();
  }
  if (current < 5) {
    migrateLogsToV2();
  }
  if (current < 6) {
    migrateLogsToV2();
  }
  if (current < 7) {
    migrateLogsToV2();
  }
  if (current < 8) {
    migrateLogsToV2();
  }

  window.localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_STORAGE_VERSION));
};

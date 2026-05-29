export const computeWeeklyOverview = (logs = [], goals = {}) => {
  const recent7 = [...logs].slice(-7);
  const dailyGoal = Number(goals.dailyGoal || 2400);
  const goalForLog = typeof goals.goalForLog === 'function' ? goals.goalForLog : null;
  const hydrationGoal = Number(goals.hydrationGoal || 2800);
  const proteinGoal = Number(goals.proteinGoal || 190);
  const days = recent7.length;
  if (!days) {
    return {
      daysTracked: 0,
      kcalAdherencePct: 0,
      hydrationAdherencePct: 0,
      proteinAdherencePct: 0,
      trainingDays: 0,
      avgSleep: 0
    };
  }

  const kcalDays = recent7.filter((log) => {
    const consumed = Number(log.consumed || 0);
    const target = Math.max(1, Number(goalForLog ? goalForLog(log, dailyGoal) : dailyGoal));
    return consumed >= target * 0.8 && consumed <= target * 1.15;
  }).length;
  const hydrationDays = recent7.filter((log) => Number(log.waterMl || 0) >= hydrationGoal * 0.8).length;
  const proteinDays = recent7.filter((log) => Number(log.protein || 0) >= proteinGoal * 0.8).length;
  const trainingDays = recent7.filter((log) => Number(log.burned || 0) >= 180).length;
  const avgSleep = recent7.reduce((sum, log) => sum + Number(log.sleepHours || 0), 0) / days;

  return {
    daysTracked: days,
    kcalAdherencePct: Math.round((kcalDays / days) * 100),
    hydrationAdherencePct: Math.round((hydrationDays / days) * 100),
    proteinAdherencePct: Math.round((proteinDays / days) * 100),
    trainingDays,
    avgSleep: Number(avgSleep.toFixed(1))
  };
};

export const evaluateDataQuality = (logs = []) => {
  const recent7 = [...logs].slice(-7);
  if (!recent7.length) return [];
  const warnings = [];
  if (recent7.length >= 3 && recent7.filter((log) => Number(log.consumed || 0) === 0).length >= 3) {
    warnings.push('3+ giorni recenti con calorie a 0: verifica logging nutrizione.');
  }
  if (recent7.some((log) => Number(log.waterMl || 0) > 7000)) {
    warnings.push('Valore idratazione anomalo (>7000 ml) rilevato.');
  }
  if (recent7.some((log) => Number(log.burned || 0) > 1800)) {
    warnings.push('Valore attività molto alto (>1800 kcal) rilevato.');
  }
  if (recent7.some((log) => Number(log.sleepHours || 0) > 14)) {
    warnings.push('Ore sonno >14 rilevate: possibile errore inserimento.');
  }
  return warnings;
};

export const computeReadinessOutcome = ({ sleepHours = 7, energy = 6, stress = 4, soreness = 4 } = {}) => {
  const sleepNorm = Math.min(1, Math.max(0, Number(sleepHours) / 8));
  const energyNorm = Math.min(1, Math.max(0, Number(energy) / 10));
  const stressNorm = 1 - Math.min(1, Math.max(0, Number(stress) / 10));
  const sorenessNorm = 1 - Math.min(1, Math.max(0, Number(soreness) / 10));
  const score = Math.round(((sleepNorm * 0.32) + (energyNorm * 0.34) + (stressNorm * 0.18) + (sorenessNorm * 0.16)) * 100);

  if (score >= 78) return { score, zone: 'green', intensity: 'alta', note: 'Pronto per sessione intensa o progressione carico.' };
  if (score >= 58) return { score, zone: 'yellow', intensity: 'media', note: 'Mantieni volume controllato e tecnica pulita.' };
  return { score, zone: 'red', intensity: 'bassa', note: 'Preferisci recovery attivo, mobilita o camminata.' };
};

export const computeSleepCoach = (logs = [], readinessScore = 0) => {
  const recent7 = [...logs].slice(-7);
  const avgSleep = recent7.length
    ? recent7.reduce((sum, log) => sum + Number(log.sleepHours || 0), 0) / recent7.length
    : 0;
  const rounded = Number(avgSleep.toFixed(1));
  const target = '7.5-9 h';

  if (rounded === 0) {
    return {
      avgSleep: 0,
      target,
      status: 'missing',
      advice: 'Inserisci almeno 3 notti di sonno per avere suggerimenti affidabili.',
      trainingHint: 'Intensita: prudente finche i dati non sono completi.'
    };
  }

  if (rounded < 7) {
    return {
      avgSleep: rounded,
      target,
      status: 'low',
      advice: 'Sei sotto target: prova ad anticipare il sonno di 30-45 minuti per 3-4 giorni.',
      trainingHint: readinessScore < 58 ? 'Intensita: bassa/media, evita picchi.' : 'Intensita: media, volume controllato.'
    };
  }

  if (rounded > 9.4) {
    return {
      avgSleep: rounded,
      target,
      status: 'high',
      advice: 'Sonno molto alto: valuta qualita energia/stress per capire se e recupero o stanchezza accumulata.',
      trainingHint: 'Intensita: media, osserva energia reale nella sessione.'
    };
  }

  return {
    avgSleep: rounded,
    target,
    status: 'ok',
    advice: 'Sonno in range ottimale: mantieni routine costante.',
    trainingHint: readinessScore >= 78 ? 'Intensita: puoi spingere.' : 'Intensita: media/alta in base al readiness.'
  };
};

export const computeWeightTrendGuard = (logs = [], objective = 'recomp') => {
  const weighted = [...logs]
    .map((log) => ({ date: log.date, weight: Number(log.weight || 0) }))
    .filter((entry) => entry.weight > 0);

  if (weighted.length < 4) {
    return {
      status: 'missing',
      message: 'Dati peso insufficienti: servono almeno 4 registrazioni (anche settimanali).',
      weeklyDeltaKg: 0,
      weeklyDeltaPct: 0,
      kcalAdjustment: 0
    };
  }

  const windowSize = weighted.length >= 10 ? 5 : Math.max(2, Math.floor(weighted.length / 2));
  const last7 = weighted.slice(-windowSize);
  const prev7 = weighted.slice(-(windowSize * 2), -windowSize);
  const avg = (arr) => arr.reduce((sum, item) => sum + item.weight, 0) / Math.max(1, arr.length);
  const lastAvg = avg(last7);
  const prevAvg = prev7.length ? avg(prev7) : weighted[0].weight;

  const weeklyDeltaKg = Number((lastAvg - prevAvg).toFixed(2));
  const weeklyDeltaPct = Number((((lastAvg - prevAvg) / Math.max(prevAvg, 1)) * 100).toFixed(2));

  const obj = String(objective || 'recomp').toLowerCase();
  if (obj === 'cut') {
    if (weeklyDeltaPct <= -1) return { status: 'too_fast_cut', message: 'Stai scendendo troppo in fretta.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: +140 };
    if (weeklyDeltaPct > -0.25) return { status: 'too_slow_cut', message: 'Dimagrimento lento o fermo.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: -120 };
    return { status: 'good_cut', message: 'Ritmo cut in range.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: 0 };
  }

  if (obj === 'bulk') {
    if (weeklyDeltaPct >= 0.75) return { status: 'too_fast_bulk', message: 'Stai salendo troppo in fretta.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: -130 };
    if (weeklyDeltaPct < 0.2) return { status: 'too_slow_bulk', message: 'Bulk lento: surplus probabilmente basso.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: +120 };
    return { status: 'good_bulk', message: 'Ritmo bulk in range.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: 0 };
  }

  if (Math.abs(weeklyDeltaPct) > 0.55) {
    return { status: 'volatile_recomp', message: 'Variazione alta per una recomp.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: weeklyDeltaPct > 0 ? -100 : +100 };
  }
  return { status: 'good_recomp', message: 'Trend stabile per recomp.', weeklyDeltaKg, weeklyDeltaPct, kcalAdjustment: 0 };
};

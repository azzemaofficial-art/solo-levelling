import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const HEAT_COLORS = ['#0f1117', '#f59e0b', '#a78bfa', '#818cf8', '#67e8f9', '#6ee7b7'];

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isWorkout = (log) => toNumber(log?.burned, 0) >= 180 || toNumber(log?.strength, 0) > 0;
const inferWorkoutTags = (log = {}) => {
  const text = `${String(log?.workoutNote || '')} ${String(log?.dayNote || '')}`.toLowerCase();
  const tags = [];
  if (/(cardio|corsa|run|bike|cyc|hiit|sprint|cammin|steps|conditioning)/.test(text)) tags.push('Cardio');
  if (/(upper|petto|schiena|spalle|braccia|push|pull|chest|back|shoulder|arms)/.test(text)) tags.push('Upper');
  if (/(lower|gamba|gambe|quad|glute|ham|leg)/.test(text)) tags.push('Lower');
  if (/(full|total body|totalbody|full body)/.test(text)) tags.push('Full');
  if (toNumber(log?.strength, 0) >= 45) tags.push('Strength');
  if (toNumber(log?.workoutBurn ?? log?.burned, 0) >= 380) tags.push('Conditioning');
  const uniq = Array.from(new Set(tags));
  return uniq.length ? uniq.slice(0, 3) : ['General'];
};
const inferWorkoutType = (log = {}) => {
  const tags = inferWorkoutTags(log);
  if (tags.includes('Cardio')) return 'Cardio';
  if (tags.includes('Upper')) return 'Upper';
  if (tags.includes('Lower')) return 'Lower';
  if (tags.includes('Full')) return 'Full';
  if (tags.includes('Strength')) return 'Strength';
  if (tags.includes('Conditioning')) return 'Conditioning';
  return 'General';
};
const getDayScore = (log, dailyGoal, hydrationGoal, mode = 'all') => {
  if (!log) return 0;
  if (mode === 'workout') return isWorkout(log) ? 1 : 0;
  if (mode === 'water') return toNumber(log.waterMl, 0) >= hydrationGoal * 0.8 ? 1 : 0;
  if (mode === 'skincare') return (log.skincareMorning ? 1 : 0) + (log.skincareEvening ? 1 : 0);
  let score = 0;
  const kcal = toNumber(log.consumed, 0);
  const water = toNumber(log.waterMl, 0);
  if (kcal >= dailyGoal * 0.8 && kcal <= dailyGoal * 1.15) score += 1;
  if (water >= hydrationGoal * 0.8) score += 1;
  if (isWorkout(log)) score += 1;
  if (log.skincareMorning) score += 1;
  if (log.skincareEvening) score += 1;
  return score;
};
const getModeMaxScore = (mode) => {
  if (mode === 'workout') return 1;
  if (mode === 'water') return 1;
  if (mode === 'skincare') return 2;
  return 5;
};
const getHeatLevel = (score, maxScore) => {
  if (score <= 0 || maxScore <= 0) return 0;
  const ratio = score / maxScore;
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.7) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const fromIsoDate = (iso) => {
  const safe = String(iso || '');
  const [y, m, d] = safe.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, Math.max(0, m - 1), d);
};
const toDateKeyFromIso = (iso) => {
  const date = fromIsoDate(iso);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
};
const createCalendarEmptyLog = (dateKey = '') => ({
  date: dateKey,
  consumed: 0,
  burned: 0,
  workoutBurn: 0,
  activeBurn: 0,
  strength: 0,
  fat: 0,
  weight: 0,
  leanMass: 0,
  carbs: 0,
  protein: 0,
  fatMacros: 0,
  fiber: 0,
  satFat: 0,
  monoFat: 0,
  polyFat: 0,
  sugars: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  omega3Mg: 0,
  waistCm: 0,
  waterMl: 0,
  steps: 0,
  hrRest: 0,
  hrvMs: 0,
  bodyWaterPct: 0,
  muscleMassKg: 0,
  bmrKcal: 0,
  visceralFat: 0,
  metabolicAge: 0,
  sleepHours: 0,
  sleepQuality: 0,
  awakenings: 0,
  recoveryScore: 0,
  energyLevel: 0,
  calciumMg: 0,
  ironMg: 0,
  magnesiumMg: 0,
  bloatingLevel: 0,
  digestionRegularity: 0,
  mealTolerance: 0,
  cravingLevel: 0,
  hungerLevel: 0,
  mealBreakfastKcal: 0,
  mealLunchKcal: 0,
  mealDinnerKcal: 0,
  skincareMorning: false,
  skincareEvening: false
});

const buildChronologicalLogs = (logs = []) => {
  const today = new Date();
  const normalized = Array.isArray(logs) ? logs : [];
  return normalized.map((log, idx) => {
    const offset = normalized.length - 1 - idx;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    return { date, iso: toIsoDate(date), log, sourceIndex: idx };
  });
};

const summarizeEntries = (entries = [], dailyGoal, hydrationGoal) => {
  const logs = entries.map((entry) => entry?.log).filter(Boolean);
  const workouts = logs.filter((log) => isWorkout(log)).length;
  const hydrationDays = logs.filter((log) => toNumber(log.waterMl, 0) >= hydrationGoal * 0.8).length;
  const fullSkincareDays = logs.filter((log) => Boolean(log.skincareMorning) && Boolean(log.skincareEvening)).length;
  const totalWater = logs.reduce((sum, log) => sum + toNumber(log.waterMl, 0), 0);
  const totalCalories = logs.reduce((sum, log) => sum + toNumber(log.consumed, 0), 0);
  const strengthVals = logs.map((log) => toNumber(log.strength, 0)).filter((v) => v > 0);
  const kcalOnTarget = logs.filter((log) => {
    const consumed = toNumber(log.consumed, 0);
    return consumed >= dailyGoal * 0.8 && consumed <= dailyGoal * 1.15;
  }).length;
  return {
    days: logs.length,
    workouts,
    hydrationDays,
    fullSkincareDays,
    avgWater: logs.length ? Math.round(totalWater / logs.length) : 0,
    avgCalories: logs.length ? Math.round(totalCalories / logs.length) : 0,
    avgStrength: strengthVals.length ? Number((strengthVals.reduce((a, b) => a + b, 0) / strengthVals.length).toFixed(1)) : 0,
    kcalAdherencePct: logs.length ? Math.round((kcalOnTarget / logs.length) * 100) : 0
  };
};

const buildStreakStats = (entries = [], predicate) => {
  let current = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (predicate(entries[i])) current += 1;
    else break;
  }
  let best = 0;
  let running = 0;
  entries.forEach((entry) => {
    if (predicate(entry)) {
      running += 1;
      if (running > best) best = running;
    } else {
      running = 0;
    }
  });
  const last21 = entries.slice(-21).map((entry) => predicate(entry));
  return { current, best, last21 };
};

const Calendar = ({
  systemLogs = [],
  setSystemLogs,
  dailyGoal = 2400,
  hydrationGoal = 2800,
  playerStats = {}
}) => {
  const [periodDays, setPeriodDays] = useState(90);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [heatmapMode, setHeatmapMode] = useState('all');
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState(null);
  const [selectedMonthDay, setSelectedMonthDay] = useState(null);
  const [monthGoals, setMonthGoals] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_calendar_goals');
      if (!raw) return { workouts: 12, hydrationDays: 18, skincareDays: 20 };
      const parsed = JSON.parse(raw);
      return {
        workouts: clamp(toNumber(parsed.workouts, 12), 1, 40),
        hydrationDays: clamp(toNumber(parsed.hydrationDays, 18), 1, 31),
        skincareDays: clamp(toNumber(parsed.skincareDays, 20), 1, 31)
      };
    } catch (_) {
      return { workouts: 12, hydrationDays: 18, skincareDays: 20 };
    }
  });

  const chronoLogs = useMemo(() => buildChronologicalLogs(systemLogs), [systemLogs]);
  const logsByIso = useMemo(() => {
    const map = new Map();
    chronoLogs.forEach((entry) => map.set(entry.iso, entry));
    return map;
  }, [chronoLogs]);

  const periodLogs = useMemo(() => chronoLogs.slice(-periodDays), [chronoLogs, periodDays]);
  const periodMetrics = useMemo(() => {
    const tracked = periodLogs.map((entry) => entry.log).filter(Boolean);
    const workouts = tracked.filter((log) => isWorkout(log)).length;
    const totalWater = tracked.reduce((sum, log) => sum + toNumber(log.waterMl, 0), 0);
    const totalCalories = tracked.reduce((sum, log) => sum + toNumber(log.consumed, 0), 0);
    const strengthVals = tracked.map((log) => toNumber(log.strength, 0)).filter((v) => v > 0);
    const skincareMorning = tracked.filter((log) => Boolean(log.skincareMorning)).length;
    const skincareEvening = tracked.filter((log) => Boolean(log.skincareEvening)).length;
    return {
      trackedDays: tracked.length,
      workouts,
      avgWater: tracked.length ? Math.round(totalWater / tracked.length) : 0,
      avgCalories: tracked.length ? Math.round(totalCalories / tracked.length) : 0,
      avgStrength: strengthVals.length ? Number((strengthVals.reduce((a, b) => a + b, 0) / strengthVals.length).toFixed(1)) : 0,
      maxStrength: strengthVals.length ? Math.max(...strengthVals) : 0,
      skincareMorning,
      skincareEvening
    };
  }, [periodLogs]);
  const comparison30 = useMemo(() => {
    const current = summarizeEntries(chronoLogs.slice(-30), dailyGoal, hydrationGoal);
    const previous = summarizeEntries(chronoLogs.slice(-60, -30), dailyGoal, hydrationGoal);
    return {
      current,
      previous,
      delta: {
        workouts: current.workouts - previous.workouts,
        avgWater: current.avgWater - previous.avgWater,
        avgCalories: current.avgCalories - previous.avgCalories,
        avgStrength: Number((current.avgStrength - previous.avgStrength).toFixed(1)),
        fullSkincareDays: current.fullSkincareDays - previous.fullSkincareDays
      }
    };
  }, [chronoLogs, dailyGoal, hydrationGoal]);
  const streaks = useMemo(() => ({
    workout: buildStreakStats(chronoLogs, (entry) => isWorkout(entry?.log)),
    hydration: buildStreakStats(chronoLogs, (entry) => toNumber(entry?.log?.waterMl, 0) >= hydrationGoal * 0.8),
    skincare: buildStreakStats(chronoLogs, (entry) => Boolean(entry?.log?.skincareMorning) && Boolean(entry?.log?.skincareEvening))
  }), [chronoLogs, hydrationGoal]);

  const monthGrid = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(selectedYear, selectedMonth, day);
      const iso = toIsoDate(date);
      const entry = logsByIso.get(iso) || null;
      const log = entry?.log || null;
      cells.push({
        day,
        date,
        iso,
        sourceIndex: Number.isFinite(entry?.sourceIndex) ? entry.sourceIndex : -1,
        log,
        workout: isWorkout(log)
      });
    }
    return cells;
  }, [selectedYear, selectedMonth, logsByIso]);

  const monthMetrics = useMemo(() => {
    const logs = monthGrid.filter(Boolean).map((cell) => cell.log).filter(Boolean);
    const strengths = logs.map((log) => toNumber(log.strength, 0)).filter((v) => v > 0);
    const hydrationDays = logs.filter((log) => toNumber(log.waterMl, 0) >= hydrationGoal * 0.8).length;
    const skincareDays = logs.filter((log) => Boolean(log.skincareMorning) && Boolean(log.skincareEvening)).length;
    return {
      workouts: logs.filter((log) => isWorkout(log)).length,
      avgStrength: strengths.length ? Number((strengths.reduce((a, b) => a + b, 0) / strengths.length).toFixed(1)) : 0,
      maxStrength: strengths.length ? Math.max(...strengths) : 0,
      kcalAdherence: logs.length ? Math.round((logs.filter((log) => {
        const consumed = toNumber(log.consumed, 0);
        return consumed >= dailyGoal * 0.8 && consumed <= dailyGoal * 1.15;
      }).length / logs.length) * 100) : 0,
      hydrationAdherence: logs.length ? Math.round((hydrationDays / logs.length) * 100) : 0,
      hydrationDays,
      skincareDays
    };
  }, [monthGrid, dailyGoal, hydrationGoal]);

  const yearOverview = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIdx) => {
      const entries = chronoLogs.filter((entry) => entry.date.getFullYear() === selectedYear && entry.date.getMonth() === monthIdx);
      const logs = entries.map((entry) => entry.log).filter(Boolean);
      return {
        monthIdx,
        workouts: logs.filter((log) => isWorkout(log)).length,
        avgWater: logs.length ? Math.round(logs.reduce((sum, log) => sum + toNumber(log.waterMl, 0), 0) / logs.length) : 0
      };
    });
  }, [chronoLogs, selectedYear]);
  const heatmapWeeks = useMemo(() => {
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const start = new Date(yearStart);
    const startOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startOffset);
    const end = new Date(yearEnd);
    const endOffset = 6 - ((end.getDay() + 6) % 7);
    end.setDate(end.getDate() + endOffset);

    const maxScore = getModeMaxScore(heatmapMode);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toIsoDate(d);
      const entry = logsByIso.get(iso) || null;
      const log = entry?.log || null;
      const score = getDayScore(log, dailyGoal, hydrationGoal, heatmapMode);
      days.push({
        date: new Date(d),
        iso,
        inYear: d.getFullYear() === selectedYear,
        sourceIndex: Number.isFinite(entry?.sourceIndex) ? entry.sourceIndex : -1,
        score,
        maxScore,
        level: getHeatLevel(score, maxScore),
        log
      });
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [selectedYear, logsByIso, dailyGoal, hydrationGoal, heatmapMode]);

  const allTimeWorkouts = useMemo(() => chronoLogs.filter((entry) => isWorkout(entry.log)).length, [chronoLogs]);
  const insights = useMemo(() => {
    const bestMonth = [...yearOverview].sort((a, b) => b.workouts - a.workouts)[0];
    const byWeek = new Map();
    chronoLogs
      .filter((entry) => entry.date.getFullYear() === selectedYear)
      .forEach((entry) => {
        const date = new Date(entry.date);
        const day = date.getDay() || 7;
        date.setDate(date.getDate() + 4 - day);
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        const key = `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
        if (!byWeek.has(key)) byWeek.set(key, []);
        byWeek.get(key).push(entry.log);
      });
    let strongestWeek = { key: '--', score: 0 };
    byWeek.forEach((logs, key) => {
      const strength = logs.reduce((sum, log) => sum + toNumber(log?.strength, 0), 0) / Math.max(1, logs.length);
      if (strength > strongestWeek.score) strongestWeek = { key, score: Number(strength.toFixed(1)) };
    });
    const weekdayScores = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    chronoLogs.filter((entry) => entry.date.getFullYear() === selectedYear).forEach((entry) => {
      const idx = (entry.date.getDay() + 6) % 7;
      weekdayScores[idx].total += getDayScore(entry.log, dailyGoal, hydrationGoal, 'all');
      weekdayScores[idx].count += 1;
    });
    const bestWeekdayIdx = weekdayScores
      .map((row, idx) => ({ idx, avg: row.count ? row.total / row.count : 0 }))
      .sort((a, b) => b.avg - a.avg)[0]?.idx ?? 0;
    return {
      bestMonthLabel: bestMonth ? MONTHS_IT[bestMonth.monthIdx] : '--',
      bestMonthWorkouts: bestMonth?.workouts || 0,
      strongestWeek: strongestWeek.key,
      strongestWeekScore: strongestWeek.score,
      bestWeekday: WEEKDAY_SHORT[bestWeekdayIdx]
    };
  }, [yearOverview, chronoLogs, selectedYear, dailyGoal, hydrationGoal]);
  const goalProgress = useMemo(() => ({
    workoutsPct: clamp(Math.round((monthMetrics.workouts / Math.max(1, monthGoals.workouts)) * 100), 0, 100),
    hydrationPct: clamp(Math.round((monthMetrics.hydrationDays / Math.max(1, monthGoals.hydrationDays)) * 100), 0, 100),
    skincarePct: clamp(Math.round((monthMetrics.skincareDays / Math.max(1, monthGoals.skincareDays)) * 100), 0, 100)
  }), [monthMetrics, monthGoals]);
  const selectedDayRaw = selectedMonthDay || (selectedHeatmapDay?.inYear ? selectedHeatmapDay : null);
  const selectedDay = useMemo(() => {
    if (!selectedDayRaw) return null;
    const live = logsByIso.get(selectedDayRaw.iso);
    if (!live) return selectedDayRaw;
    return {
      ...selectedDayRaw,
      log: live.log,
      sourceIndex: Number.isFinite(live.sourceIndex) ? live.sourceIndex : selectedDayRaw.sourceIndex
    };
  }, [selectedDayRaw, logsByIso]);
  const [retroInputs, setRetroInputs] = useState({
    consumed: 0,
    waterMl: 0,
    workoutBurn: 0,
    strength: 0,
    mealBreakfastKcal: 0,
    mealLunchKcal: 0,
    mealDinnerKcal: 0,
    dayNote: '',
    workoutNote: '',
    skincareMorning: false,
    skincareEvening: false
  });
  const [retroUndoStack, setRetroUndoStack] = useState([]);
  const [retroRedoStack, setRetroRedoStack] = useState([]);
  const [retroQuickCommand, setRetroQuickCommand] = useState('');
  const [retroQuickFeedback, setRetroQuickFeedback] = useState('');
  const [agendaAddType, setAgendaAddType] = useState('meal_lunch');
  const [agendaAddAmount, setAgendaAddAmount] = useState(0);
  const [agendaAddNote, setAgendaAddNote] = useState('');
  const [workoutLogMonthFilter, setWorkoutLogMonthFilter] = useState('all');
  const [workoutLogTypeFilter, setWorkoutLogTypeFilter] = useState('all');
  const [workoutLogSearch, setWorkoutLogSearch] = useState('');
  const selectedChronoIndex = Number.isFinite(selectedDay?.sourceIndex) ? selectedDay.sourceIndex : -1;
  const selectedDayOffsetDays = useMemo(() => {
    if (!selectedDay?.iso) return null;
    const date = fromIsoDate(selectedDay.iso);
    if (!date) return null;
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((base - target) / 86400000);
  }, [selectedDay?.iso]);
  const selectedCanEdit = Number.isFinite(selectedDayOffsetDays) && selectedDayOffsetDays >= 0;
  const selectedIsFuture = Number.isFinite(selectedDayOffsetDays) && selectedDayOffsetDays < 0;
  const workoutLogEntries = useMemo(
    () => [...chronoLogs].filter((entry) => isWorkout(entry.log)).slice(-45).reverse(),
    [chronoLogs]
  );
  const workoutLogMonthOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    workoutLogEntries.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        key,
        label: `${MONTHS_IT[entry.date.getMonth()].slice(0, 3)} ${entry.date.getFullYear()}`
      });
    });
    return options;
  }, [workoutLogEntries]);
  const workoutLogTypeOptions = ['all', 'Cardio', 'Upper', 'Lower', 'Full', 'Strength', 'Conditioning', 'General'];
  const filteredWorkoutLogEntries = useMemo(() => (
    workoutLogEntries.filter((entry) => {
      const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
      const type = inferWorkoutType(entry.log);
      const monthOk = workoutLogMonthFilter === 'all' || workoutLogMonthFilter === monthKey;
      const typeOk = workoutLogTypeFilter === 'all' || workoutLogTypeFilter === type;
      const search = String(workoutLogSearch || '').trim().toLowerCase();
      const note = `${String(entry.log?.workoutNote || '')} ${String(entry.log?.dayNote || '')}`.toLowerCase();
      const tags = inferWorkoutTags(entry.log).join(' ').toLowerCase();
      const searchOk = !search || note.includes(search) || tags.includes(search) || type.toLowerCase().includes(search);
      return monthOk && typeOk && searchOk;
    })
  ), [workoutLogEntries, workoutLogMonthFilter, workoutLogTypeFilter, workoutLogSearch]);
  const retroWorkoutStreak = streaks.workout;
  const retroValidationErrors = useMemo(() => {
    const errors = [];
    const kcal = toNumber(retroInputs.consumed, 0);
    const water = toNumber(retroInputs.waterMl, 0);
    const burn = toNumber(retroInputs.workoutBurn, 0);
    const strength = toNumber(retroInputs.strength, 0);
    if (kcal < 0 || kcal > 12000) errors.push('Kcal fuori range (0-12000)');
    if (water < 0 || water > 12000) errors.push('Acqua fuori range (0-12000 ml)');
    if (burn < 0 || burn > 5000) errors.push('Workout burn fuori range (0-5000)');
    if (strength < 0 || strength > 800) errors.push('Strength fuori range (0-800)');
    if (String(retroInputs.dayNote || '').length > 240) errors.push('Day note troppo lunga');
    if (String(retroInputs.workoutNote || '').length > 240) errors.push('Workout note troppo lunga');
    return errors;
  }, [retroInputs]);
  const retroCanSave = retroValidationErrors.length === 0;

  useEffect(() => {
    if (!selectedCanEdit) return;
    const src = chronoLogs[selectedChronoIndex]?.log || {};
    setRetroInputs({
      consumed: toNumber(src.consumed, 0),
      waterMl: toNumber(src.waterMl, 0),
      workoutBurn: toNumber(src.workoutBurn ?? src.burned, 0),
      strength: toNumber(src.strength, 0),
      mealBreakfastKcal: toNumber(src.mealBreakfastKcal, 0),
      mealLunchKcal: toNumber(src.mealLunchKcal, 0),
      mealDinnerKcal: toNumber(src.mealDinnerKcal, 0),
      dayNote: String(src.dayNote || '').slice(0, 240),
      workoutNote: String(src.workoutNote || '').slice(0, 240),
      skincareMorning: Boolean(src.skincareMorning),
      skincareEvening: Boolean(src.skincareEvening)
    });
  }, [selectedChronoIndex, selectedCanEdit, chronoLogs]);
  useEffect(() => {
    setRetroQuickFeedback('');
  }, [selectedDay?.iso]);

  const buildLogByOffset = (offsetDays) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Math.max(0, Number(offsetDays || 0)));
    return createCalendarEmptyLog(date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));
  };

  const ensureDayTracked = (offsetDays, prevLogs) => {
    const safeOffset = Math.max(0, Math.round(Number(offsetDays || 0)));
    const source = Array.isArray(prevLogs) ? prevLogs : [];
    if (!source.length) {
      const fresh = [];
      for (let off = safeOffset; off >= 0; off -= 1) {
        fresh.push(buildLogByOffset(off));
      }
      return { logs: fresh, index: fresh.length - 1 - safeOffset };
    }
    if (safeOffset <= source.length - 1) {
      return { logs: [...source], index: source.length - 1 - safeOffset };
    }
    const addCount = safeOffset - (source.length - 1);
    const prepend = [];
    for (let off = source.length - 1 + addCount; off >= source.length; off -= 1) {
      prepend.push(buildLogByOffset(off));
    }
    const extended = [...prepend, ...source];
    return { logs: extended, index: extended.length - 1 - safeOffset };
  };

  const ensureSelectedDayWritable = () => {
    if (!selectedDay?.iso || !selectedCanEdit || typeof setSystemLogs !== 'function') return;
    setSystemLogs((prevLogs) => {
      const ensured = ensureDayTracked(selectedDayOffsetDays, prevLogs);
      if (!ensured.logs[ensured.index]) return prevLogs;
      const next = [...ensured.logs];
      const dateKey = toDateKeyFromIso(selectedDay.iso);
      next[ensured.index] = { ...createCalendarEmptyLog(dateKey), ...next[ensured.index], date: dateKey || next[ensured.index].date };
      return next;
    });
  };

  const patchSelectedLog = (updater) => {
    if (!selectedCanEdit || typeof setSystemLogs !== 'function') return;
    setSystemLogs((prevLogs) => {
      const ensured = ensureDayTracked(selectedDayOffsetDays, prevLogs);
      if (!Array.isArray(ensured.logs) || ensured.index < 0 || ensured.index >= ensured.logs.length) return prevLogs;
      const current = ensured.logs[ensured.index] || {};
      const nextPatch = typeof updater === 'function' ? updater(current) : updater;
      const next = [...ensured.logs];
      const after = { ...current, ...nextPatch };
      const safeDate = toDateKeyFromIso(selectedDay?.iso);
      next[ensured.index] = {
        ...createCalendarEmptyLog(safeDate || current.date),
        ...after,
        date: safeDate || after.date || current.date
      };
      setRetroUndoStack((prev) => [...prev.slice(-49), { index: ensured.index, before: current, after: next[ensured.index] }]);
      setRetroRedoStack([]);
      return next;
    });
  };

  const undoRetroEdit = () => {
    if (!retroUndoStack.length || typeof setSystemLogs !== 'function') return;
    const action = retroUndoStack[retroUndoStack.length - 1];
    setSystemLogs((prevLogs) => {
      if (!Array.isArray(prevLogs) || action.index < 0 || action.index >= prevLogs.length) return prevLogs;
      const current = prevLogs[action.index] || {};
      const next = [...prevLogs];
      next[action.index] = { ...current, ...action.before };
      return next;
    });
    setRetroUndoStack((prev) => prev.slice(0, -1));
    setRetroRedoStack((prev) => [...prev.slice(-49), action]);
  };

  const redoRetroEdit = () => {
    if (!retroRedoStack.length || typeof setSystemLogs !== 'function') return;
    const action = retroRedoStack[retroRedoStack.length - 1];
    setSystemLogs((prevLogs) => {
      if (!Array.isArray(prevLogs) || action.index < 0 || action.index >= prevLogs.length) return prevLogs;
      const current = prevLogs[action.index] || {};
      const next = [...prevLogs];
      next[action.index] = { ...current, ...action.after };
      return next;
    });
    setRetroRedoStack((prev) => prev.slice(0, -1));
    setRetroUndoStack((prev) => [...prev.slice(-49), action]);
  };

  const saveRetroInputs = () => {
    if (!selectedCanEdit) return;
    patchSelectedLog((current) => ({
      ...current,
      consumed: Math.max(0, Math.round(toNumber(retroInputs.consumed, 0))),
      waterMl: Math.max(0, Math.round(toNumber(retroInputs.waterMl, 0))),
      workoutBurn: Math.max(0, Math.round(toNumber(retroInputs.workoutBurn, 0))),
      burned: Math.max(0, Math.round(toNumber(retroInputs.workoutBurn, 0))),
      strength: Math.max(0, Math.round(toNumber(retroInputs.strength, 0))),
      mealBreakfastKcal: Math.max(0, Math.round(toNumber(retroInputs.mealBreakfastKcal, 0))),
      mealLunchKcal: Math.max(0, Math.round(toNumber(retroInputs.mealLunchKcal, 0))),
      mealDinnerKcal: Math.max(0, Math.round(toNumber(retroInputs.mealDinnerKcal, 0))),
      dayNote: String(retroInputs.dayNote || '').trim().slice(0, 240),
      workoutNote: String(retroInputs.workoutNote || '').trim().slice(0, 240),
      skincareMorning: Boolean(retroInputs.skincareMorning),
      skincareEvening: Boolean(retroInputs.skincareEvening)
    }));
  };
  const applyRetroQuickCommand = () => {
    const text = String(retroQuickCommand || '').trim().toLowerCase();
    if (!text) {
      setRetroQuickFeedback('Scrivi un comando rapido prima di applicare.');
      return;
    }
    const numeric = Number(String((text.match(/[-+]?\d+(?:[.,]\d+)?/) || [0])[0]).replace(',', '.'));
    const amount = Number.isFinite(numeric) ? Math.round(numeric) : 0;
    if (!amount) {
      setRetroQuickFeedback('Numero non trovato. Esempio: +350 pranzo');
      return;
    }
    const hasBreakfast = /(colaz|breakfast)/.test(text);
    const hasLunch = /(pranzo|lunch)/.test(text);
    const hasDinner = /(cena|dinner)/.test(text);
    const isWater = /(acqua|water|h2o)/.test(text);
    const isWorkout = /(workout|allen|burn|cardio)/.test(text);
    const isStrength = /(forza|strength)/.test(text);
    setRetroInputs((prev) => {
      const next = { ...prev };
      if (isWater) {
        next.waterMl = Math.max(0, toNumber(prev.waterMl, 0) + amount);
      } else if (isWorkout) {
        next.workoutBurn = Math.max(0, toNumber(prev.workoutBurn, 0) + amount);
      } else if (isStrength) {
        next.strength = Math.max(0, toNumber(prev.strength, 0) + amount);
      } else if (hasBreakfast) {
        next.mealBreakfastKcal = Math.max(0, toNumber(prev.mealBreakfastKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      } else if (hasLunch) {
        next.mealLunchKcal = Math.max(0, toNumber(prev.mealLunchKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      } else if (hasDinner) {
        next.mealDinnerKcal = Math.max(0, toNumber(prev.mealDinnerKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      } else {
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      }
      return next;
    });
    setRetroQuickFeedback(`Applicato: ${amount > 0 ? '+' : ''}${amount} (${text})`);
    setRetroQuickCommand('');
  };
  const applyAgendaAddEvent = () => {
    const amount = Math.max(0, Math.round(toNumber(agendaAddAmount, 0)));
    const note = String(agendaAddNote || '').trim();
    if (!amount && !note) {
      setRetroQuickFeedback('Inserisci almeno quantità o nota per aggiungere evento.');
      return;
    }
    setRetroInputs((prev) => {
      const next = { ...prev };
      if (agendaAddType === 'water') {
        next.waterMl = Math.max(0, toNumber(prev.waterMl, 0) + amount);
      } else if (agendaAddType === 'workout') {
        next.workoutBurn = Math.max(0, toNumber(prev.workoutBurn, 0) + amount);
      } else if (agendaAddType === 'strength') {
        next.strength = Math.max(0, toNumber(prev.strength, 0) + amount);
      } else if (agendaAddType === 'meal_breakfast') {
        next.mealBreakfastKcal = Math.max(0, toNumber(prev.mealBreakfastKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      } else if (agendaAddType === 'meal_dinner') {
        next.mealDinnerKcal = Math.max(0, toNumber(prev.mealDinnerKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      } else {
        next.mealLunchKcal = Math.max(0, toNumber(prev.mealLunchKcal, 0) + amount);
        next.consumed = Math.max(0, toNumber(prev.consumed, 0) + amount);
      }
      if (note) {
        const currentDay = String(prev.dayNote || '').trim();
        next.dayNote = `${currentDay}${currentDay ? ' • ' : ''}${note}`.slice(0, 240);
      }
      return next;
    });
    setRetroQuickFeedback('Evento agenda aggiunto. Premi Salva giorno per confermare.');
    setAgendaAddAmount(0);
    setAgendaAddNote('');
  };

  const jumpRetroDay = (delta) => {
    if (!Number.isFinite(selectedDayOffsetDays)) return;
    const nextOffset = Math.max(0, Math.round(selectedDayOffsetDays - delta));
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - nextOffset);
    const nextIso = toIsoDate(nextDate);
    const live = logsByIso.get(nextIso);
    const nextLog = live?.log || null;
    const payload = {
      date: nextDate,
      iso: nextIso,
      inYear: nextDate.getFullYear() === selectedYear,
      score: getDayScore(nextLog, dailyGoal, hydrationGoal, 'all'),
      maxScore: getModeMaxScore('all'),
      sourceIndex: Number.isFinite(live?.sourceIndex) ? live.sourceIndex : -1,
      log: nextLog
    };
    setSelectedHeatmapDay(null);
    setSelectedMonthDay(payload);
    setSelectedYear(nextDate.getFullYear());
    setSelectedMonth(nextDate.getMonth());
  };
  const selectedTimelineEvents = useMemo(() => {
    const items = [];
    const breakfast = toNumber(retroInputs.mealBreakfastKcal, 0);
    const lunch = toNumber(retroInputs.mealLunchKcal, 0);
    const dinner = toNumber(retroInputs.mealDinnerKcal, 0);
    const water = toNumber(retroInputs.waterMl, 0);
    const workout = toNumber(retroInputs.workoutBurn, 0);
    if (breakfast > 0) items.push({ id: 'breakfast', label: 'Colazione', value: `${breakfast} kcal`, tone: 'text-amber-200 border-amber-300/40' });
    if (lunch > 0) items.push({ id: 'lunch', label: 'Pranzo', value: `${lunch} kcal`, tone: 'text-amber-200 border-amber-300/40' });
    if (dinner > 0) items.push({ id: 'dinner', label: 'Cena', value: `${dinner} kcal`, tone: 'text-amber-200 border-amber-300/40' });
    if (water > 0) items.push({ id: 'water', label: 'Acqua', value: `${water} ml`, tone: 'text-cyan-200 border-cyan-300/40' });
    if (workout > 0) items.push({ id: 'workout', label: 'Workout', value: `${workout} kcal`, tone: 'text-fuchsia-200 border-fuchsia-300/40' });
    if (Boolean(retroInputs.skincareMorning)) items.push({ id: 'skam', label: 'Skincare AM', value: 'Done', tone: 'text-emerald-200 border-emerald-300/40' });
    if (Boolean(retroInputs.skincareEvening)) items.push({ id: 'skpm', label: 'Skincare PM', value: 'Done', tone: 'text-emerald-200 border-emerald-300/40' });
    return items;
  }, [retroInputs]);
  const deltaClass = (value) => (value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-gray-400');
  const formatDelta = (value, suffix = '') => {
    if (!Number.isFinite(value) || value === 0) return `0${suffix}`;
    return `${value > 0 ? '+' : ''}${value}${suffix}`;
  };
  const updateGoal = (key, value) => {
    const next = {
      ...monthGoals,
      [key]: clamp(toNumber(value, monthGoals[key]), 1, 31)
    };
    setMonthGoals(next);
    localStorage.setItem('shadow_monarch_calendar_goals', JSON.stringify(next));
  };
  const buildHeatmapCanvas = () => {
    const cell = 10;
    const gap = 3;
    const rows = 7;
    const cols = heatmapWeeks.length;
    const leftPad = 28;
    const topPad = 46;
    const legendPad = 46;
    const width = leftPad + (cols * (cell + gap)) + 24;
    const height = topPad + (rows * (cell + gap)) + legendPad;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Shadow Heatmap ${selectedYear} (${heatmapMode.toUpperCase()})`, 12, 18);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Workout:${monthMetrics.workouts}  Forza max:${monthMetrics.maxStrength || '--'}  H2O adh:${monthMetrics.hydrationAdherence}%`, 12, 33);
    heatmapWeeks.forEach((week, wi) => {
      week.forEach((day, di) => {
        const x = leftPad + (wi * (cell + gap));
        const y = topPad + (di * (cell + gap));
        const color = day.inYear ? HEAT_COLORS[day.level] : '#0b0d12';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cell, cell);
      });
    });
    ctx.fillStyle = '#9ca3af';
    WEEKDAY_SHORT.forEach((name, idx) => {
      if (idx % 2 === 0) ctx.fillText(name.slice(0, 1), 8, topPad + (idx * (cell + gap)) + 8);
    });
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Less', 12, height - 14);
    HEAT_COLORS.forEach((color, i) => {
      const x = 44 + (i * 14);
      ctx.fillStyle = color;
      ctx.fillRect(x, height - 22, 10, 10);
    });
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('More', 44 + (HEAT_COLORS.length * 14) + 4, height - 14);
    return canvas;
  };
  const exportHeatmapPng = () => {
    const canvas = buildHeatmapCanvas();
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-heatmap-${selectedYear}-${heatmapMode}.png`;
    a.click();
  };
  const exportCalendarPdf = () => {
    const canvas = buildHeatmapCanvas();
    if (!canvas) return;
    const imageUrl = canvas.toDataURL('image/png');
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Shadow Calendar Report ${selectedYear}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1020; color: #e5e7eb; margin: 24px; }
          .card { border: 1px solid #334155; background: #0f172a; padding: 14px; margin-bottom: 14px; border-radius: 8px; }
          h1 { margin: 0 0 10px; font-size: 22px; color: #c4b5fd; }
          h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #67e8f9; }
          p { margin: 4px 0; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .tile { border: 1px solid #374151; padding: 8px; font-size: 12px; background: #111827; }
          img { width: 100%; max-width: 980px; border: 1px solid #334155; border-radius: 8px; }
          @media print {
            body { background: #fff; color: #111827; }
            .card, .tile, img { border-color: #d1d5db; background: #fff; }
          }
        </style>
      </head>
      <body>
        <h1>Shadow Calendar Report ${selectedYear}</h1>
        <div class="card">
          <h2>Heatmap</h2>
          <p>Modalità: ${String(heatmapMode).toUpperCase()}</p>
          <img src="${imageUrl}" alt="Heatmap annuale" />
        </div>
        <div class="card">
          <h2>Insight</h2>
          <p>Mese migliore: ${insights.bestMonthLabel} (${insights.bestMonthWorkouts} workout)</p>
          <p>Settimana più forte: ${insights.strongestWeek} (forza media ${insights.strongestWeekScore || '--'})</p>
          <p>Giorno più costante: ${insights.bestWeekday}</p>
        </div>
        <div class="card">
          <h2>Obiettivi Mese</h2>
          <div class="grid">
            <div class="tile">Workout: ${monthMetrics.workouts}/${monthGoals.workouts} (${goalProgress.workoutsPct}%)</div>
            <div class="tile">Hydration days: ${monthMetrics.hydrationDays}/${monthGoals.hydrationDays} (${goalProgress.hydrationPct}%)</div>
            <div class="tile">Skincare days: ${monthMetrics.skincareDays}/${monthGoals.skincareDays} (${goalProgress.skincarePct}%)</div>
            <div class="tile">Forza media/max: ${monthMetrics.avgStrength || '--'} / ${monthMetrics.maxStrength || '--'}</div>
          </div>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;
    const w = window.open('', '_blank', 'width=1100,height=860');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };
  const exportPeriodCsv = () => {
    const headers = [
      'isoDate', 'kcal', 'waterMl', 'workoutBurn', 'strength',
      'mealBreakfastKcal', 'mealLunchKcal', 'mealDinnerKcal',
      'skincareMorning', 'skincareEvening', 'workoutType', 'workoutTags',
      'workoutNote', 'dayNote'
    ];
    const rows = [headers.join(',')];
    periodLogs.forEach((entry) => {
      const log = entry?.log || {};
      const row = [
        entry?.iso || '',
        toNumber(log.consumed, 0),
        toNumber(log.waterMl, 0),
        toNumber(log.workoutBurn ?? log.burned, 0),
        toNumber(log.strength, 0),
        toNumber(log.mealBreakfastKcal, 0),
        toNumber(log.mealLunchKcal, 0),
        toNumber(log.mealDinnerKcal, 0),
        Boolean(log.skincareMorning) ? 1 : 0,
        Boolean(log.skincareEvening) ? 1 : 0,
        inferWorkoutType(log),
        inferWorkoutTags(log).join('|'),
        String(log.workoutNote || '').slice(0, 240),
        String(log.dayNote || '').slice(0, 240)
      ].map((value) => JSON.stringify(value));
      rows.push(row.join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-period-${periodDays}d-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 pt-10 pb-24 min-h-full">
      <div className="mb-8">
        <p className="text-gray-500 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Calendar Core</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">CALENDAR</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-sm border border-indigo-300/30 bg-black/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-indigo-200">Periodo Selezionato</p>
          <div className="flex items-center gap-1">
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
                  periodDays === days ? 'border-indigo-300 text-indigo-200 bg-indigo-500/10' : 'border-white/15 text-gray-500'
                }`}
              >
                {days}d
              </button>
            ))}
            <button onClick={exportPeriodCsv} className="text-[9px] px-2 py-1 border border-cyan-300/45 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{periodMetrics.workouts}</p><p className="text-[8px] uppercase text-gray-500">Workout Periodo</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{periodMetrics.avgWater} ml</p><p className="text-[8px] uppercase text-gray-500">Acqua Media</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-amber-200">{periodMetrics.avgCalories}</p><p className="text-[8px] uppercase text-gray-500">Kcal Medie</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-violet-200">{periodMetrics.avgStrength || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Media</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-emerald-200">{periodMetrics.skincareMorning}</p><p className="text-[8px] uppercase text-gray-500">Skincare AM</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-emerald-200">{periodMetrics.skincareEvening}</p><p className="text-[8px] uppercase text-gray-500">Skincare PM</p></div>
        </div>
        <p className="mt-3 text-[10px] text-gray-400 uppercase">Workout totali: {toNumber(playerStats.completedWorkouts, allTimeWorkouts) || allTimeWorkouts}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="mb-6 rounded-sm border border-amber-300/30 bg-black/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-amber-200 mb-2">Confronto 30 Giorni vs 30 Precedenti</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Workout</p>
            <p className="text-white text-sm font-black">{comparison30.current.workouts}</p>
            <p className={`text-[9px] ${deltaClass(comparison30.delta.workouts)}`}>{formatDelta(comparison30.delta.workouts)}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Acqua media</p>
            <p className="text-cyan-200 text-sm font-black">{comparison30.current.avgWater} ml</p>
            <p className={`text-[9px] ${deltaClass(comparison30.delta.avgWater)}`}>{formatDelta(comparison30.delta.avgWater, ' ml')}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Kcal medie</p>
            <p className="text-amber-200 text-sm font-black">{comparison30.current.avgCalories}</p>
            <p className={`text-[9px] ${deltaClass(-comparison30.delta.avgCalories)}`}>{formatDelta(comparison30.delta.avgCalories)}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Forza media</p>
            <p className="text-violet-200 text-sm font-black">{comparison30.current.avgStrength || '--'}</p>
            <p className={`text-[9px] ${deltaClass(comparison30.delta.avgStrength)}`}>{formatDelta(comparison30.delta.avgStrength)}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2 col-span-2">
            <p className="text-[8px] uppercase text-gray-500">Skincare completa (AM+PM)</p>
            <p className="text-emerald-200 text-sm font-black">{comparison30.current.fullSkincareDays} giorni</p>
            <p className={`text-[9px] ${deltaClass(comparison30.delta.fullSkincareDays)}`}>{formatDelta(comparison30.delta.fullSkincareDays)}</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.025 }} className="mb-6 rounded-sm border border-emerald-300/30 bg-black/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200 mb-2">Streak Visuali</p>
        <div className="space-y-2">
          {[
            { id: 'workout', label: 'Workout', tint: 'fuchsia', data: streaks.workout },
            { id: 'hydration', label: 'Acqua Goal', tint: 'cyan', data: streaks.hydration },
            { id: 'skincare', label: 'Skincare AM+PM', tint: 'emerald', data: streaks.skincare }
          ].map((item) => (
            <div key={item.id} className="border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white">{item.label}</p>
                <p className="text-[9px] text-gray-400">Now {item.data.current} • Best {item.data.best}</p>
              </div>
              <div className="mt-1 flex gap-[2px]">
                {item.data.last21.map((ok, idx) => (
                  <span
                    key={`${item.id}-${idx}`}
                    className={`h-2 flex-1 rounded-[1px] border ${ok
                      ? item.tint === 'fuchsia'
                        ? 'bg-fuchsia-300/80 border-fuchsia-200/60'
                        : item.tint === 'cyan'
                          ? 'bg-cyan-300/80 border-cyan-200/60'
                          : 'bg-emerald-300/80 border-emerald-200/60'
                      : 'bg-white/[0.05] border-white/[0.08]'}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.028 }} className="mb-6 rounded-sm border border-fuchsia-300/30 bg-black/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Workout Log</p>
          <p className="text-[9px] uppercase tracking-widest text-white/60">
            Streak now {retroWorkoutStreak.current} • Best {retroWorkoutStreak.best}
          </p>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={workoutLogMonthFilter}
            onChange={(e) => setWorkoutLogMonthFilter(e.target.value)}
            className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1"
          >
            <option value="all">All Months</option>
            {workoutLogMonthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <select
            value={workoutLogTypeFilter}
            onChange={(e) => setWorkoutLogTypeFilter(e.target.value)}
            className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1"
          >
            {workoutLogTypeOptions.map((type) => (
              <option key={`wtype-${type}`} value={type}>{type}</option>
            ))}
          </select>
          <input
            value={workoutLogSearch}
            onChange={(e) => setWorkoutLogSearch(e.target.value)}
            placeholder="search note/tag"
            className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1"
          />
          <p className="text-[9px] uppercase tracking-widest text-gray-400">{filteredWorkoutLogEntries.length} entry</p>
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {filteredWorkoutLogEntries.length ? filteredWorkoutLogEntries.map((entry) => (
            <button
              key={`workout-log-${entry.iso}`}
              onClick={() => {
                setSelectedHeatmapDay(null);
                setSelectedMonthDay({
                  date: entry.date,
                  iso: entry.iso,
                  inYear: true,
                  score: getDayScore(entry.log, dailyGoal, hydrationGoal, 'all'),
                  maxScore: getModeMaxScore('all'),
                  sourceIndex: entry.sourceIndex,
                  log: entry.log
                });
                setSelectedYear(entry.date.getFullYear());
                setSelectedMonth(entry.date.getMonth());
              }}
              className="w-full border border-white/10 bg-white/5 p-2 text-left hover:border-fuchsia-300/45 hover:bg-fuchsia-500/10"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white">{entry.date.toLocaleDateString('it-IT')}</p>
                <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Burn {Math.round(toNumber(entry.log?.workoutBurn ?? entry.log?.burned, 0))}</p>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {inferWorkoutTags(entry.log).map((tag) => (
                  <span
                    key={`${entry.iso}-${tag}`}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setWorkoutLogTypeFilter(tag);
                    }}
                    className="inline-block border border-cyan-300/40 bg-cyan-500/10 px-2 py-[2px] text-[9px] uppercase tracking-widest text-cyan-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-gray-300 mt-1">
                Strength {toNumber(entry.log?.strength, 0) || '--'} • Kcal {toNumber(entry.log?.consumed, 0)} • H2O {toNumber(entry.log?.waterMl, 0)} ml
              </p>
              {entry.log?.workoutNote ? (
                <p className="text-[9px] text-fuchsia-100 mt-1">Note: {String(entry.log.workoutNote).slice(0, 120)}</p>
              ) : null}
            </button>
          )) : (
            <p className="text-[10px] text-gray-500">Nessun workout trovato con questi filtri.</p>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="mb-6 rounded-sm border border-cyan-300/30 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1">
            <button onClick={() => setSelectedYear((y) => y - 1)} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">Y-</button>
            <button onClick={() => setSelectedYear((y) => y + 1)} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">Y+</button>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">{MONTHS_IT[selectedMonth]} {selectedYear}</p>
          <div className="flex gap-1">
            <button onClick={() => setSelectedMonth((m) => (m + 11) % 12)} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">M-</button>
            <button onClick={() => setSelectedMonth((m) => (m + 1) % 12)} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">M+</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_SHORT.map((day) => <p key={day} className="text-[9px] text-gray-500 uppercase text-center">{day}</p>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.map((cell, idx) => {
            if (!cell) return <div key={`blank-${idx}`} className="h-16 border border-transparent"></div>;
            const kcal = toNumber(cell.log?.consumed, 0);
            const water = toNumber(cell.log?.waterMl, 0);
            const strength = toNumber(cell.log?.strength, 0);
            const selected = selectedMonthDay?.iso === toIsoDate(cell.date);
            return (
              <button
                key={`${cell.day}-${idx}`}
                onClick={() => setSelectedMonthDay({ ...cell, iso: cell.iso, inYear: true, score: getDayScore(cell.log, dailyGoal, hydrationGoal, 'all'), maxScore: 5 })}
                className={`h-16 border p-1 text-left transition ${selected ? 'ring-1 ring-cyan-300/80' : ''} ${cell.workout ? 'border-fuchsia-300/60 bg-fuchsia-500/10' : 'border-white/10 bg-white/5'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-white">{cell.day}</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setSelectedHeatmapDay(null);
                        setSelectedMonthDay({ ...cell, iso: cell.iso, inYear: true, score: getDayScore(cell.log, dailyGoal, hydrationGoal, 'all'), maxScore: 5 });
                      }}
                      className="text-[8px] px-1 border border-cyan-300/40 text-cyan-200 hover:bg-cyan-300 hover:text-black"
                    >
                      +
                    </button>
                    {cell.workout ? <span className="text-[8px] text-fuchsia-200">W</span> : null}
                  </div>
                </div>
                <p className="text-[8px] text-cyan-200 leading-tight">{kcal > 0 ? `${kcal}k` : '--'}</p>
                <p className="text-[8px] text-emerald-200 leading-tight">{water > 0 ? `${Math.round(water / 100) / 10}L` : '--'}</p>
                <p className="text-[8px] text-violet-200 leading-tight">{strength > 0 ? `S${strength}` : '--'}</p>
                <div className="mt-[1px] flex gap-[2px]">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cell.log?.skincareMorning ? 'bg-emerald-300' : 'bg-white/20'}`}></span>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cell.log?.skincareEvening ? 'bg-cyan-300' : 'bg-white/20'}`}></span>
                </div>
              </button>
            );
          })}
        </div>
        {selectedDay ? (
          <div className="mt-3 border border-cyan-300/30 bg-black/45 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-cyan-200">
                {selectedDay.date.toLocaleDateString('it-IT')} • score {selectedDay.score}/{selectedDay.maxScore}
              </p>
              <button onClick={() => { setSelectedMonthDay(null); setSelectedHeatmapDay(null); }} className="text-[9px] px-2 py-1 border border-white/20 text-gray-300 uppercase tracking-widest">Clear</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-[9px] text-gray-500 uppercase">Kcal</p>
                <p className="text-sm font-black text-amber-200">{toNumber(selectedDay.log?.consumed, 0)}</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-[9px] text-gray-500 uppercase">Acqua</p>
                <p className="text-sm font-black text-cyan-200">{toNumber(selectedDay.log?.waterMl, 0)} ml</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-[9px] text-gray-500 uppercase">Forza</p>
                <p className="text-sm font-black text-violet-200">{toNumber(selectedDay.log?.strength, 0) || '--'}</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-[9px] text-gray-500 uppercase">Workout</p>
                <p className={`text-sm font-black ${isWorkout(selectedDay.log) ? 'text-fuchsia-200' : 'text-gray-400'}`}>{isWorkout(selectedDay.log) ? 'Completato' : 'No'}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-emerald-300">
              Skincare AM: {selectedDay.log?.skincareMorning ? 'OK' : 'No'} • PM: {selectedDay.log?.skincareEvening ? 'OK' : 'No'}
            </p>
            {selectedCanEdit && selectedChronoIndex < 0 ? (
              <div className="mt-2 border border-cyan-300/35 bg-cyan-500/10 p-2">
                <p className="text-[9px] text-cyan-100 uppercase tracking-widest mb-1">Giorno non ancora tracciato</p>
                <button onClick={ensureSelectedDayWritable} className="text-[9px] px-2 py-1 border border-cyan-300/45 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
                  Crea timeline giorno
                </button>
              </div>
            ) : null}
            {selectedIsFuture ? (
              <p className="mt-2 text-[10px] uppercase tracking-widest text-rose-300">Giorno futuro: non modificabile</p>
            ) : null}
            {selectedCanEdit ? (
              <div className="mt-3 border border-fuchsia-300/25 bg-black/35 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[9px] uppercase tracking-widest text-fuchsia-200">Retro Editor</p>
                  <div className="flex gap-1">
                    <button onClick={undoRetroEdit} disabled={!retroUndoStack.length} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${retroUndoStack.length ? 'border-cyan-300/40 text-cyan-200' : 'border-gray-700 text-gray-500'}`}>Undo</button>
                    <button onClick={redoRetroEdit} disabled={!retroRedoStack.length} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${retroRedoStack.length ? 'border-cyan-300/40 text-cyan-200' : 'border-gray-700 text-gray-500'}`}>Redo</button>
                    <button onClick={() => jumpRetroDay(-1)} className="text-[9px] px-2 py-1 border border-fuchsia-300/35 text-fuchsia-200 uppercase tracking-widest">Prev</button>
                    <button onClick={() => jumpRetroDay(1)} className="text-[9px] px-2 py-1 border border-fuchsia-300/35 text-fuchsia-200 uppercase tracking-widest">Next</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="text-[9px] uppercase text-gray-400">Kcal
                    <input type="number" value={retroInputs.consumed} onChange={(e) => setRetroInputs((prev) => ({ ...prev, consumed: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Acqua ml
                    <input type="number" value={retroInputs.waterMl} onChange={(e) => setRetroInputs((prev) => ({ ...prev, waterMl: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Workout burn
                    <input type="number" value={retroInputs.workoutBurn} onChange={(e) => setRetroInputs((prev) => ({ ...prev, workoutBurn: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Strength
                    <input type="number" value={retroInputs.strength} onChange={(e) => setRetroInputs((prev) => ({ ...prev, strength: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <label className="text-[9px] uppercase text-gray-400">Breakfast
                    <input type="number" value={retroInputs.mealBreakfastKcal} onChange={(e) => setRetroInputs((prev) => ({ ...prev, mealBreakfastKcal: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Lunch
                    <input type="number" value={retroInputs.mealLunchKcal} onChange={(e) => setRetroInputs((prev) => ({ ...prev, mealLunchKcal: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Dinner
                    <input type="number" value={retroInputs.mealDinnerKcal} onChange={(e) => setRetroInputs((prev) => ({ ...prev, mealDinnerKcal: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </label>
                </div>
                <div className="mb-2 border border-cyan-300/25 bg-cyan-500/10 p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[9px] uppercase tracking-widest text-cyan-200">+ Add Evento (Agenda)</p>
                    <p className="text-[9px] uppercase tracking-widest text-cyan-100">One Tap</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select value={agendaAddType} onChange={(e) => setAgendaAddType(e.target.value)} className="bg-black/50 border border-white/10 text-white text-[10px] uppercase tracking-widest px-2 py-2">
                      <option value="meal_breakfast">Meal Breakfast</option>
                      <option value="meal_lunch">Meal Lunch</option>
                      <option value="meal_dinner">Meal Dinner</option>
                      <option value="water">Acqua</option>
                      <option value="workout">Workout Burn</option>
                      <option value="strength">Strength</option>
                    </select>
                    <input type="number" value={agendaAddAmount} onChange={(e) => setAgendaAddAmount(e.target.value)} placeholder="quantita" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
                  </div>
                  <div className="flex gap-2">
                    <input value={agendaAddNote} onChange={(e) => setAgendaAddNote(e.target.value)} placeholder="nota evento (opzionale)" className="flex-1 bg-black/50 border border-white/10 text-white text-xs p-2" />
                    <button onClick={applyAgendaAddEvent} className="text-[9px] px-2 py-2 border border-cyan-300/45 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
                      + Add
                    </button>
                  </div>
                </div>
                <div className="mb-2 border border-indigo-300/25 bg-indigo-500/10 p-2">
                  <p className="text-[9px] uppercase tracking-widest text-indigo-200 mb-1">Timeline Day</p>
                  {selectedTimelineEvents.length ? (
                    <div className="grid grid-cols-2 gap-1">
                      {selectedTimelineEvents.map((item) => (
                        <div key={item.id} className={`border px-2 py-1 ${item.tone}`}>
                          <p className="text-[9px] uppercase tracking-widest">{item.label}</p>
                          <p className="text-[10px] font-black">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400">Nessun evento. Usa i quick add o il comando rapido.</p>
                  )}
                </div>
                <div className="mb-2 border border-violet-300/25 bg-violet-500/10 p-2">
                  <p className="text-[9px] uppercase tracking-widest text-violet-200 mb-1">Quick Command Retro</p>
                  <div className="flex gap-2">
                    <input
                      value={retroQuickCommand}
                      onChange={(e) => setRetroQuickCommand(e.target.value)}
                      placeholder="+350 pranzo | +400 acqua | -120 cena"
                      className="flex-1 bg-black/50 border border-white/10 text-white text-xs p-2"
                    />
                    <button onClick={applyRetroQuickCommand} className="text-[9px] px-2 py-2 border border-violet-300/45 text-violet-200 uppercase tracking-widest hover:bg-violet-300 hover:text-black">
                      Applica
                    </button>
                  </div>
                  {retroQuickFeedback ? <p className="mt-1 text-[9px] text-violet-100">{retroQuickFeedback}</p> : null}
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, workoutBurn: Math.max(220, toNumber(prev.workoutBurn, 0)), strength: Math.max(35, toNumber(prev.strength, 0)) }))} className="text-[9px] px-2 py-1 border border-fuchsia-300/45 text-fuchsia-200 uppercase tracking-widest">+Workout</button>
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, workoutBurn: 0, strength: 0 }))} className="text-[9px] px-2 py-1 border border-rose-300/45 text-rose-200 uppercase tracking-widest">No Workout</button>
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, waterMl: toNumber(prev.waterMl, 0) + 250 }))} className="text-[9px] px-2 py-1 border border-cyan-300/45 text-cyan-200 uppercase tracking-widest">+250ml</button>
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, consumed: toNumber(prev.consumed, 0) + 450, mealBreakfastKcal: toNumber(prev.mealBreakfastKcal, 0) + 450 }))} className="text-[9px] px-2 py-1 border border-amber-300/45 text-amber-200 uppercase tracking-widest">+Colazione</button>
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, consumed: toNumber(prev.consumed, 0) + 650, mealLunchKcal: toNumber(prev.mealLunchKcal, 0) + 650 }))} className="text-[9px] px-2 py-1 border border-amber-300/45 text-amber-200 uppercase tracking-widest">+Pranzo</button>
                  <button onClick={() => setRetroInputs((prev) => ({ ...prev, consumed: toNumber(prev.consumed, 0) + 550, mealDinnerKcal: toNumber(prev.mealDinnerKcal, 0) + 550 }))} className="text-[9px] px-2 py-1 border border-amber-300/45 text-amber-200 uppercase tracking-widest">+Cena</button>
                </div>
                <div className="mb-2 flex items-center gap-3 text-[10px] uppercase tracking-widest">
                  <label className="flex items-center gap-1 text-emerald-200">
                    <input type="checkbox" checked={retroInputs.skincareMorning} onChange={(e) => setRetroInputs((prev) => ({ ...prev, skincareMorning: e.target.checked }))} />
                    Skincare AM
                  </label>
                  <label className="flex items-center gap-1 text-cyan-200">
                    <input type="checkbox" checked={retroInputs.skincareEvening} onChange={(e) => setRetroInputs((prev) => ({ ...prev, skincareEvening: e.target.checked }))} />
                    Skincare PM
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 mb-2">
                  <label className="text-[9px] uppercase text-gray-400">Workout note
                    <textarea value={retroInputs.workoutNote} onChange={(e) => setRetroInputs((prev) => ({ ...prev, workoutNote: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2 h-16" placeholder="Esempio: upper body, energia alta, progressione ottima..." />
                  </label>
                  <label className="text-[9px] uppercase text-gray-400">Day note
                    <textarea value={retroInputs.dayNote} onChange={(e) => setRetroInputs((prev) => ({ ...prev, dayNote: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2 h-16" placeholder="Note generali giornata, digestione, sonno, fame..." />
                  </label>
                </div>
                {(selectedDay.log?.workoutNote || selectedDay.log?.dayNote) ? (
                  <div className="mb-2 border border-white/10 bg-white/5 p-2">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Note salvate</p>
                    {selectedDay.log?.workoutNote ? <p className="text-[10px] text-fuchsia-100">Workout: {selectedDay.log.workoutNote}</p> : null}
                    {selectedDay.log?.dayNote ? <p className="text-[10px] text-cyan-100">Day: {selectedDay.log.dayNote}</p> : null}
                  </div>
                ) : null}
                {!retroCanSave ? (
                  <div className="mb-2 border border-rose-300/35 bg-rose-500/10 p-2">
                    {retroValidationErrors.map((error) => (
                      <p key={error} className="text-[9px] text-rose-200">{error}</p>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    onClick={saveRetroInputs}
                    disabled={!retroCanSave}
                    className={`flex-1 text-[9px] px-2 py-2 border uppercase tracking-widest ${retroCanSave ? 'border-emerald-300/45 text-emerald-200 hover:bg-emerald-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}
                  >
                    Salva giorno
                  </button>
                  <button onClick={() => patchSelectedLog({ consumed: 0, waterMl: 0, workoutBurn: 0, burned: 0, strength: 0, mealBreakfastKcal: 0, mealLunchKcal: 0, mealDinnerKcal: 0, workoutNote: '', dayNote: '', skincareMorning: false, skincareEvening: false })} className="flex-1 text-[9px] px-2 py-2 border border-gray-300/30 text-gray-300 uppercase tracking-widest hover:bg-white/10">Reset giorno</button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-500">Modifica non disponibile</p>
            )}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-violet-200">{monthMetrics.avgStrength || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Media Mese</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-fuchsia-200">{monthMetrics.maxStrength || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Max Mese</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{monthMetrics.workouts}</p><p className="text-[8px] uppercase text-gray-500">Workout Mese</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{monthMetrics.hydrationAdherence}%</p><p className="text-[8px] uppercase text-gray-500">Hydration Adh.</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-sm border border-fuchsia-300/30 bg-black/40 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Heatmap Annuale</p>
          <div className="flex gap-1">
            <button onClick={exportHeatmapPng} className="text-[9px] px-2 py-1 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Export PNG</button>
            <button onClick={exportCalendarPdf} className="text-[9px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Export PDF</button>
          </div>
        </div>
        <div className="mb-2 flex gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'workout', label: 'Workout' },
            { id: 'water', label: 'Acqua' },
            { id: 'skincare', label: 'Skincare' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setHeatmapMode(mode.id)}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
                heatmapMode === mode.id ? 'border-fuchsia-300/60 text-fuchsia-200 bg-fuchsia-500/10' : 'border-white/15 text-gray-500'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="mb-2 overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-flow-col auto-cols-[11px] gap-[3px]">
              {heatmapWeeks.map((week, wi) => (
                <div key={`w-${wi}`} className="grid grid-rows-7 gap-[3px]">
                  {week.map((day, di) => {
                    const color = !day.inYear
                      ? 'bg-white/[0.03] border-white/[0.04]'
                      : day.level >= 5
                        ? 'bg-emerald-300/90 border-emerald-200/70'
                        : day.level === 4
                          ? 'bg-cyan-300/80 border-cyan-200/70'
                          : day.level === 3
                            ? 'bg-indigo-300/70 border-indigo-200/60'
                            : day.level === 2
                              ? 'bg-violet-300/60 border-violet-200/60'
                              : day.level === 1
                                ? 'bg-amber-300/55 border-amber-200/60'
                                : 'bg-white/[0.05] border-white/[0.08]';
                    return (
                      <div
                        key={`d-${wi}-${di}`}
                        title={`${day.date.toLocaleDateString('it-IT')} • score ${day.score}/${day.maxScore}`}
                        onClick={() => {
                          setSelectedMonthDay(null);
                          setSelectedHeatmapDay(day);
                        }}
                        className={`h-[11px] w-[11px] rounded-[2px] border ${color}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2 text-[9px] uppercase tracking-widest text-gray-400">
          <span className="text-gray-500">Less</span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-white/[0.08] bg-white/[0.05]"></span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-amber-200/60 bg-amber-300/55"></span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-violet-200/60 bg-violet-300/60"></span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-indigo-200/60 bg-indigo-300/70"></span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-cyan-200/70 bg-cyan-300/80"></span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-emerald-200/70 bg-emerald-300/90"></span>
          <span className="text-gray-500">More</span>
        </div>
        {selectedHeatmapDay?.inYear ? (
          <div className="mb-3 border border-cyan-300/30 bg-black/45 p-2">
            <p className="text-[10px] uppercase tracking-widest text-cyan-200">
              {selectedHeatmapDay.date.toLocaleDateString('it-IT')} • score {selectedHeatmapDay.score}/{selectedHeatmapDay.maxScore}
            </p>
            <p className="text-[10px] text-gray-300 mt-1">
              Workout: {isWorkout(selectedHeatmapDay.log) ? 'Si' : 'No'} • Kcal: {toNumber(selectedHeatmapDay.log?.consumed, 0)} • Acqua: {toNumber(selectedHeatmapDay.log?.waterMl, 0)} ml • Forza: {toNumber(selectedHeatmapDay.log?.strength, 0) || '--'}
            </p>
            <p className="text-[10px] text-emerald-300">
              Skincare AM: {selectedHeatmapDay.log?.skincareMorning ? 'OK' : 'No'} • PM: {selectedHeatmapDay.log?.skincareEvening ? 'OK' : 'No'}
            </p>
          </div>
        ) : null}

        <p className="text-[10px] uppercase tracking-widest text-fuchsia-200 mb-2">Visuale Anno</p>
        <div className="grid grid-cols-3 gap-2">
          {yearOverview.map((month) => (
            <button
              key={month.monthIdx}
              onClick={() => setSelectedMonth(month.monthIdx)}
              className={`border p-2 text-left ${selectedMonth === month.monthIdx ? 'border-fuchsia-300/60 bg-fuchsia-500/10' : 'border-white/10 bg-white/5'}`}
            >
              <p className="text-[9px] uppercase tracking-widest text-white">{MONTHS_IT[month.monthIdx].slice(0, 3)}</p>
              <p className="text-[10px] text-fuchsia-200 mt-1">W: {month.workouts}</p>
              <p className="text-[10px] text-cyan-200">H2O: {month.avgWater} ml</p>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="mb-6 rounded-sm border border-violet-300/30 bg-black/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-violet-200 mb-2">Insight Automatici</p>
        <div className="grid grid-cols-1 gap-2">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[10px] text-violet-100">Mese migliore: <span className="font-black">{insights.bestMonthLabel}</span> ({insights.bestMonthWorkouts} workout)</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[10px] text-violet-100">Settimana piu forte: <span className="font-black">{insights.strongestWeek}</span> (forza media {insights.strongestWeekScore || '--'})</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[10px] text-violet-100">Giorno piu costante: <span className="font-black">{insights.bestWeekday}</span></p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-6 rounded-sm border border-cyan-300/30 bg-black/40 p-4">
        <p className="text-[10px] uppercase tracking-widest text-cyan-200 mb-2">Obiettivi Calendar (Mese)</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <label className="text-[9px] uppercase text-gray-400">Workout
            <input type="number" min="1" max="31" value={monthGoals.workouts} onChange={(e) => updateGoal('workouts', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Hydration Days
            <input type="number" min="1" max="31" value={monthGoals.hydrationDays} onChange={(e) => updateGoal('hydrationDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Skincare Days
            <input type="number" min="1" max="31" value={monthGoals.skincareDays} onChange={(e) => updateGoal('skincareDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-white mb-1">Workout: {monthMetrics.workouts}/{monthGoals.workouts} ({goalProgress.workoutsPct}%)</p>
            <div className="h-2 border border-white/10 bg-white/5"><div className="h-full bg-fuchsia-300" style={{ width: `${goalProgress.workoutsPct}%` }}></div></div>
          </div>
          <div>
            <p className="text-[10px] text-white mb-1">Hydration: {monthMetrics.hydrationDays}/{monthGoals.hydrationDays} ({goalProgress.hydrationPct}%)</p>
            <div className="h-2 border border-white/10 bg-white/5"><div className="h-full bg-cyan-300" style={{ width: `${goalProgress.hydrationPct}%` }}></div></div>
          </div>
          <div>
            <p className="text-[10px] text-white mb-1">Skincare: {monthMetrics.skincareDays}/{monthGoals.skincareDays} ({goalProgress.skincarePct}%)</p>
            <div className="h-2 border border-white/10 bg-white/5"><div className="h-full bg-emerald-300" style={{ width: `${goalProgress.skincarePct}%` }}></div></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Calendar;

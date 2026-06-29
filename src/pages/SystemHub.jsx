import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { playSfx } from '../utils/sfx';
import { speakEvent } from '../utils/voice';
import AnimeStrip from '../components/AnimeStrip';
import { formatAiErrorDetail, parseModelJson, requestSystemAI } from '../utils/aiClient';
import { AI_MODELS, getModelFor, getGlobalModel, setGlobalModel, getTaskOverride, setTaskOverride } from '../utils/aiModels';
import { computeReadinessOutcome, computeSleepCoach, computeWeightTrendGuard, computeWeeklyOverview, evaluateDataQuality } from '../utils/healthLogic';
import { emitShadowFxBurst } from '../utils/fxEvents';
import { emitUiToast } from '../utils/uiEvents';
import { knowledgePrompt } from '../../lib/knowledgeBase.js';
const QUICK_PROTOCOLS = [
  { id: 'nutrition', title: 'Nutrition Lock', desc: 'Chiudi proteine + kcal target', color: 'text-cyan-200 border-cyan-300/30 bg-cyan-500/10' },
  { id: 'hydration', title: 'Hydration Shield', desc: 'Acqua costante durante il giorno', color: 'text-emerald-200 border-emerald-300/30 bg-emerald-500/10' },
  { id: 'training', title: 'Training Trigger', desc: 'Sessione minima per streak viva', color: 'text-orange-200 border-orange-300/30 bg-orange-500/10' }
];
const BLOCK_PROGRAMS = [
  { id: 'cut', label: 'Cut 4W', desc: 'Deficit controllato + mantenimento forza' },
  { id: 'recomp', label: 'Recomp 4W', desc: 'Ricomp. con aderenza alta e volume stabile' },
  { id: 'strength', label: 'Strength 4W', desc: 'Priorita forza con progressione lineare' }
];
const MEAL_TEMPLATES = [
  { id: 'breakfast-pro', label: 'Colazione Pro', slot: 'breakfast', kcal: 520, protein: 34, carbs: 52, fat: 18 },
  { id: 'lunch-balanced', label: 'Pranzo Balance', slot: 'lunch', kcal: 680, protein: 42, carbs: 66, fat: 24 },
  { id: 'snack-light', label: 'Snack Light', kcal: 260, protein: 20, carbs: 22, fat: 9 },
  { id: 'dinner-lean', label: 'Cena Lean', slot: 'dinner', kcal: 610, protein: 46, carbs: 48, fat: 22 }
];
const MEAL_SLOT_META = {
  breakfast: { label: 'Colazione', key: 'mealBreakfastKcal' },
  lunch: { label: 'Pranzo', key: 'mealLunchKcal' },
  dinner: { label: 'Cena', key: 'mealDinnerKcal' },
  snack: { label: 'Merenda', key: 'mealSnackKcal' },
};
const DEFAULT_MICRO_TARGETS = {
  fiberMin: 30,
  satFatMax: 22,
  sugarsMax: 60,
  sodiumMax: 2300,
  potassiumMin: 3500,
  omega3Min: 1200
};
const SUPPLEMENT_CATALOG = [
  { id: 'protein', name: 'Proteine whey/caseina', baseDose: '25-35 g', timing: 'post-workout / snack' },
  { id: 'creatine', name: 'Creatina monoidrato', baseDose: '3-5 g', timing: 'ogni giorno' },
  { id: 'omega3', name: 'Omega-3 (EPA+DHA)', baseDose: '1000-2000 mg', timing: 'pasto principale' },
  { id: 'magnesium', name: 'Magnesio', baseDose: '200-350 mg', timing: 'sera' },
  { id: 'electrolytes', name: 'Elettroliti', baseDose: '1 serving', timing: 'pre/durante/post workout' },
  { id: 'vitd', name: 'Vitamina D3', baseDose: '1000-2000 IU', timing: 'colazione/pranzo' },
  { id: 'multivit', name: 'Multivitaminico', baseDose: '1 cps', timing: 'colazione' },
  { id: 'probiotic', name: 'Probiotico', baseDose: '1 cps', timing: 'mattina' }
];
const getDefaultMealSlot = () => {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 17) return 'lunch';
  return 'dinner';
};
const inferMealSlotFromText = (value = '') => {
  const text = String(value || '').toLowerCase();
  if (/(colazione|breakfast|mattina)/.test(text)) return 'breakfast';
  if (/(pranzo|lunch|mezzogiorno)/.test(text)) return 'lunch';
  if (/(cena|dinner|sera|stasera)/.test(text)) return 'dinner';
  return '';
};
const toMetricNumber = (value) => {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const extractMetricByPatterns = (text, patterns = []) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[1] ?? match.groups?.value;
    const value = toMetricNumber(raw);
    if (value > 0) return value;
  }
  return 0;
};
const parseExplicitMealNutrients = (value = '') => {
  const text = String(value || '').toLowerCase();
  if (!text.trim()) return { values: {}, explicitCount: 0, hasCoreMacros: false, hasKcal: false };
  const values = {};
  const extract = (key, patterns, max = 15000, decimals = 0) => {
    const raw = extractMetricByPatterns(text, patterns);
    if (raw <= 0) return;
    const clipped = Math.max(0, Math.min(max, raw));
    values[key] = decimals > 0 ? Number(clipped.toFixed(decimals)) : Math.round(clipped);
  };
  extract('kcal', [/\b(?:kcal|calorie|cal)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/, /(\d+(?:[.,]\d+)?)\s*(?:kcal|calorie|cal)\b/], 5500);
  extract('protein', [/\b(?:proteine|proteina|protein|prot|p)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/, /(\d+(?:[.,]\d+)?)\s*g\s*(?:proteine|proteina|protein|prot)\b/], 500, 1);
  extract('carbs', [/\b(?:carbs?|carbo|carboidrati|cho|c)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/, /(\d+(?:[.,]\d+)?)\s*g\s*(?:carbo|carboidrati|carbs?)\b/], 900, 1);
  extract('fat', [/\b(?:grassi|grassi totali|fat|fats|lipidi|f)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/, /(\d+(?:[.,]\d+)?)\s*g\s*(?:grassi|fat|fats)\b/], 350, 1);
  extract('fiber', [/\b(?:fibre|fibra|fiber)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/], 120, 1);
  extract('satFat', [/\b(?:saturi|grassi saturi|sat(?:\.|urated)?\s*fat)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/], 150, 1);
  extract('monoFat', [/\b(?:mono|monoinsaturi|grassi monoinsaturi)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/], 200, 1);
  extract('polyFat', [/\b(?:poli|poly|poliinsaturi|grassi poliinsaturi)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/], 200, 1);
  extract('sugars', [/\b(?:zuccheri|sugars?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*g)?\b/], 350, 1);
  extract('sodiumMg', [/\b(?:sodio|sodium|na)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/, /(\d+(?:[.,]\d+)?)\s*mg\s*(?:sodio|sodium|na)\b/], 12000);
  extract('potassiumMg', [/\b(?:potassio|potassium|k)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/, /(\d+(?:[.,]\d+)?)\s*mg\s*(?:potassio|potassium|k)\b/], 12000);
  extract('omega3Mg', [/\b(?:omega[\s-]?3)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/], 6000);
  extract('calciumMg', [/\b(?:calcio|calcium|ca)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/], 4000);
  extract('ironMg', [/\b(?:ferro|iron|fe)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/], 200, 1);
  extract('magnesiumMg', [/\b(?:magnesio|magnesium)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*mg)?\b/, /(\d+(?:[.,]\d+)?)\s*mg\s*(?:magnesio|magnesium)\b/], 2000);

  const hasCoreMacros = ['protein', 'carbs', 'fat'].every((key) => Number(values[key] || 0) > 0);
  const hasKcal = Number(values.kcal || 0) > 0;
  if (!hasKcal && hasCoreMacros) {
    values.kcal = Math.round((Number(values.carbs || 0) * 4) + (Number(values.protein || 0) * 4) + (Number(values.fat || 0) * 9));
  }
  return {
    values,
    explicitCount: Object.keys(values).length,
    hasCoreMacros,
    hasKcal
  };
};
const MEAL_NUMERIC_KEYS = ['kcal', 'carbs', 'protein', 'fat', 'fiber', 'satFat', 'monoFat', 'polyFat', 'sugars', 'sodiumMg', 'potassiumMg', 'omega3Mg', 'calciumMg', 'ironMg', 'magnesiumMg'];
const buildFoodReliabilityKey = (value = '') => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9àèéìòù\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !['con', 'per', 'the', 'and', 'una', 'uno', 'del', 'della'].includes(token))
    .slice(0, 5)
    .join(' ');
};
const parsePortionGramsFromText = (value = '') => {
  const text = String(value || '').toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (!match) return 0;
  const grams = toMetricNumber(match[1]);
  if (grams < 20 || grams > 1800) return 0;
  return Math.round(grams);
};
const DAY_TEMPLATES = [
  { id: 'cut', label: 'Cut Day', kcalDelta: -220, proteinMul: 1.1, carbsMul: 0.88, fatsMul: 0.92, waterDelta: 250, objective: 'cut' },
  { id: 'recomp', label: 'Recomp Day', kcalDelta: 0, proteinMul: 1, carbsMul: 1, fatsMul: 1, waterDelta: 0, objective: 'recomp' },
  { id: 'recovery', label: 'Recovery Day', kcalDelta: -120, proteinMul: 1, carbsMul: 0.9, fatsMul: 1.08, waterDelta: 350, objective: 'recomp' }
];
const OBJECTIVE_WEEKEND_DELTA = {
  cut: 220,
  recomp: 300,
  bulk: 360
};
const HEALTH_SYNC_SOURCES = [
  { id: 'apple_health', label: 'Apple Health' },
  { id: 'google_fit', label: 'Google Fit' },
  { id: 'health_connect', label: 'Health Connect' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'fitbit', label: 'Fitbit' },
  { id: 'whoop', label: 'Whoop' },
  { id: 'oura', label: 'Oura' },
  { id: 'custom', label: 'Custom API' }
];
const QUICK_WORKOUT_SPORTS = [
  { id: 'none', label: 'Strength / Gym', met: 5.4 },
  { id: 'run', label: 'Run', met: 9.2 },
  { id: 'football', label: 'Football', met: 8.8 },
  { id: 'bike', label: 'Bike', met: 7.4 },
  { id: 'walk', label: 'Walk', met: 3.8 },
  { id: 'hiit', label: 'HIIT', met: 9.8 }
];
const QUICK_WORKOUT_INTENSITY = [
  { id: 'easy', label: 'Easy', burnMul: 0.88, strengthMul: 0.86 },
  { id: 'medium', label: 'Medium', burnMul: 1, strengthMul: 1 },
  { id: 'hard', label: 'Hard', burnMul: 1.16, strengthMul: 1.18 }
];
const getIsoWeekKey = (value = new Date()) => {
  const date = new Date(value);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};
const getMonthKey = (value = new Date()) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const formatMonthKeyLabel = (monthKey) => {
  const [yearStr, monthStr] = String(monthKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return String(monthKey || '-');
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
};
const parseDdMmToDate = (value) => {
  const text = String(value || '');
  const [dd, mm] = text.split('/');
  const day = Number(dd);
  const month = Number(mm);
  if (!Number.isFinite(day) || !Number.isFinite(month) || day < 1 || day > 31 || month < 1 || month > 12) return null;
  const now = new Date();
  return new Date(now.getFullYear(), month - 1, day);
};
const isWeekendFromDate = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const d = date.getDay();
  return d === 0 || d === 6;
};
const clampPct = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const getBattlePassStreakMultiplier = (streak = 0) => {
  const value = Math.max(0, Number(streak || 0));
  if (value >= 21) return 1.4;
  if (value >= 14) return 1.3;
  if (value >= 7) return 1.2;
  if (value >= 3) return 1.1;
  return 1;
};

const SystemHub = ({ systemLogs, setSystemLogs, dailyGoal, setDailyGoal, hydrationGoal, setHydrationGoal, macroGoals, setMacroGoals, playerStats, setPlayerStats, createEmptyLog, soundEnabled, soundTheme, voiceEnabled, voicePack, crownAnthemEnabled = true, coachMode = false, systemCompactMode = false }) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayData = systemLogs.find((log) => log.date === today) || createEmptyLog(today);
  const [tgSyncStatus, setTgSyncStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shadow_monarch_tg_sync') || 'null'); } catch { return null; }
  });
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const v = JSON.parse(localStorage.getItem('shadow_monarch_tg_sync') || 'null');
        setTgSyncStatus(v);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  const [quickLogDaysBack, setQuickLogDaysBack] = useState(0);
  const quickLogDateObj = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - Math.max(0, Number(quickLogDaysBack || 0)));
    return base;
  }, [quickLogDaysBack]);
  const quickLogDateKey = useMemo(() => quickLogDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }), [quickLogDateObj]);
  const quickLogDateLabel = useMemo(() => quickLogDateObj.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }), [quickLogDateObj]);
  const quickLogData = useMemo(() => (
    systemLogs.find((log) => log.date === quickLogDateKey) || createEmptyLog(quickLogDateKey)
  ), [systemLogs, quickLogDateKey, createEmptyLog]);
  const expNeeded = Math.max((playerStats.level || 1) * 100, 100);
  const expPercentage = Math.min((((playerStats.exp || 0) / expNeeded) * 100), 100);
  const avatarStage = Math.min(Math.floor(((playerStats.level || 1) - 1) / 8) + 1, 8);
  const avatarImagePath = `/avatar${avatarStage}.png`;
  const cheatMealTokenCost = 260;
  const cheatMealTokenKcal = 520;
  const cheatMealTokens = Math.max(0, Number(playerStats?.cheatMealTokens || 0));

  const [goalInput, setGoalInput] = useState(dailyGoal);
  const [activeBurnInput, setActiveBurnInput] = useState('');
  const [quickWorkoutDraftOpen, setQuickWorkoutDraftOpen] = useState(false);
  const [quickWorkoutLastSaved, setQuickWorkoutLastSaved] = useState(null);
  const [quickWorkoutSaving, setQuickWorkoutSaving] = useState(false);
  const [quickWorkoutDraft, setQuickWorkoutDraft] = useState({
    title: '',
    sportId: 'none',
    intensityId: 'medium',
    durationMin: '',
    distanceKm: '',
    rpe: '6',
    reportedKcal: '',
    note: ''
  });
  const [oracleText, setOracleText] = useState(() => localStorage.getItem('shadow_monarch_meal_draft_text') || '');
  const [oracleImage, setOracleImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComparingMeals, setIsComparingMeals] = useState(false);
  const [mealCompareDraft, setMealCompareDraft] = useState(null);
  const [isEstimatingMicroTargets, setIsEstimatingMicroTargets] = useState(false);
  const [aiMealEdit, setAiMealEdit] = useState(null);
  const [aiMealEditMode, setAiMealEditMode] = useState('edit');
  const [mealSlot, setMealSlot] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_meal_draft_slot');
    return saved === 'breakfast' || saved === 'lunch' || saved === 'dinner' ? saved : getDefaultMealSlot();
  });
  const lastKnownWeight = [...systemLogs].reverse().find((log) => (log.weight || 0) > 0)?.weight || 0;
  const [metabolicProfile, setMetabolicProfile] = useState(() => ({
    sex: playerStats.sex || 'male',
    age: playerStats.age || 30,
    heightCm: playerStats.heightCm || 178,
    activityMode: playerStats.activityMode || 'moderate',
    objective: playerStats.objective || 'recomp',
    weightKg: playerStats.currentWeightKg || todayData.weight || lastKnownWeight || 70,
    weekendSplitMode: playerStats.weekendCalorieSplitMode || (playerStats.weekendCalorieBoostEnabled ? 'custom' : 'off'),
    weekendBoostEnabled: Boolean(playerStats.weekendCalorieBoostEnabled || false),
    weekendKcalDelta: Math.max(0, Number(playerStats.weekendCalorieDelta || 0))
  }));
  const [metabolicResult, setMetabolicResult] = useState(null);
  const [readinessInput, setReadinessInput] = useState({
    sleepHours: Number(todayData.sleepHours || 7),
    energy: Number(playerStats.energyLevel || 6),
    stress: Number(playerStats.stressLevel || 4),
    soreness: Number(playerStats.sorenessLevel || 4)
  });
  const [morningCheckin, setMorningCheckin] = useState({
    sleepHours: Number(playerStats.lastMorningCheckin?.sleepHours || todayData.sleepHours || 7),
    sleepQuality: Number(playerStats.lastMorningCheckin?.sleepQuality || todayData.sleepQuality || 7),
    awakenings: Number(playerStats.lastMorningCheckin?.awakenings || todayData.awakenings || 1),
    hrRest: Number(playerStats.lastMorningCheckin?.hrRest || todayData.hrRest || 60),
    hrvMs: Number(playerStats.lastMorningCheckin?.hrvMs || todayData.hrvMs || 45),
    energy: Number(playerStats.lastMorningCheckin?.energy || playerStats.energyLevel || 6),
    stress: Number(playerStats.lastMorningCheckin?.stress || playerStats.stressLevel || 4)
  });
  const [eveningCheckin, setEveningCheckin] = useState({
    hunger: Number(playerStats.lastEveningCheckin?.hunger || 5),
    craving: Number(playerStats.lastEveningCheckin?.craving || 5),
    eveningEnergy: Number(playerStats.lastEveningCheckin?.eveningEnergy || 6),
    bloating: Number(playerStats.lastEveningCheckin?.bloating || todayData.bloatingLevel || 4),
    digestion: Number(playerStats.lastEveningCheckin?.digestion || todayData.digestionRegularity || 6),
    tolerance: Number(playerStats.lastEveningCheckin?.tolerance || todayData.mealTolerance || 7),
    stress: Number(playerStats.lastEveningCheckin?.stress || 5),
    dayQuality: Number(playerStats.lastEveningCheckin?.dayQuality || 6),
    notes: ''
  });
  const [bodyGoalInput, setBodyGoalInput] = useState({
    targetWeightKg: Number(playerStats.bodyGoal?.targetWeightKg || 0),
    targetFatPct: Number(playerStats.bodyGoal?.targetFatPct || 0)
  });
  const [microTargets, setMicroTargets] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_micro_targets');
      if (!raw) return DEFAULT_MICRO_TARGETS;
      const parsed = JSON.parse(raw);
      return {
        fiberMin: Math.max(5, Number(parsed?.fiberMin || DEFAULT_MICRO_TARGETS.fiberMin)),
        satFatMax: Math.max(5, Number(parsed?.satFatMax || DEFAULT_MICRO_TARGETS.satFatMax)),
        sugarsMax: Math.max(10, Number(parsed?.sugarsMax || DEFAULT_MICRO_TARGETS.sugarsMax)),
        sodiumMax: Math.max(1200, Number(parsed?.sodiumMax || DEFAULT_MICRO_TARGETS.sodiumMax)),
        potassiumMin: Math.max(1500, Number(parsed?.potassiumMin || DEFAULT_MICRO_TARGETS.potassiumMin)),
        omega3Min: Math.max(250, Number(parsed?.omega3Min || DEFAULT_MICRO_TARGETS.omega3Min))
      };
    } catch (_) {
      return DEFAULT_MICRO_TARGETS;
    }
  });
  const [weeklyGoals, setWeeklyGoals] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_weekly_goals');
      if (!raw) return { trainingDays: 4, hydrationDays: 5, proteinDays: 5, sleepDays: 5, avgSteps: 8000 };
      const parsed = JSON.parse(raw);
      return {
        trainingDays: Math.max(1, Number(parsed?.trainingDays || 4)),
        hydrationDays: Math.max(1, Number(parsed?.hydrationDays || 5)),
        proteinDays: Math.max(1, Number(parsed?.proteinDays || 5)),
        sleepDays: Math.max(1, Number(parsed?.sleepDays || 5)),
        avgSteps: Math.max(2000, Number(parsed?.avgSteps || 8000))
      };
    } catch (_) {
      return { trainingDays: 4, hydrationDays: 5, proteinDays: 5, sleepDays: 5, avgSteps: 8000 };
    }
  });
  const [autoMealAssistEnabled, setAutoMealAssistEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_auto_meal_assist');
      if (raw === null) return true;
      return raw === '1';
    } catch (_) {
      return true;
    }
  });
  const [hardMealGuardEnabled, setHardMealGuardEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_hard_meal_guard');
      if (raw === null) return true;
      return raw === '1';
    } catch (_) {
      return true;
    }
  });
  const [mealCompareAutoApply, setMealCompareAutoApply] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_meal_compare_auto_apply');
      if (raw === null) return true;
      return raw === '1';
    } catch (_) {
      return true;
    }
  });
  const [mealAnalysisErrorSnapshot, setMealAnalysisErrorSnapshot] = useState(null);
  const [recipePrompt, setRecipePrompt] = useState(() => localStorage.getItem('shadow_monarch_recipe_prompt') || '');
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  // Selettore modelli AI (globale + override per funzione)
  const [aiModelGlobal, setAiModelGlobal] = useState(() => getGlobalModel());
  const [aiModelMeal, setAiModelMeal] = useState(() => getTaskOverride('meal'));
  const [aiModelRecipe, setAiModelRecipe] = useState(() => getTaskOverride('recipe'));
  const [aiModelProfile, setAiModelProfile] = useState(() => getTaskOverride('profile'));
  // Analisi profilo profonda (Nemotron)
  const [profileAnalysis, setProfileAnalysis] = useState(() => {
    try { const raw = localStorage.getItem('shadow_monarch_profile_analysis_last'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_generated_recipe');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });
  const [supplementPlanSettings, setSupplementPlanSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_supplement_plan_settings');
      const parsed = raw ? JSON.parse(raw) : {};
      const enabledIds = Array.isArray(parsed?.enabledIds) ? parsed.enabledIds : SUPPLEMENT_CATALOG.map((item) => item.id);
      return {
        enabledIds,
        notes: String(parsed?.notes || '')
      };
    } catch (_) {
      return {
        enabledIds: SUPPLEMENT_CATALOG.map((item) => item.id),
        notes: ''
      };
    }
  });
  const [giQuickFood, setGiQuickFood] = useState('latticini');
  const [giQuickSymptom, setGiQuickSymptom] = useState(5);
  const [giTracker, setGiTracker] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_gi_tracker');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [holdResetToday, setHoldResetToday] = useState(false);
  const oracleImageRef = useRef(null);
  const resetTodayTimerRef = useRef(null);
  const analyzeTimeoutRef = useRef(null);
  const weeklyCrownUnlockTimerRef = useRef(null);
  const [weeklyCrownUnlockFx, setWeeklyCrownUnlockFx] = useState(false);
  const [battlePassTierFx, setBattlePassTierFx] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [isGeneratingCoachPlan, setIsGeneratingCoachPlan] = useState(false);
  const [smartGoalDraft, setSmartGoalDraft] = useState(null);
  const [dailyBriefing, setDailyBriefing] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shadow_monarch_daily_briefing') || 'null'); } catch (_) { return null; }
  });
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [shadowChatMessages, setShadowChatMessages] = useState([]);
  const [shadowChatInput, setShadowChatInput] = useState('');
  const [isShadowChatLoading, setIsShadowChatLoading] = useState(false);
  const shadowChatEndRef = useRef(null);
  const [shadowInsights, setShadowInsights] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shadow_monarch_insights') || 'null'); } catch { return null; }
  });
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [featureFlags, setFeatureFlags] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_feature_flags');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        smartGoalWizard: parsed?.smartGoalWizard !== false,
        bossReady: parsed?.bossReady !== false,
        travelMode: parsed?.travelMode !== false
      };
    } catch (_) {
      return {
        smartGoalWizard: true,
        bossReady: true,
        travelMode: true
      };
    }
  });
  const [collapsedCards, setCollapsedCards] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_system_collapsed_cards');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        timeline: parsed?.timeline !== undefined ? Boolean(parsed.timeline) : true,
        smartCoach: parsed?.smartCoach !== undefined ? Boolean(parsed.smartCoach) : true,
        monthlyBoss: parsed?.monthlyBoss !== undefined ? Boolean(parsed.monthlyBoss) : true,
        healthSync: parsed?.healthSync !== undefined ? Boolean(parsed.healthSync) : true
      };
    } catch (_) {
      return { timeline: true, smartCoach: true, monthlyBoss: true, healthSync: true };
    }
  });
  const [healthIntelThresholds, setHealthIntelThresholds] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_health_thresholds');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        electrolyteMin: Math.max(0.8, Number(parsed?.electrolyteMin || 1.25)),
        recoveryMin: Math.max(30, Number(parsed?.recoveryMin || 58)),
        kcalStabilityMin: Math.max(30, Number(parsed?.kcalStabilityMin || 55)),
        proteinConsistencyMin: Math.max(30, Number(parsed?.proteinConsistencyMin || 60)),
        digestiveMin: Math.max(30, Number(parsed?.digestiveMin || 58))
      };
    } catch (_) {
      return {
        electrolyteMin: 1.25,
        recoveryMin: 58,
        kcalStabilityMin: 55,
        proteinConsistencyMin: 60,
        digestiveMin: 58
      };
    }
  });

  useEffect(() => {
    if (!isAnalyzing) {
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
        analyzeTimeoutRef.current = null;
      }
      return;
    }
    analyzeTimeoutRef.current = setTimeout(() => {
      setIsAnalyzing(false);
      emitUiToast({
        message: 'Analisi troppo lenta: sbloccata in sicurezza, riprova.',
        tone: 'warning',
        durationMs: 4200
      });
    }, 32000);
    return () => {
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
        analyzeTimeoutRef.current = null;
      }
    };
  }, [isAnalyzing]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_meal_draft_text', String(oracleText || ''));
  }, [oracleText]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_meal_draft_slot', String(mealSlot || 'lunch'));
  }, [mealSlot]);
  useEffect(() => {
    const onFocus = () => {
      try {
        const raw = localStorage.getItem('shadow_monarch_feature_flags');
        const parsed = raw ? JSON.parse(raw) : {};
        setFeatureFlags({
          smartGoalWizard: parsed?.smartGoalWizard !== false,
          bossReady: parsed?.bossReady !== false,
          travelMode: parsed?.travelMode !== false
        });
      } catch (_) {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_system_collapsed_cards', JSON.stringify(collapsedCards));
  }, [collapsedCards]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_health_thresholds', JSON.stringify(healthIntelThresholds));
  }, [healthIntelThresholds]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_auto_meal_assist', autoMealAssistEnabled ? '1' : '0');
  }, [autoMealAssistEnabled]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_hard_meal_guard', hardMealGuardEnabled ? '1' : '0');
  }, [hardMealGuardEnabled]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_meal_compare_auto_apply', mealCompareAutoApply ? '1' : '0');
  }, [mealCompareAutoApply]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_recipe_prompt', String(recipePrompt || ''));
  }, [recipePrompt]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_generated_recipe', JSON.stringify(generatedRecipe || null));
  }, [generatedRecipe]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_supplement_plan_settings', JSON.stringify(supplementPlanSettings || {}));
  }, [supplementPlanSettings]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_gi_tracker', JSON.stringify(giTracker || []));
  }, [giTracker]);

  const updateMicroTarget = (key, value) => {
    const next = {
      ...microTargets,
      [key]: Math.max(0, Number(value || 0))
    };
    setMicroTargets(next);
    localStorage.setItem('shadow_monarch_micro_targets', JSON.stringify(next));
  };
  const updateWeeklyGoal = (key, value) => {
    const next = { ...weeklyGoals, [key]: Math.max(0, Number(value || 0)) };
    setWeeklyGoals(next);
    localStorage.setItem('shadow_monarch_weekly_goals', JSON.stringify(next));
  };
  const toggleCardCollapse = (key) => {
    setCollapsedCards((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };
  const updateHealthThreshold = (key, value) => {
    setHealthIntelThresholds((prev) => ({
      ...prev,
      [key]: Math.max(0, Number(value || 0))
    }));
  };
  const sanitizeMicroTargetRecommendation = (raw = {}) => ({
    fiberMin: Math.max(12, Math.min(80, Math.round(Number(raw.fiberMin || raw.fiber_min || DEFAULT_MICRO_TARGETS.fiberMin)))),
    satFatMax: Math.max(8, Math.min(45, Math.round(Number(raw.satFatMax || raw.sat_fat_max || DEFAULT_MICRO_TARGETS.satFatMax)))),
    sugarsMax: Math.max(20, Math.min(140, Math.round(Number(raw.sugarsMax || raw.sugars_max || DEFAULT_MICRO_TARGETS.sugarsMax)))),
    sodiumMax: Math.max(1200, Math.min(5000, Math.round(Number(raw.sodiumMax || raw.sodium_max || DEFAULT_MICRO_TARGETS.sodiumMax)))),
    potassiumMin: Math.max(1800, Math.min(6000, Math.round(Number(raw.potassiumMin || raw.potassium_min || DEFAULT_MICRO_TARGETS.potassiumMin)))),
    omega3Min: Math.max(250, Math.min(3500, Math.round(Number(raw.omega3Min || raw.omega3_min || DEFAULT_MICRO_TARGETS.omega3Min))))
  });

  const saveToSystemForDate = (dateKey, updates) => {
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === dateKey);
      if (idx >= 0) {
        const next = [...prevLogs];
        next[idx] = { ...next[idx], ...updates };
        return next;
      }
      return [...prevLogs, { ...createEmptyLog(dateKey), ...updates }];
    });
  };
  const saveToSystem = (updates) => {
    saveToSystemForDate(today, updates);
  };
  const normalizeAiMealNutrients = (raw = {}) => ({
    kcal: Math.max(0, Number(raw.kcal || 0)),
    carbs: Math.max(0, Number(raw.carbs || 0)),
    protein: Math.max(0, Number(raw.protein || 0)),
    fat: Math.max(0, Number(raw.fat || 0)),
    fiber: Math.max(0, Number(raw.fiber || 0)),
    satFat: Math.max(0, Number(raw.satFat || 0)),
    monoFat: Math.max(0, Number(raw.monoFat || 0)),
    polyFat: Math.max(0, Number(raw.polyFat || 0)),
    sugars: Math.max(0, Number(raw.sugars || 0)),
    sodiumMg: Math.max(0, Number(raw.sodiumMg || 0)),
    potassiumMg: Math.max(0, Number(raw.potassiumMg || 0)),
    omega3Mg: Math.max(0, Number(raw.omega3Mg || 0)),
    calciumMg: Math.max(0, Number(raw.calciumMg || 0)),
    ironMg: Math.max(0, Number(raw.ironMg || 0)),
    magnesiumMg: Math.max(0, Number(raw.magnesiumMg || 0))
  });
  const applyAiMealToDate = (dateKey, nutrients, slot) => {
    const clean = normalizeAiMealNutrients(nutrients);
    const slotMeta = MEAL_SLOT_META[slot] || MEAL_SLOT_META.lunch;
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === dateKey);
      const current = idx >= 0 ? prevLogs[idx] : createEmptyLog(dateKey);
      const nextLog = {
        ...current,
        consumed: Math.max(0, Number(current.consumed || 0) + clean.kcal),
        carbs: Math.max(0, Number(current.carbs || 0) + clean.carbs),
        protein: Math.max(0, Number(current.protein || 0) + clean.protein),
        fatMacros: Math.max(0, Number(current.fatMacros || 0) + clean.fat),
        fiber: Math.max(0, Number(current.fiber || 0) + clean.fiber),
        satFat: Math.max(0, Number(current.satFat || 0) + clean.satFat),
        monoFat: Math.max(0, Number(current.monoFat || 0) + clean.monoFat),
        polyFat: Math.max(0, Number(current.polyFat || 0) + clean.polyFat),
        sugars: Math.max(0, Number(current.sugars || 0) + clean.sugars),
        sodiumMg: Math.max(0, Number(current.sodiumMg || 0) + clean.sodiumMg),
        potassiumMg: Math.max(0, Number(current.potassiumMg || 0) + clean.potassiumMg),
        omega3Mg: Math.max(0, Number(current.omega3Mg || 0) + clean.omega3Mg),
        calciumMg: Math.max(0, Number(current.calciumMg || 0) + clean.calciumMg),
        ironMg: Math.max(0, Number(current.ironMg || 0) + clean.ironMg),
        magnesiumMg: Math.max(0, Number(current.magnesiumMg || 0) + clean.magnesiumMg),
        [slotMeta.key]: Math.max(0, Number(current?.[slotMeta.key] || 0) + clean.kcal)
      };
      if (idx >= 0) {
        const next = [...prevLogs];
        next[idx] = nextLog;
        return next;
      }
      return [...prevLogs, nextLog];
    });
    return clean;
  };
  const applyAiMealEditDiff = (dateKey, prevNutrients, nextNutrients, prevSlot, nextSlot) => {
    const previous = normalizeAiMealNutrients(prevNutrients);
    const next = normalizeAiMealNutrients(nextNutrients);
    const prevSlotMeta = MEAL_SLOT_META[prevSlot] || MEAL_SLOT_META.lunch;
    const nextSlotMeta = MEAL_SLOT_META[nextSlot] || MEAL_SLOT_META.lunch;
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === dateKey);
      const current = idx >= 0 ? prevLogs[idx] : createEmptyLog(dateKey);
      const deltaKcal = next.kcal - previous.kcal;
      const nextLog = {
        ...current,
        consumed: Math.max(0, Number(current.consumed || 0) + deltaKcal),
        carbs: Math.max(0, Number(current.carbs || 0) + (next.carbs - previous.carbs)),
        protein: Math.max(0, Number(current.protein || 0) + (next.protein - previous.protein)),
        fatMacros: Math.max(0, Number(current.fatMacros || 0) + (next.fat - previous.fat)),
        fiber: Math.max(0, Number(current.fiber || 0) + (next.fiber - previous.fiber)),
        satFat: Math.max(0, Number(current.satFat || 0) + (next.satFat - previous.satFat)),
        monoFat: Math.max(0, Number(current.monoFat || 0) + (next.monoFat - previous.monoFat)),
        polyFat: Math.max(0, Number(current.polyFat || 0) + (next.polyFat - previous.polyFat)),
        sugars: Math.max(0, Number(current.sugars || 0) + (next.sugars - previous.sugars)),
        sodiumMg: Math.max(0, Number(current.sodiumMg || 0) + (next.sodiumMg - previous.sodiumMg)),
        potassiumMg: Math.max(0, Number(current.potassiumMg || 0) + (next.potassiumMg - previous.potassiumMg)),
        omega3Mg: Math.max(0, Number(current.omega3Mg || 0) + (next.omega3Mg - previous.omega3Mg)),
        calciumMg: Math.max(0, Number(current.calciumMg || 0) + (next.calciumMg - previous.calciumMg)),
        ironMg: Math.max(0, Number(current.ironMg || 0) + (next.ironMg - previous.ironMg)),
        magnesiumMg: Math.max(0, Number(current.magnesiumMg || 0) + (next.magnesiumMg - previous.magnesiumMg))
      };
      if (prevSlotMeta.key === nextSlotMeta.key) {
        nextLog[prevSlotMeta.key] = Math.max(0, Number(current?.[prevSlotMeta.key] || 0) + deltaKcal);
      } else {
        nextLog[prevSlotMeta.key] = Math.max(0, Number(current?.[prevSlotMeta.key] || 0) - previous.kcal);
        nextLog[nextSlotMeta.key] = Math.max(0, Number(current?.[nextSlotMeta.key] || 0) + next.kcal);
      }
      if (idx >= 0) {
        const nextLogs = [...prevLogs];
        nextLogs[idx] = nextLog;
        return nextLogs;
      }
      return [...prevLogs, nextLog];
    });
  };

  const workoutBurnToday = Math.max(0, Number(todayData.workoutBurn ?? todayData.burned ?? 0));
  const activeBurnToday = Math.max(0, Number(todayData.activeBurn || 0));
  const workoutBurnQuickLog = Math.max(0, Number(quickLogData.workoutBurn ?? quickLogData.burned ?? 0));
  const activeBurnQuickLog = Math.max(0, Number(quickLogData.activeBurn || 0));
  const todayWeekdayIdx = new Date().getDay();
  const isWeekendDay = todayWeekdayIdx === 0 || todayWeekdayIdx === 6;
  const weekendCalorieBoostEnabled = Boolean(playerStats?.weekendCalorieBoostEnabled);
  const weekendCalorieDelta = Math.max(0, Number(playerStats?.weekendCalorieDelta || 0));
  const weekdayCalorieGoal = Math.max(1300, Number(playerStats?.weekendCalorieWeekdayTarget || dailyGoal || 2400));
  const weekendCalorieGoal = Math.max(1300, Number(playerStats?.weekendCalorieWeekendTarget || (weekdayCalorieGoal + weekendCalorieDelta)));
  const averageCalorieGoal = weekendCalorieBoostEnabled
    ? Math.round(((weekdayCalorieGoal * 5) + (weekendCalorieGoal * 2)) / 7)
    : Number(dailyGoal || 2400);
  const getCalorieTargetForDateKey = (dateKey) => {
    if (!weekendCalorieBoostEnabled) return Number(dailyGoal || 2400);
    const parsed = parseDdMmToDate(dateKey);
    if (!parsed) return Number(dailyGoal || 2400);
    return isWeekendFromDate(parsed) ? weekendCalorieGoal : weekdayCalorieGoal;
  };
  const getCalorieTargetForLog = (log) => getCalorieTargetForDateKey(log?.date);
  const effectiveDailyGoal = weekendCalorieBoostEnabled ? (isWeekendDay ? weekendCalorieGoal : weekdayCalorieGoal) : Number(dailyGoal || 0);
  const useActiveBurnForBudget = Boolean(playerStats.useActiveBurnForBudget);
  const burnForBudget = useActiveBurnForBudget && activeBurnToday > 0 ? activeBurnToday : workoutBurnToday;
  const burnForBudgetQuickLog = useActiveBurnForBudget && activeBurnQuickLog > 0 ? activeBurnQuickLog : workoutBurnQuickLog;
  const autoMacroSyncEnabled = playerStats.autoMacroSyncEnabled !== false;
  const macroBurnKcal = autoMacroSyncEnabled ? Math.max(0, burnForBudget) : 0;
  const baseMacroTargets = {
    protein: Math.max(1, Number(macroGoals?.protein || 190)),
    carbs: Math.max(1, Number(macroGoals?.carbs || 220)),
    fats: Math.max(1, Number(macroGoals?.fats || 70))
  };
  const macroBurnAdds = {
    protein: Math.max(0, Math.round((macroBurnKcal * 0.28) / 4)),
    carbs: Math.max(0, Math.round((macroBurnKcal * 0.52) / 4)),
    fats: Math.max(0, Math.round((macroBurnKcal * 0.2) / 9))
  };
  const adaptiveMacroTargets = {
    protein: baseMacroTargets.protein + macroBurnAdds.protein,
    carbs: baseMacroTargets.carbs + macroBurnAdds.carbs,
    fats: baseMacroTargets.fats + macroBurnAdds.fats
  };
  const budgetToday = Number(effectiveDailyGoal || 0) + burnForBudget;
  const consumedToday = Number(todayData.consumed || 0);
  const remainingKcal = budgetToday - consumedToday;
  const consumedPct = Math.max(0, Math.min(100, (consumedToday / Math.max(1, budgetToday)) * 100));
  const budgetQuickLog = Number(getCalorieTargetForDateKey(quickLogDateKey) || 0) + burnForBudgetQuickLog;
  const consumedQuickLog = Number(quickLogData.consumed || 0);
  const remainingKcalQuickLog = budgetQuickLog - consumedQuickLog;
  const consumedPctQuickLog = Math.max(0, Math.min(100, (consumedQuickLog / Math.max(1, budgetQuickLog)) * 100));
  const quickLogIsToday = quickLogDateKey === today;
  const hydrateLeftQuickLog = Math.max(hydrationGoal - Number(quickLogData.waterMl || 0), 0);
  const hydratePctQuickLog = Math.min((Number(quickLogData.waterMl || 0) / Math.max(1, hydrationGoal)) * 100, 100);
  const calorieStateLabelQuickLog = consumedPctQuickLog < 85 ? 'IN TARGET' : consumedPctQuickLog <= 105 ? 'NEAR LIMIT' : 'OVER LIMIT';
  const calorieStateToneQuickLog = consumedPctQuickLog < 85 ? 'text-emerald-200 border-emerald-300/40 bg-emerald-500/10' : consumedPctQuickLog <= 105 ? 'text-amber-200 border-amber-300/40 bg-amber-500/10' : 'text-rose-200 border-rose-300/40 bg-rose-500/10';
  const calorieFxClassQuickLog = consumedPctQuickLog > 105 ? 'calorie-card-over' : consumedPctQuickLog >= 70 && consumedPctQuickLog <= 88 ? 'calorie-card-target' : '';
  const calorieStateLabel = consumedPct < 85 ? 'IN TARGET' : consumedPct <= 105 ? 'NEAR LIMIT' : 'OVER LIMIT';
  const calorieStateTone = consumedPct < 85 ? 'text-emerald-200 border-emerald-300/40 bg-emerald-500/10' : consumedPct <= 105 ? 'text-amber-200 border-amber-300/40 bg-amber-500/10' : 'text-rose-200 border-rose-300/40 bg-rose-500/10';
  const calorieFxClass = consumedPct > 105 ? 'calorie-card-over' : consumedPct >= 70 && consumedPct <= 88 ? 'calorie-card-target' : '';
  const hydrationLeft = Math.max(hydrationGoal - (todayData.waterMl || 0), 0);
  const hydrationPct = Math.min(((todayData.waterMl || 0) / hydrationGoal) * 100, 100);
  const proteinGoal = Math.max(1, adaptiveMacroTargets.protein);
  const nutritionRatio = Math.min(1, Math.max(0, (todayData.protein || 0) / proteinGoal));
  const hydrationRatio = Math.min(1, Math.max(0, (todayData.waterMl || 0) / Math.max(1, hydrationGoal)));
  const sleepRatio = Math.min(1, Math.max(0, (todayData.sleepHours || 0) / 8));
  const trainingRatio = workoutBurnToday >= 180 || playerStats.lastWorkoutDate === today ? 1 : Math.min(1, workoutBurnToday / 180);
  const recoveryRatio = Math.min(1, Math.max(0, (todayData.recoveryScore || 0) / 100));
  const systemPowerScore = Math.round(((nutritionRatio * 0.26) + (hydrationRatio * 0.2) + (sleepRatio * 0.2) + (trainingRatio * 0.2) + (recoveryRatio * 0.14)) * 100);
  const systemForceBonus = Math.min(10, Math.max(0, Math.round((systemPowerScore - 40) / 8)));
  const travelModeEnabled = Boolean(playerStats?.travelModeEnabled);
  const bossReadyBreakdown = {
    nutrition: Math.round(nutritionRatio * 100),
    hydration: Math.round(hydrationRatio * 100),
    recovery: Math.round(((sleepRatio * 0.6) + (recoveryRatio * 0.4)) * 100),
    training: Math.round(trainingRatio * 100),
    consistency: Math.min(100, Math.round(((Number(playerStats?.streak || 0) / 14) * 100)))
  };
  const bossReadyScore = Math.round(
    (bossReadyBreakdown.nutrition * 0.26) +
    (bossReadyBreakdown.hydration * 0.18) +
    (bossReadyBreakdown.recovery * 0.2) +
    (bossReadyBreakdown.training * 0.2) +
    (bossReadyBreakdown.consistency * 0.16)
  );
  const bossReadyTier = bossReadyScore >= 85 ? 'S' : bossReadyScore >= 75 ? 'A' : bossReadyScore >= 60 ? 'B' : bossReadyScore >= 45 ? 'C' : 'D';
  const streak = playerStats.streak || 0;
  const streakRank = streak >= 60 ? 'Mythic' : streak >= 30 ? 'Legend' : streak >= 14 ? 'Elite' : streak >= 7 ? 'Rare' : 'Common';
  const milestoneList = [3, 7, 14, 21, 30, 50];
  const claimedMilestones = playerStats.streakMilestonesClaimed || [];
  const claimableMilestone = milestoneList.find((value) => streak >= value && !claimedMilestones.includes(value));
  const streakQuestDone = (todayData.waterMl || 0) >= Math.round(hydrationGoal * 0.6) && (workoutBurnToday >= 180 || playerStats.lastWorkoutDate === today) && (todayData.consumed || 0) > 0;
  const streakQuestClaimed = playerStats.lastStreakQuestClaimDate === today;
  const shieldTokens = playerStats.streakShieldTokens || 0;
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    const log = systemLogs.find((entry) => entry.date === key);
    const score = ((Number(log?.workoutBurn ?? log?.burned ?? 0) >= 220) ? 1 : 0) + ((log?.waterMl || 0) >= 1800 ? 1 : 0) + ((log?.consumed || 0) > 0 ? 1 : 0);
    return { key, score };
  });
  const checkinTodayIso = new Date().toLocaleDateString('en-CA');
  const weeklyReview = computeWeeklyOverview(systemLogs, {
    dailyGoal,
    hydrationGoal,
    proteinGoal: macroGoals?.protein || 190,
    goalForLog: (log, fallback) => {
      const target = getCalorieTargetForLog(log);
      return Number.isFinite(target) && target > 0 ? target : fallback;
    }
  });
  const currentWeekKey = getIsoWeekKey();
  const currentWeekTrainingSessions = systemLogs.filter((log) => {
    const parsed = parseDdMmToDate(log?.date);
    if (!parsed) return false;
    const isTrainingDay = Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0;
    return isTrainingDay && getIsoWeekKey(parsed) === currentWeekKey;
  }).length;
  const weeklyTargetWorkouts = 4;
  const weeklyCrownPct = Math.min(100, Math.round((currentWeekTrainingSessions / weeklyTargetWorkouts) * 100));
  const weeklyCrownNodes = Array.from({ length: weeklyTargetWorkouts }, (_, idx) => idx < currentWeekTrainingSessions);
  const weeklyCrownRemainingWorkouts = Math.max(0, weeklyTargetWorkouts - currentWeekTrainingSessions);
  const nowForCrown = new Date();
  const todayWeekday = nowForCrown.getDay() === 0 ? 7 : nowForCrown.getDay();
  const weeklyCrownDaysLeft = Math.max(0, 7 - todayWeekday);
  const weeklyCrownUrgencyLabel = weeklyCrownRemainingWorkouts === 0
    ? 'Crown secured: mantieni il ritmo.'
    : `${weeklyCrownRemainingWorkouts} workout mancanti in ${weeklyCrownDaysLeft} giorni`;
  const weeklyCrownUrgencyTone = weeklyCrownRemainingWorkouts === 0
    ? 'text-emerald-200'
    : weeklyCrownRemainingWorkouts > weeklyCrownDaysLeft
      ? 'text-rose-200'
      : 'text-amber-200';
  const weeklyCrownModeClass = weeklyCrownRemainingWorkouts === 0
    ? 'weekly-crown-complete'
    : weeklyCrownDaysLeft <= 2 && weeklyCrownRemainingWorkouts > 0
      ? (weeklyCrownRemainingWorkouts > weeklyCrownDaysLeft ? 'weekly-crown-critical' : 'weekly-crown-warning')
      : 'weekly-crown-safe';
  const weeklyCrownPace = weeklyCrownRemainingWorkouts === 0
    ? 'Pace perfetto'
    : weeklyCrownDaysLeft <= 0
      ? 'Ultima chiamata'
      : weeklyCrownRemainingWorkouts > weeklyCrownDaysLeft
        ? 'Serve boost'
        : 'Pace in controllo';
  const weeklyCrownStreak = Math.max(0, Number(playerStats?.weeklyTrainingStreak || 0));
  const weeklyCrownTier = weeklyCrownStreak >= 24
    ? 'Immortal'
    : weeklyCrownStreak >= 12
      ? 'Legend'
      : weeklyCrownStreak >= 6
        ? 'Elite'
        : weeklyCrownStreak >= 3
          ? 'Rare'
          : 'Starter';
  const weeklyCrownTierTone = weeklyCrownStreak >= 12
    ? 'text-fuchsia-200'
    : weeklyCrownStreak >= 6
      ? 'text-amber-200'
      : 'text-cyan-200';
  const weeklyCrownBadgeTone = weeklyCrownStreak >= 24
    ? 'border-fuchsia-300/60 text-fuchsia-100 bg-fuchsia-500/15 shadow-[0_0_18px_rgba(217,70,239,0.34)]'
    : weeklyCrownStreak >= 12
      ? 'border-violet-300/55 text-violet-100 bg-violet-500/12 shadow-[0_0_16px_rgba(139,92,246,0.28)]'
      : weeklyCrownStreak >= 6
        ? 'border-amber-300/55 text-amber-100 bg-amber-500/12 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
        : weeklyCrownStreak >= 3
          ? 'border-cyan-300/50 text-cyan-100 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.24)]'
          : 'border-white/20 text-gray-300 bg-white/5';
  const weeklyCrownEmblem = weeklyCrownStreak >= 24
    ? '◉'
    : weeklyCrownStreak >= 12
      ? '◆'
      : weeklyCrownStreak >= 6
        ? '▲'
        : weeklyCrownStreak >= 3
          ? '◈'
          : '·';
  const weeklyCrownEmblemClass = weeklyCrownStreak >= 24
    ? 'crown-emblem-mythic'
    : weeklyCrownStreak >= 12
      ? 'crown-emblem-legend'
      : weeklyCrownStreak >= 6
        ? 'crown-emblem-elite'
        : weeklyCrownStreak >= 3
          ? 'crown-emblem-rising'
          : 'crown-emblem-init';
  const weeklyCrownFxLabel = !crownAnthemEnabled
    ? 'OFF'
    : weeklyCrownStreak >= 24
      ? 'IMMORTAL MODE'
      : weeklyCrownStreak >= 12
        ? 'LEGEND MODE'
        : 'ENABLED';
  const weeklyCrownFlames = weeklyCrownStreak > 0 ? `CORE x${Math.min(5, 1 + Math.floor(weeklyCrownStreak / 2))}` : 'INIT';
  const weeklyCrownHistory = useMemo(() => {
    const byWeek = systemLogs.reduce((acc, log) => {
      const parsed = parseDdMmToDate(log?.date);
      if (!parsed) return acc;
      const isTrainingDay = Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0;
      if (!isTrainingDay) return acc;
      const key = getIsoWeekKey(parsed);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Array.from({ length: 8 }, (_, idx) => {
      const weeksAgo = 7 - idx;
      const date = new Date();
      date.setDate(date.getDate() - (weeksAgo * 7));
      const key = getIsoWeekKey(date);
      const sessions = Number(byWeek[key] || 0);
      return {
        key,
        label: weeksAgo === 0 ? 'NOW' : `-${weeksAgo}W`,
        sessions,
        done: sessions >= weeklyTargetWorkouts
      };
    });
  }, [systemLogs, weeklyTargetWorkouts]);
  const weeklyCrownPerfectRun = useMemo(() => {
    let run = 0;
    for (let i = weeklyCrownHistory.length - 1; i >= 0; i -= 1) {
      if (!weeklyCrownHistory[i]?.done) break;
      run += 1;
    }
    return run;
  }, [weeklyCrownHistory]);
  const weeklyCrownMomentumPct = Math.min(100, Math.round((((currentWeekTrainingSessions * 0.72) + (Math.min(weeklyCrownStreak, 10) * 0.28)) / weeklyTargetWorkouts) * 100));
  const dataQualityWarnings = evaluateDataQuality(systemLogs);
  const readiness = computeReadinessOutcome(readinessInput);
  const perfectWeekMetrics = [
    { id: 'kcal', label: 'Kcal', ok: weeklyReview.kcalAdherencePct >= 90 },
    { id: 'hydration', label: 'Hydration', ok: weeklyReview.hydrationAdherencePct >= 90 },
    { id: 'sleep', label: 'Sleep', ok: weeklyReview.avgSleep >= 7 },
    { id: 'training', label: 'Training', ok: weeklyReview.trainingDays >= 4 },
    { id: 'checkin', label: 'Check-in', ok: playerStats.lastEveningCheckinDate === checkinTodayIso || playerStats.lastMorningCheckinDate === checkinTodayIso }
  ];
  const perfectWeekDone = perfectWeekMetrics.filter((item) => item.ok).length;
  const perfectWeekScore = Math.round((perfectWeekDone / perfectWeekMetrics.length) * 100);
  const perfectWeekMissing = perfectWeekMetrics.filter((item) => !item.ok).map((item) => item.label);
  const sleepCoach = computeSleepCoach(systemLogs, readiness.score);
  const weightTrend = computeWeightTrendGuard(systemLogs, playerStats.objective || 'recomp');
  const sortedBodyLogs = useMemo(() => (
    [...systemLogs]
      .map((log) => ({ ...log, parsedDate: parseDdMmToDate(log?.date) }))
      .filter((row) => row.parsedDate)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
  ), [systemLogs]);
  const profileHeightCm = Math.max(0, Number(playerStats?.heightCm || metabolicProfile?.heightCm || 0));
  const profileHeightM = profileHeightCm >= 120 ? (profileHeightCm / 100) : 0;
  const bodyCompositionTrend = useMemo(() => {
    const metricConfig = [
      { id: 'weight', label: 'Peso', unit: 'kg', decimals: 1, prefer: null, getValue: (log) => Number(log?.weight || 0) },
      { id: 'bmi', label: 'BMI', unit: '', decimals: 1, prefer: 'lower', getValue: (log) => (profileHeightM > 0 ? Number(log?.weight || 0) / (profileHeightM * profileHeightM) : 0) },
      { id: 'fat', label: 'Body Fat', unit: '%', decimals: 1, prefer: 'lower', getValue: (log) => Number(log?.fat || 0) },
      { id: 'visceralFat', label: 'Visceral', unit: '', decimals: 1, prefer: 'lower', getValue: (log) => Number(log?.visceralFat || 0) },
      { id: 'leanMass', label: 'Lean Mass', unit: 'kg', decimals: 1, prefer: 'higher', getValue: (log) => Number(log?.leanMass || 0) },
      { id: 'muscleMassKg', label: 'Muscle', unit: 'kg', decimals: 1, prefer: 'higher', getValue: (log) => Number(log?.muscleMassKg || 0) },
      { id: 'bodyWaterPct', label: 'Body Water', unit: '%', decimals: 1, prefer: 'higher', getValue: (log) => Number(log?.bodyWaterPct || 0) },
      { id: 'bmrKcal', label: 'BMR', unit: 'kcal', decimals: 0, prefer: 'higher', getValue: (log) => Number(log?.bmrKcal || 0) }
    ];
    return metricConfig.map((metric) => {
      const points = sortedBodyLogs
        .map((log) => {
          const value = Number(metric.getValue(log) || 0);
          return { date: String(log?.date || ''), value };
        })
        .filter((entry) => entry.value > 0);
      if (!points.length) {
        return {
          ...metric,
          points: [],
          hasData: false,
          current: 0,
          prev: 0,
          delta: 0,
          deltaPct: 0,
          avgRecent: 0,
          sparkline: [],
          status: 'neutral'
        };
      }
      const current = Number(points[points.length - 1].value || 0);
      const prev = Number((points[points.length - 2] || points[points.length - 1]).value || 0);
      const delta = Number((current - prev).toFixed(metric.decimals));
      const deltaPct = prev > 0 ? Number((((current - prev) / prev) * 100).toFixed(2)) : 0;
      const recentSlice = points.slice(-Math.min(points.length, 6));
      const avgRecent = Number((recentSlice.reduce((sum, row) => sum + Number(row.value || 0), 0) / Math.max(1, recentSlice.length)).toFixed(metric.decimals));
      const minVal = Math.min(...recentSlice.map((row) => Number(row.value || 0)));
      const maxVal = Math.max(...recentSlice.map((row) => Number(row.value || 0)));
      const range = Math.max(0.0001, maxVal - minVal);
      const sparkline = recentSlice.map((row) => ({
        date: row.date,
        value: Number(row.value || 0),
        heightPct: clampPct((((Number(row.value || 0) - minVal) / range) * 88) + 12)
      }));
      const status = metric.prefer === 'lower'
        ? (delta <= 0 ? 'good' : 'warn')
        : metric.prefer === 'higher'
          ? (delta >= 0 ? 'good' : 'warn')
          : 'neutral';
      return {
        ...metric,
        points,
        hasData: true,
        current: Number(current.toFixed(metric.decimals)),
        prev: Number(prev.toFixed(metric.decimals)),
        delta,
        deltaPct,
        avgRecent,
        sparkline,
        status
      };
    });
  }, [sortedBodyLogs, profileHeightM]);
  const bodyCompById = useMemo(() => bodyCompositionTrend.reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {}), [bodyCompositionTrend]);
  const bodyCompSummary = useMemo(() => {
    const fatTrend = bodyCompById.fat;
    const visceralTrend = bodyCompById.visceralFat;
    const leanTrend = bodyCompById.leanMass;
    const bmiTrend = bodyCompById.bmi;
    const wins = [];
    const risks = [];
    if (fatTrend?.hasData && fatTrend.delta <= -0.2) wins.push(`BF ${fatTrend.delta}%`);
    if (visceralTrend?.hasData && visceralTrend.delta <= -0.1) wins.push(`Visceral ${visceralTrend.delta}`);
    if (leanTrend?.hasData && leanTrend.delta >= 0.1) wins.push(`Lean +${leanTrend.delta}kg`);
    if (fatTrend?.hasData && fatTrend.delta >= 0.3) risks.push(`BF +${fatTrend.delta}%`);
    if (visceralTrend?.hasData && visceralTrend.delta >= 0.2) risks.push(`Visceral +${visceralTrend.delta}`);
    if (leanTrend?.hasData && leanTrend.delta <= -0.2) risks.push(`Lean ${leanTrend.delta}kg`);
    if (bmiTrend?.hasData && bmiTrend.current >= 29.5) risks.push(`BMI ${bmiTrend.current}`);
    const headline = wins.length
      ? `Trend positivo: ${wins.join(' • ')}`
      : risks.length
        ? `Attenzione: ${risks.join(' • ')}`
        : 'Trend body composition stabile.';
    return { wins, risks, headline };
  }, [bodyCompById]);
  const weightEntries = [...systemLogs]
    .map((log) => Number(log.weight || 0))
    .filter((weight) => weight > 0);
  const weeklyWeightSignal = (() => {
    if (weightEntries.length < 3) {
      return {
        status: 'missing',
        message: 'Servono almeno 3 pesate settimanali per un alert affidabile.',
        deltaKg: 0,
        deltaPct: 0,
        kcalAdjustment: 0
      };
    }
    const last = weightEntries[weightEntries.length - 1];
    const prev = weightEntries[weightEntries.length - 2];
    const prev2 = weightEntries[weightEntries.length - 3];
    const deltaKg = Number((last - prev).toFixed(2));
    const deltaPct = Number((((last - prev) / Math.max(prev, 1)) * 100).toFixed(2));
    const prevPct = Number((((prev - prev2) / Math.max(prev2, 1)) * 100).toFixed(2));
    const obj = String(playerStats.objective || 'recomp').toLowerCase();
    if (obj === 'cut') {
      if (deltaPct <= -1.2 || (deltaPct <= -0.9 && prevPct <= -0.9)) return { status: 'too_fast', message: 'Stai scendendo troppo in fretta (pesata settimanale).', deltaKg, deltaPct, kcalAdjustment: +150 };
      if (deltaPct > -0.2) return { status: 'too_slow', message: 'Calo troppo lento su base settimanale.', deltaKg, deltaPct, kcalAdjustment: -120 };
      return { status: 'good', message: 'Ritmo peso settimanale in range cut.', deltaKg, deltaPct, kcalAdjustment: 0 };
    }
    if (obj === 'bulk') {
      if (deltaPct >= 0.9 || (deltaPct >= 0.75 && prevPct >= 0.75)) return { status: 'too_fast', message: 'Stai salendo troppo in fretta (pesata settimanale).', deltaKg, deltaPct, kcalAdjustment: -140 };
      if (deltaPct < 0.15) return { status: 'too_slow', message: 'Bulk troppo lento su base settimanale.', deltaKg, deltaPct, kcalAdjustment: +120 };
      return { status: 'good', message: 'Ritmo peso settimanale in range bulk.', deltaKg, deltaPct, kcalAdjustment: 0 };
    }
    if (Math.abs(deltaPct) > 0.7) return { status: 'volatile', message: 'Variazione settimanale troppo alta per recomp.', deltaKg, deltaPct, kcalAdjustment: deltaPct > 0 ? -100 : +100 };
    return { status: 'good', message: 'Trend settimanale stabile per recomp.', deltaKg, deltaPct, kcalAdjustment: 0 };
  })();
  const supplementAdvisor = useMemo(() => {
    const stress = Math.max(1, Math.min(10, Number(playerStats?.stressLevel || eveningCheckin?.stress || 5)));
    const energy = Math.max(1, Math.min(10, Number(playerStats?.energyLevel || readinessInput?.energy || 6)));
    const soreness = Math.max(1, Math.min(10, Number(playerStats?.sorenessLevel || readinessInput?.soreness || 4)));
    const sleep = Math.max(0, Number(todayData?.sleepHours || morningCheckin?.sleepHours || 0));
    const trainingBurn = Math.max(0, Number(todayData?.workoutBurn ?? todayData?.burned ?? 0));
    const hydrationGap = Math.max(0, Number(hydrationGoal || 2800) - Number(todayData?.waterMl || 0));
    const suggestions = [];
    suggestions.push({ id: 'protein', name: 'Proteine whey/caseina', timing: 'post-workout o snack', dose: '25-35 g', why: 'supporto recupero muscolare', priority: 1, when: trainingBurn >= 180 });
    suggestions.push({ id: 'creatine', name: 'Creatina monoidrato', timing: 'ogni giorno', dose: '3-5 g', why: 'forza e performance', priority: 1, when: true });
    suggestions.push({ id: 'magnesium', name: 'Magnesio', timing: 'sera', dose: '200-350 mg', why: 'stress/sonno/recupero', priority: 2, when: stress >= 7 || sleep < 7 });
    suggestions.push({ id: 'omega3', name: 'Omega-3 (EPA+DHA)', timing: 'pasto principale', dose: '1000-2000 mg', why: 'infiammazione e salute cardiovascolare', priority: 2, when: soreness >= 6 || stress >= 6 });
    suggestions.push({ id: 'electrolytes', name: 'Elettroliti (Na/K/Mg)', timing: 'durante o post workout', dose: '1 serving', why: 'idratazione/recupero', priority: 2, when: trainingBurn >= 350 || hydrationGap >= 900 });
    suggestions.push({ id: 'vitd', name: 'Vitamina D3', timing: 'colazione/pranzo', dose: '1000-2000 IU', why: 'supporto generale (con esami)', priority: 3, when: energy <= 5 });
    const filtered = suggestions.filter((row) => row.when).sort((a, b) => a.priority - b.priority).slice(0, 4);
    const moodTag = stress >= 8 ? 'stress alto' : energy <= 4 ? 'energia bassa' : soreness >= 7 ? 'recovery duro' : 'assetto stabile';
    return { moodTag, items: filtered };
  }, [playerStats?.stressLevel, playerStats?.energyLevel, playerStats?.sorenessLevel, eveningCheckin?.stress, readinessInput?.energy, readinessInput?.soreness, todayData?.sleepHours, todayData?.workoutBurn, todayData?.burned, todayData?.waterMl, morningCheckin?.sleepHours, hydrationGoal]);
  const enabledSupplementIds = new Set(Array.isArray(supplementPlanSettings?.enabledIds) ? supplementPlanSettings.enabledIds : []);
  const filteredSupplementItems = supplementAdvisor.items.filter((item) => enabledSupplementIds.has(item.id));
  const dailySupplementCore = SUPPLEMENT_CATALOG.filter((item) => enabledSupplementIds.has(item.id));
  const bodyCompCalorieSignal = useMemo(() => {
    const objective = String(playerStats?.objective || metabolicProfile?.objective || 'recomp').toLowerCase();
    const fatTrend = bodyCompById.fat;
    const visceralTrend = bodyCompById.visceralFat;
    const leanTrend = bodyCompById.leanMass;
    const weightDeltaPct = Number(weeklyWeightSignal?.deltaPct || 0);
    let kcalAdjustment = 0;
    const reasons = [];
    if (objective === 'cut') {
      if (fatTrend?.hasData && fatTrend.delta >= 0.3) { kcalAdjustment -= 120; reasons.push('Body fat in salita durante cut'); }
      if (visceralTrend?.hasData && visceralTrend.delta >= 0.2) { kcalAdjustment -= 80; reasons.push('Viscerale in salita'); }
      if (leanTrend?.hasData && leanTrend.delta <= -0.25) { kcalAdjustment += 140; reasons.push('Lean mass in calo rapido'); }
      if (weightDeltaPct <= -1.2) { kcalAdjustment += 90; reasons.push('Peso scende troppo veloce'); }
      if (weightDeltaPct > -0.2 && (!fatTrend?.hasData || fatTrend.delta >= -0.1)) { kcalAdjustment -= 70; reasons.push('Dimagrimento lento'); }
    } else if (objective === 'bulk') {
      if (fatTrend?.hasData && fatTrend.delta >= 0.45) { kcalAdjustment -= 130; reasons.push('Body fat sale troppo'); }
      if (visceralTrend?.hasData && visceralTrend.delta >= 0.25) { kcalAdjustment -= 90; reasons.push('Viscerale sale troppo'); }
      if (leanTrend?.hasData && leanTrend.delta >= 0.2 && (!fatTrend?.hasData || fatTrend.delta <= 0.2)) { kcalAdjustment += 40; reasons.push('Lean gain pulito'); }
      if (weightDeltaPct < 0.15 && (!leanTrend?.hasData || leanTrend.delta < 0.1)) { kcalAdjustment += 110; reasons.push('Bulk lento'); }
    } else {
      if (fatTrend?.hasData && fatTrend.delta >= 0.35 && (!leanTrend?.hasData || leanTrend.delta <= 0.1)) { kcalAdjustment -= 110; reasons.push('Recomp sporca: fat su'); }
      if (leanTrend?.hasData && leanTrend.delta <= -0.2 && (!fatTrend?.hasData || fatTrend.delta <= 0.2)) { kcalAdjustment += 90; reasons.push('Lean in calo'); }
      if (fatTrend?.hasData && fatTrend.delta <= -0.2 && leanTrend?.hasData && leanTrend.delta >= 0.1) { reasons.push('Recomp ottima'); }
    }
    const bounded = Math.max(-220, Math.min(220, Math.round(kcalAdjustment / 10) * 10));
    return {
      kcalAdjustment: bounded,
      reasons: reasons.slice(0, 3),
      hasSignal: reasons.length > 0,
      tone: bounded > 0 ? 'text-emerald-200' : bounded < 0 ? 'text-amber-200' : 'text-cyan-200'
    };
  }, [playerStats?.objective, metabolicProfile?.objective, bodyCompById, weeklyWeightSignal?.deltaPct]);
  const calorieBalanceAdvisor = useMemo(() => {
    const objective = String(playerStats?.objective || metabolicProfile?.objective || 'recomp').toLowerCase();
    const baseGoal = Math.max(1300, Number(dailyGoal || 2400));
    const trainingBurn = Math.max(0, Number(todayData?.workoutBurn ?? todayData?.burned ?? 0));
    const stress = Math.max(1, Math.min(10, Number(playerStats?.stressLevel || readinessInput?.stress || 5)));
    const hunger = Math.max(1, Math.min(10, Number(todayData?.hungerLevel || 5)));
    const sleepHours = Math.max(0, Number(todayData?.sleepHours || 0));
    let delta = 0;
    const reasons = [];
    if (objective === 'cut') {
      if (stress >= 8 || hunger >= 8 || sleepHours < 6.2) { delta += 120; reasons.push('Cut sotto stress alto'); }
      if (trainingBurn >= 450) { delta += 90; reasons.push('Workout intenso'); }
      if (weightTrend?.status === 'too_slow') { delta -= 90; reasons.push('Calo lento'); }
      if (weightTrend?.status === 'too_fast') { delta += 120; reasons.push('Calo troppo rapido'); }
    } else if (objective === 'bulk') {
      if (trainingBurn >= 500) { delta += 140; reasons.push('Volume alto'); }
      if (stress >= 8 || sleepHours < 6.2) { delta -= 80; reasons.push('Recovery basso'); }
      if (weightTrend?.status === 'too_fast') { delta -= 120; reasons.push('Bulk troppo veloce'); }
      if (weightTrend?.status === 'too_slow') { delta += 110; reasons.push('Bulk lento'); }
    } else {
      if (trainingBurn >= 450) { delta += 90; reasons.push('Spesa energetica alta'); }
      if (stress >= 8 || sleepHours < 6.2) { delta += 40; reasons.push('Stress/sonno da proteggere'); }
      if (weightTrend?.status === 'volatile') { delta += (hunger >= 7 ? 60 : -60); reasons.push('Trend volatile'); }
    }
    delta += Number(bodyCompCalorieSignal?.kcalAdjustment || 0);
    const bounded = Math.max(-280, Math.min(280, Math.round(delta / 10) * 10));
    const suggested = Math.max(1300, baseGoal + bounded);
    return {
      baseGoal,
      delta: bounded,
      suggested,
      reasons: reasons.slice(0, 4),
      tone: bounded > 0 ? 'text-emerald-200' : bounded < 0 ? 'text-amber-200' : 'text-cyan-200'
    };
  }, [playerStats?.objective, playerStats?.stressLevel, metabolicProfile?.objective, dailyGoal, todayData?.workoutBurn, todayData?.burned, todayData?.hungerLevel, todayData?.sleepHours, readinessInput?.stress, weightTrend?.status, bodyCompCalorieSignal?.kcalAdjustment]);
  const recoveryLoad3d = [...systemLogs].slice(-3).reduce((sum, log) => sum + Number(log.workoutBurn ?? log.burned ?? 0), 0);
  const recoveryAdvancedScore = Math.max(0, Math.min(100, Math.round((readiness.score * 0.58) + (Math.min(9, sleepCoach.avgSleep || 0) * 5.2) - (Math.min(900, recoveryLoad3d) * 0.018))));
  const recoveryAdvancedLabel = recoveryAdvancedScore >= 78 ? 'Ready High' : recoveryAdvancedScore >= 58 ? 'Ready Medium' : 'Recovery First';
  const normalCalorieGoal = Math.max(1300, Number(playerStats.normalCaloriesTarget || 2400));
  const activeBlockProgram = playerStats.blockProgram || null;
  const blockWeek = activeBlockProgram
    ? Math.min(4, Math.max(1, Math.floor((Date.now() - new Date(activeBlockProgram.startedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1))
    : null;
  const todayIso = new Date().toLocaleDateString('en-CA');
  const adaptiveQuest = playerStats.adaptiveQuest && playerStats.adaptiveQuest.date === todayIso ? playerStats.adaptiveQuest : null;
  const adaptiveQuestProgress = adaptiveQuest ? (
    adaptiveQuest.type === 'hydration' ? Number(todayData.waterMl || 0)
      : adaptiveQuest.type === 'protein' ? Number(todayData.protein || 0)
      : adaptiveQuest.type === 'burned' ? workoutBurnToday
      : Number(todayData.steps || 0)
  ) : 0;
  const adaptiveQuestDone = adaptiveQuest ? adaptiveQuestProgress >= adaptiveQuest.target : false;
  const adherenceHeatmap = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - idx));
    const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    const log = systemLogs.find((entry) => entry.date === key);
    let score = 0;
    const logGoal = getCalorieTargetForLog(log);
    if ((log?.consumed || 0) >= logGoal * 0.8 && (log?.consumed || 0) <= logGoal * 1.15) score += 1;
    if ((log?.waterMl || 0) >= hydrationGoal * 0.8) score += 1;
    if ((Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180)) score += 1;
    return { key, score };
  });
  const bodyGoal = playerStats.bodyGoal || { targetWeightKg: 0, targetFatPct: 0 };
  const currentWeight = Number(todayData.weight || 0) || Number(playerStats.currentWeightKg || 0);
  const profileBMR = (() => {
    const w = currentWeight || Number(playerStats?.currentWeightKg || 0);
    const h = Number(playerStats?.heightCm || metabolicProfile?.heightCm || 0);
    const age = Number(playerStats?.age || metabolicProfile?.age || 0);
    const sex = playerStats?.sex || metabolicProfile?.sex || 'male';
    if (w < 30 || h < 120 || age < 10) return 0;
    const sexAdj = (sex === 'F' || sex === 'female') ? -161 : 5;
    return Math.round((10 * w) + (6.25 * h) - (5 * age) + sexAdj);
  })();
  const goalDeltaKg = bodyGoal.targetWeightKg > 0 && currentWeight > 0 ? Number((bodyGoal.targetWeightKg - currentWeight).toFixed(1)) : 0;
  const trendAbs = Math.abs(Number(weightTrend.weeklyDeltaKg || 0));
  const estimatedWeeksToGoal = bodyGoal.targetWeightKg > 0 && currentWeight > 0 && trendAbs > 0.05
    ? Math.max(1, Math.round(Math.abs(goalDeltaKg) / trendAbs))
    : 0;
  const estimatedGoalDateLabel = estimatedWeeksToGoal
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + (estimatedWeeksToGoal * 7));
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      })()
    : '';
  const calorieDecisionLog = playerStats.calorieDecisionLog || [];
  const showAdvanced = !systemCompactMode;
  const mealToday = {
    breakfast: Number(quickLogData.mealBreakfastKcal || 0),
    lunch: Number(quickLogData.mealLunchKcal || 0),
    dinner: Number(quickLogData.mealDinnerKcal || 0)
  };
  const mealTodayTotal = mealToday.breakfast + mealToday.lunch + mealToday.dinner;
  const meal7d = [...systemLogs].slice(-7).reduce((acc, log) => ({
    breakfast: acc.breakfast + Number(log?.mealBreakfastKcal || 0),
    lunch: acc.lunch + Number(log?.mealLunchKcal || 0),
    dinner: acc.dinner + Number(log?.mealDinnerKcal || 0)
  }), { breakfast: 0, lunch: 0, dinner: 0 });
  const meal7dTotal = meal7d.breakfast + meal7d.lunch + meal7d.dinner;
  const aiMealsHistory = Array.isArray(playerStats?.aiMeals) ? playerStats.aiMeals : [];
  const mealAiReliability = (playerStats?.mealAiReliability && typeof playerStats.mealAiReliability === 'object') ? playerStats.mealAiReliability : {};
  const mealAiFixLog = Array.isArray(playerStats?.mealAiFixLog) ? playerStats.mealAiFixLog : [];
  const portionMemoryMap = (playerStats?.mealPortionMemory && typeof playerStats.mealPortionMemory === 'object') ? playerStats.mealPortionMemory : {};
  const currentFoodReliabilityKey = buildFoodReliabilityKey(oracleText);
  const currentFoodReliability = currentFoodReliabilityKey ? (mealAiReliability?.[currentFoodReliabilityKey] || null) : null;
  const currentFoodReliabilityScore = currentFoodReliability
    ? Math.max(30, Math.min(98, Math.round((Number(currentFoodReliability.ok || 0) / Math.max(1, Number(currentFoodReliability.tries || 1))) * 100)))
    : null;
  const currentPortionMemory = currentFoodReliabilityKey ? (portionMemoryMap?.[currentFoodReliabilityKey] || null) : null;
  const macroVisuals = [
    {
      id: 'protein',
      label: 'Protein',
      unit: 'g',
      value: Number(todayData.protein || 0),
      goal: Number(adaptiveMacroTargets.protein || 190),
      tone: 'text-rose-200',
      fill: 'linear-gradient(90deg, rgba(251,113,133,0.88), rgba(244,63,94,0.96))',
      ringColor: 'rgba(244,63,94,0.95)'
    },
    {
      id: 'carbs',
      label: 'Carbs',
      unit: 'g',
      value: Number(todayData.carbs || 0),
      goal: Number(adaptiveMacroTargets.carbs || 220),
      tone: 'text-amber-200',
      fill: 'linear-gradient(90deg, rgba(251,191,36,0.9), rgba(245,158,11,0.96))',
      ringColor: 'rgba(245,158,11,0.95)'
    },
    {
      id: 'fats',
      label: 'Fats',
      unit: 'g',
      value: Number(todayData.fatMacros || 0),
      goal: Number(adaptiveMacroTargets.fats || 70),
      tone: 'text-yellow-100',
      fill: 'linear-gradient(90deg, rgba(250,204,21,0.9), rgba(234,179,8,0.98))',
      ringColor: 'rgba(234,179,8,0.96)'
    },
    {
      id: 'fiber',
      label: 'Fibre',
      unit: 'g',
      value: Number(todayData.fiber || 0),
      goal: Number(microTargets?.fiberMin || 30),
      tone: 'text-lime-200',
      fill: 'linear-gradient(90deg, rgba(163,230,53,0.88), rgba(101,163,13,0.96))',
      ringColor: 'rgba(132,204,22,0.96)'
    }
  ].map((item) => ({
    ...item,
    pct: Math.max(0, Math.min(100, (item.value / Math.max(1, item.goal)) * 100))
  }));
  const macroRadarScore = Math.round(macroVisuals.reduce((sum, macro) => sum + macro.pct, 0) / Math.max(1, macroVisuals.length));
  const macroRingVisuals = macroVisuals.map((macro) => ({
    ...macro,
    ringStyle: {
      backgroundImage: `conic-gradient(from 220deg, ${macro.ringColor} ${macro.pct}%, rgba(255,255,255,0.08) ${macro.pct}% 100%)`
    }
  }));
  const mealSplitVisual = [
    { id: 'breakfast', label: 'Colazione', kcal: mealToday.breakfast, tone: 'text-fuchsia-200', fill: 'linear-gradient(90deg, rgba(232,121,249,0.9), rgba(217,70,239,0.95))' },
    { id: 'lunch', label: 'Pranzo', kcal: mealToday.lunch, tone: 'text-cyan-200', fill: 'linear-gradient(90deg, rgba(34,211,238,0.9), rgba(14,165,233,0.95))' },
    { id: 'dinner', label: 'Cena', kcal: mealToday.dinner, tone: 'text-emerald-200', fill: 'linear-gradient(90deg, rgba(16,185,129,0.9), rgba(5,150,105,0.95))' }
  ].map((item) => ({
    ...item,
    pct: Math.max(0, Math.min(100, (item.kcal / Math.max(1, mealTodayTotal)) * 100))
  }));
  const recent7 = [...systemLogs].slice(-7);
  const timelineEvents = useMemo(() => {
    const events = [];
    [...systemLogs].forEach((log) => {
      const dateKey = String(log?.date || '');
      const ts = parseDdMmToDate(dateKey)?.getTime() || 0;
      const consumed = Number(log?.consumed || 0);
      const water = Number(log?.waterMl || 0);
      const burn = Number(log?.workoutBurn ?? log?.burned ?? 0);
      const strength = Number(log?.strength || 0);
      if (consumed > 0) {
        events.push({ id: `meal-${dateKey}`, type: 'meal', date: dateKey, ts, title: 'Meal Intake', detail: `${Math.round(consumed)} kcal • P${Math.round(Number(log?.protein || 0))} C${Math.round(Number(log?.carbs || 0))} F${Math.round(Number(log?.fatMacros || 0))}` });
      }
      if (water > 0) {
        events.push({ id: `water-${dateKey}`, type: 'water', date: dateKey, ts, title: 'Hydration', detail: `${Math.round(water)} ml` });
      }
      if (burn > 0 || strength > 0) {
        events.push({ id: `workout-${dateKey}`, type: 'workout', date: dateKey, ts, title: 'Workout', detail: `Burn ${Math.round(burn)} • STR ${Math.round(strength)}` });
      }
      if (log?.skincareMorning || log?.skincareEvening) {
        events.push({ id: `skin-${dateKey}`, type: 'skincare', date: dateKey, ts, title: 'Skincare', detail: `AM ${log?.skincareMorning ? 'OK' : 'No'} • PM ${log?.skincareEvening ? 'OK' : 'No'}` });
      }
      if (log?.dayNote || log?.workoutNote) {
        const noteText = `${String(log?.workoutNote || '')} ${String(log?.dayNote || '')}`.trim().slice(0, 140);
        events.push({ id: `note-${dateKey}`, type: 'note', date: dateKey, ts, title: 'Notes', detail: noteText || 'Note salvate' });
      }
    });
    const search = String(timelineSearch || '').trim().toLowerCase();
    return events
      .filter((item) => timelineFilter === 'all' || item.type === timelineFilter)
      .filter((item) => !search || `${item.title} ${item.detail} ${item.date}`.toLowerCase().includes(search))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 120);
  }, [systemLogs, timelineFilter, timelineSearch]);
  const avgSodium7d = recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.sodiumMg || 0), 0) / recent7.length) : 0;
  const avgPotassium7d = recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.potassiumMg || 0), 0) / recent7.length) : 0;
  const avgOmega37d = recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.omega3Mg || 0), 0) / recent7.length) : 0;
  const avgHrv7d = recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.hrvMs || 0), 0) / recent7.length) : 0;
  const avgRhr7d = recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.hrRest || 0), 0) / recent7.length) : 0;
  const weeklyWeightAvg = (() => {
    const values = recent7.map((log) => Number(log?.weight || 0)).filter((v) => v > 0);
    if (!values.length) return 0;
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
  })();
  const prev7 = [...systemLogs].slice(-14, -7);
  const prevWeeklyWeightAvg = (() => {
    const values = prev7.map((log) => Number(log?.weight || 0)).filter((v) => v > 0);
    if (!values.length) return 0;
    return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
  })();
  const waistCurrent = [...systemLogs].reverse().map((log) => Number(log?.waistCm || 0)).find((v) => v > 0) || 0;
  const waistPrev = [...systemLogs].slice(0, -1).reverse().map((log) => Number(log?.waistCm || 0)).find((v) => v > 0) || 0;
  const recent14 = [...systemLogs].slice(-14);
  const weightTrendPerWeek = (() => {
    const first = Number(recent14[0]?.weight || 0);
    const last = Number(recent14[recent14.length - 1]?.weight || 0);
    if (first <= 0 || last <= 0 || recent14.length < 8) return 0;
    return Number((((last - first) / Math.max(1, recent14.length - 1)) * 7).toFixed(2));
  })();
  const waistTrendPerWeek = (() => {
    const series = recent14.map((log) => Number(log?.waistCm || 0)).filter((value) => value > 0);
    if (series.length < 2) return 0;
    const first = series[0];
    const last = series[series.length - 1];
    return Number((((last - first) / Math.max(1, series.length - 1)) * 7).toFixed(2));
  })();
  const adherenceTrend = Number((
    (weeklyReview.kcalAdherencePct * 0.34) +
    (weeklyReview.hydrationAdherencePct * 0.26) +
    (weeklyReview.proteinAdherencePct * 0.24) +
    (Math.min(100, (weeklyReview.trainingDays / 4) * 100) * 0.16)
  ).toFixed(1));
  const goalForecast = [2, 4, 8].map((weeks) => ({
    weeks,
    weight: weeklyWeightAvg > 0 ? Number((weeklyWeightAvg + (weightTrendPerWeek * weeks)).toFixed(1)) : null,
    waist: waistCurrent > 0 ? Number((waistCurrent + (waistTrendPerWeek * weeks)).toFixed(1)) : null,
    adherence: Math.max(0, Math.min(100, Math.round(adherenceTrend + ((weeks - 2) * 1.2))))
  }));
  const semaforoClass = (status) => (status === 'green' ? 'text-emerald-300' : status === 'yellow' ? 'text-amber-200' : 'text-rose-300');
  const evaluateMin = (value, target) => {
    if (value >= target) return 'green';
    if (value >= target * 0.7) return 'yellow';
    return 'red';
  };
  const evaluateMax = (value, target) => {
    if (value <= target) return 'green';
    if (value <= target * 1.2) return 'yellow';
    return 'red';
  };
  const weeklySemaforo = {
    fiber: evaluateMin(recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.fiber || 0), 0) / recent7.length) : 0, microTargets.fiberMin),
    satFat: evaluateMax(recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.satFat || 0), 0) / recent7.length) : 0, microTargets.satFatMax),
    sugars: evaluateMax(recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.sugars || 0), 0) / recent7.length) : 0, microTargets.sugarsMax),
    sodium: evaluateMax(avgSodium7d, microTargets.sodiumMax),
    potassium: evaluateMin(avgPotassium7d, microTargets.potassiumMin),
    omega3: evaluateMin(avgOmega37d, microTargets.omega3Min)
  };
  const smartNutritionAlerts = [
    avgSodium7d > microTargets.sodiumMax ? 'Sodio medio alto: prova a ridurre cibi ultra-processati.' : null,
    avgPotassium7d > 0 && avgPotassium7d < microTargets.potassiumMin ? 'Potassio medio basso: aggiungi frutta/verdura/legumi.' : null,
    avgOmega37d > 0 && avgOmega37d < microTargets.omega3Min ? 'Omega-3 medio basso: punta a 1-2g/die tra pesce o integrazione.' : null,
    recent7.length >= 3 && recent7.slice(-3).every((log) => Number(log?.fiber || 0) < (microTargets.fiberMin * 0.7)) ? 'Fibre basse 3 giorni di fila: alza vegetali, legumi, cereali integrali.' : null
  ].filter(Boolean);
  const complianceByDayType = useMemo(() => {
    const recent14Logs = [...systemLogs].slice(-14).filter((log) => parseDdMmToDate(log?.date));
    const aggregate = (isWeekend) => {
      const rows = recent14Logs.filter((log) => {
        const parsed = parseDdMmToDate(log?.date);
        return parsed ? isWeekendFromDate(parsed) === isWeekend : false;
      });
      const tracked = rows.length;
      if (!tracked) return { tracked: 0, kcal: 0, water: 0, protein: 0, score: 0 };
      const kcal = Math.round((rows.filter((log) => {
        const consumed = Number(log?.consumed || 0);
        const goal = Math.max(1, Number(getCalorieTargetForLog(log) || effectiveDailyGoal || 2400));
        return consumed >= goal * 0.8 && consumed <= goal * 1.15;
      }).length / tracked) * 100);
      const water = Math.round((rows.filter((log) => Number(log?.waterMl || 0) >= Number(hydrationGoal || 2800) * 0.8).length / tracked) * 100);
      const protein = Math.round((rows.filter((log) => Number(log?.protein || 0) >= Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 190) * 0.8).length / tracked) * 100);
      const score = Math.round((kcal * 0.5) + (water * 0.25) + (protein * 0.25));
      return { tracked, kcal, water, protein, score };
    };
    return {
      weekday: aggregate(false),
      weekend: aggregate(true)
    };
  }, [systemLogs, hydrationGoal, adaptiveMacroTargets?.protein, macroGoals?.protein, effectiveDailyGoal]);
  const hungerGuardrail = useMemo(() => {
    const last3 = recent7.slice(-3);
    if (last3.length < 3) return { active: false, hungerAvg: 0, cravingAvg: 0, recommendation: '' };
    const hungerAvg = Number((last3.reduce((sum, log) => sum + Number(log?.hungerLevel || 0), 0) / last3.length).toFixed(1));
    const cravingAvg = Number((last3.reduce((sum, log) => sum + Number(log?.cravingLevel || 0), 0) / last3.length).toFixed(1));
    const active = hungerAvg >= 7 || cravingAvg >= 7;
    const recommendation = active
      ? 'Fame alta 3 giorni: alza fibre/proteine e valuta +120 kcal nei giorni di allenamento.'
      : 'Fame sotto controllo.';
    return { active, hungerAvg, cravingAvg, recommendation };
  }, [recent7]);
  const performanceNutritionLink = useMemo(() => {
    const rows = [...systemLogs]
      .map((log) => ({ ...log, parsed: parseDdMmToDate(log?.date) }))
      .filter((row) => row.parsed)
      .sort((a, b) => a.parsed.getTime() - b.parsed.getTime());
    const pairs = [];
    for (let i = 1; i < rows.length; i += 1) {
      const todayRow = rows[i];
      const prevRow = rows[i - 1];
      const trained = Number(todayRow?.workoutBurn ?? todayRow?.burned ?? 0) >= 180 || Number(todayRow?.strength || 0) > 0;
      if (!trained) continue;
      pairs.push({
        prevCarbs: Number(prevRow?.carbs || 0),
        prevProtein: Number(prevRow?.protein || 0),
        todayStrength: Number(todayRow?.strength || 0)
      });
    }
    if (!pairs.length) return { ready: false, message: 'Servono piu giorni con workout loggato.' };
    const carbCut = Number(adaptiveMacroTargets?.carbs || macroGoals?.carbs || 220) * 0.8;
    const proteinCut = Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 190) * 0.8;
    const highFuel = pairs.filter((p) => p.prevCarbs >= carbCut && p.prevProtein >= proteinCut);
    const lowFuel = pairs.filter((p) => p.prevCarbs < carbCut || p.prevProtein < proteinCut);
    const avg = (arr, key) => arr.length ? Number((arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length).toFixed(1)) : 0;
    const highStrength = avg(highFuel, 'todayStrength');
    const lowStrength = avg(lowFuel, 'todayStrength');
    return {
      ready: true,
      highCount: highFuel.length,
      lowCount: lowFuel.length,
      highStrength,
      lowStrength,
      delta: Number((highStrength - lowStrength).toFixed(1)),
      message: highFuel.length && lowFuel.length
        ? (highStrength >= lowStrength ? 'Nei giorni high-fuel la forza tende a salire.' : 'Nei giorni low-fuel non perdi forza: puoi ottimizzare i carbo.')
        : 'Servono piu campioni misti high/low fuel.'
    };
  }, [systemLogs, adaptiveMacroTargets?.carbs, adaptiveMacroTargets?.protein, macroGoals?.carbs, macroGoals?.protein]);
  const hydrationIntel = useMemo(() => {
    const recent3 = [...systemLogs].slice(-3);
    const avgBurn3 = recent3.length
      ? recent3.reduce((sum, log) => sum + Number(log?.workoutBurn ?? log?.burned ?? 0), 0) / recent3.length
      : 0;
    const avgSodium = recent7.length
      ? recent7.reduce((sum, log) => sum + Number(log?.sodiumMg || 0), 0) / recent7.length
      : 0;
    const month = new Date().getMonth() + 1;
    const seasonHeat = [6, 7, 8].includes(month) ? 220 : [5, 9].includes(month) ? 110 : 0;
    const sodiumExtra = avgSodium > 2600 ? 180 : avgSodium > 2100 ? 90 : 0;
    const trainingExtra = Math.min(700, Math.round(avgBurn3 * 0.45));
    const bodyBase = Math.max(1800, Math.round(Number(playerStats?.currentWeightKg || todayData?.weight || 70) * 33));
    const target = Math.max(1800, Math.min(5200, bodyBase + seasonHeat + sodiumExtra + trainingExtra));
    return {
      target,
      breakdown: { base: bodyBase, heat: seasonHeat, sodium: sodiumExtra, training: trainingExtra }
    };
  }, [systemLogs, recent7, playerStats?.currentWeightKg, todayData?.weight]);
  const refeedSmart = useMemo(() => {
    const objective = String(playerStats?.objective || metabolicProfile?.objective || 'recomp');
    const recoveryLow = recoveryAdvancedScore < 58 || Number(sleepCoach?.avgSleep || 0) < 6.7;
    const highStress = Number(playerStats?.stressLevel || 5) >= 7;
    const highHunger = hungerGuardrail.active;
    const eligible = objective === 'cut' && (recoveryLow || highStress || highHunger);
    const refeedKcal = Math.round(Math.max(1300, effectiveDailyGoal + 260));
    const carbsAdd = 55;
    return {
      eligible,
      refeedKcal,
      carbsAdd,
      reason: eligible ? 'Cut + stress/recovery/fame alta: meglio refeed controllato.' : 'Nessun refeed necessario oggi.'
    };
  }, [playerStats?.objective, metabolicProfile?.objective, recoveryAdvancedScore, sleepCoach?.avgSleep, playerStats?.stressLevel, hungerGuardrail.active, effectiveDailyGoal]);
  const giInsights = useMemo(() => {
    const entries = Array.isArray(giTracker) ? giTracker.slice(0, 50) : [];
    if (!entries.length) return { top: [], note: 'Nessun trigger GI registrato.' };
    const byFood = {};
    entries.forEach((entry) => {
      const key = String(entry?.food || 'altro');
      if (!byFood[key]) byFood[key] = { food: key, count: 0, symptomAvg: 0 };
      byFood[key].count += 1;
      byFood[key].symptomAvg += Number(entry?.symptom || 0);
    });
    const top = Object.values(byFood)
      .map((row) => ({ ...row, symptomAvg: Number((row.symptomAvg / Math.max(1, row.count)).toFixed(1)) }))
      .sort((a, b) => b.symptomAvg - a.symptomAvg || b.count - a.count)
      .slice(0, 3);
    return {
      top,
      note: top.length ? `Trigger principale: ${top[0].food} (sym ${top[0].symptomAvg}/10)` : 'Pattern non ancora chiaro.'
    };
  }, [giTracker]);
  const smartWeeklyCoachActions = [
    weeklyReview.kcalAdherencePct < 80 ? `Kcal adherence bassa (${weeklyReview.kcalAdherencePct}%): usa 1 meal template fisso per 3 giorni.` : null,
    weeklyReview.hydrationAdherencePct < 80 ? `Idratazione bassa (${weeklyReview.hydrationAdherencePct}%): imposta 2 trigger acqua (mattina/pomeriggio).` : null,
    weeklyReview.trainingDays < 3 ? `Training giorni bassi (${weeklyReview.trainingDays}/7): pianifica 3 sessioni da 20-35 min.` : null,
    weeklyReview.avgSleep < 7 ? `Sonno medio ${weeklyReview.avgSleep}h: anticipa sleep window di 25-30 minuti.` : null,
    smartNutritionAlerts.length ? `Nutrizione: priorita su ${smartNutritionAlerts[0]}` : null
  ].filter(Boolean).slice(0, 3);
  const trendGuardSignals = [
    weightTrend.status === 'too_fast' ? 'Peso: variazione troppo rapida, valuta +kcal e recovery.' : null,
    weightTrend.status === 'too_slow' ? 'Peso: progresso lento, rivedi intake o volume allenante.' : null,
    weeklyWeightSignal.status === 'volatile' ? 'Peso: andamento volatile su base settimanale.' : null,
    recent7.slice(-3).length === 3 && recent7.slice(-3).every((log) => Number(log?.waterMl || 0) < hydrationGoal * 0.7) ? 'Acqua: 3 giorni sotto target.' : null,
    recent7.slice(-3).length === 3 && recent7.slice(-3).every((log) => Number(log?.protein || 0) < Number(macroGoals?.protein || 190) * 0.75) ? 'Proteine: 3 giorni sotto target.' : null
  ].filter(Boolean).slice(0, 4);
  const foodMemorySuggestions = Array.from(
    new Set(
      aiMealsHistory
        .map((entry) => String(entry?.sourceText || '').trim())
        .filter((text) => text && text !== 'manual_edit' && text.length >= 6)
    )
  ).slice(0, 6);
  const perfectRecent3Days = recent7.slice(-3).filter((log) => {
    const kcalGoalForLog = getCalorieTargetForLog(log);
    const inKcal = Number(log?.consumed || 0) >= kcalGoalForLog * 0.8 && Number(log?.consumed || 0) <= kcalGoalForLog * 1.15;
    const inWater = Number(log?.waterMl || 0) >= hydrationGoal * 0.8;
    const inProtein = Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8;
    return inKcal && inWater && inProtein;
  }).length;
  const victoryLoopReady = perfectRecent3Days >= 3;
  const victoryLoopClaimedToday = playerStats.lastVictoryLoopClaimDate === todayIso;
  const monthlyBossReport = playerStats?.monthlyBossReport || null;
  const weeklyGoalProgress = {
    trainingDays: recent7.filter((log) => Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0).length,
    hydrationDays: recent7.filter((log) => Number(log?.waterMl || 0) >= hydrationGoal * 0.8).length,
    proteinDays: recent7.filter((log) => Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8).length,
    sleepDays: recent7.filter((log) => Number(log?.sleepHours || 0) >= 7).length,
    avgSteps: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.steps || 0), 0) / recent7.length) : 0
  };
  const battlePassState = (playerStats?.battlePass && typeof playerStats.battlePass === 'object') ? playerStats.battlePass : {};
  const battlePassDailyClaims = (battlePassState?.dailyClaims && typeof battlePassState.dailyClaims === 'object') ? battlePassState.dailyClaims : {};
  const todayBattlePassClaims = (battlePassDailyClaims?.[today] && typeof battlePassDailyClaims[today] === 'object') ? battlePassDailyClaims[today] : {};
  const battlePassMissions = [
    {
      id: 'bp_hydration',
      label: `Hydration ≥ ${Math.round(hydrationGoal * 0.8)} ml`,
      done: Number(todayData?.waterMl || 0) >= hydrationGoal * 0.8,
      claimed: Boolean(todayBattlePassClaims.bp_hydration),
      reward: { exp: 18, gold: 14 }
    },
    {
      id: 'bp_protein',
      label: `Protein ≥ ${Math.round(Number(adaptiveMacroTargets?.protein || 190) * 0.8)} g`,
      done: Number(todayData?.protein || 0) >= Number(adaptiveMacroTargets?.protein || 190) * 0.8,
      claimed: Boolean(todayBattlePassClaims.bp_protein),
      reward: { exp: 20, gold: 16 }
    },
    {
      id: 'bp_training',
      label: 'Workout day (burn/strength)',
      done: Number(todayData?.workoutBurn ?? todayData?.burned ?? 0) >= 180 || Number(todayData?.strength || 0) > 0 || playerStats?.lastWorkoutDate === today,
      claimed: Boolean(todayBattlePassClaims.bp_training),
      reward: { exp: 24, gold: 20 }
    }
  ];
  const battlePassWeekProgress = (() => {
    const byDate = Object.entries(battlePassDailyClaims || {})
      .filter(([dateKey]) => getIsoWeekKey(parseDdMmToDate(dateKey) || new Date()) === currentWeekKey);
    let points = 0;
    byDate.forEach(([, claims]) => {
      points += Object.values(claims || {}).filter(Boolean).length;
    });
    return Math.max(0, points);
  })();
  const battlePassWeekTarget = 12;
  const battlePassWeeklyClaimed = String(battlePassState?.weeklyClaimWeek || '') === String(currentWeekKey);
  const battlePassStreakCurrent = Math.max(0, Number(battlePassState?.streakCurrent || 0));
  const battlePassStreakBest = Math.max(battlePassStreakCurrent, Number(battlePassState?.streakBest || 0));
  const battlePassRewardMultiplier = getBattlePassStreakMultiplier(battlePassStreakCurrent);
  const weeklyFiberDays = recent7.filter((log) => Number(log?.fiber || 0) >= Number(microTargets?.fiberMin || 30)).length;
  const weeklyMissionPack = playerStats?.weeklyMissionPack?.weekKey === currentWeekKey
    ? playerStats.weeklyMissionPack
    : null;
  const getWeeklyMissionProgress = (type) => {
    if (type === 'training_days') return Number(weeklyGoalProgress.trainingDays || 0);
    if (type === 'hydration_days') return Number(weeklyGoalProgress.hydrationDays || 0);
    if (type === 'protein_days') return Number(weeklyGoalProgress.proteinDays || 0);
    if (type === 'sleep_days') return Number(weeklyGoalProgress.sleepDays || 0);
    if (type === 'steps_avg') return Number(weeklyGoalProgress.avgSteps || 0);
    if (type === 'fiber_days') return Number(weeklyFiberDays || 0);
    return 0;
  };
  const weeklyMissionProgress = weeklyMissionPack
    ? (weeklyMissionPack.missions || []).map((mission) => {
        const progress = getWeeklyMissionProgress(mission.type);
        return {
          ...mission,
          progress,
          done: progress >= Number(mission.target || 0)
        };
      })
    : [];
  const weeklyMissionCompletion = weeklyMissionProgress.length
    ? Math.round((weeklyMissionProgress.filter((mission) => mission.claimed || mission.done).length / weeklyMissionProgress.length) * 100)
    : 0;
  const recentKcalSeries = recent7.map((log) => Number(log?.consumed || 0)).filter((value) => value > 0);
  const recentProteinSeries = recent7.map((log) => Number(log?.protein || 0)).filter((value) => value > 0);
  const avgBloating7d = recent7.length ? Number((recent7.reduce((sum, log) => sum + Number(log?.bloatingLevel || 0), 0) / recent7.length).toFixed(1)) : 0;
  const avgDigestion7d = recent7.length ? Number((recent7.reduce((sum, log) => sum + Number(log?.digestionRegularity || 0), 0) / recent7.length).toFixed(1)) : 0;
  const calcStd = (series = []) => {
    if (!Array.isArray(series) || series.length < 2) return 0;
    const mean = series.reduce((sum, value) => sum + Number(value || 0), 0) / series.length;
    const variance = series.reduce((sum, value) => sum + ((Number(value || 0) - mean) ** 2), 0) / series.length;
    return Math.sqrt(Math.max(0, variance));
  };
  const electrolyteRatio = avgSodium7d > 0 ? Number((avgPotassium7d / avgSodium7d).toFixed(2)) : 0;
  const electrolyteScore = Math.max(0, Math.min(100, Math.round((electrolyteRatio / 1.6) * 100)));
  const kcalStabilityScore = (() => {
    if (recentKcalSeries.length < 3) return 0;
    const std = calcStd(recentKcalSeries);
    const normalized = std / Math.max(1, Number(averageCalorieGoal || dailyGoal || 2400));
    return Math.max(0, Math.min(100, Math.round(100 - (normalized * 280))));
  })();
  const proteinConsistencyScore = (() => {
    if (recentProteinSeries.length < 3) return 0;
    const std = calcStd(recentProteinSeries);
    const target = Math.max(1, Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 190));
    const normalized = std / target;
    return Math.max(0, Math.min(100, Math.round(100 - (normalized * 210))));
  })();
  const recoveryIntelligenceScore = Math.max(0, Math.min(100, Math.round(
    (Math.min(100, (Number(weeklyReview.avgSleep || 0) / 8) * 100) * 0.34) +
    (Math.min(100, (Number(avgHrv7d || 0) / 70) * 100) * 0.2) +
    (Math.max(0, 100 - (Math.max(0, Number(avgRhr7d || 0) - 48) * 2.3)) * 0.2) +
    (Math.max(0, 100 - Math.min(100, (recoveryLoad3d / 900) * 100)) * 0.12) +
    (Math.max(0, 100 - (avgBloating7d * 8)) * 0.14)
  )));
  const digestiveBalanceScore = Math.max(0, Math.min(100, Math.round(
    (Math.min(100, (Number(recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.fiber || 0), 0) / recent7.length) : 0) / Math.max(1, Number(microTargets?.fiberMin || 30))) * 100) * 0.42) +
    (Math.min(100, (avgDigestion7d / 10) * 100) * 0.33) +
    (Math.max(0, 100 - (avgBloating7d * 9)) * 0.25)
  )));
  const recent14ForIntel = [...systemLogs].slice(-14);
  const healthIntelSeries14 = recent14ForIntel.map((log) => {
    const sodium = Math.max(1, Number(log?.sodiumMg || 0));
    const potassium = Number(log?.potassiumMg || 0);
    const ratio = sodium > 0 ? potassium / sodium : 0;
    const electrolyte = Math.max(0, Math.min(100, Math.round((ratio / Math.max(0.2, Number(healthIntelThresholds.electrolyteMin || 1.25))) * 100)));
    const recovery = Math.max(0, Math.min(100, Math.round(
      (Math.min(100, (Number(log?.sleepHours || 0) / 8) * 100) * 0.42) +
      (Math.min(100, (Number(log?.hrvMs || 0) / 70) * 100) * 0.2) +
      (Math.max(0, 100 - (Math.max(0, Number(log?.hrRest || 0) - 48) * 2.3)) * 0.2) +
      (Math.max(0, 100 - (Number(log?.bloatingLevel || 0) * 9)) * 0.18)
    )));
    const kcalStability = Math.max(0, Math.min(100, Math.round(
      100 - (Math.abs(Number(log?.consumed || 0) - Number(getCalorieTargetForLog(log) || dailyGoal || 2400)) / Math.max(1, Number(getCalorieTargetForLog(log) || dailyGoal || 2400))) * 180
    )));
    const digestive = Math.max(0, Math.min(100, Math.round(
      (Math.min(100, (Number(log?.fiber || 0) / Math.max(1, Number(microTargets?.fiberMin || 30))) * 100) * 0.45) +
      (Math.min(100, (Number(log?.digestionRegularity || 0) / 10) * 100) * 0.32) +
      (Math.max(0, 100 - (Number(log?.bloatingLevel || 0) * 9)) * 0.23)
    )));
    return { electrolyte, recovery, kcalStability, digestive };
  });
  const healthSentinelAlerts = [
    electrolyteRatio > 0 && electrolyteRatio < Number(healthIntelThresholds.electrolyteMin || 1.25)
      ? { id: 'electrolyte_low', message: 'Rapporto Potassio/Sodio basso: aumenta cibi ricchi di potassio e riduci sodio aggiunto.', actionId: 'water', actionLabel: 'Fix H2O' }
      : null,
    recoveryIntelligenceScore < Number(healthIntelThresholds.recoveryMin || 58)
      ? { id: 'recovery_low', message: 'Recovery score basso: alleggerisci volume e anticipa finestra sonno.', actionId: 'checkin_am', actionLabel: 'Fix Recovery' }
      : null,
    kcalStabilityScore > 0 && kcalStabilityScore < Number(healthIntelThresholds.kcalStabilityMin || 55)
      ? { id: 'kcal_stability_low', message: 'Kcal molto oscillanti: usa 1 template pasti fisso per 3 giorni.', actionId: 'meal', actionLabel: 'Fix Kcal' }
      : null,
    proteinConsistencyScore > 0 && proteinConsistencyScore < Number(healthIntelThresholds.proteinConsistencyMin || 60)
      ? { id: 'protein_consistency_low', message: 'Proteine poco stabili: distribuisci quota in 3-4 slot giornalieri.', actionId: 'protein', actionLabel: 'Fix Protein' }
      : null,
    digestiveBalanceScore < Number(healthIntelThresholds.digestiveMin || 58)
      ? { id: 'digestive_low', message: 'Digestive balance in calo: priorita fibra, idratazione e pasti meno processati.', actionId: 'water', actionLabel: 'Fix Digestive' }
      : null
  ].filter(Boolean).slice(0, 4);
  const dailyHealthScore = Math.max(0, Math.min(100, Math.round(
    (Math.min(100, (Number(todayData?.waterMl || 0) / Math.max(1, Number(hydrationGoal || 2800))) * 100) * 0.18) +
    (Math.min(100, (Number(todayData?.protein || 0) / Math.max(1, Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 190))) * 100) * 0.18) +
    (Math.min(100, (Number(todayData?.sleepHours || 0) / 8) * 100) * 0.16) +
    (recoveryIntelligenceScore * 0.2) +
    (digestiveBalanceScore * 0.14) +
    (electrolyteScore * 0.14)
  )));
  const dailyHealthBadge = dailyHealthScore >= 84
    ? { label: 'ELITE', tone: 'text-emerald-200 border-emerald-300/45 bg-emerald-500/10' }
    : dailyHealthScore >= 66
      ? { label: 'STABLE', tone: 'text-cyan-200 border-cyan-300/45 bg-cyan-500/10' }
      : { label: 'WARNING', tone: 'text-rose-200 border-rose-300/45 bg-rose-500/10' };
  const rewardHealthMultiplier = dailyHealthScore >= 84 ? 1.2 : dailyHealthScore >= 66 ? 1 : 0.88;
  const healthScoreAlertThreshold = 66;
  const healthScoreHistory = Array.isArray(playerStats?.healthScoreHistory) ? playerStats.healthScoreHistory : [];
  const healthScoreHistory7 = [...healthScoreHistory].slice(0, 7).reverse();
  const healthScoreHistory30 = [...healthScoreHistory].slice(0, 30);
  const seasonHealthAvg = healthScoreHistory30.length
    ? Math.round(healthScoreHistory30.reduce((sum, item) => sum + Number(item?.score || 0), 0) / healthScoreHistory30.length)
    : dailyHealthScore;
  const seasonMissionScore = Number(weeklyMissionCompletion || 0);
  const seasonMonthKey = getMonthKey();
  const seasonRankScore = Math.max(0, Math.min(100, Math.round((seasonHealthAvg * 0.72) + (seasonMissionScore * 0.28))));
  const seasonRank = seasonRankScore >= 92
    ? { id: 'shadow_monarch', label: 'SHADOW MONARCH', tone: 'text-fuchsia-200 border-fuchsia-300/50 bg-fuchsia-500/12' }
    : seasonRankScore >= 84
      ? { id: 'grandmaster', label: 'GRANDMASTER', tone: 'text-amber-200 border-amber-300/50 bg-amber-500/12' }
      : seasonRankScore >= 74
        ? { id: 'elite', label: 'ELITE', tone: 'text-emerald-200 border-emerald-300/45 bg-emerald-500/10' }
        : seasonRankScore >= 64
          ? { id: 'rising', label: 'RISING', tone: 'text-cyan-200 border-cyan-300/45 bg-cyan-500/10' }
          : { id: 'initiate', label: 'INITIATE', tone: 'text-gray-200 border-white/25 bg-white/5' };
  const nextSeasonTier = seasonRankScore >= 92
    ? null
    : seasonRankScore >= 84
      ? { label: 'SHADOW MONARCH', target: 92 }
      : seasonRankScore >= 74
        ? { label: 'GRANDMASTER', target: 84 }
        : seasonRankScore >= 64
          ? { label: 'ELITE', target: 74 }
          : { label: 'RISING', target: 64 };
  const seasonRankHistory = (Array.isArray(playerStats?.seasonRankHistory) ? playerStats.seasonRankHistory : [])
    .filter((row) => row && typeof row.monthKey === 'string')
    .sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)))
    .slice(0, 12);
  const healthSyncEnabled = Boolean(playerStats.healthSyncEnabled);
  const healthSyncSource = String(playerStats.healthSyncSource || 'manual');
  const healthSyncSourceLabel = HEALTH_SYNC_SOURCES.find((item) => item.id === healthSyncSource)?.label || 'Manuale';
  const healthSyncBadge = healthSyncEnabled ? `SYNC • ${healthSyncSourceLabel}` : 'MANUALE';

  const updatePlayerStats = (updater) => {
    setPlayerStats((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };
  const getLockedFieldSetFromEntry = (entry) => {
    return new Set(Array.isArray(entry?.lockedFields) ? entry.lockedFields : []);
  };
  const applyLockedFieldsToNutrients = (draft = {}, source = {}, lockedFields = []) => {
    const locked = new Set(Array.isArray(lockedFields) ? lockedFields : []);
    if (!locked.size) return normalizeAiMealNutrients(draft);
    const next = normalizeAiMealNutrients(draft);
    const sourceClean = normalizeAiMealNutrients(source);
    MEAL_NUMERIC_KEYS.forEach((key) => {
      if (locked.has(key)) next[key] = sourceClean[key];
    });
    return next;
  };
  const buildEditedFieldList = (source = {}, edited = {}) => {
    const sourceClean = normalizeAiMealNutrients(source);
    const editedClean = normalizeAiMealNutrients(edited);
    return MEAL_NUMERIC_KEYS.filter((key) => Math.abs(Number(editedClean[key] || 0) - Number(sourceClean[key] || 0)) >= 0.5);
  };
  const appendMealFixLog = (prev = {}, patch = null) => {
    const base = Array.isArray(prev?.mealAiFixLog) ? prev.mealAiFixLog : [];
    if (!patch) return base;
    return [patch, ...base].slice(0, 60);
  };
  const updateFoodReliabilityMap = (prevMap = {}, foodKey = '', payload = {}) => {
    if (!foodKey) return prevMap;
    const current = prevMap?.[foodKey] || { tries: 0, ok: 0, edits: 0, fixedFlags: 0, lastModel: '' };
    const tries = Math.max(0, Number(current.tries || 0) + Math.max(0, Number(payload.triesDelta || 0)));
    const ok = Math.max(0, Number(current.ok || 0) + Math.max(0, Number(payload.okDelta || 0)));
    const edits = Math.max(0, Number(current.edits || 0) + Math.max(0, Number(payload.editsDelta || 0)));
    const fixedFlags = Math.max(0, Number(current.fixedFlags || 0) + Math.max(0, Number(payload.fixedFlagsDelta || 0)));
    return {
      ...prevMap,
      [foodKey]: {
        tries,
        ok,
        edits,
        fixedFlags,
        lastModel: String(payload.lastModel || current.lastModel || ''),
        lastAt: new Date().toISOString()
      }
    };
  };
  const updatePortionMemoryMap = (prevMap = {}, foodKey = '', grams = 0) => {
    const portion = Math.max(0, Math.round(Number(grams || 0)));
    if (!foodKey || portion <= 0) return prevMap;
    const current = prevMap?.[foodKey] || { avgGrams: portion, count: 0 };
    const count = Math.max(0, Number(current.count || 0)) + 1;
    const avgPrev = Math.max(0, Number(current.avgGrams || portion));
    const avgGrams = Math.round(((avgPrev * (count - 1)) + portion) / Math.max(1, count));
    return {
      ...prevMap,
      [foodKey]: {
        avgGrams: Math.max(20, Math.min(1800, avgGrams)),
        count,
        lastAt: new Date().toISOString()
      }
    };
  };
  const normalizeCoachPlan = (raw = {}) => {
    const allowed = new Set(['water', 'protein', 'meal', 'mini_workout', 'checkin_pm', 'checkin_am']);
    const actions = Array.isArray(raw?.actions)
      ? raw.actions
          .map((item) => ({
            id: String(item?.id || '').trim(),
            label: String(item?.label || '').trim().slice(0, 42),
            desc: String(item?.desc || '').trim().slice(0, 120)
          }))
          .filter((item) => allowed.has(item.id))
          .slice(0, 3)
      : [];
    return {
      headline: String(raw?.headline || 'Focus Day').trim().slice(0, 80) || 'Focus Day',
      reason: String(raw?.reason || '').trim().slice(0, 180),
      actions
    };
  };
  const buildFallbackCoachPlan = () => {
    const actions = [];
    if (Number(todayData.waterMl || 0) < hydrationGoal * 0.7) {
      actions.push({ id: 'water', label: '+500ml acqua', desc: 'Spingi idratazione subito.' });
    }
    if (Number(todayData.protein || 0) < Number(adaptiveMacroTargets.protein || 190) * 0.75) {
      actions.push({ id: 'protein', label: '+28g proteine', desc: 'Stabilizza recupero muscolare.' });
    }
    if (Number(todayData.consumed || 0) < effectiveDailyGoal * 0.55) {
      actions.push({ id: 'meal', label: '+Pasto bilanciato', desc: 'Recupera energia con macro utili.' });
    }
    if (Number(todayData.workoutBurn ?? todayData.burned ?? 0) < 180) {
      actions.push({ id: 'mini_workout', label: 'Mini workout', desc: 'Blocca la costanza di oggi.' });
    }
    if (playerStats.lastEveningCheckinDate !== todayIso) {
      actions.push({ id: 'checkin_pm', label: 'Check-in sera', desc: 'Chiudi la giornata con feedback.' });
    }
    const pick = actions.slice(0, 3);
    return {
      headline: 'Execution Day',
      reason: 'Priorita generate dai gap reali di oggi.',
      actions: pick.length ? pick : [
        { id: 'water', label: '+500ml acqua', desc: 'Mantieni il ritmo.' },
        { id: 'protein', label: '+28g proteine', desc: 'Consolida la recovery.' },
        { id: 'checkin_pm', label: 'Check-in sera', desc: 'Mantieni dati puliti e progressione.' }
      ]
    };
  };
  const generateDailyBriefing = async () => {
    if (isGeneratingBriefing) return;
    setIsGeneratingBriefing(true);
    const ctx = {
      data: today,
      kcalConsumed: Math.round(Number(todayData.consumed || 0)),
      kcalTarget: Math.round(Number(effectiveDailyGoal || dailyGoal || 0)),
      protein: Math.round(Number(todayData.protein || 0)),
      proteinTarget: Math.round(Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 0)),
      carbs: Math.round(Number(todayData.carbs || 0)),
      fat: Math.round(Number(todayData.fatMacros || 0)),
      waterMl: Math.round(Number(todayData.waterMl || 0)),
      waterTarget: Math.round(Number(hydrationGoal || 0)),
      workoutBurn: Math.round(Number(todayData.workoutBurn ?? todayData.burned ?? 0)),
      sleepHours: Number(todayData.sleepHours || 0),
      systemPower: systemPowerScore,
      streak: streak,
      objective: String(playerStats.objective || 'recomp'),
      supplementSuggestions: dailySupplementCore?.map((s) => s.name).join(', ') || '--',
      weekScore: weeklyReview.kcalAdherencePct
    };
    try {
      const data = await requestSystemAI({
        temperature: 0.15,
        max_tokens: 380,
        timeoutMs: 22000,
        messages: [
          {
            role: 'system',
            content: 'Sei Nemotron, un coach AI di élite per un Shadow Hunter. Analizza il profilo giornaliero dell\'utente e fornisci un briefing operativo conciso: 1 assessment (3 righe max), 2-3 azioni prioritarie per il resto del giornata, 1 insight nutrizionale. Sii diretto, motivante, tecnico. Rispondi in italiano. MAX 120 parole totali.'
          },
          { role: 'user', content: `Profilo oggi: ${JSON.stringify(ctx)}` }
        ]
      });
      const text = data?.choices?.[0]?.message?.content || 'Nessuna analisi disponibile.';
      const briefing = { text, ts: Date.now() };
      setDailyBriefing(briefing);
      localStorage.setItem('shadow_monarch_daily_briefing', JSON.stringify(briefing));
    } catch (_) {
      setDailyBriefing({ text: 'Errore analisi — riprova.', ts: Date.now() });
    } finally {
      setIsGeneratingBriefing(false);
    }
  };
  // ── Shadow Insights — suggerimenti personalizzati 1×/giorno ───────────────
  const generateShadowInsights = async (force = false) => {
    const todayKey = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    if (!force && shadowInsights?.date === todayKey && shadowInsights?.items?.length > 0) return;
    setIsLoadingInsights(true);
    try {
      const last7 = systemLogs.slice(-7);
      const avgKcal = last7.length ? Math.round(last7.reduce((s, l) => s + Number(l.consumed || 0), 0) / last7.length) : 0;
      const avgProt = last7.length ? Math.round(last7.reduce((s, l) => s + Number(l.protein || 0), 0) / last7.length) : 0;
      const avgBurn = last7.length ? Math.round(last7.reduce((s, l) => s + Number(l.workoutBurn ?? l.burned ?? 0), 0) / last7.length) : 0;
      const trainDays = last7.filter((l) => Number(l.workoutBurn ?? l.burned ?? 0) >= 150).length;
      const ctx = {
        obiettivo: playerStats.objective || 'recomp',
        livello: playerStats.level || 1,
        streak: playerStats.streak || 0,
        ultimi7giorni: { mediaKcal: avgKcal, mediaProteine: avgProt, mediaBurn: avgBurn, giorniAllenamento: trainDays },
        oggi: { kcal: Math.round(Number(todayData?.consumed || 0)), proteine: Math.round(Number(todayData?.protein || 0)), burn: Math.round(Number(todayData?.workoutBurn ?? todayData?.burned ?? 0)) },
        targetKcal: dailyGoal || 2000,
        targetProteine: macroGoals?.protein || 150,
      };
      const systemPrompt = `Sei il coach AI personale del Shadow Hunter System. Analizza i dati reali dell'utente e genera 3 suggerimenti ultra-specifici e azionabili per oggi/questa settimana. Basa i suggerimenti esclusivamente sui dati forniti — non essere generico. Rispondi SOLO con JSON valido: {"items":[{"icon":"emoji","title":"titolo breve","body":"1-2 frasi specifiche con numeri reali"}]} — esattamente 3 items. Sempre in italiano.`;
      const res = await fetch('/api/nvidia/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `Dati utente: ${JSON.stringify(ctx)}` }], systemPrompt, tier: 'max' }),
      });
      const data = await res.json();
      const raw = data?.content || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.items?.length > 0) {
          const result = { date: todayKey, items: parsed.items, provider: data.provider };
          setShadowInsights(result);
          localStorage.setItem('shadow_monarch_insights', JSON.stringify(result));
        }
      }
    } catch (_) {}
    setIsLoadingInsights(false);
  };

  useEffect(() => {
    const todayKey = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    if (systemLogs.length > 0 && (!shadowInsights || shadowInsights.date !== todayKey)) {
      const t = setTimeout(() => generateShadowInsights(), 3000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendShadowChatMessage = async (overrideText) => {
    const text = String(overrideText || shadowChatInput || '').trim();
    if (!text || isShadowChatLoading) return;
    setShadowChatInput('');
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setShadowChatMessages((prev) => [...prev, userMsg]);
    setIsShadowChatLoading(true);
    const profileCtx = `Profilo Shadow Hunter: obiettivo=${playerStats.objective || 'recomp'}, livello=${playerStats.level || 1}, streak=${streak}. Oggi: kcal=${Math.round(Number(todayData.consumed || 0))}/${Math.round(effectiveDailyGoal || dailyGoal || 0)}, prot=${Math.round(Number(todayData.protein || 0))}g, burn=${Math.round(Number(todayData.workoutBurn ?? todayData.burned ?? 0))}kcal, h2o=${Math.round(Number(todayData.waterMl || 0))}ml. Integratori consigliati: ${dailySupplementCore?.map((s) => s.name).join(', ') || '--'}.`;
    const isHeavy = text.length > 80 || /piano|analisi|completo|settimana|ottimizza|spiega|confronta|perché|strategia|programma/i.test(text);
    const systemPrompt = `Sei Nemotron${isHeavy ? ' 550B' : ''}, il coach AI del Shadow Hunter System. Sei un esperto di fitness, nutrizione, arti marziali e performance atletica. Rispondi in italiano, sii diretto e tecnico. ${isHeavy ? 'Puoi rispondere in modo approfondito.' : 'Massimo 150 parole per risposta.'} ${profileCtx}${knowledgePrompt()}`;
    try {
      const res = await fetch('/api/nvidia/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: shadowChatMessages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
          tier: isHeavy ? 'max' : undefined,
        })
      });
      const data = await res.json();
      const reply = data?.content || 'Errore risposta Nemotron.';
      setShadowChatMessages((prev) => [...prev, { role: 'assistant', content: reply, provider: data?.provider, web: data?.web, ts: Date.now() }]);
    } catch (_) {
      setShadowChatMessages((prev) => [...prev, { role: 'assistant', content: 'Connessione fallita. Riprova.', ts: Date.now() }]);
    } finally {
      setIsShadowChatLoading(false);
      setTimeout(() => shadowChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };
  const generateCoachModePlan = async () => {
    if (isGeneratingCoachPlan) return;
    setIsGeneratingCoachPlan(true);
    const context = {
      kcalGoal: Number(dailyGoal || 0),
      kcalNow: Number(todayData.consumed || 0),
      waterGoal: Number(hydrationGoal || 0),
      waterNow: Number(todayData.waterMl || 0),
      proteinGoal: Number(adaptiveMacroTargets.protein || 0),
      proteinNow: Number(todayData.protein || 0),
      workoutBurnNow: Number(todayData.workoutBurn ?? todayData.burned ?? 0),
      eveningCheckinDone: playerStats.lastEveningCheckinDate === todayIso,
      objective: String(playerStats.objective || 'recomp')
    };
    try {
      const data = await requestSystemAI({
        temperature: 0.1,
        max_tokens: 260,
        timeoutMs: 20000,
        messages: [
          {
            role: 'system',
            content:
              'Sei un coach operativo. Crea un piano giornaliero ultra pratico con massimo 3 azioni, una per volta, tutte eseguibili in 1 tap. Rispondi SOLO JSON valido: {"headline":"string","reason":"string","actions":[{"id":"water|protein|meal|mini_workout|checkin_pm|checkin_am","label":"string","desc":"string"}]}.'
          },
          { role: 'user', content: `Contesto: ${JSON.stringify(context)}` }
        ]
      });
      const parsed = parseModelJson(data);
      const safePlan = normalizeCoachPlan(parsed);
      const finalPlan = safePlan.actions.length ? safePlan : buildFallbackCoachPlan();
      updatePlayerStats((prev) => ({
        ...prev,
        dailyCoachPlan: {
          date: todayIso,
          ...finalPlan
        }
      }));
      emitUiToast({ message: 'Coach Mode AI aggiornato', tone: 'success', durationMs: 2600 });
      playSfx('success', soundEnabled, soundTheme);
    } catch (_) {
      const fallback = buildFallbackCoachPlan();
      updatePlayerStats((prev) => ({
        ...prev,
        dailyCoachPlan: {
          date: todayIso,
          ...fallback
        }
      }));
      emitUiToast({ message: 'Coach plan fallback generato', tone: 'warning', durationMs: 2600 });
    } finally {
      setIsGeneratingCoachPlan(false);
    }
  };
  const todayCoachPlan = playerStats?.dailyCoachPlan?.date === todayIso
    ? playerStats.dailyCoachPlan
    : buildFallbackCoachPlan();
  useEffect(() => {
    if (playerStats?.dailyCoachPlan?.date === todayIso) return;
    const fallback = buildFallbackCoachPlan();
    updatePlayerStats((prev) => {
      if (prev?.dailyCoachPlan?.date === todayIso) return prev;
      return {
        ...prev,
        dailyCoachPlan: {
          date: todayIso,
          ...fallback
        }
      };
    });
  }, [todayIso, playerStats?.dailyCoachPlan?.date]);
  useEffect(() => {
    if (currentWeekTrainingSessions < weeklyTargetWorkouts) return;
    if (playerStats.lastWeeklyCrownFxWeek === currentWeekKey) return;
    updatePlayerStats((prev) => ({ ...prev, lastWeeklyCrownFxWeek: currentWeekKey }));
    setWeeklyCrownUnlockFx(true);
    if (weeklyCrownUnlockTimerRef.current) clearTimeout(weeklyCrownUnlockTimerRef.current);
    weeklyCrownUnlockTimerRef.current = setTimeout(() => setWeeklyCrownUnlockFx(false), 900);
    emitShadowFxBurst();
    playSfx(crownAnthemEnabled ? 'crown_anthem' : 'streak', soundEnabled, soundTheme);
    speakEvent('quest_clear', voiceEnabled, voicePack);
  }, [currentWeekTrainingSessions, weeklyTargetWorkouts, playerStats.lastWeeklyCrownFxWeek, currentWeekKey, soundEnabled, soundTheme, voiceEnabled, voicePack, crownAnthemEnabled]);
  useEffect(() => () => {
    if (weeklyCrownUnlockTimerRef.current) clearTimeout(weeklyCrownUnlockTimerRef.current);
  }, []);
  useEffect(() => {
    if (!battlePassTierFx) return undefined;
    const timeoutId = setTimeout(() => setBattlePassTierFx(null), 1350);
    return () => clearTimeout(timeoutId);
  }, [battlePassTierFx]);
  const setHealthSync = (enabled, source = healthSyncSource) => {
    updatePlayerStats((prev) => ({
      ...prev,
      healthSyncEnabled: Boolean(enabled),
      healthSyncSource: enabled ? String(source || 'apple_health') : 'manual',
      healthSyncUpdatedAt: new Date().toISOString()
    }));
    emitUiToast({
      message: enabled ? `Sync attiva: ${HEALTH_SYNC_SOURCES.find((s) => s.id === source)?.label || 'provider'}` : 'Modalita manuale attiva',
      tone: enabled ? 'success' : 'info',
      durationMs: 2600
    });
    playSfx('click', soundEnabled, soundTheme);
  };
  const emitFxBurst = () => {
    emitShadowFxBurst();
  };
  const generateSmartGoalDraft = () => {
    const recent = [...systemLogs].slice(-14);
    const recentWithKcal = recent.filter((log) => Number(log?.consumed || 0) > 0);
    const avgKcal = recentWithKcal.length
      ? Math.round(recentWithKcal.reduce((sum, log) => sum + Number(log?.consumed || 0), 0) / recentWithKcal.length)
      : Number(dailyGoal || 2400);
    const objective = String(playerStats?.objective || 'recomp');
    const delta = objective === 'cut' ? -220 : objective === 'strength' ? 180 : 0;
    const nextKcal = Math.max(1300, Math.min(4200, avgKcal + delta));
    const nextHydration = Math.max(1600, Math.round(nextKcal * 1.15));
    const nextProtein = Math.max(120, Math.round((nextKcal * 0.31) / 4));
    const nextCarbs = Math.max(90, Math.round((nextKcal * 0.44) / 4));
    const nextFats = Math.max(35, Math.round((nextKcal * 0.25) / 9));
    setSmartGoalDraft({
      objective,
      sourceDays: recentWithKcal.length,
      kcal: nextKcal,
      hydration: nextHydration,
      macros: {
        protein: nextProtein,
        carbs: nextCarbs,
        fats: nextFats
      }
    });
    emitUiToast({ message: 'Smart Goal Wizard pronto', tone: 'success', durationMs: 2600 });
  };
  const applySmartGoalDraft = () => {
    if (!smartGoalDraft) return;
    setDailyGoal(Number(smartGoalDraft.kcal || dailyGoal));
    setHydrationGoal(Number(smartGoalDraft.hydration || hydrationGoal));
    setMacroGoals({
      protein: Number(smartGoalDraft.macros?.protein || macroGoals?.protein || 190),
      carbs: Number(smartGoalDraft.macros?.carbs || macroGoals?.carbs || 220),
      fats: Number(smartGoalDraft.macros?.fats || macroGoals?.fats || 70)
    });
    emitUiToast({ message: 'Target applicati dal Wizard', tone: 'success', durationMs: 3000 });
    playSfx('success', soundEnabled, soundTheme);
  };
  const pushCalorieDecision = ({ source, from, to, note = '' }) => {
    updatePlayerStats((prev) => {
      const entry = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        at: new Date().toISOString(),
        source,
        from: Number(from || 0),
        to: Number(to || 0),
        delta: Number((Number(to || 0) - Number(from || 0)).toFixed(0)),
        note
      };
      return {
        ...prev,
        calorieDecisionLog: [entry, ...(prev.calorieDecisionLog || [])].slice(0, 40)
      };
    });
  };
  const runWeeklyOneTapAction = (actionId, options = {}) => {
    const silent = Boolean(options?.silent);
    if (actionId === 'water') {
      saveToSystem({ waterMl: Number(todayData.waterMl || 0) + 500 });
      if (!silent) {
        emitUiToast({ message: 'Azione weekly: +500ml acqua', tone: 'success', durationMs: 2600 });
        playSfx('click', soundEnabled, soundTheme);
      }
      return;
    }
    if (actionId === 'protein') {
      saveToSystem({
        consumed: Number(todayData.consumed || 0) + 170,
        protein: Number(todayData.protein || 0) + 28
      });
      if (!silent) {
        emitUiToast({ message: 'Azione weekly: +28g proteine', tone: 'success', durationMs: 2600 });
        playSfx('click', soundEnabled, soundTheme);
      }
      return;
    }
    if (actionId === 'mini_workout') {
      const burnAdd = travelModeEnabled ? 120 : 180;
      const nextBurn = Number(todayData.workoutBurn ?? todayData.burned ?? 0) + burnAdd;
      saveToSystem({
        workoutBurn: nextBurn,
        burned: nextBurn,
        strength: Number(todayData.strength || 0) + (travelModeEnabled ? 10 : 18)
      });
      updatePlayerStats((prev) => ({ ...prev, lastWorkoutDate: today }));
      if (!silent) {
        emitUiToast({ message: `Azione weekly: mini workout +${burnAdd} kcal`, tone: 'success', durationMs: 2600 });
        playSfx('success', soundEnabled, soundTheme);
      }
      return;
    }
    if (actionId === 'mini_move') {
      const nextBurn = Number(todayData.workoutBurn ?? todayData.burned ?? 0) + 90;
      saveToSystem({
        workoutBurn: nextBurn,
        burned: nextBurn,
        steps: Number(todayData.steps || 0) + 1500
      });
      if (!silent) {
        emitUiToast({ message: 'Azione travel: 12 min movimento registrato', tone: 'success', durationMs: 2600 });
        playSfx('success', soundEnabled, soundTheme);
      }
      return;
    }
    if (actionId === 'meal') {
      saveToSystem({
        consumed: Number(todayData.consumed || 0) + 480,
        carbs: Number(todayData.carbs || 0) + 46,
        protein: Number(todayData.protein || 0) + 26,
        fatMacros: Number(todayData.fatMacros || 0) + 16
      });
      if (!silent) {
        emitUiToast({ message: 'Azione weekly: pasto registrato', tone: 'success', durationMs: 2600 });
        playSfx('click', soundEnabled, soundTheme);
      }
      return;
    }
    if (actionId === 'checkin_pm') {
      quickSaveEveningCheckin();
      if (!silent) emitUiToast({ message: 'Azione weekly: check-in sera salvato', tone: 'success', durationMs: 2600 });
      return;
    }
    if (actionId === 'checkin_am') {
      quickSaveMorningCheckin();
      if (!silent) emitUiToast({ message: 'Azione weekly: check-in mattino salvato', tone: 'success', durationMs: 2600 });
    }
  };
  const runDailyAutopilot = () => {
    const actions = [];
    if (Number(todayData.waterMl || 0) < hydrationGoal * (travelModeEnabled ? 0.56 : 0.72)) actions.push('water');
    if (Number(todayData.protein || 0) < Number(adaptiveMacroTargets.protein || 190) * (travelModeEnabled ? 0.62 : 0.78)) actions.push('protein');
    if (Number(todayData.consumed || 0) < effectiveDailyGoal * (travelModeEnabled ? 0.48 : 0.58)) actions.push('meal');
    const hourNow = new Date().getHours();
    if (playerStats.lastMorningCheckinDate !== todayIso && hourNow < 17) actions.push('checkin_am');
    if (playerStats.lastEveningCheckinDate !== todayIso && hourNow >= 18) actions.push('checkin_pm');
    if ((Number(todayData.workoutBurn ?? todayData.burned ?? 0) < (travelModeEnabled ? 80 : 140)) && playerStats.lastWorkoutDate !== today) {
      actions.push(travelModeEnabled ? 'mini_move' : 'mini_workout');
    }
    const plan = Array.from(new Set(actions)).slice(0, 3);
    if (!plan.length) {
      emitUiToast({ message: 'Autopilot: nessuna azione necessaria ora', tone: 'info', durationMs: 2600 });
      return;
    }
    const snapshotLogs = Array.isArray(systemLogs) ? JSON.parse(JSON.stringify(systemLogs)) : [];
    const snapshotStats = JSON.parse(JSON.stringify(playerStats || {}));
    plan.forEach((actionId) => runWeeklyOneTapAction(actionId, { silent: true }));
    playSfx('success', soundEnabled, soundTheme);
    emitUiToast({
      message: `Autopilot eseguito: ${plan.join(' + ')}`,
      tone: 'success',
      actionLabel: 'Undo 30s',
      durationMs: 30000,
      onAction: () => {
        setSystemLogs(snapshotLogs);
        setPlayerStats(snapshotStats);
        emitUiToast({ message: 'Autopilot annullato', tone: 'success', durationMs: 2200 });
      }
    });
  };

  const startBlockProgram = (programId) => {
    const chosen = BLOCK_PROGRAMS.find((p) => p.id === programId);
    if (!chosen) return;
    updatePlayerStats((prev) => ({
      ...prev,
      blockProgram: {
        id: chosen.id,
        label: chosen.label,
        startedAt: new Date().toISOString(),
        checkpointsClaimed: []
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
  };

  const claimBlockCheckpoint = () => {
    if (!activeBlockProgram || !blockWeek) return;
    const checkpointKey = `W${blockWeek}`;
    if ((activeBlockProgram.checkpointsClaimed || []).includes(checkpointKey)) return;
    const rewardExp = Math.round((30 + (blockWeek * 20)) * rewardHealthMultiplier);
    const rewardGold = Math.round((25 + (blockWeek * 25)) * rewardHealthMultiplier);
    updatePlayerStats((prev) => ({
      ...prev,
      exp: Number(prev.exp || 0) + rewardExp,
      gold: Number(prev.gold || 0) + rewardGold,
      blockProgram: {
        ...(prev.blockProgram || {}),
        checkpointsClaimed: [...((prev.blockProgram?.checkpointsClaimed) || []), checkpointKey]
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };

  const buildAdaptiveQuest = () => {
    const hydrationDeficit = Math.max(0, hydrationGoal - Number(todayData.waterMl || 0));
    const proteinTarget = Math.max(120, Number(macroGoals?.protein || 190));
    const proteinDeficit = Math.max(0, proteinTarget - Number(todayData.protein || 0));
    const burnDeficit = Math.max(0, 260 - workoutBurnToday);
    const stepDeficit = Math.max(0, 7000 - Number(todayData.steps || 0));
    const candidates = [
      { type: 'hydration', deficit: hydrationDeficit, target: Math.round(Number(todayData.waterMl || 0) + Math.min(700, Math.max(350, hydrationDeficit))), label: 'Raggiungi target acqua intermedio', reward: { exp: 24, gold: 20 } },
      { type: 'protein', deficit: proteinDeficit, target: Math.round(Number(todayData.protein || 0) + Math.min(35, Math.max(20, proteinDeficit))), label: 'Aumenta proteine giornaliere', reward: { exp: 26, gold: 22 } },
      { type: 'burned', deficit: burnDeficit, target: Math.round(workoutBurnToday + Math.min(220, Math.max(140, burnDeficit))), label: 'Completa quota movimento', reward: { exp: 30, gold: 25 } },
      { type: 'steps', deficit: stepDeficit, target: Math.round(Math.max(Number(todayData.steps || 0) + 1800, 6500)), label: 'Incrementa camminata quotidiana', reward: { exp: 24, gold: 18 } }
    ];
    const picked = [...candidates].sort((a, b) => b.deficit - a.deficit)[0];
    updatePlayerStats((prev) => ({
      ...prev,
      adaptiveQuest: {
        ...picked,
        date: todayIso,
        claimed: false
      }
    }));
  };

  const claimAdaptiveQuest = () => {
    if (!adaptiveQuest || adaptiveQuest.claimed || !adaptiveQuestDone) return;
    updatePlayerStats((prev) => ({
      ...prev,
      exp: Number(prev.exp || 0) + Math.round(Number(adaptiveQuest.reward?.exp || 20) * rewardHealthMultiplier),
      gold: Number(prev.gold || 0) + Math.round(Number(adaptiveQuest.reward?.gold || 15) * rewardHealthMultiplier),
      adaptiveQuest: {
        ...(prev.adaptiveQuest || {}),
        claimed: true
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const buildWeeklyMissionPack = () => {
    const candidates = [
      {
        type: 'training_days',
        label: `Allenati ${Math.max(3, Number(weeklyGoals.trainingDays || 4))} giorni`,
        target: Math.max(3, Number(weeklyGoals.trainingDays || 4)),
        score: 100 - Math.min(100, Math.round((Number(weeklyGoalProgress.trainingDays || 0) / Math.max(1, Number(weeklyGoals.trainingDays || 4))) * 100)),
        reward: { exp: 46, gold: 38 }
      },
      {
        type: 'hydration_days',
        label: `Chiudi idratazione ${Math.max(4, Number(weeklyGoals.hydrationDays || 5))} giorni`,
        target: Math.max(4, Number(weeklyGoals.hydrationDays || 5)),
        score: 96 - Math.min(96, Math.round((Number(weeklyGoalProgress.hydrationDays || 0) / Math.max(1, Number(weeklyGoals.hydrationDays || 5))) * 100)),
        reward: { exp: 36, gold: 30 }
      },
      {
        type: 'protein_days',
        label: `Proteine in target per ${Math.max(4, Number(weeklyGoals.proteinDays || 5))} giorni`,
        target: Math.max(4, Number(weeklyGoals.proteinDays || 5)),
        score: 92 - Math.min(92, Math.round((Number(weeklyGoalProgress.proteinDays || 0) / Math.max(1, Number(weeklyGoals.proteinDays || 5))) * 100)),
        reward: { exp: 38, gold: 32 }
      },
      {
        type: 'sleep_days',
        label: `Sonno 7h+ per ${Math.max(4, Number(weeklyGoals.sleepDays || 5))} giorni`,
        target: Math.max(4, Number(weeklyGoals.sleepDays || 5)),
        score: 88 - Math.min(88, Math.round((Number(weeklyGoalProgress.sleepDays || 0) / Math.max(1, Number(weeklyGoals.sleepDays || 5))) * 100)),
        reward: { exp: 34, gold: 28 }
      },
      {
        type: 'steps_avg',
        label: `Media passi ${Math.max(4500, Number(weeklyGoals.avgSteps || 8000))}`,
        target: Math.max(4500, Number(weeklyGoals.avgSteps || 8000)),
        score: 84 - Math.min(84, Math.round((Number(weeklyGoalProgress.avgSteps || 0) / Math.max(1, Number(weeklyGoals.avgSteps || 8000))) * 100)),
        reward: { exp: 30, gold: 24 }
      },
      {
        type: 'fiber_days',
        label: `Fibra in target ${Math.max(4, Math.min(6, Number(weeklyGoals.proteinDays || 5)))} giorni`,
        target: Math.max(4, Math.min(6, Number(weeklyGoals.proteinDays || 5))),
        score: 90 - Math.min(90, Math.round((Number(weeklyFiberDays || 0) / Math.max(1, Math.max(4, Math.min(6, Number(weeklyGoals.proteinDays || 5))))) * 100)),
        reward: { exp: 32, gold: 26 }
      }
    ];
    const chosen = [...candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((mission, idx) => ({
        id: `${currentWeekKey}-${mission.type}-${idx}`,
        ...mission,
        claimed: false
      }));
    updatePlayerStats((prev) => ({
      ...prev,
      weeklyMissionPack: {
        weekKey: currentWeekKey,
        generatedAt: new Date().toISOString(),
        missions: chosen
      }
    }));
  };
  const claimWeeklyMission = (missionId) => {
    if (!weeklyMissionPack?.missions?.length) return;
    const target = weeklyMissionProgress.find((mission) => mission.id === missionId);
    if (!target || target.claimed || !target.done) return;
    updatePlayerStats((prev) => {
      const pack = prev?.weeklyMissionPack;
      if (!pack || pack.weekKey !== currentWeekKey) return prev;
      return {
        ...prev,
        exp: Number(prev.exp || 0) + Math.round(Number(target.reward?.exp || 30) * rewardHealthMultiplier),
        gold: Number(prev.gold || 0) + Math.round(Number(target.reward?.gold || 24) * rewardHealthMultiplier),
        weeklyMissionPack: {
          ...pack,
          missions: (pack.missions || []).map((mission) => (
            mission.id === missionId ? { ...mission, claimed: true } : mission
          ))
        }
      };
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const applyMealTemplate = (template) => {
    if (!template) return;
    const selected = template.slot || mealSlot;
    const slotMeta = MEAL_SLOT_META[selected] || MEAL_SLOT_META.lunch;
    saveToSystem({
      consumed: Number(todayData.consumed || 0) + Number(template.kcal || 0),
      protein: Number(todayData.protein || 0) + Number(template.protein || 0),
      carbs: Number(todayData.carbs || 0) + Number(template.carbs || 0),
      fatMacros: Number(todayData.fatMacros || 0) + Number(template.fat || 0),
      fiber: Number(todayData.fiber || 0) + Number(template.fiber || 0),
      [slotMeta.key]: Number(todayData?.[slotMeta.key] || 0) + Number(template.kcal || 0)
    });
    playSfx('click', soundEnabled, soundTheme);
  };
  const saveReadinessCheck = () => {
    const nowIso = new Date().toISOString();
    updatePlayerStats((prev) => ({
      ...prev,
      readinessScore: readiness.score,
      readinessZone: readiness.zone,
      readinessIntensity: readiness.intensity,
      lastReadinessAt: nowIso,
      energyLevel: Number(readinessInput.energy || prev.energyLevel || 6),
      stressLevel: Number(readinessInput.stress || prev.stressLevel || 4),
      sorenessLevel: Number(readinessInput.soreness || prev.sorenessLevel || 4)
    }));
    saveToSystem({
      sleepHours: Number(readinessInput.sleepHours || todayData.sleepHours || 0),
      recoveryScore: readiness.score,
      energyLevel: Number(readinessInput.energy || todayData.energyLevel || 0)
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const applyDayTemplate = (templateId) => {
    const template = DAY_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const previousGoal = Number(dailyGoal || 2400);
    const previousMacros = { ...(macroGoals || { carbs: 220, protein: 190, fats: 70 }) };
    const previousHydration = Number(hydrationGoal || 2800);
    const previousObjective = playerStats.objective;
    const previousLastTemplate = playerStats.lastDayTemplate || null;
    const currentGoal = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, Math.round(currentGoal + Number(template.kcalDelta || 0)));
    const nextProtein = Math.max(110, Math.round(Number(macroGoals?.protein || 190) * Number(template.proteinMul || 1)));
    const nextCarbs = Math.max(70, Math.round(Number(macroGoals?.carbs || 220) * Number(template.carbsMul || 1)));
    const nextFats = Math.max(35, Math.round(Number(macroGoals?.fats || 70) * Number(template.fatsMul || 1)));
    const nextWater = Math.max(1800, Math.round(Number(hydrationGoal || 2800) + Number(template.waterDelta || 0)));
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    setMacroGoals({ protein: nextProtein, carbs: nextCarbs, fats: nextFats });
    setHydrationGoal(nextWater);
    updatePlayerStats((prev) => ({
      ...prev,
      objective: template.objective || prev.objective,
      lastDayTemplate: {
        id: template.id,
        appliedAt: new Date().toISOString()
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `${template.label} applicato`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
        setMacroGoals(previousMacros);
        setHydrationGoal(previousHydration);
        updatePlayerStats((prev) => ({
          ...prev,
          objective: previousObjective,
          lastDayTemplate: previousLastTemplate
        }));
      }
    });
  };
  const applyHungerGuardrailBoost = () => {
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, previousGoal + 120);
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    setMacroGoals((prev) => ({
      ...prev,
      protein: Math.max(110, Math.round(Number(prev?.protein || 190) + 10)),
      carbs: Math.max(70, Math.round(Number(prev?.carbs || 220) + 15))
    }));
    emitUiToast({
      message: `Guardrail fame applicato: ${nextGoal} kcal (+prot/carbs)`,
      tone: 'success',
      durationMs: 2600
    });
  };
  const applyRefeedSmart = () => {
    if (!refeedSmart.eligible) return;
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, Number(refeedSmart.refeedKcal || (previousGoal + 260)));
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    setMacroGoals((prev) => ({
      ...prev,
      carbs: Math.max(70, Math.round(Number(prev?.carbs || 220) + Number(refeedSmart.carbsAdd || 55)))
    }));
    emitUiToast({
      message: `Refeed smart applicato: ${nextGoal} kcal`,
      tone: 'success',
      actionLabel: 'Undo',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
      }
    });
  };
  const applyHydrationIntelligence = () => {
    const next = Math.max(1800, Number(hydrationIntel.target || hydrationGoal || 2800));
    setHydrationGoal(next);
    emitUiToast({ message: `Hydration target aggiornato: ${next} ml`, tone: 'success', durationMs: 2400 });
  };
  const addGiTrackerEntry = () => {
    const entry = {
      id: `${Date.now()}`,
      date: todayIso,
      food: String(giQuickFood || 'altro'),
      symptom: Math.max(1, Math.min(10, Number(giQuickSymptom || 5)))
    };
    setGiTracker((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 80));
    emitUiToast({ message: 'GI trigger salvato', tone: 'success', durationMs: 1800 });
  };

  const downloadCsvReport = () => {
    const headers = ['date', 'consumed', 'mealBreakfastKcal', 'mealLunchKcal', 'mealDinnerKcal', 'burned', 'protein', 'carbs', 'fatMacros', 'fiber', 'satFat', 'monoFat', 'polyFat', 'sugars', 'sodiumMg', 'potassiumMg', 'omega3Mg', 'calciumMg', 'ironMg', 'magnesiumMg', 'waistCm', 'waterMl', 'steps', 'hrRest', 'hrvMs', 'sleepHours', 'sleepQuality', 'awakenings', 'bloatingLevel', 'digestionRegularity', 'mealTolerance', 'cravingLevel', 'hungerLevel', 'weight', 'fat', 'strength'];
    const rows = [headers.join(',')];
    systemLogs.forEach((log) => {
      rows.push(headers.map((key) => JSON.stringify(log?.[key] ?? '')).join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-monarch-logs-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWeeklySummary = () => {
    const lines = [
      `Weekly Review (${todayIso})`,
      `Days tracked: ${weeklyReview.daysTracked}/7`,
      `Kcal adherence: ${weeklyReview.kcalAdherencePct}%`,
      `Hydration adherence: ${weeklyReview.hydrationAdherencePct}%`,
      `Training days: ${weeklyReview.trainingDays}`,
      `Average sleep: ${weeklyReview.avgSleep} h`,
      '',
      `Current block: ${activeBlockProgram?.label || 'none'}`,
      `Data quality warnings: ${dataQualityWarnings.length || 0}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-weekly-review-${todayIso}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const applyWeightTrendKcalSuggestion = () => {
    if (!weightTrend.kcalAdjustment) return;
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const current = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, current + Number(weightTrend.kcalAdjustment || 0));
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    pushCalorieDecision({
      source: 'trend_guard',
      from: current,
      to: nextGoal,
      note: `Weight trend guard ${weightTrend.status}`
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `Kcal aggiornate (${nextGoal})`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
      }
    });
  };
  const applyWeeklyWeightKcalSuggestion = () => {
    if (!weeklyWeightSignal.kcalAdjustment) return;
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const current = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, current + Number(weeklyWeightSignal.kcalAdjustment || 0));
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    pushCalorieDecision({
      source: 'weekly_weighin',
      from: current,
      to: nextGoal,
      note: `Weekly signal ${weeklyWeightSignal.status}`
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `Kcal weekly applicate (${nextGoal})`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
      }
    });
  };
  const applyCalorieBalanceAdvisor = () => {
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const current = Math.max(1300, Number(dailyGoal || 2400));
    const nextGoal = Math.max(1300, Number(calorieBalanceAdvisor?.suggested || current));
    if (nextGoal === current) {
      emitUiToast({ message: 'Bilanciamento: target già ottimale', tone: 'success', durationMs: 2200 });
      return;
    }
    setDailyGoal(nextGoal);
    setGoalInput(nextGoal);
    pushCalorieDecision({
      source: 'objective_balance',
      from: current,
      to: nextGoal,
      note: `Objective balance ${String(playerStats?.objective || metabolicProfile?.objective || 'recomp')}`
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `Bilanciamento applicato: ${nextGoal} kcal`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
      }
    });
  };
  const toggleSupplementEnabled = (supplementId) => {
    if (!supplementId) return;
    setSupplementPlanSettings((prev) => {
      const current = Array.isArray(prev?.enabledIds) ? prev.enabledIds : [];
      const has = current.includes(supplementId);
      const nextIds = has ? current.filter((id) => id !== supplementId) : [...current, supplementId];
      return { ...prev, enabledIds: nextIds };
    });
  };
  // ── ANALISI PROFILO PROFONDA (Nemotron) — generale, non sul singolo giorno ──
  const analyzeProfile = async () => {
    if (isAnalyzingProfile) return;
    setIsAnalyzingProfile(true);
    try {
      const last30 = systemLogs.slice(-30);
      const avg = (sel) => last30.length ? Math.round(last30.reduce((s, l) => s + Number(sel(l) || 0), 0) / last30.length) : 0;
      const trainDays = last30.filter((l) => Number(l.workoutBurn ?? l.burned ?? 0) > 100).length;
      const weights = last30.map((l) => Number(l.weight || 0)).filter((w) => w > 0);
      const weightTrend = weights.length >= 2 ? (weights[weights.length - 1] - weights[0]).toFixed(1) : '0';
      const pesoKg = Number(playerStats?.currentWeightKg || 0) || (weights[weights.length - 1] || 70);
      const altezzaCm = Number(playerStats?.heightCm || metabolicProfile?.heightCm || 178);
      const bmi = altezzaCm > 0 ? (pesoKg / ((altezzaCm / 100) ** 2)).toFixed(1) : '?';
      const ctx = `PROFILO COMPLETO (ultimi 30 giorni di dati reali):
- Obiettivo: ${playerStats?.objective || 'recomp'} | Livello ${playerStats?.level || 1} | Streak ${playerStats?.streak || 0}gg
- Fisico: ${pesoKg}kg | ${altezzaCm}cm | BMI ${bmi} | ${playerStats?.age || metabolicProfile?.age || 25} anni | ${(playerStats?.sex || 'male') === 'male' ? 'uomo' : 'donna'}
- Peso target: ${playerStats?.bodyGoal?.targetWeightKg || 'n/d'}kg | trend peso 30gg: ${weightTrend}kg
- Allenamenti: ${trainDays}/30 giorni attivi
- Medie 30gg: ${avg((l) => l.consumed)} kcal/die | ${avg((l) => l.protein)}g proteine | ${avg((l) => l.carbs)}g carb | ${avg((l) => l.fatMacros)}g grassi
- Target: ${Math.round(Number(effectiveDailyGoal || dailyGoal || 2400))} kcal | ${Math.round(Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 150))}g proteine
- Sonno medio: ${avg((l) => l.sleepHours)}h`;

      const data = await requestSystemAI({
        model: getModelFor('profile') || undefined,
        temperature: 0.5,
        max_tokens: 1100,
        timeoutMs: 40000,
        messages: [
          { role: 'system', content: `Sei un coach d'élite di nutrizione e performance. Analizzi il PROFILO GENERALE dell'atleta sui dati reali (non il singolo giorno), in profondità. Sii concreto, basati sui numeri forniti, niente generico.
Struttura la risposta in sezioni chiare con questi titoli:
📊 QUADRO GENERALE — cosa dicono davvero i numeri (2-3 frasi)
✅ COSA FUNZIONA — punti di forza concreti
⚠️ CRITICITÀ — i 2-3 problemi più importanti, con il perché
🎯 PIANO D'AZIONE — 4-5 azioni specifiche e misurabili per le prossime settimane
🔮 PROIEZIONE — dove porta la traiettoria attuale e cosa cambiare
Italiano, diretto, esigente. Niente markdown pesante, usa i titoli con emoji come sopra.${knowledgePrompt()}` },
          { role: 'user', content: ctx },
        ],
      });
      const content = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!content) throw new Error('Analisi vuota');
      const usedModel = String(data?._shadowMeta?.model || '').trim();
      const entry = { content, model: usedModel, date: new Date().toISOString() };
      setProfileAnalysis(entry);
      try {
        localStorage.setItem('shadow_monarch_profile_analysis_last', JSON.stringify(entry));
        const hist = JSON.parse(localStorage.getItem('shadow_monarch_profile_analysis_history') || '[]');
        localStorage.setItem('shadow_monarch_profile_analysis_history', JSON.stringify([entry, ...hist].slice(0, 12)));
      } catch {}
      emitUiToast({ message: 'Analisi profilo pronta', tone: 'success', durationMs: 2400 });
    } catch (err) {
      emitUiToast({ message: 'Analisi profilo fallita: ' + formatAiErrorDetail(err?.message || ''), tone: 'warning', durationMs: 3200 });
    } finally {
      setIsAnalyzingProfile(false);
    }
  };

  const generateRecipeFromPrompt = async (autoMode = false) => {
    if (isGeneratingRecipe) return;
    const prompt = String(recipePrompt || '').trim();
    if (!autoMode && !prompt) {
      emitUiToast({ message: 'Scrivi cosa vuoi o premi "Sorprendimi"', tone: 'warning', durationMs: 2400 });
      return;
    }
    setIsGeneratingRecipe(true);
    try {
      const kcalResidui = Math.max(0, Math.round(Number(effectiveDailyGoal || dailyGoal || 2400) - Number(todayData.consumed || 0)));
      const protResidui = Math.max(0, Math.round(Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 150) - Number(todayData.protein || 0)));
      const carbResidui = Math.max(0, Math.round(Number(adaptiveMacroTargets?.carbs || macroGoals?.carbs || 200) - Number(todayData.carbs || 0)));
      const fatResidui = Math.max(0, Math.round(Number(adaptiveMacroTargets?.fats || macroGoals?.fats || 60) - Number(todayData.fatMacros || 0)));
      const isTrainingDay = playerStats?.lastWorkoutDate === new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) || Number(todayData?.workoutBurn ?? todayData?.burned ?? 0) > 100;
      const hourNow = new Date().getHours();
      const mealMoment = hourNow < 10 ? 'colazione' : hourNow < 14 ? 'pranzo' : hourNow < 18 ? 'spuntino pomeridiano' : 'cena';
      const last7 = systemLogs.slice(-7);
      const avgProt7 = last7.length ? Math.round(last7.reduce((s, l) => s + Number(l.protein || 0), 0) / last7.length) : 0;
      const avgKcal7 = last7.length ? Math.round(last7.reduce((s, l) => s + Number(l.consumed || 0), 0) / last7.length) : 0;
      const trainDays7 = last7.filter((l) => Number(l.workoutBurn ?? l.burned ?? 0) > 100).length;
      const pesoKg = Number(playerStats?.currentWeightKg || todayData?.weight || 0) || Number([...systemLogs].reverse().find((l) => l.weight > 0)?.weight || 70);
      const altezzaCm = Number(playerStats?.heightCm || metabolicProfile?.heightCm || 178);
      const bmi = altezzaCm > 0 ? (pesoKg / ((altezzaCm / 100) ** 2)).toFixed(1) : '?';
      const eta = playerStats?.age || metabolicProfile?.age || 25;
      const sesso = playerStats?.sex || metabolicProfile?.sex || 'male';
      const pesoTarget = playerStats?.bodyGoal?.targetWeightKg;
      const deltaKg = pesoTarget ? (pesoKg - pesoTarget).toFixed(1) : null;

      const profileCtx = `PROFILO SHADOW HUNTER COMPLETO:
- Obiettivo: ${playerStats?.objective || 'recomp'} | Livello ${playerStats?.level || 1} | Streak ${playerStats?.streak || 0}gg
- Dati fisici: ${pesoKg}kg | ${altezzaCm}cm | BMI ${bmi} | ${eta} anni | ${sesso === 'male' ? 'uomo' : 'donna'}
${deltaKg ? `- Obiettivo peso: ${pesoTarget}kg (${Number(deltaKg) > 0 ? '-' : '+'}${Math.abs(deltaKg)}kg da raggiungere)` : ''}
- Attività: ${playerStats?.activityMode || metabolicProfile?.activityMode || 'moderate'} | Allenamenti ultimi 7gg: ${trainDays7}/7
- Giornata: ${isTrainingDay ? '🔥 ALLENAMENTO — priorità a carb+proteine per performance/recovery' : '😴 RIPOSO — preferisci cibi sazianti e micronutrienti'}
- Momento: ${mealMoment} (ore ${hourNow})
- MACRO RESIDUE OGGI: ${kcalResidui} kcal | P: ${protResidui}g | C: ${carbResidui}g | G: ${fatResidui}g
- Media 7gg: ${avgKcal7} kcal/die | ${avgProt7}g prot/die (target ${Math.round(Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 150))}g)
- Kcal target giornaliero: ${Math.round(Number(effectiveDailyGoal || dailyGoal || 2400))} kcal`;

      const systemPrompt = `Sei uno chef nutrizionale d'élite specializzato in FITPORN — cibo che è allo stesso tempo ESTETICAMENTE PERFETTO e ultra-ottimizzato per le performance atletiche. Le tue ricette devono far venire l'acquolina in bocca solo a leggerle.

STILE OBBLIGATORIO:
- Titolo epico e evocativo (es: "Salmon Inferno Bowl", "Thunder Chicken Wrap", "Zero Guilt Dark Choc Mousse")
- Tagline che fa DESIDERARE il piatto (max 15 parole, molto visiva e appetitosa)
- Ingredienti con grammature precise e piccoli trucchi da chef (es: "180g petto pollo — battuto sottile per cottura uniforme")
- Steps concreti con tecniche vere (Maillard reaction, marinatura rapida, textura croccante)
- Emoji pertinenti negli steps per renderli scansionabili
- Note: 1 hack nutrizionale o variante fitporn

VINCOLO FERRO: la ricetta DEVE rispettare i macro residui del profilo. Se le proteine residue sono basse, fai una ricetta low-protein. Se è giorno di allenamento, priorità a carbs + proteine.

Rispondi SOLO JSON valido:
{"title":"string","emoji":"emoji","tagline":"string appetitosa max 15 parole","prepMin":numero,"cookMin":numero,"difficulty":"facile|medio|avanzato","mood":"performance|recovery|comfort|light","ingredients":[{"item":"string","amount":"string"}],"steps":["string con emoji"],"kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"fiber":numero,"fitScore":numero_1_10,"notes":"string hack nutrizionale"}`;

      const userMsg = autoMode
        ? `${profileCtx}\n\nCrea LA ricetta fitporn perfetta per questo momento. Sorprendimi con qualcosa di straordinario che non mi aspetto.`
        : `${profileCtx}\n\nRichiesta specifica: ${prompt}\n\nCrea una versione fitporn di questa ricetta, adattata ai miei macro residui.`;

      const data = await requestSystemAI({
        model: getModelFor('recipe') || undefined,
        temperature: 0.82,
        max_tokens: 700,
        timeoutMs: 28000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ]
      });
      const parsed = parseModelJson(data);
      const nextRecipe = {
        title: String(parsed?.title || 'Ricetta AI').slice(0, 80),
        emoji: String(parsed?.emoji || '🍽️').slice(0, 8),
        tagline: String(parsed?.tagline || '').slice(0, 120),
        prepMin: Math.max(0, Math.min(120, Math.round(Number(parsed?.prepMin || 10)))),
        cookMin: Math.max(0, Math.min(120, Math.round(Number(parsed?.cookMin || 10)))),
        difficulty: ['facile','medio','avanzato'].includes(parsed?.difficulty) ? parsed.difficulty : 'facile',
        mood: parsed?.mood || 'performance',
        ingredients: Array.isArray(parsed?.ingredients)
          ? parsed.ingredients.map((x) => typeof x === 'string' ? { item: x, amount: '' } : x).filter((x) => x?.item).slice(0, 16)
          : [],
        steps: Array.isArray(parsed?.steps) ? parsed.steps.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10) : [],
        kcal: Math.max(0, Math.round(Number(parsed?.kcal || 0))),
        protein: Math.max(0, Math.round(Number(parsed?.protein || 0))),
        carbs: Math.max(0, Math.round(Number(parsed?.carbs || 0))),
        fat: Math.max(0, Math.round(Number(parsed?.fat || 0))),
        fiber: Math.max(0, Math.round(Number(parsed?.fiber || 0))),
        fitScore: Math.min(10, Math.max(1, Math.round(Number(parsed?.fitScore || 7)))),
        notes: String(parsed?.notes || '').slice(0, 280),
        createdAt: new Date().toISOString(),
        auto: autoMode,
      };
      setGeneratedRecipe(nextRecipe);
      // Salva in storico ricette (max 10)
      const histKey = 'shadow_monarch_recipe_history';
      try {
        const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift(nextRecipe);
        localStorage.setItem(histKey, JSON.stringify(hist.slice(0, 10)));
      } catch (_) {}
      playSfx('success', soundEnabled, soundTheme);
      emitUiToast({ message: `🍽️ ${nextRecipe.title} — pronta!`, tone: 'success', durationMs: 3000 });
    } catch (error) {
      const detail = formatAiErrorDetail(error?.message || 'errore recipe').slice(0, 90);
      emitUiToast({ message: `Ricetta fallita (${detail})`, tone: 'warning', durationMs: 4200 });
      playSfx('warning', soundEnabled, soundTheme);
    } finally {
      setIsGeneratingRecipe(false);
    }
  };
  const saveBodyCompositionGoal = () => {
    const targetWeightKg = Number(bodyGoalInput.targetWeightKg || 0);
    const targetFatPct = Number(bodyGoalInput.targetFatPct || 0);
    updatePlayerStats((prev) => ({
      ...prev,
      bodyGoal: {
        targetWeightKg: targetWeightKg > 0 ? targetWeightKg : 0,
        targetFatPct: targetFatPct > 0 ? targetFatPct : 0,
        updatedAt: new Date().toISOString()
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const saveEveningCheckin = () => {
    const checkin = {
      date: todayIso,
      hunger: Math.min(10, Math.max(1, Number(eveningCheckin.hunger || 5))),
      craving: Math.min(10, Math.max(1, Number(eveningCheckin.craving || 5))),
      eveningEnergy: Math.min(10, Math.max(1, Number(eveningCheckin.eveningEnergy || 6))),
      bloating: Math.min(10, Math.max(1, Number(eveningCheckin.bloating || 4))),
      digestion: Math.min(10, Math.max(1, Number(eveningCheckin.digestion || 6))),
      tolerance: Math.min(10, Math.max(1, Number(eveningCheckin.tolerance || 7))),
      stress: Math.min(10, Math.max(1, Number(eveningCheckin.stress || 5))),
      dayQuality: Math.min(10, Math.max(1, Number(eveningCheckin.dayQuality || 6))),
      notes: String(eveningCheckin.notes || '').slice(0, 180)
    };
    updatePlayerStats((prev) => ({
      ...prev,
      lastEveningCheckinDate: todayIso,
      lastEveningCheckin: checkin,
      eveningCheckins: [checkin, ...((prev.eveningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    saveToSystem({
      bloatingLevel: checkin.bloating,
      digestionRegularity: checkin.digestion,
      mealTolerance: checkin.tolerance,
      cravingLevel: checkin.craving,
      hungerLevel: checkin.hunger,
      energyLevel: checkin.eveningEnergy
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const quickSaveEveningCheckin = () => {
    const checkin = {
      date: todayIso,
      hunger: 5,
      craving: 5,
      eveningEnergy: 6,
      bloating: 4,
      digestion: 6,
      tolerance: 7,
      stress: 5,
      dayQuality: 6,
      notes: ''
    };
    setEveningCheckin((prev) => ({ ...prev, ...checkin }));
    updatePlayerStats((prev) => ({
      ...prev,
      lastEveningCheckinDate: todayIso,
      lastEveningCheckin: checkin,
      eveningCheckins: [checkin, ...((prev.eveningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    saveToSystem({
      bloatingLevel: checkin.bloating,
      digestionRegularity: checkin.digestion,
      mealTolerance: checkin.tolerance,
      cravingLevel: checkin.craving,
      hungerLevel: checkin.hunger,
      energyLevel: checkin.eveningEnergy
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const saveMorningCheckin = () => {
    const checkin = {
      date: todayIso,
      sleepHours: Math.max(0, Math.min(12, Number(morningCheckin.sleepHours || 0))),
      sleepQuality: Math.max(1, Math.min(10, Number(morningCheckin.sleepQuality || 7))),
      awakenings: Math.max(0, Math.min(12, Number(morningCheckin.awakenings || 1))),
      hrRest: Math.max(30, Math.min(130, Number(morningCheckin.hrRest || 60))),
      hrvMs: Math.max(10, Math.min(180, Number(morningCheckin.hrvMs || 45))),
      energy: Math.max(1, Math.min(10, Number(morningCheckin.energy || 6))),
      stress: Math.max(1, Math.min(10, Number(morningCheckin.stress || 4)))
    };
    updatePlayerStats((prev) => ({
      ...prev,
      lastMorningCheckinDate: todayIso,
      lastMorningCheckin: checkin,
      energyLevel: checkin.energy,
      stressLevel: checkin.stress,
      morningCheckins: [checkin, ...((prev.morningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    saveToSystem({
      sleepHours: checkin.sleepHours,
      sleepQuality: checkin.sleepQuality,
      awakenings: checkin.awakenings,
      hrRest: checkin.hrRest,
      hrvMs: checkin.hrvMs,
      energyLevel: checkin.energy
    });
    setReadinessInput((prev) => ({ ...prev, sleepHours: checkin.sleepHours, energy: checkin.energy, stress: checkin.stress }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const quickSaveMorningCheckin = () => {
    const checkin = {
      date: todayIso,
      sleepHours: 7.5,
      sleepQuality: 7,
      awakenings: 1,
      hrRest: 60,
      hrvMs: 45,
      energy: 7,
      stress: 4
    };
    setMorningCheckin((prev) => ({ ...prev, ...checkin }));
    updatePlayerStats((prev) => ({
      ...prev,
      lastMorningCheckinDate: todayIso,
      lastMorningCheckin: checkin,
      energyLevel: checkin.energy,
      stressLevel: checkin.stress,
      morningCheckins: [checkin, ...((prev.morningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    saveToSystem({
      sleepHours: checkin.sleepHours,
      sleepQuality: checkin.sleepQuality,
      awakenings: checkin.awakenings,
      hrRest: checkin.hrRest,
      hrvMs: checkin.hrvMs,
      energyLevel: checkin.energy
    });
    setReadinessInput((prev) => ({ ...prev, sleepHours: checkin.sleepHours, energy: checkin.energy, stress: checkin.stress }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };
  const toggleSkincareMorning = () => {
    const next = !Boolean(todayData.skincareMorning);
    saveToSystem({ skincareMorning: next });
    playSfx('click', soundEnabled, soundTheme);
    emitUiToast({ message: `Skincare mattina ${next ? 'completata' : 'rimossa'}`, tone: next ? 'success' : 'info', durationMs: 2800 });
  };
  const toggleSkincareEvening = () => {
    const next = !Boolean(todayData.skincareEvening);
    saveToSystem({ skincareEvening: next });
    playSfx('click', soundEnabled, soundTheme);
    emitUiToast({ message: `Skincare sera ${next ? 'completata' : 'rimossa'}`, tone: next ? 'success' : 'info', durationMs: 2800 });
  };
  const doResetTodayQuickLog = () => {
    const snapshot = {
      consumed: Number(todayData.consumed || 0),
      burned: Number(todayData.burned || 0),
      workoutBurn: Number(todayData.workoutBurn ?? todayData.burned ?? 0),
      activeBurn: Number(todayData.activeBurn || 0),
      protein: Number(todayData.protein || 0),
      carbs: Number(todayData.carbs || 0),
      fatMacros: Number(todayData.fatMacros || 0),
      fiber: Number(todayData.fiber || 0),
      satFat: Number(todayData.satFat || 0),
      monoFat: Number(todayData.monoFat || 0),
      polyFat: Number(todayData.polyFat || 0),
      sugars: Number(todayData.sugars || 0),
      sodiumMg: Number(todayData.sodiumMg || 0),
      potassiumMg: Number(todayData.potassiumMg || 0),
      omega3Mg: Number(todayData.omega3Mg || 0),
      calciumMg: Number(todayData.calciumMg || 0),
      ironMg: Number(todayData.ironMg || 0),
      magnesiumMg: Number(todayData.magnesiumMg || 0),
      waistCm: Number(todayData.waistCm || 0),
      hrRest: Number(todayData.hrRest || 0),
      hrvMs: Number(todayData.hrvMs || 0),
      sleepQuality: Number(todayData.sleepQuality || 0),
      awakenings: Number(todayData.awakenings || 0),
      bloatingLevel: Number(todayData.bloatingLevel || 0),
      digestionRegularity: Number(todayData.digestionRegularity || 0),
      mealTolerance: Number(todayData.mealTolerance || 0),
      cravingLevel: Number(todayData.cravingLevel || 0),
      hungerLevel: Number(todayData.hungerLevel || 0),
      mealBreakfastKcal: Number(todayData.mealBreakfastKcal || 0),
      mealLunchKcal: Number(todayData.mealLunchKcal || 0),
      mealDinnerKcal: Number(todayData.mealDinnerKcal || 0),
      waterMl: Number(todayData.waterMl || 0),
      steps: Number(todayData.steps || 0)
    };
    saveToSystem({
      consumed: 0,
      burned: 0,
      protein: 0,
      carbs: 0,
      fatMacros: 0,
      fiber: 0,
      satFat: 0,
      monoFat: 0,
      polyFat: 0,
      sugars: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      omega3Mg: 0,
      calciumMg: 0,
      ironMg: 0,
      magnesiumMg: 0,
      waistCm: 0,
      hrRest: 0,
      hrvMs: 0,
      sleepQuality: 0,
      awakenings: 0,
      bloatingLevel: 0,
      digestionRegularity: 0,
      mealTolerance: 0,
      cravingLevel: 0,
      hungerLevel: 0,
      mealBreakfastKcal: 0,
      mealLunchKcal: 0,
      mealDinnerKcal: 0,
      waterMl: 0,
      steps: 0
    });
    playSfx('warning', soundEnabled, soundTheme);
    emitUiToast({
      message: 'Reset giorno completato',
      tone: 'warning',
      actionLabel: 'Annulla',
      onAction: () => {
        saveToSystem(snapshot);
      }
    });
  };
  const beginHoldResetToday = () => {
    if (resetTodayTimerRef.current) return;
    setHoldResetToday(true);
    resetTodayTimerRef.current = window.setTimeout(() => {
      doResetTodayQuickLog();
      setHoldResetToday(false);
      resetTodayTimerRef.current = null;
    }, 1500);
  };
  const cancelHoldResetToday = () => {
    if (resetTodayTimerRef.current) {
      clearTimeout(resetTodayTimerRef.current);
      resetTodayTimerRef.current = null;
    }
    setHoldResetToday(false);
  };
  const shareWeeklySnapshot = async () => {
    const lines = [
      `Shadow Weekly Snapshot`,
      `Kcal adherence: ${weeklyReview.kcalAdherencePct}%`,
      `Hydration adherence: ${weeklyReview.hydrationAdherencePct}%`,
      `Training days: ${weeklyReview.trainingDays}`,
      `Sleep avg: ${weeklyReview.avgSleep} h`,
      `Sodio avg: ${avgSodium7d} mg`,
      `Potassio avg: ${avgPotassium7d} mg`,
      `Omega-3 avg: ${avgOmega37d} mg`,
      `Peso medio 7d: ${weeklyWeightAvg || '--'} kg (${prevWeeklyWeightAvg ? `${(weeklyWeightAvg - prevWeeklyWeightAvg) > 0 ? '+' : ''}${(weeklyWeightAvg - prevWeeklyWeightAvg).toFixed(1)} vs prev` : 'n/a'})`,
      `Vita: ${waistCurrent || '--'} cm ${waistPrev ? `(${(waistCurrent - waistPrev) > 0 ? '+' : ''}${(waistCurrent - waistPrev).toFixed(1)} cm)` : ''}`,
      `Readiness: ${readiness.score} (${readiness.intensity})`,
      `Recovery advanced: ${recoveryAdvancedScore} (${recoveryAdvancedLabel})`,
      `Weight trend: ${weightTrend.weeklyDeltaKg > 0 ? '+' : ''}${weightTrend.weeklyDeltaKg} kg / ${weightTrend.weeklyDeltaPct > 0 ? '+' : ''}${weightTrend.weeklyDeltaPct}%`,
      '',
      `Alert: ${smartNutritionAlerts.length ? smartNutritionAlerts.join(' | ') : 'Nessun alert nutrizionale critico'}`
    ];
    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Shadow Weekly Snapshot', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      alert('Snapshot copiato negli appunti.');
    } catch (_) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadow-weekly-snapshot-${todayIso}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const regenerateWeeklyCoachReport = () => {
    const recent = [...systemLogs].slice(-7);
    const days = Math.max(1, recent.length);
    const kcalAdh = Math.round((recent.filter((log) => {
      const consumed = Number(log?.consumed || 0);
      const goal = Math.max(1, Number(getCalorieTargetForLog(log) || dailyGoal || 2400));
      return consumed >= goal * 0.8 && consumed <= goal * 1.15;
    }).length / days) * 100);
    const hydrationAdh = Math.round((recent.filter((log) => Number(log?.waterMl || 0) >= hydrationGoal * 0.8).length / days) * 100);
    const proteinAdh = Math.round((recent.filter((log) => Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8).length / days) * 100);
    const sleepAvg = Number((recent.reduce((sum, log) => sum + Number(log?.sleepHours || 0), 0) / days).toFixed(1));
    const trainingDays = recent.filter((log) => Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0).length;
    const readinessAvg = Number((recent.reduce((sum, log) => sum + Number(log?.recoveryScore || 0), 0) / days).toFixed(0));
    const score = Math.round(
      (kcalAdh * 0.28) +
      (hydrationAdh * 0.2) +
      (proteinAdh * 0.2) +
      (Math.min(100, (sleepAvg / 8) * 100) * 0.14) +
      (Math.min(100, (trainingDays / 4) * 100) * 0.1) +
      (Math.min(100, readinessAvg) * 0.08)
    );
    const wins = [
      kcalAdh >= 85 ? `Kcal adherence forte (${kcalAdh}%)` : null,
      hydrationAdh >= 85 ? `Idratazione solida (${hydrationAdh}%)` : null,
      proteinAdh >= 85 ? `Proteine solide (${proteinAdh}%)` : null,
      sleepAvg >= 7.2 ? `Sleep medio buono (${sleepAvg}h)` : null,
      trainingDays >= 4 ? `Training costante (${trainingDays}/7)` : null
    ].filter(Boolean).slice(0, 3);
    const risks = [
      kcalAdh < 75 ? 'Kcal adherence instabile' : null,
      hydrationAdh < 75 ? 'Acqua sotto target' : null,
      proteinAdh < 75 ? 'Proteine sotto target' : null,
      sleepAvg < 6.8 ? 'Sleep debt in crescita' : null,
      trainingDays < 3 ? 'Volume allenante basso' : null
    ].filter(Boolean).slice(0, 3);
    const nextWeekPlan = [
      hydrationAdh < 80 ? '2 trigger acqua fissi (+400ml mattina, +400ml pomeriggio).' : 'Mantieni routine acqua attuale.',
      proteinAdh < 80 ? 'Aggiungi 25-35g proteine nel pasto più debole.' : 'Conferma quota proteica attuale.',
      trainingDays < 4 ? 'Pianifica 3-4 sessioni brevi (20-35 min) nel calendario.' : 'Mantieni la frequenza training.',
      sleepAvg < 7 ? 'Anticipa di 25-30 min la sleep window.' : 'Conserva la sleep window attuale.'
    ].slice(0, 4);
    const summary = `Score ${score}/100 · Kcal ${kcalAdh}% · H2O ${hydrationAdh}% · Prot ${proteinAdh}% · Sleep ${sleepAvg}h · Train ${trainingDays}/7`;
    const mergedSummary = `${summary} · WD ${complianceByDayType.weekday.score}% / WE ${complianceByDayType.weekend.score}%`;
    const mergedFocus = [
      ...(smartWeeklyCoachActions.length ? smartWeeklyCoachActions : ['Settimana solida: mantieni routine e progressione lineare.']),
      hungerGuardrail.active ? 'Fame/craving alti: applica guardrail +120 kcal nei giorni duri.' : null,
      complianceByDayType.weekend.score + 8 < complianceByDayType.weekday.score ? 'Weekend compliance bassa: prepara 1 template pasti sab/dom.' : null
    ].filter(Boolean).slice(0, 4);
    const mergedWins = [
      ...wins,
      complianceByDayType.weekend.score >= 78 ? `Weekend compliance solida (${complianceByDayType.weekend.score}%)` : null
    ].filter(Boolean).slice(0, 3);
    const mergedRisks = [
      ...risks,
      complianceByDayType.weekend.score > 0 && complianceByDayType.weekend.score + 10 < complianceByDayType.weekday.score ? 'Gap weekend vs weekday marcato' : null,
      refeedSmart.eligible ? 'Cut stressato: valuta refeed controllato' : null
    ].filter(Boolean).slice(0, 3);
    const mergedPlan = [
      ...nextWeekPlan,
      `Hydration smart target: ${hydrationIntel.target} ml`,
      performanceNutritionLink.ready ? `Performance fuel delta: ${performanceNutritionLink.delta > 0 ? '+' : ''}${performanceNutritionLink.delta}` : 'Performance fuel: servono piu dati',
      giInsights.top?.[0] ? `GI trigger: ${giInsights.top[0].food} (${giInsights.top[0].symptomAvg}/10)` : 'GI tracker: logga 3+ trigger'
    ].slice(0, 4);

    updatePlayerStats((prev) => ({
      ...prev,
      sundayAutoReport: {
        weekKey: getIsoWeekKey(),
        createdAt: new Date().toISOString(),
        summary: mergedSummary,
        score,
        focus: mergedFocus,
        wins: mergedWins,
        risks: mergedRisks,
        nextWeekPlan: mergedPlan,
        advanced: {
          complianceByDayType,
          hungerGuardrail: { active: hungerGuardrail.active, hungerAvg: hungerGuardrail.hungerAvg, cravingAvg: hungerGuardrail.cravingAvg },
          hydrationSmartTarget: hydrationIntel.target,
          performanceFuelDelta: performanceNutritionLink.delta || 0,
          performanceFuelSamples: (performanceNutritionLink.highCount || 0) + (performanceNutritionLink.lowCount || 0),
          refeedEligible: refeedSmart.eligible,
          giTop: giInsights.top?.[0] ? `${giInsights.top[0].food} (${giInsights.top[0].symptomAvg}/10)` : ''
        }
      }
    }));
    emitUiToast({ message: `Weekly Coach aggiornato (${score}/100)`, tone: 'success', durationMs: 2800 });
  };
  const regenerateMonthlyBossReport = () => {
    const recent = [...systemLogs].slice(-30);
    const prev = [...systemLogs].slice(-60, -30);
    const days = Math.max(1, recent.length);
    const prevDays = Math.max(1, prev.length);

    const calcBlock = (logs, den) => {
      const kcalAdh = Math.round((logs.filter((log) => {
        const consumed = Number(log?.consumed || 0);
        const goal = Math.max(1, Number(getCalorieTargetForLog(log) || dailyGoal || 2400));
        return consumed >= goal * 0.8 && consumed <= goal * 1.15;
      }).length / den) * 100);
      const hydrationAdh = Math.round((logs.filter((log) => Number(log?.waterMl || 0) >= hydrationGoal * 0.8).length / den) * 100);
      const proteinAdh = Math.round((logs.filter((log) => Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8).length / den) * 100);
      const sleepAvg = Number((logs.reduce((sum, log) => sum + Number(log?.sleepHours || 0), 0) / den).toFixed(1));
      const trainingDays = logs.filter((log) => Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0).length;
      const readinessAvg = Number((logs.reduce((sum, log) => sum + Number(log?.recoveryScore || 0), 0) / den).toFixed(0));
      const score = Math.round(
        (kcalAdh * 0.26) +
        (hydrationAdh * 0.2) +
        (proteinAdh * 0.2) +
        (Math.min(100, (sleepAvg / 8) * 100) * 0.14) +
        (Math.min(100, (trainingDays / Math.max(6, Math.round(den * 0.22))) * 100) * 0.1) +
        (Math.min(100, readinessAvg) * 0.1)
      );
      return { kcalAdh, hydrationAdh, proteinAdh, sleepAvg, trainingDays, readinessAvg, score };
    };

    const current = calcBlock(recent, days);
    const previous = calcBlock(prev, prevDays);
    const scoreDelta = current.score - previous.score;

    const wins = [
      current.kcalAdh >= 82 ? `Kcal adherence forte (${current.kcalAdh}%)` : null,
      current.hydrationAdh >= 82 ? `Idratazione stabile (${current.hydrationAdh}%)` : null,
      current.proteinAdh >= 82 ? `Proteine consistenti (${current.proteinAdh}%)` : null,
      current.sleepAvg >= 7 ? `Sleep medio ok (${current.sleepAvg}h)` : null,
      current.trainingDays >= Math.max(6, Math.round(days * 0.22)) ? `Training volume solido (${current.trainingDays} gg)` : null
    ].filter(Boolean).slice(0, 4);
    const risks = [
      current.kcalAdh < 75 ? 'Kcal adherence sotto range.' : null,
      current.hydrationAdh < 75 ? 'Acqua sotto target per troppe giornate.' : null,
      current.proteinAdh < 75 ? 'Proteine sotto target in modo ricorrente.' : null,
      current.sleepAvg < 6.8 ? 'Sleep debt in crescita.' : null,
      current.trainingDays < Math.max(5, Math.round(days * 0.18)) ? 'Volume training basso per il mese.' : null
    ].filter(Boolean).slice(0, 4);
    const nextMonthPlan = [
      current.hydrationAdh < 80 ? 'Fissa 2 reminder acqua (mattina/pomeriggio).' : 'Conferma routine idratazione attuale.',
      current.proteinAdh < 80 ? 'Porta +25g proteine nel pasto più debole.' : 'Mantieni quota proteica attuale.',
      current.trainingDays < Math.max(6, Math.round(days * 0.22)) ? 'Programma 3-4 settimane con minimo 2-3 sessioni/sett.' : 'Spingi progressione carico/volume in sicurezza.',
      current.sleepAvg < 7 ? 'Anticipa di 20-30 min la sleep window.' : 'Mantieni orario sonno stabile.',
      scoreDelta < 0 ? 'Riduci complessità: punta su aderenza prima di aumentare volume.' : 'Incremento controllato: +5-8% volume allenante.'
    ].slice(0, 5);
    const summary = `Score ${current.score}/100 (${scoreDelta >= 0 ? '+' : ''}${scoreDelta} vs prev) · Kcal ${current.kcalAdh}% · H2O ${current.hydrationAdh}% · Prot ${current.proteinAdh}% · Sleep ${current.sleepAvg}h · Train ${current.trainingDays}d`;

    updatePlayerStats((prev) => ({
      ...prev,
      monthlyBossReport: {
        monthKey: getMonthKey(),
        createdAt: new Date().toISOString(),
        summary,
        score: current.score,
        prevScore: previous.score,
        scoreDelta,
        metrics: current,
        wins,
        risks,
        nextMonthPlan
      }
    }));
    emitUiToast({ message: `Monthly Boss Report aggiornato (${current.score}/100)`, tone: 'success', durationMs: 3200 });
  };

  useEffect(() => {
    if (!playerStats.autoAdjustEnabled) return;
    if (weeklyReview.daysTracked < 7) return;
    if (!weightTrend.kcalAdjustment) return;
    const weekKey = getIsoWeekKey();
    updatePlayerStats((prev) => {
      const meta = prev.autoAdjustMeta || { lastWeekKey: '', streak: 0, lastDirection: 0 };
      if (meta.lastWeekKey === weekKey) return prev;
      const direction = weightTrend.kcalAdjustment > 0 ? 1 : -1;
      const nextStreak = meta.lastDirection === direction ? (meta.streak || 0) + 1 : 1;
      let nextGoal = dailyGoal;
      let applied = false;
      let updatedMeta = { lastWeekKey: weekKey, streak: nextStreak, lastDirection: direction, lastAppliedAt: meta.lastAppliedAt || null };
      if (nextStreak >= 2) {
        nextGoal = Math.max(1300, Number(dailyGoal || 2400) + Number(weightTrend.kcalAdjustment || 0));
        updatedMeta = { ...updatedMeta, streak: 0, lastAppliedAt: new Date().toISOString() };
        applied = true;
      }
      if (applied && nextGoal !== dailyGoal) {
        setDailyGoal(nextGoal);
        setGoalInput(nextGoal);
      }
      return {
        ...prev,
        autoAdjustMeta: updatedMeta
      };
    });
  }, [playerStats.autoAdjustEnabled, weeklyReview.daysTracked, weightTrend.kcalAdjustment, dailyGoal, setDailyGoal]);
  const saveCurrentAsNormalCalories = () => {
    const safeGoal = Math.max(1300, Number(dailyGoal || 2400));
    const previousNormal = Number(playerStats.normalCaloriesTarget || safeGoal);
    updatePlayerStats((prev) => ({
      ...prev,
      normalCaloriesTarget: safeGoal
    }));
    pushCalorieDecision({
      source: 'save_normal',
      from: Number(playerStats.normalCaloriesTarget || safeGoal),
      to: safeGoal,
      note: 'Set new normal calorie target'
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `Normali salvate (${safeGoal})`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        updatePlayerStats((prev) => ({
          ...prev,
          normalCaloriesTarget: previousNormal
        }));
      }
    });
  };
  const restoreNormalCalories = () => {
    const previousGoal = Math.max(1300, Number(dailyGoal || 2400));
    const current = Math.max(1300, Number(dailyGoal || 2400));
    const safeGoal = Math.max(1300, Number(playerStats.normalCaloriesTarget || 2400));
    setDailyGoal(safeGoal);
    setGoalInput(safeGoal);
    pushCalorieDecision({
      source: 'restore_normal',
      from: current,
      to: safeGoal,
      note: 'Restore saved normal calories'
    });
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
    emitUiToast({
      message: `Ripristinate kcal normali (${safeGoal})`,
      tone: 'success',
      actionLabel: 'Annulla',
      onAction: () => {
        setDailyGoal(previousGoal);
        setGoalInput(previousGoal);
      }
    });
  };
  const markWeeklyWeighInDone = () => {
    updatePlayerStats((prev) => ({
      ...prev,
      lastWeeklyWeighInDate: todayIso
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitFxBurst();
  };

  const computePrecisionCalories = () => {
    const w = Math.max(35, parseFloat(metabolicProfile.weightKg) || 0);
    const h = Math.max(120, parseFloat(metabolicProfile.heightCm) || 0);
    const age = Math.max(14, parseInt(metabolicProfile.age, 10) || 0);
    const sexAdj = metabolicProfile.sex === 'female' ? -161 : 5;
    const bmr = (10 * w) + (6.25 * h) - (5 * age) + sexAdj;
    const activityMap = { light: 1.35, moderate: 1.5, high: 1.68, athlete: 1.82 };
    const activityFactor = activityMap[metabolicProfile.activityMode] || 1.5;
    const recentBurnAvg = systemLogs.slice(0, 7).reduce((sum, log) => sum + Number(log.workoutBurn ?? log.burned ?? 0), 0) / Math.max(1, Math.min(systemLogs.length, 7));
    const adaptiveTraining = recentBurnAvg * 0.62;
    const maintenance = Math.round((bmr * activityFactor) + adaptiveTraining);
    const objectiveDelta = metabolicProfile.objective === 'cut' ? -360 : metabolicProfile.objective === 'bulk' ? 280 : 0;
    const compositionDelta = Number(bodyCompCalorieSignal.kcalAdjustment || 0);
    const targetCalories = Math.max(1300, maintenance + objectiveDelta + compositionDelta);
    const weekendSplitMode = String(metabolicProfile.weekendSplitMode || 'off');
    const objectiveWeekendDelta = Math.max(0, Number(OBJECTIVE_WEEKEND_DELTA[String(metabolicProfile.objective || 'recomp')] || 0));
    const weekendBoostEnabled = weekendSplitMode === 'auto' || weekendSplitMode === 'custom';
    const weekendKcalDelta = weekendSplitMode === 'auto'
      ? objectiveWeekendDelta
      : Math.max(0, Math.round(Number(metabolicProfile.weekendKcalDelta || 0)));
    const weekendTargetCalories = weekendBoostEnabled ? Math.max(1300, targetCalories + weekendKcalDelta) : targetCalories;
    const weekdayTargetCalories = weekendBoostEnabled
      ? Math.max(1300, Math.round(((targetCalories * 7) - (weekendTargetCalories * 2)) / 5))
      : targetCalories;
    const weekdayDelta = Math.round(weekdayTargetCalories - targetCalories);
    const weeklyAverageTarget = Math.round(((weekdayTargetCalories * 5) + (weekendTargetCalories * 2)) / 7);
    const proteinPerKg = metabolicProfile.objective === 'cut' ? 2.2 : metabolicProfile.objective === 'bulk' ? 1.9 : 2.0;
    const fatPerKg = metabolicProfile.objective === 'cut' ? 0.8 : 0.9;
    const protein = Math.round(w * proteinPerKg);
    const fats = Math.round(w * fatPerKg);
    const carbs = Math.max(30, Math.round((weekdayTargetCalories - ((protein * 4) + (fats * 9))) / 4));
    const waterTarget = Math.round((w * 34) + Math.min(900, recentBurnAvg * 0.55));
    const result = {
      bmr: Math.round(bmr),
      maintenance,
      targetCalories: weekdayTargetCalories,
      weekdayTargetCalories,
      weekendTargetCalories,
      weeklyAverageTarget,
      weekdayDelta,
      weekendBoostEnabled,
      weekendSplitMode,
      weekendKcalDelta,
      compositionDelta,
      protein,
      fats,
      carbs,
      waterTarget,
      recentBurnAvg: Math.round(recentBurnAvg)
    };
    setMetabolicResult(result);
    return result;
  };

  const applyPrecisionPlan = () => {
    const result = metabolicResult || computePrecisionCalories();
    if (!result) return;
    const baseDaily = Number(result.weekdayTargetCalories || result.targetCalories || dailyGoal || 2400);
    setDailyGoal(baseDaily);
    setGoalInput(baseDaily);
    setHydrationGoal(result.waterTarget);
    setMacroGoals({ carbs: result.carbs, protein: result.protein, fats: result.fats });
    setPlayerStats((prev) => ({
      ...prev,
      sex: metabolicProfile.sex,
      age: parseInt(metabolicProfile.age, 10) || prev.age,
      heightCm: parseInt(metabolicProfile.heightCm, 10) || prev.heightCm,
      currentWeightKg: parseFloat(metabolicProfile.weightKg) || prev.currentWeightKg,
      activityMode: metabolicProfile.activityMode,
      objective: metabolicProfile.objective,
      weekendCalorieBoostEnabled: Boolean(result.weekendBoostEnabled),
      weekendCalorieSplitMode: String(result.weekendSplitMode || metabolicProfile.weekendSplitMode || 'off'),
      weekendCalorieDelta: Math.max(0, Number(result.weekendKcalDelta || 0)),
      weekendCalorieWeekdayTarget: Math.max(1300, Number(result.weekdayTargetCalories || baseDaily)),
      weekendCalorieWeekendTarget: Math.max(1300, Number(result.weekendTargetCalories || baseDaily))
    }));
  };

  const claimMilestoneReward = () => {
    if (!claimableMilestone) return;
    const rewards = {
      3: { gold: 28, exp: 22 },
      7: { gold: 56, exp: 44 },
      14: { gold: 112, exp: 84 },
      21: { gold: 182, exp: 126 },
      30: { gold: 280, exp: 175 },
      50: { gold: 490, exp: 280 }
    };
    const reward = rewards[claimableMilestone] || { gold: 35, exp: 20 };
    const scaledReward = {
      gold: Math.round(Number(reward.gold || 0) * rewardHealthMultiplier),
      exp: Math.round(Number(reward.exp || 0) * rewardHealthMultiplier)
    };
    setPlayerStats((prev) => ({
      ...prev,
      gold: (prev.gold || 0) + scaledReward.gold,
      exp: (prev.exp || 0) + scaledReward.exp,
      streakMilestonesClaimed: [...(prev.streakMilestonesClaimed || []), claimableMilestone]
    }));
    playSfx('success', soundEnabled, soundTheme);
    speakEvent('milestone_claim', voiceEnabled, voicePack);
    emitFxBurst();
  };
  const shiftQuickLogDate = (delta) => {
    setQuickLogDaysBack((prev) => Math.max(0, Number(prev || 0) + Number(delta || 0)));
  };
  const estimateQuickWorkoutBurn = ({ sportId, intensityId, durationMin, distanceKm, rpe, weightKg, reportedKcal }) => {
    const reported = Math.max(0, Math.round(Number(reportedKcal || 0)));
    if (reported > 0) return reported;
    const sport = QUICK_WORKOUT_SPORTS.find((item) => item.id === sportId) || QUICK_WORKOUT_SPORTS[0];
    const intensity = QUICK_WORKOUT_INTENSITY.find((item) => item.id === intensityId) || QUICK_WORKOUT_INTENSITY[1];
    const durationHours = Math.max(0, Number(durationMin || 0)) / 60;
    const distance = Math.max(0, Number(distanceKm || 0));
    const weight = Math.max(42, Math.min(180, Number(weightKg || 70)));
    const rpeMul = 0.85 + (Math.max(1, Math.min(10, Number(rpe || 6))) * 0.04);
    const metBurn = Math.max(0, Number(sport.met || 0)) * weight * durationHours;
    const distanceBurn = sport.id === 'run'
      ? distance * weight * 1.03
      : sport.id === 'football'
        ? distance * weight * 0.95
        : sport.id === 'walk'
          ? distance * weight * 0.58
          : sport.id === 'bike'
            ? distance * weight * 0.36
            : distance * weight * 0.72;
    const blended = metBurn > 0 && distanceBurn > 0 ? ((metBurn * 0.62) + (distanceBurn * 0.38)) : Math.max(metBurn, distanceBurn);
    const baseStrengthLike = sport.id === 'none' ? (Math.max(10, Number(durationMin || 0)) * 5.1) : 0;
    const raw = (blended + baseStrengthLike) * Number(intensity.burnMul || 1) * rpeMul;
    const minCap = Math.max(90, Math.round(Math.max(10, Number(durationMin || 35)) * 3));
    const maxCap = Math.min(1400, Math.max(520, Math.round(Math.max(10, Number(durationMin || 35)) * 18)));
    return Math.max(minCap, Math.min(maxCap, Math.round(raw)));
  };
  const estimateQuickWorkoutBurnWithAI = async ({ sportMeta, intensityMeta, durationMin, distanceKm, rpe, reportedKcal, weightKg, localEstimate, title, note }) => {
    if (reportedKcal > 0) {
      return {
        burnedKcal: reportedKcal,
        confidence: 'high',
        note: 'Watch kcal'
      };
    }
    const payload = await requestSystemAI({
      max_tokens: 180,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'Sei un coach fitness data-driven. Stima kcal bruciate in modo realistico e conservativo. Rispondi SOLO JSON valido: {"kcalBurned":numero_intero,"confidence":"low|medium|high","note":"string breve"}.'
        },
        {
          role: 'user',
          content: `Workout rapido: ${title}. Sport: ${sportMeta.label}. Intensita: ${intensityMeta.label}. Durata: ${durationMin} min. Distanza: ${distanceKm} km. RPE: ${rpe}/10. Peso: ${Math.round(weightKg)} kg. Nota: ${note || 'n/a'}. Stima locale: ${localEstimate} kcal. Fornisci una stima finale unica.`
        }
      ]
    });
    const parsed = parseModelJson(payload, { schema: 'workout_burn_estimate' });
    const aiKcal = Math.max(0, Math.round(Number(parsed?.kcalBurned || 0)));
    if (!aiKcal) throw new Error('ai_burn_empty');
    const minCap = Math.max(90, Math.round(Math.max(10, Number(durationMin || 35)) * 3));
    const maxCap = Math.min(1400, Math.max(520, Math.round(Math.max(10, Number(durationMin || 35)) * 18)));
    return {
      burnedKcal: Math.max(minCap, Math.min(maxCap, aiKcal)),
      confidence: String(parsed?.confidence || 'medium'),
      note: String(parsed?.note || 'AI estimate')
    };
  };
  const estimateQuickWorkoutStrength = ({ sportId, intensityId, durationMin }) => {
    const intensity = QUICK_WORKOUT_INTENSITY.find((item) => item.id === intensityId) || QUICK_WORKOUT_INTENSITY[1];
    const duration = Math.max(10, Number(durationMin || 35));
    if (sportId === 'none') return Math.max(8, Math.round((duration * 0.78) * Number(intensity.strengthMul || 1)));
    return Math.max(4, Math.round((duration * 0.26) * Number(intensity.strengthMul || 1)));
  };
  const saveQuickWorkoutOnDate = async () => {
    if (quickWorkoutSaving) return;
    setQuickWorkoutSaving(true);
    try {
      const sportId = String(quickWorkoutDraft.sportId || 'none');
      const intensityId = String(quickWorkoutDraft.intensityId || 'medium');
      const durationMin = Math.max(10, Math.round(toMetricNumber(quickWorkoutDraft.durationMin) || (travelModeEnabled ? 22 : 45)));
      const distanceKm = Math.max(0, Number(toMetricNumber(quickWorkoutDraft.distanceKm).toFixed(1)));
      const rpe = Math.max(1, Math.min(10, Math.round(toMetricNumber(quickWorkoutDraft.rpe) || 6)));
      const reportedKcal = Math.max(0, Math.round(toMetricNumber(quickWorkoutDraft.reportedKcal)));
      const sportMeta = QUICK_WORKOUT_SPORTS.find((item) => item.id === sportId) || QUICK_WORKOUT_SPORTS[0];
      const intensityMeta = QUICK_WORKOUT_INTENSITY.find((item) => item.id === intensityId) || QUICK_WORKOUT_INTENSITY[1];
      const title = String(quickWorkoutDraft.title || '').trim() || `${sportMeta.label} Session`;
      const note = String(quickWorkoutDraft.note || '').trim();
      const localBurnEstimate = estimateQuickWorkoutBurn({
        sportId,
        intensityId,
        durationMin,
        distanceKm,
        rpe,
        weightKg: Number(playerStats?.currentWeightKg || 70),
        reportedKcal
      });
      let burnedKcal = localBurnEstimate;
      let burnConfidence = reportedKcal > 0 ? 'high' : 'medium';
      let burnNote = reportedKcal > 0 ? 'Watch kcal' : 'Local estimate';
      try {
        const aiResult = await estimateQuickWorkoutBurnWithAI({
          sportMeta,
          intensityMeta,
          durationMin,
          distanceKm,
          rpe,
          reportedKcal,
          weightKg: Number(playerStats?.currentWeightKg || 70),
          localEstimate: localBurnEstimate,
          title,
          note
        });
        burnedKcal = Math.max(0, Math.round(Number(aiResult?.burnedKcal || localBurnEstimate)));
        burnConfidence = String(aiResult?.confidence || burnConfidence);
        burnNote = String(aiResult?.note || 'AI estimate');
      } catch (_) {
        // fallback locale
      }
      const strengthAdd = estimateQuickWorkoutStrength({ sportId, intensityId, durationMin });
      const nextBurn = Number(quickLogData.workoutBurn ?? quickLogData.burned ?? 0) + burnedKcal;
      const noteSegment = `${title}${note ? ` (${note})` : ''}`;
      const mergedWorkoutNote = [String(quickLogData.workoutNote || '').trim(), noteSegment].filter(Boolean).join(' | ');
      saveToSystemForDate(quickLogDateKey, {
        workoutBurn: nextBurn,
        burned: nextBurn,
        strength: Number(quickLogData.strength || 0) + strengthAdd,
        workoutNote: mergedWorkoutNote
      });
      try {
        const raw = localStorage.getItem('shadow_monarch_workout_history');
        const current = raw ? JSON.parse(raw) : [];
        const sessionDate = new Date(quickLogDateObj);
        const now = new Date();
        sessionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
        const rank = intensityId === 'hard' ? 'B' : intensityId === 'easy' ? 'D' : 'C';
        const focusTags = sportId === 'none' ? ['General'] : ['Cardio'];
        const nextSession = {
          id: `quick-${Date.now()}`,
          date: sessionDate.toISOString(),
          title,
          rank,
          plannedMinutes: durationMin,
          focus: sportId === 'none' ? 'quick strength' : 'quick cardio',
          focusTags,
          strengthIndex: strengthAdd,
          totalLoggedSets: 1,
          totalLoggedReps: 0,
          avgRepsPerSet: 0,
          exercises: [
            {
              name: title,
              completedSets: 1,
              setsTarget: 1,
              logs: [],
              topKg: 0,
              topReps: 0,
              strength: strengthAdd,
              focusTags
            }
          ],
          cardio: {
            sportId,
            sportLabel: sportMeta.label,
            intensityId,
            intensityLabel: intensityMeta.label,
            rpe,
            distanceKm,
            durationMin,
            paceMinPerKm: distanceKm > 0 ? Number((durationMin / Math.max(0.1, distanceKm)).toFixed(2)) : 0,
            weather: { tempC: 20, humidityPct: 55 },
            reportedKcal,
            zoneId: rpe >= 8 ? 'z4' : rpe >= 6 ? 'z3' : 'z2',
            zoneLabel: rpe >= 8 ? 'Z4 Threshold' : rpe >= 6 ? 'Z3 Tempo' : 'Z2 Base',
            calibrationFactor: 1,
            hydrationExtraMl: Math.max(300, Math.round(durationMin * 9)),
            supplementTips: ['Acqua + elettroliti', 'Proteine nel post-workout']
          },
          athleteProfile: {
            weightKg: Number(playerStats?.currentWeightKg || 70)
          },
          burnedKcal,
          burnedConfidence: burnConfidence,
          burnedNote: burnNote
        };
        const nextHistory = [nextSession, ...(Array.isArray(current) ? current : [])].slice(0, 30);
        localStorage.setItem('shadow_monarch_workout_history', JSON.stringify(nextHistory));
      } catch (_) {}
      setQuickWorkoutLastSaved({
        date: quickLogDateKey,
        title,
        burnedKcal,
        strengthAdd
      });
      setQuickWorkoutDraftOpen(false);
      playSfx('success', soundEnabled, soundTheme);
      emitUiToast({
        message: `${title} salvato su ${quickLogDateKey} • Burn +${burnedKcal} kcal (${burnConfidence}) • STR +${strengthAdd}`,
        tone: 'success',
        durationMs: 3200
      });
    } finally {
      setQuickWorkoutSaving(false);
    }
  };

  useEffect(() => {
    setPlayerStats((prev) => {
      if ((prev.systemPowerScore || 0) === systemPowerScore && (prev.systemForceBonus || 0) === systemForceBonus) return prev;
      return {
        ...prev,
        systemPowerScore,
        systemForceBonus,
        systemPowerUpdatedAt: new Date().toISOString()
      };
    });
  }, [setPlayerStats, systemPowerScore, systemForceBonus]);
  useEffect(() => {
    if (!adaptiveQuest) buildAdaptiveQuest();
  }, [adaptiveQuest]);
  useEffect(() => {
    updatePlayerStats((prev) => {
      const history = Array.isArray(prev?.healthScoreHistory) ? prev.healthScoreHistory : [];
      const top = history[0];
      if (top?.date === todayIso && Number(top?.score || 0) === Number(dailyHealthScore || 0)) return prev;
      const nextEntry = {
        date: todayIso,
        score: Number(dailyHealthScore || 0),
        badge: dailyHealthBadge.label
      };
      const filtered = history.filter((item) => item?.date !== todayIso);
      return {
        ...prev,
        healthScoreHistory: [nextEntry, ...filtered].slice(0, 60),
        lastHealthScore: Number(dailyHealthScore || 0),
        lastHealthScoreDate: todayIso
      };
    });
  }, [todayIso, dailyHealthScore, dailyHealthBadge.label]);
  useEffect(() => {
    const merged = [
      { date: todayIso, score: Number(dailyHealthScore || 0) },
      ...healthScoreHistory.filter((item) => item?.date !== todayIso).map((item) => ({ date: item.date, score: Number(item.score || 0) }))
    ].slice(0, 3);
    const isLow2Days = merged.length >= 2
      && merged[0].score < healthScoreAlertThreshold
      && merged[1].score < healthScoreAlertThreshold;
    if (!isLow2Days) return;
    if (playerStats?.lastHealthLowAlertDate === todayIso) return;
    emitUiToast({
      message: `Health Score sotto soglia 2 giorni di fila (${healthScoreAlertThreshold}). Vai su Health Intelligence e usa i Fix 1-click.`,
      tone: 'warning',
      durationMs: 5200
    });
    updatePlayerStats((prev) => ({ ...prev, lastHealthLowAlertDate: todayIso }));
  }, [todayIso, dailyHealthScore, healthScoreHistory, playerStats?.lastHealthLowAlertDate]);
  useEffect(() => {
    updatePlayerStats((prev) => {
      const current = prev?.seasonRank || {};
      const prevHistory = Array.isArray(prev?.seasonRankHistory) ? prev.seasonRankHistory : [];
      const nextEntry = {
        monthKey: seasonMonthKey,
        score: Number(seasonRankScore || 0),
        label: String(seasonRank.label || 'INITIATE'),
        healthAvg: Number(seasonHealthAvg || 0),
        missionScore: Number(seasonMissionScore || 0),
        updatedAt: new Date().toISOString()
      };
      const nextHistory = [nextEntry, ...prevHistory.filter((row) => row?.monthKey !== seasonMonthKey)]
        .sort((a, b) => String(b.monthKey || '').localeCompare(String(a.monthKey || '')))
        .slice(0, 24);
      if (
        current?.monthKey === seasonMonthKey &&
        Number(current?.score || 0) === Number(seasonRankScore || 0) &&
        String(current?.label || '') === String(seasonRank.label || '') &&
        JSON.stringify(prevHistory) === JSON.stringify(nextHistory)
      ) {
        return prev;
      }
      return {
        ...prev,
        seasonRank: nextEntry,
        seasonRankHistory: nextHistory
      };
    });
  }, [seasonMonthKey, seasonRankScore, seasonRank.label, seasonHealthAvg, seasonMissionScore]);
  useEffect(() => {
    if (playerStats?.weeklyMissionPack?.weekKey === currentWeekKey) return;
    buildWeeklyMissionPack();
  }, [playerStats?.weeklyMissionPack?.weekKey, currentWeekKey]);
  useEffect(() => {
    const inferred = inferMealSlotFromText(oracleText);
    if (inferred && inferred !== mealSlot) setMealSlot(inferred);
  }, [oracleText, mealSlot]);
  useEffect(() => () => {
    if (resetTodayTimerRef.current) clearTimeout(resetTodayTimerRef.current);
  }, []);

  const claimStreakQuest = () => {
    if (!streakQuestDone || streakQuestClaimed) return;
    const scaledReward = {
      gold: Math.round(24 * rewardHealthMultiplier),
      exp: Math.round(24 * rewardHealthMultiplier)
    };
    setPlayerStats((prev) => ({
      ...prev,
      gold: (prev.gold || 0) + scaledReward.gold,
      exp: (prev.exp || 0) + scaledReward.exp,
      lastStreakQuestClaimDate: today
    }));
    playSfx('success', soundEnabled, soundTheme);
    speakEvent('quest_clear', voiceEnabled, voicePack);
    emitFxBurst();
  };

  const buyStreakShield = () => {
    const cost = 220;
    if ((playerStats.gold || 0) < cost) {
      playSfx('warning', soundEnabled, soundTheme);
      speakEvent('insufficient_gold', voiceEnabled, voicePack);
      return;
    }
    setPlayerStats((prev) => ({
      ...prev,
      gold: (prev.gold || 0) - cost,
      streakShieldTokens: (prev.streakShieldTokens || 0) + 1
    }));
    playSfx('click', soundEnabled, soundTheme);
    speakEvent('shield_buy', voiceEnabled, voicePack);
  };
  const buyCheatMealToken = () => {
    if ((playerStats.gold || 0) < cheatMealTokenCost) {
      playSfx('warning', soundEnabled, soundTheme);
      speakEvent('insufficient_gold', voiceEnabled, voicePack);
      emitUiToast({ message: `Oro insufficiente: servono ${cheatMealTokenCost}G`, tone: 'warning', durationMs: 2600 });
      return;
    }
    setPlayerStats((prev) => ({
      ...prev,
      gold: Math.max(0, Number(prev.gold || 0) - cheatMealTokenCost),
      cheatMealTokens: Math.max(0, Number(prev.cheatMealTokens || 0)) + 1
    }));
    emitShadowFxBurst(32);
    playSfx('streak', soundEnabled, soundTheme);
    emitUiToast({ message: `Cheat Token acquistato (-${cheatMealTokenCost}G)`, tone: 'success', durationMs: 2800 });
  };
  const useCheatMealToken = () => {
    if (cheatMealTokens <= 0) {
      emitUiToast({ message: 'Nessun Cheat Token disponibile', tone: 'warning', durationMs: 2400 });
      return;
    }
    const currentConsumed = Math.max(0, Number(todayData.consumed || 0));
    if (currentConsumed <= 0) {
      emitUiToast({ message: 'Nessuna kcal da compensare oggi', tone: 'warning', durationMs: 2400 });
      return;
    }
    const compensation = Math.max(120, Math.min(cheatMealTokenKcal, Math.round(currentConsumed * 0.35)));
    const ratio = Math.min(1, compensation / Math.max(1, currentConsumed));
    saveToSystem({
      consumed: Math.max(0, Math.round(currentConsumed - compensation)),
      carbs: Math.max(0, Math.round(Number(todayData.carbs || 0) * (1 - ratio))),
      protein: Math.max(0, Math.round(Number(todayData.protein || 0) * (1 - (ratio * 0.35)))),
      fatMacros: Math.max(0, Math.round(Number(todayData.fatMacros || 0) * (1 - ratio))),
      fiber: Math.max(0, Math.round(Number(todayData.fiber || 0) * (1 - (ratio * 0.55)))),
      satFat: Math.max(0, Math.round(Number(todayData.satFat || 0) * (1 - ratio))),
      monoFat: Math.max(0, Math.round(Number(todayData.monoFat || 0) * (1 - ratio))),
      polyFat: Math.max(0, Math.round(Number(todayData.polyFat || 0) * (1 - ratio))),
      sugars: Math.max(0, Math.round(Number(todayData.sugars || 0) * (1 - ratio))),
      sodiumMg: Math.max(0, Math.round(Number(todayData.sodiumMg || 0) * (1 - ratio))),
      potassiumMg: Math.max(0, Math.round(Number(todayData.potassiumMg || 0) * (1 - (ratio * 0.65)))),
      mealBreakfastKcal: Math.max(0, Math.round(Number(todayData.mealBreakfastKcal || 0) * (1 - ratio))),
      mealLunchKcal: Math.max(0, Math.round(Number(todayData.mealLunchKcal || 0) * (1 - ratio))),
      mealDinnerKcal: Math.max(0, Math.round(Number(todayData.mealDinnerKcal || 0) * (1 - ratio)))
    });
    setPlayerStats((prev) => ({
      ...prev,
      cheatMealTokens: Math.max(0, Number(prev.cheatMealTokens || 0) - 1),
      cheatMealsUsed: Math.max(0, Number(prev.cheatMealsUsed || 0)) + 1,
      lastCheatMealDate: today
    }));
    emitShadowFxBurst(40);
    playSfx('success', soundEnabled, soundTheme);
    emitUiToast({ message: `Cheat Meal compensato: -${compensation} kcal`, tone: 'success', durationMs: 3200 });
  };
  const claimVictoryLoop = () => {
    if (!victoryLoopReady || victoryLoopClaimedToday) return;
    const scaledReward = {
      exp: Math.round(40 * rewardHealthMultiplier),
      gold: Math.round(30 * rewardHealthMultiplier)
    };
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + scaledReward.exp,
      gold: (prev.gold || 0) + scaledReward.gold,
      keys: (prev.keys || 0) + 1,
      lastVictoryLoopClaimDate: todayIso
    }));
    playSfx('streak', soundEnabled, soundTheme);
    speakEvent('quest_clear', voiceEnabled, voicePack);
    emitFxBurst();
    emitUiToast({ message: `Victory Loop: +${scaledReward.exp} EXP, +${scaledReward.gold}G, +1 Key`, tone: 'success', durationMs: 3200 });
  };
  const claimBattlePassMission = (missionId) => {
    const mission = battlePassMissions.find((item) => item.id === missionId);
    if (!mission || !mission.done || mission.claimed) return;
    let reward = { exp: 0, gold: 0 };
    let rewardMulUsed = 1;
    let streakUpdate = null;
    let tierFx = null;
    setPlayerStats((prev) => {
      const base = (prev?.battlePass && typeof prev.battlePass === 'object') ? prev.battlePass : {};
      const dailyClaims = (base?.dailyClaims && typeof base.dailyClaims === 'object') ? base.dailyClaims : {};
      const todayClaims = (dailyClaims?.[today] && typeof dailyClaims[today] === 'object') ? dailyClaims[today] : {};
      if (todayClaims?.[missionId]) return prev;
      const currentStreak = Math.max(0, Number(base?.streakCurrent || 0));
      const currentMul = getBattlePassStreakMultiplier(currentStreak);
      rewardMulUsed = currentMul;
      reward = {
        exp: Math.round(Number(mission.reward?.exp || 0) * rewardHealthMultiplier * rewardMulUsed),
        gold: Math.round(Number(mission.reward?.gold || 0) * rewardHealthMultiplier * rewardMulUsed)
      };
      const nextTodayClaims = { ...todayClaims, [missionId]: true };
      const missionIds = battlePassMissions.map((item) => item.id);
      const wasDayComplete = missionIds.every((id) => Boolean(todayClaims?.[id]));
      const isDayCompleteNow = missionIds.every((id) => Boolean(nextTodayClaims?.[id]));
      let nextStreakCurrent = currentStreak;
      let nextStreakBest = Math.max(nextStreakCurrent, Number(base?.streakBest || 0));
      let lastCompleteDate = String(base?.lastCompleteDate || '');
      if (!wasDayComplete && isDayCompleteNow) {
        const todayDate = parseDdMmToDate(today);
        const prevDate = parseDdMmToDate(lastCompleteDate);
        if (todayDate && prevDate) {
          const diffDays = Math.round((todayDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) nextStreakCurrent += 1;
          else if (diffDays !== 0) nextStreakCurrent = 1;
        } else {
          nextStreakCurrent = Math.max(1, nextStreakCurrent);
        }
        lastCompleteDate = today;
        nextStreakBest = Math.max(nextStreakBest, nextStreakCurrent);
        streakUpdate = { current: nextStreakCurrent, best: nextStreakBest };
        const nextMul = getBattlePassStreakMultiplier(nextStreakCurrent);
        if (nextMul > currentMul) {
          tierFx = {
            fromMul: currentMul,
            toMul: nextMul,
            streak: nextStreakCurrent,
            timestamp: Date.now()
          };
        }
      }
      return {
        ...prev,
        exp: Number(prev.exp || 0) + reward.exp,
        gold: Number(prev.gold || 0) + reward.gold,
        battlePass: {
          ...base,
          dailyClaims: {
            ...dailyClaims,
            [today]: nextTodayClaims
          },
          streakCurrent: nextStreakCurrent,
          streakBest: nextStreakBest,
          lastCompleteDate,
          updatedAt: new Date().toISOString()
        }
      };
    });
    emitFxBurst();
    if (tierFx) {
      setBattlePassTierFx(tierFx);
      emitShadowFxBurst(56);
      playSfx('streak', soundEnabled, soundTheme);
      speakEvent('quest_clear', voiceEnabled, voicePack);
    } else {
      playSfx('success', soundEnabled, soundTheme);
    }
    emitUiToast({
      message: `Battle Pass x${rewardMulUsed.toFixed(2)}: +${reward.exp} EXP +${reward.gold}G${streakUpdate ? ` • Streak ${streakUpdate.current}` : ''}`,
      tone: 'success',
      durationMs: 2800
    });
  };
  const claimBattlePassWeeklyChest = () => {
    if (battlePassWeeklyClaimed || battlePassWeekProgress < battlePassWeekTarget) return;
    let reward = { exp: 0, gold: 0, keys: 1 };
    let rewardMulUsed = 1;
    setPlayerStats((prev) => {
      const base = (prev?.battlePass && typeof prev.battlePass === 'object') ? prev.battlePass : {};
      if (String(base?.weeklyClaimWeek || '') === String(currentWeekKey)) return prev;
      rewardMulUsed = getBattlePassStreakMultiplier(Number(base?.streakCurrent || 0));
      reward = {
        exp: Math.round(110 * rewardHealthMultiplier * rewardMulUsed),
        gold: Math.round(95 * rewardHealthMultiplier * rewardMulUsed),
        keys: 1
      };
      return {
        ...prev,
        exp: Number(prev.exp || 0) + reward.exp,
        gold: Number(prev.gold || 0) + reward.gold,
        keys: Number(prev.keys || 0) + reward.keys,
        battlePass: {
          ...base,
          weeklyClaimWeek: currentWeekKey,
          updatedAt: new Date().toISOString()
        }
      };
    });
    emitFxBurst();
    playSfx('streak', soundEnabled, soundTheme);
    emitUiToast({ message: `Weekly Chest x${rewardMulUsed.toFixed(2)}: +${reward.exp} EXP +${reward.gold}G +1 Key`, tone: 'success', durationMs: 3200 });
  };
  const applySundayAutoPlan = () => {
    const report = playerStats?.sundayAutoReport;
    if (!report?.advanced) return;
    const hydrationTarget = Math.max(1800, Math.round(Number(report.advanced?.hydrationSmartTarget || hydrationGoal)));
    const objective = String(playerStats?.objective || 'recomp');
    const weekendScore = Number(report.advanced?.complianceByDayType?.weekend?.score || 0);
    const weekdayTarget = Math.max(1300, Number(dailyGoal || 2400));
    const suggestedDelta = objective === 'cut' ? 180 : objective === 'bulk' ? 340 : 240;
    const weekendEnabled = weekendScore < 82 || Boolean(playerStats?.weekendCalorieBoostEnabled);
    setHydrationGoal(hydrationTarget);
    setPlayerStats((prev) => ({
      ...prev,
      weekendCalorieBoostEnabled: weekendEnabled,
      weekendCalorieDelta: weekendEnabled ? suggestedDelta : 0,
      weekendCalorieWeekdayTarget: weekdayTarget,
      weekendCalorieWeekendTarget: weekendEnabled ? (weekdayTarget + suggestedDelta) : weekdayTarget,
      sundayPlanAppliedAt: new Date().toISOString()
    }));
    emitFxBurst();
    playSfx('success', soundEnabled, soundTheme);
    emitUiToast({ message: `Piano domenica applicato: H2O ${hydrationTarget} ml${weekendEnabled ? ` • WE +${suggestedDelta} kcal` : ''}`, tone: 'success', durationMs: 3800 });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setOracleImage(reader.result);
    reader.readAsDataURL(file);
  };
  const estimateMicroTargetsWithAI = async () => {
    if (isEstimatingMicroTargets) return;
    setIsEstimatingMicroTargets(true);
    try {
      const recentContext = {
        avgFiber7d: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.fiber || 0), 0) / recent7.length) : 0,
        avgSugars7d: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.sugars || 0), 0) / recent7.length) : 0,
        avgSatFat7d: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + Number(log?.satFat || 0), 0) / recent7.length) : 0,
        avgSodium7d,
        avgPotassium7d,
        avgOmega37d
      };
      const profileContext = {
        dailyGoal,
        objective: String(playerStats?.objective || metabolicProfile?.objective || 'recomp'),
        sex: String(playerStats?.sex || metabolicProfile?.sex || 'male'),
        age: Number(playerStats?.age || metabolicProfile?.age || 30),
        weightKg: Number(playerStats?.currentWeightKg || metabolicProfile?.weightKg || todayData?.weight || 70),
        activityMode: String(playerStats?.activityMode || metabolicProfile?.activityMode || 'moderate')
      };
      const data = await requestSystemAI({
        messages: [
          {
            role: 'system',
            content:
              'Sei un nutrition coach. Devi proporre target giornalieri realistici per fibra minima, grassi saturi massimi, zuccheri massimi, sodio massimo, potassio minimo e omega-3 minimo. Rispondi SOLO JSON valido: {"fiberMin":numero,"satFatMax":numero,"sugarsMax":numero,"sodiumMax":numero,"potassiumMin":numero,"omega3Min":numero}.'
          },
          {
            role: 'user',
            content: `Profilo: ${JSON.stringify(profileContext)}. Dati recenti: ${JSON.stringify(recentContext)}. Restituisci target pratici per aderenza alta.`
          }
        ]
      });
      const parsed = parseModelJson(data);
      const next = sanitizeMicroTargetRecommendation(parsed);
      setMicroTargets(next);
      localStorage.setItem('shadow_monarch_micro_targets', JSON.stringify(next));
      emitUiToast({
        message: `Target IA aggiornati • Fib ${next.fiberMin}g • Sat ${next.satFatMax}g • Zuc ${next.sugarsMax}g`,
        tone: 'success',
        durationMs: 4200
      });
      playSfx('success', soundEnabled, soundTheme);
    } catch (error) {
      emitUiToast({
        message: `Stima target fallita (${String(error?.message || 'errore').slice(0, 80)})`,
        tone: 'warning',
        durationMs: 4200
      });
      playSfx('warning', soundEnabled, soundTheme);
    } finally {
      setIsEstimatingMicroTargets(false);
    }
  };
  const openLastAiMealEditor = () => {
    const last = playerStats?.lastAiMeal;
    if (!last || !last.nutrients) {
      setAiMealEditMode('new');
      setAiMealEdit({
        id: `manual-meal-${Date.now()}`,
        date: today,
        mealSlot: mealSlot || 'lunch',
        sourceId: null,
        sourceDate: today,
        sourceMealSlot: mealSlot || 'lunch',
        sourceNutrients: normalizeAiMealNutrients({}),
        lockedFields: [],
        lockEditedValues: false,
        ...normalizeAiMealNutrients({})
      });
      return;
    }
    setAiMealEditMode('edit');
    setAiMealEdit({
      id: last.id,
      date: last.date,
      mealSlot: last.mealSlot || 'lunch',
      sourceId: last.id,
      sourceDate: last.date,
      sourceMealSlot: last.mealSlot || 'lunch',
      sourceNutrients: normalizeAiMealNutrients(last.nutrients || {}),
      lockedFields: Array.isArray(last?.lockedFields) ? last.lockedFields : [],
      lockEditedValues: false,
      ...normalizeAiMealNutrients(last.nutrients)
    });
  };
  const openAiMealAssistEditor = (entry = null) => {
    const target = entry || playerStats?.lastAiMeal;
    if (!target?.nutrients) {
      openLastAiMealEditor();
      return;
    }
    const source = normalizeAiMealNutrients(target.nutrients || {});
    const assist = buildMealEditAssistPatch(source, Number(target?.confidenceScore || 0), target?.lockedFields || []);
    setAiMealEditMode('edit');
    setAiMealEdit({
      id: target.id,
      date: target.date,
      mealSlot: target.mealSlot || 'lunch',
      sourceId: target.id,
      sourceDate: target.date,
      sourceMealSlot: target.mealSlot || 'lunch',
      sourceNutrients: source,
      sourceReviewFlags: assist.flags,
      lockedFields: Array.isArray(target?.lockedFields) ? target.lockedFields : [],
      lockEditedValues: false,
      assistMode: true,
      ...assist.patch
    });
    emitUiToast({ message: `Edit Assist pronto (${assist.flags.length} check)`, tone: 'success', durationMs: 2200 });
  };
  const openAiMealAssistEditorFromEntry = (target) => {
    if (!target?.nutrients) return;
    const source = normalizeAiMealNutrients(target.nutrients || {});
    const assist = buildMealEditAssistPatch(source, Number(target?.confidenceScore || 0), target?.lockedFields || []);
    setAiMealEditMode('edit');
    setAiMealEdit({
      id: target.id,
      date: target.date,
      mealSlot: target.mealSlot || 'lunch',
      sourceId: target.id,
      sourceDate: target.date,
      sourceMealSlot: target.mealSlot || 'lunch',
      sourceNutrients: source,
      sourceReviewFlags: assist.flags,
      lockedFields: Array.isArray(target?.lockedFields) ? target.lockedFields : [],
      lockEditedValues: false,
      assistMode: true,
      ...assist.patch
    });
    emitUiToast({ message: `Auto Assist attivato (${assist.flags.length} check)`, tone: 'warning', durationMs: 2600 });
  };
  const openAiMealEntryEditor = (entry) => {
    if (!entry) return;
    setAiMealEditMode('edit');
    setAiMealEdit({
      id: entry.id,
      date: entry.date,
      mealSlot: entry.mealSlot || 'lunch',
      sourceId: entry.id,
      sourceDate: entry.date,
      sourceMealSlot: entry.mealSlot || 'lunch',
      sourceNutrients: normalizeAiMealNutrients(entry.nutrients || {}),
      lockedFields: Array.isArray(entry?.lockedFields) ? entry.lockedFields : [],
      lockEditedValues: false,
      ...normalizeAiMealNutrients(entry.nutrients || {})
    });
  };
  const saveAiMealEdit = (overrideEdit = null) => {
    const history = Array.isArray(playerStats?.aiMeals) ? playerStats.aiMeals : [];
    const editPayload = overrideEdit || aiMealEdit;
    if (!editPayload) return;
    if (aiMealEditMode === 'new') {
      const dateKey = editPayload.date || today;
      const applied = applyAiMealToDate(dateKey, editPayload, editPayload.mealSlot || mealSlot || 'lunch');
      const confidence = computeMealAiConfidence(applied, 'manual_edit', 'manual');
      const reviewFlags = computeMealReviewFlags(applied, confidence.score);
      const entry = {
        id: editPayload.id || `manual-meal-${Date.now()}`,
        date: dateKey,
        mealSlot: editPayload.mealSlot || mealSlot || 'lunch',
        sourceText: 'manual_edit',
        createdAt: new Date().toISOString(),
        editedAt: new Date().toISOString(),
        nutrients: applied,
        confidenceScore: confidence.score,
        confidenceLabel: confidence.label,
        lockedFields: Array.isArray(editPayload?.lockedFields) ? editPayload.lockedFields : [],
        reviewFlags,
        model: 'manual'
      };
      updatePlayerStats((prev) => ({
        ...prev,
        lastAiMeal: entry,
        aiMeals: [entry, ...((prev.aiMeals || []).slice(0, 24))]
      }));
      setAiMealEdit(null);
      setAiMealEditMode('edit');
      playSfx('success', soundEnabled, soundTheme);
      emitUiToast({ message: 'Pasto manuale aggiunto', tone: 'success', durationMs: 3000 });
      return;
    }
    const sourceId = editPayload.sourceId || editPayload.id;
    const source = history.find((item) => item.id === sourceId) || playerStats?.lastAiMeal || null;
    if (!source) return;
    const sourceDate = editPayload.sourceDate || source.date || today;
    const sourceSlot = editPayload.sourceMealSlot || source.mealSlot || 'lunch';
    const sourceNutrients = editPayload.sourceNutrients || source.nutrients || {};
    if (sourceDate !== today) {
      emitUiToast({ message: 'Per ora puoi modificare rapidamente i pasti AI di oggi', tone: 'warning', durationMs: 3200 });
      return;
    }
    const previous = normalizeAiMealNutrients(sourceNutrients);
    const changedFields = buildEditedFieldList(previous, editPayload);
    const inheritedLocked = Array.from(getLockedFieldSetFromEntry(source));
    const nextLocked = new Set(inheritedLocked);
    if (editPayload?.lockEditedValues) changedFields.forEach((key) => nextLocked.add(key));
    if (Array.isArray(editPayload?.lockedFields)) {
      editPayload.lockedFields.forEach((key) => {
        if (MEAL_NUMERIC_KEYS.includes(key)) nextLocked.add(key);
      });
    }
    const editedUnlocked = normalizeAiMealNutrients(editPayload);
    const edited = editPayload?.assistMode
      ? applyLockedFieldsToNutrients(editedUnlocked, previous, Array.from(nextLocked))
      : editedUnlocked;
    const confidence = computeMealAiConfidence(edited, source?.sourceText || 'manual_edit', source?.model || 'manual');
    const reviewFlags = computeMealReviewFlags(edited, confidence.score);
    applyAiMealEditDiff(sourceDate, previous, edited, sourceSlot, editPayload.mealSlot || sourceSlot);
    updatePlayerStats((prev) => {
      const sourceReviewCount = Array.isArray(source?.reviewFlags) ? source.reviewFlags.length : computeMealReviewFlags(previous, Number(source?.confidenceScore || 0)).length;
      const fixedFlags = Math.max(0, sourceReviewCount - reviewFlags.length);
      const foodKey = buildFoodReliabilityKey(source?.sourceText || '');
      const nextReliability = updateFoodReliabilityMap(prev?.mealAiReliability || {}, foodKey, {
        editsDelta: source?.model === 'manual' ? 0 : 1,
        okDelta: reviewFlags.length === 0 ? 1 : 0,
        fixedFlagsDelta: fixedFlags,
        lastModel: source?.model || ''
      });
      const nextMeal = {
        ...(source || {}),
        mealSlot: editPayload.mealSlot,
        nutrients: edited,
        editedAt: new Date().toISOString(),
        lockedFields: Array.from(nextLocked),
        confidenceScore: confidence.score,
        confidenceLabel: confidence.label,
        reviewFlags
      };
      const updatedHistory = Array.isArray(prev.aiMeals) && prev.aiMeals.length
        ? prev.aiMeals.map((item) => (item.id === sourceId ? { ...item, ...nextMeal } : item))
        : [nextMeal];
      return {
        ...prev,
        mealAiReliability: nextReliability,
        mealAiFixLog: appendMealFixLog(prev, source?.model === 'manual' ? null : {
          id: `meal-fix-${Date.now()}`,
          date: today,
          foodKey: foodKey || 'meal',
          fixedFlags,
          beforeFlags: sourceReviewCount,
          afterFlags: reviewFlags.length,
          fromConfidence: Math.round(Number(source?.confidenceScore || 0)),
          toConfidence: Math.round(Number(confidence.score || 0)),
          model: String(source?.model || 'unknown')
        }),
        lastAiMeal: prev.lastAiMeal?.id === sourceId ? nextMeal : (prev.lastAiMeal || nextMeal),
        aiMeals: updatedHistory
      };
    });
    setAiMealEdit(null);
    setAiMealEditMode('edit');
    playSfx('success', soundEnabled, soundTheme);
    emitUiToast({ message: 'Pasto AI aggiornato con successo', tone: 'success', durationMs: 3000 });
  };
  const applyAllMealAssistFixes = () => {
    if (!aiMealEdit) return;
    const source = normalizeAiMealNutrients(aiMealEdit.sourceNutrients || aiMealEdit);
    const sourceEntry = (Array.isArray(playerStats?.aiMeals) ? playerStats.aiMeals : []).find((item) => item.id === (aiMealEdit.sourceId || aiMealEdit.id))
      || playerStats?.lastAiMeal
      || null;
    const assist = buildMealEditAssistPatch(source, Number(sourceEntry?.confidenceScore || 0), sourceEntry?.lockedFields || aiMealEdit?.lockedFields || []);
    const nextEdit = {
      ...aiMealEdit,
      assistMode: true,
      sourceReviewFlags: assist.flags,
      lockedFields: Array.isArray(sourceEntry?.lockedFields) ? sourceEntry.lockedFields : (Array.isArray(aiMealEdit?.lockedFields) ? aiMealEdit.lockedFields : []),
      ...assist.patch
    };
    setAiMealEdit(nextEdit);
    saveAiMealEdit(nextEdit);
  };
  const duplicateAiMealEntry = (entry) => {
    if (!entry?.nutrients) return;
    const targetDateKey = quickLogDateKey || today;
    const confidence = computeMealAiConfidence(entry.nutrients, entry.sourceText || 'duplicate', entry.model || 'manual');
    const reviewFlags = computeMealReviewFlags(entry.nutrients, confidence.score);
    const clone = {
      ...entry,
      id: `ai-meal-${Date.now()}`,
      date: targetDateKey,
      sourceText: String(entry.sourceText || 'duplicate').slice(0, 160),
      createdAt: new Date().toISOString(),
      editedAt: new Date().toISOString(),
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      lockedFields: Array.isArray(entry?.lockedFields) ? entry.lockedFields : [],
      reviewFlags
    };
    applyAiMealToDate(targetDateKey, clone.nutrients, clone.mealSlot || 'lunch');
    updatePlayerStats((prev) => ({
      ...prev,
      lastAiMeal: clone,
      aiMeals: [clone, ...((prev.aiMeals || []).slice(0, 24))]
    }));
    playSfx('success', soundEnabled, soundTheme);
    emitUiToast({ message: 'Pasto duplicato', tone: 'success', durationMs: 2600 });
  };
  const deleteAiMealEntry = (entry) => {
    if (!entry?.id || !entry?.nutrients) return;
    const slot = entry.mealSlot || 'lunch';
    const targetDateKey = entry.date || today;
    const snapshot = {
      ...entry,
      nutrients: normalizeAiMealNutrients(entry.nutrients || {})
    };
    applyAiMealEditDiff(targetDateKey, snapshot.nutrients, {}, slot, slot);
    updatePlayerStats((prev) => {
      const remaining = (prev.aiMeals || []).filter((item) => item.id !== entry.id);
      const nextLast = prev.lastAiMeal?.id === entry.id ? (remaining[0] || null) : prev.lastAiMeal;
      return {
        ...prev,
        lastAiMeal: nextLast,
        aiMeals: remaining
      };
    });
    playSfx('warning', soundEnabled, soundTheme);
    emitUiToast({
      message: 'Pasto eliminato',
      tone: 'warning',
      actionLabel: 'Undo 30s',
      durationMs: 30000,
      onAction: () => {
        applyAiMealToDate(targetDateKey, snapshot.nutrients, slot);
        updatePlayerStats((prev) => {
          const already = (prev.aiMeals || []).some((item) => item.id === snapshot.id);
          if (already) return prev;
          return {
            ...prev,
            lastAiMeal: snapshot,
            aiMeals: [snapshot, ...((prev.aiMeals || []).slice(0, 24))]
          };
        });
        emitUiToast({ message: 'Delete annullato', tone: 'success', durationMs: 2200 });
      }
    });
  };

  const hasValidMealPayload = (payload = {}) => {
    const kcal = Number(payload?.kcal || 0);
    const protein = Number(payload?.protein || 0);
    const carbs = Number(payload?.carbs || 0);
    const fat = Number(payload?.fat || 0);
    const macroKcal = (protein * 4) + (carbs * 4) + (fat * 9);
    if (kcal <= 0 || macroKcal <= 0) return false;
    const ratio = kcal / Math.max(1, macroKcal);
    return ratio >= 0.65 && ratio <= 1.45;
  };
  const getAiConfidenceBadge = (score = 0) => {
    const safe = Math.max(1, Math.min(99, Math.round(Number(score || 0))));
    if (safe >= 84) return { label: 'Alta', tone: 'text-emerald-200 border-emerald-300/45 bg-emerald-500/10' };
    if (safe >= 66) return { label: 'Media', tone: 'text-amber-200 border-amber-300/45 bg-amber-500/10' };
    return { label: 'Bassa', tone: 'text-rose-200 border-rose-300/45 bg-rose-500/10' };
  };
  const computeMealAiConfidence = (nutrients = {}, sourceText = '', modelName = '') => {
    const kcal = Number(nutrients?.kcal || 0);
    const carbs = Number(nutrients?.carbs || 0);
    const protein = Number(nutrients?.protein || 0);
    const fat = Number(nutrients?.fat || 0);
    const macroKcal = (carbs * 4) + (protein * 4) + (fat * 9);
    const ratio = kcal > 0 && macroKcal > 0 ? (kcal / macroKcal) : 0;
    const ratioPenalty = ratio <= 0 ? 38 : Math.min(35, Math.round(Math.abs(1 - ratio) * 120));
    const microPresent = [
      nutrients?.fiber,
      nutrients?.sodiumMg,
      nutrients?.potassiumMg,
      nutrients?.omega3Mg,
      nutrients?.calciumMg,
      nutrients?.magnesiumMg
    ].filter((value) => Number(value || 0) > 0).length;
    const textWords = String(sourceText || '').trim().split(/\s+/).filter(Boolean).length;
    const modelBoost = String(modelName || '').toLowerCase().includes('qwen') ? 4 : 0;
    const score = Math.max(
      18,
      Math.min(
        98,
        Math.round(58 + (microPresent * 4) + Math.min(14, textWords) - ratioPenalty + modelBoost)
      )
    );
    const badge = getAiConfidenceBadge(score);
    return {
      score,
      label: badge.label,
      tone: badge.tone
    };
  };
  const computeMealReviewFlags = (nutrients = {}, confidenceScore = 0) => {
    const n = normalizeAiMealNutrients(nutrients);
    const flags = [];
    const macroKcal = (Number(n.carbs || 0) * 4) + (Number(n.protein || 0) * 4) + (Number(n.fat || 0) * 9);
    const kcal = Number(n.kcal || 0);
    const ratio = macroKcal > 0 && kcal > 0 ? (kcal / Math.max(1, macroKcal)) : 1;
    if (ratio < 0.78 || ratio > 1.24) {
      flags.push({ id: 'kcal_mismatch', label: 'Kcal vs macro incoerenti', severity: 'high' });
    }
    if (Number(n.sugars || 0) > Number(n.carbs || 0)) {
      flags.push({ id: 'sugars_gt_carbs', label: 'Zuccheri oltre i carbo', severity: 'high' });
    }
    if (Number(n.satFat || 0) > Number(n.fat || 0)) {
      flags.push({ id: 'sat_gt_fat', label: 'Saturi oltre grassi totali', severity: 'high' });
    }
    if (Number(n.carbs || 0) >= 25 && Number(n.fiber || 0) <= 1) {
      flags.push({ id: 'fiber_low', label: 'Fibra molto bassa', severity: 'medium' });
    }
    if (Number(n.sodiumMg || 0) >= 1700 && Number(n.potassiumMg || 0) > 0 && Number(n.potassiumMg || 0) < Number(n.sodiumMg || 0)) {
      flags.push({ id: 'electrolyte_imbalance', label: 'Potassio basso vs sodio', severity: 'medium' });
    }
    if (Number(confidenceScore || 0) < 66) {
      flags.push({ id: 'ai_low_confidence', label: 'Confidenza AI bassa', severity: 'medium' });
    }
    return flags.slice(0, 4);
  };
  const buildMealEditAssistPatch = (nutrients = {}, confidenceScore = 0, lockedFields = []) => {
    const n = normalizeAiMealNutrients(nutrients);
    const patch = { ...n };
    const flags = computeMealReviewFlags(n, confidenceScore);
    const ids = new Set(flags.map((item) => item.id));
    const locked = new Set(Array.isArray(lockedFields) ? lockedFields : []);
    const macroKcal = (Number(n.carbs || 0) * 4) + (Number(n.protein || 0) * 4) + (Number(n.fat || 0) * 9);
    if (ids.has('kcal_mismatch') && macroKcal > 0 && !locked.has('kcal')) patch.kcal = Math.round(macroKcal);
    if (ids.has('sugars_gt_carbs') && !locked.has('sugars')) patch.sugars = Math.max(0, Math.round(Number(n.carbs || 0) * 0.55));
    if (ids.has('sat_gt_fat') && !locked.has('satFat')) patch.satFat = Math.max(0, Math.round(Number(n.fat || 0) * 0.35));
    if (ids.has('fiber_low') && !locked.has('fiber')) patch.fiber = Math.max(Number(n.fiber || 0), Math.min(Number(n.carbs || 0), Math.round(Math.max(3, Number(n.carbs || 0) * 0.12))));
    if (ids.has('electrolyte_imbalance') && !locked.has('potassiumMg')) patch.potassiumMg = Math.max(Number(n.potassiumMg || 0), Math.round(Number(n.sodiumMg || 0) * 1.2));
    return {
      patch: normalizeAiMealNutrients(patch),
      flags
    };
  };

  const buildMealAiMessages = (baseText, options = {}) => {
    const textMealSlot = inferMealSlotFromText(baseText);
    const explicit = parseExplicitMealNutrients(baseText);
    const foodKey = buildFoodReliabilityKey(baseText);
    const portionHint = foodKey ? (portionMemoryMap?.[foodKey] || null) : null;
    const selectedDateLog = quickLogData || todayData;
    const selectedDateTarget = Number(getCalorieTargetForDateKey(quickLogDateKey) || dailyGoal || 0);
    const selectedDateBurn = Math.max(0, Number(selectedDateLog?.workoutBurn ?? selectedDateLog?.burned ?? 0));
    const recentMealContext = {
      dateKey: quickLogDateKey,
      targetKcal: selectedDateTarget,
      consumedToday: Number(selectedDateLog?.consumed || 0),
      mealSplitToday: {
        breakfast: Number(selectedDateLog?.mealBreakfastKcal || 0),
        lunch: Number(selectedDateLog?.mealLunchKcal || 0),
        dinner: Number(selectedDateLog?.mealDinnerKcal || 0)
      },
      burnedToday: selectedDateBurn,
      macroGoal: {
        protein: Number(adaptiveMacroTargets.protein || 0),
        carbs: Number(adaptiveMacroTargets.carbs || 0),
        fats: Number(adaptiveMacroTargets.fats || 0)
      },
      detectedSlot: textMealSlot || mealSlot || 'lunch',
      safeMode: Boolean(options?.safeMode)
    };

    const messagesContent = [];
    if (baseText) messagesContent.push({ type: 'text', text: `Analizza questo pasto: ${baseText}` });
    messagesContent.push({ type: 'text', text: `Categoria UI attuale: ${mealSlot}` });
    messagesContent.push({ type: 'text', text: `Contesto giornaliero: ${JSON.stringify(recentMealContext)}` });
    if (portionHint?.avgGrams) {
      messagesContent.push({ type: 'text', text: `Memoria porzione alimento: media ${portionHint.avgGrams}g (n=${portionHint.count || 1}). Usa questa stima come prior.` });
    }
    if (explicit.explicitCount > 0) {
      messagesContent.push({ type: 'text', text: `Valori espliciti scritti dall'utente (priorita alta, non modificarli): ${JSON.stringify(explicit.values)}` });
    }
    if (oracleImage) messagesContent.push({ type: 'image_url', image_url: { url: oracleImage } });
    return messagesContent;
  };
  const scoreMealCandidate = (candidate) => {
    const nutrients = normalizeAiMealNutrients(candidate?.nutrients || {});
    const reviewFlags = Array.isArray(candidate?.reviewFlags) ? candidate.reviewFlags : [];
    const highFlags = reviewFlags.filter((item) => item?.severity === 'high').length;
    const medFlags = reviewFlags.filter((item) => item?.severity !== 'high').length;
    const macroKcal = (Number(nutrients.carbs || 0) * 4) + (Number(nutrients.protein || 0) * 4) + (Number(nutrients.fat || 0) * 9);
    const ratio = macroKcal > 0 ? Number(nutrients.kcal || 0) / Math.max(1, macroKcal) : 1;
    const coherencePenalty = Math.round(Math.abs(1 - ratio) * 90);
    const confidence = Math.round(Number(candidate?.confidenceScore || 0));
    return confidence - (highFlags * 18) - (medFlags * 7) - coherencePenalty;
  };
  const commitMealCandidate = ({ nutrients, resolvedMealSlot, confidenceScore, confidenceLabel, reviewFlags, usedModel, foodKey, sourceText, parsedPortionGrams, targetDateKey }) => {
    const finalDateKey = targetDateKey || quickLogDateKey || today;
    const applied = applyAiMealToDate(finalDateKey, nutrients, resolvedMealSlot);
    const entryId = `ai-meal-${Date.now()}`;
    const entry = {
      id: entryId,
      date: finalDateKey,
      mealSlot: resolvedMealSlot,
      sourceText: String(sourceText || '').slice(0, 160),
      createdAt: new Date().toISOString(),
      nutrients: applied,
      confidenceScore,
      confidenceLabel,
      lockedFields: [],
      reviewFlags,
      model: usedModel || null
    };
    updatePlayerStats((prev) => ({
      ...prev,
      mealAiReliability: updateFoodReliabilityMap(prev?.mealAiReliability || {}, foodKey, {
        triesDelta: 1,
        okDelta: reviewFlags.length === 0 ? 1 : 0,
        lastModel: usedModel || ''
      }),
      mealPortionMemory: updatePortionMemoryMap(prev?.mealPortionMemory || {}, foodKey, parsedPortionGrams),
      lastAiMeal: entry,
      aiMeals: [entry, ...((prev.aiMeals || []).slice(0, 24))]
    }));
    setMealAnalysisErrorSnapshot(null);
    if (autoMealAssistEnabled && confidenceScore < 66) {
      openAiMealAssistEditorFromEntry(entry);
    }
    playSfx('success', soundEnabled, soundTheme);
    speakEvent('quest_clear', voiceEnabled, voicePack);
    emitUiToast({
      message: `Analisi completata: +${applied.kcal} kcal • C:${applied.carbs} P:${applied.protein} F:${applied.fat} • Conf ${confidenceScore}%${reviewFlags.length ? ` • ${reviewFlags.length} check` : ''} (${MEAL_SLOT_META[resolvedMealSlot]?.label || 'Pasto'})`,
      tone: 'success',
      durationMs: 30000,
      actionLabel: 'Undo 30s',
      onAction: () => {
        applyAiMealEditDiff(finalDateKey, applied, {}, resolvedMealSlot, resolvedMealSlot);
        updatePlayerStats((prev) => {
          const remaining = (prev.aiMeals || []).filter((item) => item.id !== entryId);
          const nextLast = prev.lastAiMeal?.id === entryId ? (remaining[0] || null) : prev.lastAiMeal;
          return {
            ...prev,
            lastAiMeal: nextLast,
            aiMeals: remaining
          };
        });
        emitUiToast({ message: 'Analisi annullata', tone: 'success', durationMs: 2200 });
      }
    });
    return { applied, entry };
  };
  const buildMealCandidate = async ({ safeMode = false, modelOverride = '' } = {}) => {
    const explicit = parseExplicitMealNutrients(oracleText);
    const foodKey = buildFoodReliabilityKey(oracleText);
    const foodReliability = foodKey ? (mealAiReliability?.[foodKey] || null) : null;
    const reliabilityScore = foodReliability
      ? Math.max(30, Math.min(98, Math.round((Number(foodReliability.ok || 0) / Math.max(1, Number(foodReliability.tries || 1))) * 100)))
      : 72;
    const lowReliabilityMode = safeMode || reliabilityScore < 62;
    const messagesContent = buildMealAiMessages(oracleText, { safeMode: lowReliabilityMode });
    let data = await requestSystemAI({
      model: modelOverride || getModelFor('meal') || undefined,
      temperature: lowReliabilityMode ? 0.02 : 0.05,
      top_p: lowReliabilityMode ? 0.1 : 0.15,
      max_tokens: 480,
      timeoutMs: 28000,
      messages: [
        {
          role: 'system',
          content:
            `Sei un nutrizionista sportivo estremamente preciso. Analizza il pasto e stima macro+micro in modo conservativo ma realistico. Mantieni coerenza energetica: kcal circa uguali a (carbs*4 + protein*4 + fat*9), con tolleranza max 25%. Se una quantità è incerta, preferisci range medio realistico e non sovrastimare. ${lowReliabilityMode ? 'Modalita alta prudenza: riduci le stime incerte del 8-12% e segnala implicitamente numeri conservativi.' : ''} Rispondi ESCLUSIVAMENTE con JSON valido: {"kcal":numero,"carbs":numero,"protein":numero,"fat":numero,"fiber":numero,"sat_fat":numero,"mono_fat":numero,"poly_fat":numero,"sugars":numero,"sodium_mg":numero,"potassium_mg":numero,"omega3_mg":numero,"calcium_mg":numero,"iron_mg":numero,"magnesium_mg":numero,"meal_slot":"breakfast|lunch|dinner"}.`
        },
        { role: 'user', content: messagesContent }
      ]
    });
    let parsed = parseModelJson(data, { schema: 'meal_analysis' });
    if (!hasValidMealPayload(parsed)) {
      data = await requestSystemAI({
        model: modelOverride || getModelFor('meal') || undefined,
        temperature: 0.02,
        top_p: 0.1,
        max_tokens: 380,
        timeoutMs: 26000,
        messages: [
          {
            role: 'system',
            content:
              'Correggi una stima nutrizionale incoerente. Ricalcola in modo prudente e coerente (kcal con macro). Rispondi SOLO JSON nello stesso schema richiesto.'
          },
          {
            role: 'user',
            content: `Pasto: ${oracleText || 'n/a'}. Prima stima da correggere: ${JSON.stringify(parsed)}`
          }
        ]
      });
      parsed = parseModelJson(data, { schema: 'meal_analysis' });
    }
    const parsedValid = hasValidMealPayload(parsed);
    const explicitFallbackValid = explicit.hasCoreMacros || (explicit.hasKcal && explicit.explicitCount >= 2);
    if (!parsedValid && !explicitFallbackValid) throw new Error('stima nutrizionale incoerente');
    const baseNutrients = parsedValid ? normalizeAiMealNutrients(parsed) : normalizeAiMealNutrients({});
    let validatorNutrients = baseNutrients;
    if (parsedValid) {
      try {
        const validatorResponse = await requestSystemAI({
          model: modelOverride || getModelFor('meal') || undefined,
          temperature: 0.01,
          top_p: 0.08,
          max_tokens: 380,
          timeoutMs: 24000,
          messages: [
            {
              role: 'system',
              content:
                'Verifica una stima nutrizionale. Non cambiare i valori espliciti dell utente. Rispondi SOLO JSON coerente con schema: {"kcal":numero,"carbs":numero,"protein":numero,"fat":numero,"fiber":numero,"sat_fat":numero,"mono_fat":numero,"poly_fat":numero,"sugars":numero,"sodium_mg":numero,"potassium_mg":numero,"omega3_mg":numero,"calcium_mg":numero,"iron_mg":numero,"magnesium_mg":numero,"meal_slot":"breakfast|lunch|dinner"}.'
            },
            {
              role: 'user',
              content: `Stima primaria: ${JSON.stringify(parsed)}. Pasto: ${oracleText || 'n/a'}. Valori espliciti utente: ${JSON.stringify(explicit.values)}`
            }
          ]
        });
        const validatorParsed = parseModelJson(validatorResponse, { schema: 'meal_analysis' });
        if (hasValidMealPayload(validatorParsed)) validatorNutrients = normalizeAiMealNutrients(validatorParsed);
      } catch (_) {}
    }
    const merged = normalizeAiMealNutrients({ ...baseNutrients, ...validatorNutrients, ...explicit.values });
    const nutrients = normalizeAiMealNutrients(
      explicit.hasCoreMacros && !explicit.hasKcal
        ? {
            ...merged,
            kcal: Math.round((Number(merged.carbs || 0) * 4) + (Number(merged.protein || 0) * 4) + (Number(merged.fat || 0) * 9))
          }
        : merged
    );
    const usedModel = String(data?._shadowMeta?.model || modelOverride || '').trim();
    const confidence = computeMealAiConfidence(nutrients, oracleText, usedModel);
    const confidenceScore = Math.min(99, confidence.score + Math.min(10, explicit.explicitCount * 2));
    const confidenceBadge = getAiConfidenceBadge(confidenceScore);
    const reviewFlags = computeMealReviewFlags(nutrients, confidenceScore);
    const aiMealSlot = parsed.mealSlot || '';
    const textMealSlot = inferMealSlotFromText(oracleText);
    const resolvedMealSlot = textMealSlot || aiMealSlot || mealSlot;
    const parsedPortionGrams = parsePortionGramsFromText(oracleText);
    const candidate = {
      nutrients,
      resolvedMealSlot,
      confidenceScore,
      confidenceLabel: confidenceBadge.label,
      reviewFlags,
      usedModel,
      foodKey,
      parsedPortionGrams,
      sourceText: String(oracleText || '').slice(0, 160)
    };
    return { ...candidate, score: scoreMealCandidate(candidate) };
  };
  const runMealCompareMode = async () => {
    if (isAnalyzing || isComparingMeals) return;
    if (!oracleText && !oracleImage) {
      emitUiToast({ message: 'Inserisci testo o foto del pasto', tone: 'warning', durationMs: 2600 });
      return;
    }
    setIsComparingMeals(true);
    try {
      const primary = String(import.meta.env.VITE_OPENROUTER_MODEL || '').trim() || 'qwen/qwen3.6-plus:free';
      const secondary = String(import.meta.env.VITE_OPENROUTER_COMPARE_MODEL || '').trim() || 'openai/gpt-4o-mini';
      const models = Array.from(new Set([primary, secondary])).slice(0, 2);
      const results = [];
      for (const modelId of models) {
        try {
          const candidate = await buildMealCandidate({ safeMode: false, modelOverride: modelId });
          results.push({ ok: true, modelId, candidate });
        } catch (error) {
          results.push({ ok: false, modelId, error: formatAiErrorDetail(error?.message || 'errore').slice(0, 90) });
        }
      }
      const candidates = results
        .filter((row) => row.ok)
        .map((row) => ({ ...row.candidate, modelId: row.modelId }))
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      if (!candidates.length) throw new Error('compare mode non disponibile');
      const top = candidates[0];
      const second = candidates[1] || null;
      const gap = second ? Math.round(Number(top.score || 0) - Number(second.score || 0)) : 999;
      const topHighFlags = (top.reviewFlags || []).filter((flag) => flag?.severity === 'high').length;
      const smartAutoApply = mealCompareAutoApply && Number(top.confidenceScore || 0) >= 82 && topHighFlags === 0 && gap >= 8;
      if (smartAutoApply) {
        applyMealCompareCandidate(top);
        emitUiToast({ message: `Compare smart: auto-apply ${top.modelId} (gap ${gap})`, tone: 'success', durationMs: 3400 });
        return;
      }
      setMealCompareDraft({
        createdAt: new Date().toISOString(),
        candidates,
        failures: results.filter((row) => !row.ok),
        smartAutoApplyReady: mealCompareAutoApply,
        smartAutoApplyReason: topHighFlags > 0
          ? 'Best con flag alta severità'
          : Number(top.confidenceScore || 0) < 82
            ? `Conf best ${Math.round(Number(top.confidenceScore || 0))}% sotto soglia`
            : second && gap < 8
              ? `Gap score basso (${gap})`
              : ''
      });
      emitUiToast({ message: `Compare pronto: ${candidates.length} stime disponibili`, tone: 'success', durationMs: 3200 });
    } catch (error) {
      const detail = formatAiErrorDetail(error?.message || 'errore compare');
      emitUiToast({ message: `Compare fallito (${detail})`, tone: 'warning', durationMs: 4200 });
    } finally {
      setIsComparingMeals(false);
    }
  };
  const applyMealCompareCandidate = (candidate) => {
    if (!candidate) return;
    commitMealCandidate({ ...candidate, targetDateKey: quickLogDateKey });
    setMealCompareDraft(null);
    setOracleText('');
    setOracleImage(null);
  };
  const retryMealAnalysisSafe = () => {
    if (!mealAnalysisErrorSnapshot) return;
    if (mealAnalysisErrorSnapshot.text) setOracleText(mealAnalysisErrorSnapshot.text);
    if (mealAnalysisErrorSnapshot.image) setOracleImage(mealAnalysisErrorSnapshot.image);
    if (mealAnalysisErrorSnapshot.mealSlot) setMealSlot(mealAnalysisErrorSnapshot.mealSlot);
    analyzeMealWithAI({ safeMode: true });
  };

  const analyzeMealWithAI = async (options = {}) => {
    const safeMode = Boolean(options?.safeMode);
    if (isAnalyzing) return;
    if (!oracleText && !oracleImage) {
      emitUiToast({ message: 'Inserisci testo o foto del pasto', tone: 'warning', durationMs: 2600 });
      return;
    }
    setIsAnalyzing(true);
    try {
      const targetDateKey = quickLogDateKey || today;
      const candidate = await buildMealCandidate({ safeMode });
      const resolvedMealSlot = candidate.resolvedMealSlot;
      if (resolvedMealSlot !== mealSlot) setMealSlot(resolvedMealSlot);
      const highSeverityCount = candidate.reviewFlags.filter((flag) => String(flag?.severity || '') === 'high').length;
      const shouldHoldForReview = hardMealGuardEnabled && (candidate.confidenceScore < 68 || highSeverityCount > 0);
      if (shouldHoldForReview) {
        setAiMealEditMode('new');
        setAiMealEdit({
          id: `guard-meal-${Date.now()}`,
          date: targetDateKey,
          mealSlot: resolvedMealSlot,
          sourceId: null,
          sourceDate: targetDateKey,
          sourceMealSlot: resolvedMealSlot,
          sourceNutrients: normalizeAiMealNutrients(candidate.nutrients),
          sourceReviewFlags: candidate.reviewFlags,
          lockedFields: [],
          lockEditedValues: true,
          assistMode: true,
          ...normalizeAiMealNutrients(candidate.nutrients)
        });
        setMealAnalysisErrorSnapshot(null);
        emitUiToast({
          message: `Guard attivo: conf ${candidate.confidenceScore}% • conferma da Edit prima di applicare`,
          tone: 'warning',
          durationMs: 4200
        });
        playSfx('warning', soundEnabled, soundTheme);
        return;
      }
      commitMealCandidate({ ...candidate, targetDateKey });
      setMealCompareDraft(null);
      setOracleText('');
      setOracleImage(null);
    } catch (error) {
      console.error(error);
      playSfx('warning', soundEnabled, soundTheme);
      const detail = formatAiErrorDetail(error?.message || 'errore provider').slice(0, 90);
      setMealAnalysisErrorSnapshot({
        text: String(oracleText || ''),
        image: oracleImage || null,
        mealSlot: mealSlot || 'lunch',
        detail,
        capturedAt: new Date().toISOString()
      });
      emitUiToast({
        message: `Analisi fallita (${detail})`,
        tone: 'warning',
        durationMs: 5200
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (coachMode) {
    return (
      <div className="system-hub-shell p-6 pt-10 pb-24 min-h-full bg-void-black relative overflow-hidden">
        <div className="mb-6">
          <p className="text-gray-500 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Coach Mode</p>
          <h1 className="text-4xl font-black italic tracking-tighter text-white">TODAY FOCUS</h1>
        </div>
        <div className="mb-5 rounded-sm border border-cyan-300/35 bg-black/45 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-cyan-200">Coach Mode AI</p>
            <button onClick={generateCoachModePlan} disabled={isGeneratingCoachPlan} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${isGeneratingCoachPlan ? 'border-gray-700 text-gray-500' : 'border-cyan-300/50 text-cyan-200 hover:bg-cyan-300 hover:text-black'}`}>
              {isGeneratingCoachPlan ? 'Sync...' : 'Rigenera'}
            </button>
          </div>
          <p className="text-sm font-black text-white">{todayCoachPlan.headline}</p>
          <p className="text-[10px] text-gray-300 mt-1">{todayCoachPlan.reason}</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {(todayCoachPlan.actions || []).map((action) => (
              <button
                key={`coach-mode-${action.id}`}
                onClick={() => runWeeklyOneTapAction(action.id)}
                className="text-left border border-fuchsia-300/30 bg-fuchsia-500/10 p-2 hover:bg-fuchsia-300 hover:text-black"
              >
                <p className="text-[10px] font-black uppercase tracking-widest">{action.label}</p>
                <p className="text-[10px] opacity-80">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-5 rounded-sm border border-cyan-300/30 bg-black/45 p-4">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200 mb-2">1) Data selezionata ({quickLogDateKey})</p>
          <p className="text-xs text-gray-200">Kcal: {Math.round(quickLogData.consumed || 0)} / {Math.round(getCalorieTargetForDateKey(quickLogDateKey))} • Water: {Math.round(quickLogData.waterMl || 0)} / {hydrationGoal} ml • Burn W: {Math.round(workoutBurnQuickLog)} • Burn A: {Math.round(activeBurnQuickLog)}</p>
        </div>
        <div className="mb-5 rounded-sm border border-fuchsia-300/30 bg-black/45 p-4">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200 mb-2">2) Prossima Azione</p>
          {adaptiveQuest ? (
            <>
              <p className="text-xs text-gray-200">{adaptiveQuest.label}: {Math.round(adaptiveQuestProgress)} / {Math.round(adaptiveQuest.target)}</p>
              <button onClick={claimAdaptiveQuest} disabled={!adaptiveQuestDone || adaptiveQuest.claimed} className={`mt-2 text-[10px] px-3 py-2 border uppercase tracking-widest ${adaptiveQuestDone && !adaptiveQuest.claimed ? 'border-fuchsia-300 text-fuchsia-300 hover:bg-fuchsia-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
                {adaptiveQuest.claimed ? 'Quest riscattata' : `Claim +${adaptiveQuest.reward?.exp || 20} EXP`}
              </button>
            </>
          ) : (
            <button onClick={buildAdaptiveQuest} className="text-[10px] px-3 py-2 border border-fuchsia-300 text-fuchsia-300 uppercase tracking-widest">Genera Quest</button>
          )}
        </div>
        <div className="mb-5 rounded-sm border border-amber-300/30 bg-black/45 p-4">
          <p className="text-[10px] uppercase tracking-widest text-amber-200 mb-2">3) Warning</p>
          {dataQualityWarnings.length > 0 ? dataQualityWarnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-100 mb-1">{warning}</p>
          )) : <p className="text-xs text-gray-300">Nessun warning critico: dati puliti.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="system-hub-shell p-6 pt-10 pb-24 min-h-full bg-void-black relative overflow-hidden">
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.38em] font-bold system-font mb-1 uppercase" style={{ color: 'rgba(124,58,237,0.9)', letterSpacing: '0.36em' }}>⚡ System Core</p>
        <h1 className="epic-title text-4xl font-black italic tracking-tight">COMMAND CENTER</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, scale: 1.005 }}
        transition={{ delay: 0.01, type: 'spring', stiffness: 300, damping: 20 }}
        className="relative mb-6 overflow-hidden rounded-2xl p-5"
        style={{
          background: 'linear-gradient(145deg, rgba(8,16,40,0.96), rgba(14,22,50,0.93), rgba(10,26,56,0.96))',
          border: '1px solid rgba(0,242,255,0.18)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 40px rgba(0,242,255,0.08), 0 4px 16px rgba(2,8,20,0.6)'
        }}
      >
        <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full blur-3xl" style={{ background: 'rgba(0,242,255,0.12)' }} />
        <div className="pointer-events-none absolute -bottom-14 -right-12 h-48 w-48 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.12)' }} />
        <div className="pointer-events-none absolute top-0 right-0 w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.4), transparent)' }} />
        <div className="relative z-10">
          <p className="text-[9px] uppercase tracking-[0.42em] font-bold" style={{ color: '#00f2ff', letterSpacing: '0.4em' }}>◈ Shadow Protocol Online</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-white tracking-wide" style={{ fontFamily: 'Russo One, sans-serif' }}>Hunter Dashboard</h2>
          <p className="mt-2 text-xs text-gray-400">
            Stato realtime: energia, calorie engine e progressione evolutiva.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="hero-stat-box">
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#67e8f9' }}>System Power</p>
              <p className="text-xl font-black" style={{ color: '#cffafe', fontFamily: 'Russo One, sans-serif' }}>{systemPowerScore}</p>
            </div>
            <div className="hero-stat-box">
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#d8b4fe' }}>Force Bonus</p>
              <p className="text-xl font-black" style={{ color: '#f0e6ff', fontFamily: 'Russo One, sans-serif' }}>+{systemForceBonus}</p>
            </div>
            <div className="hero-stat-box">
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#6ee7b7' }}>Hydration</p>
              <p className="text-xl font-black" style={{ color: '#d1fae5', fontFamily: 'Russo One, sans-serif' }}>{Math.round(hydrationPct)}%</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Profilo Fisico — HUD Biometrico ── */}
      {(() => {
        const bmiVal = profileHeightCm >= 120 && currentWeight ? Number((currentWeight / ((profileHeightCm / 100) ** 2)).toFixed(1)) : null;
        const bmiColor = !bmiVal ? '#6b7280' : bmiVal < 18.5 ? '#93c5fd' : bmiVal < 25 ? '#6ee7b7' : bmiVal < 30 ? '#fbbf24' : '#f87171';
        const bmiLabel = !bmiVal ? '' : bmiVal < 18.5 ? 'Sottopeso' : bmiVal < 25 ? 'Ottimale' : bmiVal < 30 ? 'Sovrappeso' : 'Obesità';
        const sexVal = playerStats?.sex || metabolicProfile?.sex;
        const heightVal = playerStats?.heightCm || metabolicProfile?.heightCm;
        const ageVal = playerStats?.age || metabolicProfile?.age;
        const fatVal = bodyCompById.fat?.hasData ? bodyCompById.fat.current : null;
        const isMale = sexVal === 'M' || sexVal === 'male';
        const fatColor = !fatVal ? '#6b7280' : (isMale ? fatVal < 15 : fatVal < 22) ? '#6ee7b7' : (isMale ? fatVal < 25 : fatVal < 32) ? '#fbbf24' : '#f87171';
        const waterColor = bodyCompById.bodyWaterPct?.hasData ? (bodyCompById.bodyWaterPct.current >= 50 ? '#67e8f9' : '#fbbf24') : '#6b7280';
        const viscVal = bodyCompById.visceralFat?.hasData ? bodyCompById.visceralFat.current : null;
        const viscColor = !viscVal ? '#6b7280' : viscVal <= 9 ? '#6ee7b7' : viscVal <= 14 ? '#fbbf24' : '#f87171';
        const deltaColor = goalDeltaKg === 0 || !bodyGoal.targetWeightKg ? '#00f2ff' : Math.abs(goalDeltaKg) <= 2 ? '#6ee7b7' : goalDeltaKg < 0 ? '#6ee7b7' : '#fca5a5';
        const metrics = [
          { label: 'Peso', value: currentWeight ? `${currentWeight}` : '--', unit: 'kg', color: '#00f2ff', sub: bodyGoal.targetWeightKg > 0 ? `goal ${bodyGoal.targetWeightKg}kg` : null },
          { label: 'Altezza', value: heightVal ? `${heightVal}` : '--', unit: 'cm', color: '#67e8f9', sub: null },
          { label: 'BMI', value: bmiVal ? `${bmiVal}` : '--', unit: '', color: bmiColor, sub: bmiLabel },
          { label: 'Età', value: ageVal ? `${ageVal}` : '--', unit: 'anni', color: '#c4b5fd', sub: null },
          { label: 'Sesso', value: sexVal ? (isMale ? '♂' : '♀') : '--', unit: sexVal ? (isMale ? 'M' : 'F') : '', color: '#f0abfc', sub: null },
          { label: 'Target', value: bodyGoal.targetWeightKg > 0 ? `${bodyGoal.targetWeightKg}` : '--', unit: 'kg', color: deltaColor, sub: goalDeltaKg !== 0 && bodyGoal.targetWeightKg > 0 ? `${goalDeltaKg > 0 ? '+' : ''}${goalDeltaKg}kg` : null },
          { label: 'Body Fat', value: fatVal ? `${fatVal}` : '--', unit: '%', color: fatColor, sub: null },
          { label: 'Body Water', value: bodyCompById.bodyWaterPct?.hasData ? `${bodyCompById.bodyWaterPct.current}` : '--', unit: '%', color: waterColor, sub: null },
          { label: 'Viscerale', value: viscVal ? `${viscVal}` : '--', unit: '', color: viscColor, sub: viscVal ? (viscVal <= 9 ? 'Normale' : viscVal <= 14 ? 'Alto' : 'Critico') : null },
          { label: 'Lean Mass', value: bodyCompById.leanMass?.hasData ? `${bodyCompById.leanMass.current}` : '--', unit: 'kg', color: '#6ee7b7', sub: null },
          { label: 'Muscolo', value: bodyCompById.muscleMassKg?.hasData ? `${bodyCompById.muscleMassKg.current}` : '--', unit: 'kg', color: '#4ade80', sub: null },
          { label: 'BMR', value: profileBMR > 0 ? `${profileBMR}` : '--', unit: 'kcal', color: '#fde68a', sub: profileBMR > 0 ? 'riposo' : null },
        ];
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.0105, type: 'spring', stiffness: 220, damping: 26 }}
            className="mb-6 relative overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, rgba(2,10,24,0.99) 0%, rgba(6,18,40,0.97) 50%, rgba(4,14,32,0.99) 100%)',
              border: '1px solid rgba(0,242,255,0.2)',
              boxShadow: '0 0 0 1px rgba(0,242,255,0.04), 0 24px 64px rgba(0,0,0,0.75), 0 8px 32px rgba(0,242,255,0.1)',
            }}
          >
            {/* Ambient orbs */}
            <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(0,242,255,0.16), transparent 70%)', animation: 'drift-slow 14s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.16), transparent 70%)', animation: 'drift-reverse 18s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-20 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(ellipse, rgba(0,242,255,0.3), transparent 70%)' }} />
            {/* HUD grid */}
            <div className="pointer-events-none absolute inset-0 hud-grid opacity-40" />
            {/* Scanlines */}
            <div className="pointer-events-none absolute inset-0 system-scanlines opacity-30" />
            {/* Top shimmer line */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,242,255,0.7) 30%, rgba(124,58,237,0.5) 70%, transparent 100%)', animation: 'frame-glow-shift 3.5s ease-in-out infinite' }} />
            {/* Bottom accent */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.4) 50%, transparent 100%)' }} />

            <div className="relative z-10 p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[8px] uppercase font-bold mb-1" style={{ color: '#00f2ff', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.45em' }}>◈ Profilo Fisico</p>
                  <p className="text-[10px] text-gray-400 tracking-wider">Biometria · {metrics.filter(m => m.value !== '--').length}/{metrics.length} metriche attive</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #4ade80', animation: 'pulse-glow 2s ease-in-out infinite' }} />
                  <span className="text-[8px] uppercase tracking-widest" style={{ color: '#4ade80', fontFamily: 'Orbitron, sans-serif' }}>Live</span>
                </div>
              </div>

              {/* Metrics grid */}
              <motion.div
                className="grid grid-cols-3 gap-2"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.045, delayChildren: 0.12 } } }}
              >
                {metrics.map(({ label, value, unit, color, sub }) => (
                  <motion.div
                    key={label}
                    variants={{
                      hidden: { opacity: 0, scale: 0.82, y: 10 },
                      visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 22 } }
                    }}
                    whileHover={{ scale: 1.05, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96 }}
                    className="hud-chip relative rounded-xl overflow-hidden"
                    style={{
                      background: `linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
                      border: `1px solid ${value !== '--' ? color + '28' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: value !== '--' ? `0 0 12px ${color}10, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    {/* Tile top glow when active */}
                    {value !== '--' && (
                      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
                    )}
                    <div className="p-2.5">
                      <p className="text-[7px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(156,163,175,0.7)', fontFamily: 'Orbitron, sans-serif' }}>{label}</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-lg font-black leading-none" style={{ color: value !== '--' ? color : 'rgba(107,114,128,0.6)', fontFamily: 'Russo One, sans-serif', filter: value !== '--' ? `drop-shadow(0 0 6px ${color}66)` : 'none' }}>
                          {value}
                        </p>
                        {unit && value !== '--' && (
                          <p className="text-[8px] font-bold" style={{ color: color + 'aa' }}>{unit}</p>
                        )}
                      </div>
                      {sub && (
                        <p className="text-[8px] mt-1 leading-none" style={{ color: color + 'bb', fontFamily: 'Chakra Petch, sans-serif' }}>{sub}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Bottom hint */}
              <p className="text-[8px] text-center mt-4 tracking-widest" style={{ color: 'rgba(0,242,255,0.3)', fontFamily: 'Orbitron, sans-serif' }}>
                INVIA DATI VIA TELEGRAM · AGGIORNAMENTO REAL-TIME
              </p>
            </div>
          </motion.div>
        );
      })()}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.011 }}
        className="mb-6 rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(10,10,20,0.96), rgba(18,12,32,0.93))',
          border: '1px solid rgba(124,58,237,0.22)',
          boxShadow: '0 8px 32px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'
        }}
      >
        <div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.14)' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(167,139,250,0.9)' }}>◈ Daily Integration</p>
              <p className="text-sm font-black text-white tracking-wide" style={{ fontFamily: 'Russo One, sans-serif' }}>Briefing Giornaliero</p>
            </div>
            <button
              onClick={generateDailyBriefing}
              disabled={isGeneratingBriefing}
              className={`text-[9px] px-3 py-1.5 border uppercase tracking-widest transition-colors ${isGeneratingBriefing ? 'border-gray-700 text-gray-500' : 'border-violet-300/50 text-violet-200 hover:bg-violet-300 hover:text-black'}`}
            >
              {isGeneratingBriefing ? 'Analisi...' : 'Analizza'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)' }}>
              <p className="text-[8px] uppercase tracking-widest text-cyan-400 mb-0.5">Kcal</p>
              <p className="text-sm font-black text-white">{Math.round(Number(todayData.consumed || 0))}</p>
              <p className="text-[8px] text-gray-500">/{Math.round(effectiveDailyGoal || dailyGoal || 0)}</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <p className="text-[8px] uppercase tracking-widest text-emerald-400 mb-0.5">Prot</p>
              <p className="text-sm font-black text-white">{Math.round(Number(todayData.protein || 0))}g</p>
              <p className="text-[8px] text-gray-500">/{Math.round(Number(adaptiveMacroTargets?.protein || macroGoals?.protein || 0))}g</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
              <p className="text-[8px] uppercase tracking-widest text-orange-400 mb-0.5">Burn</p>
              <p className="text-sm font-black text-white">{Math.round(Number(todayData.workoutBurn ?? todayData.burned ?? 0))}</p>
              <p className="text-[8px] text-gray-500">kcal</p>
            </div>
            <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(217,70,239,0.08)', border: '1px solid rgba(217,70,239,0.18)' }}>
              <p className="text-[8px] uppercase tracking-widest text-fuchsia-400 mb-0.5">Score</p>
              <p className="text-sm font-black text-white">{systemPowerScore}</p>
              <p className="text-[8px] text-gray-500">/100</p>
            </div>
          </div>
          {dailyBriefing ? (
            <div className="rounded-lg p-3 mt-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <p className="text-[10px] text-gray-200 leading-relaxed whitespace-pre-wrap">{dailyBriefing.text}</p>
              {dailyBriefing.ts ? (
                <p className="text-[8px] text-gray-600 uppercase mt-2 tracking-widest">{new Date(dailyBriefing.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 italic">Premi "Analizza" per il briefing Nemotron del giorno.</p>
          )}
        </div>
      </motion.div>

      {showAdvanced && featureFlags.bossReady ? (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.011 }}
        className="mb-6 rounded-sm border border-fuchsia-300/35 bg-black/45 p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.32em] text-fuchsia-200">Boss Ready Score</p>
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-100">Tier {bossReadyTier}</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border border-fuchsia-300/30 bg-black/40 mb-2">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, bossReadyScore))}%` }} className="h-full bg-[linear-gradient(90deg,#22d3ee,#d946ef,#f59e0b)]" />
        </div>
        <p className="text-xs text-white mb-2">Score: <span className="font-black text-fuchsia-200">{bossReadyScore}/100</span></p>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="hero-stat-box py-2 px-1"><p className="text-[11px] font-black text-cyan-200 leading-none">{bossReadyBreakdown.nutrition}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Nutri</p></div>
          <div className="hero-stat-box py-2 px-1"><p className="text-[11px] font-black text-emerald-200 leading-none">{bossReadyBreakdown.hydration}</p><p className="text-[8px] text-gray-500 uppercase mt-1">H2O</p></div>
          <div className="hero-stat-box py-2 px-1"><p className="text-[11px] font-black text-amber-200 leading-none">{bossReadyBreakdown.recovery}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Rec</p></div>
          <div className="hero-stat-box py-2 px-1"><p className="text-[11px] font-black text-orange-200 leading-none">{bossReadyBreakdown.training}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Train</p></div>
          <div className="hero-stat-box py-2 px-1"><p className="text-[11px] font-black text-violet-200 leading-none">{bossReadyBreakdown.consistency}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Streak</p></div>
        </div>
      </motion.div>
      ) : null}

      {showAdvanced && featureFlags.smartGoalWizard ? (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.0115 }}
        className="mb-6 rounded-sm border border-cyan-300/35 bg-black/45 p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-200">Smart Goal Wizard (30s)</p>
          <button onClick={generateSmartGoalDraft} className="text-[9px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Calcola</button>
        </div>
        {smartGoalDraft ? (
          <>
            <p className="text-[10px] text-gray-300 mb-2">Base su {smartGoalDraft.sourceDays} giorni reali • objective: {smartGoalDraft.objective}</p>
            <div className="grid grid-cols-5 gap-2 text-center mb-2">
              <div className="border border-white/10 bg-white/5 p-1"><p className="text-[10px] font-black text-white">{smartGoalDraft.kcal}</p><p className="text-[8px] text-gray-500 uppercase">Kcal</p></div>
              <div className="border border-white/10 bg-white/5 p-1"><p className="text-[10px] font-black text-cyan-200">{smartGoalDraft.hydration}</p><p className="text-[8px] text-gray-500 uppercase">H2O</p></div>
              <div className="border border-white/10 bg-white/5 p-1"><p className="text-[10px] font-black text-emerald-200">{smartGoalDraft.macros.protein}</p><p className="text-[8px] text-gray-500 uppercase">Prot</p></div>
              <div className="border border-white/10 bg-white/5 p-1"><p className="text-[10px] font-black text-amber-200">{smartGoalDraft.macros.carbs}</p><p className="text-[8px] text-gray-500 uppercase">Carb</p></div>
              <div className="border border-white/10 bg-white/5 p-1"><p className="text-[10px] font-black text-yellow-200">{smartGoalDraft.macros.fats}</p><p className="text-[8px] text-gray-500 uppercase">Fat</p></div>
            </div>
            <button onClick={applySmartGoalDraft} className="w-full text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Applica Target</button>
          </>
        ) : (
          <p className="text-xs text-gray-400">Premi "Calcola" per ottenere target personalizzati dal tuo storico reale.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced && featureFlags.travelMode ? (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.0117 }}
        className="mb-6 rounded-sm border border-amber-300/35 bg-black/45 p-4"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.32em] text-amber-200">Travel / Chaos Mode</p>
          <button
            onClick={() => updatePlayerStats((prev) => ({ ...prev, travelModeEnabled: !prev.travelModeEnabled }))}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${travelModeEnabled ? 'border-emerald-300/50 text-emerald-200' : 'border-white/15 text-gray-400'}`}
          >
            {travelModeEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-xs text-gray-300 mb-2">Modalita minima efficace: mantiene streak anche nei giorni incasinati.</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-[9px] uppercase text-cyan-200">1</p><p className="text-[10px] text-gray-300">+500ml acqua</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-[9px] uppercase text-emerald-200">2</p><p className="text-[10px] text-gray-300">+28g proteine</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-[9px] uppercase text-amber-200">3</p><p className="text-[10px] text-gray-300">12 min movimento</p></div>
        </div>
      </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.014 }}
        className={`weekly-crown-card ${weeklyCrownModeClass} mb-6 rounded-2xl p-5`}
        style={{ background: 'linear-gradient(145deg, rgba(12,10,6,0.97), rgba(28,18,4,0.93), rgba(10,8,20,0.96))', border: '1px solid rgba(245,158,11,0.25)', boxShadow: '0 8px 32px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}
      >
        {weeklyCrownUnlockFx ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.92, 1.04, 1.08] }}
            transition={{ duration: 0.96, ease: [0.16, 1, 0.3, 1] }}
            className="weekly-crown-unlock pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.74, opacity: 0 }}
              animate={{ scale: [0.74, 1.12, 1.26], opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-52 w-52 rounded-full border border-amber-300/60"
            />
            <motion.div
              initial={{ scale: 0.78, opacity: 0 }}
              animate={{ scale: [0.78, 1.08, 1.22], opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.88, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-40 w-40 rounded-full border border-fuchsia-300/45"
            />
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 16 }).map((_, idx) => (
                <motion.span
                  key={`crown-spark-${idx}`}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
                  animate={{
                    opacity: [0, 0.95, 0],
                    x: [0, (idx % 2 === 0 ? 1 : -1) * (36 + ((idx * 7) % 44))],
                    y: [0, -24 - ((idx * 5) % 38)],
                    scale: [0.35, 1.08, 0.2]
                  }}
                  transition={{ duration: 0.7, delay: 0.04 + (idx * 0.015), ease: 'easeOut' }}
                  className="absolute left-1/2 top-[58%] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.9)]"
                />
              ))}
            </div>
            <div className="rounded-full border border-amber-300/65 bg-black/70 px-5 py-2 shadow-[0_0_28px_rgba(251,191,36,0.4)]">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-100">Crown Unlocked</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-fuchsia-100/85">Weekly chain secured</p>
            </div>
          </motion.div>
        ) : null}
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-amber-200">Weekly Crown</p>
              <h3 className="mt-1 text-lg font-black uppercase text-white">4 Workout Streak</h3>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-orange-200">
                {weeklyCrownStreak} settimane chain · {weeklyCrownTier} {weeklyCrownFlames}
              </p>
              <p className={`mt-1 text-[10px] uppercase tracking-[0.24em] font-black ${weeklyCrownTierTone}`}>Crown Tier {weeklyCrownTier}</p>
            </div>
            <div className="rounded-full border border-amber-300/35 bg-black/35 px-3 py-2 text-center">
              <p className="text-xl font-black text-white">{currentWeekTrainingSessions}/{weeklyTargetWorkouts}</p>
              <p className="text-[9px] uppercase tracking-widest text-amber-200">Week</p>
            </div>
          </div>
          <div className="mt-2">
            <motion.span
              animate={crownAnthemEnabled && currentWeekTrainingSessions >= weeklyTargetWorkouts ? { scale: [1, 1.045, 1], opacity: [0.92, 1, 0.92] } : { scale: 1, opacity: 1 }}
              transition={crownAnthemEnabled && currentWeekTrainingSessions >= weeklyTargetWorkouts ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              className={`inline-flex items-center border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${
                crownAnthemEnabled
                  ? weeklyCrownBadgeTone
                  : 'border-white/15 text-gray-400 bg-white/5'
              }`}
            >
              <span className={`mr-1 crown-emblem ${weeklyCrownEmblemClass}`}>{weeklyCrownEmblem}</span>
              CROWN FX {weeklyCrownFxLabel}
            </motion.span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-lg font-black text-white">{weeklyCrownRemainingWorkouts}</p>
              <p className="text-[8px] uppercase text-gray-400">Left</p>
            </div>
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-lg font-black text-emerald-200">{weeklyCrownPerfectRun}</p>
              <p className="text-[8px] uppercase text-gray-400">Perfect Run</p>
            </div>
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-lg font-black text-fuchsia-200">{weeklyCrownMomentumPct}%</p>
              <p className="text-[8px] uppercase text-gray-400">Momentum</p>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/15 bg-black/40">
            <motion.div initial={{ width: 0 }} animate={{ width: `${weeklyCrownPct}%` }} className="h-full bg-[linear-gradient(90deg,#f59e0b,#fb923c,#d946ef)] shadow-[0_0_20px_rgba(251,146,60,0.55)]" />
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-fuchsia-300/25 bg-black/40">
            <motion.div initial={{ width: 0 }} animate={{ width: `${weeklyCrownMomentumPct}%` }} className="h-full bg-[linear-gradient(90deg,#22d3ee,#d946ef)] shadow-[0_0_14px_rgba(217,70,239,0.55)]" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className={`text-[10px] uppercase tracking-widest ${weeklyCrownUrgencyTone}`}>{weeklyCrownUrgencyLabel}</p>
            <span className="text-[9px] uppercase tracking-[0.24em] text-white/65">{weeklyCrownPace}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {weeklyCrownNodes.map((done, idx) => (
              <div key={`wc-${idx}`} className={`text-center text-[10px] font-black uppercase tracking-widest rounded-sm border px-2 py-2 ${done ? 'border-emerald-300/60 bg-emerald-500/18 text-emerald-100' : 'border-white/12 bg-white/5 text-white/35'}`}>
                {done ? 'Clear' : `Slot ${idx + 1}`}
              </div>
            ))}
          </div>
          <div className="mt-3 border border-white/10 bg-black/30 p-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-200">Weekly Timeline</p>
              <p className="text-[9px] uppercase tracking-widest text-gray-400">Last 8 Weeks</p>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {weeklyCrownHistory.map((item) => {
                const barHeight = Math.max(20, Math.min(100, Math.round((item.sessions / Math.max(1, weeklyTargetWorkouts)) * 100)));
                return (
                  <div key={item.key} className="flex flex-col items-center gap-1">
                    <div className="h-16 w-full border border-white/10 bg-black/40 p-[2px]">
                      <div
                        className={`w-full self-end ${item.done ? 'bg-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.45)]' : 'bg-cyan-300/60'}`}
                        style={{ height: `${barHeight}%`, marginTop: `${100 - barHeight}%` }}
                      />
                    </div>
                    <p className={`text-[8px] uppercase tracking-widest ${item.label === 'NOW' ? 'text-cyan-100' : 'text-gray-500'}`}>{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.0165 }}
        className="mb-6 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(6,10,22,0.97), rgba(14,8,28,0.95))',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 8px 32px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'
        }}
      >
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(129,140,248,0.9)' }}>◈ Nemotron AI</p>
              <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Shadow Chat</p>
            </div>
            <button
              onClick={() => setShadowChatMessages([])}
              className="text-[8px] px-2 py-1 border border-white/15 text-gray-500 uppercase tracking-widest hover:border-rose-300/40 hover:text-rose-300"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="h-52 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {shadowChatMessages.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic text-center pt-8">Chiedimi qualsiasi cosa: nutrizione, allenamento, integratori, analisi del tuo profilo...</p>
          ) : (
            shadowChatMessages.map((msg, idx) => (
              <div key={`schat-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-gray-200'}`}
                  style={msg.role === 'user'
                    ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.3)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {msg.role === 'assistant' && msg.provider && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider opacity-60" style={{ color: '#818cf8' }}>
                      <span>⚡ {msg.provider}</span>
                      {msg.web && <span style={{ color: '#34d399' }}>· 🌐 web</span>}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isShadowChatLoading ? (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl text-[11px] text-indigo-300" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}>
                Nemotron sta analizzando...
              </div>
            </div>
          ) : null}
          <div ref={shadowChatEndRef} />
        </div>
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex gap-2">
            <input
              type="text"
              value={shadowChatInput}
              onChange={(e) => setShadowChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendShadowChatMessage(); } }}
              placeholder="Chiedi a Nemotron..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-300/50"
            />
            <button
              onClick={() => sendShadowChatMessage()}
              disabled={isShadowChatLoading || !shadowChatInput.trim()}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${isShadowChatLoading || !shadowChatInput.trim() ? 'bg-white/5 text-gray-600 border border-white/10' : 'border border-indigo-300/50 text-indigo-200 hover:bg-indigo-300 hover:text-black'}`}
            >
              Invia
            </button>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {['Analizza il mio profilo oggi', 'Quali integratori devo prendere?', 'Ottimizza i miei macro', 'Workout consigliato'].map((q) => (
              <button key={q} onClick={() => sendShadowChatMessage(q)} className="text-[9px] px-2 py-1 border border-indigo-300/20 text-indigo-400 rounded-full hover:bg-indigo-300/15 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Shadow Insights — suggerimenti personalizzati */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.017 }}
        className="system-card mb-6 rounded-sm p-4"
        style={{ background: 'linear-gradient(145deg, rgba(6,10,22,0.97), rgba(8,14,28,0.95))', border: '1px solid rgba(52,211,153,0.2)', boxShadow: '0 8px 32px rgba(52,211,153,0.06), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>◈ AI Personale</p>
            <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Shadow Insights</p>
          </div>
          <button onClick={() => generateShadowInsights(true)} disabled={isLoadingInsights}
            className="text-[8px] px-2 py-1 border border-white/15 text-gray-500 uppercase tracking-widest hover:border-emerald-300/40 hover:text-emerald-300 transition-colors disabled:opacity-30">
            {isLoadingInsights ? '...' : '↻ Aggiorna'}
          </button>
        </div>
        {isLoadingInsights ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34d399' }} />
            <span className="text-[10px] text-emerald-400">Analisi dati in corso…</span>
          </div>
        ) : shadowInsights?.items?.length > 0 ? (
          <div className="space-y-2">
            {shadowInsights.items.map((item, i) => (
              <div key={i} className="flex gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.1)' }}>
                <span className="text-lg flex-shrink-0 leading-none mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-[11px] font-bold text-white mb-0.5">{item.title}</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
            {shadowInsights.provider && (
              <p className="text-[8px] font-mono text-gray-600 text-right mt-1">⚡ {shadowInsights.provider}</p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-gray-600 italic text-center py-4">Inizia a registrare pasti e workout per ricevere suggerimenti personalizzati</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.018 }}
        className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-fuchsia-400/30 bg-black/45 p-4' : 'hidden'}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300">Mission Control</p>
          <p className="text-[10px] uppercase tracking-widest text-white/60">Today Protocol</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {QUICK_PROTOCOLS.map((protocol, idx) => (
            <motion.div
              key={protocol.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 + (idx * 0.04) }}
              whileHover={{ x: 2, scale: 1.01 }}
              className={`rounded-sm border p-3 ${protocol.color}`}
            >
              <p className="text-[10px] uppercase tracking-widest font-black">{protocol.title}</p>
              <p className="text-xs text-white/80 mt-1">{protocol.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.022 }} className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4' : 'hidden'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">Template Giorno (1 Tap)</p>
          <span className="text-[9px] text-gray-500 uppercase">{playerStats.lastDayTemplate?.id || 'none'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DAY_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => applyDayTemplate(template.id)}
              className="text-[10px] px-2 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
            >
              {template.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.025 }} className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-emerald-300/30 bg-black/45 p-4' : 'hidden'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200">Weekly Review</p>
          <span className="text-[9px] text-gray-500 uppercase">{weeklyReview.daysTracked}/7 giorni</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{weeklyReview.kcalAdherencePct}%</p><p className="text-[8px] text-gray-500 uppercase">Kcal Adherence</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{weeklyReview.hydrationAdherencePct}%</p><p className="text-[8px] text-gray-500 uppercase">Hydration</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-amber-200">{weeklyReview.trainingDays}</p><p className="text-[8px] text-gray-500 uppercase">Training Days</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-indigo-200">{weeklyReview.avgSleep}h</p><p className="text-[8px] text-gray-500 uppercase">Sleep Avg</p></div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.027 }} className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-fuchsia-300/30 bg-black/45 p-4' : 'hidden'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Settimana Perfetta</p>
          <p className="text-lg font-black text-white">{perfectWeekScore}%</p>
        </div>
        <div className="w-full h-2 bg-white/10 border border-fuchsia-300/25 overflow-hidden mb-2">
          <motion.div initial={{ width: 0 }} animate={{ width: `${perfectWeekScore}%` }} className="h-full bg-fuchsia-300" />
        </div>
        <p className="text-[10px] text-gray-300">Completato: {perfectWeekDone}/{perfectWeekMetrics.length}</p>
        <p className="text-[10px] text-gray-400 mt-1">
          {perfectWeekMissing.length > 0 ? `Manca: ${perfectWeekMissing.join(', ')}` : 'Perfetta: tutti i target weekly centrati.'}
        </p>
      </motion.div>
      {systemCompactMode ? (
        <div className="system-card mb-6 rounded-sm border border-fuchsia-300/30 bg-fuchsia-500/10 p-3">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">System Compatto Attivo</p>
          <p className="text-[10px] text-gray-300 mt-1">Le sezioni avanzate sono in System+ (menu hamburger).</p>
        </div>
      ) : null}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.028 }} className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4' : 'hidden'}`}>
        <p className="text-[10px] uppercase tracking-widest text-cyan-200 mb-3">Sleep Coach & Weight Guard</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">Sleep Avg (7d)</p>
            <p className="text-lg font-black text-white">{sleepCoach.avgSleep || '--'} h</p>
            <p className="text-[9px] text-cyan-200 uppercase">Target {sleepCoach.target}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">Weight Trend (7d vs prev)</p>
            <p className="text-lg font-black text-white">{weightTrend.weeklyDeltaKg > 0 ? '+' : ''}{weightTrend.weeklyDeltaKg || 0} kg</p>
            <p className="text-[9px] text-cyan-200 uppercase">{weightTrend.weeklyDeltaPct > 0 ? '+' : ''}{weightTrend.weeklyDeltaPct || 0}% / week</p>
          </div>
        </div>
        <p className="text-xs text-gray-200 mb-1">{sleepCoach.advice}</p>
        <p className="text-[10px] text-cyan-200 uppercase mb-2">{sleepCoach.trainingHint}</p>
        <p className="text-xs text-gray-200">{weightTrend.message}</p>
        <p className={`text-[10px] uppercase mt-2 ${weeklyWeightSignal.status === 'too_fast' || weeklyWeightSignal.status === 'too_slow' || weeklyWeightSignal.status === 'volatile' ? 'text-rose-200' : 'text-emerald-200'}`}>
          Alert pesata settimanale: {weeklyWeightSignal.message}
        </p>
        <p className="text-[10px] text-gray-300 uppercase">
          Delta ultima pesata: {weeklyWeightSignal.deltaKg > 0 ? '+' : ''}{weeklyWeightSignal.deltaKg} kg ({weeklyWeightSignal.deltaPct > 0 ? '+' : ''}{weeklyWeightSignal.deltaPct}%)
        </p>
        <p className="text-[10px] text-gray-400 uppercase">
          Ultima pesata segnata: {playerStats.lastWeeklyWeighInDate || '--'}
        </p>
        <p className="text-[10px] text-violet-200 uppercase mt-1">
          Suggerimento weekly: {weeklyWeightSignal.kcalAdjustment === 0 ? 'mantieni' : `${weeklyWeightSignal.kcalAdjustment > 0 ? '+' : ''}${weeklyWeightSignal.kcalAdjustment} kcal/giorno`}
        </p>
        <button
          onClick={markWeeklyWeighInDone}
          className="mt-2 text-[10px] px-3 py-2 border border-emerald-300/50 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
        >
          Ho fatto pesata weekly
        </button>
        <button
          onClick={applyWeeklyWeightKcalSuggestion}
          disabled={!weeklyWeightSignal.kcalAdjustment}
          className={`mt-2 text-[10px] px-3 py-2 border uppercase tracking-widest ${
            weeklyWeightSignal.kcalAdjustment
              ? 'border-violet-300 text-violet-200 hover:bg-violet-300 hover:text-black'
              : 'border-gray-700 text-gray-500'
          }`}
        >
          Applica Suggestione Weekly (1 tap)
        </button>
        <p className="text-[10px] text-amber-200 uppercase mt-2">
          {weightTrend.kcalAdjustment === 0
            ? 'Kcal suggestion: mantieni attuali'
            : `Kcal suggestion: ${weightTrend.kcalAdjustment > 0 ? '+' : ''}${weightTrend.kcalAdjustment} kcal/giorno`}
        </p>
        <p className={`text-[10px] uppercase mt-1 ${bodyCompCalorieSignal.tone}`}>
          Body-comp smart: {bodyCompCalorieSignal.kcalAdjustment === 0 ? 'mantieni' : `${bodyCompCalorieSignal.kcalAdjustment > 0 ? '+' : ''}${bodyCompCalorieSignal.kcalAdjustment} kcal/giorno`}
        </p>
        {bodyCompCalorieSignal.reasons.length ? (
          <p className="text-[10px] text-gray-300 mt-1">{bodyCompCalorieSignal.reasons.join(' • ')}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={applyWeightTrendKcalSuggestion}
            disabled={!weightTrend.kcalAdjustment}
            className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${
              weightTrend.kcalAdjustment
                ? 'border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black'
                : 'border-gray-700 text-gray-500'
            }`}
          >
            Applica kcal suggerite (1 tap)
          </button>
          <button
            onClick={restoreNormalCalories}
            className="text-[10px] px-3 py-2 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
          >
            Ripristina Normali (1 tap)
          </button>
          <button
            onClick={saveCurrentAsNormalCalories}
            className="text-[10px] px-3 py-2 border border-emerald-300/50 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
          >
            Salva come Normali
          </button>
        </div>
        <p className="mt-2 text-[9px] text-gray-400 uppercase tracking-widest">
          Normali attuali: {normalCalorieGoal} kcal
        </p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0285 }} className={`${showAdvanced ? 'system-card mb-6 rounded-sm border border-emerald-300/30 bg-black/45 p-4' : 'hidden'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200">Objective Calorie Balance</p>
          <p className={`text-[10px] uppercase ${calorieBalanceAdvisor.tone}`}>{calorieBalanceAdvisor.delta > 0 ? '+' : ''}{calorieBalanceAdvisor.delta} kcal</p>
        </div>
        <p className="text-xs text-gray-300">Base {calorieBalanceAdvisor.baseGoal} → Suggested {calorieBalanceAdvisor.suggested} kcal</p>
        {calorieBalanceAdvisor.reasons.length ? (
          <p className="text-[10px] text-gray-400 mt-1">{calorieBalanceAdvisor.reasons.join(' • ')}</p>
        ) : (
          <p className="text-[10px] text-gray-500 mt-1">Nessun correttivo forte oggi: profilo stabile.</p>
        )}
        <button
          onClick={applyCalorieBalanceAdvisor}
          className="mt-2 text-[10px] px-3 py-2 border border-emerald-300/55 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
        >
          Applica bilanciamento (1 tap)
        </button>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0287 }} className="mb-6 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(145deg, rgba(8,8,24,0.97), rgba(12,8,28,0.93))', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 8px 32px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.12)' }} />
        <div className="p-4 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(129,140,248,0.9)' }}>◈ Smart Stack</p>
            <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Daily Integrators</p>
          </div>
          <span className="text-[8px] px-2 py-1 border border-indigo-300/30 text-indigo-300 uppercase tracking-widest">{supplementAdvisor.moodTag}</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {SUPPLEMENT_CATALOG.map((supp) => {
            const enabled = enabledSupplementIds.has(supp.id);
            return (
              <button
                key={`supp-toggle-${supp.id}`}
                onClick={() => toggleSupplementEnabled(supp.id)}
                className={`text-[9px] px-2 py-1.5 rounded-lg border uppercase tracking-widest transition-colors ${
                  enabled ? 'border-indigo-300/55 text-indigo-100 bg-indigo-500/15' : 'border-white/10 text-gray-600 hover:border-white/20 hover:text-gray-400'
                }`}
              >
                {supp.name}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {filteredSupplementItems.length ? filteredSupplementItems.map((item) => (
            <div key={item.id} className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white">{item.name}</p>
                <span className="text-[8px] px-1.5 py-0.5 border border-cyan-300/25 text-cyan-300 rounded-full">{item.dose}</span>
              </div>
              <p className="text-[9px] text-indigo-300">{item.timing}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{item.why}</p>
            </div>
          )) : (
            <p className="text-[10px] text-gray-500 italic">Nessun integratore prioritario oggi.</p>
          )}
        </div>
        {dailySupplementCore.length ? (
          <p className="mt-3 text-[9px] text-indigo-300">Stack attivo: {dailySupplementCore.map((x) => x.name).join(' • ')}</p>
        ) : null}
        <p className="mt-2 text-[8px] text-gray-600 uppercase">Indicazioni generali, non mediche.</p>
        </div>
      </motion.div>
      {/* ── CONFIG MODELLI AI ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl overflow-hidden relative p-4" style={{ background: 'linear-gradient(145deg, rgba(8,10,22,0.97), rgba(12,16,32,0.93))', border: '1px solid rgba(99,102,241,0.22)' }}>
        <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(129,140,248,0.9)' }}>◈ Configurazione</p>
        <p className="text-sm font-black text-white mb-3" style={{ fontFamily: 'Russo One, sans-serif' }}>Modelli AI</p>
        <div className="space-y-2">
          {[
            { label: '🌐 Globale (default)', value: aiModelGlobal, set: (v) => { setAiModelGlobal(v); setGlobalModel(v); } },
            { label: '🍽️ Analisi pasto', value: aiModelMeal, set: (v) => { setAiModelMeal(v); setTaskOverride('meal', v); } },
            { label: '👨‍🍳 Ricetta', value: aiModelRecipe, set: (v) => { setAiModelRecipe(v); setTaskOverride('recipe', v); } },
            { label: '🧠 Analisi profilo', value: aiModelProfile, set: (v) => { setAiModelProfile(v); setTaskOverride('profile', v); } },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-300 flex-shrink-0">{row.label}</span>
              <select value={row.value} onChange={(e) => row.set(e.target.value)}
                className="bg-black/55 border border-white/10 rounded-lg text-white text-[10px] px-2 py-1.5 focus:outline-none focus:border-indigo-400/50 max-w-[60%]">
                {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[8px] text-gray-600">Override vuoto = usa il globale. Globale vuoto = catena automatica del proxy.</p>
      </motion.div>

      {/* ── ANALISI PROFILO PROFONDA (Nemotron) ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl overflow-hidden relative p-4" style={{ background: 'linear-gradient(145deg, rgba(6,18,14,0.97), rgba(8,24,18,0.93))', border: '1px solid rgba(16,185,129,0.22)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>◈ Deep Analysis</p>
            <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Analisi Profilo</p>
          </div>
          <button onClick={analyzeProfile} disabled={isAnalyzingProfile}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${isAnalyzingProfile ? 'border-gray-700 text-gray-500' : 'border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/20'}`}>
            {isAnalyzingProfile ? '⏳ Analizzo…' : '🧠 Analizza profilo'}
          </button>
        </div>
        {profileAnalysis ? (
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-[8px] text-gray-500 mb-1.5">{new Date(profileAnalysis.date).toLocaleString('it-IT')}{profileAnalysis.model ? ` · ${profileAnalysis.model}` : ''}</p>
            <p className="text-[11px] text-gray-200 whitespace-pre-wrap leading-relaxed">{profileAnalysis.content}</p>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500">Genera un'analisi profonda del tuo profilo sugli ultimi 30 giorni di dati reali — quadro, criticità, piano d'azione e proiezione.</p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0289 }} className="mb-6 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(145deg, rgba(10,6,22,0.97), rgba(20,8,36,0.93))', border: '1px solid rgba(167,139,250,0.22)', boxShadow: '0 8px 32px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.16)' }} />
        <div className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(167,139,250,0.9)' }}>◈ Fitporn AI</p>
              <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Recipe Forge</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => generateRecipeFromPrompt(true)} disabled={isGeneratingRecipe}
                className={`text-[9px] px-2.5 py-1.5 rounded-lg border transition-colors ${isGeneratingRecipe ? 'border-gray-700 text-gray-500' : 'border-violet-400/40 text-violet-300 hover:bg-violet-500/20'}`}>
                ✨ Sorprendimi
              </button>
              <button onClick={() => generateRecipeFromPrompt(false)} disabled={isGeneratingRecipe}
                className={`text-[9px] px-2.5 py-1.5 rounded-lg border transition-colors ${isGeneratingRecipe ? 'border-gray-700 text-gray-500' : 'border-violet-300/60 text-white hover:bg-violet-500/30'}`}>
                {isGeneratingRecipe ? '⏳' : '⚡ Genera'}
              </button>
            </div>
          </div>
          <textarea value={recipePrompt} onChange={(e) => setRecipePrompt(e.target.value)}
            placeholder="Es: pollo e riso express, dessert proteico al cioccolato, bowl estiva leggera..."
            className="w-full bg-black/55 border border-white/10 rounded-xl text-white text-[11px] p-3 h-14 focus:outline-none focus:border-violet-400/50 resize-none placeholder-gray-600" />
          {/* Quick tags */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {['🍗 High protein', '⚡ Pre-workout', '🌙 Cena leggera', '🍫 Dessert fit', '🥗 Bowl fresca'].map((tag) => (
              <button key={tag} onClick={() => setRecipePrompt(tag.split(' ').slice(1).join(' '))}
                className="text-[8px] px-2 py-0.5 rounded-full border border-violet-300/20 text-violet-400 hover:bg-violet-400/10 transition-colors">
                {tag}
              </button>
            ))}
          </div>
          {isGeneratingRecipe && (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#a78bfa' }} />
              <span className="text-[10px] text-violet-300">Chef AI al lavoro...</span>
            </div>
          )}
          {generatedRecipe && !isGeneratingRecipe && (
            <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(0,0,0,0.4)' }}>
              {/* Header fitporn */}
              <div className="p-3 pb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))' }}>
                <div className="flex items-start gap-2">
                  <span className="text-3xl leading-none">{generatedRecipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white leading-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>{generatedRecipe.title}</p>
                    {generatedRecipe.tagline && <p className="text-[10px] text-violet-200 mt-0.5 italic leading-snug">"{generatedRecipe.tagline}"</p>}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(167,139,250,0.2)', color: '#c4b5fd' }}>
                      FIT {generatedRecipe.fitScore}/10
                    </div>
                    <div className="text-[8px] text-gray-400">{generatedRecipe.difficulty}</div>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 text-[9px] text-gray-400">
                  {generatedRecipe.prepMin > 0 && <span>⏱ prep {generatedRecipe.prepMin}min</span>}
                  {generatedRecipe.cookMin > 0 && <span>🔥 cook {generatedRecipe.cookMin}min</span>}
                  <span className="capitalize">{generatedRecipe.mood}</span>
                </div>
              </div>
              {/* Macro bar */}
              <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/5">
                {[
                  { label: 'Kcal', val: generatedRecipe.kcal, color: '#f97316' },
                  { label: 'Prot', val: `${generatedRecipe.protein}g`, color: '#10b981' },
                  { label: 'Carb', val: `${generatedRecipe.carbs}g`, color: '#3b82f6' },
                  { label: 'Grass', val: `${generatedRecipe.fat}g`, color: '#f59e0b' },
                ].map((m) => (
                  <div key={m.label} className="py-2 text-center">
                    <p className="text-[11px] font-black" style={{ color: m.color }}>{m.val}</p>
                    <p className="text-[8px] text-gray-500 uppercase">{m.label}</p>
                  </div>
                ))}
              </div>
              {/* Ingredienti */}
              {generatedRecipe.ingredients?.length > 0 && (
                <div className="p-3 border-b border-white/5">
                  <p className="text-[8px] uppercase tracking-widest text-gray-500 mb-1.5">Ingredienti</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {generatedRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-gray-300 truncate">{ing.item || ing}</span>
                        {ing.amount && <span className="text-gray-500 ml-1 flex-shrink-0">{ing.amount}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Steps */}
              {generatedRecipe.steps?.length > 0 && (
                <div className="p-3 border-b border-white/5">
                  <p className="text-[8px] uppercase tracking-widest text-gray-500 mb-1.5">Preparazione</p>
                  <ol className="space-y-1.5">
                    {generatedRecipe.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-[10px] text-gray-300 leading-snug">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold mt-0.5" style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {/* Note hack */}
              {generatedRecipe.notes && (
                <div className="p-3">
                  <p className="text-[9px] text-violet-300 leading-relaxed">💡 {generatedRecipe.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.0832 }} className="bg-black/40 border border-fuchsia-300/30 p-5 rounded-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-fuchsia-200 text-[10px] uppercase tracking-widest">Body Composition Trends (pesate)</p>
          <p className="text-[9px] uppercase text-gray-500">{bodyCompositionTrend.filter((row) => row.hasData).length}/8 metriche</p>
        </div>
        <p className="text-[10px] text-gray-300 mb-3">{bodyCompSummary.headline}</p>
        <div className="grid grid-cols-2 gap-2">
          {bodyCompositionTrend.map((row) => (
            <div key={`bc-${row.id}`} className="border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] uppercase text-gray-400">{row.label}</p>
                <p className={`text-[9px] uppercase ${row.status === 'good' ? 'text-emerald-200' : row.status === 'warn' ? 'text-amber-200' : 'text-cyan-200'}`}>
                  {row.hasData ? `${row.delta > 0 ? '+' : ''}${row.delta}${row.unit}` : '--'}
                </p>
              </div>
              <p className="text-sm font-black text-white">
                {row.hasData ? `${row.current}${row.unit}` : '--'}
              </p>
              <p className="text-[9px] text-gray-400">Avg recent: {row.hasData ? `${row.avgRecent}${row.unit}` : '--'}</p>
              <div className="mt-2 h-9 border border-white/10 bg-black/35 px-1 py-1 flex items-end gap-1">
                {row.sparkline.length ? row.sparkline.map((bar, idx) => (
                  <span key={`${row.id}-spark-${bar.date}-${idx}`} className={`flex-1 rounded-[1px] ${row.status === 'good' ? 'bg-emerald-300/85' : row.status === 'warn' ? 'bg-amber-300/85' : 'bg-cyan-300/80'}`} style={{ height: `${bar.heightPct}%` }} />
                )) : <span className="text-[8px] text-gray-500">No data</span>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.029 }} className="system-card mb-6 rounded-sm border border-indigo-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-indigo-200 mb-2">Storico Decisioni Calorie</p>
        {calorieDecisionLog.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {calorieDecisionLog.slice(0, 8).map((entry) => (
              <div key={entry.id} className="border border-white/10 bg-white/5 p-2">
                <p className="text-[10px] text-indigo-100 uppercase">
                  {entry.source} • {entry.delta > 0 ? '+' : ''}{entry.delta} kcal
                </p>
                <p className="text-[10px] text-gray-400">{entry.from} → {entry.to} • {new Date(entry.at).toLocaleString('it-IT')}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-400">Nessuna decisione calorie registrata.</p>
        )}
      </motion.div>

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.029 }} className="system-card mb-6 rounded-sm border border-rose-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-rose-200">Recovery Advanced</p>
          <span className="text-[9px] uppercase text-gray-400">Load 3d: {Math.round(recoveryLoad3d)} kcal</span>
        </div>
        <p className="text-2xl font-black text-white">{recoveryAdvancedScore}</p>
        <p className="text-[10px] text-rose-200 uppercase tracking-widest">{recoveryAdvancedLabel}</p>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="system-card mb-6 rounded-sm border border-violet-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-violet-200">Body Composition Goal</p>
          <button onClick={saveBodyCompositionGoal} className="text-[9px] px-2 py-1 border border-violet-300/40 text-violet-200 uppercase tracking-widest hover:bg-violet-300 hover:text-black">Salva Goal</button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="number" step="0.1" value={bodyGoalInput.targetWeightKg || ''} onChange={(e) => setBodyGoalInput((prev) => ({ ...prev, targetWeightKg: e.target.value }))} placeholder="Target peso kg" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={bodyGoalInput.targetFatPct || ''} onChange={(e) => setBodyGoalInput((prev) => ({ ...prev, targetFatPct: e.target.value }))} placeholder="Target body fat %" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <p className="text-[10px] text-gray-300">Attuale: {currentWeight || '--'} kg • Goal: {bodyGoal.targetWeightKg || '--'} kg • Delta: {goalDeltaKg > 0 ? '+' : ''}{goalDeltaKg || 0} kg</p>
        <p className="text-[10px] text-violet-200 uppercase mt-1">Stima tempo: {estimatedWeeksToGoal ? `${estimatedWeeksToGoal} settimane` : 'insufficiente dati trend'}</p>
        <p className="text-[10px] text-cyan-200 uppercase mt-1">ETA target: {estimatedGoalDateLabel || '--'}</p>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0305 }} className="system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">Stato Integrazioni</p>
          <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${healthSyncEnabled ? 'border-emerald-300/40 text-emerald-200' : 'border-amber-300/40 text-amber-200'}`}>
            {healthSyncBadge}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setHealthSync(!healthSyncEnabled, healthSyncEnabled ? 'manual' : (healthSyncSource === 'manual' ? 'apple_health' : healthSyncSource))}
            className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${healthSyncEnabled ? 'border-rose-300/40 text-rose-200 hover:bg-rose-300 hover:text-black' : 'border-emerald-300/40 text-emerald-200 hover:bg-emerald-300 hover:text-black'}`}
          >
            {healthSyncEnabled ? 'Passa a Manuale' : 'Attiva Sync'}
          </button>
          <button
            onClick={() => updatePlayerStats((prev) => ({ ...prev, healthSyncUpdatedAt: new Date().toISOString() }))}
            className="text-[10px] px-3 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
          >
            Ping Sync
          </button>
        </div>
        {healthSyncEnabled ? (
          <div className="grid grid-cols-1 gap-2">
            <select
              value={healthSyncSource === 'manual' ? 'apple_health' : healthSyncSource}
              onChange={(e) => setHealthSync(true, e.target.value)}
              className="bg-black/50 border border-white/10 text-white text-xs p-2"
            >
              {HEALTH_SYNC_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        <p className="mt-2 text-[9px] text-gray-400 uppercase tracking-widest">
          Ultimo update: {playerStats.healthSyncUpdatedAt ? new Date(playerStats.healthSyncUpdatedAt).toLocaleString('it-IT') : '--'}
        </p>
        <p className="mt-1 text-[9px] text-gray-500">
          Nota: la raccolta automatica device e in roadmap; al momento il tracciamento resta manuale con badge stato.
        </p>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.031 }} className="system-card mb-6 rounded-sm border border-fuchsia-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Auto Adjust (2 settimane)</p>
          <button
            onClick={() => updatePlayerStats((prev) => ({ ...prev, autoAdjustEnabled: !prev.autoAdjustEnabled }))}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${playerStats.autoAdjustEnabled ? 'border-emerald-300/40 text-emerald-200' : 'border-gray-700 text-gray-500'}`}
          >
            {playerStats.autoAdjustEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-[10px] text-gray-300">Se ON, dopo 2 settimane consecutive fuori range applica automaticamente l’aggiustamento kcal suggerito.</p>
        <p className="text-[9px] text-gray-400 uppercase mt-2">Streak settimane: {playerStats.autoAdjustMeta?.streak || 0}</p>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.032 }} className="system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-cyan-200 mb-2">Adherence Heatmap (30 giorni)</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
          {adherenceHeatmap.map((day) => (
            <div key={day.key} title={`${day.key} • score ${day.score}/3`} className={`h-3 rounded-sm border ${day.score === 3 ? 'bg-emerald-400/80 border-emerald-300' : day.score === 2 ? 'bg-cyan-300/70 border-cyan-300' : day.score === 1 ? 'bg-amber-300/60 border-amber-300' : 'bg-white/5 border-white/10'}`}></div>
          ))}
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.033 }} className="system-card mb-6 rounded-sm border border-amber-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-cyan-200 mb-2">Morning Check-in (10s)</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input type="number" min="0" max="12" step="0.1" value={morningCheckin.sleepHours} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, sleepHours: e.target.value }))} placeholder="Sleep h" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={morningCheckin.energy} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, energy: e.target.value }))} placeholder="Energy" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={morningCheckin.stress} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, stress: e.target.value }))} placeholder="Stress" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <input type="number" min="1" max="10" value={morningCheckin.sleepQuality} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, sleepQuality: e.target.value }))} placeholder="Qualita sonno" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="0" max="12" value={morningCheckin.awakenings} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, awakenings: e.target.value }))} placeholder="Risvegli" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="30" max="130" value={morningCheckin.hrRest} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, hrRest: e.target.value }))} placeholder="RHR" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="10" max="180" value={morningCheckin.hrvMs} onChange={(e) => setMorningCheckin((prev) => ({ ...prev, hrvMs: e.target.value }))} placeholder="HRV ms" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <button onClick={saveMorningCheckin} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Salva check-in</button>
          <button onClick={quickSaveMorningCheckin} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Quick 20s</button>
          <p className="text-[9px] text-gray-500 uppercase">Ultimo: {playerStats.lastMorningCheckinDate || '--'}</p>
        </div>
        <button
          onClick={toggleSkincareMorning}
          className={`mb-3 text-[10px] px-3 py-2 border uppercase tracking-widest ${
            todayData.skincareMorning ? 'border-emerald-300 text-emerald-200 bg-emerald-500/10' : 'border-white/20 text-gray-300'
          }`}
        >
          Skincare Mattina {todayData.skincareMorning ? 'OK' : 'OFF'}
        </button>
        <p className="text-[10px] uppercase tracking-widest text-amber-200 mb-2">Evening Check-in (20s)</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input type="number" min="1" max="10" value={eveningCheckin.hunger} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, hunger: e.target.value }))} placeholder="Hunger" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={eveningCheckin.craving} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, craving: e.target.value }))} placeholder="Craving" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={eveningCheckin.eveningEnergy} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, eveningEnergy: e.target.value }))} placeholder="Energia sera" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input type="number" min="1" max="10" value={eveningCheckin.stress} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, stress: e.target.value }))} placeholder="Stress" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={eveningCheckin.dayQuality} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, dayQuality: e.target.value }))} placeholder="Day quality" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={eveningCheckin.bloating} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, bloating: e.target.value }))} placeholder="Gonfiore" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="number" min="1" max="10" value={eveningCheckin.digestion} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, digestion: e.target.value }))} placeholder="Regolarita" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" min="1" max="10" value={eveningCheckin.tolerance} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, tolerance: e.target.value }))} placeholder="Tolleranza pasti" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <input type="text" value={eveningCheckin.notes} onChange={(e) => setEveningCheckin((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Nota rapida (opzionale)" className="w-full bg-black/50 border border-white/10 text-white text-xs p-2 mb-2" />
        <div className="flex items-center justify-between">
          <button onClick={saveEveningCheckin} className="text-[10px] px-3 py-2 border border-amber-300 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">Salva check-in</button>
          <button onClick={quickSaveEveningCheckin} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Quick 20s</button>
          <p className="text-[9px] text-gray-500 uppercase">Ultimo: {playerStats.lastEveningCheckinDate || '--'}</p>
        </div>
        <button
          onClick={toggleSkincareEvening}
          className={`mt-3 text-[10px] px-3 py-2 border uppercase tracking-widest ${
            todayData.skincareEvening ? 'border-emerald-300 text-emerald-200 bg-emerald-500/10' : 'border-white/20 text-gray-300'
          }`}
        >
          Skincare Sera {todayData.skincareEvening ? 'OK' : 'OFF'}
        </button>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: battlePassTierFx ? [0, -4, 0] : 0,
          x: battlePassTierFx ? [0, -2, 2, -1, 1, 0] : 0,
          scale: battlePassTierFx ? [1, 1.008, 1] : 1,
          borderColor: battlePassTierFx
            ? ['rgba(252,211,77,0.35)', 'rgba(34,211,238,0.95)', 'rgba(252,211,77,0.45)', 'rgba(252,211,77,0.35)']
            : 'rgba(252,211,77,0.35)',
          boxShadow: battlePassTierFx
            ? [
                '0 0 0 rgba(0,0,0,0)',
                '0 0 32px rgba(34,211,238,0.42), inset 0 0 22px rgba(34,211,238,0.12)',
                '0 0 14px rgba(251,191,36,0.25), inset 0 0 10px rgba(251,191,36,0.08)',
                '0 0 0 rgba(0,0,0,0)'
              ]
            : '0 0 0 rgba(0,0,0,0)'
        }}
        transition={{
          delay: 0.0335,
          duration: battlePassTierFx ? 0.62 : 0.24,
          ease: [0.2, 0.9, 0.2, 1]
        }}
        className="system-card relative mb-6 overflow-hidden rounded-sm border border-amber-300/35 bg-black/45 p-4"
      >
        {battlePassTierFx ? (
          <motion.div
            key={battlePassTierFx.timestamp}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 1, 0], scale: [0.92, 1.03, 1.08] }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.24),rgba(0,0,0,0.06),transparent_68%)]"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.08, 1.22], opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-52 w-52 rounded-full border border-cyan-300/70"
            />
            <motion.div
              initial={{ scale: 0.74, opacity: 0 }}
              animate={{ scale: [0.74, 1.03, 1.16], opacity: [0, 0.4, 0] }}
              transition={{ duration: 0.82, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-40 w-40 rounded-full border border-amber-300/60"
            />
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 14 }).map((_, idx) => (
                <motion.span
                  key={`bp-tier-spark-${idx}`}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  animate={{
                    opacity: [0, 0.95, 0],
                    x: [0, (idx % 2 === 0 ? 1 : -1) * (34 + ((idx * 8) % 36))],
                    y: [0, -20 - ((idx * 6) % 32)],
                    scale: [0.4, 1.12, 0.2]
                  }}
                  transition={{ duration: 0.68, delay: 0.04 + (idx * 0.018), ease: 'easeOut' }}
                  className="absolute left-1/2 top-[60%] h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.95)]"
                />
              ))}
            </div>
            <div className="rounded-full border border-cyan-300/65 bg-black/75 px-5 py-2 shadow-[0_0_30px_rgba(34,211,238,0.45)]">
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-100">Battle Pass Tier Up</p>
              <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.22em] text-amber-100">
                x{Number(battlePassTierFx.fromMul || 1).toFixed(2)} → x{Number(battlePassTierFx.toMul || 1).toFixed(2)}
              </p>
              <p className="mt-1 text-center text-[9px] uppercase tracking-[0.22em] text-fuchsia-100/90">
                Streak {Number(battlePassTierFx.streak || 0)}
              </p>
            </div>
          </motion.div>
        ) : null}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-200">Daily Battle Pass</p>
          <p className="text-[9px] uppercase text-gray-500">{battlePassWeekProgress}/{battlePassWeekTarget}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Streak</p>
            <p className="text-sm font-black text-amber-100">{battlePassStreakCurrent}</p>
            <p className="text-[8px] text-gray-500">Best {battlePassStreakBest}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Multiplier</p>
            <p className="text-sm font-black text-emerald-200">x{battlePassRewardMultiplier.toFixed(2)}</p>
            <p className="text-[8px] text-gray-500">Reward bonus</p>
          </div>
        </div>
        <div className="space-y-2">
          {battlePassMissions.map((mission) => (
            <div key={mission.id} className="border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] text-white">{mission.label}</p>
              <button
                onClick={() => claimBattlePassMission(mission.id)}
                disabled={!mission.done || mission.claimed}
                className={`mt-1 text-[9px] px-2 py-1 border uppercase tracking-widest ${
                  mission.claimed
                    ? 'border-emerald-300/40 text-emerald-200'
                    : mission.done
                      ? 'border-amber-300/55 text-amber-200 hover:bg-amber-300 hover:text-black'
                      : 'border-gray-700 text-gray-500'
                }`}
              >
                {mission.claimed ? 'Claimed' : mission.done ? `Claim +${Math.round(mission.reward.exp * battlePassRewardMultiplier)}EXP +${Math.round(mission.reward.gold * battlePassRewardMultiplier)}G` : 'In corso'}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <button
            onClick={claimBattlePassWeeklyChest}
            disabled={battlePassWeeklyClaimed || battlePassWeekProgress < battlePassWeekTarget}
            className={`w-full text-[10px] px-3 py-2 border uppercase tracking-widest ${
              battlePassWeeklyClaimed
                ? 'border-emerald-300/40 text-emerald-200'
                : battlePassWeekProgress >= battlePassWeekTarget
                  ? 'border-amber-300/60 text-amber-200 hover:bg-amber-300 hover:text-black'
                  : 'border-gray-700 text-gray-500'
            }`}
          >
            {battlePassWeeklyClaimed ? 'Weekly chest già preso' : battlePassWeekProgress >= battlePassWeekTarget ? 'Claim Weekly Chest' : `Serve ${battlePassWeekTarget - battlePassWeekProgress} punti`}
          </button>
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.034 }} className="system-card mb-6 rounded-sm border border-emerald-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200 mb-2">Obiettivi Settimanali</p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          <label className="text-[8px] uppercase text-gray-400">Train
            <input type="number" min="1" max="7" value={weeklyGoals.trainingDays} onChange={(e) => updateWeeklyGoal('trainingDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">H2O
            <input type="number" min="1" max="7" value={weeklyGoals.hydrationDays} onChange={(e) => updateWeeklyGoal('hydrationDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Prot
            <input type="number" min="1" max="7" value={weeklyGoals.proteinDays} onChange={(e) => updateWeeklyGoal('proteinDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Sleep
            <input type="number" min="1" max="7" value={weeklyGoals.sleepDays} onChange={(e) => updateWeeklyGoal('sleepDays', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Steps
            <input type="number" min="2000" max="20000" step="500" value={weeklyGoals.avgSteps} onChange={(e) => updateWeeklyGoal('avgSteps', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className={`border p-2 ${weeklyGoalProgress.trainingDays >= weeklyGoals.trainingDays ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}><p className="text-[10px] font-black text-white">{weeklyGoalProgress.trainingDays}/{weeklyGoals.trainingDays}</p><p className="text-[8px] text-gray-500 uppercase">Train</p></div>
          <div className={`border p-2 ${weeklyGoalProgress.hydrationDays >= weeklyGoals.hydrationDays ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}><p className="text-[10px] font-black text-white">{weeklyGoalProgress.hydrationDays}/{weeklyGoals.hydrationDays}</p><p className="text-[8px] text-gray-500 uppercase">H2O</p></div>
          <div className={`border p-2 ${weeklyGoalProgress.proteinDays >= weeklyGoals.proteinDays ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}><p className="text-[10px] font-black text-white">{weeklyGoalProgress.proteinDays}/{weeklyGoals.proteinDays}</p><p className="text-[8px] text-gray-500 uppercase">Prot</p></div>
          <div className={`border p-2 ${weeklyGoalProgress.sleepDays >= weeklyGoals.sleepDays ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}><p className="text-[10px] font-black text-white">{weeklyGoalProgress.sleepDays}/{weeklyGoals.sleepDays}</p><p className="text-[8px] text-gray-500 uppercase">Sleep</p></div>
          <div className={`border p-2 ${weeklyGoalProgress.avgSteps >= weeklyGoals.avgSteps ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}><p className="text-[10px] font-black text-white">{weeklyGoalProgress.avgSteps}</p><p className="text-[8px] text-gray-500 uppercase">Steps</p></div>
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0345 }} className="system-card mb-6 rounded-sm border border-emerald-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200">Weekly Snapshot</p>
          <div className="flex items-center gap-2">
            <button onClick={runDailyAutopilot} className="text-[10px] px-3 py-2 border border-fuchsia-300 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Daily Autopilot</button>
            <button onClick={regenerateWeeklyCoachReport} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Rigenera</button>
            <button onClick={applySundayAutoPlan} className="text-[10px] px-3 py-2 border border-amber-300 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">Apply Week Plan</button>
            <button onClick={shareWeeklySnapshot} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Condividi / Copia</button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button onClick={() => runWeeklyOneTapAction('water')} className="text-[9px] px-2 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Azione H2O</button>
          <button onClick={() => runWeeklyOneTapAction('protein')} className="text-[9px] px-2 py-2 border border-emerald-300/40 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Azione Protein</button>
          <button onClick={() => runWeeklyOneTapAction('mini_workout')} className="text-[9px] px-2 py-2 border border-fuchsia-300/40 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Azione Train</button>
        </div>
        {playerStats?.sundayAutoReport?.summary ? (
          <div className="mt-3 border border-emerald-300/30 bg-black/40 p-2">
            <p className="text-[9px] uppercase tracking-widest text-emerald-200">Report Domenica Auto</p>
            <p className="text-[10px] text-white mt-1">{playerStats.sundayAutoReport.summary}</p>
            {Number.isFinite(Number(playerStats?.sundayAutoReport?.score)) ? (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1">
                  <span>Weekly Score</span>
                  <span>{Math.round(Number(playerStats.sundayAutoReport.score || 0))}/100</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-emerald-300/30 bg-black/40">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, Number(playerStats.sundayAutoReport.score || 0)))}%` }} className="h-full bg-emerald-300" />
                </div>
              </div>
            ) : null}
            <div className="mt-1">
              {(playerStats.sundayAutoReport.focus || []).map((item) => <p key={item} className="text-[10px] text-gray-300">• {item}</p>)}
            </div>
            {(playerStats.sundayAutoReport.wins || []).length ? (
              <div className="mt-2 border border-emerald-300/25 bg-emerald-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-emerald-200">Wins</p>
                {(playerStats.sundayAutoReport.wins || []).map((item) => <p key={`win-${item}`} className="text-[10px] text-emerald-100">• {item}</p>)}
              </div>
            ) : null}
            {(playerStats.sundayAutoReport.risks || []).length ? (
              <div className="mt-2 border border-rose-300/25 bg-rose-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-rose-200">Risks</p>
                {(playerStats.sundayAutoReport.risks || []).map((item) => <p key={`risk-${item}`} className="text-[10px] text-rose-100">• {item}</p>)}
              </div>
            ) : null}
            {(playerStats.sundayAutoReport.nextWeekPlan || []).length ? (
              <div className="mt-2 border border-cyan-300/25 bg-cyan-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-cyan-200">Next Week Plan</p>
                {(playerStats.sundayAutoReport.nextWeekPlan || []).map((item) => <p key={`plan-${item}`} className="text-[10px] text-cyan-100">• {item}</p>)}
              </div>
            ) : null}
            {playerStats?.sundayAutoReport?.advanced ? (
              <div className="mt-2 border border-violet-300/25 bg-violet-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-violet-200">Advanced Signals</p>
                <p className="text-[10px] text-violet-100">WD {Number(playerStats.sundayAutoReport.advanced?.complianceByDayType?.weekday?.score || 0)}% • WE {Number(playerStats.sundayAutoReport.advanced?.complianceByDayType?.weekend?.score || 0)}%</p>
                <p className="text-[10px] text-violet-100">Hunger {Number(playerStats.sundayAutoReport.advanced?.hungerGuardrail?.hungerAvg || playerStats.sundayAutoReport.advanced?.hungerGuardrail?.hungerAvg3d || 0).toFixed(1)} • Craving {Number(playerStats.sundayAutoReport.advanced?.hungerGuardrail?.cravingAvg || playerStats.sundayAutoReport.advanced?.hungerGuardrail?.cravingAvg3d || 0).toFixed(1)}</p>
                <p className="text-[10px] text-violet-100">Hydration smart {Math.round(Number(playerStats.sundayAutoReport.advanced?.hydrationSmartTarget || 0))} ml</p>
                <p className="text-[10px] text-violet-100">Fuel delta {Number(playerStats.sundayAutoReport.advanced?.performanceFuelDelta || 0) > 0 ? '+' : ''}{Number(playerStats.sundayAutoReport.advanced?.performanceFuelDelta || 0)} ({Number(playerStats.sundayAutoReport.advanced?.performanceFuelSamples || 0)} samples)</p>
                {playerStats.sundayAutoReport.advanced?.giTop ? (
                  <p className="text-[10px] text-violet-100">GI top: {playerStats.sundayAutoReport.advanced.giTop}</p>
                ) : null}
                {playerStats.sundayAutoReport.advanced?.refeedEligible ? (
                  <p className="text-[10px] text-amber-200">Refeed smart consigliato</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03455 }} className="system-card mb-6 rounded-sm border border-indigo-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-indigo-200">Unified Timeline</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase text-gray-500">{timelineEvents.length} eventi</span>
            <button onClick={() => toggleCardCollapse('timeline')} className="text-[9px] px-2 py-1 border border-indigo-300/40 text-indigo-200 uppercase tracking-widest">{collapsedCards.timeline ? 'Expand' : 'Collapse'}</button>
          </div>
        </div>
        {!collapsedCards.timeline ? (
        <>
        <div className="mb-2 flex flex-wrap gap-2">
          {['all', 'workout', 'meal', 'water', 'skincare', 'note'].map((type) => (
            <button
              key={`tl-${type}`}
              onClick={() => setTimelineFilter(type)}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${timelineFilter === type ? 'border-indigo-300/50 text-indigo-200 bg-indigo-500/10' : 'border-white/15 text-gray-500'}`}
            >
              {type}
            </button>
          ))}
          <input
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
            placeholder="cerca..."
            className="ml-auto bg-black/50 border border-white/10 text-white text-[10px] p-1.5 w-28"
          />
        </div>
        <div className="max-h-52 overflow-y-auto space-y-2">
          {timelineEvents.length ? timelineEvents.map((entry) => (
            <div key={entry.id} className="border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white">{entry.title}</p>
                <p className="text-[9px] text-indigo-200">{entry.date}</p>
              </div>
              <p className="text-[10px] text-gray-300 mt-1">{entry.detail}</p>
            </div>
          )) : (
            <p className="text-[10px] text-gray-400">Nessun evento per i filtri correnti.</p>
          )}
        </div>
        </>
        ) : (
          <p className="text-[10px] text-gray-500">Card compressa. Premi Expand per vedere i dettagli.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0346 }} className="system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">Smart Weekly Coach</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase text-gray-500">3 mosse</span>
            <button onClick={() => toggleCardCollapse('smartCoach')} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest">{collapsedCards.smartCoach ? 'Expand' : 'Collapse'}</button>
          </div>
        </div>
        {collapsedCards.smartCoach ? (
          <p className="text-[10px] text-gray-500">Card compressa. Premi Expand per vedere il coach.</p>
        ) : smartWeeklyCoachActions.length ? (
          smartWeeklyCoachActions.map((action) => <p key={action} className="text-[10px] text-gray-200 mb-1">• {action}</p>)
        ) : (
          <p className="text-[10px] text-emerald-200">Settimana solida: mantieni piano e progressione.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03465 }} className="system-card mb-6 rounded-sm border border-amber-300/35 bg-black/45 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-amber-200">Monthly Boss Report</p>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleCardCollapse('monthlyBoss')} className="text-[9px] px-2 py-1 border border-amber-300/40 text-amber-200 uppercase tracking-widest">{collapsedCards.monthlyBoss ? 'Expand' : 'Collapse'}</button>
            <button onClick={regenerateMonthlyBossReport} className="text-[10px] px-3 py-2 border border-amber-300 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">Rigenera</button>
          </div>
        </div>
        {collapsedCards.monthlyBoss ? (
          <p className="text-[10px] text-gray-500 mt-2">Card compressa. Premi Expand per vedere il report.</p>
        ) : monthlyBossReport?.summary ? (
          <div className="mt-3 border border-amber-300/25 bg-black/40 p-2">
            <p className="text-[9px] uppercase tracking-widest text-amber-200">{monthlyBossReport.monthKey || getMonthKey()} • Boss Ledger</p>
            <p className="text-[10px] text-white mt-1">{monthlyBossReport.summary}</p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1">
                <span>Monthly Score</span>
                <span>{Math.round(Number(monthlyBossReport.score || 0))}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-amber-300/30 bg-black/40">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, Number(monthlyBossReport.score || 0)))}%` }} className="h-full bg-amber-300" />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{monthlyBossReport.metrics?.kcalAdh || 0}%</p><p className="text-[8px] uppercase text-gray-500">Kcal</p></div>
              <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{monthlyBossReport.metrics?.hydrationAdh || 0}%</p><p className="text-[8px] uppercase text-gray-500">H2O</p></div>
              <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{monthlyBossReport.metrics?.trainingDays || 0}</p><p className="text-[8px] uppercase text-gray-500">Training</p></div>
            </div>
            {(monthlyBossReport.wins || []).length ? (
              <div className="mt-2 border border-emerald-300/25 bg-emerald-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-emerald-200">Wins</p>
                {(monthlyBossReport.wins || []).map((item) => <p key={`m-win-${item}`} className="text-[10px] text-emerald-100">• {item}</p>)}
              </div>
            ) : null}
            {(monthlyBossReport.risks || []).length ? (
              <div className="mt-2 border border-rose-300/25 bg-rose-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-rose-200">Risks</p>
                {(monthlyBossReport.risks || []).map((item) => <p key={`m-risk-${item}`} className="text-[10px] text-rose-100">• {item}</p>)}
              </div>
            ) : null}
            {(monthlyBossReport.nextMonthPlan || []).length ? (
              <div className="mt-2 border border-cyan-300/25 bg-cyan-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-cyan-200">Next Month Plan</p>
                {(monthlyBossReport.nextMonthPlan || []).map((item) => <p key={`m-plan-${item}`} className="text-[10px] text-cyan-100">• {item}</p>)}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] text-gray-300 mt-2">Genera il primo Monthly Boss Report per vedere score, delta e piano mese.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03467 }} className="system-card mb-6 rounded-sm border border-emerald-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200">Daily Health Score</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-2 py-1 border border-amber-300/40 text-amber-200 uppercase tracking-widest">Reward x{rewardHealthMultiplier.toFixed(2)}</span>
            <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${dailyHealthBadge.tone}`}>{dailyHealthBadge.label}</span>
          </div>
        </div>
        <div className="flex items-end justify-between mb-2">
          <p className="text-3xl font-black text-white">{dailyHealthScore}</p>
          <p className="text-[10px] uppercase tracking-widest text-gray-500">0-100</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-emerald-300/30 bg-black/40 mb-2">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, dailyHealthScore))}%` }} className="h-full bg-emerald-300" />
        </div>
        <p className="text-[10px] text-gray-300 mb-2">
          Driver: Recovery {recoveryIntelligenceScore} • Digestive {digestiveBalanceScore} • Electrolyte {electrolyteScore}
        </p>
        <div className="border border-white/10 bg-white/5 p-2">
          <p className="text-[9px] uppercase tracking-widest text-emerald-200 mb-1">Storico 7 giorni</p>
          <div className="flex items-end gap-1 h-12">
            {healthScoreHistory7.length ? healthScoreHistory7.map((item) => (
              <div key={`hs-${item.date}`} className="flex-1 text-center">
                <div className="mx-auto w-full max-w-[18px] border border-emerald-300/30 bg-emerald-400/15" style={{ height: `${Math.max(4, Math.round(Number(item.score || 0) * 0.42))}px` }} />
                <p className="mt-1 text-[8px] text-gray-500">{String(item.date || '').slice(5)}</p>
              </div>
            )) : (
              <p className="text-[10px] text-gray-500">Storico non disponibile.</p>
            )}
          </div>
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.034675 }} className="system-card mb-6 rounded-sm border border-fuchsia-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Season Rank</p>
          <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${seasonRank.tone}`}>{seasonRank.label}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{seasonRankScore}</p><p className="text-[8px] uppercase text-gray-500">Rank Score</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{seasonHealthAvg}</p><p className="text-[8px] uppercase text-gray-500">Health Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-amber-200">{seasonMissionScore}</p><p className="text-[8px] uppercase text-gray-500">Mission Score</p></div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-fuchsia-300/30 bg-black/40 mb-1">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, seasonRankScore))}%` }} className="h-full bg-fuchsia-300" />
        </div>
        <p className="text-[10px] text-gray-300">
          {nextSeasonTier ? `Prossimo tier: ${nextSeasonTier.label} a ${nextSeasonTier.target} (${Math.max(0, nextSeasonTier.target - seasonRankScore)} punti)` : 'Tier massimo raggiunto.'}
        </p>
        <div className="mt-3 border border-white/10 bg-white/5 p-2">
          <p className="text-[9px] uppercase tracking-widest text-fuchsia-200 mb-2">Timeline Mensile</p>
          {seasonRankHistory.length ? (
            <div className="space-y-1.5">
              {seasonRankHistory.map((row, index) => {
                const prev = seasonRankHistory[index + 1];
                const hasPrev = Boolean(prev);
                const delta = hasPrev ? Number(row.score || 0) - Number(prev?.score || 0) : null;
                const deltaTone = delta > 0
                  ? 'text-emerald-200 border-emerald-300/35 bg-emerald-500/10'
                  : delta < 0
                    ? 'text-rose-200 border-rose-300/35 bg-rose-500/10'
                    : 'text-gray-200 border-white/20 bg-white/5';
                const deltaLabel = delta > 0 ? `+${delta}` : `${delta || 0}`;
                return (
                  <div key={`srh-${row.monthKey}`} className="flex items-center justify-between border border-white/10 bg-black/35 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-gray-200">{formatMonthKeyLabel(row.monthKey)}</p>
                      <p className="text-[9px] text-gray-500">Health {Number(row.healthAvg || 0)} • Mission {Number(row.missionScore || 0)}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <p className="text-[10px] font-bold text-white">{Number(row.score || 0)}</p>
                        <span className={`text-[8px] px-1.5 py-0.5 border uppercase tracking-widest ${deltaTone}`}>
                          {hasPrev ? deltaLabel : 'BASE'}
                        </span>
                      </div>
                      <p className="text-[8px] uppercase tracking-widest text-fuchsia-200">{String(row.label || 'INITIATE')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500">Nessuno storico disponibile.</p>
          )}
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03468 }} className="system-card mb-6 rounded-sm border border-sky-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-sky-200">Health Intelligence</p>
          <span className="text-[9px] uppercase tracking-widest text-gray-500">Sentinel</span>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-2">
          <label className="text-[8px] uppercase text-gray-400">K:Na min
            <input type="number" step="0.01" min="0" value={healthIntelThresholds.electrolyteMin} onChange={(e) => updateHealthThreshold('electrolyteMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Recovery min
            <input type="number" min="0" value={healthIntelThresholds.recoveryMin} onChange={(e) => updateHealthThreshold('recoveryMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Kcal stab min
            <input type="number" min="0" value={healthIntelThresholds.kcalStabilityMin} onChange={(e) => updateHealthThreshold('kcalStabilityMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Prot cons min
            <input type="number" min="0" value={healthIntelThresholds.proteinConsistencyMin} onChange={(e) => updateHealthThreshold('proteinConsistencyMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
          <label className="text-[8px] uppercase text-gray-400">Digestive min
            <input type="number" min="0" value={healthIntelThresholds.digestiveMin} onChange={(e) => updateHealthThreshold('digestiveMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Elettroliti (K:Na)</p>
            <p className="text-lg font-black text-cyan-200">{electrolyteRatio || '--'}</p>
            <p className="text-[9px] text-gray-400">Score {electrolyteScore}/100</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Recovery Intel</p>
            <p className="text-lg font-black text-emerald-200">{recoveryIntelligenceScore}</p>
            <p className="text-[9px] text-gray-400">Sleep {weeklyReview.avgSleep}h • HRV {avgHrv7d || '--'}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Kcal Stability</p>
            <p className="text-lg font-black text-amber-200">{kcalStabilityScore}</p>
            <p className="text-[9px] text-gray-400">Consistenza 7d</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[8px] uppercase text-gray-500">Digestive Balance</p>
            <p className="text-lg font-black text-violet-200">{digestiveBalanceScore}</p>
            <p className="text-[9px] text-gray-400">Bloating {avgBloating7d || '--'} • Dig {avgDigestion7d || '--'}</p>
          </div>
        </div>
        <div className="mb-2 border border-white/10 bg-white/5 p-2">
          <p className="text-[9px] uppercase tracking-widest text-sky-200 mb-1">Trend 14 giorni</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'electrolyte', label: 'K:Na', tone: 'bg-cyan-300/85' },
              { id: 'recovery', label: 'Recovery', tone: 'bg-emerald-300/85' },
              { id: 'kcalStability', label: 'Kcal', tone: 'bg-amber-300/85' },
              { id: 'digestive', label: 'Digestive', tone: 'bg-violet-300/85' }
            ].map((metric) => (
              <div key={metric.id}>
                <p className="text-[8px] uppercase text-gray-500 mb-1">{metric.label}</p>
                <div className="flex items-end gap-[2px] h-8">
                  {healthIntelSeries14.map((row, idx) => (
                    <span key={`${metric.id}-${idx}`} className={`w-1 rounded-[1px] ${metric.tone}`} style={{ height: `${Math.max(2, Math.round(Number(row?.[metric.id] || 0) * 0.28))}px` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-2 space-y-1">
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1"><span>Protein Consistency</span><span>{proteinConsistencyScore}%</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-rose-300/30 bg-black/40"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, proteinConsistencyScore))}%` }} className="h-full bg-rose-300" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1"><span>Electrolyte Score</span><span>{electrolyteScore}%</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-cyan-300/30 bg-black/40"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, electrolyteScore))}%` }} className="h-full bg-cyan-300" /></div>
          </div>
        </div>
        {healthSentinelAlerts.length ? (
          <div className="border border-rose-300/25 bg-rose-500/10 p-2">
            <p className="text-[9px] uppercase tracking-widest text-rose-200 mb-1">Sentinel Alerts</p>
            {healthSentinelAlerts.map((alert) => (
              <div key={alert.id} className="mb-2 last:mb-0">
                <p className="text-[10px] text-rose-100">• {alert.message}</p>
                <button onClick={() => runWeeklyOneTapAction(alert.actionId)} className="mt-1 text-[9px] px-2 py-1 border border-rose-300/45 text-rose-200 uppercase tracking-widest hover:bg-rose-300 hover:text-black">
                  {alert.actionLabel}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-emerald-200">Nessun alert critico: monitoraggio stabile.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0347 }} className="system-card mb-6 rounded-sm border border-rose-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-rose-200 mb-2">Trend Guard AI</p>
        {trendGuardSignals.length ? (
          trendGuardSignals.map((signal) => <p key={signal} className="text-[10px] text-rose-100 mb-1">• {signal}</p>)
        ) : (
          <p className="text-[10px] text-emerald-200">Nessun alert trend critico.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="system-card mb-6 rounded-sm border border-violet-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-violet-200">4 Week Block Program</p>
          <span className="text-[9px] text-gray-500 uppercase">{activeBlockProgram ? `Week ${blockWeek}` : 'Not Started'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {BLOCK_PROGRAMS.map((program) => (
            <button
              key={program.id}
              onClick={() => startBlockProgram(program.id)}
              className="border border-violet-300/35 bg-violet-500/10 text-violet-200 text-[10px] px-2 py-2 uppercase tracking-widest hover:bg-violet-400 hover:text-black"
            >
              {program.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mb-2">{activeBlockProgram ? `${activeBlockProgram.label} attivo • checkpoint riscattati: ${(activeBlockProgram.checkpointsClaimed || []).length}` : 'Seleziona un blocco da avviare.'}</p>
        <button onClick={claimBlockCheckpoint} disabled={!activeBlockProgram || (activeBlockProgram.checkpointsClaimed || []).includes(`W${blockWeek}`)} className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${activeBlockProgram && !(activeBlockProgram.checkpointsClaimed || []).includes(`W${blockWeek}`) ? 'border-violet-300 text-violet-200 hover:bg-violet-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
          Claim Checkpoint Settimanale
        </button>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0349 }} className="system-card mb-6 rounded-sm border border-cyan-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">Weekly Mission Engine</p>
          <button onClick={buildWeeklyMissionPack} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Regenera</button>
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1">
            <span>Completion</span>
            <span>{weeklyMissionCompletion}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-cyan-300/30 bg-black/40">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, weeklyMissionCompletion))}%` }} className="h-full bg-cyan-300" />
          </div>
        </div>
        {weeklyMissionProgress.length ? (
          <div className="space-y-2">
            {weeklyMissionProgress.map((mission) => (
              <div key={mission.id} className="border border-white/10 bg-white/5 p-2">
                <p className="text-[10px] text-white">{mission.label}</p>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-1">
                  Progress: {Math.round(Number(mission.progress || 0))} / {Math.round(Number(mission.target || 0))}
                </p>
                <div className="w-full h-1.5 bg-white/10 border border-cyan-300/20 overflow-hidden mt-1 mb-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (Number(mission.progress || 0) / Math.max(1, Number(mission.target || 0))) * 100)}%` }} className="h-full bg-cyan-300" />
                </div>
                <button
                  onClick={() => claimWeeklyMission(mission.id)}
                  disabled={mission.claimed || !mission.done}
                  className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${
                    mission.claimed
                      ? 'border-emerald-300/40 text-emerald-200'
                      : mission.done
                        ? 'border-cyan-300 text-cyan-200 hover:bg-cyan-300 hover:text-black'
                        : 'border-gray-700 text-gray-500'
                  }`}
                >
                  {mission.claimed ? 'Reward riscattata' : `Claim +${mission.reward?.exp || 0} EXP +${mission.reward?.gold || 0} G`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-300">Nessuna missione settimanale pronta.</p>
        )}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.035 }} className="system-card mb-6 rounded-sm border border-fuchsia-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Adaptive Daily Quest</p>
          <button onClick={buildAdaptiveQuest} className="text-[9px] px-2 py-1 border border-fuchsia-300/40 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Refresh</button>
        </div>
        {adaptiveQuest ? (
          <>
            <p className="text-xs text-white mb-2">{adaptiveQuest.label}</p>
            <p className="text-[10px] text-gray-400 uppercase mb-2">Progress: {Math.round(adaptiveQuestProgress)} / {Math.round(adaptiveQuest.target)}</p>
            <div className="w-full h-2 bg-white/10 border border-fuchsia-300/25 overflow-hidden mb-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (adaptiveQuestProgress / Math.max(1, adaptiveQuest.target)) * 100)}%` }} className="h-full bg-fuchsia-300" />
            </div>
            <button onClick={claimAdaptiveQuest} disabled={!adaptiveQuestDone || adaptiveQuest.claimed} className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${adaptiveQuestDone && !adaptiveQuest.claimed ? 'border-fuchsia-300 text-fuchsia-300 hover:bg-fuchsia-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
              {adaptiveQuest.claimed ? 'Reward riscattata' : `Claim +${adaptiveQuest.reward?.exp || 20} EXP +${adaptiveQuest.reward?.gold || 15} G`}
            </button>
          </>
        ) : <p className="text-xs text-gray-300">Nessuna quest adattiva pronta.</p>}
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="system-card mb-6 rounded-sm border border-amber-300/30 bg-black/45 p-4">
        <p className="text-[10px] uppercase tracking-widest text-amber-200 mb-3">Export & Data Quality</p>
        <div className="flex gap-2 mb-3">
          <button onClick={downloadCsvReport} className="flex-1 text-[10px] px-3 py-2 border border-amber-300/40 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">Export CSV</button>
          <button onClick={downloadWeeklySummary} className="flex-1 text-[10px] px-3 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Export Weekly</button>
        </div>
        {dataQualityWarnings.length > 0 ? dataQualityWarnings.map((warning) => (
          <p key={warning} className="text-[10px] text-amber-100 mb-1">• {warning}</p>
        )) : <p className="text-[10px] text-emerald-200">Nessun warning qualità dati negli ultimi 7 giorni.</p>}
      </motion.div>
      ) : null}

      {showAdvanced ? <AnimeStrip title="Hunter Collection" /> : null}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} className={`${showAdvanced ? 'hud-panel bg-black/40 border border-system-blue/30 p-5 rounded-sm mb-6' : 'hidden'}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full border-2 border-system-blue/50 bg-black/80 overflow-hidden shadow-[0_0_15px_rgba(0,242,255,0.3)] shrink-0">
            <img src={avatarImagePath} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black italic text-white">LEVEL {playerStats.level || 1}</h2>
              <p className="text-yellow-300 text-sm font-black">{playerStats.gold || 0} G</p>
            </div>
            <p className="text-[10px] text-cursed-purple uppercase tracking-widest">Shadow Hunter</p>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${expPercentage}%` }} className="h-full bg-system-blue"></motion.div>
            </div>
            <p className="text-[9px] text-system-blue mt-1 uppercase tracking-widest">Exp {Math.floor(playerStats.exp || 0)} / {expNeeded}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-xl">{playerStats.completedWorkouts || 0}</p>
            <p className="text-[8px] text-gray-500 uppercase">Workout</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-orange-300 font-black text-xl">{playerStats.streak || 0}</p>
            <p className="text-[8px] text-gray-500 uppercase">Streak</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-purple-300 font-black text-xl">{playerStats.keys || 0}</p>
            <p className="text-[8px] text-gray-500 uppercase">Keys</p>
          </div>
          <div className="bg-white/5 border border-emerald-300/30 p-2">
            <p className="text-emerald-300 font-black text-xl">{systemPowerScore}</p>
            <p className="text-[8px] text-gray-500 uppercase">Sys Power</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.03 }} className={`${showAdvanced ? 'hud-panel bg-black/40 border border-orange-400/30 p-5 rounded-sm mb-6' : 'hidden'}`}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-[10px] text-orange-300 uppercase tracking-widest">Streak Engine</p>
            <p className="text-3xl font-black text-white">{streak} giorni</p>
          </div>
          <div className="text-right">
            <p className="text-orange-300 text-sm font-black uppercase">{streakRank}</p>
            <p className="text-[9px] text-gray-500 uppercase">Shield x{shieldTokens}</p>
          </div>
        </div>
        <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {days14.map((day) => (
            <div key={day.key} className={`h-3 rounded-sm border ${day.score === 3 ? 'bg-emerald-400/80 border-emerald-300' : day.score === 2 ? 'bg-cyan-300/70 border-cyan-300' : day.score === 1 ? 'bg-yellow-300/60 border-yellow-300' : 'bg-white/5 border-white/10'}`}></div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={claimMilestoneReward} disabled={!claimableMilestone} className={`flex-1 text-[10px] px-3 py-2 border font-bold uppercase tracking-widest ${claimableMilestone ? 'border-orange-300 text-orange-300 hover:bg-orange-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
            {claimableMilestone ? `Claim Milestone ${claimableMilestone}` : 'Nessun milestone'}
          </button>
          <button onClick={buyStreakShield} className="flex-1 text-[10px] px-3 py-2 border border-cyan-300 text-cyan-300 font-bold uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
            Buy Shield (220G)
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.04 }} className={`${showAdvanced ? 'bg-black/40 border border-fuchsia-300/30 p-5 rounded-sm mb-6' : 'hidden'}`}>
        <div className="mb-6 border border-yellow-300/35 rounded-sm p-4 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.26),rgba(18,18,24,0.9)_46%),linear-gradient(135deg,rgba(16,12,6,0.9),rgba(28,20,8,0.74),rgba(16,10,4,0.92))] shadow-[0_0_28px_rgba(250,204,21,0.12)]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Cheat Meal Vault</p>
              <p className="text-xs text-amber-100/90">Compra token con oro e compensa gli sgarri quando serve.</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase text-gray-300">Token</p>
              <p className="text-2xl font-black text-yellow-200">{cheatMealTokens}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3 text-center">
            <div className="border border-yellow-300/35 bg-black/45 p-2">
              <p className="text-[8px] uppercase text-gray-400">Costo</p>
              <p className="text-sm font-black text-yellow-100">{cheatMealTokenCost}G</p>
            </div>
            <div className="border border-yellow-300/35 bg-black/45 p-2">
              <p className="text-[8px] uppercase text-gray-400">Compensazione</p>
              <p className="text-sm font-black text-amber-100">fino a {cheatMealTokenKcal} kcal</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={buyCheatMealToken} className="text-[10px] px-3 py-2 border border-yellow-300/55 text-yellow-100 uppercase tracking-widest hover:bg-yellow-300 hover:text-black">
              Buy Token
            </button>
            <button onClick={useCheatMealToken} className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${cheatMealTokens > 0 ? 'border-amber-300/65 text-amber-100 hover:bg-amber-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
              Use Today
            </button>
          </div>
        </div>
        <p className="text-fuchsia-300 text-[10px] uppercase tracking-widest mb-2">Daily Streak Quest</p>
        <p className="text-xs text-gray-300 mb-3">Completa: acqua 60% target + 180 kcal/allenamento + almeno 1 log kcal cibo.</p>
        <button onClick={claimStreakQuest} disabled={!streakQuestDone || streakQuestClaimed} className={`w-full text-[10px] px-3 py-2 border font-bold uppercase tracking-widest ${streakQuestDone && !streakQuestClaimed ? 'border-fuchsia-300 text-fuchsia-300 hover:bg-fuchsia-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
          {streakQuestClaimed ? 'Reward già riscattato' : streakQuestDone ? 'Claim +35 EXP +35G' : 'Quest incompleta'}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.041 }} className={`${showAdvanced ? 'bg-black/40 border border-emerald-300/30 p-5 rounded-sm mb-6' : 'hidden'}`}>
        <p className="text-emerald-200 text-[10px] uppercase tracking-widest mb-2">Victory Loop</p>
        <p className="text-xs text-gray-300 mb-2">Condizione: 3 giorni consecutivi con kcal/acqua/proteine in range.</p>
        <p className="text-[10px] uppercase text-gray-400 mb-3">Progress: {perfectRecent3Days}/3</p>
        <button onClick={claimVictoryLoop} disabled={!victoryLoopReady || victoryLoopClaimedToday} className={`w-full text-[10px] px-3 py-2 border font-bold uppercase tracking-widest ${victoryLoopReady && !victoryLoopClaimedToday ? 'border-emerald-300 text-emerald-200 hover:bg-emerald-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
          {victoryLoopClaimedToday ? 'Reward già riscattata oggi' : victoryLoopReady ? 'Claim +40 EXP +30G +1 Key' : 'Completa 3/3'}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.05 }} className="hud-panel bg-black/40 border border-cyan-300/30 p-5 rounded-sm mb-6">
        <p className="text-cyan-200 text-[10px] uppercase tracking-widest mb-3">Daily Quick Log</p>
        <div className="mb-3 flex justify-end">
          <button
            onMouseDown={beginHoldResetToday}
            onMouseUp={cancelHoldResetToday}
            onMouseLeave={cancelHoldResetToday}
            onTouchStart={beginHoldResetToday}
            onTouchEnd={cancelHoldResetToday}
            onTouchCancel={cancelHoldResetToday}
            className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${
              holdResetToday ? 'border-rose-200 text-rose-100 bg-rose-500/30' : 'border-rose-300/40 text-rose-200 hover:bg-rose-300 hover:text-black'
            }`}
          >
            {holdResetToday ? 'Tieni premuto...' : 'Reset Giorno (hold 1.5s)'}
          </button>
        </div>
        <div className={`mb-4 rounded-sm border border-white/10 bg-[linear-gradient(145deg,rgba(12,18,34,0.9),rgba(22,28,48,0.75),rgba(14,40,62,0.78))] p-3 ${calorieFxClassQuickLog}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => shiftQuickLogDate(1)}
              className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
            >
              ← Giorno prima
            </button>
            <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100">{quickLogDateLabel} {quickLogIsToday ? '• OGGI' : ''}</p>
            <button
              onClick={() => shiftQuickLogDate(-1)}
              disabled={quickLogDaysBack <= 0}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${quickLogDaysBack > 0 ? 'border-cyan-300/40 text-cyan-200 hover:bg-cyan-300 hover:text-black' : 'border-white/15 text-gray-500'}`}
            >
              Giorno dopo →
            </button>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.24em] text-gray-400">Kcal Engine</p>
              <p className={`text-4xl leading-none font-black ${remainingKcalQuickLog < 0 ? 'text-rose-300' : 'text-white'}`}>{Math.round(remainingKcalQuickLog)}</p>
              <p className="text-[9px] uppercase text-gray-500 mt-1">residue</p>
              <p className="text-[9px] uppercase text-cyan-300 mt-1">
                Target {Math.round(getCalorieTargetForDateKey(quickLogDateKey))} kcal
              </p>
            </div>
            <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${calorieStateToneQuickLog}`}>
              {calorieStateLabelQuickLog}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-[8px] uppercase text-gray-500">Cons.</p>
              <p className="text-sm font-black text-cyan-200">{Math.round(consumedQuickLog)}</p>
            </div>
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-[8px] uppercase text-gray-500">Budget</p>
              <p className="text-sm font-black text-white">{Math.round(budgetQuickLog)}</p>
            </div>
            <div className="border border-white/10 bg-black/30 p-2">
              <p className="text-[8px] uppercase text-gray-500">Burn</p>
              <p className="text-sm font-black text-orange-200">+{Math.round(burnForBudgetQuickLog)}</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => updatePlayerStats((prev) => ({ ...prev, useActiveBurnForBudget: false }))}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${!useActiveBurnForBudget ? 'border-cyan-300/50 text-cyan-200 bg-cyan-500/10' : 'border-white/15 text-gray-400'}`}
            >
              Budget: Workout
            </button>
            <button
              onClick={() => updatePlayerStats((prev) => ({ ...prev, useActiveBurnForBudget: true }))}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${useActiveBurnForBudget ? 'border-emerald-300/50 text-emerald-200 bg-emerald-500/10' : 'border-white/15 text-gray-400'}`}
            >
              Budget: Active
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="border border-white/10 bg-white/5 p-1.5">
              <p className="text-[8px] text-gray-500 uppercase">Workout Burn</p>
              <p className="text-[11px] font-black text-cyan-200">+{Math.round(workoutBurnQuickLog)}</p>
            </div>
            <div className="border border-white/10 bg-white/5 p-1.5">
              <p className="text-[8px] text-gray-500 uppercase">Active Burn</p>
              <p className="text-[11px] font-black text-emerald-200">+{Math.round(activeBurnQuickLog)}</p>
            </div>
            <div className="border border-white/10 bg-white/5 p-1.5">
              <p className="text-[8px] text-gray-500 uppercase">Fonte Budget</p>
              <p className="text-[11px] font-black text-white">{useActiveBurnForBudget ? 'Active' : 'Workout'}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              onClick={() => updatePlayerStats((prev) => ({ ...prev, autoMacroSyncEnabled: !autoMacroSyncEnabled }))}
              className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${autoMacroSyncEnabled ? 'border-fuchsia-300/50 text-fuchsia-200 bg-fuchsia-500/10' : 'border-white/15 text-gray-400'}`}
            >
              Macro Sync {autoMacroSyncEnabled ? 'ON' : 'OFF'}
            </button>
            <p className="text-[9px] uppercase tracking-widest text-gray-400">
              +P {macroBurnAdds.protein}g · +C {macroBurnAdds.carbs}g · +F {macroBurnAdds.fats}g
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              min="0"
              step="10"
              value={activeBurnInput}
              onChange={(e) => setActiveBurnInput(e.target.value)}
              placeholder="Active burn oggi"
              className="flex-1 bg-black/50 border border-white/10 text-white text-xs p-2"
            />
            <button
              onClick={() => {
                const value = Math.max(0, Math.round(Number(activeBurnInput || 0)));
                saveToSystemForDate(quickLogDateKey, { activeBurn: value });
                setActiveBurnInput('');
              }}
              className="text-[10px] px-3 py-2 border border-emerald-300/40 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
            >
              Save Active
            </button>
            <button
              onClick={() => setQuickWorkoutDraftOpen((prev) => !prev)}
              className={`text-[10px] px-3 py-2 border uppercase tracking-widest font-black ${quickWorkoutDraftOpen ? 'border-fuchsia-200 text-fuchsia-100 bg-fuchsia-500/25' : 'border-fuchsia-300/55 text-fuchsia-100 bg-fuchsia-500/12 hover:bg-fuchsia-300 hover:text-black'}`}
            >
              {quickWorkoutDraftOpen ? 'Chiudi WO' : '+Workout Pro'}
            </button>
          </div>
          {quickWorkoutDraftOpen ? (
            <div className="mt-2 rounded-sm border border-fuchsia-300/35 bg-fuchsia-500/10 p-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-fuchsia-100 mb-2">Workout su {quickLogDateKey}</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  value={quickWorkoutDraft.title}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titolo workout"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
                <select
                  value={quickWorkoutDraft.sportId}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, sportId: e.target.value }))}
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                >
                  {QUICK_WORKOUT_SPORTS.map((sport) => (
                    <option key={`qw-s-${sport.id}`} value={sport.id}>{sport.label}</option>
                  ))}
                </select>
                <select
                  value={quickWorkoutDraft.intensityId}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, intensityId: e.target.value }))}
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                >
                  {QUICK_WORKOUT_INTENSITY.map((lvl) => (
                    <option key={`qw-i-${lvl.id}`} value={lvl.id}>{lvl.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={quickWorkoutDraft.durationMin}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, durationMin: e.target.value }))}
                  placeholder="Durata min"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={quickWorkoutDraft.distanceKm}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, distanceKm: e.target.value }))}
                  placeholder="Distanza km"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={quickWorkoutDraft.rpe}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, rpe: e.target.value }))}
                  placeholder="RPE 1-10"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={quickWorkoutDraft.reportedKcal}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, reportedKcal: e.target.value }))}
                  placeholder="Kcal watch (opt)"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
                <input
                  value={quickWorkoutDraft.note}
                  onChange={(e) => setQuickWorkoutDraft((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Nota (opt)"
                  className="bg-black/50 border border-white/10 text-white text-[10px] p-2"
                />
              </div>
              <button
                onClick={saveQuickWorkoutOnDate}
                disabled={quickWorkoutSaving}
                className={`w-full text-[10px] px-3 py-2 border uppercase tracking-[0.16em] ${quickWorkoutSaving ? 'border-gray-700 text-gray-500 bg-black/30' : 'border-fuchsia-200/70 text-fuchsia-50 bg-fuchsia-500/25 hover:bg-fuchsia-300 hover:text-black'}`}
              >
                {quickWorkoutSaving ? 'Stima AI in corso...' : 'Salva Workout Completo'}
              </button>
            </div>
          ) : null}
          {quickWorkoutLastSaved ? (
            <p className="mt-2 text-[9px] uppercase tracking-widest text-fuchsia-200">
              Ultimo: {quickWorkoutLastSaved.title} • +{Math.round(quickWorkoutLastSaved.burnedKcal || 0)} kcal • STR +{Math.round(quickWorkoutLastSaved.strengthAdd || 0)}
            </p>
          ) : null}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[8px] uppercase text-gray-500 mb-1">
              <span>Progress</span>
              <span>{Math.round(consumedPctQuickLog)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-white/15 bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, consumedPctQuickLog)}%` }}
                className={`h-full ${consumedPctQuickLog < 85 ? 'bg-emerald-300' : consumedPctQuickLog <= 105 ? 'bg-amber-300' : 'bg-rose-300'}`}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-end mb-3">
          <div className="text-right ml-auto">
            <p className="text-cyan-300 text-xl font-black">{Math.round(quickLogData.waterMl || 0)} ml</p>
            <p className="text-[10px] text-gray-500 uppercase">Acqua ({hydrateLeftQuickLog} ml left)</p>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[250, 500, 1000].map((amount) => (
            <button
              key={`water-${amount}`}
              onClick={() => saveToSystemForDate(quickLogDateKey, { waterMl: Number(quickLogData.waterMl || 0) + amount })}
              className="text-[10px] px-2 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
            >
              +{amount} ml
            </button>
          ))}
        </div>
        <div className="w-full bg-cyan-100/10 h-2 rounded-full overflow-hidden border border-cyan-300/20 mb-4">
          <motion.div initial={{ width: 0 }} animate={{ width: `${hydratePctQuickLog}%` }} className="h-full bg-cyan-300"></motion.div>
        </div>
        <div className="premium-macro-card mb-3 rounded-sm border border-white/10 bg-[linear-gradient(145deg,rgba(10,12,20,0.82),rgba(18,26,40,0.7),rgba(16,42,56,0.62))] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-[0.22em] text-gray-400">Macro Radar</p>
            <p className="text-[8px] uppercase tracking-widest text-cyan-200">{autoMacroSyncEnabled ? 'vs target dinamico' : 'vs target base'}</p>
          </div>
          <div className="space-y-2.5">
            {macroVisuals.map((macro) => (
              <div key={macro.id} className="macro-row">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-widest">
                  <span className={`${macro.tone} font-bold`}>{macro.label}</span>
                  <span className="text-gray-300">{Math.round(macro.value)} / {Math.round(macro.goal)} {macro.unit}</span>
                </div>
                <div className="macro-track">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${macro.pct}%` }} className="macro-fill" style={{ background: macro.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="premium-macro-hud mb-3 rounded-sm border border-cyan-300/25 bg-[linear-gradient(160deg,rgba(6,12,26,0.88),rgba(10,24,38,0.72),rgba(16,14,34,0.72))] p-3 shadow-[0_0_26px_rgba(34,211,238,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-100">Macro HUD</p>
            <p className="text-[10px] font-black text-white">Score {macroRadarScore}%</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {macroRingVisuals.map((macro) => (
              <div key={`ring-${macro.id}`} className="text-center">
                <div className="premium-macro-ring mx-auto h-16 w-16 rounded-full p-[5px] macro-ring-shell" style={macro.ringStyle}>
                  <div className="h-full w-full rounded-full bg-black/85 border border-white/10 grid place-items-center">
                    <p className="text-[10px] font-black text-white">{Math.round(macro.pct)}%</p>
                  </div>
                </div>
                <p className={`mt-1 text-[9px] uppercase tracking-widest ${macro.tone}`}>{macro.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="border border-orange-300/20 bg-orange-500/10 p-1.5"><p className="text-[9px] font-black text-orange-200">{Math.round(Number(quickLogData.satFat || 0))}g</p><p className="text-[8px] text-gray-500 uppercase">Sat</p></div>
          <div className="border border-cyan-300/20 bg-cyan-500/10 p-1.5"><p className="text-[9px] font-black text-cyan-100">{Math.round(Number(quickLogData.monoFat || 0))}g</p><p className="text-[8px] text-gray-500 uppercase">Mono</p></div>
          <div className="border border-indigo-300/20 bg-indigo-500/10 p-1.5"><p className="text-[9px] font-black text-indigo-200">{Math.round(Number(quickLogData.polyFat || 0))}g</p><p className="text-[8px] text-gray-500 uppercase">Poly</p></div>
          <div className="border border-pink-300/20 bg-pink-500/10 p-1.5"><p className="text-[9px] font-black text-pink-200">{Math.round(Number(quickLogData.sugars || 0))}g</p><p className="text-[8px] text-gray-500 uppercase">Zucch</p></div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {Object.entries(MEAL_SLOT_META).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => setMealSlot(id)}
              className={`text-[10px] px-2 py-2 border uppercase tracking-widest ${mealSlot === id ? 'border-fuchsia-300 text-fuchsia-200 bg-fuchsia-500/10' : 'border-white/15 text-gray-400'}`}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <div className="mb-3 rounded-sm border border-white/10 bg-black/35 p-3">
          <p className="text-[9px] uppercase tracking-[0.22em] text-gray-400 mb-2">Meal Split ({quickLogDateKey})</p>
          <div className="space-y-2">
            {mealSplitVisual.map((entry) => (
              <div key={entry.id}>
                <div className="flex items-center justify-between text-[9px] uppercase tracking-widest">
                  <span className={`${entry.tone} font-bold`}>{entry.label}</span>
                  <span className="text-gray-300">{Math.round(entry.kcal)} kcal</span>
                </div>
                <div className="macro-track">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${entry.pct}%` }} className="macro-fill" style={{ background: entry.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-orange-200">{Math.round(Number(quickLogData.sodiumMg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">Na mg</p></div>
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-indigo-200">{Math.round(Number(quickLogData.potassiumMg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">K mg</p></div>
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-emerald-200">{Math.round(Number(quickLogData.omega3Mg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">Omega3</p></div>
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-fuchsia-200">{Number(quickLogData.waistCm || 0) || '--'}</p><p className="text-[8px] text-gray-500 uppercase">Vita cm</p></div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-cyan-200">{Math.round(Number(quickLogData.calciumMg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">Calcio mg</p></div>
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-rose-200">{Math.round(Number(quickLogData.ironMg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">Ferro mg</p></div>
          <div className="border border-white/10 bg-white/5 p-1.5"><p className="text-[9px] font-black text-emerald-200">{Math.round(Number(quickLogData.magnesiumMg || 0))}</p><p className="text-[8px] text-gray-500 uppercase">Magnesio mg</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.08 }} className="premium-oracle-card hud-panel bg-black/50 border border-purple-400/40 p-5 rounded-sm mb-6">
        <p className="text-purple-300 text-[10px] uppercase tracking-widest mb-2">Meal Templates (1 Tap)</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {MEAL_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => applyMealTemplate(template)}
              className="text-[10px] px-2 py-2 border border-purple-300/40 text-purple-200 bg-purple-500/10 uppercase tracking-widest hover:bg-purple-300 hover:text-black"
            >
              {template.label}
              <span className="block text-[9px] opacity-80">{template.kcal} kcal</span>
            </button>
          ))}
        </div>
        <p className="text-purple-300 text-[10px] uppercase tracking-widest mb-2">AI Meal Oracle</p>
        <p className="text-[10px] text-gray-400 uppercase mb-2">Scrivi o fotografa il pasto: stima kcal e macro in automatico (slot auto-detect).</p>
        <p className="text-[10px] text-gray-500 mb-2">Auto-detect dal testo se trova parole come colazione/pranzo/cena.</p>
        {currentFoodReliabilityKey ? (
          <div className={`mb-2 border px-2 py-1.5 ${currentFoodReliabilityScore !== null && currentFoodReliabilityScore < 62 ? 'border-amber-300/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
            <p className="text-[9px] uppercase tracking-widest text-gray-400">Food Reliability</p>
            <p className="text-[10px] text-white">
              {currentFoodReliabilityKey || 'n/a'} • {currentFoodReliabilityScore !== null ? `${currentFoodReliabilityScore}%` : 'nuovo alimento'}
            </p>
            {currentFoodReliabilityScore !== null && currentFoodReliabilityScore < 62 ? (
              <p className="text-[9px] text-amber-200">Modalità prudente attiva: stima AI più conservativa.</p>
            ) : null}
          </div>
        ) : null}
        <div className="mb-2 flex items-center justify-between border border-white/10 bg-white/5 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-400">Auto Assist low confidence</p>
          <button
            onClick={() => setAutoMealAssistEnabled((prev) => !prev)}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${autoMealAssistEnabled ? 'border-fuchsia-300/55 text-fuchsia-200 bg-fuchsia-500/10' : 'border-white/20 text-gray-300 bg-white/5'}`}
          >
            {autoMealAssistEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between border border-white/10 bg-white/5 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-400">Confidence Guard Hard</p>
          <button
            onClick={() => setHardMealGuardEnabled((prev) => !prev)}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${hardMealGuardEnabled ? 'border-amber-300/55 text-amber-200 bg-amber-500/10' : 'border-white/20 text-gray-300 bg-white/5'}`}
          >
            {hardMealGuardEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between border border-white/10 bg-white/5 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-widest text-gray-400">Compare Auto-Apply Best</p>
          <button
            onClick={() => setMealCompareAutoApply((prev) => !prev)}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${mealCompareAutoApply ? 'border-cyan-300/55 text-cyan-200 bg-cyan-500/10' : 'border-white/20 text-gray-300 bg-white/5'}`}
          >
            {mealCompareAutoApply ? 'ON' : 'OFF'}
          </button>
        </div>
        {currentPortionMemory?.avgGrams ? (
          <div className="mb-2 border border-cyan-300/25 bg-cyan-500/5 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-widest text-cyan-200">Portion Memory</p>
            <p className="text-[10px] text-cyan-100">Media alimento: ~{Math.round(currentPortionMemory.avgGrams)}g ({currentPortionMemory.count || 1} log)</p>
          </div>
        ) : null}
        {mealAnalysisErrorSnapshot ? (
          <div className="mb-2 border border-rose-300/30 bg-rose-500/10 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-widest text-rose-200">Ultimo errore AI</p>
            <p className="text-[10px] text-rose-100 mb-1">{mealAnalysisErrorSnapshot.detail || 'errore provider'}</p>
            <button
              onClick={retryMealAnalysisSafe}
              className="text-[9px] px-2 py-1 border border-rose-200/55 text-rose-100 uppercase tracking-widest hover:bg-rose-300 hover:text-black"
            >
              Retry Safe
            </button>
          </div>
        ) : null}
        <textarea value={oracleText} onChange={(e) => setOracleText(e.target.value)} placeholder="Es: pasta al pomodoro con parmigiano..." className="w-full bg-void-black border border-purple-900 text-white text-xs p-3 h-20 rounded-sm mb-3 focus:outline-none focus:border-purple-400" />
        {foodMemorySuggestions.length ? (
          <div className="mb-2">
            <p className="text-[9px] uppercase tracking-widest text-purple-200 mb-1">Food Memory</p>
            <div className="flex flex-wrap gap-1">
              {foodMemorySuggestions.map((suggestion) => (
                <button
                  key={`food-memory-${suggestion}`}
                  onClick={() => setOracleText(suggestion)}
                  className="text-[9px] px-2 py-1 border border-purple-300/35 text-purple-100 bg-purple-500/10 hover:bg-purple-300 hover:text-black"
                >
                  {suggestion.slice(0, 42)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex gap-2 mb-2">
          <input type="file" accept="image/*" ref={oracleImageRef} onChange={handleImageUpload} className="hidden" />
          <button onClick={() => oracleImageRef.current?.click()} className="flex-1 text-[10px] px-3 py-2 border border-purple-400 text-purple-300 uppercase tracking-widest hover:bg-purple-500 hover:text-white">
            Foto
          </button>
          <button onClick={analyzeMealWithAI} disabled={isAnalyzing} className={`flex-1 text-[10px] px-3 py-2 border uppercase tracking-widest ${isAnalyzing ? 'border-gray-700 text-gray-500' : 'border-purple-300 text-purple-200 hover:bg-purple-400 hover:text-black'}`}>
            {isAnalyzing ? 'Analisi...' : 'Analizza'}
          </button>
          <button onClick={runMealCompareMode} disabled={isAnalyzing || isComparingMeals} className={`flex-1 text-[10px] px-3 py-2 border uppercase tracking-widest ${(isAnalyzing || isComparingMeals) ? 'border-gray-700 text-gray-500' : 'border-cyan-300 text-cyan-200 hover:bg-cyan-300 hover:text-black'}`}>
            {isComparingMeals ? 'Compare...' : 'Compare'}
          </button>
        </div>
        {mealCompareDraft?.candidates?.length ? (
          <div className="mb-2 border border-cyan-300/30 bg-cyan-500/10 p-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] uppercase tracking-widest text-cyan-200">Meal Compare Mode</p>
              <button onClick={() => setMealCompareDraft(null)} className="text-[8px] px-1.5 py-0.5 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">Close</button>
            </div>
            {mealCompareDraft?.smartAutoApplyReady && mealCompareDraft?.smartAutoApplyReason ? (
              <p className="mb-2 text-[9px] text-amber-200">Auto-apply non eseguito: {mealCompareDraft.smartAutoApplyReason}</p>
            ) : null}
            <div className="space-y-2">
              {mealCompareDraft.candidates.slice(0, 2).map((candidate, idx) => (
                <div key={`compare-${candidate.modelId}-${idx}`} className="border border-white/10 bg-black/35 p-2">
                  <p className="text-[9px] uppercase text-white">{idx === 0 ? 'Best' : 'Alt'} • {candidate.modelId}</p>
                  <p className="text-[9px] text-gray-300">Score {Math.round(Number(candidate.score || 0))} • Conf {Math.round(Number(candidate.confidenceScore || 0))}% • Flags {(candidate.reviewFlags || []).length}</p>
                  <p className="text-[9px] text-cyan-200">K {Math.round(candidate.nutrients?.kcal || 0)} • P {Math.round(candidate.nutrients?.protein || 0)} • C {Math.round(candidate.nutrients?.carbs || 0)} • F {Math.round(candidate.nutrients?.fat || 0)}</p>
                  <button onClick={() => applyMealCompareCandidate(candidate)} className="mt-1 text-[9px] px-2 py-1 border border-cyan-300/55 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
                    Apply this
                  </button>
                </div>
              ))}
              {mealCompareDraft?.failures?.length ? (
                <p className="text-[9px] text-amber-200">Fallback: {mealCompareDraft.failures.map((item) => `${item.modelId} (${item.error})`).join(' • ')}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex gap-2 mb-2">
          <button
            onClick={openLastAiMealEditor}
            className="flex-1 text-[10px] px-3 py-2 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
          >
            Edit Manually
          </button>
          <button
            onClick={() => openAiMealAssistEditor()}
            className="flex-1 text-[10px] px-3 py-2 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black"
          >
            Edit Assist
          </button>
          {playerStats?.lastAiMeal?.mealSlot ? (
            <p className="flex-1 text-[9px] text-gray-400 uppercase tracking-widest self-center text-right">
              Ultimo: {MEAL_SLOT_META[playerStats.lastAiMeal.mealSlot]?.label || playerStats.lastAiMeal.mealSlot}
              {Number(playerStats?.lastAiMeal?.confidenceScore || 0) > 0 ? ` • Conf ${Math.round(Number(playerStats.lastAiMeal.confidenceScore))}%` : ''}
            </p>
          ) : null}
        </div>
        {playerStats?.lastAiMeal?.confidenceScore ? (() => {
          const lastConfidence = Number(playerStats.lastAiMeal.confidenceScore || 0);
          const confidenceBadge = getAiConfidenceBadge(lastConfidence);
          const lastFlags = Array.isArray(playerStats?.lastAiMeal?.reviewFlags)
            ? playerStats.lastAiMeal.reviewFlags
            : computeMealReviewFlags(playerStats?.lastAiMeal?.nutrients || {}, lastConfidence);
          return (
            <div className="mb-2 border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${confidenceBadge.tone}`}>
                  AI Confidence {Math.round(lastConfidence)}% • {confidenceBadge.label}
                </span>
                {lastFlags.length ? <span className="text-[9px] uppercase tracking-widest text-amber-200">{lastFlags.length} check</span> : <span className="text-[9px] uppercase tracking-widest text-emerald-200">Clean</span>}
              </div>
              {lastFlags.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {lastFlags.map((flag) => (
                    <span key={`last-flag-${flag.id}`} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${flag?.severity === 'high' ? 'border-rose-300/40 text-rose-200 bg-rose-500/10' : 'border-amber-300/40 text-amber-200 bg-amber-500/10'}`}>
                      {flag.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })() : null}
        {oracleImage && <p className="text-[10px] text-emerald-400 uppercase">Foto acquisita [OK]</p>}
        {aiMealEdit ? (
          <div className="mt-2 border border-cyan-300/35 bg-black/45 p-2">
            <p className="text-[9px] uppercase tracking-widest text-cyan-200 mb-2">
              {aiMealEditMode === 'new' ? 'Inserimento Manuale Nutrienti' : aiMealEdit?.assistMode ? 'Edit Assist Nutrienti' : 'Modifica Nutrienti Ultimo Pasto AI'}
            </p>
            <div className="mb-2 flex items-center justify-between gap-2 border border-white/10 bg-white/5 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-widest text-gray-400">Lock Edited Values</p>
              <button
                onClick={() => setAiMealEdit((prev) => ({ ...prev, lockEditedValues: !prev?.lockEditedValues }))}
                className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${aiMealEdit?.lockEditedValues ? 'border-amber-300/55 text-amber-200 bg-amber-500/10' : 'border-white/20 text-gray-300 bg-white/5'}`}
              >
                {aiMealEdit?.lockEditedValues ? 'ON' : 'OFF'}
              </button>
            </div>
            {Array.isArray(aiMealEdit?.lockedFields) && aiMealEdit.lockedFields.length ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {aiMealEdit.lockedFields.map((field) => (
                  <span key={`locked-${field}`} className="text-[8px] px-1.5 py-0.5 border border-amber-300/40 text-amber-100 bg-amber-500/10 uppercase tracking-widest">
                    lock {field}
                  </span>
                ))}
              </div>
            ) : null}
            {Array.isArray(aiMealEdit?.sourceReviewFlags) && aiMealEdit.sourceReviewFlags.length ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {aiMealEdit.sourceReviewFlags.map((flag) => (
                  <span key={`edit-flag-${flag.id}`} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${flag?.severity === 'high' ? 'border-rose-300/40 text-rose-200 bg-rose-500/10' : 'border-amber-300/40 text-amber-200 bg-amber-500/10'}`}>
                    {flag.label}
                  </span>
                ))}
              </div>
            ) : null}
            <select
              value={aiMealEdit.mealSlot}
              onChange={(e) => setAiMealEdit((prev) => ({ ...prev, mealSlot: e.target.value }))}
              className="w-full bg-black/60 border border-white/10 text-white text-xs p-2 mb-2"
            >
              {Object.entries(MEAL_SLOT_META).map(([id, meta]) => <option key={`edit-slot-${id}`} value={id}>{meta.label}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['kcal', 'Kcal'],
                ['carbs', 'Carbs g'],
                ['protein', 'Protein g'],
                ['fat', 'Fat g'],
                ['fiber', 'Fiber g'],
                ['satFat', 'Sat g'],
                ['monoFat', 'Mono g'],
                ['polyFat', 'Poly g'],
                ['sugars', 'Sugars g'],
                ['sodiumMg', 'Na mg'],
                ['potassiumMg', 'K mg'],
                ['omega3Mg', 'Omega3 mg'],
                ['calciumMg', 'Ca mg'],
                ['ironMg', 'Fe mg'],
                ['magnesiumMg', 'Mg mg']
              ].map(([key, label]) => (
                <input
                  key={`edit-${key}`}
                  type="number"
                  step={key === 'ironMg' ? '0.1' : '1'}
                  value={aiMealEdit[key]}
                  onChange={(e) => setAiMealEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={label}
                  className="bg-black/50 border border-white/10 text-white text-xs p-2"
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {aiMealEdit?.assistMode ? (
                <button onClick={applyAllMealAssistFixes} className="flex-1 text-[10px] px-3 py-2 border border-fuchsia-300 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">
                  Apply All Fixes
                </button>
              ) : null}
              <button onClick={saveAiMealEdit} className="flex-1 text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">
                Salva Edit
              </button>
              <button onClick={() => setAiMealEdit(null)} className="flex-1 text-[10px] px-3 py-2 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">
                Annulla
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 border border-white/10 bg-white/5 p-2">
          <p className="text-[10px] uppercase tracking-widest text-purple-200 mb-1">Statistiche pasti 7 giorni</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[8px] uppercase text-gray-500">Colazione</p>
              <p className="text-sm font-black text-fuchsia-200">{meal7d.breakfast}</p>
              <p className="text-[8px] text-gray-500">{meal7dTotal ? Math.round((meal7d.breakfast / meal7dTotal) * 100) : 0}%</p>
            </div>
            <div>
              <p className="text-[8px] uppercase text-gray-500">Pranzo</p>
              <p className="text-sm font-black text-cyan-200">{meal7d.lunch}</p>
              <p className="text-[8px] text-gray-500">{meal7dTotal ? Math.round((meal7d.lunch / meal7dTotal) * 100) : 0}%</p>
            </div>
            <div>
              <p className="text-[8px] uppercase text-gray-500">Cena</p>
              <p className="text-sm font-black text-emerald-200">{meal7d.dinner}</p>
              <p className="text-[8px] text-gray-500">{meal7dTotal ? Math.round((meal7d.dinner / meal7dTotal) * 100) : 0}%</p>
            </div>
          </div>
        </div>
        <div className="mt-3 border border-cyan-300/25 bg-black/35 p-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-cyan-200">Storico Pasti AI</p>
            <p className="text-[9px] uppercase text-gray-500">{aiMealsHistory.length} voci</p>
          </div>
          {aiMealsHistory.length ? (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {aiMealsHistory.slice(0, 10).map((entry) => {
                const n = normalizeAiMealNutrients(entry?.nutrients || {});
                const badge = getAiConfidenceBadge(Number(entry?.confidenceScore || 0));
                const reviewFlags = Array.isArray(entry?.reviewFlags)
                  ? entry.reviewFlags
                  : computeMealReviewFlags(n, Number(entry?.confidenceScore || 0));
                return (
                  <div key={entry.id} className="border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-white uppercase">
                        {entry.date || '--'} • {MEAL_SLOT_META[entry.mealSlot]?.label || entry.mealSlot || 'Pasto'}
                      </p>
                      <p className="text-[10px] text-cyan-200 font-black">{Math.round(n.kcal)} kcal</p>
                    </div>
                    <p className="text-[9px] text-gray-400">P {Math.round(n.protein)}g • C {Math.round(n.carbs)}g • F {Math.round(n.fat)}g • Fib {Math.round(n.fiber)}g</p>
                    {Number(entry?.confidenceScore || 0) > 0 ? (
                      <div className="mt-1">
                        <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${badge.tone}`}>
                          AI Confidence {Math.round(Number(entry.confidenceScore || 0))}% • {entry?.confidenceLabel || badge.label}
                        </span>
                      </div>
                    ) : null}
                    {reviewFlags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {reviewFlags.map((flag) => (
                          <span key={`${entry.id}-${flag.id}`} className={`text-[8px] px-1.5 py-0.5 border uppercase tracking-widest ${flag?.severity === 'high' ? 'border-rose-300/40 text-rose-200 bg-rose-500/10' : 'border-amber-300/40 text-amber-200 bg-amber-500/10'}`}>
                            {flag.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {Array.isArray(entry?.lockedFields) && entry.lockedFields.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.lockedFields.slice(0, 6).map((field) => (
                          <span key={`${entry.id}-locked-${field}`} className="text-[8px] px-1.5 py-0.5 border border-amber-300/40 text-amber-100 bg-amber-500/10 uppercase tracking-widest">
                            lock {field}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <button onClick={() => openAiMealEntryEditor(entry)} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Edit</button>
                      <button onClick={() => openAiMealAssistEditor(entry)} className="text-[9px] px-2 py-1 border border-fuchsia-300/40 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Assist</button>
                      <button onClick={() => duplicateAiMealEntry(entry)} className="text-[9px] px-2 py-1 border border-emerald-300/40 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Duplica</button>
                      <button onClick={() => deleteAiMealEntry(entry)} className="text-[9px] px-2 py-1 border border-rose-300/40 text-rose-200 uppercase tracking-widest hover:bg-rose-300 hover:text-black">Elimina</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400">Nessun pasto AI nello storico.</p>
          )}
        </div>
        <div className="mt-3 border border-amber-300/25 bg-black/35 p-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-amber-200">AI Fix History</p>
            <p className="text-[9px] uppercase text-gray-500">{mealAiFixLog.length} fix</p>
          </div>
          {mealAiFixLog.length ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {mealAiFixLog.slice(0, 8).map((row) => (
                <div key={row.id} className="border border-white/10 bg-white/5 p-1.5">
                  <p className="text-[9px] text-white uppercase">{row.date || '--'} • {row.foodKey || 'meal'} • {row.model || 'model'}</p>
                  <p className="text-[9px] text-gray-300">Flags {row.beforeFlags || 0} → {row.afterFlags || 0} • fixed {row.fixedFlags || 0}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400">Nessun fix registrato.</p>
          )}
        </div>
      </motion.div>

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.083 }} className="bg-black/40 border border-indigo-300/30 p-5 rounded-sm mb-6">
        <p className="text-indigo-200 text-[10px] uppercase tracking-widest mb-2">Electrolytes + Weekly Body Trend</p>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-orange-200">{avgSodium7d}</p><p className="text-[8px] uppercase text-gray-500">Sodio 7d mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{avgPotassium7d}</p><p className="text-[8px] uppercase text-gray-500">Potassio 7d mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{avgOmega37d}</p><p className="text-[8px] uppercase text-gray-500">Omega-3 7d mg</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center mb-2">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-sm font-black text-cyan-200">{weeklyWeightAvg || '--'}</p>
            <p className="text-[8px] uppercase text-gray-500">Peso medio 7d</p>
            <p className="text-[9px] text-gray-400">{prevWeeklyWeightAvg ? `${(weeklyWeightAvg - prevWeeklyWeightAvg) > 0 ? '+' : ''}${(weeklyWeightAvg - prevWeeklyWeightAvg).toFixed(1)} kg` : 'n/a'}</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-sm font-black text-fuchsia-200">{waistCurrent || '--'}</p>
            <p className="text-[8px] uppercase text-gray-500">Vita corrente cm</p>
            <p className="text-[9px] text-gray-400">{waistPrev ? `${(waistCurrent - waistPrev) > 0 ? '+' : ''}${(waistCurrent - waistPrev).toFixed(1)} cm` : 'n/a'}</p>
          </div>
        </div>
        <div>
          {smartNutritionAlerts.length ? smartNutritionAlerts.map((warn) => (
            <p key={warn} className="text-[10px] text-amber-200">• {warn}</p>
          )) : <p className="text-[10px] text-emerald-200">Nessun alert nutrizionale critico questa settimana.</p>}
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.0835 }} className="bg-black/40 border border-cyan-300/30 p-5 rounded-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-cyan-200 text-[10px] uppercase tracking-widest">Goal Forecast 2 / 4 / 8 settimane</p>
          <p className="text-[9px] uppercase text-gray-500">Trend model</p>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">
          Velocita attuale: peso {weightTrendPerWeek >= 0 ? '+' : ''}{weightTrendPerWeek} kg/settimana •
          vita {waistTrendPerWeek >= 0 ? '+' : ''}{waistTrendPerWeek} cm/settimana • aderenza {Math.round(adherenceTrend)}%
        </p>
        <div className="grid grid-cols-3 gap-2">
          {goalForecast.map((row) => (
            <div key={`forecast-${row.weeks}`} className="border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-[9px] uppercase tracking-widest text-cyan-200">+{row.weeks}W</p>
              <p className="text-[10px] text-white mt-1">Peso: <span className="font-black">{row.weight ?? '--'}</span></p>
              <p className="text-[10px] text-fuchsia-200">Vita: <span className="font-black">{row.waist ?? '--'}</span></p>
              <p className="text-[10px] text-emerald-200">Adh: <span className="font-black">{row.adherence}%</span></p>
            </div>
          ))}
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.084 }} className="bg-black/40 border border-emerald-300/30 p-5 rounded-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-emerald-200 text-[10px] uppercase tracking-widest">Target Micronutrienti + Semaforo</p>
          <button
            onClick={estimateMicroTargetsWithAI}
            disabled={isEstimatingMicroTargets}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
              isEstimatingMicroTargets
                ? 'border-gray-700 text-gray-500'
                : 'border-emerald-300/50 text-emerald-200 hover:bg-emerald-300 hover:text-black'
            }`}
          >
            {isEstimatingMicroTargets ? 'Stima IA...' : 'Stima IA Target'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="text-[9px] uppercase text-gray-400">Fibre min (g)
            <input type="number" min="0" value={microTargets.fiberMin} onChange={(e) => updateMicroTarget('fiberMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Sat max (g)
            <input type="number" min="0" value={microTargets.satFatMax} onChange={(e) => updateMicroTarget('satFatMax', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Zuccheri max (g)
            <input type="number" min="0" value={microTargets.sugarsMax} onChange={(e) => updateMicroTarget('sugarsMax', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Sodio max (mg)
            <input type="number" min="0" value={microTargets.sodiumMax} onChange={(e) => updateMicroTarget('sodiumMax', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Potassio min (mg)
            <input type="number" min="0" value={microTargets.potassiumMin} onChange={(e) => updateMicroTarget('potassiumMin', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[9px] uppercase text-gray-400">Omega-3 min (mg)
            <input type="number" min="0" value={microTargets.omega3Min} onChange={(e) => updateMicroTarget('omega3Min', e.target.value)} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.fiber)}`}>Fibre</p><p className="text-[9px] text-gray-400">{recent7.length ? Math.round(recent7.reduce((s, l) => s + Number(l?.fiber || 0), 0) / recent7.length) : 0} / {microTargets.fiberMin} g</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.satFat)}`}>Saturi</p><p className="text-[9px] text-gray-400">{recent7.length ? Math.round(recent7.reduce((s, l) => s + Number(l?.satFat || 0), 0) / recent7.length) : 0} / {microTargets.satFatMax} g</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.sugars)}`}>Zuccheri</p><p className="text-[9px] text-gray-400">{recent7.length ? Math.round(recent7.reduce((s, l) => s + Number(l?.sugars || 0), 0) / recent7.length) : 0} / {microTargets.sugarsMax} g</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.sodium)}`}>Sodio</p><p className="text-[9px] text-gray-400">{avgSodium7d} / {microTargets.sodiumMax} mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.potassium)}`}>Potassio</p><p className="text-[9px] text-gray-400">{avgPotassium7d} / {microTargets.potassiumMin} mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${semaforoClass(weeklySemaforo.omega3)}`}>Omega-3</p><p className="text-[9px] text-gray-400">{avgOmega37d} / {microTargets.omega3Min} mg</p></div>
        </div>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.085 }} className="bg-black/40 border border-rose-300/30 p-5 rounded-sm mb-6">
        <p className="text-rose-200 text-[10px] uppercase tracking-widest mb-2">Readiness Test (30s)</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="text-[10px] text-gray-300 uppercase">Sleep (h)
            <input type="number" min="0" max="12" step="0.1" value={readinessInput.sleepHours} onChange={(e) => setReadinessInput((prev) => ({ ...prev, sleepHours: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[10px] text-gray-300 uppercase">Energy (1-10)
            <input type="number" min="1" max="10" value={readinessInput.energy} onChange={(e) => setReadinessInput((prev) => ({ ...prev, energy: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[10px] text-gray-300 uppercase">Stress (1-10)
            <input type="number" min="1" max="10" value={readinessInput.stress} onChange={(e) => setReadinessInput((prev) => ({ ...prev, stress: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
          <label className="text-[10px] text-gray-300 uppercase">Soreness (1-10)
            <input type="number" min="1" max="10" value={readinessInput.soreness} onChange={(e) => setReadinessInput((prev) => ({ ...prev, soreness: e.target.value }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-xs p-2" />
          </label>
        </div>
        <div className={`mb-3 border p-3 ${readiness.zone === 'green' ? 'border-emerald-300/40 bg-emerald-500/10' : readiness.zone === 'yellow' ? 'border-amber-300/40 bg-amber-500/10' : 'border-rose-300/40 bg-rose-500/10'}`}>
          <p className="text-[10px] uppercase tracking-widest text-white/80">Readiness Score: {readiness.score}</p>
          <p className="text-xs text-white mt-1">Intensita consigliata: {readiness.intensity}</p>
          <p className="text-[10px] text-white/80 mt-1">{readiness.note}</p>
        </div>
        <button onClick={saveReadinessCheck} className="text-[10px] px-3 py-2 border border-rose-300 text-rose-200 uppercase tracking-widest hover:bg-rose-300 hover:text-black">
          Salva Readiness
        </button>
      </motion.div>
      ) : null}

      {showAdvanced ? (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} transition={{ delay: 0.09 }} className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-black/70 to-cyan-500/10 border border-emerald-300/35 p-5 rounded-xl mb-6 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
        <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-emerald-200 text-[10px] uppercase tracking-[0.24em] font-black">Precision Calorie Engine</p>
            <span className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 bg-cyan-400/10 uppercase tracking-widest">Smart</span>
          </div>
          <p className="text-[10px] text-gray-300 uppercase tracking-widest mb-4">BMR + attività + training volume 7 giorni</p>
          <p className={`text-[10px] uppercase tracking-widest mb-3 ${bodyCompCalorieSignal.tone}`}>
            Body Composition Signal: {bodyCompCalorieSignal.kcalAdjustment === 0 ? 'NEUTRO' : `${bodyCompCalorieSignal.kcalAdjustment > 0 ? '+' : ''}${bodyCompCalorieSignal.kcalAdjustment} kcal`}
          </p>
          {bodyCompCalorieSignal.reasons.length ? (
            <p className="text-[10px] text-gray-300 mb-3">{bodyCompCalorieSignal.reasons.join(' • ')}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input type="number" value={metabolicProfile.weightKg} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, weightKg: e.target.value }))} placeholder="Peso (kg)" className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300" />
            <input type="number" value={metabolicProfile.heightCm} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, heightCm: e.target.value }))} placeholder="Altezza (cm)" className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300" />
            <input type="number" value={metabolicProfile.age} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, age: e.target.value }))} placeholder="Età" className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300" />
            <select value={metabolicProfile.sex} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, sex: e.target.value }))} className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300">
              <option value="male">Uomo</option>
              <option value="female">Donna</option>
            </select>
            <select value={metabolicProfile.activityMode} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, activityMode: e.target.value }))} className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300">
              <option value="light">Attività Light</option>
              <option value="moderate">Attività Moderata</option>
              <option value="high">Attività Alta</option>
              <option value="athlete">Atleta</option>
            </select>
            <select value={metabolicProfile.objective} onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, objective: e.target.value }))} className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300">
              <option value="recomp">Obiettivo: Recomp</option>
              <option value="cut">Obiettivo: Cut</option>
              <option value="bulk">Obiettivo: Bulk</option>
            </select>
            <select
              value={metabolicProfile.weekendSplitMode || 'off'}
              onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, weekendSplitMode: e.target.value }))}
              className="bg-black/55 border border-white/15 rounded-md text-white text-xs p-2.5 focus:outline-none focus:border-emerald-300"
            >
              <option value="off">Weekend Split: OFF</option>
              <option value="auto">Weekend Split: AUTO by objective</option>
              <option value="custom">Weekend Split: CUSTOM</option>
            </select>
            <input
              type="number"
              min="0"
              step="25"
              value={metabolicProfile.weekendKcalDelta}
              onChange={(e) => setMetabolicProfile((prev) => ({ ...prev, weekendKcalDelta: e.target.value }))}
              placeholder="+ Kcal weekend"
              className={`bg-black/55 border rounded-md text-white text-xs p-2.5 focus:outline-none ${metabolicProfile.weekendSplitMode === 'custom' ? 'border-emerald-300/55 focus:border-emerald-300' : 'border-white/15'}`}
              disabled={metabolicProfile.weekendSplitMode !== 'custom'}
            />
          </div>
          <div className="mb-3 border border-cyan-300/20 bg-cyan-500/8 p-2">
            <p className="text-[9px] uppercase tracking-widest text-cyan-200">Step 1: scegli obiettivo • Step 2: Weekend Split AUTO • Step 3: Calcola</p>
            <p className="text-[9px] text-gray-300 mt-1">
              AUTO usa: Cut +{OBJECTIVE_WEEKEND_DELTA.cut} / Recomp +{OBJECTIVE_WEEKEND_DELTA.recomp} / Bulk +{OBJECTIVE_WEEKEND_DELTA.bulk} kcal nel weekend.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={computePrecisionCalories} className="text-[10px] px-3 py-2.5 rounded-md border border-emerald-300 text-emerald-100 uppercase tracking-widest font-bold bg-emerald-500/15 hover:bg-emerald-400 hover:text-black transition-colors">Calcola</button>
            <button onClick={applyPrecisionPlan} className="text-[10px] px-3 py-2.5 rounded-md border border-cyan-300 text-cyan-100 uppercase tracking-widest font-bold bg-cyan-500/15 hover:bg-cyan-300 hover:text-black transition-colors">Applica Target</button>
          </div>

          {metabolicResult ? (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5">
                <p className="text-white font-black text-base">{metabolicResult.targetCalories}</p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Kcal Weekday</p>
              </div>
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5">
                <p className="text-cyan-200 font-black text-[11px]">{metabolicResult.protein}P / {metabolicResult.carbs}C / {metabolicResult.fats}F</p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Macro</p>
              </div>
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5">
                <p className="text-emerald-200 font-black text-base">{metabolicResult.waterTarget} ml</p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Acqua</p>
              </div>
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5">
                <p className="text-amber-200 font-black text-base">{metabolicResult.weekendTargetCalories}</p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Kcal Weekend</p>
              </div>
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5 col-span-2">
                <p className="text-fuchsia-200 font-black text-[12px]">{metabolicResult.weeklyAverageTarget} kcal avg • Δ weekend +{metabolicResult.weekendKcalDelta || 0} • Δ weekday {metabolicResult.weekdayDelta > 0 ? '+' : ''}{metabolicResult.weekdayDelta || 0}</p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Weekly Balance</p>
              </div>
              <div className="bg-black/50 border border-white/15 rounded-md p-2.5 col-span-2">
                <p className={`font-black text-[12px] ${metabolicResult.compositionDelta > 0 ? 'text-emerald-200' : metabolicResult.compositionDelta < 0 ? 'text-amber-200' : 'text-cyan-200'}`}>
                  Body-comp delta {metabolicResult.compositionDelta > 0 ? '+' : ''}{metabolicResult.compositionDelta || 0} kcal
                </p>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Composizione corporea + trend pesate</p>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Inserisci i dati e premi Calcola per il piano personalizzato.</p>
          )}
        </div>
      </motion.div>
      ) : null}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.095 }} className="bg-black/40 border border-cyan-300/25 p-4 rounded-sm mb-6">
        <p className="text-cyan-200 text-[10px] uppercase tracking-widest mb-3">Adaptive Health Stack</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-400">Compliance Weekday</p>
            <p className="text-lg font-black text-emerald-200">{complianceByDayType.weekday.score}%</p>
            <p className="text-[9px] text-gray-400">K {complianceByDayType.weekday.kcal}% • H2O {complianceByDayType.weekday.water}% • P {complianceByDayType.weekday.protein}%</p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-400">Compliance Weekend</p>
            <p className="text-lg font-black text-amber-200">{complianceByDayType.weekend.score}%</p>
            <p className="text-[9px] text-gray-400">K {complianceByDayType.weekend.kcal}% • H2O {complianceByDayType.weekend.water}% • P {complianceByDayType.weekend.protein}%</p>
          </div>
        </div>
        <div className="border border-white/10 bg-white/5 p-2 mb-2">
          <p className="text-[9px] uppercase text-gray-400">Hunger Guardrail</p>
          <p className={`text-[10px] ${hungerGuardrail.active ? 'text-amber-200' : 'text-emerald-200'}`}>Hunger {hungerGuardrail.hungerAvg}/10 • Craving {hungerGuardrail.cravingAvg}/10</p>
          <p className="text-[10px] text-gray-300 mt-1">{hungerGuardrail.recommendation}</p>
          <button onClick={applyHungerGuardrailBoost} disabled={!hungerGuardrail.active} className={`mt-2 text-[9px] px-2 py-1 border uppercase tracking-widest ${hungerGuardrail.active ? 'border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black' : 'border-white/15 text-gray-500'}`}>Apply Guardrail</button>
        </div>
        <div className="border border-white/10 bg-white/5 p-2 mb-2">
          <p className="text-[9px] uppercase text-gray-400">Performance Nutrition Link</p>
          <p className="text-[10px] text-cyan-200">Delta forza high vs low fuel: {performanceNutritionLink.delta > 0 ? '+' : ''}{performanceNutritionLink.delta || 0}</p>
          <p className="text-[10px] text-gray-300 mt-1">{performanceNutritionLink.message}</p>
        </div>
        <div className="border border-white/10 bg-white/5 p-2 mb-2">
          <p className="text-[9px] uppercase text-gray-400">Hydration Intelligence</p>
          <p className="text-[10px] text-emerald-200">Target smart: {hydrationIntel.target} ml</p>
          <p className="text-[9px] text-gray-400 mt-1">Base {hydrationIntel.breakdown.base} • Heat +{hydrationIntel.breakdown.heat} • Na +{hydrationIntel.breakdown.sodium} • Training +{hydrationIntel.breakdown.training}</p>
          <button onClick={applyHydrationIntelligence} className="mt-2 text-[9px] px-2 py-1 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Apply Hydration</button>
        </div>
        <div className="border border-white/10 bg-white/5 p-2 mb-2">
          <p className="text-[9px] uppercase text-gray-400">Refeed Smart (cut)</p>
          <p className={`text-[10px] ${refeedSmart.eligible ? 'text-amber-200' : 'text-gray-400'}`}>{refeedSmart.reason}</p>
          <button onClick={applyRefeedSmart} disabled={!refeedSmart.eligible} className={`mt-2 text-[9px] px-2 py-1 border uppercase tracking-widest ${refeedSmart.eligible ? 'border-fuchsia-300 text-fuchsia-200 hover:bg-fuchsia-300 hover:text-black' : 'border-white/15 text-gray-500'}`}>Apply Refeed</button>
        </div>
        <div className="border border-white/10 bg-white/5 p-2">
          <p className="text-[9px] uppercase text-gray-400">GI Tolerance Tracker</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <select value={giQuickFood} onChange={(e) => setGiQuickFood(e.target.value)} className="bg-black/50 border border-white/10 text-white text-[10px] p-1.5">
              <option value="latticini">Latticini</option>
              <option value="legumi">Legumi</option>
              <option value="fritti">Fritti</option>
              <option value="glutine">Glutine</option>
              <option value="dolcificanti">Dolcificanti</option>
              <option value="altro">Altro</option>
            </select>
            <input type="number" min="1" max="10" value={giQuickSymptom} onChange={(e) => setGiQuickSymptom(e.target.value)} className="bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
            <button onClick={addGiTrackerEntry} className="text-[9px] px-2 py-1 border border-violet-300 text-violet-200 uppercase tracking-widest hover:bg-violet-300 hover:text-black">Log GI</button>
          </div>
          <p className="text-[9px] text-gray-400 mt-2">{giInsights.note}</p>
        </div>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={(e) => { e.preventDefault(); const value = parseInt(goalInput, 10); if (!Number.isNaN(value) && value > 1000) setDailyGoal(value); }} className="bg-black/40 border border-cursed-purple/30 p-5 rounded-sm">
        <p className="text-cursed-purple text-[10px] uppercase tracking-widest mb-2">Base Kcal Goal</p>
        <div className="flex gap-2">
          <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="bg-black/50 border border-white/10 text-white text-sm p-2 w-full focus:outline-none focus:border-cursed-purple" />
          <button type="submit" className="text-[10px] px-3 border border-cursed-purple text-cursed-purple uppercase">Save</button>
        </div>
      </motion.form>
    </div>
  );
};

export default SystemHub;

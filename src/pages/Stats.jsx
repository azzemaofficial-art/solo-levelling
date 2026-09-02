import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, LineChart, Line, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTH_LABEL_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MACRO_COLORS = {
  protein: '#fb7185',
  carbs: '#f59e0b',
  fats: '#60a5fa'
};

const toDateKey = (date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isWorkoutDay = (log) => toNumber(log?.burned, 0) >= 180 || toNumber(log?.strength, 0) > 0;
const safePct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
const estimateNeatScore = (steps) => Math.max(0, Math.round((toNumber(steps, 0) / 10000) * 100));

const Stats = ({ systemLogs, dailyGoal = 2400, hydrationGoal = 2800, macroGoals = { protein: 190 }, playerStats = {} }) => {
  const [timeframe, setTimeframe] = useState('daily'); // daily, weekly, monthly
  const [periodDays, setPeriodDays] = useState(90);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const logsByDateKey = useMemo(() => {
    const map = new Map();
    systemLogs.forEach((log) => {
      if (!log?.date) return;
      map.set(log.date, log);
    });
    return map;
  }, [systemLogs]);

  const getLogByDate = (date) => logsByDateKey.get(toDateKey(date)) || null;

  const recent7 = [...systemLogs].slice(-7);
  const weeklyOverview = {
    kcalAdherence: recent7.length ? Math.round((recent7.filter((log) => {
      const consumed = toNumber(log.consumed, 0);
      return consumed >= dailyGoal * 0.8 && consumed <= dailyGoal * 1.15;
    }).length / recent7.length) * 100) : 0,
    hydrationAdherence: recent7.length ? Math.round((recent7.filter((log) => toNumber(log.waterMl, 0) >= hydrationGoal * 0.8).length / recent7.length) * 100) : 0,
    proteinAdherence: recent7.length ? Math.round((recent7.filter((log) => toNumber(log.protein, 0) >= toNumber(macroGoals?.protein, 190) * 0.8).length / recent7.length) * 100) : 0,
    avgSleep: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.sleepHours, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgProtein: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.protein, 0), 0) / recent7.length) : 0,
    avgCarbs: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.carbs, 0), 0) / recent7.length) : 0,
    avgFats: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.fatMacros, 0), 0) / recent7.length) : 0,
    avgFiber: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.fiber, 0), 0) / recent7.length) : 0,
    avgSatFat: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.satFat, 0), 0) / recent7.length) : 0,
    avgMonoFat: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.monoFat, 0), 0) / recent7.length) : 0,
    avgPolyFat: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.polyFat, 0), 0) / recent7.length) : 0,
    avgSugars: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.sugars, 0), 0) / recent7.length) : 0,
    avgSodium: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.sodiumMg, 0), 0) / recent7.length) : 0,
    avgPotassium: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.potassiumMg, 0), 0) / recent7.length) : 0,
    avgOmega3: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.omega3Mg, 0), 0) / recent7.length) : 0,
    avgWaist: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.waistCm, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgCalcium: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.calciumMg, 0), 0) / recent7.length) : 0,
    avgIron: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.ironMg, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgMagnesium: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.magnesiumMg, 0), 0) / recent7.length) : 0,
    avgHrRest: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.hrRest, 0), 0) / recent7.length) : 0,
    avgHrv: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.hrvMs, 0), 0) / recent7.length) : 0,
    avgSleepQuality: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.sleepQuality, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgAwakenings: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.awakenings, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgBloating: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.bloatingLevel, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgDigestion: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.digestionRegularity, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgCraving: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.cravingLevel, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgHunger: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.hungerLevel, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgEnergy: recent7.length ? Number((recent7.reduce((sum, log) => sum + toNumber(log.energyLevel, 0), 0) / recent7.length).toFixed(1)) : 0,
    avgSteps: recent7.length ? Math.round(recent7.reduce((sum, log) => sum + toNumber(log.steps, 0), 0) / recent7.length) : 0
  };
  const qualityFlags = [
    recent7.length >= 3 && recent7.filter((log) => toNumber(log.consumed, 0) === 0).length >= 3 ? '3+ giorni a 0 kcal registrate' : null,
    recent7.some((log) => toNumber(log.waterMl, 0) > 7000) ? 'idratazione >7000 ml (outlier)' : null,
    recent7.some((log) => toNumber(log.sleepHours, 0) > 14) ? 'sonno >14h (outlier)' : null,
    recent7.length >= 3 && recent7.slice(-3).every((log) => toNumber(log.fiber, 0) < 25) ? 'fibra bassa da 3 giorni' : null,
    recent7.length >= 3 && recent7.slice(-3).every((log) => toNumber(log.satFat, 0) > 24) ? 'saturi alti da 3 giorni' : null,
    recent7.length >= 3 && recent7.slice(-3).every((log) => toNumber(log.waterMl, 0) < hydrationGoal * 0.7) ? 'acqua bassa da 3 giorni' : null
  ].filter(Boolean);

  const processData = () => {
    if (timeframe === 'daily') return systemLogs;
    if (timeframe === 'weekly') {
      const weekly = [];
      for (let i = 0; i < systemLogs.length; i += 7) {
        const chunk = systemLogs.slice(i, i + 7);
        if (!chunk.length) continue;
        const totalConsumed = chunk.reduce((sum, log) => sum + toNumber(log.consumed, 0), 0);
        const totalWater = chunk.reduce((sum, log) => sum + toNumber(log.waterMl, 0), 0);
        const avgStrength = chunk.reduce((sum, log) => sum + toNumber(log.strength, 0), 0) / chunk.length;
        const avgFat = chunk.reduce((sum, log) => sum + toNumber(log.fat, 0), 0) / chunk.length;
        const avgBodyWater = chunk.reduce((sum, log) => sum + toNumber(log.bodyWaterPct, 0), 0) / chunk.length;
        const avgMuscleMass = chunk.reduce((sum, log) => sum + toNumber(log.muscleMassKg, 0), 0) / chunk.length;
        const avgMetabolicAge = chunk.reduce((sum, log) => sum + toNumber(log.metabolicAge, 0), 0) / chunk.length;
        const avgSleep = chunk.reduce((sum, log) => sum + toNumber(log.sleepHours, 0), 0) / chunk.length;
        const avgProtein = chunk.reduce((sum, log) => sum + toNumber(log.protein, 0), 0) / chunk.length;
        const avgCarbs = chunk.reduce((sum, log) => sum + toNumber(log.carbs, 0), 0) / chunk.length;
        const avgFats = chunk.reduce((sum, log) => sum + toNumber(log.fatMacros, 0), 0) / chunk.length;
        const avgFiber = chunk.reduce((sum, log) => sum + toNumber(log.fiber, 0), 0) / chunk.length;
        const avgSodium = chunk.reduce((sum, log) => sum + toNumber(log.sodiumMg, 0), 0) / chunk.length;
        const avgPotassium = chunk.reduce((sum, log) => sum + toNumber(log.potassiumMg, 0), 0) / chunk.length;
        const avgOmega3 = chunk.reduce((sum, log) => sum + toNumber(log.omega3Mg, 0), 0) / chunk.length;
        const avgWaist = chunk.reduce((sum, log) => sum + toNumber(log.waistCm, 0), 0) / chunk.length;
        const avgCalcium = chunk.reduce((sum, log) => sum + toNumber(log.calciumMg, 0), 0) / chunk.length;
        const avgIron = chunk.reduce((sum, log) => sum + toNumber(log.ironMg, 0), 0) / chunk.length;
        const avgMagnesium = chunk.reduce((sum, log) => sum + toNumber(log.magnesiumMg, 0), 0) / chunk.length;
        const avgHrRest = chunk.reduce((sum, log) => sum + toNumber(log.hrRest, 0), 0) / chunk.length;
        const avgHrv = chunk.reduce((sum, log) => sum + toNumber(log.hrvMs, 0), 0) / chunk.length;
        const avgSleepQuality = chunk.reduce((sum, log) => sum + toNumber(log.sleepQuality, 0), 0) / chunk.length;
        const avgAwakenings = chunk.reduce((sum, log) => sum + toNumber(log.awakenings, 0), 0) / chunk.length;
        const avgBloating = chunk.reduce((sum, log) => sum + toNumber(log.bloatingLevel, 0), 0) / chunk.length;
        const avgDigestion = chunk.reduce((sum, log) => sum + toNumber(log.digestionRegularity, 0), 0) / chunk.length;
        const avgCraving = chunk.reduce((sum, log) => sum + toNumber(log.cravingLevel, 0), 0) / chunk.length;
        const avgHunger = chunk.reduce((sum, log) => sum + toNumber(log.hungerLevel, 0), 0) / chunk.length;
        const avgEnergy = chunk.reduce((sum, log) => sum + toNumber(log.energyLevel, 0), 0) / chunk.length;
        const avgSteps = chunk.reduce((sum, log) => sum + toNumber(log.steps, 0), 0) / chunk.length;
        weekly.push({
          date: `W${Math.floor(i / 7) + 1}`,
          consumed: totalConsumed,
          waterMl: totalWater,
          strength: Number(avgStrength.toFixed(1)),
          fat: Number(avgFat.toFixed(1)),
          bodyWaterPct: Number(avgBodyWater.toFixed(1)),
          muscleMassKg: Number(avgMuscleMass.toFixed(1)),
          metabolicAge: Number(avgMetabolicAge.toFixed(1)),
          sleepHours: Number(avgSleep.toFixed(1)),
          protein: Number(avgProtein.toFixed(1)),
          carbs: Number(avgCarbs.toFixed(1)),
          fatMacros: Number(avgFats.toFixed(1)),
          fiber: Number(avgFiber.toFixed(1)),
          sodiumMg: Number(avgSodium.toFixed(1)),
          potassiumMg: Number(avgPotassium.toFixed(1)),
          omega3Mg: Number(avgOmega3.toFixed(1)),
          waistCm: Number(avgWaist.toFixed(1)),
          calciumMg: Number(avgCalcium.toFixed(1)),
          ironMg: Number(avgIron.toFixed(1)),
          magnesiumMg: Number(avgMagnesium.toFixed(1)),
          hrRest: Number(avgHrRest.toFixed(1)),
          hrvMs: Number(avgHrv.toFixed(1)),
          sleepQuality: Number(avgSleepQuality.toFixed(1)),
          awakenings: Number(avgAwakenings.toFixed(1)),
          bloatingLevel: Number(avgBloating.toFixed(1)),
          digestionRegularity: Number(avgDigestion.toFixed(1)),
          cravingLevel: Number(avgCraving.toFixed(1)),
          hungerLevel: Number(avgHunger.toFixed(1)),
          energyLevel: Number(avgEnergy.toFixed(1)),
          steps: Number(avgSteps.toFixed(0))
        });
      }
      return weekly;
    }
    const monthly = [];
    for (let i = 0; i < systemLogs.length; i += 30) {
      const chunk = systemLogs.slice(i, i + 30);
      if (!chunk.length) continue;
      const totalConsumed = chunk.reduce((sum, log) => sum + toNumber(log.consumed, 0), 0);
      const totalWater = chunk.reduce((sum, log) => sum + toNumber(log.waterMl, 0), 0);
      const avgStrength = chunk.reduce((sum, log) => sum + toNumber(log.strength, 0), 0) / chunk.length;
      const avgFat = chunk.reduce((sum, log) => sum + toNumber(log.fat, 0), 0) / chunk.length;
      const avgBodyWater = chunk.reduce((sum, log) => sum + toNumber(log.bodyWaterPct, 0), 0) / chunk.length;
      const avgMuscleMass = chunk.reduce((sum, log) => sum + toNumber(log.muscleMassKg, 0), 0) / chunk.length;
      const avgMetabolicAge = chunk.reduce((sum, log) => sum + toNumber(log.metabolicAge, 0), 0) / chunk.length;
      const avgSleep = chunk.reduce((sum, log) => sum + toNumber(log.sleepHours, 0), 0) / chunk.length;
      const avgProtein = chunk.reduce((sum, log) => sum + toNumber(log.protein, 0), 0) / chunk.length;
      const avgCarbs = chunk.reduce((sum, log) => sum + toNumber(log.carbs, 0), 0) / chunk.length;
      const avgFats = chunk.reduce((sum, log) => sum + toNumber(log.fatMacros, 0), 0) / chunk.length;
      const avgFiber = chunk.reduce((sum, log) => sum + toNumber(log.fiber, 0), 0) / chunk.length;
      const avgSodium = chunk.reduce((sum, log) => sum + toNumber(log.sodiumMg, 0), 0) / chunk.length;
      const avgPotassium = chunk.reduce((sum, log) => sum + toNumber(log.potassiumMg, 0), 0) / chunk.length;
      const avgOmega3 = chunk.reduce((sum, log) => sum + toNumber(log.omega3Mg, 0), 0) / chunk.length;
      const avgWaist = chunk.reduce((sum, log) => sum + toNumber(log.waistCm, 0), 0) / chunk.length;
      const avgCalcium = chunk.reduce((sum, log) => sum + toNumber(log.calciumMg, 0), 0) / chunk.length;
      const avgIron = chunk.reduce((sum, log) => sum + toNumber(log.ironMg, 0), 0) / chunk.length;
      const avgMagnesium = chunk.reduce((sum, log) => sum + toNumber(log.magnesiumMg, 0), 0) / chunk.length;
      const avgHrRest = chunk.reduce((sum, log) => sum + toNumber(log.hrRest, 0), 0) / chunk.length;
      const avgHrv = chunk.reduce((sum, log) => sum + toNumber(log.hrvMs, 0), 0) / chunk.length;
      const avgSleepQuality = chunk.reduce((sum, log) => sum + toNumber(log.sleepQuality, 0), 0) / chunk.length;
      const avgAwakenings = chunk.reduce((sum, log) => sum + toNumber(log.awakenings, 0), 0) / chunk.length;
      const avgBloating = chunk.reduce((sum, log) => sum + toNumber(log.bloatingLevel, 0), 0) / chunk.length;
      const avgDigestion = chunk.reduce((sum, log) => sum + toNumber(log.digestionRegularity, 0), 0) / chunk.length;
      const avgCraving = chunk.reduce((sum, log) => sum + toNumber(log.cravingLevel, 0), 0) / chunk.length;
      const avgHunger = chunk.reduce((sum, log) => sum + toNumber(log.hungerLevel, 0), 0) / chunk.length;
      const avgEnergy = chunk.reduce((sum, log) => sum + toNumber(log.energyLevel, 0), 0) / chunk.length;
      const avgSteps = chunk.reduce((sum, log) => sum + toNumber(log.steps, 0), 0) / chunk.length;
      monthly.push({
        date: `M${Math.floor(i / 30) + 1}`,
        consumed: totalConsumed,
        waterMl: totalWater,
        strength: Number(avgStrength.toFixed(1)),
        fat: Number(avgFat.toFixed(1)),
        bodyWaterPct: Number(avgBodyWater.toFixed(1)),
        muscleMassKg: Number(avgMuscleMass.toFixed(1)),
        metabolicAge: Number(avgMetabolicAge.toFixed(1)),
        sleepHours: Number(avgSleep.toFixed(1)),
        protein: Number(avgProtein.toFixed(1)),
        carbs: Number(avgCarbs.toFixed(1)),
        fatMacros: Number(avgFats.toFixed(1)),
        fiber: Number(avgFiber.toFixed(1)),
        sodiumMg: Number(avgSodium.toFixed(1)),
        potassiumMg: Number(avgPotassium.toFixed(1)),
        omega3Mg: Number(avgOmega3.toFixed(1)),
        waistCm: Number(avgWaist.toFixed(1)),
        calciumMg: Number(avgCalcium.toFixed(1)),
        ironMg: Number(avgIron.toFixed(1)),
        magnesiumMg: Number(avgMagnesium.toFixed(1)),
        hrRest: Number(avgHrRest.toFixed(1)),
        hrvMs: Number(avgHrv.toFixed(1)),
        sleepQuality: Number(avgSleepQuality.toFixed(1)),
        awakenings: Number(avgAwakenings.toFixed(1)),
        bloatingLevel: Number(avgBloating.toFixed(1)),
        digestionRegularity: Number(avgDigestion.toFixed(1)),
        cravingLevel: Number(avgCraving.toFixed(1)),
        hungerLevel: Number(avgHunger.toFixed(1)),
        energyLevel: Number(avgEnergy.toFixed(1)),
        steps: Number(avgSteps.toFixed(0))
      });
    }
    return monthly;
  };

  const chartData = processData();

  const periodEntries = useMemo(() => {
    const entries = [];
    const now = new Date();
    for (let i = periodDays - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      entries.push({ date, key: toDateKey(date), log: getLogByDate(date) });
    }
    return entries;
  }, [periodDays, logsByDateKey]);

  const periodStats = useMemo(() => {
    const tracked = periodEntries.filter((entry) => entry.log);
    const workouts = tracked.filter((entry) => isWorkoutDay(entry.log)).length;
    const totalWater = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.waterMl, 0), 0);
    const totalCalories = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.consumed, 0), 0);
    const strengthLogs = tracked.map((entry) => toNumber(entry.log?.strength, 0)).filter((v) => v > 0);
    const totalProtein = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.protein, 0), 0);
    const totalCarbs = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.carbs, 0), 0);
    const totalFats = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.fatMacros, 0), 0);
    const totalFiber = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.fiber, 0), 0);
    const totalSatFat = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.satFat, 0), 0);
    const totalMonoFat = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.monoFat, 0), 0);
    const totalPolyFat = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.polyFat, 0), 0);
    const totalSugars = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.sugars, 0), 0);
    const totalSodium = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.sodiumMg, 0), 0);
    const totalPotassium = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.potassiumMg, 0), 0);
    const totalOmega3 = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.omega3Mg, 0), 0);
    const totalWaist = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.waistCm, 0), 0);
    const totalCalcium = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.calciumMg, 0), 0);
    const totalIron = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.ironMg, 0), 0);
    const totalMagnesium = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.magnesiumMg, 0), 0);
    const totalHrRest = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.hrRest, 0), 0);
    const totalHrv = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.hrvMs, 0), 0);
    const totalSleepQuality = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.sleepQuality, 0), 0);
    const totalAwakenings = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.awakenings, 0), 0);
    const totalBloating = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.bloatingLevel, 0), 0);
    const totalDigestion = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.digestionRegularity, 0), 0);
    const totalCraving = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.cravingLevel, 0), 0);
    const totalHunger = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.hungerLevel, 0), 0);
    const totalEnergy = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.energyLevel, 0), 0);
    const totalSteps = tracked.reduce((sum, entry) => sum + toNumber(entry.log?.steps, 0), 0);
    const kcalAdherenceDays = tracked.filter((entry) => {
      const consumed = toNumber(entry.log?.consumed, 0);
      return consumed >= dailyGoal * 0.8 && consumed <= dailyGoal * 1.15;
    }).length;
    const hydrationAdherenceDays = tracked.filter((entry) => toNumber(entry.log?.waterMl, 0) >= hydrationGoal * 0.8).length;
    const proteinAdherenceDays = tracked.filter((entry) => toNumber(entry.log?.protein, 0) >= toNumber(macroGoals?.protein, 190) * 0.8).length;
    const sleepAdherenceDays = tracked.filter((entry) => toNumber(entry.log?.sleepHours, 0) >= 7).length;
    const skincareMorningDone = tracked.filter((entry) => Boolean(entry.log?.skincareMorning)).length;
    const skincareEveningDone = tracked.filter((entry) => Boolean(entry.log?.skincareEvening)).length;
    return {
      trackedDays: tracked.length,
      workouts,
      totalWater,
      avgWater: tracked.length ? Math.round(totalWater / tracked.length) : 0,
      totalCalories,
      avgCalories: tracked.length ? Math.round(totalCalories / tracked.length) : 0,
      avgStrength: strengthLogs.length ? Number((strengthLogs.reduce((a, b) => a + b, 0) / strengthLogs.length).toFixed(1)) : 0,
      maxStrength: strengthLogs.length ? Math.max(...strengthLogs) : 0,
      avgProtein: tracked.length ? Math.round(totalProtein / tracked.length) : 0,
      avgCarbs: tracked.length ? Math.round(totalCarbs / tracked.length) : 0,
      avgFats: tracked.length ? Math.round(totalFats / tracked.length) : 0,
      avgFiber: tracked.length ? Math.round(totalFiber / tracked.length) : 0,
      avgSatFat: tracked.length ? Math.round(totalSatFat / tracked.length) : 0,
      avgMonoFat: tracked.length ? Math.round(totalMonoFat / tracked.length) : 0,
      avgPolyFat: tracked.length ? Math.round(totalPolyFat / tracked.length) : 0,
      avgSugars: tracked.length ? Math.round(totalSugars / tracked.length) : 0,
      avgSodium: tracked.length ? Math.round(totalSodium / tracked.length) : 0,
      avgPotassium: tracked.length ? Math.round(totalPotassium / tracked.length) : 0,
      avgOmega3: tracked.length ? Math.round(totalOmega3 / tracked.length) : 0,
      avgWaist: tracked.length ? Number((totalWaist / tracked.length).toFixed(1)) : 0,
      avgCalcium: tracked.length ? Math.round(totalCalcium / tracked.length) : 0,
      avgIron: tracked.length ? Number((totalIron / tracked.length).toFixed(1)) : 0,
      avgMagnesium: tracked.length ? Math.round(totalMagnesium / tracked.length) : 0,
      avgHrRest: tracked.length ? Math.round(totalHrRest / tracked.length) : 0,
      avgHrv: tracked.length ? Math.round(totalHrv / tracked.length) : 0,
      avgSleepQuality: tracked.length ? Number((totalSleepQuality / tracked.length).toFixed(1)) : 0,
      avgAwakenings: tracked.length ? Number((totalAwakenings / tracked.length).toFixed(1)) : 0,
      avgBloating: tracked.length ? Number((totalBloating / tracked.length).toFixed(1)) : 0,
      avgDigestion: tracked.length ? Number((totalDigestion / tracked.length).toFixed(1)) : 0,
      avgCraving: tracked.length ? Number((totalCraving / tracked.length).toFixed(1)) : 0,
      avgHunger: tracked.length ? Number((totalHunger / tracked.length).toFixed(1)) : 0,
      avgEnergy: tracked.length ? Number((totalEnergy / tracked.length).toFixed(1)) : 0,
      avgSteps: tracked.length ? Math.round(totalSteps / tracked.length) : 0,
      neatScore: tracked.length ? estimateNeatScore(totalSteps / tracked.length) : 0,
      kcalAdherencePct: safePct(kcalAdherenceDays, tracked.length),
      hydrationAdherencePct: safePct(hydrationAdherenceDays, tracked.length),
      proteinAdherencePct: safePct(proteinAdherenceDays, tracked.length),
      sleepAdherencePct: safePct(sleepAdherenceDays, tracked.length),
      skincareMorningDone,
      skincareEveningDone
    };
  }, [periodEntries, dailyGoal, hydrationGoal, macroGoals]);
  const macroTrend14 = useMemo(() => {
    return [...systemLogs].slice(-14).map((log) => ({
      date: log?.date || '--',
      protein: toNumber(log?.protein, 0),
      carbs: toNumber(log?.carbs, 0),
      fats: toNumber(log?.fatMacros, 0)
    }));
  }, [systemLogs]);
  const macroGoalBars = useMemo(() => {
    const proteinGoal = toNumber(macroGoals?.protein, 190);
    const carbsGoal = toNumber(macroGoals?.carbs, 220);
    const fatsGoal = toNumber(macroGoals?.fats, 70);
    return [
      { name: 'Prot', avg: periodStats.avgProtein, goal: proteinGoal },
      { name: 'Carb', avg: periodStats.avgCarbs, goal: carbsGoal },
      { name: 'Fat', avg: periodStats.avgFats, goal: fatsGoal }
    ];
  }, [periodStats.avgProtein, periodStats.avgCarbs, periodStats.avgFats, macroGoals]);
  const macroEnergySplit = useMemo(() => {
    const p = Math.max(0, periodStats.avgProtein * 4);
    const c = Math.max(0, periodStats.avgCarbs * 4);
    const f = Math.max(0, periodStats.avgFats * 9);
    const total = p + c + f;
    if (total <= 0) {
      return [
        { name: 'Protein', value: 0 },
        { name: 'Carbs', value: 0 },
        { name: 'Fats', value: 0 }
      ];
    }
    return [
      { name: 'Protein', value: Math.round((p / total) * 100) },
      { name: 'Carbs', value: Math.round((c / total) * 100) },
      { name: 'Fats', value: Math.round((f / total) * 100) }
    ];
  }, [periodStats.avgProtein, periodStats.avgCarbs, periodStats.avgFats]);
  const protocolMode = playerStats?.objective === 'bulk' ? 'bulk' : 'cut';
  const protocolAccent = protocolMode === 'cut' ? '#b8f34a' : '#ff9b54';
  const weightSeries = useMemo(() => recent7.map((log, index) => ({
    day: log?.date || `D${index + 1}`,
    weight: toNumber(log?.weight, 0)
  })).filter((entry) => entry.weight > 0), [recent7]);
  const latestWeight = weightSeries.length ? weightSeries[weightSeries.length - 1].weight : toNumber(playerStats?.currentWeightKg, 0);
  const firstWeight = weightSeries.length ? weightSeries[0].weight : latestWeight;
  const weightDelta = latestWeight && firstWeight ? Number((latestWeight - firstWeight).toFixed(1)) : 0;

  const calendarData = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const log = getLogByDate(date);
      cells.push({ day, date, log, workout: isWorkoutDay(log) });
    }
    return {
      label: `${MONTH_LABEL_IT[month]} ${year}`,
      cells
    };
  }, [monthCursor, logsByDateKey]);

  const monthStrengthStats = useMemo(() => {
    const monthLogs = calendarData.cells.filter(Boolean).map((cell) => cell.log).filter(Boolean);
    const strengths = monthLogs.map((log) => toNumber(log.strength, 0)).filter((v) => v > 0);
    return {
      avg: strengths.length ? Number((strengths.reduce((a, b) => a + b, 0) / strengths.length).toFixed(1)) : 0,
      max: strengths.length ? Math.max(...strengths) : 0,
      workouts: monthLogs.filter((log) => isWorkoutDay(log)).length
    };
  }, [calendarData]);

  const totalWorkoutAllTime = useMemo(() => systemLogs.filter((log) => isWorkoutDay(log)).length, [systemLogs]);

  const customTooltipStyle = {
    backgroundColor: '#050505',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    fontFamily: 'Rajdhani'
  };

  return (
    <div className="p-6 pt-10 pb-24 min-h-full">
      <div className="mb-8">
        <p className="text-gray-500 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Hunt Logs</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">STATISTICS</h1>
      </div>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border p-4" style={{ borderColor: `${protocolAccent}55`, background: `linear-gradient(145deg, ${protocolMode === 'cut' ? 'rgba(184,243,74,0.09)' : 'rgba(255,155,84,0.09)'}, rgba(0,0,0,0.35))` }}>
        <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[0.3em] font-bold" style={{ color: protocolAccent }}>Protocol snapshot</p><p className="mt-1 text-sm font-black uppercase text-white">{protocolMode} · trend 7 giorni</p></div><p className="text-xl font-black" style={{ color: protocolAccent }}>{latestWeight || '--'}<span className="ml-1 text-[9px]">kg</span></p></div>
        <div className="h-20 w-full">
          {weightSeries.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={weightSeries}><Line type="monotone" dataKey="weight" stroke={protocolAccent} strokeWidth={2.5} dot={false} isAnimationActive={false} /><XAxis dataKey="day" hide /><Tooltip contentStyle={customTooltipStyle} formatter={(value) => [`${value} kg`, 'Peso']} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-[9px] uppercase tracking-widest text-gray-500">Servono almeno 2 pesate per il trend</div>}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center"><div className="rounded-lg border border-white/10 bg-white/[0.03] py-1.5"><p className="text-[8px] text-gray-500">Δ peso</p><p className="text-[11px] font-black" style={{ color: weightDelta <= 0 && protocolMode === 'cut' ? protocolAccent : '#fff' }}>{weightDelta > 0 ? '+' : ''}{weightDelta || '--'} kg</p></div><div className="rounded-lg border border-white/10 bg-white/[0.03] py-1.5"><p className="text-[8px] text-gray-500">Kcal</p><p className="text-[11px] font-black text-white">{periodStats.kcalAdherencePct}%</p></div><div className="rounded-lg border border-white/10 bg-white/[0.03] py-1.5"><p className="text-[8px] text-gray-500">Prot</p><p className="text-[11px] font-black text-white">{periodStats.proteinAdherencePct}%</p></div><div className="rounded-lg border border-white/10 bg-white/[0.03] py-1.5"><p className="text-[8px] text-gray-500">Fibra</p><p className="text-[11px] font-black text-white">{periodStats.avgFiber}g</p></div></div>
      </motion.section>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-sm border border-fuchsia-300/30 bg-black/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200">Periodo Selezionato</p>
          <div className="flex gap-1">
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
                  periodDays === days ? 'border-fuchsia-300 text-fuchsia-200 bg-fuchsia-500/10' : 'border-white/15 text-gray-500'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{periodStats.workouts}</p><p className="text-[8px] uppercase text-gray-500">Workout Periodo</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{periodStats.avgWater} ml</p><p className="text-[8px] uppercase text-gray-500">Acqua Media</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-amber-200">{periodStats.avgCalories}</p><p className="text-[8px] uppercase text-gray-500">Kcal Medie</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-violet-200">{periodStats.avgStrength || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Media</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-emerald-200">{periodStats.skincareMorningDone}</p><p className="text-[8px] uppercase text-gray-500">Skincare Mattina</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-emerald-200">{periodStats.skincareEveningDone}</p><p className="text-[8px] uppercase text-gray-500">Skincare Sera</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{periodStats.avgProtein}g</p><p className="text-[8px] uppercase text-gray-500">Prot</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-amber-200">{periodStats.avgCarbs}g</p><p className="text-[8px] uppercase text-gray-500">Carb</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-yellow-100">{periodStats.avgFats}g</p><p className="text-[8px] uppercase text-gray-500">Fat</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-lime-200">{periodStats.avgFiber}g</p><p className="text-[8px] uppercase text-gray-500">Fibre</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-orange-200">{periodStats.avgSatFat}g</p><p className="text-[8px] uppercase text-gray-500">Sat</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-100">{periodStats.avgMonoFat}g</p><p className="text-[8px] uppercase text-gray-500">Mono</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{periodStats.avgPolyFat}g</p><p className="text-[8px] uppercase text-gray-500">Poly</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-pink-200">{periodStats.avgSugars}g</p><p className="text-[8px] uppercase text-gray-500">Zucch</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-orange-200">{periodStats.avgSodium}</p><p className="text-[8px] uppercase text-gray-500">Na mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{periodStats.avgPotassium}</p><p className="text-[8px] uppercase text-gray-500">K mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{periodStats.avgOmega3}</p><p className="text-[8px] uppercase text-gray-500">Omega3 mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-fuchsia-200">{periodStats.avgWaist || '--'}</p><p className="text-[8px] uppercase text-gray-500">Vita cm</p></div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{periodStats.avgCalcium}</p><p className="text-[8px] uppercase text-gray-500">Calcio mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{periodStats.avgIron}</p><p className="text-[8px] uppercase text-gray-500">Ferro mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{periodStats.avgMagnesium}</p><p className="text-[8px] uppercase text-gray-500">Magnesio mg</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-100">{periodStats.avgHrRest || '--'}</p><p className="text-[8px] uppercase text-gray-500">RHR</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{periodStats.avgHrv || '--'}</p><p className="text-[8px] uppercase text-gray-500">HRV ms</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-violet-200">{periodStats.avgSleepQuality || '--'}</p><p className="text-[8px] uppercase text-gray-500">Sleep Q</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-amber-200">{periodStats.avgAwakenings || 0}</p><p className="text-[8px] uppercase text-gray-500">Risvegli</p></div>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{periodStats.avgSteps}</p><p className="text-[8px] uppercase text-gray-500">Steps</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{periodStats.neatScore}%</p><p className="text-[8px] uppercase text-gray-500">NEAT</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-amber-200">{periodStats.avgBloating || '--'}</p><p className="text-[8px] uppercase text-gray-500">Gonfiore</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{periodStats.avgDigestion || '--'}</p><p className="text-[8px] uppercase text-gray-500">Digestione</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{periodStats.avgCraving || '--'}</p><p className="text-[8px] uppercase text-gray-500">Craving</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{periodStats.avgHunger || '--'}</p><p className="text-[8px] uppercase text-gray-500">Fame</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{periodStats.avgEnergy || '--'}</p><p className="text-[8px] uppercase text-gray-500">Energia</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{periodStats.kcalAdherencePct}%</p><p className="text-[8px] uppercase text-gray-500">Aderenza Kcal</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{Math.round((periodStats.kcalAdherencePct + periodStats.hydrationAdherencePct + periodStats.proteinAdherencePct + periodStats.sleepAdherencePct) / 4)}%</p><p className="text-[8px] uppercase text-gray-500">Aderenza Piano</p></div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-cyan-200">{periodStats.hydrationAdherencePct}%</p><p className="text-[8px] uppercase text-gray-500">Acqua</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-fuchsia-200">{periodStats.proteinAdherencePct}%</p><p className="text-[8px] uppercase text-gray-500">Proteine</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-indigo-200">{periodStats.sleepAdherencePct}%</p><p className="text-[8px] uppercase text-gray-500">Sonno</p></div>
        </div>
        <p className="mt-3 text-[10px] text-gray-400 uppercase">Workout totali all-time: {toNumber(playerStats.completedWorkouts, totalWorkoutAllTime) || totalWorkoutAllTime}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="mb-6 rounded-sm border border-fuchsia-300/35 bg-black/40 p-4 overflow-hidden relative">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl"></div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200 mb-3">Macro Command Center</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-white/10 bg-black/35 p-2">
              <p className="text-[9px] uppercase text-gray-400 mb-1">Distribuzione Energia</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={macroEnergySplit} dataKey="value" nameKey="name" innerRadius={34} outerRadius={56} paddingAngle={3}>
                      {macroEnergySplit.map((entry) => (
                        <Cell key={entry.name} fill={entry.name === 'Protein' ? MACRO_COLORS.protein : entry.name === 'Carbs' ? MACRO_COLORS.carbs : MACRO_COLORS.fats} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center mt-1">
                <p className="text-[9px] text-rose-200">P {macroEnergySplit[0]?.value || 0}%</p>
                <p className="text-[9px] text-amber-200">C {macroEnergySplit[1]?.value || 0}%</p>
                <p className="text-[9px] text-cyan-200">F {macroEnergySplit[2]?.value || 0}%</p>
              </div>
            </div>
            <div className="border border-white/10 bg-black/35 p-2">
              <p className="text-[9px] uppercase text-gray-400 mb-1">Media vs Goal</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={macroGoalBars}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Bar dataKey="avg" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="goal" fill="#334155" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-3 border border-white/10 bg-black/30 p-2">
            <p className="text-[9px] uppercase text-gray-400 mb-1">Macro Trend Ultimi 14 Giorni</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={macroTrend14}>
                  <defs>
                    <linearGradient id="macroProt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={MACRO_COLORS.protein} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={MACRO_COLORS.protein} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="macroCarb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={MACRO_COLORS.carbs} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={MACRO_COLORS.carbs} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="macroFat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={MACRO_COLORS.fats} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={MACRO_COLORS.fats} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Area type="monotone" dataKey="protein" stroke={MACRO_COLORS.protein} fill="url(#macroProt)" strokeWidth={2} />
                  <Area type="monotone" dataKey="carbs" stroke={MACRO_COLORS.carbs} fill="url(#macroCarb)" strokeWidth={2} />
                  <Area type="monotone" dataKey="fats" stroke={MACRO_COLORS.fats} fill="url(#macroFat)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="mb-6 rounded-sm border border-cyan-300/30 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">Prev</button>
          <p className="text-[10px] uppercase tracking-widest text-cyan-200">{calendarData.label}</p>
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">Next</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_SHORT.map((day) => <p key={day} className="text-[9px] text-gray-500 uppercase text-center">{day}</p>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarData.cells.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} className="h-16 border border-transparent"></div>;
            const kcal = toNumber(cell.log?.consumed, 0);
            const water = toNumber(cell.log?.waterMl, 0);
            const strength = toNumber(cell.log?.strength, 0);
            return (
              <div key={cell.day} className={`h-16 border p-1 ${cell.workout ? 'border-fuchsia-300/60 bg-fuchsia-500/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-white">{cell.day}</p>
                  {cell.workout ? <span className="text-[8px] text-fuchsia-200">W</span> : null}
                </div>
                <p className="text-[8px] text-cyan-200 leading-tight">{kcal > 0 ? `${kcal}k` : '--'}</p>
                <p className="text-[8px] text-emerald-200 leading-tight">{water > 0 ? `${Math.round(water / 100) / 10}L` : '--'}</p>
                <p className="text-[8px] text-violet-200 leading-tight">{strength > 0 ? `S${strength}` : '--'}</p>
                <div className="mt-[1px] flex gap-[2px]">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cell.log?.skincareMorning ? 'bg-emerald-300' : 'bg-white/20'}`} title="Skincare mattina"></span>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cell.log?.skincareEvening ? 'bg-cyan-300' : 'bg-white/20'}`} title="Skincare sera"></span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{monthStrengthStats.workouts}</p><p className="text-[8px] uppercase text-gray-500">Workout Mese</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-violet-200">{monthStrengthStats.avg || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Media Mese</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-fuchsia-200">{monthStrengthStats.max || '--'}</p><p className="text-[8px] uppercase text-gray-500">Forza Max Mese</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-sm border border-emerald-300/25 bg-black/30 p-4">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200 mb-2">Weekly Overview</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-white">{weeklyOverview.kcalAdherence}%</p><p className="text-[8px] uppercase text-gray-500">Kcal</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-cyan-200">{weeklyOverview.hydrationAdherence}%</p><p className="text-[8px] uppercase text-gray-500">Hydration</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-fuchsia-200">{weeklyOverview.proteinAdherence}%</p><p className="text-[8px] uppercase text-gray-500">Protein</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-lg font-black text-indigo-200">{weeklyOverview.avgSleep}h</p><p className="text-[8px] uppercase text-gray-500">Sleep</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{weeklyOverview.avgProtein}g</p><p className="text-[8px] uppercase text-gray-500">Prot Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-amber-200">{weeklyOverview.avgCarbs}g</p><p className="text-[8px] uppercase text-gray-500">Carb Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-yellow-100">{weeklyOverview.avgFats}g</p><p className="text-[8px] uppercase text-gray-500">Fat Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-lime-200">{weeklyOverview.avgFiber}g</p><p className="text-[8px] uppercase text-gray-500">Fibre Avg</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-orange-200">{weeklyOverview.avgSatFat}g</p><p className="text-[8px] uppercase text-gray-500">Sat Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-100">{weeklyOverview.avgMonoFat}g</p><p className="text-[8px] uppercase text-gray-500">Mono Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{weeklyOverview.avgPolyFat}g</p><p className="text-[8px] uppercase text-gray-500">Poly Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-pink-200">{weeklyOverview.avgSugars}g</p><p className="text-[8px] uppercase text-gray-500">Zucch Avg</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-orange-200">{weeklyOverview.avgSodium}</p><p className="text-[8px] uppercase text-gray-500">Na Avg mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{weeklyOverview.avgPotassium}</p><p className="text-[8px] uppercase text-gray-500">K Avg mg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{weeklyOverview.avgOmega3}</p><p className="text-[8px] uppercase text-gray-500">Omega3 Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-fuchsia-200">{weeklyOverview.avgWaist || '--'}</p><p className="text-[8px] uppercase text-gray-500">Vita Avg cm</p></div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{weeklyOverview.avgCalcium}</p><p className="text-[8px] uppercase text-gray-500">Ca Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-rose-200">{weeklyOverview.avgIron}</p><p className="text-[8px] uppercase text-gray-500">Fe Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{weeklyOverview.avgMagnesium}</p><p className="text-[8px] uppercase text-gray-500">Mg Avg</p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-100">{weeklyOverview.avgHrRest || '--'}</p><p className="text-[8px] uppercase text-gray-500">RHR Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-indigo-200">{weeklyOverview.avgHrv || '--'}</p><p className="text-[8px] uppercase text-gray-500">HRV Avg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-violet-200">{weeklyOverview.avgSleepQuality || '--'}</p><p className="text-[8px] uppercase text-gray-500">Sleep Q</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-amber-200">{weeklyOverview.avgAwakenings || 0}</p><p className="text-[8px] uppercase text-gray-500">Risvegli</p></div>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-white">{weeklyOverview.avgSteps}</p><p className="text-[8px] uppercase text-gray-500">Steps</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-cyan-200">{estimateNeatScore(weeklyOverview.avgSteps)}%</p><p className="text-[8px] uppercase text-gray-500">NEAT</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-amber-200">{weeklyOverview.avgBloating || '--'}</p><p className="text-[8px] uppercase text-gray-500">Gonfiore</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-emerald-200">{weeklyOverview.avgDigestion || '--'}</p><p className="text-[8px] uppercase text-gray-500">Digestione</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-xs font-black text-rose-200">{weeklyOverview.avgCraving || '--'}</p><p className="text-[8px] uppercase text-gray-500">Craving</p></div>
        </div>
      <div className="mt-3">
          {qualityFlags.length > 0 ? qualityFlags.map((flag) => (
            <p key={flag} className="text-[10px] text-amber-200">• {flag}</p>
          )) : <p className="text-[10px] text-emerald-200">Qualita dati buona negli ultimi 7 giorni.</p>}
        </div>
      </motion.div>

      <div className="flex bg-white/5 rounded-sm p-1 mb-8 border border-white/10">
        {['daily', 'weekly', 'monthly'].map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`flex-1 text-[10px] font-bold uppercase py-2 tracking-widest transition-all ${
              timeframe === tf ? 'bg-white/10 text-system-blue shadow-md border-b-2 border-system-blue' : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10" key={`mana-${timeframe}`}>
        <h2 className="text-system-blue text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-system-blue animate-pulse"></span> Mana Fluctuation (Kcal)
        </h2>
        <div className="h-40 w-full bg-gradient-to-b from-system-blue/5 to-transparent border-b border-system-blue/20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorKcal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#00f2ff' }} />
              <Area type="monotone" dataKey="consumed" stroke="#00f2ff" strokeWidth={2} fillOpacity={1} fill="url(#colorKcal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10" key={`power-${timeframe}`}>
        <h2 className="text-cursed-purple text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-cursed-purple animate-pulse"></span> Power Evolution (1RM Kg)
        </h2>
        <div className="h-40 w-full bg-gradient-to-b from-cursed-purple/5 to-transparent border-b border-cursed-purple/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#a855f7' }} />
              <Line type="stepAfter" dataKey="strength" stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: '#a855f7' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} key={`vessel-${timeframe}`}>
        <h2 className="text-emerald-500 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></span> Vessel Optimization (Fat %)
        </h2>
        <div className="h-40 w-full bg-gradient-to-b from-emerald-500/5 to-transparent border-b border-emerald-500/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#10b981' }} />
              <Line type="monotone" dataKey="fat" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-10" key={`hydration-${timeframe}`}>
        <h2 className="text-cyan-300 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-cyan-300 animate-pulse"></span> Hydration Flow (ml)
        </h2>
        <div className="h-40 w-full bg-gradient-to-b from-cyan-300/5 to-transparent border-b border-cyan-300/20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#67e8f9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#67e8f9' }} />
              <Area type="monotone" dataKey="waterMl" stroke="#67e8f9" strokeWidth={2} fillOpacity={1} fill="url(#colorWater)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-10" key={`okok-${timeframe}`}>
        <h2 className="text-emerald-300 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-emerald-300 animate-pulse"></span> Smart Scale Matrix
        </h2>
        <div className="h-44 w-full bg-gradient-to-b from-emerald-300/5 to-transparent border-b border-emerald-300/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line type="monotone" dataKey="bodyWaterPct" stroke="#67e8f9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="muscleMassKg" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="metabolicAge" stroke="#f472b6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-10" key={`sleep-${timeframe}`}>
        <h2 className="text-indigo-300 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-indigo-300 animate-pulse"></span> Sleep Monitor (h)
        </h2>
        <div className="h-40 w-full bg-gradient-to-b from-indigo-300/5 to-transparent border-b border-indigo-300/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: '#a5b4fc' }} />
              <Line type="monotone" dataKey="sleepHours" stroke="#a5b4fc" strokeWidth={2} dot={{ r: 3, fill: '#a5b4fc' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-10" key={`minerals-${timeframe}`}>
        <h2 className="text-cyan-200 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-cyan-200 animate-pulse"></span> Minerals Trend (Ca/Fe/Mg)
        </h2>
        <div className="h-44 w-full bg-gradient-to-b from-cyan-200/5 to-transparent border-b border-cyan-200/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line type="monotone" dataKey="calciumMg" stroke="#67e8f9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ironMg" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="magnesiumMg" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-10" key={`hr-${timeframe}`}>
        <h2 className="text-violet-200 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-violet-200 animate-pulse"></span> Recovery Pulse (RHR + HRV)
        </h2>
        <div className="h-44 w-full bg-gradient-to-b from-violet-200/5 to-transparent border-b border-violet-200/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line type="monotone" dataKey="hrRest" stroke="#a5b4fc" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hrvMs" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-10" key={`digestion-${timeframe}`}>
        <h2 className="text-amber-200 text-[10px] font-bold system-font mb-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-amber-200 animate-pulse"></span> Biofeedback Trend
        </h2>
        <div className="h-44 w-full bg-gradient-to-b from-amber-200/5 to-transparent border-b border-amber-200/20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line type="monotone" dataKey="digestionRegularity" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hungerLevel" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cravingLevel" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="energyLevel" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};

export default Stats;

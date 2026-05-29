import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { playSfx } from '../utils/sfx';
import { speakEvent } from '../utils/voice';
import { formatAiErrorDetail, getAiHistory, parseModelJson, pushAiHistory, requestSystemAI } from '../utils/aiClient';
import { emitUiToast } from '../utils/uiEvents';

const WORKOUT_PROMPT_PRESETS = [
  { id: 'beginner-home', label: 'Home Start', prompt: '35 minuti, casa, corpo libero, focus tecnica base e mobilita, livello principiante.' },
  { id: 'strength-upper', label: 'Upper Strength', prompt: '60 minuti, palestra, focus petto-dorso-spalle, progressione forza controllata, livello intermedio.' },
  { id: 'hypertrophy-lower', label: 'Lower Hypertrophy', prompt: '55 minuti, palestra, focus gambe e glutei, ipertrofia con recuperi moderati.' },
  { id: 'conditioning', label: 'Conditioning', prompt: '40 minuti, misto pesi+cardio, obiettivo conditioning e resistenza, livello intermedio.' },
  { id: 'deload', label: 'Deload', prompt: '30 minuti, recupero attivo, carichi leggeri, mobilita e core, bassa intensita.' }
];
const CARDIO_SPORTS = [
  { id: 'none', label: 'No Cardio', met: 0, hydrationMlPerHour: 350 },
  { id: 'walk', label: 'Walk', met: 3.8, hydrationMlPerHour: 450 },
  { id: 'run', label: 'Run', met: 9.2, hydrationMlPerHour: 850 },
  { id: 'football', label: 'Football', met: 8.8, hydrationMlPerHour: 900 },
  { id: 'bike', label: 'Bike', met: 7.4, hydrationMlPerHour: 700 },
  { id: 'row', label: 'Row', met: 7.1, hydrationMlPerHour: 720 },
  { id: 'swim', label: 'Swim', met: 8.0, hydrationMlPerHour: 780 },
  { id: 'jumprope', label: 'Jump Rope', met: 10.0, hydrationMlPerHour: 900 },
  { id: 'hiit', label: 'HIIT', met: 9.8, hydrationMlPerHour: 880 }
];
const CARDIO_INTENSITY = [
  { id: 'easy', label: 'Easy', burnMul: 0.88, hydrationMul: 0.9 },
  { id: 'medium', label: 'Medium', burnMul: 1, hydrationMul: 1 },
  { id: 'hard', label: 'Hard', burnMul: 1.14, hydrationMul: 1.15 }
];
const DEFAULT_CARDIO_WEATHER = { tempC: 20, humidityPct: 55 };
const clampCardioCalibration = (value, min = 0.85, max = 1.2) => Math.max(min, Math.min(max, Number(value || 1)));
const inferCardioSportFromText = (text = '') => {
  const lower = String(text || '').toLowerCase();
  if (/(calcio|football|soccer)/.test(lower)) return 'football';
  if (/(run|corsa|jog|tapis)/.test(lower)) return 'run';
  if (/(walk|cammin)/.test(lower)) return 'walk';
  if (/(bike|bici|cycling|cycle)/.test(lower)) return 'bike';
  if (/(swim|nuoto)/.test(lower)) return 'swim';
  if (/(row|rowing|remo)/.test(lower)) return 'row';
  if (/(hiit|interval)/.test(lower)) return 'hiit';
  if (/(rope|corda|jumprope)/.test(lower)) return 'jumprope';
  return 'none';
};
const parseCardioQuickImport = (raw = '') => {
  const text = String(raw || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const distanceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  const durationMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minutes|minute)\b/);
  const kcalMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|calorie|cal)\b/);
  const paceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:min\/km|\/km)\b/);
  const distanceKm = distanceMatch ? toNumber(distanceMatch[1]) : 0;
  const durationMin = durationMatch ? toNumber(durationMatch[1]) : 0;
  const reportedKcal = kcalMatch ? toNumber(kcalMatch[1]) : 0;
  const paceMinPerKm = paceMatch ? toNumber(paceMatch[1]) : computePaceMinPerKm(distanceKm, durationMin);
  const intensityId = /(easy|legger|blando)/.test(lower)
    ? 'easy'
    : /(hard|intens|alta)/.test(lower)
      ? 'hard'
      : 'medium';
  const sportId = inferCardioSportFromText(lower);
  if (distanceKm <= 0 && durationMin <= 0 && reportedKcal <= 0) return null;
  return {
    sportId,
    intensityId,
    distanceKm,
    durationMin,
    paceMinPerKm,
    reportedKcal
  };
};

const toNumber = (value) => {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const deepClone = (value, fallback = null) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
};

const detectFocusTags = (exerciseName = '') => {
  const name = exerciseName.toLowerCase();
  const tags = [];
  if (/(squat|lunge|leg|quad|ham|calf|glute)/.test(name)) tags.push('Lower');
  if (/(bench|press|push|chest|dip)/.test(name)) tags.push('Push');
  if (/(row|pull|chin|lat|deadlift)/.test(name)) tags.push('Pull');
  if (/(shoulder|deltoid|ohp)/.test(name)) tags.push('Shoulders');
  if (/(core|abs|plank|crunch)/.test(name)) tags.push('Core');
  if (/(run|sprint|bike|cardio|jump|burpee)/.test(name)) tags.push('Cardio');
  return tags.length ? tags : ['General'];
};

const estimateSetStrength = (kg, reps) => {
  const w = toNumber(kg);
  const r = Math.max(1, toNumber(reps));
  if (w <= 0) return 0;
  return w * (1 + (r / 30));
};

const clampBurnKcal = (rawKcal, plannedMinutes = 40) => {
  const duration = Math.max(10, Number(plannedMinutes || 40));
  const minCap = Math.max(90, Math.round(duration * 3));
  const maxCap = Math.min(1400, Math.max(520, Math.round(duration * 18)));
  const safe = Math.round(Number(rawKcal || 0));
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  return Math.max(minCap, Math.min(maxCap, safe));
};
const computePaceMinPerKm = (distanceKm = 0, durationMin = 0) => {
  const d = Math.max(0, Number(distanceKm || 0));
  const t = Math.max(0, Number(durationMin || 0));
  if (d <= 0 || t <= 0) return 0;
  return t / d;
};
const estimateCardioBurnKcal = ({ sportId = 'none', intensityId = 'medium', distanceKm = 0, durationMin = 0, weightKg = 70, paceMinPerKm = 0, weatherTempC = 20, humidityPct = 55, rpe = 6, calibrationFactor = 1 }) => {
  const sport = CARDIO_SPORTS.find((item) => item.id === sportId) || CARDIO_SPORTS[0];
  const intensity = CARDIO_INTENSITY.find((item) => item.id === intensityId) || CARDIO_INTENSITY[1];
  if (!sport || sport.id === 'none') return 0;
  const weight = Math.max(42, Math.min(180, Number(weightKg || 70)));
  const durationHours = Math.max(0, Number(durationMin || 0)) / 60;
  const distance = Math.max(0, Number(distanceKm || 0));
  const metBurn = sport.met > 0 && durationHours > 0 ? sport.met * weight * durationHours : 0;
  const distanceBurn =
    sport.id === 'run'
      ? distance * weight * 1.03
      : sport.id === 'football'
        ? distance * weight * 0.95
      : sport.id === 'walk'
        ? distance * weight * 0.58
        : sport.id === 'bike'
          ? distance * weight * 0.36
          : sport.id === 'swim'
            ? distance * weight * 1.2
            : distance * weight * 0.72;
  const blended = (metBurn > 0 && distanceBurn > 0)
    ? ((metBurn * 0.62) + (distanceBurn * 0.38))
    : Math.max(metBurn, distanceBurn);
  const cardioFloor = (sport.id === 'run' || sport.id === 'football') && distance > 0
    ? (distanceBurn * 0.9)
    : 0;
  const pace = Number(paceMinPerKm || 0);
  const paceFactor = pace <= 0
    ? 1
    : pace <= 4.5
      ? 1.18
      : pace <= 5.3
        ? 1.1
        : pace <= 6
          ? 1.04
          : pace <= 7
            ? 0.96
            : 0.9;
  const temp = Number(weatherTempC || 20);
  const humidity = Number(humidityPct || 55);
  const heatFactor = temp >= 26 ? 1 + Math.min(0.12, (temp - 25) * 0.012) : 1;
  const humidityFactor = humidity >= 65 ? 1 + Math.min(0.1, (humidity - 64) * 0.003) : 1;
  const weatherFactor = Math.min(1.22, Math.max(0.92, heatFactor * humidityFactor));
  const rpeNum = Math.max(1, Math.min(10, Number(rpe || 6)));
  const rpeFactor = 0.84 + (rpeNum * 0.04);
  return Math.max(0, Math.round(Math.max(blended, cardioFloor) * Number(intensity.burnMul || 1) * paceFactor * weatherFactor * rpeFactor * clampCardioCalibration(calibrationFactor)));
};
const buildCardioRecoveryGuide = ({ sportId = 'none', intensityId = 'medium', distanceKm = 0, durationMin = 0, weightKg = 70, weatherTempC = 20, humidityPct = 55, rpe = 6 }) => {
  const sport = CARDIO_SPORTS.find((item) => item.id === sportId) || CARDIO_SPORTS[0];
  const intensity = CARDIO_INTENSITY.find((item) => item.id === intensityId) || CARDIO_INTENSITY[1];
  if (!sport || sport.id === 'none') {
    return {
      hydrationExtraMl: 0,
      hydrationPrompt: 'Sessione cardio non rilevata.',
      supplements: []
    };
  }
  const durationHours = Math.max(0, Number(durationMin || 0)) / 60;
  const distance = Math.max(0, Number(distanceKm || 0));
  const temp = Number(weatherTempC || 20);
  const humidity = Number(humidityPct || 55);
  const climateHydrationMul = (temp >= 26 ? 1 + Math.min(0.2, (temp - 25) * 0.02) : 1) * (humidity >= 65 ? 1 + Math.min(0.15, (humidity - 64) * 0.004) : 1);
  const baseExtra = Math.round((sport.hydrationMlPerHour || 450) * durationHours * Number(intensity.hydrationMul || 1) * Math.min(1.28, climateHydrationMul));
  const distanceExtra = Math.round(distance * 120);
  const hydrationExtraMl = Math.max(300, Math.min(1800, baseExtra + distanceExtra));
  const rpeNum = Math.max(1, Math.min(10, Number(rpe || 6)));
  const intensityScore = ((sport.met * 10) + (distance * 5) + (durationHours * 20) + (Math.max(42, Math.min(180, Number(weightKg || 70))) * 0.1) + (rpeNum * 7)) * Number(intensity.burnMul || 1);
  const supplements = [
    intensityScore >= 150 ? 'Elettroliti (sodio/potassio) post-sessione' : 'Acqua + pizzico di sale nei pasti',
    intensityScore >= 165 ? 'Magnesio 200-300mg la sera' : 'Magnesio opzionale se crampi',
    distance >= 8 || durationHours >= 1.1 ? 'Carboidrati rapidi + proteine nel post workout' : 'Snack recovery leggero con proteine'
  ];
  return {
    hydrationExtraMl,
    hydrationPrompt: `Dopo ${sport.label}: prova +${hydrationExtraMl} ml nelle prossime 2-3h.`,
    supplements
  };
};
const getCardioZone = ({ rpe = 6, paceMinPerKm = 0, intensityId = 'medium', sportId = 'none' }) => {
  if (sportId === 'none') return { id: 'none', label: 'No Cardio' };
  const pace = Math.max(0, Number(paceMinPerKm || 0));
  const intensity = String(intensityId || 'medium');
  const effort = Math.max(1, Math.min(10, Number(rpe || 6)));
  let score = effort;
  if (pace > 0 && pace <= 4.7) score += 1.1;
  else if (pace > 0 && pace >= 6.7) score -= 0.8;
  if (intensity === 'hard') score += 1;
  if (intensity === 'easy') score -= 0.8;
  if (score <= 3.3) return { id: 'z1', label: 'Z1 Recovery' };
  if (score <= 4.8) return { id: 'z2', label: 'Z2 Base' };
  if (score <= 6.4) return { id: 'z3', label: 'Z3 Tempo' };
  if (score <= 8) return { id: 'z4', label: 'Z4 Threshold' };
  return { id: 'z5', label: 'Z5 VO2' };
};

const estimateFallbackBurnKcal = (summary) => {
  if (!summary) return 0;
  const duration = Math.max(10, Number(summary.plannedMinutes || 40));
  const completedSets = (summary.exercises || []).reduce((sum, row) => sum + Number(row?.completedSets || 0), 0);
  const strengthFactor = Math.max(0, Number(summary.strengthIndex || 0)) * 0.01;
  const cardioBurn = estimateCardioBurnKcal({
    sportId: summary?.cardio?.sportId || 'none',
    intensityId: summary?.cardio?.intensityId || 'medium',
    distanceKm: summary?.cardio?.distanceKm || 0,
    durationMin: summary?.cardio?.durationMin || 0,
    weightKg: summary?.athleteProfile?.weightKg || 70,
    paceMinPerKm: summary?.cardio?.paceMinPerKm || 0,
    weatherTempC: summary?.cardio?.weather?.tempC ?? DEFAULT_CARDIO_WEATHER.tempC,
    humidityPct: summary?.cardio?.weather?.humidityPct ?? DEFAULT_CARDIO_WEATHER.humidityPct,
    rpe: summary?.cardio?.rpe ?? 6,
    calibrationFactor: summary?.cardio?.calibrationFactor ?? 1
  });
  const base = (duration * 5.6) + (completedSets * 5.2) + strengthFactor + (cardioBurn * 0.85);
  return clampBurnKcal(base, duration);
};
const getPlanConfidenceBadge = (score = 0) => {
  const safe = Math.max(1, Math.min(99, Math.round(Number(score || 0))));
  if (safe >= 84) return { label: 'Alta', tone: 'text-emerald-200 border-emerald-300/45 bg-emerald-500/10' };
  if (safe >= 66) return { label: 'Media', tone: 'text-amber-200 border-amber-300/45 bg-amber-500/10' };
  return { label: 'Bassa', tone: 'text-rose-200 border-rose-300/45 bg-rose-500/10' };
};
const computeWorkoutPlanConfidence = (plan = {}, prompt = '', modelName = '') => {
  const mainCount = Array.isArray(plan?.main) ? plan.main.length : 0;
  const warnings = Array.isArray(plan?.safetyWarnings) ? plan.safetyWarnings.length : 0;
  const duration = Number(plan?.durationMin || 40);
  const promptWords = String(prompt || '').trim().split(/\s+/).filter(Boolean).length;
  const durationPenalty = duration > 85 ? 12 : duration < 20 ? 10 : 0;
  const structureBoost = Math.min(22, mainCount * 3);
  const warningPenalty = Math.min(18, warnings * 5);
  const detailBoost = Math.min(12, promptWords);
  const modelBoost = String(modelName || '').toLowerCase().includes('qwen') ? 4 : 0;
  const score = Math.max(20, Math.min(98, Math.round(55 + structureBoost + detailBoost + modelBoost - warningPenalty - durationPenalty)));
  const badge = getPlanConfidenceBadge(score);
  return { score, label: badge.label, tone: badge.tone };
};

const BODY_ZONES = [
  { id: 'shoulders', label: 'Spalle', tag: 'Shoulders' },
  { id: 'push', label: 'Petto', tag: 'Push' },
  { id: 'pull', label: 'Schiena', tag: 'Pull' },
  { id: 'core', label: 'Core', tag: 'Core' },
  { id: 'lower', label: 'Gambe', tag: 'Lower' },
  { id: 'cardio', label: 'Cardio', tag: 'Cardio' }
];

const BATTLE_VISUAL_PRESETS = [
  { id: 'shadow', title: 'Shadow Burst', subtitle: 'Burst Arcano', image: '/vfx/magic-burst.png', fallback: '◆' },
  { id: 'slash', title: 'Blade Arc', subtitle: 'Taglio Energetico', image: '/vfx/magic-slash.png', fallback: '✦' },
  { id: 'sigil', title: 'Rune Circle', subtitle: 'Sigillo di Buff', image: '/vfx/magic-circle.png', fallback: '◈' }
];

const BODY_IMAGE_ZONES = {
  Shoulders: [
    { left: '25%', top: '18%', width: '12%', height: '10%', radius: '40%', rotate: '-8deg' },
    { left: '63%', top: '18%', width: '12%', height: '10%', radius: '40%', rotate: '8deg' }
  ],
  Push: [
    { left: '35%', top: '22%', width: '30%', height: '12%', radius: '40%' }
  ],
  Pull: [
    { left: '18%', top: '28%', width: '12%', height: '25%', radius: '40%', rotate: '-8deg' },
    { left: '70%', top: '28%', width: '12%', height: '25%', radius: '40%', rotate: '8deg' }
  ],
  Core: [
    { left: '46.2%', top: '30.4%', width: '7.2%', height: '3%', radius: '0.7rem' },
    { left: '43.2%', top: '34.1%', width: '4.6%', height: '3.8%', radius: '0.7rem' },
    { left: '52.2%', top: '34.1%', width: '4.6%', height: '3.8%', radius: '0.7rem' },
    { left: '43.1%', top: '38.4%', width: '4.6%', height: '4.1%', radius: '0.7rem' },
    { left: '52.3%', top: '38.4%', width: '4.6%', height: '4.1%', radius: '0.7rem' },
    { left: '44.6%', top: '43%', width: '3.6%', height: '4.1%', radius: '0.8rem' },
    { left: '52.1%', top: '43%', width: '3.6%', height: '4.1%', radius: '0.8rem' },
    { left: '39.8%', top: '34.6%', width: '3.1%', height: '7.9%', radius: '1rem', rotate: '-8deg' },
    { left: '57.1%', top: '34.6%', width: '3.1%', height: '7.9%', radius: '1rem', rotate: '8deg' }
  ],
  Lower: [
    { left: '36.5%', top: '50.7%', width: '4.5%', height: '11.2%', radius: '1.4rem', rotate: '-5deg' },
    { left: '40.2%', top: '54.8%', width: '2.8%', height: '9.5%', radius: '1rem', rotate: '-4deg' },
    { left: '58.7%', top: '50.7%', width: '4.5%', height: '11.2%', radius: '1.4rem', rotate: '5deg' },
    { left: '57%', top: '54.8%', width: '2.8%', height: '9.5%', radius: '1rem', rotate: '4deg' },
    { left: '37.8%', top: '68.2%', width: '2.9%', height: '7.6%', radius: '1rem', rotate: '-4deg' },
    { left: '59.3%', top: '68.2%', width: '2.9%', height: '7.6%', radius: '1rem', rotate: '4deg' }
  ],
  Cardio: [
    { left: '47.1%', top: '23.9%', width: '4.5%', height: '3%', radius: '999px' }
  ]
};

const BODY_CALIBRATION_DEFAULT = {
  Push: { x: 0, y: -1.8, sx: 0.96, sy: 0.96, spread: 0, tilt: 0, lx: 0, rx: 0, ltilt: 0, rtilt: 0 },
  Shoulders: { x: 0, y: 0.6, sx: 0.66, sy: 0.76, spread: -5, tilt: 0, lx: 0, rx: 0, ltilt: 0, rtilt: 0 },
  Pull: { x: -6, y: -4.8, sx: 0.5, sy: 0.74, spread: 0, tilt: -22, lx: 12.5, rx: -0.5, ltilt: 45, rtilt: -17 }
};

const percentToNumber = (value) => {
  const parsed = Number(String(value || '').replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const degToNumber = (value) => {
  const parsed = Number(String(value || '').replace('deg', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const getAdjustedFrame = (frame, calibration, tag) => {
  const baseLeft = percentToNumber(frame.left);
  const baseTop = percentToNumber(frame.top);
  const baseWidth = percentToNumber(frame.width);
  const baseHeight = percentToNumber(frame.height);
  const baseCenterX = baseLeft + (baseWidth / 2);
  const sideSign = baseCenterX < 50 ? -1 : 1;
  const pairZone = tag === 'Shoulders' || tag === 'Pull';

  const sx = clampValue(calibration?.sx ?? 1, 0.5, 1.8);
  const sy = clampValue(calibration?.sy ?? 1, 0.5, 1.8);
  const shiftX = calibration?.x ?? 0;
  const shiftY = calibration?.y ?? 0;
  const spread = clampValue(calibration?.spread ?? 0, -15, 15);
  const tilt = clampValue(calibration?.tilt ?? 0, -35, 35);
  const sideExtraX = pairZone ? (sideSign < 0 ? (calibration?.lx ?? 0) : (calibration?.rx ?? 0)) : 0;
  const sideTilt = pairZone ? (sideSign < 0 ? (calibration?.ltilt ?? 0) : (calibration?.rtilt ?? 0)) : 0;

  const scaledWidth = baseWidth * sx;
  const scaledHeight = baseHeight * sy;
  const spreadShift = pairZone ? sideSign * spread : 0;
  const baseRotate = degToNumber(frame.rotate || '0deg');
  const rotateValue = baseRotate + tilt + sideTilt;

  let nextLeft = baseLeft + shiftX + spreadShift + sideExtraX - ((scaledWidth - baseWidth) / 2);
  let nextTop = baseTop + shiftY - ((scaledHeight - baseHeight) / 2);
  let nextWidth = scaledWidth;
  let nextHeight = scaledHeight;

  nextLeft = clampValue(nextLeft, 0, 100);
  nextTop = clampValue(nextTop, 0, 100);
  nextWidth = clampValue(nextWidth, 0.2, 100 - nextLeft);
  nextHeight = clampValue(nextHeight, 0.2, 100 - nextTop);

  return {
    ...frame,
    left: `${nextLeft}%`,
    top: `${nextTop}%`,
    width: `${nextWidth}%`,
    height: `${nextHeight}%`,
    rotate: `${rotateValue}deg`
  };
};

const getWeekKey = (value = new Date()) => {
  const date = new Date(value);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};
const toDayMonthKey = (value = new Date()) => {
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  } catch (_) {
    return '';
  }
};
const getCurrentWeekDateKeys = (base = new Date()) => {
  const date = new Date(base);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    const cursor = new Date(monday);
    cursor.setDate(monday.getDate() + i);
    keys.push(toDayMonthKey(cursor));
  }
  return keys;
};

const getZoneStyle = (tag, selectedZones, recommendedZones, trainedZones) => {
  if (selectedZones.includes(tag)) {
    return { fill: '#38bdf8', opacity: 0.95, glow: 'drop-shadow(0 0 12px rgba(56,189,248,0.75))' };
  }
  if (recommendedZones.includes(tag)) {
    return { fill: '#f472b6', opacity: 0.88, glow: 'drop-shadow(0 0 10px rgba(244,114,182,0.55))' };
  }
  if (trainedZones.includes(tag)) {
    return { fill: '#4ade80', opacity: 0.82, glow: 'drop-shadow(0 0 10px rgba(74,222,128,0.5))' };
  }
  return { fill: '#a1a1c5', opacity: 0.5, glow: 'none' };
};

const HumanBodyMap = ({ selectedZones, recommendedZones, trainedZones, onToggle, daysSinceLastWorkout, freshGroupsCount }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [bodyImageReady, setBodyImageReady] = useState(true);
  const [activeCalibrationTag, setActiveCalibrationTag] = useState('Pull');
  const [zoneCalibration, setZoneCalibration] = useState(() => {
    const saved = localStorage.getItem('shadow_body_zone_calibration');
    if (!saved) return BODY_CALIBRATION_DEFAULT;
    try {
      const parsed = JSON.parse(saved);
      return {
        Push: { ...BODY_CALIBRATION_DEFAULT.Push, ...(parsed.Push || {}) },
        Shoulders: { ...BODY_CALIBRATION_DEFAULT.Shoulders, ...(parsed.Shoulders || {}) },
        Pull: { ...BODY_CALIBRATION_DEFAULT.Pull, ...(parsed.Pull || {}) }
      };
    } catch {
      return BODY_CALIBRATION_DEFAULT;
    }
  });

  const adjustZoom = (direction) => {
    setZoomLevel((prev) => {
      const next = direction === 'in' ? prev + 0.06 : prev - 0.06;
      return Math.min(1.24, Math.max(0.82, Number(next.toFixed(2))));
    });
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const applyViewportMode = () => setIsCompactViewport(media.matches);
    applyViewportMode();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', applyViewportMode);
      return () => media.removeEventListener('change', applyViewportMode);
    }
    media.addListener(applyViewportMode);
    return () => media.removeListener(applyViewportMode);
  }, []);

  useEffect(() => {
    setZoomLevel(isCompactViewport ? 1.08 : 0.96);
  }, [isCompactViewport]);

  useEffect(() => {
    localStorage.setItem('shadow_body_zone_calibration', JSON.stringify(zoneCalibration));
  }, [zoneCalibration]);

  const tuneActiveZone = ({ dx = 0, dy = 0, dsx = 0, dsy = 0, dspread = 0, dtilt = 0, dlx = 0, drx = 0, dltilt = 0, drtilt = 0 }) => {
    setZoneCalibration((prev) => {
      const current = prev[activeCalibrationTag] || BODY_CALIBRATION_DEFAULT[activeCalibrationTag];
      const next = {
        x: Number((current.x + dx).toFixed(2)),
        y: Number((current.y + dy).toFixed(2)),
        sx: Number(clampValue(current.sx + dsx, 0.5, 1.8).toFixed(2)),
        sy: Number(clampValue(current.sy + dsy, 0.5, 1.8).toFixed(2)),
        spread: Number(clampValue((current.spread || 0) + dspread, -15, 15).toFixed(2)),
        tilt: Number(clampValue((current.tilt || 0) + dtilt, -35, 35).toFixed(2)),
        lx: Number(clampValue((current.lx || 0) + dlx, -15, 15).toFixed(2)),
        rx: Number(clampValue((current.rx || 0) + drx, -15, 15).toFixed(2)),
        ltilt: Number(clampValue((current.ltilt || 0) + dltilt, -45, 45).toFixed(2)),
        rtilt: Number(clampValue((current.rtilt || 0) + drtilt, -45, 45).toFixed(2))
      };
      return {
        ...prev,
        [activeCalibrationTag]: next
      };
    });
  };

  const resetActiveZoneCalibration = () => {
    setZoneCalibration((prev) => ({
      ...prev,
      [activeCalibrationTag]: BODY_CALIBRATION_DEFAULT[activeCalibrationTag]
    }));
  };

  const activeCalibration = zoneCalibration[activeCalibrationTag] || BODY_CALIBRATION_DEFAULT[activeCalibrationTag];
  const isPairCalibration = activeCalibrationTag === 'Shoulders' || activeCalibrationTag === 'Pull';

  return (
  <div className="mb-6 overflow-hidden rounded-sm border border-cyan-400/25 bg-[linear-gradient(145deg,rgba(8,15,28,0.96),rgba(2,6,23,0.98))] p-4 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-cyan-300 text-[10px] uppercase tracking-[0.32em]">Hunter Anatomy</p>
        <h3 className="mt-1 text-sm font-black uppercase text-white">Recovery Body Scanner</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center">
          <p className="text-3xl font-black text-white">{daysSinceLastWorkout}</p>
          <p className="text-[9px] uppercase tracking-[0.28em] text-white/45">Days Since Workout</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center">
          <p className="text-3xl font-black text-white">{freshGroupsCount}</p>
          <p className="text-[9px] uppercase tracking-[0.28em] text-white/45">Fresh Groups</p>
        </div>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
      <div className="relative mx-auto w-full max-w-[26rem] md:max-w-[22rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.22),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.1),transparent_36%),linear-gradient(180deg,rgba(12,14,26,0.98),rgba(14,18,34,0.98))] px-2 pb-3 pt-12 shadow-[inset_0_0_28px_rgba(56,189,248,0.1)]">
        <motion.div
          animate={{ opacity: [0.18, 0.34, 0.18], scale: [0.96, 1.02, 0.96] }}
          transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-0 rounded-full bg-indigo-300/12 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(251,191,36,0.08),transparent_26%)]" />
        <div className="absolute right-3 top-3 z-20 flex gap-2">
          <button onClick={() => adjustZoom('out')} className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-sm font-black text-white/75 hover:border-cyan-300/40 hover:text-cyan-200">-</button>
          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
            Zoom {zoomLevel.toFixed(2)}x
          </div>
          <button onClick={() => adjustZoom('in')} className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-sm font-black text-white/75 hover:border-cyan-300/40 hover:text-cyan-200">+</button>
          <button
            onClick={() => setZoomLevel(isCompactViewport ? 1.08 : 0.96)}
            className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-300 hover:text-black"
          >
            Fit
          </button>
        </div>
        <div className="body-map-shell">
          <div className="body-map-wrapper">
            <div className="body-map-zoom" style={{ transform: `scale(${zoomLevel})` }}>
              <img
                src="/body/body-front.png"
                alt=""
                className="body-map-image"
                onError={() => setBodyImageReady(false)}
                onLoad={() => setBodyImageReady(true)}
              />
              <div className="body-map-zones">
                {BODY_ZONES.map((zone) => {
                  const style = getZoneStyle(zone.tag, selectedZones, recommendedZones, trainedZones);
                  const frames = BODY_IMAGE_ZONES[zone.tag] || [];
                  return (
                    <React.Fragment key={zone.id}>
                      {frames.map((frame, index) => {
                        const adjustedFrame = ['Push', 'Shoulders', 'Pull'].includes(zone.tag)
                          ? getAdjustedFrame(frame, zoneCalibration[zone.tag] || BODY_CALIBRATION_DEFAULT[zone.tag], zone.tag)
                          : frame;
                        return (
                        <button
                          key={`${zone.id}-${index}`}
                          type="button"
                          onClick={() => {
                            if (['Push', 'Shoulders', 'Pull'].includes(zone.tag)) {
                              setActiveCalibrationTag(zone.tag);
                            }
                            onToggle(zone.tag);
                          }}
                          className="body-map-zone"
                          style={{
                            left: adjustedFrame.left,
                            top: adjustedFrame.top,
                            width: adjustedFrame.width,
                            height: adjustedFrame.height,
                            background: style.fill,
                            opacity: style.opacity * (selectedZones.includes(zone.tag) ? 0.24 : recommendedZones.includes(zone.tag) ? 0.13 : trainedZones.includes(zone.tag) ? 0.11 : 0.025),
                            borderColor: style.fill,
                            filter: style.glow,
                            borderRadius: adjustedFrame.radius,
                            transform: `rotate(${adjustedFrame.rotate || '0deg'})`,
                            transformOrigin: 'center center',
                            transition: 'transform 120ms ease, left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease, opacity 120ms ease'
                          }}
                          aria-label={zone.label}
                        />
                      )})}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
          {!bodyImageReady ? (
            <div className="pointer-events-none absolute inset-x-5 top-1/2 z-30 -translate-y-1/2 rounded-xl border border-rose-300/35 bg-black/75 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">Body image missing</p>
              <p className="mt-1 text-[10px] text-gray-300">Ricarica la pagina dopo il nuovo deploy.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 xl:min-w-[9rem]">
        <div className="rounded-sm border border-cyan-400/25 bg-cyan-400/8 p-2 text-[10px] uppercase tracking-widest text-cyan-200">Target IA</div>
        {(selectedZones.length ? selectedZones : recommendedZones).slice(0, 6).map((tag) => (
          <div key={tag} className="rounded-sm border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-white">
            {tag}
          </div>
        ))}
        {!selectedZones.length && !recommendedZones.length && (
          <p className="text-[10px] text-white/45">Nessuna zona selezionata.</p>
        )}
        <div className="mt-2 rounded-sm border border-emerald-400/20 bg-emerald-400/8 p-2 text-[10px] uppercase tracking-widest text-emerald-200">Allenate oggi</div>
        {trainedZones.length ? trainedZones.map((tag) => (
          <div key={`trained-${tag}`} className="rounded-sm border border-emerald-300/20 bg-white/5 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
            {tag}
          </div>
        )) : <p className="text-[10px] text-white/45">Ancora nessuna.</p>}
        <div className="mt-2 space-y-2 rounded-sm border border-white/10 bg-black/25 p-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/55">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            Selezionata
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/55">
            <span className="h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.8)]" />
            Suggerita IA
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/55">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
            Già allenata
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const Training = ({ playerStats, setPlayerStats, systemLogs = [], setSystemLogs, hydrationGoal = 2800, createEmptyLog, soundEnabled, soundTheme, voiceEnabled, voicePack, crownAnthemEnabled = true }) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const [workoutPrompt, setWorkoutPrompt] = useState(() => localStorage.getItem('shadow_monarch_workout_draft_prompt') || '');
  const [cardioDraft, setCardioDraft] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_cardio_draft');
      const parsed = raw ? JSON.parse(raw) : {};
      const sportId = String(parsed?.sportId || 'none');
      const intensityId = String(parsed?.intensityId || 'medium');
      return {
        sportId: CARDIO_SPORTS.some((item) => item.id === sportId) ? sportId : 'none',
        intensityId: CARDIO_INTENSITY.some((item) => item.id === intensityId) ? intensityId : 'medium',
        distanceKm: Number(parsed?.distanceKm || 0) > 0 ? String(parsed.distanceKm) : '',
        durationMin: Number(parsed?.durationMin || 0) > 0 ? String(parsed.durationMin) : '',
        weatherTempC: Number.isFinite(Number(parsed?.weatherTempC)) ? String(parsed.weatherTempC) : String(DEFAULT_CARDIO_WEATHER.tempC),
        humidityPct: Number.isFinite(Number(parsed?.humidityPct)) ? String(parsed.humidityPct) : String(DEFAULT_CARDIO_WEATHER.humidityPct),
        rpe: Number.isFinite(Number(parsed?.rpe)) ? String(parsed.rpe) : '6',
        reportedKcal: Number(parsed?.reportedKcal || 0) > 0 ? String(parsed.reportedKcal) : ''
      };
    } catch (_) {
      return { sportId: 'none', intensityId: 'medium', distanceKm: '', durationMin: '', weatherTempC: String(DEFAULT_CARDIO_WEATHER.tempC), humidityPct: String(DEFAULT_CARDIO_WEATHER.humidityPct), rpe: '6', reportedKcal: '' };
    }
  });
  const [cardioQuickImportText, setCardioQuickImportText] = useState('');
  const [aiHistory, setAiHistory] = useState(() => getAiHistory());
  const [aiWorkout, setAiWorkout] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_ai_workout');
    if (!saved) return null;
    try { return JSON.parse(saved); } catch { return null; }
  });
  const [workoutHistory, setWorkoutHistory] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_workout_history');
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [flowStep, setFlowStep] = useState('briefing');
  const [isWorkoutRunning, setIsWorkoutRunning] = useState(false);
  const [workoutRemaining, setWorkoutRemaining] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [exerciseInputs, setExerciseInputs] = useState({});
  const [lastSessionSummary, setLastSessionSummary] = useState(null);
  const [selectedBodyZones, setSelectedBodyZones] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_workout_draft_zones');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [restFxKey, setRestFxKey] = useState(0);
  const [weeklyBurst, setWeeklyBurst] = useState(false);
  const [activeBattleVisual, setActiveBattleVisual] = useState(0);
  const [battleVisualImageOk, setBattleVisualImageOk] = useState(true);
  const [battleCueLabel, setBattleCueLabel] = useState('Idle Preview');
  const [battleCueTick, setBattleCueTick] = useState(0);
  const [burnEstimateMeta, setBurnEstimateMeta] = useState({ state: 'idle', message: '' });
  const [isFinishingWorkout, setIsFinishingWorkout] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [historyMonthFilter, setHistoryMonthFilter] = useState('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState('');
  const [historyEditDraft, setHistoryEditDraft] = useState(null);
  const [historyUndoStack, setHistoryUndoStack] = useState([]);
  const [historyRedoStack, setHistoryRedoStack] = useState([]);
  const [recoveryAutopilotEnabled, setRecoveryAutopilotEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_recovery_autopilot');
      if (raw === null) return true;
      return raw === '1';
    } catch (_) {
      return true;
    }
  });
  const [cardioWeeklyGoalKm, setCardioWeeklyGoalKm] = useState(() => {
    const raw = Number(localStorage.getItem('shadow_monarch_cardio_weekly_goal_km') || 20);
    return Math.max(3, Math.min(120, Number.isFinite(raw) ? raw : 20));
  });
  const [cardioCalibrationFactor, setCardioCalibrationFactor] = useState(() => {
    const raw = Number(localStorage.getItem('shadow_monarch_cardio_calibration_factor') || 1);
    return clampCardioCalibration(Number.isFinite(raw) ? raw : 1);
  });
  const sessionRef = useRef({ aiWorkout: null, exerciseProgress: {} });
  const workoutHistoryRef = useRef(workoutHistory);
  const lastRestTickRef = useRef(null);
  const generatingTimeoutRef = useRef(null);
  const finishingTimeoutRef = useRef(null);

  useEffect(() => { localStorage.setItem('shadow_monarch_workout_history', JSON.stringify(workoutHistory)); }, [workoutHistory]);
  useEffect(() => { workoutHistoryRef.current = workoutHistory; }, [workoutHistory]);
  useEffect(() => { localStorage.setItem('shadow_monarch_recovery_autopilot', recoveryAutopilotEnabled ? '1' : '0'); }, [recoveryAutopilotEnabled]);
  useEffect(() => { localStorage.setItem('shadow_monarch_workout_draft_prompt', String(workoutPrompt || '')); }, [workoutPrompt]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_cardio_draft', JSON.stringify(cardioDraft));
  }, [cardioDraft]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_cardio_weekly_goal_km', String(cardioWeeklyGoalKm));
  }, [cardioWeeklyGoalKm]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_cardio_calibration_factor', String(cardioCalibrationFactor));
  }, [cardioCalibrationFactor]);
  useEffect(() => { localStorage.setItem('shadow_monarch_workout_draft_zones', JSON.stringify(selectedBodyZones || [])); }, [selectedBodyZones]);
  useEffect(() => { sessionRef.current = { aiWorkout, exerciseProgress }; }, [aiWorkout, exerciseProgress]);
  useEffect(() => {
    if (!isGeneratingWorkout) {
      if (generatingTimeoutRef.current) {
        clearTimeout(generatingTimeoutRef.current);
        generatingTimeoutRef.current = null;
      }
      return;
    }
    generatingTimeoutRef.current = setTimeout(() => {
      setIsGeneratingWorkout(false);
      alert('Generazione lunga: sbloccata in sicurezza, riprova.');
    }, 32000);
    return () => {
      if (generatingTimeoutRef.current) {
        clearTimeout(generatingTimeoutRef.current);
        generatingTimeoutRef.current = null;
      }
    };
  }, [isGeneratingWorkout]);
  useEffect(() => {
    if (!isFinishingWorkout) {
      if (finishingTimeoutRef.current) {
        clearTimeout(finishingTimeoutRef.current);
        finishingTimeoutRef.current = null;
      }
      return;
    }
    finishingTimeoutRef.current = setTimeout(() => {
      setIsFinishingWorkout(false);
      setBurnEstimateMeta({ state: 'failed', message: 'Timeout stima burn, prova di nuovo.' });
    }, 34000);
    return () => {
      if (finishingTimeoutRef.current) {
        clearTimeout(finishingTimeoutRef.current);
        finishingTimeoutRef.current = null;
      }
    };
  }, [isFinishingWorkout]);

  useEffect(() => {
    if (!isWorkoutRunning) return;
    const interval = setInterval(() => {
      setWorkoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finishWorkoutSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isWorkoutRunning]);

  useEffect(() => {
    if (restRemaining <= 0) return;
    const interval = setInterval(() => setRestRemaining((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [restRemaining]);

  useEffect(() => {
    if (restRemaining > 0 && lastRestTickRef.current !== restRemaining) {
      if (restRemaining <= 3) playSfx('countdown', soundEnabled, soundTheme);
      lastRestTickRef.current = restRemaining;
    }
    if (restRemaining === 0 && lastRestTickRef.current !== 0) {
      playSfx('success', soundEnabled, soundTheme);
      lastRestTickRef.current = 0;
    }
  }, [restRemaining, soundEnabled, soundTheme]);

  useEffect(() => {
    if (!weeklyBurst) return;
    const timeout = window.setTimeout(() => setWeeklyBurst(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [weeklyBurst]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBattleVisual((prev) => (prev + 1) % BATTLE_VISUAL_PRESETS.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  const triggerBattleCue = (modeIndex, label) => {
    setActiveBattleVisual(modeIndex);
    setBattleVisualImageOk(true);
    setBattleCueLabel(label);
    setBattleCueTick((prev) => prev + 1);
  };
  const applyWorkoutPromptPreset = (presetText) => {
    setWorkoutPrompt(presetText);
  };
  const updateCardioDraft = (key, value) => {
    setCardioDraft((prev) => ({ ...prev, [key]: value }));
  };
  const runCardioQuickImport = () => {
    const parsed = parseCardioQuickImport(cardioQuickImportText);
    if (!parsed) {
      emitUiToast({ message: 'Import cardio non valido. Usa testo tipo: "Football 5 km 70 min 620 kcal"', tone: 'warning', durationMs: 3600 });
      return;
    }
    setCardioDraft((prev) => ({
      ...prev,
      sportId: parsed.sportId !== 'none' ? parsed.sportId : prev.sportId,
      intensityId: parsed.intensityId || prev.intensityId,
      distanceKm: parsed.distanceKm > 0 ? String(parsed.distanceKm) : prev.distanceKm,
      durationMin: parsed.durationMin > 0 ? String(parsed.durationMin) : prev.durationMin,
      reportedKcal: parsed.reportedKcal > 0 ? String(Math.round(parsed.reportedKcal)) : prev.reportedKcal
    }));
    emitUiToast({ message: 'Cardio importato nel draft', tone: 'success', durationMs: 2400 });
  };
  const applyWorkoutHistoryChange = (updater, actionLabel = 'Update history', clearRedo = true) => {
    const current = deepClone(workoutHistoryRef.current, []);
    const nextRaw = typeof updater === 'function' ? updater(current) : updater;
    const next = deepClone(nextRaw, current);
    if (!Array.isArray(next)) return;
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: actionLabel,
      payload: current
    };
    setHistoryUndoStack((prev) => [snapshot, ...prev].slice(0, 20));
    if (clearRedo) setHistoryRedoStack([]);
    setWorkoutHistory(next);
  };
  const undoWorkoutHistory = () => {
    if (!historyUndoStack.length) return;
    const [latest, ...rest] = historyUndoStack;
    const current = deepClone(workoutHistoryRef.current, []);
    setHistoryUndoStack(rest);
    setHistoryRedoStack((prev) => [{ id: `${Date.now()}-redo`, label: latest?.label || 'Redo', payload: current }, ...prev].slice(0, 20));
    setWorkoutHistory(Array.isArray(latest?.payload) ? deepClone(latest.payload, []) : []);
    emitUiToast({ message: 'Undo completato', tone: 'success', durationMs: 1800 });
  };
  const redoWorkoutHistory = () => {
    if (!historyRedoStack.length) return;
    const [latest, ...rest] = historyRedoStack;
    const current = deepClone(workoutHistoryRef.current, []);
    setHistoryRedoStack(rest);
    setHistoryUndoStack((prev) => [{ id: `${Date.now()}-undo`, label: latest?.label || 'Undo', payload: current }, ...prev].slice(0, 20));
    setWorkoutHistory(Array.isArray(latest?.payload) ? deepClone(latest.payload, []) : []);
    emitUiToast({ message: 'Redo completato', tone: 'success', durationMs: 1800 });
  };

  const formatSeconds = (totalSeconds) => {
    const safe = Math.max(0, totalSeconds || 0);
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const generateAnimeWorkout = async () => {
    if (isGeneratingWorkout) return;
    if (!workoutPrompt.trim()) return alert("Scrivi obiettivo e attrezzatura.");
    setIsGeneratingWorkout(true);
    try {
      const recentTagCount = workoutHistory.slice(0, 8).flatMap((session) => session.focusTags || []).reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
      const suggestedRecoveryZones = BODY_ZONES
        .map((zone) => ({ tag: zone.tag, count: recentTagCount[zone.tag] || 0 }))
        .sort((a, b) => a.count - b.count)
        .slice(0, 2)
        .map((zone) => zone.tag);
      const targetZones = selectedBodyZones.length ? selectedBodyZones : suggestedRecoveryZones;
      const cardioDistance = Math.max(0, toNumber(cardioDraft.distanceKm));
      const cardioSportId = String(cardioDraft.sportId || 'none');
      const cardioIntensityId = String(cardioDraft.intensityId || 'medium');
      const cardioRpe = Math.max(1, Math.min(10, Math.round(toNumber(cardioDraft.rpe) || 6)));
      const cardioSportLabel = CARDIO_SPORTS.find((item) => item.id === cardioSportId)?.label || 'No Cardio';
      const cardioIntensityLabel = CARDIO_INTENSITY.find((item) => item.id === cardioIntensityId)?.label || 'Medium';
      const recentHistory = workoutHistory.slice(0, 6).map((session) => ({
        date: new Date(session.date).toLocaleDateString('it-IT'),
        title: session.title,
        focusTags: session.focusTags || [],
        strengthIndex: Math.round(session.strengthIndex || 0),
        exercises: (session.exercises || []).slice(0, 6).map((ex) => ({
          name: ex.name,
          completedSets: ex.completedSets,
          topKg: Math.max(0, ...(ex.logs || []).map((log) => toNumber(log.kg))),
          topReps: Math.max(0, ...(ex.logs || []).map((log) => toNumber(log.repsDone)))
        }))
      }));
      const data = await requestSystemAI({
        temperature: 0.15,
        max_tokens: 950,
        timeoutMs: 30000,
        messages: [
          {
            role: 'system',
            content:
              'Sei un coach strength & conditioning esperto. Crea un workout SICURO ma efficace, personalizzato su storico, focus muscolari e livello utente. Obiettivi: progressione intelligente, volume sostenibile, varieta esercizi, niente sovraccarico ripetuto degli stessi pattern. Dai cue pratici brevi e utili. Rispondi ESCLUSIVAMENTE in JSON valido con schema: {"title":"string","difficulty":"E|D|C|B|A|S","durationMin":numero,"focus":"string","warmup":["string"],"main":[{"name":"string","sets":numero,"reps":"string","restSec":numero,"cue":"string"}],"finisher":["string"],"notes":["string"]}.'
          },
          { role: 'user', content: `Genera workout per: ${workoutPrompt}\nZone prioritarie del corpo: ${targetZones.join(', ') || 'libero'}\nZone più trascurate da recuperare: ${suggestedRecoveryZones.join(', ') || 'nessuna'}\nPreferenza cardio: ${cardioSportLabel}, intensita ${cardioIntensityLabel}, RPE target ${cardioRpe}/10${cardioDistance > 0 ? `, target ${cardioDistance} km` : ''}${toNumber(cardioDraft.durationMin) > 0 ? `, durata cardio ${Math.round(toNumber(cardioDraft.durationMin))} min` : ''}, meteo ${Math.round(toNumber(cardioDraft.weatherTempC) || DEFAULT_CARDIO_WEATHER.tempC)}°C / ${Math.round(toNumber(cardioDraft.humidityPct) || DEFAULT_CARDIO_WEATHER.humidityPct)}%.\nRecovery autopilot: ${recoveryAutopilotHint.label} (${recoveryAutopilotHint.score}/100) -> ${recoveryAutopilotHint.prompt}\nStorico recente: ${JSON.stringify(recentHistory)}` }
        ]
      });
      const result = parseModelJson(data, { schema: 'workout_plan' });
      const modelUsed = String(data?._shadowMeta?.model || '').trim();
      const confidence = computeWorkoutPlanConfidence(result, workoutPrompt, modelUsed);
      const enrichedResult = {
        ...result,
        confidenceScore: confidence.score,
        confidenceLabel: confidence.label,
        sourceModel: modelUsed || null
      };
      setAiWorkout(enrichedResult);
      setAiHistory(pushAiHistory({
        kind: 'workout_plan',
        title: enrichedResult.title || 'Shadow Protocol',
        prompt: workoutPrompt,
        output: enrichedResult
      }));
      localStorage.setItem('shadow_monarch_ai_workout', JSON.stringify(enrichedResult));
      setFlowStep('setup');
      playSfx('success', soundEnabled, soundTheme);
      speakEvent('workout_evoked', voiceEnabled, voicePack);
    } catch (error) {
      console.error(error);
      alert("Generazione fallita. Riprova con prompt più preciso.");
    } finally {
      setIsGeneratingWorkout(false);
    }
  };
  const formatHistoryTime = (iso) => {
    if (!iso) return '--';
    try {
      return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '--';
    }
  };
  const applyHistoryPrompt = (entry) => {
    if (!entry?.prompt) return;
    setWorkoutPrompt(entry.prompt);
  };
  const loadHistoryWorkout = (entry) => {
    if (!entry?.output || entry.kind !== 'workout_plan') return;
    setAiWorkout(entry.output);
    localStorage.setItem('shadow_monarch_ai_workout', JSON.stringify(entry.output));
    setFlowStep('setup');
  };
  const deleteWorkoutSession = (session) => {
    if (!session?.id) return;
    const burnToRemove = Math.max(0, Math.round(Number(session?.burnedKcal || 0)));
    const dateKey = toDayMonthKey(session?.date || Date.now());
    applyWorkoutHistoryChange((prev) => prev.filter((item) => item.id !== session.id), 'Delete session');
    if (lastSessionSummary?.id === session.id) setLastSessionSummary(null);
    if (burnToRemove > 0 && dateKey) removeBurnedFromDateLog(dateKey, burnToRemove);
    emitUiToast({ message: 'Sessione rimossa dallo storico', tone: 'success', durationMs: 2200 });
  };
  const openSessionEditor = (session) => {
    if (!session?.id) return;
    setEditingSessionId(session.id);
    setHistoryEditDraft({
      title: String(session?.title || ''),
      rank: String(session?.rank || 'C'),
      sportId: String(session?.cardio?.sportId || 'none'),
      intensityId: String(session?.cardio?.intensityId || 'medium'),
      distanceKm: String(session?.cardio?.distanceKm || ''),
      durationMin: String(session?.cardio?.durationMin || ''),
      rpe: String(session?.cardio?.rpe || 6),
      paceMinPerKm: String(session?.cardio?.paceMinPerKm || ''),
      reportedKcal: String(session?.cardio?.reportedKcal || ''),
      burnedKcal: String(session?.burnedKcal || 0)
    });
  };
  const cancelSessionEditor = () => {
    setEditingSessionId('');
    setHistoryEditDraft(null);
  };
  const saveSessionEditor = (session) => {
    if (!session?.id || !historyEditDraft) return;
    const oldBurn = Math.max(0, Math.round(Number(session?.burnedKcal || 0)));
    const nextBurn = Math.max(0, Math.round(toNumber(historyEditDraft.burnedKcal)));
    const burnDelta = nextBurn - oldBurn;
    const dateKey = toDayMonthKey(session?.date || Date.now());
    const distanceKm = Math.max(0, toNumber(historyEditDraft.distanceKm));
    const durationMin = Math.max(0, toNumber(historyEditDraft.durationMin));
    const rpe = Math.max(1, Math.min(10, Math.round(toNumber(historyEditDraft.rpe) || 6)));
    const paceMinPerKm = toNumber(historyEditDraft.paceMinPerKm) > 0
      ? toNumber(historyEditDraft.paceMinPerKm)
      : computePaceMinPerKm(distanceKm, durationMin);
    const zone = getCardioZone({
      rpe,
      paceMinPerKm,
      intensityId: historyEditDraft.intensityId,
      sportId: historyEditDraft.sportId
    });
    applyWorkoutHistoryChange((prev) => prev.map((row) => {
      if (row.id !== session.id) return row;
      return {
        ...row,
        title: String(historyEditDraft.title || row.title || 'Shadow Protocol'),
        rank: String(historyEditDraft.rank || row.rank || 'C').toUpperCase(),
        burnedKcal: nextBurn,
        cardio: {
          ...(row.cardio || {}),
          sportId: String(historyEditDraft.sportId || row?.cardio?.sportId || 'none'),
          sportLabel: CARDIO_SPORTS.find((s) => s.id === String(historyEditDraft.sportId || row?.cardio?.sportId || 'none'))?.label || row?.cardio?.sportLabel || 'No Cardio',
          intensityId: String(historyEditDraft.intensityId || row?.cardio?.intensityId || 'medium'),
          intensityLabel: CARDIO_INTENSITY.find((it) => it.id === String(historyEditDraft.intensityId || row?.cardio?.intensityId || 'medium'))?.label || row?.cardio?.intensityLabel || 'Medium',
          distanceKm,
          durationMin,
          rpe,
          paceMinPerKm,
          reportedKcal: Math.max(0, Math.round(toNumber(historyEditDraft.reportedKcal))),
          zoneId: zone.id,
          zoneLabel: zone.label
        }
      };
    }), 'Edit session');
    if (burnDelta > 0 && dateKey) addBurnedToDateLog(dateKey, burnDelta);
    if (burnDelta < 0 && dateKey) removeBurnedFromDateLog(dateKey, Math.abs(burnDelta));
    if (lastSessionSummary?.id === session.id) {
      setLastSessionSummary((prev) => prev ? ({
        ...prev,
        title: String(historyEditDraft.title || prev.title || 'Shadow Protocol'),
        rank: String(historyEditDraft.rank || prev.rank || 'C').toUpperCase(),
        burnedKcal: nextBurn,
        cardio: {
          ...(prev.cardio || {}),
          sportId: String(historyEditDraft.sportId || prev?.cardio?.sportId || 'none'),
          intensityId: String(historyEditDraft.intensityId || prev?.cardio?.intensityId || 'medium'),
          distanceKm,
          durationMin,
          rpe,
          paceMinPerKm,
          reportedKcal: Math.max(0, Math.round(toNumber(historyEditDraft.reportedKcal))),
          zoneId: zone.id,
          zoneLabel: zone.label
        }
      }) : prev);
    }
    cancelSessionEditor();
    emitUiToast({ message: 'Sessione aggiornata', tone: 'success', durationMs: 1800 });
  };

  const startWorkoutSession = () => {
    if (!aiWorkout?.main?.length) return;
    setBurnEstimateMeta({ state: 'idle', message: '' });
    setIsFinishingWorkout(false);
    const initial = {};
    aiWorkout.main.forEach((exercise, idx) => {
      const targetSets = Math.max(parseInt(exercise.sets, 10) || 1, 1);
      initial[idx] = { completedSets: 0, setsTarget: targetSets, logs: [] };
    });
    setExerciseProgress(initial);
    setExerciseInputs({});
    setActiveExerciseIndex(0);
    setRestRemaining(0);
    setWorkoutRemaining((parseInt(aiWorkout.durationMin, 10) || 40) * 60);
    setIsWorkoutRunning(true);
    setFlowStep('active');
    triggerBattleCue(0, 'Start Sequence');
    playSfx('click', soundEnabled, soundTheme);
    speakEvent('workout_start', voiceEnabled, voicePack);
  };

  const addBurnedToDateLog = (dateKey, burnedKcal) => {
    if (!setSystemLogs || !createEmptyLog) return;
    if (!dateKey) return;
    const safeBurned = Math.max(0, Math.round(Number(burnedKcal || 0)));
    if (!safeBurned) return;
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === dateKey);
      if (idx >= 0) {
        const next = [...prevLogs];
        const currentWorkoutBurn = Math.max(0, Number(next[idx]?.workoutBurn ?? next[idx]?.burned ?? 0));
        const nextWorkoutBurn = currentWorkoutBurn + safeBurned;
        next[idx] = {
          ...next[idx],
          workoutBurn: nextWorkoutBurn,
          burned: nextWorkoutBurn
        };
        return next;
      }
      return [
        ...prevLogs,
        {
          ...createEmptyLog(dateKey),
          workoutBurn: safeBurned,
          burned: safeBurned
        }
      ];
    });
  };
  const removeBurnedFromDateLog = (dateKey, burnedKcal) => {
    if (!setSystemLogs || !createEmptyLog) return;
    if (!dateKey) return;
    const safeBurned = Math.max(0, Math.round(Number(burnedKcal || 0)));
    if (!safeBurned) return;
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === dateKey);
      if (idx < 0) return prevLogs;
      const next = [...prevLogs];
      const currentWorkoutBurn = Math.max(0, Number(next[idx]?.workoutBurn ?? next[idx]?.burned ?? 0));
      const nextWorkoutBurn = Math.max(0, currentWorkoutBurn - safeBurned);
      next[idx] = {
        ...next[idx],
        workoutBurn: nextWorkoutBurn,
        burned: nextWorkoutBurn
      };
      return next;
    });
  };
  const addBurnedToTodayLog = (burnedKcal) => addBurnedToDateLog(today, burnedKcal);
  const removeBurnedFromTodayLog = (burnedKcal) => removeBurnedFromDateLog(today, burnedKcal);

  const estimateWorkoutBurnWithAI = async (summary) => {
    if (!summary) return;
    try {
      setBurnEstimateMeta({ state: 'estimating', message: 'Estimating burn...' });
      const profileWeight = Number(playerStats?.currentWeightKg || 0);
      const profileHeight = Number(playerStats?.heightCm || 0);
      const profileAge = Number(playerStats?.age || 0);
      const cardioDistance = Math.max(0, Number(summary?.cardio?.distanceKm || 0));
      const cardioDuration = Math.max(0, Number(summary?.cardio?.durationMin || 0));
      const cardioSportId = String(summary?.cardio?.sportId || 'none');
      const cardioIntensityId = String(summary?.cardio?.intensityId || 'medium');
      const cardioSportLabel = CARDIO_SPORTS.find((item) => item.id === cardioSportId)?.label || 'No Cardio';
      const cardioIntensityLabel = CARDIO_INTENSITY.find((item) => item.id === cardioIntensityId)?.label || 'Medium';
      const cardioRpe = Math.max(1, Math.min(10, Number(summary?.cardio?.rpe || 6)));
      const cardioModelBurn = estimateCardioBurnKcal({
        sportId: cardioSportId,
        intensityId: cardioIntensityId,
        distanceKm: cardioDistance,
        durationMin: cardioDuration,
        weightKg: profileWeight || 70,
        paceMinPerKm: Number(summary?.cardio?.paceMinPerKm || 0),
        weatherTempC: summary?.cardio?.weather?.tempC ?? DEFAULT_CARDIO_WEATHER.tempC,
        humidityPct: summary?.cardio?.weather?.humidityPct ?? DEFAULT_CARDIO_WEATHER.humidityPct,
        rpe: cardioRpe,
        calibrationFactor: Number(summary?.cardio?.calibrationFactor || cardioCalibrationFactor || 1)
      });
      const reportedKcal = Math.max(0, Number(summary?.cardio?.reportedKcal || 0));
      const payload = await requestSystemAI({
        temperature: 0.05,
        max_tokens: 220,
        timeoutMs: 28000,
        messages: [
          {
            role: 'system',
            content:
              'Sei un coach fitness data-driven. Stima le kcal bruciate del workout in modo realistico e conservativo, considerando durata reale, numero set completati, intensita stimata e profilo atleta. Rispondi ESCLUSIVAMENTE in JSON valido con schema: {"kcalBurned":numero_intero,"confidence":"low|medium|high","note":"string breve"}. Nessun testo extra.'
          },
          {
            role: 'user',
            content: `Profilo: peso ${profileWeight || 'n/a'} kg, altezza ${profileHeight || 'n/a'} cm, eta ${profileAge || 'n/a'}.\nSessione: ${summary.title}, rank ${summary.rank}, durata prevista ${summary.plannedMinutes} min, esercizi ${summary.exercises.length}, set completati ${summary.exercises.reduce((s, ex) => s + Number(ex.completedSets || 0), 0)}, reps reali totali ${Math.round(Number(summary.totalLoggedReps || 0))}, media reps/set ${Number(summary.avgRepsPerSet || 0).toFixed(1)}, indice forza ${Math.round(summary.strengthIndex || 0)}, focus ${(summary.focusTags || []).join(', ') || 'general'}.\nCardio: ${cardioSportLabel}, intensita ${cardioIntensityLabel}, RPE ${cardioRpe}/10, distanza ${cardioDistance} km, durata ${cardioDuration} min, passo ${Number(summary?.cardio?.paceMinPerKm || 0).toFixed(2)} min/km, meteo ${summary?.cardio?.weather?.tempC ?? DEFAULT_CARDIO_WEATHER.tempC}°C / ${summary?.cardio?.weather?.humidityPct ?? DEFAULT_CARDIO_WEATHER.humidityPct}%.\nStima kcal solo allenamento.`
          }
        ]
      });
      const parsed = parseModelJson(payload, { schema: 'workout_burn_estimate' });
      const aiBurn = clampBurnKcal(parsed?.kcalBurned, summary.plannedMinutes || 40);
      const cardioFloor = cardioSportId !== 'none' && cardioDistance > 0
        ? Math.round(cardioModelBurn * 0.82)
        : 0;
      const reportedAnchor = reportedKcal > 0 ? Math.round(reportedKcal * 0.9) : 0;
      const hybrid = Math.round((aiBurn * 0.65) + (cardioModelBurn * 0.35));
      const burned = clampBurnKcal(Math.max(aiBurn, hybrid, cardioFloor, reportedAnchor), summary.plannedMinutes || 40);
      if (!burned) throw new Error('stima kcal vuota');

      addBurnedToTodayLog(burned);
      applyWorkoutHistoryChange((prev) =>
        prev.map((entry) =>
          entry.id === summary.id
            ? { ...entry, burnedKcal: burned, burnedConfidence: parsed?.confidence || 'medium', cardioModelBurn }
            : entry
        ), 'Burn estimate sync', false
      );
      setLastSessionSummary((prev) =>
        prev && prev.id === summary.id
          ? { ...prev, burnedKcal: burned, burnedConfidence: parsed?.confidence || 'medium', burnedNote: parsed?.note || '', cardioModelBurn }
          : prev
      );
      setBurnEstimateMeta({ state: 'done', message: `Burn stimato: +${burned} kcal` });
      emitUiToast({
        message: `Burn AI applicato: +${burned} kcal`,
        tone: 'success',
        actionLabel: 'Undo 30s',
        durationMs: 30000,
        onAction: () => {
          removeBurnedFromTodayLog(burned);
          applyWorkoutHistoryChange((prev) =>
            prev.map((entry) =>
              entry.id === summary.id
                ? { ...entry, burnedKcal: 0, burnedConfidence: '', burnedNote: 'Undo burn' }
                : entry
            ), 'Undo burn action', false
          );
          setLastSessionSummary((prev) =>
            prev && prev.id === summary.id
              ? { ...prev, burnedKcal: 0, burnedConfidence: '', burnedNote: 'Undo burn' }
              : prev
          );
          emitUiToast({ message: 'Burn annullato', tone: 'success', durationMs: 2200 });
        }
      });
      playSfx('success', soundEnabled, soundTheme);
    } catch (error) {
      const reason = formatAiErrorDetail(error?.message || 'errore AI');
      const fallbackBurn = estimateFallbackBurnKcal(summary);
      if (fallbackBurn > 0) {
        addBurnedToTodayLog(fallbackBurn);
        applyWorkoutHistoryChange((prev) =>
          prev.map((entry) =>
            entry.id === summary.id
              ? { ...entry, burnedKcal: fallbackBurn, burnedConfidence: 'low', burnedNote: 'Fallback locale' }
              : entry
          ), 'Fallback burn sync', false
        );
        setLastSessionSummary((prev) =>
          prev && prev.id === summary.id
            ? { ...prev, burnedKcal: fallbackBurn, burnedConfidence: 'low', burnedNote: `Fallback locale (${reason})` }
            : prev
        );
        setBurnEstimateMeta({ state: 'fallback', message: `Burn stimato (fallback): +${fallbackBurn} kcal` });
        emitUiToast({
          message: `Burn fallback applicato: +${fallbackBurn} kcal`,
          tone: 'warning',
          actionLabel: 'Undo 30s',
          durationMs: 30000,
          onAction: () => {
            removeBurnedFromTodayLog(fallbackBurn);
            applyWorkoutHistoryChange((prev) =>
              prev.map((entry) =>
                entry.id === summary.id
                  ? { ...entry, burnedKcal: 0, burnedConfidence: '', burnedNote: 'Undo burn' }
                  : entry
              ), 'Undo fallback burn', false
            );
            setLastSessionSummary((prev) =>
              prev && prev.id === summary.id
                ? { ...prev, burnedKcal: 0, burnedConfidence: '', burnedNote: 'Undo burn' }
                : prev
            );
            emitUiToast({ message: 'Burn annullato', tone: 'success', durationMs: 2200 });
          }
        });
      } else {
        setBurnEstimateMeta({ state: 'failed', message: `Stima burn non disponibile (${reason})` });
      }
      console.error(error);
    } finally {
      setIsFinishingWorkout(false);
    }
  };

  const finishWorkoutSession = () => {
    if (isFinishingWorkout) return;
    setIsFinishingWorkout(true);
    const currentWorkout = sessionRef.current.aiWorkout;
    const currentProgress = sessionRef.current.exerciseProgress;
    if (!currentWorkout?.main) {
      setIsWorkoutRunning(false);
      setFlowStep('debrief');
      setIsFinishingWorkout(false);
      return;
    }
    const exerciseRows = currentWorkout.main.map((exercise, idx) => {
      const p = currentProgress[idx] || { completedSets: 0, setsTarget: parseInt(exercise.sets, 10) || 1, logs: [] };
      const avgRepsLogged = (p.logs || []).length
        ? Math.round((p.logs || []).reduce((sum, log) => sum + Math.max(0, toNumber(log.repsDone)), 0) / (p.logs || []).length)
        : Math.max(0, toNumber(exercise.reps || 0));
      const topSet = (p.logs || []).reduce((best, log) => {
        const repsForStrength = Math.max(1, toNumber(log.repsDone || avgRepsLogged || exercise.reps || 1));
        const strength = estimateSetStrength(log.kg, repsForStrength);
        if (!best || strength > best.strength) return { strength, kg: toNumber(log.kg), reps: Math.max(0, toNumber(log.repsDone || avgRepsLogged)) };
        return best;
      }, null);
      return {
        name: exercise.name,
        completedSets: p.completedSets,
        setsTarget: p.setsTarget,
        logs: p.logs,
        topKg: topSet?.kg || 0,
        topReps: topSet?.reps || 0,
        strength: topSet?.strength || 0,
        focusTags: detectFocusTags(exercise.name)
      };
    });
    const focusTags = Array.from(new Set(exerciseRows.flatMap((row) => row.focusTags))).slice(0, 4);
    const strengthIndex = exerciseRows.reduce((sum, row) => sum + row.strength, 0);
    const totalLoggedSets = exerciseRows.reduce((sum, row) => sum + Math.max(0, Number(row.completedSets || 0)), 0);
    const totalLoggedReps = exerciseRows.reduce((sum, row) => (
      sum + (row.logs || []).reduce((repSum, log) => repSum + Math.max(0, toNumber(log.repsDone)), 0)
    ), 0);
    const avgRepsPerSet = totalLoggedSets > 0 ? Number((totalLoggedReps / totalLoggedSets).toFixed(1)) : 0;
    const cardioSportId = String(cardioDraft.sportId || 'none');
    const cardioIntensityId = String(cardioDraft.intensityId || 'medium');
    const cardioIntensityLabel = CARDIO_INTENSITY.find((item) => item.id === cardioIntensityId)?.label || 'Medium';
    const cardioRpe = Math.max(1, Math.min(10, Math.round(toNumber(cardioDraft.rpe) || 6)));
    const cardioDistanceKm = Math.max(0, toNumber(cardioDraft.distanceKm));
    const cardioReportedKcal = Math.max(0, Math.round(toNumber(cardioDraft.reportedKcal)));
    const cardioDurationFromInput = Math.max(0, toNumber(cardioDraft.durationMin));
    const cardioDurationMin = cardioSportId !== 'none'
      ? (cardioDurationFromInput > 0
          ? cardioDurationFromInput
          : Math.max(8, Math.round((parseInt(currentWorkout.durationMin, 10) || 40) * (cardioDistanceKm > 0 ? 0.55 : 0.35))))
      : 0;
    const paceMinPerKm = computePaceMinPerKm(cardioDistanceKm, cardioDurationMin);
    const weatherTempC = Number.isFinite(toNumber(cardioDraft.weatherTempC)) ? toNumber(cardioDraft.weatherTempC) : DEFAULT_CARDIO_WEATHER.tempC;
    const humidityPct = Number.isFinite(toNumber(cardioDraft.humidityPct)) ? toNumber(cardioDraft.humidityPct) : DEFAULT_CARDIO_WEATHER.humidityPct;
    const cardioLabel = CARDIO_SPORTS.find((item) => item.id === cardioSportId)?.label || 'No Cardio';
    const cardioZone = getCardioZone({
      rpe: cardioRpe,
      paceMinPerKm,
      intensityId: cardioIntensityId,
      sportId: cardioSportId
    });
    const hydrationGuide = buildCardioRecoveryGuide({
      sportId: cardioSportId,
      intensityId: cardioIntensityId,
      distanceKm: cardioDistanceKm,
      durationMin: cardioDurationMin,
      weightKg: Number(playerStats?.currentWeightKg || 70),
      weatherTempC,
      humidityPct,
      rpe: cardioRpe
    });
    const summary = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      title: currentWorkout.title || 'Shadow Protocol',
      rank: currentWorkout.difficulty || 'C',
      plannedMinutes: parseInt(currentWorkout.durationMin, 10) || 40,
      focus: currentWorkout.focus || 'focus libero',
      focusTags: cardioSportId !== 'none' && !focusTags.includes('Cardio') ? [...focusTags, 'Cardio'] : focusTags,
      strengthIndex,
      totalLoggedSets,
      totalLoggedReps,
      avgRepsPerSet,
      exercises: exerciseRows,
      cardio: {
        sportId: cardioSportId,
        sportLabel: cardioLabel,
        intensityId: cardioIntensityId,
        intensityLabel: cardioIntensityLabel,
        rpe: cardioRpe,
        distanceKm: cardioDistanceKm,
        durationMin: cardioDurationMin,
        paceMinPerKm,
        weather: { tempC: weatherTempC, humidityPct },
        reportedKcal: cardioReportedKcal,
        zoneId: cardioZone.id,
        zoneLabel: cardioZone.label,
        calibrationFactor: cardioCalibrationFactor,
        hydrationExtraMl: hydrationGuide.hydrationExtraMl,
        supplementTips: hydrationGuide.supplements
      },
      athleteProfile: {
        weightKg: Number(playerStats?.currentWeightKg || 70)
      },
      burnedKcal: 0,
      burnedConfidence: '',
      burnedNote: ''
    };
    applyWorkoutHistoryChange((prev) => [summary, ...prev].slice(0, 30), 'Add session', false);
    setLastSessionSummary(summary);
    setIsWorkoutRunning(false);
    setWorkoutRemaining(0);
    setRestRemaining(0);
    setExerciseProgress({});
    setExerciseInputs({});
    setActiveExerciseIndex(0);
    setAiWorkout(null);
    localStorage.removeItem('shadow_monarch_ai_workout');
    setFlowStep('debrief');
    setBurnEstimateMeta({ state: 'estimating', message: 'Estimating burn...' });
    estimateWorkoutBurnWithAI(summary);
    if (cardioSportId !== 'none') {
      emitUiToast({
        message: `${hydrationGuide.hydrationPrompt} • ${hydrationGuide.supplements[0] || 'Recupero elettroliti consigliato.'}`,
        tone: 'warning',
        durationMs: 5200
      });
    }
    triggerBattleCue(2, 'Finisher Sequence');
    const streakMultiplier = 1 + Math.min((playerStats.streak || 0), 30) / 100;
    const longJourneyFactor = 0.55;
    const gainedExp = Math.round(60 * streakMultiplier * longJourneyFactor);
    const gainedGold = Math.round(35 * streakMultiplier * longJourneyFactor);
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + gainedExp,
      gold: (prev.gold || 0) + gainedGold,
      completedWorkouts: (prev.completedWorkouts || 0) + 1,
      lastWorkoutDate: today
    }));
    playSfx('success', soundEnabled, soundTheme);
    speakEvent('workout_clear', voiceEnabled, voicePack);
  };

  const handleExerciseInput = (index, field, value) => {
    setExerciseInputs((prev) => ({ ...prev, [index]: { ...prev[index], [field]: value } }));
  };

  const logExerciseSet = (index) => {
    if (!isWorkoutRunning || !aiWorkout?.main?.[index]) return;
    const exercise = aiWorkout.main[index];
    const input = exerciseInputs[index] || {};
    const restSec = Math.max(parseInt(exercise.restSec, 10) || 60, 15);

    setExerciseProgress((prev) => {
      const current = prev[index] || { completedSets: 0, setsTarget: Math.max(parseInt(exercise.sets, 10) || 1, 1), logs: [] };
      const nextCompleted = Math.min(current.completedSets + 1, current.setsTarget);
      const next = {
        ...prev,
        [index]: {
          ...current,
          completedSets: nextCompleted,
          logs: [...current.logs, {
            time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            kg: input.kg || '',
            repsDone: String(input.repsDone || '').trim() !== '' ? Math.max(0, Math.round(toNumber(input.repsDone))) : (exercise.reps || '')
          }]
        }
      };
      if (nextCompleted >= current.setsTarget) {
        const nextIndex = aiWorkout.main.findIndex((_, exIdx) => (next[exIdx]?.completedSets || 0) < (next[exIdx]?.setsTarget || 1));
        if (nextIndex >= 0) setActiveExerciseIndex(nextIndex);
      }
      return next;
    });
    setRestRemaining(restSec);
    setRestFxKey(Date.now());
    triggerBattleCue(1, `Set Logged • ${exercise.name}`);
    playSfx('click', soundEnabled, soundTheme);
  };

  const toggleBodyZone = (tag) => {
    setSelectedBodyZones((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
    playSfx('nav', soundEnabled, soundTheme);
  };

  const workoutExercises = Array.isArray(aiWorkout?.main) ? aiWorkout.main : [];
  const cardioDraftDistanceKm = Math.max(0, toNumber(cardioDraft.distanceKm));
  const cardioDraftDurationMin = Math.max(0, toNumber(cardioDraft.durationMin));
  const cardioDraftRpe = Math.max(1, Math.min(10, Math.round(toNumber(cardioDraft.rpe) || 6)));
  const cardioDraftPace = computePaceMinPerKm(cardioDraftDistanceKm, cardioDraftDurationMin);
  const cardioDraftTempC = Number.isFinite(toNumber(cardioDraft.weatherTempC)) ? toNumber(cardioDraft.weatherTempC) : DEFAULT_CARDIO_WEATHER.tempC;
  const cardioDraftHumidityPct = Number.isFinite(toNumber(cardioDraft.humidityPct)) ? toNumber(cardioDraft.humidityPct) : DEFAULT_CARDIO_WEATHER.humidityPct;
  const cardioDraftBurnPreview = estimateCardioBurnKcal({
    sportId: String(cardioDraft.sportId || 'none'),
    intensityId: String(cardioDraft.intensityId || 'medium'),
    distanceKm: cardioDraftDistanceKm,
    durationMin: cardioDraftDurationMin,
    weightKg: Number(playerStats?.currentWeightKg || 70),
    paceMinPerKm: cardioDraftPace,
    weatherTempC: cardioDraftTempC,
    humidityPct: cardioDraftHumidityPct,
    rpe: cardioDraftRpe,
    calibrationFactor: cardioCalibrationFactor
  });
  const cardioDraftReportedKcal = Math.max(0, Math.round(toNumber(cardioDraft.reportedKcal)));
  const latestHealthLog = useMemo(() => {
    const logs = Array.isArray(systemLogs) ? systemLogs : [];
    const recent = [...logs].reverse().find((row) => {
      const sleep = Math.max(0, Number(row?.sleepHours || 0));
      const hrv = Math.max(0, Number(row?.hrvMs || 0));
      const hrRest = Math.max(0, Number(row?.hrRest || 0));
      return sleep > 0 || hrv > 0 || hrRest > 0;
    });
    return recent || null;
  }, [systemLogs]);
  const recoveryAutopilotHint = useMemo(() => {
    if (!recoveryAutopilotEnabled) {
      return { mode: 'manual', score: 70, label: 'Manual', prompt: 'Nessun adjustment automatico.' };
    }
    const sleep = Math.max(0, Number(latestHealthLog?.sleepHours || 0));
    const hrv = Math.max(0, Number(latestHealthLog?.hrvMs || 0));
    const hrRest = Math.max(0, Number(latestHealthLog?.hrRest || 0));
    const stress = Math.max(0, Number(playerStats?.stressLevel || 4));
    let score = 62;
    if (sleep > 0) score += Math.max(-16, Math.min(16, (sleep - 7) * 5));
    if (hrv > 0) score += Math.max(-12, Math.min(12, (hrv - 42) * 0.55));
    if (hrRest > 0) score -= Math.max(-10, Math.min(15, (hrRest - 58) * 0.7));
    score -= Math.max(0, Math.min(12, (stress - 5) * 2));
    const safe = Math.max(25, Math.min(95, Math.round(score)));
    if (safe < 45) return { mode: 'low', score: safe, label: 'Recovery', prompt: 'Riduci volume del 25%, recuperi +20%, tecnica pulita, niente finisher ad alta intensita.' };
    if (safe < 62) return { mode: 'mid', score: safe, label: 'Controlled', prompt: 'Riduci volume del 10-15%, carichi tecnici, mantieni RPE medio.' };
    return { mode: 'high', score: safe, label: 'Attack', prompt: 'Sessione completa consentita, progressione normale.' };
  }, [recoveryAutopilotEnabled, latestHealthLog, playerStats?.stressLevel]);
  const totalTargetSets = workoutExercises.reduce((sum, ex) => sum + Math.max(parseInt(ex.sets, 10) || 1, 1), 0);
  const totalLoggedSets = Object.values(exerciseProgress).reduce((sum, ex) => sum + (ex.completedSets || 0), 0);
  const completionPct = totalTargetSets > 0 ? Math.min(Math.round((totalLoggedSets / totalTargetSets) * 100), 100) : 0;
  const streakMultiplier = 1 + Math.min((playerStats.streak || 0), 30) / 100;
  const aiWorkoutZones = Array.from(new Set(workoutExercises.flatMap((ex) => detectFocusTags(ex.name))));
  const trainedZones = Array.from(new Set(Object.entries(exerciseProgress)
    .filter(([, progress]) => (progress?.completedSets || 0) > 0)
    .flatMap(([index]) => detectFocusTags(workoutExercises[Number(index)]?.name || ''))));
  const lastWorkoutDate = workoutHistory[0]?.date ? new Date(workoutHistory[0].date) : null;
  const daysSinceLastWorkout = lastWorkoutDate ? Math.max(0, Math.floor((Date.now() - lastWorkoutDate.getTime()) / 86400000)) : 0;
  const recentZoneSet = new Set(workoutHistory.slice(0, 3).flatMap((session) => session.focusTags || []));
  const freshGroupsCount = BODY_ZONES.filter((zone) => !recentZoneSet.has(zone.tag)).length;
  const currentWeekKey = getWeekKey();
  const currentWeekSessions = workoutHistory.filter((session) => getWeekKey(session.date) === currentWeekKey).length;
  const weeklyGoal = 4;
  const weeklyPct = Math.min(100, Math.round((currentWeekSessions / weeklyGoal) * 100));
  const weeklyNodes = Array.from({ length: weeklyGoal }, (_, idx) => idx < currentWeekSessions);
  const weeklySessionsLeft = Math.max(0, weeklyGoal - currentWeekSessions);
  const currentWeekCardioKm = Number(workoutHistory
    .filter((session) => getWeekKey(session.date) === currentWeekKey)
    .reduce((sum, session) => sum + Math.max(0, Number(session?.cardio?.distanceKm || 0)), 0)
    .toFixed(1));
  const cardioWeeklyPct = Math.min(100, Math.round((currentWeekCardioKm / Math.max(1, Number(cardioWeeklyGoalKm || 20))) * 100));
  const cardioWeeklyLeftKm = Math.max(0, Number((Number(cardioWeeklyGoalKm || 20) - currentWeekCardioKm).toFixed(1)));
  const weeklyTrainingStreak = Math.max(0, Number(playerStats?.weeklyTrainingStreak || 0));
  const fireLevel = Math.min(5, Math.max(1, Math.floor(weeklyTrainingStreak / 2) + 1));
  const fireIcons = weeklyTrainingStreak > 0 ? `CORE x${fireLevel}` : 'INIT';
  const weeklyCrownTier = weeklyTrainingStreak >= 24
    ? 'MYTHIC'
    : weeklyTrainingStreak >= 12
      ? 'LEGEND'
      : weeklyTrainingStreak >= 6
        ? 'ELITE'
        : weeklyTrainingStreak >= 3
          ? 'RISING'
          : 'INIT';
  const weeklyCrownTone = weeklyTrainingStreak >= 12
    ? 'text-fuchsia-200'
    : weeklyTrainingStreak >= 6
      ? 'text-amber-200'
      : 'text-cyan-200';
  const weeklyCrownBadgeTone = weeklyTrainingStreak >= 24
    ? 'border-fuchsia-300/60 text-fuchsia-100 bg-fuchsia-500/15 shadow-[0_0_18px_rgba(217,70,239,0.34)]'
    : weeklyTrainingStreak >= 12
      ? 'border-violet-300/55 text-violet-100 bg-violet-500/12 shadow-[0_0_16px_rgba(139,92,246,0.28)]'
      : weeklyTrainingStreak >= 6
        ? 'border-amber-300/55 text-amber-100 bg-amber-500/12 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
        : weeklyTrainingStreak >= 3
          ? 'border-cyan-300/50 text-cyan-100 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.24)]'
          : 'border-white/20 text-gray-300 bg-white/5';
  const weeklyCrownEmblem = weeklyTrainingStreak >= 24
    ? '◉'
    : weeklyTrainingStreak >= 12
      ? '◆'
      : weeklyTrainingStreak >= 6
        ? '▲'
        : weeklyTrainingStreak >= 3
          ? '◈'
          : '·';
  const weeklyCrownEmblemClass = weeklyTrainingStreak >= 24
    ? 'crown-emblem-mythic'
    : weeklyTrainingStreak >= 12
      ? 'crown-emblem-legend'
      : weeklyTrainingStreak >= 6
        ? 'crown-emblem-elite'
        : weeklyTrainingStreak >= 3
          ? 'crown-emblem-rising'
          : 'crown-emblem-init';
  const weeklyCrownFxLabel = !crownAnthemEnabled
    ? 'OFF'
    : weeklyTrainingStreak >= 24
      ? 'MYTHIC MODE'
      : weeklyTrainingStreak >= 12
        ? 'LEGEND MODE'
        : 'ENABLED';
  const weeklyHistory = useMemo(() => {
    const byWeek = workoutHistory.reduce((acc, session) => {
      const key = getWeekKey(session.date);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Array.from({ length: 8 }, (_, idx) => {
      const weeksAgo = 7 - idx;
      const date = new Date();
      date.setDate(date.getDate() - (weeksAgo * 7));
      const key = getWeekKey(date);
      const sessions = Number(byWeek[key] || 0);
      return {
        key,
        label: weeksAgo === 0 ? 'NOW' : `-${weeksAgo}W`,
        sessions,
        done: sessions >= weeklyGoal
      };
    });
  }, [workoutHistory]);
  const cardioWeekHistory = useMemo(() => {
    const byWeek = workoutHistory.reduce((acc, session) => {
      const key = getWeekKey(session.date);
      acc[key] = (acc[key] || 0) + Math.max(0, Number(session?.cardio?.distanceKm || 0));
      return acc;
    }, {});
    return Array.from({ length: 8 }, (_, idx) => {
      const weeksAgo = 7 - idx;
      const date = new Date();
      date.setDate(date.getDate() - (weeksAgo * 7));
      const key = getWeekKey(date);
      const km = Number((byWeek[key] || 0).toFixed(1));
      return {
        key,
        label: weeksAgo === 0 ? 'NOW' : `-${weeksAgo}W`,
        km,
        done: km >= Number(cardioWeeklyGoalKm || 20)
      };
    });
  }, [workoutHistory, cardioWeeklyGoalKm]);
  const cardioWeeklyStreak = useMemo(() => {
    let run = 0;
    for (let i = cardioWeekHistory.length - 1; i >= 0; i -= 1) {
      if (!cardioWeekHistory[i]?.done) break;
      run += 1;
    }
    return run;
  }, [cardioWeekHistory]);
  const perfectRun = useMemo(() => {
    let run = 0;
    for (let i = weeklyHistory.length - 1; i >= 0; i -= 1) {
      if (!weeklyHistory[i]?.done) break;
      run += 1;
    }
    return run;
  }, [weeklyHistory]);
  const momentumPct = Math.min(100, Math.round(((currentWeekSessions * 0.72) + (Math.min(weeklyTrainingStreak, 10) * 0.28)) / weeklyGoal * 100));
  const strengthTrend = workoutHistory.slice(0, 8).map((session, idx, arr) => {
    const prev = arr[idx + 1];
    const delta = prev ? (session.strengthIndex || 0) - (prev.strengthIndex || 0) : 0;
    return { id: session.id, date: session.date, value: Math.round(session.strengthIndex || 0), delta };
  });
  const avgStrength = strengthTrend.length ? Math.round(strengthTrend.reduce((sum, row) => sum + row.value, 0) / strengthTrend.length) : 0;
  const distractionFree = focusMode && (isWorkoutRunning || flowStep === 'active');
  const personalRecords = useMemo(() => {
    const sessions = Array.isArray(workoutHistory) ? workoutHistory : [];
    let topKg = 0;
    let topVolume = 0;
    sessions.forEach((session) => {
      const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
      let sessionVolume = 0;
      exercises.forEach((exercise) => {
        const logs = Array.isArray(exercise?.logs) ? exercise.logs : [];
        logs.forEach((log) => {
          const kg = toNumber(log?.kg);
          const reps = Math.max(0, toNumber(log?.repsDone));
          if (kg > topKg) topKg = kg;
          sessionVolume += (kg * reps);
        });
      });
      if (sessionVolume > topVolume) topVolume = sessionVolume;
    });
    return {
      topKg: Math.round(topKg),
      topVolume: Math.round(topVolume),
      bestStrength: Math.round(Math.max(0, ...sessions.map((session) => Number(session?.strengthIndex || 0)))),
      totalSessions: sessions.length
    };
  }, [workoutHistory]);
  const historyMonthOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    workoutHistory.forEach((session) => {
      const date = new Date(session?.date || Date.now());
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        key,
        label: date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
      });
    });
    return options;
  }, [workoutHistory]);
  const historyTypeOptions = ['all', 'Cardio', 'Push', 'Pull', 'Lower', 'Shoulders', 'Core', 'General'];
  const filteredHistory = useMemo(() => {
    const search = String(historySearch || '').trim().toLowerCase();
    return workoutHistory.filter((session) => {
      const date = new Date(session?.date || Date.now());
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const tags = Array.isArray(session?.focusTags) ? session.focusTags : [];
      const monthOk = historyMonthFilter === 'all' || historyMonthFilter === monthKey;
      const typeOk = historyTypeFilter === 'all' || tags.includes(historyTypeFilter);
      const text = `${String(session?.title || '')} ${String(session?.rank || '')} ${String(session?.planPrompt || '')} ${String(session?.notes || '')} ${tags.join(' ')}`.toLowerCase();
      const searchOk = !search || text.includes(search);
      return monthOk && typeOk && searchOk;
    });
  }, [workoutHistory, historyMonthFilter, historyTypeFilter, historySearch]);
  const filteredHistoryStats = useMemo(() => {
    const sessions = filteredHistory;
    const totalBurn = sessions.reduce((sum, session) => sum + Math.max(0, Number(session?.burnedKcal || 0)), 0);
    const avgStrengthFiltered = sessions.length
      ? Math.round(sessions.reduce((sum, session) => sum + Math.max(0, Number(session?.strengthIndex || 0)), 0) / sessions.length)
      : 0;
    const bestRank = sessions.reduce((best, session) => {
      const rank = String(session?.rank || 'D').toUpperCase();
      const order = ['E', 'D', 'C', 'B', 'A', 'S'];
      return order.indexOf(rank) > order.indexOf(best) ? rank : best;
    }, 'E');
    return {
      count: sessions.length,
      totalBurn: Math.round(totalBurn),
      avgStrength: avgStrengthFiltered,
      bestRank
    };
  }, [filteredHistory]);
  const cardioMap = useMemo(() => {
    const sessions = Array.isArray(workoutHistory) ? workoutHistory : [];
    const bySport = {};
    sessions.forEach((session) => {
      const cardio = session?.cardio || {};
      const sportId = String(cardio?.sportId || 'none');
      const distanceKm = Math.max(0, Number(cardio?.distanceKm || 0));
      if (sportId === 'none' && distanceKm <= 0) return;
      if (!bySport[sportId]) {
        bySport[sportId] = {
          sportId,
          sportLabel: String(cardio?.sportLabel || (CARDIO_SPORTS.find((item) => item.id === sportId)?.label || sportId)),
          sessions: 0,
          km: 0,
          kcal: 0
        };
      }
      bySport[sportId].sessions += 1;
      bySport[sportId].km += distanceKm;
      bySport[sportId].kcal += Math.max(0, Number(session?.burnedKcal || 0));
    });
    const items = Object.values(bySport)
      .map((row) => ({
        ...row,
        km: Number(row.km.toFixed(1)),
        kcal: Math.round(row.kcal)
      }))
      .sort((a, b) => b.km - a.km || b.kcal - a.kcal);
    const totalKm = Number(items.reduce((sum, row) => sum + row.km, 0).toFixed(1));
    const totalKcal = Math.round(items.reduce((sum, row) => sum + row.kcal, 0));
    return { items, totalKm, totalKcal };
  }, [workoutHistory]);
  const cardioCalibrationInsights = useMemo(() => {
    const sessions = Array.isArray(workoutHistory) ? workoutHistory.slice(0, 32) : [];
    const samples = [];
    sessions.forEach((session, idx) => {
      const cardio = session?.cardio || {};
      const reported = Math.max(0, Number(cardio?.reportedKcal || 0));
      if (!reported) return;
      const baseModel = estimateCardioBurnKcal({
        sportId: cardio?.sportId || 'none',
        intensityId: cardio?.intensityId || 'medium',
        distanceKm: Number(cardio?.distanceKm || 0),
        durationMin: Number(cardio?.durationMin || 0),
        weightKg: Number(session?.athleteProfile?.weightKg || 70),
        paceMinPerKm: Number(cardio?.paceMinPerKm || 0),
        weatherTempC: cardio?.weather?.tempC ?? DEFAULT_CARDIO_WEATHER.tempC,
        humidityPct: cardio?.weather?.humidityPct ?? DEFAULT_CARDIO_WEATHER.humidityPct,
        rpe: Number(cardio?.rpe || 6),
        calibrationFactor: 1
      });
      if (!baseModel) return;
      const rawRatio = reported / Math.max(1, baseModel);
      const ratio = Math.max(0.72, Math.min(1.35, rawRatio));
      const weight = Math.max(0.58, 1.25 - (idx * 0.03));
      samples.push({ ratio, weight });
    });
    if (!samples.length) return { samples: 0, learnedFactor: 1 };
    const totalWeight = samples.reduce((sum, row) => sum + row.weight, 0);
    const weighted = samples.reduce((sum, row) => sum + (row.ratio * row.weight), 0) / Math.max(1e-6, totalWeight);
    return {
      samples: samples.length,
      learnedFactor: Number(clampCardioCalibration(weighted).toFixed(3))
    };
  }, [workoutHistory]);
  const cardioCommandCenter = useMemo(() => {
    const sessions = (Array.isArray(workoutHistory) ? workoutHistory : [])
      .filter((session) => {
        const cardio = session?.cardio || {};
        const sportId = String(cardio?.sportId || 'none');
        const distance = Math.max(0, Number(cardio?.distanceKm || 0));
        const duration = Math.max(0, Number(cardio?.durationMin || 0));
        return sportId !== 'none' || distance > 0 || duration > 0;
      })
      .slice(0, 60);
    const last28 = sessions.filter((session) => {
      const ts = new Date(session?.date || Date.now()).getTime();
      return Number.isFinite(ts) && ts >= Date.now() - (28 * 86400000);
    });
    const bestDistance = sessions.reduce((best, session) => {
      const km = Math.max(0, Number(session?.cardio?.distanceKm || 0));
      if (!best || km > best.km) return { km, session };
      return best;
    }, null);
    const bestBurn = sessions.reduce((best, session) => {
      const kcal = Math.max(0, Number(session?.burnedKcal || 0));
      if (!best || kcal > best.kcal) return { kcal, session };
      return best;
    }, null);
    const bestPace = sessions.reduce((best, session) => {
      const pace = Math.max(0, Number(session?.cardio?.paceMinPerKm || 0));
      const km = Math.max(0, Number(session?.cardio?.distanceKm || 0));
      if (km < 1 || pace <= 0) return best;
      if (!best || pace < best.pace) return { pace, session };
      return best;
    }, null);
    const totalKm28 = Number(last28.reduce((sum, session) => sum + Math.max(0, Number(session?.cardio?.distanceKm || 0)), 0).toFixed(1));
    const totalBurn28 = Math.round(last28.reduce((sum, session) => sum + Math.max(0, Number(session?.burnedKcal || 0)), 0));
    const totalDuration28 = Math.round(last28.reduce((sum, session) => sum + Math.max(0, Number(session?.cardio?.durationMin || 0)), 0));
    const weightedPace = (() => {
      const withPace = last28.filter((session) => Math.max(0, Number(session?.cardio?.paceMinPerKm || 0)) > 0 && Math.max(0, Number(session?.cardio?.distanceKm || 0)) >= 1);
      const dist = withPace.reduce((sum, session) => sum + Math.max(0, Number(session?.cardio?.distanceKm || 0)), 0);
      if (dist <= 0) return 0;
      const weighted = withPace.reduce((sum, session) => {
        const km = Math.max(0, Number(session?.cardio?.distanceKm || 0));
        const pace = Math.max(0, Number(session?.cardio?.paceMinPerKm || 0));
        return sum + (pace * km);
      }, 0) / dist;
      return Number(weighted.toFixed(2));
    })();
    const advisory = [];
    if (totalKm28 < Number(cardioWeeklyGoalKm || 20)) advisory.push('Aumenta di +1 sessione cardio questa settimana per chiudere il target.');
    if (cardioCalibrationInsights.samples < 3) advisory.push('Inserisci kcal smartwatch per 3+ sessioni: la stima diventa molto piu precisa.');
    if (weightedPace > 0 && weightedPace > 6.4) advisory.push('Pace medio alto: prova blocchi progressivi 5x4 min per migliorare efficienza.');
    if (!advisory.length) advisory.push('Trend cardio solido: mantieni volume e cura il recupero idrico post sessione.');
    return {
      sessions: sessions.length,
      totalKm28,
      totalBurn28,
      totalDuration28,
      weightedPace,
      bestDistance,
      bestBurn,
      bestPace,
      advisory: advisory.slice(0, 2)
    };
  }, [workoutHistory, cardioWeeklyGoalKm, cardioCalibrationInsights.samples]);
  const cardioZoneMix = useMemo(() => {
    const buckets = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    workoutHistory.slice(0, 20).forEach((session) => {
      const cardio = session?.cardio || {};
      const zone = String(cardio?.zoneId || '');
      if (buckets[zone] !== undefined) buckets[zone] += 1;
    });
    const total = Object.values(buckets).reduce((sum, n) => sum + n, 0);
    return {
      total,
      items: [
        { id: 'z1', label: 'Z1', target: 20, value: buckets.z1 },
        { id: 'z2', label: 'Z2', target: 45, value: buckets.z2 },
        { id: 'z3', label: 'Z3', target: 20, value: buckets.z3 },
        { id: 'z4', label: 'Z4', target: 10, value: buckets.z4 },
        { id: 'z5', label: 'Z5', target: 5, value: buckets.z5 }
      ]
    };
  }, [workoutHistory]);
  const sevenDayPrediction = useMemo(() => {
    const recentSessions = workoutHistory.filter((session) => {
      const ts = new Date(session?.date || Date.now()).getTime();
      return Number.isFinite(ts) && ts >= Date.now() - (21 * 86400000);
    });
    const avgBurnPerSession = recentSessions.length
      ? Math.round(recentSessions.reduce((sum, session) => sum + Math.max(0, Number(session?.burnedKcal || 0)), 0) / recentSessions.length)
      : 0;
    const projectedWorkouts = Math.max(2, Math.round((currentWeekSessions || 0) + (weeklyTrainingStreak >= 2 ? 1 : 0)));
    const projectedBurn7d = Math.round(avgBurnPerSession * projectedWorkouts);
    const logs = Array.isArray(systemLogs) ? systemLogs.slice(-14) : [];
    const avgNet = logs.length
      ? logs.reduce((sum, log) => {
        const consumed = Math.max(0, Number(log?.consumed || 0));
        const burned = Math.max(0, Number(log?.burned || log?.workoutBurn || 0));
        return sum + (burned - consumed);
      }, 0) / logs.length
      : 0;
    const projectedWeightDeltaKg = Number(((avgNet * 7) / 7700).toFixed(2));
    return {
      projectedWorkouts,
      projectedBurn7d,
      projectedWeightDeltaKg,
      note: projectedWeightDeltaKg <= -0.45
        ? 'Deficit molto aggressivo: monitora energia e recupero.'
        : projectedWeightDeltaKg >= 0.35
          ? 'Surplus probabile: utile per forza, controlla la qualita dei macro.'
          : 'Trend stabile: ottimo ritmo per progressi sostenibili.'
    };
  }, [workoutHistory, systemLogs, currentWeekSessions, weeklyTrainingStreak]);
  const weeklyQuestBoard = useMemo(() => {
    const weekKeys = new Set(getCurrentWeekDateKeys(new Date()));
    const weekLogs = (Array.isArray(systemLogs) ? systemLogs : []).filter((log) => weekKeys.has(String(log?.date || '')));
    const hydrationDays = weekLogs.filter((log) => Math.max(0, Number(log?.waterMl || 0)) >= Math.max(1200, Number(hydrationGoal || 2800) * 0.85)).length;
    const cardioDone = currentWeekCardioKm >= Number(cardioWeeklyGoalKm || 20);
    const trainingDone = currentWeekSessions >= weeklyGoal;
    const hydrationDone = hydrationDays >= 4;
    return {
      hydrationDays,
      allDone: cardioDone && trainingDone && hydrationDone,
      items: [
        { id: 'q1', label: 'Training 4x', progress: `${currentWeekSessions}/${weeklyGoal}`, done: trainingDone },
        { id: 'q2', label: `Cardio ${Number(cardioWeeklyGoalKm || 20)}km`, progress: `${currentWeekCardioKm}/${Number(cardioWeeklyGoalKm || 20)}`, done: cardioDone },
        { id: 'q3', label: 'Hydration 4d', progress: `${hydrationDays}/4`, done: hydrationDone }
      ]
    };
  }, [systemLogs, hydrationGoal, currentWeekCardioKm, cardioWeeklyGoalKm, currentWeekSessions, weeklyGoal]);

  useEffect(() => {
    if (currentWeekSessions < weeklyGoal) return;
    if (playerStats.lastWeeklyTrainingClaimWeek === currentWeekKey) return;
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 70,
      gold: (prev.gold || 0) + 50,
      weeklyTrainingStreak: (prev.weeklyTrainingStreak || 0) + 1,
      lastWeeklyTrainingClaimWeek: currentWeekKey
    }));
    setWeeklyBurst(true);
    playSfx(crownAnthemEnabled ? 'crown_anthem' : 'streak', soundEnabled, soundTheme);
  }, [currentWeekSessions, currentWeekKey, playerStats.lastWeeklyTrainingClaimWeek, setPlayerStats, soundEnabled, soundTheme, crownAnthemEnabled]);
  useEffect(() => {
    if (!weeklyQuestBoard.allDone) return;
    if (playerStats.lastWeeklyQuestClaimWeek === currentWeekKey) return;
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 120,
      gold: (prev.gold || 0) + 90,
      weeklyQuestWins: (prev.weeklyQuestWins || 0) + 1,
      lastWeeklyQuestClaimWeek: currentWeekKey
    }));
    emitUiToast({ message: 'Weekly Quest completata: +120 EXP +90 Gold', tone: 'success', durationMs: 3600 });
    playSfx('success', soundEnabled, soundTheme);
  }, [weeklyQuestBoard.allDone, playerStats.lastWeeklyQuestClaimWeek, currentWeekKey, setPlayerStats, soundEnabled, soundTheme]);
  useEffect(() => {
    if (cardioCalibrationInsights.samples < 3) return;
    const target = Number(cardioCalibrationInsights.learnedFactor || 1);
    setCardioCalibrationFactor((prev) => {
      const next = clampCardioCalibration((Number(prev || 1) * 0.65) + (target * 0.35));
      return Math.abs(next - Number(prev || 1)) >= 0.008 ? Number(next.toFixed(3)) : prev;
    });
  }, [cardioCalibrationInsights.samples, cardioCalibrationInsights.learnedFactor]);

  return (
    <div className="p-6 pt-10 pb-24 min-h-full bg-void-black relative overflow-hidden">
      <img src="/boss9.png" alt="" className="pointer-events-none absolute -right-16 -top-2 w-48 opacity-12 grayscale" />
      <img src="/avatar7.png" alt="" className="pointer-events-none absolute -left-14 bottom-6 w-36 opacity-12 grayscale" />
      <div className="mb-6">
        <p className="text-gray-500 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Training Flow</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">WORKOUT LAB</h1>
        <p className="text-[10px] text-amber-300 uppercase tracking-widest mt-2">Streak Multiplier x{streakMultiplier.toFixed(2)}</p>
        {burnEstimateMeta.message ? (
          <p className={`text-[10px] uppercase tracking-widest mt-1 ${
            burnEstimateMeta.state === 'done'
              ? 'text-emerald-300'
              : burnEstimateMeta.state === 'fallback'
                ? 'text-amber-300'
                : burnEstimateMeta.state === 'failed'
                  ? 'text-rose-300'
                  : 'text-cyan-300'
          }`}>
            {burnEstimateMeta.message}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={undoWorkoutHistory} disabled={!historyUndoStack.length} className={`text-[10px] px-3 py-1 border uppercase tracking-widest ${historyUndoStack.length ? 'border-cyan-300/45 text-cyan-200 hover:bg-cyan-300 hover:text-black' : 'border-white/10 text-white/35'}`}>Undo</button>
          <button type="button" onClick={redoWorkoutHistory} disabled={!historyRedoStack.length} className={`text-[10px] px-3 py-1 border uppercase tracking-widest ${historyRedoStack.length ? 'border-violet-300/45 text-violet-200 hover:bg-violet-300 hover:text-black' : 'border-white/10 text-white/35'}`}>Redo</button>
          <button type="button" onClick={() => setRecoveryAutopilotEnabled((prev) => !prev)} className={`text-[10px] px-3 py-1 border uppercase tracking-widest ${recoveryAutopilotEnabled ? 'border-emerald-300/45 text-emerald-200 bg-emerald-500/10' : 'border-amber-300/45 text-amber-200'}`}>
            Recovery Autopilot {recoveryAutopilotEnabled ? 'ON' : 'OFF'}
          </button>
          <span className="text-[10px] uppercase tracking-widest text-gray-400">{recoveryAutopilotHint.label} {recoveryAutopilotHint.score}/100</span>
        </div>
      </div>

      <div className="mb-4 rounded-sm border border-cyan-300/35 bg-cyan-500/10 p-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Battle Visual Status</p>
        <p className="text-xs text-white mt-1">
          Online · Mode {activeBattleVisual + 1}/{BATTLE_VISUAL_PRESETS.length} ·
          {battleVisualImageOk ? ' FX image loaded' : ' Fallback icon active'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.015 }}
        className="mb-4 rounded-sm border border-indigo-400/25 bg-black/45 p-3"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-indigo-300 mb-2">Battle Visuals</p>
        <div className="grid grid-cols-3 gap-2">
          {BATTLE_VISUAL_PRESETS.map((preset, idx) => (
            <button
              key={`rail-${preset.id}`}
              type="button"
              onClick={() => {
                setActiveBattleVisual(idx);
                setBattleVisualImageOk(true);
              }}
              className={`rounded-sm border p-2 text-center transition-colors ${
                idx === activeBattleVisual
                  ? 'border-cyan-300 bg-cyan-400/12'
                  : 'border-white/15 bg-white/5 hover:border-cyan-300/45'
              }`}
            >
              <p className="text-2xl">{preset.fallback || '◇'}</p>
              <p className="text-[9px] uppercase tracking-widest text-white">{preset.title}</p>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="mb-6 overflow-hidden rounded-sm border border-indigo-400/30 bg-black/55 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-indigo-300">Battle Visual Simulator</p>
            <p className="text-xs text-gray-300">Preview skill FX durante il workout flow.</p>
          </div>
          <p className="text-[10px] text-cyan-200 uppercase tracking-widest">Mode {activeBattleVisual + 1}/{BATTLE_VISUAL_PRESETS.length}</p>
        </div>
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
          <p className="text-gray-400">Linked Action</p>
          <p className="text-amber-200">{battleCueLabel}</p>
        </div>
        <div className="relative h-40 overflow-hidden rounded-sm border border-white/10 bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.38),transparent_42%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.34),transparent_44%),linear-gradient(140deg,rgba(5,18,42,0.98),rgba(7,10,24,0.98))]" />
          <motion.div
            animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.82, 0.35] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/55 bg-cyan-300/10 shadow-[0_0_40px_rgba(34,211,238,0.45)]"
          />
          <motion.div
            animate={{ x: ['-8%', '12%', '-8%'], opacity: [0.2, 0.7, 0.2] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-cyan-300/0 via-cyan-300/35 to-cyan-300/0 blur-[2px]"
          />
          <motion.div
            animate={{ x: ['14%', '-10%', '14%'], opacity: [0.25, 0.75, 0.25] }}
            transition={{ repeat: Infinity, duration: 3.1, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-fuchsia-300/0 via-fuchsia-300/35 to-fuchsia-300/0 blur-[2px]"
          />
          <motion.div
            key={BATTLE_VISUAL_PRESETS[activeBattleVisual].id}
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {battleVisualImageOk ? (
              <img
                src={BATTLE_VISUAL_PRESETS[activeBattleVisual].image}
                alt={BATTLE_VISUAL_PRESETS[activeBattleVisual].title}
                className="h-full w-full object-contain p-3 drop-shadow-[0_0_24px_rgba(56,189,248,0.55)] mix-blend-screen"
                onError={() => setBattleVisualImageOk(false)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-6xl">{BATTLE_VISUAL_PRESETS[activeBattleVisual].fallback || '◇'}</span>
              </div>
            )}
          </motion.div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-[0.38em] text-white/35">Battle FX Live</span>
          </div>
          <motion.div
            key={`cue-${battleCueTick}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.94, 1.04, 1.08] }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 border border-cyan-300/55 shadow-[0_0_32px_rgba(34,211,238,0.4)]"
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.9, 0.35] }}
            transition={{ repeat: Infinity, duration: isWorkoutRunning ? 1.2 : 2.2, ease: 'easeInOut' }}
            className="pointer-events-none absolute right-4 top-4 h-10 w-10 rounded-full border border-cyan-300/55 bg-cyan-300/15"
          />
          <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/45 p-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white">{BATTLE_VISUAL_PRESETS[activeBattleVisual].title}</p>
            <p className="text-[10px] text-cyan-200">{BATTLE_VISUAL_PRESETS[activeBattleVisual].subtitle}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {BATTLE_VISUAL_PRESETS.map((preset, idx) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setActiveBattleVisual(idx);
                setBattleVisualImageOk(true);
              }}
              className={`text-[10px] px-2 py-2 uppercase tracking-widest border ${idx === activeBattleVisual ? 'border-cyan-300 text-cyan-200 bg-cyan-400/10' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`weekly-streak-card relative mb-6 overflow-hidden rounded-sm border border-amber-400/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(34,211,238,0.08),rgba(217,70,239,0.1))] p-4 ${weeklyBurst ? 'weekly-streak-burst' : ''}`}>
        {weeklyBurst ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.9, 1.04, 1.1] }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
          >
            <motion.div
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: [0.72, 1.1, 1.24], opacity: [0, 0.45, 0] }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-44 w-44 rounded-full border border-fuchsia-300/55"
            />
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 12 }).map((_, idx) => (
                <motion.span
                  key={`train-crown-spark-${idx}`}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
                  animate={{
                    opacity: [0, 0.9, 0],
                    x: [0, (idx % 2 === 0 ? 1 : -1) * (30 + ((idx * 8) % 40))],
                    y: [0, -20 - ((idx * 6) % 34)],
                    scale: [0.35, 1.04, 0.2]
                  }}
                  transition={{ duration: 0.66, delay: 0.05 + (idx * 0.02), ease: 'easeOut' }}
                  className="absolute left-1/2 top-[58%] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.85)]"
                />
              ))}
            </div>
            <div className="rounded-full border border-fuchsia-300/60 bg-black/70 px-4 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-fuchsia-100">Weekly Crown Secured</p>
            </div>
          </motion.div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300">Weekly Streak</p>
            <h2 className="mt-1 text-lg font-black uppercase text-white">4 workout a settimana</h2>
            <p className="mt-1 text-[11px] text-white/65">Chiudi 4/4 ogni settimana per mantenere chain e reward automatici.</p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-orange-200">Flame chain: <span className="text-orange-100 font-black">{weeklyTrainingStreak} settimane</span> {fireIcons}</p>
            <p className={`mt-1 text-[10px] uppercase tracking-[0.24em] font-black ${weeklyCrownTone}`}>Crown Tier {weeklyCrownTier}</p>
            <motion.p
              animate={crownAnthemEnabled && currentWeekSessions >= weeklyGoal ? { scale: [1, 1.045, 1], opacity: [0.92, 1, 0.92] } : { scale: 1, opacity: 1 }}
              transition={crownAnthemEnabled && currentWeekSessions >= weeklyGoal ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              className={`mt-1 inline-flex items-center border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${
                crownAnthemEnabled
                  ? weeklyCrownBadgeTone
                  : 'border-white/15 text-gray-400 bg-white/5'
              }`}
            >
              <span className={`mr-1 crown-emblem ${weeklyCrownEmblemClass}`}>{weeklyCrownEmblem}</span>
              CROWN FX {weeklyCrownFxLabel}
            </motion.p>
          </div>
          <div className={`rounded-full border px-3 py-2 text-center ${weeklyBurst ? 'border-fuchsia-300 bg-fuchsia-500/20 shadow-[0_0_32px_rgba(217,70,239,0.35)]' : 'border-amber-300/30 bg-black/30'}`}>
            <p className="text-xl font-black text-white">{currentWeekSessions}/{weeklyGoal}</p>
            <p className="text-[9px] uppercase tracking-[0.3em] text-amber-200">Week</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="border border-white/10 bg-black/30 p-2">
            <p className="text-lg font-black text-white">{weeklySessionsLeft}</p>
            <p className="text-[8px] uppercase text-gray-400">Left</p>
          </div>
          <div className="border border-white/10 bg-black/30 p-2">
            <p className="text-lg font-black text-emerald-200">{perfectRun}</p>
            <p className="text-[8px] uppercase text-gray-400">Perfect Run</p>
          </div>
          <div className="border border-white/10 bg-black/30 p-2">
            <p className="text-lg font-black text-fuchsia-200">{momentumPct}%</p>
            <p className="text-[8px] uppercase text-gray-400">Momentum</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/10 bg-black/40">
          <motion.div initial={{ width: 0 }} animate={{ width: `${weeklyPct}%` }} className="h-full bg-[linear-gradient(90deg,#f59e0b,#22d3ee,#d946ef)] shadow-[0_0_18px_rgba(34,211,238,0.7)]" />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full border border-fuchsia-300/25 bg-black/40">
          <motion.div initial={{ width: 0 }} animate={{ width: `${momentumPct}%` }} className="h-full bg-[linear-gradient(90deg,#22d3ee,#d946ef)] shadow-[0_0_14px_rgba(217,70,239,0.55)]" />
        </div>
        <div className="mt-3 flex gap-2">
          {weeklyNodes.map((filled, idx) => (
            <div key={`week-node-${idx}`} className={`flex-1 rounded-sm border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest ${filled ? 'border-emerald-300 bg-emerald-400/18 text-emerald-100 shadow-[0_0_18px_rgba(74,222,128,0.22)]' : 'border-white/10 bg-white/5 text-white/35'}`}>
              {filled ? 'Clear' : `Slot ${idx + 1}`}
            </div>
          ))}
        </div>
        <div className="mt-3 border border-white/10 bg-black/30 p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-200">Weekly Timeline</p>
            <p className="text-[9px] uppercase tracking-widest text-gray-400">Last 8 Weeks</p>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {weeklyHistory.map((item) => {
              const barHeight = Math.max(20, Math.min(100, Math.round((item.sessions / Math.max(1, weeklyGoal)) * 100)));
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
        <div className="mt-3 border border-violet-300/25 bg-violet-500/10 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[9px] uppercase tracking-[0.24em] text-violet-200">Cardio Weekly Goal</p>
            <input
              type="number"
              min="3"
              max="120"
              step="1"
              value={cardioWeeklyGoalKm}
              onChange={(e) => setCardioWeeklyGoalKm(Math.max(3, Math.min(120, Math.round(toNumber(e.target.value) || 20))))}
              className="w-20 bg-black/50 border border-violet-300/35 text-white text-[10px] px-2 py-1 text-right"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="border border-white/10 bg-black/30 p-2"><p className="text-sm font-black text-violet-100">{currentWeekCardioKm}</p><p className="text-[8px] uppercase text-gray-500">KM Week</p></div>
            <div className="border border-white/10 bg-black/30 p-2"><p className="text-sm font-black text-cyan-200">{cardioWeeklyPct}%</p><p className="text-[8px] uppercase text-gray-500">Progress</p></div>
            <div className="border border-white/10 bg-black/30 p-2"><p className="text-sm font-black text-emerald-200">{cardioWeeklyStreak}</p><p className="text-[8px] uppercase text-gray-500">Cardio Streak</p></div>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-violet-300/30 bg-black/40 mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${cardioWeeklyPct}%` }} className="h-full bg-violet-300" />
          </div>
          <div className="grid grid-cols-8 gap-1">
            {cardioWeekHistory.map((item) => {
              const barHeight = Math.max(10, Math.min(100, Math.round((item.km / Math.max(1, cardioWeeklyGoalKm)) * 100)));
              return (
                <div key={`cardio-week-${item.key}`} className="flex flex-col items-center gap-1">
                  <div className="h-12 w-full border border-white/10 bg-black/40 p-[2px]">
                    <div className={`w-full self-end ${item.done ? 'bg-violet-300' : 'bg-cyan-300/60'}`} style={{ height: `${barHeight}%`, marginTop: `${100 - barHeight}%` }} />
                  </div>
                  <p className={`text-[8px] uppercase tracking-widest ${item.label === 'NOW' ? 'text-violet-100' : 'text-gray-500'}`}>{item.label}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/70">
            {cardioWeeklyLeftKm > 0 ? `Mancano ${cardioWeeklyLeftKm} km al target.` : 'Target cardio settimanale completato.'}
          </p>
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-white/70">
          {weeklySessionsLeft > 0
            ? `Target attivo: mancano ${weeklySessionsLeft} sessioni per blindare la settimana.`
            : 'Settimana completata: crown protetta, continua per allungare la chain.'}
        </p>
      </motion.div>

      <HumanBodyMap
        selectedZones={selectedBodyZones}
        recommendedZones={aiWorkoutZones}
        trainedZones={trainedZones}
        onToggle={toggleBodyZone}
        daysSinceLastWorkout={daysSinceLastWorkout}
        freshGroupsCount={freshGroupsCount}
      />

      <div className="flex bg-white/5 border border-white/10 rounded-sm p-1 mb-6">
        {['briefing', 'setup', 'active', 'debrief'].map((step) => (
          <div key={step} className={`flex-1 text-center text-[9px] font-bold py-2 uppercase tracking-widest ${flowStep === step ? 'text-system-blue bg-white/10' : 'text-gray-500'}`}>{step}</div>
        ))}
      </div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setFocusMode((prev) => !prev)}
          className={`text-[10px] px-3 py-2 border uppercase tracking-widest ${
            focusMode ? 'border-fuchsia-300 text-fuchsia-200 bg-fuchsia-500/10' : 'border-cyan-300/45 text-cyan-200'
          }`}
        >
          {focusMode ? 'Focus ON' : 'Focus OFF'}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="hud-panel bg-black/50 border border-red-500/40 p-5 rounded-sm mb-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {WORKOUT_PROMPT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyWorkoutPromptPreset(preset.prompt)}
              className="text-[10px] px-2 py-1 border border-red-500/50 text-red-200 bg-red-500/10 hover:bg-red-500 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mb-3 rounded-sm border border-cyan-300/30 bg-cyan-500/10 p-3">
          <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-200 mb-2">Cardio Boost</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={cardioDraft.sportId}
              onChange={(e) => updateCardioDraft('sportId', e.target.value)}
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            >
              {CARDIO_SPORTS.map((sport) => (
                <option key={`cardio-s-${sport.id}`} value={sport.id}>{sport.label}</option>
              ))}
            </select>
            <select
              value={cardioDraft.intensityId}
              onChange={(e) => updateCardioDraft('intensityId', e.target.value)}
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            >
              {CARDIO_INTENSITY.map((level) => (
                <option key={`cardio-i-${level.id}`} value={level.id}>{level.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={cardioDraft.distanceKm}
              onChange={(e) => updateCardioDraft('distanceKm', e.target.value)}
              placeholder="Km (es. 5.2)"
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={cardioDraft.durationMin}
              onChange={(e) => updateCardioDraft('durationMin', e.target.value)}
              placeholder="Durata min (es. 70)"
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={cardioDraft.reportedKcal}
              onChange={(e) => updateCardioDraft('reportedKcal', e.target.value)}
              placeholder="Kcal da smartwatch (opz.)"
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="number"
              min="-10"
              max="45"
              step="1"
              value={cardioDraft.weatherTempC}
              onChange={(e) => updateCardioDraft('weatherTempC', e.target.value)}
              placeholder="Temp °C"
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            />
            <input
              type="number"
              min="10"
              max="100"
              step="1"
              value={cardioDraft.humidityPct}
              onChange={(e) => updateCardioDraft('humidityPct', e.target.value)}
              placeholder="Humidity %"
              className="bg-black/50 border border-cyan-300/30 text-white text-[10px] uppercase tracking-widest px-2 py-2"
            />
          </div>
          <div className="mt-2 border border-white/10 bg-black/35 px-2 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-widest text-gray-300">RPE (fatica percepita)</p>
              <p className="text-[10px] font-black text-fuchsia-200">{cardioDraftRpe}/10</p>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={cardioDraftRpe}
              onChange={(e) => updateCardioDraft('rpe', e.target.value)}
              className="mt-2 w-full accent-fuchsia-300"
            />
          </div>
          <p className="mt-2 text-[10px] text-cyan-100/85">
            Pace {cardioDraftPace > 0 ? `${cardioDraftPace.toFixed(2)} min/km` : '--'} • Burn preview {cardioDraftBurnPreview} kcal • Meteo {Math.round(cardioDraftTempC)}°C/{Math.round(cardioDraftHumidityPct)}% • RPE {cardioDraftRpe}/10{cardioDraftReportedKcal > 0 ? ` • Watch ${cardioDraftReportedKcal} kcal` : ''} • Calib x{Number(cardioCalibrationFactor || 1).toFixed(2)}
          </p>
          <p className="mt-1 text-[9px] text-gray-400 uppercase tracking-widest">
            Learning samples: {cardioCalibrationInsights.samples} {cardioCalibrationInsights.samples >= 3 ? `• learned x${Number(cardioCalibrationInsights.learnedFactor || 1).toFixed(2)}` : '• servono 3+ sessioni con kcal watch'}
          </p>
          <div className="mt-2 border border-white/10 bg-black/35 p-2">
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Quick Import (Apple/Garmin/Strava)</p>
            <textarea
              value={cardioQuickImportText}
              onChange={(e) => setCardioQuickImportText(e.target.value)}
              placeholder="Esempio: Football hard 5 km 70 min 620 kcal"
              className="w-full bg-black/50 border border-white/10 text-white text-[10px] p-2 h-16"
            />
            <button
              onClick={runCardioQuickImport}
              className="mt-2 w-full text-[10px] px-2 py-2 border border-violet-300/45 text-violet-200 uppercase tracking-widest hover:bg-violet-300 hover:text-black"
            >
              Import Cardio
            </button>
          </div>
        </div>
        <textarea value={workoutPrompt} onChange={(e) => setWorkoutPrompt(e.target.value)} placeholder="Es: 50 min, palestra, focus dorso+tricipiti, livello intermedio..." className="w-full bg-void-black border border-red-900 text-white text-xs p-3 h-20 rounded-sm mb-3 focus:outline-none focus:border-red-500" />
        {selectedBodyZones.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedBodyZones.map((tag) => (
              <span key={tag} className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                {tag}
              </span>
            ))}
          </div>
        )}
        <button onClick={generateAnimeWorkout} disabled={isGeneratingWorkout} className={`w-full text-[11px] font-black uppercase tracking-widest p-3 ${isGeneratingWorkout ? 'bg-gray-800 text-gray-500' : 'bg-red-500/20 border border-red-500 text-red-300 hover:bg-red-500 hover:text-white'}`}>
          {isGeneratingWorkout ? 'EVOCANDO...' : 'GENERA WORKOUT'}
        </button>
        <p className="mt-2 text-[10px] text-emerald-200 uppercase tracking-widest">Recovery Autopilot: {recoveryAutopilotHint.label} ({recoveryAutopilotHint.score}/100)</p>
        <div className="mt-3 border border-white/10 bg-black/30 p-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">AI History (ultimi 20)</p>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {aiHistory.length > 0 ? aiHistory.slice(0, 6).map((entry) => (
              <div key={entry.id} className="border border-white/10 bg-white/5 p-2">
                {Number(entry?.output?.confidenceScore || 0) > 0 ? (
                  <p className="mb-1 text-[9px] uppercase tracking-widest text-emerald-200">AI Confidence {Math.round(Number(entry.output.confidenceScore || 0))}%</p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-white font-bold">{entry.title}</p>
                  <span className="text-[9px] text-gray-500">{formatHistoryTime(entry.createdAt)}</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">{entry.prompt ? entry.prompt.slice(0, 90) : 'Nessun prompt testuale'}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => applyHistoryPrompt(entry)} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 hover:bg-cyan-400 hover:text-black">
                    Usa Prompt
                  </button>
                  {entry.kind === 'workout_plan' ? (
                    <button type="button" onClick={() => loadHistoryWorkout(entry)} className="text-[9px] px-2 py-1 border border-red-300/40 text-red-200 hover:bg-red-400 hover:text-black">
                      Carica Scheda
                    </button>
                  ) : null}
                </div>
              </div>
            )) : (
              <p className="text-[10px] text-gray-500">Nessuna risposta AI registrata.</p>
            )}
          </div>
        </div>
      </motion.div>

	      {aiWorkout && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="hud-panel bg-black/50 border border-red-500/30 p-4 rounded-sm mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-white text-sm font-black italic">{aiWorkout.title || 'Shadow Protocol'}</h3>
            <div className="flex items-center gap-1">
              {Number(aiWorkout?.confidenceScore || 0) > 0 ? (
                <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${getPlanConfidenceBadge(aiWorkout.confidenceScore).tone}`}>
                  AI {Math.round(Number(aiWorkout.confidenceScore || 0))}% • {aiWorkout?.confidenceLabel || getPlanConfidenceBadge(aiWorkout.confidenceScore).label}
                </span>
              ) : null}
              <span className="text-[10px] px-2 py-1 border border-red-500 text-red-300 font-bold">RANK {aiWorkout.difficulty || 'C'}</span>
            </div>
          </div>
          {Array.isArray(aiWorkout.safetyWarnings) && aiWorkout.safetyWarnings.length > 0 ? (
            <div className="mb-2 border border-amber-300/40 bg-amber-500/10 p-2">
              <p className="text-[9px] uppercase tracking-widest text-amber-200 mb-1">Safety Layer</p>
              <p className="text-[10px] text-amber-100">{aiWorkout.safetyWarnings.join(' ')}</p>
            </div>
          ) : null}
          <p className="text-[10px] text-gray-400 uppercase mb-3">{aiWorkout.focus || 'focus libero'} • {aiWorkout.durationMin || 40} min</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/5 border border-white/10 p-2 text-center"><p className="text-white font-black">{formatSeconds(workoutRemaining)}</p><p className="text-[8px] text-gray-500 uppercase">Session</p></div>
            <div className="bg-white/5 border border-white/10 p-2 text-center"><p className="text-cyan-300 font-black">{formatSeconds(restRemaining)}</p><p className="text-[8px] text-gray-500 uppercase">Rest</p></div>
            <div className="bg-white/5 border border-white/10 p-2 text-center"><p className="text-red-300 font-black">{completionPct}%</p><p className="text-[8px] text-gray-500 uppercase">Done</p></div>
          </div>

          {restRemaining > 0 && (
            <motion.div
              key={restFxKey}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 overflow-hidden rounded-sm border border-cyan-300/35 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),rgba(2,6,23,0.92))] p-4 shadow-[0_0_36px_rgba(34,211,238,0.18)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300">Recovery Window</p>
                  <p className="mt-1 text-xl font-black uppercase text-white">{formatSeconds(restRemaining)}</p>
                  <p className="text-[10px] text-white/60">Respira, resetta il focus e prepara il prossimo set.</p>
                </div>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/30 bg-black/35">
                  <motion.div
                    animate={{ scale: [1, 1.14, 1], opacity: [0.4, 0.9, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="absolute inset-2 rounded-full border border-cyan-300/40"
                  />
                  <span className="relative text-2xl font-black text-cyan-200">{restRemaining}</span>
                </div>
              </div>
            </motion.div>
          )}

	          <div className="flex gap-2 mb-3">
	            <button onClick={startWorkoutSession} disabled={isWorkoutRunning} className={`flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border ${isWorkoutRunning ? 'border-gray-700 text-gray-500' : 'border-red-500 text-red-300 hover:bg-red-500 hover:text-white'}`}>Start</button>
	            <button onClick={() => setIsWorkoutRunning((prev) => !prev)} disabled={!workoutExercises.length} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black">{isWorkoutRunning ? 'Pause' : 'Resume'}</button>
	            <button
                onClick={finishWorkoutSession}
                disabled={!workoutExercises.length || isFinishingWorkout}
                className={`flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border ${
                  (!workoutExercises.length || isFinishingWorkout)
                    ? 'border-gray-700 text-gray-500'
                    : 'border-emerald-400 text-emerald-300 hover:bg-emerald-400 hover:text-black'
                }`}
              >
                {isFinishingWorkout ? 'Finishing...' : 'Finish'}
              </button>
	          </div>

          <div className="space-y-2">
            {workoutExercises.map((ex, idx) => {
              const progress = exerciseProgress[idx] || { completedSets: 0, setsTarget: Math.max(parseInt(ex.sets, 10) || 1, 1), logs: [] };
              const input = exerciseInputs[idx] || {};
              const active = idx === activeExerciseIndex;
              return (
                <div key={`${ex.name || 'ex'}-${idx}`} className={`border p-2 ${active ? 'border-red-400 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                  <p className="text-xs text-gray-100">{idx + 1}. {ex.name} • {ex.sets}x{ex.reps} • Rest {ex.restSec}s</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {detectFocusTags(ex.name).map((tag) => (
                      <span key={`${ex.name}-${tag}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/65">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase mt-1">Set: {progress.completedSets}/{progress.setsTarget}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input type="number" placeholder="kg" value={input.kg || ''} onChange={(e) => handleExerciseInput(idx, 'kg', e.target.value)} className="bg-black/50 border border-white/10 text-white text-xs p-2" />
                    <input type="number" placeholder="reps" value={input.repsDone || ''} onChange={(e) => handleExerciseInput(idx, 'repsDone', e.target.value)} className="bg-black/50 border border-white/10 text-white text-xs p-2" />
                    <button onClick={() => logExerciseSet(idx)} disabled={!isWorkoutRunning || progress.completedSets >= progress.setsTarget} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-2 border ${(!isWorkoutRunning || progress.completedSets >= progress.setsTarget) ? 'border-gray-700 text-gray-500' : 'border-red-500 text-red-300 hover:bg-red-500 hover:text-white'}`}>Log</button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
	      )}

      {lastSessionSummary && flowStep === 'debrief' && !aiWorkout && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-black/40 border border-emerald-400/30 p-4 rounded-sm mb-6">
          <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Session Completed</p>
          <div className="mb-2">
            <span className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
              burnEstimateMeta.state === 'done'
                ? 'border-emerald-300/50 text-emerald-200 bg-emerald-500/10'
                : burnEstimateMeta.state === 'fallback'
                  ? 'border-amber-300/50 text-amber-200 bg-amber-500/10'
                  : burnEstimateMeta.state === 'failed'
                    ? 'border-rose-300/50 text-rose-200 bg-rose-500/10'
                    : 'border-cyan-300/50 text-cyan-200 bg-cyan-500/10'
            }`}>
              Burn {burnEstimateMeta.state === 'done' ? 'AI DONE' : burnEstimateMeta.state === 'fallback' ? 'FALLBACK' : burnEstimateMeta.state === 'failed' ? 'FAILED' : 'ESTIMATING'}
            </span>
          </div>
          <p className="text-xs text-gray-200">{lastSessionSummary.title} • Rank {lastSessionSummary.rank} • Strength {Math.round(lastSessionSummary.strengthIndex || 0)}</p>
          <p className="text-[10px] text-gray-400 uppercase mt-1">Focus: {(lastSessionSummary.focusTags || []).join(' / ')}</p>
          <p className="text-[10px] text-cyan-200 uppercase mt-1">
            Burn stimato: {lastSessionSummary.burnedKcal ? `+${Math.round(lastSessionSummary.burnedKcal)} kcal` : 'in calcolo...'}
            {lastSessionSummary.burnedConfidence ? ` (${lastSessionSummary.burnedConfidence})` : ''}
          </p>
          {lastSessionSummary?.cardio?.sportId && lastSessionSummary.cardio.sportId !== 'none' ? (
            <div className="mt-2 border border-cyan-300/35 bg-cyan-500/10 p-2">
              <p className="text-[9px] uppercase tracking-widest text-cyan-200">
                Cardio {lastSessionSummary.cardio.sportLabel} • {lastSessionSummary.cardio.intensityLabel || 'Medium'} • RPE {Math.round(Number(lastSessionSummary.cardio.rpe || 6))}/10 • {Number(lastSessionSummary.cardio.distanceKm || 0).toFixed(1)} km
              </p>
              <p className="text-[10px] text-gray-200 mt-1">
                Pace {Number(lastSessionSummary.cardio.paceMinPerKm || 0) > 0 ? `${Number(lastSessionSummary.cardio.paceMinPerKm).toFixed(2)} min/km` : '--'} • Meteo {Math.round(Number(lastSessionSummary.cardio?.weather?.tempC ?? DEFAULT_CARDIO_WEATHER.tempC))}°C/{Math.round(Number(lastSessionSummary.cardio?.weather?.humidityPct ?? DEFAULT_CARDIO_WEATHER.humidityPct))}%
              </p>
              <p className="text-[10px] text-violet-200 mt-1 uppercase">Zone: {lastSessionSummary.cardio.zoneLabel || 'N/A'}</p>
              <p className="text-[10px] text-gray-200 mt-1">Hydration boost: +{Math.round(Number(lastSessionSummary.cardio.hydrationExtraMl || 0))} ml</p>
              {(lastSessionSummary.cardio.supplementTips || []).slice(0, 3).map((tip) => (
                <p key={`supp-${tip}`} className="text-[10px] text-amber-200">• {tip}</p>
              ))}
            </div>
          ) : null}
        </motion.div>
      )}

	      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-black/40 border border-cyan-300/20 p-4 rounded-sm mb-4">
        <p className="text-cyan-300 text-[10px] uppercase tracking-widest mb-2">Strength Trend</p>
        {strengthTrend.length === 0 ? (
          <p className="text-xs text-gray-500">Nessun dato forza disponibile</p>
        ) : (
          <>
            <p className="text-xs text-gray-300 mb-2">Indice medio ultime sessioni: <span className="text-cyan-200 font-black">{avgStrength}</span></p>
            <div className="space-y-1">
              {strengthTrend.slice(0, 5).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">{new Date(row.date).toLocaleDateString('it-IT')}</span>
                  <span className="text-cyan-200 font-bold">{row.value}</span>
                  <span className={`${row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-red-300' : 'text-gray-500'}`}>
                    {row.delta > 0 ? `+${Math.round(row.delta)}` : Math.round(row.delta)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
	      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="bg-black/40 border border-violet-300/30 p-4 rounded-sm mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-violet-200 text-[10px] uppercase tracking-widest">Cardio Map</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400">{cardioMap.totalKm} km • {cardioMap.totalKcal} kcal • Calib x{Number(cardioCalibrationFactor || 1).toFixed(2)}</p>
        </div>
        {cardioMap.items.length ? (
          <div className="space-y-2">
            {cardioMap.items.map((row) => {
              const width = cardioMap.totalKm > 0 ? Math.min(100, Math.round((row.km / cardioMap.totalKm) * 100)) : 0;
              return (
                <div key={`cardio-map-${row.sportId}`} className="border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <p className="text-white uppercase">{row.sportLabel}</p>
                    <p className="text-cyan-200 font-black">{row.km} km • {row.kcal} kcal</p>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-violet-300/30 bg-black/40">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} className="h-full bg-violet-300" />
                  </div>
                  <p className="mt-1 text-[9px] uppercase tracking-widest text-gray-500">{row.sessions} sessioni</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500">Nessun cardio registrato: seleziona sport e km prima del workout.</p>
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.115 }} className="bg-black/40 border border-cyan-300/30 p-4 rounded-sm mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-cyan-200 text-[10px] uppercase tracking-widest">Cardio Command Center</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400">Last 28d</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center mb-2">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{cardioCommandCenter.totalKm28}</p><p className="text-[8px] uppercase text-gray-500">Km</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{cardioCommandCenter.totalBurn28}</p><p className="text-[8px] uppercase text-gray-500">Burn</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-violet-200">{cardioCommandCenter.totalDuration28}</p><p className="text-[8px] uppercase text-gray-500">Min</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{cardioCommandCenter.weightedPace > 0 ? cardioCommandCenter.weightedPace.toFixed(2) : '--'}</p><p className="text-[8px] uppercase text-gray-500">Pace</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="border border-cyan-300/25 bg-cyan-500/8 p-2">
            <p className="text-[8px] uppercase tracking-widest text-cyan-200">Best KM</p>
            <p className="text-[11px] text-white font-black mt-1">{cardioCommandCenter.bestDistance?.km ? `${Number(cardioCommandCenter.bestDistance.km).toFixed(1)} km` : '--'}</p>
          </div>
          <div className="border border-violet-300/25 bg-violet-500/8 p-2">
            <p className="text-[8px] uppercase tracking-widest text-violet-200">Best Burn</p>
            <p className="text-[11px] text-white font-black mt-1">{cardioCommandCenter.bestBurn?.kcal ? `${Math.round(cardioCommandCenter.bestBurn.kcal)} kcal` : '--'}</p>
          </div>
          <div className="border border-emerald-300/25 bg-emerald-500/8 p-2">
            <p className="text-[8px] uppercase tracking-widest text-emerald-200">Best Pace</p>
            <p className="text-[11px] text-white font-black mt-1">{cardioCommandCenter.bestPace?.pace ? `${Number(cardioCommandCenter.bestPace.pace).toFixed(2)} min/km` : '--'}</p>
          </div>
        </div>
        <div className="space-y-1">
          {cardioCommandCenter.advisory.map((tip) => (
            <p key={tip} className="text-[10px] text-amber-200">• {tip}</p>
          ))}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.118 }} className="bg-black/40 border border-violet-300/30 p-4 rounded-sm mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-violet-200 text-[10px] uppercase tracking-widest">Cardio Zone Engine</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400">{cardioZoneMix.total} sessions</p>
        </div>
        {cardioZoneMix.total > 0 ? (
          <div className="space-y-2">
            {cardioZoneMix.items.map((zone) => {
              const actualPct = cardioZoneMix.total > 0 ? Math.round((zone.value / cardioZoneMix.total) * 100) : 0;
              return (
                <div key={zone.id} className="border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <p className="text-white uppercase">{zone.label}</p>
                    <p className="text-cyan-200">{actualPct}% / target {zone.target}%</p>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-violet-300/30 bg-black/35">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, actualPct)}%` }} className="h-full bg-gradient-to-r from-violet-300 to-cyan-300" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500">Non ci sono ancora zone registrate. Completa 2-3 sessioni cardio.</p>
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-black/40 border border-emerald-300/30 p-4 rounded-sm mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-emerald-200 text-[10px] uppercase tracking-widest">Prediction 7 Days</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400">Forecast</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{sevenDayPrediction.projectedWorkouts}</p><p className="text-[8px] uppercase text-gray-500">Workouts</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{sevenDayPrediction.projectedBurn7d}</p><p className="text-[8px] uppercase text-gray-500">Burn 7d</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className={`text-sm font-black ${sevenDayPrediction.projectedWeightDeltaKg < 0 ? 'text-emerald-200' : sevenDayPrediction.projectedWeightDeltaKg > 0 ? 'text-amber-200' : 'text-gray-200'}`}>{sevenDayPrediction.projectedWeightDeltaKg > 0 ? '+' : ''}{sevenDayPrediction.projectedWeightDeltaKg} kg</p><p className="text-[8px] uppercase text-gray-500">Weight 7d</p></div>
        </div>
        <p className="text-[10px] text-amber-200">• {sevenDayPrediction.note}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.122 }} className="bg-black/40 border border-fuchsia-300/30 p-4 rounded-sm mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-fuchsia-200 text-[10px] uppercase tracking-widest">Weekly Quest Rewards</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400">{weeklyQuestBoard.allDone ? 'Completed' : 'In progress'}</p>
        </div>
        <div className="space-y-2">
          {weeklyQuestBoard.items.map((quest) => (
            <div key={quest.id} className={`border p-2 ${quest.done ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between text-[10px]">
                <p className="text-white uppercase">{quest.label}</p>
                <p className={quest.done ? 'text-emerald-200' : 'text-gray-300'}>{quest.progress}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

	      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-black/40 border border-white/10 p-4 rounded-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest">Workout History</p>
            <p className="text-[9px] uppercase tracking-widest text-white/65">{filteredHistoryStats.count} sessioni • U{historyUndoStack.length} R{historyRedoStack.length}</p>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select value={historyMonthFilter} onChange={(e) => setHistoryMonthFilter(e.target.value)} className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1">
              <option value="all">All Months</option>
              {historyMonthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1">
              {historyTypeOptions.map((opt) => (
                <option key={`hf-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="search title / tag"
            className="mb-2 w-full bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1"
          />
          <div className="mb-2 grid grid-cols-4 gap-2 text-center">
            <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{filteredHistoryStats.count}</p><p className="text-[8px] uppercase text-gray-500">Sessions</p></div>
            <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{filteredHistoryStats.totalBurn}</p><p className="text-[8px] uppercase text-gray-500">Burn Tot</p></div>
            <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{filteredHistoryStats.avgStrength}</p><p className="text-[8px] uppercase text-gray-500">Avg STR</p></div>
            <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-fuchsia-200">{filteredHistoryStats.bestRank}</p><p className="text-[8px] uppercase text-gray-500">Best Rank</p></div>
          </div>
	        {filteredHistory.length === 0 ? <p className="text-xs text-gray-500">Nessuna sessione trovata</p> : filteredHistory.slice(0, 24).map((s) => (
          <div key={s.id} className="border border-white/10 bg-black/30 p-2 mb-2">
            <div className="mb-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => openSessionEditor(s)}
                className="text-[9px] px-2 py-1 border border-cyan-300/35 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteWorkoutSession(s)}
                className="text-[9px] px-2 py-1 border border-rose-300/35 text-rose-200 uppercase tracking-widest hover:bg-rose-400 hover:text-black"
              >
                Delete
              </button>
            </div>
            {editingSessionId === s.id && historyEditDraft ? (
              <div className="mb-2 grid grid-cols-2 gap-2 border border-cyan-300/25 bg-cyan-500/8 p-2">
                <input value={historyEditDraft.title} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.rank} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, rank: e.target.value }))} placeholder="Rank" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <select value={historyEditDraft.sportId} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, sportId: e.target.value }))} className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1">
                  {CARDIO_SPORTS.map((sport) => <option key={`edit-s-${sport.id}`} value={sport.id}>{sport.label}</option>)}
                </select>
                <select value={historyEditDraft.intensityId} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, intensityId: e.target.value }))} className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1">
                  {CARDIO_INTENSITY.map((lvl) => <option key={`edit-i-${lvl.id}`} value={lvl.id}>{lvl.label}</option>)}
                </select>
                <input value={historyEditDraft.distanceKm} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, distanceKm: e.target.value }))} placeholder="KM" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.durationMin} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, durationMin: e.target.value }))} placeholder="MIN" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.rpe} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, rpe: e.target.value }))} placeholder="RPE" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.paceMinPerKm} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, paceMinPerKm: e.target.value }))} placeholder="PACE" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.reportedKcal} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, reportedKcal: e.target.value }))} placeholder="WATCH KCAL" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <input value={historyEditDraft.burnedKcal} onChange={(e) => setHistoryEditDraft((prev) => ({ ...prev, burnedKcal: e.target.value }))} placeholder="BURN KCAL" className="bg-black/50 border border-white/15 text-white text-[10px] uppercase tracking-widest px-2 py-1" />
                <button type="button" onClick={() => saveSessionEditor(s)} className="text-[9px] px-2 py-2 border border-emerald-300/45 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Save</button>
                <button type="button" onClick={cancelSessionEditor} className="text-[9px] px-2 py-2 border border-white/25 text-white/80 uppercase tracking-widest hover:bg-white hover:text-black">Cancel</button>
              </div>
            ) : null}
            <p className="text-xs text-gray-200">{new Date(s.date).toLocaleDateString('it-IT')} • {s.title} • Rank {s.rank}</p>
            <p className="text-[10px] text-cyan-300 uppercase mt-1">Focus: {(s.focusTags || []).join(' / ') || 'General'}</p>
            {s?.cardio?.sportId && s.cardio.sportId !== 'none' ? (
              <p className="text-[10px] text-violet-200 mt-1 uppercase">Cardio: {s.cardio.sportLabel} • {s.cardio.intensityLabel || 'Medium'} • RPE {Math.round(Number(s.cardio.rpe || 6))}/10 • {Number(s.cardio.distanceKm || 0).toFixed(1)} km • {s.cardio.zoneLabel || 'zone n/a'}</p>
            ) : null}
            <p className="text-[10px] text-gray-400 mt-1">
              Esercizi: {(s.exercises || []).slice(0, 5).map((ex) => ex.name).join(' • ')}
            </p>
            <p className="text-[10px] text-emerald-300 mt-1">Strength Index: {Math.round(s.strengthIndex || 0)}</p>
            {Number(s.burnedKcal || 0) > 0 ? (
              <p className="text-[10px] text-cyan-200 mt-1 uppercase">Burn: +{Math.round(Number(s.burnedKcal || 0))} kcal {s?.burnedConfidence ? `(${s.burnedConfidence})` : ''}</p>
            ) : null}
          </div>
	        ))}
	      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="bg-black/40 border border-amber-300/30 p-4 rounded-sm mb-4">
        <p className="text-amber-300 text-[10px] uppercase tracking-widest mb-2">Personal Records Hub</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-white">{personalRecords.topKg || 0}</p><p className="text-[8px] uppercase text-gray-500">Top Kg</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-cyan-200">{personalRecords.topVolume || 0}</p><p className="text-[8px] uppercase text-gray-500">Top Volume</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-emerald-200">{personalRecords.bestStrength || 0}</p><p className="text-[8px] uppercase text-gray-500">Best STR</p></div>
          <div className="border border-white/10 bg-white/5 p-2"><p className="text-sm font-black text-fuchsia-200">{personalRecords.totalSessions || 0}</p><p className="text-[8px] uppercase text-gray-500">Sessions</p></div>
        </div>
      </motion.div>
	      {distractionFree && aiWorkout ? (
        <div className="absolute inset-0 z-[70] bg-black/95 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-200">Focus Mode</p>
            <button
              onClick={() => setFocusMode(false)}
              className="text-[10px] px-3 py-2 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest"
            >
              Exit
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="border border-cyan-300/35 bg-cyan-500/10 p-3 text-center">
              <p className="text-[9px] uppercase text-cyan-200 tracking-widest">Session</p>
              <p className="text-2xl font-black text-white">{formatSeconds(workoutRemaining)}</p>
            </div>
            <div className="border border-amber-300/35 bg-amber-500/10 p-3 text-center">
              <p className="text-[9px] uppercase text-amber-200 tracking-widest">Rest</p>
              <p className="text-2xl font-black text-white">{formatSeconds(restRemaining)}</p>
            </div>
            <div className="border border-emerald-300/35 bg-emerald-500/10 p-3 text-center">
              <p className="text-[9px] uppercase text-emerald-200 tracking-widest">Done</p>
              <p className="text-2xl font-black text-white">{completionPct}%</p>
            </div>
          </div>
          <div className="border border-white/10 bg-white/5 p-3 mb-4">
            <p className="text-[10px] uppercase tracking-widest text-cyan-200">Exercise Corrente</p>
            <p className="text-xl font-black text-white mt-1">{workoutExercises[activeExerciseIndex]?.name || 'Nessun esercizio attivo'}</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Set {exerciseProgress?.[activeExerciseIndex]?.completedSets || 0}/{exerciseProgress?.[activeExerciseIndex]?.setsTarget || Math.max(parseInt(workoutExercises?.[activeExerciseIndex]?.sets, 10) || 1, 1)} •
              reps target {workoutExercises?.[activeExerciseIndex]?.reps || '--'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <button
              onClick={() => setIsWorkoutRunning((prev) => !prev)}
              className="text-[10px] px-2 py-3 border border-amber-300/45 text-amber-200 uppercase tracking-widest"
            >
              {isWorkoutRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={() => logExerciseSet(activeExerciseIndex)}
              disabled={!isWorkoutRunning || !workoutExercises[activeExerciseIndex]}
              className={`text-[10px] px-2 py-3 border uppercase tracking-widest ${
                !isWorkoutRunning || !workoutExercises[activeExerciseIndex]
                  ? 'border-gray-700 text-gray-500'
                  : 'border-cyan-300/45 text-cyan-200'
              }`}
            >
              Log Set
            </button>
            <button
              onClick={finishWorkoutSession}
              disabled={isFinishingWorkout}
              className={`text-[10px] px-2 py-3 border uppercase tracking-widest ${
                isFinishingWorkout ? 'border-gray-700 text-gray-500' : 'border-emerald-300/45 text-emerald-200'
              }`}
            >
              {isFinishingWorkout ? 'Finish...' : 'Finish'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Training;

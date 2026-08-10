import React, { Suspense, lazy, useMemo, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Swords, BrainCircuit, Activity } from 'lucide-react';
import { playSfx } from './utils/sfx';
import { formatAiErrorDetail, requestSystemAI, subscribeAiStatus } from './utils/aiClient';
import { runStorageMigrations } from './utils/storageMigrations';
import { applyXp } from './utils/xpLogic';
import { useFxCombo } from './hooks/useFxCombo';
import { subscribeUiToast, emitUiToast } from './utils/uiEvents';
import { cloudPush, getCloudSession, refreshCloudSession } from './utils/cloudSync';
import { fetchTelegramLogs } from './utils/personalAgentSync';
import NeuralIntro from './components/NeuralIntro';
import TouchSparks from './components/TouchSparks';
import LevelUpOverlay from './components/LevelUpOverlay';

const SystemHub = lazy(() => import('./pages/SystemHub'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Stats = lazy(() => import('./pages/Stats'));
const Quests = lazy(() => import('./pages/Quests'));
const Boss = lazy(() => import('./pages/Boss'));
const Training = lazy(() => import('./pages/Training'));
const Recovery = lazy(() => import('./pages/Recovery'));
const Help = lazy(() => import('./pages/Help'));
const Coach = lazy(() => import('./pages/Coach'));
const News = lazy(() => import('./pages/News'));
const French = lazy(() => import('./pages/French'));
const Polish = lazy(() => import('./pages/Polish'));
runStorageMigrations();
const isWorkoutLog = (log) => Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0;
const getIsoWeekKey = (value = new Date()) => {
  const date = new Date(value);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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

function App() {
  const readJsonSafe = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  };
  const [activePage, setActivePage] = useState('system');
  const [lastPageIndex, setLastPageIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(() => {
    try { if (sessionStorage.getItem('sm_intro_seen')) return false; sessionStorage.setItem('sm_intro_seen', '1'); return true; } catch { return false; }
  });
  const [levelUpTo, setLevelUpTo] = useState(null);
  const prevLevelRef = React.useRef(null);
  const [pageIntroFx, setPageIntroFx] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickMealSlot, setQuickMealSlot] = useState('lunch');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [tapPulseTick, setTapPulseTick] = useState(0);
  const [toastState, setToastState] = useState(null);
  const [toastDurationMs, setToastDurationMs] = useState(9000);
  const [tgBindPrompt, setTgBindPrompt] = useState(false);
  const [tgBindCustom, setTgBindCustom] = useState('');
  const { fxPulseKey, fxBurstKey, surgeKey, comboProgress, triggerFxBurst } = useFxCombo();
  const pagesOrder = ['system', 'systemplus', 'training', 'recovery', 'quests', 'boss', 'calendar', 'stats', 'help', 'coach', 'news'];
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_sound');
    return saved ? saved === '1' : true;
  });
  const [soundTheme, setSoundTheme] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_sound_theme');
    return saved || 'solo';
  });
  const [crownAnthemEnabled, setCrownAnthemEnabled] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_crown_anthem');
    return saved ? saved === '1' : true;
  });
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_voice');
    return saved ? saved === '1' : true;
  });
  const [voicePack, setVoicePack] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_voice_pack');
    return saved || 'dark';
  });
  const [aiStatus, setAiStatus] = useState('checking');
  const [aiStatusDetail, setAiStatusDetail] = useState('');
  const [aiInflightCount, setAiInflightCount] = useState(0);
  const [coachMode, setCoachMode] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_coach_mode');
    return saved ? saved === '1' : false;
  });
  const [dismissedReminderDate, setDismissedReminderDate] = useState(() => localStorage.getItem('shadow_monarch_reminder_dismissed') || '');
  const [reminderSnoozeUntil, setReminderSnoozeUntil] = useState(() => Number(localStorage.getItem('shadow_monarch_reminder_snooze_until') || 0));
  const [reminderAdaptiveMeta, setReminderAdaptiveMeta] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_reminder_adaptive_meta');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  });
  const [onboardingState, setOnboardingState] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_onboarding_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          done: Boolean(parsed?.done),
          step: Number(parsed?.step || 0)
        };
      } catch (_) {}
    }
    return { done: false, step: 0 };
  });
  const [systemCompactMode, setSystemCompactMode] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_system_compact');
    return saved ? saved === '1' : true;
  });
  const [fxMode, setFxMode] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_fx_mode');
    return saved === 'lite' || saved === 'full' || saved === 'auto' ? saved : 'auto';
  });
  const [mobilePerformanceMode, setMobilePerformanceMode] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_mobile_performance_mode');
    if (saved === '1' || saved === '0') return saved === '1';
    if (typeof window !== 'undefined') return window.innerWidth <= 430;
    return false;
  });
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 430;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const createEmptyLog = (date) => ({
    date,
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

  // Memoria 1: Log di Battaglia
  const [systemLogs, setSystemLogs] = useState(() => {
    const parsed = readJsonSafe('shadow_monarch_logs', []);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    return [createEmptyLog(today)];
  });

  // ── Telegram → Solo Levelling sync ───────────────────────────────────────────
  // Fetch personal_logs from the main project API (Supabase) and merge into
  // systemLogs. Uses _telegramValues to track the previous Telegram contribution
  // so that re-syncs correctly replace it instead of adding on top (no double-count).
  // Local values entered manually on the site are always preserved.
  useEffect(() => {
    async function syncTelegram() {
      const patches = await fetchTelegramLogs(7);
      const patchKeys = Object.keys(patches);
      const todayKey2 = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      if (!patchKeys.length) {
        localStorage.setItem('shadow_monarch_tg_sync', JSON.stringify({ ts: Date.now(), ok: true, kcal: 0, count: 0 }));
        return;
      }
      setSystemLogs(prev => {
        const next = [...prev];
        for (const [ddMm, patch] of Object.entries(patches)) {
          const idx = next.findIndex(l => l.date === ddMm);
          if (idx >= 0) {
            const existing = next[idx];
            const merged = { ...existing };
            // Previous Telegram-contributed values for this date (used to compute
            // the local-only portion before applying the new Telegram totals).
            const prevTgValues = existing._telegramValues ?? {};
            for (const [k, v] of Object.entries(patch)) {
              if (k === 'date' || k === '_telegramSynced' || k === '_telegramValues') continue;
              if (typeof v === 'number') {
                const prevTg = Number(prevTgValues[k] ?? 0);
                // Local-only = what the user entered on the site (not from Telegram)
                const localOnly = Math.max(0, Number(existing[k] ?? 0) - prevTg);
                merged[k] = localOnly + v;
              }
            }
            merged._telegramSynced = true;
            // Store the new Telegram totals so the next sync can subtract them correctly
            const tgValues = {};
            for (const [k, v] of Object.entries(patch)) {
              if (k !== 'date' && k !== '_telegramSynced' && typeof v === 'number') tgValues[k] = v;
            }
            merged._telegramValues = tgValues;
            next[idx] = merged;
          } else {
            next.push({
              ...createEmptyLog(ddMm),
              ...patch,
              date: ddMm,
              _telegramSynced: true,
              _telegramValues: Object.fromEntries(
                Object.entries(patch).filter(([k, v]) => k !== 'date' && typeof v === 'number')
              )
            });
          }
        }
        const todayPatch = patches[todayKey2];
        localStorage.setItem('shadow_monarch_tg_sync', JSON.stringify({
          ts: Date.now(),
          ok: true,
          kcal: Math.round(todayPatch?.consumed ?? 0),
          count: patchKeys.length,
        }));
        return next;
      });
    }
    syncTelegram();
    const t = setInterval(syncTelegram, 60_000);
    return () => clearInterval(t);
  }, []);

  // Memoria 2: Obiettivo Calorico (Mana Base)
  const [dailyGoal, setDailyGoal] = useState(() => {
    const savedGoal = localStorage.getItem('shadow_monarch_goal');
    return savedGoal ? parseInt(savedGoal) : 2400;
  });
// Memoria 2.5: Obiettivi Macronutrienti
  const [macroGoals, setMacroGoals] = useState(() => {
    const parsed = readJsonSafe('shadow_monarch_macros', null);
    if (parsed && typeof parsed === 'object') return parsed;
    return { carbs: 220, protein: 190, fats: 70 };
  });
  // Memoria 3: Statistiche Giocatore (EXP, Livello, Oro, AP, ecc.)
  const [playerStats, setPlayerStats] = useState(() => {
    const parsed = readJsonSafe('shadow_monarch_stats', null);
    if (parsed && typeof parsed === 'object') return parsed;
    return {
      level: 1,
      exp: 0,
      gold: 0,
      ap: 0,
      str: 10,
      vit: 10,
      agi: 10,
      streak: 0,
      useActiveBurnForBudget: false,
      healthSyncEnabled: false,
      healthSyncSource: 'manual',
      streakShieldTokens: 0
    };
  });
  const [hydrationGoal, setHydrationGoal] = useState(() => {
    const savedHydrationGoal = localStorage.getItem('shadow_monarch_hydration_goal');
    return savedHydrationGoal ? parseInt(savedHydrationGoal, 10) : 2800;
  });
  const [onboardingProfile, setOnboardingProfile] = useState(() => ({
    objective: String(playerStats?.objective || 'recomp'),
    trainingDays: Math.max(2, Math.min(6, Number(playerStats?.onboardingTrainingDays || 4))),
    sleepTarget: Math.max(6, Math.min(9, Number(playerStats?.onboardingSleepTarget || 7.5))),
    weekendSplit: Boolean(playerStats?.weekendCalorieBoostEnabled || false),
    mobilePerf: mobilePerformanceMode
  }));
  useEffect(() => {
    let timer = null;
    const unsubscribe = subscribeUiToast((event) => {
      const detail = event?.detail || {};
      const next = {
        id: Date.now(),
        message: String(detail.message || ''),
        tone: String(detail.tone || 'info'),
        actionLabel: String(detail.actionLabel || ''),
        onAction: typeof detail.onAction === 'function' ? detail.onAction : null
      };
      setToastState(next);
      if (timer) clearTimeout(timer);
      const duration = Math.max(2200, Number(detail.durationMs || 9000));
      setToastDurationMs(duration);
      timer = setTimeout(() => setToastState(null), duration);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Level-up cinematico al salire di livello (dopo la dichiarazione di playerStats)
  useEffect(() => {
    const lvl = Number(playerStats?.level || 1);
    if (prevLevelRef.current == null) { prevLevelRef.current = lvl; return; } // niente al primo mount
    if (lvl > prevLevelRef.current) setLevelUpTo(lvl);
    prevLevelRef.current = lvl;
  }, [playerStats?.level]);

  // Salvataggi automatici
  useEffect(() => { localStorage.setItem('shadow_monarch_logs', JSON.stringify(systemLogs)); }, [systemLogs]);
  useEffect(() => { localStorage.setItem('shadow_monarch_goal', dailyGoal.toString()); }, [dailyGoal]);
  useEffect(() => { localStorage.setItem('shadow_monarch_stats', JSON.stringify(playerStats)); }, [playerStats]);
useEffect(() => { localStorage.setItem('shadow_monarch_macros', JSON.stringify(macroGoals)); }, [macroGoals]);
  useEffect(() => { localStorage.setItem('shadow_monarch_hydration_goal', hydrationGoal.toString()); }, [hydrationGoal]);
  useEffect(() => { localStorage.setItem('shadow_monarch_sound', soundEnabled ? '1' : '0'); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('shadow_monarch_sound_theme', soundTheme); }, [soundTheme]);
  useEffect(() => { localStorage.setItem('shadow_monarch_crown_anthem', crownAnthemEnabled ? '1' : '0'); }, [crownAnthemEnabled]);
  useEffect(() => { localStorage.setItem('shadow_monarch_voice', voiceEnabled ? '1' : '0'); }, [voiceEnabled]);
  useEffect(() => { localStorage.setItem('shadow_monarch_voice_pack', voicePack); }, [voicePack]);
  useEffect(() => { localStorage.setItem('shadow_monarch_coach_mode', coachMode ? '1' : '0'); }, [coachMode]);
  useEffect(() => { localStorage.setItem('shadow_monarch_reminder_dismissed', dismissedReminderDate); }, [dismissedReminderDate]);
  useEffect(() => { localStorage.setItem('shadow_monarch_onboarding_state', JSON.stringify(onboardingState)); }, [onboardingState]);
  useEffect(() => { localStorage.setItem('shadow_monarch_system_compact', systemCompactMode ? '1' : '0'); }, [systemCompactMode]);
  useEffect(() => { localStorage.setItem('shadow_monarch_fx_mode', fxMode); }, [fxMode]);
  useEffect(() => { localStorage.setItem('shadow_monarch_mobile_performance_mode', mobilePerformanceMode ? '1' : '0'); }, [mobilePerformanceMode]);
  useEffect(() => { localStorage.setItem('shadow_monarch_reminder_snooze_until', String(Math.max(0, Number(reminderSnoozeUntil || 0)))); }, [reminderSnoozeUntil]);
  useEffect(() => { localStorage.setItem('shadow_monarch_reminder_adaptive_meta', JSON.stringify(reminderAdaptiveMeta || {})); }, [reminderAdaptiveMeta]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsNarrowViewport(window.innerWidth <= 430);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Applica payload Telegram al log di oggi (usato da URL param e da server claim)
  const applyTgImport = useCallback((payload) => {
    if (!payload?.type) return;
    // 🧠 Gate della Conoscenza: XP guadagnato studiando su Telegram → livello del personaggio
    if (payload.type === 'learn_xp' || payload.type === 'learn_boss') {
      const gained = Number(payload.amount || 0);
      if (gained > 0) {
        setPlayerStats?.((prev) => {
          // Modello sottrattivo condiviso (level*100 per salire), stesso di
          // Boss/Quests/French: prima qui si usava exp cumulativa e i due
          // modelli si sovrascrivevano a vicenda sullo stesso playerStats.
          const { level, exp } = applyXp(prev, gained);
          return { ...prev, level, exp };
        });
        const msg = payload.type === 'learn_boss'
          ? `🐉 Boss del Sapere sconfitto! +${gained} XP (${payload.score}/${payload.of})`
          : `🧠 Studio: +${gained} XP`;
        emitUiToast({ message: msg, tone: 'success', durationMs: 4000 });
        triggerFxBurst('success');
      }
      return;
    }
    const key = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    setSystemLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === key);
      const base = idx >= 0 ? prev[idx] : { date: key, consumed: 0, protein: 0, carbs: 0, fatMacros: 0, workoutBurn: 0, burned: 0, waterMl: 0 };
      let patch = {};
      if (payload.type === 'meal') {
        const slotKeyMap = { colazione: 'mealBreakfastKcal', pranzo: 'mealLunchKcal', cena: 'mealDinnerKcal', merenda: 'mealSnackKcal' };
        const slotKey = slotKeyMap[payload.slot] || null;
        patch = {
          consumed: Number(base.consumed || 0) + Number(payload.kcal || 0),
          protein: Number(base.protein || 0) + Number(payload.protein || 0),
          carbs: Number(base.carbs || 0) + Number(payload.carbs || 0),
          fatMacros: Number(base.fatMacros || 0) + Number(payload.fat || 0),
          ...(slotKey ? { [slotKey]: Number(base[slotKey] || 0) + Number(payload.kcal || 0) } : {}),
        };
      } else if (payload.type === 'workout') {
        const burn = Number(base.workoutBurn ?? base.burned ?? 0) + Number(payload.burn || 0);
        patch = { workoutBurn: burn, burned: burn };
      } else if (payload.type === 'measurement') {
        patch = {
          ...(payload.weight ? { weight: Number(payload.weight) } : {}),
          ...(payload.bodyFat ? { fat: Number(payload.bodyFat) } : {}),
          ...(payload.bodyWater ? { bodyWaterPct: Number(payload.bodyWater) } : {}),
          ...(payload.visceral ? { visceralFat: Number(payload.visceral) } : {}),
          ...(payload.leanMass ? { leanMass: Number(payload.leanMass) } : {}),
          ...(payload.muscleMass ? { muscleMassKg: Number(payload.muscleMass) } : {}),
        };
      }
      const updated = { ...base, ...patch };
      const next = [...prev];
      if (idx >= 0) { next[idx] = updated; } else { next.push(updated); }
      return next;
    });
    // Per le misurazioni aggiorna anche playerStats
    if (payload.type === 'measurement') {
      setPlayerStats?.((prev) => ({
        ...prev,
        ...(payload.weight ? { currentWeightKg: Number(payload.weight), lastWeightUpdateDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) } : {}),
        ...(payload.bodyFat ? { bodyFatPct: Number(payload.bodyFat) } : {}),
        ...(payload.height ? { heightCm: Number(payload.height) } : {}),
        ...(payload.age ? { age: Number(payload.age) } : {}),
        ...(payload.sex ? { sex: payload.sex } : {}),
        ...(payload.targetWeight ? { bodyGoal: { ...(prev.bodyGoal || {}), targetWeightKg: Number(payload.targetWeight) } } : {}),
      }));
    }
    const parts = [];
    if (payload.type === 'measurement') {
      if (payload.weight) parts.push(`⚖️ Peso ${payload.weight} kg`);
      if (payload.height) parts.push(`📏 Altezza ${payload.height} cm`);
      if (payload.age) parts.push(`🎂 Età ${payload.age} anni`);
      if (payload.sex) parts.push(`👤 Sesso ${payload.sex}`);
      if (payload.bodyFat) parts.push(`💧 BF ${payload.bodyFat}%`);
      if (payload.targetWeight) parts.push(`🎯 Target ${payload.targetWeight} kg`);
    }
    const label = payload.type === 'meal'
      ? `📲 ${payload.name || 'Pasto'}: +${payload.kcal || 0} kcal aggiunto al diario`
      : payload.type === 'measurement'
      ? parts.join(' · ') + ' salvato nel profilo'
      : `📲 ${payload.name || 'Workout'}: +${payload.burn || 0} kcal burn aggiunto`;
    emitUiToast({ message: label, tone: 'success', durationMs: 5000 });
    triggerFxBurst('success');
  }, []);

  // 1. Recupera import pendenti dal server (funziona da qualsiasi browser, bypassa WebView isolation)
  //    Coda completa: applica TUTTI gli import accodati (più messaggi Telegram non si perdono).
  //    Re-poll al focus/visibilità: il sito si aggiorna senza refresh manuale.
  useEffect(() => {
    // Il chat_id da cui importare è legato al BROWSER (localStorage), non fisso.
    // Nota iOS: "Aggiungi a Home" ignora l'URL corrente e riapre sempre lo
    // start_url del manifest (senza ?tg=), e l'icona ha memoria isolata da Safari.
    // Per questo l'abbinamento NON può dipendere solo dal query param: se manca,
    // chiediamolo una volta in-app (tgBindPrompt) — da lì resta salvato nell'icona.
    const TG_ID_KEY = 'shadow_monarch_tg_chat_id';
    const urlTg = new URLSearchParams(window.location.search).get('tg');
    if (urlTg && /^\d+$/.test(urlTg)) {
      try { window.localStorage.setItem(TG_ID_KEY, urlTg); } catch {}
    }
    let chatId = '';
    try { chatId = window.localStorage.getItem(TG_ID_KEY) || ''; } catch {}
    if (!chatId) { setTgBindPrompt(true); return undefined; }
    let polling = false;
    const claim = () => {
      if (polling) return;
      polling = true;
      // POST: il claim svuota la coda (DEL), non deve essere un GET innescabile da prefetch
      fetch(`/api/telegram/claim-import?chat_id=${chatId}`, { method: 'POST' })
        .then((r) => r.json())
        .then(({ items, data }) => {
          const list = Array.isArray(items) && items.length ? items : (data ? [data] : []);
          list.forEach((p) => applyTgImport(p));
        })
        .catch(() => {})
        .finally(() => { polling = false; });
    };
    claim();
    const onFocus = () => claim();
    const onVisible = () => { if (document.visibilityState === 'visible') claim(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applyTgImport]);

  // 2. Fallback: legge ?tg_import= dall'URL (per desktop o link diretti)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('tg_import');
    if (!raw) return;
    try {
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      applyTgImport(JSON.parse(atob(b64)));
      window.history.replaceState({}, '', window.location.pathname);
    } catch (_) {}
  }, [applyTgImport]);

  useEffect(() => {
    if (!tapPulseTick) return undefined;
    const timer = setTimeout(() => setTapPulseTick(0), 320);
    return () => clearTimeout(timer);
  }, [tapPulseTick]);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    const onChange = () => sync();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  useEffect(() => {
    if (!Array.isArray(systemLogs) || !systemLogs.length) return;
    const toIsoDay = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const workoutDateRows = systemLogs
      .filter((log) => isWorkoutLog(log))
      .map((log) => {
        const parsed = parseDdMmToDate(log?.date);
        if (!parsed) return null;
        parsed.setHours(0, 0, 0, 0);
        return { iso: toIsoDay(parsed), dateKey: String(log?.date || '') };
      })
      .filter(Boolean);
    const workoutIsoSet = new Set(workoutDateRows.map((row) => row.iso));
    const latestWorkoutDate = workoutDateRows.length
      ? workoutDateRows.sort((a, b) => a.iso.localeCompare(b.iso))[workoutDateRows.length - 1].dateKey
      : '';

    let current = 0;
    {
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      for (let i = 0; i < 400; i += 1) {
        const iso = toIsoDay(cursor);
        if (!workoutIsoSet.has(iso)) break;
        current += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    let best = 0;
    if (workoutDateRows.length) {
      const sortedIso = [...new Set(workoutDateRows.map((row) => row.iso))].sort((a, b) => a.localeCompare(b));
      let run = 0;
      let prevDate = null;
      sortedIso.forEach((iso) => {
        const currentDate = new Date(`${iso}T00:00:00`);
        if (prevDate) {
          const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000);
          run = diffDays === 1 ? run + 1 : 1;
        } else {
          run = 1;
        }
        if (run > best) best = run;
        prevDate = currentDate;
      });
    }

    setPlayerStats((prev) => {
      if (
        Number(prev.workoutStreakCurrent || 0) === current &&
        Number(prev.workoutStreakBest || 0) === best &&
        String(prev.lastWorkoutDate || '') === latestWorkoutDate
      ) {
        return prev;
      }
      return {
        ...prev,
        workoutStreakCurrent: current,
        workoutStreakBest: best,
        lastWorkoutDate: latestWorkoutDate || prev.lastWorkoutDate || ''
      };
    });
  }, [systemLogs]);
  const shouldReduceFx = mobilePerformanceMode || fxMode === 'lite' || (fxMode === 'auto' && (isNarrowViewport || prefersReducedMotion));
  const checkAiConnection = async () => {
    setAiStatus('checking');
    setAiStatusDetail('');
    try {
      await requestSystemAI({
        max_tokens: 6,
        temperature: 0,
        messages: [{ role: 'user', content: 'Rispondi solo con OK.' }]
      });
      setAiStatus('online');
    } catch (error) {
      setAiStatus('offline');
      const detail = formatAiErrorDetail(error?.message || 'AI non raggiungibile');
      setAiStatusDetail(detail.slice(0, 60));
    }
  };
  useEffect(() => {
    checkAiConnection();
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeAiStatus((event) => {
      const count = Number(event?.detail?.inflightCount || 0);
      setAiInflightCount(Math.max(0, count));
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKey = (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (key === 'escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 0) return; // Domenica
    const weekKey = getIsoWeekKey(now);
    if (playerStats.lastAutoSundayReportWeek === weekKey) return;
    const recent7 = [...systemLogs].slice(-7);
    const days = Math.max(1, recent7.length);
    const weekendBoostEnabled = Boolean(playerStats?.weekendCalorieBoostEnabled);
    const weekdayCalorieGoal = Math.max(1300, Number(playerStats?.weekendCalorieWeekdayTarget || dailyGoal || 2400));
    const weekendCalorieGoal = Math.max(1300, Number(playerStats?.weekendCalorieWeekendTarget || (weekdayCalorieGoal + Number(playerStats?.weekendCalorieDelta || 0))));
    const calorieTargetForLog = (log) => {
      if (!weekendBoostEnabled) return Number(dailyGoal || 2400);
      const parsed = parseDdMmToDate(log?.date);
      if (!parsed) return Number(dailyGoal || 2400);
      return isWeekendFromDate(parsed) ? weekendCalorieGoal : weekdayCalorieGoal;
    };
    const kcalAdh = Math.round((recent7.filter((log) => {
      const consumed = Number(log?.consumed || 0);
      const target = Math.max(1, Number(calorieTargetForLog(log) || dailyGoal || 2400));
      return consumed >= target * 0.8 && consumed <= target * 1.15;
    }).length / days) * 100);
    const hydrationAdh = Math.round((recent7.filter((log) => Number(log?.waterMl || 0) >= hydrationGoal * 0.8).length / days) * 100);
    const proteinAdh = Math.round((recent7.filter((log) => Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8).length / days) * 100);
    const sleepAvg = Number((recent7.reduce((sum, log) => sum + Number(log?.sleepHours || 0), 0) / days).toFixed(1));
    const trainingDays = recent7.filter((log) => Number(log?.workoutBurn ?? log?.burned ?? 0) >= 180 || Number(log?.strength || 0) > 0).length;
    const readinessAvg = Number((recent7.reduce((sum, log) => sum + Number(log?.recoveryScore || 0), 0) / days).toFixed(0));
    const splitStats = (() => {
      const aggregate = (isWeekend) => {
        const rows = recent7.filter((log) => {
          const parsed = parseDdMmToDate(log?.date);
          return parsed ? isWeekendFromDate(parsed) === isWeekend : false;
        });
        const tracked = rows.length;
        if (!tracked) return { tracked: 0, score: 0, kcal: 0, hydration: 0, protein: 0 };
        const kcal = Math.round((rows.filter((log) => {
          const consumed = Number(log?.consumed || 0);
          const target = Math.max(1, Number(calorieTargetForLog(log) || dailyGoal || 2400));
          return consumed >= target * 0.8 && consumed <= target * 1.15;
        }).length / tracked) * 100);
        const hydration = Math.round((rows.filter((log) => Number(log?.waterMl || 0) >= hydrationGoal * 0.8).length / tracked) * 100);
        const protein = Math.round((rows.filter((log) => Number(log?.protein || 0) >= Number(macroGoals?.protein || 190) * 0.8).length / tracked) * 100);
        return {
          tracked,
          kcal,
          hydration,
          protein,
          score: Math.round((kcal * 0.5) + (hydration * 0.25) + (protein * 0.25))
        };
      };
      return { weekday: aggregate(false), weekend: aggregate(true) };
    })();
    const hungerAvg3d = Number((recent7.slice(-3).reduce((sum, log) => sum + Number(log?.hungerLevel || 0), 0) / Math.max(1, recent7.slice(-3).length)).toFixed(1));
    const cravingAvg3d = Number((recent7.slice(-3).reduce((sum, log) => sum + Number(log?.cravingLevel || 0), 0) / Math.max(1, recent7.slice(-3).length)).toFixed(1));
    const hungerGuardrailActive = recent7.slice(-3).length >= 3 && (hungerAvg3d >= 7 || cravingAvg3d >= 7);
    const avgBurn3 = (() => {
      const last3 = recent7.slice(-3);
      return last3.length ? last3.reduce((sum, log) => sum + Number(log?.workoutBurn ?? log?.burned ?? 0), 0) / last3.length : 0;
    })();
    const avgSodium7 = recent7.length ? recent7.reduce((sum, log) => sum + Number(log?.sodiumMg || 0), 0) / recent7.length : 0;
    const seasonHeatExtra = [6, 7, 8].includes(now.getMonth() + 1) ? 220 : [5, 9].includes(now.getMonth() + 1) ? 110 : 0;
    const sodiumExtra = avgSodium7 > 2600 ? 180 : avgSodium7 > 2100 ? 90 : 0;
    const trainingExtra = Math.min(700, Math.round(avgBurn3 * 0.45));
    const weightRef = Math.max(45, Number(playerStats?.currentWeightKg || 70));
    const hydrationSmartTarget = Math.max(1800, Math.min(5200, Math.round((weightRef * 33) + seasonHeatExtra + sodiumExtra + trainingExtra)));
    const objective = String(playerStats?.objective || 'recomp');
    const refeedEligible = objective === 'cut' && (hungerGuardrailActive || sleepAvg < 6.7 || readinessAvg < 58);
    const performanceNutrition = (() => {
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
      if (!pairs.length) return { ready: false, delta: 0 };
      const carbCut = Number(macroGoals?.carbs || 220) * 0.8;
      const proteinCut = Number(macroGoals?.protein || 190) * 0.8;
      const highFuel = pairs.filter((p) => p.prevCarbs >= carbCut && p.prevProtein >= proteinCut);
      const lowFuel = pairs.filter((p) => p.prevCarbs < carbCut || p.prevProtein < proteinCut);
      const avg = (arr) => arr.length ? arr.reduce((s, r) => s + Number(r.todayStrength || 0), 0) / arr.length : 0;
      return { ready: true, delta: Number((avg(highFuel) - avg(lowFuel)).toFixed(1)), samples: pairs.length };
    })();
    let giTop = '';
    try {
      const rawGi = localStorage.getItem('shadow_monarch_gi_tracker');
      const parsedGi = rawGi ? JSON.parse(rawGi) : [];
      if (Array.isArray(parsedGi) && parsedGi.length) {
        const byFood = {};
        parsedGi.slice(0, 50).forEach((entry) => {
          const key = String(entry?.food || 'altro');
          if (!byFood[key]) byFood[key] = { food: key, count: 0, sym: 0 };
          byFood[key].count += 1;
          byFood[key].sym += Number(entry?.symptom || 0);
        });
        const top = Object.values(byFood)
          .map((row) => ({ ...row, avg: row.sym / Math.max(1, row.count) }))
          .sort((a, b) => b.avg - a.avg || b.count - a.count)[0];
        giTop = top ? `${top.food} (${Number(top.avg).toFixed(1)}/10)` : '';
      }
    } catch (_) {}
    const weeklyScore = Math.round(
      (kcalAdh * 0.28) +
      (hydrationAdh * 0.2) +
      (proteinAdh * 0.2) +
      (Math.min(100, (sleepAvg / 8) * 100) * 0.14) +
      (Math.min(100, (trainingDays / 4) * 100) * 0.1) +
      (Math.min(100, readinessAvg) * 0.08)
    );
    const focus = [];
    if (hydrationAdh < 70) focus.push('Alza acqua: +400ml in 2 momenti fissi');
    if (proteinAdh < 70) focus.push('Aggiungi 25-35g proteine nel pasto più debole');
    if (sleepAvg < 7) focus.push('Punta a +30 minuti di sonno medio');
    if (trainingDays < 3) focus.push('Minimo 3 sessioni brevi da 20-35 min');
    if (kcalAdh < 70) focus.push('Stabilisci 1 meal template fisso al giorno');
    if (hungerGuardrailActive) focus.push('Fame/craving alti: applica guardrail (+fibre/proteine, kcal mirato).');
    if (splitStats.weekend.score + 8 < splitStats.weekday.score) focus.push('Weekend compliance bassa: usa split sab/dom con piano pasti fisso.');
    const wins = [
      kcalAdh >= 85 ? `Kcal adherence forte (${kcalAdh}%)` : null,
      hydrationAdh >= 85 ? `Idratazione solida (${hydrationAdh}%)` : null,
      proteinAdh >= 85 ? `Proteine solide (${proteinAdh}%)` : null,
      sleepAvg >= 7.2 ? `Sleep medio buono (${sleepAvg}h)` : null,
      trainingDays >= 4 ? `Training costante (${trainingDays}/7)` : null,
      splitStats.weekend.score >= 78 ? `Weekend compliance solida (${splitStats.weekend.score}%)` : null
    ].filter(Boolean).slice(0, 3);
    const risks = [
      kcalAdh < 75 ? 'Kcal adherence instabile' : null,
      hydrationAdh < 75 ? 'Acqua sotto target' : null,
      proteinAdh < 75 ? 'Proteine sotto target' : null,
      sleepAvg < 6.8 ? 'Sleep debt in crescita' : null,
      trainingDays < 3 ? 'Volume allenante basso' : null,
      splitStats.weekend.score > 0 && splitStats.weekend.score + 10 < splitStats.weekday.score ? 'Gap weekend vs weekday marcato' : null,
      refeedEligible ? 'Cut stressato: valuta refeed controllato' : null
    ].filter(Boolean).slice(0, 3);
    const nextWeekPlan = [
      hydrationAdh < 80 ? '2 trigger acqua fissi (+400ml mattina, +400ml pomeriggio).' : 'Mantieni routine acqua attuale.',
      proteinAdh < 80 ? 'Aggiungi 25-35g proteine nel pasto più debole.' : 'Conferma quota proteica attuale.',
      trainingDays < 4 ? 'Pianifica 3-4 sessioni brevi (20-35 min) nel calendario.' : 'Mantieni la frequenza training.',
      sleepAvg < 7 ? 'Anticipa di 25-30 min la sleep window.' : 'Conserva la sleep window attuale.',
      `Hydration smart target: ${hydrationSmartTarget} ml`,
      performanceNutrition.ready ? `Performance fuel delta: ${performanceNutrition.delta > 0 ? '+' : ''}${performanceNutrition.delta} strength` : 'Performance fuel: servono piu dati',
      giTop ? `GI trigger da monitorare: ${giTop}` : 'GI tracker: logga 3+ trigger per pattern affidabile'
    ].slice(0, 4);
    const summary = `Score ${weeklyScore}/100 · Kcal ${kcalAdh}% · H2O ${hydrationAdh}% · Prot ${proteinAdh}% · Sleep ${sleepAvg}h · Train ${trainingDays}/7 · WD ${splitStats.weekday.score}% / WE ${splitStats.weekend.score}%`;
    setPlayerStats((prev) => ({
      ...prev,
      lastAutoSundayReportWeek: weekKey,
      sundayAutoReport: {
        weekKey,
        createdAt: new Date().toISOString(),
        summary,
        score: weeklyScore,
        focus: (focus.length ? focus : ['Settimana solida: mantieni routine e progressione lineare.']).slice(0, 4),
        wins,
        risks,
        nextWeekPlan,
        advanced: {
          complianceByDayType: splitStats,
          hungerGuardrail: { active: hungerGuardrailActive, hungerAvg3d, cravingAvg3d },
          hydrationSmartTarget,
          performanceFuelDelta: performanceNutrition.delta,
          performanceFuelSamples: performanceNutrition.samples || 0,
          refeedEligible,
          giTop
        }
      }
    }));
  }, [systemLogs, playerStats.lastAutoSundayReportWeek, playerStats.weekendCalorieBoostEnabled, playerStats.weekendCalorieWeekdayTarget, playerStats.weekendCalorieWeekendTarget, playerStats.weekendCalorieDelta, playerStats.currentWeightKg, playerStats.objective, setPlayerStats, dailyGoal, hydrationGoal, macroGoals]);
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    setPlayerStats((prev) => {
      if (prev.lastLoginDate === todayStr) return prev;
      let nextStreak = prev.streak || 0;
      if (!prev.lastLoginDate) {
        nextStreak = 1;
      } else {
        const last = new Date(prev.lastLoginDate);
        const now = new Date(todayStr);
        const diffDays = Math.round(Math.abs((now - last) / (1000 * 60 * 60 * 24)));
        if (diffDays === 1) {
          nextStreak += 1;
        } else if (diffDays === 2 && (prev.streakShieldTokens || 0) > 0) {
          nextStreak += 1;
          return {
            ...prev,
            streak: nextStreak,
            streakShieldTokens: Math.max((prev.streakShieldTokens || 0) - 1, 0),
            lastLoginDate: todayStr
          };
        } else {
          nextStreak = 1;
        }
      }
      return { ...prev, streak: nextStreak, lastLoginDate: todayStr };
    });
  }, []);
  const handleTabChange = (nextPage) => {
    if (nextPage === activePage) {
      setMenuOpen(false);
      return;
    }
    setLastPageIndex(pagesOrder.indexOf(activePage));
    setActivePage(nextPage);
    setMenuOpen(false);
    setQuickAddOpen(false);
    if (!shouldReduceFx && (nextPage === 'system' || nextPage === 'training')) {
      setPageIntroFx({
        id: Date.now(),
        page: nextPage
      });
    }
    triggerFxBurst('light');
    setTapPulseTick(Date.now());
    playSfx('nav', soundEnabled, soundTheme);
  };
  useEffect(() => {
    if (!pageIntroFx) return;
    const timer = setTimeout(() => setPageIntroFx(null), 820);
    return () => clearTimeout(timer);
  }, [pageIntroFx]);
  const todayKey = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayIso = new Date().toLocaleDateString('en-CA');
  const todayLog = systemLogs.find((log) => log.date === todayKey) || createEmptyLog(todayKey);
  const weeklyWeighInDue = (() => {
    const raw = playerStats.lastWeeklyWeighInDate;
    if (!raw) return true;
    const last = new Date(raw);
    if (Number.isNaN(last.getTime())) return true;
    const now = new Date(todayIso);
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
  })();
  const markWeeklyWeighInDone = () => {
    setPlayerStats((prev) => ({
      ...prev,
      lastWeeklyWeighInDate: todayIso
    }));
    setDismissedReminderDate(todayKey);
    triggerFxBurst('success');
  };
  const trackReminderAction = (id, action = 'shown') => {
    if (!id) return;
    const nowTs = Date.now();
    setReminderAdaptiveMeta((prev) => {
      const current = prev?.[id] || {};
      const next = {
        ...current,
        lastShownAt: action === 'shown' ? nowTs : Number(current.lastShownAt || nowTs),
        shownCount: action === 'shown' ? Number(current.shownCount || 0) + 1 : Number(current.shownCount || 0),
        resolveCount: action === 'resolved' ? Number(current.resolveCount || 0) + 1 : Number(current.resolveCount || 0),
        dismissCount: action === 'dismissed' ? Number(current.dismissCount || 0) + 1 : Number(current.dismissCount || 0),
        snoozeCount: action === 'snooze' ? Number(current.snoozeCount || 0) + 1 : Number(current.snoozeCount || 0),
        updatedAt: nowTs
      };
      return { ...(prev || {}), [id]: next };
    });
  };
  const contextualReminder = useMemo(() => {
    if (dismissedReminderDate === todayKey) return null;
    const now = new Date();
    const hour = now.getHours();
    const nowTs = now.getTime();
    if (Number(reminderSnoozeUntil || 0) > nowTs) return null;
    const reminders = [];
    const pushReminder = (id, title, text, baseScore, page = 'system') => {
      const meta = reminderAdaptiveMeta?.[id] || {};
      const lastShownAt = Number(meta.lastShownAt || 0);
      const shownCount = Number(meta.shownCount || 0);
      const resolveCount = Number(meta.resolveCount || 0);
      const avoidSpamPenalty = Math.min(35, shownCount * 4);
      const engagementBoost = Math.min(24, resolveCount * 3);
      const recencyPenalty = lastShownAt && (nowTs - lastShownAt < (1000 * 60 * 90)) ? 22 : 0;
      const score = baseScore + engagementBoost - avoidSpamPenalty - recencyPenalty;
      reminders.push({ id, title, text, score, page });
    };
    const breakfastDone = Number(todayLog?.mealBreakfastKcal || 0) > 0;
    const lunchDone = Number(todayLog?.mealLunchKcal || 0) > 0;
    const dinnerDone = Number(todayLog?.mealDinnerKcal || 0) > 0;
    const consumedPct = Number(todayLog.consumed || 0) / Math.max(1, Number(dailyGoal || 0));
    const hydrationPct = Number(todayLog.waterMl || 0) / Math.max(1, Number(hydrationGoal || 0));
    const progressiveHydrationTarget = Math.max(0.2, Math.min(1, (hour + 1) / 24));
    if (weeklyWeighInDue && hour >= 9) {
      pushReminder('weekly_weighin', 'Reminder pesata settimanale', 'È ora della pesata weekly. Dopo averla fatta premi "Fatto".', 92, 'system');
    }
    if (playerStats.lastMorningCheckinDate !== todayIso && hour >= 9 && hour < 14) {
      pushReminder('morning_checkin', 'Reminder check-in mattino', 'Manca il check-in mattutino 10s. Ti aiuta con focus giornata e recovery.', 84, 'system');
    }
    if (!breakfastDone && hour >= 8 && hour <= 11) {
      pushReminder('meal_breakfast', 'Reminder colazione', 'Colazione non registrata: inserisci il primo pasto per stabilizzare energia e focus.', 80, 'system');
    }
    if (!lunchDone && hour >= 12 && hour <= 16) {
      pushReminder('meal_lunch', 'Reminder pranzo', 'Pranzo non registrato: completa il meal log per mantenere i macro in traiettoria.', 82, 'system');
    }
    if (!dinnerDone && hour >= 19 && hour <= 22) {
      pushReminder('meal_dinner', 'Reminder cena', 'Cena non registrata: chiudi la giornata nutrizione con un pasto completo.', 84, 'system');
    }
    if (consumedPct < 0.35 && hour >= 13) {
      pushReminder('nutrition', 'Reminder nutrizione', 'Sei sotto il 35% delle kcal giornaliere. Inserisci un pasto completo per mantenere energia stabile.', 78, 'system');
    }
    if (hydrationPct < Math.max(0.5, progressiveHydrationTarget - 0.08) && hour >= 11) {
      pushReminder('hydration', 'Reminder idratazione', 'Sei sotto il ritmo acqua del giorno. Aggiungi 400-600 ml entro la prossima ora.', 82, 'system');
    }
    if ((todayLog.burned || 0) < 120 && playerStats.lastWorkoutDate !== todayKey && hour >= 18) {
      pushReminder('training', 'Reminder training', 'Nessuna sessione registrata oggi. Anche 15-20 minuti mantengono attiva la streak.', 88, 'training');
    }
    if (playerStats.lastEveningCheckinDate !== todayIso && hour >= 21) {
      pushReminder('evening_checkin', 'Reminder check-in serale', 'Manca il check-in 20s. Salvalo da System per migliorare recovery e suggerimenti automatici.', 76, 'system');
    }
    if (!reminders.length) return null;
    return reminders.sort((a, b) => b.score - a.score)[0] || null;
  }, [
    dismissedReminderDate,
    todayKey,
    todayIso,
    todayLog,
    dailyGoal,
    hydrationGoal,
    playerStats.lastWorkoutDate,
    playerStats.lastEveningCheckinDate,
    weeklyWeighInDue,
    playerStats.lastMorningCheckinDate,
    reminderSnoozeUntil,
    reminderAdaptiveMeta
  ]);
  useEffect(() => {
    if (!contextualReminder?.id) return;
    trackReminderAction(contextualReminder.id, 'shown');
  }, [contextualReminder?.id]);
  const nextAction = useMemo(() => {
    if ((todayLog.waterMl || 0) < hydrationGoal * 0.7) {
      return { title: 'Prossima mossa', text: 'Bevi 400-600 ml ora.', page: 'system' };
    }
    if (weeklyWeighInDue) {
      return { title: 'Prossima mossa', text: 'Fai pesata settimanale e segna "fatto".', page: 'system' };
    }
    if ((todayLog.protein || 0) < (macroGoals?.protein || 190) * 0.65) {
      return { title: 'Prossima mossa', text: 'Aggiungi +25g proteine nel prossimo pasto.', page: 'system' };
    }
    if (playerStats.lastMorningCheckinDate !== todayIso) {
      return { title: 'Prossima mossa', text: 'Completa il check-in mattutino 10s.', page: 'system' };
    }
    if (playerStats.lastEveningCheckinDate !== todayIso && new Date().getHours() >= 20) {
      return { title: 'Prossima mossa', text: 'Salva check-in serale 20s prima di chiudere giornata.', page: 'system' };
    }
    if ((todayLog.burned || 0) < 140 && playerStats.lastWorkoutDate !== todayKey) {
      return { title: 'Prossima mossa', text: 'Fai 15-20 minuti di movimento leggero.', page: 'training' };
    }
    return { title: 'Prossima mossa', text: 'Ottimo ritmo: continua con il piano attuale.', page: 'stats' };
  }, [todayLog, hydrationGoal, macroGoals, playerStats.lastMorningCheckinDate, playerStats.lastEveningCheckinDate, playerStats.lastWorkoutDate, todayIso, todayKey, weeklyWeighInDue]);
  const applyQuickAdd = (mode) => {
    const slotKey = quickMealSlot === 'breakfast'
      ? 'mealBreakfastKcal'
      : quickMealSlot === 'dinner'
        ? 'mealDinnerKcal'
        : 'mealLunchKcal';
    setSystemLogs((prevLogs) => {
      const idx = prevLogs.findIndex((log) => log.date === todayKey);
      const base = idx >= 0 ? prevLogs[idx] : createEmptyLog(todayKey);
      const patch = (() => {
        if (mode === 'water') return { waterMl: Number(base.waterMl || 0) + 350 };
        if (mode === 'meal') return {
          consumed: Number(base.consumed || 0) + 480,
          protein: Number(base.protein || 0) + 26,
          carbs: Number(base.carbs || 0) + 46,
          fatMacros: Number(base.fatMacros || 0) + 16,
          [slotKey]: Number(base?.[slotKey] || 0) + 480
        };
        if (mode === 'protein') return {
          consumed: Number(base.consumed || 0) + 170,
          protein: Number(base.protein || 0) + 28
        };
        if (mode === 'workout') {
          const nextBurn = Number(base.workoutBurn ?? base.burned ?? 0) + 220;
          return {
            workoutBurn: nextBurn,
            burned: nextBurn,
            strength: Number(base.strength || 0) + 24
          };
        }
        if (mode === 'skincare_am') return { skincareMorning: true };
        if (mode === 'skincare_pm') return { skincareEvening: true };
        return {};
      })();
      const nextLog = { ...base, ...patch };
      if (idx >= 0) {
        const next = [...prevLogs];
        next[idx] = nextLog;
        return next;
      }
      return [...prevLogs, nextLog];
    });
    if (mode === 'workout') {
      setPlayerStats((prev) => ({ ...prev, lastWorkoutDate: todayKey }));
    }
    setQuickAddOpen(false);
    triggerFxBurst('success');
    setTapPulseTick(Date.now());
    playSfx('success', soundEnabled, soundTheme);
  };
  const commandItems = useMemo(() => {
    const base = [
      { id: 'goto-system', label: 'Apri System', section: 'Navigate', run: () => handleTabChange('system') },
      { id: 'goto-systemplus', label: 'Apri System+', section: 'Navigate', run: () => handleTabChange('systemplus') },
      { id: 'goto-training', label: 'Apri Train', section: 'Navigate', run: () => handleTabChange('training') },
      { id: 'goto-recovery', label: 'Apri Bio', section: 'Navigate', run: () => handleTabChange('recovery') },
      { id: 'goto-quests', label: 'Apri Quest', section: 'Navigate', run: () => handleTabChange('quests') },
      { id: 'goto-boss', label: 'Apri Gate', section: 'Navigate', run: () => handleTabChange('boss') },
      { id: 'goto-calendar', label: 'Apri Calendar', section: 'Navigate', run: () => handleTabChange('calendar') },
      { id: 'goto-stats', label: 'Apri Stats', section: 'Navigate', run: () => handleTabChange('stats') },
      { id: 'goto-help', label: 'Apri Help', section: 'Navigate', run: () => handleTabChange('help') },
      { id: 'quick-water', label: 'Quick Add: +350ml acqua', section: 'Quick Add', run: () => applyQuickAdd('water') },
      { id: 'quick-meal', label: 'Quick Add: +Pasto', section: 'Quick Add', run: () => applyQuickAdd('meal') },
      { id: 'quick-protein', label: 'Quick Add: +Protein', section: 'Quick Add', run: () => applyQuickAdd('protein') },
      { id: 'quick-workout', label: 'Quick Add: +Workout', section: 'Quick Add', run: () => applyQuickAdd('workout') },
      { id: 'ai-test', label: 'Test AI Connection', section: 'System', run: () => checkAiConnection() }
    ];
    const q = String(commandQuery || '').trim().toLowerCase();
    if (!q) return base.slice(0, 12);
    return base
      .filter((item) => item.label.toLowerCase().includes(q) || String(item.section || '').toLowerCase().includes(q))
      .slice(0, 14);
  }, [commandQuery, quickMealSlot, todayKey]);

  const onboardingSteps = [
    { id: 'welcome', title: 'Benvenuto nel Sistema', text: 'Questa app traccia nutrizione, allenamento e recovery con suggerimenti automatici.' },
    { id: 'setup', title: '1. Setup Intelligente', text: 'Imposta obiettivo, training, sleep e weekend split: il sistema calibra target in automatico.' },
    { id: 'training', title: '2. Registra Training', text: 'Apri Train e salva una sessione o mini-quest per attivare la streak.' },
    { id: 'recovery', title: '3. Recovery & Sleep', text: 'Apri Bio per sonno, readiness e consigli di recupero.' },
    { id: 'done', title: 'Sistema pronto', text: 'Da ora segui reminder e check-in serale per restare in progressione.' }
  ];
  const activeOnboardingStep = onboardingSteps[Math.min(onboardingState.step, onboardingSteps.length - 1)];

  const closeOnboarding = () => {
    setOnboardingState({ done: true, step: onboardingSteps.length - 1 });
  };

  const onboardingNext = () => {
    setOnboardingState((prev) => {
      const nextStep = Math.min((prev.step || 0) + 1, onboardingSteps.length - 1);
      const done = nextStep >= onboardingSteps.length - 1;
      return { done, step: nextStep };
    });
  };

  const onboardingJump = (page) => {
    handleTabChange(page);
  };
  const applySmartOnboardingSetup = () => {
    const objective = String(onboardingProfile?.objective || 'recomp');
    const trainingDays = Math.max(2, Math.min(6, Number(onboardingProfile?.trainingDays || 4)));
    const sleepTarget = Math.max(6, Math.min(9, Number(onboardingProfile?.sleepTarget || 7.5)));
    const weekendSplit = Boolean(onboardingProfile?.weekendSplit);
    const weight = Math.max(45, Number(playerStats?.currentWeightKg || 70));
    const base = objective === 'cut' ? Math.round(weight * 30) : objective === 'bulk' ? Math.round(weight * 37) : Math.round(weight * 33);
    const trainAdj = trainingDays >= 5 ? 160 : trainingDays <= 2 ? -120 : 0;
    const sleepAdj = sleepTarget >= 8 ? 60 : sleepTarget <= 6.5 ? -80 : 0;
    const calibratedKcal = Math.max(1500, Math.min(4200, base + trainAdj + sleepAdj));
    const proteinPerKg = objective === 'cut' ? 2.2 : objective === 'bulk' ? 1.9 : 2.0;
    const protein = Math.max(120, Math.round(weight * proteinPerKg));
    const fats = Math.max(45, Math.round(weight * 0.9));
    const carbs = Math.max(90, Math.round((calibratedKcal - ((protein * 4) + (fats * 9))) / 4));
    const hydration = Math.max(2000, Math.min(5200, Math.round((weight * 34) + (trainingDays * 140))));
    const weekendDelta = objective === 'bulk' ? 320 : objective === 'cut' ? 180 : 240;
    setDailyGoal(calibratedKcal);
    setMacroGoals({ carbs, protein, fats });
    setHydrationGoal(hydration);
    setMobilePerformanceMode(Boolean(onboardingProfile?.mobilePerf));
    setPlayerStats((prev) => ({
      ...prev,
      objective,
      onboardingTrainingDays: trainingDays,
      onboardingSleepTarget: sleepTarget,
      weekendCalorieBoostEnabled: weekendSplit,
      weekendCalorieDelta: weekendSplit ? weekendDelta : 0,
      weekendCalorieWeekdayTarget: calibratedKcal,
      weekendCalorieWeekendTarget: weekendSplit ? (calibratedKcal + weekendDelta) : calibratedKcal,
      quickSetupAt: new Date().toISOString()
    }));
    setOnboardingState({ done: true, step: onboardingSteps.length - 1 });
    triggerFxBurst('success');
    handleTabChange('system');
  };
  const completeQuickSetup = () => {
    setDailyGoal((prev) => {
      const value = Number(prev || 0);
      return Number.isFinite(value) && value >= 1400 ? value : 2400;
    });
    setHydrationGoal((prev) => {
      const value = Number(prev || 0);
      return Number.isFinite(value) && value >= 1200 ? value : 2800;
    });
    setMacroGoals((prev) => {
      const carbs = Number(prev?.carbs || 0);
      const protein = Number(prev?.protein || 0);
      const fats = Number(prev?.fats || 0);
      if (carbs > 0 && protein > 0 && fats > 0) return prev;
      return { carbs: 220, protein: 190, fats: 70 };
    });
    setPlayerStats((prev) => ({ ...prev, quickSetupAt: new Date().toISOString() }));
    setOnboardingState({ done: true, step: onboardingSteps.length - 1 });
    triggerFxBurst('success');
    handleTabChange('system');
  };

  const createBackupPayload = () => {
    const data = {};
    const includedKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('shadow_monarch_')) continue;
      data[key] = localStorage.getItem(key);
      includedKeys.push(key);
    }
    return {
      app: 'solo-leveling-fit',
      version: 1,
      exportedAt: new Date().toISOString(),
      keysCount: includedKeys.length,
      keys: includedKeys.sort(),
      data
    };
  };
  useEffect(() => {
    const session = getCloudSession();
    if (!session?.token || !session?.userId || !session?.isExpired) return;
    refreshCloudSession().catch(() => {});
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const session = getCloudSession();
    if (!session.isAuthenticated) return undefined;
    const timer = setTimeout(async () => {
      try {
        await cloudPush({ backupPayload: createBackupPayload() });
        localStorage.setItem('shadow_monarch_cloud_last_auto_push', new Date().toISOString());
      } catch (_) {
        // Silent fail: il sync cloud manuale da Help resta disponibile.
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [systemLogs, dailyGoal, macroGoals, hydrationGoal, playerStats]);
  useEffect(() => {
    try {
      const weekKey = getIsoWeekKey();
      const metaRaw = localStorage.getItem('shadow_monarch_auto_backup_meta');
      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      if (meta.lastWeekKey === weekKey) return;
      const payload = createBackupPayload();
      const currentRaw = localStorage.getItem('shadow_monarch_auto_backups');
      const current = currentRaw ? JSON.parse(currentRaw) : [];
      const next = [
        {
          id: `${weekKey}-${Date.now()}`,
          weekKey,
          createdAt: new Date().toISOString(),
          payload
        },
        ...current
      ].slice(0, 12);
      localStorage.setItem('shadow_monarch_auto_backups', JSON.stringify(next));
      localStorage.setItem('shadow_monarch_auto_backup_meta', JSON.stringify({ lastWeekKey: weekKey, updatedAt: new Date().toISOString() }));
    } catch (_) {}
  }, []);
  useEffect(() => {
    try {
      const dayKey = new Date().toLocaleDateString('en-CA');
      const metaRaw = localStorage.getItem('shadow_monarch_daily_restore_meta');
      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      if (meta.lastDayKey === dayKey) return;
      const payload = createBackupPayload();
      const currentRaw = localStorage.getItem('shadow_monarch_daily_restore_points');
      const current = currentRaw ? JSON.parse(currentRaw) : [];
      const next = [
        {
          id: `restore-${dayKey}-${Date.now()}`,
          dayKey,
          createdAt: new Date().toISOString(),
          payload
        },
        ...((Array.isArray(current) ? current : []).filter((item) => item?.dayKey !== dayKey))
      ].slice(0, 14);
      localStorage.setItem('shadow_monarch_daily_restore_points', JSON.stringify(next));
      localStorage.setItem('shadow_monarch_daily_restore_meta', JSON.stringify({ lastDayKey: dayKey, updatedAt: new Date().toISOString() }));
    } catch (_) {}
  }, []);

  const importBackupPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
      throw new Error('Backup non valido');
    }
    Object.entries(payload.data).forEach(([key, value]) => {
      if (!key.startsWith('shadow_monarch_')) return;
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    });
    window.location.reload();
  };

  const resetAppData = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('shadow_monarch_')) continue;
      keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };
  const upsertTodayLog = (updater) => {
    setSystemLogs((prevLogs) => {
      const index = prevLogs.findIndex((log) => log.date === todayKey);
      if (index >= 0) {
        const current = prevLogs[index];
        const updates = typeof updater === 'function' ? updater(current) : updater;
        const next = [...prevLogs];
        next[index] = { ...current, ...updates };
        return next;
      }
      const base = createEmptyLog(todayKey);
      const updates = typeof updater === 'function' ? updater(base) : updater;
      return [...prevLogs, { ...base, ...updates }];
    });
  };
  const quickAddWater = () => {
    upsertTodayLog((current) => ({ waterMl: Number(current.waterMl || 0) + 400 }));
    triggerFxBurst('success');
    setMenuOpen(false);
  };
  const quickMorningCheckin = () => {
    const sleep = Number(todayLog.sleepHours || 7);
    const sleepQuality = Number(todayLog.sleepQuality || 7);
    const awakenings = Number(todayLog.awakenings || 1);
    const hrRest = Number(todayLog.hrRest || 60);
    const hrvMs = Number(todayLog.hrvMs || 45);
    const energy = Number(playerStats.energyLevel || 6);
    const stress = Number(playerStats.stressLevel || 4);
    setPlayerStats((prev) => ({
      ...prev,
      lastMorningCheckinDate: todayIso,
      lastMorningCheckin: { date: todayIso, sleepHours: sleep, sleepQuality, awakenings, hrRest, hrvMs, energy, stress },
      morningCheckins: [{ date: todayIso, sleepHours: sleep, sleepQuality, awakenings, hrRest, hrvMs, energy, stress }, ...((prev.morningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    upsertTodayLog({ sleepHours: sleep, sleepQuality, awakenings, hrRest, hrvMs, energyLevel: energy });
    triggerFxBurst('success');
    setMenuOpen(false);
    handleTabChange('system');
  };
  const quickEveningCheckin = () => {
    const hunger = Number(playerStats.lastEveningCheckin?.hunger || 5);
    const stress = Number(playerStats.lastEveningCheckin?.stress || 5);
    const dayQuality = Number(playerStats.lastEveningCheckin?.dayQuality || 6);
    const craving = Number(playerStats.lastEveningCheckin?.craving || 5);
    const eveningEnergy = Number(playerStats.lastEveningCheckin?.eveningEnergy || playerStats.energyLevel || 6);
    const bloating = Number(playerStats.lastEveningCheckin?.bloating || 4);
    const digestion = Number(playerStats.lastEveningCheckin?.digestion || 6);
    const tolerance = Number(playerStats.lastEveningCheckin?.tolerance || 7);
    setPlayerStats((prev) => ({
      ...prev,
      lastEveningCheckinDate: todayIso,
      lastEveningCheckin: {
        date: todayIso,
        hunger,
        stress,
        dayQuality,
        craving,
        eveningEnergy,
        bloating,
        digestion,
        tolerance,
        notes: ''
      },
      eveningCheckins: [{
        date: todayIso,
        hunger,
        stress,
        dayQuality,
        craving,
        eveningEnergy,
        bloating,
        digestion,
        tolerance,
        notes: ''
      }, ...((prev.eveningCheckins || []).filter((entry) => entry.date !== todayIso))].slice(0, 30)
    }));
    upsertTodayLog({
      bloatingLevel: bloating,
      digestionRegularity: digestion,
      mealTolerance: tolerance,
      cravingLevel: craving,
      hungerLevel: hunger,
      energyLevel: eveningEnergy
    });
    triggerFxBurst('success');
    setMenuOpen(false);
    handleTabChange('system');
  };

  return (
    <div
      className={`app-shell-fs gameframe-shell premium-shell system-scanlines neon-cinema theme-${activePage} ${shouldReduceFx ? 'fx-lite' : ''} max-w-[390px] mx-auto bg-void-black relative shadow-2xl overflow-hidden border-x border-white/5 flex flex-col`}>
      {showIntro && <NeuralIntro onDone={() => setShowIntro(false)} />}
      {tgBindPrompt ? (
        <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-sm p-5 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">Chi sei?</p>
          <p className="text-[11px] text-gray-400 max-w-[280px]">
            Abbina questo telefono al tuo account Telegram, così i tuoi dati restano separati. Serve una sola volta.
          </p>
          <button
            onClick={() => {
              try { window.localStorage.setItem('shadow_monarch_tg_chat_id', '264863579'); } catch {}
              window.location.reload();
            }}
            className="w-full max-w-[260px] border border-cyan-300/40 bg-cyan-300/10 text-white text-xs uppercase tracking-widest py-3 hover:bg-cyan-300/20"
          >
            Sono Emanuele
          </button>
          <button
            onClick={() => {
              try { window.localStorage.setItem('shadow_monarch_tg_chat_id', '546598075'); } catch {}
              window.location.reload();
            }}
            className="w-full max-w-[260px] border border-cursed-purple/40 bg-cursed-purple/10 text-white text-xs uppercase tracking-widest py-3 hover:bg-cursed-purple/20"
          >
            Sono Alessandro
          </button>
          <input
            value={tgBindCustom}
            onChange={(e) => setTgBindCustom(e.target.value.replace(/\D/g, ''))}
            placeholder="Il tuo chat_id (scrivi /id al bot)"
            inputMode="numeric"
            className="w-full max-w-[260px] bg-black/60 border border-white/15 text-white text-xs p-2 text-center outline-none focus:border-cyan-300/50"
          />
          <button
            onClick={() => {
              const id = tgBindCustom.trim();
              if (!/^\d+$/.test(id)) return;
              try { window.localStorage.setItem('shadow_monarch_tg_chat_id', id); } catch {}
              window.location.reload();
            }}
            disabled={!/^\d+$/.test(tgBindCustom.trim())}
            className="w-full max-w-[260px] border border-white/15 bg-white/5 text-white text-xs uppercase tracking-widest py-3 hover:bg-white/10 disabled:opacity-30"
          >
            Conferma
          </button>
        </div>
      ) : null}
      <TouchSparks />
      <AnimatePresence>
        {levelUpTo != null && <LevelUpOverlay key="levelup" level={levelUpTo} onDone={() => setLevelUpTo(null)} />}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 cinematic-backdrop">
        <div className="absolute inset-0 aurora-layer"></div>
        <div className="absolute inset-0 hud-grid"></div>
        <div className="absolute -top-24 -left-20 h-56 w-56 rounded-full bg-system-blue/15 blur-3xl drift-slow"></div>
        <div className="absolute top-1/3 -right-24 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl drift-reverse"></div>
        <div className="absolute -bottom-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cursed-purple/15 blur-3xl pulse-glow"></div>
        <img src="/avatar8.png" alt="" className="anime-float absolute -left-10 top-24 w-24 opacity-20 grayscale" />
        <img src="/boss9.png" alt="" className="anime-float-reverse absolute -right-12 top-40 w-28 opacity-16 grayscale" />
        <img src="/avatar6.png" alt="" className="anime-float absolute left-1/2 bottom-24 w-20 -translate-x-1/2 opacity-14 grayscale" />
        <img src="/boss4.png" alt="" className="anime-float-reverse absolute right-10 bottom-40 w-24 opacity-12 grayscale" />
        <div className="absolute inset-0 starfield"></div>
      </div>
      <div className="absolute top-2 right-2 z-[90] flex items-center gap-1">
        <button
          onClick={() => { setMenuOpen((prev) => !prev); triggerFxBurst('light'); }}
          aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          className="hud-chip text-[10px] px-2 py-1 border border-cyan-300/60 text-cyan-200 bg-black/50 backdrop-blur-md"
        >
          {menuOpen ? 'CLOSE' : 'MENU'}
        </button>
      </div>
      <div className="absolute top-2 left-2 z-[80] flex items-center gap-1">
        <div role="status" aria-live="polite" className={`text-[10px] px-2 py-1 border backdrop-blur-md ${
          aiStatus === 'online'
            ? 'border-emerald-300 text-emerald-300 bg-emerald-500/10'
            : aiStatus === 'offline'
              ? 'border-rose-300 text-rose-300 bg-rose-500/10'
              : 'border-amber-300 text-amber-200 bg-amber-500/10'
        }`}>
          AI {aiStatus === 'online' ? 'ONLINE' : aiStatus === 'offline' ? 'OFFLINE' : 'CHECK'}
        </div>
        <button
          onClick={checkAiConnection}
          aria-label="Testa connessione AI"
          className="text-[10px] px-2 py-1 border border-cyan-300/60 text-cyan-200 bg-black/40 backdrop-blur-md"
        >
          TEST AI
        </button>
        {aiInflightCount > 0 ? (
          <div className="text-[10px] px-2 py-1 border border-indigo-300/50 text-indigo-200 bg-indigo-500/10 backdrop-blur-md">
            AI BUSY {aiInflightCount}
          </div>
        ) : null}
      </div>
      {aiStatus === 'offline' && aiStatusDetail ? (
        <div className="absolute top-10 left-2 z-[80] max-w-[220px] text-[9px] px-2 py-1 border border-rose-300/30 text-rose-200 bg-black/45 backdrop-blur-md">
          {aiStatusDetail}
        </div>
      ) : null}
      {contextualReminder ? (
        <div className="absolute top-10 right-2 z-[80] max-w-[230px] border border-amber-300/40 bg-black/70 p-2 backdrop-blur-md">
          <p className="text-[9px] uppercase tracking-widest text-amber-200">{contextualReminder.title}</p>
          <p className="text-[10px] text-amber-100 mt-1">{contextualReminder.text}</p>
          <button
            onClick={() => {
              setDismissedReminderDate(todayKey);
              trackReminderAction(contextualReminder.id, 'dismissed');
            }}
            className="mt-2 text-[9px] px-2 py-1 border border-amber-300/40 text-amber-100 hover:bg-amber-300 hover:text-black"
          >
            Chiudi oggi
          </button>
          <button
            onClick={() => {
              setReminderSnoozeUntil(Date.now() + (1000 * 60 * 60 * 2));
              trackReminderAction(contextualReminder.id, 'snooze');
            }}
            className="mt-2 ml-1 text-[9px] px-2 py-1 border border-indigo-300/40 text-indigo-100 hover:bg-indigo-300 hover:text-black"
          >
            Snooze 2h
          </button>
          <button
            onClick={() => {
              trackReminderAction(contextualReminder.id, 'resolved');
              handleTabChange(contextualReminder.page || 'system');
            }}
            className="mt-2 ml-1 text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-100 hover:bg-cyan-300 hover:text-black"
          >
            Apri
          </button>
          {(contextualReminder.id === 'morning_checkin' || contextualReminder.id === 'evening_checkin') ? (
            <button
              onClick={() => {
                trackReminderAction(contextualReminder.id, 'resolved');
                handleTabChange('system');
              }}
              className="mt-2 ml-1 text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-100 hover:bg-cyan-300 hover:text-black"
            >
              Apri System
            </button>
          ) : null}
          {contextualReminder.id === 'weekly_weighin' ? (
            <button
              onClick={() => {
                markWeeklyWeighInDone();
                trackReminderAction(contextualReminder.id, 'resolved');
              }}
              className="mt-2 ml-1 text-[9px] px-2 py-1 border border-emerald-300/40 text-emerald-100 hover:bg-emerald-300 hover:text-black"
            >
              Fatto
            </button>
          ) : null}
        </div>
      ) : null}
      {menuOpen ? (
        <div className="absolute inset-0 z-[92] flex justify-end bg-black/45 backdrop-blur-[1px]" onClick={() => setMenuOpen(false)}>
          <div className="menu-drawer-premium w-[78%] h-full border-l border-cyan-300/35 bg-[#070b14]/95 p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Hamburger Menu</p>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Chiudi pannello menu"
                className="text-[10px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
              >
                X
              </button>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">Quick Actions</p>
            <div className="grid grid-cols-1 gap-2 mb-4">
              <button onClick={quickAddWater} className="text-[10px] px-2 py-2 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest">+400 ml acqua</button>
              <button onClick={quickMorningCheckin} className="text-[10px] px-2 py-2 border border-emerald-300/50 text-emerald-200 uppercase tracking-widest">Check-in mattino</button>
              <button onClick={quickEveningCheckin} className="text-[10px] px-2 py-2 border border-amber-300/50 text-amber-200 uppercase tracking-widest">Check-in sera</button>
            </div>

            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">Altre sezioni</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => { handleTabChange('coach'); setMenuOpen(false); }} className="text-[10px] px-2 py-3 border border-blue-300/40 text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>🧠</span> Coach AI
              </button>
              <button onClick={() => handleTabChange('recovery')} className="text-[10px] px-2 py-3 border border-emerald-300/40 text-emerald-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>🫀</span> Bio
              </button>
              <button onClick={() => handleTabChange('quests')} className="text-[10px] px-2 py-3 border border-amber-300/40 text-amber-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>📋</span> Quest
              </button>
              <button onClick={() => handleTabChange('boss')} className="text-[10px] px-2 py-3 border border-rose-300/40 text-rose-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>💀</span> Gate
              </button>
              <button onClick={() => handleTabChange('calendar')} className="text-[10px] px-2 py-3 border border-indigo-300/40 text-indigo-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>📅</span> Calendar
              </button>
              <button onClick={() => handleTabChange('systemplus')} className="text-[10px] px-2 py-3 border border-fuchsia-300/40 text-fuchsia-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>⚙️</span> System+
              </button>
              <button onClick={() => handleTabChange('help')} className="text-[10px] px-2 py-3 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>❓</span> Help
              </button>
              <button onClick={() => { handleTabChange('news'); setMenuOpen(false); }} className="text-[10px] px-2 py-3 border border-sky-300/40 text-sky-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>🔬</span> News
              </button>
              <button onClick={() => { handleTabChange('french'); setMenuOpen(false); }} className="text-[10px] px-2 py-3 border border-blue-300/40 text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>🇫🇷</span> Français
              </button>
              <button onClick={() => { handleTabChange('polish'); setMenuOpen(false); }} className="text-[10px] px-2 py-3 border border-red-300/40 text-red-200 uppercase tracking-widest flex items-center gap-1.5">
                <span>🇵🇱</span> Polski
              </button>
            </div>

            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">Audio & Voice</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => { setSoundEnabled((prev) => !prev); triggerFxBurst('light'); playSfx('click', true, soundTheme); }} className={`text-[10px] px-2 py-2 border uppercase tracking-widest ${soundEnabled ? 'border-emerald-300/50 text-emerald-200' : 'border-white/15 text-gray-400'}`}>SFX {soundEnabled ? 'ON' : 'OFF'}</button>
              <button onClick={() => { setVoiceEnabled((prev) => !prev); triggerFxBurst('light'); }} className={`text-[10px] px-2 py-2 border uppercase tracking-widest ${voiceEnabled ? 'border-cyan-300/50 text-cyan-200' : 'border-white/15 text-gray-400'}`}>VOICE {voiceEnabled ? 'ON' : 'OFF'}</button>
              <button onClick={() => { setVoicePack((prev) => (prev === 'dark' ? 'system' : 'dark')); triggerFxBurst('light'); }} className="text-[10px] px-2 py-2 border border-violet-300/50 text-violet-200 uppercase tracking-widest">{voicePack === 'dark' ? 'PACK DARK' : 'PACK SYS'}</button>
              <button onClick={() => { setSoundTheme((prev) => (prev === 'solo' ? 'cyber' : 'solo')); triggerFxBurst('light'); playSfx('nav', true, soundTheme === 'solo' ? 'cyber' : 'solo'); }} className="text-[10px] px-2 py-2 border border-orange-300/50 text-orange-200 uppercase tracking-widest">{soundTheme === 'solo' ? 'THEME SOLO' : 'THEME CYBER'}</button>
              <button onClick={() => { setCrownAnthemEnabled((prev) => !prev); triggerFxBurst('light'); playSfx('click', true, soundTheme); }} className={`col-span-2 text-[10px] px-2 py-2 border uppercase tracking-widest ${crownAnthemEnabled ? 'border-fuchsia-300/50 text-fuchsia-200' : 'border-white/15 text-gray-400'}`}>CROWN ANTHEM {crownAnthemEnabled ? 'ON' : 'OFF'}</button>
            </div>

            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">Gameplay</p>
            <div className="grid grid-cols-1 gap-2 mb-2">
              <button onClick={() => { setCoachMode((prev) => !prev); triggerFxBurst('light'); }} className={`text-[10px] px-2 py-2 border uppercase tracking-widest ${coachMode ? 'border-amber-300/50 text-amber-200' : 'border-white/15 text-gray-400'}`}>COACH {coachMode ? 'ON' : 'OFF'}</button>
              <button onClick={() => handleTabChange('systemplus')} className="text-[10px] px-2 py-2 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest">APRI SYSTEM+</button>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2 mt-3">Performance</p>
            <div className="grid grid-cols-1 gap-2 mb-2">
              <button
                onClick={() => {
                  setFxMode((prev) => (prev === 'auto' ? 'lite' : prev === 'lite' ? 'full' : 'auto'));
                  triggerFxBurst('light');
                }}
                className="text-[10px] px-2 py-2 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest"
              >
                FX MODE {fxMode.toUpperCase()}
              </button>
              <button
                onClick={() => {
                  setMobilePerformanceMode((prev) => !prev);
                  triggerFxBurst('light');
                }}
                className={`text-[10px] px-2 py-2 border uppercase tracking-widest ${mobilePerformanceMode ? 'border-emerald-300/50 text-emerald-200' : 'border-white/15 text-gray-400'}`}
              >
                MOBILE PERF {mobilePerformanceMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {!onboardingState.done ? (
        <div className="absolute inset-0 z-[95] flex items-end bg-black/70 p-3">
          <div className="w-full rounded-sm border border-cyan-300/40 bg-black/90 p-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-cyan-200">Onboarding</p>
            <h3 className="mt-1 text-base font-black uppercase text-white">{activeOnboardingStep.title}</h3>
            <p className="mt-2 text-xs text-gray-300">{activeOnboardingStep.text}</p>
            {activeOnboardingStep.id === 'setup' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[9px] uppercase text-gray-400">Obiettivo
                  <select
                    value={onboardingProfile.objective}
                    onChange={(e) => setOnboardingProfile((prev) => ({ ...prev, objective: e.target.value }))}
                    className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5"
                  >
                    <option value="cut">Cut</option>
                    <option value="recomp">Recomp</option>
                    <option value="bulk">Bulk</option>
                  </select>
                </label>
                <label className="text-[9px] uppercase text-gray-400">Train giorni
                  <input type="number" min="2" max="6" value={onboardingProfile.trainingDays} onChange={(e) => setOnboardingProfile((prev) => ({ ...prev, trainingDays: Number(e.target.value || 4) }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
                </label>
                <label className="text-[9px] uppercase text-gray-400">Sleep target
                  <input type="number" min="6" max="9" step="0.5" value={onboardingProfile.sleepTarget} onChange={(e) => setOnboardingProfile((prev) => ({ ...prev, sleepTarget: Number(e.target.value || 7.5) }))} className="mt-1 w-full bg-black/50 border border-white/10 text-white text-[10px] p-1.5" />
                </label>
                <label className="text-[9px] uppercase text-gray-400">Weekend split
                  <button onClick={() => setOnboardingProfile((prev) => ({ ...prev, weekendSplit: !prev.weekendSplit }))} className={`mt-1 w-full text-[10px] px-2 py-1.5 border uppercase tracking-widest ${onboardingProfile.weekendSplit ? 'border-cyan-300/50 text-cyan-200' : 'border-white/15 text-gray-400'}`}>{onboardingProfile.weekendSplit ? 'ON' : 'OFF'}</button>
                </label>
                <label className="text-[9px] uppercase text-gray-400 col-span-2">Mobile performance
                  <button onClick={() => setOnboardingProfile((prev) => ({ ...prev, mobilePerf: !prev.mobilePerf }))} className={`mt-1 w-full text-[10px] px-2 py-1.5 border uppercase tracking-widest ${onboardingProfile.mobilePerf ? 'border-emerald-300/50 text-emerald-200' : 'border-white/15 text-gray-400'}`}>{onboardingProfile.mobilePerf ? 'ON' : 'OFF'}</button>
                </label>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={onboardingNext} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
                {onboardingState.step >= onboardingSteps.length - 2 ? 'Completa' : 'Avanti'}
              </button>
              <button onClick={closeOnboarding} className="text-[10px] px-3 py-2 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">
                Salta
              </button>
              <button onClick={completeQuickSetup} className="text-[10px] px-3 py-2 border border-emerald-300/55 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">
                Setup rapido
              </button>
              {activeOnboardingStep.id === 'setup' ? (
                <button onClick={applySmartOnboardingSetup} className="text-[10px] px-3 py-2 border border-amber-300/55 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">
                  Setup intelligente
                </button>
              ) : null}
              {(activeOnboardingStep.id === 'system' || activeOnboardingStep.id === 'training' || activeOnboardingStep.id === 'recovery') ? (
                <button
                  onClick={() => onboardingJump(activeOnboardingStep.id === 'system' ? 'system' : activeOnboardingStep.id === 'training' ? 'training' : 'recovery')}
                  className="text-[10px] px-3 py-2 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black"
                >
                  Apri pagina
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[9px] text-gray-500 uppercase">Step {Math.min(onboardingState.step + 1, onboardingSteps.length)} / {onboardingSteps.length}</p>
          </div>
        </div>
      ) : null}
      
      {/* Pagine (Passiamo tutte le memorie come prop) */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
        <Suspense fallback={<div className="p-6 text-xs text-cyan-200 uppercase tracking-widest">Loading System Module...</div>}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              initial={shouldReduceFx ? false : { opacity: 0, x: pagesOrder.indexOf(activePage) >= lastPageIndex ? 30 : -30, y: 8, scale: 0.982, filter: 'blur(5px)' }}
              animate={shouldReduceFx ? { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' } : { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={shouldReduceFx ? { opacity: 0, x: 0, y: 0, scale: 1, filter: 'none' } : { opacity: 0, x: pagesOrder.indexOf(activePage) >= lastPageIndex ? -30 : 30, y: -8, scale: 0.982, filter: 'blur(5px)' }}
              transition={shouldReduceFx ? { duration: 0.14, ease: 'linear' } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`min-h-full page-shell page-shell-${activePage}`}
            >
            {activePage === 'system' && (
              <SystemHub
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                dailyGoal={dailyGoal}
                setDailyGoal={setDailyGoal}
                playerStats={playerStats}
                setPlayerStats={setPlayerStats}
                hydrationGoal={hydrationGoal}
                setHydrationGoal={setHydrationGoal}
                macroGoals={macroGoals}
                setMacroGoals={setMacroGoals}
                createEmptyLog={createEmptyLog}
                soundEnabled={soundEnabled}
                soundTheme={soundTheme}
                voiceEnabled={voiceEnabled}
                voicePack={voicePack}
                crownAnthemEnabled={crownAnthemEnabled}
                coachMode={coachMode}
                systemCompactMode={true}
                onOpenNews={() => handleTabChange('news')}
              />
            )}
            {activePage === 'systemplus' && (
              <SystemHub
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                dailyGoal={dailyGoal}
                setDailyGoal={setDailyGoal}
                playerStats={playerStats}
                setPlayerStats={setPlayerStats}
                hydrationGoal={hydrationGoal}
                setHydrationGoal={setHydrationGoal}
                macroGoals={macroGoals}
                setMacroGoals={setMacroGoals}
                createEmptyLog={createEmptyLog}
                soundEnabled={soundEnabled}
                soundTheme={soundTheme}
                voiceEnabled={voiceEnabled}
                voicePack={voicePack}
                crownAnthemEnabled={crownAnthemEnabled}
                coachMode={false}
                systemCompactMode={false}
                onOpenNews={() => handleTabChange('news')}
              />
            )}
            {activePage === 'training' && (
              <Training
                playerStats={playerStats}
                setPlayerStats={setPlayerStats}
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                hydrationGoal={hydrationGoal}
                createEmptyLog={createEmptyLog}
                soundEnabled={soundEnabled}
                soundTheme={soundTheme}
                voiceEnabled={voiceEnabled}
                voicePack={voicePack}
                crownAnthemEnabled={crownAnthemEnabled}
              />
            )}
            {activePage === 'recovery' && (
              <Recovery
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                playerStats={playerStats}
                setPlayerStats={setPlayerStats}
                dailyGoal={dailyGoal}
                setDailyGoal={setDailyGoal}
                hydrationGoal={hydrationGoal}
                setHydrationGoal={setHydrationGoal}
                createEmptyLog={createEmptyLog}
                soundEnabled={soundEnabled}
                soundTheme={soundTheme}
                voiceEnabled={voiceEnabled}
                voicePack={voicePack}
              />
            )}
            {activePage === 'quests' && <Quests playerStats={playerStats} setPlayerStats={setPlayerStats} soundEnabled={soundEnabled} soundTheme={soundTheme} />}
            {activePage === 'boss' && <Boss playerStats={playerStats} setPlayerStats={setPlayerStats} soundEnabled={soundEnabled} soundTheme={soundTheme} voiceEnabled={voiceEnabled} voicePack={voicePack} />}
            {activePage === 'calendar' && (
              <Calendar
                systemLogs={systemLogs}
                setSystemLogs={setSystemLogs}
                dailyGoal={dailyGoal}
                hydrationGoal={hydrationGoal}
                playerStats={playerStats}
              />
            )}
            {activePage === 'stats' && <Stats systemLogs={systemLogs} dailyGoal={dailyGoal} hydrationGoal={hydrationGoal} macroGoals={macroGoals} playerStats={playerStats} />}
            {activePage === 'help' && <Help createBackupPayload={createBackupPayload} importBackupPayload={importBackupPayload} resetAppData={resetAppData} playerStats={playerStats} onNavigate={handleTabChange} />}
            {activePage === 'french' && <French playerStats={playerStats} setPlayerStats={setPlayerStats} soundEnabled={soundEnabled} soundTheme={soundTheme} />}
            {activePage === 'polish' && <Polish playerStats={playerStats} setPlayerStats={setPlayerStats} soundEnabled={soundEnabled} soundTheme={soundTheme} />}
            {activePage === 'coach' && <Coach />}
            {activePage === 'news' && (
              <News
                playerStats={playerStats}
                onAskCoach={(question) => {
                  try { localStorage.setItem('shadow_monarch_pending_coach_question', question); } catch {}
                  handleTabChange('coach');
                }}
                onToast={(message) => emitUiToast({ message, tone: 'success', durationMs: 2600 })}
              />
            )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </div>
      {!shouldReduceFx ? (
        <>
          <div key={`fx-${fxPulseKey}`} className="pointer-events-none absolute inset-0 z-[65] warp-flash" />
          <div key={`burst-${fxBurstKey}`} className="pointer-events-none absolute inset-0 z-[66] fx-particles">
            {Array.from({ length: 14 }).map((_, idx) => (
              <span
                key={`${fxBurstKey}-${idx}`}
                className="fx-spark"
                style={{
                  left: `${8 + ((idx * 7) % 84)}%`,
                  top: `${18 + ((idx * 13) % 62)}%`,
                  animationDelay: `${(idx % 7) * 24}ms`
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      <div className="pointer-events-none absolute top-11 left-1/2 z-[82] -translate-x-1/2 rounded-full border border-fuchsia-300/40 bg-black/55 px-3 py-1 backdrop-blur-md">
        <p className="text-[9px] uppercase tracking-[0.22em] text-fuchsia-200">Combo {comboProgress.count}/3</p>
      </div>
      <div key={`surge-${surgeKey}`} className={`pointer-events-none absolute inset-0 z-[84] shadow-surge ${!shouldReduceFx && surgeKey > 0 ? 'shadow-surge-active' : ''}`}>
        <div className="shadow-surge-center">
          <p className="text-[11px] uppercase tracking-[0.34em] text-fuchsia-200">Shadow Surge</p>
          <p className="text-[10px] uppercase tracking-widest text-cyan-200 mt-1">3 azioni utili consecutive</p>
        </div>
      </div>
      <AnimatePresence>
        {pageIntroFx && !shouldReduceFx ? (
          <motion.div
            key={`intro-${pageIntroFx.id}`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 0.92, 0], scale: [0.92, 1, 1.08] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute inset-0 z-[83] page-intro-fx ${pageIntroFx.page === 'training' ? 'page-intro-fx-training' : 'page-intro-fx-system'}`}
          >
            <div className="page-intro-fx-center">
              <p className="text-[10px] uppercase tracking-[0.34em] text-white/90">
                {pageIntroFx.page === 'training' ? 'Training Mode' : 'System Mode'}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {toastState ? (
          <motion.div
            key={toastState.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-2 right-2 bottom-24 z-[96] border border-cyan-300/35 bg-black/85 p-3 backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <motion.div
              className={`absolute left-0 top-0 h-[2px] ${
                toastState.tone === 'success' ? 'bg-emerald-300/80' : toastState.tone === 'warning' ? 'bg-amber-300/80' : 'bg-cyan-300/80'
              }`}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: Math.max(1.2, toastDurationMs / 1000), ease: 'linear' }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[10px] uppercase tracking-widest ${
                toastState.tone === 'success' ? 'text-emerald-200' : toastState.tone === 'warning' ? 'text-amber-200' : 'text-cyan-200'
              }`}>
                {toastState.message}
              </p>
              <div className="flex items-center gap-2">
                {toastState.actionLabel && toastState.onAction ? (
                  <button
                    onClick={() => {
                      try { toastState.onAction(); } catch (_) {}
                      setToastState(null);
                    }}
                    className="text-[9px] px-2 py-1 border border-emerald-300/50 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
                  >
                    {toastState.actionLabel}
                  </button>
                ) : null}
                <button
                  onClick={() => setToastState(null)}
                  className="text-[9px] px-2 py-1 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {commandPaletteOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-black/70 backdrop-blur-[2px] p-3"
            onClick={() => setCommandPaletteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.2 }}
              className="command-palette-shell mx-auto mt-14 w-full max-w-[390px] border border-cyan-300/35 bg-black/90 p-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[9px] uppercase tracking-[0.25em] text-cyan-200">System Terminal</p>
                <div className="flex items-center gap-2">
                  <span className="command-kbd">ESC</span>
                  <button
                    onClick={() => setCommandPaletteOpen(false)}
                    className="text-[9px] px-2 py-1 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
              <div className="command-input-wrap mb-2 flex items-center gap-2 border border-white/10 bg-black/60 p-2">
                <span className="text-[11px] text-cyan-300/80">{'>'}</span>
                <input
                  autoFocus
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  placeholder="Cerca comando..."
                  className="command-input w-full bg-transparent text-white text-xs outline-none"
                />
                <span className="command-kbd">CMD/CTRL + K</span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {commandItems.length ? commandItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.run?.();
                      setCommandPaletteOpen(false);
                      setCommandQuery('');
                    }}
                    className="command-item w-full text-left text-[10px] px-2 py-2 border border-white/10 text-gray-200 hover:border-cyan-300/50 hover:bg-cyan-500/10 hover:text-cyan-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-gray-100">{item.label}</p>
                        <p className="text-[8px] uppercase tracking-widest text-gray-500">{item.section || 'Action'}</p>
                      </div>
                      <span className="text-[11px] text-cyan-200/65">↵</span>
                    </div>
                  </button>
                )) : (
                  <p className="text-[10px] text-gray-500">Nessun comando trovato.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {tapPulseTick > 0 ? (
          <motion.div
            key={`tap-${tapPulseTick}`}
            initial={{ opacity: 0.38, scale: 0.92 }}
            animate={{ opacity: 0, scale: 1.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed left-1/2 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-[98] h-10 w-10 -translate-x-1/2 rounded-full border border-fuchsia-300/65 bg-fuchsia-400/20 blur-[0.2px]"
          />
        ) : null}
      </AnimatePresence>
      <button
        aria-label="Apri Quick Add"
        onClick={() => setQuickAddOpen((v) => !v)}
        className="quick-add-fab fixed right-14 z-[97] flex h-9 w-9 items-center justify-center border border-fuchsia-300/55 bg-black/88 text-lg font-black text-fuchsia-200 backdrop-blur-md hover:bg-fuchsia-300 hover:text-black shadow-[0_0_18px_rgba(217,70,239,0.28)]"
        style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        +
      </button>
      <AnimatePresence>
        {quickAddOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.2 }}
            className="quick-add-panel fixed left-2 right-2 z-[98] border border-fuchsia-300/40 bg-black/90 p-3 backdrop-blur-md"
            style={{ top: 'calc(3rem + env(safe-area-inset-top))' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-widest text-fuchsia-200">Quick Add Globale</p>
              <button onClick={() => setQuickAddOpen(false)} className="text-[9px] px-2 py-1 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">Chiudi</button>
            </div>
            <div className="mb-2 flex gap-2">
              <button onClick={() => setQuickMealSlot('breakfast')} className={`flex-1 text-[9px] px-2 py-1 border uppercase tracking-widest ${quickMealSlot === 'breakfast' ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : 'border-white/20 text-gray-400'}`}>Colazione</button>
              <button onClick={() => setQuickMealSlot('lunch')} className={`flex-1 text-[9px] px-2 py-1 border uppercase tracking-widest ${quickMealSlot === 'lunch' ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : 'border-white/20 text-gray-400'}`}>Pranzo</button>
              <button onClick={() => setQuickMealSlot('dinner')} className={`flex-1 text-[9px] px-2 py-1 border uppercase tracking-widest ${quickMealSlot === 'dinner' ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : 'border-white/20 text-gray-400'}`}>Cena</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => applyQuickAdd('water')} className="text-[9px] px-2 py-2 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">+350ml</button>
              <button onClick={() => applyQuickAdd('meal')} className="text-[9px] px-2 py-2 border border-amber-300/50 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">+Pasto</button>
              <button onClick={() => applyQuickAdd('protein')} className="text-[9px] px-2 py-2 border border-emerald-300/50 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">+Protein</button>
              <button onClick={() => applyQuickAdd('workout')} className="text-[9px] px-2 py-2 border border-fuchsia-300/50 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">+Workout</button>
              <button onClick={() => applyQuickAdd('skincare_am')} className="text-[9px] px-2 py-2 border border-emerald-300/40 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Skin AM</button>
              <button onClick={() => applyQuickAdd('skincare_pm')} className="text-[9px] px-2 py-2 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Skin PM</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* BARRA NAVIGAZIONE — 4 tab principali */}
      <nav
        style={{ height: 'calc(5rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
        className="game-nav premium-nav w-full max-w-[390px] h-20 bg-black/95 backdrop-blur-xl border-t border-white/[0.06] flex justify-around items-center z-50 shrink-0 relative">
        {[
          { id: 'system',   label: 'System', Icon: Zap,          hex: '#38bdf8', glow: 'rgba(56,189,248,0.6)'   },
          { id: 'training', label: 'Train',  Icon: Swords,       hex: '#f87171', glow: 'rgba(248,113,113,0.6)'  },
          { id: 'coach',    label: 'Coach',  Icon: BrainCircuit, hex: '#818cf8', glow: 'rgba(129,140,248,0.6)'  },
          { id: 'stats',    label: 'Stats',  Icon: Activity,     hex: '#a78bfa', glow: 'rgba(167,139,250,0.6)'  },
        ].map(({ id, label, Icon, hex, glow }) => {
          const active = activePage === id;
          return (
            <motion.button key={id} aria-label={`Apri pagina ${label}`} onClick={() => handleTabChange(id)}
              className="relative flex flex-col items-center gap-1.5 px-5 py-2"
              whileTap={{ scale: 0.76 }}
              transition={{ type: 'spring', stiffness: 700, damping: 30 }}>

              {/* sliding background pill — layoutId shared across all tabs */}
              {active && (
                <motion.div layoutId="navPill" className="absolute inset-x-1 inset-y-0 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse 80% 60% at 50% 20%, ${hex}1a, transparent 80%)` }}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }} />
              )}

              {/* sliding top indicator line */}
              {active && (
                <motion.span layoutId="navLine"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                  style={{ width: 32, background: `linear-gradient(90deg, transparent, ${hex}, transparent)`,
                           boxShadow: `0 0 8px 1px ${hex}99` }}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }} />
              )}

              {/* burst ring on activation */}
              <AnimatePresence>
                {active && (
                  <motion.span key={`burst-${id}`}
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ border: `1px solid ${hex}` }}
                    initial={{ opacity: 0.7, scale: 0.7 }}
                    animate={{ opacity: 0, scale: 1.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }} />
                )}
              </AnimatePresence>

              {/* icon */}
              <motion.div
                animate={{ scale: active ? 1.22 : 1, y: active ? -2 : 0 }}
                transition={{ type: 'spring', stiffness: 550, damping: 22 }}
                style={{
                  color: active ? hex : 'rgba(255,255,255,0.2)',
                  filter: active ? `drop-shadow(0 0 9px ${glow})` : 'none',
                }}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.4} />
              </motion.div>

              {/* label */}
              <motion.span
                className="text-[9px] font-bold tracking-widest uppercase system-font relative z-10"
                animate={{ color: active ? hex : 'rgba(255,255,255,0.2)' }}
                transition={{ duration: 0.18 }}
                style={{ letterSpacing: '0.12em' }}>
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;

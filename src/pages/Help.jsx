import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { clearCloudSession, cloudLogin, cloudPull, cloudPush, cloudRegister, getCloudSession } from '../utils/cloudSync';
import { clearTelemetry, getTelemetryEntries } from '../utils/telemetry';
import { formatAiErrorDetail, requestSystemAI } from '../utils/aiClient';

const SCREEN_GUIDE = [
  { id: 'system', title: 'System', desc: 'Log giornaliero, AI meal analyzer, precision calorie engine, obiettivi kcal/acqua/macro.' },
  { id: 'train', title: 'Train', desc: 'Workout generato da AI con timer, log set/reps/peso e reward EXP/Gold a fine sessione.' },
  { id: 'bio', title: 'Bio / Recovery', desc: 'Sonno, energia, score recupero e dati bilancia smart (peso, grasso, massa, BMR).' },
  { id: 'quest', title: 'Quest', desc: 'Daily/season mission board con reward. Aumenta streak, chiavi e progressione account.' },
  { id: 'gate', title: 'Gate', desc: 'Dungeon 3D, boss IA autonomo, elite encounter, season 6 mesi, mastery e prestige.' },
  { id: 'stats', title: 'Stats', desc: 'Grafici storici su kcal, idratazione, sonno e composizione corporea.' }
];

const DAILY_FLOW = [
  'System: logga acqua + primo pasto (o usa AI meal).',
  'Train: avvia workout e salva i set nel log.',
  'Bio: salva sonno/energia o sincronizza i dati.',
  'Quest: riscatta daily reward prima del Gate.',
  'Gate: fai run dungeon per mastery/loot/chiavi.'
];

const WEEKLY_FLOW = [
  'Chiudi almeno 4 workout settimanali per alimentare streak e progressione combat.',
  'Mantieni sonno medio > 7h e aderenza lifestyle alta: migliora il power rating nel Gate.',
  'Fai 2-3 clear di piani stabili prima di pushare un nuovo boss floor.',
  'A fine settimana: esporta backup JSON e controlla grafici trend in Stats.'
];

const GATE_LEVELS = [
  { floor: 1, boss: 'Goblin Scout Alpha', biome: 'Stone Entrance', note: 'Ingresso tutorial, ritmo base del combat.' },
  { floor: 2, boss: 'Orc Sword Reaver', biome: 'Rust Forge', note: 'Primo check su danno e gestione energia.' },
  { floor: 3, boss: 'Armored Skeleton Warden', biome: 'Crypt Hall', note: 'Più pressione difensiva e counter.' },
  { floor: 4, boss: 'Venom Spider Matriarch', biome: 'Poison Web Nest', note: 'Burst rapidi, timing skill importante.' },
  { floor: 5, boss: 'Shadow Wolf Fenrir', biome: 'Moonlit Ravine', note: 'Transizione mid-game, DPS check.' },
  { floor: 6, boss: 'Rock Golem Colossus', biome: 'Titan Quarry', note: 'Fight lunga, servono costanza e sustain.' },
  { floor: 7, boss: 'Prime Wyrm Skybreaker', biome: 'Dragon Citadel', note: 'Ingresso high-tier, spike di difficoltà.' },
  { floor: 8, boss: 'Demon Knight Executor', biome: 'Abyss Throne', note: 'Pattern aggressivi e punizione errori.' },
  { floor: 9, boss: 'Demonic Horror Leviathan', biome: 'Void Cathedral', note: 'Fight intensa, controllo risorse vitale.' },
  { floor: 10, boss: 'Astral Dragon Monarch', biome: 'Cosmic Rift', note: 'Endgame, richiesta massima consistenza.' }
];

const SKILL_TREE_GUIDE = [
  { name: 'Iron Core', unlock: 'Level ≥ 12', effect: '+8% riduzione danno, +18 HP' },
  { name: 'Battle Instinct', unlock: 'Workout completati ≥ 30', effect: '+10% danno base' },
  { name: 'Flow State', unlock: 'Streak ≥ 7', effect: '+4 energia on-hit, -2 costo skill' },
  { name: 'Monarch Resolve', unlock: 'Aderenza lifestyle ≥ 72% e clear Gate ≥ 3', effect: '+8% crit, +6% evasione' }
];

const EVOLUTION_GUIDE = [
  'Il tuo livello System influenza direttamente la forma Hunter nel Gate (più livello = tier più alto).',
  'Lifestyle (acqua, sonno, cibo, costanza) aumenta il power effettivo del combattimento.',
  'Quest e workout non sono “solo statistiche”: spingono danno, tenuta e unlock dei nodi skill tree.',
  'Quando sali di potenza reale, i piani alti passano da impossibili a progressivamente gestibili.'
];

const DATA_COVERAGE = [
  'Progressione account: livello, stat, streak, gold, keys, titles.',
  'Storico workout: log esercizi, serie, trend forza e completamenti.',
  'Raid/Gate: season meta, floor raggiunti, clear, relic inventory.',
  'Log giornalieri: acqua, calorie, macro, composizione corporea, recovery.'
];

const WEEKDAY_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const getWeakStat = (stats = {}) => {
  const pool = [
    { key: 'str', label: 'Forza', value: Number(stats?.str || 0) },
    { key: 'vit', label: 'Resistenza', value: Number(stats?.vit || 0) },
    { key: 'agi', label: 'Agilità', value: Number(stats?.agi || 0) }
  ];
  return pool.sort((a, b) => a.value - b.value)[0];
};

const getMainFocusFromWeakStat = (weak) => {
  if (!weak) return 'Bilanciamento generale';
  if (weak.key === 'str') return 'Push/Pull forza';
  if (weak.key === 'vit') return 'Gambe + conditioning';
  if (weak.key === 'agi') return 'Mobilità + core + velocità';
  return 'Bilanciamento generale';
};

const buildWeekPlan = (stats = {}) => {
  const level = Number(stats?.level || 1);
  const streak = Number(stats?.streak || 0);
  const completedWorkouts = Number(stats?.completedWorkouts || 0);
  const weakStat = getWeakStat(stats);
  const focus = getMainFocusFromWeakStat(weakStat);
  const start = new Date();
  const floorTarget = Math.max(2, Math.min(10, Math.floor((level - 1) / 5) + 2));
  const weeklyWorkoutTarget = Math.max(4, Math.min(6, 4 + Math.floor(level / 20)));
  const streakTarget = Math.max(streak + 4, 7);

  const themes = [
    { title: 'Setup & Scan', mission: `Apri System e fissa il focus: ${focus}. Logga acqua + primo pasto.`, gate: `1 run controllo su Floor ${Math.max(1, floorTarget - 1)}.` },
    { title: 'Power Session', mission: 'Allenamento principale con log completo di set/reps/peso.', gate: '1 run Assault, punta al clear pulito senza consumare troppe pozioni.' },
    { title: 'Recovery Precision', mission: 'Sonno + Bio update + camminata leggera o mobilità 20-30 min.', gate: 'Solo run breve o skip raid se recovery bassa.' },
    { title: 'Progressive Overload', mission: 'Aumenta carico o volume in almeno 2 esercizi chiave.', gate: `Push sul Floor ${floorTarget} se la run precedente era stabile.` },
    { title: 'Quest Day', mission: 'Completa daily/season quest e aggiorna tracking nutrizione.', gate: 'Run tattica: gestione energia e cooldown skill.' },
    { title: 'Peak Challenge', mission: 'Sessione intensa controllata + idratazione alta durante il giorno.', gate: `Tentativo serio di clear alto: target Floor ${Math.min(10, floorTarget + 1)}.` },
    { title: 'Review & Backup', mission: 'Controlla Stats trend settimanale e prepara prossima micro-cycle.', gate: 'Export backup JSON prima di ogni update/deploy.' }
  ];

  return {
    weakStat,
    focus,
    floorTarget,
    weeklyWorkoutTarget,
    streakTarget,
    week: themes.map((item, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return {
        ...item,
        dayLabel: WEEKDAY_IT[date.getDay()],
        dateLabel: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        checklist: `Workout target week: ${weeklyWorkoutTarget} · Streak target: ${streakTarget}`
      };
    }),
    completedWorkouts
  };
};

const HELP_DEMOS = [
  {
    id: 'demo-system',
    title: 'Demo • System',
    subtitle: 'Meal AI + acqua + calorie engine',
    screen: 'system',
    image: '/vfx/magic-circle.png',
    tint: 'from-cyan-500/20 via-blue-500/10 to-transparent'
  },
  {
    id: 'demo-train',
    title: 'Demo • Train',
    subtitle: 'Workout con timer, set log e fine run',
    screen: 'training',
    image: '/vfx/magic-slash.png',
    tint: 'from-red-500/20 via-orange-500/10 to-transparent'
  },
  {
    id: 'demo-bio',
    title: 'Demo • Bio',
    subtitle: 'Recovery, sonno e composizione',
    screen: 'recovery',
    image: '/body/body-front.png',
    tint: 'from-emerald-500/20 via-teal-500/10 to-transparent'
  },
  {
    id: 'demo-gate',
    title: 'Demo • Gate',
    subtitle: 'Boss run, skill tree e progressione piani',
    screen: 'boss',
    image: '/vfx/magic-burst.png',
    tint: 'from-fuchsia-500/25 via-indigo-500/10 to-transparent'
  },
  {
    id: 'demo-backup',
    title: 'Demo • Backup',
    subtitle: 'Export prima update, import nel nuovo deploy',
    screen: 'help',
    image: '/manifest.json',
    tint: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    fallbackLabel: 'JSON'
  }
];

const TROUBLESHOOT = [
  { q: 'Le icone loot non si vedono', a: 'Metti i file in public/loot. L’app prova più nomi/estensioni; se manca il file mostra fallback.' },
  { q: 'Su iPhone alcuni pulsanti sembrano tagliati', a: 'Usa modalità Full nel Gate e verifica zoom browser al 100%.' },
  { q: 'Dopo update Netlify perdo i dati', a: 'Prima fai Export Dati in Help. Poi nel nuovo deploy fai Import Dati.' },
  { q: 'L’IA meal/workout non risponde', a: 'Controlla connessione e riprova con prompt breve e chiaro.' },
  { q: 'Il boss sembra fuori posizione nel dungeon', a: 'Ricarica la run dal Gate: lo spawn viene ricalcolato all’entry del piano.' },
  { q: 'Vedo calo FPS su mobile', a: 'Chiudi altre tab, disattiva effetti audio/SFX e riduci luminosità dinamica del device.' }
];

const Help = ({ createBackupPayload, importBackupPayload, resetAppData, playerStats, onNavigate }) => {
  const [status, setStatus] = useState('');
  const [backupPreview, setBackupPreview] = useState(null);
  const [pendingImportPayload, setPendingImportPayload] = useState(null);
  const [cloudSession, setCloudSession] = useState(() => getCloudSession());
  const [cloudAuth, setCloudAuth] = useState({ email: getCloudSession().email || '', password: '' });
  const [cloudStatus, setCloudStatus] = useState('');
  const [telemetryEntries, setTelemetryEntries] = useState(() => getTelemetryEntries());
  const [holdResetAll, setHoldResetAll] = useState(false);
  const [autoBackups, setAutoBackups] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_auto_backups');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [dailyRestorePoints, setDailyRestorePoints] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_daily_restore_points');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });
  const [deployHealth, setDeployHealth] = useState({
    checking: false,
    checkedAt: '',
    endpointOk: null,
    aiPingOk: null,
    hasApiKey: null,
    forcedModel: '',
    defaultModel: '',
    fallbackEnabled: null,
    modelUsed: '',
    detail: ''
  });
  const [cloudConflict, setCloudConflict] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(() => {
    try {
      const raw = localStorage.getItem('shadow_monarch_feature_flags');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        globalTimeline: parsed?.globalTimeline !== false,
        smartGoalWizard: parsed?.smartGoalWizard !== false,
        bossReady: parsed?.bossReady !== false,
        travelMode: parsed?.travelMode !== false
      };
    } catch (_) {
      return {
        globalTimeline: true,
        smartGoalWizard: true,
        bossReady: true,
        travelMode: true
      };
    }
  });
  const [globalTimeline, setGlobalTimeline] = useState([]);
  const fileRef = useRef(null);
  const resetAllTimerRef = useRef(null);
  const weekPlan = buildWeekPlan(playerStats);
  const refreshBackupPanels = () => {
    try {
      const autoRaw = localStorage.getItem('shadow_monarch_auto_backups');
      const autoParsed = autoRaw ? JSON.parse(autoRaw) : [];
      setAutoBackups(Array.isArray(autoParsed) ? autoParsed : []);
    } catch (_) {
      setAutoBackups([]);
    }
    try {
      const dailyRaw = localStorage.getItem('shadow_monarch_daily_restore_points');
      const dailyParsed = dailyRaw ? JSON.parse(dailyRaw) : [];
      setDailyRestorePoints(Array.isArray(dailyParsed) ? dailyParsed : []);
    } catch (_) {
      setDailyRestorePoints([]);
    }
  };
  const refreshGlobalTimeline = () => {
    try {
      const events = [];
      const logsRaw = localStorage.getItem('shadow_monarch_logs');
      const logs = logsRaw ? JSON.parse(logsRaw) : [];
      if (Array.isArray(logs)) {
        logs.forEach((log) => {
          const date = String(log?.date || '');
          const iso = date ? `${new Date().getFullYear()}-${date.split('/').reverse().join('-')}` : '';
          const ts = iso ? new Date(iso).getTime() : 0;
          if (Number(log?.consumed || 0) > 0) events.push({ id: `meal-${date}`, type: 'meal', ts, date, detail: `${Math.round(Number(log.consumed || 0))} kcal` });
          if (Number(log?.waterMl || 0) > 0) events.push({ id: `water-${date}`, type: 'water', ts, date, detail: `${Math.round(Number(log.waterMl || 0))} ml` });
          if (Number(log?.workoutBurn ?? log?.burned ?? 0) > 0) events.push({ id: `workout-${date}`, type: 'workout', ts, date, detail: `burn ${Math.round(Number(log.workoutBurn ?? log.burned ?? 0))}` });
        });
      }
      const workoutRaw = localStorage.getItem('shadow_monarch_workout_history');
      const workouts = workoutRaw ? JSON.parse(workoutRaw) : [];
      if (Array.isArray(workouts)) {
        workouts.slice(0, 16).forEach((w) => {
          const ts = new Date(w?.date || Date.now()).getTime();
          events.push({
            id: `wh-${w?.id || ts}`,
            type: 'workout_log',
            ts,
            date: new Date(ts).toLocaleDateString('it-IT'),
            detail: `${w?.title || 'Workout'} • STR ${Math.round(Number(w?.strengthIndex || 0))}`
          });
        });
      }
      const telemetry = getTelemetryEntries();
      if (Array.isArray(telemetry)) {
        telemetry.slice(0, 20).forEach((item) => {
          const ts = new Date(item?.createdAt || Date.now()).getTime();
          events.push({
            id: `te-${item?.id || ts}`,
            type: String(item?.status || 'info') === 'error' ? 'error' : 'ai',
            ts,
            date: new Date(ts).toLocaleDateString('it-IT'),
            detail: String(item?.detail || item?.type || 'telemetry').slice(0, 120)
          });
        });
      }
      setGlobalTimeline(events.sort((a, b) => b.ts - a.ts).slice(0, 40));
    } catch (_) {
      setGlobalTimeline([]);
    }
  };
  useEffect(() => {
    const onFocus = () => {
      refreshBackupPanels();
      refreshGlobalTimeline();
      try {
        const raw = localStorage.getItem('shadow_monarch_feature_flags');
        const parsed = raw ? JSON.parse(raw) : {};
        setFeatureFlags({
          globalTimeline: parsed?.globalTimeline !== false,
          smartGoalWizard: parsed?.smartGoalWizard !== false,
          bossReady: parsed?.bossReady !== false,
          travelMode: parsed?.travelMode !== false
        });
      } catch (_) {}
    };
    refreshGlobalTimeline();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      if (resetAllTimerRef.current) clearTimeout(resetAllTimerRef.current);
    };
  }, []);

  const exportBackup = () => {
    try {
      const payload = createBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `shadow-monarch-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('Backup esportato con successo.');
    } catch {
      setStatus('Errore durante export backup.');
    }
  };

  const buildBackupInspector = (payload) => {
    const safeParse = (raw, fallback) => {
      try {
        return JSON.parse(raw ?? '');
      } catch {
        return fallback;
      }
    };
    const data = payload?.data || {};
    const logs = safeParse(data.shadow_monarch_logs, []);
    const workouts = safeParse(data.shadow_monarch_workout_history, []);
    const stats = safeParse(data.shadow_monarch_stats, {});
    const raidMeta = safeParse(data.shadow_monarch_raid_meta, {});
    const raidSeason = safeParse(data.shadow_monarch_raid_season, {});
    const relics = safeParse(data.shadow_monarch_relic_inventory, {});
    const titles = Array.isArray(stats.titlesUnlocked) ? stats.titlesUnlocked : [];
    return {
      exportedAt: payload?.exportedAt || 'n/a',
      keysCount: payload?.keysCount || Object.keys(data).length,
      logsCount: Array.isArray(logs) ? logs.length : 0,
      workoutsCount: Array.isArray(workouts) ? workouts.length : 0,
      streak: stats?.streak || 0,
      level: stats?.level || 1,
      gold: stats?.gold || 0,
      keys: stats?.keys || 0,
      completedWorkouts: stats?.completedWorkouts || 0,
      systemPowerScore: stats?.systemPowerScore || 0,
      raidClears: raidMeta?.clears || 0,
      raidHighestFloor: raidMeta?.highestFloor || 1,
      prestigeLevel: raidSeason?.prestigeLevel || 0,
      relicSlots: Object.keys(relics || {}).length,
      titlesCount: titles.length
    };
  };

  const importBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const preview = buildBackupInspector(payload);
        setBackupPreview(preview);
        setPendingImportPayload(payload);
        setStatus('Backup caricato. Controlla anteprima e conferma import.');
      } catch {
        setStatus('File backup non valido.');
        setBackupPreview(null);
        setPendingImportPayload(null);
      }
    };
    reader.onerror = () => setStatus('Impossibile leggere il file.');
    reader.readAsText(file);
    event.target.value = '';
  };

  const confirmImport = () => {
    if (!pendingImportPayload) return;
    try {
      importBackupPayload(pendingImportPayload);
    } catch {
      setStatus('Errore durante import backup.');
    }
  };

  const doResetAppData = () => {
    resetAppData?.();
  };
  const beginHoldResetAll = () => {
    if (resetAllTimerRef.current) return;
    setHoldResetAll(true);
    resetAllTimerRef.current = window.setTimeout(() => {
      doResetAppData();
      setHoldResetAll(false);
      resetAllTimerRef.current = null;
    }, 1500);
  };
  const cancelHoldResetAll = () => {
    if (resetAllTimerRef.current) {
      clearTimeout(resetAllTimerRef.current);
      resetAllTimerRef.current = null;
    }
    setHoldResetAll(false);
  };
  const refreshTelemetry = () => setTelemetryEntries(getTelemetryEntries());
  const handleCloudRegister = async () => {
    try {
      await cloudRegister({ email: cloudAuth.email, password: cloudAuth.password });
      setCloudSession(getCloudSession());
      setCloudStatus('Registrazione completata. Sessione cloud attiva.');
    } catch (error) {
      setCloudStatus(`Errore register: ${error?.message || 'sconosciuto'}`);
    }
  };
  const handleCloudLogin = async () => {
    try {
      await cloudLogin({ email: cloudAuth.email, password: cloudAuth.password });
      setCloudSession(getCloudSession());
      setCloudStatus('Login cloud completato.');
    } catch (error) {
      setCloudStatus(`Errore login: ${error?.message || 'sconosciuto'}`);
    }
  };
  const handleCloudPush = async () => {
    if (!cloudSession.isAuthenticated) {
      setCloudStatus('Nessuna sessione Supabase: fai login prima.');
      return;
    }
    try {
      await cloudPush({ backupPayload: createBackupPayload() });
      setCloudStatus('Sync push completata con successo.');
    } catch (error) {
      setCloudStatus(`Errore push: ${error?.message || 'sconosciuto'}`);
    }
  };
  const handleCloudPull = async () => {
    if (!cloudSession.isAuthenticated) {
      setCloudStatus('Nessuna sessione Supabase: fai login prima.');
      return;
    }
    try {
      const payload = await cloudPull();
      if (!payload?.backup) throw new Error('Backup non presente in risposta');
      const localPayload = createBackupPayload();
      const localPreview = buildBackupInspector(localPayload);
      const cloudPreview = buildBackupInspector(payload.backup);
      setCloudConflict({
        cloudBackup: payload.backup,
        localBackup: localPayload,
        cloudUpdatedAt: payload.updatedAt || '',
        localPreview,
        cloudPreview
      });
      setCloudStatus('Conflitto rilevato: scegli se usare Cloud o tenere Locale.');
    } catch (error) {
      setCloudStatus(`Errore pull: ${error?.message || 'sconosciuto'}`);
    }
  };
  const applyCloudBackupNow = () => {
    if (!cloudConflict?.cloudBackup) return;
    importBackupPayload(cloudConflict.cloudBackup);
  };
  const keepLocalAndPushNow = async () => {
    if (!cloudConflict?.localBackup) return;
    try {
      await cloudPush({ backupPayload: cloudConflict.localBackup });
      setCloudStatus('Versione locale mantenuta e pushata su cloud.');
      setCloudConflict(null);
    } catch (error) {
      setCloudStatus(`Errore push locale: ${error?.message || 'sconosciuto'}`);
    }
  };
  const handleCloudLogout = () => {
    clearCloudSession();
    setCloudSession(getCloudSession());
    setCloudStatus('Sessione cloud rimossa da questo device.');
  };
  const restoreLatestAutoBackup = () => {
    const latest = autoBackups?.[0];
    if (!latest?.payload) {
      setStatus('Nessun backup automatico disponibile.');
      return;
    }
    const ok = window.confirm('Ripristinare l’ultimo backup automatico settimanale?');
    if (!ok) return;
    importBackupPayload(latest.payload);
  };
  const restoreDailyPoint = (point) => {
    if (!point?.payload) {
      setStatus('Restore point giornaliero non valido.');
      return;
    }
    const ok = window.confirm(`Ripristinare il restore point del ${new Date(point.createdAt || Date.now()).toLocaleString('it-IT')}?`);
    if (!ok) return;
    importBackupPayload(point.payload);
  };
  const restoreLatestDailyPoint = () => {
    const latest = dailyRestorePoints?.[0];
    if (!latest?.payload) {
      setStatus('Nessun restore point giornaliero disponibile.');
      return;
    }
    restoreDailyPoint(latest);
  };
  const runDeployHealthCheck = async () => {
    setDeployHealth((prev) => ({ ...prev, checking: true, detail: '' }));
    let endpointOk = false;
    let aiPingOk = false;
    let hasApiKey = null;
    let forcedModel = '';
    let defaultModel = '';
    let fallbackEnabled = null;
    let detail = '';
    let modelUsed = '';
    try {
      const healthRes = await fetch('/api/openrouter/chat', { method: 'GET' });
      endpointOk = healthRes.ok;
      const healthJson = await healthRes.json().catch(() => ({}));
      hasApiKey = Boolean(healthJson?.hasApiKey);
      forcedModel = String(healthJson?.forcedModel || '');
      defaultModel = String(healthJson?.defaultModel || '');
      fallbackEnabled = Boolean(healthJson?.fallbackEnabled);
    } catch (error) {
      detail = `Endpoint check fallito: ${formatAiErrorDetail(error?.message || 'errore rete')}`;
    }
    try {
      const aiRes = await requestSystemAI({
        temperature: 0,
        max_tokens: 30,
        timeoutMs: 12000,
        messages: [
          { role: 'system', content: 'Rispondi solo con JSON: {"ok":true,"msg":"pong"}' },
          { role: 'user', content: 'ping' }
        ]
      });
      aiPingOk = Boolean(aiRes?.choices?.[0]?.message?.content);
      modelUsed = String(aiRes?._shadowMeta?.model || '');
    } catch (error) {
      aiPingOk = false;
      detail = detail || `Ping AI fallito: ${formatAiErrorDetail(error?.message || 'errore provider')}`;
    }
    setDeployHealth({
      checking: false,
      checkedAt: new Date().toISOString(),
      endpointOk,
      aiPingOk,
      hasApiKey,
      forcedModel,
      defaultModel,
      fallbackEnabled,
      modelUsed,
      detail
    });
  };
  const toggleFeatureFlag = (key) => {
    const next = {
      ...featureFlags,
      [key]: !featureFlags?.[key]
    };
    setFeatureFlags(next);
    localStorage.setItem('shadow_monarch_feature_flags', JSON.stringify(next));
  };
  const classifyErrorBucket = (entry = {}) => {
    const text = `${String(entry?.detail || '')} ${String(entry?.message || '')}`.toLowerCase();
    if (text.includes('api key') || text.includes('invalid key') || text.includes('401') || text.includes('unauthorized')) {
      return {
        id: 'api_key',
        label: 'API Key / Autorizzazione',
        suggestion: 'Apri Deploy Health e verifica API key + modello forzato.'
      };
    }
    if (text.includes('rate') || text.includes('429') || text.includes('too many')) {
      return {
        id: 'rate_limit',
        label: 'Rate Limit',
        suggestion: 'Riduci frequenza richieste e riprova dopo 20-40 secondi.'
      };
    }
    if (text.includes('timeout') || text.includes('408')) {
      return {
        id: 'timeout',
        label: 'Timeout Provider',
        suggestion: 'Riprova con prompt piu breve e controlla la connessione.'
      };
    }
    if (text.includes('provider') || text.includes('unavailable') || text.includes('503') || text.includes('502')) {
      return {
        id: 'provider_busy',
        label: 'Provider Occupato',
        suggestion: 'Attendi qualche secondo o usa modello backup.'
      };
    }
    if (text.includes('network') || text.includes('fetch') || text.includes('offline')) {
      return {
        id: 'network',
        label: 'Connessione',
        suggestion: 'Controlla rete e riprova il check AI.'
      };
    }
    return {
      id: 'generic',
      label: 'Errore Generico',
      suggestion: 'Esegui Deploy Health e controlla i log recenti.'
    };
  };
  const telemetryErrorRows = (() => {
    const source = Array.isArray(telemetryEntries) ? telemetryEntries : [];
    const recentErrors = source
      .filter((entry) => String(entry?.status || '').toLowerCase() === 'error' || String(entry?.detail || '').trim())
      .slice(0, 20);
    const map = new Map();
    recentErrors.forEach((entry) => {
      const bucket = classifyErrorBucket(entry);
      const prev = map.get(bucket.id) || {
        ...bucket,
        count: 0,
        lastAt: '',
        lastDetail: ''
      };
      const at = String(entry?.createdAt || entry?.at || '');
      const nextLastAt = !prev.lastAt || (at && new Date(at).getTime() > new Date(prev.lastAt).getTime()) ? at : prev.lastAt;
      map.set(bucket.id, {
        ...prev,
        count: prev.count + 1,
        lastAt: nextLastAt,
        lastDetail: String(entry?.detail || prev.lastDetail || '').slice(0, 140)
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  return (
    <div className="p-6 pt-10 pb-24 min-h-full bg-void-black">
      <div className="mb-8">
        <p className="text-cyan-300 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Support Core</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">HELP</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-cyan-300 uppercase tracking-widest mb-2">Panoramica Schermate</p>
        <div className="space-y-2">
          {SCREEN_GUIDE.map((screen) => (
            <div key={screen.id} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-cyan-200 uppercase tracking-widest">{screen.title}</p>
              <p className="text-xs text-gray-300 mt-1">{screen.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="bg-black/40 border border-indigo-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-indigo-300 uppercase tracking-widest mb-2">Tutorial Interattivo</p>
        <p className="text-xs text-gray-300 mb-3">Apri le schermate in ordine consigliato con un tap.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate?.('system')} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Vai a System</button>
          <button onClick={() => onNavigate?.('training')} className="text-[10px] px-3 py-2 border border-red-300 text-red-200 uppercase tracking-widest hover:bg-red-300 hover:text-black">Vai a Train</button>
          <button onClick={() => onNavigate?.('recovery')} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Vai a Bio</button>
          <button onClick={() => onNavigate?.('quests')} className="text-[10px] px-3 py-2 border border-amber-300 text-amber-200 uppercase tracking-widest hover:bg-amber-300 hover:text-black">Vai a Quest</button>
          <button onClick={() => onNavigate?.('boss')} className="text-[10px] px-3 py-2 border border-rose-300 text-rose-200 uppercase tracking-widest hover:bg-rose-300 hover:text-black">Vai a Gate</button>
          <button onClick={() => onNavigate?.('stats')} className="text-[10px] px-3 py-2 border border-purple-300 text-purple-200 uppercase tracking-widest hover:bg-purple-300 hover:text-black">Vai a Stats</button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-cyan-300 uppercase tracking-widest mb-2">Demo Visive (Mini Clip)</p>
        <p className="text-xs text-gray-300 mb-3">Tap su una card per aprire subito la schermata correlata.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HELP_DEMOS.map((demo, idx) => (
            <button
              key={demo.id}
              onClick={() => onNavigate?.(demo.screen)}
              className="relative overflow-hidden border border-white/15 bg-black/40 rounded-sm p-3 text-left group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${demo.tint}`} />
              <motion.div
                className="absolute -inset-10 opacity-25 pointer-events-none"
                animate={{ x: [-12, 12, -12], y: [-8, 8, -8], rotate: [0, 2, 0] }}
                transition={{ duration: 5 + idx, repeat: Infinity, ease: 'easeInOut' }}
              >
                {demo.image.endsWith('.json') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl font-black text-amber-200/80">{demo.fallbackLabel || 'DATA'}</span>
                  </div>
                ) : (
                  <img src={demo.image} alt={demo.title} className="w-full h-full object-contain" />
                )}
              </motion.div>
              <div className="relative z-10">
                <p className="text-[10px] text-cyan-200 uppercase tracking-widest">{demo.title}</p>
                <p className="text-xs text-gray-300 mt-1">{demo.subtitle}</p>
                <p className="text-[10px] text-white/70 mt-2 uppercase tracking-widest">Tap to open</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-black/40 border border-purple-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-purple-300 uppercase tracking-widest mb-2">Backup & Restore</p>
        <p className="text-xs text-gray-300 mb-3">Usa queste azioni prima di cambiare deploy su Netlify: preservano streak, grafici, raid, inventario, quest, workout history e progressione completa.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportBackup} className="text-[10px] px-3 py-2 border border-purple-300 text-purple-200 uppercase tracking-widest hover:bg-purple-400 hover:text-black">Esporta Dati</button>
          <button onClick={() => fileRef.current?.click()} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Importa Dati</button>
        </div>
        <div className="mt-3 border border-white/10 bg-black/30 p-2 rounded-sm">
          <p className="text-[10px] text-gray-300 uppercase tracking-widest">Procedura consigliata</p>
          <p className="text-xs text-gray-400 mt-1">1. Esporta Dati.</p>
          <p className="text-xs text-gray-400">2. Salva il file JSON in iCloud/Drive.</p>
          <p className="text-xs text-gray-400">3. Apri il nuovo sito Netlify.</p>
          <p className="text-xs text-gray-400">4. Importa Dati e attendi reload automatico.</p>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importBackup} />
        {backupPreview && (
          <div className="mt-3 border border-cyan-300/30 bg-black/40 p-3 rounded-sm">
            <p className="text-[10px] text-cyan-200 uppercase tracking-widest mb-2">Backup Inspector</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <p className="text-gray-400">Export:</p><p className="text-white">{new Date(backupPreview.exportedAt).toLocaleString('it-IT')}</p>
              <p className="text-gray-400">Chiavi Backup:</p><p className="text-white">{backupPreview.keysCount}</p>
              <p className="text-gray-400">Log Giorni:</p><p className="text-white">{backupPreview.logsCount}</p>
              <p className="text-gray-400">Workout Salvati:</p><p className="text-white">{backupPreview.workoutsCount}</p>
              <p className="text-gray-400">Livello / Streak:</p><p className="text-white">{backupPreview.level} / {backupPreview.streak}</p>
              <p className="text-gray-400">Gold / Key:</p><p className="text-white">{backupPreview.gold} / {backupPreview.keys}</p>
              <p className="text-gray-400">Sys Power:</p><p className="text-white">{backupPreview.systemPowerScore}</p>
              <p className="text-gray-400">Raid Clear / Floor:</p><p className="text-white">{backupPreview.raidClears} / {backupPreview.raidHighestFloor}</p>
              <p className="text-gray-400">Prestige:</p><p className="text-white">{backupPreview.prestigeLevel}</p>
              <p className="text-gray-400">Relic Slots:</p><p className="text-white">{backupPreview.relicSlots}</p>
              <p className="text-gray-400">Titles:</p><p className="text-white">{backupPreview.titlesCount}</p>
            </div>
            <button onClick={confirmImport} className="mt-3 w-full text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">
              Conferma Import
            </button>
          </div>
        )}
        {status ? <p className="mt-3 text-[10px] text-emerald-300 uppercase tracking-widest">{status}</p> : null}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="bg-black/40 border border-emerald-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Backup Automatico Settimanale</p>
        <p className="text-xs text-gray-300 mb-3">Il sistema salva automaticamente uno snapshot a settimana (max 12).</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={restoreLatestAutoBackup} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">
            Ripristina Ultimo (1 tap)
          </button>
          <button
            onClick={() => {
              refreshBackupPanels();
            }}
            className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
          >
            Aggiorna Lista
          </button>
        </div>
        <p className="text-[10px] text-gray-400 uppercase">Snapshot salvati: {autoBackups.length}</p>
        {autoBackups[0]?.createdAt ? (
          <p className="text-[10px] text-gray-400">Ultimo: {new Date(autoBackups[0].createdAt).toLocaleString('it-IT')} ({autoBackups[0].weekKey})</p>
        ) : (
          <p className="text-[10px] text-gray-500">Ancora nessun snapshot disponibile.</p>
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mb-6">
        <p className="text-[10px] text-cyan-300 uppercase tracking-widest mb-2">Restore Point Giornalieri (Auto)</p>
        <p className="text-xs text-gray-300 mb-3">Snapshot automatico giornaliero (max 14). Perfetto per tornare indietro di 1 giorno con un tap.</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={restoreLatestDailyPoint} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">
            Ripristina Ultimo (1 tap)
          </button>
          <button
            onClick={() => {
              refreshBackupPanels();
            }}
            className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black"
          >
            Aggiorna Lista
          </button>
        </div>
        <p className="text-[10px] text-gray-400 uppercase">Restore point: {dailyRestorePoints.length}</p>
        {dailyRestorePoints.length ? (
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
            {dailyRestorePoints.slice(0, 8).map((point) => (
              <div key={point.id} className="border border-white/10 bg-black/35 p-2 rounded-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-cyan-100">{new Date(point.createdAt || Date.now()).toLocaleString('it-IT')}</p>
                  <button
                    onClick={() => restoreDailyPoint(point)}
                    className="text-[9px] px-2 py-1 border border-cyan-300/50 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black"
                  >
                    Ripristina
                  </button>
                </div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">Day key: {point.dayKey || '--'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 mt-1">Nessun restore point giornaliero ancora disponibile.</p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-black/40 border border-amber-400/30 p-4 rounded-sm">
        <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Auth + Cloud Sync</p>
        <p className="text-xs text-gray-300 mb-3">Collega Supabase impostando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={cloudAuth.email} onChange={(e) => setCloudAuth((prev) => ({ ...prev, email: e.target.value }))} placeholder="email" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="password" value={cloudAuth.password} onChange={(e) => setCloudAuth((prev) => ({ ...prev, password: e.target.value }))} placeholder="password" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={handleCloudRegister} className="text-[10px] px-3 py-2 border border-emerald-300 text-emerald-200 uppercase tracking-widest hover:bg-emerald-300 hover:text-black">Register</button>
          <button onClick={handleCloudLogin} className="text-[10px] px-3 py-2 border border-cyan-300 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Login</button>
          <button onClick={handleCloudPush} className="text-[10px] px-3 py-2 border border-purple-300 text-purple-200 uppercase tracking-widest hover:bg-purple-300 hover:text-black">Push Cloud</button>
          <button onClick={handleCloudPull} className="text-[10px] px-3 py-2 border border-fuchsia-300 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Pull Cloud</button>
        </div>
        <button onClick={handleCloudLogout} className="w-full text-[10px] px-3 py-2 border border-rose-300 text-rose-200 uppercase tracking-widest hover:bg-rose-300 hover:text-black">Logout Cloud</button>
        <p className="mt-2 text-[10px] text-gray-400">Sessione: {cloudSession.email || 'guest'} ({cloudSession.provider || 'cloud'})</p>
        {cloudConflict ? (
          <div className="mt-3 border border-fuchsia-300/35 bg-black/40 p-3 rounded-sm">
            <p className="text-[10px] text-fuchsia-200 uppercase tracking-widest mb-2">Cloud Conflict Resolver</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-cyan-200 uppercase tracking-widest">Locale</p>
                <p className="text-gray-300 mt-1">Log: {cloudConflict.localPreview?.logsCount || 0}</p>
                <p className="text-gray-300">Workout: {cloudConflict.localPreview?.workoutsCount || 0}</p>
                <p className="text-gray-300">Livello: {cloudConflict.localPreview?.level || 1}</p>
              </div>
              <div className="border border-white/10 bg-white/5 p-2">
                <p className="text-fuchsia-200 uppercase tracking-widest">Cloud</p>
                <p className="text-gray-300 mt-1">Log: {cloudConflict.cloudPreview?.logsCount || 0}</p>
                <p className="text-gray-300">Workout: {cloudConflict.cloudPreview?.workoutsCount || 0}</p>
                <p className="text-gray-300">Livello: {cloudConflict.cloudPreview?.level || 1}</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mb-2">Cloud updated: {cloudConflict.cloudUpdatedAt ? new Date(cloudConflict.cloudUpdatedAt).toLocaleString('it-IT') : '--'}</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={applyCloudBackupNow} className="text-[9px] px-2 py-2 border border-fuchsia-300/45 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Usa Cloud</button>
              <button onClick={keepLocalAndPushNow} className="text-[9px] px-2 py-2 border border-cyan-300/45 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Tieni Locale</button>
              <button onClick={() => setCloudConflict(null)} className="text-[9px] px-2 py-2 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">Annulla</button>
            </div>
          </div>
        ) : null}
        {cloudStatus ? <p className="mt-1 text-[10px] text-emerald-300">{cloudStatus}</p> : null}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.105 }} className="bg-black/40 border border-violet-400/30 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-violet-300 uppercase tracking-widest">Release Switch (Beta)</p>
          <button onClick={() => {
            try {
              const raw = localStorage.getItem('shadow_monarch_feature_flags');
              const parsed = raw ? JSON.parse(raw) : {};
              setFeatureFlags({
                globalTimeline: parsed?.globalTimeline !== false,
                smartGoalWizard: parsed?.smartGoalWizard !== false,
                bossReady: parsed?.bossReady !== false,
                travelMode: parsed?.travelMode !== false
              });
            } catch (_) {}
          }} className="text-[9px] px-2 py-1 border border-violet-300/40 text-violet-200 uppercase tracking-widest">Refresh</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['globalTimeline', 'Global Timeline'],
            ['smartGoalWizard', 'Smart Goal Wizard'],
            ['bossReady', 'Boss Ready'],
            ['travelMode', 'Travel Mode']
          ].map(([key, label]) => (
            <button
              key={`ff-${key}`}
              onClick={() => toggleFeatureFlag(key)}
              className={`text-[9px] px-2 py-2 border uppercase tracking-widest ${
                featureFlags?.[key] ? 'border-emerald-300/45 text-emerald-200 bg-emerald-500/10' : 'border-white/20 text-gray-400'
              }`}
            >
              {label} {featureFlags?.[key] ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </motion.div>

      {featureFlags.globalTimeline ? (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.108 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-cyan-300 uppercase tracking-widest">Global Timeline</p>
          <button onClick={refreshGlobalTimeline} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest">Refresh</button>
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {globalTimeline.length ? globalTimeline.map((event) => (
            <div key={event.id} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-cyan-200">{event.type}</p>
                <p className="text-[9px] text-gray-500">{event.date}</p>
              </div>
              <p className="text-[10px] text-gray-300 mt-1">{event.detail}</p>
            </div>
          )) : (
            <p className="text-xs text-gray-400">Timeline vuota per ora.</p>
          )}
        </div>
      </motion.div>
      ) : null}

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-cyan-300 uppercase tracking-widest">Dev Telemetry</p>
          <div className="flex gap-2">
            <button onClick={refreshTelemetry} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest">Refresh</button>
            <button onClick={() => { clearTelemetry(); refreshTelemetry(); }} className="text-[9px] px-2 py-1 border border-rose-300/40 text-rose-200 uppercase tracking-widest">Clear</button>
          </div>
        </div>
        <div className="space-y-2 max-h-44 overflow-y-auto">
          {telemetryEntries.length > 0 ? telemetryEntries.slice(0, 10).map((entry) => (
            <div key={entry.id} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-cyan-200 uppercase tracking-widest">{entry.type} • {entry.status || 'n/a'}</p>
              <p className="text-[10px] text-gray-400">model: {entry.model || '-'} | attempts: {entry.attempts || '-'} | {entry.durationMs || 0}ms</p>
              {entry.detail ? <p className="text-[10px] text-rose-200">{entry.detail}</p> : null}
            </div>
          )) : <p className="text-xs text-gray-400">Nessuna telemetria disponibile.</p>}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.112 }} className="bg-black/40 border border-rose-400/30 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-rose-300 uppercase tracking-widest">Error Center</p>
          <button
            onClick={() => {
              refreshTelemetry();
              runDeployHealthCheck();
            }}
            className="text-[9px] px-2 py-1 border border-rose-300/40 text-rose-200 uppercase tracking-widest"
          >
            Diagnosi 1-Click
          </button>
        </div>
        {telemetryErrorRows.length ? (
          <div className="space-y-2">
            {telemetryErrorRows.map((row) => (
              <div key={`err-bucket-${row.id}`} className="border border-white/10 bg-black/30 p-2 rounded-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-rose-200">{row.label}</p>
                  <p className="text-[10px] text-white font-black">x{row.count}</p>
                </div>
                <p className="text-[10px] text-gray-300 mt-1">{row.suggestion}</p>
                {row.lastDetail ? <p className="text-[10px] text-gray-500 mt-1">Last: {row.lastDetail}</p> : null}
                <div className="mt-2 flex gap-2">
                  <button onClick={runDeployHealthCheck} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 uppercase tracking-widest hover:bg-cyan-300 hover:text-black">Run Health</button>
                  <button onClick={() => onNavigate?.('system')} className="text-[9px] px-2 py-1 border border-fuchsia-300/40 text-fuchsia-200 uppercase tracking-widest hover:bg-fuchsia-300 hover:text-black">Apri System</button>
                  <button onClick={refreshTelemetry} className="text-[9px] px-2 py-1 border border-white/20 text-gray-300 uppercase tracking-widest hover:bg-white/10">Refresh Logs</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-200">Nessun errore critico nelle ultime telemetrie.</p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.115 }} className="bg-black/40 border border-fuchsia-400/30 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-fuchsia-300 uppercase tracking-widest">Deploy Health Panel</p>
          <button
            onClick={runDeployHealthCheck}
            disabled={deployHealth.checking}
            className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${
              deployHealth.checking ? 'border-gray-700 text-gray-500' : 'border-fuchsia-300/40 text-fuchsia-200'
            }`}
          >
            {deployHealth.checking ? 'Check...' : 'Run Check'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">Endpoint</p>
            <p className={`text-[10px] font-black ${deployHealth.endpointOk ? 'text-emerald-200' : deployHealth.endpointOk === false ? 'text-rose-200' : 'text-gray-400'}`}>
              {deployHealth.endpointOk ? 'ONLINE' : deployHealth.endpointOk === false ? 'OFFLINE' : '--'}
            </p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">AI Ping</p>
            <p className={`text-[10px] font-black ${deployHealth.aiPingOk ? 'text-emerald-200' : deployHealth.aiPingOk === false ? 'text-rose-200' : 'text-gray-400'}`}>
              {deployHealth.aiPingOk ? 'OK' : deployHealth.aiPingOk === false ? 'FAIL' : '--'}
            </p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">API Key Server</p>
            <p className={`text-[10px] font-black ${deployHealth.hasApiKey ? 'text-emerald-200' : deployHealth.hasApiKey === false ? 'text-rose-200' : 'text-gray-400'}`}>
              {deployHealth.hasApiKey ? 'SET' : deployHealth.hasApiKey === false ? 'MISSING' : '--'}
            </p>
          </div>
          <div className="border border-white/10 bg-white/5 p-2">
            <p className="text-[9px] uppercase text-gray-500">Fallback Paid</p>
            <p className={`text-[10px] font-black ${deployHealth.fallbackEnabled ? 'text-amber-200' : deployHealth.fallbackEnabled === false ? 'text-emerald-200' : 'text-gray-400'}`}>
              {deployHealth.fallbackEnabled ? 'ON' : deployHealth.fallbackEnabled === false ? 'OFF' : '--'}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-gray-300">Forced model: <span className="text-cyan-200">{deployHealth.forcedModel || '--'}</span></p>
        <p className="text-[10px] text-gray-300">Default model: <span className="text-cyan-200">{deployHealth.defaultModel || '--'}</span></p>
        <p className="text-[10px] text-gray-300">Model used (ping): <span className="text-cyan-200">{deployHealth.modelUsed || '--'}</span></p>
        {deployHealth.checkedAt ? <p className="text-[9px] text-gray-500 mt-1">Ultimo check: {new Date(deployHealth.checkedAt).toLocaleString('it-IT')}</p> : null}
        {deployHealth.detail ? <p className="text-[10px] text-rose-200 mt-1">{deployHealth.detail}</p> : null}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-black/40 border border-amber-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-amber-300 uppercase tracking-widest mb-2">Flow Giornaliero Consigliato</p>
        {DAILY_FLOW.map((step, idx) => (
          <p key={step} className="text-xs text-gray-300 mb-1">{idx + 1}. {step}</p>
        ))}
        <p className="text-[10px] text-amber-200 mt-3 uppercase tracking-widest">Hunter level: {playerStats?.level || 1}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="bg-black/40 border border-blue-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-blue-300 uppercase tracking-widest mb-2">Roadmap Settimanale</p>
        {WEEKLY_FLOW.map((step, idx) => (
          <p key={step} className="text-xs text-gray-300 mb-1">{idx + 1}. {step}</p>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-black/40 border border-sky-400/35 p-4 rounded-sm mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-sky-300 uppercase tracking-widest">Piano Progressione 7 Giorni</p>
          <p className="text-[10px] text-sky-200">Focus: {weekPlan.focus}</p>
        </div>
        <p className="text-xs text-gray-300 mb-2">
          Stat da recuperare: <span className="text-sky-200 font-bold">{weekPlan.weakStat?.label || 'Bilanciata'}</span> ·
          Workout fatti: <span className="text-white">{weekPlan.completedWorkouts}</span> ·
          Target week: <span className="text-white">{weekPlan.weeklyWorkoutTarget}</span> ·
          Gate target: <span className="text-white">Floor {weekPlan.floorTarget}</span>
        </p>
        <div className="space-y-2">
          {weekPlan.week.map((entry, idx) => (
            <div key={`${entry.dayLabel}-${entry.dateLabel}`} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-sky-200 uppercase tracking-widest">Day {idx + 1} · {entry.dayLabel} {entry.dateLabel} · {entry.title}</p>
              <p className="text-xs text-gray-300 mt-1">{entry.mission}</p>
              <p className="text-xs text-cyan-200 mt-1">Gate: {entry.gate}</p>
              <p className="text-[10px] text-gray-400 mt-1">{entry.checklist}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => onNavigate?.('training')} className="text-[10px] px-3 py-2 border border-red-300 text-red-200 uppercase tracking-widest hover:bg-red-300 hover:text-black">Apri Train</button>
          <button onClick={() => onNavigate?.('boss')} className="text-[10px] px-3 py-2 border border-sky-300 text-sky-200 uppercase tracking-widest hover:bg-sky-300 hover:text-black">Apri Gate</button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-black/40 border border-rose-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-rose-300 uppercase tracking-widest mb-2">Gate Atlas (Piani 1-10)</p>
        <div className="space-y-2">
          {GATE_LEVELS.map((floor) => (
            <div key={floor.floor} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-rose-200 uppercase tracking-widest">Floor {floor.floor} • {floor.boss}</p>
              <p className="text-xs text-gray-300 mt-1">Biome: {floor.biome}</p>
              <p className="text-xs text-gray-400">{floor.note}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="bg-black/40 border border-fuchsia-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-fuchsia-300 uppercase tracking-widest mb-2">Hunter Evolution</p>
        <div className="space-y-2">
          {EVOLUTION_GUIDE.map((line) => (
            <p key={line} className="text-xs text-gray-300">{line}</p>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="bg-black/40 border border-cyan-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-cyan-300 uppercase tracking-widest mb-2">Skill Tree Guide</p>
        <div className="space-y-2">
          {SKILL_TREE_GUIDE.map((node) => (
            <div key={node.name} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-cyan-200 uppercase tracking-widest">{node.name}</p>
              <p className="text-xs text-gray-300 mt-1">Sblocco: {node.unlock}</p>
              <p className="text-xs text-gray-400">Effetto: {node.effect}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="bg-black/40 border border-teal-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-teal-300 uppercase tracking-widest mb-2">Cosa Salva il Backup</p>
        {DATA_COVERAGE.map((line, idx) => (
          <p key={line} className="text-xs text-gray-300 mb-1">{idx + 1}. {line}</p>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }} className="bg-black/40 border border-emerald-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Checklist Prima di Pushare un Nuovo Piano</p>
        <p className="text-xs text-gray-300 mb-1">1. Hai almeno 3-5 clear stabili al piano precedente.</p>
        <p className="text-xs text-gray-300 mb-1">2. Energia e skill cost sono sostenibili senza andare in dry dopo pochi attacchi.</p>
        <p className="text-xs text-gray-300 mb-1">3. Lifestyle score della giornata non è “rosso” (sonno/acqua/cibo allineati).</p>
        <p className="text-xs text-gray-300">4. Hai fatto backup recente se stai per fare update del deploy.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-black/40 border border-rose-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-rose-300 uppercase tracking-widest mb-2">Problemi Comuni</p>
        <div className="space-y-2">
          {TROUBLESHOOT.map((item) => (
            <div key={item.q} className="border border-white/10 bg-black/30 p-2 rounded-sm">
              <p className="text-[10px] text-rose-200 uppercase tracking-widest">{item.q}</p>
              <p className="text-xs text-gray-300 mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }} className="bg-black/40 border border-emerald-400/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">FAQ Rapida</p>
        <p className="text-xs text-gray-300 mb-1">Posso usare l’app solo da iPhone? Sì, è ottimizzata mobile-first.</p>
        <p className="text-xs text-gray-300 mb-1">La streak si mantiene dopo update? Sì, con backup/import.</p>
        <p className="text-xs text-gray-300 mb-1">Il Gate scala nel tempo? Sì, con season lunga + prestige.</p>
        <p className="text-xs text-gray-300">Le calorie sono automatiche? Sì, con Precision Calorie Engine e log attività.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }} className="bg-black/40 border border-red-500/30 p-4 rounded-sm mt-6">
        <p className="text-[10px] text-red-300 uppercase tracking-widest mb-2">Zona Pericolosa</p>
        <p className="text-xs text-gray-300 mb-3">Usa il reset solo se vuoi ripartire da zero. Cancella esclusivamente i dati locali di Shadow Monarch da questo dispositivo/browser.</p>
        <button
          onMouseDown={beginHoldResetAll}
          onMouseUp={cancelHoldResetAll}
          onMouseLeave={cancelHoldResetAll}
          onTouchStart={beginHoldResetAll}
          onTouchEnd={cancelHoldResetAll}
          onTouchCancel={cancelHoldResetAll}
          className={`w-full text-[10px] px-3 py-2 border uppercase tracking-widest ${
            holdResetAll ? 'border-red-200 text-red-100 bg-red-500/30' : 'border-red-300 text-red-200 hover:bg-red-300 hover:text-black'
          }`}
        >
          {holdResetAll ? 'Tieni premuto...' : 'Reset Totale Dati (hold 1.5s)'}
        </button>
      </motion.div>
    </div>
  );
};

export default Help;

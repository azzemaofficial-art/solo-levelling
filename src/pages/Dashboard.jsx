import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAiHistory, parseModelJson, pushAiHistory, requestSystemAI } from '../utils/aiClient';

const WORKOUT_PROMPT_PRESETS = [
  { id: 'home-quick', label: 'Casa 30m', prompt: '30 minuti, casa, corpo libero, full body, livello principiante.' },
  { id: 'gym-cut', label: 'Cut Palestra', prompt: '55 minuti, palestra, focus perdita grasso, circuito pesi+cardio, livello intermedio.' },
  { id: 'push', label: 'Push Day', prompt: '60 minuti, palestra, focus petto spalle tricipiti, progressione forza, livello intermedio.' },
  { id: 'pull', label: 'Pull Day', prompt: '60 minuti, palestra, focus dorso bicipiti, progressione forza, livello intermedio.' },
  { id: 'legs', label: 'Leg Day', prompt: '50 minuti, palestra, focus gambe e glutei, tecnica pulita, livello intermedio.' }
];

const Dashboard = ({
  systemLogs,
  setSystemLogs,
  dailyGoal,
  setDailyGoal,
  playerStats,
  setPlayerStats,
  macroGoals,
  hydrationGoal,
  setHydrationGoal,
  createEmptyLog
}) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayData = systemLogs.find(log => log.date === today) || createEmptyLog(today);

  const [isWeekly, setIsWeekly] = useState(false);
  const [eatInput, setEatInput] = useState(''); 
  const [burnInput, setBurnInput] = useState('');
  const [liftWeight, setLiftWeight] = useState('');
  const [liftReps, setLiftReps] = useState('');
  const [bodyWeight, setBodyWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState(dailyGoal);

  const [isSpinning, setIsSpinning] = useState(false);
  const [chestReward, setChestReward] = useState(null);

  const [oracleText, setOracleText] = useState('');
  const [oracleImage, setOracleImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const oracleImageRef = useRef(null);
  const [waterInput, setWaterInput] = useState('');
  const [workoutPrompt, setWorkoutPrompt] = useState('');
  const [aiWorkout, setAiWorkout] = useState(null);
  const [aiHistory, setAiHistory] = useState(() => getAiHistory());
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [isWorkoutRunning, setIsWorkoutRunning] = useState(false);
  const [workoutRemaining, setWorkoutRemaining] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [exerciseInputs, setExerciseInputs] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState(() => {
    const savedHistory = localStorage.getItem('shadow_monarch_workout_history');
    if (!savedHistory) return [];
    try {
      return JSON.parse(savedHistory);
    } catch (error) {
      console.error(error);
      return [];
    }
  });
  const [sleepInput, setSleepInput] = useState('');
  const [energyInput, setEnergyInput] = useState(7);
  const [hydrationGoalInput, setHydrationGoalInput] = useState(hydrationGoal);
  const [showHydrationEditor, setShowHydrationEditor] = useState(false);
  const [scaleWeightInput, setScaleWeightInput] = useState('');
  const [scaleFatInput, setScaleFatInput] = useState('');
  const [scaleWaterInput, setScaleWaterInput] = useState('');
  const [scaleMuscleInput, setScaleMuscleInput] = useState('');
  const [scaleBmrInput, setScaleBmrInput] = useState('');
  const [scaleVisceralInput, setScaleVisceralInput] = useState('');
  const [scaleAgeInput, setScaleAgeInput] = useState('');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusRemaining, setFocusRemaining] = useState(25 * 60);
  const [isFocusRunning, setIsFocusRunning] = useState(false);
  const [microQuest, setMicroQuest] = useState(() => {
    const savedQuest = localStorage.getItem('shadow_monarch_micro_quest');
    if (!savedQuest) return null;
    try {
      return JSON.parse(savedQuest);
    } catch (error) {
      console.error(error);
      return null;
    }
  });
  const [cinematicEvent, setCinematicEvent] = useState(null);
  const [isCinematicVisible, setIsCinematicVisible] = useState(false);
  const cinematicTimeoutRef = useRef(null);
  const workoutSessionRef = useRef({ aiWorkout: null, exerciseProgress: {} });

  // 🔥 NUOVA LOGICA SHADOW STREAK
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA'); 
    const lastLogin = playerStats.lastLoginDate;
    let newStreak = playerStats.streak || 0;

    if (lastLogin !== todayStr) {
      if (lastLogin) {
        const lastDate = new Date(lastLogin);
        const todayObj = new Date(todayStr);
        const diffDays = Math.round(Math.abs((todayObj - lastDate) / (1000 * 60 * 60 * 24)));
        
        if (diffDays === 1) {
          newStreak += 1; 
        } else if (diffDays > 1) {
          if ((playerStats.streakShieldTokens || 0) > 0) {
            setPlayerStats((prev) => ({ ...prev, streakShieldTokens: Math.max((prev.streakShieldTokens || 0) - 1, 0) }));
            setTimeout(() => alert("🛡️ STREAK SHIELD ATTIVO: combo giornaliera salvata!"), 1000);
          } else {
            newStreak = 1;
            setTimeout(() => alert("⚠️ SYSTEM WARNING: Hai saltato un giorno. La tua Shadow Streak è tornata a 1!"), 1000);
          }
        }
      } else {
        newStreak = 1; 
      }
      setPlayerStats(prev => ({ ...prev, streak: newStreak, lastLoginDate: todayStr }));
    }
  }, []);

  useEffect(() => {
    const savedWorkout = localStorage.getItem('shadow_monarch_ai_workout');
    if (savedWorkout) {
      try {
        setAiWorkout(JSON.parse(savedWorkout));
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  useEffect(() => {
    setHydrationGoalInput(hydrationGoal);
  }, [hydrationGoal]);

  useEffect(() => {
    localStorage.setItem('shadow_monarch_micro_quest', JSON.stringify(microQuest));
  }, [microQuest]);

  useEffect(() => {
    localStorage.setItem('shadow_monarch_workout_history', JSON.stringify(workoutHistory));
  }, [workoutHistory]);

  useEffect(() => {
    workoutSessionRef.current = { aiWorkout, exerciseProgress };
  }, [aiWorkout, exerciseProgress]);

  useEffect(() => {
    if (!isFocusRunning) {
      setFocusRemaining(focusMinutes * 60);
    }
  }, [focusMinutes, isFocusRunning]);

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
    const interval = setInterval(() => {
      setRestRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [restRemaining]);

  useEffect(() => {
    if (!isFocusRunning) return;
    const interval = setInterval(() => {
      setFocusRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsFocusRunning(false);
          setPlayerStats((stats) => ({
            ...stats,
            exp: (stats.exp || 0) + 35,
            gold: (stats.gold || 0) + 20,
            focusSessions: (stats.focusSessions || 0) + 1,
            lastFocusCompletion: new Date().toISOString()
          }));
          incrementCombo('focus-session');
          triggerCinematic("FOCUS COMPLETE", `Sessione ${focusMinutes} min completata`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isFocusRunning, focusMinutes]);

  useEffect(() => {
    return () => {
      if (cinematicTimeoutRef.current) clearTimeout(cinematicTimeoutRef.current);
    };
  }, []);
  const saveToSystem = (updates) => {
    const exists = systemLogs.some(log => log.date === today);
    if (exists) {
      setSystemLogs(systemLogs.map(log => log.date === today ? { ...log, ...updates } : log));
    } else {
      setSystemLogs([...systemLogs, { ...todayData, ...updates }]);
    }
  };

  const distributeWeeklyData = (field, totalValue) => {
    const perDay = Math.round(totalValue / 7);
    let updatedLogs = [...systemLogs];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      const existingIdx = updatedLogs.findIndex(l => l.date === dStr);
      if (existingIdx >= 0) {
        updatedLogs[existingIdx] = { ...updatedLogs[existingIdx], [field]: (updatedLogs[existingIdx][field] || 0) + perDay };
      } else {
        const newLog = createEmptyLog(dStr);
        newLog[field] = perDay; 
        updatedLogs.push(newLog);
      }
    }
    setSystemLogs(updatedLogs);
  };

  const addExpAndGold = (gainedExp, gainedGold) => {
    let newExp = playerStats.exp + gainedExp;
    let newLevel = playerStats.level;
    let newGold = playerStats.gold + gainedGold;
    let newAp = playerStats.ap || 0; 

    if (newExp >= (playerStats.level * 100)) {
      newLevel += 1;
      newExp -= (playerStats.level * 100);
      newAp += 3; 
      alert(`🔥 SYSTEM MESSAGE: LEVEL UP! Sei al Livello ${newLevel}!`);
    }
    setPlayerStats({ ...playerStats, level: newLevel, exp: newExp, gold: newGold, ap: newAp });
  };

  const handleStatUpgrade = (statName) => {
    if ((playerStats.ap || 0) > 0) {
      setPlayerStats({ ...playerStats, [statName]: (playerStats[statName] || 10) + 1, ap: playerStats.ap - 1 });
    }
  };

  // 👁️ ORACLE AI 
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setOracleImage(reader.result); 
      reader.readAsDataURL(file);
    }
  };

  const analyzeWithSystemEye = async (type) => {
    if (!oracleText && !oracleImage) return alert("Inserisci un testo o un'immagine da analizzare!");
    setIsAnalyzing(true);

    try {
      const messagesContent = [];
      let systemPrompt = "";

      if (type === 'food') {
        systemPrompt = "Sei il Sistema di Solo Leveling. Analizza il pasto (testo o immagine). Stima Kcal totali, Carboidrati, Proteine e Grassi in grammi. RISPONDI ESATTAMENTE E SOLO CON QUESTO JSON: {\"kcal\": numero, \"carbs\": numero, \"protein\": numero, \"fat\": numero}. Nessun altro testo.";
        if (oracleText) messagesContent.push({ type: "text", text: `Ho mangiato questo: ${oracleText}` });
      } else {
        systemPrompt = "Sei il Sistema di Solo Leveling. Analizza l'allenamento. Stima le Kcal bruciate e, se l'utente usa i pesi, calcola il Massimale (1RM) stimato. RISPONDI ESATTAMENTE E SOLO CON QUESTO JSON: {\"burned\": numero, \"strength\": numero}. Nessun altro testo.";
        if (oracleText) messagesContent.push({ type: "text", text: `Ho fatto questo allenamento: ${oracleText}` });
      }

      if (oracleImage) messagesContent.push({ type: "image_url", image_url: { url: oracleImage } });

      const data = await requestSystemAI({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: messagesContent }]
      });
      const result = parseModelJson(data, { schema: type === 'food' ? 'meal_analysis' : 'workout_analysis' });

      if (type === 'food') {
        const k = result.kcal || 0; const c = result.carbs || 0; const p = result.protein || 0; const f = result.fat || 0;
        setAiHistory(pushAiHistory({
          kind: 'meal_analysis',
          title: 'Analisi Pasto',
          prompt: oracleText || '[input immagine]',
          output: { kcal: k, carbs: c, protein: p, fat: f }
        }));
        saveToSystem({ 
          consumed: todayData.consumed + k, 
          carbs: (todayData.carbs || 0) + c, 
          protein: (todayData.protein || 0) + p, 
          fatMacros: (todayData.fatMacros || 0) + f 
        });
        incrementCombo('oracle-food');
        alert(`🍎 ANALISI COMPLETATA:\n+${k} Kcal\nCarbo: ${c}g | Proteine: ${p}g | Grassi: ${f}g`);
      } else {
        const b = result.burned || 0; const s = result.strength || 0;
        setAiHistory(pushAiHistory({
          kind: 'workout_analysis',
          title: 'Analisi Allenamento',
          prompt: oracleText || '[input immagine]',
          output: { burned: b, strength: s }
        }));
        let updates = { burned: todayData.burned + b };
        if (s > todayData.strength) updates.strength = s; 
        saveToSystem(updates);
        addExpAndGold(Math.floor(b / 10) + 20, Math.floor(b / 20) + 10); 
        incrementCombo('oracle-workout');
        alert(`⚔️ ALLENAMENTO REGISTRATO:\nBruciate: ${b} Kcal\nForza Stimata: ${s} Kg\nRicevi EXP e ORO!`);
      }

      setOracleText(''); setOracleImage(null);

    } catch (error) {
      console.error(error); alert("⚠️ IL SISTEMA È CONFUSO. Sii più chiaro o riprova.");
    } finally { setIsAnalyzing(false); }
  };

  const generateAnimeWorkout = async () => {
    if (!workoutPrompt.trim()) return alert("Scrivi il tuo obiettivo prima di evocare il workout.");
    setIsGeneratingWorkout(true);
    try {
      const data = await requestSystemAI({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Sei il Sistema di Solo Leveling. Crea un workout sicuro e progressivo in stile anime. Rispondi ESCLUSIVAMENTE in JSON valido con questo schema: {"title":"string","difficulty":"E|D|C|B|A|S","durationMin":numero,"focus":"string","warmup":["string"],"main":[{"name":"string","sets":numero,"reps":"string","restSec":numero,"cue":"string"}],"finisher":["string"],"notes":["string"]}. Nessun altro testo.'
          },
          { role: 'user', content: `Genera workout per: ${workoutPrompt}` }
        ]
      });
      const result = parseModelJson(data, { schema: 'workout_plan' });
      setAiWorkout(result);
      setAiHistory(pushAiHistory({
        kind: 'workout_plan',
        title: result.title || 'Shadow Protocol',
        prompt: workoutPrompt,
        output: result
      }));
      localStorage.setItem('shadow_monarch_ai_workout', JSON.stringify(result));
      incrementCombo('ai-workout');
      triggerCinematic("EVOCATION COMPLETE", `${result.title || 'Shadow Protocol'} • Rank ${result.difficulty || 'C'}`);
    } catch (error) {
      console.error(error);
      alert("⚠️ Evocazione fallita. Riformula obiettivo e riprova.");
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
  };
  const applyWorkoutPromptPreset = (presetText) => {
    setWorkoutPrompt(presetText);
  };

  const formatSeconds = (totalSeconds) => {
    const safeValue = Math.max(0, totalSeconds || 0);
    const mm = String(Math.floor(safeValue / 60)).padStart(2, '0');
    const ss = String(safeValue % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const startWorkoutSession = () => {
    if (!aiWorkout || !Array.isArray(aiWorkout.main) || aiWorkout.main.length === 0) {
      alert("Genera prima un workout valido.");
      return;
    }
    const initialProgress = {};
    aiWorkout.main.forEach((exercise, idx) => {
      const setsTarget = Math.max(parseInt(exercise.sets, 10) || 1, 1);
      initialProgress[idx] = { completedSets: 0, setsTarget, logs: [] };
    });
    setExerciseProgress(initialProgress);
    setExerciseInputs({});
    setActiveExerciseIndex(0);
    setRestRemaining(0);
    setWorkoutRemaining((parseInt(aiWorkout.durationMin, 10) || 40) * 60);
    setIsWorkoutRunning(true);
    triggerCinematic("WORKOUT START", `${aiWorkout.title || 'Shadow Protocol'} avviato`);
    incrementCombo('workout-start');
  };

  const finishWorkoutSession = () => {
    const currentWorkout = workoutSessionRef.current.aiWorkout;
    const currentProgress = workoutSessionRef.current.exerciseProgress;
    if (!currentWorkout || !Array.isArray(currentWorkout.main)) {
      setIsWorkoutRunning(false);
      return;
    }
    const summaryExercises = currentWorkout.main.map((exercise, idx) => {
      const progress = currentProgress[idx] || { completedSets: 0, setsTarget: parseInt(exercise.sets, 10) || 1, logs: [] };
      return {
        name: exercise.name || `Exercise ${idx + 1}`,
        completedSets: progress.completedSets,
        setsTarget: progress.setsTarget,
        logs: progress.logs
      };
    });

    const summary = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      title: currentWorkout.title || 'Shadow Protocol',
      rank: currentWorkout.difficulty || 'C',
      plannedMinutes: parseInt(currentWorkout.durationMin, 10) || 40,
      exercises: summaryExercises
    };

    setWorkoutHistory((prev) => [summary, ...prev].slice(0, 20));
    setIsWorkoutRunning(false);
    setRestRemaining(0);
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 60,
      gold: (prev.gold || 0) + 35,
      completedWorkouts: (prev.completedWorkouts || 0) + 1,
      lastWorkoutDate: today
    }));
    incrementCombo('workout-complete');
    triggerCinematic("WORKOUT CLEAR", "+60 EXP • +35 G");
  };

  const handleExerciseInput = (index, field, value) => {
    setExerciseInputs((prev) => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const logExerciseSet = (index) => {
    if (!isWorkoutRunning || !aiWorkout?.main?.[index]) return;
    const exercise = aiWorkout.main[index];
    const currentInput = exerciseInputs[index] || {};
    const repsDone = currentInput.repsDone || exercise.reps || '';
    const kg = currentInput.kg || '';
    const restSec = Math.max(parseInt(exercise.restSec, 10) || 60, 15);

    setExerciseProgress((prev) => {
      const existing = prev[index] || { completedSets: 0, setsTarget: Math.max(parseInt(exercise.sets, 10) || 1, 1), logs: [] };
      const nextCompleted = Math.min(existing.completedSets + 1, existing.setsTarget);
      const next = {
        ...prev,
        [index]: {
          ...existing,
          completedSets: nextCompleted,
          logs: [
            ...existing.logs,
            { time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), kg, repsDone }
          ]
        }
      };

      const isExerciseDone = nextCompleted >= existing.setsTarget;
      if (isExerciseDone) {
        const nextIndex = aiWorkout.main.findIndex((_, exIdx) => {
          const p = next[exIdx];
          return p && p.completedSets < p.setsTarget;
        });
        if (nextIndex >= 0) setActiveExerciseIndex(nextIndex);
      } else {
        setActiveExerciseIndex(index);
      }
      return next;
    });

    setRestRemaining(restSec);
    incrementCombo('workout-log-set');
  };

  const handleAddWater = (e) => {
    e.preventDefault();
    if (!waterInput) return;
    const waterValue = parseInt(waterInput, 10);
    if (Number.isNaN(waterValue) || waterValue <= 0) return;
    if (isWeekly) distributeWeeklyData('waterMl', waterValue);
    else saveToSystem({ waterMl: (todayData.waterMl || 0) + waterValue });
    setWaterInput('');
    incrementCombo('hydration');
  };

  const handleHydrationGoalUpdate = (e) => {
    e.preventDefault();
    const parsed = parseInt(hydrationGoalInput, 10);
    if (Number.isNaN(parsed) || parsed < 500) return;
    setHydrationGoal(parsed);
    setShowHydrationEditor(false);
  };

  const openAppleHealth = () => {
    window.location.href = "x-apple-health://";
    setPlayerStats((prev) => ({
      ...prev,
      healthSyncEnabled: true,
      healthSyncSource: 'iphone-health',
      healthLastAttempt: new Date().toISOString()
    }));
  };

  const quickHealthSync = () => {
    const mockSteps = Math.max(3000, Math.floor(todayData.burned * 28));
    const mockHr = Math.max(52, 68 - Math.floor((playerStats.level || 1) / 8));
    saveToSystem({ steps: mockSteps, hrRest: mockHr });
    setPlayerStats((prev) => ({
      ...prev,
      healthSyncEnabled: true,
      healthSyncSource: prev.healthSyncSource || 'manual',
      healthLastSync: new Date().toISOString()
    }));
    incrementCombo('health-sync');
    alert("SYNC COMPLETATA: passi e battito a riposo aggiornati.");
  };

  const parseOptionalNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleOkokSync = (e) => {
    e.preventDefault();
    const weight = parseOptionalNumber(scaleWeightInput);
    const fat = parseOptionalNumber(scaleFatInput);
    const bodyWater = parseOptionalNumber(scaleWaterInput);
    const muscleMass = parseOptionalNumber(scaleMuscleInput);
    const bmr = parseOptionalNumber(scaleBmrInput);
    const visceral = parseOptionalNumber(scaleVisceralInput);
    const metabolicAge = parseOptionalNumber(scaleAgeInput);

    if ([weight, fat, bodyWater, muscleMass, bmr, visceral, metabolicAge].every((value) => value === null)) {
      alert("Inserisci almeno un valore dalla bilancia OKOK.");
      return;
    }

    const updates = {};
    if (weight !== null) updates.weight = weight;
    if (fat !== null) updates.fat = fat;
    if (bodyWater !== null) updates.bodyWaterPct = bodyWater;
    if (muscleMass !== null) updates.muscleMassKg = muscleMass;
    if (bmr !== null) updates.bmrKcal = Math.round(bmr);
    if (visceral !== null) updates.visceralFat = visceral;
    if (metabolicAge !== null) updates.metabolicAge = metabolicAge;
    if (weight !== null && fat !== null) {
      const leanMass = weight - (weight * (fat / 100));
      updates.leanMass = parseFloat(leanMass.toFixed(1));
    }

    saveToSystem(updates);
    setPlayerStats((prev) => ({
      ...prev,
      healthSyncEnabled: true,
      healthSyncSource: 'okok',
      healthLastSync: new Date().toISOString()
    }));
    incrementCombo('okok-sync');
    triggerCinematic("OKOK SYNC COMPLETE", `Peso ${updates.weight || todayData.weight || '--'} kg • Dati aggiornati`);

    setScaleWeightInput('');
    setScaleFatInput('');
    setScaleWaterInput('');
    setScaleMuscleInput('');
    setScaleBmrInput('');
    setScaleVisceralInput('');
    setScaleAgeInput('');
  };

  const handleRecoveryCheckin = (e) => {
    e.preventDefault();
    const sleepHours = parseFloat(sleepInput);
    const energyLevel = parseInt(energyInput, 10);
    if (Number.isNaN(sleepHours) || sleepHours <= 0) {
      alert("Inserisci ore di sonno valide.");
      return;
    }
    const sleepScore = Math.min(100, Math.max(0, Math.round((sleepHours / 8) * 70)));
    const energyScore = Math.min(100, Math.max(0, energyLevel * 10));
    const recoveryScore = Math.round((sleepScore * 0.7) + (energyScore * 0.3));
    saveToSystem({
      sleepHours: parseFloat(sleepHours.toFixed(1)),
      energyLevel,
      recoveryScore
    });
    setPlayerStats((prev) => ({
      ...prev,
      recoveryStreak: recoveryScore >= 75 ? (prev.recoveryStreak || 0) + 1 : 0
    }));
    incrementCombo('recovery-checkin');
    triggerCinematic("RECOVERY SCAN", `Recovery score ${recoveryScore}/100`);
    setSleepInput('');
  };

  const runAutoTune = () => {
    const bmrFromScale = todayData.bmrKcal || 0;
    const weightFromScale = todayData.weight || 0;
    const tunedCalories = bmrFromScale > 0 ? Math.round(bmrFromScale * 1.45) : dailyGoal;
    const tunedHydration = weightFromScale > 0 ? Math.round(weightFromScale * 35) : hydrationGoal;
    if (bmrFromScale === 0 && weightFromScale === 0) {
      alert("Auto-Tune richiede almeno BMR o peso dalla smart scale.");
      return;
    }
    setDailyGoal(Math.max(1600, tunedCalories));
    setHydrationGoal(Math.max(1800, tunedHydration));
    incrementCombo('auto-tune');
    triggerCinematic("SYSTEM AUTO-TUNE", `Goal ${Math.max(1600, tunedCalories)} kcal • Acqua ${Math.max(1800, tunedHydration)} ml`);
  };

  const buyLoot = (type) => {
    const catalog = {
      shield: { cost: 180, reward: "Streak Shield +1" },
      surge: { cost: 140, reward: "EXP +90" },
      ration: { cost: 120, reward: "Proteine +25g" }
    };
    const item = catalog[type];
    if (!item) return;
    if ((playerStats.gold || 0) < item.cost) {
      alert("Oro insufficiente.");
      return;
    }

    if (type === 'shield') {
      setPlayerStats((prev) => ({
        ...prev,
        gold: (prev.gold || 0) - item.cost,
        streakShieldTokens: (prev.streakShieldTokens || 0) + 1
      }));
    } else if (type === 'surge') {
      setPlayerStats((prev) => ({
        ...prev,
        gold: (prev.gold || 0) - item.cost,
        exp: (prev.exp || 0) + 90
      }));
    } else if (type === 'ration') {
      setPlayerStats((prev) => ({
        ...prev,
        gold: (prev.gold || 0) - item.cost
      }));
      saveToSystem({ protein: (todayData.protein || 0) + 25 });
    }

    incrementCombo('loot-shop');
    triggerCinematic("LOOT FORGE", item.reward);
  };

  const triggerCinematic = (title, subtitle) => {
    setCinematicEvent({ title, subtitle });
    setIsCinematicVisible(true);
    if (cinematicTimeoutRef.current) clearTimeout(cinematicTimeoutRef.current);
    cinematicTimeoutRef.current = setTimeout(() => setIsCinematicVisible(false), 2400);
  };

  const incrementCombo = (actionType) => {
    const now = Date.now();
    const lastActionAt = playerStats.lastActionAt ? new Date(playerStats.lastActionAt).getTime() : null;
    const shouldReset = !lastActionAt || (now - lastActionAt) > (1000 * 60 * 90);
    const nextCombo = shouldReset ? 1 : Math.min((playerStats.comboChain || 0) + 1, 50);

    setPlayerStats((prev) => ({
      ...prev,
      comboChain: nextCombo,
      lastActionAt: new Date(now).toISOString(),
      lastActionType: actionType
    }));

    if (nextCombo > 0 && nextCombo % 5 === 0) {
      triggerCinematic("CHAIN ASCESA", `Combo x${nextCombo} • ritmo perfetto`);
    }
  };

  const unleashShadowBurst = () => {
    saveToSystem({ burned: (todayData.burned || 0) + 250 });
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 45,
      gold: (prev.gold || 0) + 40
    }));
    incrementCombo('shadow-burst');
    triggerCinematic("SHADOW BURST", "Kcal bruciate +250 • EXP +45 • Gold +40");
  };

  const togglePrecisionMode = () => {
    setPlayerStats((prev) => ({
      ...prev,
      precisionMode: !prev.precisionMode
    }));
  };

  const claimPrecisionReward = () => {
    if (playerStats.lastPrecisionRewardDate === today) {
      alert("Reward giornaliero già riscattato.");
      return;
    }
    const hydrationMission = currentHydration >= hydrationGoal;
    const proteinMission = (todayData.protein || 0) >= Math.round(dynamicProteinGoal * 0.9);
    const movementMission = (todayData.steps || 0) >= 8000 || (todayData.burned || 0) >= 350;
    if (!(hydrationMission && proteinMission && movementMission)) {
      alert("Completa tutte le missioni Precisione Assoluta prima del claim.");
      return;
    }

    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 80,
      gold: (prev.gold || 0) + 120,
      keys: (prev.keys || 0) + 1,
      lastPrecisionRewardDate: today
    }));
    alert("⚡ PRECISIONE ASSOLUTA: +80 EXP, +120 G, +1 KEY");
  };

  const handleDailyOath = () => {
    if (playerStats.lastOathDate === today) {
      alert("Hai già fatto il giuramento oggi.");
      return;
    }
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + 20,
      gold: (prev.gold || 0) + 15,
      lastOathDate: today
    }));
    incrementCombo('daily-oath');
    triggerCinematic("GIURAMENTO ATTIVO", "Costanza assoluta attivata per oggi");
  };

  const generateMicroQuest = () => {
    const pool = [
      {
        type: 'water',
        target: (todayData.waterMl || 0) + 400,
        description: `Raggiungi ${Math.round((todayData.waterMl || 0) + 400)} ml acqua`,
        reward: { exp: 25, gold: 20 }
      },
      {
        type: 'burned',
        target: (todayData.burned || 0) + 180,
        description: `Brucia altre 180 kcal`,
        reward: { exp: 30, gold: 20 }
      },
      {
        type: 'protein',
        target: (todayData.protein || 0) + 30,
        description: `Aggiungi 30g proteine`,
        reward: { exp: 25, gold: 25 }
      },
      {
        type: 'steps',
        target: Math.max((todayData.steps || 0) + 2000, 6000),
        description: `Porta i passi a ${Math.max((todayData.steps || 0) + 2000, 6000)}`,
        reward: { exp: 30, gold: 25 }
      }
    ];
    const quest = pool[Math.floor(Math.random() * pool.length)];
    setMicroQuest({
      ...quest,
      createdAt: new Date().toISOString(),
      createdDate: today,
      claimed: false
    });
  };

  const getQuestProgress = () => {
    if (!microQuest || microQuest.createdDate !== today) return { value: 0, done: false };
    const sourceValue =
      microQuest.type === 'water' ? (todayData.waterMl || 0) :
      microQuest.type === 'burned' ? (todayData.burned || 0) :
      microQuest.type === 'protein' ? (todayData.protein || 0) :
      (todayData.steps || 0);
    return { value: sourceValue, done: sourceValue >= microQuest.target };
  };

  const claimMicroQuestReward = () => {
    if (!microQuest) return;
    if (microQuest.claimed) {
      alert("Reward micro-quest già riscattato.");
      return;
    }
    const progress = getQuestProgress();
    if (!progress.done) {
      alert("Micro-quest non ancora completata.");
      return;
    }
    setPlayerStats((prev) => ({
      ...prev,
      exp: (prev.exp || 0) + (microQuest.reward?.exp || 20),
      gold: (prev.gold || 0) + (microQuest.reward?.gold || 15)
    }));
    setMicroQuest((prev) => ({ ...prev, claimed: true }));
    incrementCombo('micro-quest');
    triggerCinematic("QUEST CLEAR", `+${microQuest.reward?.exp || 20} EXP • +${microQuest.reward?.gold || 15} G`);
  };

  const handleOpenChest = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    let spinCount = 0;
    const spinInterval = setInterval(() => {
      setChestReward(Math.floor(Math.random() * 999));
      spinCount++;
      if (spinCount > 20) {
        clearInterval(spinInterval);
        const dropRates = Math.random();
        let finalGold = 50; 
        if (dropRates > 0.6) finalGold = 100; 
        if (dropRates > 0.85) finalGold = 250; 
        if (dropRates > 0.95) finalGold = 500; 
        setChestReward(finalGold);
        setTimeout(() => {
          setIsSpinning(false);
          setPlayerStats({ ...playerStats, gold: (playerStats.gold || 0) + finalGold, lastChestDate: today });
          incrementCombo('chest');
          if (finalGold >= 250) triggerCinematic("LEGENDARY DROP", `Ricompensa ${finalGold} G`);
          alert(`🎁 REWARD DEL MONARCA: Hai trovato +${finalGold} G!`);
        }, 800);
      }
    }, 50); 
  };

  const handleGoalUpdate = (e) => {
    e.preventDefault();
    if (newGoalInput && !isNaN(newGoalInput)) { setDailyGoal(parseInt(newGoalInput)); setIsEditingGoal(false); }
  };

  const handleEat = (e) => {
    e.preventDefault();
    if (eatInput) { 
      if (isWeekly) distributeWeeklyData('consumed', parseInt(eatInput)); 
      else saveToSystem({ consumed: todayData.consumed + parseInt(eatInput) });
      setEatInput(''); 
      incrementCombo('consume');
    }
  };

  const handleHunt = (e) => {
    e.preventDefault();
    if (burnInput) { 
      if (isWeekly) distributeWeeklyData('burned', parseInt(burnInput)); 
      else saveToSystem({ burned: todayData.burned + parseInt(burnInput) });
      setBurnInput(''); addExpAndGold(30, 10);
      incrementCombo('hunt');
    }
  };

  const handleStrengthUpload = (e) => {
    e.preventDefault();
    if (liftWeight && liftReps) {
      const oneRepMax = parseFloat(liftWeight) * (1 + (parseInt(liftReps) / 30));
      saveToSystem({ strength: parseFloat(oneRepMax.toFixed(1)) });
      setLiftWeight(''); setLiftReps(''); addExpAndGold(50, 20);
      incrementCombo('strength');
    }
  };

  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = {
      logs: systemLogs,
      goal: dailyGoal,
      hydrationGoal,
      stats: playerStats,
      aiWorkout
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `shadow_monarch_backup.json`; a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.logs) setSystemLogs(data.logs);
        if (data.goal) setDailyGoal(data.goal);
        if (data.hydrationGoal) setHydrationGoal(data.hydrationGoal);
        if (data.stats) setPlayerStats(data.stats);
        if (data.aiWorkout) {
          setAiWorkout(data.aiWorkout);
          localStorage.setItem('shadow_monarch_ai_workout', JSON.stringify(data.aiWorkout));
        }
        alert("🔮 SYSTEM MESSAGE: Cristallo di Memoria assorbito! Dati ripristinati con successo.");
      } catch (err) { alert("⚠️ SYSTEM ERROR: Il Cristallo di Memoria è corrotto o non valido."); }
    };
    reader.readAsText(file);
  };
  const expNeeded = playerStats.level * 100;
  const expPercentage = Math.min((playerStats.exp / expNeeded) * 100, 100);
  const periodDays = isWeekly ? 7 : 1;
  const baseKcal = dailyGoal * periodDays; 
  const targetKcal = baseKcal + todayData.burned;
  const remainingKcal = targetKcal - todayData.consumed;
  const goalReached = todayData.consumed >= baseKcal; 
  const hasOpenedChest = playerStats.lastChestDate === today;
  const avatarStage = Math.min(Math.floor(((playerStats.level || 1) - 1) / 5) + 1, 8);
  const avatarImagePath = `/avatar${avatarStage}.png`;
  const currentHydration = todayData.waterMl || 0;
  const hydrationProgress = Math.min((currentHydration / hydrationGoal) * 100, 100);
  const hydrationLeft = Math.max(hydrationGoal - currentHydration, 0);
  const bodyWaterValue = todayData.bodyWaterPct || 0;
  const muscleMassValue = todayData.muscleMassKg || 0;
  const bmrValue = todayData.bmrKcal || 0;
  const visceralFatValue = todayData.visceralFat || 0;
  const metabolicAgeValue = todayData.metabolicAge || 0;
  const sleepHoursValue = todayData.sleepHours || 0;
  const recoveryScoreValue = todayData.recoveryScore || 0;
  const energyLevelValue = todayData.energyLevel || 0;
  const hasHealthSync = Boolean(playerStats.healthSyncEnabled);
  const healthSyncDateLabel = playerStats.healthLastSync
    ? new Date(playerStats.healthLastSync).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'mai';
// Calcolo del moltiplicatore dinamico (Calorie Target / Calorie Base)
  // Se non hai bruciato nulla, il moltiplicatore è 1. Se hai bruciato kcal, sarà maggiore di 1.
  const macroMultiplier = targetKcal / baseKcal;

  // Nuovi target dinamici arrotondati
  const dynamicCarbsGoal = Math.round(macroGoals.carbs * macroMultiplier);
  const dynamicProteinGoal = Math.round(macroGoals.protein * macroMultiplier);
  const dynamicFatsGoal = Math.round(macroGoals.fats * macroMultiplier);

  // Calcolo dei macro rimanenti basati sui nuovi target
  const remainingCarbs = dynamicCarbsGoal - (todayData.carbs || 0);
  const remainingProtein = dynamicProteinGoal - (todayData.protein || 0);
  const remainingFat = dynamicFatsGoal - (todayData.fatMacros || 0);
  const precisionMissions = [
    { id: 'hydration', label: 'Hydration', target: `${hydrationGoal}ml`, completed: currentHydration >= hydrationGoal },
    { id: 'protein', label: 'Protein', target: `${Math.round(dynamicProteinGoal * 0.9)}g`, completed: (todayData.protein || 0) >= Math.round(dynamicProteinGoal * 0.9) },
    { id: 'movement', label: 'Movement', target: '8000 steps o 350 kcal', completed: (todayData.steps || 0) >= 8000 || (todayData.burned || 0) >= 350 }
  ];
  const completedMissions = precisionMissions.filter((mission) => mission.completed).length;
  const allMissionsComplete = completedMissions === precisionMissions.length;
  const precisionRewardClaimed = playerStats.lastPrecisionRewardDate === today;
  const nutritionBalance = Math.max(0, 100 - Math.abs(remainingKcal / (baseKcal || 1)) * 100);
  const readinessScore = Math.min(
    100,
    Math.round(
      hydrationProgress * 0.35 +
      nutritionBalance * 0.3 +
      Math.min((todayData.burned || 0) / 4, 100) * 0.2 +
      Math.min((playerStats.streak || 0) * 6, 100) * 0.15
    )
  );
  const readinessRank = readinessScore >= 90 ? 'S' : readinessScore >= 75 ? 'A' : readinessScore >= 60 ? 'B' : readinessScore >= 45 ? 'C' : 'D';
  const hunterTitle =
    readinessRank === 'S' ? 'Monarca dell’Eclissi' :
    (playerStats.level || 1) >= 20 ? 'Comandante dell’Ombra' :
    (playerStats.streak || 0) >= 14 ? 'Predatore Inarrestabile' :
    'S-Rank Hunter';
  const comboChain = playerStats.comboChain || 0;
  const comboAura = comboChain >= 20 ? 'text-red-400' : comboChain >= 10 ? 'text-amber-300' : 'text-system-blue';
  const focusSessions = playerStats.focusSessions || 0;
  const focusFormatted = `${String(Math.floor(focusRemaining / 60)).padStart(2, '0')}:${String(focusRemaining % 60).padStart(2, '0')}`;
  const prophecyPool = [
    "Il varco si apre quando chiudi i macro entro il tramonto.",
    "Il boss cede se mantieni hydration e movimento insieme.",
    "Un rank superiore nasce da piccole azioni ripetute.",
    "Ogni combo lunga trasforma la disciplina in potere.",
    "La precisione di oggi è il livello di domani."
  ];
  const prophecyIndex = ((new Date().getDate() + readinessScore + (playerStats.streak || 0)) % prophecyPool.length);
  const dailyProphecy = prophecyPool[prophecyIndex];
  const questProgress = getQuestProgress();
  const isQuestToday = Boolean(microQuest && microQuest.createdDate === today);
  const questProgressPct = microQuest ? Math.min((questProgress.value / (microQuest.target || 1)) * 100, 100) : 0;
  const recentLogs = [...systemLogs].slice(-7);
  const consistencyDays = recentLogs.filter((log) => (log.burned || 0) >= 250 && (log.waterMl || 0) >= 1800).length;
  const momentumPct = recentLogs.length ? Math.round((consistencyDays / recentLogs.length) * 100) : 0;
  const shieldTokens = playerStats.streakShieldTokens || 0;
  const workoutExercises = Array.isArray(aiWorkout?.main) ? aiWorkout.main : [];
  const totalTargetSets = workoutExercises.reduce((sum, ex) => sum + Math.max(parseInt(ex.sets, 10) || 1, 1), 0);
  const totalLoggedSets = Object.values(exerciseProgress).reduce((sum, ex) => sum + (ex.completedSets || 0), 0);
  const workoutCompletionPct = totalTargetSets > 0 ? Math.min(Math.round((totalLoggedSets / totalTargetSets) * 100), 100) : 0;
  const latestWorkouts = workoutHistory.slice(0, 2);

  useEffect(() => {
    if (readinessRank === 'S' && playerStats.lastSRankCinematicDate !== today) {
      triggerCinematic("BOSS PRESENCE DETECTED", "Rank S raggiunto • dominio totale");
      setPlayerStats((prev) => ({ ...prev, lastSRankCinematicDate: today }));
    }
  }, [readinessRank, playerStats.lastSRankCinematicDate, today]);
  
  return (
    <div className="p-6 pt-10 pb-24 h-full overflow-y-auto relative bg-void-black">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-16 h-48 w-48 rounded-full bg-system-blue/10 blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -left-16 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"></div>
      </div>

      {isCinematicVisible && cinematicEvent && (
        <motion.div
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/70"></div>
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-red-500/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-system-blue/20 to-transparent"></div>
          <div className="relative border border-red-500/70 bg-black/90 px-6 py-5 text-center shadow-[0_0_35px_rgba(239,68,68,0.4)]">
            <p className="text-[10px] uppercase tracking-[0.35em] text-red-300 mb-2">Cinematic Event</p>
            <h3 className="text-2xl font-black italic text-white tracking-tight">{cinematicEvent.title}</h3>
            <p className="text-[11px] uppercase tracking-widest text-gray-300 mt-2">{cinematicEvent.subtitle}</p>
          </div>
        </motion.div>
      )}
      
      {/* HEADER AVATAR E STATS */}
      <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-20 h-20 rounded-full border-2 border-system-blue/50 bg-black/80 flex items-center justify-center overflow-hidden relative shadow-[0_0_15px_rgba(0,242,255,0.3)] shrink-0">
          <div className="absolute inset-0 bg-gradient-to-t from-system-blue/30 to-transparent opacity-50"></div>
          <img src={avatarImagePath} alt="Avatar" className="w-full h-full object-cover z-10" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150/111111/00f2ff?text=LVL+" + playerStats.level; }} />
        </motion.div>
        
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-black italic tracking-tighter text-white leading-none">LEVEL {playerStats.level}</h1>
                <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-widest rounded-sm border ${playerStats.streak > 0 ? 'bg-orange-500/10 border-orange-500 text-orange-500' : 'bg-gray-800/30 border-gray-700 text-gray-500'}`}>
                  <span className={playerStats.streak > 0 ? "animate-pulse" : "opacity-50"}>🔥</span><span>{playerStats.streak || 0} STRK</span>
                </div>
              </div>
              <p className="text-cursed-purple text-[10px] font-black italic mt-1 tracking-widest uppercase">{hunterTitle}</p>
            </div>
            
            <div className="text-right flex flex-col items-end gap-1">
              <p className="text-yellow-400 text-xs font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span> {playerStats.gold} G</p>
              <p className="text-purple-400 text-xs font-bold">{playerStats.keys || 0} 🗝️</p>
              {/* TASTI WIP E WEEKLY */}
              <div className="flex gap-2 mt-1">
                <button onClick={() => setIsWeekly(!isWeekly)} className="text-[8px] border border-cursed-purple text-cursed-purple px-2 py-1 uppercase tracking-widest hover:bg-cursed-purple hover:text-white transition-colors">
                  {isWeekly ? 'WEEKLY' : 'DAILY'}
                </button>
                <button onClick={() => { if(window.confirm("Formattare il Sistema?")) { localStorage.clear(); window.location.reload(); } }} className="text-[8px] border border-boss-red text-boss-red px-2 py-1 uppercase tracking-widest hover:bg-boss-red hover:text-white transition-colors">
                  Wipe
                </button>
              </div>
            </div>
          </div>
          <div className="w-full bg-white/10 h-1.5 mt-2 overflow-hidden rounded-full">
            <motion.div initial={{ width: 0 }} animate={{ width: `${expPercentage}%` }} className="bg-system-blue h-full shadow-[0_0_10px_#00f2ff]"></motion.div>
          </div>
          <p className="text-[8px] text-system-blue font-bold tracking-widest mt-1 uppercase">EXP: {Math.floor(playerStats.exp)} / {expNeeded}</p>
          <p className={`text-[9px] font-bold tracking-[0.22em] mt-1 uppercase ${comboAura}`}>Combo Chain x{comboChain}</p>
        </div>
      </div>

      {/* 👁️ L'OCCHIO DEL SISTEMA */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/60 border-2 border-purple-500/50 p-5 rounded-sm mb-6 relative overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.2)]">
        <h2 className="text-purple-400 text-sm font-black italic system-font flex items-center gap-2 uppercase mb-4 tracking-widest"><span className="text-xl animate-pulse">👁️</span> SYSTEM ORACLE</h2>
        <p className="text-[10px] text-gray-400 uppercase mb-3">Descrivi o fotografa cibo/allenamento.</p>
        <textarea value={oracleText} onChange={(e) => setOracleText(e.target.value)} placeholder="Es: Piatto di pasta, oppure Panca piana 3x10 con 60kg..." className="w-full bg-void-black border border-purple-900 text-white text-xs p-3 focus:outline-none focus:border-purple-500 resize-none h-20 mb-3 rounded-sm" />
        <div className="flex items-center gap-3 mb-4">
          <input type="file" accept="image/*" ref={oracleImageRef} onChange={handleImageUpload} className="hidden" />
          <button onClick={() => oracleImageRef.current.click()} className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-purple-500 text-purple-400 hover:bg-purple-900/50 transition-all flex items-center gap-2">📸 FOTO</button>
          {oracleImage && <span className="text-[10px] text-emerald-500 font-bold uppercase animate-pulse">✓ Acquisita</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => analyzeWithSystemEye('food')} disabled={isAnalyzing} className={`flex-1 text-[11px] font-black uppercase tracking-widest p-3 transition-all ${isAnalyzing ? 'bg-gray-800 text-gray-500' : 'bg-system-blue/20 border border-system-blue text-system-blue hover:bg-system-blue hover:text-black'}`}>{isAnalyzing ? 'ANALISI...' : 'ANALIZZA PASTO 🍎'}</button>
          <button onClick={() => analyzeWithSystemEye('workout')} disabled={isAnalyzing} className={`flex-1 text-[11px] font-black uppercase tracking-widest p-3 transition-all ${isAnalyzing ? 'bg-gray-800 text-gray-500' : 'bg-boss-red/20 border border-boss-red text-boss-red hover:bg-boss-red hover:text-white'}`}>{isAnalyzing ? 'ANALISI...' : 'ANALIZZA ALLENAMENTO ⚔️'}</button>
        </div>
      </motion.div>

      {/* MANA CARD & ROULETTE CON MACROS */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/40 border border-system-blue/30 p-5 rounded-sm mb-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-system-blue text-xs font-bold system-font flex items-center gap-2 uppercase"><span className="w-2 h-2 bg-system-blue animate-pulse"></span> {isWeekly ? 'WEEKLY MANA' : 'DAILY MANA'}</h2>
          <button onClick={() => setIsEditingGoal(!isEditingGoal)} className="text-[10px] text-gray-400 hover:text-white uppercase tracking-widest underline decoration-system-blue/50 decoration-2 underline-offset-4">
            {isEditingGoal ? 'Cancel' : 'Edit Base'}
          </button>
        </div>

        {isEditingGoal && (
          <form onSubmit={handleGoalUpdate} className="flex gap-2 mb-4 bg-system-blue/10 p-2 border border-system-blue/30 rounded-sm">
            <input type="number" value={newGoalInput} onChange={(e) => setNewGoalInput(e.target.value)} className="bg-void-black text-white text-xs p-2 w-full focus:outline-none focus:border-system-blue" placeholder="New Daily Kcal..." />
            <button type="submit" className="bg-system-blue text-black px-3 py-1 font-bold text-xs uppercase hover:bg-white transition-colors">Save</button>
          </form>
        )}

        <div className="flex justify-between items-end mb-4">
          <div><p className={`text-4xl font-black ${remainingKcal < 0 ? 'text-boss-red' : 'text-white'}`}>{remainingKcal}</p><p className="text-[10px] text-gray-500 mt-1 uppercase">Mana Left (Base: {baseKcal})</p></div>
          <div className="text-right"><p className="text-system-blue text-xl font-bold">+ {todayData.burned}</p><p className="text-[10px] text-gray-500 uppercase italic">From Hunt</p></div>
        </div>

        {/* I TUOI MACRONUTRIENTI A SCALARE (DINAMICI) */}
        <div className="flex justify-between text-[10px] font-bold mt-4 mb-4 pt-4 pb-2 border-t border-system-blue/20 tracking-widest">
          <div className={`text-center w-1/3 border-r border-white/5 ${remainingCarbs < 0 ? 'text-boss-red animate-pulse' : 'text-yellow-500'}`}>
            CARBO<br/>
            <span className="text-sm">{remainingCarbs}g</span>
            <p className="text-[8px] text-gray-500 uppercase mt-0.5">di {dynamicCarbsGoal}g</p>
          </div>
          <div className={`text-center w-1/3 border-r border-white/5 ${remainingProtein < 0 ? 'text-boss-red animate-pulse' : 'text-boss-red'}`}>
            PRO<br/>
            <span className="text-sm">{remainingProtein}g</span>
            <p className="text-[8px] text-gray-500 uppercase mt-0.5">di {dynamicProteinGoal}g</p>
          </div>
          <div className={`text-center w-1/3 ${remainingFat < 0 ? 'text-boss-red animate-pulse' : 'text-emerald-500'}`}>
            GRASSI<br/>
            <span className="text-sm">{remainingFat}g</span>
            <p className="text-[8px] text-gray-500 uppercase mt-0.5">di {dynamicFatsGoal}g</p>
          </div>
        </div>

        {/* INSERIMENTI MANUALI */}
        <form onSubmit={handleEat} className="flex gap-2 mb-3">
          <input type="number" value={eatInput} onChange={(e) => setEatInput(e.target.value)} placeholder={isWeekly ? "Add 7 Days Kcal..." : "Add Daily Kcal..."} className="bg-black/50 border border-white/10 text-white text-sm p-2 w-full focus:outline-none focus:border-system-blue" />
          <button type="submit" className="bg-system-blue/10 border border-system-blue text-system-blue px-3 text-xs font-bold uppercase hover:bg-system-blue hover:text-black transition-colors">Absorb</button>
        </form>
        <form onSubmit={handleHunt} className="flex gap-2">
          <input type="number" value={burnInput} onChange={(e) => setBurnInput(e.target.value)} placeholder={isWeekly ? "7 Days burned..." : "Kcal burned..."} className="bg-black/50 border border-white/10 text-white text-sm p-2 w-full focus:outline-none focus:border-system-blue" />
          <button type="submit" className="bg-system-blue/10 border border-system-blue text-system-blue px-3 text-xs font-bold uppercase hover:bg-system-blue hover:text-black transition-colors">Hunt</button>
        </form>

        {/* ROULETTE */}
        {goalReached && !hasOpenedChest && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 mb-2 p-4 border border-yellow-500 bg-gradient-to-t from-yellow-500/20 to-black flex flex-col items-center justify-center rounded-sm relative overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.3)]">
            <p className="text-yellow-500 text-[10px] font-bold tracking-[0.3em] uppercase mb-3 animate-pulse">Mana Goal Raggiunto</p>
            <button onClick={handleOpenChest} disabled={isSpinning} className={`w-full text-black font-black italic text-xl py-3 uppercase tracking-widest transition-all shadow-[0_0_15px_#eab308] border border-yellow-400 ${isSpinning ? 'bg-white scale-105' : 'bg-yellow-500 hover:bg-yellow-400 hover:scale-[1.02] active:scale-[0.98]'}`}>
              {isSpinning ? <span className="flex items-center justify-center gap-2"><span className="animate-spin text-2xl">🌀</span> {chestReward} G</span> : 'APRI FORZIERE 🎁'}
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* HYDRATION CORE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-black/40 border border-cyan-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-cyan-300 text-xs font-bold system-font flex items-center gap-2 uppercase">
            <span className="w-2 h-2 bg-cyan-300 animate-pulse"></span>
            HYDRATION CORE
          </h2>
          <button onClick={() => setShowHydrationEditor(!showHydrationEditor)} className="text-[10px] text-cyan-200/80 uppercase tracking-widest underline decoration-cyan-300/50 decoration-2 underline-offset-4">
            {showHydrationEditor ? 'Cancel' : 'Edit Goal'}
          </button>
        </div>

        {showHydrationEditor && (
          <form onSubmit={handleHydrationGoalUpdate} className="flex gap-2 mb-4 bg-cyan-400/10 p-2 border border-cyan-300/40 rounded-sm">
            <input type="number" value={hydrationGoalInput} onChange={(e) => setHydrationGoalInput(e.target.value)} className="bg-void-black text-white text-xs p-2 w-full focus:outline-none focus:border-cyan-300 border border-transparent" placeholder="Goal ml/day..." />
            <button type="submit" className="bg-cyan-300 text-black px-3 py-1 font-bold text-xs uppercase">Save</button>
          </form>
        )}

        <div className="flex justify-between items-end">
          <div>
            <p className="text-4xl font-black text-white">{currentHydration}</p>
            <p className="text-[10px] text-gray-500 mt-1 uppercase">ml assunti oggi</p>
          </div>
          <div className="text-right">
            <p className="text-cyan-300 text-xl font-bold">{hydrationLeft} ml</p>
            <p className="text-[10px] text-gray-500 uppercase">target {hydrationGoal} ml</p>
          </div>
        </div>
        <div className="w-full bg-cyan-100/10 h-2 mt-3 overflow-hidden rounded-full border border-cyan-300/20">
          <motion.div initial={{ width: 0 }} animate={{ width: `${hydrationProgress}%` }} className="bg-cyan-300 h-full shadow-[0_0_10px_rgba(103,232,249,0.9)]"></motion.div>
        </div>
        <form onSubmit={handleAddWater} className="flex gap-2 mt-4">
          <input type="number" value={waterInput} onChange={(e) => setWaterInput(e.target.value)} placeholder={isWeekly ? "Acqua 7 giorni (ml)..." : "Aggiungi acqua (ml)..."} className="bg-black/50 border border-white/10 text-white text-sm p-2 w-full focus:outline-none focus:border-cyan-300" />
          <button type="submit" className="bg-cyan-400/10 border border-cyan-300 text-cyan-300 px-3 text-xs font-bold uppercase hover:bg-cyan-300 hover:text-black transition-colors">Drink</button>
        </form>
      </motion.div>

      {/* PRECISIONE ASSOLUTA */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.085 }} className="bg-black/50 border border-amber-400/40 p-5 rounded-sm mb-6 relative overflow-hidden shadow-[0_0_18px_rgba(251,191,36,0.13)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-amber-300 text-xs font-bold system-font flex items-center gap-2 uppercase">
            <span className="w-2 h-2 bg-amber-300 animate-pulse"></span>
            PRECISIONE ASSOLUTA
          </h2>
          <button onClick={togglePrecisionMode} className={`text-[10px] border px-2 py-1 uppercase tracking-widest transition-colors ${playerStats.precisionMode ? 'border-amber-300 text-amber-300 bg-amber-300/10' : 'border-gray-600 text-gray-400 hover:border-amber-300 hover:text-amber-300'}`}>
            {playerStats.precisionMode ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-4xl leading-none font-black text-white">{readinessScore}</p>
            <p className="text-[10px] text-gray-500 uppercase mt-1">Readiness Score</p>
          </div>
          <div className="text-right">
            <p className="text-amber-300 text-2xl font-black">RANK {readinessRank}</p>
            <p className="text-[10px] text-gray-500 uppercase">Missioni {completedMissions}/3</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {precisionMissions.map((mission) => (
            <div key={mission.id} className={`flex items-center justify-between px-2 py-1 border text-[10px] uppercase tracking-widest ${mission.completed ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-gray-400 bg-white/5'}`}>
              <span>{mission.label}</span>
              <span>{mission.completed ? 'CLEAR' : mission.target}</span>
            </div>
          ))}
        </div>

        <button onClick={claimPrecisionReward} disabled={!allMissionsComplete || precisionRewardClaimed} className={`w-full text-[11px] font-black uppercase tracking-widest p-3 transition-all ${(!allMissionsComplete || precisionRewardClaimed) ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-amber-400/20 border border-amber-300 text-amber-300 hover:bg-amber-300 hover:text-black'}`}>
          {precisionRewardClaimed ? 'REWARD GIÀ RISCATTATO' : 'RISCATTA REWARD GIORNALIERO'}
        </button>
      </motion.div>

      {/* ORACOLO GIORNALIERO + SHADOW BURST */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.088 }} className="bg-black/50 border border-indigo-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-indigo-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-indigo-300 animate-pulse"></span>
          DAILY PROPHECY
        </h2>
        <p className="text-[11px] text-indigo-100 italic leading-relaxed mb-4">“{dailyProphecy}”</p>
        <div className="flex gap-2">
          <button onClick={() => triggerCinematic("RED GATE OPEN", "Scenario boss attivato: mantieni combo e precisione")} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-red-500 text-red-300 hover:bg-red-500 hover:text-white transition-all">
            Apri Gate
          </button>
          <button onClick={unleashShadowBurst} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-indigo-400 text-indigo-300 hover:bg-indigo-400 hover:text-black transition-all">
            Shadow Burst
          </button>
        </div>
      </motion.div>

      {/* HABIT ENGINE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.089 }} className="bg-black/50 border border-system-blue/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-system-blue text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-system-blue animate-pulse"></span>
          HABIT ENGINE
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{playerStats.streak || 0}</p>
            <p className="text-[8px] text-gray-500 uppercase">Streak</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{focusSessions}</p>
            <p className="text-[8px] text-gray-500 uppercase">Focus</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-emerald-300 font-black text-base">{momentumPct}%</p>
            <p className="text-[8px] text-gray-500 uppercase">Momentum</p>
          </div>
        </div>
        <button onClick={handleDailyOath} className={`w-full text-[10px] font-bold uppercase tracking-widest px-3 py-2 border transition-all ${playerStats.lastOathDate === today ? 'border-gray-700 text-gray-500 bg-gray-900/60' : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black'}`}>
          {playerStats.lastOathDate === today ? 'Giuramento già fatto oggi' : 'Fai giuramento giornaliero (+EXP)'}
        </button>
        <div className="w-full bg-white/10 h-2 mt-3 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${momentumPct}%` }} className="h-full bg-system-blue shadow-[0_0_10px_#00f2ff]"></motion.div>
        </div>
      </motion.div>

      {/* RECOVERY CHECK-IN */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="bg-black/50 border border-lime-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-lime-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-lime-300 animate-pulse"></span>
          RECOVERY CHECK-IN
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{sleepHoursValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Sleep h</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-lime-300 font-black text-base">{recoveryScoreValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Recovery</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-yellow-300 font-black text-base">{energyLevelValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Energy</p>
          </div>
        </div>
        <form onSubmit={handleRecoveryCheckin} className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" value={sleepInput} onChange={(e) => setSleepInput(e.target.value)} placeholder="Ore sonno..." className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-lime-300" />
          <select value={energyInput} onChange={(e) => setEnergyInput(e.target.value)} className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-lime-300">
            <option value={4}>Energy 4/10</option>
            <option value={5}>Energy 5/10</option>
            <option value={6}>Energy 6/10</option>
            <option value={7}>Energy 7/10</option>
            <option value={8}>Energy 8/10</option>
            <option value={9}>Energy 9/10</option>
            <option value={10}>Energy 10/10</option>
          </select>
          <button type="submit" className="col-span-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-lime-400 text-lime-300 hover:bg-lime-400 hover:text-black transition-all">
            Salva Recovery
          </button>
        </form>
      </motion.div>

      {/* AUTO-TUNE ENGINE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.091 }} className="bg-black/50 border border-cyan-300/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-cyan-200 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-cyan-200 animate-pulse"></span>
          AUTO-TUNE GOALS
        </h2>
        <p className="text-[10px] text-gray-400 uppercase mb-3">Ricalibra calorie e acqua usando smart-scale (BMR/Peso).</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/5 border border-white/10 p-2 text-center">
            <p className="text-white font-black text-base">{dailyGoal}</p>
            <p className="text-[8px] text-gray-500 uppercase">Goal kcal</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 text-center">
            <p className="text-cyan-200 font-black text-base">{hydrationGoal}</p>
            <p className="text-[8px] text-gray-500 uppercase">Goal acqua ml</p>
          </div>
        </div>
        <button onClick={runAutoTune} className="w-full text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-cyan-300 text-cyan-200 hover:bg-cyan-300 hover:text-black transition-all">
          Esegui Auto-Tune
        </button>
      </motion.div>

      {/* LOOT FORGE SHOP */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.092 }} className="bg-black/50 border border-amber-300/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-amber-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-amber-300 animate-pulse"></span>
          LOOT FORGE SHOP
        </h2>
        <p className="text-[10px] text-gray-400 uppercase mb-3">Token Shield: {shieldTokens} • Oro: {playerStats.gold || 0} G</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => buyLoot('shield')} className="text-[9px] font-bold uppercase tracking-widest px-2 py-2 border border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black transition-all">
            Shield
            <br />
            180G
          </button>
          <button onClick={() => buyLoot('surge')} className="text-[9px] font-bold uppercase tracking-widest px-2 py-2 border border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black transition-all">
            EXP Surge
            <br />
            140G
          </button>
          <button onClick={() => buyLoot('ration')} className="text-[9px] font-bold uppercase tracking-widest px-2 py-2 border border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black transition-all">
            Protein
            <br />
            120G
          </button>
        </div>
      </motion.div>

      {/* FOCUS TIMER */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.091 }} className="bg-black/50 border border-violet-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-violet-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-violet-300 animate-pulse"></span>
          FOCUS MODE
        </h2>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-4xl font-black text-white">{focusFormatted}</p>
            <p className="text-[10px] text-gray-500 uppercase">timer attivo</p>
          </div>
          <select value={focusMinutes} onChange={(e) => setFocusMinutes(parseInt(e.target.value, 10))} disabled={isFocusRunning} className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-violet-300">
            <option value={15}>15 min</option>
            <option value={25}>25 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsFocusRunning(true)} disabled={isFocusRunning} className={`flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border transition-all ${isFocusRunning ? 'border-gray-700 text-gray-500' : 'border-violet-400 text-violet-300 hover:bg-violet-400 hover:text-black'}`}>
            Start
          </button>
          <button onClick={() => setIsFocusRunning(false)} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-red-500 text-red-300 hover:bg-red-500 hover:text-white transition-all">
            Stop
          </button>
        </div>
      </motion.div>

      {/* MICRO QUEST */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.092 }} className="bg-black/50 border border-fuchsia-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-fuchsia-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-fuchsia-300 animate-pulse"></span>
          MICRO QUEST
        </h2>
        {isQuestToday && microQuest ? (
          <>
            <p className="text-xs text-white mb-2">{microQuest.description}</p>
            <p className="text-[10px] text-gray-500 uppercase mb-2">Progresso: {Math.round(questProgress.value)} / {Math.round(microQuest.target)}</p>
            <div className="w-full bg-fuchsia-100/10 h-2 mb-3 overflow-hidden rounded-full border border-fuchsia-300/20">
              <motion.div initial={{ width: 0 }} animate={{ width: `${questProgressPct}%` }} className="bg-fuchsia-300 h-full shadow-[0_0_10px_rgba(232,121,249,0.9)]"></motion.div>
            </div>
            <div className="flex gap-2">
              <button onClick={claimMicroQuestReward} disabled={!questProgress.done || microQuest.claimed} className={`flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border transition-all ${(!questProgress.done || microQuest.claimed) ? 'border-gray-700 text-gray-500' : 'border-fuchsia-400 text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black'}`}>
                {microQuest.claimed ? 'Reward riscattato' : `Claim +${microQuest.reward?.exp || 20} EXP`}
              </button>
              <button onClick={generateMicroQuest} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-white/20 text-gray-300 hover:text-fuchsia-300 hover:border-fuchsia-300 transition-all">
                Reroll
              </button>
            </div>
          </>
        ) : (
          <button onClick={generateMicroQuest} className="w-full text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-fuchsia-400 text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black transition-all">
            Genera quest giornaliera
          </button>
        )}
      </motion.div>

      {/* APPLE HEALTH BRIDGE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="bg-black/40 border border-pink-500/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-pink-400 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-pink-400 animate-pulse"></span>
          HEALTH BRIDGE (iPhone)
        </h2>
        <p className="text-[10px] text-gray-400 uppercase mb-3">HealthKit diretto non è disponibile sul web: bridge rapido via app Salute + sync manuale intelligente.</p>
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{todayData.steps || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Steps</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{todayData.hrRest || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">HR Rest</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className={`font-black text-base ${hasHealthSync ? 'text-emerald-400' : 'text-gray-400'}`}>{hasHealthSync ? 'ON' : 'OFF'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Link</p>
          </div>
        </div>
        <p className="text-[9px] text-gray-500 uppercase mb-4">Ultima sync: {healthSyncDateLabel}</p>
        <div className="flex gap-2">
          <button onClick={openAppleHealth} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-pink-500 text-pink-400 hover:bg-pink-500 hover:text-white transition-all">
            Apri Salute
          </button>
          <button onClick={quickHealthSync} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all">
            Sync Rapida
          </button>
        </div>
      </motion.div>

      {/* SMART SCALE SYNC (OKOK) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.095 }} className="bg-black/50 border border-emerald-400/40 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-emerald-300 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-emerald-300 animate-pulse"></span>
          SMART SCALE SYNC (OKOK)
        </h2>
        <p className="text-[10px] text-gray-400 uppercase mb-3">Importa i dati dalla tua bilancia intelligente in formato rapido.</p>

        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{todayData.weight || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Peso</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-emerald-300 font-black text-base">{todayData.fat || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Fat %</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-cyan-300 font-black text-base">{bodyWaterValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">H2O %</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{muscleMassValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Muscle</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-amber-300 font-black text-base">{bmrValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">BMR</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-pink-300 font-black text-base">{visceralFatValue || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Visceral</p>
          </div>
        </div>

        <form onSubmit={handleOkokSync} className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" value={scaleWeightInput} onChange={(e) => setScaleWeightInput(e.target.value)} placeholder="Peso kg" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" step="0.1" value={scaleFatInput} onChange={(e) => setScaleFatInput(e.target.value)} placeholder="Body Fat %" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" step="0.1" value={scaleWaterInput} onChange={(e) => setScaleWaterInput(e.target.value)} placeholder="Acqua corporea %" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" step="0.1" value={scaleMuscleInput} onChange={(e) => setScaleMuscleInput(e.target.value)} placeholder="Massa muscolare kg" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" value={scaleBmrInput} onChange={(e) => setScaleBmrInput(e.target.value)} placeholder="BMR kcal" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" step="0.1" value={scaleVisceralInput} onChange={(e) => setScaleVisceralInput(e.target.value)} placeholder="Grasso viscerale" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300" />
          <input type="number" value={scaleAgeInput} onChange={(e) => setScaleAgeInput(e.target.value)} placeholder="Età metabolica" className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-emerald-300 col-span-2" />
          <button type="submit" className="col-span-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-emerald-400 text-emerald-300 hover:bg-emerald-400 hover:text-black transition-all">
            Salva Lettura OKOK
          </button>
        </form>
        <p className="text-[9px] text-gray-500 uppercase mt-2">Età metabolica attuale: {metabolicAgeValue || '--'}</p>
      </motion.div>

      {/* ANIME WORKOUT FORGE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-black/50 border border-red-500/40 p-5 rounded-sm mb-6 relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.12)]">
        <h2 className="text-red-400 text-xs font-bold system-font mb-3 flex items-center gap-2 uppercase">
          <span className="w-2 h-2 bg-red-400 animate-pulse"></span>
          ANIME WORKOUT FORGE
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {WORKOUT_PROMPT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyWorkoutPromptPreset(preset.prompt)}
              className="text-[10px] px-2 py-1 border border-red-500/50 text-red-200 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <textarea value={workoutPrompt} onChange={(e) => setWorkoutPrompt(e.target.value)} placeholder="Es: 45 minuti, casa, manubri, focus petto+spalle, livello intermedio..." className="w-full bg-void-black border border-red-900 text-white text-xs p-3 focus:outline-none focus:border-red-500 resize-none h-20 mb-3 rounded-sm" />
        <button onClick={generateAnimeWorkout} disabled={isGeneratingWorkout} className={`w-full text-[11px] font-black uppercase tracking-widest p-3 transition-all ${isGeneratingWorkout ? 'bg-gray-800 text-gray-500' : 'bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white'}`}>
          {isGeneratingWorkout ? 'EVOCANDO...' : 'GENERA WORKOUT IA'}
        </button>
        <div className="mt-3 border border-white/10 bg-black/30 p-2">
          <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-2">AI History (ultimi 20)</p>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {aiHistory.length > 0 ? aiHistory.slice(0, 6).map((entry) => (
              <div key={entry.id} className="border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-white font-bold">{entry.title}</p>
                  <span className="text-[9px] text-gray-500">{formatHistoryTime(entry.createdAt)}</span>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">{entry.prompt ? entry.prompt.slice(0, 90) : 'Nessun prompt testuale'}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => applyHistoryPrompt(entry)} className="text-[9px] px-2 py-1 border border-cyan-300/40 text-cyan-200 hover:bg-cyan-400 hover:text-black transition-all">
                    Usa Prompt
                  </button>
                  {entry.kind === 'workout_plan' ? (
                    <button onClick={() => loadHistoryWorkout(entry)} className="text-[9px] px-2 py-1 border border-red-300/40 text-red-200 hover:bg-red-400 hover:text-black transition-all">
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

        {aiWorkout && (
          <div className="mt-4 border border-red-500/30 bg-black/40 p-3">
            <div className="flex justify-between items-start gap-2 mb-2">
              <h3 className="text-white text-sm font-black italic">{aiWorkout.title || 'Shadow Protocol'}</h3>
              <span className="text-[10px] px-2 py-1 border border-red-500 text-red-400 font-bold">RANK {aiWorkout.difficulty || 'C'}</span>
            </div>
            {Array.isArray(aiWorkout.safetyWarnings) && aiWorkout.safetyWarnings.length > 0 ? (
              <div className="mb-2 border border-amber-300/40 bg-amber-500/10 p-2">
                <p className="text-[9px] uppercase tracking-widest text-amber-200 mb-1">Safety Layer</p>
                <p className="text-[10px] text-amber-100">{aiWorkout.safetyWarnings.join(' ')}</p>
              </div>
            ) : null}
            <p className="text-[10px] text-gray-400 uppercase mb-2">{aiWorkout.focus || 'focus libero'} • {aiWorkout.durationMin || 40} min</p>
            <p className="text-[10px] text-red-300 uppercase mb-1">Warmup</p>
            <p className="text-xs text-gray-200 mb-2">{Array.isArray(aiWorkout.warmup) ? aiWorkout.warmup.join(' • ') : '--'}</p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-white font-black text-base">{formatSeconds(workoutRemaining)}</p>
                <p className="text-[8px] text-gray-500 uppercase">Timer</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-cyan-300 font-black text-base">{formatSeconds(restRemaining)}</p>
                <p className="text-[8px] text-gray-500 uppercase">Rest</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-red-300 font-black text-base">{workoutCompletionPct}%</p>
                <p className="text-[8px] text-gray-500 uppercase">Complete</p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={startWorkoutSession} disabled={isWorkoutRunning} className={`flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border transition-all ${isWorkoutRunning ? 'border-gray-700 text-gray-500' : 'border-red-500 text-red-300 hover:bg-red-500 hover:text-white'}`}>
                Avvia Sessione
              </button>
              <button onClick={() => setIsWorkoutRunning((prev) => !prev)} disabled={!workoutExercises.length} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black transition-all">
                {isWorkoutRunning ? 'Pausa' : 'Riprendi'}
              </button>
              <button onClick={finishWorkoutSession} disabled={!workoutExercises.length} className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-emerald-400 text-emerald-300 hover:bg-emerald-400 hover:text-black transition-all">
                Fine
              </button>
            </div>

            <p className="text-[10px] text-red-300 uppercase mb-1">Main Set + Log</p>
            <div className="space-y-2 mb-2">
              {workoutExercises.length > 0 ? workoutExercises.map((ex, idx) => {
                const progress = exerciseProgress[idx] || { completedSets: 0, setsTarget: Math.max(parseInt(ex.sets, 10) || 1, 1), logs: [] };
                const input = exerciseInputs[idx] || {};
                const isActive = idx === activeExerciseIndex;
                return (
                  <div key={`${ex.name || 'ex'}-${idx}`} className={`border p-2 ${isActive ? 'border-red-400 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                    <p className="text-xs text-gray-100">
                      {idx + 1}. {ex.name} • {ex.sets}x{ex.reps} • Rest {ex.restSec}s
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase mt-1">Set: {progress.completedSets}/{progress.setsTarget}</p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <input
                        type="number"
                        placeholder="kg"
                        value={input.kg || ''}
                        onChange={(e) => handleExerciseInput(idx, 'kg', e.target.value)}
                        className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-red-400"
                      />
                      <input
                        type="number"
                        placeholder="reps"
                        value={input.repsDone || ''}
                        onChange={(e) => handleExerciseInput(idx, 'repsDone', e.target.value)}
                        className="bg-black/50 border border-white/10 text-white text-xs p-2 focus:outline-none focus:border-red-400"
                      />
                      <button
                        onClick={() => logExerciseSet(idx)}
                        disabled={!isWorkoutRunning || progress.completedSets >= progress.setsTarget}
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-2 border transition-all ${(!isWorkoutRunning || progress.completedSets >= progress.setsTarget) ? 'border-gray-700 text-gray-500' : 'border-red-500 text-red-300 hover:bg-red-500 hover:text-white'}`}
                      >
                        Log Set
                      </button>
                    </div>
                    {progress.logs.length > 0 && (
                      <p className="text-[9px] text-gray-400 mt-1">
                        Ultimo: {progress.logs[progress.logs.length - 1].kg || '--'} kg x {progress.logs[progress.logs.length - 1].repsDone || '--'} ({progress.logs[progress.logs.length - 1].time})
                      </p>
                    )}
                  </div>
                );
              }) : <p className="text-xs text-gray-500">Nessun esercizio</p>}
            </div>
            <p className="text-[10px] text-red-300 uppercase mb-1">Finisher</p>
            <p className="text-xs text-gray-200 mb-2">{Array.isArray(aiWorkout.finisher) ? aiWorkout.finisher.join(' • ') : '--'}</p>
            <p className="text-[10px] text-gray-400">{Array.isArray(aiWorkout.notes) ? aiWorkout.notes.join(' | ') : ''}</p>
            {latestWorkouts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] text-red-300 uppercase mb-1">Sessioni Recenti</p>
                {latestWorkouts.map((session) => (
                  <p key={session.id} className="text-[10px] text-gray-300">
                    {new Date(session.date).toLocaleDateString('it-IT')} • {session.title} • Rank {session.rank}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* POWER LEVEL CARD */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-black/40 border border-cursed-purple/30 p-5 rounded-sm mb-6 relative overflow-hidden">
        <h2 className="text-cursed-purple text-xs font-bold system-font mb-4 flex items-center gap-2 uppercase"><span className="w-2 h-2 bg-cursed-purple animate-pulse"></span> POWER LEVEL</h2>
        <div className="flex justify-between items-end mb-6">
          <div><p className="text-4xl font-black text-white">{todayData.strength > 0 ? todayData.strength : '--'}</p><p className="text-[10px] text-gray-500 mt-1 uppercase">Estimated 1RM (KG)</p></div>
        </div>
        <form onSubmit={handleStrengthUpload} className="flex gap-2">
          <input type="number" value={liftWeight} onChange={(e) => setLiftWeight(e.target.value)} placeholder="Weight" className="bg-black/50 border border-white/10 text-white text-sm p-2 w-1/2 focus:outline-none focus:border-cursed-purple" />
          <input type="number" value={liftReps} onChange={(e) => setLiftReps(e.target.value)} placeholder="Reps" className="bg-black/50 border border-white/10 text-white text-sm p-2 w-1/2 focus:outline-none focus:border-cursed-purple" />
          <button type="submit" className="bg-cursed-purple/10 border border-cursed-purple text-cursed-purple px-3 text-xs font-bold uppercase hover:bg-cursed-purple hover:text-white transition-colors">Evolve</button>
        </form>
      </motion.div>

      {/* ABILITY STATS */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-black/40 border border-yellow-500/30 p-5 rounded-sm mb-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-yellow-500 text-xs font-bold system-font flex items-center gap-2 uppercase"><span className="w-2 h-2 bg-yellow-500 animate-pulse"></span> ABILITIES</h2>
          {(playerStats.ap || 0) > 0 && <span className="text-[10px] bg-yellow-500 text-black font-bold px-2 py-0.5 animate-pulse rounded-sm">+{playerStats.ap} AP DISPONIBILI</span>}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-white/5 border border-white/10 p-2"><div className="flex items-center gap-2"><span className="text-boss-red font-black italic w-8">STR</span><span className="text-white font-bold">{playerStats.str || 10}</span></div>{(playerStats.ap || 0) > 0 && <button onClick={() => handleStatUpgrade('str')} className="text-boss-red font-bold text-lg hover:scale-125 transition-transform">+</button>}</div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 p-2"><div className="flex items-center gap-2"><span className="text-emerald-500 font-black italic w-8">VIT</span><span className="text-white font-bold">{playerStats.vit || 10}</span></div>{(playerStats.ap || 0) > 0 && <button onClick={() => handleStatUpgrade('vit')} className="text-emerald-500 font-bold text-lg hover:scale-125 transition-transform">+</button>}</div>
          <div className="flex justify-between items-center bg-white/5 border border-white/10 p-2"><div className="flex items-center gap-2"><span className="text-system-blue font-black italic w-8">AGI</span><span className="text-white font-bold">{playerStats.agi || 10}</span></div>{(playerStats.ap || 0) > 0 && <button onClick={() => handleStatUpgrade('agi')} className="text-system-blue font-bold text-lg hover:scale-125 transition-transform">+</button>}</div>
        </div>
      </motion.div>

      {/* VESSEL EVOLUTION CARD */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-black/40 border border-emerald-500/30 p-5 rounded-sm relative overflow-hidden">
        <h2 className="text-emerald-500 text-xs font-bold system-font mb-4 flex items-center gap-2 uppercase"><span className="w-2 h-2 bg-emerald-500 animate-pulse"></span> VESSEL EVOLUTION</h2>
        <div className="grid grid-cols-3 gap-2 mb-6 text-center divide-x divide-white/10">
          <div><p className="text-2xl font-black text-white">{todayData.weight > 0 ? todayData.weight : '--'}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Weight</p></div>
          <div><p className="text-2xl font-black text-emerald-500">{todayData.fat > 0 ? `${todayData.fat}%` : '--'}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Fat %</p></div>
          <div><p className="text-2xl font-black text-white">{todayData.leanMass > 0 ? todayData.leanMass : '--'}</p><p className="text-[8px] text-gray-500 uppercase mt-1">Lean Mass</p></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (bodyWeight && bodyFat) { const w = parseFloat(bodyWeight); const bf = parseFloat(bodyFat); const lm = w - (w * (bf / 100)); saveToSystem({ weight: w, fat: bf, leanMass: parseFloat(lm.toFixed(1)) }); setBodyWeight(''); setBodyFat(''); incrementCombo('body-update'); } }} className="flex gap-2">
          <input type="number" step="0.1" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} placeholder="Weight..." className="bg-black/50 border border-white/10 text-white text-sm p-2 w-1/2 focus:outline-none focus:border-emerald-500" />
          <input type="number" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="Fat %..." className="bg-black/50 border border-white/10 text-white text-sm p-2 w-1/2 focus:outline-none focus:border-emerald-500" />
          <button type="submit" className="bg-emerald-500/10 border border-emerald-500 text-emerald-500 px-3 text-xs font-bold uppercase hover:bg-emerald-500 hover:text-black transition-colors">Update</button>
        </form>
      </motion.div>

      {/* SEZIONE BACKUP / CRISTALLO DI MEMORIA */}
      <div className="mt-8 flex flex-col gap-3 pb-8 border-t border-white/10 pt-6">
        <p className="text-system-blue text-[10px] tracking-[0.3em] font-bold system-font uppercase text-center mb-2">System Backup</p>
        <div className="flex justify-between gap-2">
          <button onClick={handleExport} className="flex-1 text-[10px] text-gray-400 border border-gray-700 p-3 uppercase tracking-widest hover:text-system-blue hover:border-system-blue transition-all">↓ Extract Memory</button>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="flex-1 text-[10px] text-gray-400 border border-gray-700 p-3 uppercase tracking-widest hover:text-emerald-500 hover:border-emerald-500 transition-all">↑ Absorb Memory</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

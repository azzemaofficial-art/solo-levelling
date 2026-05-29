import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { playSfx } from '../utils/sfx';
import { speakEvent } from '../utils/voice';
import AnimeStrip from '../components/AnimeStrip';

const Recovery = ({
  systemLogs,
  setSystemLogs,
  playerStats,
  setPlayerStats,
  dailyGoal,
  setDailyGoal,
  hydrationGoal,
  setHydrationGoal,
  createEmptyLog,
  soundEnabled,
  soundTheme,
  voiceEnabled,
  voicePack
}) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayData = systemLogs.find((log) => log.date === today) || createEmptyLog(today);

  const [sleepInput, setSleepInput] = useState('');
  const [energyInput, setEnergyInput] = useState(7);
  const [scaleWeightInput, setScaleWeightInput] = useState('');
  const [scaleFatInput, setScaleFatInput] = useState('');
  const [scaleWaterInput, setScaleWaterInput] = useState('');
  const [scaleMuscleInput, setScaleMuscleInput] = useState('');
  const [scaleBmrInput, setScaleBmrInput] = useState('');
  const [scaleVisceralInput, setScaleVisceralInput] = useState('');
  const [scaleAgeInput, setScaleAgeInput] = useState('');
  const [lastSaveMessage, setLastSaveMessage] = useState('');

  const saveToSystem = (updates) => {
    const exists = systemLogs.some((log) => log.date === today);
    if (exists) setSystemLogs(systemLogs.map((log) => (log.date === today ? { ...log, ...updates } : log)));
    else setSystemLogs([...systemLogs, { ...createEmptyLog(today), ...updates }]);
  };

  const parseOptionalNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleRecoveryCheckin = (e) => {
    e.preventDefault();
    const sleepHours = parseFloat(sleepInput);
    const energyLevel = parseInt(energyInput, 10);
    if (Number.isNaN(sleepHours) || sleepHours <= 0) return alert("Inserisci ore sonno valide.");
    const sleepScore = Math.min(100, Math.max(0, Math.round((sleepHours / 8) * 70)));
    const energyScore = Math.min(100, Math.max(0, energyLevel * 10));
    const recoveryScore = Math.round((sleepScore * 0.7) + (energyScore * 0.3));
    saveToSystem({ sleepHours: parseFloat(sleepHours.toFixed(1)), energyLevel, recoveryScore });
    setSleepInput('');
    setLastSaveMessage(`Recovery salvato: ${sleepHours.toFixed(1)}h • score ${recoveryScore}`);
    setPlayerStats((prev) => ({ ...prev, healthLastSync: new Date().toISOString(), healthSyncSource: prev.healthSyncSource || 'manual' }));
    playSfx('success', soundEnabled, soundTheme);
  };

  const handleScaleSync = (e) => {
    e.preventDefault();
    const weight = parseOptionalNumber(scaleWeightInput);
    const fat = parseOptionalNumber(scaleFatInput);
    const bodyWater = parseOptionalNumber(scaleWaterInput);
    const muscleMass = parseOptionalNumber(scaleMuscleInput);
    const bmr = parseOptionalNumber(scaleBmrInput);
    const visceral = parseOptionalNumber(scaleVisceralInput);
    const metabolicAge = parseOptionalNumber(scaleAgeInput);
    if ([weight, fat, bodyWater, muscleMass, bmr, visceral, metabolicAge].every((value) => value === null)) return;

    const updates = {};
    if (weight !== null) updates.weight = weight;
    if (fat !== null) updates.fat = fat;
    if (bodyWater !== null) updates.bodyWaterPct = bodyWater;
    if (muscleMass !== null) updates.muscleMassKg = muscleMass;
    if (bmr !== null) updates.bmrKcal = Math.round(bmr);
    if (visceral !== null) updates.visceralFat = visceral;
    if (metabolicAge !== null) updates.metabolicAge = metabolicAge;
    if (weight !== null && fat !== null) updates.leanMass = parseFloat((weight - (weight * (fat / 100))).toFixed(1));

    saveToSystem(updates);
    setPlayerStats((prev) => ({ ...prev, healthSyncEnabled: true, healthSyncSource: 'okok', healthLastSync: new Date().toISOString() }));
    setLastSaveMessage('Lettura bilancia salvata correttamente.');
    playSfx('success', soundEnabled, soundTheme);
    setScaleWeightInput(''); setScaleFatInput(''); setScaleWaterInput(''); setScaleMuscleInput(''); setScaleBmrInput(''); setScaleVisceralInput(''); setScaleAgeInput('');
  };

  const openAppleHealth = () => {
    window.location.href = "x-apple-health://";
  };

  const syncSleepFromHealth = () => {
    const input = window.prompt("Inserisci ore sonno lette in App Salute (es. 7.4)");
    if (!input) return;
    const sleepHours = parseFloat(input.replace(',', '.'));
    if (Number.isNaN(sleepHours) || sleepHours <= 0) {
      playSfx('warning', soundEnabled, soundTheme);
      return alert("Valore non valido.");
    }
    const recoveryScore = Math.round(Math.min(100, Math.max(0, (sleepHours / 8) * 100)));
    saveToSystem({ sleepHours: parseFloat(sleepHours.toFixed(1)), recoveryScore });
    setPlayerStats((prev) => ({
      ...prev,
      healthSyncEnabled: true,
      healthSyncSource: 'iphone-health',
      healthLastSync: new Date().toISOString()
    }));
    setLastSaveMessage(`Sonno sincronizzato da Salute: ${sleepHours.toFixed(1)}h`);
    playSfx('success', soundEnabled, soundTheme);
    speakEvent('quest_clear', voiceEnabled, voicePack);
  };

  const runAutoTune = () => {
    const tunedCalories = todayData.bmrKcal ? Math.round(todayData.bmrKcal * 1.45) : dailyGoal;
    const tunedHydration = todayData.weight ? Math.round(todayData.weight * 35) : hydrationGoal;
    if (!todayData.bmrKcal && !todayData.weight) return;
    setDailyGoal(Math.max(1600, tunedCalories));
    setHydrationGoal(Math.max(1800, tunedHydration));
  };

  return (
    <div className="p-6 pt-10 pb-24 min-h-full bg-void-black relative overflow-hidden">
      <img src="/avatar6.png" alt="" className="pointer-events-none absolute -right-12 top-12 w-40 opacity-15 grayscale" />
      <img src="/boss7.png" alt="" className="pointer-events-none absolute -left-14 bottom-10 w-40 opacity-10 grayscale" />
      <div className="mb-8">
        <p className="text-gray-500 text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Recovery</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">BIO LAB</h1>
      </div>

      <AnimeStrip title="Shadow Aesthetic" />

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-black/50 border border-pink-400/30 p-5 rounded-sm mb-6">
        <p className="text-pink-300 text-[10px] uppercase tracking-widest mb-2">Health Bridge (iPhone)</p>
        <p className="text-xs text-gray-300 mb-3">Su web app (Netlify/Safari) non si può leggere HealthKit in automatico. Usa: Apri Salute + Sync Sonno.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={openAppleHealth} className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-pink-400 text-pink-300">Apri Salute</button>
          <button type="button" onClick={syncSleepFromHealth} className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-cyan-300 text-cyan-200">Sync Sonno</button>
        </div>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} onSubmit={handleRecoveryCheckin} className="bg-black/50 border border-lime-400/30 p-5 rounded-sm mb-6">
        <p className="text-lime-300 text-[10px] uppercase tracking-widest mb-3">Recovery Check-in</p>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-white font-black text-base">{todayData.sleepHours || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Sleep h</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-lime-300 font-black text-base">{todayData.recoveryScore || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Recovery</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2">
            <p className="text-yellow-300 font-black text-base">{todayData.energyLevel || '--'}</p>
            <p className="text-[8px] text-gray-500 uppercase">Energy</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" value={sleepInput} onChange={(e) => setSleepInput(e.target.value)} placeholder="Ore sonno..." className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <select value={energyInput} onChange={(e) => setEnergyInput(e.target.value)} className="bg-black/50 border border-white/10 text-white text-xs p-2">
            <option value={5}>Energy 5/10</option><option value={6}>Energy 6/10</option><option value={7}>Energy 7/10</option><option value={8}>Energy 8/10</option><option value={9}>Energy 9/10</option><option value={10}>Energy 10/10</option>
          </select>
          <button type="submit" className="col-span-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-lime-400 text-lime-300">Salva</button>
        </div>
      </motion.form>

      <motion.form initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} onSubmit={handleScaleSync} className="bg-black/50 border border-emerald-400/30 p-5 rounded-sm mb-6">
        <p className="text-emerald-300 text-[10px] uppercase tracking-widest mb-3">Smart Scale (OKOK)</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" value={scaleWeightInput} onChange={(e) => setScaleWeightInput(e.target.value)} placeholder="Peso kg" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={scaleFatInput} onChange={(e) => setScaleFatInput(e.target.value)} placeholder="Body Fat %" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={scaleWaterInput} onChange={(e) => setScaleWaterInput(e.target.value)} placeholder="Acqua corporea %" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={scaleMuscleInput} onChange={(e) => setScaleMuscleInput(e.target.value)} placeholder="Massa muscolare kg" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" value={scaleBmrInput} onChange={(e) => setScaleBmrInput(e.target.value)} placeholder="BMR kcal" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={scaleVisceralInput} onChange={(e) => setScaleVisceralInput(e.target.value)} placeholder="Grasso viscerale" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" value={scaleAgeInput} onChange={(e) => setScaleAgeInput(e.target.value)} placeholder="Età metabolica" className="bg-black/50 border border-white/10 text-white text-xs p-2 col-span-2" />
          <button type="submit" className="col-span-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-emerald-400 text-emerald-300">Salva Lettura</button>
        </div>
      </motion.form>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="bg-black/50 border border-cyan-300/30 p-5 rounded-sm">
        <p className="text-cyan-200 text-[10px] uppercase tracking-widest mb-3">Auto-Tune</p>
        <p className="text-xs text-gray-300 mb-3">Ricalibra obiettivi da BMR e Peso smart-scale.</p>
        <button onClick={runAutoTune} className="w-full text-[10px] font-bold uppercase tracking-widest px-3 py-2 border border-cyan-300 text-cyan-200">Esegui Auto-Tune</button>
        {lastSaveMessage && <p className="text-[10px] text-emerald-400 mt-3 uppercase">{lastSaveMessage}</p>}
      </motion.div>
    </div>
  );
};

export default Recovery;

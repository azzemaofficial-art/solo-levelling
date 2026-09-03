// ─────────────────────────────────────────────────────────────────────────────
// BODY COMPOSITION — trends pesate/metriche + goal, self-contained.
// Vive nella pagina Stats (spostato da SystemHub): calcola tutto da
// systemLogs + playerStats, salva il goal in playerStats.bodyGoal.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { playSfx } from '../utils/sfx';

const parseDdMmToDate = (value) => {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
};
const clampPct = (value) => Math.max(0, Math.min(100, Number(value || 0)));

export default function BodyCompositionPanel({ systemLogs = [], playerStats = {}, setPlayerStats, soundEnabled = true, soundTheme = 'solo' }) {
  const [goalInput, setGoalInput] = useState({ targetWeightKg: '', targetFatPct: '' });

  const sortedBodyLogs = useMemo(() => (
    [...systemLogs]
      .map((log) => ({ ...log, parsedDate: parseDdMmToDate(log?.date) }))
      .filter((row) => row.parsedDate)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
  ), [systemLogs]);

  const profileHeightM = (() => {
    const cm = Math.max(0, Number(playerStats?.heightCm || 0));
    return cm >= 120 ? cm / 100 : 0;
  })();

  const trend = useMemo(() => {
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
        .map((log) => ({ date: String(log?.date || ''), value: Number(metric.getValue(log) || 0) }))
        .filter((entry) => entry.value > 0);
      if (!points.length) return { ...metric, hasData: false, current: 0, delta: 0, avgRecent: 0, sparkline: [], status: 'neutral' };
      const current = Number(points[points.length - 1].value || 0);
      const prev = Number((points[points.length - 2] || points[points.length - 1]).value || 0);
      const delta = Number((current - prev).toFixed(metric.decimals));
      const recentSlice = points.slice(-Math.min(points.length, 6));
      const avgRecent = Number((recentSlice.reduce((sum, row) => sum + Number(row.value || 0), 0) / Math.max(1, recentSlice.length)).toFixed(metric.decimals));
      const minVal = Math.min(...recentSlice.map((row) => Number(row.value || 0)));
      const maxVal = Math.max(...recentSlice.map((row) => Number(row.value || 0)));
      const range = Math.max(0.0001, maxVal - minVal);
      const sparkline = recentSlice.map((row) => ({
        date: row.date,
        heightPct: clampPct((((Number(row.value || 0) - minVal) / range) * 88) + 12)
      }));
      const status = metric.prefer === 'lower'
        ? (delta <= 0 ? 'good' : 'warn')
        : metric.prefer === 'higher' ? (delta >= 0 ? 'good' : 'warn') : 'neutral';
      return { ...metric, hasData: true, current: Number(current.toFixed(metric.decimals)), delta, avgRecent, sparkline, status };
    });
  }, [sortedBodyLogs, profileHeightM]);

  const byId = useMemo(() => trend.reduce((acc, row) => { acc[row.id] = row; return acc; }, {}), [trend]);

  const headline = useMemo(() => {
    const wins = [];
    const risks = [];
    const fat = byId.fat, visceral = byId.visceralFat, lean = byId.leanMass, bmi = byId.bmi;
    if (fat?.hasData && fat.delta <= -0.2) wins.push(`BF ${fat.delta}%`);
    if (visceral?.hasData && visceral.delta <= -0.1) wins.push(`Visceral ${visceral.delta}`);
    if (lean?.hasData && lean.delta >= 0.1) wins.push(`Lean +${lean.delta}kg`);
    if (fat?.hasData && fat.delta >= 0.3) risks.push(`BF +${fat.delta}%`);
    if (visceral?.hasData && visceral.delta >= 0.2) risks.push(`Visceral +${visceral.delta}`);
    if (lean?.hasData && lean.delta <= -0.2) risks.push(`Lean ${lean.delta}kg`);
    if (bmi?.hasData && bmi.current >= 29.5) risks.push(`BMI ${bmi.current}`);
    return wins.length ? `Trend positivo: ${wins.join(' • ')}` : risks.length ? `Attenzione: ${risks.join(' • ')}` : 'Trend body composition stabile.';
  }, [byId]);

  const bodyGoal = playerStats.bodyGoal || { targetWeightKg: 0, targetFatPct: 0 };
  const currentWeight = (() => {
    const w = [...sortedBodyLogs].reverse().find((l) => Number(l.weight) > 0);
    return Number(w?.weight || 0) || Number(playerStats.currentWeightKg || 0);
  })();
  const goalDeltaKg = bodyGoal.targetWeightKg > 0 && currentWeight > 0 ? Number((bodyGoal.targetWeightKg - currentWeight).toFixed(1)) : 0;
  // Trend settimanale del peso: ultima pesata vs media delle 6 precedenti
  const weeklyDeltaKg = (() => {
    const ws = sortedBodyLogs.map((l) => Number(l.weight || 0)).filter((v) => v > 0);
    if (ws.length < 3) return 0;
    const last = ws[ws.length - 1];
    const prevSlice = ws.slice(Math.max(0, ws.length - 7), ws.length - 1);
    const avg = prevSlice.reduce((a, b) => a + b, 0) / Math.max(1, prevSlice.length);
    return Number((last - avg).toFixed(2));
  })();
  const trendAbs = Math.abs(weeklyDeltaKg);
  const estimatedWeeksToGoal = bodyGoal.targetWeightKg > 0 && currentWeight > 0 && trendAbs > 0.05
    ? Math.max(1, Math.round(Math.abs(goalDeltaKg) / trendAbs))
    : 0;
  const estimatedGoalDateLabel = estimatedWeeksToGoal
    ? (() => { const d = new Date(); d.setDate(d.getDate() + (estimatedWeeksToGoal * 7)); return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }); })()
    : '';

  const saveGoal = () => {
    const targetWeightKg = Number(goalInput.targetWeightKg || 0);
    const targetFatPct = Number(goalInput.targetFatPct || 0);
    setPlayerStats?.((prev) => ({
      ...prev,
      bodyGoal: {
        targetWeightKg: targetWeightKg > 0 ? targetWeightKg : 0,
        targetFatPct: targetFatPct > 0 ? targetFatPct : 0,
        updatedAt: new Date().toISOString()
      }
    }));
    playSfx('success', soundEnabled, soundTheme);
  };

  return (
    <div className="space-y-4">
      {/* ── TRENDS ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2, scale: 1.005 }} className="bg-black/40 border border-fuchsia-300/30 p-5 rounded-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-fuchsia-200 text-[10px] uppercase tracking-widest">Body Composition Trends (pesate)</p>
          <p className="text-[9px] uppercase text-gray-500">{trend.filter((row) => row.hasData).length}/8 metriche</p>
        </div>
        <p className="text-[10px] text-gray-300 mb-3">{headline}</p>
        <div className="grid grid-cols-2 gap-2">
          {trend.map((row) => (
            <div key={`bc-${row.id}`} className="border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] uppercase text-gray-400">{row.label}</p>
                <p className={`text-[9px] uppercase ${row.status === 'good' ? 'text-emerald-200' : row.status === 'warn' ? 'text-amber-200' : 'text-cyan-200'}`}>
                  {row.hasData ? `${row.delta > 0 ? '+' : ''}${row.delta}${row.unit}` : '--'}
                </p>
              </div>
              <p className="text-sm font-black text-white">{row.hasData ? `${row.current}${row.unit}` : '--'}</p>
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

      {/* ── GOAL ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="system-card rounded-sm border border-violet-300/30 bg-black/45 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-violet-200">Body Composition Goal</p>
          <button onClick={saveGoal} className="text-[9px] px-2 py-1 border border-violet-300/40 text-violet-200 uppercase tracking-widest hover:bg-violet-300 hover:text-black">Salva Goal</button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="number" step="0.1" value={goalInput.targetWeightKg || ''} onChange={(e) => setGoalInput((prev) => ({ ...prev, targetWeightKg: e.target.value }))} placeholder="Target peso kg" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
          <input type="number" step="0.1" value={goalInput.targetFatPct || ''} onChange={(e) => setGoalInput((prev) => ({ ...prev, targetFatPct: e.target.value }))} placeholder="Target body fat %" className="bg-black/50 border border-white/10 text-white text-xs p-2" />
        </div>
        <p className="text-[10px] text-gray-300">Attuale: {currentWeight || '--'} kg • Goal: {bodyGoal.targetWeightKg || '--'} kg • Delta: {goalDeltaKg > 0 ? '+' : ''}{goalDeltaKg || 0} kg</p>
        <p className="text-[10px] text-violet-200 uppercase mt-1">Stima tempo: {estimatedWeeksToGoal ? `${estimatedWeeksToGoal} settimane` : 'insufficiente dati trend'}</p>
        <p className="text-[10px] text-cyan-200 uppercase mt-1">ETA target: {estimatedGoalDateLabel || '--'}</p>
      </motion.div>
    </div>
  );
}

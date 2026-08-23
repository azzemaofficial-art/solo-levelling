// ─────────────────────────────────────────────────────────────────────────────
// Barra di maestria globale 0-100, fissa sopra la nav in tutta l'app.
// Il 100 si raggiunge solo con tantissima pratica (curva asintotica).
// Si aggiorna sugli eventi 'coach-progress-updated' e 'storage'.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { globalMastery, masteryTitle } from '../../lib/mastery.js';

const PROGRESS_KEY = 'shadow_monarch_coach_progress';
const readMastery = () => {
  try { return globalMastery(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')); } catch { return 0; }
};

export default function GlobalMasteryBar() {
  const [level, setLevel] = useState(readMastery);

  useEffect(() => {
    const update = () => setLevel(readMastery());
    window.addEventListener('coach-progress-updated', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('coach-progress-updated', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const t = masteryTitle(level);

  return (
    <div className="w-full max-w-[390px] px-3 pb-1 shrink-0" aria-label={`Maestria globale livello ${level}`}>
      <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(10,10,14,0.92)', border: '1px solid rgba(251,191,36,0.25)', boxShadow: '0 -2px 18px rgba(251,191,36,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[8px] font-black tracking-[0.2em]" style={{ color: '#fbbf24', fontFamily: 'Orbitron, sans-serif' }}>
            ⚔ MAESTRIA · {t.title}
          </p>
          <p className="text-[9px] font-black" style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif' }}>{level}<span style={{ color: '#6b7280' }}>/100</span></p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.5)' }}>
          <motion.div className="h-full rounded-full"
            animate={{ width: `${Math.max(1.5, level)}%` }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.3, 1] }}
            style={{ background: 'linear-gradient(90deg, #b45309, #fbbf24, #fff)', boxShadow: '0 0 8px rgba(251,191,36,0.7)' }} />
        </div>
      </div>
    </div>
  );
}

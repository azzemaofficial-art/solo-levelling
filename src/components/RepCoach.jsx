// ─────────────────────────────────────────────────────────────────────────────
// COACH VOCALE MANI-LIBERE — scegli l'esercizio, la camera conta le rep,
// il coach le dice ad alta voce e ti corregge se scendi poco. Zero AI.
// Presentational: la logica (counter, voce, XP) vive in Coach.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, AnimatePresence } from 'framer-motion';

const MODES = [
  { id: 'punch', label: 'PUGNI', icon: '🥊' },
  { id: 'kicks', label: 'CALCI', icon: '🥋' },
  { id: 'squat', label: 'SQUAT', icon: '🦵' },
  { id: 'push', label: 'PIEGAMENTI', icon: '💪' },
];

export default function RepCoach({ mode, count, onSelect, onStop }) {
  if (!mode) {
    return (
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <p className="text-[8px] font-black tracking-[0.2em] mr-1 whitespace-nowrap" style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
          🎙 CONTA VOCE
        </p>
        {MODES.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)}
            className="px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider whitespace-nowrap"
            style={{
              background: 'rgba(6,10,20,0.8)', border: '1px solid rgba(56,189,248,0.4)',
              color: '#bae6fd', fontFamily: 'Orbitron, sans-serif', backdropFilter: 'blur(6px)',
            }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>
    );
  }

  const active = MODES.find((m) => m.id === mode);
  return (
    <div className="flex items-center gap-3 pointer-events-auto rounded-2xl px-4 py-2.5"
      style={{
        background: 'rgba(6,10,20,0.88)', border: '1px solid rgba(251,191,36,0.5)',
        boxShadow: '0 0 22px rgba(251,191,36,0.2)', backdropFilter: 'blur(8px)',
      }}>
      <div className="text-center">
        <AnimatePresence mode="popLayout">
          <motion.p key={count}
            initial={{ scale: 1.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="text-3xl font-black leading-none"
            style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 16px rgba(251,191,36,0.8)' }}>
            {count}
          </motion.p>
        </AnimatePresence>
        <p className="text-[8px] font-black tracking-[0.2em] mt-0.5" style={{ color: '#fbbf24', fontFamily: 'Orbitron, sans-serif' }}>
          {active?.icon} {active?.label}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[8px] leading-tight" style={{ color: '#94a3b8' }}>Conta il coach,<br />tu allenati</p>
        <button onClick={onStop}
          className="px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest"
          style={{ background: 'rgba(239,68,68,0.85)', color: '#fff', fontFamily: 'Orbitron, sans-serif' }}>
          ■ FINE SERIE
        </button>
      </div>
    </div>
  );
}

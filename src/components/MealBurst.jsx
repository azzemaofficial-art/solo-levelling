// ─────────────────────────────────────────────────────────────────────────────
// Burst cinematico quando si aggiunge cibo/acqua: pennellata d'inchiostro,
// particelle oro, barra che sale col suono. Stile Solo Leveling + cinema
// orientale — tutto procedurale (framer-motion + SVG), zero asset.
// fx: { t, kind: meal|protein|water, delta, unit, before, after, fromPct, toPct, slot }
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSfx, playEatCrunch, playBarRise } from '../utils/sfx';

const KIND = {
  meal: { emoji: '🍜', label: 'PASTO', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)' },
  protein: { emoji: '🍗', label: 'PROTEINE', color: '#34d399', glow: 'rgba(52,211,153,0.5)' },
  water: { emoji: '💧', label: 'ACQUA', color: '#38bdf8', glow: 'rgba(56,189,248,0.5)' },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export default function MealBurst({ fx, onDone, soundEnabled = true, soundTheme = 'solo' }) {
  const playedRef = useRef(0);

  useEffect(() => {
    if (!fx || fx.t === playedRef.current) return undefined;
    playedRef.current = fx.t;
    if (soundEnabled) {
      if (fx.kind === 'water') {
        playSfx('bar', true, soundTheme);
      } else {
        playEatCrunch({ enabled: true });
        playSfx('eat', true, soundTheme);
      }
      setTimeout(() => playBarRise({ enabled: true, from: fx.fromPct, to: fx.toPct }), 180);
    }
    const id = setTimeout(() => onDone?.(), 1750);
    return () => clearTimeout(id);
  }, [fx, soundEnabled, soundTheme, onDone]);

  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (fx?.t || 0) % 1;
    const dist = 68 + ((i * 37) % 42);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, d: 0.04 + (i % 5) * 0.03 };
  }), [fx?.t]);

  const k = KIND[fx?.kind] || KIND.meal;
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {fx ? (
        <motion.div key={fx.t}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[97] flex items-center justify-center pointer-events-none">
          <div className="relative flex flex-col items-center gap-3">
            {/* Pennellata d'inchiostro dietro il cibo */}
            {!reduced && (
              <svg width="260" height="120" viewBox="0 0 260 120" className="absolute -top-8 pointer-events-none" aria-hidden>
                <motion.path d="M 18 78 C 60 30, 150 22, 240 52"
                  fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="26" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.9 }} animate={{ pathLength: 1, opacity: 0.28 }}
                  transition={{ duration: 0.5, ease: [0.2, 0.8, 0.3, 1] }} />
                <motion.path d="M 34 88 C 90 52, 170 46, 232 66"
                  fill="none" stroke={k.color} strokeWidth="7" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.55, delay: 0.08, ease: [0.2, 0.8, 0.3, 1] }} />
              </svg>
            )}

            {/* Cibo che arriva */}
            <motion.div
              initial={reduced ? { opacity: 1 } : { scale: 0, y: -70, rotate: -24 }}
              animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              className="text-6xl relative z-10"
              style={{ filter: `drop-shadow(0 0 18px ${k.glow})` }}>
              {k.emoji}
            </motion.div>

            {/* Particelle oro */}
            {!reduced && particles.map((p, i) => (
              <motion.span key={i}
                className="absolute rounded-full z-0"
                style={{ width: i % 3 === 0 ? 5 : 3, height: i % 3 === 0 ? 5 : 3, background: i % 4 === 0 ? '#fff' : k.color, boxShadow: `0 0 8px ${k.glow}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.7, delay: p.d, ease: 'easeOut' }} />
            ))}

            {/* Chip del delta */}
            <motion.p
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 18 }}
              className="text-sm font-black tracking-widest z-10"
              style={{ color: k.color, textShadow: `0 0 14px ${k.glow}`, fontFamily: 'Orbitron, sans-serif' }}>
              +{fx.delta}{fx.unit || ' kcal'} · {k.label}
            </motion.p>

            {/* Barra che sale */}
            <div className="w-56 z-10">
              <div className="flex justify-between text-[9px] tracking-widest mb-1" style={{ color: '#9ca3af' }}>
                <span>{fx.before}</span>
                <span style={{ color: k.color }}>{fx.after}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: `${(fx.fromPct || 0) * 100}%` }}
                  animate={{ width: `${(fx.toPct || 0) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.18, ease: [0.2, 0.8, 0.3, 1] }}
                  style={{ background: `linear-gradient(90deg, ${k.color}, #fff)`, boxShadow: `0 0 12px ${k.glow}` }} />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

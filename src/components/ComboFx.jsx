// ─────────────────────────────────────────────────────────────────────────────
// Cinematico combo/super-combo: slash d'inchiostro, flash bianco, particelle
// oro, screen-shake. Stile fantasy orientale — tutto procedurale, zero asset.
// fx: { t, grade: 'perfect'|'good', combo } · perfect = SUPER COMBO.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playGong, playComboHit, playEpicDing } from '../utils/sfx';

const CFG = {
  perfect: { label: 'SUPER COMBO', sub: 'PERFETTO', color: '#fbbf24', glow: 'rgba(251,191,36,0.85)' },
  good: { label: 'COMBO', sub: 'BUONO', color: '#38bdf8', glow: 'rgba(56,189,248,0.8)' },
};

const soundOn = () => {
  try { return window.localStorage.getItem('shadow_monarch_sound') !== '0'; } catch { return true; }
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export default function ComboFx({ fx, onDone }) {
  const playedRef = useRef(0);

  useEffect(() => {
    if (!fx || fx.t === playedRef.current) return undefined;
    playedRef.current = fx.t;
    if (soundOn()) {
      if (fx.grade === 'perfect') {
        playGong({ power: 1.2 });
        setTimeout(() => playEpicDing({ enabled: true }), 220);
      } else {
        playComboHit({ power: 1 });
      }
    }
    const id = setTimeout(() => onDone?.(), 1500);
    return () => clearTimeout(id);
  }, [fx, onDone]);

  const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + ((fx?.t || 0) % 7) * 0.13;
    const dist = 90 + ((i * 53) % 70);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, d: (i % 6) * 0.025, big: i % 4 === 0 };
  }), [fx?.t]);

  const c = CFG[fx?.grade] || CFG.good;
  const reduced = prefersReducedMotion();
  const superFx = fx?.grade === 'perfect';

  return (
    <AnimatePresence>
      {fx ? (
        <motion.div key={fx.t}
          initial={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[96] flex items-center justify-center pointer-events-none overflow-hidden">

          {/* Flash bianco d'impatto (solo super) */}
          {superFx && !reduced && (
            <motion.div className="absolute inset-0 bg-white"
              initial={{ opacity: 0.85 }} animate={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }} />
          )}

          {/* Screen shake sul contenuto */}
          <motion.div className="relative flex flex-col items-center"
            animate={superFx && !reduced ? { x: [0, -8, 6, -4, 2, 0], y: [0, 3, -2, 1, 0, 0] } : {}}
            transition={{ duration: 0.4 }}>

            {/* Slash d'inchiostro incrociati */}
            {!reduced && (
              <svg width="340" height="220" viewBox="0 0 340 220" className="absolute -top-16 pointer-events-none" aria-hidden>
                <motion.path d="M 20 160 C 110 90, 220 70, 320 40"
                  fill="none" stroke="rgba(15,15,20,0.9)" strokeWidth="30" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.22, ease: [0.1, 0.9, 0.2, 1] }} />
                <motion.path d="M 20 160 C 110 90, 220 70, 320 40"
                  fill="none" stroke={c.color} strokeWidth="4" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: 0.35 }}
                  transition={{ duration: 0.26, delay: 0.04 }} />
                {superFx && (
                  <motion.path d="M 300 170 C 220 110, 120 90, 30 50"
                    fill="none" stroke="rgba(15,15,20,0.85)" strokeWidth="22" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.2, delay: 0.08, ease: [0.1, 0.9, 0.2, 1] }} />
                )}
              </svg>
            )}

            {/* Particelle oro */}
            {!reduced && particles.map((p, i) => (
              <motion.span key={i}
                className="absolute z-0"
                style={{
                  width: p.big ? 7 : 4, height: p.big ? 3 : 3,
                  borderRadius: 1,
                  background: i % 3 === 0 ? '#fff' : c.color,
                  boxShadow: `0 0 10px ${c.glow}`,
                }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.big ? 220 : 90 }}
                transition={{ duration: 0.8, delay: p.d, ease: 'easeOut' }} />
            ))}

            {/* Testo gigante */}
            <motion.p
              initial={reduced ? { opacity: 1 } : { scale: 3.2, opacity: 0, rotate: -6, letterSpacing: '0.6em' }}
              animate={{ scale: 1, opacity: 1, rotate: superFx ? -3 : 0, letterSpacing: '0.12em' }}
              transition={{ type: 'spring', stiffness: 380, damping: 17 }}
              className={`relative z-10 font-black text-center leading-none ${superFx ? 'text-5xl' : 'text-4xl'}`}
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: '#fff',
                textShadow: `0 0 22px ${c.glow}, 0 0 60px ${c.glow}, 0 3px 10px rgba(0,0,0,0.9)`,
                WebkitTextStroke: `1px ${c.color}`,
              }}>
              {c.label}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="relative z-10 text-xs font-black tracking-[0.4em] mt-2"
              style={{ color: c.color, textShadow: `0 0 12px ${c.glow}` }}>
              {c.sub}
            </motion.p>
            {fx.combo && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 0.85 }}
                transition={{ delay: 0.22 }}
                className="relative z-10 text-[10px] mt-1.5 font-mono"
                style={{ color: '#e5e7eb' }}>
                {fx.combo}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

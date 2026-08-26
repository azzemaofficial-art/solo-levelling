// ─────────────────────────────────────────────────────────────────────────────
// AWAKENING — il risveglio del grado. Flash bianco, buio, esplosione di luce,
// particelle e la lettera del nuovo grado che si incendia sullo schermo.
// fx: { t, rank, disc } · tutto procedurale, ~3 secondi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { playGong, playEpicDing, playSample } from '../utils/sfx';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export default function AwakeningFx({ fx, onDone }) {
  const playedRef = useRef(0);
  const shakeRef = useRef(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    if (!fx || fx.t === playedRef.current) return undefined;
    playedRef.current = fx.t;
    playGong({ power: 1.3 });
    setTimeout(() => { if (!playSample('levelup', { volume: 0.5 })) playEpicDing({ enabled: true }); }, 520);
    if (shakeRef.current && !prefersReducedMotion()) {
      gsap.fromTo(shakeRef.current,
        { x: 0, y: 0 },
        { x: 0, y: 0, duration: 0.55, ease: 'power2.out', keyframes: [{ x: -10, y: 4 }, { x: 8, y: -3 }, { x: -5, y: 2 }, { x: 3, y: 0 }] });
    }
    const id = setTimeout(() => onDoneRef.current?.(), 3000);
    return () => clearTimeout(id);
  }, [fx]);

  const rays = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    rot: (i / 20) * 360,
    len: 130 + ((i * 47) % 90),
    delay: 0.32 + (i % 5) * 0.03,
  })), []);

  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {fx ? (
        <motion.div key={fx.t}
          initial={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99] flex items-center justify-center pointer-events-none overflow-hidden">

          <div ref={shakeRef} className="absolute inset-0 flex items-center justify-center">
            {/* Buio che cala */}
            <motion.div className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.94, 0.88] }}
              transition={{ duration: 0.5, times: [0, 0.6, 1] }} />

            {/* Flash bianco accecante */}
            {!reduced && (
              <motion.div className="absolute inset-0 bg-white"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.7, times: [0, 0.35, 1], delay: 0.1 }} />
            )}

            {/* Esplosione radiale dorata */}
            {!reduced && (
              <motion.div className="absolute w-40 h-40 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.95) 0%, rgba(217,119,6,0.5) 40%, transparent 70%)' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 7, opacity: [0, 1, 0.25] }}
                transition={{ duration: 1.15, delay: 0.3, times: [0, 0.5, 1], ease: 'power2.out' }} />
            )}

            {/* Raggi di luce */}
            {!reduced && rays.map((r, i) => (
              <motion.span key={i}
                className="absolute origin-center"
                style={{
                  width: 2.5, height: r.len,
                  background: 'linear-gradient(to top, transparent, #fbbf24, #fff)',
                  transform: `rotate(${r.rot}deg) translateY(-70px)`,
                  borderRadius: 2,
                }}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: [0, 1, 0], scaleY: [0, 1, 1.3] }}
                transition={{ duration: 0.9, delay: r.delay, ease: 'power2.out' }} />
            ))}

            {/* Particelle */}
            {!reduced && rays.slice(0, 14).map((r, i) => (
              <motion.span key={`p${i}`}
                className="absolute rounded-full"
                style={{ width: i % 3 === 0 ? 6 : 4, height: i % 3 === 0 ? 6 : 4, background: i % 2 === 0 ? '#fff' : '#fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.9)' }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((r.rot * Math.PI) / 180) * (r.len + 80),
                  y: Math.sin((r.rot * Math.PI) / 180) * (r.len + 80),
                  opacity: 0, scale: 0.2,
                }}
                transition={{ duration: 1.25, delay: r.delay, ease: 'power2.out' }} />
            ))}

            {/* Contenuto centrale */}
            <div className="relative flex flex-col items-center gap-1.5 px-6">
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                className="text-[10px] font-black tracking-[0.5em]"
                style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
                ⌈ RISVEGLIO ⌋
              </motion.p>

              {/* La lettera del grado che si incendia */}
              <motion.p
                initial={reduced ? { opacity: 1 } : { scale: 4.5, opacity: 0, filter: 'blur(14px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ delay: 0.62, type: 'spring', stiffness: 320, damping: 17 }}
                className="text-8xl font-black leading-none"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#fff',
                  textShadow: '0 0 12px #fbbf24, 0 0 34px #f59e0b, 0 0 80px rgba(245,158,11,0.8), 0 4px 16px rgba(0,0,0,0.9)',
                  WebkitTextStroke: '2px #f59e0b',
                }}>
                {fx.rank}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                className="text-xs font-black tracking-[0.3em] text-center"
                style={{ color: '#fde68a', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 14px rgba(251,191,36,0.8)' }}>
                GRADO {fx.rank} RAGGIUNTO
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 1.15 }}
                className="text-[10px] font-bold tracking-widest text-center"
                style={{ color: '#94a3b8' }}>
                {fx.disc}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ delay: 1.5, duration: 1.2 }}
                className="text-[9px] tracking-[0.35em] mt-2"
                style={{ color: '#64748b', fontFamily: 'Orbitron, sans-serif' }}>
                [SYSTEM] POTERE RICONOSCIUTO
              </motion.p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

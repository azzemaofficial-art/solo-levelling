// ─────────────────────────────────────────────────────────────────────────────
// ARMATA DELLE OMBRE — il potere più iconico del Sistema.
// Ogni disciplina portata al grado A/S dona un soldato d'ombra alla collezione:
// sagoma incappucciata con occhi ciano luminosi e fumo viola alla base.
// ShadowSoldier = la figura · ShadowRiseFx = la cinematica di estrazione.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { playGong, playSample, playEpicDing } from '../utils/sfx';

export function ShadowSoldier({ extracted = true, size = 64, glow = true }) {
  const uid = useId().replace(/[:]/g, '');
  const gradId = `sh-${uid}`;
  return (
    <motion.div
      animate={extracted ? { y: [0, -3.5, 0] } : {}}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size * 1.4, position: 'relative' }}>
      {extracted && glow && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center bottom, rgba(139,92,246,0.4) 0%, transparent 70%)' }} />
      )}
      <svg viewBox="0 0 60 84" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            {extracted ? (
              <>
                <stop offset="0" stopColor="#31215a" />
                <stop offset="1" stopColor="#0a0614" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#1f2430" />
                <stop offset="1" stopColor="#0b0e14" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* fumo viola alla base */}
        {extracted && (
          <>
            <motion.ellipse cx="30" cy="79" rx="19" ry="4.5" fill="rgba(139,92,246,0.5)"
              animate={{ opacity: [0.35, 0.7, 0.35], rx: [17, 21, 17] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.ellipse cx="30" cy="77" rx="11" ry="3" fill="rgba(196,181,253,0.45)"
              animate={{ opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} />
          </>
        )}

        {/* corpo/mantello */}
        <path
          d="M30 16 C 20 17 15 26 14 40 L 12 76 L 23 71 L 27 54 L 30 72 L 33 54 L 37 71 L 48 76 L 46 40 C 45 26 40 17 30 16 Z"
          fill={`url(#${gradId})`}
          stroke={extracted ? 'rgba(167,139,250,0.55)' : 'rgba(100,116,139,0.35)'}
          strokeWidth="1" />

        {/* testa/cappuccio */}
        <path
          d="M30 2 C 23 2 19 7 19 13 C 19 18 22 22 26 23.5 L 34 23.5 C 38 22 41 18 41 13 C 41 7 37 2 30 2 Z"
          fill={extracted ? '#140a24' : '#141821'}
          stroke={extracted ? 'rgba(167,139,250,0.5)' : 'rgba(100,116,139,0.3)'}
          strokeWidth="1" />

        {/* occhi luminosi */}
        {extracted ? (
          <motion.g animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 1.9, repeat: Infinity }}>
            <circle cx="26.2" cy="12.5" r="1.9" fill="#67e8f9" />
            <circle cx="33.8" cy="12.5" r="1.9" fill="#67e8f9" />
            <circle cx="26.2" cy="12.5" r="3.6" fill="rgba(103,232,249,0.25)" />
            <circle cx="33.8" cy="12.5" r="3.6" fill="rgba(103,232,249,0.25)" />
          </motion.g>
        ) : (
          <text x="30" y="17" textAnchor="middle" fontSize="10" fontWeight="900" fill="#334155">?</text>
        )}
      </svg>
    </motion.div>
  );
}

// ── CINEMATICA DI ESTRAZIONE ─────────────────────────────────────────────────
// fx: { t, disc, rank }
export function ShadowRiseFx({ fx, onDone }) {
  const playedRef = useRef(0);
  const riseRef = useRef(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    if (!fx || fx.t === playedRef.current) return undefined;
    playedRef.current = fx.t;
    playGong({ power: 1.1 });
    setTimeout(() => { if (!playSample('unlock', { volume: 0.55 })) playEpicDing({ enabled: true }); }, 650);
    if (riseRef.current) {
      gsap.fromTo(riseRef.current,
        { y: 90, opacity: 0, scale: 0.7 },
        { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out', delay: 0.25 });
    }
    const id = setTimeout(() => onDoneRef.current?.(), 3400);
    return () => clearTimeout(id);
  }, [fx]);

  const motes = Array.from({ length: 16 }, (_, i) => ({
    x: (i / 16) * 100, delay: (i % 8) * 0.14, dur: 1.6 + (i % 5) * 0.2,
  }));

  return (
    <AnimatePresence>
      {fx ? (
        <motion.div key={fx.t}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99] flex items-center justify-center pointer-events-none overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, rgba(30,15,60,0.96) 0%, rgba(5,2,12,0.98) 75%)' }}>

          {/* pulviscolo viola che sale */}
          {motes.map((m, i) => (
            <motion.span key={i}
              className="absolute rounded-full"
              style={{ left: `${m.x}%`, bottom: -8, width: i % 3 === 0 ? 5 : 3, height: i % 3 === 0 ? 5 : 3, background: i % 2 === 0 ? '#a78bfa' : '#e9d5ff', boxShadow: '0 0 10px rgba(167,139,250,0.9)' }}
              animate={{ y: [0, -420], opacity: [0, 0.9, 0] }}
              transition={{ duration: m.dur, repeat: Infinity, delay: m.delay, ease: 'easeOut' }} />
          ))}

          <div className="relative flex flex-col items-center">
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-[10px] font-black tracking-[0.5em] mb-2"
              style={{ color: '#c4b5fd', fontFamily: 'Orbitron, sans-serif' }}>
              ⌈ ESTRAZIONE ⌋
            </motion.p>

            {/* Il soldato che si alza dal terreno */}
            <div ref={riseRef} style={{ opacity: 0 }}>
              <ShadowSoldier extracted size={110} />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}
              className="text-xl font-black tracking-widest mt-3 text-center"
              style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 18px rgba(139,92,246,0.9), 0 0 44px rgba(139,92,246,0.6)' }}>
              OMBRA ESTRATTA
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: 1.6 }}
              className="text-[11px] font-bold tracking-[0.3em] mt-1 text-center"
              style={{ color: '#a78bfa' }}>
              {fx.disc} · GRADO {fx.rank}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ delay: 2.1, duration: 1.1 }}
              className="text-[9px] tracking-[0.35em] mt-4"
              style={{ color: '#7c6a9c', fontFamily: 'Orbitron, sans-serif' }}>
              [SYSTEM] ALZATI. COMBATTI PER ME.
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

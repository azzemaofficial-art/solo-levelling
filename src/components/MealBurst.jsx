// ─────────────────────────────────────────────────────────────────────────────
// Burst cinematico quando si aggiunge cibo/acqua: figura 3D del piatto che
// appare (ciotola + riso + vapore / goccia), pennellata d'inchiostro,
// particelle oro, barra che sale col suono. Zero asset: tutto procedurale.
// fx: { t, kind: meal|protein|water, delta, unit, before, after, fromPct, toPct, slot }
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { playSfx, playEatCrunch, playBarRise, playSample } from '../utils/sfx';
import FoodFigure from './FoodFigure';

// Popup del ramen con sfondo TRASPARENTE. Prima si era provato con video
// HEVC-alpha (per Safari/iPhone) + VP9-alpha (per il resto): sul telefono reale
// dell'utente non partiva (autoplay/decode bloccato, non verificabile da qui
// senza un iPhone fisico). GIF invece: trasparenza binaria, supporto garantito
// in un <img> su OGNI browser, zero rischio di codec — meno morbida sui bordi
// del video, ma è quella che funziona per davvero.
const RAMEN_GIF = '/ramen_popup_v4/ramen_popup.gif';
// Durata reale della clip (16 frame, ~2.28s): il burst resta a schermo almeno tanto.
const RAMEN_MS = 2280;

const KIND = {
  meal: { emoji: '🍜', label: 'PASTO', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)', img: RAMEN_GIF },
  protein: { emoji: '🍗', label: 'PROTEINE', color: '#34d399', glow: 'rgba(52,211,153,0.5)' },
  water: { emoji: '💧', label: 'ACQUA', color: '#38bdf8', glow: 'rgba(56,189,248,0.5)' },
};

// Preload: il primo burst non deve aspettare il download del gif.
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  const preloadImg = new Image();
  preloadImg.src = RAMEN_GIF;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export default function MealBurst({ fx, onDone, soundEnabled = true, soundTheme = 'solo' }) {
  const playedRef = useRef(0);
  const stageRef = useRef(null);
  const [imgFailed, setImgFailed] = useState(false);
  // onDone arriva inline (identità nuova a ogni render): se finisse nelle deps,
  // il cleanup cancellerebbe il timeout di chiusura e il burst resterebbe incollato.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    if (!fx || fx.t === playedRef.current) return undefined;
    playedRef.current = fx.t;
    setImgFailed(false);
    if (soundEnabled) {
      // Campioni reali (Mixkit) con fallback sintetico
      if (fx.kind === 'water') {
        if (!playSample('water', { volume: 0.55 })) playSfx('bar', true, soundTheme);
      } else {
        if (!playSample('eat', { volume: 0.55 })) playEatCrunch({ enabled: true });
        playSfx('eat', true, soundTheme);
      }
      // Suono della barra sincronizzato con l'animazione della barra (0.22s)
      setTimeout(() => playBarRise({ enabled: true, from: fx.fromPct, to: fx.toPct }), 220);
    }
    // Ingresso GSAP: la figura sbuca con overshoot
    if (stageRef.current && !prefersReducedMotion()) {
      gsap.fromTo(stageRef.current,
        { scale: 0.4, y: 46, opacity: 0, rotate: -6 },
        { scale: 1, y: 0, opacity: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.7)' });
    }
    // Il pasto mostra la clip del ramen: resta finché la clip non è finita
    // (+ mezzo secondo per leggere kcal/nome) invece di sparire a metà.
    const hold = fx.kind === 'meal' ? RAMEN_MS + 500 : 2400;
    const id = setTimeout(() => onDoneRef.current?.(), hold);
    return () => clearTimeout(id);
  }, [fx, soundEnabled, soundTheme]);

  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (fx?.t || 0) % 1;
    const dist = 68 + ((i * 37) % 42);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, d: 0.04 + (i % 5) * 0.03 };
  }), [fx?.t]);

  const k = KIND[fx?.kind] || KIND.meal;
  // Se la gif non carica (rete/offline), la ciotola SVG disegnata fa da backup:
  // l'animazione non resta MAI vuota. (dopo la dichiarazione di k!)
  const showGif = k.img && !imgFailed;
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {fx ? (
        <motion.div key={fx.t}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none">
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

            {/* Nome del cibo mangiato — NEON, visibile per poco tempo */}
            {fx.name && !reduced && (
              <motion.p
                initial={{ opacity: 0, scale: 1.7, filter: 'blur(8px)' }}
                animate={{ opacity: [0, 1, 1, 0], scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 2.1, times: [0, 0.15, 0.78, 1], ease: 'easeOut' }}
                className="text-base font-black uppercase tracking-[0.22em] z-10 text-center px-3 -mb-1"
                style={{
                  color: '#fff', fontFamily: 'Orbitron, sans-serif',
                  textShadow: `0 0 5px ${k.color}, 0 0 16px ${k.color}, 0 0 36px ${k.glow}`,
                }}>
                {fx.name}
              </motion.p>
            )}

            {/* Figura del cibo: gif del pasto / SVG animato / emoji se reduced-motion */}
            <div ref={stageRef} className="relative z-10" style={{ width: 200, height: 200, filter: `drop-shadow(0 0 22px ${k.glow})` }}>
              {!reduced && (
                <motion.div className="absolute inset-0 rounded-full"
                  animate={{ opacity: [0.4, 0.85, 0.4], scale: [1, 1.13, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ background: `radial-gradient(circle, ${k.glow} 0%, transparent 62%)` }} />
              )}
              {reduced ? (
                <div className="w-full h-full flex items-center justify-center text-6xl">{k.emoji}</div>
              ) : showGif ? (
                // Nessun bordo/sfondo: il gif ha l'alpha, deve sembrare ritagliato sullo schermo.
                <img key={fx.t} src={k.img} alt="" draggable="false"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-contain relative z-10"
                  style={{ filter: `drop-shadow(0 0 18px ${k.glow})` }} />
              ) : (
                <FoodFigure kind={fx.kind} />
              )}
            </div>

            {/* Particelle oro */}
            {!reduced && particles.map((p, i) => (
              <motion.span key={i}
                className="absolute rounded-full z-0"
                style={{ width: i % 3 === 0 ? 5 : 3, height: i % 3 === 0 ? 5 : 3, background: i % 4 === 0 ? '#fff' : k.color, boxShadow: `0 0 8px ${k.glow}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.7, delay: p.d, ease: 'easeOut' }} />
            ))}

            {/* Calorie — NEON, visibili per poco tempo */}
            <motion.p
              initial={{ opacity: 0, y: 12, scale: 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], y: 0, scale: [0.7, 1.12, 1, 0.95] }}
              transition={{ duration: 2.15, times: [0, 0.12, 0.75, 1], ease: 'easeOut' }}
              className="text-lg font-black tracking-widest z-10"
              style={{
                color: '#fff', fontFamily: 'Orbitron, sans-serif',
                textShadow: `0 0 6px ${k.color}, 0 0 18px ${k.color}, 0 0 34px ${k.glow}`,
              }}>
              +{fx.delta}{fx.unit || ' kcal'}{fx.name ? '' : ` · ${k.label}`}
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
                  transition={{ duration: 0.7, delay: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
                  style={{ background: `linear-gradient(90deg, ${k.color}, #fff)`, boxShadow: `0 0 12px ${k.glow}` }} />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

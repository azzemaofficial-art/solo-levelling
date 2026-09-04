// ─────────────────────────────────────────────────────────────────────────────
// SHADOW SPARRING — il coach diventa l'avversario.
// Lancia attacchi (voce + countdown), tu reagisci in tempo reale, la camera
// giudica: sprawl per i takedown, guardia alta per i colpi, contrattacco bonus.
// readState() dal Coach: { kin: [{t,eL,eR,kL,kR}], lm: landmarks MediaPipe }.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ATTACK_TYPES, buildAttackSequence, reactionWindow, gradeReaction,
  computeFightIq, nextLevel, detectSprawl, detectGuard, detectCounter,
} from '../../lib/fightIq.js';

const ATTACKS_PER_ROUND = 8;
const GRADE_STYLE = {
  perfect: { label: 'PERFECT', color: '#4ade80' },
  good: { label: 'BENE', color: '#38bdf8' },
  late: { label: 'IN RITARDO', color: '#fbbf24' },
  missed: { label: 'COLPITO', color: '#ef4444' },
};

// Landmark → stato guardia (polsi vs spalle, y normalizzata)
function guardFromLandmarks(lm) {
  if (!lm || !lm[11] || !lm[12] || !lm[15] || !lm[16]) return null;
  return { wL: lm[15].y, wR: lm[16].y, shL: lm[11].y, shR: lm[12].y };
}

export default function ShadowSparring({ active, onExit, readState, speak, onComplete }) {
  const [phase, setPhase] = useState('idle');          // idle|intro|fight|report
  const [attackIdx, setAttackIdx] = useState(0);
  const [sequence, setSequence] = useState([]);
  const [level, setLevel] = useState(2);
  const [results, setResults] = useState([]);
  const [lastGrade, setLastGrade] = useState(null);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);

  const callTimeRef = useRef(0);
  const windowRef = useRef(1600);
  const pollingRef = useRef(null);
  const judgedRef = useRef(false);
  const guardHoldRef = useRef(0);

  const currentAttack = sequence[attackIdx] || null;
  const attack = currentAttack ? ATTACK_TYPES[currentAttack] : null;
  const currentWin = currentAttack ? reactionWindow(currentAttack, level) : 1600;

  const startRound = (lvl) => {
    setLevel(lvl);
    setSequence(buildAttackSequence(ATTACKS_PER_ROUND, lvl, Date.now() % 100000));
    setResults([]);
    setScore(0);
    setAttackIdx(0);
    setLastGrade(null);
    setPhase('intro');
    setCountdown(3);
    speak?.(`Shadow sparring, livello ${lvl}. Preparati a reagire.`, true);
  };

  // Conto alla rovescia introduttivo
  useEffect(() => {
    if (phase !== 'intro') return undefined;
    if (countdown <= 0) { setPhase('fight'); return undefined; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 900);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  // Giudica la reazione corrente
  const judge = (reacted, reactTimeMs, countered) => {
    if (judgedRef.current) return;
    judgedRef.current = true;
    clearInterval(pollingRef.current);
    const g = gradeReaction({ reacted, reactTimeMs, windowMs: windowRef.current, countered });
    setLastGrade({ ...g, attack: currentAttack });
    setResults((r) => [...r, g]);
    setScore((s) => s + g.points);
    setTimeout(() => {
      setLastGrade(null);
      if (attackIdx + 1 >= sequence.length) {
        setPhase('report');
      } else {
        setAttackIdx((i) => i + 1);
      }
    }, 850);
  };

  // Chiamata dell'attacco + polling della reazione
  useEffect(() => {
    if (phase !== 'fight' || !currentAttack || !attack || lastGrade) return undefined;
    judgedRef.current = false;
    guardHoldRef.current = 0;
    windowRef.current = currentWin;
    callTimeRef.current = performance.now();
    speak?.(attack.voice, true);

    const deadline = setTimeout(() => judge(false, windowRef.current, false), windowRef.current + 80);
    pollingRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - callTimeRef.current;
      const state = readState?.() || {};
      const kin = state.kin || [];
      const lm = state.lm;
      if (attack.react === 'sprawl') {
        const r = detectSprawl(kin.filter((s) => s.t >= callTimeRef.current - 200), callTimeRef.current, windowRef.current);
        if (r.detected) judge(true, r.timeMs, false);
      } else {
        // colpi: guardia alta sostenuta (300ms) = difesa; un pugno = contrattacco
        const g = guardFromLandmarks(lm);
        if (g && detectGuard(g)) {
          guardHoldRef.current += 60;
          if (guardHoldRef.current >= 300) {
            const c = detectCounter(kin.filter((s) => s.t >= callTimeRef.current - 200), callTimeRef.current, windowRef.current);
            judge(true, Math.max(120, elapsed - 300), c.detected);
          }
        } else {
          guardHoldRef.current = 0;
          const c = detectCounter(kin.filter((s) => s.t >= callTimeRef.current - 200), callTimeRef.current, windowRef.current);
          if (c.detected) judge(true, c.timeMs, true);
        }
      }
    }, 60);

    return () => { clearTimeout(deadline); clearInterval(pollingRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, attackIdx, sequence, level]);

  const iq = computeFightIq(results);

  useEffect(() => {
    if (phase === 'report' && onComplete) onComplete(iq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!active) return null;

  const gStyle = lastGrade ? GRADE_STYLE[lastGrade.grade] : null;

  return (
    <div className="absolute inset-0 z-[60] flex flex-col pointer-events-none">
      {/* HUD in alto: score + progresso */}
      <div className="flex justify-center mt-14 pointer-events-none">
        <div className="flex items-center gap-4 rounded-2xl px-5 py-2"
          style={{ background: 'rgba(6,10,20,0.85)', border: '1px solid rgba(239,68,68,0.45)', backdropFilter: 'blur(8px)' }}>
          <p className="text-[9px] font-black tracking-[0.25em]" style={{ color: '#f87171', fontFamily: 'Orbitron, sans-serif' }}>
            🥊 SHADOW SPARRING · LIV {level}
          </p>
          <p className="text-sm font-black" style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif' }}>{score} PT</p>
          <p className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>
            {Math.min(attackIdx + 1, sequence.length)}/{sequence.length}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      {/* Zona centrale: countdown / attacco / esito / report */}
      <div className="flex justify-center pb-56 pointer-events-none">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <motion.p key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-black" style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 30px rgba(239,68,68,0.8)' }}>
                {countdown > 0 ? countdown : 'VIA'}
              </motion.p>
            </motion.div>
          )}

          {phase === 'fight' && attack && !lastGrade && (
            <motion.div key={`atk-${attackIdx}`} initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center px-6 py-4 rounded-3xl"
              style={{ background: 'rgba(6,10,20,0.88)', border: '2px solid rgba(239,68,68,0.6)', boxShadow: '0 0 34px rgba(239,68,68,0.3)' }}>
              <p className="text-[10px] font-black tracking-[0.3em] mb-1" style={{ color: '#f87171', fontFamily: 'Orbitron, sans-serif' }}>
                {attack.cat === 'takedown' ? '⚠ REAGISCI: SPRAWL' : '⚠ DIFENDI O CONTRATTACCA'}
              </p>
              <p className="text-3xl font-black" style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 20px rgba(239,68,68,0.7)' }}>
                {attack.label}
              </p>
              <motion.div className="h-1.5 rounded-full mt-3 mx-auto" style={{ background: 'rgba(239,68,68,0.85)', width: '70%' }}
                initial={{ scaleX: 1 }} animate={{ scaleX: 0 }}
                transition={{ duration: currentWin / 1000, ease: 'linear' }}
                key={`bar-${attackIdx}`} />
            </motion.div>
          )}

          {phase === 'fight' && lastGrade && gStyle && (
            <motion.div key={`res-${attackIdx}`} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center px-8 py-4 rounded-3xl"
              style={{ background: 'rgba(6,10,20,0.9)', border: `2px solid ${gStyle.color}`, boxShadow: `0 0 34px ${gStyle.color}55` }}>
              <p className="text-3xl font-black" style={{ color: gStyle.color, fontFamily: 'Orbitron, sans-serif', textShadow: `0 0 18px ${gStyle.color}` }}>
                {gStyle.label}
              </p>
              <p className="text-[11px] font-bold mt-1" style={{ color: '#cbd5e1' }}>+{lastGrade.points} pt</p>
            </motion.div>
          )}

          {phase === 'report' && (
            <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-center px-8 py-5 rounded-3xl pointer-events-auto"
              style={{ background: 'rgba(6,10,20,0.94)', border: '1px solid rgba(251,191,36,0.5)', boxShadow: '0 0 40px rgba(251,191,36,0.2)' }}>
              <p className="text-[10px] font-black tracking-[0.35em]" style={{ color: '#fbbf24', fontFamily: 'Orbitron, sans-serif' }}>FIGHT IQ</p>
              <p className="text-5xl font-black my-1" style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 26px rgba(251,191,36,0.8)' }}>{iq}</p>
              <p className="text-[11px] mb-3" style={{ color: '#94a3b8' }}>
                {score} punti · livello {level} · {results.filter((r) => r.grade === 'perfect').length} perfette
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => startRound(nextLevel(iq, level))}
                  className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest"
                  style={{ background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', color: '#1c1204', fontFamily: 'Orbitron, sans-serif' }}>
                  ▶ LIVELLO {nextLevel(iq, level)}
                </button>
                <button onClick={onExit}
                  className="px-4 py-2 rounded-xl text-[10px] font-black tracking-widest"
                  style={{ background: 'rgba(148,163,184,0.2)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)', fontFamily: 'Orbitron, sans-serif' }}>
                  ESCI
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ESCI durante il round */}
      {(phase === 'fight' || phase === 'intro') && (
        <button onClick={onExit}
          className="absolute top-4 right-4 z-[61] px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest pointer-events-auto"
          style={{ background: 'rgba(239,68,68,0.85)', color: '#fff', fontFamily: 'Orbitron, sans-serif' }}>
          ✕ FINE
        </button>
      )}
    </div>
  );
}

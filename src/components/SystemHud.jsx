// ─────────────────────────────────────────────────────────────────────────────
// HUD OLOGRAFICO — finestre di sistema fluttuanti sopra il video live, come
// il HUD di Solo Leveling. Legge lo stato ogni ~700ms via getSnapshot().
// pointer-events-none: mai d'intralcio ai comandi.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dailyQuest } from '../../lib/quests.js';

const CLAIM_KEY = 'shadow_monarch_quest_claim';
const todayKey = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

function Corners({ color = 'rgba(56,189,248,0.75)' }) {
  const s = { width: 9, height: 9, position: 'absolute', borderColor: color, borderStyle: 'solid' };
  return (
    <>
      <span style={{ ...s, top: -1, left: -1, borderWidth: '1.5px 0 0 1.5px' }} />
      <span style={{ ...s, top: -1, right: -1, borderWidth: '1.5px 1.5px 0 0' }} />
      <span style={{ ...s, bottom: -1, left: -1, borderWidth: '0 0 1.5px 1.5px' }} />
      <span style={{ ...s, bottom: -1, right: -1, borderWidth: '0 1.5px 1.5px 0' }} />
    </>
  );
}

const winStyle = {
  background: 'rgba(6,10,20,0.72)',
  border: '1px solid rgba(56,189,248,0.35)',
  boxShadow: '0 0 18px rgba(56,189,248,0.14)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

const fmtTime = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function SystemHud({ active, getSnapshot }) {
  const [snap, setSnap] = useState(null);
  const [questState, setQuestState] = useState(null);

  useEffect(() => {
    if (!active || typeof getSnapshot !== 'function') return undefined;
    const poll = () => {
      try {
        setSnap(getSnapshot());
        const today = todayKey();
        const q = dailyQuest(today, 0);
        let claim = null;
        try { claim = JSON.parse(localStorage.getItem(CLAIM_KEY)); } catch {}
        const checks = claim?.date === today ? claim.checks : [false, false, false];
        setQuestState({ disc: q.disc, checks, claimed: claim?.date === today && !!claim?.claimed });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 700);
    return () => clearInterval(id);
  }, [active, getSnapshot]);

  if (!active || !snap) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none" aria-hidden>
      {/* ── FINESTRA QUEST (sotto la top bar, sinistra) ─────────────── */}
      {questState && (
        <motion.div
          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
          className="absolute rounded-xl px-2.5 py-2 space-y-1"
          style={{ ...winStyle, top: 64, left: 10, maxWidth: 168 }}>
          <Corners />
          <p className="text-[8px] font-black tracking-[0.25em]" style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
            ⌈ QUEST {questState.claimed ? '✓' : ''}
          </p>
          <div className="flex items-center gap-1.5">
            {questState.checks.map((c, i) => (
              <span key={i} className="flex-1 h-1 rounded-full"
                style={{ background: c ? '#4ade80' : 'rgba(148,163,184,0.25)', boxShadow: c ? '0 0 6px rgba(74,222,128,0.8)' : 'none' }} />
            ))}
          </div>
          <p className="text-[8px] font-bold" style={{ color: '#94a3b8' }}>
            {questState.checks.filter(Boolean).length}/3 · {questState.disc.toUpperCase()}
          </p>
        </motion.div>
      )}

      {/* ── FINESTRA LIVE (destra): tempo + intensità ───────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
        className="absolute rounded-xl px-2.5 py-2 space-y-1"
        style={{ ...winStyle, top: 64, right: 10, width: 118 }}>
        <Corners />
        <p className="text-[8px] font-black tracking-[0.25em]" style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
          ⌈ LIVE
        </p>
        <p className="text-sm font-black leading-none" style={{ color: '#e2e8f0', fontFamily: 'Orbitron, sans-serif' }}>
          {fmtTime(Math.max(0, snap.elapsedSec || 0))}
        </p>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(51,65,85,0.6)' }}>
          <div className="h-full rounded-full"
            style={{
              width: `${Math.min(100, snap.intensity || 0)}%`,
              background: (snap.intensity || 0) > 66 ? 'linear-gradient(90deg,#ef4444,#fca5a5)' : (snap.intensity || 0) > 33 ? 'linear-gradient(90deg,#f59e0b,#fde68a)' : 'linear-gradient(90deg,#0ea5e9,#7dd3fc)',
              transition: 'width 0.5s ease',
            }} />
        </div>
        <p className="text-[8px] font-bold" style={{ color: '#64748b' }}>⚡ INTENSITÀ</p>
      </motion.div>

      {/* ── FINESTRA CALCI (match 3+ round) ─────────────────────────── */}
      <AnimatePresence>
        {snap.matchOn && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
            className="absolute rounded-xl px-3 py-2 text-center"
            style={{ ...winStyle, bottom: 132, left: 10, borderColor: 'rgba(251,191,36,0.45)' }}>
            <Corners color="rgba(251,191,36,0.85)" />
            <p className="text-[8px] font-black tracking-[0.25em]" style={{ color: '#fbbf24', fontFamily: 'Orbitron, sans-serif' }}>🦵 CALCI</p>
            <motion.p key={snap.kicks} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
              className="text-xl font-black leading-none"
              style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 14px rgba(251,191,36,0.7)' }}>
              {snap.kicks || 0}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RIGA SISTEMA (messaggi di stato) ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ opacity: { duration: 2.6, repeat: Infinity } }}
        className="absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1"
        style={{ bottom: 96, background: 'rgba(6,10,20,0.6)', border: '1px solid rgba(56,189,248,0.25)' }}>
        <p className="text-[8px] font-bold tracking-[0.3em] whitespace-nowrap" style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
          [SYSTEM] ANALISI ATTIVA
        </p>
      </motion.div>
    </div>
  );
}

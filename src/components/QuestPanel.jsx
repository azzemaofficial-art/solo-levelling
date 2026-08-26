// ─────────────────────────────────────────────────────────────────────────────
// DAILY QUEST del Sistema — finestra olografica stile Solo Leveling.
// Il Sistema assegna la missione del giorno; completala tutta per l'XP.
// Se ieri hai fallito → PENALTY: il Sistema non dimentica.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dailyQuest, questXp } from '../../lib/quests.js';
import { masteryFromXp } from '../../lib/mastery.js';
import { playSfx, playEpicDing, playSample, playGong } from '../utils/sfx';
import { speakSystem } from '../utils/systemVoice';

const META_KEY = 'shadow_monarch_quest_meta';        // { lastClaim, streak }
const CLAIM_KEY = 'shadow_monarch_quest_claim';      // { date, checks, claimed }
const PENALTY_KEY = 'shadow_monarch_quest_penalty';  // data dell'ultima penalty mostrata
const PROGRESS_KEY = 'shadow_monarch_coach_progress';

const todayKey = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
const yesterdayKey = () => new Date(Date.now() - 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

const DISC_LABEL = {
  muaythai: 'MUAY THAI', boxing: 'BOXE', karate: 'KARATE', taekwondo: 'TAEKWONDO',
  bjj: 'BJJ', mma: 'MMA', kali: 'KALI', sanda: 'COMBAT SANDA', judo: 'JUDO',
  yoga: 'YOGA', running: 'RUNNING',
};
const UNIT_LABEL = { rip: 'ripetizioni', sec: 'secondi', min: 'minuti' };

// Angoli olografici della finestra di sistema
function Corners({ color = 'rgba(56,189,248,0.8)' }) {
  const s = { width: 14, height: 14, position: 'absolute', borderColor: color, borderStyle: 'solid' };
  return (
    <>
      <span style={{ ...s, top: -1, left: -1, borderWidth: '2px 0 0 2px' }} />
      <span style={{ ...s, top: -1, right: -1, borderWidth: '2px 2px 0 0' }} />
      <span style={{ ...s, bottom: -1, left: -1, borderWidth: '0 0 2px 2px' }} />
      <span style={{ ...s, bottom: -1, right: -1, borderWidth: '0 2px 2px 0' }} />
    </>
  );
}

export default function QuestPanel() {
  const [meta, setMeta] = useState(() => readJson(META_KEY, { lastClaim: '', streak: 0 }));
  const [claim, setClaim] = useState(() => readJson(CLAIM_KEY, { date: '', checks: [false, false, false], claimed: false }));
  const [penalty, setPenalty] = useState(false);
  const [xpBurst, setXpBurst] = useState(null);
  const claimedNowRef = useRef(false);

  const today = todayKey();
  const quest = useMemo(() => {
    const progress = readJson(PROGRESS_KEY, {});
    const lvl = Math.floor(masteryFromXp(progress[questDisciplineProbe(today)]?.xp || 0) / 20);
    return dailyQuest(today, lvl);
  }, [today]);

  // Stato della quest di oggi (reset se la memoria è di un altro giorno)
  const state = claim.date === today ? claim : { date: today, checks: [false, false, false], claimed: false };
  const done = state.checks.filter(Boolean).length;
  const allDone = done === quest.exercises.length;

  // PENALTY: streak attiva ma ieri niente quest → il Sistema punisce (una volta al giorno)
  useEffect(() => {
    const seen = readJson(PENALTY_KEY, '');
    if (seen === today) return;
    const missed = meta.streak > 0 && meta.lastClaim && meta.lastClaim !== today && meta.lastClaim !== yesterdayKey();
    if (missed) {
      setPenalty(true);
      playGong({ power: 0.7 });
      playSfx('warning', true, 'solo');
      speakSystem('Missione fallita. Penalità applicata. Il Sistema non dimentica.');
    }
  }, [today, meta.lastClaim, meta.streak]);

  const toggleCheck = (i) => {
    if (state.claimed) return;
    const checks = [...state.checks];
    checks[i] = !checks[i];
    setClaim({ date: today, checks, claimed: false });
    writeJson(CLAIM_KEY, { date: today, checks, claimed: false });
    playSfx(checks[i] ? 'countdown' : 'click', true, 'solo');
  };

  const claimQuest = () => {
    if (!allDone || state.claimed || claimedNowRef.current) return;
    claimedNowRef.current = true;
    const streak = meta.lastClaim === yesterdayKey() ? meta.streak + 1 : 1;
    const progress = readJson(PROGRESS_KEY, {});
    const lvl = Math.floor(masteryFromXp(progress[quest.disc]?.xp || 0) / 20);
    const xp = questXp(lvl, streak);
    // XP alla disciplina della quest → le barre maestria si aggiornano da sole
    progress[quest.disc] = { ...(progress[quest.disc] || {}), xp: (progress[quest.disc]?.xp || 0) + xp };
    writeJson(PROGRESS_KEY, progress);
    try { window.dispatchEvent(new Event('coach-progress-updated')); } catch {}
    const nextClaim = { date: today, checks: state.checks, claimed: true };
    setClaim(nextClaim);
    writeJson(CLAIM_KEY, nextClaim);
    setMeta({ lastClaim: today, streak });
    writeJson(META_KEY, { lastClaim: today, streak });
    setXpBurst({ xp, streak, t: Date.now() });
    if (!playSample('levelup', { volume: 0.5 })) playEpicDing({ enabled: true });
    playSfx('streak', true, 'solo');
    speakSystem(`Quest completata. Ricompensa: ${xp} punti esperienza. Serie di ${streak} giorni.`);
  };

  const dismissPenalty = () => {
    setPenalty(false);
    writeJson(PENALTY_KEY, today);
    // La streak si azzera: il Sistema ha già colpito
    setMeta((m) => ({ ...m, streak: 0 }));
    writeJson(META_KEY, { lastClaim: meta.lastClaim, streak: 0 });
    playSfx('click', true, 'solo');
  };

  const discLabel = DISC_LABEL[quest.disc] || quest.disc.toUpperCase();

  return (
    <>
      {/* ── FINESTRA QUEST ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl p-4 space-y-3 overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, rgba(10,14,26,0.94), rgba(8,10,18,0.9))',
          border: '1px solid rgba(56,189,248,0.35)',
          boxShadow: state.claimed ? '0 0 26px rgba(74,222,128,0.25)' : '0 0 26px rgba(56,189,248,0.18)',
        }}>
        <Corners color={state.claimed ? 'rgba(74,222,128,0.9)' : 'rgba(56,189,248,0.8)'} />
        {/* scanline olografica */}
        <motion.div className="absolute left-0 right-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(56,189,248,0.06), transparent)' }}
          animate={{ top: ['-10%', '110%'] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }} />

        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[0.3em]" style={{ color: '#7dd3fc', fontFamily: 'Orbitron, sans-serif' }}>
            ⌈ DAILY QUEST ⌋
          </p>
          {meta.streak > 0 && (
            <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }}>
              🔥 {meta.streak} {meta.streak === 1 ? 'GIORNO' : 'GIORNI'}
            </motion.span>
          )}
        </div>

        <p className="text-xs" style={{ color: '#94a3b8' }}>
          Il Sistema ha scelto per oggi: <span className="font-black" style={{ color: '#e2e8f0' }}>{discLabel}</span>
        </p>

        <div className="space-y-2">
          {quest.exercises.map((ex, i) => (
            <motion.button key={ex.name} onClick={() => toggleCheck(i)} whileTap={{ scale: 0.97 }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
              style={{
                background: state.checks[i] ? 'rgba(74,222,128,0.1)' : 'rgba(30,41,59,0.5)',
                border: `1px solid ${state.checks[i] ? 'rgba(74,222,128,0.5)' : 'rgba(148,163,184,0.15)'}`,
              }}>
              <motion.span
                animate={state.checks[i] ? { scale: [0, 1.35, 1] } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0"
                style={{
                  background: state.checks[i] ? '#4ade80' : 'transparent',
                  border: state.checks[i] ? 'none' : '1.5px solid rgba(148,163,184,0.4)',
                  color: '#04120a',
                }}>
                {state.checks[i] ? '✓' : ''}
              </motion.span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate" style={{ color: state.checks[i] ? '#86efac' : '#e2e8f0' }}>{ex.name}</span>
                <span className="block text-[10px]" style={{ color: '#64748b' }}>{ex.target} {UNIT_LABEL[ex.unit]}</span>
              </span>
            </motion.button>
          ))}
        </div>

        {/* progresso + claim */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(51,65,85,0.6)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <motion.div className="h-full rounded-full"
              animate={{ width: `${(done / quest.exercises.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
              style={{ background: allDone ? 'linear-gradient(90deg, #4ade80, #bbf7d0)' : 'linear-gradient(90deg, #0ea5e9, #7dd3fc)', boxShadow: allDone ? '0 0 10px rgba(74,222,128,0.7)' : '0 0 10px rgba(56,189,248,0.6)' }} />
          </div>
          {state.claimed ? (
            <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-[11px] font-black tracking-widest whitespace-nowrap"
              style={{ color: '#4ade80', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 12px rgba(74,222,128,0.6)' }}>
              ✓ QUEST COMPLETATA
            </motion.p>
          ) : (
            <motion.button onClick={claimQuest} disabled={!allDone} whileTap={allDone ? { scale: 0.94 } : {}}
              className="px-4 py-2 rounded-xl text-[11px] font-black tracking-widest whitespace-nowrap"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: allDone ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'rgba(51,65,85,0.5)',
                color: allDone ? '#1c1204' : '#64748b',
                boxShadow: allDone ? '0 0 18px rgba(251,191,36,0.55)' : 'none',
              }}>
              RISCATTI
            </motion.button>
          )}
        </div>

        {/* XP burst */}
        <AnimatePresence>
          {xpBurst && (
            <motion.div key={xpBurst.t}
              initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center pt-1">
              <motion.p animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5 }}
                className="text-sm font-black"
                style={{ color: '#fbbf24', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 16px rgba(251,191,36,0.7)' }}>
                +{xpBurst.xp} XP
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── PENALTY: il Sistema non dimentica ─────────────────────────── */}
      <AnimatePresence>
        {penalty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[98] flex items-center justify-center p-6"
            style={{ background: 'rgba(20,0,0,0.88)' }}>
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1, x: [0, -6, 6, -4, 4, 0] }}
              transition={{ x: { duration: 0.45 } }}
              className="relative max-w-sm w-full rounded-2xl p-6 space-y-3 text-center"
              style={{ background: 'linear-gradient(165deg, rgba(50,8,8,0.96), rgba(25,4,4,0.96))', border: '1px solid rgba(239,68,68,0.6)', boxShadow: '0 0 44px rgba(239,68,68,0.35)' }}>
              <Corners color="rgba(239,68,68,0.9)" />
              <p className="text-[11px] font-black tracking-[0.35em]" style={{ color: '#f87171', fontFamily: 'Orbitron, sans-serif' }}>⚠ PENALTY ⚠</p>
              <p className="text-2xl font-black" style={{ color: '#fecaca', fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 18px rgba(239,68,68,0.8)' }}>
                QUEST FALLITA
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>
                Ieri non hai completato la missione del Sistema.<br />
                Il fuoco si spegne. La streak è azzerata.<br />
                <span style={{ color: '#f87171' }}>Il Sistema non dimentica.</span>
              </p>
              <button onClick={dismissPenalty} className="w-full py-2.5 rounded-xl text-xs font-black tracking-widest"
                style={{ background: 'rgba(239,68,68,0.9)', color: '#1c0505', fontFamily: 'Orbitron, sans-serif' }}>
                ACCETTO LA PENITENZA
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Serve solo per il calcolo del livello della quest (evita import circolari)
function questDisciplineProbe(date) {
  try { return dailyQuest(date, 0).disc; } catch { return 'muaythai'; }
}

// Sessione camera live del Coach (tab "Live"): ~210KB, caricata solo quando si apre
// quel tab. Gli helper condivisi restano in Coach.jsx e sono importati da lì.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Lightbulb, Trophy, ScanSearch, Play, Pause, Target, FlipHorizontal2, Volume2, VolumeX, Bone, X, Move, ThumbsUp, ThumbsDown } from 'lucide-react';
import { BREATHING_PROTOCOLS } from '../../lib/breathingProtocols.js';
import { getDiscipline } from '../../lib/martialKnowledge.js';
import { analyzeKinematics, fatigueFromTrend, detectKicks, kickLevelFromMatch } from '../../lib/kinematics.js';
import { createRepCounter } from '../../lib/repCounter.js';
import { techniquesByCat, CAT_LABEL } from '../../lib/techniques.js';
import { fighterLevel, pillarLevels, evalUnlock, lvlToFl, levelTitle } from '../../lib/progression.js';
import RepCoach from '../components/RepCoach';
import ShadowSparring from '../components/ShadowSparring';
import { masteryFromXp } from '../../lib/mastery.js';
import { playEpicDing, playComboHit, playSample } from '../utils/sfx';
import { speakSystem } from '../utils/systemVoice';
import ComboFx from '../components/ComboFx';
import QuestPanel from '../components/QuestPanel';
import SystemHud from '../components/SystemHud';
import AwakeningFx from '../components/AwakeningFx';
import { ShadowSoldier, ShadowRiseFx } from '../components/ShadowArmy';
import { secretsFor, secretOfTheDay } from '../../lib/coachSecrets.js';
import { MARKER_RE, canonicalMarker, normalizeCoachingText, extractCommand } from '../../lib/coachingText.js';
import { buildCoachWorkout } from '../../lib/workouts.js';
import { applyXp } from '../utils/xpLogic';
import { describeProfile, readCutProfile } from '../utils/cutProfile';
import { ALL_DISCIPLINES, BreathingGuide, C, COMBO_MOVE_MS, COOLDOWN_STEPS, CURRICULUM, Coach, ComboAnimator, DISCIPLINE_GROUPS, PRAISE, REACT_DIFFS, RoundConfig, RoundTimerDisplay, RoutineOverlay, ScoreTracker, SkillRadar, StickFigure, WARMUP_STEPS, _prefersReducedMotion, anchorsOf, anglesFromLandmarks, buildBreathingTemplate, buildFitnessTemplate, buildLearnerProfile, buildRunningTemplate, buildStrikeTemplate, buildYogaTemplate, coachLevelOf, coachRankOf, curriculumContext, disciplineRank, drawAnnotatedFrame, isSparring, jointAngle, loadCoachProgress, loadCurrProgress, loadExams, loadSessions, markTopicDate, markTrainDay, masterTitle, matchPose, nextObjective, parsePoint, playGong, pushSkillsHistory, reactionCallsFor, resolveGoal, resolveGoalFromHistory, resolvePose, saveCoachProgress, saveCurrProgress, saveExams, saveFightIq, saveSessions, sceneFor, secretLevelForMode, sessionStats, strikeSurfaceFor, takePendingLive, useRoundTimer } from './Coach.jsx';

export default function VisualCoach({ setPlayerStats, aiStatus }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  // Ref per enqueueSpeak (dichiarata molto più sotto, ~riga 4130): alcuni callback
  // qui sopra (startReps/stopReps) la usano prima di quel punto — mettere
  // enqueueSpeak nella loro dependency array darebbe "Cannot access before
  // initialization" (TDZ), perché le dependency array si valutano subito a ogni
  // render, in ordine, indipendentemente da dove il JSX la chiamerebbe davvero.
  // Stesso pattern già usato in questo file per speakNextRef.
  const enqueueSpeakRef = useRef(() => {});
  const [step, setStep] = useState('setup');
  const [sessionContext, setSessionContext] = useState('');
  const [academyLesson, setAcademyLesson] = useState(null);
  const [studioClock, setStudioClock] = useState({ phase: 'ready', round: 1, left: 120 });
  const [studioPaused, setStudioPaused] = useState(false);
  const [studioCombos, setStudioCombos] = useState(0);
  const [studioSaved, setStudioSaved] = useState(false);
  const studioSamplesRef = useRef([]);
  const studioComboRef = useRef({ armed: { L: false, R: false }, last: null, at: 0, count: 0 });
  const studioLessonRef = useRef(null);
  const studioPhaseRef = useRef('ready');
  studioLessonRef.current = academyLesson;
  studioPhaseRef.current = studioClock.phase;
  const [streaming, setStreaming] = useState(false);
  const wakeLockRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [mode, setMode] = useState('mma');
  const [pastSessions, setPastSessions] = useState(() => loadSessions());
  const [coachProgress, setCoachProgress] = useState(() => loadCoachProgress());
  // ── MEMORIA DEL MAESTRO cross-device: idrata lo storico da KV (coach_sessions)
  // una volta al mount, così errori ricorrenti e focus sopravvivono al cambio
  // telefono/clear storage. Merge per (data+disciplina+titolo), ordinato per ts.
  useEffect(() => {
    let chatId = '';
    try { chatId = window.localStorage.getItem('shadow_monarch_tg_chat_id') || ''; } catch {}
    if (!chatId) return;
    const toTs = (s) => s.ts || (s.date ? new Date(`${String(s.date).split('/').reverse().join('-')}T00:00:00`).toISOString() : '');
    fetch('/api/nvidia/visual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memorySync: true, chatId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const kv = (data?.sessions || []).filter((s) => s && s.mode);
        if (!kv.length) return;
        setPastSessions((prev) => {
          const local = (Array.isArray(prev) ? prev : []).map((s) => ({ ...s, ts: toTs(s) }));
          const seen = new Set(local.map((s) => `${(s.ts || '').slice(0, 10)}|${s.mode}|${String(s.keyFeedback || '').slice(0, 40)}`));
          const merged = [...local];
          for (const s of kv) {
            const dateIt = s.date ? new Date(`${s.date}T00:00:00`).toLocaleDateString('it-IT') : '';
            const key = `${(s.ts || '').slice(0, 10)}|${s.mode}|${String(s.title || '').slice(0, 40)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({
              ts: s.ts || '', date: dateIt, mode: s.mode, score: s.score,
              weaknesses: s.weaknesses || [], focusNext: s.focusNext || [],
              keyFeedback: s.title || '',
            });
          }
          merged.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
          const next = merged.slice(0, 12);
          saveSessions(next);
          return next;
        });
      })
      .catch(() => {});
  }, []);
  const examRef = useRef(null);          // esame milestone in corso: {li, label, milestone, mode}
  const [examBanner, setExamBanner] = useState(null); // mostrato in setup quando arrivi dal curriculum
  // Deep-link dal Curriculum: sessione pre-configurata (argomento del percorso o esame milestone)
  useEffect(() => {
    const p = takePendingLive();
    if (!p || !p.mode) return;
    setMode(p.mode);
    setSessionContext(p.context || '');
    if (p.mirror) {
      setMirrorTech(p.mirror);
      setMirrorOn(true);
      setSkeletonOn(true);
    }
    if (p.academyLesson) setAcademyLesson(p.academyLesson);
    if (p.exam) {
      examRef.current = { ...p.exam, mode: p.mode };
      setExamBanner({ label: p.exam.label, milestone: p.exam.milestone });
    } else if (p.context) {
      setExamBanner({ objective: p.context });
      // Se la sessione punta a un argomento del percorso, a fine sessione con voto ≥80
      // l'argomento viene segnato appreso automaticamente (cerchio chiuso).
      const m = p.context.match(/imparare "([^"]+)"/);
      if (m) pendingObjectiveRef.current = { topic: m[1], mode: p.mode };
    }
  }, []);
  // Cambio disciplina manuale → l'esame/obiettivo pre-caricato decade
  useEffect(() => {
    if (examRef.current && examRef.current.mode !== mode) { examRef.current = null; setExamBanner(null); }
  }, [mode]);
  // 🔒 Wake Lock: durante la sessione live lo schermo non deve MAI spegnersi (telefono
  // appoggiato in palestra, mani occupate). Si ri-acquisisce al ritorno in foreground
  // perché iOS lo rilascia a ogni cambio di visibilità.
  useEffect(() => {
    if (!streaming || !('wakeLock' in navigator)) return undefined;
    let released = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible' || released) return;
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (_) { /* non supportato o negato: la sessione funziona comunque */ }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', acquire);
      try { wakeLockRef.current?.release(); } catch (_) {}
      wakeLockRef.current = null;
    };
  }, [streaming]);
  // ── Nuove funzioni live: round solo, angolo, reflex, intensità, routine ──────
  const [roundsOn, setRoundsOn] = useState(false);        // round timer anche in solo
  const [cornerMsg, setCornerMsg] = useState(null);       // {talk, breath} | {loading} durante il rest
  const roundStartIdxRef = useRef(0);                     // indice verdetti a inizio round
  const prevPhaseRef = useRef('idle');
  const [reactOn, setReactOn] = useState(false);          // reaction trainer
  const [reactDiff, setReactDiff] = useState('medio');
  const [reactCall, setReactCall] = useState('');
  const [reactCount, setReactCount] = useState(0);
  const reactTimerRef = useRef(null);
  const reactOnRef = useRef(false);
  const timerPhaseRef = useRef('idle');
  // ── COACH VOCALE MANI-LIBERE (conta ripetizioni ad alta voce) ──
  const [repMode, setRepMode] = useState(null);           // 'squat'|'push'|'kicks'|null
  const [vcCount, setVcCount] = useState(0);              // contatore vocale (repCount è del guided)
  const repCounterRef = useRef(null);
  const repModeRef = useRef(null);                        // specchio per il loop rAF
  const repBadStreakRef = useRef(0);
  const lastRepVoiceRef = useRef(0);

  const startReps = useCallback((m) => {
    repCounterRef.current = createRepCounter(m);
    repModeRef.current = m;
    repBadStreakRef.current = 0;
    setRepMode(m);
    setVcCount(0);
    const label = { squat: 'squat', push: 'piegamenti', kicks: 'calci', punch: 'pugni' }[m] || 'ripetizioni';
    enqueueSpeakRef.current(`Serie di ${label}. Parti quando vuoi, conto io.`, true);
  }, []);

  const stopReps = useCallback(() => {
    const n = repCounterRef.current?.count || 0;
    repCounterRef.current = null;
    repModeRef.current = null;
    setRepMode(null);
    if (n > 0) {
      enqueueSpeakRef.current(`Serie finita: ${n} ripetizioni.`, true);
      playEpicDing({ enabled: true });
      // XP alla disciplina attiva → barre maestria si aggiornano da sole
      try {
        const p = loadCoachProgress();
        const cur = p[mode] || {};
        p[mode] = { ...cur, xp: (cur.xp || 0) + Math.min(60, 8 + n * 2) };
        saveCoachProgress(p);
      } catch {}
    }
    setVcCount(0);
  }, [mode]);

  // ── SHADOW SPARRING — il coach diventa l'avversario ──
  const [shadowOn, setShadowOn] = useState(false);
  const handleShadowComplete = useCallback((iq) => {
    try {
      const p = loadCoachProgress();
      const cur = p[mode] || {};
      p[mode] = { ...cur, xp: (cur.xp || 0) + Math.min(100, iq) };
      saveCoachProgress(p);
    } catch {}
    saveFightIq(iq); // il miglior Fight IQ alimenta LA SCALATA
    speakSystem(`Round di shadow sparring completato. Fight IQ ${iq}.`);
  }, [mode]);

  // ── CONTATORE CALCI DA MATCH (camera, da 3+ round) ──
  const matchKicksRef = useRef({ tot: 0, sx: 0, dx: 0, peaks: [] });
  const kickStateRef = useRef({ lastKickT: { kL: -1e9, kR: -1e9 } });
  const matchCtxRef = useRef({ active: false, rounds: 0 }); // specchiato: l'effetto rAF non si ricrea
  const [kickReport, setKickReport] = useState(null);
  const [intensity, setIntensity] = useState(0);          // intensità movimento 0-100 (EMA)
  const intensityRef = useRef(0);
  const prevLmRef = useRef(null);
  const lastIntSetRef = useRef(0);
  const pendingObjectiveRef = useRef(null);               // argomento percorso da auto-segnare se voto ≥80
  const [warmupKind, setWarmupKind] = useState(null);     // 'warmup' | 'cooldown' | null
  // pastSessions cambia dopo ogni pagella → ricalcola obiettivo (post auto-apprendimento) e stats
  const liveObjective = useMemo(() => nextObjective(mode), [mode, pastSessions]);
  const liveStats = useMemo(() => sessionStats(), [pastSessions]);
  const [rounds, setRounds] = useState(3);
  const [roundDuration, setRoundDuration] = useState(180);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [lastPoint, setLastPoint] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSlow, setVoiceSlow] = useState(true);   // voce lenta e scandita (default: più facile da seguire)
  const [skeletonOn, setSkeletonOn] = useState(true);
  // ── Respirazione guidata (protocolli con fasi temporizzate) ─────────────────
  const [breathingProtocolId, setBreathingProtocolId] = useState(BREATHING_PROTOCOLS[0].id);
  const [showBreathingGuide, setShowBreathingGuide] = useState(false);
  const [centered, setCentered] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);
  const voicesRef = useRef([]);
  const sessionStartRef = useRef(null);
  const analyzingRef = useRef(false);
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const poseRef = useRef(null);
  const feedbackHistoryRef = useRef([]);
  const sessionFeedbacksRef = useRef([]);
  const insistedRef = useRef([]);       // su cosa il maestro ha già insistito in QUESTA sessione (per rincarare)
  const pastSessionsRef = useRef([]);   // storico in ref: il loop di analisi lo legge senza doversi ricreare
  useEffect(() => { pastSessionsRef.current = pastSessions; }, [pastSessions]);
  // Il difetto storico #1 di questa disciplina: mostrato a schermo così sai cosa ti sta guardando.
  const learnerHunt = useMemo(() => {
    const p = buildLearnerProfile(pastSessions, mode);
    return p?.recurring?.[0]?.split(':')[0] || null;
  }, [pastSessions, mode]);
  const speakQueueRef = useRef([]);   // coda comandi da mostrare/leggere uno alla volta
  const presentingRef = useRef(false); // true mentre un comando è a schermo + in lettura
  const lastLandmarksRef = useRef(null); // ultimi landmark MediaPipe → angoli reali per l'AI
  const trailRef = useRef([]);           // scia polsi/caviglie → disegnata sul frame annotato per l'AI
  const kinHistRef = useRef([]);         // storia angolari (~3.5s) → velocità/rep-quality (lib/kinematics)
  const trendRef = useRef([]);           // campioni lenti (stance/guardia ogni ~5s) → segnali fatica
  const lastTrendTRef = useRef(0);
  const lastFramingVoiceRef = useRef(0); // coaching vocale inquadratura (throttle 20s)
  // ── SPECCHIO (corpo vs ideale) — feedback deterministico dallo scheletro ──
  const [mirrorOn, setMirrorOn] = useState(false);
  const [mirrorTech, setMirrorTech] = useState('guard');   // tecnica da rispecchiare (manuale)
  const [mirrorState, setMirrorState] = useState(null);    // {score, joint, hints}
  const [mirrorTargetKey, setMirrorTargetKey] = useState('guard');
  const mirrorOnRef = useRef(false);
  const mirrorTargetRef = useRef('guard');
  const mirrorMatchRef = useRef(null);
  const mirrorStateAtRef = useRef(0);
  const mirrorSpeakRef = useRef({ t: 0, msg: '' });
  // ── Workout del maestro: fasi guidate con insegnamento + correzione live ──
  const [workout, setWorkout] = useState(null);        // { phases, idx, left }
  const workoutRef = useRef(null);
  const workoutSeedRef = useRef(0);
  const observationsRef = useRef([]);  // osservazioni accumulate in auto (osserva N → 1 verdetto)
  const [observeProgress, setObserveProgress] = useState(0);
  // ── Cattura dati per l'alveare: ogni verdetto = 1 campione (angoli + esito + 👍/👎) ──
  const pendingSampleRef = useRef(null); // ultimo verdetto in attesa di etichetta/invio
  const [sampleFeedback, setSampleFeedback] = useState(null); // null | 'shown' | 'up' | 'down'
  const [sampleCount, setSampleCount] = useState(0);          // campioni inviati in sessione
  const [framingHint, setFramingHint] = useState('');     // avviso "inquadra il corpo"
  const [trackQuality, setTrackQuality] = useState('none'); // full | upper | partial | none
  const lastLocalQualityRef = useRef('none');
  const [repCount, setRepCount] = useState(0);            // conta-ripetizioni (guidato)
  const repCountRef = useRef(0);
  const repPhaseRef = useRef('up');
  const guidedRunningRef = useRef(false);
  const VERDICT_EVERY = 3;             // il maestro osserva 3 momenti, poi dà UN verdetto
  // ── Modalità GUIDATA (circuito drill su misura) ─────────────────────────────
  const [guidedOn, setGuidedOn] = useState(false);
  const [guidedPlan, setGuidedPlan] = useState([]);        // [{name,durationSec,focus,watchFor}]
  const [guidedIdx, setGuidedIdx] = useState(0);
  const [guidedPhase, setGuidedPhase] = useState('idle');  // idle|gen|ready|running|review|done
  const [guidedTimeLeft, setGuidedTimeLeft] = useState(0);
  const [guidedReview, setGuidedReview] = useState(null);  // {good[],fix[],score,cue}
  const [guidedAutoAdvance, setGuidedAutoAdvance] = useState(false);
  const [guidedLoading, setGuidedLoading] = useState(false);
  const [guidedLevel, setGuidedLevel] = useState('intermedio');
  const guidedTimerRef = useRef(null);   // countdown 1s
  const guidedTickRef = useRef(null);    // osservazione durante il drill
  const guidedObsRef = useRef([]);       // osservazioni del drill corrente
  const [sessionAnalysis, setSessionAnalysis] = useState(null);
  const [analyzingSession, setAnalyzingSession] = useState(false);
  // ── Pagella di fine sessione (voto + progressione salvata su Obsidian) ──
  const sessionVerdictsRef = useRef([]);   // comandi chiave raccolti nella sessione
  const [sessionReport, setSessionReport] = useState(null); // {report:{...}} | {loading:true}

  // ── Modalità COMBO A COMANDO ─────────────────────────────────────────────────
  const [comboOn, setComboOn] = useState(false);
  const [comboPhase, setComboPhase] = useState('idle'); // idle|calling|go|judging|result
  const [currentCombo, setCurrentCombo] = useState('');
  const [comboCountdown, setComboCountdown] = useState(3);
  const [comboResult, setComboResult] = useState(null); // {grade, feedback, nextCombo}
  const [comboFx, setComboFx] = useState(null);         // cinematico SUPER COMBO/COMBO
  const [comboScore, setComboScore] = useState({ perfect: 0, good: 0, redo: 0 });
  const comboPhaseRef = useRef('idle');
  const comboTimerRef = useRef(null);
  // Pausa combo: congela la demo/il countdown senza avanzare, per studiare la tecnica con calma.
  const [comboPaused, setComboPaused] = useState(false);
  const comboPausedRef = useRef(false);
  useEffect(() => { comboPausedRef.current = comboPaused; }, [comboPaused]);
  // Coda locale di focus→voto in attesa di sync: si accumula e parte in UN'unica chiamata ogni
  // 5 voci (o a fine sessione) invece di una richiesta per ogni combo giudicata — riduce le
  // invocazioni serverless (Fluid Compute costa a consumo di CPU/memoria attiva).
  const pendingComboFocusRef = useRef([]);
  const flushComboFocus = useCallback(() => {
    if (!pendingComboFocusRef.current.length) return;
    const batch = pendingComboFocusRef.current;
    pendingComboFocusRef.current = [];
    fetch('/api/nvidia/visual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webPrefs: { comboFocus: batch } }),
    }).catch(() => {});
  }, []);

  // Ogni combo è ora { c: stringa combo, lvl: 'base'|'intermedio'|'avanzato', focus: 'potenza'|'velocità'|'difesa'|'counter'|'clinch' }
  // pickCombo (sotto) continua a restituire SEMPRE una stringa semplice — nessun consumer va toccato.
  const COMBO_LIBRARY = {
    boxing: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: '1-2-3', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Double Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Gancio Corpo', lvl: 'base', focus: 'potenza' },
      { c: 'Slip-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Uppercut', lvl: 'intermedio', focus: 'potenza' },
      { c: '1-2-Gancio Corpo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Slip-Cross-Gancio Corpo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Corpo-Gancio', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Double Jab-Cross-Uppercut', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Uppercut-Cross', lvl: 'intermedio', focus: 'velocità' },
      { c: '1-2-3-2', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Jab-Cross-Gancio-Uppercut-Gancio', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Double Jab-Cross-Uppercut-Gancio', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Slip-Jab-Cross-Gancio-Uppercut', lvl: 'avanzato', focus: 'counter' },
    ],
    muaythai: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Teep-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Jab-Cross-Low Kick', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Teep-Jab', lvl: 'base', focus: 'difesa' },
      { c: 'Jab-Jab-Cross-Low Kick', lvl: 'base', focus: 'velocità' },
      { c: 'Low Kick-Cross', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Hook-Body Kick', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Double Jab-Cross-Hook', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Teep-Cross-Hook', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Jab-Cross-Ginocchio', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Low Kick-Jab-Cross-Ginocchio', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Teep-Low Kick-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Ginocchio-Elbow', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Jab-Cross-Hook-Low Kick-Ginocchio', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Teep-Jab-Cross-Hook-Body Kick', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Clinch-Ginocchio-Elbow', lvl: 'avanzato', focus: 'clinch' },
    ],
    kickboxing: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Cross-Roundhouse', lvl: 'base', focus: 'potenza' },
      { c: 'Front Kick-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Jab-Roundhouse', lvl: 'base', focus: 'velocità' },
      { c: 'Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Cross-Side Kick', lvl: 'base', focus: 'difesa' },
      { c: 'Front Kick-Cross-Hook', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Roundhouse-Cross', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Cross-Hook-Body Kick', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Side Kick-Hook', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Roundhouse-Cross-Hook', lvl: 'intermedio', focus: 'counter' },
      { c: 'Side Kick-Jab-Cross', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Jab-Jab-Cross-Roundhouse', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Front Kick-Roundhouse-Cross', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Spinning Back Kick', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Cross-Hook-Roundhouse-Spinning Hook', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Jab-Cross-Body Kick-Spinning Back Kick', lvl: 'avanzato', focus: 'potenza' },
    ],
    mma: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Cross-Level Change', lvl: 'base', focus: 'potenza' },
      { c: 'Teep-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Jab-Cross-Body', lvl: 'base', focus: 'potenza' },
      { c: 'Low Kick-Cross', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Sprawl', lvl: 'base', focus: 'difesa' },
      { c: 'Jab-Level Change-Takedown', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Teep-Cross-Takedown', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Body-Clinch', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Combo-Sprawl', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Low Kick-Cross-Double Leg', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Hook-Level Change', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Knee-Clinch', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Jab-Low Kick-Cross', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Jab-Cross-Hook-Doppia Gamba', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Cross-Sprawl-Ginocchio-Clinch', lvl: 'avanzato', focus: 'clinch' },
      { c: 'Jab-Cross-Level Change-Takedown-Controllo', lvl: 'avanzato', focus: 'potenza' },
    ],
    karate: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Kizami-Oi Zuki', lvl: 'base', focus: 'velocità' },
      { c: 'Gyaku Zuki-Mawashi Geri', lvl: 'base', focus: 'potenza' },
      { c: 'Mae Geri-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Kizami-Gyaku Zuki', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Cross-Mawashi Geri', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kizami-Oi Zuki-Mae Geri', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Gyaku Zuki-Mawashi Geri-Yoko Geri', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Mae Geri-Mawashi Geri', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Kizami-Gyaku-Yoko Geri', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Sanbon Zuki', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Oi Zuki-Gyaku Zuki', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Kizami-Mae Geri-Gyaku Zuki', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Yoko Geri', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Kizami-Oi Zuki-Mawashi Geri-Yoko Geri', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Sanbon Zuki-Mawashi Geri', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Gyaku Zuki-Mae Geri-Mawashi Geri-Yoko Geri', lvl: 'avanzato', focus: 'potenza' },
    ],
    taekwondo: [
      { c: 'Dollyo-Ap', lvl: 'base', focus: 'potenza' },
      { c: 'Ap-Dollyo', lvl: 'base', focus: 'velocità' },
      { c: 'Yeop Chagi-Dollyo', lvl: 'base', focus: 'difesa' },
      { c: 'Dollyo-Yeop Chagi', lvl: 'base', focus: 'potenza' },
      { c: 'Ap Chagi-Dollyo', lvl: 'base', focus: 'velocità' },
      { c: 'Double Dollyo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Dollyo-Ap-Dollyo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Yeop Chagi-Dollyo-Ap Chagi', lvl: 'intermedio', focus: 'counter' },
      { c: 'Ap-Dollyo-Yeop Chagi', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Dwi Chagi-Dollyo Chagi', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jump Dollyo-Dollyo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Spinning Hook-Dollyo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Ap Chagi-Yeop Chagi-Dollyo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Double Dollyo-Ap Chagi', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Dwi Chagi-Dollyo-Yeop Chagi', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Jump Dollyo-Dollyo-Dwi Chagi', lvl: 'avanzato', focus: 'potenza' },
    ],
    muayboran: [
      { c: 'Chok-Teep', lvl: 'base', focus: 'difesa' },
      { c: 'Chok-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Teep-Tee Kha', lvl: 'base', focus: 'potenza' },
      { c: 'Chok-Tee Kha', lvl: 'base', focus: 'potenza' },
      { c: 'Teep-Salab Fan Pla', lvl: 'base', focus: 'difesa' },
      { c: 'Chok-Teep-Sok Ngad', lvl: 'intermedio', focus: 'counter' },
      { c: 'Sok Ti-Sok Tad', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kao Tone-Kao Dode', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Teep-Sok Ti', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Chok-Tee Kha-Sok Tad', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kao Tone-Sok Ngad', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Teep-Kao Tone-Kao Dode', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Chok-Cross-Tee Kha', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Sok Ti-Kao Tone-Kao Dode', lvl: 'avanzato', focus: 'clinch' },
      { c: 'Chok-Teep-Sok Ngad-Kao Dode', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Teep-Tee Kha-Sok Ti-Kao Tone', lvl: 'avanzato', focus: 'potenza' },
    ],
    kravmaga: [
      { c: 'Palm Strike-Knee', lvl: 'base', focus: 'potenza' },
      { c: 'Burst-Strike-Move', lvl: 'base', focus: 'velocità' },
      { c: 'Forearm Block-Counter', lvl: 'base', focus: 'difesa' },
      { c: 'Palm Strike-Push', lvl: 'base', focus: 'potenza' },
      { c: '360 Defense-Counter', lvl: 'base', focus: 'difesa' },
      { c: 'Palm Strike-Knee-Push', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Eye Gouge-Groin-Disengage', lvl: 'intermedio', focus: 'counter' },
      { c: 'Forearm Block-Counter-Disengage', lvl: 'intermedio', focus: 'difesa' },
      { c: '360 Defense-Counter-Escape', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Burst-Palm Strike-Knee', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Groin-Palm Strike-Escape', lvl: 'intermedio', focus: 'counter' },
      { c: 'Forearm Block-Palm Strike-Knee', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Burst-Strike-Escape', lvl: 'intermedio', focus: 'velocità' },
      { c: '360 Defense-Eye Gouge-Groin', lvl: 'avanzato', focus: 'counter' },
      { c: 'Forearm Block-Counter-Knee-Escape', lvl: 'avanzato', focus: 'difesa' },
      { c: 'Burst-Palm Strike-Knee-Push-Disengage', lvl: 'avanzato', focus: 'potenza' },
    ],
    selfdefense: [
      { c: 'Voce-Palm Strike-Disimpegno', lvl: 'base', focus: 'velocità' },
      { c: 'Palm Strike-Ginocchiata-Fuga', lvl: 'base', focus: 'potenza' },
      { c: 'Difesa 360-Counter-Scan', lvl: 'base', focus: 'difesa' },
      { c: 'Uscita Polso-Palm Strike', lvl: 'base', focus: 'counter' },
      { c: 'Gomitata-Spinta-Fuga', lvl: 'base', focus: 'potenza' },
      { c: 'Uscita Collo-Ginocchiata-Scan', lvl: 'intermedio', focus: 'counter' },
      { c: 'Difesa 360-Palm Strike-Ginocchiata', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Caduta-Calcio da Terra-Rialzo Tattico', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Uscita Bear Hug-Gomitata-Disimpegno', lvl: 'intermedio', focus: 'counter' },
      { c: 'Palm Strike-Gomitata-Ginocchiata-Fuga', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Angolo 45-Palm Strike-Scan', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Difesa Spinta-Counter-Disimpegno', lvl: 'avanzato', focus: 'counter' },
      { c: 'Multi-aggressore: Linea-Colpo-Fuga', lvl: 'avanzato', focus: 'difesa' },
      { c: 'Rialzo Tattico-Palm Strike-Ginocchiata-Fuga', lvl: 'avanzato', focus: 'potenza' },
    ],
    kalaripayattu: [
      { c: 'Chuvadu-Vadivu Leone', lvl: 'base', focus: 'difesa' },
      { c: 'Kaal Eduppu-Affondo', lvl: 'base', focus: 'velocità' },
      { c: 'Vadivu Elefante-Colpo di Palmo', lvl: 'base', focus: 'potenza' },
      { c: 'Chuvadu-Salto-Abbassata', lvl: 'base', focus: 'velocità' },
      { c: 'Meippayattu: Apertura-Chiusura', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Calcio Alto-Rotazione-Vadivu', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Abbassata-Sweep-Rialzo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Salto-Calcio-Atterraggio in Vadivu', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Sequenza Fluida: 3 Vadivu concatenati', lvl: 'avanzato', focus: 'difesa' },
    ],
    // ── Grappling / lotta a terra ──────────────────────────────────────────
    bjj: [
      { c: 'Guardia-Kimura', lvl: 'base', focus: 'clinch' },
      { c: 'Guardia-Sweep', lvl: 'base', focus: 'difesa' },
      { c: 'Passaggio-Mount', lvl: 'base', focus: 'potenza' },
      { c: 'Triangolo-Sweep', lvl: 'base', focus: 'counter' },
      { c: 'Guardia-Triangle', lvl: 'base', focus: 'clinch' },
      { c: 'Mount-Choke', lvl: 'base', focus: 'potenza' },
      { c: 'Passaggio-Mount-Armbar', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Guardia-Triangle-Armbar', lvl: 'intermedio', focus: 'counter' },
      { c: 'Mount-Back take-Choke', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Spider guard-Sweep-Mount', lvl: 'intermedio', focus: 'counter' },
      { c: 'Guardia-Berimbolo-Back take', lvl: 'intermedio', focus: 'counter' },
      { c: 'Guillotine-Controllo', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Triangolo-Armbar', lvl: 'intermedio', focus: 'counter' },
      { c: 'Passaggio-Side control-Mount', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Guardia-Sweep-Back take', lvl: 'intermedio', focus: 'counter' },
      { c: 'Guardia-Berimbolo-Back take-Choke', lvl: 'avanzato', focus: 'counter' },
      { c: 'Spider guard-Sweep-Mount-Armbar', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Passaggio-Mount-Back take-Choke', lvl: 'avanzato', focus: 'potenza' },
    ],
    wrestling: [
      { c: 'Livello-Shot', lvl: 'base', focus: 'potenza' },
      { c: 'Shot-Takedown', lvl: 'base', focus: 'potenza' },
      { c: 'Collar tie-Snap down', lvl: 'base', focus: 'clinch' },
      { c: 'Single leg-Takedown', lvl: 'base', focus: 'potenza' },
      { c: 'Sprawl-Headlock', lvl: 'base', focus: 'difesa' },
      { c: 'Underhook-Hip Throw', lvl: 'base', focus: 'clinch' },
      { c: 'Collar tie-Snap down-Sprawl', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Double leg-Takedown-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Livello-Shot-Takedown', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Single leg-Takedown-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Underhook-Hip Throw-Controllo', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Sprawl-Headlock-Controllo', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Collar tie-Underhook-Hip Throw', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Snap down-Sprawl-Headlock', lvl: 'intermedio', focus: 'counter' },
      { c: 'Livello-Shot-Double leg-Controllo', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Collar tie-Snap down-Sprawl-Headlock', lvl: 'avanzato', focus: 'counter' },
      { c: 'Underhook-Hip Throw-Controllo-Back take', lvl: 'avanzato', focus: 'potenza' },
    ],
    judo: [
      { c: 'Kumikata-O-soto-gari', lvl: 'base', focus: 'potenza' },
      { c: 'Kuzushi-Seoi-nage', lvl: 'base', focus: 'potenza' },
      { c: 'Uchi mata-Controllo', lvl: 'base', focus: 'potenza' },
      { c: 'Kumikata-De-ashi-barai', lvl: 'base', focus: 'velocità' },
      { c: 'Ko-uchi-gari-Tai-otoshi', lvl: 'base', focus: 'potenza' },
      { c: 'Harai-goshi-Controllo', lvl: 'base', focus: 'potenza' },
      { c: 'Kuzushi-Seoi-nage-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Ko-uchi-gari-Tai-otoshi-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'De-ashi-barai-Seoi-nage', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kumikata-Uchi mata-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Harai-goshi-Uchi mata', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kuzushi-O-soto-gari-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Ko-uchi-gari-Seoi-nage', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kumikata-Ko-uchi-gari-Tai-otoshi', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kuzushi-Seoi-nage-Uchi mata-Controllo', lvl: 'avanzato', focus: 'potenza' },
      { c: 'De-ashi-barai-Harai-goshi-Controllo', lvl: 'avanzato', focus: 'counter' },
      { c: 'Kumikata-Uchi mata-Tai-otoshi-Controllo', lvl: 'avanzato', focus: 'potenza' },
    ],
    sambo: [
      { c: 'Kurtka grip-Hip Throw', lvl: 'base', focus: 'potenza' },
      { c: 'Leg pick-Takedown', lvl: 'base', focus: 'potenza' },
      { c: 'Leg sweep-Controllo', lvl: 'base', focus: 'counter' },
      { c: 'Ankle pick-Sgambetto', lvl: 'base', focus: 'velocità' },
      { c: 'Kurtka grip-Leg pick', lvl: 'base', focus: 'clinch' },
      { c: 'Ashi-garami-Leg lock', lvl: 'intermedio', focus: 'counter' },
      { c: 'Sacrifice Throw-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Leg pick-Takedown-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kurtka grip-Hip Throw-Controllo', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Leg sweep-Ashi-garami', lvl: 'intermedio', focus: 'counter' },
      { c: 'Ankle pick-Sgambetto-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Sacrifice Throw-Leg lock', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kurtka grip-Leg sweep-Controllo', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Leg pick-Sacrifice Throw-Controllo', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Ashi-garami-Leg lock-Controllo', lvl: 'avanzato', focus: 'counter' },
      { c: 'Kurtka grip-Hip Throw-Ashi-garami-Leg lock', lvl: 'avanzato', focus: 'potenza' },
    ],
    lutalivre: [
      { c: 'Guillotine-Controllo', lvl: 'base', focus: 'clinch' },
      { c: 'Takedown-Mount', lvl: 'base', focus: 'potenza' },
      { c: 'Guardia-Sweep', lvl: 'base', focus: 'difesa' },
      { c: 'Heel hook-Leg lock', lvl: 'base', focus: 'counter' },
      { c: 'Kneebar-Leva', lvl: 'base', focus: 'counter' },
      { c: 'Takedown-Mount-Choke', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Guardia-Sweep-Back take', lvl: 'intermedio', focus: 'counter' },
      { c: 'Heel hook-Leg lock-Controllo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Guillotine-Mount-Choke', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kneebar-Leva-Controllo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Takedown-Guardia-Sweep', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Guillotine-Back take-Choke', lvl: 'intermedio', focus: 'counter' },
      { c: 'Heel hook-Kneebar', lvl: 'intermedio', focus: 'counter' },
      { c: 'Sweep-Mount-Guillotine', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Takedown-Mount-Back take-Choke', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Guardia-Sweep-Heel hook-Leg lock', lvl: 'avanzato', focus: 'counter' },
    ],
    hapkido: [
      { c: 'Leva al polso-Proiezione', lvl: 'base', focus: 'counter' },
      { c: 'Devia-Leva al gomito', lvl: 'base', focus: 'difesa' },
      { c: 'Calcio basso-Leva alla spalla', lvl: 'base', focus: 'potenza' },
      { c: 'Contropresa-Proiezione', lvl: 'base', focus: 'counter' },
      { c: 'Devia-Proiezione', lvl: 'base', focus: 'difesa' },
      { c: 'Circolare-Leva-Immobilizzazione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Leva al polso-Devia-Leva al gomito', lvl: 'intermedio', focus: 'counter' },
      { c: 'Contropresa-Leva alla spalla', lvl: 'intermedio', focus: 'counter' },
      { c: 'Calcio basso-Devia-Proiezione', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Circolare-Leva al polso', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Devia-Contropresa-Proiezione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Leva al gomito-Immobilizzazione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Calcio basso-Leva al polso-Proiezione', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Circolare-Leva-Contropresa-Immobilizzazione', lvl: 'avanzato', focus: 'counter' },
      { c: 'Devia-Leva al gomito-Proiezione-Immobilizzazione', lvl: 'avanzato', focus: 'counter' },
      { c: 'Calcio basso-Leva alla spalla-Contropresa-Proiezione', lvl: 'avanzato', focus: 'potenza' },
    ],
    // ── Striking tradizionale / arti miste ─────────────────────────────────
    capoeira: [
      { c: 'Ginga-Meia lua', lvl: 'base', focus: 'velocità' },
      { c: 'Ginga-Queixada', lvl: 'base', focus: 'velocità' },
      { c: 'Au-Rasteira', lvl: 'base', focus: 'counter' },
      { c: 'Armada-Martelo', lvl: 'base', focus: 'potenza' },
      { c: 'Ginga-Esquiva', lvl: 'base', focus: 'difesa' },
      { c: 'Bênção-Meia lua de compasso', lvl: 'base', focus: 'potenza' },
      { c: 'Queixada-Esquiva-Armada', lvl: 'intermedio', focus: 'counter' },
      { c: 'Ginga-Rasteira', lvl: 'intermedio', focus: 'counter' },
      { c: 'Armada-Martelo-Queixada', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Meia lua-Rasteira', lvl: 'intermedio', focus: 'counter' },
      { c: 'Au-Rasteira-Armada', lvl: 'intermedio', focus: 'counter' },
      { c: 'Ginga-Meia lua-Queixada', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Bênção-Armada', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Esquiva-Rasteira-Armada', lvl: 'intermedio', focus: 'counter' },
      { c: 'Ginga-Meia lua-Queixada-Armada', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Au-Rasteira-Meia lua de compasso', lvl: 'avanzato', focus: 'counter' },
      { c: 'Armada-Martelo-Meia lua de compasso-Rasteira', lvl: 'avanzato', focus: 'potenza' },
    ],
    wingchun: [
      { c: 'Chain Punch-Chain Punch', lvl: 'base', focus: 'velocità' },
      { c: 'Tan sao-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Bong sao-Contropugno', lvl: 'base', focus: 'counter' },
      { c: 'Pak sao-Palm Strike', lvl: 'base', focus: 'velocità' },
      { c: 'Wu sao-Tan sao', lvl: 'base', focus: 'difesa' },
      { c: 'Chi sao-Chain Punch', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Tan sao-Cross-Elbow', lvl: 'intermedio', focus: 'counter' },
      { c: 'Bong sao-Contropugno-Palm Strike', lvl: 'intermedio', focus: 'counter' },
      { c: 'Pak sao-Palm Strike-Chain Punch', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Wu sao-Tan sao-Palm Strike', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Chi sao-Chain Punch-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Bong sao-Pak sao-Palm Strike', lvl: 'intermedio', focus: 'counter' },
      { c: 'Tan sao-Bong sao-Contropugno', lvl: 'intermedio', focus: 'counter' },
      { c: 'Chi sao-Chain Punch-Elbow-Palm Strike', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Wu sao-Tan sao-Bong sao-Contropugno', lvl: 'avanzato', focus: 'counter' },
      { c: 'Pak sao-Chain Punch-Elbow-Palm Strike', lvl: 'avanzato', focus: 'potenza' },
    ],
    kungfu: [
      { c: 'Horse stance-Palm Strike', lvl: 'base', focus: 'potenza' },
      { c: 'Spear hand-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Crane kick-Roundhouse', lvl: 'base', focus: 'difesa' },
      { c: 'Pugno a vite-Gancio', lvl: 'base', focus: 'potenza' },
      { c: 'Horse stance-Spear hand', lvl: 'base', focus: 'potenza' },
      { c: 'Iron palm-Palm Strike', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Crane kick-Roundhouse-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Roundhouse', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Spear hand-Cross-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Iron palm-Palm Strike-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Horse stance-Palm Strike-Gancio', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Pugno a vite-Gancio-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Crane kick-Spear hand-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Iron palm-Palm Strike-Elbow-Gancio', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Horse stance-Spear hand-Crane kick-Roundhouse', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Pugno a vite-Gancio-Elbow-Palm Strike', lvl: 'avanzato', focus: 'potenza' },
    ],
    silat: [
      { c: 'Kuda-kuda-Sapuan', lvl: 'base', focus: 'potenza' },
      { c: 'Harimau-Kuncian', lvl: 'base', focus: 'counter' },
      { c: 'Deviazione-Palm Strike', lvl: 'base', focus: 'difesa' },
      { c: 'Langkah-Elbow', lvl: 'base', focus: 'velocità' },
      { c: 'Sapuan-Kuncian', lvl: 'base', focus: 'counter' },
      { c: 'Kuda-kuda-Harimau', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Langkah-Elbow-Kuncian', lvl: 'intermedio', focus: 'counter' },
      { c: 'Deviazione-Palm Strike-Sapuan', lvl: 'intermedio', focus: 'counter' },
      { c: 'Sapuan-Kuncian-Proiezione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Harimau-Kuncian-Proiezione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kuda-kuda-Sapuan-Kuncian', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Langkah-Deviazione-Palm Strike', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Palm Strike-Elbow-Sapuan', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Kuda-kuda-Harimau-Kuncian-Proiezione', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Langkah-Elbow-Kuncian-Proiezione', lvl: 'avanzato', focus: 'counter' },
      { c: 'Deviazione-Palm Strike-Sapuan-Kuncian', lvl: 'avanzato', focus: 'counter' },
    ],
    kendo: [
      { c: 'Men jab', lvl: 'base', focus: 'velocità' },
      { c: 'Do cross', lvl: 'base', focus: 'potenza' },
      { c: 'Tsuki jab', lvl: 'base', focus: 'velocità' },
      { c: 'Kote hook', lvl: 'base', focus: 'difesa' },
      { c: 'Debana kote hook', lvl: 'base', focus: 'counter' },
      { c: 'Kote hook-Men jab', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Do cross-Men jab', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Men jab-Do cross', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Tsuki jab-Do cross', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Debana kote hook-Men jab', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kote hook-Tsuki jab', lvl: 'intermedio', focus: 'counter' },
      { c: 'Men jab-Kote hook-Do cross', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Debana kote hook-Do cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Kote hook-Men jab-Do cross-Tsuki jab', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Men jab-Debana kote hook-Do cross', lvl: 'avanzato', focus: 'counter' },
    ],
    sanda: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Low Kick-Cross', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Roundhouse', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Roundhouse-Catch', lvl: 'base', focus: 'counter' },
      { c: 'Jab-Cross-Sgambetto', lvl: 'intermedio', focus: 'counter' },
      { c: 'Roundhouse-Catch-Takedown', lvl: 'intermedio', focus: 'counter' },
      { c: 'Low Kick-Cross-Clinch', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Jab-Roundhouse-Shoot', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Hook-Sgambetto', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Clinch-Sgambetto', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Low Kick-Roundhouse-Cross', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Catch-Takedown', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Roundhouse-Sgambetto', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Low Kick-Cross-Clinch-Sgambetto', lvl: 'avanzato', focus: 'clinch' },
      { c: 'Roundhouse-Catch-Takedown-Controllo', lvl: 'avanzato', focus: 'potenza' },
    ],
    pankration: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Teep-Cross', lvl: 'base', focus: 'difesa' },
      { c: 'Low Kick-Clinch', lvl: 'base', focus: 'clinch' },
      { c: 'Cross-Knee', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Cross-Shoot', lvl: 'base', focus: 'potenza' },
      { c: 'Teep-Cross-Sprawl', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Low Kick-Clinch-Choke', lvl: 'intermedio', focus: 'counter' },
      { c: 'Knee-Takedown-Controllo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Knee-Strangolamento', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Sprawl', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Teep-Knee-Clinch', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Low Kick-Cross-Shoot', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Clinch-Knee', lvl: 'intermedio', focus: 'clinch' },
      { c: 'Jab-Cross-Shoot-Controllo', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Low Kick-Clinch-Choke-Controllo', lvl: 'avanzato', focus: 'counter' },
      { c: 'Teep-Cross-Knee-Strangolamento', lvl: 'avanzato', focus: 'potenza' },
    ],
    systema: [
      { c: 'Palm Strike-Devia', lvl: 'base', focus: 'difesa' },
      { c: 'Palm Strike-Proiezione', lvl: 'base', focus: 'potenza' },
      { c: 'Devia-Colpo', lvl: 'base', focus: 'difesa' },
      { c: 'Palm Strike-Elbow', lvl: 'base', focus: 'potenza' },
      { c: 'Devia-Controllo', lvl: 'base', focus: 'difesa' },
      { c: 'Palm Strike-Devia-Leva al polso', lvl: 'intermedio', focus: 'counter' },
      { c: 'Devia-Colpo-Controllo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Palm Strike-Elbow-Proiezione', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Devia-Palm Strike-Proiezione', lvl: 'intermedio', focus: 'counter' },
      { c: 'Colpo-Devia-Controllo', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Palm Strike-Devia-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Devia-Leva al polso-Controllo', lvl: 'intermedio', focus: 'counter' },
      { c: 'Palm Strike-Colpo-Elbow', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Devia-Colpo-Elbow-Proiezione', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Palm Strike-Devia-Leva al polso-Proiezione', lvl: 'avanzato', focus: 'counter' },
    ],
    // ── Fitness / flow / movimento (senza bersaglio) ───────────────────────
    calisthenics: [
      { c: 'Squat-Push-up', lvl: 'base', focus: 'potenza' },
      { c: 'Affondo-Squat', lvl: 'base', focus: 'potenza' },
      { c: 'Push-up-Plank', lvl: 'base', focus: 'difesa' },
      { c: 'Squat-Plank', lvl: 'base', focus: 'difesa' },
      { c: 'Affondo-Push-up', lvl: 'base', focus: 'potenza' },
      { c: 'Squat-Push-up-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Squat-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Push-up-Plank-Squat', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Squat-Affondo-Push-up', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Plank-Push-up-Squat', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Affondo-Plank-Push-up', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Squat-Push-up-Affondo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Pistol Squat-Plank', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Squat-Affondo-Push-up-Plank', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Pistol Squat-Push-up-Plank', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Affondo-Squat-Push-up-Plank', lvl: 'avanzato', focus: 'potenza' },
    ],
    crossfit: [
      { c: 'Squat-Push-up', lvl: 'base', focus: 'potenza' },
      { c: 'Affondo-Squat', lvl: 'base', focus: 'potenza' },
      { c: 'Push-up-Corsa', lvl: 'base', focus: 'velocità' },
      { c: 'Squat-Corsa', lvl: 'base', focus: 'velocità' },
      { c: 'Burpee-Squat', lvl: 'base', focus: 'potenza' },
      { c: 'Squat-Push-up-Corsa', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Squat-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Push-up-Squat-Corsa', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Burpee-Squat-Push-up', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Thruster-Squat', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Wall ball-Squat', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Burpee-Squat', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Push-up-Plank-Corsa', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Thruster-Wall ball-Squat', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Burpee-Squat-Push-up-Corsa', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Affondo-Squat-Thruster-Corsa', lvl: 'avanzato', focus: 'potenza' },
    ],
    yoga: [
      { c: 'Guerriero-Albero', lvl: 'base', focus: 'difesa' },
      { c: 'Albero-Ponte', lvl: 'base', focus: 'potenza' },
      { c: 'Piega in avanti-Guerriero', lvl: 'base', focus: 'difesa' },
      { c: 'Respiro-Guerriero', lvl: 'base', focus: 'difesa' },
      { c: 'Guerriero-Ponte', lvl: 'base', focus: 'potenza' },
      { c: 'Albero-Piega in avanti', lvl: 'base', focus: 'difesa' },
      { c: 'Guerriero-Albero-Ponte', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Piega in avanti-Guerriero-Albero', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Respiro-Guerriero-Ponte', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Albero-Piega in avanti-Ponte', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Guerriero-Piega in avanti-Albero', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Ponte-Albero-Guerriero', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Respiro-Albero-Ponte', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Guerriero-Albero-Piega in avanti-Ponte', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Respiro-Guerriero-Albero-Ponte', lvl: 'avanzato', focus: 'difesa' },
      { c: 'Piega in avanti-Ponte-Albero-Guerriero', lvl: 'avanzato', focus: 'potenza' },
    ],
    running: [
      { c: 'Affondo-Corsa', lvl: 'base', focus: 'velocità' },
      { c: 'Corsa-Sprint', lvl: 'base', focus: 'velocità' },
      { c: 'Scatto-Corsa', lvl: 'base', focus: 'velocità' },
      { c: 'Affondo-Scatto', lvl: 'base', focus: 'potenza' },
      { c: 'Corsa-Cadenza', lvl: 'base', focus: 'velocità' },
      { c: 'Affondo-Corsa-Sprint', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Corsa-Sprint-Affondo', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Scatto-Corsa-Cadenza', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Affondo-Cadenza-Sprint', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Corsa-Scatto-Affondo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Sprint-Cadenza-Corsa', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Affondo-Sprint-Cadenza', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Corsa-Affondo-Scatto', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Corsa-Sprint-Cadenza', lvl: 'avanzato', focus: 'velocità' },
      { c: 'Scatto-Sprint-Corsa-Cadenza', lvl: 'avanzato', focus: 'velocità' },
    ],
    stretching: [
      { c: 'Piega in avanti-Ponte', lvl: 'base', focus: 'difesa' },
      { c: 'Affondo-Piega in avanti', lvl: 'base', focus: 'difesa' },
      { c: 'Ponte-Piega in avanti', lvl: 'base', focus: 'difesa' },
      { c: 'Piega in avanti-Albero', lvl: 'base', focus: 'difesa' },
      { c: 'Affondo-Ponte', lvl: 'base', focus: 'difesa' },
      { c: 'Ponte-Piega in avanti-Albero', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Affondo-Piega in avanti-Ponte', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Piega in avanti-Ponte-Affondo', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Albero-Piega in avanti-Ponte', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Affondo-Albero-Piega in avanti', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Ponte-Affondo-Piega in avanti', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Piega in avanti-Affondo-Albero', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Ponte-Piega in avanti-Affondo-Albero', lvl: 'avanzato', focus: 'difesa' },
      { c: 'Affondo-Ponte-Piega in avanti-Albero', lvl: 'avanzato', focus: 'difesa' },
      { c: 'Piega in avanti-Albero-Ponte-Affondo', lvl: 'avanzato', focus: 'difesa' },
    ],
    fitness: [
      { c: 'Squat-Push-up', lvl: 'base', focus: 'potenza' },
      { c: 'Affondo-Squat', lvl: 'base', focus: 'potenza' },
      { c: 'Push-up-Corsa', lvl: 'base', focus: 'velocità' },
      { c: 'Squat-Plank', lvl: 'base', focus: 'difesa' },
      { c: 'Affondo-Push-up', lvl: 'base', focus: 'potenza' },
      { c: 'Squat-Push-up-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Squat-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Push-up-Squat-Corsa', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Squat-Affondo-Corsa', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Plank-Push-up-Corsa', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Affondo-Plank-Squat', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Push-up-Plank-Affondo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Squat-Corsa-Plank', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Squat-Push-up-Plank-Corsa', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Affondo-Squat-Push-up-Corsa', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Plank-Affondo-Squat-Push-up', lvl: 'avanzato', focus: 'potenza' },
    ],
    general: [
      { c: 'Squat-Affondo', lvl: 'base', focus: 'potenza' },
      { c: 'Corsa-Squat', lvl: 'base', focus: 'velocità' },
      { c: 'Affondo-Plank', lvl: 'base', focus: 'difesa' },
      { c: 'Squat-Plank', lvl: 'base', focus: 'difesa' },
      { c: 'Corsa-Affondo', lvl: 'base', focus: 'velocità' },
      { c: 'Squat-Affondo-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Corsa-Squat-Plank', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Affondo-Corsa-Squat', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Plank-Squat-Affondo', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Corsa-Plank-Squat', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Affondo-Squat-Corsa', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Squat-Corsa-Affondo', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Plank-Affondo-Corsa', lvl: 'intermedio', focus: 'difesa' },
      { c: 'Squat-Affondo-Plank-Corsa', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Corsa-Squat-Affondo-Plank', lvl: 'avanzato', focus: 'potenza' },
    ],
    default: [
      { c: 'Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Jab-Cross', lvl: 'base', focus: 'velocità' },
      { c: 'Hook-Cross-Hook', lvl: 'base', focus: 'potenza' },
      { c: 'Cross-Hook-Cross', lvl: 'base', focus: 'potenza' },
      { c: 'Jab-Cross-Hook', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Uppercut', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Cross-Hook-Uppercut', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Jab-Cross-Hook', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Hook-Uppercut-Cross', lvl: 'intermedio', focus: 'counter' },
      { c: 'Jab-Cross-Hook-Cross', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Combo veloce 4 colpi', lvl: 'intermedio', focus: 'velocità' },
      { c: 'Jab-Cross-Hook-Uppercut', lvl: 'intermedio', focus: 'potenza' },
      { c: 'Jab-Cross-Hook-Uppercut-Cross', lvl: 'avanzato', focus: 'potenza' },
      { c: 'Cross-Hook-Uppercut-Hook-Cross', lvl: 'avanzato', focus: 'potenza' },
    ],
  };

  // Storico anti-ripetizione per disciplina (si azzera al remount, non serve persistenza cross-sessione)
  const recentComboRef = useRef({});

  // Trova il tag `focus` di una combo (dal suo testo) cercandola nella libreria della disciplina.
  // Usato per loggare focus→voto e per ripesare le prossime scelte — ritorna null se non trovata
  // (es. combo suggerita dall'AI come "nextCombo", non presente nella libreria).
  const comboFocusFor = (m, comboStr) => {
    const baseMode = String(m || '').replace(/^sparring_/, '');
    const list = COMBO_LIBRARY[m] || COMBO_LIBRARY[baseMode] || COMBO_LIBRARY.default;
    const entry = list.find((e) => (typeof e === 'string' ? e : e.c) === comboStr);
    return entry && typeof entry !== 'string' ? entry.focus || null : null;
  };

  const pickCombo = useCallback((exclude = '') => {
    // sparring_X / partner_drills usano il combo set della disciplina base (es. sparring_muaythai → muaythai)
    const baseMode = String(mode || '').replace(/^sparring_/, '');
    const list = COMBO_LIBRARY[mode] || COMBO_LIBRARY[baseMode] || COMBO_LIBRARY.default;
    const comboStr = (entry) => (typeof entry === 'string' ? entry : entry.c);
    const comboLvl = (entry) => (typeof entry === 'string' ? 'intermedio' : (entry.lvl || 'intermedio'));
    const comboFocus = (entry) => (typeof entry === 'string' ? null : entry.focus || null);

    // Livello dell'utente per questa disciplina, derivato dalla media punteggio delle sessioni passate
    const modeHistory = pastSessions.filter((s) => s.mode === mode || s.mode === baseMode);
    const scores = modeHistory.map((s) => s.score).filter((v) => v != null);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    let lvlWeights = { base: 1, intermedio: 1, avanzato: 1 }; // fallback bilanciato 33/33/33
    if (avgScore != null) {
      if (avgScore < 55) lvlWeights = { base: 3, intermedio: 1, avanzato: 0.3 };
      else if (avgScore < 75) lvlWeights = { base: 1, intermedio: 2, avanzato: 1 };
      else lvlWeights = { base: 0.5, intermedio: 1.5, avanzato: 2 };
    }

    // Affinità per FOCUS (potenza/velocità/difesa/counter/clinch): dal log locale voto→focus
    // delle combo giudicate in questa disciplina — stile "ti riesce bene/ti piace → te ne propongo
    // di più", mai un'esclusione totale degli altri focus (peso minimo 0.4, non zero).
    let focusWeights = {};
    try {
      const hist = JSON.parse(localStorage.getItem('shadow_monarch_combo_focus_history') || '[]');
      const relevant = hist.filter((h) => h.mode === mode || h.mode === baseMode);
      if (relevant.length >= 4) {
        const score = {};
        relevant.forEach((h, i) => {
          const recentBoost = i >= relevant.length - 20 ? 2 : 1;
          const delta = (h.grade === 'perfect' ? 2 : h.grade === 'good' ? 1 : -1) * recentBoost;
          score[h.focus] = (score[h.focus] || 0) + delta;
        });
        const vals = Object.values(score);
        const max = Math.max(1, ...vals.map(Math.abs));
        Object.entries(score).forEach(([f, v]) => { focusWeights[f] = Math.max(0.4, 1 + (v / max)); });
      }
    } catch (_) {}

    // Anti-ripetizione: evita le ultime N combo mostrate per QUESTA disciplina (N=5 o lista se più corta)
    const historyKey = mode || 'default';
    const recentList = recentComboRef.current[historyKey] || [];
    const N = Math.min(5, Math.max(list.length - 1, 0));
    const recentSet = N > 0 ? new Set(recentList.slice(-N)) : new Set();

    let pool = list.filter((entry) => comboStr(entry) !== exclude && !recentSet.has(comboStr(entry)));
    if (!pool.length) pool = list.filter((entry) => comboStr(entry) !== exclude);
    if (!pool.length) pool = list;

    // Scelta pesata per livello + affinità di focus dentro il pool anti-ripetizione
    const weighted = [];
    pool.forEach((entry) => {
      const lvlW = Math.max(0.05, lvlWeights[comboLvl(entry)] ?? 1);
      const focusW = focusWeights[comboFocus(entry)] ?? 1;
      const reps = Math.max(1, Math.round(lvlW * focusW * 3));
      for (let i = 0; i < reps; i++) weighted.push(entry);
    });
    const chosen = weighted[Math.floor(Math.random() * weighted.length)] || pool[0] || list[0];
    const chosenStr = comboStr(chosen);

    recentComboRef.current = { ...recentComboRef.current, [historyKey]: [...recentList, chosenStr].slice(-10) };
    return chosenStr;
  }, [mode, pastSessions]);

  const stopCombo = useCallback(() => {
    clearTimeout(comboTimerRef.current);
    setComboOn(false);
    setComboPhase('idle');
    comboPhaseRef.current = 'idle';
    setCurrentCombo('');
    setComboResult(null);
    setComboPaused(false); comboPausedRef.current = false;
    flushComboFocus(); // manda le eventuali voci accodate rimaste sotto soglia
  }, [flushComboFocus]);

  // Fotogrammi chiave catturati durante il GO della combo → collage per il giudice
  const comboFramesRef = useRef([]);
  const comboShotTRef = useRef(0);
  const comboCanvasRef = useRef(null);

  // Compone N pannelli affiancati in una singola immagine (1 chiamata, N momenti)
  const composeContactSheet = useCallback(async (urls, labels) => {
    const imgs = await Promise.all(urls.map((u) => new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = ko;
      img.src = u;
    })));
    if (!imgs.length) return null;
    const pw = 384;
    const ph = Math.round(imgs[0].height * (pw / (imgs[0].width || pw))) || 288;
    const labelH = 28;
    const c = document.createElement('canvas');
    c.width = pw * imgs.length; c.height = ph + labelH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    imgs.forEach((img, i) => {
      ctx.drawImage(img, i * pw, labelH, pw, ph);
      ctx.fillStyle = '#ffd24a';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(labels[i] || String(i + 1), i * pw + 8, 20);
    });
    return c.toDataURL('image/jpeg', 0.72).split(',')[1];
  }, []);

  const runComboJudge = useCallback(async (combo) => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    const pose = computePose();
    const frames = comboFramesRef.current;
    let imageBase64 = null;
    // SCHEDA DI CONTATTO: inizio/centro + frame finale ANNOTATO (misure reali)
    if (frames.length >= 2) {
      const urls = [frames[0], frames[Math.floor(frames.length / 2)]];
      const labels = ['1 — INIZIO', '2 — CENTRO'];
      if (skeletonOn && lastLandmarksRef.current) {
        urls.push('data:image/jpeg;base64,' + drawAnnotatedFrame(video, lastLandmarksRef.current, pose, trailRef.current, 448, 0.6));
        labels.push('3 — FINE (misure reali)');
      } else {
        urls.push(frames[frames.length - 1]);
        labels.push('3 — FINE');
      }
      try { imageBase64 = await composeContactSheet(urls, labels); } catch { imageBase64 = null; }
    }
    if (!imageBase64) {
      // fallback: singolo frame (annotato se lo scheletro è attivo)
      if (skeletonOn && lastLandmarksRef.current) {
        imageBase64 = drawAnnotatedFrame(video, lastLandmarksRef.current, pose, trailRef.current, 512, 0.72);
      } else {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0);
        imageBase64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
      }
    }
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comboJudge: true, imageBase64, mimeType: 'image/jpeg', mode, targetCombo: combo }),
      });
      const data = await res.json();
      return data;
    } catch { return null; }
  }, [mode, composeContactSheet, skeletonOn]);

  const currentComboRef = useRef('');
  const nextComboRoundRef = useRef(null);

  // ── Coda VOCALE (solo audio) — disaccoppiata dal display ────────────────────
  // Il testo a schermo si aggiorna SUBITO e RESTA (gestito in captureAndAnalyze);
  // qui gestiamo solo la voce, che legge un comando per intero prima del successivo.
  const speakNextRef = useRef(() => {});
  const speakNext = useCallback(() => {
    if (presentingRef.current) return;            // sta già leggendo → aspetta la fine
    if (!voiceOn || !window.speechSynthesis) { speakQueueRef.current = []; return; }
    const text = speakQueueRef.current.shift();
    if (text == null) return;

    const clean = normalizeCoachingText(String(text))
      .replace(/\*\*/g, '').replace(/[*#_~`]/g, '')
      .replace(/RIGA\s*\d+\s*[—-]/g, '')
      .replace(/\bBENE\s*:/gi, 'Bene,').replace(/\bPROVA\s*:/gi, 'Prova')
      .replace(/([A-ZÀ]{0,4}ANDO|VISTO|PERCHÉ|SITUAZIONE|ISTRUZIONE|PUNTO)\s*:/gi, '')
      .replace(/[^\x00-\x7F]/g, (c) => /\p{Emoji}/u.test(c) ? '' : c)
      .replace(/\n+/g, '. ')
      .trim();
    if (!clean) { speakNextRef.current(); return; }

    presentingRef.current = true;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      presentingRef.current = false;
      setTimeout(() => speakNextRef.current(), 150);
    };
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'it-IT'; utt.rate = voiceSlow ? 0.82 : 1.05; utt.pitch = 1;
    const itVoice = voicesRef.current.find((v) => v.lang === 'it-IT' || v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    utt.onend = advance;
    utt.onerror = advance;
    window.speechSynthesis.speak(utt);
    // Watchdog iOS Safari: se onend non scatta, avanza comunque dopo durata stimata
    setTimeout(advance, Math.min(18000, Math.max(3800, clean.length * (voiceSlow ? 125 : 95))));
  }, [voiceOn, voiceSlow]);
  speakNextRef.current = speakNext;

  // Accoda solo il TESTO per la voce. Cap a 2: evita backlog stantio in auto mode.
  const enqueueSpeak = useCallback((text) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([28, 16, 28]); // feedback aptico nuovo comando
    speakQueueRef.current.push(text);
    if (speakQueueRef.current.length > 2) speakQueueRef.current = speakQueueRef.current.slice(-2);
    speakNext();
  }, [speakNext]);
  enqueueSpeakRef.current = enqueueSpeak;

  const nextComboRound = useCallback((suggestedCombo) => {
    if (!comboPhaseRef.current || comboPhaseRef.current === 'idle') return;
    const combo = suggestedCombo || pickCombo(currentComboRef.current);
    currentComboRef.current = combo;
    setCurrentCombo(combo);
    setComboResult(null);
    setComboPhase('calling');
    comboPhaseRef.current = 'calling';
    const nTech = Math.max(1, combo.split('-').filter(Boolean).length);
    setComboCountdown(null);                 // fase DEMO: mostra la combo intera, nessun numero
    enqueueSpeak(`Guarda: ${combo}`, true);
    // 1) DEMO: lascia scorrere l'intera combo almeno una volta sulla figura animata
    const demoMs = Math.max(3400, nTech * COMBO_MOVE_MS + 500);
    // avvia il GO + giudizio quando finisce il conto alla rovescia
    const go = () => {
      setComboPhase('go');
      comboPhaseRef.current = 'go';
      comboFramesRef.current = [];  // nuova esecuzione → nuovi fotogrammi chiave
      enqueueSpeak('Via!', true);
      const execMs = Math.max(2400, nTech * 950);   // tempo d'esecuzione proporzionale ai colpi
      comboTimerRef.current = setTimeout(async () => {
        if (comboPhaseRef.current !== 'go') return;
        setComboPhase('judging');
        comboPhaseRef.current = 'judging';
        const result = await runComboJudge(combo);
        if (comboPhaseRef.current !== 'judging') return;
        const grade = result?.grade || 'good';
        setComboResult({ grade, feedback: result?.feedback || '', nextCombo: result?.nextCombo || '' });
        setComboScore((prev) => ({ ...prev, [grade]: (prev[grade] || 0) + 1 }));
        // Cinematico: PERFETTO → SUPER COMBO (gong+flash), BUONO → COMBO
        if (grade === 'perfect' || grade === 'good') setComboFx({ t: Date.now(), grade, combo });
        // Log locale focus→voto: alimenta pickCombo per proporre più spesso ciò che ti riesce bene
        // (stile "più ti piace/riesce, più te ne mostro simili"), mai un vincolo, solo un peso.
        try {
          const focus = comboFocusFor(mode, combo);
          if (focus) {
            const key = 'shadow_monarch_combo_focus_history';
            const hist = JSON.parse(localStorage.getItem(key) || '[]');
            hist.push({ mode, focus, grade, ts: Date.now() });
            localStorage.setItem(key, JSON.stringify(hist.slice(-300)));
            // Copia durevole su KV (per Obsidian) — accodata, sync in batch ogni 5 voci
            pendingComboFocusRef.current.push({ mode, focus, grade });
            if (pendingComboFocusRef.current.length >= 5) flushComboFocus();
          }
        } catch (_) {}
        setComboPhase('result');
        comboPhaseRef.current = 'result';
        const ttsMsg = grade === 'perfect' ? `Perfetto! ${result?.feedback || ''}` : grade === 'good' ? `Buono. ${result?.feedback || ''}` : `Riprova. ${result?.feedback || ''}`;
        enqueueSpeak(ttsMsg, true);
        const advanceToNext = () => {
          if (comboPhaseRef.current !== 'result') return;
          if (comboPausedRef.current) { comboTimerRef.current = setTimeout(advanceToNext, 400); return; } // in pausa: ricontrolla, non avanzare
          nextComboRoundRef.current?.(result?.nextCombo || '');
        };
        comboTimerRef.current = setTimeout(advanceToNext, 3200);
      }, execMs);
    };
    // 2) dopo la demo → conto alla rovescia 3-2-1 → VIA (in pausa resta in demo, non parte il countdown)
    const startCountdownWhenReady = () => {
      if (comboPhaseRef.current !== 'calling') return;
      if (comboPausedRef.current) { comboTimerRef.current = setTimeout(startCountdownWhenReady, 400); return; }
      enqueueSpeak(`Esegui tra tre`, true);
      let c = 3;
      const tick = () => {
        if (comboPhaseRef.current !== 'calling') return;
        if (comboPausedRef.current) { comboTimerRef.current = setTimeout(tick, 400); return; } // pausa durante il countdown
        if (c === 0) { go(); return; }
        setComboCountdown(c);
        c--;
        comboTimerRef.current = setTimeout(tick, 650);
      };
      tick();
    };
    comboTimerRef.current = setTimeout(startCountdownWhenReady, demoMs);
  }, [pickCombo, enqueueSpeak, runComboJudge]);

  nextComboRoundRef.current = nextComboRound;

  const startCombo = useCallback(() => {
    setComboScore({ perfect: 0, good: 0, redo: 0 });
    setComboPaused(false); comboPausedRef.current = false;
    setComboOn(true);
    comboPhaseRef.current = 'calling';
    nextComboRound('');
  }, [nextComboRound]);

  // Precarica le voci appena disponibili (getVoices è asincrono su Chrome/Safari)
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // ── Sblocco TTS — DEVE girare dentro un gesto utente ────────────────────────
  // iOS Safari e Chrome bloccano speechSynthesis fuori da un'interazione: in auto
  // mode la voce parte da un timer, quindi senza questo "priming" non si sente nulla.
  const speechUnlockedRef = useRef(false);
  const unlockSpeech = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.lang = 'it-IT';
      synth.speak(u);
      synth.resume();
      speechUnlockedRef.current = true;
      const v = synth.getVoices();
      if (v && v.length) voicesRef.current = v;       // Safari popola le voci dopo il gesto
    } catch (_) {}
  }, []);

  // Keepalive: Chrome mette in pausa la sintesi dopo ~15s — la riattiviamo.
  useEffect(() => {
    if (!voiceOn) return;
    const id = setInterval(() => {
      const s = window.speechSynthesis;
      if (s && s.paused) s.resume();
    }, 5000);
    return () => clearInterval(id);
  }, [voiceOn]);

  const timer = useRoundTimer({ rounds, roundDuration, restDuration: 60 });
  const currentDisc = ALL_DISCIPLINES.find((d) => d.id === mode) || ALL_DISCIPLINES[0];
  const isPartnerMode = isSparring(mode);
  useEffect(() => { matchCtxRef.current = { active: roundsOn || isPartnerMode, rounds }; }, [roundsOn, isPartnerMode, rounds]);
  // Fine match → referto livello calcio (cinematico + suono); inizio → azzera
  useEffect(() => {
    if (timer.phase === 'round' && timer.currentRound === 1) {
      matchKicksRef.current = { tot: 0, sx: 0, dx: 0, peaks: [] };
      kickStateRef.current = { lastKickT: { kL: -1e9, kR: -1e9 } };
      setKickReport(null);
    }
    if (timer.phase === 'finished') {
      const M = matchKicksRef.current;
      if (matchCtxRef.current.active && matchCtxRef.current.rounds >= 3 && M.tot > 0) {
        const avgPeak = Math.round(M.peaks.reduce((a, b) => a + b, 0) / M.peaks.length);
        const level = kickLevelFromMatch({ tot: M.tot, avgPeak });
        setKickReport({ tot: M.tot, sx: M.sx, dx: M.dx, avgPeak, level });
        if (level >= 60) playEpicDing({ enabled: true }); else playComboHit({ enabled: true, power: 0.8 });
      }
    }
  }, [timer.phase, timer.currentRound]);

  const handleScore = useCallback((who, delta) => {
    setScore((s) => ({ ...s, [who]: Math.max(0, s[who] + delta) }));
  }, []);

  const startCamera = async (facing = facingMode) => {
    try {
      // 720p come ideal (non requisito): la posizione delle mani si legge molto
      // meglio; i device deboli scendono da soli alla risoluzione che reggono.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStreaming(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setStreaming(true);
      } catch (err) { alert('Camera non accessibile: ' + err.message); }
    }
  };

  useEffect(() => {
    if (step !== 'live' || !streaming || !streamRef.current || !videoRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [step, streaming, academyLesson]);

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    poseRef.current?.lm?.close();
    poseRef.current = null;
    setStreaming(false);
    await startCamera(next);
  };

  const startSession = async () => {
    sessionStartRef.current = Date.now();
    sessionVerdictsRef.current = [];      // nuova sessione → azzera i verdetti accumulati
    kinHistRef.current = []; trendRef.current = []; lastTrendTRef.current = 0; // fatica misurata su QUESTA sessione
    unlockSpeech();                       // gesto utente: sblocca la voce per l'auto mode
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    if (academyLesson) {
      setStudioClock({ phase: 'ready', round: 1, left: academyLesson.roundSeconds || 120 });
      setStudioPaused(false); setStudioCombos(0); setStudioSaved(false);
      studioSamplesRef.current = [];
      studioComboRef.current = { armed: { L: false, R: false }, last: null, at: 0, count: 0 };
      mirrorMatchRef.current = null;
      lastLandmarksRef.current = null;
    }
    setStep('live'); setAnalysis(null);
    await startCamera();
  };

  // Fine sessione → il Maestro genera la pagella, la salva su KV (→ Obsidian) e la mostra.
  const requestSessionReport = useCallback(async ({ durationMin, verdicts, sampleCount: sc, context, discipline }) => {
    setSessionReport({ loading: true });
    const exam = examRef.current && examRef.current.mode === discipline ? examRef.current : null;
    let ownChatId = '';
    try { ownChatId = window.localStorage.getItem('shadow_monarch_tg_chat_id') || ''; } catch {}
    try {
      const r = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionReport: true, mode: discipline, durationMin, sampleCount: sc,
          verdicts, context, level: guidedLevel, chatId: ownChatId || undefined,
          exam: exam ? { milestone: exam.milestone, label: exam.label } : undefined,
        }),
      });
      const data = await r.json();
      if (r.ok && data.report) {
        // L'XP della pagella entra anche nel personaggio (stesso modello XP
        // sottrattivo di Boss/Quests/Training): allenarsi col coach fa salire il System.
        if (setPlayerStats && data.report.xp > 0) {
          setPlayerStats((prev) => {
            const { level, exp } = applyXp(prev, data.report.xp);
            return { ...prev, level, exp };
          });
        }
        // Progressione per disciplina: KV è la fonte, copia locale per l'UI immediata.
        if (data.progress && typeof data.progress === 'object') {
          saveCoachProgress(data.progress);
          setCoachProgress(data.progress);
        }
        if (data.report.skills) pushSkillsHistory(discipline, data.report.skills); // trend competenze
        // Esame milestone: >=75 = PROMOSSO → salva il diploma e sblocca il grado
        let examOutcome = null;
        if (exam) {
          examRef.current = null;
          const passed = (data.report.score ?? 0) >= 75;
          examOutcome = { passed, label: exam.label, score: data.report.score };
          if (passed) {
            const ex = loadExams();
            ex[discipline] = { ...(ex[discipline] || {}), [exam.li]: { score: data.report.score, date: new Date().toLocaleDateString('it-IT') } };
            saveExams(ex);
          }
        }
        // Cerchio chiuso col percorso: sessione mirata a un argomento + voto ≥80
        // → l'argomento viene segnato appreso nel curriculum automaticamente.
        let learned = null;
        const po = pendingObjectiveRef.current;
        if (po && po.mode === discipline && (data.report.score ?? 0) >= 80) {
          const curr = CURRICULUM[discipline];
          for (let li = 0; li < (curr?.levels.length || 0); li++) {
            const ti = curr.levels[li].topics.indexOf(po.topic);
            if (ti === -1) continue;
            const prog = loadCurrProgress();
            const dp = prog[discipline] || {};
            const set = new Set(dp[`l${li}`] || []);
            if (!set.has(ti)) {
              set.add(ti);
              prog[discipline] = { ...dp, [`l${li}`]: [...set] };
              saveCurrProgress(prog);
              markTopicDate(discipline, li, ti);
              learned = po.topic;
            }
            break;
          }
          pendingObjectiveRef.current = null;
        }
        setSessionReport({ report: data.report, discipline, exam: examOutcome, learned });
        // arricchisci lo storico locale con voto + focus (usato anche per la progressione dei drill)
        try {
          const rep = data.report;
          const enriched = [{
            date: new Date().toLocaleDateString('it-IT'), mode: discipline, context,
            keyFeedback: rep.title, duration: durationMin,
            score: rep.score, weaknesses: rep.weaknesses, focusNext: rep.focusNext,
          }, ...loadSessions()].slice(0, 10);
          saveSessions(enriched); setPastSessions(enriched);
          markTrainDay(); // LA SCALATA: oggi conta come giorno di allenamento
        } catch (_) {}
      } else {
        setSessionReport(null);
      }
    } catch (_) {
      setSessionReport(null);
    }
  }, [guidedLevel]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    poseRef.current?.lm?.close();
    poseRef.current = null;
    timer.stop();
    const duration = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
    const verdicts = sessionVerdictsRef.current.slice();
    if (verdicts.length >= 2) {
      // Sessione con abbastanza dati → il Maestro genera la pagella (salva su Obsidian via KV)
      requestSessionReport({ durationMin: duration, verdicts, sampleCount, context: sessionContext, discipline: mode });
    } else if (analysis?.content) {
      // troppo poco per una pagella → salva solo il feedback chiave (comportamento precedente)
      const updated = [{ date: new Date().toLocaleDateString('it-IT'), mode, context: sessionContext, keyFeedback: analysis.content.slice(0, 200), duration }, ...pastSessions].slice(0, 10);
      saveSessions(updated); setPastSessions(updated);
    }
    sessionVerdictsRef.current = [];
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setReactOn(false); setCornerMsg(null);
    intensityRef.current = 0; prevLmRef.current = null; setIntensity(0);
    setStep('setup');
    sessionFeedbacksRef.current = [];
    insistedRef.current = [];      // nuova sessione: il maestro riparte, ma lo storico resta
    speakQueueRef.current = [];
    presentingRef.current = false;
    window.speechSynthesis?.cancel();
    setSessionAnalysis(null);
    clearInterval(autoTimerRef.current);
    clearInterval(guidedTimerRef.current); clearInterval(guidedTickRef.current);
    setGuidedOn(false); setGuidedPhase('idle'); setGuidedReview(null); setGuidedPlan([]); setGuidedIdx(0);
  };

  // ── Skeleton MediaPipe ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!streaming || !skeletonOn) {
      cancelAnimationFrame(rafRef.current);
      if (overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d');
        ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
      setCentered(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
        );
        if (!active) return;
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (!active) return;
        // Solo connessioni/punti dal corpo in giù (indici 11+): esclude naso/occhi/orecchie/bocca
        // (indici 0-10) che altrimenti affollano il volto di puntini inutili al coaching, specie
        // in selfie ravvicinato con le mani in guardia vicino al viso.
        const bodyConnections = (PoseLandmarker.POSE_CONNECTIONS || []).filter((c) => {
          const a = c.start ?? c[0], b = c.end ?? c[1];
          return a >= 11 && b >= 11;
        });
        poseRef.current = { lm, DrawingUtils, PoseLandmarker, bodyConnections };
        const loop = () => {
          if (!active) return;
          const video = videoRef.current;
          const canvas = overlayRef.current;
          if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
          // Align canvas to the actual displayed video area (object-contain letterbox)
          const vW = video.videoWidth || 640, vH = video.videoHeight || 480;
          const container = canvas.parentElement;
          if (container && vW > 0 && vH > 0) {
            const cW = container.clientWidth, cH = container.clientHeight;
            // object-cover: scala per RIEMPIRE, ritaglia l'eccesso (offset negativi)
            const scale = Math.max(cW / vW, cH / vH);
            const dW = Math.round(vW * scale), dH = Math.round(vH * scale);
            const dX = Math.round((cW - dW) / 2), dY = Math.round((cH - dH) / 2);
            canvas.width = dW; canvas.height = dH;
            canvas.style.left = dX + 'px'; canvas.style.top = dY + 'px';
            canvas.style.width = dW + 'px'; canvas.style.height = dH + 'px';
          } else {
            canvas.width = vW; canvas.height = vH;
          }
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const result = lm.detectForVideo(video, performance.now());
          if (result.landmarks.length > 0) {
            const visible = (i) => (result.landmarks[0][i]?.visibility ?? 0) > 0.45;
            const quality = visible(11) && visible(12) && visible(23) && visible(24)
              ? (visible(25) || visible(26) ? 'full' : 'upper') : 'partial';
            if (quality !== lastLocalQualityRef.current) {
              lastLocalQualityRef.current = quality; setTrackQuality(quality);
            }
            const du = new DrawingUtils(ctx);
            const bodyConns = poseRef.current?.bodyConnections || PoseLandmarker.POSE_CONNECTIONS;
            du.drawConnectors(result.landmarks[0], bodyConns,
              { color: 'rgba(0,255,136,0.8)', lineWidth: 2 });
            // Disegna i punti solo dal corpo in giù (indice 11+) — niente naso/occhi/orecchie/bocca
            du.drawLandmarks(result.landmarks[0].filter((_, i) => i >= 11),
              { color: '#FF6B35', lineWidth: 1, radius: 4 });
            lastLandmarksRef.current = result.landmarks[0];   // per la precisione AI (angoli reali)
            // ── TRAIL: scia di polsi/caviglie per il frame annotato dell'AI ──
            {
              const L = result.landmarks[0];
              const T = trailRef.current;
              T.push({ t: performance.now(), lw: [L[15].x, L[15].y], rw: [L[16].x, L[16].y], la: [L[27].x, L[27].y], ra: [L[28].x, L[28].y] });
              while (T.length > 26) T.shift();
              const cutoff = performance.now() - 900;
              while (T.length && T[0].t < cutoff) T.shift();
            }
            // ── CINEMATICA: storia angoli (~3.5s) + trend fatica ogni ~5s ──
            {
              const L = result.landmarks[0];
              const nowK = performance.now();
              const K = kinHistRef.current;
              K.push({ t: nowK, eL: jointAngle(L, 11, 13, 15), eR: jointAngle(L, 12, 14, 16), kL: jointAngle(L, 23, 25, 27), kR: jointAngle(L, 24, 26, 28) });
              if (studioLessonRef.current?.id === 'one-two' && studioPhaseRef.current === 'round') {
                const combo = studioComboRef.current;
                for (const [side, angle] of [['L', K[K.length - 1].eL], ['R', K[K.length - 1].eR]]) {
                  if (angle == null) continue;
                  if (angle < 115) combo.armed[side] = true;
                  if (angle >= 153 && combo.armed[side]) {
                    combo.armed[side] = false;
                    if (combo.last && combo.last !== side && nowK - combo.at < 1600) {
                      combo.count += 1; setStudioCombos(combo.count); combo.last = null;
                    } else { combo.last = side; combo.at = nowK; }
                  }
                }
              }
              while (K.length > 220) K.shift();
              while (K.length && nowK - K[0].t > 3500) K.shift();
              if (nowK - lastTrendTRef.current > 5000) {
                lastTrendTRef.current = nowK;
                const stanceW = L[27] && L[28] ? Math.abs(L[27].x - L[28].x) : null;
                const guardDown = (L[15] && L[11] && L[15].y > L[11].y + 0.08) || (L[16] && L[12] && L[16].y > L[12].y + 0.08);
                trendRef.current = [...trendRef.current, { t: nowK, stanceW, guardDown: guardDown ? 1 : 0 }].slice(-140);
              }
            }
            // ── MATCH: conteggio calci dalla camera (attivo da 3+ round) ──
            {
              const mc = matchCtxRef.current;
              if (mc.active && mc.rounds >= 3 && timerPhaseRef.current === 'round') {
                const K = kinHistRef.current;
                if (K.length >= 2) {
                  const hits = detectKicks(K[K.length - 2], K[K.length - 1], kickStateRef.current);
                  const M = matchKicksRef.current;
                  for (const h of hits) {
                    M.tot += 1;
                    if (h.side === 'kL') M.sx += 1; else M.dx += 1;
                    M.peaks.push(h.vel);
                  }
                }
              }
            }
            // ── COACH VOCALE: conteggio ripetizioni live (squat/piegamenti/calci) ──
            if (repCounterRef.current) {
              const K = kinHistRef.current;
              if (K.length >= 1) {
                const rr = repCounterRef.current.push(K[K.length - 1]);
                if (rr.counted) {
                  setVcCount(rr.count);
                  repBadStreakRef.current = rr.bad ? repBadStreakRef.current + 1 : 0;
                  const nowV = performance.now();
                  if (rr.bad && repBadStreakRef.current >= 2) {
                    repBadStreakRef.current = 0;
                    enqueueSpeak(repModeRef.current === 'squat' ? 'Scendi di più.' : repModeRef.current === 'push' ? 'Scendi col petto.' : repModeRef.current === 'punch' ? 'Colpisci più esplosivo e torna in guardia.' : 'Calcio più esplosivo.', true);
                  } else if (rr.count <= 3 || rr.count % 5 === 0) {
                    lastRepVoiceRef.current = nowV;
                    enqueueSpeak(rr.count % 5 === 0 ? `${rr.count}!` : String(rr.count), true);
                  } else if (nowV - lastRepVoiceRef.current > 1400) {
                    lastRepVoiceRef.current = nowV;
                    enqueueSpeak(String(rr.count), true);
                  }
                }
              }
            }
            // ── COMBO: fotogrammi chiave durante il GO → scheda di contatto ──
            if (comboPhaseRef.current === 'go' && video.readyState >= 2) {
              const nowC = performance.now();
              if (nowC - comboShotTRef.current > 350) {
                comboShotTRef.current = nowC;
                const cw = 384;
                const ch = Math.round((video.videoHeight || 480) * (cw / (video.videoWidth || 640)));
                const kc = comboCanvasRef.current || (comboCanvasRef.current = document.createElement('canvas'));
                kc.width = cw; kc.height = ch;
                kc.getContext('2d').drawImage(video, 0, 0, cw, ch);
                comboFramesRef.current.push(kc.toDataURL('image/jpeg', 0.5));
                if (comboFramesRef.current.length > 14) comboFramesRef.current.shift();
              }
            }
            // ── INTENSITÀ: spostamento medio dei landmark del corpo → EMA 0-100 ──
            {
              const curL = result.landmarks[0];
              const prevL = prevLmRef.current;
              if (prevL) {
                let d = 0, n = 0;
                for (let i = 11; i <= 28; i++) {
                  const a = curL[i], b = prevL[i];
                  if (a && b) { d += Math.hypot(a.x - b.x, a.y - b.y); n++; }
                }
                if (n) {
                  const inst = Math.min(100, (d / n) * 4200);
                  intensityRef.current = intensityRef.current * 0.9 + inst * 0.1;
                  const nowI = performance.now();
                  if (nowI - lastIntSetRef.current > 800) { lastIntSetRef.current = nowI; setIntensity(Math.round(intensityRef.current)); }
                }
              }
              prevLmRef.current = curL;
            }
            // ── SPECCHIO: colora i giunti verde/rosso confrontando con la tecnica target ──
            if (mirrorOnRef.current) {
              const Lm = result.landmarks[0];
              const m = matchPose(anglesFromLandmarks(Lm), mirrorTargetRef.current || 'guard');
              mirrorMatchRef.current = m;
              if (m) {
                const JI = { eL: 13, eR: 14, kL: 25, kR: 26, hL: 23, hR: 24 };
                for (const jn in JI) {
                  const st = m.joint[jn]; if (!st || st === 'na') continue;
                  const P = Lm[JI[jn]]; if (!P) continue;
                  ctx.beginPath();
                  ctx.arc(P.x * canvas.width, P.y * canvas.height, 9, 0, Math.PI * 2);
                  ctx.fillStyle = st === 'ok' ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.9)';
                  ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
                }
                if (m.joint.lean && m.joint.lean !== 'na' && Lm[11] && Lm[12] && Lm[23] && Lm[24]) {
                  const sX = ((Lm[11].x + Lm[12].x) / 2) * canvas.width, sY = ((Lm[11].y + Lm[12].y) / 2) * canvas.height;
                  const hX = ((Lm[23].x + Lm[24].x) / 2) * canvas.width, hY = ((Lm[23].y + Lm[24].y) / 2) * canvas.height;
                  ctx.beginPath(); ctx.moveTo(sX, sY); ctx.lineTo(hX, hY);
                  ctx.strokeStyle = m.joint.lean === 'ok' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)'; ctx.lineWidth = 5; ctx.stroke();
                }
                const now = performance.now();
                if (now - mirrorStateAtRef.current > 180) { mirrorStateAtRef.current = now; setMirrorState(m); }
              }
            }
            // Conta-ripetizioni (guidato): oscillazione angolo ginocchio/gomito
            if (guidedRunningRef.current) {
              const L = result.landmarks[0];
              const a3 = (a, b, c) => {
                const A = L[a], B = L[b], C = L[c];
                if (!A || !B || !C) return null;
                const v1x = A.x - B.x, v1y = A.y - B.y, v2x = C.x - B.x, v2y = C.y - B.y;
                const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
                if (!d) return null;
                return (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI;
              };
              const kL = a3(23, 25, 27), kR = a3(24, 26, 28), eL = a3(11, 13, 15), eR = a3(12, 14, 16);
              let aa = null;
              if (kL != null || kR != null) aa = ((kL ?? kR) + (kR ?? kL)) / 2;
              else if (eL != null || eR != null) aa = ((eL ?? eR) + (eR ?? eL)) / 2;
              if (aa != null) {
                if (repPhaseRef.current === 'up' && aa < 95) repPhaseRef.current = 'down';
                else if (repPhaseRef.current === 'down' && aa > 155) { repPhaseRef.current = 'up'; repCountRef.current += 1; setRepCount(repCountRef.current); }
              }
            }
            const nose = result.landmarks[0][0];
            if (nose) setCentered(nose.x > 0.2 && nose.x < 0.8 && nose.y < 0.85 ? 'ok' : 'off');
          } else {
            lastLandmarksRef.current = null;
            prevLmRef.current = null;
            setCentered('none');
            if (lastLocalQualityRef.current !== 'none') {
              lastLocalQualityRef.current = 'none'; setTrackQuality('none');
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        // MediaPipe non disponibile su questo browser/dispositivo
      }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      poseRef.current?.lm?.close();
      poseRef.current = null;
      setCentered(null);
    };
  }, [streaming, skeletonOn]);

  // Specchio: sincronizza il ref on/off e reset stato
  useEffect(() => { mirrorOnRef.current = mirrorOn; if (!mirrorOn) setMirrorState(null); }, [mirrorOn]);
  // Specchio: la tecnica da rispecchiare segue il workout/guidato/combo, altrimenti la scelta manuale
  useEffect(() => {
    let key;
    if (workout && workout.phases[workout.idx]) {
      key = workout.phases[workout.idx].mirror;
    } else if (guidedOn && (guidedPhase === 'running' || guidedPhase === 'ready') && guidedPlan[guidedIdx]) {
      key = resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim());
    } else if (comboOn && currentCombo) {
      key = resolvePose(currentCombo.split('-')[0].trim());
    } else {
      key = mirrorTech;
    }
    mirrorTargetRef.current = key; setMirrorTargetKey(key);
  }, [workout, guidedOn, guidedPhase, guidedIdx, guidedPlan, comboOn, currentCombo, mirrorTech]);

  // ── COACH VOCALE CONTINUO: corregge ad alta voce finché l'errore persiste ──
  // Prima: 1 correzione ogni 6s e solo con score <70. Ora: correzione ogni
  // ~2.5s quando c'è un errore (score <85), ripetuta con insistenza se non
  // viene corretta, + lode breve quando la posa torna giusta.
  useEffect(() => {
    if (!mirrorOn || !voiceOn || !mirrorState) return;
    const h = mirrorState.hints?.[0];
    const score = mirrorState.score ?? 0;
    const now = Date.now();
    if (h && score < 85) {
      const same = h === mirrorSpeakRef.current.msg;
      const gap = same ? 9000 : 2500; // stesso errore: ripeti meno spesso ma non mollare
      if (now - mirrorSpeakRef.current.t > gap) {
        mirrorSpeakRef.current = { t: now, msg: h };
        enqueueSpeak(h);
      }
    } else if (!h && score >= 92 && mirrorSpeakRef.current.msg) {
      // l'errore è stato corretto: rinforzo positivo (max 1 lode ogni 10s)
      if (now - mirrorSpeakRef.current.t > 10000) {
        mirrorSpeakRef.current = { t: now, msg: '' };
        enqueueSpeak(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      }
    }
  }, [mirrorState, mirrorOn, voiceOn, enqueueSpeak]);

  useEffect(() => {
    if (step !== 'live' || !academyLesson || studioPaused || !['round', 'rest'].includes(studioClock.phase)) return undefined;
    const tick = setInterval(() => {
      if (studioPhaseRef.current === 'round' && lastLandmarksRef.current && ['full', 'upper'].includes(lastLocalQualityRef.current)) {
        const match = mirrorMatchRef.current;
        if (match && Number.isFinite(match.score)) {
          studioSamplesRef.current.push({ score: match.score, hint: match.hints?.[0] || '' });
        }
      }
      setStudioClock((current) => {
        if (current.left > 1) return { ...current, left: current.left - 1 };
        if (current.phase === 'round') return current.round === (academyLesson.rounds || 3)
          ? { phase: 'done', round: current.round, left: 0 }
          : { phase: 'rest', round: current.round, left: 30 };
        return { phase: 'round', round: current.round + 1, left: academyLesson.roundSeconds || 120 };
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [step, academyLesson, studioPaused, studioClock.phase]);

  const studioAnnouncementRef = useRef('ready-1');
  useEffect(() => {
    if (!academyLesson || step !== 'live') return;
    const current = `${studioClock.phase}-${studioClock.round}`;
    if (current === studioAnnouncementRef.current) return;
    studioAnnouncementRef.current = current;
    if (studioClock.phase === 'round') enqueueSpeakRef.current(`Round ${studioClock.round}. ${academyLesson.roundPlan?.[studioClock.round - 1] || academyLesson.focus}`, true);
    if (studioClock.phase === 'rest') enqueueSpeakRef.current('Recupera 30 secondi. Respira e torna in guardia.', true);
    if (studioClock.phase === 'done') enqueueSpeakRef.current('Sessione completata. Ottimo lavoro. Guarda il riepilogo.', true);
  }, [academyLesson, step, studioClock.phase, studioClock.round]);

  useEffect(() => {
    if (!academyLesson?.id || studioClock.phase !== 'done' || studioSaved) return;
    const samples = studioSamplesRef.current;
    const average = samples.length ? Math.round(samples.reduce((sum, sample) => sum + sample.score, 0) / samples.length) : null;
    try {
      const key = 'shadow_monarch_mma_academy_v1';
      const previous = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...previous,
        done: { ...(previous.done || {}), [academyLesson.id]: true },
        lastSession: { lessonId: academyLesson.id, date: new Date().toISOString(), score: average, samples: samples.length, combinations: studioCombos, rounds: academyLesson.rounds || 3 },
      }));
    } catch {}
    setStudioSaved(true);
  }, [academyLesson, studioClock.phase, studioCombos, studioSaved]);

  // ── Motore workout: timer 1s, countdown vocale, gong e insegnamento a ogni fase ──
  const startCoachWorkout = useCallback(() => {
    const phases = buildCoachWorkout(mode, workoutSeedRef.current);
    workoutSeedRef.current += 1;
    const w = { phases, idx: 0, left: phases[0].seconds };
    workoutRef.current = w;
    setWorkout({ ...w });
    setMirrorOn(true); // lo specchio corregge live durante tutto il workout
    const dName = getDiscipline(mode)?.name || mode;
    enqueueSpeak(`Workout di ${dName}: ${phases.length} fasi. Prima: ${phases[0].name}. ${phases[0].teach}`, true);
  }, [mode, enqueueSpeak]);

  const stopCoachWorkout = useCallback(() => {
    workoutRef.current = null;
    setWorkout(null);
    enqueueSpeak('Workout interrotto.', true);
  }, [enqueueSpeak]);

  useEffect(() => {
    if (!workout) return undefined;
    const id = setInterval(() => {
      const w = workoutRef.current;
      if (!w) return;
      w.left -= 1;
      if (w.left === 3) enqueueSpeak('Tre', true);
      else if (w.left === 2) enqueueSpeak('due', true);
      else if (w.left === 1) enqueueSpeak('uno', true);
      else if (w.left <= 0) {
        if (w.idx + 1 >= w.phases.length) {
          workoutRef.current = null;
          setWorkout(null);
          playGong(); setTimeout(() => playGong(660), 500);
          enqueueSpeak('Workout completato. Ben fatto, guerriero.', true);
          if (setPlayerStats) { // XP del workout nel System
            setPlayerStats((prev) => {
              const { level, exp } = applyXp(prev, w.phases.length * 8);
              return { ...prev, level, exp };
            });
          }
          return;
        }
        playGong();
        w.idx += 1;
        const ph = w.phases[w.idx];
        w.left = ph.seconds;
        enqueueSpeak(`${ph.name}. ${ph.teach}`, true);
      }
      setWorkout({ ...w });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout ? 1 : 0]);

  const buildPrompt = useCallback((basePrompt) => {
    let p = basePrompt || '';
    p += curriculumContext(mode);
    if (sessionContext.trim()) p += `\n\nSESSIONE ATTUALE: ${sessionContext.trim()}`;
    if (pastSessions.length > 0)
      p += `\n\nSESSIONI PRECEDENTI:\n` + pastSessions.slice(0, 2).map((s) => `- ${s.date} (${s.mode}): ${s.context} → ${s.keyFeedback}`).join('\n');
    const hist = feedbackHistoryRef.current;
    if (hist.length > 0)
      p += `\n\nFEEDBACK RECENTI (NON ripetere queste frasi, varia sempre il focus):\n` + hist.map((f, i) => `${i + 1}. ${f}`).join('\n');
    return p;
  }, [mode, sessionContext, pastSessions]);

  // ── CORNER COACH: al suono del gong il maestro ti aspetta all'angolo ─────────
  // Round → accumula verdetti; Rest → discorso da cornerman (AI) + cue respiro.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = timer.phase;
    timerPhaseRef.current = timer.phase;
    if (timer.phase === prev) return;
    if (timer.phase === 'round') { roundStartIdxRef.current = sessionVerdictsRef.current.length; setCornerMsg(null); }
    if (timer.phase === 'rest') {
      const roundVerdicts = sessionVerdictsRef.current.slice(roundStartIdxRef.current);
      setCornerMsg({ loading: true });
      fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cornerTalk: true, mode, roundNumber: timer.currentRound, totalRounds: timer.totalRounds, verdicts: roundVerdicts }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!d?.talk) { setCornerMsg(null); return; }
          setCornerMsg({ talk: d.talk, breath: d.breath });
          enqueueSpeak(`All'angolo. ${d.talk} ${d.breath || ''}`);
        })
        .catch(() => setCornerMsg(null));
    }
    if (timer.phase === 'finished') setCornerMsg(null);
  }, [timer.phase, timer.currentRound, timer.totalRounds, mode, enqueueSpeak]);

  // ── REACTION TRAINER: comandi random a voce → reattività da vero allenatore ──
  useEffect(() => {
    reactOnRef.current = reactOn;
    clearTimeout(reactTimerRef.current);
    if (!reactOn) { setReactCall(''); return; }
    setReactCount(0);
    let last = '';
    const tick = () => {
      if (!reactOnRef.current) return;
      const [min, max] = REACT_DIFFS[reactDiff] || REACT_DIFFS.medio;
      // in pausa durante il riposo del round: il reflex riparte al gong
      if (timerPhaseRef.current === 'rest') {
        reactTimerRef.current = setTimeout(tick, 1500);
        return;
      }
      const calls = reactionCallsFor(mode);
      let call = calls[Math.floor(Math.random() * calls.length)];
      if (call === last && calls.length > 1) call = calls[(calls.indexOf(call) + 1) % calls.length];
      last = call;
      setReactCall(call);
      setReactCount((c) => c + 1);
      try {
        const u = new SpeechSynthesisUtterance(call.replace(/!/g, ''));
        u.lang = 'it-IT'; u.rate = 1.18; u.pitch = 1.05;
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(u);
      } catch {}
      if (navigator.vibrate) navigator.vibrate(45);
      reactTimerRef.current = setTimeout(tick, min + Math.random() * (max - min));
    };
    reactTimerRef.current = setTimeout(tick, 1200);
    return () => clearTimeout(reactTimerRef.current);
  }, [reactOn, reactDiff, mode]);

  // ── ALVEARE: invia un campione coach al cloud (KV → ponte Obsidian) ─────────
  const postSample = useCallback(async (row) => {
    if (!row) return;
    try {
      const r = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample: row, mode }),
      });
      if (r.ok) setSampleCount((n) => n + 1);
    } catch (_) { /* silenzioso: la cattura non deve mai disturbare la sessione */ }
  }, [mode]);

  // Mette in staging un nuovo verdetto: se ce n'era uno non etichettato, lo invia (label vuota).
  const stageSample = useCallback((verdict, angles, alerts) => {
    if (pendingSampleRef.current) postSample(pendingSampleRef.current); // flush del precedente
    pendingSampleRef.current = {
      exercise: mode,
      verdict: (verdict || '').split('\n')[0].slice(0, 200),
      angles: angles || {},
      alerts: alerts || [],
      label: '',
    };
    // Accumula la riga COMANDO/chiave per la pagella di fine sessione (max 40).
    // Tollera marker tronchi ("ANDO:" invece di "COMANDO:") via MARKER_RE.
    const lines = String(verdict || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const cmdLine = lines.find((l) => { const m = l.match(MARKER_RE); return m && canonicalMarker(m[1]) === 'COMANDO'; });
    const key = normalizeCoachingText((cmdLine || lines[0] || '').replace(MARKER_RE, '')).slice(0, 220);
    if (key) sessionVerdictsRef.current = [...sessionVerdictsRef.current, key].slice(-40);
    setSampleFeedback('shown');
  }, [mode, postSample]);

  // L'utente etichetta l'ultimo verdetto (👍 utile / 👎 sbagliato) → invio immediato.
  const labelSample = useCallback((label) => {
    const row = pendingSampleRef.current;
    if (!row) return;
    pendingSampleRef.current = null;
    postSample({ ...row, label });
    setSampleFeedback(label);
    setTimeout(() => setSampleFeedback(null), 1600);
  }, [postSample]);

  // Flush best-effort dell'ultimo campione non etichettato all'uscita (unmount / cambio disciplina).
  useEffect(() => () => {
    const row = pendingSampleRef.current;
    if (row && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/nvidia/visual',
          new Blob([JSON.stringify({ sample: row, mode })], { type: 'application/json' }));
      } catch (_) {}
      pendingSampleRef.current = null;
    }
    if (pendingComboFocusRef.current.length && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/nvidia/visual',
          new Blob([JSON.stringify({ webPrefs: { comboFocus: pendingComboFocusRef.current } })], { type: 'application/json' }));
      } catch (_) {}
      pendingComboFocusRef.current = [];
    }
  }, [mode]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    analyzingRef.current = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    // Frame annotato anche per l'analisi manuale (risoluzione più alta: 768px)
    const pose = computePose();
    let base64;
    if (skeletonOn && lastLandmarksRef.current) {
      base64 = drawAnnotatedFrame(video, lastLandmarksRef.current, pose, trailRef.current, 768, 0.72);
    } else {
      canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      base64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    }
    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, prompt: buildPrompt(currentDisc?.prompt), secretLevel: secretLevelForMode(mode) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      // Display SUBITO e persistente (non sparisce); la voce va in coda separata
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
      enqueueSpeak(data.content);
      stageSample(data.content, {}, []); // cattura per l'alveare (angoli non calcolati in manuale)
      // Store last 3 feedbacks to avoid repetition
      feedbackHistoryRef.current = [data.content.split('\n')[0], ...feedbackHistoryRef.current].slice(0, 3);
      // Accumulate all feedbacks for session analysis
      sessionFeedbacksRef.current = [...sessionFeedbacksRef.current, data.content].slice(0, 30);
      if (isSparring(mode) && data.content) {
        const point = parsePoint(data.content);
        if (point) {
          setScore((s) => ({ ...s, [point]: s[point] + 1 }));
          setLastPoint(point);
          setTimeout(() => setLastPoint(null), 2500);
        }
      }
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally { setAnalyzing(false); analyzingRef.current = false; }
  }, [mode, buildPrompt, currentDisc, enqueueSpeak, stageSample]);

  // ── PRECISIONE: angoli reali dallo scheletro + smoothing + framing + segnali ──
  const poseHistRef = useRef([]);
  const computePose = useCallback(() => {
    const lm = lastLandmarksRef.current;
    if (!lm || lm.length < 29) return { framingOk: false, quality: 'none', hint: '', alerts: [], angles: {} };
    const vis = (i) => lm[i]?.visibility ?? 1;
    const ang = (a, b, c) => {
      const A = lm[a], B = lm[b], C = lm[c];
      if (!A || !B || !C || vis(a) < 0.4 || vis(b) < 0.4 || vis(c) < 0.4) return null;
      const v1x = A.x - B.x, v1y = A.y - B.y, v2x = C.x - B.x, v2y = C.y - B.y;
      const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
      if (!d) return null;
      return Math.round((Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI);
    };
    // 1) framing/qualità tracking
    const core = vis(11) > 0.4 && vis(12) > 0.4 && vis(23) > 0.4 && vis(24) > 0.4;
    const legs = vis(25) > 0.4 || vis(26) > 0.4;
    const anyVis = lm.some((p) => (p?.visibility ?? 0) > 0.5);
    const quality = core ? (legs ? 'full' : 'upper') : (anyVis ? 'partial' : 'none');
    const framingOk = core;
    // 2) smoothing: mediana delle ultime 3 letture per stabilità
    const cur = { eL: ang(11, 13, 15), eR: ang(12, 14, 16), kL: ang(23, 25, 27), kR: ang(24, 26, 28), hL: ang(11, 23, 25), hR: ang(12, 24, 26) };
    const hist = [...poseHistRef.current, cur].slice(-3);
    poseHistRef.current = hist;
    const med = (k) => { const v = hist.map((h) => h[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const sm = { eL: med('eL'), eR: med('eR'), kL: med('kL'), kR: med('kR'), hL: med('hL'), hR: med('hR') };
    const sM = lm[11] && lm[12] ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 } : null;
    const hM = lm[23] && lm[24] ? { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 } : null;
    const lean = sM && hM ? Math.round((Math.atan2(Math.abs(sM.x - hM.x), Math.abs(hM.y - sM.y) || 0.001) * 180) / Math.PI) : null;
    const parts = [];
    const p = (lbl, v) => { if (v != null) parts.push(`${lbl} ${v}°`); };
    p('gomito sx', sm.eL); p('gomito dx', sm.eR); p('ginocchio sx', sm.kL); p('ginocchio dx', sm.kR); p('anca sx', sm.hL); p('anca dx', sm.hR);
    if (lean != null) parts.push(`busto ${lean}° dalla verticale`);
    if (intensityRef.current > 1) parts.push(`intensità movimento ${Math.round(intensityRef.current)}/100`);
    // 3) segnali geometrici misurati (fatti certi per l'AI)
    const alerts = [];
    if (sm.eL != null && sm.eL > 168) alerts.push('gomito sx iperesteso');
    if (sm.eR != null && sm.eR > 168) alerts.push('gomito dx iperesteso');
    const striking = /box|mma|muay|kick|karate|taekwondo|sanda|kung|wing|krav|sambo|hapkido|judo|wrestl|bjj|luta|pankration|silat|systema|capoeira|kendo/i.test(mode);
    if (striking) {
      if (vis(15) > 0.4 && vis(11) > 0.4 && lm[15].y > lm[11].y + 0.08) alerts.push('guardia sx bassa (mano sotto la spalla)');
      if (vis(16) > 0.4 && vis(12) > 0.4 && lm[16].y > lm[12].y + 0.08) alerts.push('guardia dx bassa (mano sotto la spalla)');
    }
    if (lean != null && lean > 38) alerts.push('busto troppo inclinato');
    return { framingOk, quality, hint: parts.join(', '), alerts, angles: { ...sm, lean } };
  }, [mode]);

  // ── AUTO: il maestro osserva in silenzio, poi UN verdetto (no voce ogni tick) ──
  // Ogni tick = un'osservazione silenziosa accumulata. Al 3° tick → verdetto fuso e
  // letto UNA volta. Se un'osservazione vede rischio infortunio → verdetto SUBITO.
  const autoTick = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    analyzingRef.current = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const pose = computePose();
    // FRAME ANNOTATO: se lo scheletro c'è, l'AI riceve il frame con scheletro
    // colorato + scia del movimento + HUD degli angoli misurati. Altrimenti
    // fallback al frame grezzo (downscale a max 512px per upload leggero).
    let base64;
    if (skeletonOn && lastLandmarksRef.current) {
      base64 = drawAnnotatedFrame(video, lastLandmarksRef.current, pose, trailRef.current);
    } else {
      const vw = video.videoWidth || 640;
      const sc = Math.min(1, 512 / vw);
      canvas.width = Math.round((video.videoWidth || 640) * sc); canvas.height = Math.round((video.videoHeight || 480) * sc);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    }
    // GATE inquadratura: corpo parziale o assente → niente analisi imprecisa,
    // e il maestro ti dice A VOCE come rimetterti in quadro (max una volta ogni 20s)
    if (skeletonOn && (pose.quality === 'partial' || pose.quality === 'none')) {
      const msg = pose.quality === 'none'
        ? 'Non ti vedo: entra nell\'inquadratura, petto e gambe visibili.'
        : 'Non ti vedo tutto: arretra di un passo, mi serve il corpo intero.';
      setFramingHint(pose.quality === 'none' ? 'Entra nell\'inquadratura' : 'Inquadra tutto il corpo nel riquadro');
      setTrackQuality(pose.quality);
      const nowF = Date.now();
      if (nowF - lastFramingVoiceRef.current > 20000) {
        lastFramingVoiceRef.current = nowF;
        enqueueSpeak(msg);
      }
      analyzingRef.current = false; return;
    }
    setFramingHint(''); setTrackQuality(pose.quality);
    // CINEMATICA: velocità/rep-quality dal buffer scheletro + segnali fatica
    const kin = skeletonOn ? analyzeKinematics(kinHistRef.current) : null;
    // QUOTA FREE: se non succede nulla (niente azione, intensità minima, nessun
    // alert) la chiamata AI si salta — l'occhio osserva solo quando conta.
    const calmMode = /yoga|stretch|breath|medita|mobilit|running/.test(mode);
    if (kin && !kin.active && intensityRef.current < 3 && !pose.alerts.length && !calmMode) {
      analyzingRef.current = false; return;
    }
    const JOINT_LABEL = { eL: 'gomito sx', eR: 'gomito dx', kL: 'ginocchio sx', kR: 'ginocchio dx' };
    let poseHint = pose.hint + (pose.alerts.length ? `. SEGNALI MISURATI (certi): ${pose.alerts.join('; ')}` : '');
    if (kin && (kin.peakDeg > 0 || kin.strikes.tot > 0)) {
      poseHint += `. CINEMATICA MISURATA: picco ${kin.peakDeg}°/s${kin.peakJoint ? ` (${JOINT_LABEL[kin.peakJoint] || kin.peakJoint})` : ''}`;
      if (kin.strikes.tot > 0) poseHint += `; colpi ${kin.strikes.tot}: ${kin.strikes.esplosivi} esplosivi, ${kin.strikes.lenti} lenti al ritorno`;
    }
    const fat = skeletonOn ? fatigueFromTrend(trendRef.current) : null;
    if (fat?.fatigued) poseHint += `. SEGNALE FATICA (misurato): ${fat.reasons.join('; ')}`;
    setAnalyzing(true);
    try {
      // 1) OSSERVAZIONE silenziosa (osservatori, niente cervello, niente voce)
      const obsRes = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, observeOnly: true, poseHint }),
      });
      const obsData = await obsRes.json();
      let reachedVerdict = false;
      if (obsRes.ok && obsData.observation) {
        const obsText = poseHint ? `${obsData.observation} [angoli: ${poseHint}]` : obsData.observation;
        observationsRef.current = [...observationsRef.current, obsText].slice(-VERDICT_EVERY);
        setObserveProgress(observationsRef.current.length);
        const urgent = obsData.risk || /infortun|rischio|pericol|cede|collass|iperesten/i.test(obsData.observation);
        reachedVerdict = urgent || observationsRef.current.length >= VERDICT_EVERY;
      }
      // 2) VERDETTO finale del maestro (parla UNA volta) — su tutte le osservazioni
      if (reachedVerdict) {
        const verRes = await fetch('/api/nvidia/visual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode, observations: observationsRef.current, prompt: buildPrompt(currentDisc?.prompt), poseHint,
            secretLevel: secretLevelForMode(mode),
            // Il maestro sa CHI ha davanti: difetti storici da cacciare, cose già risolte, cosa gli ha già detto stasera.
            learner: buildLearnerProfile(pastSessionsRef.current, mode, insistedRef.current),
          }),
        });
        const data = await verRes.json();
        if (verRes.ok && data.content) {
          setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
          enqueueSpeak(data.content);
          stageSample(data.content, pose.angles, pose.alerts); // cattura per l'alveare (angoli reali)
          // Registra su cosa ha già insistito stasera → se ricapita, rincara invece di ricominciare da zero.
          const cmd = extractCommand(data.content) || data.content;
          if (cmd) {
            anchorsOf(cmd).forEach((a) => {
              const prev = insistedRef.current.find((x) => x.startsWith(`${a} ×`));
              const n = prev ? parseInt(prev.split('×')[1], 10) + 1 : 1;
              insistedRef.current = [...insistedRef.current.filter((x) => x !== prev), `${a} ×${n}: ${cmd.slice(0, 60)}`].slice(-4);
            });
          }
          feedbackHistoryRef.current = [data.content.split('\n')[0], ...feedbackHistoryRef.current].slice(0, 3);
          sessionFeedbacksRef.current = [...sessionFeedbacksRef.current, data.content].slice(0, 30);
          if (isSparring(mode) && data.content) {
            const point = parsePoint(data.content);
            if (point) { setScore((s) => ({ ...s, [point]: s[point] + 1 })); setLastPoint(point); setTimeout(() => setLastPoint(null), 2500); }
          }
        }
        observationsRef.current = [];
        setObserveProgress(0);
      }
    } catch (_) {
      // silenzioso: tieni l'ultimo verdetto a schermo
    } finally { setAnalyzing(false); analyzingRef.current = false; }
  }, [mode, buildPrompt, currentDisc, enqueueSpeak, computePose, skeletonOn, stageSample]);

  const analyzeSession = useCallback(async () => {
    const feedbacks = sessionFeedbacksRef.current;
    if (feedbacks.length === 0) return;
    setAnalyzingSession(true);
    try {
      const res = await fetch('/api/nvidia/visual-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks, discipline: currentDisc?.label, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore analisi sessione');
      setSessionAnalysis({ content: data.content, provider: data.provider });
    } catch (err) {
      setSessionAnalysis({ content: '⚠️ ' + err.message, provider: null });
    } finally {
      setAnalyzingSession(false);
    }
  }, [mode, currentDisc]);

  useEffect(() => {
    if (autoMode && streaming) {
      observationsRef.current = []; setObserveProgress(0);
      autoTick();
      autoTimerRef.current = setInterval(autoTick, 4000);
    } else {
      clearInterval(autoTimerRef.current);
      observationsRef.current = []; setObserveProgress(0);
    }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  // ── GUIDATO: genera circuito → drill (Via → timer+osserva → pagella) → next ──
  const stopGuidedTimers = useCallback(() => {
    clearInterval(guidedTimerRef.current); guidedTimerRef.current = null;
    clearInterval(guidedTickRef.current); guidedTickRef.current = null;
  }, []);

  // Piano LOCALE garantito — usato se l'AI non risponde: così il circuito parte SEMPRE.
  // Varia per obiettivo dichiarato (sessionContext) e, in assenza di un obiettivo esplicito,
  // considera le debolezze/focus delle sessioni precedenti per la stessa disciplina (progressione
  // che prima avveniva solo lato AI — qui il fallback locale non era mai stato personalizzato).
  const buildLocalPlan = useCallback(() => {
    const scene = sceneFor(mode);
    const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    // obiettivo: priorità all'input esplicito della sessione corrente, altrimenti storico recente
    const goal = resolveGoal(sessionContext) || resolveGoalFromHistory(pastSessions, mode);
    if (scene === 'solo') {
      if (mode === 'yoga' || mode === 'stretching') return buildYogaTemplate(goal === 'difesa' ? 'mobilita' : goal);
      if (mode === 'running') return buildRunningTemplate(goal === 'difesa' ? null : goal);
      if (mode === 'breathing') return buildBreathingTemplate(goal === 'difesa' ? 'mobilita' : goal);
      // calisthenics / crossfit / fitness / general → template forza/cardio/tecnica
      return buildFitnessTemplate(goal === 'difesa' ? null : goal);
    }
    // strike / opponent → usa i combo della disciplina (gestisce anche sparring_<disciplina>)
    const baseMode = String(mode || '').replace(/^sparring_/, '');
    const combos = COMBO_LIBRARY[mode] || COMBO_LIBRARY[baseMode] || COMBO_LIBRARY.default;
    const picks = shuffle(combos).slice(0, 4).map((entry) => (typeof entry === 'string' ? entry : entry.c));
    return buildStrikeTemplate(goal, picks);
  }, [mode, sessionContext, pastSessions]);

  const generateGuidedPlan = useCallback(async () => {
    setGuidedLoading(true); setGuidedReview(null); setGuidedPhase('gen');
    let drills = null;
    try {
      // progressione: passa lo storico locale (voti + debolezze + focus) così i drill crescono
      const history = pastSessions
        .filter((s) => s.mode === mode && (s.score != null || s.focusNext?.length))
        .slice(0, 5)
        .map((s) => `${s.date} voto ${s.score ?? '-'}/100 · da migliorare: ${(s.weaknesses || []).join('; ') || '-'} · focus→ ${(s.focusNext || []).join('; ') || '-'}`);
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePlan: true, mode, goal: sessionContext, level: guidedLevel, context: sessionContext, history }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.drills) && data.drills.length) drills = data.drills;
    } catch (_) { /* rete/AI giù → fallback locale */ }
    // Fallback GARANTITO: se l'AI non produce nulla, usa il piano locale della disciplina.
    if (!drills || !drills.length) drills = buildLocalPlan();
    setGuidedPlan(drills); setGuidedIdx(0); setGuidedPhase('ready'); setGuidedLoading(false);
  }, [mode, sessionContext, guidedLevel, pastSessions, buildLocalPlan]);

  const finishDrillRef = useRef(() => {});
  const nextDrillRef = useRef(() => {});

  const finishDrill = useCallback(async () => {
    stopGuidedTimers(); guidedRunningRef.current = false;
    setGuidedPhase('review'); setGuidedLoading(true);
    const d = guidedPlan[guidedIdx] || {};
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillReview: true, mode, drill: d, observations: guidedObsRef.current }),
      });
      const data = await res.json();
      if (res.ok && data.review) {
        setGuidedReview(data.review);
        if (data.review.cue) enqueueSpeak(`${d.name}. ${data.review.cue}`);
        if (guidedAutoAdvance) setTimeout(() => nextDrillRef.current(), 7000);
      }
    } catch {} finally { setGuidedLoading(false); }
  }, [guidedPlan, guidedIdx, mode, enqueueSpeak, guidedAutoAdvance, stopGuidedTimers]);
  finishDrillRef.current = finishDrill;

  const startDrill = useCallback(() => {
    const d = guidedPlan[guidedIdx]; if (!d) return;
    guidedObsRef.current = []; setGuidedReview(null);
    repCountRef.current = 0; repPhaseRef.current = 'up'; setRepCount(0); guidedRunningRef.current = true; // conta-rip
    setGuidedPhase('running'); setGuidedTimeLeft(d.durationSec);
    unlockSpeech();
    enqueueSpeak(`Prossimo: ${d.name}. ${d.focus || ''}. Pronti, via!`);
    guidedTimerRef.current = setInterval(() => {
      setGuidedTimeLeft((t) => { if (t <= 1) { finishDrillRef.current(); return 0; } return t - 1; });
    }, 1000);
    guidedTickRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
      analyzingRef.current = true;
      try {
        const canvas = canvasRef.current, video = videoRef.current;
        canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
        const r = await fetch('/api/nvidia/visual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, observeOnly: true }) });
        const dt = await r.json();
        if (r.ok && dt.observation) guidedObsRef.current = [...guidedObsRef.current, dt.observation].slice(-8);
      } catch {} finally { analyzingRef.current = false; }
    }, 4000);
  }, [guidedPlan, guidedIdx, mode, enqueueSpeak, unlockSpeech]);

  const nextDrill = useCallback(() => {
    stopGuidedTimers(); setGuidedReview(null);
    setGuidedIdx((i) => {
      const ni = i + 1;
      if (ni >= guidedPlan.length) { setGuidedPhase('done'); return i; }
      setGuidedPhase('ready'); return ni;
    });
  }, [guidedPlan, stopGuidedTimers]);
  nextDrillRef.current = nextDrill;

  const startGuided = useCallback(() => {
    if (autoMode) setAutoMode(false);
    setGuidedOn(true);
    if (guidedPlan.length === 0) generateGuidedPlan();
    else setGuidedPhase('ready');
  }, [autoMode, guidedPlan, generateGuidedPlan]);

  const stopGuided = useCallback(() => {
    stopGuidedTimers(); guidedRunningRef.current = false;
    setGuidedOn(false); setGuidedPhase('idle'); setGuidedReview(null);
    window.speechSynthesis?.cancel();
  }, [stopGuidedTimers]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // Snapshot per l'HUD olografico: legge i ref, nessun re-render del Coach.
  // DEVE stare prima del return anticipato di 'setup' qui sotto: un hook
  // dichiarato dopo un return condizionale viene chiamato solo in alcuni
  // render (qui sì/no a seconda di step) → "Rendered fewer hooks than
  // expected" (React #310), crash totale al primo cambio di step.
  const hudSnapshot = useCallback(() => ({
    elapsedSec: sessionStartRef.current ? Math.floor((Date.now() - sessionStartRef.current) / 1000) : 0,
    intensity: Math.round(intensityRef.current),
    kicks: matchKicksRef.current.tot,
    matchOn: matchCtxRef.current.active && matchCtxRef.current.rounds >= 3 && timerPhaseRef.current === 'round',
  }), []);

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    if (academyLesson) return (
      <div className="coach-academy-setup space-y-4 pb-5">
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg,#153239,#111a29)', border: '1px solid #6de2d366' }}>
          <p className="academy-eyebrow text-[10px] font-bold tracking-[.2em] text-cyan-300">LEZIONE GUIDATA / MMA</p>
          <h2 className="text-2xl font-black text-white mt-2">{academyLesson.title}</h2>
          <p className="text-sm text-slate-300 leading-relaxed mt-3">{academyLesson.focus}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/[.04] border border-white/10">
          <p className="text-[10px] font-bold tracking-widest text-cyan-300">IL DRILL</p>
          <p className="text-sm text-slate-200 mt-2 leading-relaxed">{academyLesson.drill}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/[.04] border border-white/10">
          <p className="text-[10px] font-bold tracking-widest text-cyan-300">FEEDBACK DALLA CAMERA</p>
          <p className="text-sm text-slate-200 mt-2">{academyLesson.camera}</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{aiStatus === 'offline' ? 'Lo specchio posturale è attivo. In questa anteprima il servizio AI è offline: riceverai solo le correzioni locali basate sulla posa.' : 'Lo specchio posturale è già attivo. Inquadra il corpo intero; il feedback AI dipende dalla connessione al servizio.'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { unlockSpeech(); setWarmupKind('warmup'); }} className="flex-1 rounded-xl border border-orange-400/40 bg-orange-400/10 text-orange-200 py-3 text-xs font-bold">Riscaldamento 3'</button>
          <button onClick={() => { unlockSpeech(); setWarmupKind('cooldown'); }} className="flex-1 rounded-xl border border-sky-400/40 bg-sky-400/10 text-sky-200 py-3 text-xs font-bold">Defaticamento</button>
        </div>
        <button onClick={startSession} className="academy-start w-full rounded-xl py-4 bg-cyan-300 text-slate-950 font-black text-sm">AVVIA CAMERA E LEZIONE</button>
        <button onClick={() => setAcademyLesson(null)} className="w-full py-2 text-xs text-slate-400">Altre modalità del coach</button>
        {warmupKind === 'warmup' && <RoutineOverlay title="RISCALDAMENTO" emoji="🔥" color="orange" steps={WARMUP_STEPS} voiceOn={voiceOn} onExit={() => setWarmupKind(null)} />}
        {warmupKind === 'cooldown' && <RoutineOverlay title="DEFATICAMENTO" emoji="🧘" color="blue" steps={COOLDOWN_STEPS} voiceOn={voiceOn} onExit={() => setWarmupKind(null)} />}
      </div>
    );
    return (
      <div className="space-y-4">
        {/* 🎓/🎯 Sessione pre-configurata dal Curriculum */}
        {examBanner && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-4 py-3"
            style={examBanner.milestone
              ? { background: 'linear-gradient(135deg, rgba(244,63,94,0.14), rgba(17,24,39,0.9))', border: `1px solid ${C.rose.border}`, boxShadow: `0 0 16px ${C.rose.glow}` }
              : { background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(17,24,39,0.9))', border: `1px solid ${C.emerald.border}` }}>
            {examBanner.milestone ? (
              <>
                <p className="text-xs font-black tracking-widest" style={{ color: C.rose.hex, fontFamily: 'Syne, sans-serif' }}>🎓 ESAME MILESTONE — {examBanner.label}</p>
                <p className="text-[11px] mt-1 text-gray-300">{examBanner.milestone}</p>
                <p className="text-[10px] mt-1" style={{ color: '#6b7280' }}>Il Maestro giudica da esaminatore: serve ≥75/100 per la promozione. Avvia la sessione quando sei pronto.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-black tracking-widest" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>🎯 OBIETTIVO DAL PERCORSO</p>
                <p className="text-[11px] mt-1 text-gray-300">{examBanner.objective}</p>
              </>
            )}
          </motion.div>
        )}

        {/* 🎯 Il percorso della disciplina scelta: sempre visibile, il coach sa dove sei */}
        {!examBanner && liveObjective && CURRICULUM[mode] && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.07), rgba(17,24,39,0.85))', border: `1px solid ${C.emerald.border}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black tracking-widest" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>
                🎯 PERCORSO — {liveObjective.level.label}
              </p>
              <p className="text-xs mt-0.5 text-gray-300 truncate">
                {liveObjective.levelComplete ? `Pronto per l'esame: ${liveObjective.milestone}` : liveObjective.topic}
              </p>
            </div>
            {(() => { const r = disciplineRank(mode); return r && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-black font-mono flex-shrink-0"
                style={{ background: r.rank === 'S' ? 'rgba(244,63,94,0.15)' : 'rgba(139,92,246,0.12)', color: r.rank === 'S' ? C.rose.hex : C.violet.hex, border: `1px solid ${r.rank === 'S' ? C.rose.border : C.violet.border}` }}>
                RANGO {r.rank}
              </span>
            ); })()}
          </div>
        )}

        {/* 🔥 Streak e volume settimanale */}
        {(liveStats.streak > 0 || liveStats.weekMin > 0) && (
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(249,115,22,0.1)', color: C.orange.hex, border: `1px solid ${C.orange.border}` }}>
              🔥 Streak {liveStats.streak} {liveStats.streak === 1 ? 'giorno' : 'giorni'}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(59,130,246,0.08)', color: C.blue.hex, border: `1px solid ${C.blue.border}` }}>
              ⏱️ {liveStats.weekMin} min negli ultimi 7 giorni
            </span>
          </div>
        )}
        {/* 🎁 Biglietto una-tantum: Arena Edition */}
        {!localStorage.getItem('sm_arena_gift_seen') && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="relative rounded-2xl px-4 py-3.5 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.14), rgba(139,92,246,0.12))', border: '1px solid rgba(251,191,36,0.45)', boxShadow: '0 0 24px rgba(251,191,36,0.15)' }}>
            {!_prefersReducedMotion() && [12, 34, 58, 79, 91].map((x, i) => (
              <motion.span key={i} aria-hidden className="absolute bottom-1 w-1 h-1 rounded-full pointer-events-none"
                style={{ left: `${x}%`, background: i % 2 ? '#fbbf24' : '#a78bfa', boxShadow: '0 0 5px currentColor' }}
                animate={{ y: [0, -46], opacity: [0, 0.85, 0] }}
                transition={{ duration: 2.4 + i * 0.4, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }} />
            ))}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>🎁 ARENA EDITION</p>
                <p className="text-[11px] mt-1 leading-snug text-gray-300">
                  Buon compleanno, Monarca. 👑 Il Coach è stato forgiato di nuovo: arena con riflettori, impatti con scintille e detriti,
                  esplosione sui <b style={{ color: '#34d399' }}>PERFECT</b> — e un motore d'animazione che consuma la metà.
                </p>
              </div>
              <button onClick={(e) => { localStorage.setItem('sm_arena_gift_seen', '1'); e.currentTarget.closest('div.relative').style.display = 'none'; }}
                className="text-gray-500 hover:text-gray-300 flex-shrink-0 p-1" aria-label="Chiudi"><X size={14} /></button>
            </div>
          </motion.div>
        )}
        <div className="relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(13,148,136,0.06))', border: `1px solid ${C.emerald.border}` }}>
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #10b981 40%, #0d9488 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
          <div className="relative px-4 py-3.5 overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', animation: 'drift-slow 8s ease-in-out infinite' }} />
            <p className="text-xs font-black tracking-widest" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>📷 VISUAL LIVE COACH</p>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Groq Scout · Cosmos · Gemma Brain · 27 discipline</p>
          </div>
        </div>

        {DISCIPLINE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-black text-gray-600 mb-2 tracking-widest" style={{ fontFamily: 'Syne, sans-serif' }}>{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((d) => {
                const isActive = mode === d.id;
                const isSpar = isSparring(d.id);
                const col = isSpar ? C.violet : C.emerald;
                return (
                  <motion.button key={d.id} whileTap={{ scale: 0.91 }} whileHover={{ scale: 1.04 }} onClick={() => setMode(d.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative overflow-hidden"
                    style={isActive
                      ? { background: `linear-gradient(135deg, ${col.hex}33, ${col.hex}11)`, color: col.hex, boxShadow: `0 0 0 1px ${col.border}, 0 4px 14px ${col.glow}`, border: `1px solid ${col.border}` }
                      : { background: 'rgba(55,65,81,0.35)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {isActive && <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', animation: 'chip-sheen 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />}
                    {d.emoji} {d.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {isPartnerMode && (
          <div className="p-3 rounded-xl" style={{ background: C.violet.bg, border: `1px solid ${C.violet.border}` }}>
            <p className="text-xs font-bold" style={{ color: C.violet.hex }}>👥 Modalità partner attiva</p>
            <p className="text-xs text-gray-500 mt-0.5">Inquadrate entrambi — l'AI arbitra e dà punti in tempo reale</p>
          </div>
        )}

        {isPartnerMode && (
          <RoundConfig rounds={rounds} onRounds={setRounds} roundDuration={roundDuration} onRoundDuration={setRoundDuration} />
        )}

        {/* 🔔 Round anche in solo: shadowboxing/drill a round veri, con angolo e respiro */}
        {!isPartnerMode && mode !== 'breathing' && (
          <div className="space-y-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setRoundsOn((v) => !v)}
              className="w-full py-2.5 rounded-xl text-xs font-black transition-all"
              style={roundsOn
                ? { background: `linear-gradient(135deg, ${C.red.hex}33, ${C.red.hex}11)`, color: C.red.hex, border: `1px solid ${C.red.border}`, boxShadow: `0 0 12px ${C.red.glow}` }
                : { background: 'rgba(55,65,81,0.4)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.06)' }}>
              🔔 Modalità ROUND {roundsOn ? 'ATTIVA — gong, angolo e respiro tra i round' : '— allena a round veri come in palestra'}
            </motion.button>
            {roundsOn && <RoundConfig rounds={rounds} onRounds={setRounds} roundDuration={roundDuration} onRoundDuration={setRoundDuration} />}
          </div>
        )}

        {mode === 'breathing' && (
          <div className="p-3 rounded-xl" style={{ background: C.emerald.bg, border: `1px solid ${C.emerald.border}` }}>
            <p className="text-[10px] font-black text-gray-500 mb-2 tracking-widest" style={{ fontFamily: 'Syne, sans-serif' }}>🌬️ PROTOCOLLO DI RESPIRAZIONE</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {BREATHING_PROTOCOLS.map((p) => {
                const isActive = breathingProtocolId === p.id;
                return (
                  <motion.button key={p.id} whileTap={{ scale: 0.91 }} whileHover={{ scale: 1.04 }} onClick={() => setBreathingProtocolId(p.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={isActive
                      ? { background: `linear-gradient(135deg, ${C.emerald.hex}33, ${C.emerald.hex}11)`, color: C.emerald.hex, boxShadow: `0 0 0 1px ${C.emerald.border}`, border: `1px solid ${C.emerald.border}` }
                      : { background: 'rgba(55,65,81,0.35)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {p.name}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-[11px] mb-3" style={{ color: '#6b7280' }}>
              {BREATHING_PROTOCOLS.find((p) => p.id === breathingProtocolId)?.when}
            </p>
            <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={() => setShowBreathingGuide(true)}
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs"
              style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #0d9488)` }}>
              🫁 Avvia guida visiva (senza camera)
            </motion.button>
          </div>
        )}

        {/* 🥋 La via della disciplina: filosofia, respiro ed etiqueta dell'arte scelta */}
        {(() => {
          const kd = getDiscipline(mode);
          if (!kd) return null;
          const dp = coachProgress?.[mode] || null;
          const xp = Number(dp?.xp) || 0;
          return (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(180,120,30,0.07)', border: `1px solid ${C.amber.border}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Syne, sans-serif' }}>
                  {kd.emoji} LA VIA — {kd.name.toUpperCase()}
                </p>
                {dp && (
                  <p className="text-[9px] font-bold font-mono" style={{ color: '#fbbf24' }} title={`${dp.sessions || 0} sessioni · record ${dp.best || 0}/100`}>
                    🏆 Lv {coachLevelOf(xp)} · {xp} XP{coachRankOf(mode, xp) ? ` · ${coachRankOf(mode, xp)}` : ''}
                  </p>
                )}
              </div>
              <p className="text-[11px] leading-snug mb-1" style={{ color: '#d1d5db' }}>{kd.philosophy}</p>
              <p className="text-[10px] leading-snug mb-1" style={{ color: '#9ca3af' }}>🫁 Respiro: {kd.breathing.principle}</p>
              <p className="text-[10px] leading-snug" style={{ color: '#9ca3af' }}>🙏 {kd.etiquette[0]}</p>
            </div>
          );
        })()}

        {/* 💪 Workout del maestro: allenamento guidato con voce + correzione live */}
        {!workout && (
          <button onClick={startCoachWorkout}
            className="w-full p-3.5 rounded-xl text-left transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.28), rgba(180,83,9,0.14))', border: `1px solid ${C.amber.hex}55` }}>
            <p className="text-[11px] font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>
              💪 DAMMI UN WORKOUT
            </p>
            <p className="text-[10px] mt-1 leading-snug" style={{ color: '#d1d5db' }}>
              Il maestro ti guida con la voce: riscaldamento → tecniche di {currentDisc?.label || 'questa arte'} → condizionamento → respiro. Ti insegna ogni esercizio e ti corregge in tempo reale. Attiva la fotocamera e l'audio.
            </p>
          </button>
        )}

        <div>
          <p className="text-[10px] text-gray-600 mb-1.5 font-mono tracking-widest">DESCRIVI LA SESSIONE <span className="text-gray-700">(OPZIONALE)</span></p>
          <textarea value={sessionContext} onChange={(e) => setSessionContext(e.target.value)} rows={2}
            placeholder={isPartnerMode ? 'Es. Io e mio fratello — focus combo leggero…' : `Es. ${currentDisc?.label} – tecnica base…`}
            className="w-full px-4 py-3 text-sm text-white placeholder-gray-700 resize-none focus:outline-none transition-all"
            style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(8px)' }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(16,185,129,0.35)'; e.target.style.boxShadow = '0 0 0 1px rgba(16,185,129,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }} />
        </div>

        {pastSessions.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 mb-1.5 font-mono tracking-widest">SESSIONI RECENTI</p>
            <div className="space-y-1">
              {pastSessions.slice(0, 3).map((s, i) => (
                <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode(s.mode); setSessionContext(s.context); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all"
                  style={{ background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#4b5563' }}>{s.date} · {s.mode}</span>
                  {s.duration > 0 && <span style={{ color: '#374151' }}> · {s.duration}min</span>}
                  <span className="mx-1" style={{ color: '#374151' }}>·</span>
                  <span style={{ color: '#6b7280' }}>{s.context.slice(0, 42)}{s.context.length > 42 ? '…' : ''}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* 🔥/🧘 Routine guidate: mai iniziare freddo, mai finire senza defaticare */}
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { unlockSpeech(); setWarmupKind('warmup'); }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(249,115,22,0.1)', color: C.orange.hex, border: `1px solid ${C.orange.border}` }}>
            🔥 Riscaldamento 3'
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { unlockSpeech(); setWarmupKind('cooldown'); }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(59,130,246,0.08)', color: C.blue.hex, border: `1px solid ${C.blue.border}` }}>
            🧘 Defaticamento 2.5'
          </motion.button>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={startSession}
          className="w-full py-4 rounded-2xl text-white font-black text-sm transition-all relative overflow-hidden"
          style={isPartnerMode
            ? { background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 8px 28px ${C.violet.glow}` }
            : { background: `linear-gradient(135deg, ${C.emerald.hex}, #0d9488)`, boxShadow: `0 8px 28px ${C.emerald.glow}` }}>
          <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', animation: 'chip-sheen 2.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
          <span className="relative" style={{ fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}>
            {isPartnerMode ? `👥 INIZIA MATCH — ${rounds}×${roundDuration/60}MIN` : '📷 INIZIA SESSIONE LIVE'}
          </span>
        </motion.button>

        {showBreathingGuide && createPortal(
          <BreathingGuide
            protocol={BREATHING_PROTOCOLS.find((p) => p.id === breathingProtocolId) || BREATHING_PROTOCOLS[0]}
            voiceOn={voiceOn}
            enqueueSpeak={enqueueSpeak}
            onExit={() => setShowBreathingGuide(false)}
          />,
          document.body
        )}

        {warmupKind === 'warmup' && (
          <RoutineOverlay title="RISCALDAMENTO" emoji="🔥" color="orange" steps={WARMUP_STEPS}
            voiceOn={voiceOn} onExit={() => setWarmupKind(null)} />
        )}
        {warmupKind === 'cooldown' && (
          <RoutineOverlay title="DEFATICAMENTO" emoji="🧘" color="blue" steps={COOLDOWN_STEPS}
            voiceOn={voiceOn} onExit={() => setWarmupKind(null)} />
        )}
      </div>
    );
  }

  if (academyLesson) {
    const visiblePose = streaming && ['full', 'upper'].includes(trackQuality);
    const poseScore = visiblePose && mirrorState ? Math.round(mirrorState.score) : null;
    const cue = !streaming ? 'La camera non è disponibile. Controlla i permessi.'
      : !visiblePose ? 'Arretra finché spalle, bacino e gambe sono inquadrati.'
        : mirrorState?.hints?.[0] || 'Posizione stabile. Mantieni la guardia e respira.';
    const scoreColor = poseScore == null ? '#7c899c' : poseScore >= 82 ? '#6de2d3' : poseScore >= 60 ? '#ffd184' : '#ff9b9b';
    const samples = studioSamplesRef.current;
    const average = samples.length ? Math.round(samples.reduce((sum, sample) => sum + sample.score, 0) / samples.length) : null;
    const commonCue = Object.entries(samples.reduce((counts, sample) => {
      if (sample.hint) counts[sample.hint] = (counts[sample.hint] || 0) + 1;
      return counts;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0];
    return createPortal(<div className="mma-studio" style={{ '--studio-accent': '#6de2d3' }}>
      <video ref={videoRef} className="mma-studio-video" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} playsInline muted />
      <canvas ref={canvasRef} hidden />
      <canvas ref={overlayRef} className="mma-studio-skeleton" style={{ opacity: skeletonOn ? 1 : 0, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
      <div className="mma-studio-shade" />
      <header className="mma-studio-header">
        <button className="mma-studio-close" onClick={stopCamera} aria-label="Chiudi lezione"><X size={18} /></button>
        <div><small>COACH LIVE / MMA</small><strong>{academyLesson.title}</strong></div>
        <span className={`mma-studio-badge ${streaming ? 'live' : ''}`}>{streaming ? 'LIVE' : 'CAMERA'}</span>
      </header>
      <div className="mma-studio-topline">
        <span className={`mma-studio-tracking ${visiblePose ? 'ready' : ''}`}><i />{visiblePose ? trackQuality === 'full' ? 'Corpo inquadrato' : 'Busto inquadrato' : 'Cerca il corpo'}</span>
        <span>{aiStatus === 'offline' ? 'FEEDBACK LOCALE' : 'SPECCHIO ATTIVO'}</span>
      </div>
      <div className="mma-studio-feedback">
        <div className="mma-studio-score" style={{ '--score': `${poseScore ?? 0}%`, '--score-color': scoreColor }}><span>{poseScore == null ? '—' : poseScore}<small>{poseScore == null ? '' : '%'}</small></span></div>
        <div className="mma-studio-cue"><small>CORREZIONE ADESSO</small><p>{cue}</p><span>{academyLesson.camera} · posa istantanea</span></div>
      </div>
      <footer className="mma-studio-panel">
        <div className="mma-studio-rounds" style={{ gridTemplateColumns: `repeat(${academyLesson.rounds || 3},1fr)` }}>{Array.from({ length: academyLesson.rounds || 3 }, (_, index) => index + 1).map((round) => <span key={round} className={round < studioClock.round || studioClock.phase === 'done' ? 'complete' : round === studioClock.round ? 'current' : ''}>ROUND {round}</span>)}</div>
        {studioClock.phase === 'done' ? <div className="mma-studio-summary">
          <small>LEZIONE COMPLETATA</small><h2>{academyLesson.rounds || 3} round. Un passo avanti.</h2>
          <div><span>POSA MEDIA<em>{average == null ? '—' : `${average}%`}</em></span><span>CAMPIONI<em>{samples.length}</em></span>{academyLesson.id === 'one-two' && <span>1–2 RILEVATE<em>{studioCombos}</em></span>}</div>
          <p>{commonCue ? `Nel prossimo allenamento concentrati su: ${commonCue}.` : 'Il prossimo passo è ripetere la lezione con il corpo intero inquadrato.'}</p>
          <button className="mma-studio-main" onClick={stopCamera}>Rivedi la lezione</button>
        </div> : <>
          <div className="mma-studio-phase"><div><small>{studioClock.phase === 'ready' ? 'PRONTO A INIZIARE' : studioClock.phase === 'rest' ? 'RECUPERO' : `ROUND ${studioClock.round} IN CORSO`}</small><strong>{String(Math.floor(studioClock.left / 60)).padStart(2, '0')}:{String(studioClock.left % 60).padStart(2, '0')}</strong></div><p>{studioClock.phase === 'rest' ? 'Respira, recupera e torna in guardia.' : academyLesson.roundPlan?.[studioClock.round - 1] || academyLesson.drill}</p></div>
          {academyLesson.id === 'one-two' && <p className="mma-studio-combos">{studioCombos} sequenze alternate rilevate <span>stima dalla posa, non verifica tecnica completa</span></p>}
          <div className="mma-studio-actions">
            {studioClock.phase === 'ready' ? streaming
              ? <button className="mma-studio-main" onClick={() => setStudioClock({ phase: 'round', round: 1, left: academyLesson.roundSeconds || 120 })}>Inizia round 1</button>
              : <button className="mma-studio-main" onClick={() => startCamera()}>Riprova fotocamera</button>
              : studioClock.phase === 'rest' ? <button className="mma-studio-main" onClick={() => setStudioClock({ phase: 'round', round: studioClock.round + 1, left: academyLesson.roundSeconds || 120 })}>Inizia round {studioClock.round + 1}</button>
                : <button className="mma-studio-main" onClick={() => setStudioPaused((value) => !value)}>{studioPaused ? 'Riprendi round' : 'Pausa round'}</button>}
            <button className="mma-studio-tool" onClick={flipCamera} aria-label="Cambia fotocamera"><FlipHorizontal2 size={19} /></button>
            <button className="mma-studio-tool" onClick={() => setVoiceOn((value) => !value)} aria-label={voiceOn ? 'Disattiva voce' : 'Attiva voce'}>{voiceOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
          </div>
          <button className="mma-studio-advanced" onClick={() => setAcademyLesson(null)}>Apri strumenti avanzati</button>
        </>}
      </footer>
    </div>, document.body);
  }

  // ── Live — camera overlay (video a tutto schermo + comandi sovrapposti) ──────

  // Pattern app-fotocamera: video in absolute inset-0 come sfondo, tutti i
  // comandi in absolute ancorati top/bottom.
  // PORTAL su document.body: indispensabile perché un ancestor con transform
  // (il <motion.div> di framer-motion che anima i tab) renderebbe altrimenti
  // `position: fixed` relativo a sé, spingendo i comandi in fondo alla pagina
  // invece che al viewport. Il portal li àncora al viewport reale.
  return createPortal(
    <div className="coach-live-fs fixed inset-0 z-[100] bg-black overflow-hidden" style={{ touchAction: 'none', overscrollBehavior: 'none' }}>
      {/* VIDEO — sfondo a tutto schermo. Frontale = speculare (come un vero specchio) */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={overlayRef} className="absolute pointer-events-none" style={{ opacity: skeletonOn ? 1 : 0, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />

      {/* ⌈ HUD OLOGRAFICO DEL SISTEMA ⌋ — finestre fluttuanti sul video */}
      <SystemHud active={streaming && skeletonOn} getSnapshot={hudSnapshot} />

      {/* TOP BAR — sovrapposta in alto */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2.5 px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 30%, transparent)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {currentDisc?.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {currentDisc?.label?.toUpperCase()}
            <span className="font-bold" style={{ color: '#9ca3af' }}> · {masterTitle(mode).toUpperCase()}</span>
          </p>
          {analysis?.provider
            ? <p className="text-[10px] truncate mt-0.5 font-mono" style={{ color: C.violet.hex, opacity: 0.9 }}>🤖 {analysis.provider}</p>
            : sessionContext && <p className="text-[10px] truncate mt-0.5" style={{ color: '#9ca3af' }}>{sessionContext}</p>
          }
        </div>
        <div className="flex items-center gap-1.5">
          {streaming && (autoMode || guidedOn) && skeletonOn && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold inline-flex items-center gap-1" title="Qualità tracking corpo"
              style={{
                background: trackQuality === 'full' ? 'rgba(16,185,129,0.22)' : trackQuality === 'upper' ? 'rgba(56,189,248,0.2)' : trackQuality === 'partial' ? 'rgba(249,115,22,0.22)' : 'rgba(120,120,120,0.2)',
                color: trackQuality === 'full' ? C.emerald.hex : trackQuality === 'upper' ? '#38bdf8' : trackQuality === 'partial' ? C.orange.hex : '#9ca3af',
              }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
              {trackQuality === 'full' ? 'corpo pieno' : trackQuality === 'upper' ? 'busto' : trackQuality === 'partial' ? 'parziale' : 'no corpo'}
            </span>
          )}
          {streaming && skeletonOn && intensity > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" title="Intensità del movimento"
              style={{ background: 'rgba(0,0,0,0.4)', color: intensity > 66 ? '#ef4444' : intensity > 33 ? '#f59e0b' : '#38bdf8', border: '1px solid rgba(255,255,255,0.1)' }}>
              ⚡{intensity}
            </span>
          )}
          {streaming && <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'rgba(16,185,129,0.25)', color: C.emerald.hex, border: `1px solid ${C.emerald.border}`, animation: 'pulse-glow 2s ease-in-out infinite' }}>● LIVE</span>}
          {autoMode && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold inline-flex items-center gap-1.5" style={{ background: 'rgba(249,115,22,0.25)', color: C.orange.hex, border: `1px solid ${C.orange.border}` }}>
              AUTO
              <span className="flex gap-0.5">
                {Array.from({ length: VERDICT_EVERY }).map((_, i) => (
                  <motion.span key={i} className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: i < observeProgress ? C.orange.hex : 'rgba(249,115,22,0.25)' }}
                    animate={i === observeProgress ? { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] } : { scale: 1 }}
                    transition={{ duration: 0.9, repeat: Infinity }} />
                ))}
              </span>
            </span>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={stopCamera} aria-label="Chiudi sessione"
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(185,28,28,0.55)', border: `1px solid ${C.red.border}`, color: '#fff' }}>
            <X size={16} />
          </motion.button>
        </div>
      </div>

      {/* 💪 WORKOUT HUD: fase corrente, timer, insegnamento, stop */}
      {workout && workout.phases[workout.idx] && (
        <div className="absolute inset-x-0 z-20 px-3" style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 52px)' }}>
          <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.78)', border: `1px solid ${C.amber.hex}66`, backdropFilter: 'blur(6px)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-black text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                {workout.phases[workout.idx].emoji} {workout.phases[workout.idx].name.toUpperCase()}
              </p>
              <p className="text-lg font-black font-mono leading-none" style={{ color: workout.left <= 5 ? '#ef4444' : '#fbbf24' }}>{workout.left}s</p>
            </div>
            <div className="flex gap-1 my-1.5">
              {workout.phases.map((ph, i) => (
                <div key={ph.name + i} className="h-1 flex-1 rounded-full" style={{ background: i < workout.idx ? C.amber.hex : i === workout.idx ? '#fbbf24' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <p className="text-[10px] leading-snug" style={{ color: '#d1d5db' }}>{workout.phases[workout.idx].teach}</p>
            {workout.phases[workout.idx].drill && (
              <p className="text-[9px] mt-0.5" style={{ color: '#9ca3af' }}>🎯 {workout.phases[workout.idx].drill}</p>
            )}
            <button onClick={stopCoachWorkout} className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background: 'rgba(185,28,28,0.4)', border: `1px solid ${C.red.border}`, color: '#fecaca' }}>
              ✕ FERMA IL WORKOUT
            </button>
          </div>
        </div>
      )}

      {/* ROUND (sparring o solo): timer + angolo con respiro — sotto la top bar */}
      {(isPartnerMode || roundsOn) && (
        <div className="absolute inset-x-0 z-20 px-3 space-y-2" style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 52px)' }}>
          {timer.phase === 'idle'
            ? <motion.button whileTap={{ scale: 0.97 }} onClick={timer.start}
                className="w-full py-2.5 rounded-xl text-white font-black text-sm"
                style={{ background: `linear-gradient(135deg, ${C.red.hex}, #b91c1c)`, boxShadow: `0 4px 16px ${C.red.glow}` }}>
                🔔 Inizia Round 1
              </motion.button>
            : <RoundTimerDisplay timer={timer} roundDuration={roundDuration} restDuration={60} />
          }
          {/* 🪑 ANGOLO: nel riposo il maestro parla e il cerchio guida il respiro (4-4) */}
          {timer.phase === 'rest' && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-2xl flex items-center gap-3"
              style={{ background: 'rgba(120,53,15,0.55)', border: `1px solid ${C.amber.border}`, backdropFilter: 'blur(8px)' }}>
              <motion.div className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black"
                style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.45), rgba(245,158,11,0.08))', border: `1.5px solid ${C.amber.hex}`, color: '#fde68a' }}
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}>
                4-4
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Syne, sans-serif' }}>
                  🪑 ANGOLO — respira col cerchio: cresce inspira, cala espira
                </p>
                <p className="text-xs text-white mt-1 leading-snug">
                  {cornerMsg?.talk || (cornerMsg?.loading ? 'Il maestro sta arrivando all\'angolo…' : 'Recupera: spalle giù, respiro dal naso.')}
                </p>
                {cornerMsg?.breath && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(254,243,199,0.85)' }}>🫁 {cornerMsg.breath}</p>}
              </div>
            </motion.div>
          )}
          {isPartnerMode && <ScoreTracker score={score} onScore={handleScore} lastPoint={lastPoint} />}
          {/* 🦵 REFERTO LIVELLO CALCIO — a fine match, dalla camera */}
          {kickReport && (
            <motion.div initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="p-3 rounded-2xl space-y-2"
              style={{ background: 'rgba(127,29,29,0.5)', border: `1px solid ${C.red.border}`, backdropFilter: 'blur(8px)' }}>
              <p className="text-[10px] font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>
                🦵 LIVELLO CALCIO — REFERTO MATCH
              </p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-black leading-none" style={{ color: '#fff', textShadow: '0 0 16px rgba(251,191,36,0.7)', fontFamily: 'Syne, sans-serif' }}>
                  {kickReport.level}
                </p>
                <div className="flex-1">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.6)' }}>
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }} animate={{ width: `${kickReport.level}%` }}
                      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.3, 1] }}
                      style={{ background: 'linear-gradient(90deg, #fbbf24, #fff)', boxShadow: '0 0 10px rgba(251,191,36,0.6)' }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#fca5a5' }}>
                    {kickReport.tot} calci ({kickReport.sx} sx / {kickReport.dx} dx) · picco medio {kickReport.avgPeak}°/s
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ⚡ REFLEX: il coach chiama, tu esegui — comando gigante al centro */}
      {reactOn && (
        <div className="absolute inset-x-0 z-20 flex flex-col items-center pointer-events-none" style={{ top: '32%' }}>
          <AnimatePresence mode="wait">
            {reactCall && timerPhaseRef.current !== 'rest' && (
              <motion.p key={`${reactCall}-${reactCount}`}
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="text-4xl font-black text-white text-center px-4"
                style={{ fontFamily: 'Syne, sans-serif', textShadow: '0 0 28px rgba(220,38,38,0.9), 0 2px 8px rgba(0,0,0,0.8)' }}>
                {reactCall}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-[10px] font-mono mt-3 px-2 py-0.5 rounded-md" style={{ color: '#e5e7eb', background: 'rgba(0,0,0,0.45)' }}>
            ⚡ REFLEX · {reactCount} comandi
          </p>
          <div className="flex gap-1.5 mt-2 pointer-events-auto">
            {Object.keys(REACT_DIFFS).map((d) => (
              <button key={d} onClick={() => setReactDiff(d)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                style={reactDiff === d
                  ? { background: 'rgba(220,38,38,0.5)', color: '#fff', border: '1px solid rgba(239,68,68,0.6)' }
                  : { background: 'rgba(0,0,0,0.45)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Avviso inquadratura — il corpo non è ben visibile per un'analisi precisa */}
      <AnimatePresence>
        {framingHint && (autoMode || guidedOn) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5"
            style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 56px)', background: 'rgba(249,115,22,0.92)', color: '#1a1208', boxShadow: '0 4px 18px rgba(249,115,22,0.4)' }}>
            <Move size={13} /> {framingHint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🥊 SHADOW SPARRING — il coach diventa l'avversario */}
      <ShadowSparring
        active={shadowOn && streaming}
        onExit={() => setShadowOn(false)}
        readState={() => ({ kin: kinHistRef.current, lm: lastLandmarksRef.current })}
        speak={enqueueSpeak}
        onComplete={handleShadowComplete}
      />

      {/* BLOCCO INFERIORE — feedback + comandi, ancorato in basso (sempre visibile) */}
      <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 65%, rgba(0,0,0,0.55) 88%, transparent)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

        {/* 🎙 COACH VOCALE + 🥊 SHADOW SPARRING */}
        {streaming && skeletonOn && (
          <div className="flex justify-center items-end gap-2 mt-2 pointer-events-none">
            <button onClick={() => setShadowOn(true)}
              className="pointer-events-auto px-3 py-2.5 rounded-xl text-[9px] font-black tracking-widest whitespace-nowrap"
              style={{ background: 'rgba(127,29,29,0.75)', border: '1px solid rgba(239,68,68,0.6)', color: '#fecaca', fontFamily: 'Syne, sans-serif', backdropFilter: 'blur(6px)', boxShadow: '0 0 14px rgba(239,68,68,0.25)' }}>
              🥊 SPARRING
            </button>
            <RepCoach mode={repMode} count={vcCount} onSelect={startReps} onStop={stopReps} />
          </div>
        )}

        {/* CARD GUIDATA — circuito drill su misura */}
        {guidedOn && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mx-3 mt-3 rounded-2xl p-4"
            style={{ background: 'rgba(6,20,16,0.94)', border: `1px solid ${C.emerald.border}`, backdropFilter: 'blur(8px)' }}>

            {guidedPhase === 'gen' && (
              <div className="text-center py-3">
                <p className="text-sm font-black" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>🎯 Genero il tuo circuito…</p>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(209,250,229,0.7)' }}>Esercizi su misura per {currentDisc?.label}</p>
              </div>
            )}

            {guidedPhase === 'ready' && guidedPlan[guidedIdx] && (
              <div className="space-y-3">
                {/* stepper del circuito */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest" style={{ color: 'rgba(209,250,229,0.6)' }}>ESERCIZIO {guidedIdx + 1}/{guidedPlan.length}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: C.emerald.hex }}>{guidedPlan[guidedIdx].durationSec}s</span>
                </div>
                <div className="flex gap-1">
                  {guidedPlan.map((_, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i < guidedIdx ? C.emerald.hex : i === guidedIdx ? '#fbbf24' : '#1f2937' }} />
                  ))}
                </div>
                {/* anteprima animata del movimento */}
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl p-1" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                    <StickFigure poseKey={resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())} color={C.emerald.hex} size={88} highlight scene={sceneFor(mode)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-black text-white leading-tight">{guidedPlan[guidedIdx].name}</p>
                    {guidedPlan[guidedIdx].focus && (
                      <p className="text-[12px] text-emerald-200/90 mt-1 leading-snug"><b className="uppercase text-[9px] tracking-wider opacity-70">Cosa fare</b><br />{guidedPlan[guidedIdx].focus}</p>
                    )}
                    {strikeSurfaceFor(resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())) && (
                      <p className="text-[11px] font-semibold mt-1 leading-snug" style={{ color: '#fbbf24' }}>🎯 Colpisci con: {strikeSurfaceFor(resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim()))}</p>
                    )}
                  </div>
                </div>
                {guidedPlan[guidedIdx].watchFor && (
                  <p className="text-[11px] text-amber-200/90 flex items-start gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}><Eye size={13} className="shrink-0 mt-0.5" /> <span><b className="uppercase text-[9px] tracking-wider opacity-70">Tieni d'occhio</b> · {guidedPlan[guidedIdx].watchFor}</span></p>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={startDrill}
                  className="w-full py-3.5 rounded-xl text-white font-black text-sm"
                  style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #047857)`, boxShadow: '0 4px 18px rgba(16,185,129,0.4)' }}>
                  ▶ Via — sono pronto
                </motion.button>
              </div>
            )}

            {guidedPhase === 'running' && guidedPlan[guidedIdx] && (
              <div className="text-center space-y-2">
                <p className="text-[10px] font-mono tracking-widest" style={{ color: 'rgba(209,250,229,0.6)' }}>ESERCIZIO {guidedIdx + 1}/{guidedPlan.length}</p>
                {/* movimento animato ben visibile */}
                <div className="flex justify-center" style={{ filter: `drop-shadow(0 0 14px ${C.emerald.hex}55)` }}>
                  <StickFigure poseKey={resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())} color={C.emerald.hex} size={104} highlight scene={sceneFor(mode)} />
                </div>
                <p className="text-lg font-black text-white leading-tight">{guidedPlan[guidedIdx].name}</p>
                {/* COSA FARE — grande e chiaro */}
                {guidedPlan[guidedIdx].focus && (
                  <p className="text-[13px] font-semibold text-emerald-200 leading-snug px-2">{guidedPlan[guidedIdx].focus}</p>
                )}
                {strikeSurfaceFor(resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())) && (
                  <p className="text-[12px] font-semibold" style={{ color: '#fbbf24' }}>🎯 Colpisci con: {strikeSurfaceFor(resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim()))}</p>
                )}
                <div className="flex items-center justify-center gap-5 pt-1">
                  <div>
                    <p className="text-5xl font-black text-white tabular-nums leading-none" style={{ fontFamily: 'Syne, sans-serif' }}>{Math.floor(guidedTimeLeft / 60)}:{String(guidedTimeLeft % 60).padStart(2, '0')}</p>
                    <p className="text-[8px] tracking-widest uppercase mt-1" style={{ color: 'rgba(209,250,229,0.6)' }}>tempo</p>
                  </div>
                  <div className="w-px h-12" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <p className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: 'Syne, sans-serif', color: C.emerald.hex }}>{repCount}</p>
                    <p className="text-[8px] tracking-widest uppercase mt-1" style={{ color: 'rgba(209,250,229,0.6)' }}>rip</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: '100%', transformOrigin: 'left', transform: `scaleX(${guidedPlan[guidedIdx].durationSec ? guidedTimeLeft / guidedPlan[guidedIdx].durationSec : 0})`, background: C.emerald.hex, transition: 'transform 1s linear' }} />
                </div>
                {guidedPlan[guidedIdx].watchFor && <p className="text-[11px] text-amber-200/80 flex items-center justify-center gap-1.5"><Eye size={12} /> {guidedPlan[guidedIdx].watchFor}</p>}
                <button onClick={() => finishDrillRef.current()} className="text-[11px] underline" style={{ color: 'rgba(255,255,255,0.55)' }}>termina ora</button>
              </div>
            )}

            {guidedPhase === 'review' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest" style={{ color: 'rgba(209,250,229,0.6)' }}>PAGELLA · {guidedPlan[guidedIdx]?.name}</span>
                  {guidedReview && <span className="text-base font-black" style={{ color: guidedReview.score >= 7 ? C.emerald.hex : guidedReview.score >= 5 ? C.orange.hex : C.red.hex }}>{guidedReview.score}/10</span>}
                </div>
                {guidedLoading && <p className="text-xs" style={{ color: 'rgba(209,250,229,0.7)' }}>⏳ Analizzo il drill…</p>}
                {guidedReview && (
                  <>
                    {guidedReview.good?.length > 0 && <div className="space-y-1">{guidedReview.good.map((g, i) => <p key={i} className="text-xs text-gray-200">✅ {g}</p>)}</div>}
                    {guidedReview.fix?.length > 0 && <div className="space-y-1">{guidedReview.fix.map((f, i) => <p key={i} className="text-xs" style={{ color: '#fca5a5' }}>❌ {f}</p>)}</div>}
                    {guidedReview.cue && <p className="text-sm font-bold text-white mt-1">🎯 {guidedReview.cue}</p>}
                  </>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => nextDrillRef.current()}
                  className="w-full py-3 rounded-xl text-white font-black text-sm mt-1"
                  style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)` }}>
                  {guidedIdx + 1 >= guidedPlan.length ? '🏁 Fine circuito' : 'Prossimo drill →'}
                </motion.button>
                <label className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(209,250,229,0.65)' }}>
                  <input type="checkbox" checked={guidedAutoAdvance} onChange={(e) => setGuidedAutoAdvance(e.target.checked)} /> auto-avanza dopo la pagella
                </label>
              </div>
            )}

            {guidedPhase === 'done' && (
              <div className="text-center space-y-2 py-2">
                <p className="text-lg font-black" style={{ color: C.emerald.hex }}>🎉 Circuito completato!</p>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setGuidedPlan([]); generateGuidedPlan(); }} className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs" style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #047857)` }}>🔄 Nuovo circuito</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={stopGuided} className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs" style={{ background: 'rgba(55,65,81,0.7)' }}>Esci</motion.button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── COMBO A COMANDO ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {comboOn && (
            <motion.div
              key="combo-overlay"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="mx-3 mt-3 rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(124,58,237,0.14))', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 28px rgba(239,68,68,0.18)' }}>
              {/* Punteggio */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-[9px] font-mono tracking-widest font-bold text-red-400/90">🥊 COMBO MODE</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black" style={{ color: '#34d399' }}>✅ {comboScore.perfect}</span>
                  <span className="text-[10px] font-black" style={{ color: '#fbbf24' }}>👍 {comboScore.good}</span>
                  <span className="text-[10px] font-black" style={{ color: '#f87171' }}>🔄 {comboScore.redo}</span>
                  <button onClick={stopCombo} className="text-gray-500 hover:text-gray-300 ml-1"><X size={14} /></button>
                </div>
              </div>
              <div className="px-4 pb-4">
                {/* CALLING — DEMO (mostra la combo intera) poi conto alla rovescia */}
                {comboPhase === 'calling' && (
                  <div className="flex flex-col items-center py-2">
                    {/* Figura combattente animata al centro, ben grande */}
                    <ComboAnimator combo={currentCombo} color={C.orange.hex} mode={mode} size={128} />
                    {/* Fase demo vs conto alla rovescia */}
                    {comboCountdown == null ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full"
                          style={{ color: '#0b0e14', background: C.orange.hex }}>{comboPaused ? '⏸ In pausa' : '👁 Memorizza la combo'}</span>
                        {!comboPaused && <div className="flex gap-1 mt-1">{[0,1,2].map((i) => (
                          <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange.hex }}
                            animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }} />
                        ))}</div>}
                      </motion.div>
                    ) : (
                      <div className="mt-1 flex flex-col items-center">
                        <p className="text-[9px] uppercase tracking-widest text-gray-400">{comboPaused ? 'In pausa' : 'Esegui tra…'}</p>
                        <motion.p key={comboCountdown} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-6xl font-black leading-none" style={{ color: '#f97316', textShadow: '0 0 24px rgba(249,115,22,0.5)' }}>{comboCountdown}</motion.p>
                      </div>
                    )}
                    {/* Pausa: congela demo/countdown per studiare la tecnica con calma */}
                    <motion.button whileTap={{ scale: 0.93 }} onClick={() => setComboPaused((v) => !v)}
                      className="mt-3 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      style={comboPaused
                        ? { background: `linear-gradient(135deg, ${C.orange.hex}, #b45309)`, color: '#fff' }
                        : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e7eb' }}>
                      {comboPaused ? <><Play size={13} /> Riprendi</> : <><Pause size={13} /> Pausa</>}
                    </motion.button>
                  </div>
                )}
                {/* GO! */}
                {comboPhase === 'go' && (
                  <div className="text-center py-3">
                    <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-5xl font-black" style={{ color: '#ef4444', textShadow: '0 0 30px rgba(239,68,68,0.6)' }}>VIA!</motion.p>
                    <p className="text-base font-black text-white mt-1">{currentCombo}</p>
                  </div>
                )}
                {/* JUDGING */}
                {comboPhase === 'judging' && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-base font-black text-white">{currentCombo}</p>
                    <div className="flex justify-center gap-1">{[0,1,2].map((i) => (
                      <motion.span key={i} className="w-2 h-2 rounded-full" style={{ background: '#f97316' }}
                        animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.2 }} />
                    ))}</div>
                    <p className="text-[10px]" style={{ color: 'rgba(254,215,170,0.8)' }}>Il coach valuta…</p>
                  </div>
                )}
                {/* 🎬 CINEMATICO COMBO/SUPER COMBO — fullscreen */}
                <ComboFx fx={comboFx} onDone={() => setComboFx(null)} />
                {/* RESULT */}
                {comboPhase === 'result' && comboResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 py-1 relative">
                    {/* 🎆 Esplosione celebrativa sul PERFETTO */}
                    {comboResult.grade === 'perfect' && !_prefersReducedMotion() && (
                      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-visible">
                        <motion.span className="absolute left-1/2 top-1/2 w-10 h-10 -ml-5 -mt-5 rounded-full"
                          style={{ border: '2px solid #34d399' }}
                          initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 3.2, opacity: 0 }}
                          transition={{ duration: 0.7, ease: 'easeOut' }} />
                        {[...Array(12)].map((_, i) => {
                          const a = (i / 12) * Math.PI * 2;
                          return <motion.span key={i} className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                            style={{ background: i % 3 === 0 ? '#fde68a' : '#34d399', boxShadow: '0 0 6px #34d399' }}
                            initial={{ x: 0, y: 0, opacity: 1 }}
                            animate={{ x: Math.cos(a) * (52 + (i % 4) * 14), y: Math.sin(a) * (36 + (i % 3) * 12), opacity: 0, scale: 0.4 }}
                            transition={{ duration: 0.75 + (i % 3) * 0.12, ease: 'easeOut' }} />;
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <motion.span className="text-2xl"
                        animate={comboResult.grade === 'perfect' ? { scale: [1, 1.5, 1], rotate: [0, -12, 8, 0] } : {}}
                        transition={{ duration: 0.55 }}>
                        {comboResult.grade === 'perfect' ? '🌟' : comboResult.grade === 'good' ? '✅' : '🔄'}
                      </motion.span>
                      <span className="text-sm font-black" style={{
                        color: comboResult.grade === 'perfect' ? '#34d399' : comboResult.grade === 'good' ? '#fbbf24' : '#f87171'
                      }}>
                        {comboResult.grade === 'perfect' ? 'PERFETTO!' : comboResult.grade === 'good' ? 'BUONO' : 'RIPROVA'}
                      </span>
                    </div>
                    {comboResult.feedback && <p className="text-[12px] text-gray-200 leading-snug">{comboResult.feedback}</p>}
                    <p className="text-[10px]" style={{ color: 'rgba(254,215,170,0.7)' }}>Prossimo combo in arrivo…</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEZIONE COMMENTI AI — il comando RESTA visibile; l'analisi è solo un puntino */}
        <AnimatePresence>
          {!guidedOn && !comboOn && (analysis || analyzing) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="px-3 pt-4 pb-1 max-h-[38vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-1.5">
                {analysis?.provider && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: C.violet.hex, background: 'rgba(139,92,246,0.15)' }}>🤖 {analysis.provider}</span>
                )}
                {/* Indicatore di analisi in corso — NON cancella il comando visibile */}
                {analyzing && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {[0,1,2].map((i) => (
                      <motion.span key={i} className="w-1 h-1 rounded-full inline-block" style={{ background: C.violet.hex }}
                        animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 0.7, repeat: Infinity, delay: i*0.16 }} />
                    ))}
                  </span>
                )}
                {/* 🎯 Il maestro ti conosce: mostra il difetto storico che sta cacciando adesso */}
                {learnerHunt && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 truncate max-w-[46%]"
                    style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)' }}
                    title={`Difetto ricorrente dalle sessioni passate — il coach lo sta cercando: ${learnerHunt}`}>
                    🎯 caccia: {learnerHunt}
                  </span>
                )}
                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${C.violet.hex}66, transparent)` }} />
                {sampleCount > 0 && (
                  <span className="text-[9px] font-mono font-bold flex-shrink-0" style={{ color: '#fbbf24' }} title="Campioni raccolti per l'alveare">🐝 {sampleCount}</span>
                )}
                {analysis?.time && <p className="text-[9px] font-mono flex-shrink-0" style={{ color: '#6b7280' }}>{analysis.time}</p>}
              </div>
              {analysis?.content
                ? (() => {
                    const parts = {};
                    String(analysis.content).split('\n').forEach((line) => {
                      const t = line.trim();
                      const m = t.match(MARKER_RE);
                      if (m) parts[canonicalMarker(m[1])] = normalizeCoachingText(t.slice(m[0].length));
                    });
                    const cmd = parts.COMANDO || parts.ISTRUZIONE || parts.SITUAZIONE;
                    if (!cmd) return <p className="text-sm text-white leading-snug whitespace-pre-wrap font-medium">{analysis.content}</p>;
                    return (
                      <motion.div key={analysis.time}
                        initial={{ scale: 0.96, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                        className="rounded-xl px-3.5 py-3 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(124,58,237,0.10))', border: '1px solid rgba(16,185,129,0.35)', boxShadow: '0 0 24px rgba(16,185,129,0.18)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/90 pl-1.5 mb-0.5">⚠️ Correggi</p>
                        <p className="text-[17px] font-black text-white leading-tight pl-1.5" style={{ letterSpacing: '-0.01em' }}>{cmd}</p>
                        {parts.BENE && <p className="mt-2 text-[12px] font-semibold text-emerald-300 pl-1.5 flex items-start gap-1.5"><span className="shrink-0">✅</span> <span><b className="uppercase text-[9px] tracking-wider opacity-80">Bene</b> · {parts.BENE}</span></p>}
                        {parts.PROVA && (() => {
                          const firstTech = parts.PROVA.split(/[→\-,· ]/)[0].trim();
                          const poseKey = resolvePose(firstTech);
                          return (
                            <div className="mt-1.5 rounded-lg px-1.5 py-1 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <div className="shrink-0" style={{ opacity: 0.92 }}>
                                <StickFigure poseKey={poseKey} color="#fbbf24" size={68} highlight scene={sceneFor(mode)} />
                              </div>
                              <div>
                                <p className="text-[12px] font-bold text-amber-200 flex items-start gap-1.5"><span className="shrink-0">🥊</span> <span><b className="uppercase text-[9px] tracking-wider opacity-80">Prova ora</b> · {parts.PROVA}</span></p>
                                {strikeSurfaceFor(poseKey) && <p className="text-[10px] font-semibold mt-1 pl-4 leading-snug" style={{ color: '#fde68a' }}>🎯 Colpisci con: {strikeSurfaceFor(poseKey)}</p>}
                              </div>
                            </div>
                          );
                        })()}
                        {parts.VISTO && <p className="mt-1.5 text-[11px] text-emerald-200/80 pl-1.5 flex items-center gap-1.5"><Eye size={12} className="shrink-0" /> {parts.VISTO}</p>}
                        {parts.PERCHÉ && <p className="mt-0.5 text-[11px] text-violet-200/70 italic pl-1.5 flex items-center gap-1.5"><Lightbulb size={12} className="shrink-0" /> {parts.PERCHÉ}</p>}
                        {parts.PUNTO && <p className="mt-1 text-[11px] font-bold text-amber-300 pl-1.5 flex items-center gap-1.5"><Trophy size={12} className="shrink-0" /> {parts.PUNTO}</p>}
                        {/* 👍/👎 — etichetta il consiglio: alimenta il dataset dell'alveare */}
                        {sampleFeedback && (
                          <div className="mt-2.5 flex items-center gap-2 pl-1.5">
                            {sampleFeedback === 'up' || sampleFeedback === 'down' ? (
                              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                className="text-[11px] font-bold flex items-center gap-1"
                                style={{ color: sampleFeedback === 'up' ? '#34d399' : '#f87171' }}>
                                {sampleFeedback === 'up' ? <><ThumbsUp size={12} /> Salvato, grazie</> : <><ThumbsDown size={12} /> Annotato</>}
                              </motion.span>
                            ) : (
                              <>
                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.65)' }}>Consiglio giusto?</span>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => labelSample('up')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(16,185,129,0.4)' }} aria-label="Consiglio utile">
                                  <ThumbsUp size={13} className="text-emerald-300" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => labelSample('down')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.38)' }} aria-label="Consiglio sbagliato">
                                  <ThumbsDown size={13} className="text-red-300" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })()
                : <p className="text-xs font-bold" style={{ color: C.violet.hex, fontFamily: 'Syne, sans-serif' }}>Primo comando in arrivo…</p>
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* COMANDI principali */}
        <div className="px-3 pt-3 flex flex-col gap-2">
          {/* ── SPECCHIO: il tuo corpo vs l'ideale ──────────────────────────── */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setMirrorOn((v) => !v); if (!mirrorOn) { setSkeletonOn(true); unlockSpeech(); } }}
            className="w-full py-2.5 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2"
            style={mirrorOn
              ? { background: 'linear-gradient(135deg, #10b981, #0ea5e9)', boxShadow: '0 4px 18px rgba(14,165,233,0.4)' }
              : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            🪞 Specchio {mirrorOn ? 'ON' : 'OFF'}
          </motion.button>
          {mirrorOn && (() => {
            const sc = mirrorState?.score ?? 0;
            const scColor = sc >= 80 ? C.emerald.hex : sc >= 55 ? C.amber.hex : '#ef4444';
            const LBL = { guard: 'Guardia', jab: 'Jab', cross: 'Cross', hook: 'Gancio', uppercut: 'Montante', teep: 'Teep', roundhouse: 'Calcio', knee: 'Ginocchio', side_kick: 'Side kick', low_kick: 'Low kick', body_kick: 'Body kick', squat: 'Squat', pushup: 'Push-up', plank: 'Plank', lunge: 'Affondo', warrior: 'Warrior', tree: 'Albero', forward_fold: 'Piega', breathe: 'Respiro', run: 'Corsa', bridge: 'Ponte' };
            const chips = sceneFor(mode) === 'solo'
              ? ['squat', 'pushup', 'plank', 'lunge', 'warrior', 'tree', 'forward_fold', 'breathe']
              : ['guard', 'jab', 'cross', 'hook', 'uppercut', 'teep', 'roundhouse', 'knee'];
            const following = (guidedOn && (guidedPhase === 'running' || guidedPhase === 'ready')) || comboOn;
            return (
              <div className="rounded-2xl p-3 space-y-2.5" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.10))', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="flex items-center gap-3">
                  {/* anello punteggio */}
                  <div className="relative flex-shrink-0" style={{ width: 62, height: 62 }}>
                    <svg width={62} height={62} viewBox="0 0 62 62">
                      <circle cx={31} cy={31} r={26} fill="none" stroke="#1f2937" strokeWidth={6} />
                      <circle cx={31} cy={31} r={26} fill="none" stroke={scColor} strokeWidth={6} strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - sc / 100)}
                        transform="rotate(-90 31 31)" style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.2s' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-black" style={{ color: scColor }}>{sc}<span className="text-[9px]">%</span></span>
                    </div>
                  </div>
                  {/* figura target + nome */}
                  <div className="flex-shrink-0" style={{ opacity: 0.95 }}>
                    <StickFigure poseKey={mirrorTargetKey} color={C.emerald.hex} size={58} highlight scene={sceneFor(mode)} />
                  </div>
                  {/* correzioni */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-widest text-emerald-300/80">Rispecchi: <b className="text-emerald-200">{LBL[mirrorTargetKey] || mirrorTargetKey}</b></p>
                    {!mirrorState ? (
                      <p className="text-[11px] mt-1" style={{ color: 'rgba(209,250,229,0.65)' }}>Inquadrati tutto e muoviti…</p>
                    ) : sc >= 82 ? (
                      <p className="text-[13px] font-bold text-emerald-300 mt-1">✓ Perfetto, tieni così!</p>
                    ) : mirrorState.hints?.length ? (
                      mirrorState.hints.map((h, i) => <p key={i} className="text-[12px] font-semibold text-red-300 mt-1 leading-snug">→ {h}</p>)
                    ) : (
                      <p className="text-[12px] text-amber-300 mt-1">Aggiusta i giunti rossi</p>
                    )}
                  </div>
                </div>
                {/* selettore tecnica (solo se non stai seguendo guidato/combo) */}
                {following ? (
                  <p className="text-[10px] text-center" style={{ color: 'rgba(209,250,229,0.65)' }}>Segue automaticamente l'esercizio in corso</p>
                ) : (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {chips.map((k) => (
                      <button key={k} onClick={() => setMirrorTech(k)}
                        className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 transition-all"
                        style={mirrorTech === k
                          ? { background: C.emerald.hex, color: '#0b0e14' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {LBL[k] || k}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-center text-emerald-200/80">🟢 giunto corretto · 🔴 da aggiustare — usa la fotocamera frontale (Gira)</p>
              </div>
            );
          })()}
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.93 }} onClick={captureAndAnalyze} disabled={analyzing}
              className="flex-[1.4] py-3.5 rounded-xl text-white text-sm font-black transition-all disabled:opacity-40 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 4px 18px ${C.violet.glow}` }}>
              <span className="relative inline-flex items-center justify-center gap-1.5"><ScanSearch size={16} /> Analizza</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => { if (!autoMode && guidedOn) stopGuided(); setAutoMode((v) => !v); }}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={autoMode
                ? { background: `linear-gradient(135deg, ${C.orange.hex}, #b45309)`, boxShadow: `0 4px 18px ${C.orange.glow}` }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{autoMode ? <><Pause size={15} /> Stop Auto</> : <><Play size={15} /> Auto</>}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => guidedOn ? stopGuided() : startGuided()}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={guidedOn
                ? { background: 'linear-gradient(135deg, #10b981, #047857)', boxShadow: '0 4px 18px rgba(16,185,129,0.4)' }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{guidedOn ? <><X size={15} /> Esci</> : <><Target size={15} /> Guidato</>}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => comboOn ? stopCombo() : startCombo()}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={comboOn
                ? { background: 'linear-gradient(135deg, #dc2626, #9f1239)', boxShadow: '0 4px 18px rgba(220,38,38,0.5)' }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{comboOn ? <><X size={15} /> Stop</> : <>🥊 Combo</>}</span>
            </motion.button>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={flipCamera}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <FlipHorizontal2 size={14} /> Gira
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceOn((v) => { const nv = !v; if (nv) unlockSpeech(); else window.speechSynthesis?.cancel(); return nv; })}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={voiceOn
                ? { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 16px rgba(5,150,105,0.4)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Voce {voiceOn ? 'ON' : 'OFF'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceSlow((v) => !v)}
              title={voiceSlow ? 'Voce lenta e scandita' : 'Voce a velocità normale'} aria-label="Velocità voce"
              className="px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center"
              style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {voiceSlow ? '🐢' : '🐇'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (!reactOn) unlockSpeech(); setReactOn((v) => !v); }}
              title="Reaction trainer: il coach chiama i comandi, tu esegui all'istante" aria-label="Reaction trainer"
              className="px-3 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center"
              style={reactOn
                ? { background: 'linear-gradient(135deg, #dc2626, #9f1239)', boxShadow: '0 4px 16px rgba(220,38,38,0.5)', color: '#fff' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}>
              ⚡
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSkeletonOn((v) => !v)}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={skeletonOn
                ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.45)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Bone size={14} /> Scheletro
            </motion.button>
          </div>

          {/* ANALISI PROFONDA — appare dopo 3+ feedback */}
          <AnimatePresence>
            {sessionFeedbacksRef.current.length >= 3 && (
              <motion.button
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                whileTap={{ scale: 0.97 }} onClick={analyzeSession} disabled={analyzingSession}
                className="w-full py-3 rounded-xl text-white text-xs font-black transition-all disabled:opacity-40 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.35), rgba(16,185,129,0.2))', border: `1px solid ${C.emerald.border}`, color: C.emerald.hex }}>
                {analyzingSession ? '⏳ Analisi profonda in corso…' : `🧠 Analisi Profonda — cosa migliorare (${sessionFeedbacksRef.current.length} frame)`}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Session analysis modal */}
      <AnimatePresence>
        {sessionAnalysis && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setSessionAnalysis(null)}>
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: '#08090f', border: '1px solid rgba(20,184,166,0.25)', borderBottom: 'none' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif', letterSpacing: '0.06em' }}>🧠 ANALISI SESSIONE</p>
                <button onClick={() => setSessionAnalysis(null)} className="text-gray-500 font-black text-lg leading-none">✕</button>
              </div>
              <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{sessionAnalysis.content}</p>
              {sessionAnalysis.provider && (
                <p className="text-[10px] font-mono mt-4" style={{ color: C.violet.hex, opacity: 0.6 }}>via {sessionAnalysis.provider} · {currentDisc?.label}</p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ── PAGELLA DI FINE SESSIONE ─────────────────────────────────────── */}
        {sessionReport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end"
            style={{ background: 'rgba(0,0,0,0.88)' }}
            onClick={() => !sessionReport.loading && setSessionReport(null)}>
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-h-[88vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: '#08090f', border: '1px solid rgba(124,58,237,0.3)', borderBottom: 'none' }}
              onClick={(e) => e.stopPropagation()}>
              {sessionReport.loading ? (
                <div className="py-10 flex flex-col items-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full" style={{ border: `3px solid ${C.violet.hex}33`, borderTopColor: C.violet.hex }} />
                  <p className="text-sm font-bold text-white/80">Il Maestro sta valutando la sessione…</p>
                  <p className="text-[11px] text-gray-500">Salvo i progressi per la prossima volta</p>
                </div>
              ) : sessionReport.report && (() => {
                const R = sessionReport.report;
                const sc = R.score;
                const scColor = sc >= 80 ? C.emerald.hex : sc >= 60 ? C.amber.hex : sc >= 40 ? C.orange.hex : '#ef4444';
                return (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black" style={{ color: C.violet.hex, fontFamily: 'Syne, sans-serif', letterSpacing: '0.06em' }}>
                        {sessionReport.exam ? '🎓 ESITO ESAME' : '🥋 PAGELLA SESSIONE'}
                      </p>
                      <button onClick={() => setSessionReport(null)} className="text-gray-500 font-black text-lg leading-none">✕</button>
                    </div>
                    {sessionReport.learned && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl px-3 py-2 mb-2"
                        style={{ background: 'rgba(139,92,246,0.12)', border: `1px solid ${C.violet.border}` }}>
                        <p className="text-xs font-black" style={{ color: C.violet.hex }}>📚 ARGOMENTO APPRESO: {sessionReport.learned}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#6b7280' }}>Segnato automaticamente nel curriculum: la sessione ha superato 80/100.</p>
                      </motion.div>
                    )}
                    {sessionReport.exam && (
                      <div className="rounded-xl px-3 py-2 mb-2 text-center"
                        style={sessionReport.exam.passed
                          ? { background: 'rgba(16,185,129,0.12)', border: `1px solid ${C.emerald.border}` }
                          : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <p className="text-base font-black" style={{ color: sessionReport.exam.passed ? C.emerald.hex : '#ef4444' }}>
                          {sessionReport.exam.passed ? `👑 PROMOSSO — livello ${sessionReport.exam.label} certificato` : `❌ RIPROVA — livello ${sessionReport.exam.label}`}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#6b7280' }}>
                          {sessionReport.exam.passed ? 'Diploma salvato nel curriculum. Avanti col prossimo livello.' : 'Serve ≥75/100. Allena i punti deboli qui sotto e ripresentati.'}
                        </p>
                      </div>
                    )}
                    {/* Voto + titolo */}
                    <div className="flex items-center gap-4 mb-4 mt-2">
                      <div className="relative flex-shrink-0" style={{ width: 78, height: 78 }}>
                        <svg width={78} height={78} viewBox="0 0 78 78">
                          <circle cx={39} cy={39} r={34} fill="none" stroke="#1f2937" strokeWidth={7} />
                          <motion.circle cx={39} cy={39} r={34} fill="none" stroke={scColor} strokeWidth={7} strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 34}
                            initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - sc / 100) }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            transform="rotate(-90 39 39)" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black" style={{ color: scColor }}>{sc}</span>
                          <span className="text-[8px] text-gray-500 -mt-0.5">/100</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-black text-white leading-tight">{R.title}</p>
                        <p className="text-[11px] mt-1" style={{ color: C.amber.hex }}>+{R.xp} XP · {currentDisc?.label}</p>
                        {R.coachNote && <p className="text-[11px] text-violet-200/80 italic mt-1 leading-snug">"{R.coachNote}"</p>}
                      </div>
                    </div>
                    {/* Radar delle 5 competenze del guerriero */}
                    {R.skills && (
                      <div className="flex flex-col items-center mb-3">
                        <SkillRadar skills={R.skills} />
                        <p className="text-[9px] mt-1" style={{ color: '#4b5563' }}>Competenze valutate dal Maestro in questa sessione</p>
                      </div>
                    )}
                    {/* Punti di forza */}
                    {R.strengths?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1">✅ Punti di forza</p>
                        {R.strengths.map((s, i) => <p key={i} className="text-[12px] text-emerald-100/90 pl-1 leading-snug">· {s}</p>)}
                      </div>
                    )}
                    {/* Da correggere */}
                    {R.weaknesses?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/90 mb-1">⚠️ Da correggere</p>
                        {R.weaknesses.map((s, i) => <p key={i} className="text-[12px] text-orange-100/90 pl-1 leading-snug">· {s}</p>)}
                      </div>
                    )}
                    {/* Focus prossima sessione */}
                    {R.focusNext?.length > 0 && (
                      <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300 mb-1">🎯 La prossima volta</p>
                        {R.focusNext.map((s, i) => <p key={i} className="text-[12px] text-white/90 pl-1 leading-snug">· {s}</p>)}
                        {R.nextDrill && <p className="text-[12px] font-bold text-amber-200 mt-2 pl-1">🥊 Prova: {R.nextDrill}</p>}
                      </div>
                    )}
                    {/* Segreto da studiare */}
                    {R.techniqueSecret && (
                      <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">🥷 Segreto da studiare</p>
                        <p className="text-[12px] text-amber-100/90 pl-1 leading-snug">{R.techniqueSecret}</p>
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-center" style={{ color: C.violet.hex, opacity: 0.5 }}>salvato nell'alveare · migliorerai giorno dopo giorno</p>
                    <button onClick={() => setSessionReport(null)}
                      className="w-full mt-3 py-3 rounded-xl text-white text-sm font-black"
                      style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)` }}>Continua</button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

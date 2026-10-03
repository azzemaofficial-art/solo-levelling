import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronRight, HelpCircle, Focus, Pause, Play, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { advanceMmaClock, createMmaObserver, initialMmaClock, MMA_CUES, summarizeMmaSession } from '../../lib/mmaCoachEngine.js';
import { readMmaStore, saveMmaReport } from '../../lib/mmaCoachStorage.js';
import { mmaCoaching } from '../data/mmaCoaching';
import { mmaRoundPlans } from '../data/mmaPath';
import useMmaCamera from '../hooks/useMmaCamera';
import { createReadiness, observerPose, readPose } from '../../lib/mmaReadiness.js';
import { createComboJudge, rateGesture } from '../../lib/mmaComboJudge.js';
import { loadTemplates } from '../../lib/mmaTemplates.js';

const MmaTeach = lazy(() => import('./MmaTeach'));
import { MOVES } from '../data/mmaMoves';
import MmaTechnique from './MmaTechnique';
import '../styles/mma-pro.css';

const timeText = ms => `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, '0')}`;
const emptySignal = { pose: { visible: false }, calibration: 0, calibrated: false, cue: 'framing', stats: {}, hint: '' };
const LOST_PAUSE = 'Non ti vedo più. Rientra nell’inquadratura: riparto da solo.';
const warmupCues = ['Cammina sul posto a ritmo facile, respira e sciogli le spalle.', 'Mobilizza dolcemente spalle e anche, senza cercare l’ampiezza massima.', 'Trova la guardia e fai passi corti in ogni direzione.'];

export default function MmaProCoach({ lesson, onClose }) {
  const teaching = mmaCoaching[lesson.id];
  const [view, setView] = useState('setup'), [mode, setMode] = useState('guided');
  const [stance, setStance] = useState(() => readMmaStore().lastSession?.stance === 'southpaw' ? 'southpaw' : 'orthodox');
  const [dose, setDose] = useState(() => { const last = readMmaStore().lastSession; return last?.effort === 8 && Date.now() - Date.parse(last.date) < 172800000 ? 'light' : 'standard'; });
  const [voice, setVoice] = useState(true), [warmedUp, setWarmedUp] = useState(false);
  const [signal, setSignal] = useState(emptySignal), [clock, setClock] = useState(initialMmaClock);
  const [paused, setPaused] = useState(''), [report, setReport] = useState(null), [saved, setSaved] = useState(true);
  const [checks, setChecks] = useState([]), [effort, setEffort] = useState(null), [exitPrompt, setExitPrompt] = useState(false);
  const [facing, setFacing] = useState('user');
  const [strike, setStrike] = useState(null), [teachOpen, setTeachOpen] = useState(false), [guardAlert, setGuardAlert] = useState('');
  const guardRef = useRef({ L: null, R: null, at: 0 });
  const judgeRef = useRef(null), readinessRef = useRef(createReadiness()), seenRef = useRef(0), tipRef = useRef({ at: 0, clean: 0 }), hintRef = useRef({ text: '', at: 0 });
  const lostRef = useRef({ paused: false, back: null }), autoStartRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const rootRef = useRef(null), observerRef = useRef(createMmaObserver({ lessonId: lesson.id }));
  const live = useRef({}), clockRef = useRef(clock), lastFrame = useRef(0), lastUI = useRef(0), cueSpoken = useRef({ cue: '', at: 0 });
  const activeMs = useRef(0), roundLog = useRef([]), roundStart = useRef({}), finalized = useRef(false), voiceRef = useRef(voice);
  voiceRef.current = voice;
  const config = { rounds: dose === 'light' ? 2 : lesson.rounds || 3, workMs: dose === 'light' ? 60000 : (lesson.roundSeconds || (lesson.id === 'sprawl' ? 60 : 120)) * 1000, restMs: 60000 };
  live.current = { view, mode, paused, config, stance };
  const speak = useCallback((message, interrupt = false) => {
    if (!voiceRef.current || !window.speechSynthesis) return;
    if (interrupt) window.speechSynthesis.cancel();
    else if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = 'it-IT'; speech.rate = 1; speech.volume = .9;
    const italian = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('it'));
    if (italian) speech.voice = italian;
    window.speechSynthesis.speak(speech);
  }, []);
  // colpo finito (giudice 3D): conta, mostra il voto e al massimo una correzione ogni 3,5 s
  const handleStrike = useCallback((g, at) => {
    const rate = rateGesture(g);
    if (!rate) { if (g.kind === 'unclear') setStrike((prev) => ({ name: 'Colpo poco chiaro', score: null, tip: 'più deciso e completo', n: (prev?.n || 0) + 1 })); return; }
    if (rate.id === 'jab' || rate.id === 'cross') observerRef.current.recordPunch(rate.id, at);
    const name = MOVES[rate.id]?.name || rate.id, tip = rate.issues[0]?.text;
    setStrike(prev => ({ name, score: rate.score, tip, n: (prev?.n || 0) + 1 }));
    const now = performance.now();
    if (tip && now - tipRef.current.at > 3500) { tipRef.current.at = now; speak(`${name}: ${tip}.`); }
    else if (!tip && ++tipRef.current.clean >= 4 && now - tipRef.current.at > 6000) { tipRef.current = { at: now, clean: 0 }; speak(['Pulito.', 'Bene così.', 'Ottimo, continua.'][Math.floor(Math.random() * 3)]); }
  }, [speak]);
  const receiveFrame = useCallback((points, at, aspect, world) => {
    const state = live.current;
    const working = state.view === 'session' && clockRef.current.phase === 'work' && !state.paused;
    const read = readPose(points, world, { aspect, needFeet: lesson.id === 'kick' });
    const judge = judgeRef.current;
    let busy = {}, guardNow = null;
    if (state.view === 'calibrate' && judge) {
      // niente pulsante da premere: quando ti vede in guardia per ~1,3 s parte da solo
      readinessRef.current.update(read.ok, at);
      if (read.ok && world?.length) judge.calibrate(world, points, aspect);
      if (readinessRef.current.done && judge.isCalibrated()) observerRef.current.setCalibrated();
      const now = performance.now();
      if (!read.ok && read.hint && (read.hint !== hintRef.current.text ? now - hintRef.current.at > 2500 : now - hintRef.current.at > 7000)) { hintRef.current = { text: read.hint, at: now }; speak(read.hint, true); }
    } else if (working && judge?.isCalibrated() && world?.length && read.visible) {
      const info = judge.push(world, at, points, aspect);
      if (info) {
        // "sta colpendo" solo per i primi 0,6 s: una mano che resta giù non è un colpo
        const striking = (key) => info.activeKeys.includes(key) && (info.activeAge[key] ?? 0) < 600;
        busy = { [judge.lead]: striking('leadArm'), [judge.rear]: striking('rearArm') };
        guardNow = info;
        // guardia bassa: mano per mano, pugno sotto la linea della spalla per più di 0,7 s di fila
        // (un colpo, anche al corpo, ci resta molto meno)
        const G = guardRef.current, now = performance.now();
        for (const S of ['L', 'R']) {
          const down = info.guardKnown[S] && !info.guard[S];
          G[S] = down ? (G[S] ?? now) : null;
        }
        const late = ['L', 'R'].filter((S) => G[S] != null && now - G[S] > 700);
        const text = late.length === 2 ? 'Mani su!' : late[0] === 'L' ? 'Mano sinistra su!' : late[0] === 'R' ? 'Mano destra su!' : '';
        setGuardAlert((prev) => (prev === text ? prev : text));
        if (text && now - G.at > 3500) { G.at = now; tipRef.current.at = now; speak(text, true); }
        if (info.gestures > seenRef.current) { judge.gestures().slice(seenRef.current).forEach(g => handleStrike(g, at)); seenRef.current = info.gestures; }
      }
    } else if (!read.visible) judge?.abort();
    if (!working) setGuardAlert((prev) => (prev ? '' : prev));
    const pose = observerPose(read, points, aspect, busy);
    // la guardia del giudice (calibrata su di te, pugno sopra la spalla) vale più del controllo di partenza
    if (guardNow && pose.visible) for (const S of ['L', 'R']) if (guardNow.guardKnown[S]) { pose.arms[S].guard = guardNow.guard[S]; pose.arms[S].high = guardNow.guard[S]; }
    if (guardNow && pose.visible) pose.bothGuard = pose.arms.L.guard && pose.arms.R.guard;
    const next = observerRef.current.update(points, at, { aspect, active: working, pose });
    if (state.view === 'calibrate') next.calibration = readinessRef.current.progress;
    next.hint = read.hint; next.ready = read.ok;
    lastFrame.current = performance.now();
    if (performance.now() - lastUI.current > 150) { lastUI.current = performance.now(); setSignal(next); }
    // inquadratura persa → pausa; quando ti rivede per 1 s riparte da solo
    if (working && next.lostFor > 2500) { lostRef.current = { paused: true, back: null }; setPaused(LOST_PAUSE); speak('Non ti vedo più. Rientra e riparto da solo.', true); }
    if (state.view === 'session' && state.paused === LOST_PAUSE && lostRef.current.paused) {
      if (read.visible) {
        lostRef.current.back ??= at;
        if (at - lostRef.current.back > 1000) { lostRef.current = { paused: false, back: null }; judge?.abort(); setPaused(''); speak('Ti rivedo. Riprendiamo.', true); }
      } else lostRef.current.back = null;
    }
    if (working && next.cue !== 'ready' && next.cue !== 'framing' && next.cue !== 'guard' && performance.now() - cueSpoken.current.at > 6500 && performance.now() - tipRef.current.at > 2500) {
      cueSpoken.current = { cue: next.cue, at: performance.now() }; speak(MMA_CUES[next.cue]);
    }
  }, [speak, handleStrike, lesson.id]);
  const camera = useMmaCamera(receiveFrame, { minInterval: 33, canSwap: () => live.current.view !== 'session' || clockRef.current.phase !== 'work' || Boolean(live.current.paused) });
  const close = useCallback(() => { camera.stop(); window.speechSynthesis?.cancel(); onCloseRef.current(); }, [camera.stop]);
  const requestExit = useCallback(() => {
    if (live.current.view === 'session') { setPaused('Sessione in pausa.'); setExitPrompt(true); }
    else close();
  }, [close]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    rootRef.current?.focus();
    const keys = e => {
      if (e.key === 'Escape') { e.preventDefault(); requestExit(); }
      if (e.key === 'Tab') {
        const focusRoot = rootRef.current.querySelector('.mma-pro-exit') || rootRef.current;
        const nodes = [...focusRoot.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
        if (!nodes.length) return;
        if (e.shiftKey && (document.activeElement === nodes[0] || document.activeElement === rootRef.current)) { e.preventDefault(); nodes.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
      }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keys); window.speechSynthesis?.cancel(); previousFocus?.focus?.(); };
  }, [requestExit]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && live.current.view === 'session') { setPaused('App lasciata in background. Riprendi quando sei pronto.'); observerRef.current.resetGesture(); window.speechSynthesis?.cancel(); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => { if (camera.error && camera.status === 'error' && view === 'session') setPaused(camera.error); }, [camera.error, camera.status, view]);
  useEffect(() => {
    if (!['session', 'calibrate'].includes(view) || !navigator.wakeLock) return;
    let active = true, lock;
    navigator.wakeLock.request('screen').then(value => {
      if (active) lock = value;
      else value.release().catch(() => {});
    }).catch(() => {});
    return () => { active = false; lock?.release().catch(() => {}); };
  }, [view, paused]);
  const completeRound = useCallback((number) => {
    const stats = observerRef.current.snapshot(), before = roundStart.current;
    roundLog.current.push({ round: number, jab: stats.jab - (before.jab || 0), cross: stats.cross - (before.cross || 0), observedMs: Math.round(stats.observedMs - (before.observedMs || 0)) });
    roundStart.current = stats;
  }, []);
  const finish = useCallback(() => {
    if (finalized.current) return;
    finalized.current = true;
    const state = live.current;
    const result = summarizeMmaSession(observerRef.current.snapshot(), { lessonId: lesson.id, rounds: state.config.rounds, completed: clockRef.current.completed, mode: state.mode, activeMs: activeMs.current, stance: state.stance, dose, roundLog: roundLog.current });
    camera.stop(); window.speechSynthesis?.cancel(); setExitPrompt(false);
    setReport(result); setSaved(result.activeMs >= 15000 ? saveMmaReport(result) : null); setView('report');
  }, [lesson.id, dose, camera.stop]);
  useEffect(() => {
    if (view !== 'session' || paused) return;
    let last = performance.now();
    const tick = setInterval(() => {
      const now = performance.now(), delta = now - last; last = now;
      if (document.hidden) return;
      if (delta > 1500) { setPaused('Il dispositivo si è fermato per un istante. Riprendi quando sei pronto.'); return; }
      const current = clockRef.current;
      if (mode === 'camera' && current.phase === 'work' && now - lastFrame.current > 2000) { setPaused('Il video non si aggiorna. Controlla la fotocamera.'); return; }
      if (current.phase === 'work') activeMs.current += Math.min(delta, current.remaining);
      const next = advanceMmaClock(current, delta, config);
      if (current.phase === 'work' && next.phase !== 'work') { completeRound(current.round); observerRef.current.resetGesture(); }
      if (current.phase !== 'work' && next.phase === 'work') roundStart.current = observerRef.current.snapshot();
      clockRef.current = next; setClock(next);
      if (next.phase === 'done') finish();
    }, 100);
    return () => clearInterval(tick);
  }, [view, paused, mode, config.rounds, config.workMs, config.restMs, completeRound, finish]);
  useEffect(() => { rootRef.current?.scrollTo({ top: 0 }); }, [view]);
  const spokenPhase = useRef('');
  useEffect(() => {
    if (view !== 'session' || paused) return;
    const key = `${clock.phase}-${clock.round}`;
    if (spokenPhase.current === key) return;
    spokenPhase.current = key;
    if (clock.phase === 'work') speak(`Round ${clock.round}. ${mmaRoundPlans[lesson.id]?.[clock.round - 1] || lesson.focus}`, true);
    if (clock.phase === 'rest') speak('Recupera un minuto. Respira e rilassa le spalle.', true);
    if (clock.phase === 'countdown') speak('Cinque secondi. Trova la guardia.', true);
    if (clock.phase === 'warmup') speak(warmupCues[0], true);
  }, [clock.phase, clock.round, view, paused, speak, lesson]);
  const warmupIndex = clock.phase === 'warmup' ? Math.min(2, Math.floor((180000 - clock.remaining) / 60000)) : -1;
  useEffect(() => { if (view === 'session' && warmupIndex > 0 && !paused) speak(warmupCues[warmupIndex], true); }, [warmupIndex, view, paused, speak]);
  // pronto in guardia → si parte da solo (niente corsa al telefono per toccare "Inizia")
  useEffect(() => {
    if (view !== 'calibrate' || !signal.calibrated || camera.status !== 'ready' || autoStartRef.current) return;
    autoStartRef.current = true;
    begin('camera');
  });
  const freshTracking = () => {
    observerRef.current = createMmaObserver({ lessonId: lesson.id, lead: stance === 'southpaw' ? 'R' : 'L', external: true });
    judgeRef.current = createComboJudge({ stance, templates: loadTemplates(stance) }); readinessRef.current.reset(); guardRef.current = { L: null, R: null, at: 0 }; setGuardAlert(''); seenRef.current = 0; autoStartRef.current = false;
    setSignal(emptySignal); setStrike(null);
  };
  const enterCamera = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* sblocca la voce su iPhone */ }
    freshTracking(); setMode('camera'); setView('calibrate'); speak('Appoggia il telefono, allontanati e mettiti in guardia. Parto da solo appena ti vedo.', true); camera.start(facing);
  };
  const begin = chosenMode => {
    if (chosenMode === 'guided') { camera.stop(); observerRef.current = createMmaObserver({ lessonId: lesson.id }); }
    lostRef.current = { paused: false, back: null };
    setMode(chosenMode); setPaused(''); finalized.current = false; activeMs.current = 0; roundLog.current = []; roundStart.current = {};
    const start = warmedUp ? initialMmaClock() : { phase: 'warmup', round: 1, remaining: 180000, completed: 0 };
    clockRef.current = start; setClock(start); setView('session');
    speak(`${chosenMode === 'camera' ? 'Ti vedo. ' : ''}${warmedUp ? 'Preparati. Cinque secondi.' : warmupCues[0]}`, true);
  };
  const togglePause = () => {
    observerRef.current.resetGesture(); judgeRef.current?.abort(); lostRef.current = { paused: false, back: null };
    if (!paused) { setPaused('Prenditi il tempo che serve.'); window.speechSynthesis?.cancel(); }
    else { setPaused(''); speak('Riprendi con controllo.', true); }
  };
  const updateReflection = (nextChecks, nextEffort) => {
    setChecks(nextChecks); setEffort(nextEffort);
    const next = { ...report, selfCheck: nextChecks, effort: nextEffort };
    setReport(next); setSaved(next.activeMs >= 15000 ? saveMmaReport(next) : null);
  };
  const punchLesson = ['jab','cross','one-two','defense','tactics'].includes(lesson.id);
  const canResume = mode !== 'camera' || (camera.status === 'ready' && signal.pose.visible && performance.now() - lastFrame.current < 2000);
  const prior = report ? (readMmaStore().history || []).find(item => item.id !== report.id && item.lessonId === lesson.id && item.version === report.version && item.dose === report.dose && item.stance === report.stance && item.enough) : null;
  const readyCamera = camera.status === 'ready';
  const activeCue = paused || (mode === 'camera' && guardAlert ? `${guardAlert} Pugni sopra la linea delle spalle, vicino al viso.` : null) || (mode === 'guided' ? 'Segui la consegna del round, al tuo ritmo.' : !signal.pose.visible ? MMA_CUES.framing : teaching.guidedOnly || ['kick'].includes(lesson.id) ? 'Esegui con controllo. Questa tecnica richiede una verifica umana.' : MMA_CUES[signal.cue]);
  const phaseLabel = { warmup: 'RISCALDAMENTO', countdown: 'PREPARATI', work: `ROUND ${clock.round}`, rest: `RECUPERO / POI ROUND ${clock.round}`, done: 'COMPLETATO' }[clock.phase];
  const roundCue = clock.phase === 'warmup' ? warmupCues[warmupIndex] : clock.phase === 'rest' ? `Prossimo: ${mmaRoundPlans[lesson.id]?.[clock.round - 1] || lesson.focus}` : mmaRoundPlans[lesson.id]?.[clock.round - 1] || lesson.focus;
  return createPortal(<div className={`mma-pro mma-pro--${view}`} role="dialog" aria-modal="true" aria-labelledby="mma-pro-title" ref={rootRef} tabIndex={-1}>
    <div className="mma-pro-shell">
      <header className="mma-pro-header"><button className="mma-pro-icon" onClick={requestExit} aria-label="Chiudi Coach Studio"><ArrowLeft size={19} /></button><div><small>SHADOW / COACH STUDIO</small><span>Il tuo angolo. Una correzione alla volta.</span></div><button className={`mma-pro-icon ${voice ? 'on' : ''}`} aria-label={voice ? 'Disattiva voce del coach' : 'Attiva voce del coach'} aria-pressed={voice} onClick={() => { setVoice(v => !v); window.speechSynthesis?.cancel(); }} >{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></header>
      <div className="mma-pro-heading"><div><span className="mma-pro-eyebrow">{teaching.tag}</span><h1 id="mma-pro-title">{view === 'report' ? 'Porta avanti questo.' : lesson.title}</h1></div><span className="mma-pro-pill"><ShieldCheck size={13} />{view === 'setup' ? 'TECNICA / CONTROLLO' : mode === 'camera' ? 'ANALISI LOCALE' : 'GUIDA A ROUND'}</span></div>
      {view === 'report' ? <div className="mma-pro-report">
        <section className="mma-pro-report-lead"><span className="mma-pro-eyebrow">{report.completed === report.rounds ? 'SESSIONE TERMINATA' : 'SESSIONE INTERROTTA'}</span><h2>{report.focus}</h2><p>{report.completed}/{report.rounds} round completati · {timeText(report.activeMs)} di lavoro{report.mode === 'camera' ? ` · ${report.coverage}% del lavoro osservato` : ' · senza valutazione della camera'}</p></section>
        <div className="mma-pro-report-metrics"><div><small>TEMPO OSSERVATO</small><strong>{report.mode === 'camera' ? timeText(report.observedMs) : '—'}</strong><span>fotogrammi utilizzabili</span></div><div><small>MANO LIBERA ALTA</small><strong>{report.guard == null ? '—' : `${report.guard}%`}</strong><span>del tempo osservabile{prior?.guard != null && report.guard != null ? ` · ${report.guard - prior.guard >= 0 ? '+' : ''}${report.guard - prior.guard} punti vs ultima seduta comparabile` : ''}</span></div>{punchLesson && <div><small>{lesson.id === 'one-two' ? 'SEQUENZE 1–2' : 'CICLI COMPLETI'}</small><strong>{report.enough ? lesson.id === 'one-two' ? report.combinations : report.jab + report.cross : '—'}</strong><span>estensione + ritorno visibili</span></div>}</div>
        {report.roundLog.length > 0 && <section className="mma-pro-card"><h3>Round per round</h3>{report.roundLog.map(row => <div className="mma-pro-round-result" key={row.round}><b>0{row.round}</b><span>{report.mode === 'camera' ? `${timeText(row.observedMs)} osservati` : 'Pratica guidata'}</span>{punchLesson && report.mode === 'camera' && <span>{row.jab} jab · {row.cross} cross</span>}<Check size={15} /></div>)}</section>}
        <section className="mma-pro-card"><span className="mma-pro-eyebrow">LA TUA VALUTAZIONE</span><h3>Cosa sei riuscito a controllare?</h3><p>Questi aspetti completano ciò che la camera può vedere.</p><div className="mma-pro-checks">{teaching.checklist.map((text, index) => <label key={text}><input type="checkbox" checked={checks.includes(index)} onChange={() => updateReflection(checks.includes(index) ? checks.filter(i => i !== index) : [...checks,index], effort)} /><span>{text}</span></label>)}</div><h3>Quanto è stata impegnativa?</h3><div className="mma-pro-effort">{[[3,'Facile'],[5,'Gestibile'],[8,'Faticosa']].map(([value,label]) => <button key={value} aria-pressed={effort === value} onClick={() => updateReflection(checks,value)}>{label}</button>)}</div>{effort === 8 && <p>La prossima volta scegli la versione breve e rallenta l’esecuzione.</p>}</section>
        <p className="mma-pro-note">{saved === null ? 'Meno di 15 secondi di lavoro: questa prova non entra nel diario.' : saved ? 'Riepilogo salvato sul dispositivo.' : 'Memoria del browser piena o non disponibile: il riepilogo non è stato salvato.'} Le misure sono stime visive, non un voto sulla tua abilità MMA.</p>
        <button className="mma-pro-primary" onClick={close}>Torna al percorso <ArrowRight size={17} /></button>
      </div> : <div className="mma-pro-workspace">
        <section className="mma-pro-visual">
          {mode === 'camera' && view !== 'setup' ? <div className="mma-pro-camera"><video ref={camera.videoRef} autoPlay muted playsInline style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} onClick={() => camera.videoRef.current?.play()} /><canvas ref={camera.canvasRef} style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />{view === 'session' && strike && <div key={strike.n} className={`mma-live-label ${strike.score == null ? 'unclear' : strike.tip ? 'fix' : ''}`}>{strike.score == null ? '?' : strike.name}</div>}{view === 'session' && guardAlert && <div className="mma-guard-alert">{guardAlert}</div>}<div className={`mma-pro-tracking ${readyCamera && signal.pose.visible ? 'good' : ''}`}><i />{camera.status === 'permission' ? 'Attendo il permesso camera' : camera.status === 'loading' ? 'Carico il riconoscimento…' : !readyCamera ? 'Camera non disponibile' : signal.pose.full ? 'Corpo intero visibile' : signal.pose.visible ? 'Busto visibile · piedi fuori quadro' : 'Cerca un’inquadratura completa'}{readyCamera && camera.profile && <em className="mma-pro-precision">{camera.profile.model === 'full' ? '3D · precisione alta' : '3D · standard'}</em>}</div>{view === 'calibrate' && <div className="mma-pro-calibration"><Focus size={30} /><strong>{signal.calibrated ? 'Ti vedo. Si parte!' : signal.hint || 'Mettiti in guardia davanti al telefono.'}</strong><p>{signal.calibrated ? 'La sessione parte da sola.' : 'Telefono fermo all’altezza del petto, tu a 2 metri, di tre quarti. Parto da solo quando ti vedo in guardia.'}</p><div role="progressbar" aria-label="Preparazione inquadratura" aria-valuenow={Math.round(signal.calibration * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${signal.calibration * 100}%` }} /></div></div>}</div> : <MmaTechnique kind={teaching.demo} steps={teaching.steps} stance={stance} compact={view === 'session'} />}
          {view === 'session' && <div className={`mma-pro-correction ${paused ? 'paused' : ''}`} role="status"><small>{paused ? 'PAUSA' : mode === 'guided' ? 'FOCUS' : 'IL COACH OSSERVA'}</small><strong>{activeCue}</strong>{mode === 'camera' && punchLesson && <span>{signal.stats.jab || 0} jab · {signal.stats.cross || 0} cross{lesson.id === 'one-two' ? ` · ${signal.stats.combos || 0} sequenze 1–2` : ''}</span>}{mode === 'camera' && strike && <div className={`mma-pro-strike ${strike.tip ? 'fix' : 'clean'}`} key={strike.n} aria-live="polite"><b>{strike.name}</b><i>{strike.score}</i><small>{strike.tip || 'pulito'}</small></div>}</div>}
          {view !== 'session' && <div className="mma-pro-observation"><ShieldCheck size={18} /><div><strong>Cosa osserviamo</strong><p>{teaching.measured}</p></div></div>}
        </section>
        <aside className="mma-pro-controls">
          {view === 'setup' && <>
            <section><span className="mma-pro-eyebrow">L’OBIETTIVO DI OGGI</span><h2>{teaching.objective}</h2></section>
            <fieldset className="mma-pro-choice"><legend>La tua guardia</legend><div>{[['orthodox','Sinistro avanti','Guardia destra'],['southpaw','Destro avanti','Guardia mancina']].map(([value,label,note]) => <button key={value} aria-pressed={stance === value} onClick={() => setStance(value)}><strong>{label}</strong><small>{note}</small></button>)}</div></fieldset>
            <fieldset className="mma-pro-choice"><legend>La sessione di oggi</legend><div>{[['standard','Completa',`${lesson.rounds || 3} round tecnici`],['light','Breve','2 × 1 min · recupero 1 min']].map(([value,label,note]) => <button key={value} aria-pressed={dose === value} onClick={() => setDose(value)}><strong>{label}</strong><small>{note}</small></button>)}</div></fieldset>
            <div className="mma-pro-plan">{Array.from({ length: config.rounds }, (_, i) => <div key={i}><b>0{i+1}</b><span>{mmaRoundPlans[lesson.id]?.[i] || lesson.focus}</span><small>{timeText(config.workMs)}</small></div>)}</div>
            <label className="mma-pro-warmed"><input type="checkbox" checked={warmedUp} onChange={e => setWarmedUp(e.target.checked)} />Ho già fatto riscaldamento</label>
            <p className="mma-pro-note">{warmedUp ? '5 secondi di preparazione, poi il primo round.' : 'Iniziamo con 3 minuti di riscaldamento guidato.'} 60 secondi di recupero fra i round.</p>
            {!teaching.guidedOnly && <button className="mma-pro-primary" onClick={enterCamera}><Camera size={18} />Prepara la fotocamera <ArrowRight size={17} /></button>}
            {!teaching.guidedOnly && <button className="mma-pro-secondary" onClick={() => setTeachOpen(true)}>🎓 {loadTemplates(stance) ? 'Rifai: insegna i tuoi colpi' : 'Insegna i tuoi colpi al coach (2 min)'}</button>}
            <button className={teaching.guidedOnly ? 'mma-pro-primary' : 'mma-pro-secondary'} onClick={() => begin('guided')}><Play size={16} />{teaching.guidedOnly ? 'Inizia la guida a round' : 'Allenati senza fotocamera'}</button>
            <p className="mma-pro-privacy">Il video resta sul dispositivo. Nessuna registrazione o chiamata AI a consumo. Il riconoscimento richiede il download iniziale del modello.</p>
          </>}
          {view === 'calibrate' && <>
            <span className="mma-pro-eyebrow">PRIMA DI COMINCIARE</span><h2>Metti il coach nella posizione giusta.</h2><ol className="mma-pro-placement"><li>Telefono fermo, camera all’altezza del petto.</li><li>Lascia spazio intorno a testa, mani e piedi.</li><li>Luce davanti a te. Parti in guardia, ruotato a circa 45°.</li></ol>
            {camera.error && <p role="alert" className="mma-pro-error">{camera.error}</p>}
            <button className="mma-pro-primary" disabled={!signal.calibrated || !readyCamera} onClick={() => begin('camera')}>Inizia la sessione <Play size={16} /></button>
            <p className="mma-pro-note">Non serve toccare: appena ti vedo in guardia per un secondo, la sessione parte da sola.</p>
            <div className="mma-pro-inline-actions"><button onClick={() => { freshTracking(); camera.start(facing); }}>Riprova camera</button><button onClick={() => { const next = facing === 'user' ? 'environment' : 'user'; setFacing(next); freshTracking(); camera.start(next); }}>Cambia camera</button></div>
            <button className="mma-pro-secondary" onClick={() => begin('guided')}>Continua senza fotocamera</button><button className="mma-pro-text" onClick={() => { camera.stop(); setView('setup'); }}>Modifica la sessione</button>
          </>}
          {view === 'session' && <>
            <div className="mma-pro-round-dots">{Array.from({ length: config.rounds },(_, i) => <span className={i < clock.completed ? 'done' : i + 1 === clock.round ? 'current' : ''} key={i}>{i < clock.completed ? <Check size={12} /> : String(i + 1).padStart(2,'0')}</span>)}<small>{clock.completed}/{config.rounds} COMPLETATI</small></div>
            <div className={`mma-pro-clock ${clock.phase === 'rest' ? 'rest' : ''}`}><small>{paused ? 'IN PAUSA' : phaseLabel}</small><strong>{timeText(clock.remaining)}</strong><div><i style={{ width: `${Math.max(0,Math.min(100,clock.remaining / (clock.phase === 'warmup' ? 180000 : clock.phase === 'work' ? config.workMs : clock.phase === 'rest' ? config.restMs : 5000) * 100))}%` }} /></div></div>
            <div className="mma-pro-current-drill"><small>LA CONSEGNA</small><h2>{roundCue}</h2></div>
            <button className="mma-pro-primary" disabled={Boolean(paused) && !canResume} onClick={togglePause}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? 'Riprendi' : 'Pausa'}</button>
            {paused && mode === 'camera' && !canResume && <button className="mma-pro-secondary" onClick={() => { camera.start(facing); }}>Riapri la fotocamera</button>}
            <button className="mma-pro-text" onClick={() => { setPaused('Sessione in pausa.'); setExitPrompt(true); }}>Termina e salva il riepilogo</button>
            <p className="mma-pro-note">{mode === 'camera' ? 'Se la camera perde il corpo, il lavoro si mette in pausa. Riprendi tu quando sei pronto.' : 'La guida scandisce il lavoro. Nessuna valutazione automatica della tecnica.'}</p>
          </>}
        </aside>
      </div>}
      <details className="mma-pro-method"><summary><HelpCircle size={14} /> Metodo e limiti del Coach <ChevronRight size={13} /></summary><p>Le basi di guardia e pugni fanno riferimento ai <a href="https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf" target="_blank" rel="noreferrer">manuali England Boxing</a>. Il rilevamento usa <a href="https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js" target="_blank" rel="noreferrer">MediaPipe Pose Landmarker</a>. Le nostre regole di lettura dei movimenti sono euristiche e non sono state validate come valutazione professionale. Lavora lentamente: occlusioni, prospettiva e velocità possono far perdere colpi. Sparring, clinch e grappling richiedono un istruttore.</p></details>
    </div>
    {teachOpen && <Suspense fallback={null}><MmaTeach initialStance={stance} onClose={() => { setTeachOpen(false); if (judgeRef.current) judgeRef.current.setTemplates(loadTemplates(stance)); }} /></Suspense>}
    {exitPrompt && <div className="mma-pro-exit" role="alertdialog" aria-label="Termina sessione"><div><span className="mma-pro-eyebrow">SESSIONE IN PAUSA</span><h2>Chiudiamo qui?</h2><p>Salvo il lavoro effettivamente completato. Puoi ripartire dalla stessa lezione la prossima volta.</p><button className="mma-pro-primary" autoFocus onClick={finish}>Salva e termina</button><button className="mma-pro-secondary" onClick={() => setExitPrompt(false)}>Resta nella sessione</button><button className="mma-pro-text" onClick={close}>Scarta senza salvare</button></div></div>}
  </div>, document.body);
}

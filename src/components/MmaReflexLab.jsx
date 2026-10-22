import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Lock, RotateCcw, Video, Volume2, VolumeX, Zap } from 'lucide-react';
import useMmaCamera from '../hooks/useMmaCamera';
import MmaCameraSetup from './MmaCameraSetup';
import { createReadiness, readPose } from '../../lib/mmaReadiness';
import { createComboJudge } from '../../lib/mmaComboJudge';
import { loadTemplates } from '../../lib/mmaTemplates';
import { CUES, DRILLS, REFLEX, addSession, drillAnswers, drillById, drillNeedsFeet, drillStats, loadHistory, passed, planTrials, saveHistory, scoreTrial, summarize, unlockedDrills, windowOf } from '../../lib/mmaReflex';
import { localDateKey, logWorkout } from '../utils/trainingLog';

// Laboratorio riflessi: lo schermo si colora (colore + segno, si vede a 3 metri), tu rispondi, la camera
// misura reazione, tempo del colpo e scelta giusta. Logica e misure: lib/mmaReflex.js.

const say = (text, on) => {
  if (!on || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    const v = window.speechSynthesis.getVoices().find((x) => /^it/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* voce non disponibile */ }
};

// cosa è successo in una prova, in parole
const VERDICT = {
  ok: 'Giusto', wrong: 'Risposta sbagliata', miss: 'Nessuna risposta', early: 'Partito prima del segnale',
  held: 'Bravo, fermo', bit: 'Hai abboccato', unread: 'Colpo non letto: non conta', restless: 'Eri in movimento: la rifacciamo', noBase: 'Non ti vedevo bene: la rifacciamo',
};
const GOOD = new Set(['ok', 'held']);
const ms = (x) => (x == null ? '—' : `${x} ms`);

export default function MmaReflexLab({ onClose, initialDrill }) {
  const [stance] = useState(() => { try { return localStorage.getItem('shadow_monarch_mma_stance') || 'orthodox'; } catch { return 'orthodox'; } });
  const [history, setHistory] = useState(loadHistory);
  const open = unlockedDrills(history);
  const [drillId, setDrillId] = useState(() => (open.includes(initialDrill) ? initialDrill : open[open.length - 1]));
  const drill = drillById(drillId);
  const feet = drillNeedsFeet(drill);
  const [facing, setFacing] = useState('user');
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem('shadow_monarch_coach_voice') !== '0'; } catch { return true; } });
  const [phase, setPhaseState] = useState('setup'); // setup calibrate ready cue feedback summary
  const [calib, setCalib] = useState(0);
  const [framing, setFraming] = useState('');
  const [hint, setHint] = useState('');
  const [last, setLast] = useState(null);       // ultima prova
  const [done, setDone] = useState([]);         // prove della serie
  const [report, setReport] = useState(null);   // riassunto a fine serie

  const phaseRef = useRef('setup');
  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };
  const judgeRef = useRef(null);
  const readyRef = useRef(createReadiness());
  const planRef = useRef([]), idxRef = useRef(0), trialsRef = useRef([]), redoRef = useRef(0);
  const cueRef = useRef(null);                  // { cue, at }
  const stillRef = useRef({ since: null, timer: null, armedAt: 0 });
  const aspectRef = useRef(1), startedRef = useRef(0);
  const flashRef = useRef(null), audioRef = useRef(null), cameraRef = useRef(null);
  const timers = useRef([]);
  const later = (fn, wait) => { const id = setTimeout(fn, wait); timers.current.push(id); return id; };
  const voiceRef = useRef(voice); voiceRef.current = voice;
  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(stillRef.current.timer); window.speechSynthesis?.cancel(); audioRef.current?.close?.(); }, []);
  useEffect(() => { try { localStorage.setItem('shadow_monarch_coach_voice', voice ? '1' : '0'); } catch { /* storage */ } }, [voice]);

  // bip corto (sei lontano dal telefono): acuto = giusto, grave = sbagliato
  const beep = (good) => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = good ? 880 : 220; o.type = 'sine';
      g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
    } catch { /* audio */ }
  };

  const hideFlash = () => { const el = flashRef.current; if (el) { el.dataset.on = '0'; el.style.background = 'transparent'; el.textContent = ''; } };

  // il segnale: si accende nel fotogramma dello schermo (niente attese di React) e l'istante vero è
  // il fotogramma dopo, quando il colore è apparso davvero
  const fireCue = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    const trial = planRef.current[idxRef.current];
    if (!trial) return;
    const spec = CUES[trial.cue];
    requestAnimationFrame(() => {
      const el = flashRef.current;
      if (el) { el.style.background = spec.color; el.textContent = spec.sign; el.dataset.on = '1'; }
      requestAnimationFrame((shownAt) => {
        cueRef.current = { cue: trial.cue, at: shownAt };
        setPhase('cue');
      });
    });
  }, []);

  const finishSeries = useCallback(() => {
    const trials = trialsRef.current;
    const s = summarize(trials);
    const h = addSession(loadHistory(), drill.id, s);
    saveHistory(h); setHistory(h);
    const st = drillStats(h, drill.id);
    const nowOpen = unlockedDrills(h);
    const next = DRILLS.find((d) => nowOpen.includes(d.id) && !open.includes(d.id)) || null;
    const minutes = Math.max(2, Math.round((performance.now() - startedRef.current) / 60000));
    logWorkout({ date: localDateKey(), kind: 'mma', title: `Riflessi · ${drill.name}`, minutes, note: `reazione ${s.rt ?? '—'} ms, giuste ${Math.round(s.acc * 100)}%` });
    setReport({ s, st, next, ok: passed(s) });
    setPhase('summary');
    const lines = [`Fine serie. Reazione ${s.rt != null ? `${s.rt} millisecondi` : 'non misurata'}, giuste ${Math.round(s.acc * 100)} per cento.`];
    if (st?.gain != null && st.gain > 0) lines.push(`Sei più veloce di ${st.gain} millisecondi rispetto alle prime serie.`);
    if (next) lines.push(`Esercizio superato: si apre ${next.name}.`);
    else if (!passed(s)) lines.push(s.early > 1 ? 'Troppe partenze anticipate: aspetta il segnale, non indovinarlo.' : 'Ripeti la serie: prima la scelta giusta, poi la velocità.');
    say(lines.join(' '), voiceRef.current);
  }, [drill, open]);

  const finishTrial = useCallback(() => {
    const c = cueRef.current, judge = judgeRef.current;
    if (!c || !judge) return;
    cueRef.current = null;
    const lagMs = cameraRef.current?.getStats?.().camLagMs || 0;
    const r = scoreTrial({ cue: c.cue, cueAt: c.at, frames: judge.frames(), gestures: judge.gestures(), aspect: aspectRef.current, lead: judge.lead, lagMs, answers: drillAnswers(drill) });
    hideFlash();
    // prova non valida (eri in movimento, non ti vedevo): si rifà, al massimo 2 volte di fila
    const invalid = r.status === 'restless' || r.status === 'noBase';
    if (invalid && redoRef.current < 2) redoRef.current += 1;
    else {
      redoRef.current = 0;
      trialsRef.current = [...trialsRef.current, r];
      idxRef.current += 1;
      setDone(trialsRef.current);
    }
    setLast(r); beep(GOOD.has(r.status));
    setPhase('feedback');
    later(() => {
      if (idxRef.current >= planRef.current.length) finishSeries();
      else { stillRef.current = { since: null, timer: null, armedAt: 0 }; setHint(''); setPhase('ready'); }
    }, 1300);
  }, [drill, finishSeries]);

  // fotogrammi dalla camera
  const onFrame = useCallback((points, t, aspect, world) => {
    const judge = judgeRef.current;
    const ph = phaseRef.current;
    if (!judge) return;
    if (ph === 'calibrate') {
      const read = readPose(points, world, { aspect, needFeet: feet });
      setFraming(read.hint); setCalib(readyRef.current.update(read.ok, t));
      if (read.ok && world?.length) judge.calibrate(world, points, aspect);
      if (readyRef.current.done && judge.isCalibrated()) {
        readyRef.current.reset();
        startedRef.current = performance.now();
        setPhase('ready');
        say('Pronto. Fermo in guardia: quando lo schermo si colora, rispondi.', voiceRef.current);
      }
      return;
    }
    if (!['ready', 'cue', 'feedback'].includes(ph) || !world?.length) return;
    if (!readPose(points, world, { aspect }).visible) {
      judge.abort();
      if (ph === 'ready') { clearTimeout(stillRef.current.timer); stillRef.current = { since: null, timer: null, armedAt: 0 }; setHint('Rientra nell’inquadratura'); }
      // uscito dall'inquadratura dopo il segnale: la prova si chiude lo stesso (lo schermo non resta colorato)
      const c = cueRef.current;
      if (ph === 'cue' && c && t > c.at + windowOf(c.cue) + 1200) finishTrial();
      return;
    }
    aspectRef.current = aspect;
    const info = judge.push(world, t, points, aspect);
    if (!info) return;
    const moving = info.activeKeys.length > 0;
    if (ph === 'ready') {
      const st = stillRef.current;
      // il segnale parte solo se sei fermo: muoverti durante l'attesa la fa ripartire (niente indovinare)
      if (moving) {
        if (st.timer) { clearTimeout(st.timer); setHint('Fermo… aspetta il segnale'); }
        stillRef.current = { since: null, timer: null, armedAt: 0 };
      } else if (st.since == null) st.since = t;
      else if (!st.timer && t - st.since > 500) {
        const fore = planRef.current[idxRef.current]?.foreMs ?? REFLEX.foreMin;
        st.timer = later(fireCue, fore); st.armedAt = t;
        setHint('');
      }
      return;
    }
    if (ph === 'cue') {
      const c = cueRef.current;
      if (!c) return;
      const win = windowOf(c.cue);
      // la prova finisce dopo la finestra di risposta, a gesto chiuso (al massimo 1,2 s in più)
      if (t > c.at + win && (judge.idle() || t > c.at + win + 1200)) finishTrial();
    }
  }, [feet, fireCue, finishTrial]);
  const camera = useMmaCamera(onFrame, { minInterval: 33, canSwap: () => !['cue', 'ready'].includes(phaseRef.current) });
  cameraRef.current = camera;

  const start = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* voce */ }
    try { const A = window.AudioContext || window.webkitAudioContext; if (A && !audioRef.current) audioRef.current = new A(); audioRef.current?.resume?.(); } catch { /* audio */ }
    judgeRef.current = createComboJudge({ stance, templates: loadTemplates(stance) });
    readyRef.current.reset();
    planRef.current = planTrials(drill); idxRef.current = 0; trialsRef.current = []; redoRef.current = 0;
    setDone([]); setLast(null); setReport(null); setCalib(0); hideFlash();
    setPhase('calibrate');
    say(feet ? 'Telefono a due o tre metri, corpo intero in inquadratura, mani in guardia.' : 'Telefono a due metri, dalla testa alle ginocchia in inquadratura, mani in guardia.', voice);
    camera.start(facing);
  };
  const again = () => {
    planRef.current = planTrials(drill); idxRef.current = 0; trialsRef.current = []; redoRef.current = 0;
    setDone([]); setLast(null); setReport(null); hideFlash();
    stillRef.current = { since: null, timer: null, armedAt: 0 };
    startedRef.current = performance.now();
    setPhase('ready');
  };
  const close = () => { timers.current.forEach(clearTimeout); camera.stop(); window.speechSynthesis?.cancel(); onClose(); };
  const mirrored = facing === 'user';
  const total = planRef.current.length || drill.trials;

  return createPortal(<div className="mma-train mma-reflex" role="dialog" aria-modal="true" aria-label={`Laboratorio riflessi: ${drill.name}`}>
    <header className="mma-train-head">
      <button className="mma-combo-icon" onClick={close} aria-label="Chiudi il laboratorio riflessi"><ArrowLeft size={20} /></button>
      <div><small>LABORATORIO RIFLESSI{phase !== 'setup' ? ` · ${Math.min(done.length, total)}/${total}` : ''}</small><h2>{drill.name}</h2></div>
      <button className="mma-combo-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    </header>

    {phase === 'setup' ? <section className="mma-train-setup">
      <p className="mma-reflex-intro">Lo schermo si colora e mostra un segno: rispondi il più in fretta possibile, con il colpo giusto. La camera misura quando parti, quanto ci mette il colpo e se hai scelto bene.</p>
      <div className="mma-reflex-drills" role="radiogroup" aria-label="Esercizio">{DRILLS.map((d, i) => {
        const locked = !open.includes(d.id), st = drillStats(history, d.id);
        return <button key={d.id} role="radio" aria-checked={drillId === d.id} disabled={locked} className={`${drillId === d.id ? 'active' : ''} ${locked ? 'locked' : ''}`} onClick={() => setDrillId(d.id)}>
          <span className="mma-reflex-no">{locked ? <Lock size={14} /> : st?.passed ? <Check size={14} /> : i + 1}</span>
          <span><b>{d.name}</b><small>{locked ? `Si apre superando «${DRILLS[i - 1].name}»` : d.what}</small>
            {st && <em>Ultima: reazione {ms(st.last.rt)} · giuste {Math.round(st.last.acc * 100)}%{st.best != null ? ` · record ${ms(st.best)}` : ''}</em>}</span>
        </button>;
      })}</div>
      <div className="mma-reflex-legend" aria-label="I segnali di questo esercizio">{Object.keys(drill.cues).map((c) => <span key={c}><i style={{ background: CUES[c].color }}>{CUES[c].sign}</i>{CUES[c].label}</span>)}</div>
      <h3>Dove mettere il telefono</h3>
      <MmaCameraSetup stance={stance} compact />
      <ol>
        <li>Telefono fermo all’altezza del petto, {feet ? 'a 2–3 metri: servono anche i piedi' : 'a 2 metri'}, <b>con lo schermo verso di te</b>: il segnale è lo schermo.</li>
        <li>Prima di ogni segnale stai <b>fermo in guardia</b>: se ti muovi, l’attesa riparte. L’attesa è casuale, non provare a indovinarla.</li>
        <li>Colpi leggeri e veloci, a vuoto, mai verso il telefono. Meglio da riposato: con la stanchezza i riflessi peggiorano.</li>
      </ol>
      <div className="mma-train-reps"><button className={facing === 'user' ? 'active' : ''} onClick={() => setFacing('user')}>Camera frontale</button><button className={facing === 'environment' ? 'active' : ''} onClick={() => setFacing('environment')}>Camera posteriore</button></div>
      <button className="mma-combo-done" onClick={start}><Video size={19} /> Avvia · {drill.trials} prove</button>
      <p className="mma-train-note">Quanto spesso: 10 minuti, 2–3 volte a settimana, da riposato (da stanco i tempi ballano). Negli studi così i riflessi migliorano davvero in poche settimane.</p>
      <p className="mma-train-note">Per orientarti: in laboratorio un adulto giovane reagisce a una luce in circa 220 ms; con il telefono si aggiungono circa 60 ms, quindi qui 280–300 ms è un buon tempo. Nei combattenti MMA misurati, reazione 266 ms e poi altri 115 ms per il movimento. Il video resta sul telefono; il ritardo della camera è uguale ogni volta, quindi i tuoi progressi sono veri, e se il telefono lo dichiara viene tolto.</p>
    </section> : <>
      <div className="mma-train-stage">
        <video ref={camera.videoRef} autoPlay muted playsInline style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} onClick={() => camera.videoRef.current?.play()} />
        <canvas ref={camera.canvasRef} style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />
        {camera.status !== 'ready' && camera.status !== 'error' && <div className="mma-train-overlay">{camera.status === 'permission' ? 'Consenti l’uso della fotocamera…' : 'Carico il riconoscimento del corpo…'}</div>}
        {camera.status === 'error' && <div className="mma-train-overlay error">{camera.error}<button onClick={start}>Riprova</button></div>}
        {phase === 'calibrate' && camera.status === 'ready' && <div className="mma-train-calib"><strong>{framing || 'Mettiti in guardia'}</strong><div role="progressbar" aria-valuenow={Math.round(calib * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${calib * 100}%` }} /></div></div>}
        {phase === 'ready' && <div className="mma-reflex-wait">{hint || 'Fermo in guardia…'}</div>}
        {phase === 'feedback' && last && <div className={`mma-reflex-verdict ${GOOD.has(last.status) ? 'good' : 'bad'}`}>
          {last.rt != null && last.status !== 'early' && <b>{last.rt} ms</b>}
          <span>{VERDICT[last.status]}{last.status === 'wrong' ? ` · era: ${CUES[last.cue].label}` : ''}</span>
          {last.mt != null && last.status === 'ok' && <small>colpo disteso in {last.mt} ms</small>}
        </div>}
      </div>
      {/* il segnale: copre lo schermo (colore + segno), acceso e spento senza passare da React */}
      <div ref={flashRef} className="mma-reflex-flash" data-on="0" aria-live="assertive" />

      {phase !== 'summary' && done.length > 0 && <div className="mma-reflex-dots" aria-label="Prove fatte">{done.map((r, i) => <i key={i} className={GOOD.has(r.status) ? 'good' : r.status === 'unread' ? 'skip' : 'bad'} title={`${i + 1}: ${VERDICT[r.status]}${r.rt != null ? ` · ${r.rt} ms` : ''}`} />)}</div>}

      {phase === 'summary' && report && <section className="mma-train-summary mma-reflex-summary">
        <small>FINE SERIE · {drill.name.toUpperCase()}</small>
        <h3>Reazione {ms(report.s.rt)}</h3>
        <div className="mma-reflex-grid">
          <div><small>Giuste</small><b>{Math.round(report.s.acc * 100)}%</b><span>{report.s.n} prove valide</span></div>
          <div><small>Record</small><b>{ms(report.s.best)}</b><span>{report.s.spread != null ? `costanza ±${Math.round(report.s.spread / 2)} ms` : 'servono più prove giuste'}</span></div>
          <div><small>Colpo disteso</small><b>{ms(report.s.mt)}</b><span>dalla partenza</span></div>
          <div><small>Segnale → colpo</small><b>{ms(report.s.total)}</b><span>quello che conta sul ring</span></div>
        </div>
        {(report.s.early > 0 || report.s.nogo > 0 || report.s.wrong > 0 || report.s.unread > 0) && <p>
          {report.s.early > 0 && <>Partenze anticipate: <b>{report.s.early}</b>. </>}
          {report.s.nogo > 0 && <>Sul ✋: fermo {report.s.nogo - report.s.bit} su {report.s.nogo}. </>}
          {report.s.wrong > 0 && <>Risposte sbagliate: <b>{report.s.wrong}</b>. </>}
          {report.s.unread > 0 && <>Colpi non letti (non contano): {report.s.unread}.</>}
        </p>}
        {report.st?.sessions > 1 && <p>Serie fatte: <b>{report.st.sessions}</b>{report.st.gain != null ? <> · rispetto alle prime: <b>{report.st.gain > 0 ? `${report.st.gain} ms più veloce` : report.st.gain < 0 ? `${-report.st.gain} ms più lento` : 'uguale'}</b></> : ''}.</p>}
        {report.next ? <p className="mma-train-applied"><b><Zap size={14} /> Esercizio superato!</b> Si apre «{report.next.name}»: {report.next.what}</p>
          : report.ok ? <p className="mma-train-applied"><b>✓ Superato.</b> Ora abbassa il tempo: stessa precisione, più veloce.</p>
            : <p className="mma-train-note">Per superarlo: almeno 8 prove valide, 8 su 10 giuste, al massimo una partenza anticipata.</p>}
        <p className="mma-train-note">{report.s.lagFixed ? 'Tolto il ritardo della camera dichiarato dal telefono.' : 'Il tempo include il ritardo della camera (uguale ogni volta): confrontalo con le tue serie, non con i numeri di laboratorio.'} Salvato nel diario allenamenti.</p>
        <div className="mma-train-actions"><button onClick={again}><RotateCcw size={16} /> Un’altra serie</button>{report.next && <button onClick={() => { setDrillId(report.next.id); setPhase('setup'); camera.stop(); }}><Zap size={16} /> Vai a {report.next.name}</button>}<button onClick={close}><Check size={16} /> Fine</button></div>
      </section>}
    </>}
  </div>, document.body);
}

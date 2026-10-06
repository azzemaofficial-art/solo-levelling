import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, RotateCcw, SkipForward, Video, Volume2, VolumeX } from 'lucide-react';
import useMmaCamera from '../hooks/useMmaCamera';
import MmaFigure, { useSkeletonPlayer } from './MmaFigure';
import MmaCameraSetup from './MmaCameraSetup';
import { createComboJudge, roleOf, teachSample } from '../../lib/mmaComboJudge';
import { createReadiness, readPose } from '../../lib/mmaReadiness';
import { TEACH_GROUPS, cameraCheck, loadTemplates, saveTemplates, selfCheck } from '../../lib/mmaTemplates';
import { encodeClip, readChatId, sendClips } from '../../lib/mmaClips';
import { MOVES, comboKeys } from '../data/mmaMoves';

// "Insegna i tuoi colpi" v2 — A COMANDO. Per ogni colpo, 3 volte:
//   guardia ferma → "VAI!" → vale solo il colpo del braccio giusto partito in quel momento
//   (il più ampio). Niente più esempi presi da mani che scendono o aggiustamenti
//   (era il difetto della v1 visto nelle clip del 5 ottobre).
// Gli esempi sono le TRAIETTORIE del pugno (motore 2D lib/mmaStrikes.js), salvate sul
// telefono; con il tuo consenso le clip dello scheletro (niente video) vanno al server.

const REPS = 3;
const CAPTURE_MS = 1600;   // finestra dopo il "VAI"
const STILL_MS = 600;      // guardia ferma prima del "VAI"
const STILL_DISP = 0.1;    // "ferma" = entrambi i pugni entro 0,1 busti dalla guardia
const say = (text, on) => {
  if (!on || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; u.rate = 1.05;
    const v = window.speechSynthesis.getVoices().find((x) => /^it/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* voce non disponibile */ }
};
const STANCE_KEY = 'shadow_monarch_mma_stance';
const readStance = () => { try { return localStorage.getItem(STANCE_KEY) === 'southpaw' ? 'southpaw' : 'orthodox'; } catch { return 'orthodox'; } };

function MoveDemo({ id, stance }) {
  const keys = useMemo(() => comboKeys([id], { lead: 300, tail: 500 }), [id]);
  const frame = useSkeletonPlayer({ keys, speed: 0.6, playing: true });
  return <MmaFigure frame={frame} stance={stance} caption="COSÌ" label={`Dimostrazione: ${MOVES[id].name}`} />;
}

export default function MmaTeach({ onClose, onDone, initialStance }) {
  const [stance, setStance] = useState(() => initialStance || readStance());
  const [groups, setGroups] = useState(() => TEACH_GROUPS.filter((g) => g.default).map((g) => g.id));
  const [facing, setFacing] = useState('user');
  const [share, setShare] = useState(true);
  const [voice, setVoice] = useState(true);
  const [phase, setPhase] = useState('setup'); // setup calibrate move done
  const [progress, setProgress] = useState(0), [hint, setHint] = useState('');
  const [step, setStep] = useState(0), [got, setGot] = useState(0);
  const [cue, setCue] = useState('wait'); // wait (torna in guardia) · go (VAI!) · ok · retry
  const [msg, setMsg] = useState('');
  const [meter, setMeter] = useState({ lead: 0, rear: 0 });
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]);
  const existing = useMemo(() => loadTemplates(stance), [stance]);
  const moves = useMemo(() => TEACH_GROUPS.filter((g) => groups.includes(g.id)).flatMap((g) => g.moves), [groups]);

  const judgeRef = useRef(null), readyRef = useRef(createReadiness({ holdMs: 1200 }));
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const L = useRef({ step: 0, got: 0, state: 'wait', stillSince: null, cueT: 0, items: [], clips: [], hintAt: 0, moves: [], lastUi: 0 });
  L.current.moves = queue;
  const voiceRef = useRef(voice); voiceRef.current = voice;
  const speak = useCallback((t) => say(t, voiceRef.current), []);
  const timers = useRef([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); window.speechSynthesis?.cancel(); }, []);

  const announce = useCallback((i) => {
    const id = L.current.moves[i];
    if (!id) return;
    speak(`${MOVES[id].name}, braccio ${roleOf(id) === 'lead' ? 'avanti' : 'dietro'}. Torna in guardia e aspetta il via.`);
  }, [speak]);

  const goTo = useCallback((i) => {
    const s = L.current;
    if (i >= s.moves.length) { setPhase('done'); phaseRef.current = 'done'; return; }
    Object.assign(s, { step: i, got: 0, state: 'wait', stillSince: null });
    setStep(i); setGot(0); setCue('wait'); setMsg('');
    announce(i);
  }, [announce]);

  // fine della finestra dopo il "VAI": il colpo più ampio del braccio giusto
  const judgeCapture = useCallback(() => {
    const s = L.current, judge = judgeRef.current, id = s.moves[s.step];
    const fresh = judge.gestures().filter((g) => g.limb === 'arm' && g.start >= s.cueT - 150 && g.start <= s.cueT + CAPTURE_MS);
    const mine = fresh.map((g) => ({ g, sample: teachSample(id, g) })).filter((x) => x.sample && x.g.kind !== 'drop').sort((a, b) => b.sample.reach - a.sample.reach);
    const best = mine[0];
    if (best && best.sample.reach >= 0.16) {
      s.items = [...s.items, best.sample];
      s.clips.push(encodeClip(judge.frames(), { from: s.cueT - 400, to: best.g.end + 300, move: id, stance, kind: 'teach', cueMs: 400, reach: best.sample.reach }));
      s.got += 1; setGot(s.got); setItems(s.items);
      if (s.got >= REPS) { s.state = 'next'; setCue('ok'); speak('Perfetto.'); timers.current.push(setTimeout(() => goTo(s.step + 1), 900)); return; }
      s.state = 'wait'; s.stillSince = null; setCue('ok'); setMsg(''); speak(['Uno.', 'Due.'][s.got - 1] || 'Bene.');
      return;
    }
    const other = fresh.find((g) => g.side !== roleOf(id) && g.kind !== 'drop' && g.reach >= 0.16);
    s.state = 'wait'; s.stillSince = null; setCue('retry');
    const text = other ? `Hai usato il braccio ${other.side === 'lead' ? 'avanti' : 'dietro'}: usa quello ${roleOf(id) === 'lead' ? 'avanti' : 'dietro'}.`
      : 'Non l’ho visto. Colpo deciso, verso il bersaglio davanti a te, non verso il telefono.';
    setMsg(text); speak(text);
  }, [stance, speak, goTo]);

  const onFrame = useCallback((points, t, aspect, world) => {
    const judge = judgeRef.current, ph = phaseRef.current, s = L.current;
    if (!judge) return;
    if (ph === 'calibrate') {
      const read = readPose(points, world, { aspect });
      setProgress(readyRef.current.update(read.ok, t)); setHint(read.hint);
      const now = performance.now();
      if (!read.ok && now - s.hintAt > 4000) { s.hintAt = now; speak(read.hint); }
      if (read.ok && world?.length) judge.calibrate(world, points, aspect);
      if (readyRef.current.done && judge.isCalibrated() && judge.engine.isCalibrated()) { setPhase('move'); phaseRef.current = 'move'; goTo(0); }
      return;
    }
    if (ph !== 'move' || !world?.length) return;
    if (!readPose(points, world, { aspect }).visible) { judge.abort(); s.stillSince = null; return; }
    const info = judge.push(world, t, points, aspect);
    if (!info) return;
    if (t - s.lastUi > 80) { s.lastUi = t; setMeter(info.armDisp); }
    if (s.state === 'wait') {
      // guardia ferma per 0,6 s → "VAI!"
      const still = !info.activeKeys.some((k) => k.endsWith('Arm')) && info.armDisp.lead < STILL_DISP && info.armDisp.rear < STILL_DISP;
      s.stillSince = still ? (s.stillSince ?? t) : null;
      if (s.stillSince != null && t - s.stillSince >= STILL_MS) { s.state = 'go'; s.cueT = t; setCue('go'); setMsg(''); speak('Vai!'); }
    } else if (s.state === 'go' && ((t - s.cueT >= CAPTURE_MS && judge.idle()) || t - s.cueT >= CAPTURE_MS + 1200)) {
      judgeCapture(); // (se il colpo non si è chiuso in tempo si giudica comunque)
    }
  }, [speak, goTo, judgeCapture]);
  const camera = useMmaCamera(onFrame, { minInterval: 33, canSwap: () => phaseRef.current !== 'move' });

  const start = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* sblocca la voce su iPhone */ }
    try { localStorage.setItem(STANCE_KEY, stance); } catch { /* storage */ }
    judgeRef.current = createComboJudge({ stance });
    readyRef.current.reset();
    L.current = { ...L.current, step: 0, got: 0, state: 'wait', stillSince: null, items: [], clips: [], hintAt: 0, moves };
    setQueue(moves); setItems([]); setProgress(0); setPhase('calibrate');
    speak('Metti il telefono di lato, come nello schema, allontanati di due metri e mettiti in guardia.');
    camera.start(facing);
  };
  const skip = () => goTo(L.current.step + 1);
  const redo = (id) => {
    L.current.items = L.current.items.filter((it) => it.move !== id);
    setItems(L.current.items);
    L.current.moves = [id]; setQueue([id]);
    camera.start(facing);
    setPhase('move'); phaseRef.current = 'move'; goTo(0);
  };

  // fine: salva (uniti a quelli di prima per i colpi non rifatti) e manda le clip
  const check = useMemo(() => (phase === 'done' ? selfCheck({ items }) : null), [phase, items]);
  const cam = useMemo(() => (phase === 'done' ? cameraCheck([...(existing?.items || []).filter((it) => !items.some((x) => x.move === it.move)), ...items]) : null), [phase, items, existing]);
  useEffect(() => {
    if (phase !== 'done') return;
    camera.stop();
    const taught = new Set(items.map((it) => it.move));
    const merged = [...(existing?.items || []).filter((it) => !taught.has(it.move)), ...items];
    if (merged.length) saveTemplates({ stance, at: new Date().toISOString(), items: merged });
    const acc = check?.accuracy;
    speak(cam && !cam.ok ? 'Fatto. Ma i tuoi colpi si vedono poco: sposta il telefono di lato e rifai l’insegnamento.' : acc == null ? 'Fatto. Ho imparato i tuoi colpi.' : `Fatto. Riconosco i tuoi colpi al ${Math.round(acc * 100)} per cento.`);
    if (share) { const clips = L.current.clips; L.current.clips = []; sendClips(clips, { chatId: readChatId(), kind: 'teach' }); }
    onDone?.();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { camera.stop(); window.speechSynthesis?.cancel(); onClose(); };
  const id = queue[step];
  const mirrored = facing === 'user';
  const taughtMoves = [...new Set(items.map((it) => it.move))];
  const want = id ? roleOf(id) : null;

  return createPortal(<div className="mma-train mma-teach" role="dialog" aria-modal="true" aria-label="Insegna i tuoi colpi al coach">
    <header className="mma-train-head">
      <button className="mma-combo-icon" onClick={close} aria-label="Chiudi"><ArrowLeft size={20} /></button>
      <div><small>IL COACH IMPARA I TUOI COLPI{phase === 'move' ? ` · ${step + 1}/${queue.length}` : ''}</small><h2>{phase === 'move' && id ? MOVES[id].name : phase === 'done' ? 'Fatto' : 'Insegna i tuoi colpi'}</h2></div>
      <button className="mma-combo-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    </header>

    {phase === 'setup' && <section className="mma-train-setup">
      <p className="mma-teach-lead">Il coach ti dice <b>“VAI!”</b> e tu tiri il colpo: <b>3 volte ogni colpo</b>. Da lì riconosce <b>te</b>. Circa {Math.max(2, Math.round(moves.length * 3 * 3.5 / 60))} minuti.</p>
      <MmaCameraSetup stance={stance} />
      {existing && <p className="mma-train-note">Hai già {new Set(existing.items.map((it) => it.move)).size} colpi insegnati: quelli che rifai vengono sostituiti, gli altri restano.</p>}
      <div className="mma-train-reps" role="group" aria-label="Cosa insegnare">{TEACH_GROUPS.map((g) => <button key={g.id} aria-pressed={groups.includes(g.id)} className={groups.includes(g.id) ? 'active' : ''} onClick={() => setGroups((prev) => (prev.includes(g.id) ? (prev.length > 1 ? prev.filter((x) => x !== g.id) : prev) : [...prev, g.id]))}>{g.label} · {g.moves.length}</button>)}</div>
      <div className="mma-train-reps" role="radiogroup" aria-label="Guardia">{[['orthodox', 'Sinistro avanti'], ['southpaw', 'Destro avanti']].map(([v, l]) => <button key={v} role="radio" aria-checked={stance === v} className={stance === v ? 'active' : ''} onClick={() => setStance(v)}>{l}</button>)}</div>
      <div className="mma-train-reps"><button className={facing === 'user' ? 'active' : ''} onClick={() => setFacing('user')}>Camera frontale</button><button className={facing === 'environment' ? 'active' : ''} onClick={() => setFacing('environment')}>Camera posteriore</button></div>
      <ol>
        <li>Telefono come nello schema, <b>fermo</b>, all’altezza del petto.</li>
        <li>Aspetta il <b>“VAI!”</b>: tira <b>un solo colpo</b>, completo, e torna in guardia.</li>
        <li>Stessa posizione e stesso angolo in cui poi farai le combo.</li>
      </ol>
      <label className="mma-teach-share"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /><span>Invia i movimenti per migliorare il coach: solo i punti dello scheletro, <b>niente video</b>.</span></label>
      <button className="mma-combo-done" onClick={start}><Video size={19} /> Inizia</button>
    </section>}

    {phase !== 'setup' && phase !== 'done' && <>
      <div className="mma-train-stage">
        <video ref={camera.videoRef} autoPlay muted playsInline style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} onClick={() => camera.videoRef.current?.play()} />
        <canvas ref={camera.canvasRef} style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />
        {camera.status !== 'ready' && camera.status !== 'error' && <div className="mma-train-overlay">{camera.status === 'permission' ? 'Consenti l’uso della fotocamera…' : 'Carico il riconoscimento del corpo…'}</div>}
        {camera.status === 'error' && <div className="mma-train-overlay error">{camera.error}<button onClick={start}>Riprova</button></div>}
        {phase === 'calibrate' && camera.status === 'ready' && <div className="mma-train-calib"><strong>{hint || 'Mettiti in guardia'}</strong><div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress * 100}%` }} /></div></div>}
        {phase === 'move' && id && <div className="mma-teach-ghost"><MoveDemo id={id} stance={stance} /></div>}
        {phase === 'move' && <div className="mma-teach-count" aria-live="polite">{Array.from({ length: REPS }, (_, i) => <i key={i} className={i < got ? 'on' : ''} />)}</div>}
        {phase === 'move' && cue === 'go' && <div className="mma-teach-go" aria-live="assertive">VAI!</div>}
        {phase === 'move' && <div className="mma-teach-meter" aria-hidden="true">{['lead', 'rear'].map((arm) => <div key={arm} className={arm === want ? 'want' : ''}><small>{arm === 'lead' ? 'AVANTI' : 'DIETRO'}</small><span><i style={{ transform: `scaleY(${Math.min(1, (meter[arm] || 0) / 0.6)})` }} /></span></div>)}</div>}
      </div>
      {phase === 'move' && id && <div className="mma-teach-bar">
        <p className={cue === 'retry' ? 'mma-teach-stuck' : ''}>{cue === 'go' ? 'Adesso: un colpo!' : cue === 'retry' ? msg : got > 0 && cue === 'ok' ? 'Preso. Torna in guardia e aspetta il via.' : `Torna in guardia e resta fermo: al “VAI!” tira ${MOVES[id].name.toLowerCase()} col braccio ${want === 'lead' ? 'avanti' : 'dietro'}.`}</p>
        <p className="mma-train-note">{MOVES[id].cue}</p>
        <button onClick={skip}><SkipForward size={16} /> Salta questo colpo</button>
      </div>}
    </>}

    {phase === 'done' && <section className="mma-train-summary">
      <small>IL COACH TI CONOSCE</small>
      <h3>{taughtMoves.length} colpi imparati</h3>
      {cam && !cam.ok && <div className="mma-teach-warn"><b>I tuoi colpi si vedono poco</b> (ampiezza {cam.median?.toFixed(2)}): quasi sicuramente stai colpendo <b>verso il telefono</b>. Spostalo di lato come nello schema e rifai l’insegnamento.<MmaCameraSetup stance={stance} compact /></div>}
      {check?.accuracy != null && <p>Li distinguo tra loro al <b>{Math.round(check.accuracy * 100)}%</b>{check.accuracy >= 0.9 ? ': ottimo.' : '.'}</p>}
      {check?.confusions?.slice(0, 2).map(({ pair }) => <p key={pair.join()} className="mma-train-note">{MOVES[pair[0]].name} e {MOVES[pair[1]].name} si somigliano da questa posizione: rifai il secondo più marcato. <button className="mma-teach-redo" onClick={() => redo(pair[1])}><RotateCcw size={14} /> Rifai {MOVES[pair[1]].name}</button></p>)}
      <p className="mma-train-note">Salvato sul telefono. Nelle combo e nel Coach Studio adesso il coach riconosce i tuoi colpi.{share ? ' Clip dello scheletro inviate.' : ''}</p>
      <div className="mma-train-actions"><button onClick={close}><Check size={16} /> Fine</button></div>
    </section>}
  </div>, document.body);
}

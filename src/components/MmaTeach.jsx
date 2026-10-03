import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, RotateCcw, SkipForward, Video, Volume2, VolumeX } from 'lucide-react';
import useMmaCamera from '../hooks/useMmaCamera';
import MmaFigure, { useSkeletonPlayer } from './MmaFigure';
import { createComboJudge, describeGesture, limbOf, roleOf, teachSample } from '../../lib/mmaComboJudge';
import { createReadiness, readPose } from '../../lib/mmaReadiness';
import { TEACH_GROUPS, loadTemplates, saveTemplates, selfCheck } from '../../lib/mmaTemplates';
import { encodeClip, readChatId, sendClips } from '../../lib/mmaClips';
import { MOVES, comboKeys } from '../data/mmaMoves';

// "Insegna i tuoi colpi": il coach ti guarda fare 3 volte ogni colpo e da lì in poi
// riconosce TE (corpo, camera, angolo, velocità) invece di soglie fisse.
// Esempi salvati sul telefono; con il tuo consenso le clip dello scheletro (niente video)
// vanno al server per tarare il coach su movimenti veri.

const REPS = 3;
const say = (text, on) => {
  if (!on || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; u.rate = 1.02;
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
  const [step, setStep] = useState(0), [got, setGot] = useState(0), [stuck, setStuck] = useState(false), [flash, setFlash] = useState(null);
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]); // colpi di questa sessione (o solo quello da rifare)
  const existing = useMemo(() => loadTemplates(stance), [stance]);
  const moves = useMemo(() => TEACH_GROUPS.filter((g) => groups.includes(g.id)).flatMap((g) => g.moves), [groups]);

  const judgeRef = useRef(null), readyRef = useRef(createReadiness({ holdMs: 1200 }));
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const live = useRef({ step: 0, got: 0, seen: 0, stepAt: 0, items: [], clips: [], wrongAt: 0, hintAt: 0, moves: [] });
  live.current.moves = queue;
  const voiceRef = useRef(voice); voiceRef.current = voice;
  const speak = useCallback((t) => say(t, voiceRef.current), []);
  const timers = useRef([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); window.speechSynthesis?.cancel(); }, []);

  const announce = useCallback((i) => {
    const id = live.current.moves[i];
    if (!id) return;
    const side = roleOf(id) === 'lead' ? 'avanti' : 'dietro';
    speak(`${MOVES[id].name}, ${limbOf(id) === 'leg' ? 'gamba' : 'braccio'} ${side}. Fanne tre, con calma, tornando in guardia ogni volta.`);
  }, [speak]);

  const goTo = useCallback((i) => {
    const L = live.current;
    if (i >= L.moves.length) { setPhase('done'); return; }
    L.step = i; L.got = 0; L.stepAt = performance.now(); L.seen = judgeRef.current?.gestures().length || 0;
    setStep(i); setGot(0); setStuck(false);
    announce(i);
  }, [announce]);

  const onFrame = useCallback((points, t, aspect, world) => {
    const judge = judgeRef.current, ph = phaseRef.current, L = live.current;
    if (!judge) return;
    if (ph === 'calibrate') {
      const read = readPose(points, world, { aspect, needFeet: groups.includes('kicks') });
      setProgress(readyRef.current.update(read.ok, t)); setHint(read.hint);
      const now = performance.now();
      if (!read.ok && now - L.hintAt > 4000) { L.hintAt = now; speak(read.hint); }
      if (read.ok && world?.length) judge.calibrate(world, points, aspect);
      if (readyRef.current.done && judge.isCalibrated()) { setPhase('move'); phaseRef.current = 'move'; goTo(0); }
      return;
    }
    if (ph !== 'move' || !world?.length) return;
    if (!readPose(points, world, { aspect }).visible) { judge.abort(); return; }
    const info = judge.push(world, t, points, aspect);
    if (!info || info.gestures <= L.seen) {
      if (L.got === 0 && performance.now() - L.stepAt > 14000) setStuck(true);
      return;
    }
    const id = L.moves[L.step];
    const fresh = judge.gestures().slice(L.seen); L.seen = info.gestures;
    for (const g of fresh) {
      if (L.got < 0) break; // colpo già completato: si aspetta il prossimo
      const sample = teachSample(id, g);
      if (!sample) {
        // colpo dell'altro braccio/gamba: aiuta senza contare
        if ((g.limb === 'arm' || g.limb === 'leg') && g.kind !== 'drop' && performance.now() - L.wrongAt > 4000) {
          L.wrongAt = performance.now();
          const want = `${limbOf(id) === 'leg' ? 'la gamba' : 'il braccio'} ${roleOf(id) === 'lead' ? 'avanti' : 'dietro'}`;
          speak(`Quello era ${g.limb === 'leg' ? 'la gamba' : 'il braccio'} ${g.side === 'lead' ? 'avanti' : 'dietro'}. Usa ${want}.`);
          setFlash({ ok: false, text: describeGesture(g), n: Date.now() });
        }
        continue;
      }
      L.items = [...L.items.filter((it) => !(it.move === id && it.redo)), sample];
      L.clips.push(encodeClip(judge.frames(), { from: g.start - 250, to: g.end + 250, move: id, stance, kind: 'teach' }));
      L.got += 1; setGot(L.got); setFlash({ ok: true, text: `${L.got}`, n: Date.now() });
      setItems(L.items);
      if (L.got >= REPS) {
        speak(L.step + 1 < L.moves.length ? 'Perfetto.' : 'Finito!');
        timers.current.push(setTimeout(() => goTo(L.step + 1), 900));
        L.got = -99; // non contare altro finché non cambia colpo
      } else speak(['Uno.', 'Due.'][L.got - 1] || 'Bene.');
    }
  }, [groups, stance, speak, goTo]);
  const camera = useMmaCamera(onFrame, { minInterval: 33, canSwap: () => phaseRef.current !== 'move' });

  const start = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* sblocca la voce su iPhone */ }
    try { localStorage.setItem(STANCE_KEY, stance); } catch { /* storage */ }
    judgeRef.current = createComboJudge({ stance });
    readyRef.current.reset();
    live.current = { ...live.current, step: 0, got: 0, seen: 0, items: [], clips: [], wrongAt: 0, hintAt: 0 };
    live.current.moves = moves; setQueue(moves);
    setItems([]); setProgress(0); setPhase('calibrate');
    speak(`Appoggia il telefono, allontanati${groups.includes('kicks') ? ' di due o tre metri' : ''} e mettiti in guardia, di tre quarti.`);
    camera.start(facing);
  };
  const skip = () => { live.current.got = -99; goTo(live.current.step + 1); };
  const redo = (id) => {
    live.current.items = live.current.items.filter((it) => it.move !== id);
    setItems(live.current.items);
    // si rifà solo quel colpo, poi si torna al riepilogo
    live.current.moves = [id]; setQueue([id]);
    camera.start(facing);
    setPhase('move'); phaseRef.current = 'move'; goTo(0);
  };

  // fine: salva gli esempi (uniti a quelli di prima per i colpi non rifatti) e manda le clip
  const check = useMemo(() => (phase === 'done' ? selfCheck({ items }) : null), [phase, items]);
  useEffect(() => {
    if (phase !== 'done') return;
    camera.stop();
    const taught = new Set(items.map((it) => it.move));
    const merged = [...(existing?.items || []).filter((it) => !taught.has(it.move)), ...items];
    saveTemplates({ stance, at: new Date().toISOString(), items: merged });
    const acc = check?.accuracy;
    speak(acc == null ? 'Fatto. Ho imparato i tuoi colpi.' : `Fatto. Riconosco i tuoi colpi al ${Math.round(acc * 100)} per cento.`);
    if (share) { const clips = live.current.clips; live.current.clips = []; sendClips(clips, { chatId: readChatId(), kind: 'teach' }); }
    onDone?.();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { camera.stop(); window.speechSynthesis?.cancel(); onClose(); };
  const id = queue[step];
  const mirrored = facing === 'user';
  const taughtMoves = [...new Set(items.map((it) => it.move))];

  return createPortal(<div className="mma-train mma-teach" role="dialog" aria-modal="true" aria-label="Insegna i tuoi colpi al coach">
    <header className="mma-train-head">
      <button className="mma-combo-icon" onClick={close} aria-label="Chiudi"><ArrowLeft size={20} /></button>
      <div><small>IL COACH IMPARA I TUOI COLPI{phase === 'move' ? ` · ${step + 1}/${queue.length}` : ''}</small><h2>{phase === 'move' && id ? MOVES[id].name : phase === 'done' ? 'Fatto' : 'Insegna i tuoi colpi'}</h2></div>
      <button className="mma-combo-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    </header>

    {phase === 'setup' && <section className="mma-train-setup">
      <p className="mma-teach-lead">Fai <b>3 volte ogni colpo</b> davanti alla camera: da lì il coach riconosce <b>te</b>, con il tuo corpo, la tua velocità e la tua angolazione. Circa {Math.max(1, Math.round(moves.length * 12 / 60))} minuti.</p>
      {existing && <p className="mma-train-note">Hai già {new Set(existing.items.map((it) => it.move)).size} colpi insegnati: quelli che rifai vengono sostituiti, gli altri restano.</p>}
      <div className="mma-train-reps" role="group" aria-label="Cosa insegnare">{TEACH_GROUPS.map((g) => <button key={g.id} aria-pressed={groups.includes(g.id)} className={groups.includes(g.id) ? 'active' : ''} onClick={() => setGroups((prev) => (prev.includes(g.id) ? (prev.length > 1 ? prev.filter((x) => x !== g.id) : prev) : [...prev, g.id]))}>{g.label} · {g.moves.length}</button>)}</div>
      <div className="mma-train-reps" role="radiogroup" aria-label="Guardia">{[['orthodox', 'Sinistro avanti'], ['southpaw', 'Destro avanti']].map(([v, l]) => <button key={v} role="radio" aria-checked={stance === v} className={stance === v ? 'active' : ''} onClick={() => setStance(v)}>{l}</button>)}</div>
      <div className="mma-train-reps"><button className={facing === 'user' ? 'active' : ''} onClick={() => setFacing('user')}>Camera frontale</button><button className={facing === 'environment' ? 'active' : ''} onClick={() => setFacing('environment')}>Camera posteriore</button></div>
      <ol>
        <li>Telefono fermo all’altezza del petto, tu a {groups.includes('kicks') ? '2–3' : '1,5–2'} metri.</li>
        <li><b>Di tre quarti</b>, come starai durante le combo: il coach impara proprio quell’angolo.</li>
        <li>Colpi completi e tornando in guardia, alla tua velocità normale.</li>
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
        {flash && <div key={flash.n} className={`mma-teach-flash ${flash.ok ? 'ok' : 'no'}`}>{flash.ok ? <Check size={30} /> : flash.text}</div>}
      </div>
      {phase === 'move' && id && <div className="mma-teach-bar">
        <p>{MOVES[id].cue}</p>
        {stuck && <p className="mma-teach-stuck">Non lo vedo ancora: colpo più ampio, resta di tre quarti e torna in guardia tra uno e l’altro.</p>}
        <button onClick={skip}><SkipForward size={16} /> Salta</button>
      </div>}
    </>}

    {phase === 'done' && <section className="mma-train-summary">
      <small>IL COACH TI CONOSCE</small>
      <h3>{taughtMoves.length} colpi imparati</h3>
      {check?.accuracy != null && <p>Li distinguo tra loro al <b>{Math.round(check.accuracy * 100)}%</b>{check.accuracy >= 0.9 ? ': ottimo.' : '.'}</p>}
      {check?.confusions?.slice(0, 2).map(({ pair }) => <p key={pair.join()} className="mma-train-note">{MOVES[pair[0]].name} e {MOVES[pair[1]].name} si somigliano: rifai il secondo più marcato. <button className="mma-teach-redo" onClick={() => redo(pair[1])}><RotateCcw size={14} /> Rifai {MOVES[pair[1]].name}</button></p>)}
      <p className="mma-train-note">Salvato sul telefono. Nelle combo e nel Coach Studio adesso il coach riconosce i tuoi colpi; un movimento che non somiglia a nessuno non viene più contato come colpo in più.{share ? ' Clip dello scheletro inviate.' : ''}</p>
      <div className="mma-train-actions"><button onClick={close}><Check size={16} /> Fine</button></div>
    </section>}
  </div>, document.body);
}

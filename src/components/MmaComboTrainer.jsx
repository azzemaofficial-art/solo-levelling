import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Flag, GraduationCap, Pause, Play, RotateCcw, Video, Volume2, VolumeX, X } from 'lucide-react';
import useMmaCamera from '../hooks/useMmaCamera';
import MmaFigure, { useSkeletonPlayer } from './MmaFigure';
import { createReadiness, readPose } from '../../lib/mmaReadiness';
import { coachFeedback, createComboJudge, describeGesture, needsFeet, teachSample, EXPECT } from '../../lib/mmaComboJudge';
import { forgetRep, learnFromRep, loadTemplates, saveTemplates } from '../../lib/mmaTemplates';
import { encodeClip, readChatId, sendClips } from '../../lib/mmaClips';
import MmaCameraSetup from './MmaCameraSetup';

const MmaTeach = lazy(() => import('./MmaTeach'));
import { MOVES, comboKeys } from '../data/mmaMoves';
import { localDateKey, logWorkout } from '../utils/trainingLog';

// Coach con camera sulla combo scelta: calibra la tua guardia, ti mostra la combo,
// ti guarda eseguirla colpo per colpo (MediaPipe sul telefono, niente upload) e ti
// corregge a voce, con replay al rallentatore. Logica di giudizio: lib/mmaComboJudge.js.

const say = (text, on) => {
  if (!on || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; u.rate = 1; u.pitch = 1;
    const v = window.speechSynthesis.getVoices().find((x) => /^it/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* voce non disponibile */ }
};

const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

// Replay al rallentatore dei punti 2D registrati, con i punti in cui hai sbagliato.
function ReplayCanvas({ frames, marks, mirrored, speed = 0.3 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!frames.length) return undefined;
    const canvas = ref.current; const ctx = canvas.getContext('2d');
    const W = canvas.width = 540; const H = canvas.height = 400;
    const t0 = frames[0].t; const total = frames[frames.length - 1].t - t0 + 600;
    let raf; const start = performance.now();
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const vt = ((now - start) * speed) % total;
      let f = frames[0];
      for (const fr of frames) { if (fr.t - t0 <= vt) f = fr; else break; }
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (mirrored) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      const pt = (p) => [p.x * W, p.y * H];
      ctx.lineCap = 'round';
      for (const [a, b] of EDGES) {
        const A = f.points?.[a], B = f.points?.[b];
        if (!A || !B || (A.visibility ?? 1) < 0.5 || (B.visibility ?? 1) < 0.5) continue;
        ctx.strokeStyle = [13, 15].includes(b) ? '#6de2d3' : [14, 16].includes(b) ? '#b8a4ff' : '#9fb4c8';
        ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...pt(A)); ctx.lineTo(...pt(B)); ctx.stroke();
      }
      const nose = f.points?.[0];
      if (nose) { ctx.fillStyle = '#c6d3e0'; ctx.beginPath(); ctx.arc(...pt(nose), 13, 0, Math.PI * 2); ctx.fill(); }
      for (const mk of marks) {
        const dt = Math.abs(f.t - mk.t);
        if (dt > 260) continue;
        const p = f.points?.[mk.joint]; if (!p) continue;
        ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 4; ctx.globalAlpha = 1 - dt / 260;
        ctx.beginPath(); ctx.arc(...pt(p), 24, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.restore();
      const active = marks.find((mk) => Math.abs(f.t - mk.t) <= 260);
      if (active) {
        ctx.fillStyle = '#1b0f16e6'; ctx.fillRect(12, H - 58, W - 24, 44);
        ctx.fillStyle = '#ffc9c9'; ctx.font = '600 17px system-ui'; ctx.fillText(active.text.slice(0, 52), 24, H - 30);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frames, marks, mirrored, speed]);
  return <canvas ref={ref} className="mma-train-replay-canvas" aria-label="Replay al rallentatore" />;
}

function GhostDemo({ combo, speed }) {
  const keys = useMemo(() => comboKeys(combo.moves), [combo]);
  const frame = useSkeletonPlayer({ keys, speed, playing: true });
  return <MmaFigure frame={frame} caption="MAESTRO" label="Dimostrazione della combo" />;
}

const MOVE_JOINT = (id, lead, rear) => {
  const e = EXPECT[id] || {};
  const S = e.side === 'rear' ? rear : lead;
  const idx = { L: { arm: 15, leg: 27 }, R: { arm: 16, leg: 28 } }[S];
  return ['kick', 'teep', 'knee', 'check'].includes(e.kind) ? idx.leg : idx.arm;
};

export default function MmaComboTrainer({ combo, onClose, onLearned }) {
  const moves = combo.moves;
  const moveNames = moves.map((id) => MOVES[id].name);
  const feet = needsFeet(moves);
  const guided = moves.filter((id) => EXPECT[id]?.kind === 'guided');
  const [stance] = useState(() => { try { return localStorage.getItem('shadow_monarch_mma_stance') || 'orthodox'; } catch { return 'orthodox'; } });
  const [facing, setFacing] = useState('user');
  const [reps, setReps] = useState(6);
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem('shadow_monarch_coach_voice') !== '0'; } catch { return true; } });
  const [phase, setPhase] = useState('setup'); // setup calibrate demo countdown go result summary
  const [count, setCount] = useState(3);
  const [calib, setCalib] = useState(0);
  const [framing, setFraming] = useState('');
  const [live, setLive] = useState([]);           // stato dei colpi durante l'esecuzione
  const [results, setResults] = useState([]);     // una voce per ripetizione
  const [current, setCurrent] = useState(null);   // ultimo risultato
  const [replay, setReplay] = useState(null);
  const [paused, setPaused] = useState(false);
  const [templates, setTemplates] = useState(() => loadTemplates(stance));
  const [teachOpen, setTeachOpen] = useState(false);
  const [label, setLabel] = useState(null); // ultimo colpo letto, mostrato sulla camera
  const [reported, setReported] = useState(false);
  const judgeRef = useRef(createComboJudge({ stance, templates }));
  const templatesRef = useRef(templates); templatesRef.current = templates;
  // nuovi esempi tuoi (da una combo riuscita, o tolti dopo "Il coach ha sbagliato"): salvati e subito in uso
  const applyTemplates = useCallback((t) => {
    if (!t || t === templatesRef.current || !saveTemplates(t)) return;
    templatesRef.current = t; setTemplates(t); judgeRef.current.setTemplates(t);
  }, []);
  const readyRef = useRef(createReadiness()), hintRef = useRef({ text: '', at: 0 });
  // riferimento stabile: il genitore può ridisegnarsi spesso, non deve azzerare i timer
  const onLearnedRef = useRef(onLearned); onLearnedRef.current = onLearned;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const repRef = useRef({ start: 0, lastActive: 0, lastLive: 0 });
  const timers = useRef([]);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; };
  useEffect(() => () => { timers.current.forEach(clearTimeout); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { try { localStorage.setItem('shadow_monarch_coach_voice', voice ? '1' : '0'); } catch { /* storage */ } }, [voice]);

  const finishRep = useCallback(() => {
    if (phaseRef.current !== 'go') return;
    const judge = judgeRef.current;
    const t0 = repRef.current.start;
    // vale anche un colpo partito un attimo prima del "via"
    const res = judge.judgeRep(moves, { since: t0 - 700 });
    const frames = judge.frames().filter((f) => f.t >= t0 - 200);
    const marks = res.moves.flatMap((mv) => (mv.gesture && mv.issues.length ? [{ t: mv.gesture.peakT ?? mv.gesture.start, joint: MOVE_JOINT(mv.id, judge.lead, judge.rear), text: `${MOVES[mv.id].name}: ${mv.issues[0].text}` }] : []));
    const rep = Date.now();
    const entry = { ...res, rep, frames, marks, feedback: coachFeedback(res, moveNames), seen: judge.gestures().filter((g) => g.start >= t0 - 700).map((g) => g.move || describeGesture(g)) };
    // combo riuscita: i colpi riconosciuti diventano tuoi esempi in più (il coach impara mentre ti alleni)
    applyTemplates(learnFromRep(templatesRef.current, res, { rep, sample: teachSample }));
    setCurrent(entry); setReported(false);
    setResults((prev) => [...prev, entry]);
    setPhase('result');
    say(entry.feedback, voice);
  }, [moves, moveNames, voice, applyTemplates]);

  // fotogrammi dalla camera
  const onFrame = useCallback((points, t, aspect, world) => {
    const judge = judgeRef.current;
    const ph = phaseRef.current;
    if (ph === 'calibrate') {
      // tollerante: guardia in 3D, mano dietro coperta ok, la barra non si azzera per un fotogramma
      const read = readPose(points, world, { aspect, needFeet: feet });
      const progress = readyRef.current.update(read.ok, t);
      setFraming(read.hint); setCalib(progress);
      const now = performance.now();
      if (!read.ok && (read.hint !== hintRef.current.text ? now - hintRef.current.at > 2500 : now - hintRef.current.at > 7000)) { hintRef.current = { text: read.hint, at: now }; say(read.hint, voice); }
      if (read.ok && world?.length) judge.calibrate(world, points, aspect);
      if (readyRef.current.done && judge.isCalibrated()) {
        readyRef.current.reset();
        setPhase('demo');
        say(`Guarda la combo: ${combo.name}.`, voice);
        later(() => { setPhase('countdown'); setCount(3); say('Tre. Due. Uno. Via!', voice); }, Math.max(3200, moves.length * 1100));
      }
      return;
    }
    if (ph !== 'go' || !world?.length) return;
    if (!readPose(points, world, { aspect }).visible) {
      judge.abort();
      if (t - repRef.current.start > 2600 + moves.length * 1100) finishRep();
      return;
    }
    const before = judge.gestures().length;
    const info = judge.push(world, t, points, aspect);
    if (!info) return;
    if (info.activeKeys.length) repRef.current.lastActive = t;
    if (info.gestures > before) {
      const g = judge.gestures().at(-1);
      // colpo di braccio senza tipo deciso: si dice quale braccio (è quello che conta nella combo)
      if (g.kind !== 'drop') setLabel({ text: g.move ? MOVES[g.move]?.name || describeGesture(g) : g.kind === 'strike' ? `Braccio ${g.side === 'lead' ? 'avanti' : 'dietro'}` : describeGesture(g), unclear: g.kind === 'unclear', n: t });
    }
    // colpi che si accendono in diretta (ricalcolo leggero ogni 150 ms)
    if (t - repRef.current.lastLive > 150) {
      repRef.current.lastLive = t;
      const r = judge.judgeRep(moves, { since: repRef.current.start - 700 });
      setLive(r.moves.map((mv) => mv.status));
      const needed = r.moves.filter((mv) => mv.status !== 'guided').length;
      const done = r.moves.filter((mv) => mv.status === 'ok' || mv.status === 'partial').length;
      const quietFor = t - Math.max(repRef.current.lastActive, repRef.current.start);
      if ((done >= needed && judge.idle() && quietFor > 600) || t - repRef.current.start > 2600 + moves.length * 1100) finishRep();
    }
  }, [feet, combo.name, moves, voice, finishRep]);
  const camera = useMmaCamera(onFrame, { minInterval: 33, canSwap: () => phaseRef.current !== 'go' });

  // countdown → via
  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (count === 0) {
      judgeRef.current.abort(); // un gesto rimasto a metà dalla ripetizione prima non conta
      repRef.current = { start: performance.now(), lastActive: 0, lastLive: 0 };
      setLabel(null);
      setLive(moves.map(() => 'missing'));
      setPhase('go');
      return undefined;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(id);
  }, [phase, count, moves]);

  // dopo il risultato: prossima ripetizione o riassunto
  useEffect(() => {
    if (phase !== 'result' || paused || replay) return undefined;
    const id = setTimeout(() => {
      if (results.length >= reps) {
        setPhase('summary');
        const avg = Math.round(results.reduce((s, r) => s + r.total, 0) / results.length);
        logWorkout({ date: localDateKey(), kind: 'mma', title: `Combo ${combo.name} · con camera`, minutes: Math.max(3, Math.round(results.length * 0.6)), note: `media ${avg}/100` });
        if (avg >= 80) onLearnedRef.current?.();
        say(`Fine serie. Media ${avg} su cento. ${avg >= 85 ? 'Combo imparata!' : avg >= 65 ? 'Buon lavoro, ancora qualche ripetizione e ci sei.' : 'Rifalla più lenta, un colpo alla volta.'}`, voice);
      } else { setPhase('countdown'); setCount(3); say('Ancora. Tre. Due. Uno. Via!', voice); }
    }, 5200);
    return () => clearTimeout(id);
  }, [phase, paused, replay, results, reps, combo.name, voice]);

  const startCamera = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* voce */ }
    judgeRef.current = createComboJudge({ stance, templates }); readyRef.current.reset();
    setCalib(0); setResults([]); setCurrent(null);
    setPhase('calibrate');
    say(feet ? 'Mettiti a due o tre metri, corpo intero in inquadratura, mani in guardia.' : 'Mettiti a un metro e mezzo, busto e braccia in inquadratura, mani in guardia.', voice);
    camera.start(facing);
  };
  const close = () => { camera.stop(); window.speechSynthesis?.cancel(); onClose(); };
  const mirrored = facing === 'user';
  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.total, 0) / results.length) : 0;
  const topIssue = (() => {
    const tally = {};
    results.forEach((r) => r.moves.forEach((mv) => mv.issues.forEach((it) => { tally[it.text] = (tally[it.text] || 0) + 1; })));
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  })();

  return createPortal(<div className="mma-train" role="dialog" aria-modal="true" aria-label={`Allenamento con camera: ${combo.name}`}>
    <header className="mma-train-head">
      <button className="mma-combo-icon" onClick={close} aria-label="Chiudi il coach con camera"><ArrowLeft size={20} /></button>
      <div><small>COACH CON CAMERA · {results.length}/{reps}</small><h2>{combo.name}</h2></div>
      <button className="mma-combo-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    </header>

    {phase === 'setup' ? <section className="mma-train-setup">
      <div className="mma-train-ghost"><GhostDemo combo={combo} speed={0.6} /></div>
      <h3>Dove mettere il telefono</h3>
      <MmaCameraSetup stance={stance} />
      <ol>
        <li>Telefono in verticale, fermo, all’altezza del petto, {feet ? 'a 2–3 metri: servono anche i piedi' : 'a 2 metri'}.</li>
        <li><b>Non colpire verso il telefono</b>: il pugno che arriva dritto alla camera non si vede.</li>
        <li>Buona luce davanti a te, niente controluce.</li>
      </ol>
      <button className={`mma-teach-banner ${templates ? 'done' : ''}`} onClick={() => setTeachOpen(true)}><GraduationCap size={22} /><span><b>{templates ? `Il coach conosce ${new Set(templates.items.map((it) => it.move)).size} tuoi colpi` : 'Prima insegnami i tuoi colpi'}</b><small>{templates ? 'Rifalli se cambi posto o angolo della camera.' : '2 minuti: 3 volte ogni colpo. Poi riconosco te, non un atleta medio.'}</small></span></button>
      {guided.length > 0 && <p className="mma-train-note">{guided.map((id) => MOVES[id].name).join(' e ')}: solo su materassina e con istruttore. Il coach non li giudica, esegui il gesto lento.</p>}
      <div className="mma-train-reps" role="radiogroup" aria-label="Ripetizioni">{[4, 6, 10].map((n) => <button key={n} role="radio" aria-checked={reps === n} className={reps === n ? 'active' : ''} onClick={() => setReps(n)}>{n} ripetizioni</button>)}</div>
      <div className="mma-train-reps"><button className={facing === 'user' ? 'active' : ''} onClick={() => setFacing('user')}>Camera frontale</button><button className={facing === 'environment' ? 'active' : ''} onClick={() => setFacing('environment')}>Camera posteriore</button></div>
      {templates
        ? <button className="mma-combo-done" onClick={startCamera}><Video size={19} /> Avvia la camera</button>
        : <>
          <button className="mma-combo-done" onClick={() => setTeachOpen(true)}><GraduationCap size={19} /> Prima insegna i tuoi colpi (2 min)</button>
          <button className="mma-train-skip" onClick={startCamera}><Video size={16} /> Avvia senza insegnare · meno preciso</button>
        </>}
      <p className="mma-train-note">Il video resta sul telefono: niente registrazioni né invii. Il coach vede la posa in 3D stimato: ordine dei colpi, guardia, distensione, rotazione e ritorno. Non misura potenza né impatto.</p>
    </section> : <>
      <div className="mma-train-stage">
        <video ref={camera.videoRef} autoPlay muted playsInline style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} onClick={() => camera.videoRef.current?.play()} />
        <canvas ref={camera.canvasRef} style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />
        {camera.status !== 'ready' && camera.status !== 'error' && <div className="mma-train-overlay">{camera.status === 'permission' ? 'Consenti l’uso della fotocamera…' : 'Carico il riconoscimento del corpo…'}</div>}
        {camera.status === 'error' && <div className="mma-train-overlay error">{camera.error}<button onClick={startCamera}>Riprova</button></div>}
        {phase === 'calibrate' && camera.status === 'ready' && <div className="mma-train-calib"><strong>{framing || 'Mettiti in guardia'}</strong><div role="progressbar" aria-valuenow={Math.round(calib * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${calib * 100}%` }} /></div></div>}
        {phase === 'demo' && <div className="mma-train-demo"><GhostDemo combo={combo} speed={0.7} /><span>Guarda la combo…</span></div>}
        {phase === 'countdown' && <div className="mma-train-count" key={count}>{count || 'VIA!'}</div>}
        {phase === 'go' && <div className="mma-train-go">VAI!</div>}
        {phase === 'go' && label && <div key={label.n} className={`mma-live-label ${label.unclear ? 'unclear' : ''}`}>{label.unclear ? '?' : label.text}</div>}
        {phase === 'result' && current && <div className={`mma-train-score grade-${current.grade}`}><b>{current.total}</b><small>{current.grade === 'perfect' ? 'PERFETTA' : current.grade === 'good' ? 'BUONA' : 'RIPROVA'}</small></div>}
      </div>

      <div className="mma-train-moves">{moves.map((id, i) => {
        const st = phase === 'result' && current ? current.moves[i].status : live[i];
        return <span key={`${id}-${i}`} className={`st-${st || 'missing'}`}><b>{MOVES[id].num}</b>{MOVES[id].name}{phase === 'result' && current && current.moves[i].status !== 'guided' && <em>{current.moves[i].score}</em>}</span>;
      })}</div>

      {phase === 'result' && current && <section className="mma-train-feedback">
        <p>{current.feedback}</p>
        <div className="mma-train-actions">
          <button onClick={() => setReplay(current)}><RotateCcw size={16} /> Rivedi al rallentatore</button>
          <button onClick={() => setPaused((v) => !v)}>{paused ? <><Play size={16} /> Continua</> : <><Pause size={16} /> Pausa</>}</button>
          <button disabled={reported} onClick={() => { setReported(true); setPaused(true); applyTemplates(forgetRep(templatesRef.current, current.rep)); sendClips([encodeClip(current.frames, { combo: combo.id, expected: moves, seen: current.seen, total: current.total, stance, templates: Boolean(templates), model: camera.profile?.model || null, engine: 6, kind: 'rep' })], { chatId: readChatId(), kind: 'rep' }); }}>{reported ? <><Check size={16} /> Inviata</> : <><Flag size={16} /> Il coach ha sbagliato</>}</button>
        </div>
        {reported && <p className="mma-train-note">Grazie: ho mandato i punti dello scheletro di questa ripetizione (niente video). Mi servono per correggere il riconoscimento.</p>}
      </section>}

      {phase === 'summary' && <section className="mma-train-summary">
        <small>FINE SERIE</small>
        <h3>Media {avg}/100</h3>
        <div className="mma-train-bars">{results.map((r, i) => <i key={i} style={{ height: `${Math.max(8, r.total)}%` }} className={`grade-${r.grade}`} title={`${i + 1}: ${r.total}`} />)}</div>
        {topIssue && <p>Da sistemare più spesso: <b>{topIssue}</b>.</p>}
        <p className="mma-train-note">Salvato nel diario allenamenti.{avg >= 80 ? ' Combo segnata come imparata.' : ''}</p>
        <div className="mma-train-actions"><button onClick={() => { setResults([]); setPhase('countdown'); setCount(3); }}><RotateCcw size={16} /> Un’altra serie</button><button onClick={close}><Check size={16} /> Fine</button></div>
      </section>}
    </>}

    {teachOpen && <Suspense fallback={null}><MmaTeach initialStance={stance} onClose={() => { setTeachOpen(false); const t = loadTemplates(stance); setTemplates(t); judgeRef.current.setTemplates(t); }} onDone={() => { const t = loadTemplates(stance); setTemplates(t); judgeRef.current.setTemplates(t); }} /></Suspense>}
    {replay && <div className="mma-train-replay" role="dialog" aria-label="Replay al rallentatore">
      <header><strong>Replay · rallentatore</strong><button className="mma-combo-icon" onClick={() => setReplay(null)} aria-label="Chiudi replay"><X size={18} /></button></header>
      <div className="mma-train-replay-grid">
        <div><small>TU</small><ReplayCanvas frames={replay.frames} marks={replay.marks} mirrored={mirrored} /></div>
        <div><GhostDemo combo={combo} speed={0.3} /></div>
      </div>
      <ul>{replay.moves.map((mv, i) => <li key={i} className={`st-${mv.status}`}><b>{MOVES[mv.id].name}</b>{mv.status === 'missing' ? ' — non visto' : mv.status === 'guided' ? ' — guidato' : ` — ${mv.score}/100`}{mv.issues.slice(0, 2).map((it) => <span key={it.key}>{it.text}</span>)}</li>)}</ul>
    </div>}
  </div>, document.body);
}

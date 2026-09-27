import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import MmaFigure, { useSkeletonPlayer } from './MmaFigure';
import { MOVES, comboKeys } from '../data/mmaMoves';
import { LEVELS } from '../data/mmaCombos';

const ORDINAL = ['Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto', 'Sesto'];
const SPEEDS = [[0.35, 'Lento'], [0.6, 'Medio'], [1, 'Reale']];

// Voce del coach: calma, italiana, una frase alla volta.
function coachSay(text, enabled) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; u.rate = 0.95; u.pitch = 1;
    const voice = window.speechSynthesis.getVoices().find((v) => /^it/i.test(v.lang));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch { /* voce non disponibile */ }
}

// "Impara con calma": ogni colpo da solo al rallentatore (2 volte, spiegato),
// poi la combo intera lenta, poi a velocità reale.
function lessonScript(combo) {
  const steps = combo.moves.map((id, index) => ({
    focus: index,
    keys: comboKeys([id], { lead: 400, tail: 500 }).map((key) => ({ ...key, tag: key.tag === 0 ? index : key.tag })),
    speed: 0.4, repeat: 2,
    say: `${ORDINAL[index] || 'Poi'}: ${MOVES[id].name}. ${MOVES[id].cue}`,
  }));
  const all = comboKeys(combo.moves);
  return [
    ...steps,
    { focus: null, keys: all, speed: 0.5, repeat: 2, say: 'Adesso tutta la combinazione, piano. Ogni colpo torna in guardia.' },
    { focus: null, keys: all, speed: 1, repeat: 3, say: 'A velocità reale. Respira a ogni colpo, mento basso.' },
  ];
}

export default function MmaComboPlayer({ combo, learned, onLearned, onClose }) {
  const script = useMemo(() => lessonScript(combo), [combo]);
  const loopKeys = useMemo(() => comboKeys(combo.moves), [combo]);
  const [mode, setMode] = useState('learn'); // learn | loop
  const [segment, setSegment] = useState(0);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [loopSpeed, setLoopSpeed] = useState(0.6);
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem('shadow_monarch_coach_voice') !== '0'; } catch { return true; } });
  const [stance, setStance] = useState(() => { try { return localStorage.getItem('shadow_monarch_mma_stance') || 'orthodox'; } catch { return 'orthodox'; } });

  useEffect(() => { try { localStorage.setItem('shadow_monarch_coach_voice', voice ? '1' : '0'); } catch { /* storage */ } if (!voice) window.speechSynthesis?.cancel(); }, [voice]);
  useEffect(() => { try { localStorage.setItem('shadow_monarch_mma_stance', stance); } catch { /* storage */ } }, [stance]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = mode === 'learn' ? script[Math.min(segment, script.length - 1)] : null;
  useEffect(() => {
    if (mode !== 'learn' || finished || !playing) return;
    coachSay(current.say, voice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, segment, finished]);

  const frame = useSkeletonPlayer({
    keys: mode === 'learn' ? current.keys : loopKeys,
    speed: mode === 'learn' ? current.speed : loopSpeed,
    playing: playing && !finished,
    repeat: mode === 'learn' ? current.repeat : Infinity,
    runId: `${mode}-${segment}-${finished}`,
    onEnd: () => {
      if (segment + 1 < script.length) setSegment(segment + 1);
      else { setFinished(true); coachSay('Fatto. Ora provala tu: dieci ripetizioni lente, poi cambia guardia e ripeti.', voice); }
    },
  });

  const activeIndex = mode === 'learn' && current.focus != null ? current.focus : (frame.tag >= 0 && frame.tag < combo.moves.length ? frame.tag : null);
  const activeMove = activeIndex != null ? MOVES[combo.moves[activeIndex]] : null;
  const phaseText = finished ? 'Lezione completata'
    : mode === 'learn' ? (current.focus != null ? `Colpo ${current.focus + 1} di ${combo.moves.length} · al rallentatore` : current.speed < 1 ? 'Combinazione intera · lenta' : 'Combinazione intera · velocità reale')
      : `Ripeti · ${SPEEDS.find(([s]) => s === loopSpeed)?.[1] || ''}`;

  const goTo = (index) => { setMode('learn'); setFinished(false); setSegment(index); setPlaying(true); };
  const restart = () => goTo(0);

  // Portal sul body: la sezione che lo contiene ha un'animazione di ingresso e su Safari
  // un elemento animato "cattura" i figli position:fixed (il player restava dentro la pagina).
  return createPortal(<div className="mma-combo" role="dialog" aria-modal="true" aria-label={`Combo ${combo.name}`}>
    <header className="mma-combo-head">
      <button className="mma-combo-icon" onClick={onClose} aria-label="Torna alle combo"><ArrowLeft size={20} /></button>
      <div><small>COMBO · {LEVELS[combo.level].toUpperCase()}</small><h2>{combo.name}</h2></div>
      <button className="mma-combo-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? 'Spegni la voce del coach' : 'Accendi la voce del coach'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    </header>

    <div className="mma-combo-modes" role="tablist">
      <button role="tab" aria-selected={mode === 'learn'} className={mode === 'learn' ? 'active' : ''} onClick={restart}>Impara con calma</button>
      <button role="tab" aria-selected={mode === 'loop'} className={mode === 'loop' ? 'active' : ''} onClick={() => { setMode('loop'); setFinished(false); setPlaying(true); window.speechSynthesis?.cancel(); }}>Ripeti</button>
    </div>

    <div className="mma-combo-stage">
      <MmaFigure frame={frame} stance={stance} highlight={activeMove?.limb} caption={activeMove ? `${activeIndex + 1}/${combo.moves.length} · ${activeMove.name.toUpperCase()}` : 'GUARDIA'} label={`${combo.name}: ${activeMove?.name || 'guardia'}`} />
      <p className="mma-combo-phase">{phaseText}</p>
    </div>

    <div className="mma-combo-steps">{combo.moves.map((id, index) => <button key={`${id}-${index}`} className={activeIndex === index ? 'active' : ''} onClick={() => goTo(index)}><b>{MOVES[id].num}</b><span>{MOVES[id].name}</span></button>)}</div>

    <section className="mma-combo-coach" aria-live="polite">
      {finished ? <><small>IL COACH</small><p>Fatto. Ora provala tu: <b>10 ripetizioni lente</b>, poi cambia guardia e ripeti. Quando esce pulita, passa a “Ripeti” a velocità reale.</p></>
        : activeMove ? <><small>IL COACH · {activeMove.num} {activeMove.name.toUpperCase()}</small><p>{activeMove.cue}</p><p className="mma-combo-mistake"><b>Attento:</b> {activeMove.mistake}</p></>
          : <><small>PERCHÉ FUNZIONA</small><p>{combo.why}</p></>}
    </section>

    <div className="mma-combo-controls">
      <button onClick={() => mode === 'learn' && goTo(Math.max(0, segment - 1))} disabled={mode !== 'learn'} aria-label="Passo precedente"><SkipBack size={20} /></button>
      <button className="mma-combo-play" onClick={() => (finished ? restart() : setPlaying((v) => !v))} aria-label={playing && !finished ? 'Pausa' : 'Riproduci'}>{playing && !finished ? <Pause size={24} /> : <Play size={24} />}</button>
      <button onClick={() => mode === 'learn' && goTo(Math.min(script.length - 1, segment + 1))} disabled={mode !== 'learn'} aria-label="Passo successivo"><SkipForward size={20} /></button>
    </div>
    {mode === 'loop' && <div className="mma-combo-speeds">{SPEEDS.map(([value, label]) => <button key={value} className={loopSpeed === value ? 'active' : ''} onClick={() => setLoopSpeed(value)}>{label}</button>)}</div>}

    <div className="mma-combo-foot">
      <button onClick={() => setStance((s) => (s === 'orthodox' ? 'southpaw' : 'orthodox'))}>{stance === 'orthodox' ? 'Guardia destra' : 'Guardia mancina'} · cambia</button>
      <button className={`mma-combo-learned ${learned ? 'done' : ''}`} onClick={onLearned}>{learned ? <><Check size={16} /> Imparata</> : 'Segna come imparata'}</button>
    </div>
  </div>, document.body);
}

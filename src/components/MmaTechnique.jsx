import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import MmaFigure, { useSkeletonPlayer } from './MmaFigure';

// Manichino delle lezioni: sequenza in 3 fasi (etichette + testo del coach) sul motore
// condiviso src/mma/skeleton.js. Parte da solo; toccando una fase si ferma lì.
const k = (pose, move, hold, tag, curve = 'io') => ({ pose, move, hold, tag, curve });
const TIMELINES = {
  guard: [k('base', 450, 900, 0), k('tight', 380, 650, 1), k('leadStep', 280, 120, 2), k('stepped', 280, 500, 2), k('base', 520, 300, 0)],
  jab: [k('base', 320, 850, 0), k('jab', 170, 230, 1, 'out'), k('base', 290, 700, 2)],
  cross: [k('base', 340, 850, 0), k('cross', 210, 260, 1, 'out'), k('base', 330, 700, 2)],
  combo: [k('base', 320, 750, 0), k('jab', 170, 150, 1, 'out'), k('base', 200, 60, 1), k('cross', 210, 240, 2, 'out'), k('base', 330, 800, 2)],
  kick: [k('base', 450, 800, 0), k('bodyKickChamber', 430, 260, 1), k('bodyKick', 280, 380, 2, 'out'), k('bodyKickChamber', 300, 200, 2), k('base', 450, 600, 0)],
  sprawl: [k('base', 500, 800, 0), k('sprawl', 430, 750, 1, 'out'), k('base', 680, 800, 2)],
  footwork: [k('base', 400, 700, 0), k('leadStep', 260, 120, 1), k('stepped', 260, 500, 1), k('rearBack', 260, 120, 2), k('base', 300, 650, 2)],
};
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export default function MmaTechnique({ kind = 'guard', steps, stance = 'orthodox', compact = false }) {
  const timeline = TIMELINES[kind] || TIMELINES.guard;
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [manualPhase, setManualPhase] = useState(0);
  useEffect(() => { setManualPhase(0); setPlaying(!reducedMotion()); }, [kind]);

  // In pausa: scivola sulla posa più rappresentativa della fase scelta e resta lì.
  const manualKeys = useMemo(() => {
    const step = timeline.find((s) => s.tag === manualPhase && s.pose !== 'base') || timeline.find((s) => s.tag === manualPhase) || timeline[0];
    return [{ ...step, move: 320, hold: 60000 }];
  }, [timeline, manualPhase]);
  const frame = useSkeletonPlayer({ keys: playing ? timeline : manualKeys, speed: 1, playing: true, runId: playing ? 'play' : manualPhase });
  const phase = playing ? (frame.tag ?? 0) : manualPhase;

  const labels = ['jab', 'cross', 'combo'].includes(kind)
    ? ['GUARDIA', kind === 'cross' ? 'CROSS' : 'JAB', kind === 'combo' ? 'CROSS + RIENTRO' : 'RIENTRO']
    : kind === 'kick' ? ['BASE', 'GINOCCHIO', 'ESTENDI + RICHIAMA']
      : kind === 'sprawl' ? ['BASE', 'GAMBE INDIETRO', 'RITORNO']
        : kind === 'footwork' ? ['BASE', 'PASSO AVANTI', 'PASSO INDIETRO']
          : ['BASE', 'GUARDIA CHIUSA', 'PASSO CORTO'];

  return <div className={`mma-technique ${compact ? 'compact' : ''}`}>
    <div className="mma-technique-label"><span>SCHEMA DEL MOVIMENTO</span><button onClick={() => { if (playing) setManualPhase(phase); setPlaying((v) => !v); }} aria-label={playing ? 'Ferma schema' : 'Anima schema'}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Ferma' : 'Riproduci'}</button></div>
    <MmaFigure frame={frame} stance={stance} caption={`0${phase + 1} / ${labels[phase]}`} label={`Schema ${kind}, fase ${phase + 1}: ${labels[phase]}`} />
    {!compact && <><div className="mma-technique-steps">{[0, 1, 2].map((i) => <button key={i} aria-pressed={phase === i} onClick={() => { setManualPhase(i); setPlaying(false); }}><b>0{i + 1}</b>{labels[i]}</button>)}</div><p className="mma-technique-instruction" aria-live="polite">{steps[phase]}</p></>}
  </div>;
}

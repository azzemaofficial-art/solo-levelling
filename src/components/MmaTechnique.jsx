import React, { useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// Deliberately schematic: illustrates sequence, never presents itself as a video of a coach.
export default function MmaTechnique({ kind = 'guard', steps, stance = 'orthodox', compact = false }) {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setPhase(0); setPlaying(false); }, [kind]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setPhase(p => (p + 1) % 3), 1600);
    return () => clearInterval(timer);
  }, [playing]);
  const punch = ['jab', 'cross', 'combo'].includes(kind);
  const leadOut = punch && phase === 1 && kind !== 'cross';
  const rearOut = punch && ((phase === 1 && kind === 'cross') || (phase === 2 && kind === 'combo'));
  const kick = kind === 'kick';
  const ground = kind === 'sprawl' && phase === 1;
  const offset = kind === 'footwork' ? [0, 22, -12][phase] : 0;
  const labels = punch ? ['GUARDIA', kind === 'cross' ? 'CROSS' : 'JAB', kind === 'combo' ? 'CROSS + RIENTRO' : 'RIENTRO'] : kick ? ['BASE', 'GINOCCHIO', 'ESTENDI + RICHIAMA'] : kind === 'sprawl' ? ['BASE', 'GAMBE INDIETRO', 'RITORNO'] : ['BASE', 'MOVIMENTO', 'RITORNO'];
  return <div className={`mma-technique ${compact ? 'compact' : ''}`}>
    <div className="mma-technique-label"><span>SCHEMA DEL MOVIMENTO</span><button onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Ferma schema' : 'Anima schema'}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Ferma' : 'Riproduci'}</button></div>
    <svg viewBox="0 0 340 220" role="img" aria-label={`Schema ${kind}, fase ${phase + 1}: ${labels[phase]}`}>
      <defs><pattern id="mma-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#b4d5df" strokeOpacity=".07" /></pattern></defs>
      <rect width="340" height="220" fill="url(#mma-grid)" />
      <ellipse cx="169" cy="197" rx="103" ry="11" fill="#6de2d3" opacity=".07" />
      <path d="M43 197H297" stroke="#66818a" strokeOpacity=".4" strokeDasharray="3 7" />
      <g transform={stance === 'southpaw' ? 'translate(340 0) scale(-1 1)' : undefined}>
        <g transform={`translate(${offset} 0)`} className="mma-technique-figure">
          {ground ? <g fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="103" cy="105" r="14" fill="#a1b4c7" /><path d="M122 115L180 135L262 175" stroke="#8194ab" strokeWidth="17" /><path d="M128 120L120 185M180 135L239 185" stroke="#6de2d3" strokeWidth="9" /></g> : <>
            <path d="M157 123L135 158L115 193" fill="none" stroke="#657b93" strokeWidth="15" strokeLinecap="round" />
            <path d={kick && phase > 0 ? phase === 1 ? 'M172 123L207 120L204 160' : 'M172 123L214 111L271 108' : 'M172 123L190 160L212 193'} fill="none" stroke="#98b9c8" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M152 73Q171 69 180 87L179 129Q164 139 148 123Z" fill="#253d50" stroke="#7295aa" strokeWidth="1.5" />
            <path d={rearOut ? 'M153 81L218 80L273 79' : 'M153 81L133 103L145 57'} fill="none" stroke="#9eaed2" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={rearOut ? 273 : 145} cy={rearOut ? 79 : 57} r="10" fill="#b8a4ff" />
            <path d="M162 72V61" stroke="#a1b4c7" strokeWidth="13" />
            <ellipse cx="163" cy="43" rx="15" ry="19" fill="#a1b4c7" />
            <path d="M169 49L177 49" stroke="#486079" strokeWidth="2" />
            <path d={leadOut ? 'M175 81L223 77L279 75' : 'M175 81L188 109L181 60'} fill="none" stroke="#6de2d3" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={leadOut ? 279 : 181} cy={leadOut ? 75 : 60} r="11" fill="#a3f6e7" />
            {(leadOut || rearOut) && <circle cx="285" cy="77" r="22" fill="none" stroke="#6de2d3" strokeOpacity=".4" strokeDasharray="3 4" />}
          </>}
        </g>
      </g>
      <text x="20" y="27" fill="#6de2d3" fontSize="10" fontFamily="var(--font-label)" letterSpacing="2">0{phase + 1} / {labels[phase]}</text>
      <text x="20" y="213" fill="#8196a8" fontSize="9" fontFamily="var(--font-body)">Illustrazione della sequenza · non una verifica tecnica</text>
    </svg>
    {!compact && <><div className="mma-technique-steps">{[0, 1, 2].map(i => <button key={i} aria-pressed={phase === i} onClick={() => { setPhase(i); setPlaying(false); }}><b>0{i + 1}</b>{labels[i]}</button>)}</div><p className="mma-technique-instruction">{steps[phase]}</p></>}
  </div>;
}

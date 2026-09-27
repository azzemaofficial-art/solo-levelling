import React, { useEffect, useId, useState } from 'react';
import '../styles/dragons.css';

// Draghi che ogni tanto attraversano il cielo dietro le pagine (solo CSS: niente
// three.js sulla home) + una picchiata in primo piano sull'evento
// DRAGON_SWOOP_EVENT (es. allenamento completato). Spenti in modalità leggera
// e con prefers-reduced-motion.
export const DRAGON_SWOOP_EVENT = 'shadow_dragon_swoop';
export const summonDragon = () => {
  try { window.dispatchEvent(new CustomEvent(DRAGON_SWOOP_EVENT)); } catch { /* SSR/test */ }
};

// variant "shadow": silhouette scura con bordo luminoso, per il cielo dietro i testi
// (un drago chiaro si confondeva con le scritte). "bright": la picchiata in primo piano.
const PALETTE = {
  bright: { body: ['#ff8fd8', '#b8a4ff', '#e3dbff'], wing: ['#6f52e8', '#ff8fd8'], rim: 'none', spikes: '#8a6cff', legs: '#b8a4ff', horns: '#ffd184', eye: '#fff' },
  shadow: { body: ['#6a44b8', '#44308f', '#5a42b0'], wing: ['#3a2878', '#9a5fd0'], rim: '#c9b8ff', spikes: '#ff8fd8', legs: '#2f2266', horns: '#ffd184', eye: '#ff8fd8' },
};

export function Dragon({ className = '', variant = 'bright' }) {
  const id = useId().replace(/:/g, '');
  const c = PALETTE[variant] || PALETTE.bright;
  const rim = c.rim === 'none' ? {} : { stroke: c.rim, strokeWidth: 1.1, strokeOpacity: 0.75, strokeLinejoin: 'round' };
  return <svg className={`dragon ${className}`} viewBox="-20 -10 250 110" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`db-${id}`} gradientUnits="userSpaceOnUse" x1="-18" x2="214" y1="0" y2="0">
        <stop offset="0" stopColor={c.body[0]} /><stop offset=".55" stopColor={c.body[1]} /><stop offset="1" stopColor={c.body[2]} />
      </linearGradient>
      <linearGradient id={`dw-${id}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={c.wing[0]} /><stop offset="1" stopColor={c.wing[1]} stopOpacity=".85" />
      </linearGradient>
    </defs>
    <g className="dragon-body">
      <g className="dragon-wing dragon-wing-far">
        <path d="M122 56 C118 38 112 20 108 6 L66 0 Q82 10 76 20 Q92 24 90 34 Q100 42 100 58 Z" fill={`url(#dw-${id})`} opacity=".55" transform="translate(-6 4)" {...rim} />
      </g>
      <path className="dragon-tail" fill={`url(#db-${id})`} {...rim} d="M100 62 Q72 72 50 66 Q30 60 12 66 Q2 70 -8 68 L-18 62 L-12 70 L-18 78 L-6 74 Q6 74 16 72 Q34 68 52 74 Q76 80 104 70 Z" />
      <path fill={`url(#db-${id})`} {...rim} d="M96 60 Q110 50 132 50 Q146 50 152 46 L150 60 Q140 70 120 72 Q104 72 96 66 Z" />
      <path fill={`url(#db-${id})`} {...rim} d="M146 48 Q156 36 168 30 Q176 26 184 26 L192 24 L210 28 L214 32 L200 34 L204 38 L190 38 Q180 38 172 42 Q162 48 154 60 Z" />
      <path d="M182 27 L178 14 L188 25 Z M188 25 L190 12 L194 25 Z" fill={c.horns} />
      <circle className="dragon-eye" cx="196" cy="29.5" r={variant === 'shadow' ? 2.2 : 1.6} fill={c.eye} />
      <path d="M110 51 l3 -6 l3 6 Z M122 50 l3 -6 l3 6 Z M134 50 l3 -5 l3 5 Z M88 64 l3 -5 l3 5 Z M70 67 l2 -4 l3 4 Z" fill={c.spikes} />
      <path d="M110 70 Q106 80 100 86 L108 84 Q114 78 118 71 Z M140 64 Q140 74 136 80 L143 78 Q147 72 148 62 Z" fill={c.legs} {...rim} />
      <g className="dragon-wing dragon-wing-near">
        <path d="M128 54 C124 36 118 18 114 2 L64 -6 Q84 6 76 18 Q96 22 92 34 Q106 42 104 58 Z" fill={`url(#dw-${id})`} {...rim} />
        <path d="M128 54 L114 2 L64 -6 M114 2 L76 18 M114 2 L92 34" stroke={variant === 'shadow' ? '#c9b8ff' : '#2a1850'} strokeWidth="1.2" fill="none" opacity=".6" strokeLinecap="round" />
      </g>
    </g>
  </svg>;
}

export default function DragonSky({ enabled = true, lane = 'top' }) {
  const [swoops, setSwoops] = useState([]);

  useEffect(() => {
    const onSwoop = () => {
      const key = Date.now();
      setSwoops((prev) => [...prev.slice(-1), key]);
      setTimeout(() => setSwoops((prev) => prev.filter((k) => k !== key)), 2600);
    };
    window.addEventListener(DRAGON_SWOOP_EVENT, onSwoop);
    return () => window.removeEventListener(DRAGON_SWOOP_EVENT, onSwoop);
  }, []);

  if (!enabled) return null;
  return <>
    <div className={`dragon-sky dragon-lane-${lane}`} aria-hidden="true">
      <div className="dragon-flight dragon-flight-a"><div className="dragon-arc"><Dragon variant="shadow" /></div></div>
      <div className="dragon-flight dragon-flight-b"><div className="dragon-arc"><Dragon variant="shadow" className="dragon-far" /></div></div>
    </div>
    {swoops.map((key) => <div key={key} className="dragon-swoop" aria-hidden="true"><div className="dragon-arc"><Dragon /></div></div>)}
  </>;
}

import React, { useEffect, useState } from 'react';
import '../styles/dragons.css';

// Draghi che ogni tanto attraversano il cielo dietro le pagine + una picchiata in
// primo piano sull'evento DRAGON_SWOOP_EVENT (allenamento completato, tocco sul
// guerriero, menu). Il drago è un render Blender del modello 3D del progetto
// (tools/blender/dragon-flap.py) salvato come WebP animato: aspetto 3D senza
// caricare three.js sulla home.
export const DRAGON_SWOOP_EVENT = 'shadow_dragon_swoop';
export const summonDragon = () => {
  try { window.dispatchEvent(new CustomEvent(DRAGON_SWOOP_EVENT)); } catch { /* SSR/test */ }
};

const DRAGON_SRC = '/dragons/astral.webp';

export function Dragon({ className = '' }) {
  return <img className={`dragon ${className}`} src={DRAGON_SRC} alt="" width="305" height="289" decoding="async" draggable="false" />;
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
      <div className="dragon-flight dragon-flight-a"><div className="dragon-arc"><Dragon /></div></div>
      <div className="dragon-flight dragon-flight-b"><div className="dragon-arc"><Dragon className="dragon-far" /></div></div>
    </div>
    {swoops.map((key) => <div key={key} className="dragon-swoop" aria-hidden="true"><div className="dragon-arc"><Dragon /></div></div>)}
  </>;
}

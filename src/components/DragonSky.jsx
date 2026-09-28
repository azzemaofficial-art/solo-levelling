import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/dragons.css';

// Draghi che ogni tanto attraversano il cielo dietro le pagine + una picchiata in
// primo piano sull'evento DRAGON_SWOOP_EVENT (allenamento completato, tocco sul
// guerriero, menu). Il drago è un modello con scheletro e animazione di volo vera
// (Quaternius, CC0) ricolorato e renderizzato in Blender (tools/blender/dragon-quaternius.py),
// salvato come WebP animato: aspetto 3D senza caricare three.js sulla home.
export const DRAGON_SWOOP_EVENT = 'shadow_dragon_swoop';
export const summonDragon = () => {
  try { window.dispatchEvent(new CustomEvent(DRAGON_SWOOP_EVENT)); } catch { /* SSR/test */ }
};
// Scena "arriva il drago gigante": il draghetto lo vede, sobbalza e scappa.
export const DRAGON_CHASE_EVENT = 'shadow_dragon_chase';
export const summonChase = () => {
  try { window.dispatchEvent(new CustomEvent(DRAGON_CHASE_EVENT)); } catch { /* SSR/test */ }
};

// Nomi con versione: la cache del telefono li tiene per un anno (vercel.json), quindi
// ogni nuovo render va salvato con un nuovo suffisso.
const CUTE = { idle: '/dragons/cute-idle-v2.webp', hit: '/dragons/cute-hit-v2.webp', flee: '/dragons/cute-fast-v2.webp' };
const CHASE_MS = 7400;

// Scarica prima tutto (3 stati del draghetto + video del gigante): la scena parte
// solo quando è pronta, così niente buchi o immagini che compaiono in ritardo.
function preloadChase() {
  const images = Object.values(CUTE).map((src) => new Promise((resolve) => {
    const img = new Image(); img.onload = resolve; img.onerror = resolve; img.src = src;
  }));
  const video = new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    const done = () => resolve();
    v.addEventListener('canplaythrough', done, { once: true });
    v.addEventListener('error', done, { once: true });
    v.src = v.canPlayType('video/quicktime; codecs="hvc1"') ? '/dragons/giant-v3.mov' : '/dragons/giant-v3.webm';
    v.load();
  });
  // il gigante in alta qualità pesa ~2 MB: fino a 8 s di attesa la prima volta, poi è in cache
  return Promise.race([Promise.all([...images, video]), new Promise((r) => setTimeout(r, 8000))]);
}

function DragonChase({ onDone }) {
  const [stage, setStage] = useState('idle'); // idle → hit (lo vede) → flee (scappa)
  useEffect(() => {
    const timers = [setTimeout(() => setStage('hit'), 1700), setTimeout(() => setStage('flee'), 2500), setTimeout(onDone, CHASE_MS)];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  return <div className="dragon-chase" aria-hidden="true">
    <div className="dragon-chase-dark" />
    <div className="dragon-chase-shake">
      <div className="dragon-chase-giant">
        <video autoPlay muted playsInline disablePictureInPicture preload="auto">
          <source src="/dragons/giant-v3.mov" type='video/quicktime; codecs="hvc1"' />
          <source src="/dragons/giant-v3.webm" type="video/webm" />
        </video>
      </div>
    </div>
    <div className={`dragon-chase-cute is-${stage}`}>
      <img src={CUTE[stage]} alt="" width="560" height="387" draggable="false" />
      {stage === 'hit' && <span className="dragon-chase-alert">!</span>}
    </div>
  </div>;
}

const DRAGON_SRC = '/dragons/cute-fast-v2.webp'; // stesso volo della fuga · Quaternius CC0, vedi public/dragons/CREDITS.txt

export function Dragon({ className = '' }) {
  return <img className={`dragon ${className}`} src={DRAGON_SRC} alt="" width="560" height="387" decoding="async" draggable="false" />;
}

export default function DragonSky({ enabled = true, lane = 'top' }) {
  const [swoops, setSwoops] = useState([]);
  const [chase, setChase] = useState(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const onSwoop = () => {
      const key = Date.now();
      setSwoops((prev) => [...prev.slice(-1), key]);
      setTimeout(() => setSwoops((prev) => prev.filter((k) => k !== key)), 2600);
    };
    window.addEventListener(DRAGON_SWOOP_EVENT, onSwoop);
    return () => window.removeEventListener(DRAGON_SWOOP_EVENT, onSwoop);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onChase = () => {
      if (busyRef.current) return;
      busyRef.current = true;
      preloadChase().then(() => setChase(Date.now()));
    };
    window.addEventListener(DRAGON_CHASE_EVENT, onChase);
    // In home, una volta per apertura dell'app, parte da sola dopo un po'.
    let auto;
    try {
      if (lane === 'mid' && !sessionStorage.getItem('shadow_dragon_chase_seen')) {
        auto = setTimeout(() => { sessionStorage.setItem('shadow_dragon_chase_seen', '1'); onChase(); }, 18000);
      }
    } catch { /* storage bloccato */ }
    return () => { window.removeEventListener(DRAGON_CHASE_EVENT, onChase); clearTimeout(auto); };
  }, [enabled, lane]);
  const endChase = useCallback(() => { setChase(null); busyRef.current = false; }, []);

  if (!enabled) return null;
  return <>
    <div className={`dragon-sky dragon-lane-${lane} ${chase ? 'is-hidden' : ''}`} aria-hidden="true">
      <div className="dragon-flight dragon-flight-a"><div className="dragon-arc"><Dragon /></div></div>
      <div className="dragon-flight dragon-flight-b"><div className="dragon-arc"><Dragon className="dragon-far" /></div></div>
    </div>
    {chase && <DragonChase key={chase} onDone={endChase} />}
    {swoops.map((key) => <div key={key} className="dragon-swoop" aria-hidden="true"><div className="dragon-arc"><Dragon /></div></div>)}
  </>;
}

import React, { useEffect, useRef, useState } from 'react';
import { BASE, isUpright, sampleKeys, timelineDuration } from '../mma/skeleton';

const P = (pt) => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;

// Anima una timeline di keyframe: tempo "virtuale" che scorre a `speed`, così
// cambiare velocità non fa salti. `repeat` giri poi onEnd (Infinity = loop).
export function useSkeletonPlayer({ keys, speed = 1, playing = true, repeat = Infinity, onEnd, bob = true, runId = 0 }) {
  const [frame, setFrame] = useState({ pose: BASE, tag: null });
  const clockRef = useRef(0);
  const lastRef = useRef(null);
  const trailRef = useRef([]);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  // runId: riparte da zero anche con la stessa timeline (es. stessa combo a un'altra velocità)
  useEffect(() => { clockRef.current = 0; lastRef.current = null; trailRef.current = []; }, [keys, runId]);

  useEffect(() => {
    if (!keys?.length) return undefined;
    let raf;
    const total = timelineDuration(keys);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = lastRef.current == null ? 0 : Math.min(64, now - lastRef.current);
      lastRef.current = now;
      if (playing) clockRef.current += dt * speed;
      const lap = Math.floor(clockRef.current / total);
      if (lap >= repeat) {
        cancelAnimationFrame(raf);
        const endFrame = sampleKeys(keys, total - 1);
        setFrame({ ...endFrame, bob: 0, fast: [] });
        endRef.current?.();
        return;
      }
      const sample = sampleKeys(keys, clockRef.current % total);
      const tip = [sample.pose.fl, sample.pose.fr, sample.pose.ftl, sample.pose.ftr];
      const prev = trailRef.current[trailRef.current.length - 1];
      trailRef.current = [...trailRef.current.slice(-7), tip];
      const fast = prev ? tip.map((pt, i) => Math.hypot(pt[0] - prev[i][0], pt[1] - prev[i][1]) > 3.5 * Math.max(0.35, speed)) : [];
      setFrame({ ...sample, bob: bob && playing && isUpright(sample.pose) ? Math.sin(now / 430) * 1.8 : 0, fast, trail: trailRef.current });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lastRef.current = null; };
  }, [keys, speed, playing, repeat, bob, runId]);

  return frame;
}

const TRAIL_COLORS = ['#6de2d3', '#b8a4ff', '#98b9c8', '#9eaed2'];

// Solo disegno: riceve una posa già calcolata.
export default function MmaFigure({ frame, stance = 'orthodox', label, caption, highlight }) {
  const p = frame.pose || BASE;
  const trail = frame.trail || [];
  const fast = frame.fast || [];
  const impact = frame.holding ? [p.fl, p.fr, p.ftl, p.ftr].find((pt) => pt[0] > 238) : null;
  const shadowX = (p.ftl[0] + p.ftr[0]) / 2 + p.dx;
  const shadowW = Math.max(60, Math.abs(p.ftl[0] - p.ftr[0]) + 50);
  const limb = (a, b, c, color, width, glow) => <g>
    {glow && <path d={`M${P(a)}L${P(b)}L${P(c)}`} fill="none" stroke={color} strokeWidth={width + 8} strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".18" />}
    <path d={`M${P(a)}L${P(b)}L${P(c)}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={b[0]} cy={b[1]} r={width * 0.34} fill="#0d1a24" opacity=".35" />
  </g>;
  const lit = (part) => highlight === part;

  return <svg className="mma-figure" viewBox="0 0 340 220" role="img" aria-label={label}>
    <defs>
      <pattern id="mma-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#b4d5df" strokeOpacity=".07" /></pattern>
      <linearGradient id="mma-torso" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2e4a60" /><stop offset="1" stopColor="#1c2f3f" /></linearGradient>
      <radialGradient id="mma-head" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#c6d3e0" /><stop offset="1" stopColor="#8fa3b8" /></radialGradient>
    </defs>
    <rect width="340" height="220" fill="url(#mma-grid)" />
    <ellipse cx={shadowX} cy="197" rx={shadowW / 2} ry="9" fill="#6de2d3" opacity=".09" />
    <path d="M30 197H310" stroke="#66818a" strokeOpacity=".4" strokeDasharray="3 7" />
    <g transform={stance === 'southpaw' ? 'translate(340 0) scale(-1 1)' : undefined}>
      <g transform={`translate(${p.dx.toFixed(1)} ${(frame.bob || 0).toFixed(2)})`}>
        {[0, 1, 2, 3].map((i) => fast[i] && trail.length > 2 && <polyline key={i} points={trail.map((t) => P(t[i])).join(' ')} fill="none" stroke={TRAIL_COLORS[i]} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3" />)}
        {limb(p.hr, p.kr, p.ftr, '#5d7390', 15, lit('rearLeg'))}
        {limb(p.hl, p.kl, p.ftl, '#98b9c8', 15, lit('leadLeg'))}
        <path d={`M${P(p.sr)}Q${P([(p.sr[0] + p.sl[0]) / 2, Math.min(p.sr[1], p.sl[1]) - 8])} ${P(p.sl)}L${P(p.hl)}Q${P([(p.hl[0] + p.hr[0]) / 2, Math.max(p.hl[1], p.hr[1]) + 8])} ${P(p.hr)}Z`} fill="url(#mma-torso)" stroke="#7295aa" strokeWidth="1.5" strokeLinejoin="round" />
        {limb(p.sr, p.er, p.fr, '#9eaed2', 10, lit('rearArm'))}
        <circle cx={p.fr[0]} cy={p.fr[1]} r="10" fill="#b8a4ff" />
        <path d={`M${P(p.neck)}L${P([p.neck[0] + (p.head[0] - p.neck[0]) * 0.45, p.neck[1] + (p.head[1] - p.neck[1]) * 0.45])}`} stroke="#a1b4c7" strokeWidth="13" strokeLinecap="round" />
        <ellipse cx={p.head[0]} cy={p.head[1]} rx="15" ry="19" fill="url(#mma-head)" transform={`rotate(${((p.head[0] - p.neck[0]) * 1.2).toFixed(1)} ${p.head[0]} ${p.head[1]})`} />
        <path d={`M${p.head[0] + 6} ${p.head[1] + 6}L${p.head[0] + 14} ${p.head[1] + 6}`} stroke="#486079" strokeWidth="2" />
        {limb(p.sl, p.el, p.fl, '#6de2d3', 10, lit('leadArm'))}
        <circle cx={p.fl[0]} cy={p.fl[1]} r="11" fill="#a3f6e7" />
        {impact && <circle cx={impact[0] + 5} cy={impact[1] + 1} r="22" fill="none" stroke="#6de2d3" strokeOpacity=".45" strokeDasharray="3 4" className="mma-technique-impact" />}
      </g>
    </g>
    {caption && <text x="20" y="27" fill="#6de2d3" fontSize="10" fontFamily="var(--font-label)" letterSpacing="2">{caption}</text>}
    <text x="20" y="213" fill="#8196a8" fontSize="9" fontFamily="var(--font-body)">Illustrazione della sequenza · non una verifica tecnica</text>
  </svg>;
}

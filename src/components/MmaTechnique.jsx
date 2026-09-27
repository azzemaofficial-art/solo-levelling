import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// Manichino schematico ANIMATO: uno scheletro (spalle, gomiti, pugni, anche, ginocchia,
// piedi) che passa in modo continuo da una posa all'altra con i tempi del gesto reale
// (uscita rapida, ritorno controllato, molleggio in guardia). Resta un'illustrazione
// della sequenza, non la dimostrazione di un coach.

// ── Pose (viewBox 340×220, atleta che guarda a destra; "l" = lato anteriore) ──
const BASE = {
  head: [163, 43], neck: [162, 66], sl: [175, 81], sr: [153, 81],
  el: [188, 109], fl: [181, 60], er: [133, 103], fr: [145, 57],
  hl: [172, 123], hr: [157, 123], kl: [190, 160], ftl: [212, 193], kr: [135, 158], ftr: [115, 193], dx: 0,
};
const pose = (over) => ({ ...BASE, ...over });
const POSES = {
  base: BASE,
  tight: pose({ head: [165, 46], el: [186, 104], fl: [179, 55], er: [137, 100], fr: [149, 53] }),
  jab: pose({ head: [168, 44], neck: [165, 66], sl: [179, 80], el: [226, 77], fl: [282, 75], kl: [194, 160] }),
  cross: pose({ head: [170, 45], neck: [166, 67], sr: [162, 80], er: [222, 80], fr: [276, 79], hr: [165, 123], kr: [146, 158], ftr: [124, 190] }),
  chamber: pose({ head: [158, 44], neck: [159, 66], hl: [174, 121], kl: [209, 118], ftl: [205, 158] }),
  kick: pose({ head: [153, 47], neck: [156, 68], sr: [150, 82], hl: [176, 119], kl: [216, 110], ftl: [274, 106], fl: [178, 62] }),
  sprawl: pose({
    head: [103, 105], neck: [118, 112], sl: [126, 116], sr: [121, 119], el: [126, 150], fl: [122, 185], er: [118, 152], fr: [131, 186],
    hl: [182, 134], hr: [178, 138], kl: [214, 152], ftl: [262, 176], kr: [210, 160], ftr: [241, 186],
  }),
  leadStep: pose({ kl: [201, 159], ftl: [236, 193], dx: 4 }),
  stepped: pose({ dx: 24 }),
  rearBack: pose({ dx: 24, kr: [128, 158], ftr: [92, 193] }),
};

// ── Sequenze: [posa, ms di movimento, ms di pausa, fase (0-2), curva] ──
const TIMELINES = {
  guard: [['base', 450, 900, 0, 'io'], ['tight', 380, 650, 1, 'io'], ['leadStep', 280, 120, 2, 'io'], ['stepped', 280, 500, 2, 'io'], ['base', 520, 300, 0, 'io']],
  jab: [['base', 320, 850, 0, 'io'], ['jab', 170, 230, 1, 'out'], ['base', 290, 700, 2, 'io']],
  cross: [['base', 340, 850, 0, 'io'], ['cross', 210, 260, 1, 'out'], ['base', 330, 700, 2, 'io']],
  combo: [['base', 320, 750, 0, 'io'], ['jab', 170, 150, 1, 'out'], ['base', 200, 60, 1, 'io'], ['cross', 210, 240, 2, 'out'], ['base', 330, 800, 2, 'io']],
  kick: [['base', 450, 800, 0, 'io'], ['chamber', 430, 260, 1, 'io'], ['kick', 280, 380, 2, 'out'], ['chamber', 300, 200, 2, 'io'], ['base', 450, 600, 0, 'io']],
  sprawl: [['base', 500, 800, 0, 'io'], ['sprawl', 430, 750, 1, 'out'], ['base', 680, 800, 2, 'io']],
  footwork: [['base', 400, 700, 0, 'io'], ['leadStep', 260, 120, 1, 'io'], ['stepped', 260, 500, 1, 'io'], ['rearBack', 260, 120, 2, 'io'], ['base', 300, 650, 2, 'io']],
};

const EASE = {
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2),
  out: (t) => 1 - (1 - t) ** 3,
};
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (p, q, t) => {
  const out = {};
  for (const key of Object.keys(BASE)) out[key] = Array.isArray(BASE[key]) ? [lerp(p[key][0], q[key][0], t), lerp(p[key][1], q[key][1], t)] : lerp(p[key], q[key], t);
  return out;
};
const P = (pt) => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

function sampleTimeline(steps, ms) {
  const total = steps.reduce((sum, s) => sum + s[1] + s[2], 0);
  let t = ms % total;
  for (let i = 0; i < steps.length; i += 1) {
    const [name, move, hold, phase, curve] = steps[i];
    const from = POSES[steps[(i - 1 + steps.length) % steps.length][0]];
    const to = POSES[name];
    if (t < move) return { pose: mix(from, to, EASE[curve](t / move)), phase, striking: curve === 'out' };
    t -= move;
    if (t < hold) return { pose: to, phase, striking: false, holding: curve === 'out' };
    t -= hold;
  }
  return { pose: BASE, phase: 0 };
}

export default function MmaTechnique({ kind = 'guard', steps, stance = 'orthodox', compact = false }) {
  const timeline = TIMELINES[kind] || TIMELINES.guard;
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [frame, setFrame] = useState(() => ({ pose: BASE, phase: 0 }));
  const [manualPhase, setManualPhase] = useState(0);
  const rootRef = useRef(null);
  const shownRef = useRef(BASE);
  const trailRef = useRef([]);
  const visibleRef = useRef(true);

  useEffect(() => { setManualPhase(0); setPlaying(!reducedMotion()); trailRef.current = []; }, [kind]);

  // Solo quando il manichino è sullo schermo (batteria)
  useEffect(() => {
    if (!rootRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting; });
    io.observe(rootRef.current);
    return () => io.disconnect();
  }, []);

  const manualTarget = useMemo(() => {
    const step = timeline.find((s) => s[3] === manualPhase && s[0] !== 'base') || timeline.find((s) => s[3] === manualPhase) || timeline[0];
    return POSES[step[0]];
  }, [timeline, manualPhase]);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = shownRef.current;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!visibleRef.current) return;
      let next;
      if (playing) {
        next = sampleTimeline(timeline, now - start);
      } else {
        // in pausa: scivola in 320 ms verso la fase scelta
        const t = Math.min(1, (now - start) / 320);
        next = { pose: mix(from, manualTarget, EASE.io(t)), phase: manualPhase, holding: t === 1 && ['jab', 'cross', 'kick'].includes(timeline.find((s) => s[3] === manualPhase)?.[0]) };
      }
      // molleggio da pugile quando è in piedi
      const upright = next.pose.head[1] < 80 ? 1 : 0;
      const bob = playing ? Math.sin(now / 430) * 1.8 * upright : 0;
      const shown = { ...next.pose, bob };
      shownRef.current = next.pose;
      // scia dei pugni/piede che si muovono veloci
      const tip = [shown.fl, shown.fr, shown.ftl];
      const prev = trailRef.current[trailRef.current.length - 1];
      trailRef.current = [...trailRef.current.slice(-7), tip];
      const fast = prev ? tip.map((pt, i) => Math.hypot(pt[0] - prev[i][0], pt[1] - prev[i][1]) > 4) : [false, false, false];
      setFrame({ pose: shown, phase: next.phase, holding: next.holding, fast });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline, manualTarget, manualPhase]);

  const labels = ['jab', 'cross', 'combo'].includes(kind)
    ? ['GUARDIA', kind === 'cross' ? 'CROSS' : 'JAB', kind === 'combo' ? 'CROSS + RIENTRO' : 'RIENTRO']
    : kind === 'kick' ? ['BASE', 'GINOCCHIO', 'ESTENDI + RICHIAMA']
      : kind === 'sprawl' ? ['BASE', 'GAMBE INDIETRO', 'RITORNO']
        : kind === 'footwork' ? ['BASE', 'PASSO AVANTI', 'PASSO INDIETRO']
          : ['BASE', 'GUARDIA CHIUSA', 'PASSO CORTO'];
  const { pose: p, phase, holding, fast = [] } = frame;
  const trail = trailRef.current;
  const impact = holding ? (p.fl[0] > 240 ? p.fl : p.fr[0] > 240 ? p.fr : p.ftl[0] > 240 ? p.ftl : null) : null;
  const limb = (a, b, c, color, width) => <path d={`M${P(a)}L${P(b)}L${P(c)}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;

  return <div ref={rootRef} className={`mma-technique ${compact ? 'compact' : ''}`}>
    <div className="mma-technique-label"><span>SCHEMA DEL MOVIMENTO</span><button onClick={() => { if (playing) setManualPhase(phase); setPlaying((v) => !v); }} aria-label={playing ? 'Ferma schema' : 'Anima schema'}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Ferma' : 'Riproduci'}</button></div>
    <svg viewBox="0 0 340 220" role="img" aria-label={`Schema ${kind}, fase ${phase + 1}: ${labels[phase]}`}>
      <defs><pattern id="mma-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#b4d5df" strokeOpacity=".07" /></pattern></defs>
      <rect width="340" height="220" fill="url(#mma-grid)" />
      <ellipse cx={169 + p.dx} cy="197" rx="103" ry="11" fill="#6de2d3" opacity=".07" />
      <path d="M43 197H297" stroke="#66818a" strokeOpacity=".4" strokeDasharray="3 7" />
      <g transform={stance === 'southpaw' ? 'translate(340 0) scale(-1 1)' : undefined}>
        <g transform={`translate(${p.dx.toFixed(1)} ${(p.bob || 0).toFixed(2)})`}>
          {/* scia: solo sulle estremità che si stanno muovendo veloci */}
          {[0, 1, 2].map((i) => fast[i] && trail.length > 2 && <polyline key={i} points={trail.map((t) => P(t[i])).join(' ')} fill="none" stroke={i === 0 ? '#6de2d3' : i === 1 ? '#b8a4ff' : '#98b9c8'} strokeWidth="6" strokeLinecap="round" strokeOpacity=".28" />)}
          {limb(p.hr, p.kr, p.ftr, '#657b93', 15)}
          {limb(p.hl, p.kl, p.ftl, '#98b9c8', 15)}
          <path d={`M${P(p.sr)}Q${P([(p.sr[0] + p.sl[0]) / 2, Math.min(p.sr[1], p.sl[1]) - 8])} ${P(p.sl)}L${P(p.hl)}Q${P([(p.hl[0] + p.hr[0]) / 2, Math.max(p.hl[1], p.hr[1]) + 8])} ${P(p.hr)}Z`} fill="#253d50" stroke="#7295aa" strokeWidth="1.5" strokeLinejoin="round" />
          {limb(p.sr, p.er, p.fr, '#9eaed2', 10)}
          <circle cx={p.fr[0]} cy={p.fr[1]} r="10" fill="#b8a4ff" />
          <path d={`M${P(p.neck)}L${P([p.neck[0] + (p.head[0] - p.neck[0]) * 0.45, p.neck[1] + (p.head[1] - p.neck[1]) * 0.45])}`} stroke="#a1b4c7" strokeWidth="13" strokeLinecap="round" />
          <ellipse cx={p.head[0]} cy={p.head[1]} rx="15" ry="19" fill="#a1b4c7" transform={`rotate(${((p.head[0] - p.neck[0]) * 1.2).toFixed(1)} ${p.head[0]} ${p.head[1]})`} />
          <path d={`M${p.head[0] + 6} ${p.head[1] + 6}L${p.head[0] + 14} ${p.head[1] + 6}`} stroke="#486079" strokeWidth="2" />
          {limb(p.sl, p.el, p.fl, '#6de2d3', 10)}
          <circle cx={p.fl[0]} cy={p.fl[1]} r="11" fill="#a3f6e7" />
          {impact && <circle cx={impact[0] + 5} cy={impact[1] + 1} r="22" fill="none" stroke="#6de2d3" strokeOpacity=".45" strokeDasharray="3 4" className="mma-technique-impact" />}
        </g>
      </g>
      <text x="20" y="27" fill="#6de2d3" fontSize="10" fontFamily="var(--font-label)" letterSpacing="2">0{phase + 1} / {labels[phase]}</text>
      <text x="20" y="213" fill="#8196a8" fontSize="9" fontFamily="var(--font-body)">Illustrazione della sequenza · non una verifica tecnica</text>
    </svg>
    {!compact && <><div className="mma-technique-steps">{[0, 1, 2].map((i) => <button key={i} aria-pressed={phase === i} onClick={() => { setManualPhase(i); setPlaying(false); }}><b>0{i + 1}</b>{labels[i]}</button>)}</div><p className="mma-technique-instruction" aria-live="polite">{steps[phase]}</p></>}
  </div>;
}

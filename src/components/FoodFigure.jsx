// ─────────────────────────────────────────────────────────────────────────────
// Figura del cibo — disegnata in SVG, zero asset, zero WebGL: funziona ovunque.
//   meal    → ciotola laccata con riso, uovo, cipollotto e bacchette
//   protein → ciotola con bocconcini di carne che saltellano
//   water   → goccia con riflesso + onde
// Vapore, riflessi e scintille si animano da soli (framer-motion su SVG).
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';

const STEAM = [
  { d: 'M 0 46 C -8 34, 8 24, 0 12 C -7 2, 6 -6, 1 -16', x: -18, delay: 0 },
  { d: 'M 0 46 C 9 34, -7 22, 2 10 C 9 0, -5 -8, 2 -18', x: 6, delay: 0.5 },
  { d: 'M 0 46 C -5 32, 7 26, -2 14 C -8 4, 6 -4, 0 -14', x: 28, delay: 1 },
];

function BowlBase({ children }) {
  return (
    <g>
      {/* corpo ciotola */}
      <path d="M 28 104 Q 30 158 100 165 Q 170 158 172 104 Z" fill="url(#fb-bowl)" />
      {/* pennellata lucida sulla ceramica */}
      <path d="M 44 118 Q 60 146 96 152" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" strokeLinecap="round" />
      {/* bordo oro */}
      <ellipse cx="100" cy="104" rx="72" ry="17" fill="#1d1209" />
      <ellipse cx="100" cy="104" rx="72" ry="17" fill="none" stroke="#f5b342" strokeWidth="3.5" />
      {/* interno */}
      <ellipse cx="100" cy="105" rx="59" ry="12.5" fill="#2a1a0e" />
      {children}
    </g>
  );
}

function Meal() {
  return (
    <BowlBase>
      {/* montagnetta di riso */}
      <path d="M 48 104 Q 54 84 72 86 Q 78 72 96 76 Q 106 66 120 76 Q 138 72 144 88 Q 154 92 152 104 Z" fill="url(#fb-rice)" />
      {/* grana del riso */}
      <g stroke="#d8cba8" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
        <path d="M 70 92 l 7 -3" /><path d="M 92 84 l 7 -2" /><path d="M 116 82 l 7 2" /><path d="M 132 92 l 7 3" /><path d="M 104 92 l 7 -2" />
      </g>
      {/* uovo */}
      <ellipse cx="82" cy="97" rx="15" ry="8.5" fill="#fdf6e3" stroke="#e4d5ae" strokeWidth="1" />
      <circle cx="82" cy="96" r="4.6" fill="#fbbf24" />
      <circle cx="80.6" cy="94.8" r="1.5" fill="#fff3c4" />
      {/* cipollotto */}
      <g fill="#4ade80">
        <rect x="112" y="92" width="10" height="3.4" rx="1.7" transform="rotate(-14 117 94)" />
        <rect x="126" y="97" width="9" height="3.2" rx="1.6" transform="rotate(10 130 98)" />
      </g>
      {/* bacchette */}
      <g strokeLinecap="round">
        <motion.line x1="118" y1="52" x2="178" y2="88" stroke="#c9a06a" strokeWidth="4"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.15 }} />
        <motion.line x1="126" y1="44" x2="182" y2="76" stroke="#b8905c" strokeWidth="4"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.25 }} />
      </g>
    </BowlBase>
  );
}

function Protein() {
  const chunks = [
    { x: 74, y: 94, r: -12, s: 1 },
    { x: 104, y: 90, r: 8, s: 1.15 },
    { x: 132, y: 96, r: -6, s: 0.9 },
  ];
  return (
    <BowlBase>
      {chunks.map((c, i) => (
        <motion.g key={i}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}>
          <g transform={`translate(${c.x} ${c.y}) rotate(${c.r}) scale(${c.s})`}>
            <rect x="-13" y="-9" width="26" height="18" rx="8" fill="url(#fb-meat)" />
            <path d="M -8 -3 q 8 -4 16 0" fill="none" stroke="#e9b98a" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <path d="M -8 3 q 8 3 16 0" fill="none" stroke="#5f3113" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          </g>
        </motion.g>
      ))}
      <g fill="#4ade80">
        <rect x="90" y="101" width="9" height="3" rx="1.5" transform="rotate(-10 94 102)" />
        <rect x="118" y="103" width="8" height="2.8" rx="1.4" transform="rotate(12 122 104)" />
      </g>
    </BowlBase>
  );
}

function Water() {
  return (
    <g>
      {/* onde */}
      {[0, 1].map((i) => (
        <motion.ellipse key={i} cx="100" cy="150" rx="20" ry="6"
          fill="none" stroke="#7dd3fc" strokeWidth="2.5"
          animate={{ rx: [18, 62], ry: [5, 17], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }} />
      ))}
      {/* goccia */}
      <motion.g animate={{ y: [0, -9, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M 100 34 C 100 34 62 94 62 122 A 38 38 0 0 0 138 122 C 138 94 100 34 100 34 Z" fill="url(#fb-water)" />
        {/* riflesso */}
        <ellipse cx="86" cy="112" rx="9" ry="16" fill="rgba(255,255,255,0.5)" transform="rotate(18 86 112)" />
        <circle cx="112" cy="88" r="3" fill="rgba(255,255,255,0.7)" />
      </motion.g>
      {/* goccioline */}
      {[{ x: 58, y: 96, d: 0 }, { x: 144, y: 90, d: 0.4 }, { x: 70, y: 60, d: 0.8 }].map((p, i) => (
        <motion.circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#7dd3fc"
          animate={{ y: [0, 14], opacity: [0.9, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: p.d, ease: 'easeIn' }} />
      ))}
    </g>
  );
}

function SteamLayer() {
  return (
    <g transform="translate(100 62)">
      {STEAM.map((s, i) => (
        <motion.path key={i} d={s.d} transform={`translate(${s.x} 0)`}
          fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4.5" strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0], y: [6, -14] }}
          transition={{ duration: 2.1, repeat: Infinity, delay: s.delay, ease: 'easeOut' }} />
      ))}
    </g>
  );
}

function Sparkles({ color = '#ffd24a' }) {
  const pts = [[26, 66], [174, 58], [40, 140], [164, 138], [100, 22], [16, 104], [184, 100]];
  return (
    <g>
      {pts.map((p, i) => (
        <motion.circle key={i} cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 3 : 2}
          fill={i % 2 === 0 ? color : '#ffffff'}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.19, ease: 'easeInOut' }} />
      ))}
    </g>
  );
}

export default function FoodFigure({ kind = 'meal' }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden
      style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="fb-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2417" />
          <stop offset="1" stopColor="#170d06" />
        </linearGradient>
        <linearGradient id="fb-rice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#efe3c2" />
        </linearGradient>
        <linearGradient id="fb-meat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b06a33" />
          <stop offset="1" stopColor="#7a3f18" />
        </linearGradient>
        <linearGradient id="fb-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
        <radialGradient id="fb-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(251,191,36,0.5)" />
          <stop offset="0.7" stopColor="rgba(251,191,36,0.12)" />
          <stop offset="1" stopColor="rgba(251,191,36,0)" />
        </radialGradient>
      </defs>

      {/* alone di luce pulsante */}
      <motion.circle cx="100" cy="104" r="92" fill="url(#fb-halo)"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />

      {/* respiro dell'intera figura */}
      <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
        {kind === 'water' ? <Water /> : kind === 'protein' ? <Protein /> : <Meal />}
        {kind !== 'water' && <SteamLayer />}
      </motion.g>

      <Sparkles />
    </svg>
  );
}

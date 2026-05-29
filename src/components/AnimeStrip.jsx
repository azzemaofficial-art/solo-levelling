import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const animeImages = [
  { src: '/avatar8.png', label: 'Hunter VIII', glyph: '🛡️' },
  { src: '/boss9.png', label: 'Horror IX', glyph: '👾' },
  { src: '/avatar7.png', label: 'Hunter VII', glyph: '⚔️' },
  { src: '/boss7.png', label: 'Dragon VII', glyph: '🐉' },
  { src: '/avatar6.png', label: 'Hunter VI', glyph: '✨' },
  { src: '/boss5.png', label: 'Wolf V', glyph: '🐺' },
  { src: '/avatar5.png', label: 'Hunter V', glyph: '🔥' },
  { src: '/boss3.png', label: 'Warden III', glyph: '☠️' }
];

const AnimeStrip = ({ title = 'Anime Deck' }) => {
  const [failed, setFailed] = useState({});
  const base = useMemo(() => (import.meta.env.BASE_URL || '/').replace(/\/$/, ''), []);
  const resolvePath = (src) => `${base}${src}`;

  return (
    <div className="bg-black/50 border border-white/10 rounded-sm p-4 mb-6">
      <p className="text-[10px] text-indigo-300 uppercase tracking-widest mb-3">{title}</p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {animeImages.map((entry, idx) => (
          <motion.div
            key={`${entry.src}-${idx}`}
            whileHover={{ y: -4, scale: 1.03 }}
            className="relative min-w-[92px] h-[126px] rounded-sm border border-white/10 bg-black/60 overflow-hidden shrink-0"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(56,189,248,0.25),transparent_45%),linear-gradient(145deg,rgba(11,18,32,0.95),rgba(8,8,14,0.98))]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 pointer-events-none">
              <span className="text-2xl">{entry.glyph}</span>
              <span className="text-[9px] uppercase tracking-widest mt-1">{entry.label}</span>
            </div>
            {!failed[entry.src] && (
              <img
                src={resolvePath(entry.src)}
                alt={entry.label}
                loading="lazy"
                className="relative z-10 w-full h-full object-cover"
                onError={() => setFailed((prev) => ({ ...prev, [entry.src]: true }))}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AnimeStrip;

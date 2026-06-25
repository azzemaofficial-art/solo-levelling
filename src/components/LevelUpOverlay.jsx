import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
//  LevelUpOverlay — celebrazione cinematografica stile Solo Leveling quando sali
//  di livello. Pannello "System" blu glow + numero livello oro + scintille che
//  salgono. Auto-dismiss ~3.2s, skippabile al tap.
// ─────────────────────────────────────────────────────────────────────────────

export default function LevelUpOverlay({ level, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      const t = setTimeout(() => onDone?.(), 1800);
      return () => clearTimeout(t);
    }
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const parent = canvas.parentElement;
    let W = 0, H = 0, raf = 0;
    const resize = () => {
      const r = parent.getBoundingClientRect(); W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const sparks = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: H + Math.random() * H * 0.5,
      v: 0.6 + Math.random() * 2.2, r: 0.8 + Math.random() * 2.2,
      c: Math.random() < 0.6 ? '255,210,74' : Math.random() < 0.6 ? '56,189,248' : '255,255,255',
      a: 0.3 + Math.random() * 0.6,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        s.y -= s.v; s.x += Math.sin(s.y * 0.03) * 0.4;
        if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        g.addColorStop(0, `rgba(${s.c},${s.a})`); g.addColorStop(1, `rgba(${s.c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setTimeout(() => onDone?.(), 3200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onDone}
      className="absolute inset-0 z-[998] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(8,16,40,0.92), rgba(2,3,10,0.96))', backdropFilter: 'blur(2px)' }}>
      <canvas ref={ref} className="absolute inset-0 pointer-events-none" />

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        className="relative flex flex-col items-center px-8 py-6 rounded-2xl"
        style={{ border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(8,18,44,0.55)', boxShadow: '0 0 60px rgba(56,189,248,0.35), inset 0 0 40px rgba(56,189,248,0.12)' }}>
        <motion.p
          initial={{ letterSpacing: '0.05em', opacity: 0 }} animate={{ letterSpacing: '0.35em', opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="text-[13px] font-bold uppercase" style={{ color: 'rgba(56,189,248,0.95)' }}>
          ⟢ System ⟣
        </motion.p>
        <p className="mt-2 text-[30px] font-black text-white" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 30px rgba(255,210,74,0.6)' }}>
          LEVEL UP
        </p>
        <motion.div
          initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 12 }}
          className="mt-3 flex items-center gap-2">
          <span className="text-[64px] font-black leading-none"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#ffd24a', textShadow: '0 0 40px rgba(255,210,74,0.8), 0 0 80px rgba(245,179,1,0.5)' }}>
            {level}
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-3 text-[11px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,210,74,0.85)' }}>
          Sei diventato più forte
        </motion.p>
      </motion.div>

      <p className="absolute bottom-5 text-[9px] tracking-widest uppercase text-white/35">tap per continuare</p>
    </motion.div>
  );
}

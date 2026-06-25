import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  TouchSparks — micro-interazione globale: ogni tap/click emette una piccola
//  esplosione di particelle (oro/coral/blu/viola). Canvas fisso, pointer-events
//  NONE (non blocca nulla), transitorio. Rispetta prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ['255,210,74', '255,111,97', '139,92,246', '56,189,248'];

export default function TouchSparks() {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0;
    const parts = [];

    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const burst = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
      const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
      if (x < 0 || y < 0 || x > W || y > H) return;
      const col = COLORS[(Math.random() * COLORS.length) | 0];
      const n = 9 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 1.4 + Math.random() * 3.4;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 1, r: 1.4 + Math.random() * 2.4, col });
      }
      // anello luminoso
      parts.push({ x, y, vx: 0, vy: 0, life: 1, ring: true, r: 4, col });
    };
    window.addEventListener('pointerdown', burst, { passive: true });

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p.ring) {
          p.life -= 0.05; p.r += 2.4;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(${p.col},${p.life * 0.5})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
          continue;
        }
        p.vy += 0.07; p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.life -= 0.025;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(${p.col},${p.life})`); g.addColorStop(1, `rgba(${p.col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', burst);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 z-[900] pointer-events-none" />;
}

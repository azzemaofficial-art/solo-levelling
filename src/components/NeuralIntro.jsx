import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
//  NeuralIntro — intro motion-graphics: cervello translucido con dentro una
//  rete neurale a galassia che pulsa oro neon, particelle coral/viola nello
//  spazio blu elettrico, push-in cinematografico. Canvas 2D, zero dipendenze.
//  Una volta a sessione, skippabile, ~4s. Rispetta prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

const BLUE = [37, 99, 235];
const GOLD = [255, 210, 74];
const VIOLET = [139, 92, 246];
const CORAL = [255, 111, 97];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export default function NeuralIntro({ onDone, duration = 4800 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const [visible, setVisible] = useState(true);
  const [titleIn, setTitleIn] = useState(false);

  const finish = () => {
    cancelAnimationFrame(rafRef.current);
    setVisible(false);
    setTimeout(() => onDone?.(), 650);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    let W = 0, H = 0, cx = 0, cy = 0, dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const r = parent.getBoundingClientRect();
      W = r.width; H = r.height; cx = W / 2; cy = H / 2;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const R = Math.min(W, H) * 0.34; // raggio del cervello/galassia

    // ── Nodi galassia (rete neurale a spirale) ──
    const N = reduce ? 40 : 92;
    const nodes = [];
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const arm = i % 2 === 0 ? 0 : Math.PI; // 2 bracci
      const ang = i * GOLDEN + arm + t * 2.4;
      const rad = R * (0.12 + 0.92 * Math.sqrt(t));
      const jitter = (Math.sin(i * 12.9) * 0.5) * R * 0.07;
      nodes.push({
        x: Math.cos(ang) * rad * 1.05 + jitter,
        y: Math.sin(ang) * rad * 0.82 + jitter,
        z: 0.4 + Math.random() * 0.6,
        r: 0.9 + Math.random() * 1.8,
        c: i % 7 === 0 ? GOLD : i % 4 === 0 ? VIOLET : BLUE,
        ph: Math.random() * Math.PI * 2,
      });
    }
    // edges: collega nodi vicini
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        if (dx * dx + dy * dy < (R * 0.34) ** 2) edges.push([i, j]);
      }
    }
    // pulsi di energia oro che viaggiano lungo gli edge
    const pulses = Array.from({ length: reduce ? 0 : 14 }, () => ({
      e: (Math.random() * edges.length) | 0, t: Math.random(), sp: 0.004 + Math.random() * 0.01,
    }));

    // ── Particelle (coral/viola/oro) nello spazio blu ──
    const P = reduce ? 30 : 120;
    const parts = Array.from({ length: P }, () => {
      const z = 0.2 + Math.random() * 0.8;
      return {
        x: Math.random() * W, y: Math.random() * H, z,
        r: (0.5 + Math.random() * 1.8) * z,
        vx: (Math.random() - 0.5) * 0.25 * z, vy: (Math.random() - 0.5) * 0.25 * z,
        c: Math.random() < 0.5 ? CORAL : Math.random() < 0.6 ? GOLD : VIOLET,
        a: 0.25 + Math.random() * 0.55,
      };
    });

    // forme geometriche morphing (wireframe)
    const shapes = Array.from({ length: reduce ? 0 : 3 }, (_, k) => ({
      x: cx + (k - 1) * R * 0.9, y: cy + Math.sin(k) * R * 0.7,
      s: R * (0.12 + k * 0.04), sides: 3 + k, rot: Math.random() * 6, vr: 0.004 + k * 0.002,
    }));

    const start = performance.now();
    const WHITE = [255, 255, 255];
    let starsSpawned = false;      // climax: la sinapsi esplode in stelle
    const stars = [];

    // silhouette cervello: blob organico "rugoso"
    const brainPath = (scale) => {
      const p = new Path2D();
      const steps = 90;
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const wob = 1 + 0.12 * Math.sin(a * 7) + 0.06 * Math.sin(a * 13 + 1) + 0.04 * Math.sin(a * 3);
        const rx = R * 1.18 * wob * scale, ry = R * 0.96 * wob * scale;
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        if (s === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
      return p;
    };

    const draw = (now) => {
      const el = Math.min(1, (now - start) / (duration - 700));
      const ease = 1 - Math.pow(1 - el, 3);
      const zoom = 1 + ease * 0.22;       // push-in cinematografico
      const settle = el > 0.85 ? Math.max(0, 1 - (el - 0.85) / 0.15) : 1; // finale "congelato"
      const reveal = Math.min(1, el / 0.55); // build-up rete
      if (el > 0.5 && !titleIn) setTitleIn(true);

      // sfondo: radiale blu elettrico → nero
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
      bg.addColorStop(0, 'rgba(12,20,48,1)');
      bg.addColorStop(0.5, 'rgba(6,10,28,1)');
      bg.addColorStop(1, 'rgba(2,3,10,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';

      // particelle di sfondo (lontane)
      for (const p of parts) {
        if (p.z >= 0.55) continue;
        p.x += p.vx * settle; p.y += p.vy * settle;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, rgba(p.c, p.a * 0.6)); g.addColorStop(1, rgba(p.c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 7); ctx.fill();
      }

      // alone del cervello
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
      halo.addColorStop(0, rgba(BLUE, 0.10)); halo.addColorStop(0.6, rgba(VIOLET, 0.06)); halo.addColorStop(1, rgba(BLUE, 0));
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

      // stroke cervello (glow)
      const bp = brainPath(1);
      ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(BLUE, 0.35); ctx.stroke(bp);
      ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(VIOLET, 0.12); ctx.stroke(bp);

      // galassia clippata dentro il cervello
      ctx.save();
      ctx.clip(brainPath(1.02));

      // edges della rete
      ctx.lineWidth = 0.7;
      for (let k = 0; k < edges.length; k++) {
        if (k / edges.length > reveal) continue;
        const a = nodes[edges[k][0]], b = nodes[edges[k][1]];
        ctx.strokeStyle = rgba(BLUE, 0.10);
        ctx.beginPath(); ctx.moveTo(cx + a.x, cy + a.y); ctx.lineTo(cx + b.x, cy + b.y); ctx.stroke();
      }
      // pulsi oro lungo gli edge
      for (const pl of pulses) {
        pl.t += pl.sp; if (pl.t > 1) { pl.t = 0; pl.e = (Math.random() * edges.length) | 0; }
        const e = edges[pl.e]; if (!e) continue;
        const a = nodes[e[0]], b = nodes[e[1]];
        const x = cx + a.x + (b.x - a.x) * pl.t, y = cy + a.y + (b.y - a.y) * pl.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, rgba(GOLD, 0.95)); g.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
      }
      // nodi (sinapsi)
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(now * 0.003 + n.ph);
        const rr = (n.r + pulse) * (0.6 + reveal * 0.6);
        const g = ctx.createRadialGradient(cx + n.x, cy + n.y, 0, cx + n.x, cy + n.y, rr * 4);
        g.addColorStop(0, rgba(n.c, 0.9 * pulse)); g.addColorStop(1, rgba(n.c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + n.x, cy + n.y, rr * 4, 0, 7); ctx.fill();
      }
      ctx.restore(); // fine clip

      // forme geometriche morphing
      for (const sh of shapes) {
        sh.rot += sh.vr;
        ctx.strokeStyle = rgba(CORAL, 0.18); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= sh.sides; i++) {
          const a = sh.rot + (i / sh.sides) * Math.PI * 2;
          const x = sh.x + Math.cos(a) * sh.s, y = sh.y + Math.sin(a) * sh.s;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore(); // fine zoom

      // particelle in primo piano
      for (const p of parts) {
        if (p.z < 0.55) continue;
        p.x += p.vx * settle; p.y += p.vy * settle;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        g.addColorStop(0, rgba(p.c, p.a)); g.addColorStop(1, rgba(p.c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, 7); ctx.fill();
      }

      // ── CLIMAX ORCHESTRATO: la sinapsi centrale sboccia ed esplode in stelle ──
      const bloom = Math.max(0, Math.min(1, (el - 0.58) / 0.34));
      if (bloom > 0) {
        if (!starsSpawned) {
          starsSpawned = true;
          for (let i = 0; i < 170; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 10;
            stars.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.6 + Math.random() * 1.9, c: Math.random() < 0.5 ? GOLD : Math.random() < 0.5 ? WHITE : CORAL, life: 1 });
          }
        }
        const flash = Math.sin(bloom * Math.PI); // 0→1→0: il lampo del fiore
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
        fg.addColorStop(0, rgba(WHITE, 0.5 * flash)); fg.addColorStop(0.35, rgba(GOLD, 0.4 * flash)); fg.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, 7); ctx.fill();
        // shockwave: due anelli che si espandono
        for (let k = 0; k < 2; k++) {
          const rt = bloom - k * 0.16;
          if (rt > 0 && rt < 1) {
            ctx.strokeStyle = rgba(k === 0 ? WHITE : GOLD, (1 - rt) * 0.5);
            ctx.lineWidth = 2.5 - rt * 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, rt * Math.max(W, H) * 0.62, 0, 7); ctx.stroke();
          }
        }
        // le stelle che erompono
        for (const s of stars) {
          s.x += s.vx * settle; s.y += s.vy * settle; s.vx *= 0.985; s.vy *= 0.985; s.life -= 0.012;
          if (s.life <= 0) continue;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
          g.addColorStop(0, rgba(s.c, s.life)); g.addColorStop(1, rgba(s.c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, 7); ctx.fill();
        }
        // dendrite finale: un filamento luminoso che si protende nel buio
        if (bloom > 0.5) {
          const dlen = (bloom - 0.5) * 2 * R * 1.3;
          const grd = ctx.createLinearGradient(cx, cy, cx + dlen, cy - dlen * 0.4);
          grd.addColorStop(0, rgba(GOLD, 0.6)); grd.addColorStop(1, rgba(GOLD, 0));
          ctx.strokeStyle = grd; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + dlen * 0.5, cy - dlen * 0.1, cx + dlen, cy - dlen * 0.4); ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      // vignette
      const vg = ctx.createRadialGradient(cx, cy, R, cx, cy, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      if (now - start < duration) rafRef.current = requestAnimationFrame(draw);
      else finish();
    };
    rafRef.current = requestAnimationFrame(draw);

    const skipTimer = setTimeout(finish, duration);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(skipTimer); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.06 }} transition={{ duration: 0.6 }}
          onClick={finish}
          className="absolute inset-0 z-[999] cursor-pointer overflow-hidden"
          style={{ background: '#02030a' }}>
          <canvas ref={canvasRef} className="absolute inset-0" />
          <div className="absolute inset-x-0 bottom-[18%] flex flex-col items-center pointer-events-none">
            <div className="flex" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {'SOLO LEVELING'.split('').map((ch, i) => (
                <motion.span key={i}
                  initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                  animate={titleIn ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
                  transition={{ delay: 0.045 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[26px] font-black tracking-[0.18em] text-white"
                  style={{ textShadow: '0 0 24px rgba(255,210,74,0.55), 0 0 50px rgba(37,99,235,0.5)', whiteSpace: 'pre' }}>
                  {ch}
                </motion.span>
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: titleIn ? 1 : 0, y: titleIn ? 0 : 8 }}
              transition={{ delay: 0.75, duration: 0.8, ease: 'easeOut' }}
              className="mt-2 text-[10px] tracking-[0.45em] uppercase" style={{ color: 'rgba(255,210,74,0.85)' }}>
              System Awakening
            </motion.p>
          </div>
          <p className="absolute bottom-5 right-5 text-[9px] tracking-widest uppercase text-white/35 pointer-events-none">tap per saltare</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

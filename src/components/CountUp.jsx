import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Numero che sale da 0 al valore (ease-out, ~0,9 s). Senza animazione se il
// sistema chiede meno movimento; ai cambi successivi parte dal valore precedente.
export default function CountUp({ value, decimals = 0, duration = 900 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(target); fromRef.current = target; return undefined; }
    const from = fromRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const next = from + (target - from) * eased;
      setShown(next);
      fromRef.current = next;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

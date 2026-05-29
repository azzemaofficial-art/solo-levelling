import { useCallback, useEffect, useState } from 'react';
import { subscribeShadowFxBurst } from '../utils/fxEvents';

const getTodayIso = () => new Date().toLocaleDateString('en-CA');

const triggerHaptic = (mode = 'light') => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (mode === 'success') navigator.vibrate([12, 20, 16]);
  else if (mode === 'warning') navigator.vibrate([18, 24, 12]);
  else navigator.vibrate(10);
};

export const useFxCombo = () => {
  const [fxPulseKey, setFxPulseKey] = useState(0);
  const [fxBurstKey, setFxBurstKey] = useState(0);
  const [surgeKey, setSurgeKey] = useState(0);
  const [comboProgress, setComboProgress] = useState(() => ({
    date: getTodayIso(),
    count: 0
  }));

  const triggerFxBurst = useCallback((mode = 'light') => {
    setFxPulseKey((prev) => prev + 1);
    setFxBurstKey((prev) => prev + 1);
    triggerHaptic(mode);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeShadowFxBurst(() => {
      triggerFxBurst('success');
      const day = getTodayIso();
      setComboProgress((prev) => {
        const baseCount = prev.date === day ? prev.count : 0;
        const nextCount = baseCount + 1;
        if (nextCount >= 3) {
          setSurgeKey((k) => k + 1);
          triggerHaptic('success');
          return { date: day, count: 0 };
        }
        return { date: day, count: nextCount };
      });
    });
    return unsubscribe;
  }, [triggerFxBurst]);

  return {
    fxPulseKey,
    fxBurstKey,
    surgeKey,
    comboProgress,
    triggerFxBurst
  };
};


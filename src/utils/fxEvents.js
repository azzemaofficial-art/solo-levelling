export const SHADOW_FX_BURST_EVENT = 'shadow_fx_burst';

export const emitShadowFxBurst = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SHADOW_FX_BURST_EVENT));
};

export const subscribeShadowFxBurst = (handler) => {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  window.addEventListener(SHADOW_FX_BURST_EVENT, handler);
  return () => window.removeEventListener(SHADOW_FX_BURST_EVENT, handler);
};


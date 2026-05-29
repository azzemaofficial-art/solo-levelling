export const SHADOW_UI_TOAST_EVENT = 'shadow_ui_toast';

export const emitUiToast = ({ message, tone = 'info', actionLabel = '', onAction = null, durationMs = 9000 } = {}) => {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(SHADOW_UI_TOAST_EVENT, {
    detail: {
      message: String(message),
      tone: String(tone || 'info'),
      actionLabel: String(actionLabel || ''),
      onAction: typeof onAction === 'function' ? onAction : null,
      durationMs: Number(durationMs || 9000)
    }
  }));
};

export const subscribeUiToast = (handler) => {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  window.addEventListener(SHADOW_UI_TOAST_EVENT, handler);
  return () => window.removeEventListener(SHADOW_UI_TOAST_EVENT, handler);
};


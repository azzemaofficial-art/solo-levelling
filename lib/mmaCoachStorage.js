export const MMA_STORE_KEY = 'shadow_monarch_mma_academy_v1';
export function readMmaStore(storage = globalThis.localStorage) {
  try { const value = JSON.parse(storage.getItem(MMA_STORE_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function saveMmaReport(report, storage = globalThis.localStorage) {
  const previous = readMmaStore(storage);
  const history = Array.isArray(previous.history) ? previous.history : [];
  const next = { ...previous, lastSession: report, history: [report, ...history.filter(item => item.id !== report.id)].slice(0, 80),
    done: { ...(previous.done || {}), ...(report.practiced ? { [report.lessonId]: true } : {}) } };
  try { storage.setItem(MMA_STORE_KEY, JSON.stringify(next)); return true; } catch { return false; }
}

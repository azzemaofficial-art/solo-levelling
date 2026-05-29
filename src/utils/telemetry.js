const TELEMETRY_KEY = 'shadow_monarch_telemetry';
const TELEMETRY_LIMIT = 120;

export const getTelemetryEntries = () => {
  const raw = window.localStorage.getItem(TELEMETRY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

export const pushTelemetryEntry = (entry = {}) => {
  const current = getTelemetryEntries();
  const next = [{
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...entry
  }, ...current].slice(0, TELEMETRY_LIMIT);
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(next));
  return next;
};

export const clearTelemetry = () => {
  window.localStorage.removeItem(TELEMETRY_KEY);
};

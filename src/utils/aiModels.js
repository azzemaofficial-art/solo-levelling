// ─────────────────────────────────────────────────────────────────────────────
//  Configurazione modelli AI — default globale + override per funzione.
//  Tutto passa da /api/openrouter/chat (id modello OpenRouter). Vuoto = catena
//  di fallback automatica del proxy. Persistito in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

// Modelli GRATIS via Groq + NVIDIA NIM (proxy /api/ai/chat). Prefisso groq:/nvidia:.
// (Lista provvisoria, verificata sull'endpoint reale dopo il deploy.)
export const AI_MODELS = [
  { id: '', label: 'Automatico (fallback)' },
  { id: 'groq:llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B — veloce' },
  { id: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', label: 'Groq Llama 4 Scout' },
  { id: 'nvidia:qwen/qwen3.5-397b-a17b', label: 'NVIDIA Qwen 3.5 397B — potente' },
  { id: 'nvidia:google/diffusiongemma-26b-a4b-it', label: 'NVIDIA Gemma 26B' },
  { id: 'nvidia:nvidia/nemotron-3-ultra-550b-a55b', label: 'NVIDIA Nemotron Ultra 550B — top' },
  { id: 'nvidia:deepseek-ai/deepseek-v4-pro', label: 'NVIDIA DeepSeek V4 Pro' },
];

// Default consigliati per funzione quando l'utente non ha scelto nulla.
const TASK_DEFAULT = {
  meal: 'groq:llama-3.3-70b-versatile',              // veloce e affidabile su JSON
  recipe: 'nvidia:qwen/qwen3.5-397b-a17b',           // creativo e potente
  profile: 'nvidia:nvidia/nemotron-3-ultra-550b-a55b', // analisi profonda (Nemotron, come volevi)
};

// Prefisso shadow_monarch_ → incluso nel backup cloud (createBackupPayload).
const KEY_GLOBAL = 'shadow_monarch_ai_model_global';
const keyFor = (task) => `shadow_monarch_ai_model_${task}`;

const read = (k) => {
  if (typeof window === 'undefined') return '';
  try { return String(window.localStorage.getItem(k) || '').trim(); } catch { return ''; }
};

export const getGlobalModel = () => read(KEY_GLOBAL);
export const setGlobalModel = (id) => { try { window.localStorage.setItem(KEY_GLOBAL, String(id || '')); } catch {} };

export const getTaskOverride = (task) => read(keyFor(task));
export const setTaskOverride = (task, id) => { try { window.localStorage.setItem(keyFor(task), String(id || '')); } catch {} };

// Modello effettivo per una funzione: override funzione → globale → default funzione.
// Stringa vuota → lascia decidere alla catena di fallback del proxy.
export const getModelFor = (task) => {
  const override = getTaskOverride(task);
  if (override) return override;
  const global = getGlobalModel();
  if (global) return global;
  return TASK_DEFAULT[task] || '';
};

export const labelForModel = (id) => AI_MODELS.find((m) => m.id === id)?.label || id || 'Automatico';

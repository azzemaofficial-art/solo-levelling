// ─────────────────────────────────────────────────────────────────────────────
//  Configurazione modelli AI — default globale + override per funzione.
//  Tutto passa da /api/openrouter/chat (id modello OpenRouter). Vuoto = catena
//  di fallback automatica del proxy. Persistito in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

export const AI_MODELS = [
  { id: '', label: 'Automatico (fallback)' },
  { id: 'google/gemini-flash-1.5', label: 'Gemini Flash — veloce, ottimo JSON' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o-mini — OpenAI' },
  { id: 'google/gemma-2-27b-it', label: 'Gemma 27B — Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 72B' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B — potente, ragionamento' },
];

// Default consigliati per funzione quando l'utente non ha scelto nulla.
const TASK_DEFAULT = {
  meal: 'google/gemini-flash-1.5',                      // JSON preciso e completo
  recipe: 'google/gemini-flash-1.5',                    // niente OpenAI (crediti finiti)
  profile: 'nvidia/llama-3.1-nemotron-70b-instruct',    // analisi profonda + consigli
};

const KEY_GLOBAL = 'sm_ai_model_global';
const keyFor = (task) => `sm_ai_model_${task}`;

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

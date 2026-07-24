// ─────────────────────────────────────────────────────────────────────────────
//  Configurazione modelli AI — default globale + override per funzione.
//  Tutto passa da /api/openrouter/chat (id modello OpenRouter). Vuoto = catena
//  di fallback automatica del proxy. Persistito in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

// Modelli via Groq + NVIDIA NIM (proxy /api/ai/chat) — VERIFICATI funzionanti.
// Prefisso groq:/nvidia: → ogni modello NVIDIA usa la chiave mappata in chat.js.
// Verificati live il 2026-07-22 (probe su /api/ai/chat con campo `tried`):
// rimossi Llama 4 Scout, Kimi K2.6 NIM e Mistral Large 3 → 404/no-key su provider.
export const AI_MODELS = [
  { id: '', label: 'Automatico (fallback)' },
  { id: 'groq:openai/gpt-oss-120b', label: 'Groq GPT-OSS 120B — qualità alta, mai in coda' },
  { id: 'groq:llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B — veloce, JSON pulito' },
  { id: 'groq:openai/gpt-oss-20b', label: 'Groq GPT-OSS 20B — fulmineo' },
  { id: 'nvidia:nvidia/nemotron-3-ultra-550b-a55b', label: 'NVIDIA Nemotron Ultra 550B — il più potente' },
  { id: 'nvidia:mistralai/mistral-nemotron', label: 'NVIDIA Mistral NeMo — macro precisi, veloce (13-17s)' },
];

// Default consigliati per funzione quando l'utente non ha scelto nulla.
const TASK_DEFAULT = {
  meal: 'groq:llama-3.3-70b-versatile',   // veloce e JSON pulito (no reasoning)
  recipe: 'groq:openai/gpt-oss-120b',     // creativo, JSON solido, niente rate-limit 429
  profile: '',                            // usa sempre /api/nvidia/coach direttamente
};

// Prefisso shadow_monarch_ → incluso nel backup cloud (createBackupPayload).
const KEY_GLOBAL = 'shadow_monarch_ai_model_global';
const keyFor = (task) => `shadow_monarch_ai_model_${task}`;

const VALID_IDS = new Set(AI_MODELS.map((m) => m.id));

const read = (k) => {
  if (typeof window === 'undefined') return '';
  try { return String(window.localStorage.getItem(k) || '').trim(); } catch { return ''; }
};

const readValidated = (k) => {
  const val = read(k);
  if (!val) return '';
  if (VALID_IDS.has(val)) return val;
  // modello non più in lista (rimosso da NIM, ecc.) → cancella e usa fallback
  try { window.localStorage.removeItem(k); } catch {}
  return '';
};

export const getGlobalModel = () => readValidated(KEY_GLOBAL);
export const setGlobalModel = (id) => { try { window.localStorage.setItem(KEY_GLOBAL, String(id || '')); } catch {} };

export const getTaskOverride = (task) => readValidated(keyFor(task));
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

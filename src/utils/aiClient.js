import { pushTelemetryEntry } from './telemetry';

const DEFAULT_PROXY_PATH = '/api/ai/chat'; // Groq + NVIDIA NIM (gratis), no crediti OpenRouter
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 22000;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const AI_HISTORY_KEY = 'shadow_monarch_ai_history';
const AI_HISTORY_LIMIT = 20;
const SHADOW_AI_STATUS_EVENT = 'shadow_ai_status';

let queueTail = Promise.resolve();
let inflightCount = 0;
const DEFAULT_MODEL_CANDIDATES = ['groq:openai/gpt-oss-120b', 'groq:openai/gpt-oss-20b'];

const getProxyPath = () => {
  const configured = import.meta.env.VITE_SYSTEM_AI_PROXY;
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  return DEFAULT_PROXY_PATH;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uniqueModels = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};
const getModelCandidates = (explicitModel) => {
  const envList = String(import.meta.env.VITE_OPENROUTER_MODEL_CANDIDATES || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const envPrimary = String(import.meta.env.VITE_OPENROUTER_MODEL || '').trim();
  return uniqueModels([explicitModel, ...envList, envPrimary, ...DEFAULT_MODEL_CANDIDATES]);
};

const withQueue = async (task) => {
  const run = queueTail.then(task, task);
  queueTail = run.catch(() => {});
  return run;
};
const emitAiStatus = (detail = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SHADOW_AI_STATUS_EVENT, { detail }));
};

const parseResponsePayload = async (response) => {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1500, Number(timeoutMs || DEFAULT_TIMEOUT_MS)));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Timeout richiesta AI');
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const toUserFacingDetail = (detail = '') => {
  const text = String(detail || '').trim();
  const lower = text.toLowerCase();
  if (!text) return 'Errore AI temporaneo';
  if (lower.includes('provider returned error')) {
    return 'Provider AI occupato o non disponibile ora';
  }
  if (lower.includes('timeout')) return 'Timeout rete: riprova tra pochi secondi';
  if (lower.includes('rate') || lower.includes('429')) return 'Troppi tentativi ravvicinati: attendi qualche secondo';
  if (lower.includes('401') || lower.includes('api key') || lower.includes('invalid key')) {
    return 'Chiave API non valida o non attiva';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) return 'Connessione non disponibile';
  return text.slice(0, 120);
};

export const formatAiErrorDetail = (detail = '') => toUserFacingDetail(detail);

const createHttpError = (status, payload) => {
  let detail = toUserFacingDetail(payload?.error || payload?.message || `HTTP ${status}`);
  // Il proxy riporta la catena di provider tentati: mostrarla trasforma un generico
  // "Errore AI" in qualcosa di diagnosticabile (es. "70b:429 → 8b:429").
  if (Array.isArray(payload?.tried) && payload.tried.length) {
    const chain = payload.tried.slice(-3).map((t) => String(t).replace(/^\w+:/, '').split('/').pop()).join(' → ');
    detail = `${detail} [${chain}]`.slice(0, 140);
  }
  const error = new Error(detail);
  error.status = status;
  return error;
};

const isRetryableError = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status)) return RETRYABLE_STATUS.has(status);
  return true;
};

// Pulisce una risposta AI grezza: toglie i fence markdown e gli spazi.
const stripFences = (rawContent) =>
  String(rawContent || '').replace(/```json/gi, '').replace(/```/g, '').trim();

// Ritaglia dal primo `open` fino alla chiusura BILANCIATA corrispondente (depth 0),
// rispettando le stringhe (le parentesi dentro le stringhe non contano). Gestisce prosa
// prima e dopo il JSON. Se la risposta è TRONCATA (non si bilancia mai) ritorna null.
const sliceToBalance = (raw, open, close) => {
  const start = raw.indexOf(open);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  return null; // troncato: nessuna chiusura di pari livello trovata
};

// Chiude stringhe e parentesi rimaste aperte (tipico di risposte tagliate a max_tokens),
// rimuove code pendenti (virgole/duepunti finali) e trailing comma prima delle chiusure.
const closeOpenStructures = (input) => {
  let s = input;
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inStr) s += '"';                 // stringa lasciata aperta
  s = s.replace(/\\+$/, '');           // backslash di escape spurio in coda
  s = s.replace(/[\s,:]+$/, '');       // virgola/duepunti/spazi pendenti
  for (let i = stack.length - 1; i >= 0; i--) s += stack[i] === '{' ? '}' : ']';
  return s.replace(/,\s*([}\]])/g, '$1');
};

// Ripara una risposta TRONCATA: prova a chiudere le strutture aperte e, se ancora non
// parsa, retrocede all'ultimo confine di elemento (ultima virgola/chiusura) e riprova —
// così un array o oggetto tagliato a metà salva tutto ciò che è completo invece di esplodere.
const repairTruncatedJson = (candidate) => {
  let s = candidate;
  for (let guard = 0; guard < 80 && s.length > 1; guard++) {
    const closed = closeOpenStructures(s);
    try { return JSON.parse(closed); } catch (_) { /* prova a tagliare più corto */ }
    const cut = Math.max(s.lastIndexOf(','), s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (cut <= 0) break;
    s = s.slice(0, cut);
  }
  return undefined;
};

// Estrae uno per uno gli oggetti top-level `{...}` bilanciati da un array: ognuno viene
// parsato in isolamento, così un ultimo oggetto troncato viene semplicemente scartato e i
// precedenti (interi) si salvano. Ultima rete di sicurezza per gli array di ricette.
const salvageJsonObjects = (candidate) => {
  const objects = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { objects.push(JSON.parse(candidate.slice(objStart, i + 1))); } catch (_) { /* salta */ }
        objStart = -1;
      }
    }
  }
  return objects;
};

// Parsing tollerante di JSON prodotto da modelli: gestisce fence markdown, prosa attorno al
// JSON, trailing commas e — soprattutto — risposte troncate (max_tokens). `prefer` sceglie se
// il valore atteso è un oggetto o un array; 'auto' decide in base a cosa compare per primo.
export const looseJsonParse = (rawContent, prefer = 'auto') => {
  const raw = stripFences(rawContent);
  const oCurly = raw.indexOf('{');
  const oSquare = raw.indexOf('[');
  const useArray = prefer === 'array'
    || (prefer !== 'object' && oSquare >= 0 && (oCurly < 0 || oSquare < oCurly));
  const open = useArray ? '[' : '{';
  const close = useArray ? ']' : '}';
  if (raw.indexOf(open) < 0) throw new Error('Risposta AI non valida (nessun JSON presente)');
  // 1) percorso veloce: ritaglio bilanciato (regge la prosa prima/dopo)
  const balanced = sliceToBalance(raw, open, close);
  if (balanced) {
    try { return JSON.parse(balanced); } catch (_) { /* continua */ }
    try { return JSON.parse(balanced.replace(/,\s*([}\]])/g, '$1')); } catch (_) { /* continua */ }
  }
  // 2) risposta troncata: chiudi e retrocedi all'ultimo elemento completo
  const candidate = raw.slice(raw.indexOf(open));
  const repaired = repairTruncatedJson(candidate);
  if (repaired !== undefined) return repaired;
  // 3) rete finale per gli array: salva gli oggetti interi uno per uno
  if (useArray) {
    const objs = salvageJsonObjects(candidate);
    if (objs.length) return objs;
  }
  throw new Error('Risposta AI non valida (JSON irrecuperabile)');
};

const toSafeNumber = (value, fallback = 0, min = 0, max = 99999) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const toSafeInteger = (value, fallback = 0, min = 0, max = 99999) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const toSafeString = (value, fallback = '', maxLen = 120) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.slice(0, maxLen);
};

const toStringList = (value, fallback = [], maxItems = 10, itemMaxLen = 140) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((entry) => toSafeString(entry, '', itemMaxLen))
    .filter(Boolean)
    .slice(0, maxItems);
  return cleaned.length ? cleaned : fallback;
};

const sanitizeReps = (value) => {
  const text = toSafeString(value, '8-12', 24);
  const nums = text.match(/\d+/g)?.map((v) => Number(v)).filter(Number.isFinite) || [];
  const maxRep = nums.length ? Math.max(...nums) : 12;
  if (maxRep > 25) return '8-15';
  return text;
};

// Fa quadrare le kcal con i macro di UNA ricetta (i modelli sbagliano spesso: kcal
// scollegate dai grammi, o fibre > carboidrati). Stessa filosofia di normalizeMealAnalysis
// ma isolata e riusabile sia dalla ricetta singola sia dalle card del Recipe Forge, che
// finora NON avevano nessun controllo di coerenza. Ritorna interi già sanificati.
export const reconcileRecipeMacros = (raw = {}) => {
  const protein = toSafeInteger(raw.protein, 0, 0, 900);
  const carbs = toSafeInteger(raw.carbs, 0, 0, 1200);
  const fat = toSafeInteger(raw.fat, 0, 0, 700);
  let fiber = toSafeInteger(raw.fiber ?? raw.fibre, 0, 0, 250);
  let kcal = toSafeInteger(raw.kcal, 0, 0, 12000);

  // Le fibre sono un sottoinsieme dei carboidrati: non possono superarli.
  fiber = Math.min(fiber, carbs);

  const kcalFromMacros = Math.round((carbs * 4) + (protein * 4) + (fat * 9));
  if (kcalFromMacros > 0) {
    // Se il modello non ha dato le kcal, usiamo quelle calcolate dai macro.
    if (kcal <= 0) {
      kcal = kcalFromMacros;
    } else {
      // Se le kcal dichiarate divergono troppo dai macro (fuori -26% / +30%),
      // le riportiamo verso il valore fisiologico, tenendo un filo dell'originale.
      const lowerBound = Math.round(kcalFromMacros * 0.74);
      const upperBound = Math.round(kcalFromMacros * 1.3);
      if (kcal < lowerBound || kcal > upperBound) {
        kcal = Math.round((kcalFromMacros * 0.85) + (kcal * 0.15));
      }
    }
  }
  return { kcal, protein, carbs, fat, fiber };
};

const normalizeMealAnalysis = (parsed) => {
  const base = {
    kcal: toSafeInteger(parsed?.kcal, 0, 0, 12000),
    carbs: toSafeInteger(parsed?.carbs, 0, 0, 1200),
    protein: toSafeInteger(parsed?.protein, 0, 0, 900),
    fat: toSafeInteger(parsed?.fat, 0, 0, 700),
    fiber: toSafeInteger(parsed?.fiber ?? parsed?.fibre, 0, 0, 250),
    satFat: toSafeInteger(parsed?.satFat ?? parsed?.sat_fat ?? parsed?.saturatedFat ?? parsed?.saturated_fat, 0, 0, 200),
    monoFat: toSafeInteger(parsed?.monoFat ?? parsed?.mono_fat ?? parsed?.monounsaturatedFat ?? parsed?.monounsaturated_fat, 0, 0, 250),
    polyFat: toSafeInteger(parsed?.polyFat ?? parsed?.poly_fat ?? parsed?.polyunsaturatedFat ?? parsed?.polyunsaturated_fat, 0, 0, 250),
    sugars: toSafeInteger(parsed?.sugars ?? parsed?.sugar, 0, 0, 500),
    sodiumMg: toSafeInteger(parsed?.sodiumMg ?? parsed?.sodium_mg ?? parsed?.sodium, 0, 0, 12000),
    potassiumMg: toSafeInteger(parsed?.potassiumMg ?? parsed?.potassium_mg ?? parsed?.potassium, 0, 0, 12000),
    omega3Mg: toSafeInteger(parsed?.omega3Mg ?? parsed?.omega3_mg ?? parsed?.omega3, 0, 0, 8000),
    calciumMg: toSafeInteger(parsed?.calciumMg ?? parsed?.calcium_mg ?? parsed?.calcium, 0, 0, 4000),
    ironMg: toSafeNumber(parsed?.ironMg ?? parsed?.iron_mg ?? parsed?.iron, 0, 0, 120),
    magnesiumMg: toSafeInteger(parsed?.magnesiumMg ?? parsed?.magnesium_mg ?? parsed?.magnesium, 0, 0, 3000),
    mealSlot: (() => {
      const raw = String(parsed?.mealSlot ?? parsed?.meal_slot ?? '').toLowerCase().trim();
      if (raw === 'breakfast' || raw === 'colazione' || raw === 'morning' || raw === 'brunch') return 'breakfast';
      if (raw === 'lunch' || raw === 'pranzo' || raw === 'midday') return 'lunch';
      if (raw === 'dinner' || raw === 'cena' || raw === 'evening' || raw === 'supper') return 'dinner';
      return '';
    })()
  };

  const totalSubFat = base.satFat + base.monoFat + base.polyFat;
  if (base.fat > 0 && totalSubFat > base.fat) {
    const ratio = base.fat / Math.max(1, totalSubFat);
    base.satFat = Math.round(base.satFat * ratio);
    base.monoFat = Math.round(base.monoFat * ratio);
    base.polyFat = Math.round(base.polyFat * ratio);
  }
  base.fiber = Math.min(base.fiber, base.carbs);
  base.sugars = Math.min(base.sugars, base.carbs);
  if (base.omega3Mg > 0) {
    const maxOmegaFromFat = Math.round(base.fat * 1000);
    base.omega3Mg = Math.min(base.omega3Mg, maxOmegaFromFat);
  }

  const kcalFromMacros = Math.round((base.carbs * 4) + (base.protein * 4) + (base.fat * 9));
  if (kcalFromMacros > 0) {
    const lowerBound = Math.round(kcalFromMacros * 0.74);
    const upperBound = Math.round(kcalFromMacros * 1.3);
    if (base.kcal <= 0) base.kcal = kcalFromMacros;
    if (base.kcal < lowerBound || base.kcal > upperBound) {
      base.kcal = Math.round((kcalFromMacros * 0.85) + (base.kcal * 0.15));
    }
  }

  return base;
};

const normalizeWorkoutAnalysis = (parsed) => ({
  burned: toSafeInteger(parsed?.burned, 0, 0, 5000),
  strength: toSafeInteger(parsed?.strength, 0, 0, 700)
});

const normalizeWorkoutBurnEstimate = (parsed) => {
  const rawConfidence = String(parsed?.confidence || '').toLowerCase().trim();
  const confidence = rawConfidence === 'high' || rawConfidence === 'medium' || rawConfidence === 'low'
    ? rawConfidence
    : 'medium';
  return {
    kcalBurned: toSafeInteger(parsed?.kcalBurned ?? parsed?.kcal_burned ?? parsed?.burned ?? parsed?.kcal, 0, 0, 5000),
    confidence,
    note: toSafeString(parsed?.note, '', 180)
  };
};

const normalizeWorkoutPlan = (parsed) => {
  const rankSet = new Set(['E', 'D', 'C', 'B', 'A', 'S']);
  const safetyWarnings = [];
  const maxTotalSets = 34;
  const main = Array.isArray(parsed?.main)
    ? parsed.main
        .map((exercise, index) => {
          const name = toSafeString(exercise?.name, `Exercise ${index + 1}`, 80);
          const sets = toSafeInteger(exercise?.sets, 3, 1, 8);
          const reps = sanitizeReps(exercise?.reps);
          const restSec = toSafeInteger(exercise?.restSec, 60, 30, 180);
          if (reps !== toSafeString(exercise?.reps, '8-12', 24)) {
            safetyWarnings.push(`Reps adattate su "${name}" per sicurezza articolare.`);
          }
          return {
            name,
            sets,
            reps,
            restSec,
            cue: toSafeString(exercise?.cue, 'Controlla il movimento.', 200)
          };
        })
        .slice(0, 14)
    : [];

  const safeMain = main.length
    ? main
    : [{
        name: 'Bodyweight Squat',
        sets: 3,
        reps: '10-12',
        restSec: 60,
        cue: 'Mantieni il core attivo.'
      }];

  const difficultyRaw = String(parsed?.difficulty || 'C').toUpperCase();
  const difficulty = rankSet.has(difficultyRaw) ? difficultyRaw : 'C';
  const initialDuration = toSafeInteger(parsed?.durationMin, 40, 10, 180);
  const durationMin = Math.min(initialDuration, 95);
  if (durationMin !== initialDuration) {
    safetyWarnings.push('Durata ridotta per mantenere una sessione sostenibile.');
  }

  const totalSets = safeMain.reduce((sum, ex) => sum + (ex.sets || 0), 0);
  let adjustedMain = safeMain;
  if (totalSets > maxTotalSets) {
    let setsBudget = maxTotalSets;
    adjustedMain = safeMain.map((exercise) => {
      const cappedSets = Math.max(1, Math.min(exercise.sets, setsBudget));
      setsBudget -= cappedSets;
      return { ...exercise, sets: cappedSets };
    }).filter((exercise) => exercise.sets > 0);
    safetyWarnings.push('Volume ridotto per evitare sovraccarico eccessivo in una singola seduta.');
  }

  return {
    title: toSafeString(parsed?.title, 'Shadow Protocol', 80),
    difficulty,
    durationMin,
    focus: toSafeString(parsed?.focus, 'Progressive conditioning', 120),
    warmup: toStringList(parsed?.warmup, ['5 min mobilita dinamica'], 8, 120),
    main: adjustedMain,
    finisher: toStringList(parsed?.finisher, ['2 min breath reset'], 6, 120),
    notes: toStringList(parsed?.notes, ['Mantieni tecnica pulita e recupero adeguato.'], 8, 180),
    safetyWarnings: Array.from(new Set(safetyWarnings)).slice(0, 4)
  };
};

const normalizeBossPlan = (parsed) => {
  const allowedMoves = new Set(['roar', 'dash', 'guard']);
  const moves = Array.isArray(parsed?.moves)
    ? parsed.moves
        .map((move) => String(move || '').toLowerCase())
        .filter((move) => allowedMoves.has(move))
        .slice(0, 4)
    : [];
  return {
    moves,
    mood: toSafeString(parsed?.mood, 'adaptive', 32),
    attackBias: toSafeNumber(parsed?.attackBias, 0.62, 0, 1)
  };
};

const schemaNormalizers = {
  meal_analysis: normalizeMealAnalysis,
  workout_analysis: normalizeWorkoutAnalysis,
  workout_burn_estimate: normalizeWorkoutBurnEstimate,
  workout_plan: normalizeWorkoutPlan,
  boss_plan: normalizeBossPlan
};

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

export const getAiHistory = () => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(AI_HISTORY_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
};

export const pushAiHistory = (entry = {}) => {
  if (typeof window === 'undefined') return [];
  const nextEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    kind: String(entry.kind || 'generic'),
    title: String(entry.title || 'AI Entry').slice(0, 60),
    prompt: String(entry.prompt || '').slice(0, 320),
    output: entry.output || null,
    createdAt: new Date().toISOString()
  };
  const current = getAiHistory();
  const next = [nextEntry, ...current].slice(0, AI_HISTORY_LIMIT);
  window.localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(next));
  return next;
};

export const requestSystemAI = async ({ messages, model, maxRetries = DEFAULT_MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, ...options }) => {
  const modelCandidates = getModelCandidates(model);
  const maxAttempts = Math.max(1, Number(maxRetries) + 1);
  const startedAt = Date.now();
  let attemptsUsed = 0;
  let activeModel = modelCandidates[0] || model || DEFAULT_MODEL_CANDIDATES[0];

  return withQueue(async () => {
    inflightCount += 1;
    emitAiStatus({ state: 'busy', inflightCount });
    let lastError = null;
    for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
      activeModel = modelCandidates[modelIndex];
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        attemptsUsed += 1;
        const payload = { model: activeModel, messages, ...options };
        try {
          const response = await fetchWithTimeout(getProxyPath(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }, timeoutMs);
          const data = await parseResponsePayload(response);
          if (!response.ok) throw createHttpError(response.status, data);
          pushTelemetryEntry({
            type: 'ai_request',
            status: 'ok',
            model: activeModel,
            attempts: attemptsUsed,
            durationMs: Date.now() - startedAt
          });
          return data;
        } catch (error) {
          lastError = error;
          const shouldRetry = attempt < maxAttempts - 1 && isRetryableError(error);
          if (shouldRetry) {
            const baseDelayMs = 500 * (2 ** attempt);
            const jitterMs = Math.floor(Math.random() * 260);
            await sleep(baseDelayMs + jitterMs);
            continue;
          }
          break;
        }
      }
    }
    pushTelemetryEntry({
      type: 'ai_request',
      status: 'error',
      model: activeModel,
      attempts: attemptsUsed,
      durationMs: Date.now() - startedAt,
      detail: toUserFacingDetail(lastError?.message || 'unknown error').slice(0, 120)
    });
    throw (lastError || new Error('AI request failed unexpectedly'));
  }).finally(() => {
    inflightCount = Math.max(0, inflightCount - 1);
    emitAiStatus({ state: inflightCount > 0 ? 'busy' : 'idle', inflightCount });
  });
};
export const subscribeAiStatus = (handler) => {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  window.addEventListener(SHADOW_AI_STATUS_EVENT, handler);
  return () => window.removeEventListener(SHADOW_AI_STATUS_EVENT, handler);
};

export const parseModelJson = (data, config = {}) => {
  const content = data?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = looseJsonParse(content, config?.expect || 'object');
  } catch (_) {
    throw new Error('Risposta AI non valida (JSON malformato)');
  }

  const schema = config?.schema;
  if (!schema) return parsed;
  const normalize = schemaNormalizers[schema];
  if (!normalize) return parsed;
  return normalize(parsed);
};

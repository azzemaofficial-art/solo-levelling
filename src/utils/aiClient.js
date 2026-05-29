import { pushTelemetryEntry } from './telemetry';

const DEFAULT_PROXY_PATH = '/api/openrouter/chat';
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 22000;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const AI_HISTORY_KEY = 'shadow_monarch_ai_history';
const AI_HISTORY_LIMIT = 20;
const SHADOW_AI_STATUS_EVENT = 'shadow_ai_status';

let queueTail = Promise.resolve();
let inflightCount = 0;
const DEFAULT_MODEL_CANDIDATES = ['qwen/qwen3.6-plus:free', 'openai/gpt-4o-mini'];

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
  const detail = toUserFacingDetail(payload?.error || payload?.message || `HTTP ${status}`);
  const error = new Error(detail);
  error.status = status;
  return error;
};

const isRetryableError = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status)) return RETRYABLE_STATUS.has(status);
  return true;
};

const extractJsonCandidate = (raw) => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
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
  const raw = String(data?.choices?.[0]?.message?.content || '').replace(/```json/g, '').replace(/```/g, '').trim();
  const candidate = extractJsonCandidate(raw);
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (_) {
    throw new Error('Risposta AI non valida (JSON malformato)');
  }

  const schema = config?.schema;
  if (!schema) return parsed;
  const normalize = schemaNormalizers[schema];
  if (!normalize) return parsed;
  return normalize(parsed);
};

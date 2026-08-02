// ─────────────────────────────────────────────────────────────────────────────
//  Proxy System AI — Groq + NVIDIA NIM (OpenAI-compatible). NESSUN credito
//  OpenRouter: usa le chiavi gratuite già attive (le stesse del live coach).
//  Routing per prefisso id modello:  "groq:<model>"  |  "nvidia:<model>"
//  Ids non prefissati/sconosciuti → ignorati, si passa alla catena di fallback.
// ─────────────────────────────────────────────────────────────────────────────

// I modelli NIM (es. Nemotron 550B) possono superare i 15s di default: senza questo
// Vercel uccide la funzione a metà risposta e il client vede "Ricetta fallita".
export const config = { maxDuration: 60 };

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';
// Endpoint OpenAI-compatibile di Anthropic: stessa forma chat/completions, auth Bearer,
// così si incastra nel proxy senza casi speciali. Attivo SOLO se esiste ANTHROPIC_API_KEY
// (a pagamento) — senza key resolveProvider ritorna null e Claude viene saltato.
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
// Agnes AI — gateway OpenAI-compatibile (POST /v1/chat/completions, auth Bearer). Uso ampio,
// contesto grande (agnes-2.5-flash: 512K). Attivo solo se esiste AGNES_API_KEY.
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';

const firstKey = (...names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return '';
};

const GROQ_KEY = () => firstKey('GROQ_API_KEY');
const ANTHROPIC_KEY = () => firstKey('ANTHROPIC_API_KEY');
const AGNES_KEY = () => firstKey('AGNES_API_KEY');

// Mapping modello NVIDIA → chiave specifica (ogni modello ha la sua key su NIM)
const NVIDIA_MODEL_KEY = {
  'nvidia/nemotron-3-ultra-550b-a55b': () => firstKey('NVIDIA_550B_API_KEY'),
  'deepseek-ai/deepseek-v4-pro':       () => firstKey('DEEPSEEK_PRO_API_KEY'),
  'moonshotai/kimi-k2.6':              () => firstKey('KIMI_NVIDIA_API_KEY'),
  'meta/llama-3.1-70b-instruct':       () => firstKey('LLAMA_NVIDIA_API_KEY'),
  'microsoft/phi-4-mini-instruct':     () => firstKey('PHI_NVIDIA_API_KEY'),
  'mistralai/mistral-large-3-675b-instruct-2512': () => firstKey('MISTRAL_NVIDIA_API_KEY'),
  'mistralai/mistral-medium-3.5-128b': () => firstKey('MISTRAL_MEDIUM3_NVIDIA_API_KEY'),
  // Verificato live 2026-07-24: risponde 200, JSON pulito (fence markdown, gestito
  // da looseJsonParse), 13-17s — più veloce e affidabile di Nemotron 550B per le ricette.
  'mistralai/mistral-nemotron': () => firstKey('MISTRAL_NEMO_NVIDIA_API_KEY'),
};
const NVIDIA_KEY_DEFAULT = () => firstKey('NVIDIA_API_KEY', 'LLAMA_NVIDIA_API_KEY', 'KIMI_NVIDIA_API_KEY', 'DEEPSEEK_PRO_API_KEY');

// Catena di fallback sempre disponibile (modelli VERIFICATI live il 2026-07-22).
// gpt-oss-120b prima: qualità alta, JSON pulito e — a differenza del 70B — non va
// in rate-limit 429 sotto carico (batch Recipe Forge da 12+ chiamate consecutive).
const FALLBACK = [
  // Agnes 2.0 Flash in cima: se AGNES_API_KEY è impostata la proviamo per prima (uso ampio,
  // contesto grande, JSON pulito ~9-10s). Senza key resolveProvider ritorna null → si passa
  // oltre. NB: agnes-2.5-flash è escluso dalla catena — in default consuma tutto il budget in
  // reasoning e torna content vuoto (usabile solo con reasoning_effort:"none").
  'agnes:agnes-2.0-flash',
  'groq:openai/gpt-oss-120b',
  'groq:llama-3.3-70b-versatile',
  'groq:openai/gpt-oss-20b',
  'groq:llama-3.1-8b-instant',
  // Ultima risorsa fuori-Groq: se Groq è interamente in 429, NIM risponde comunque
  // (lento ma verificato 200) — meglio una risposta in 20s che nessuna.
  'nvidia:nvidia/nemotron-3-ultra-550b-a55b',
  // Rete di sicurezza FINALE a pagamento: entra in gioco solo se TUTTO il resto ha
  // fallito E esiste ANTHROPIC_API_KEY. Senza la key viene saltato (nessun costo).
  'anthropic:claude-haiku-4-5-20251001',
];

function resolveProvider(modelId) {
  const id = String(modelId || '').trim();
  if (!id) return null;
  if (id.startsWith('groq:')) {
    const key = GROQ_KEY();
    return key ? { base: GROQ_BASE, key, model: id.slice(5), tag: id } : null;
  }
  if (id.startsWith('nvidia:')) {
    const modelName = id.slice(7);
    const keyFn = NVIDIA_MODEL_KEY[modelName] || NVIDIA_KEY_DEFAULT;
    const key = keyFn();
    return key ? { base: NVIDIA_BASE, key, model: modelName, tag: id } : null;
  }
  if (id.startsWith('anthropic:')) {
    const key = ANTHROPIC_KEY();
    return key ? { base: ANTHROPIC_BASE, key, model: id.slice(10), tag: id } : null;
  }
  if (id.startsWith('agnes:')) {
    const key = AGNES_KEY();
    return key ? { base: AGNES_BASE, key, model: id.slice(6), tag: id } : null;
  }
  return null; // id non prefissato (es. vecchi id OpenRouter) → salta al fallback
}

const unique = (arr) => { const s = new Set(); const o = []; for (const x of arr) { if (x && !s.has(x)) { s.add(x); o.push(x); } } return o; };

// I modelli gpt-oss (Groq) sono "reasoning": senza reasoning_effort esplicito
// possono riempire TUTTO il max_tokens col ragionamento interno prima di arrivare
// alla risposta finale — il client vede `content` pieno di "We need to output..."
// invece del JSON atteso (bug reale trovato testando Recipe Forge). low = risposte
// dirette, adatto a JSON strutturato; il chiamante può comunque sovrascriverlo.
const isReasoningModel = (modelName) => /^openai\/gpt-oss/i.test(String(modelName || ''));

async function callProvider(prov, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const payload = { ...body, model: prov.model };
    if (isReasoningModel(prov.model) && payload.reasoning_effort === undefined) {
      payload.reasoning_effort = 'low';
    }
    const upstream = await fetch(`${prov.base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: upstream.ok, status: upstream.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/ai/chat',
      providers: {
        groq: Boolean(GROQ_KEY()),
        nvidia: Boolean(NVIDIA_KEY_DEFAULT()),
        anthropic: Boolean(ANTHROPIC_KEY()),
        agnes: Boolean(AGNES_KEY()),
      },
      nvidiaKeySource: ['NVIDIA_550B_API_KEY', 'DEEPSEEK_PRO_API_KEY', 'KIMI_NVIDIA_API_KEY', 'LLAMA_NVIDIA_API_KEY', 'MISTRAL_NVIDIA_API_KEY', 'NVIDIA_API_KEY']
        .filter((n) => process.env[n]),
      fallback: FALLBACK,
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { messages, model } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }
  // payload upstream senza il nostro campo model (lo impone il provider)
  const { model: _m, ...rest } = body;

  const candidates = unique([model, ...FALLBACK]);
  let lastErr = null;
  const tried = [];
  for (const cand of candidates) {
    const prov = resolveProvider(cand);
    if (!prov) { tried.push(`${cand}(no-key/unknown)`); continue; }
    try {
      const r = await callProvider(prov, rest);
      tried.push(`${cand}:${r.status}`);
      if (r.ok && r.data?.choices?.[0]?.message) {
        // Pulisci il ragionamento dei modelli reasoning (es. Nemotron): <think>…</think>
        const msg = r.data.choices[0].message;
        if (typeof msg.content === 'string') {
          msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<\/?think>\s*/gi, '').trim();
        }
        // Alcuni modelli reasoning separano il ragionamento dal contenuto: se il content
        // arriva vuoto (budget esaurito nel reasoning) prova gli altri campi noti —
        // message.reasoning (gpt-oss Groq) e reasoning_content (Agnes).
        if (!msg.content && typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
          msg.content = msg.reasoning.trim();
        }
        // Content ancora vuoto → questo provider non ha prodotto una risposta usabile
        // (tipico di un reasoning model troncato): non restituirlo, prova il successivo.
        if (msg.content && String(msg.content).trim()) {
          res.setHeader('X-Shadow-Model', cand);
          return res.status(200).json({ ...r.data, _shadowMeta: { model: cand, fallbackUsed: cand !== model, tried } });
        }
        tried[tried.length - 1] = `${cand}:${r.status}(empty)`;
        lastErr = 'risposta vuota (reasoning senza content)';
        continue;
      }
      lastErr = r.data?.error?.message || r.data?.error || `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e?.message || 'fetch error';
      tried.push(`${cand}:ERR`);
    }
  }
  return res.status(502).json({ error: String(lastErr || 'Nessun provider disponibile'), tried });
}

// Proxy universale AI — gestisce groq: / nvidia: / modelli OpenRouter.
// VITE_SYSTEM_AI_PROXY punta qui; il prefisso nel model ID determina il provider.

const GROQ_BASE    = 'https://api.groq.com/openai/v1';
const NVIDIA_BASE  = 'https://integrate.api.nvidia.com/v1';
const OR_BASE      = 'https://openrouter.ai/api/v1';

const firstKey = (...names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return '';
};

// Mapping modello NVIDIA → chiave specifica (stessa logica di api/ai/chat.js)
const NVIDIA_MODEL_KEY = {
  'nvidia/nemotron-3-ultra-550b-a55b':           () => firstKey('NVIDIA_550B_API_KEY'),
  'deepseek-ai/deepseek-v4-pro':                 () => firstKey('DEEPSEEK_PRO_API_KEY'),
  'moonshotai/kimi-k2.6':                        () => firstKey('KIMI_NVIDIA_API_KEY'),
  'meta/llama-3.1-70b-instruct':                 () => firstKey('LLAMA_NVIDIA_API_KEY'),
  'microsoft/phi-4-mini-instruct':               () => firstKey('PHI_NVIDIA_API_KEY'),
  'mistralai/mistral-large-3-675b-instruct-2512':() => firstKey('MISTRAL_NVIDIA_API_KEY'),
  'mistralai/mistral-medium-3.5-128b':           () => firstKey('MISTRAL_MEDIUM3_NVIDIA_API_KEY'),
};
const NVIDIA_KEY_DEFAULT = () => firstKey('NVIDIA_API_KEY', 'LLAMA_NVIDIA_API_KEY', 'KIMI_NVIDIA_API_KEY');

// Groq fallback chain (sempre disponibili)
const GROQ_FALLBACK = ['groq:llama-3.3-70b-versatile', 'groq:llama-3.1-8b-instant'];

const unique = (items) => {
  const out = []; const seen = new Set();
  for (const item of items) {
    const v = String(item || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out;
};

// Risolve prefisso → { base, key, model } oppure null se non supportato
function resolveProvider(modelId) {
  const id = String(modelId || '').trim();
  if (!id) return null;

  if (id.startsWith('groq:')) {
    const key = firstKey('GROQ_API_KEY');
    return key ? { base: GROQ_BASE, key, model: id.slice(5) } : null;
  }

  if (id.startsWith('nvidia:')) {
    const modelName = id.slice(7);
    const key = (NVIDIA_MODEL_KEY[modelName] || NVIDIA_KEY_DEFAULT)();
    return key ? { base: NVIDIA_BASE, key, model: modelName } : null;
  }

  // Modello senza prefisso → OpenRouter
  const key = firstKey('OPENROUTER_API_KEY');
  return key ? { base: OR_BASE, key, model: id, isOpenRouter: true } : null;
}

async function callProvider(prov, body, isOpenRouter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  try {
    const headers = { Authorization: `Bearer ${prov.key}`, 'Content-Type': 'application/json' };
    if (isOpenRouter) {
      headers['HTTP-Referer'] = process.env.OPENROUTER_APP_URL || 'https://solo-levelling-gold.vercel.app';
      headers['X-Title'] = process.env.OPENROUTER_APP_TITLE || 'solo-leveling-fit';
    }
    const upstream = await fetch(`${prov.base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, model: prov.model }),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: upstream.ok, status: upstream.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/openrouter/chat',
      providers: {
        groq: Boolean(firstKey('GROQ_API_KEY')),
        nvidia: Boolean(NVIDIA_KEY_DEFAULT()),
        openrouter: Boolean(firstKey('OPENROUTER_API_KEY')),
      },
      fallback: GROQ_FALLBACK,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { messages, model: requestModel } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }

  // Catena: modello richiesto → groq fallback
  const candidates = unique([requestModel, ...GROQ_FALLBACK]);
  const { model: _m, ...rest } = body;

  let lastErr = null;
  const tried = [];

  for (const cand of candidates) {
    const prov = resolveProvider(cand);
    if (!prov) { tried.push(`${cand}(no-key)`); continue; }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await callProvider(prov, rest, prov.isOpenRouter);
        tried.push(`${cand}:${r.status}`);

        if (r.ok && r.data?.choices?.[0]?.message) {
          const msg = r.data.choices[0].message;
          if (typeof msg.content === 'string') {
            msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          }
          res.setHeader('X-Shadow-Model', cand);
          return res.status(200).json({ ...r.data, _shadowMeta: { model: cand, tried } });
        }

        lastErr = r.data?.error?.message || r.data?.error || `HTTP ${r.status}`;
        const retryable = [429, 500, 502, 503].includes(r.status);
        if (retryable && attempt < 1) { await sleep(400); continue; }
        break;
      } catch (e) {
        lastErr = e?.message || 'fetch error';
        tried.push(`${cand}:ERR`);
        if (attempt < 1) { await sleep(400); continue; }
      }
    }
  }

  return res.status(502).json({ error: String(lastErr || 'Nessun provider disponibile'), tried });
}

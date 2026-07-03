// ─────────────────────────────────────────────────────────────────────────────
//  Proxy System AI — Groq + NVIDIA NIM (OpenAI-compatible). NESSUN credito
//  OpenRouter: usa le chiavi gratuite già attive (le stesse del live coach).
//  Routing per prefisso id modello:  "groq:<model>"  |  "nvidia:<model>"
//  Ids non prefissati/sconosciuti → ignorati, si passa alla catena di fallback.
// ─────────────────────────────────────────────────────────────────────────────

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const firstKey = (...names) => {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return '';
};

const GROQ_KEY = () => firstKey('GROQ_API_KEY');

// Mapping modello NVIDIA → chiave specifica (ogni modello ha la sua key su NIM)
const NVIDIA_MODEL_KEY = {
  'nvidia/nemotron-3-ultra-550b-a55b': () => firstKey('NVIDIA_550B_API_KEY'),
  'deepseek-ai/deepseek-v4-pro':       () => firstKey('DEEPSEEK_PRO_API_KEY'),
  'moonshotai/kimi-k2.6':              () => firstKey('KIMI_NVIDIA_API_KEY'),
  'meta/llama-3.1-70b-instruct':       () => firstKey('LLAMA_NVIDIA_API_KEY'),
  'microsoft/phi-4-mini-instruct':     () => firstKey('PHI_NVIDIA_API_KEY'),
  'mistralai/mistral-large-3-675b-instruct-2512': () => firstKey('MISTRAL_NVIDIA_API_KEY'),
  'mistralai/mistral-medium-3.5-128b': () => firstKey('MISTRAL_MEDIUM3_NVIDIA_API_KEY'),
};
const NVIDIA_KEY_DEFAULT = () => firstKey('NVIDIA_API_KEY', 'LLAMA_NVIDIA_API_KEY', 'KIMI_NVIDIA_API_KEY', 'DEEPSEEK_PRO_API_KEY');

// Catena di fallback sempre disponibile (modelli che reggiamo per certo).
const FALLBACK = ['groq:llama-3.3-70b-versatile', 'groq:llama-3.1-8b-instant'];

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
  return null; // id non prefissato (es. vecchi id OpenRouter) → salta al fallback
}

const unique = (arr) => { const s = new Set(); const o = []; for (const x of arr) { if (x && !s.has(x)) { s.add(x); o.push(x); } } return o; };

async function callProvider(prov, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(`${prov.base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/ai/chat',
      providers: {
        groq: Boolean(GROQ_KEY()),
        nvidia: Boolean(NVIDIA_KEY()),
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
        res.setHeader('X-Shadow-Model', cand);
        return res.status(200).json({ ...r.data, _shadowMeta: { model: cand, fallbackUsed: cand !== model, tried } });
      }
      lastErr = r.data?.error?.message || r.data?.error || `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e?.message || 'fetch error';
      tried.push(`${cand}:ERR`);
    }
  }
  return res.status(502).json({ error: String(lastErr || 'Nessun provider disponibile'), tried });
}

// NVIDIA NIM fitness/nutrition AI coach
// tier: 'max' → tenta 550B prima; default → chain veloce
// web: true → Tavily search iniettata nel contesto prima dell'LLM

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE   = 'https://api.groq.com/openai/v1';
const TAVILY_BASE = 'https://api.tavily.com';

const SYSTEM_PROMPT = `Sei un coach AI specializzato in fitness, nutrizione e salute.
Hai accesso a conoscenze su:
- Allenamenti: schede, progressione, esercizi, recupero
- Nutrizione: macronutrienti, calorie, piani alimentari, timing dei pasti
- Integratori: proteine, creatina, vitamine, omega-3, BCAA, pre-workout
- Ricette: ingredienti, preparazione, valori nutrizionali
- Composizione corporea: dimagrimento, massa muscolare, recomposizione

Rispondi sempre in italiano. Sii preciso, pratico e conciso.
Quando suggerisci ricette, includi sempre macro approssimativi (proteine/carb/grassi/kcal).
Quando parli di integratori, cita dosaggi evidence-based.`;

// Parole che suggeriscono bisogno di info aggiornate da web
const WEB_TRIGGERS = /oggi|adesso|attual|recente|2025|2026|notizie|news|studio|ricerca|scopert|prezzo|costo|disponibil|ultimo|nuov|aggiornament|migliore.*2\d{3}|classifica|versus|vs\b/i;

const PROVIDERS_FAST = [
  { name: 'groq-70b',       key: () => process.env.GROQ_API_KEY,                  base: GROQ_BASE,   model: () => 'llama-3.3-70b-versatile' },
  { name: 'groq-8b',        key: () => process.env.GROQ_API_KEY,                  base: GROQ_BASE,   model: () => 'llama-3.1-8b-instant' },
  { name: 'kimi-k2',        key: () => process.env.KIMI_NVIDIA_API_KEY,           base: NVIDIA_BASE, model: () => process.env.KIMI_NVIDIA_MODEL || 'moonshotai/kimi-k2.6' },
  { name: 'llama-3.1-70b',  key: () => process.env.LLAMA_NVIDIA_API_KEY,         base: NVIDIA_BASE, model: () => 'meta/llama-3.1-70b-instruct' },
  { name: 'phi4-mini',      key: () => process.env.PHI_NVIDIA_API_KEY,            base: NVIDIA_BASE, model: () => 'microsoft/phi-4-mini-instruct' },
  { name: 'mistral-large3', key: () => process.env.MISTRAL_NVIDIA_API_KEY,        base: NVIDIA_BASE, model: () => 'mistralai/mistral-large-3-675b-instruct-2512' },
  { name: 'mistral-medium3',key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY,base: NVIDIA_BASE, model: () => process.env.MISTRAL_MEDIUM3_NVIDIA_MODEL || 'mistralai/mistral-medium-3.5-128b' },
  { name: 'nemotron-nano',  key: () => process.env.NVIDIA_API_KEY,                base: NVIDIA_BASE, model: () => process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' },
];

const PROVIDERS_MAX = [
  { name: 'nemotron-550b',  key: () => process.env.NVIDIA_550B_API_KEY,           base: NVIDIA_BASE, model: () => process.env.NVIDIA_550B_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b' },
  { name: 'deepseek-v4pro', key: () => process.env.DEEPSEEK_PRO_API_KEY,          base: NVIDIA_BASE, model: () => process.env.DEEPSEEK_PRO_MODEL || 'deepseek-ai/deepseek-v4-pro' },
  ...PROVIDERS_FAST,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${TAVILY_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'basic',
        max_results: 4,
        include_answer: true,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    // Costruisce contesto: risposta diretta + snippet dei risultati
    const parts = [];
    if (data.answer) parts.push(`Risposta sintetica: ${data.answer}`);
    (data.results || []).forEach((r, i) => {
      parts.push(`[${i + 1}] ${r.title}\n${r.content?.slice(0, 300) || ''}`);
    });
    return parts.join('\n\n');
  } catch {
    return null;
  }
}

async function callProvider(apiKey, model, baseUrl, messages, maxTokens = 1024) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // SSE/NDJSON fallback (es. Mistral Medium 3)
      const lines = text.split('\n').filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'));
      for (let i = lines.length - 1; i >= 0; i--) {
        try { const c = JSON.parse(lines[i].slice(6)); if (c.choices) { data = c; break; } } catch {}
      }
      if (!data) return { ok: false, status: res.status, data: {} };
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, endpoint: '/api/nvidia/coach', tiers: ['fast', 'max'], web: !!process.env.TAVILY_API_KEY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, tier, web, webQuery } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }

  const providers = tier === 'max' ? PROVIDERS_MAX : PROVIDERS_FAST;
  const maxTokens = tier === 'max' ? 2048 : 1024;

  // Ultima query dell'utente per decidere se cercare su web
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  let webContext = null;
  let usedWeb = false;

  // web:true forza la ricerca; webQuery sovrascrive la query Tavily
  if (web || WEB_TRIGGERS.test(lastUserMsg)) {
    webContext = await tavilySearch(webQuery || lastUserMsg);
    if (webContext) usedWeb = true;
  }

  // Costruisce system prompt finale, iniettando web context se disponibile
  let finalSystem = systemPrompt || SYSTEM_PROMPT;
  if (webContext) {
    finalSystem += `\n\n---\nRISULTATI WEB AGGIORNATI (usa queste info per rispondere):\n${webContext}\n---\nCita la fonte solo se rilevante. Rispondi sempre in italiano.`;
  }

  const fullMessages = [
    { role: 'system', content: finalSystem },
    ...messages,
  ];

  for (const provider of providers) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    const model = provider.model();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callProvider(apiKey, model, provider.base, fullMessages, maxTokens);
        const msg = data?.choices?.[0]?.message;
        const content = msg?.content || msg?.reasoning_content || msg?.reasoning;
        if (ok && content) {
          res.setHeader('X-Coach-Provider', provider.name);
          res.setHeader('X-Coach-Model', model);
          res.setHeader('X-Coach-Web', usedWeb ? '1' : '0');
          return res.status(200).json({ content, provider: provider.name, model, web: usedWeb });
        }
        if ([429, 500, 502, 503].includes(status) && attempt < 1) { await sleep(500); continue; }
        break;
      } catch (_) {
        if (attempt < 1) { await sleep(500); continue; }
      }
    }
  }

  return res.status(503).json({ error: 'Tutti i provider NVIDIA non disponibili. Riprova.' });
}

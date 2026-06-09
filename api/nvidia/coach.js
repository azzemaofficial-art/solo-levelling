// NVIDIA NIM fitness/nutrition AI coach
// Models: Kimi K2.6 (primary) → Mistral Medium 3 → Nemotron Nano (fallback)

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

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

const PROVIDERS = [
  {
    name: 'kimi',
    key: () => process.env.KIMI_NVIDIA_API_KEY,
    model: () => process.env.KIMI_NVIDIA_MODEL || 'moonshotai/kimi-k2.6',
  },
  {
    name: 'mistral-large3',
    key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: () => process.env.MISTRAL_LARGE3_NVIDIA_MODEL || 'mistralai/mistral-large-3-675b-instruct-2512',
  },
  {
    name: 'nemotron-super-120b',
    key: () => process.env.NEMOTRON_SUPER_API_KEY,
    model: () => process.env.NEMOTRON_SUPER_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
  },
  {
    name: 'qwq-80b',
    key: () => process.env.QWQ_NVIDIA_API_KEY,
    model: () => process.env.QWQ_NVIDIA_MODEL || 'qwen/qwen3-next-80b-a3b-instruct',
  },
  {
    name: 'mistral-small4',
    key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: () => process.env.MISTRAL_SMALL4_NVIDIA_MODEL || 'mistralai/mistral-small-4-119b-2603',
  },
  {
    name: 'step-3.7',
    key: () => process.env.STEP37_NVIDIA_API_KEY,
    model: () => process.env.STEP37_NVIDIA_MODEL || 'stepfun-ai/step-3.7-flash',
  },
  {
    name: 'mistral-medium3',
    key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY,
    model: () => process.env.MISTRAL_MEDIUM3_NVIDIA_MODEL || 'mistralai/mistral-medium-3-instruct',
  },
  {
    name: 'nemotron',
    key: () => process.env.NVIDIA_API_KEY,
    model: () => process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callNvidia(apiKey, model, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
      signal: controller.signal,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, endpoint: '/api/nvidia/coach', providers: PROVIDERS.map((p) => p.name) });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, systemPrompt } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
    ...messages,
  ];

  for (const provider of PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    const model = provider.model();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callNvidia(apiKey, model, fullMessages);
        if (ok && data?.choices?.[0]?.message) {
          res.setHeader('X-Coach-Provider', provider.name);
          res.setHeader('X-Coach-Model', model);
          return res.status(200).json({
            content: data.choices[0].message.content,
            provider: provider.name,
            model,
          });
        }
        if ([429, 500, 502, 503].includes(status) && attempt < 1) {
          await sleep(500);
          continue;
        }
        break;
      } catch (_) {
        if (attempt < 1) { await sleep(500); continue; }
      }
    }
  }

  return res.status(503).json({ error: 'Tutti i provider NVIDIA non disponibili. Riprova.' });
}

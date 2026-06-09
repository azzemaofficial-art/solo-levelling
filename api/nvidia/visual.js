// NVIDIA NIM visual learning live — Cosmos 3 Nano Reasoner
// Accetta un frame base64 dalla camera e restituisce analisi fitness in tempo reale

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const SYSTEM_PROMPT = `Sei un coach fitness visivo AI. Analizzi frame video della camera in tempo reale.
Quando vedi un esercizio in esecuzione:
- Identifica l'esercizio
- Analizza la forma/postura (errori principali)
- Dai 1-2 correzioni immediate e pratiche
- Valuta il livello di esecuzione (1-10)

Rispondi SEMPRE in italiano. Sii brevissimo e diretto (max 3 frasi).
Se non vedi un esercizio, descrivi cosa vedi e suggerisci cosa mostrare.`;

async function callVision(apiKey, model, imageBase64, mimeType, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const imageUrl = `data:${mimeType};base64,${imageBase64}`;

  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: userPrompt || 'Analizza questo frame e dimmi come migliorare.' },
            ],
          },
        ],
        max_tokens: 256,
        temperature: 0.4,
      }),
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
    return res.status(200).json({
      ok: true,
      endpoint: '/api/nvidia/visual',
      model: process.env.COSMOS3_NVIDIA_MODEL || 'nvidia/cosmos3-nano-reasoner',
      hasKey: Boolean(process.env.COSMOS3_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg', prompt } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 obbligatorio' });
  }

  // Prova Cosmos 3 prima, fallback su Nemotron multimodale
  const providers = [
    {
      key: process.env.COSMOS3_NVIDIA_API_KEY,
      model: process.env.COSMOS3_NVIDIA_MODEL || 'nvidia/cosmos3-nano-reasoner',
      name: 'cosmos3',
    },
    {
      key: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      name: 'nemotron-omni',
    },
  ];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const { ok, data } = await callVision(p.key, p.model, imageBase64, mimeType, prompt);
      if (ok && data?.choices?.[0]?.message?.content) {
        res.setHeader('X-Visual-Provider', p.name);
        return res.status(200).json({
          content: data.choices[0].message.content,
          provider: p.name,
          model: p.model,
        });
      }
    } catch (_) {}
  }

  return res.status(503).json({ error: 'Visual AI non disponibile. Verifica chiave COSMOS3_NVIDIA_API_KEY.' });
}

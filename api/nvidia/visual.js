// NVIDIA NIM visual learning live — Cosmos 3 Nano Reasoner
// Supporta modalità: fitness, martial (arti marziali), general

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const SYSTEM_PROMPTS = {
  fitness: `Sei un coach fitness visivo AI. Analizzi frame video della camera in tempo reale.
Quando vedi un esercizio in esecuzione:
- Identifica l'esercizio
- Analizza la forma/postura (errori principali)
- Dai 1-2 correzioni immediate e pratiche
- Valuta il livello di esecuzione (1-10)
Rispondi SEMPRE in italiano. Sii brevissimo e diretto (max 3 frasi).
Se non vedi un esercizio, descrivi cosa vedi e suggerisci cosa mostrare.`,

  martial: `Sei un maestro di arti marziali AI con esperienza in karate, muay thai, boxe, BJJ, MMA, kung fu, krav maga.
Analizzi frame video della camera in tempo reale durante l'allenamento.

Analisi prioritaria:
1. **Tecnica rilevata**: identifica il colpo, la guardia, il movimento o la presa
2. **Posizione**: piedi, baricentro, guardia, angolo del corpo
3. **Errore principale**: cosa correggeresti subito
4. **Correzione pratica**: 1 istruzione precisa e immediata (es. "gomito più alto", "punta il piede avanti")
5. **Punteggio tecnica**: X/10

Se vedi guardia: analizza equilibrio, copertura, distanza mani-mento.
Se vedi un colpo: analizza rotazione dell'anca, estensione, retrattazione.
Se vedi proiezione/presa: analizza grips, leverage, posizione del corpo.

Rispondi in italiano. Max 4 righe. Sii preciso come un coach a bordo ring.`,

  general: `Sei un coach AI visivo. Analizza il frame e descrivi cosa vedi,
identificando attività fisica, postura, movimento o esercizio.
Dai feedback costruttivo in italiano, max 3 frasi.`,
};

async function callVision(apiKey, model, imageBase64, mimeType, systemPrompt, userPrompt) {
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
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: userPrompt || 'Analizza questo frame.' },
            ],
          },
        ],
        max_tokens: 300,
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
      modes: Object.keys(SYSTEM_PROMPTS),
      model: process.env.COSMOS3_NVIDIA_MODEL || 'nvidia/cosmos3-nano-reasoner',
      hasKey: Boolean(process.env.COSMOS3_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg', prompt, mode = 'fitness' } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 obbligatorio' });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.fitness;

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
      const { ok, data } = await callVision(p.key, p.model, imageBase64, mimeType, systemPrompt, prompt);
      if (ok && data?.choices?.[0]?.message?.content) {
        res.setHeader('X-Visual-Provider', p.name);
        res.setHeader('X-Visual-Mode', mode);
        return res.status(200).json({
          content: data.choices[0].message.content,
          provider: p.name,
          model: p.model,
          mode,
        });
      }
    } catch (_) {}
  }

  return res.status(503).json({ error: 'Visual AI non disponibile. Verifica chiave COSMOS3_NVIDIA_API_KEY.' });
}

// NVIDIA NIM visual live coach — Llama Vision 90B primary
// Supporta modalità: fitness, martial (arti marziali), general

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const SYSTEM_PROMPTS = {
  fitness: `Sei un personal trainer visivo AI in tempo reale. Guardi un frame della camera dell'atleta.
Il tuo compito è GUIDARE attivamente, non solo analizzare.

STRUTTURA RISPOSTA (sempre in questo ordine):
1. 🎯 **Esercizio/Posizione**: cosa stai vedendo (o cosa vuoi che l'atleta faccia)
2. 📐 **Postura**: come deve mettersi — piedi, schiena, bacino, testa (istruzione diretta, tipo "piedi larghi spalle, punte fuori 30°")
3. 🔁 **Prossima azione**: di' esattamente cosa fare ora (es. "Scendi in squat, coscia parallela, 3 secondi giù — fai 10 reps")
4. ⚠️ **Correzione** (solo se vedi un errore): 1 istruzione precisa e immediata
5. ✅ **Punteggio forma**: X/10

Se l'atleta è fermo/in attesa: proponi il prossimo esercizio con reps e postura di partenza.
Rispondi in italiano. Max 5 righe. Sii diretto come un trainer che ti sta accanto.`,

  martial: `Sei un maestro di arti marziali AI in sessione live. Guardi un frame della camera.
Discipline: karate, muay thai, boxe, BJJ, MMA, kung fu, krav maga.
Il tuo compito è GUIDARE l'allenamento, non solo giudicare.

STRUTTURA RISPOSTA (sempre in questo ordine):
1. 🥊 **Tecnica vista**: identifica colpo, guardia, movimento, presa o posizione neutra
2. 📐 **Postura attuale**: piedi, baricentro, guardia, angolo spalle (descrivi rapidamente)
3. ➡️ **Prossima istruzione**: di' esattamente cosa fare adesso (es. "Metti guardia sinistra avanti — jab diretto × 5, poi gancio destro × 5")
4. ⚠️ **Errore principale**: se ne vedi uno, 1 correzione sola (es. "Gomito sinistro troppo basso — alzalo al mento")
5. ⭐ **Punteggio tecnica**: X/10

Se vedi posizione neutra/riposo: prescrivi il prossimo drill con reps e postura di partenza.
Se sei in auto-mode ogni 6s: segui la progressione logica della sessione (warm-up → tecnica → combo → conditioning).
Rispondi in italiano. Max 5 righe. Tono da coach a bordo ring.`,

  general: `Sei un coach AI visivo in tempo reale. Guardi un frame della camera.
GUIDA l'atleta attivamente:
1. Di' cosa stai vedendo (postura, movimento, posizione)
2. Di' cosa fare adesso (esercizio, posizione, azione specifica con reps se applicabile)
3. Dai 1 correzione se necessario
Rispondi in italiano, max 4 righe, tono diretto e pratico.`,
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
        max_tokens: 450,
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

  // Ordine: Llama Vision 90B → Phi-4 Multimodal → Cosmos 3 → Nemotron Omni (fallback)
  const providers = [
    {
      key: process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
      model: process.env.LLAMA_VISION90B_NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct',
      name: 'llama-vision-90b',
    },
    {
      key: process.env.PHI4_NVIDIA_API_KEY,
      model: process.env.PHI4_NVIDIA_MODEL || 'microsoft/phi-4-multimodal-instruct',
      name: 'phi4-multimodal',
    },
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

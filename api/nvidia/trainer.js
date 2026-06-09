// Personal Trainer AI — Kimi K2.6 come agente primario
// Gestisce: calorie/macro, ricette, schede allenamento, integratori

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const TRAINER_SYSTEM = `Sei un personal trainer e nutrizionista AI certificato. Il tuo nome è SHADOW COACH.
Hai competenze in:
- Calcolo TDEE, fabbisogno calorico, ripartizione macronutrienti (proteine/carboidrati/grassi)
- Piani alimentari personalizzati con ricette complete (ingredienti, preparazione, macro precisi)
- Schede di allenamento progressive (forza, ipertrofia, dimagrimento, sport specifico)
- Integratori: evidence-based, dosaggi corretti, timing ottimale, interazioni
- Arti marziali: conditioning, mobilità, forza specifica per atleti marziali

FORMATO RISPOSTA:
- Usa sempre emoji per le sezioni (🔥 Calorie, 🥩 Proteine, 💪 Allenamento, ecc.)
- Per ricette: includi SEMPRE macro completi (Proteine Xg | Carboidrati Xg | Grassi Xg | Kcal X)
- Per schede: specifica serie × ripetizioni × recupero
- Per integratori: dosaggio + timing + note scientifiche
- Rispondi sempre in italiano
- Sii preciso come un vero professionista, non generico

Quando l'utente chiede il piano calorico, chiedi (o usa quelli forniti):
- Peso, altezza, età, sesso
- Livello attività (sedentario/moderato/attivo/molto attivo)
- Obiettivo (dimagrimento/mantenimento/massa/recomposizione)
- Sport praticato (es. arti marziali, palestra, ecc.)`;

const PROVIDERS = [
  {
    name: 'kimi-k2',
    key: () => process.env.KIMI_NVIDIA_API_KEY,
    model: () => process.env.KIMI_NVIDIA_MODEL || 'moonshotai/kimi-k2.6',
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
    name: 'nemotron-550b',
    key: () => process.env.NVIDIA_550B_API_KEY,
    model: () => process.env.NVIDIA_550B_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
  },
  {
    name: 'mistral-medium3',
    key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY,
    model: () => process.env.MISTRAL_MEDIUM3_NVIDIA_MODEL || 'mistralai/mistral-medium-3-instruct',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callNvidia(apiKey, model, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.6 }),
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
      endpoint: '/api/nvidia/trainer',
      primaryAgent: 'kimi-k2.6',
      capabilities: ['calorie/macro', 'ricette', 'schede allenamento', 'integratori', 'arti marziali'],
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, profile } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }

  // Inietta il profilo utente nel sistema se fornito
  let systemContent = TRAINER_SYSTEM;
  if (profile) {
    const profileStr = Object.entries(profile)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    systemContent += `\n\nPROFILO UTENTE ATTUALE: ${profileStr}`;
  }

  const fullMessages = [{ role: 'system', content: systemContent }, ...messages];

  for (const provider of PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    const model = provider.model();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callNvidia(apiKey, model, fullMessages);
        if (ok && data?.choices?.[0]?.message) {
          res.setHeader('X-Trainer-Provider', provider.name);
          res.setHeader('X-Trainer-Model', model);
          return res.status(200).json({
            content: data.choices[0].message.content,
            provider: provider.name,
            model,
          });
        }
        if ([429, 500, 502, 503].includes(status) && attempt < 1) { await sleep(600); continue; }
        break;
      } catch (_) {
        if (attempt < 1) { await sleep(600); continue; }
      }
    }
  }

  return res.status(503).json({ error: 'Personal trainer AI non disponibile. Riprova.' });
}

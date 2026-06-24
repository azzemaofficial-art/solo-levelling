// Visual Coach Session Analyzer
// Riceve tutti i feedback AI raccolti durante la sessione e produce un'analisi completa:
// pattern ricorrenti, errori sistematici, piano di miglioramento

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const ANALYSIS_SYSTEM = `Sei un coach biomeccanico AI specializzato in analisi delle performance sportive.
Hai ricevuto una serie di feedback visivi raccolti durante una sessione di allenamento.
Il tuo compito è identificare pattern ricorrenti, errori sistematici e progressi nella sessione.

FORMATO RISPOSTA (usa esattamente questi separatori):
🔴 PROBLEMI RICORRENTI
[Lista errori che appaiono più volte — sii specifico, cita i feedback originali]

🟡 AREE DA MIGLIORARE
[Punti tecnici su cui l'atleta deve lavorare nelle prossime sessioni]

🟢 PROGRESSI OSSERVATI
[Elementi positivi, miglioramenti, punti di forza rilevati]

📋 PIANO PROSSIMA SESSIONE
[3-5 esercizi/drill specifici per correggere gli errori più frequenti]

Rispondi sempre in italiano. Sii preciso e tecnico come un coach professionista.
NON ripetere i feedback originali per intero — analizza i pattern, non elencare.`;

const PROVIDERS = [
  { name: 'kimi-k2', key: () => process.env.KIMI_NVIDIA_API_KEY, model: 'moonshotai/kimi-k2.6', base: NVIDIA_BASE },
  { name: 'groq-llama', key: () => process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', base: GROQ_BASE },
  { name: 'diffusiongemma', key: () => process.env.QWEN35_NVIDIA_API_KEY, model: 'google/diffusiongemma-26b-a4b-it', base: NVIDIA_BASE },
  { name: 'nvidia-nano', key: () => process.env.NVIDIA_API_KEY, model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', base: NVIDIA_BASE },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callAI(apiKey, model, base, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.6 }),
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
    return res.status(200).json({ ok: true, endpoint: '/api/nvidia/visual-analysis' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { feedbacks, discipline, mode } = req.body || {};
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    return res.status(400).json({ error: 'feedbacks[] obbligatorio' });
  }

  const disciplineLabel = discipline || mode || 'allenamento';
  const feedbackText = feedbacks
    .map((f, i) => `[Frame ${i + 1}] ${f.trim()}`)
    .join('\n\n');

  const messages = [
    { role: 'system', content: ANALYSIS_SYSTEM },
    {
      role: 'user',
      content: `Disciplina: ${disciplineLabel}\nNumero di frame analizzati: ${feedbacks.length}\n\nFEEDBACK RACCOLTI DURANTE LA SESSIONE:\n\n${feedbackText}\n\nProduci l'analisi completa della sessione.`,
    },
  ];

  for (const provider of PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) continue;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callAI(apiKey, provider.model, provider.base, messages);
        if (ok && data?.choices?.[0]?.message?.content) {
          const content = data.choices[0].message.content
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();
          return res.status(200).json({ content, provider: provider.name, model: provider.model });
        }
        if ([429, 500, 502, 503].includes(status) && attempt < 1) { await sleep(800); continue; }
        break;
      } catch (_) {
        if (attempt < 1) { await sleep(800); continue; }
      }
    }
  }

  return res.status(503).json({ error: 'Analisi sessione non disponibile. Riprova.' });
}

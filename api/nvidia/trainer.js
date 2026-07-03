// Personal Trainer AI — Shadow Coach
// Gestisce: calorie/macro, ricette, schede allenamento, integratori

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE   = 'https://api.groq.com/openai/v1';
const TAVILY_BASE = 'https://api.tavily.com';

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
  { name: 'groq-70b',        key: () => process.env.GROQ_API_KEY,                   base: GROQ_BASE,   model: () => 'llama-3.3-70b-versatile' },
  { name: 'groq-8b',         key: () => process.env.GROQ_API_KEY,                   base: GROQ_BASE,   model: () => 'llama-3.1-8b-instant' },
  { name: 'kimi-k2',     key: () => process.env.KIMI_NVIDIA_API_KEY,            base: NVIDIA_BASE, model: () => process.env.KIMI_NVIDIA_MODEL || 'moonshotai/kimi-k2.6' },
  { name: 'llama-3.1-70b',   key: () => process.env.LLAMA_NVIDIA_API_KEY,          base: NVIDIA_BASE, model: () => 'meta/llama-3.1-70b-instruct' },
  { name: 'phi4-mini',       key: () => process.env.PHI_NVIDIA_API_KEY,             base: NVIDIA_BASE, model: () => 'microsoft/phi-4-mini-instruct' },
  { name: 'mistral-large3',  key: () => process.env.MISTRAL_NVIDIA_API_KEY,         base: NVIDIA_BASE, model: () => 'mistralai/mistral-large-3-675b-instruct-2512' },
  { name: 'step-3.7',        key: () => process.env.STEP27_NVIDIA_API_KEY,          base: NVIDIA_BASE, model: () => 'stepfun-ai/step-3.7-flash' },
  { name: 'mistral-medium3', key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY, base: NVIDIA_BASE, model: () => process.env.MISTRAL_MEDIUM3_NVIDIA_MODEL || 'mistralai/mistral-medium-3.5-128b' },
  { name: 'nemotron-nano',   key: () => process.env.NVIDIA_API_KEY,                 base: NVIDIA_BASE, model: () => 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' },
  { name: 'nemotron-550b',   key: () => process.env.NVIDIA_550B_API_KEY,            base: NVIDIA_BASE, model: () => 'nvidia/nemotron-3-ultra-550b-a55b' },
];

// Trigger per ricerche web legate a nutrizione, allenamento, integratori
const WEB_TRIGGERS = /oggi|adesso|attual|recente|2025|2026|studio|ricerca|scopert|ultimo|nuov|aggiornament|migliore.*2\d{3}|classifica|versus|vs\b|prezzo|costo|disponibil|integratore.*miglior|miglior.*integratore|proteina.*2\d{3}|creatina.*studio|omega.*ricerca|bcaa.*2\d{3}/i;

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

async function callProvider(apiKey, model, baseUrl, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.6 }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
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

  // Web search Tavily se la query lo richiede
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  let webContext = null;
  let usedWeb = false;

  if (WEB_TRIGGERS.test(lastUserMsg)) {
    webContext = await tavilySearch(lastUserMsg);
    if (webContext) usedWeb = true;
  }

  if (webContext) {
    systemContent += `\n\n---\nRISULTATI WEB AGGIORNATI (usa queste info per rispondere):\n${webContext}\n---\nCita la fonte solo se rilevante. Rispondi sempre in italiano.`;
  }

  const fullMessages = [{ role: 'system', content: systemContent }, ...messages];

  for (const provider of PROVIDERS) {
    const apiKey = provider.key();
    if (!apiKey) continue;
    const model = provider.model();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callProvider(apiKey, model, provider.base, fullMessages);
        const msg = data?.choices?.[0]?.message;
        const content = msg?.content || msg?.reasoning_content || msg?.reasoning;
        if (ok && content) {
          res.setHeader('X-Trainer-Provider', provider.name);
          res.setHeader('X-Trainer-Model', model);
          res.setHeader('X-Trainer-Web', usedWeb ? '1' : '0');
          return res.status(200).json({ content, provider: provider.name, model, web: usedWeb });
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

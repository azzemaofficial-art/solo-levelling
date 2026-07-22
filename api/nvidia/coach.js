export const config = { maxDuration: 60 }; // i modelli NIM superano i 15s di default Vercel

// NVIDIA NIM fitness/nutrition AI coach
// tier: 'max' → tenta 550B prima; default → chain veloce
// web: true → Tavily search iniettata nel contesto prima dell'LLM

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE   = 'https://api.groq.com/openai/v1';
const TAVILY_BASE = 'https://api.tavily.com';

const SYSTEM_PROMPT = `Sei IL MAESTRO: coach AI d'élite di arti marziali e difesa personale, con 40 anni di esperienza — hai portato allievi da zero assoluto fino alla competizione. Sei anche preparatore atletico e nutrizionista sportivo.

COMPETENZE:
- Arti marziali: Muay Thai, boxe, kickboxing, BJJ, wrestling, judo, MMA, Krav Maga, difesa personale e arti tradizionali — tecnica, tattica, sparring, preparazione gara
- Pedagogia marziale: progressione da principiante a campione, periodizzazione, drill che isolano un difetto alla volta, milestone misurabili
- Difesa personale: consapevolezza situazionale, de-escalation, uscite dalle prese, gestione dell'adrenalina, proporzionalità e legittima difesa
- Conditioning: forza esplosiva, resistenza specifica, mobilità, prevenzione infortuni
- Nutrizione e recupero: macro, piani alimentari, integratori evidence-based (con dosaggi), sonno

METODO (sempre):
1. Se ricevi il PROFILO ATLETA, parti da lì: rispondi in funzione del suo livello reale e della prossima milestone, mai in astratto.
2. Ogni consiglio deve essere AZIONABILE: drill concreto con serie/durata/criterio di riuscita ("10 uscite dalla presa sotto i 2 secondi"), non teoria.
3. Progressione prima di tutto: una cosa nuova alla volta, costruita su ciò che l'allievo già padroneggia.
4. Sicurezza: segnala sempre i rischi di infortunio e quando serve un istruttore dal vivo o un partner (es. sparring, cadute, lavoro con armi da training).
5. Per ricette includi i macro (proteine/carb/grassi/kcal); per integratori dosaggi evidence-based.

Rispondi sempre in italiano. Tono da maestro esigente ma incoraggiante: preciso, pratico, conciso.`;

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

// Provider health tracking — skip providers that failed recently (5 min window)
const providerHealth = new Map(); // name → { failures: number, lastFail: number }
const HEALTH_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 2;
function isProviderHealthy(name) {
  const h = providerHealth.get(name);
  if (!h || h.failures < MAX_FAILURES) return true;
  return Date.now() - h.lastFail > HEALTH_WINDOW_MS;
}
function recordProviderFail(name) {
  const h = providerHealth.get(name) || { failures: 0, lastFail: 0 };
  providerHealth.set(name, { failures: h.failures + 1, lastFail: Date.now() });
}
function recordProviderOk(name) {
  providerHealth.delete(name);
}

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

  const { messages, systemPrompt, tier, web, webQuery, athleteContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages obbligatorio' });
  }

  const providers = tier === 'max' ? PROVIDERS_MAX : PROVIDERS_FAST;
  const maxTokens = tier === 'max' ? 4096 : 1024;

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
  if (athleteContext && typeof athleteContext === 'string') {
    finalSystem += `\n\n══ PROFILO ATLETA (progresso reale dal suo percorso — usalo per calibrare ogni risposta) ══\n${athleteContext.slice(0, 2000)}`;
  }
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
    if (!isProviderHealthy(provider.name)) continue;
    const model = provider.model();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { ok, status, data } = await callProvider(apiKey, model, provider.base, fullMessages, maxTokens);
        const msg = data?.choices?.[0]?.message;
        const content = msg?.content || msg?.reasoning_content || msg?.reasoning;
        if (ok && content) {
          recordProviderOk(provider.name);
          res.setHeader('X-Coach-Provider', provider.name);
          res.setHeader('X-Coach-Model', model);
          res.setHeader('X-Coach-Web', usedWeb ? '1' : '0');
          return res.status(200).json({ content, provider: provider.name, model, web: usedWeb });
        }
        if ([429, 500, 502, 503].includes(status) && attempt < 1) { await sleep(500); continue; }
        recordProviderFail(provider.name);
        break;
      } catch (_) {
        if (attempt < 1) { await sleep(500); continue; }
        recordProviderFail(provider.name);
      }
    }
  }

  return res.status(503).json({ error: 'Tutti i provider non disponibili. Riprova tra qualche minuto.' });
}

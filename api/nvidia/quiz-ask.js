// Quiz Arena — single-model endpoint, chiamato in parallelo dal frontend
// POST { modelId, question, options:[A,B,C,D], correct } → JSON result

const NVIDIA_BASE     = 'https://integrate.api.nvidia.com/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const MODELS = {
  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  'kimi':          { name:'Kimi K2.6',           emoji:'🌙', color:'#06b6d4', provider:'nvidia',     envKey:'KIMI_NVIDIA_API_KEY',           model:'moonshotai/kimi-k2.6',                            maxTokens: 50  },
  'mistral-large': { name:'Mistral Large 675B',   emoji:'🌪️', color:'#3b82f6', provider:'nvidia',     envKey:'MISTRAL_SMALL4_NVIDIA_API_KEY',  model:'mistralai/mistral-large-3-675b-instruct-2512' },
  'nemotron':      { name:'Nemotron 120B',        emoji:'⚡', color:'#f59e0b', provider:'nvidia',     envKey:'NEMOTRON_SUPER_API_KEY',         model:'nvidia/nemotron-3-super-120b-a12b' },
  'step':          { name:'Step 3.7',             emoji:'🚀', color:'#10b981', provider:'nvidia',     envKey:'STEP37_NVIDIA_API_KEY',          model:'stepfun-ai/step-3.7-flash' },
  'qwq':           { name:'QwQ 80B',              emoji:'🧩', color:'#8b5cf6', provider:'nvidia',     envKey:'QWQ_NVIDIA_API_KEY',             model:'qwen/qwen3-next-80b-a3b-instruct' },
  // ── OpenRouter ────────────────────────────────────────────────────────────
  'gpt4o-mini':    { name:'GPT-4o Mini',          emoji:'🤖', color:'#e5e7eb', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'openai/gpt-4o-mini' },
  'deepseek-v3':   { name:'DeepSeek V3',          emoji:'🐋', color:'#22d3ee', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'deepseek/deepseek-chat-v3-0324' },
  'llama33':       { name:'Llama 3.3 70B',        emoji:'🦙', color:'#f97316', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'meta-llama/llama-3.3-70b-instruct' },
  'qwen25':        { name:'Qwen 2.5 72B',         emoji:'🐉', color:'#e879f9', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'qwen/qwen-2.5-72b-instruct' },
  'mistral-nemo':  { name:'Mistral Nemo',         emoji:'🔮', color:'#f43f5e', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'mistralai/mistral-nemo' },
  'gemma3-12b':    { name:'Gemma 3 12B',          emoji:'💎', color:'#34d399', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'google/gemma-3-12b-it' },
  'gemma3n':       { name:'Gemma 3n E4B',         emoji:'🔵', color:'#60a5fa', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'google/gemma-3n-e4b-it' },
  'llama32-3b':    { name:'Llama 3.2 3B',         emoji:'🦎', color:'#a3e635', provider:'openrouter', envKey:'OPENROUTER_API_KEY',             model:'meta-llama/llama-3.2-3b-instruct' },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      contestants: Object.entries(MODELS).map(([id, m]) => ({
        id, name: m.name, emoji: m.emoji, color: m.color, provider: m.provider,
      })),
    });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { modelId, question, options, correct } = req.body || {};
  const cfg = MODELS[modelId];
  if (!cfg) return res.status(400).json({ error: 'unknown model' });

  const key = process.env[cfg.envKey];
  if (!key) {
    return res.status(200).json({ id: modelId, name: cfg.name, emoji: cfg.emoji, color: cfg.color, answer: '?', latencyMs: 0, isCorrect: false, error: 'no_key' });
  }

  const base    = cfg.provider === 'openrouter' ? OPENROUTER_BASE : NVIDIA_BASE;
  const letters = ['A', 'B', 'C', 'D'];
  const prompt  = `Question: ${question}\n\n${options.map((o, i) => `${letters[i]}) ${o}`).join('\n')}\n\nAnswer with ONLY the single letter A, B, C, or D. No other text.`;
  const t0      = Date.now();

  try {
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (cfg.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://solo-levelling-gold.vercel.app';
      headers['X-Title']      = 'Solo Levelling AI Quiz';
    }

    const body = JSON.stringify({
      model:       cfg.model,
      messages: [
        { role: 'system', content: 'You are in a multiple-choice quiz competition. You MUST reply with ONLY one letter: A, B, C, or D. Nothing else. No punctuation. No explanation. Just the single letter.' },
        { role: 'user',   content: prompt },
      ],
      max_tokens:  cfg.maxTokens || 10,
      temperature: 0.0,
    });

    // Single automatic retry on 429 (NVIDIA NIM rate limit)
    let resp = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body, signal: AbortSignal.timeout(28000) });
    if (resp.status === 429) {
      await new Promise(r => setTimeout(r, 3000));
      resp = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body, signal: AbortSignal.timeout(24000) });
    }

    const data = await resp.json();

    if (!resp.ok) {
      const errMsg = data?.error?.message || data?.message || JSON.stringify(data).slice(0, 120);
      return res.status(200).json({
        id: modelId, name: cfg.name, emoji: cfg.emoji, color: cfg.color,
        answer: '?', latencyMs: Date.now() - t0, isCorrect: false,
        error: `http_${resp.status}`, errorDetail: errMsg,
      });
    }

    const raw    = data?.choices?.[0]?.message?.content || '';
    const match  = raw.match(/\b([ABCD])\b/i) || raw.match(/([ABCD])/i);
    const answer = match ? match[1].toUpperCase() : '?';

    return res.status(200).json({
      id: modelId, name: cfg.name, emoji: cfg.emoji, color: cfg.color,
      answer, latencyMs: Date.now() - t0, isCorrect: answer === correct,
    });
  } catch (err) {
    return res.status(200).json({
      id: modelId, name: cfg.name, emoji: cfg.emoji, color: cfg.color,
      answer: '?', latencyMs: Date.now() - t0, isCorrect: false,
      error: 'timeout', errorDetail: err?.message?.slice(0, 80),
    });
  }
}

// AI Quiz Arena — 11 modelli (6 NVIDIA NIM + 5 OpenRouter) in SSE streaming
// GET  → lista concorrenti
// POST { question, options:[A,B,C,D], correct:'A'|'B'|'C'|'D' } → SSE stream

const NVIDIA_BASE     = 'https://integrate.api.nvidia.com/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const CONTESTANTS = [
  {
    id: 'kimi', name: 'Kimi K2.6', emoji: '🌙', color: '#06b6d4',
    provider: 'nvidia', key: () => process.env.KIMI_NVIDIA_API_KEY,
    model: 'moonshotai/kimi-k2.6',
  },
  {
    id: 'mistral-large', name: 'Mistral Large 675B', emoji: '🌪️', color: '#3b82f6',
    provider: 'nvidia', key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: 'mistralai/mistral-large-3-675b-instruct-2512',
  },
  {
    id: 'qwq', name: 'QwQ 80B', emoji: '🧩', color: '#8b5cf6',
    provider: 'nvidia', key: () => process.env.QWQ_NVIDIA_API_KEY,
    model: 'qwen/qwen3-next-80b-a3b-instruct',
  },
  {
    id: 'nemotron', name: 'Nemotron 120B', emoji: '⚡', color: '#f59e0b',
    provider: 'nvidia', key: () => process.env.NEMOTRON_SUPER_API_KEY,
    model: 'nvidia/nemotron-3-super-120b-a12b',
  },
  {
    id: 'step', name: 'Step 3.7', emoji: '🚀', color: '#10b981',
    provider: 'nvidia', key: () => process.env.STEP37_NVIDIA_API_KEY,
    model: 'stepfun-ai/step-3.7-flash',
  },
  {
    id: 'medium', name: 'Mistral Medium 3', emoji: '🔮', color: '#f43f5e',
    provider: 'nvidia', key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY,
    model: 'mistralai/mistral-medium-3-instruct',
  },
  {
    id: 'gpt4o-mini', name: 'GPT-4o Mini', emoji: '🤖', color: '#e5e7eb',
    provider: 'openrouter', key: () => process.env.OPENROUTER_API_KEY,
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'gemini-flash', name: 'Gemini Flash 1.5', emoji: '💎', color: '#34d399',
    provider: 'openrouter', key: () => process.env.OPENROUTER_API_KEY,
    model: 'google/gemini-flash-1.5',
  },
  {
    id: 'claude-haiku', name: 'Claude Haiku 3.5', emoji: '🦋', color: '#fb923c',
    provider: 'openrouter', key: () => process.env.OPENROUTER_API_KEY,
    model: 'anthropic/claude-3-5-haiku',
  },
  {
    id: 'deepseek-v3', name: 'DeepSeek V3', emoji: '🐋', color: '#22d3ee',
    provider: 'openrouter', key: () => process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-chat',
  },
  {
    id: 'deepseek-r1', name: 'DeepSeek R1', emoji: '🧠', color: '#818cf8',
    provider: 'openrouter', key: () => process.env.OPENROUTER_API_KEY,
    model: 'deepseek/deepseek-r1',
  },
];

async function askModel(contestant, prompt) {
  const key = contestant.key();
  if (!key) {
    return { id: contestant.id, name: contestant.name, emoji: contestant.emoji, color: contestant.color, answer: '?', latencyMs: 0, error: 'no_key' };
  }

  const base = contestant.provider === 'openrouter' ? OPENROUTER_BASE : NVIDIA_BASE;
  const t0 = Date.now();

  try {
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    if (contestant.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://solo-levelling-gold.vercel.app';
      headers['X-Title'] = 'Solo Levelling AI Quiz';
    }

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: contestant.model,
        messages: [
          {
            role: 'system',
            content: 'You are competing in a multiple-choice quiz. Reply with ONLY the letter of the correct answer: A, B, C, or D. No explanation, no punctuation — just the single letter.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 8,
        temperature: 0.0,
      }),
      signal: AbortSignal.timeout(7000),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const match = raw.match(/\b([ABCD])\b/i) || raw.match(/([ABCD])/i);
    const answer = match ? match[1].toUpperCase() : '?';

    return { id: contestant.id, name: contestant.name, emoji: contestant.emoji, color: contestant.color, answer, latencyMs: Date.now() - t0 };
  } catch {
    return { id: contestant.id, name: contestant.name, emoji: contestant.emoji, color: contestant.color, answer: '?', latencyMs: Date.now() - t0, error: 'timeout' };
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      contestants: CONTESTANTS.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, provider: c.provider })),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, options, correct } = req.body || {};
  if (!question || !Array.isArray(options) || options.length !== 4 || !correct) {
    return res.status(400).json({ error: 'question, options[4], correct required' });
  }

  const letters = ['A', 'B', 'C', 'D'];
  const prompt = `Question: ${question}\n\n${options.map((o, i) => `${letters[i]}) ${o}`).join('\n')}\n\nAnswer with ONLY the letter A, B, C, or D.`;

  // SSE streaming — ogni risposta arriva appena il modello risponde
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const allResults = [];

  const promises = CONTESTANTS.map(c =>
    askModel(c, prompt).then(result => {
      const enriched = { ...result, isCorrect: result.answer === correct };
      allResults.push(enriched);
      res.write(`data: ${JSON.stringify({ type: 'answer', ...enriched })}\n\n`);
      return enriched;
    })
  );

  await Promise.allSettled(promises);
  res.write(`data: ${JSON.stringify({ type: 'done', results: allResults, correct })}\n\n`);
  res.end();
}

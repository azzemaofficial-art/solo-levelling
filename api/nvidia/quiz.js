// AI Quiz Arena — 6 modelli NVIDIA NIM competono in parallelo
// POST { question, options: [A,B,C,D], correct: 'A'|'B'|'C'|'D' }

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const CONTESTANTS = [
  {
    id: 'kimi',
    name: 'Kimi K2.6',
    emoji: '🌙',
    color: '#06b6d4',
    key: () => process.env.KIMI_NVIDIA_API_KEY,
    model: 'moonshotai/kimi-k2.6',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large 675B',
    emoji: '🌪️',
    color: '#3b82f6',
    key: () => process.env.MISTRAL_SMALL4_NVIDIA_API_KEY,
    model: 'mistralai/mistral-large-3-675b-instruct-2512',
  },
  {
    id: 'qwq',
    name: 'QwQ 80B',
    emoji: '🧩',
    color: '#8b5cf6',
    key: () => process.env.QWQ_NVIDIA_API_KEY,
    model: 'qwen/qwen3-next-80b-a3b-instruct',
  },
  {
    id: 'nemotron',
    name: 'Nemotron 120B',
    emoji: '⚡',
    color: '#f59e0b',
    key: () => process.env.NEMOTRON_SUPER_API_KEY,
    model: 'nvidia/nemotron-3-super-120b-a12b',
  },
  {
    id: 'step',
    name: 'Step 3.7',
    emoji: '🚀',
    color: '#10b981',
    key: () => process.env.STEP37_NVIDIA_API_KEY,
    model: 'stepfun-ai/step-3.7-flash',
  },
  {
    id: 'medium',
    name: 'Mistral Medium 3',
    emoji: '🔮',
    color: '#f43f5e',
    key: () => process.env.MISTRAL_MEDIUM3_NVIDIA_API_KEY,
    model: 'mistralai/mistral-medium-3-instruct',
  },
];

async function askModel(contestant, prompt) {
  const key = contestant.key();
  if (!key) return { ...contestant, answer: '?', correct: false, latencyMs: 0, error: 'no_key' };
  const t0 = Date.now();
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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
      signal: AbortSignal.timeout(18000),
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
    return res.status(200).json({ ok: true, contestants: CONTESTANTS.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color })) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, options, correct } = req.body || {};
  if (!question || !Array.isArray(options) || options.length !== 4 || !correct) {
    return res.status(400).json({ error: 'question, options[4], correct required' });
  }

  const letters = ['A', 'B', 'C', 'D'];
  const prompt = `Question: ${question}\n\n${options.map((o, i) => `${letters[i]}) ${o}`).join('\n')}\n\nAnswer with ONLY the letter A, B, C, or D.`;

  const settled = await Promise.allSettled(CONTESTANTS.map(c => askModel(c, prompt)));
  const results = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? { ...s.value, isCorrect: s.value.answer === correct }
      : { id: CONTESTANTS[i].id, name: CONTESTANTS[i].name, emoji: CONTESTANTS[i].emoji, color: CONTESTANTS[i].color, answer: '?', latencyMs: 0, isCorrect: false }
  );

  return res.status(200).json({ results, correct });
}

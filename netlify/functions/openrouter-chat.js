export const handler = async (event) => {
  const unique = (items) => {
    const out = [];
    const seen = new Set();
    for (const item of items) {
      const value = String(item || '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  };
  const extractUpstreamReason = (status, data) => {
    const raw = data?.error?.message || data?.error || data?.message || '';
    const text = String(raw || '').trim();
    const lower = text.toLowerCase();
    if (status === 429 || lower.includes('rate limit')) return 'Rate limit provider: riprova tra pochi secondi';
    if (status === 401 || lower.includes('invalid key') || lower.includes('unauthorized')) return 'API key non valida o senza accesso al modello';
    if (status === 408 || lower.includes('timeout')) return 'Provider timeout';
    if (lower.includes('provider returned error')) return 'Provider AI occupato o temporaneamente non disponibile';
    return text || `Errore upstream (${status})`;
  };
  const forcedModel = String(process.env.OPENROUTER_MODEL || '').trim();
  const paidFallbackModel = String(process.env.OPENROUTER_PAID_FALLBACK_MODEL || '').trim();
  const freeFallbackModel = String(process.env.OPENROUTER_FREE_FALLBACK_MODEL || '').trim();
  const modelCandidatesEnv = String(process.env.OPENROUTER_MODEL_CANDIDATES || '').trim();
  const defaultModel = forcedModel || 'openai/gpt-4o-mini';

  if (event.httpMethod === 'GET') {
    const modelCandidatesEnv = String(process.env.OPENROUTER_MODEL_CANDIDATES || '').trim();
    const freeFallbackModel = String(process.env.OPENROUTER_FREE_FALLBACK_MODEL || '').trim();
    const healthCandidates = unique([
      ...(modelCandidatesEnv ? modelCandidatesEnv.split(',') : []),
      forcedModel,
      defaultModel,
      freeFallbackModel,
      paidFallbackModel
    ]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        endpoint: '/api/openrouter/chat',
        hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
        forcedModel: forcedModel || null,
        defaultModel,
        paidFallbackModel: paidFallbackModel || null,
        freeFallbackModel: freeFallbackModel || null,
        modelCandidates: healthCandidates,
        fallbackEnabled: healthCandidates.length > 1
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST, GET', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OPENROUTER_API_KEY non configurata lato server' })
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Body JSON non valido' })
    };
  }

  const requestModel = String(body?.model || '').trim();
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Payload non valido: messages obbligatorio' })
    };
  }

  const modelCandidates = unique([
    ...(modelCandidatesEnv ? modelCandidatesEnv.split(',') : []),
    forcedModel,
    requestModel,
    defaultModel,
    freeFallbackModel,
    paidFallbackModel
  ]);
  const model = modelCandidates[0] || defaultModel;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const callOpenRouter = async (selectedModel) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'https://example.netlify.app',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'solo-leveling-fit'
        },
        body: JSON.stringify({ ...body, model: selectedModel, messages }),
        signal: controller.signal
      });
      const data = await upstream.json();
      return { upstream, data };
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let upstream = null;
    let data = null;
    let lastErr = null;
    let usedModel = model;
    const triedModels = [];

    for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
      const candidateModel = modelCandidates[modelIndex];
      triedModels.push(candidateModel);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await callOpenRouter(candidateModel);
          upstream = result.upstream;
          data = result.data;
          usedModel = candidateModel;
          if (upstream.ok) break;
          const retryable = [408, 409, 425, 429, 500, 502, 503, 504].includes(upstream.status);
          if (retryable && attempt < 2) {
            await sleep(350 * (attempt + 1));
            continue;
          }
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) {
            await sleep(350 * (attempt + 1));
            continue;
          }
        }
      }
      if (upstream?.ok) break;
    }

    if (!upstream && lastErr) throw lastErr;
    const fallbackUsed = usedModel !== model;
    if (!upstream.ok) {
      const reason = extractUpstreamReason(upstream.status, data);
      return {
        statusCode: upstream.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: reason, triedModels })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Shadow-Model': usedModel,
        'X-Shadow-Fallback-Used': fallbackUsed ? '1' : '0'
      },
      body: JSON.stringify({
        ...data,
        _shadowMeta: {
          model: usedModel,
          fallbackUsed,
          primaryModel: model,
          modelCandidates
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Errore sconosciuto' })
    };
  }
};

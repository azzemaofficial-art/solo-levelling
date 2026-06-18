// Debug endpoint — testa kvSet dal contesto serverless
// GET /api/telegram/debug-kv  (rimuovere dopo il test)
export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.json({ error: 'env vars mancanti', url: !!url, token: !!token });

  try {
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', 'tg_import:264863579', JSON.stringify({ type: 'meal', kcal: 500, protein: 35, carbs: 55, fat: 12, name: 'Debug test', slot: 'colazione', ts: Date.now() }), 'EX', '300'],
      ]),
    });
    const data = await r.json();
    return res.json({ ok: r.ok, status: r.status, data, url: url.slice(0, 30) });
  } catch (e) {
    return res.json({ error: e.message });
  }
}

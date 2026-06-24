// Recupera e consuma TUTTI i pending import da Upstash Redis
// GET /api/telegram/claim-import?chat_id=264863579
// Ritorna { items: [...] } (coda completa) + { data } (ultimo, retrocompat)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const chatId = req.query.chat_id || process.env.SHADOW_BOT_CHAT_ID;
  if (!chatId) return res.status(400).json({ error: 'chat_id mancante' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(200).json({ items: [], data: null });

  const queueKey = `tg_queue:${chatId}`;
  const legacyKey = `tg_import:${chatId}`;

  const parse = (raw) => {
    if (raw == null) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  };

  try {
    // 1. Coda nuova: LRANGE tutto + DEL atomico via pipeline
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['LRANGE', queueKey, '0', '-1'],
        ['DEL', queueKey],
      ]),
    });
    const pipe = await r.json();
    const rawList = Array.isArray(pipe) ? (pipe[0]?.result || []) : [];
    let items = rawList.map(parse).filter(Boolean);

    // 2. Fallback legacy: vecchio slot singolo tg_import (GETDEL)
    if (items.length === 0) {
      const r2 = await fetch(`${url}/getdel/${encodeURIComponent(legacyKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r2.json();
      const legacy = parse(json?.result);
      if (legacy) items = [legacy];
    }

    return res.status(200).json({ items, data: items[items.length - 1] || null });
  } catch {
    return res.status(200).json({ items: [], data: null });
  }
}

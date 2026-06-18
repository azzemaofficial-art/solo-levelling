// Recupera e consuma il pending import da Upstash Redis
// GET /api/telegram/claim-import?chat_id=264863579

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const chatId = req.query.chat_id || process.env.SHADOW_BOT_CHAT_ID;
  if (!chatId) return res.status(400).json({ error: 'chat_id mancante' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(200).json({ data: null });

  const key = `tg_import:${chatId}`;

  try {
    // GET + DEL atomico via GETDEL
    const r = await fetch(`${url}/getdel/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await r.json();
    const raw = json?.result;
    if (!raw) return res.status(200).json({ data: null });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json({ data });
  } catch {
    return res.status(200).json({ data: null });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstash Redis REST — helper condiviso con semantica STRICT.
//
// kvGet ritorna null SOLO quando la chiave non esiste davvero: un errore di
// rete/HTTP (429, timeout, 5xx) lancia KvError dopo 2 tentativi. È il punto
// chiave per la sicurezza dei dati: i flussi read→write (stato learn, pasti,
// code) non devono MAI proseguire con uno stato fresco quando il read è
// fallito, altrimenti sovrascrivono lo stato reale dell'utente (è così che si
// perde uno streak/XP: kvGet giù → initLearn() → kvSet → azzerato).
// Le scritture NON ritentano (RPUSH duplicherebbe le entry).
// ─────────────────────────────────────────────────────────────────────────────

export class KvError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KvError';
  }
}

function cfg() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new KvError('KV_REST_API_URL/TOKEN non configurati');
  return { url, token };
}

async function request(path, init, retries = 0) {
  const { url, token } = cfg();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const r = await fetch(`${url}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new KvError(`KV non raggiungibile: ${lastErr?.message || 'errore sconosciuto'}`);
}

export async function kvGet(key) {
  const d = await request(`/get/${encodeURIComponent(key)}`, {}, 1);
  if (d?.result == null) return null;
  try { return JSON.parse(d.result); } catch { return d.result; }
}

export async function kvSet(key, value, ttl = 86400) {
  await request('/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, JSON.stringify(value), 'EX', String(ttl)]]),
  }, 0);
}

export async function kvPush(key, value, ttl = 86400) {
  await request('/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['RPUSH', key, JSON.stringify(value)],
      ['LTRIM', key, '-50', '-1'],
      ['EXPIRE', key, String(ttl)],
    ]),
  }, 0);
}

// kvPush scrive una LISTA Redis (RPUSH) — kvGet/kvSet fanno GET/SET, validi solo
// su stringhe: usarli su una chiave costruita con kvPush dà WRONGTYPE da Redis.
// Questi due leggono/riscrivono la lista con i comandi giusti.
export async function kvListRange(key) {
  const d = await request(`/lrange/${encodeURIComponent(key)}/0/-1`, {}, 1);
  const raw = Array.isArray(d?.result) ? d.result : [];
  return raw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter((v) => v != null);
}

export async function kvListReplace(key, items, ttl = 86400) {
  const cmds = [['DEL', key]];
  for (const it of items) cmds.push(['RPUSH', key, JSON.stringify(it)]);
  cmds.push(['EXPIRE', key, String(ttl)]);
  await request('/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  }, 0);
}

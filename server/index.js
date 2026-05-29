import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT || process.env.SYNC_API_PORT || 8787);
const JWT_SECRET = String(process.env.SYNC_JWT_SECRET || 'sync-dev-secret-change-me');
const CORS_ORIGIN = String(process.env.SYNC_CORS_ORIGIN || '*');
const DB_DIR = process.env.SYNC_DB_DIR ? String(process.env.SYNC_DB_DIR) : join(__dirname, 'data');
const DB_PATH = join(DB_DIR, 'sync-db.json');
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const ensureDb = () => {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ users: [], backups: {} }, null, 2), 'utf8');
  }
};

const readDb = () => {
  ensureDb();
  try {
    const raw = readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      backups: parsed?.backups && typeof parsed.backups === 'object' ? parsed.backups : {}
    };
  } catch (_) {
    return { users: [], backups: {} };
  }
};

const writeDb = (db) => {
  ensureDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
};

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signToken = (payload) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const body = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const body = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (_) {
    return null;
  }
  if (!payload?.sub || !payload?.exp || Date.now() / 1000 > Number(payload.exp)) return null;
  return payload;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const hashPassword = (password, salt = randomBytes(16).toString('hex')) => {
  const hash = pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, salt, expectedHash) => {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 2_000_000) {
      reject(new Error('Payload too large'));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!raw) return resolve({});
    try {
      resolve(JSON.parse(raw));
    } catch (_) {
      reject(new Error('Invalid JSON'));
    }
  });
  req.on('error', reject);
});

const createUserToken = (user) => signToken({
  sub: user.id,
  email: user.email,
  exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
});

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization || '');
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return '';
  return token;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { ok: true, service: 'shadow-sync', now: new Date().toISOString() });
  }

  if (req.method === 'POST' && path === '/auth/register') {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!email || !email.includes('@')) return json(res, 400, { error: 'Email non valida' });
      if (password.length < 6) return json(res, 400, { error: 'Password troppo corta (min 6)' });

      const db = readDb();
      if (db.users.some((user) => user.email === email)) {
        return json(res, 409, { error: 'Utente già registrato' });
      }

      const id = randomBytes(12).toString('hex');
      const { salt, hash } = hashPassword(password);
      const user = {
        id,
        email,
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDb(db);

      return json(res, 200, { token: createUserToken(user), user: { id: user.id, email: user.email } });
    } catch (error) {
      return json(res, 400, { error: error?.message || 'Payload non valido' });
    }
  }

  if (req.method === 'POST' && path === '/auth/login') {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const db = readDb();
      const user = db.users.find((entry) => entry.email === email);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        return json(res, 401, { error: 'Credenziali non valide' });
      }
      return json(res, 200, { token: createUserToken(user), user: { id: user.id, email: user.email } });
    } catch (error) {
      return json(res, 400, { error: error?.message || 'Payload non valido' });
    }
  }

  if (path === '/sync/push' || path === '/sync/pull') {
    const token = getBearerToken(req);
    const session = verifyToken(token);
    if (!session) return json(res, 401, { error: 'Token non valido o scaduto' });

    const db = readDb();
    const user = db.users.find((entry) => entry.id === session.sub);
    if (!user) return json(res, 401, { error: 'Utente non trovato' });

    if (req.method === 'POST' && path === '/sync/push') {
      try {
        const body = await readJsonBody(req);
        if (!body?.backup || typeof body.backup !== 'object') {
          return json(res, 400, { error: 'backup payload mancante o non valido' });
        }
        db.backups[user.id] = {
          backup: body.backup,
          updatedAt: new Date().toISOString()
        };
        writeDb(db);
        return json(res, 200, { ok: true, updatedAt: db.backups[user.id].updatedAt });
      } catch (error) {
        return json(res, 400, { error: error?.message || 'Payload non valido' });
      }
    }

    if (req.method === 'GET' && path === '/sync/pull') {
      const bucket = db.backups[user.id];
      if (!bucket?.backup) return json(res, 404, { error: 'Nessun backup cloud trovato' });
      return json(res, 200, { backup: bucket.backup, updatedAt: bucket.updatedAt });
    }

    return json(res, 405, { error: 'Method not allowed' });
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  ensureDb();
  // eslint-disable-next-line no-console
  console.log(`[shadow-sync] running on http://localhost:${PORT}`);
});

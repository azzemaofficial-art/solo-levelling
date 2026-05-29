const CLOUD_TOKEN_KEY = 'shadow_monarch_cloud_token';
const CLOUD_REFRESH_KEY = 'shadow_monarch_cloud_refresh_token';
const CLOUD_EMAIL_KEY = 'shadow_monarch_cloud_email';
const CLOUD_USER_ID_KEY = 'shadow_monarch_cloud_user_id';

const getSupabaseUrl = () => {
  const value = import.meta.env.VITE_SUPABASE_URL;
  return typeof value === 'string' ? value.trim().replace(/\/+$/g, '') : '';
};

const getSupabaseAnonKey = () => {
  const value = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof value === 'string' ? value.trim() : '';
};

const ensureSupabaseConfig = () => {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) throw new Error('Config Supabase mancante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  return { url, anon };
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
};

const saveSession = ({ email, accessToken, refreshToken, userId }) => {
  if (accessToken) window.localStorage.setItem(CLOUD_TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(CLOUD_REFRESH_KEY, refreshToken);
  if (email) window.localStorage.setItem(CLOUD_EMAIL_KEY, email);
  if (userId) window.localStorage.setItem(CLOUD_USER_ID_KEY, userId);
};
const getStoredRefreshToken = () => window.localStorage.getItem(CLOUD_REFRESH_KEY) || '';
const isTokenExpired = (token, skewSec = 30) => {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return false;
  return (Date.now() / 1000) >= (exp - Math.max(0, Number(skewSec || 0)));
};

const authHeaders = ({ anonKey, token }) => ({
  apikey: anonKey,
  Authorization: token ? `Bearer ${token}` : `Bearer ${anonKey}`,
  'Content-Type': 'application/json'
});

const requestSupabase = async (path, { method = 'GET', token, body, extraHeaders } = {}) => {
  const { url, anon } = ensureSupabaseConfig();
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...authHeaders({ anonKey: anon, token }),
      ...(extraHeaders || {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = payload?.error_description || payload?.msg || payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(reason);
  }
  return payload;
};

export const getCloudSession = () => {
  const token = window.localStorage.getItem(CLOUD_TOKEN_KEY) || '';
  const refreshToken = getStoredRefreshToken();
  const email = window.localStorage.getItem(CLOUD_EMAIL_KEY) || '';
  const userId = window.localStorage.getItem(CLOUD_USER_ID_KEY) || decodeJwtPayload(token)?.sub || '';
  const expired = token ? isTokenExpired(token) : true;
  return {
    provider: 'supabase',
    token,
    refreshToken,
    email,
    userId,
    isExpired: Boolean(expired),
    isAuthenticated: Boolean(token && userId && !expired)
  };
};

export const clearCloudSession = () => {
  window.localStorage.removeItem(CLOUD_TOKEN_KEY);
  window.localStorage.removeItem(CLOUD_REFRESH_KEY);
  window.localStorage.removeItem(CLOUD_EMAIL_KEY);
  window.localStorage.removeItem(CLOUD_USER_ID_KEY);
};

export const cloudLogin = async ({ email, password }) => {
  const payload = await requestSupabase('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password }
  });
  const accessToken = payload?.access_token || '';
  const refreshToken = payload?.refresh_token || '';
  const userId = payload?.user?.id || decodeJwtPayload(accessToken)?.sub || '';
  saveSession({ email, accessToken, refreshToken, userId });
  return { token: accessToken, user: payload?.user || null };
};

export const refreshCloudSession = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('Refresh token mancante. Rifai login.');
  const payload = await requestSupabase('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken }
  });
  const accessToken = payload?.access_token || '';
  const nextRefresh = payload?.refresh_token || refreshToken;
  const userId = payload?.user?.id || decodeJwtPayload(accessToken)?.sub || '';
  const email = payload?.user?.email || window.localStorage.getItem(CLOUD_EMAIL_KEY) || '';
  saveSession({ email, accessToken, refreshToken: nextRefresh, userId });
  return getCloudSession();
};

export const ensureCloudSession = async () => {
  const session = getCloudSession();
  if (session.isAuthenticated) return session;
  if (session.token && session.userId && session.isExpired) {
    try {
      return await refreshCloudSession();
    } catch (_) {
      clearCloudSession();
      throw new Error('Sessione cloud scaduta. Rifai login.');
    }
  }
  throw new Error('Sessione cloud assente. Esegui login.');
};

export const cloudRegister = async ({ email, password }) => {
  await requestSupabase('/auth/v1/signup', {
    method: 'POST',
    body: { email, password }
  });
  // Per rendere il flow lineare nell'app: dopo signup facciamo login immediato.
  return cloudLogin({ email, password });
};

export const cloudPush = async ({ backupPayload }) => {
  const session = await ensureCloudSession();
  const body = [{
    user_id: session.userId,
    backup_json: backupPayload,
    updated_at: new Date().toISOString()
  }];
  const rows = await requestSupabase('/rest/v1/user_backups', {
    method: 'POST',
    token: session.token,
    body,
    extraHeaders: {
      Prefer: 'resolution=merge-duplicates,return=representation'
    }
  });
  return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
};

export const cloudPull = async () => {
  const session = await ensureCloudSession();
  const filterUser = encodeURIComponent(`eq.${session.userId}`);
  const query = `/rest/v1/user_backups?select=backup_json,updated_at&user_id=${filterUser}&order=updated_at.desc&limit=1`;
  const rows = await requestSupabase(query, {
    method: 'GET',
    token: session.token,
    extraHeaders: { Accept: 'application/json' }
  });
  const latest = Array.isArray(rows) ? rows[0] : null;
  if (!latest?.backup_json) throw new Error('Nessun backup cloud trovato');
  return { backup: latest.backup_json, updatedAt: latest.updated_at };
};

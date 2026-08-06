// ─────────────────────────────────────────────────────────────────────────────
// Guard condiviso per gli endpoint AI pubblici (proxy verso Groq/NVIDIA/
// OpenRouter/Anthropic). Obiettivo: fermare scanner e abusi che brucerebbero
// le chiavi API, senza richiedere modifiche al client.
//
// Una richiesta passa se:
//   1. porta l'header `x-solo-client` uguale a API_CLIENT_SECRET (o a
//      HIVE_SECRET, così il ponte Obsidian — che gira senza Origin — continua
//      a funzionare con il secret che già possiede), oppure
//   2. arriva dal sito stesso (Origin/Referer = SITE_URL) — copre tutti i
//      fetch del browser senza toccare 22+ call site.
// In più: rate-limit best-effort per IP (per-istanza, i contatori si
// azzerano al cold start della funzione — sufficiente contro gli scanner).
//
// Robustezza futura: impostare API_CLIENT_SECRET e poi migrare i call site
// all'header renderà il controllo forte indipendentemente dall'Origin.
// ─────────────────────────────────────────────────────────────────────────────
import { safeEqual } from './secrets.js';

const SITE_URL = process.env.SITE_URL || 'https://solo-levelling-steel.vercel.app';
const WINDOW_MS = 60_000;
const hits = new Map(); // ip -> { count, resetAt }

function sameOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer || '';
  return typeof origin === 'string' && origin.startsWith(SITE_URL);
}

export function guardApi(req, res, { maxPerMinute = 40 } = {}) {
  const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || slot.resetAt <= now) {
    if (hits.size > 2000) hits.clear(); // memoria: non crescere all'infinito
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    slot.count += 1;
    if (slot.count > maxPerMinute) {
      res.status(429).json({ error: 'troppe richieste: rallenta qualche secondo' });
      return false;
    }
  }

  const given = String(req.headers?.['x-solo-client'] || '');
  const clientSecret = process.env.API_CLIENT_SECRET;
  if (given && (safeEqual(given, clientSecret || '') || safeEqual(given, process.env.HIVE_SECRET || ''))) {
    return true;
  }
  if (sameOrigin(req)) return true;

  res.status(401).json({ error: 'accesso non autorizzato' });
  return false;
}

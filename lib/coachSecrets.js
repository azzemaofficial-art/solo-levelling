// ─────────────────────────────────────────────────────────────────────────────
// Il cervello della conoscenza: ~860 segreti del maestro strutturati in JSON
// (lib/knowledge/secrets/*.json) + retrieval deterministico.
//
// Il maestro non rovescia tutto il sapere addosso: tira fuori i 2-4 segreti
// GIUSTI per ciò che l'atleta sta sbagliando ADESSO, al livello giusto.
// Nessuna AI, nessun vettore: punteggio deterministico → gratis e testabile.
// (Nota: lib/secrets.js è un'altra cosa — comparazione secret API Telegram.)
// ─────────────────────────────────────────────────────────────────────────────

// Import attributes `with { type: 'json' }`: richiesti da Node, gestiti da Vite/Rollup.
import bjj from './knowledge/secrets/bjj.json' with { type: 'json' };
import boxing from './knowledge/secrets/boxing.json' with { type: 'json' };
import breathing from './knowledge/secrets/breathing.json' with { type: 'json' };
import calisthenics from './knowledge/secrets/calisthenics.json' with { type: 'json' };
import capoeira from './knowledge/secrets/capoeira.json' with { type: 'json' };
import crossfit from './knowledge/secrets/crossfit.json' with { type: 'json' };
import fitness from './knowledge/secrets/fitness.json' with { type: 'json' };
import general from './knowledge/secrets/general.json' with { type: 'json' };
import hapkido from './knowledge/secrets/hapkido.json' with { type: 'json' };
import judo from './knowledge/secrets/judo.json' with { type: 'json' };
import kali from './knowledge/secrets/kali.json' with { type: 'json' };
import kalaripayattu from './knowledge/secrets/kalaripayattu.json' with { type: 'json' };
import karate from './knowledge/secrets/karate.json' with { type: 'json' };
import kendo from './knowledge/secrets/kendo.json' with { type: 'json' };
import kickboxing from './knowledge/secrets/kickboxing.json' with { type: 'json' };
import kravmaga from './knowledge/secrets/kravmaga.json' with { type: 'json' };
import kungfu from './knowledge/secrets/kungfu.json' with { type: 'json' };
import lutalivre from './knowledge/secrets/lutalivre.json' with { type: 'json' };
import mma from './knowledge/secrets/mma.json' with { type: 'json' };
import muayboran from './knowledge/secrets/muayboran.json' with { type: 'json' };
import muaythai from './knowledge/secrets/muaythai.json' with { type: 'json' };
import pankration from './knowledge/secrets/pankration.json' with { type: 'json' };
import running from './knowledge/secrets/running.json' with { type: 'json' };
import sambo from './knowledge/secrets/sambo.json' with { type: 'json' };
import sanda from './knowledge/secrets/sanda.json' with { type: 'json' };
import selfdefense from './knowledge/secrets/selfdefense.json' with { type: 'json' };
import silat from './knowledge/secrets/silat.json' with { type: 'json' };
import stretching from './knowledge/secrets/stretching.json' with { type: 'json' };
import systema from './knowledge/secrets/systema.json' with { type: 'json' };
import taekwondo from './knowledge/secrets/taekwondo.json' with { type: 'json' };
import wingchun from './knowledge/secrets/wingchun.json' with { type: 'json' };
import wrestling from './knowledge/secrets/wrestling.json' with { type: 'json' };
import yoga from './knowledge/secrets/yoga.json' with { type: 'json' };

export const SECRETS_DB = {
  bjj, boxing, breathing, calisthenics, capoeira, crossfit, fitness, general,
  hapkido, judo, kali, kalaripayattu, karate, kendo, kickboxing, kravmaga, kungfu,
  lutalivre, mma, muayboran, muaythai, pankration, running, sambo, sanda,
  selfdefense, silat, stretching, systema, taekwondo, wingchun, wrestling, yoga,
};

// Normalizza le mode della UI (sparring_muaythai, drill_...) alla disciplina base.
export function normalizeDiscipline(mode) {
  let id = String(mode || '').toLowerCase().trim();
  id = id.replace(/^(sparring|drill|partner)_/, '');
  if (SECRETS_DB[id]) return id;
  if (id.includes('muaythai') || id.includes('muay')) return 'muaythai';
  if (id.includes('box')) return 'boxing';
  if (id.includes('kali') || id.includes('escrima') || id.includes('arnis')) return 'kali';
  if (id.includes('sanda')) return 'sanda'; // combat sanda → sanda
  return 'general';
}

export function secretsFor(mode) {
  const d = SECRETS_DB[normalizeDiscipline(mode)];
  return d ? d.secrets : [];
}

const STOP = new Set(['della', 'dello', 'degli', 'delle', 'con', 'per', 'che', 'non', 'una', 'uno', 'gli', 'dei', 'del', 'nel', 'nella', 'sul', 'più', 'meno', 'sono', 'essere', 'questo', 'quella', 'anche', 'molto', 'sotto', 'sopra', 'tra', 'fra', 'alla', 'allo', 'alle', 'ogni', 'sempre', 'mai', 'poi', 'quando', 'dopo', 'prima', 'suo', 'sua', 'tuoi', 'tua', 'il', 'lo', 'la', 'le', 'di', 'a', 'e', 'o', 'in', 'si', 'da', 'ma', 'se', 'come', 'piu']);

// Tokenizza un testo di errore/osservazione in parole chiave per il matching.
export function errorTokens(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// Scegli i segreti migliori per il momento.
// opts: { n, maxLevel, errorText (testo libero: alert/osservazioni), avoidIds, seed }
export function pickSecrets(mode, opts = {}) {
  const pool = secretsFor(mode);
  if (!pool.length) return [];
  const n = Math.max(1, Math.min(10, opts.n || 3));
  const maxLevel = Math.max(1, Math.min(5, opts.maxLevel || 5));
  const avoid = new Set(opts.avoidIds || []);
  const tokens = errorTokens(opts.errorText || '');
  const scored = [];
  for (const s of pool) {
    if ((s.livello || 1) > maxLevel || avoid.has(s.id)) continue;
    let score = 1;
    if (tokens.length) {
      const hay = `${s.text} ${(s.tags || []).join(' ')} ${s.errore || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const t of tokens) if (hay.includes(t)) score += 3;
    }
    scored.push({ s, score });
  }
  if (!scored.length) return [];
  const seed = opts.seed != null ? opts.seed : 0;
  // Tie-break deterministico ma vario: permutation LCG sul seed
  let st = (hashStr(normalizeDiscipline(mode)) ^ seed) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  scored.forEach((x) => { x.jitter = rnd(); });
  scored.sort((a, b) => (b.score - a.score) || (a.jitter - b.jitter));
  return scored.slice(0, n).map((x) => x.s);
}

// Il segreto del giorno: deterministico per disciplina+data (come la combo del giorno).
export function secretOfTheDay(mode, dateKey) {
  const d = normalizeDiscipline(mode);
  const pool = (SECRETS_DB[d]?.secrets) || [];
  if (!pool.length) return null;
  const key = dateKey || new Date().toISOString().slice(0, 10);
  return pool[hashStr(`${d}:${key}`) % pool.length];
}

// Blocco compatto da iniettare nel prompt del cervello (max ~N caratteri).
export function formatSecretsForPrompt(list, maxChars = 700) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return '';
  const lines = arr.map((s) => `- [${s.categoria}${s.lore ? '·tradizione' : ''}] ${s.text}`);
  let out = 'SEGRETI DEL MAESTRO (conoscenza riservata pertinente a ciò che vedi — citane al massimo UNO, solo se serve davvero):\n' + lines.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars);
  return out;
}

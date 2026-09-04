// ─────────────────────────────────────────────────────────────────────────────
// FIGHT IQ — SHADOW SPARRING. Il coach diventa l'avversario: lancia attacchi,
// tu reagisci, la camera giudica. Logica pura e deterministica (zero AI/rete).
//
// Un "attacco" ha: tipo, nome, finestra di reazione (ms) e come lo riconosci.
// La difficoltà sale accorciando le finestre e mescolando più tipi.
// ─────────────────────────────────────────────────────────────────────────────

// Tipi di attacco e come il corpo li difende.
// react: quale reazione ci si aspetta (per la detection e il prompt vocale).
export const ATTACK_TYPES = {
  jab:      { cat: 'punch',    label: 'JAB',              voice: 'Jab in arrivo',        react: 'guard' },
  cross:    { cat: 'punch',    label: 'CROSS',            voice: 'Cross potente',        react: 'guard' },
  hook:     { cat: 'punch',    label: 'GANCIO',           voice: 'Gancio largo',         react: 'guard' },
  uppercut: { cat: 'punch',    label: 'MONTANTE',         voice: 'Montante sotto',       react: 'guard' },
  lowkick:  { cat: 'kick',     label: 'LOW KICK',         voice: 'Low kick alla gamba',  react: 'guard' },
  bodykick: { cat: 'kick',     label: 'CALCIO AL CORPO',  voice: 'Calcio al corpo',      react: 'guard' },
  doubleleg:{ cat: 'takedown', label: 'DOUBLE LEG',       voice: 'Ti entra DOUBLE LEG',  react: 'sprawl' },
  singleleg:{ cat: 'takedown', label: 'SINGLE LEG',       voice: 'Ti entra SINGLE LEG',  react: 'sprawl' },
  clinch:   { cat: 'takedown', label: 'CLINCH',           voice: 'Vuole il CLINCH',      react: 'sprawl' },
};

// Finestra di reazione base per categoria (ms), poi scalata dalla difficoltà.
const BASE_WINDOW = { punch: 1600, kick: 1800, takedown: 1900 };

// Moltiplicatore finestra per livello di difficoltà 1..10 (10 = pro).
export function windowScale(level) {
  const l = Math.min(10, Math.max(1, Math.round(level || 1)));
  // da 1.0 (facile) a 0.45 (pro): finestre sempre più strette
  return 1 - (l - 1) * (0.55 / 9);
}

// Finestra effettiva per un attacco a una data difficoltà.
export function reactionWindow(attackId, level) {
  const a = ATTACK_TYPES[attackId];
  if (!a) return 1500;
  return Math.round(BASE_WINDOW[a.cat] * windowScale(level));
}

// Genera una sequenza di attacchi per un round.
// level alto → più takedown (i più difficili) e mix più vario.
export function buildAttackSequence(count, level, seed = 1) {
  const l = Math.min(10, Math.max(1, Math.round(level || 1)));
  const pool = Object.keys(ATTACK_TYPES);
  const takedowns = pool.filter((k) => ATTACK_TYPES[k].cat === 'takedown');
  const seq = [];
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let last = null;
  for (let i = 0; i < count; i += 1) {
    let pick;
    // Più sali, più probabilità di takedown (40% a livello 8+)
    const tdChance = Math.min(0.4, 0.1 + l * 0.035);
    if (rnd() < tdChance && takedowns.length) {
      pick = takedowns[Math.floor(rnd() * takedowns.length)];
    } else {
      pick = pool[Math.floor(rnd() * pool.length)];
    }
    if (pick === last) pick = pool[(pool.indexOf(pick) + 1) % pool.length]; // no doppioni consecutivi
    seq.push(pick);
    last = pick;
  }
  return seq;
}

// ─── Valutazione della reazione ──────────────────────────────────────────────
// Esito di una singola reazione.
// grade: 'perfect' | 'good' | 'late' | 'missed'
export function gradeReaction({ reacted, reactTimeMs, windowMs, countered }) {
  if (!reacted) return { grade: 'missed', points: 0 };
  const ratio = reactTimeMs / Math.max(1, windowMs);
  if (ratio <= 0.45) return { grade: 'perfect', points: countered ? 15 : 12 };
  if (ratio <= 0.75) return { grade: 'good', points: countered ? 10 : 8 };
  return { grade: 'late', points: countered ? 6 : 4 };
}

// Punteggio → Fight IQ (0-100) a fine round.
export function computeFightIq(results) {
  if (!results.length) return 0;
  const maxPts = results.length * 15;
  const got = results.reduce((a, r) => a + (r.points || 0), 0);
  const streakBonus = Math.min(10, longestStreak(results) * 2);
  return Math.min(100, Math.round((got / maxPts) * 90 + streakBonus));
}

export function longestStreak(results) {
  let best = 0, cur = 0;
  for (const r of results) {
    if (r.grade === 'perfect' || r.grade === 'good') { cur += 1; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

// Dalla prestazione, suggerisce il livello di difficoltà successivo.
export function nextLevel(iq, current) {
  const c = Math.min(10, Math.max(1, Math.round(current || 1)));
  if (iq >= 80) return Math.min(10, c + 1);
  if (iq <= 40) return Math.max(1, c - 1);
  return c;
}

// ─── Detection delle reazioni (sui landmark/angoli già tracciati) ───────────
// SPRAWL: le ginocchia si estendono di scatto (gambe che scattano indietro)
// e il baricentro scende. Ritorna true se rilevato entro la finestra.
// samples: [{t, kL, kR, hipY?}] — hipY opzionale (altezza anche, normalizzata).
export function detectSprawl(samples, callTimeMs, windowMs) {
  if (!Array.isArray(samples) || !samples.length) return { detected: false, timeMs: null };
  const win = samples.filter((sm) => sm.t >= callTimeMs && sm.t <= callTimeMs + windowMs);
  for (let i = 1; i < win.length; i += 1) {
    const a = win[i - 1], b = win[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > 250) continue;
    const kneeExt = Math.max(
      (b.kL ?? 0) - (a.kL ?? 0),
      (b.kR ?? 0) - (a.kR ?? 0)
    );
    const vel = (kneeExt / dt) * 1000; // °/s di estensione ginocchio
    const hipDrop = (a.hipY != null && b.hipY != null) ? (b.hipY - a.hipY) : 0;
    // scatto di estensione + anche che scendono = sprawl
    if (vel > 380 || (vel > 220 && hipDrop > 0.02)) return { detected: true, timeMs: b.t - callTimeMs };
  }
  return { detected: false, timeMs: null };
}

// GUARDIA: mani all'altezza delle spalle o sopra (difesa pugni/calci).
// sample: {wL, wR, shL, shR} con y normalizzate (0 in alto). y più piccolo = più alto.
export function detectGuard(sample) {
  if (!sample || sample.wL == null || sample.shL == null) return false;
  const leftOk = sample.wL <= sample.shL + 0.06;
  const rightOk = sample.wR <= sample.shR + 0.06;
  return leftOk && rightOk;
}

// CONTRATTACCO: un pugno rilevato (estensione esplosiva del gomito) nella finestra.
export function detectCounter(samples, callTimeMs, windowMs) {
  if (!Array.isArray(samples) || !samples.length) return { detected: false, timeMs: null };
  const win = samples.filter((sm) => sm.t >= callTimeMs && sm.t <= callTimeMs + windowMs);
  for (let i = 1; i < win.length; i += 1) {
    const a = win[i - 1], b = win[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > 250) continue;
    const elbowExt = Math.max((b.eL ?? 0) - (a.eL ?? 0), (b.eR ?? 0) - (a.eR ?? 0));
    const vel = (elbowExt / dt) * 1000;
    if (vel > 500) return { detected: true, timeMs: b.t - callTimeMs };
  }
  return { detected: false, timeMs: null };
}

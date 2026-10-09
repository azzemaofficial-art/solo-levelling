// ─────────────────────────────────────────────────────────────────────────────
// "Il coach impara i TUOI colpi" (v2): ogni esempio è la TRAIETTORIA del pugno
// nell'immagine, rispetto al tuo corpo (dal motore lib/mmaStrikes.js), fatta
// su comando ("Guardia… VAI!"). Un colpo nuovo si riconosce confrontando la sua
// traiettoria con le tue (DTW: allineamento elastico, tollera velocità diverse).
//
// Perché v2: gli esempi della v1 (5 ottobre) erano finestre di 1,6 s prese da
// qualsiasi movimento del braccio (mani che scendono, aggiustamenti, perfino
// pugni che MediaPipe aveva perso) → il coach imparava rumore. Ora vale solo il
// colpo partito al "VAI", e solo se è un colpo vero.
//
// v6: gli esempi portano anche le misure di tutto il braccio (`f`, lib/mmaArmFeatures.js).
// Se tutti gli esempi di un braccio le hanno, il confronto si fa su quelle (provato su
// BoxingVI: 64% contro 55% con 3 esempi, 79% contro 70% con 20). Gli esempi vecchi senza
// misure continuano a funzionare con la traiettoria. Il coach decide il tipo solo se il
// più simile stacca il secondo di almeno il 15% (così ci prende 3 volte su 4): altrimenti
// resta "colpo di quel braccio".
// ─────────────────────────────────────────────────────────────────────────────

import { featureDistance, hasFeatures } from './mmaArmFeatures.js';

export const TEMPLATE_KEY = 'shadow_monarch_mma_templates_v2';
export const TEMPLATE_VERSION = 2;

// Gruppi che si possono insegnare (id di src/data/mmaMoves.js) — solo braccia:
// per calci e ginocchia restano le regole (la camera da sola non li distingue bene)
export const TEACH_GROUPS = [
  { id: 'punches', label: 'Pugni', moves: ['jab', 'cross', 'hook', 'rearHook', 'uppercut', 'rearUppercut', 'bodyHook', 'bodyCross'], default: true },
  { id: 'elbows', label: 'Gomiti', moves: ['leadElbow', 'rearElbow'], default: false },
];

const norm = (v) => Math.hypot(v[0], v[1]);

// Forma del colpo: traiettoria scalata sulla sua ampiezza (conta il disegno, non la grandezza)
const shapeOf = (it) => {
  const r = Math.max(0.05, it.reach || 0);
  return (it.path || []).map(([x, y]) => [x / r, y / r]);
};

// DTW con banda: costo medio lungo il miglior allineamento fra due traiettorie
export function dtw(a, b, band = 4) {
  const n = a.length, m = b.length;
  if (!n || !m) return Infinity;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  D[0][0] = 0;
  const w = Math.max(band, Math.abs(n - m));
  for (let i = 1; i <= n; i += 1) {
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j += 1) {
      const c = norm([a[i - 1][0] - b[j - 1][0], a[i - 1][1] - b[j - 1][1]]);
      let best = D[i - 1][j - 1], len = L[i - 1][j - 1];
      if (D[i - 1][j] < best) { best = D[i - 1][j]; len = L[i - 1][j]; }
      if (D[i][j - 1] < best) { best = D[i][j - 1]; len = L[i][j - 1]; }
      D[i][j] = c + best; L[i][j] = len + 1;
    }
  }
  return D[n][m] / Math.max(1, L[n][m]);
}

// Distanza fra due colpi: forma + quanto sono diversi di ampiezza
export function strikeDistance(a, b) {
  return dtw(shapeOf(a), shapeOf(b)) + 0.35 * Math.abs(Math.log(Math.max(0.05, a.reach) / Math.max(0.05, b.reach)));
}

// Fiducia minima per decidere il tipo con le misure del braccio: il più simile deve staccare
// il secondo del 15% (BoxingVI, 3 esempi: decide sul 56% dei colpi e ci prende nel 75%)
export const FEATURE_MARGIN = 0.15;

// Distanza fra un colpo e un esempio: misure del braccio se ci sono, altrimenti traiettoria
const distOf = (mode, a, b) => (mode === 'feat' ? featureDistance(a.f, b.f) : strikeDistance(a, b));

// Modello per braccio (avanti / dietro): esempi + tolleranza dalla variabilità dei tuoi colpi
export function buildModel(templates) {
  const items = (Array.isArray(templates?.items) ? templates.items : []).filter((it) => it?.move && Array.isArray(it.path) && it.path.length >= 4 && (it.arm === 'lead' || it.arm === 'rear'));
  const model = {};
  for (const arm of ['lead', 'rear']) {
    const list = items.filter((it) => it.arm === arm);
    if (!list.length) continue;
    const mode = list.every((it) => hasFeatures(it.f)) ? 'feat' : 'path';
    // quanto si somigliano fra loro due esempi dello STESSO colpo (vicino più prossimo)
    const intra = list.map((it) => {
      const same = list.filter((x) => x !== it && x.move === it.move);
      return same.length ? Math.min(...same.map((x) => distOf(mode, it, x))) : null;
    }).filter((d) => d != null).sort((x, y) => x - y);
    const typical = intra.length ? intra[Math.floor(intra.length / 2)] : mode === 'feat' ? 1.5 : 0.15;
    model[arm] = { items: list, mode, tol: mode === 'feat' ? Math.max(2, typical * 2.5) : Math.max(0.22, typical * 2.5) };
  }
  return model;
}

// Il colpo più somigliante: media dei 3 esempi più vicini di ogni colpo con le misure del
// braccio (dei 2 più vicini con la traiettoria)
export function classify(model, arm, ev, { exclude } = {}) {
  const group = model?.[arm];
  if (!group || !Array.isArray(ev?.path) || ev.path.length < 4) return null;
  const mode = group.mode === 'feat' && hasFeatures(ev.f) ? 'feat' : 'path';
  const k = mode === 'feat' ? 3 : 2;
  const perMove = {};
  for (const it of group.items) {
    if (it === exclude) continue;
    (perMove[it.move] ||= []).push(distOf(mode, ev, it));
  }
  const ranked = Object.entries(perMove)
    .map(([move, ds]) => { const near = ds.sort((a, b) => a - b).slice(0, k); return { move, dist: near.reduce((a, b) => a + b, 0) / near.length }; })
    .sort((a, b) => a.dist - b.dist);
  if (!ranked.length) return null;
  const [best, second] = ranked;
  const margin = second ? second.dist - best.dist : Infinity;
  // tolleranza della traiettoria solo con la traiettoria (un colpo vecchio senza misure su un modello con misure)
  const tol = mode === group.mode ? group.tol : Math.max(0.22, 0.15 * 2.5);
  return {
    move: best.move, dist: best.dist, second: second?.move || null, margin, mode,
    // due colpi quasi uguali per questa camera: non si decide fra i due
    ambiguous: Boolean(second) && (mode === 'feat' ? margin < best.dist * FEATURE_MARGIN : margin < 0.04),
    accepted: best.dist <= tol, tol,
  };
}

// Il coach impara anche mentre ti alleni: in una combo riuscita sa già che colpo dovevi tirare,
// quindi ogni colpo riconosciuto "ok" diventa un tuo esempio in più (BoxingVI: da 3 a 20 esempi
// per tipo la precisione sale dal 64% al 79%, e regge anche con un esempio sbagliato su 10).
// Solo per i colpi che si possono insegnare, solo se quel braccio ha già i tuoi esempi, al massimo
// LEARN_MAX per colpo (i più recenti); quelli insegnati a comando restano sempre.
export const LEARN_MAX = 12;
const TEACHABLE = new Set(TEACH_GROUPS.flatMap((g) => g.moves));
export function learnFromRep(templates, result, { rep, sample, max = LEARN_MAX } = {}) {
  if (!templates?.items?.length || !result || result.grade === 'redo' || typeof sample !== 'function') return null;
  if (result.moves.some((mv) => mv.status === 'missing')) return null;
  const arms = new Set(templates.items.map((it) => it.arm));
  const fresh = result.moves
    .filter((mv) => mv.status === 'ok' && TEACHABLE.has(mv.id) && mv.gesture && (!mv.gesture.move || mv.gesture.move === mv.id))
    .map((mv) => sample(mv.id, mv.gesture))
    .filter((s) => s && arms.has(s.arm) && Array.isArray(s.f))
    .map((s) => ({ ...s, src: 'combo', rep }));
  if (!fresh.length) return null;
  let items = [...templates.items, ...fresh];
  for (const id of new Set(fresh.map((s) => s.move))) {
    const learned = items.filter((it) => it.move === id && it.src === 'combo');
    if (learned.length > max) { const drop = new Set(learned.slice(0, learned.length - max)); items = items.filter((it) => !drop.has(it)); }
  }
  return { ...templates, items };
}
// "Il coach ha sbagliato": via gli esempi presi da quella ripetizione
export function forgetRep(templates, rep) {
  if (!templates?.items || rep == null) return templates;
  const items = templates.items.filter((it) => it.rep !== rep);
  return items.length === templates.items.length ? templates : { ...templates, items };
}

// Quanto bene si distinguono i tuoi colpi tra loro (ognuno riconosciuto dagli altri)
export function selfCheck(templates) {
  const model = buildModel(templates);
  const confusions = {};
  let ok = 0, total = 0;
  for (const [arm, group] of Object.entries(model)) {
    if (new Set(group.items.map((it) => it.move)).size < 2) continue;
    for (const it of group.items) {
      if (group.items.filter((x) => x.move === it.move).length < 2) continue;
      const res = classify(model, arm, it, { exclude: it });
      total += 1;
      if (res?.move === it.move) ok += 1;
      else if (res) { const k = [it.move, res.move].sort().join('|'); confusions[k] = (confusions[k] || 0) + 1; }
    }
  }
  return { accuracy: total ? ok / total : null, total, confusions: Object.entries(confusions).sort((a, b) => b[1] - a[1]).map(([pair, n]) => ({ pair: pair.split('|'), n })) };
}

// La camera ti vede bene? Con i colpi verso il telefono jab e diretto si muovono
// pochissimo nell'immagine (clip vere: jab 0,18–0,31). Di lato si vedono 2–3 volte di più.
export function cameraCheck(items) {
  const straights = (items || []).filter((it) => ['jab', 'cross'].includes(it.move)).map((it) => it.reach).sort((a, b) => a - b);
  if (straights.length < 2) return { ok: true, median: null };
  const median = straights[Math.floor(straights.length / 2)];
  return { ok: median >= 0.3, median };
}

export function loadTemplates(stance, storage = globalThis.localStorage) {
  try {
    const t = JSON.parse(storage?.getItem(TEMPLATE_KEY) || 'null');
    if (t?.v === TEMPLATE_VERSION && t.stance === stance && Array.isArray(t.items) && t.items.length) return t;
  } catch { /* corrotto: si usano le regole */ }
  return null;
}
export function saveTemplates(t, storage = globalThis.localStorage) {
  try { storage?.setItem(TEMPLATE_KEY, JSON.stringify({ ...t, v: TEMPLATE_VERSION })); return true; } catch { return false; }
}
export function clearTemplates(storage = globalThis.localStorage) { try { storage?.removeItem(TEMPLATE_KEY); } catch { /* storage */ } }

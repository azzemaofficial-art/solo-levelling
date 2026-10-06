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
// ─────────────────────────────────────────────────────────────────────────────

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

// Modello per braccio (avanti / dietro): esempi + tolleranza dalla variabilità dei tuoi colpi
export function buildModel(templates) {
  const items = (Array.isArray(templates?.items) ? templates.items : []).filter((it) => it?.move && Array.isArray(it.path) && it.path.length >= 4 && (it.arm === 'lead' || it.arm === 'rear'));
  const model = {};
  for (const arm of ['lead', 'rear']) {
    const list = items.filter((it) => it.arm === arm);
    if (!list.length) continue;
    // quanto si somigliano fra loro due esempi dello STESSO colpo (vicino più prossimo)
    const intra = list.map((it) => {
      const same = list.filter((x) => x !== it && x.move === it.move);
      return same.length ? Math.min(...same.map((x) => strikeDistance(it, x))) : null;
    }).filter((d) => d != null).sort((x, y) => x - y);
    const typical = intra.length ? intra[Math.floor(intra.length / 2)] : 0.15;
    model[arm] = { items: list, tol: Math.max(0.22, typical * 2.5) };
  }
  return model;
}

// Il colpo più somigliante (media dei 2 esempi più vicini di ogni colpo)
export function classify(model, arm, ev, { exclude } = {}) {
  const group = model?.[arm];
  if (!group || !Array.isArray(ev?.path) || ev.path.length < 4) return null;
  const perMove = {};
  for (const it of group.items) {
    if (it === exclude) continue;
    (perMove[it.move] ||= []).push(strikeDistance(ev, it));
  }
  const ranked = Object.entries(perMove)
    .map(([move, ds]) => { ds.sort((a, b) => a - b); return { move, dist: ds.length > 1 ? (ds[0] + ds[1]) / 2 : ds[0] }; })
    .sort((a, b) => a.dist - b.dist);
  if (!ranked.length) return null;
  const [best, second] = ranked;
  return { move: best.move, dist: best.dist, second: second?.move || null, margin: second ? second.dist - best.dist : Infinity, accepted: best.dist <= group.tol, tol: group.tol };
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

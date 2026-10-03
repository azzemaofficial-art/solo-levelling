// ─────────────────────────────────────────────────────────────────────────────
// "Il coach impara i TUOI colpi": riconoscimento per somiglianza (k-NN) con gli
// esempi che hai fatto tu, con la tua camera e il tuo corpo.
//
// Perché: MediaPipe su telefono schiaccia la profondità (un jab verso la camera
// sembra corto in 3D), perde fotogrammi nei colpi veloci e cambia con l'angolo.
// Le soglie fisse tarate su un atleta virtuale sbagliano; i tuoi esempi no.
// Un movimento che non somiglia a nessun colpo insegnato resta "non chiaro" e
// NON viene contato come colpo in più (niente colpi fantasma).
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_KEY = 'shadow_monarch_mma_templates_v1';
export const TEMPLATE_VERSION = 1;

// Gruppi che si possono insegnare (id di src/data/mmaMoves.js)
export const TEACH_GROUPS = [
  { id: 'punches', label: 'Pugni', moves: ['jab', 'cross', 'hook', 'rearHook', 'uppercut', 'rearUppercut', 'bodyHook', 'bodyCross'], default: true },
  { id: 'elbows', label: 'Gomiti', moves: ['leadElbow', 'rearElbow'], default: false },
  { id: 'kicks', label: 'Calci e ginocchia', moves: ['teep', 'lowKick', 'bodyKick', 'headKick', 'rearKnee'], default: false },
];

// Peso di ogni caratteristica (le distanze sono già in unità "busto")
// arto braccio: spostamento 3D (x,y,z) + 2D (x,y) del polso dalla TUA guardia,
// angolo del gomito, altezza del gomito, salita (montante), curvatura (gancio)
const FLOORS = { arm: [0.08, 0.08, 0.1, 0.08, 0.08, 0.12, 0.08, 0.08, 0.15], leg: [0.1, 0.1, 0.12, 0.1, 0.1, 0.12, 0.08, 0.15] };
export const ACCEPT = 2.6; // distanza (in deviazioni tipiche) oltre la quale "non somiglia a niente"

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function stats(items, limb) {
  const n = FLOORS[limb].length;
  const byMove = {};
  for (const it of items) (byMove[it.move] ||= []).push(it.f);
  // deviazione "dentro la classe" (quanto varia lo stesso colpo) → scala di ogni caratteristica
  const scale = Array.from({ length: n }, (_, k) => {
    let sum = 0, cnt = 0;
    for (const fs of Object.values(byMove)) {
      const vals = fs.map((f) => f[k]).filter(finite);
      if (vals.length < 2) continue;
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      sum += vals.reduce((a, b) => a + (b - m) ** 2, 0); cnt += vals.length - 1;
    }
    return Math.max(FLOORS[limb][k], cnt ? Math.sqrt(sum / cnt) : 0);
  });
  return scale;
}

function distance(a, b, scale) {
  let s = 0, n = 0;
  for (let k = 0; k < scale.length; k += 1) {
    if (!finite(a[k]) || !finite(b[k])) continue;
    s += ((a[k] - b[k]) / scale[k]) ** 2; n += 1;
  }
  return n ? Math.sqrt(s / n) : Infinity;
}

// Modello per arto e ruolo (braccio avanti, braccio dietro, gamba avanti, gamba dietro)
export function buildModel(templates) {
  const items = Array.isArray(templates?.items) ? templates.items : [];
  const groups = {};
  for (const it of items) {
    if (!it?.move || !Array.isArray(it.f)) continue;
    (groups[`${it.limb}:${it.role}`] ||= []).push(it);
  }
  const model = {};
  for (const [key, list] of Object.entries(groups)) {
    const limb = key.split(':')[0];
    model[key] = { items: list, scale: stats(list, limb) };
  }
  return model;
}

// Il colpo più somigliante: media dei 2 esempi più vicini di ogni colpo
export function classify(model, limb, role, f, { exclude } = {}) {
  const group = model?.[`${limb}:${role}`];
  if (!group) return null;
  const perMove = {};
  for (const it of group.items) {
    if (it === exclude) continue;
    (perMove[it.move] ||= []).push(distance(f, it.f, group.scale));
  }
  const ranked = Object.entries(perMove)
    .map(([move, ds]) => { ds.sort((a, b) => a - b); return { move, dist: ds.length > 1 ? (ds[0] + ds[1]) / 2 : ds[0] }; })
    .sort((a, b) => a.dist - b.dist);
  if (!ranked.length) return null;
  const [best, second] = ranked;
  return { move: best.move, dist: best.dist, second: second?.move || null, margin: second ? second.dist - best.dist : Infinity, accepted: best.dist <= ACCEPT };
}

// Quanto bene si distinguono i tuoi colpi tra loro (ognuno riconosciuto dagli altri)
export function selfCheck(templates) {
  const model = buildModel(templates);
  const confusions = {};
  let ok = 0, total = 0;
  for (const group of Object.values(model)) {
    const moves = new Set(group.items.map((it) => it.move));
    if (moves.size < 2) continue;
    for (const it of group.items) {
      if (group.items.filter((x) => x.move === it.move).length < 2) continue;
      const [limb, role] = [it.limb, it.role];
      const res = classify(model, limb, role, it.f, { exclude: it });
      total += 1;
      if (res?.move === it.move) ok += 1;
      else if (res) { const k = [it.move, res.move].sort().join('|'); confusions[k] = (confusions[k] || 0) + 1; }
    }
  }
  return { accuracy: total ? ok / total : null, total, confusions: Object.entries(confusions).sort((a, b) => b[1] - a[1]).map(([pair, n]) => ({ pair: pair.split('|'), n })) };
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

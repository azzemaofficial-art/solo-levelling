// ─────────────────────────────────────────────────────────────────────────────
// Modalità sacco del coach MMA: logica pura (niente DOM), testabile in Node.
//
// 1. analyzeBag(): Emanuele tocca il sacco sullo schermo; da un fotogramma
//    rimpicciolito (RGBA, lato ≤ 256 px) si trova la sagoma del sacco con una
//    crescita di regione dal punto toccato. Il costo per entrare in un pixel è il
//    bordo (gradiente) più un piccolo extra se il colore è molto diverso: le
//    sfumature morbide del cilindro (lato in luce / lato in ombra) non fermano la
//    crescita, i bordi netti sì. Si prova ogni soglia (minimax con coda a secchi,
//    un passaggio solo) e si tiene la regione più "da sacco": alta, piena,
//    larghezza costante, che non tocca i bordi dell'immagine. La persona (dallo
//    scheletro) è esclusa: se copre mezzo sacco, la larghezza vera viene dalle
//    righe libere. Niente modello da scaricare (MediaPipe InteractiveSegmenter
//    vorrebbe qualche MB in più e un secondo motore sul telefono): se il sacco
//    non si trova bene lo diciamo e si ritocca.
// 2. bagZones() / bagTargets(): zone testa e corpo all'altezza del TUO viso e
//    del TUO plesso (scheletro in guardia), dentro il sacco; un bersaglio per
//    ogni colpo della combo (diretti al centro, ganci sul bordo, montante sotto,
//    colpi al corpo nella zona corpo, calci in basso/al corpo/alla testa).
// 3. createBagMotion(): il sacco si è mosso? Miniature 32×32 in grigio della
//    parte alta del sacco (dove le braccia non arrivano). Profilo per colonne →
//    spostamento orizzontale sub-pixel (Lucas–Kanade 1D) → velocità. Un colpo è
//    un CAMBIO BRUSCO di velocità rispetto alla tendenza (l'oscillazione del
//    sacco è morbida, periodo ~2,5 s); in più il "tremolio" (differenza media tra
//    miniature) per i colpi che spingono il sacco in profondità o lo fanno girare.
// 4. createBagContacts(): contatto = pugno che arriva al bordo del sacco con una
//    frenata brusca + il sacco che si muove subito dopo. Ne esce
//    { t, S: 'L'|'R', limb, zone, strength, x, y, sure }.
// 5. matchContacts(): abbina i colpi del motore ai contatti; un colpo senza
//    contatto non è "a segno"; il contatto corregge il braccio se il motore ha
//    scelto quello sbagliato.
//
// Soglie: tutte in BAG, in unità relative (larghezze di sacco, pixel della
// miniatura per fotogramma da 33 ms). Vengono da calcoli fisici e da prove
// sintetiche, NON da video veri al sacco: da confermare sul telefono.
// ─────────────────────────────────────────────────────────────────────────────

import { EXPECT } from './mmaComboJudge.js';
import { unflip } from './mmaStrikes.js';

export const BAG = {
  // ── analisi del sacco ──
  edgeK: 1,           // peso del bordo (gradiente) nel costo
  colorFree: 30,      // differenza di colore "gratis" (ombra del cilindro)
  colorK: 0.3,        // oltre: costo in più per colori molto diversi
  minConfidence: 0.35,
  // ── contatto ──
  near: 0.45,         // pugno entro 0,45 larghezze di sacco dal bordo (≈ 15 cm: guanto + errore dello scheletro).
                      // Un pugno fermato a 30 cm è a ~0,85: fuori.
  vMin: 2.5,          // arrivo ad almeno 2,5 larghezze/s (≈ 0,9 m/s; un jab vero 3–6 m/s)
  stopRatio: 0.45,    // frenata brusca: nel fotogramma dopo la velocità scende sotto il 45%
  approach: 0.08,     // nell'ultimo tratto il pugno si è avvicinato al sacco di almeno 0,08 larghezze
  nearBlind: 0.3,     // senza miniature (o sacco che non si distingue dal muro) il contatto è "probabile"
  vMinBlind: 3.5,     // solo se il pugno è più vicino e più veloce
  win: [-80, 230],    // il sacco si muove da 80 ms prima (fotogrammi) a 230 ms dopo l'arrivo
  impWait: 110,       // un movimento senza arrivo aspetta 110 ms un pugno ritardatario
  refractory: 160,    // lo stesso braccio non colpisce due volte in 160 ms
  vStrong: 10,        // forza: arrivo a 10 larghezze/s (≈ 3,5 m/s) = pieno…
  zStrong: 4,         // …e sacco mosso 4 volte la soglia = pieno
  // ── movimento del sacco (miniature) ──
  thumb: 32,
  minStd: 4,          // miniatura quasi uniforme (livelli di grigio) = cieco
  minContrast: 10,    // profilo per colonne quasi piatto = il sacco non si stacca dal muro
  impulseMin: 0.15,   // cambio di velocità minimo, px della miniatura per 33 ms
                      // (fisica: un pugno dà 0,1–0,3 m/s in alto al sacco ≈ 0,2–0,6 px)
  impulseK: 4,        // …e almeno 4 volte il rumore della previsione (un falso da solo non basta:
                      // serve anche un pugno che arriva al sacco nello stesso momento)
  movingNoise: 0.12,  // col sacco che oscilla il rumore della velocità cresce: 12% della velocità
  shakeMin: 2.5,      // tremolio minimo (differenza media, scala normalizzata a deviazione 32)
  shakeK: 6,
  baseMs: 450,        // tendenza della velocità stimata sugli ultimi 0,45 s, esclusi gli ultimi 1–3 fotogrammi
  impRefractory: 120, // dopo un colpo il sacco vibra: 120 ms senza nuovi impulsi
  settleMs: 40,       // la nuova tendenza parte 40 ms dopo il colpo (1-2 veloci: il secondo si vede da ~170 ms)
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vis = (p, min = 0.3) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= min;
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[clamp(Math.round(q * (s.length - 1)), 0, s.length - 1)];
};

// ── 1. Analisi del sacco ────────────────────────────────────────────────────

function features(img) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    A[i] = r - g;
    B[i] = (r + g) / 2 - b;
  }
  // luce scarsa: si allarga il contrasto (guadagno ≤ 6) così le soglie restano in scala
  const sample = Array.from(L.filter((_, i) => i % 7 === 0));
  const p2 = pct(sample, 0.02), p98 = pct(sample, 0.98);
  const gain = clamp(160 / Math.max(20, p98 - p2), 1, 6);
  if (gain > 1.05) for (let i = 0; i < n; i += 1) { L[i] = (L[i] - p2) * gain; A[i] *= gain; B[i] *= gain; }
  // due passate di media 3×3 ≈ sfocatura gaussiana: toglie il rumore del sensore
  for (const ch of [L, A, B]) for (let k = 0; k < 2; k += 1) boxBlur(ch, w, h);
  return { L, A, B, w, h, gain };
}

function boxBlur(ch, w, h) {
  const tmp = new Float32Array(ch.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = ch[y * w + Math.max(0, x - 1)], b = ch[y * w + x], c = ch[y * w + Math.min(w - 1, x + 1)];
      tmp[y * w + x] = (a + b + c) / 3;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = tmp[Math.max(0, y - 1) * w + x], b = tmp[y * w + x], c = tmp[Math.min(h - 1, y + 1) * w + x];
      ch[y * w + x] = (a + b + c) / 3;
    }
  }
}

// gradiente di Sobel su luce e colore, scalato: un bordo netto di contrasto C vale ~C/3
function gradient({ L, A, B, w, h }) {
  const G = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let sum = 0;
      for (const ch of [L, A, B]) {
        const i = y * w + x;
        const gx = ch[i - w + 1] + 2 * ch[i + 1] + ch[i + w + 1] - ch[i - w - 1] - 2 * ch[i - 1] - ch[i + w - 1];
        const gy = ch[i + w - 1] + 2 * ch[i + w] + ch[i + w + 1] - ch[i - w - 1] - 2 * ch[i - w] - ch[i - w + 1];
        sum += gx * gx + gy * gy;
      }
      G[y * w + x] = Math.sqrt(sum) / 4;
    }
  }
  return G;
}

// la persona davanti al sacco: capsule attorno a braccia, gambe, busto e testa (dallo scheletro)
const SEGMENTS = [[11, 13, 0.14], [13, 15, 0.14], [12, 14, 0.14], [14, 16, 0.14], [15, 19, 0.16], [16, 20, 0.16], [15, 17, 0.16], [16, 18, 0.16],
  [23, 25, 0.17], [25, 27, 0.15], [24, 26, 0.17], [26, 28, 0.15], [27, 31, 0.12], [28, 32, 0.12], [11, 12, 0.12], [23, 24, 0.12], [11, 23, 0.12], [12, 24, 0.12]];
export function personMask(points, w, h) {
  if (!Array.isArray(points) || points.length < 29) return null;
  const P = (i) => (vis(points[i]) ? [points[i].x * w, points[i].y * h] : null);
  const sh = P(11) && P(12) ? [(P(11)[0] + P(12)[0]) / 2, (P(11)[1] + P(12)[1]) / 2] : null;
  const hp = P(23) && P(24) ? [(P(23)[0] + P(24)[0]) / 2, (P(23)[1] + P(24)[1]) / 2] : null;
  let torso = sh && hp ? Math.hypot(sh[0] - hp[0], sh[1] - hp[1]) : sh ? 1.6 * Math.hypot(P(11)[0] - P(12)[0], P(11)[1] - P(12)[1]) : 0;
  if (!(torso > 2)) return null;
  const mask = new Uint8Array(w * h);
  const capsule = (a, b, r) => {
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r));
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
        if (Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy) <= r) mask[y * w + x] = 1;
      }
    }
  };
  for (const [a, b, k] of SEGMENTS) { const A = P(a), B = P(b); if (A && B) capsule(A, B, k * torso); }
  // busto pieno: due triangoli spalle-anche
  if (P(11) && P(12) && P(23) && P(24)) {
    const quad = [P(11), P(12), P(24), P(23)];
    const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y += 1) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x += 1) {
        let inside = false;
        for (let i = 0, j = 3; i < 4; j = i, i += 1) {
          const [xi, yi] = quad[i], [xj, yj] = quad[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) mask[y * w + x] = 1;
      }
    }
  }
  const nose = P(0);
  if (nose) capsule(nose, sh ? [nose[0] * 0.8 + sh[0] * 0.2, nose[1] * 0.8 + sh[1] * 0.2] : nose, 0.34 * torso);
  return mask;
}

// Analizza il sacco da un fotogramma RGBA e dal punto toccato (normalizzato 0–1).
// Restituisce sempre { ok, box, axis, width, outline, confidence, hint }: se ok è
// false, box è una stima di ripiego (centrata sul tocco) che l'utente può accettare.
export function analyzeBag(img, tap, { points = null } = {}) {
  const fail = (reason, hint, extra = {}) => ({ ok: false, reason, hint, confidence: 0, ...guessBag(tap, points, img), ...extra });
  if (!img?.data || !(img.width > 8) || !(img.height > 8) || !tap || !Number.isFinite(tap.x) || !Number.isFinite(tap.y)) return fail('input', 'Non vedo l’immagine della camera. Riprova.');
  const f = features(img);
  const { w, h } = f;
  const mask = personMask(points, w, h);
  let sx = clamp(Math.round(tap.x * w), 0, w - 1), sy = clamp(Math.round(tap.y * h), 0, h - 1);
  if (mask?.[sy * w + sx]) {
    // tocco sul bordo della persona: il pixel libero più vicino (entro il 5% dell'immagine)
    const R = Math.max(2, Math.round(0.05 * Math.min(w, h)));
    let best = null;
    for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) {
      const x = sx + dx, y = sy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || mask[y * w + x]) continue;
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { x, y, d };
    }
    if (!best) return fail('person', 'Hai toccato te stesso: tocca il sacco.');
    sx = best.x; sy = best.y;
  }
  // larghezza attesa: le spalle viste dal telefono (se la persona è in quadro)
  const expectW = Array.isArray(points) && vis(points[11]) && vis(points[12]) ? Math.hypot((points[11].x - points[12].x) * w, (points[11].y - points[12].y) * h) : 0;
  const G = gradient(f);
  const first = regionAt(f, G, mask, sx, sy, expectW);
  if (first.ok) return first;
  // tocco su un logo, una scritta o una cucitura: si riprova più in basso sul sacco e si tiene
  // il risultato solo se il contorno trovato contiene il punto toccato
  let res = first;
  for (const dy of [0.1, 0.2, -0.08]) {
    const y = clamp(Math.round(sy + dy * h), 0, h - 1);
    if (mask?.[y * w + sx]) continue;
    const r = regionAt(f, G, mask, sx, y, expectW);
    if (!r.ok || !r.box) continue;
    const { x0, x1, y0, y1 } = r.box;
    if (sx / w < x0 || sx / w > x1 || sy / h < y0 || sy / h > y1) continue;
    if (!res.ok || r.confidence > res.confidence) res = r;
  }
  if (res.ok) return res;
  return first.box ? first : fail('shape', first.hint);
}

// Una regione a partire da un seme: colore del seme, costo, minimax, forma migliore.
function regionAt(f, G, mask, sx, sy, expectW) {
  const { w, h } = f;
  // colore del sacco: mediana di 5×5 attorno al tocco (un logo o una cucitura non la spostano)
  const seed = { L: [], A: [], B: [] };
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
    const x = clamp(sx + dx, 0, w - 1), y = clamp(sy + dy, 0, h - 1), i = y * w + x;
    if (mask?.[i]) continue;
    seed.L.push(f.L[i]); seed.A.push(f.A[i]); seed.B.push(f.B[i]);
  }
  const sL = median(seed.L), sA = median(seed.A), sB = median(seed.B);
  const cost = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const d = Math.sqrt((0.5 * (f.L[i] - sL)) ** 2 + (f.A[i] - sA) ** 2 + (f.B[i] - sB) ** 2);
    cost[i] = clamp(Math.round(BAG.edgeK * G[i] + BAG.colorK * Math.max(0, d - BAG.colorFree)), 0, 255);
  }
  // minimax dal tocco: level[p] = il bordo più alto da superare per arrivare a p
  const level = new Uint8Array(w * h).fill(255), seen = new Uint8Array(w * h);
  const buckets = Array.from({ length: 256 }, () => []);
  const s0 = sy * w + sx;
  level[s0] = cost[s0]; seen[s0] = 1; buckets[cost[s0]].push(s0);
  const order = []; // pixel in ordine di livello
  for (let b = 0; b < 256; b += 1) {
    const q = buckets[b];
    for (let k = 0; k < q.length; k += 1) {
      const i = q[k];
      order.push(i);
      const x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0 || seen[j] || mask?.[j]) continue;
        seen[j] = 1;
        const lv = Math.max(b, cost[j]);
        level[j] = lv; buckets[lv].push(j);
      }
    }
  }
  // tutte le soglie in un passaggio: si aggiungono i pixel in ordine di livello e si misura la forma
  const rowMin = new Int32Array(h).fill(w), rowMax = new Int32Array(h).fill(-1), rowCnt = new Int32Array(h);
  let area = 0, lastArea = 0, best = null;
  const cands = [];
  for (let k = 0; k < order.length; k += 1) {
    const i = order[k], x = i % w, y = (i - x) / w;
    if (x < rowMin[y]) rowMin[y] = x;
    if (x > rowMax[y]) rowMax[y] = x;
    rowCnt[y] += 1; area += 1;
    const lvNext = k + 1 < order.length ? level[order[k + 1]] : 256;
    if (lvNext === level[i] || area < 12) continue;
    if (area < lastArea * 1.03 && lvNext < 256) continue;
    lastArea = area;
    const c = shapeOf(rowMin, rowMax, rowCnt, area, w, h, mask, expectW);
    c.t = level[i];
    cands.push(c);
    if (!best || c.score > best.score) best = c;
  }
  const noShape = { ok: false, reason: 'shape', hint: 'Non trovo il sacco: tocca il centro del sacco, con più luce.' };
  if (!best || best.score <= 0.05) return noShape;
  // tra le soglie buone attorno alla migliore (senza buchi in mezzo) si tiene la regione più grande:
  // copre anche il lato in ombra, ma si ferma prima di colare nel muro
  const bi = cands.indexOf(best);
  let pick = best;
  for (let k = bi + 1; k < cands.length && cands[k].score >= 0.7 * best.score; k += 1) if (cands[k].score >= 0.85 * best.score) pick = cands[k];
  // ricostruisce la regione scelta
  const inRegion = (i) => seen[i] && level[i] <= pick.t;
  rowMin.fill(w); rowMax.fill(-1); rowCnt.fill(0);
  for (let i = 0; i < w * h; i += 1) {
    if (!inRegion(i)) continue;
    const x = i % w, y = (i - x) / w;
    if (x < rowMin[y]) rowMin[y] = x;
    if (x > rowMax[y]) rowMax[y] = x;
    rowCnt[y] += 1;
  }
  const geo = bagGeometry(rowMin, rowMax, rowCnt, mask, w, h, sy);
  if (!geo) return noShape;
  const stability = clamp((pick.t - best.t + 4) / 10, 0.4, 1);
  const confidence = Math.round(clamp(best.score * stability * (1 - 0.5 * geo.occluded), 0, 1) * 100) / 100;
  const out = { ...geo, confidence, imgAspect: w / h, gain: Math.round(f.gain * 10) / 10, seed: { x: sx / w, y: sy / h } };
  if (confidence < BAG.minConfidence || geo.aspect < 1.1) return { ...out, ok: false, reason: 'unsure', hint: 'Non sono sicuro del contorno: controlla, oppure ritocca il sacco.' };
  return { ...out, ok: true, hint: '' };
}

function shapeOf(rowMin, rowMax, rowCnt, area, w, h, mask = null, expectW = 0) {
  // righe tagliate dalla persona: contano per l'altezza, non per larghezza e regolarità
  const spans = [], free = [];
  let y0 = -1, y1 = -1, side = 0, sum = 0;
  for (let y = 0; y < h; y += 1) {
    if (!rowCnt[y]) continue;
    if (y0 < 0) y0 = y;
    y1 = y;
    const s = rowMax[y] - rowMin[y] + 1;
    spans.push(s); sum += s;
    if (rowMin[y] === 0 || rowMax[y] === w - 1) side += 1;
    const cut = mask && [rowMin[y] - 1, rowMin[y] - 2, rowMax[y] + 1, rowMax[y] + 2].some((x) => x >= 0 && x < w && mask[y * w + x]);
    if (!cut) free.push(s);
  }
  const ref = free.length >= 4 ? free : spans;
  const H = y1 - y0 + 1, W = Math.max(1, pct(ref, 0.75));
  const aspect = H / W;
  const rect = clamp(ref.reduce((a, v) => a + v, 0) / (ref.length * W), 0, 1);
  const solid = clamp(area / sum, 0, 1);
  const mid = ref.slice(Math.floor(ref.length * 0.1), Math.ceil(ref.length * 0.9));
  const mean = mid.reduce((s, v) => s + v, 0) / Math.max(1, mid.length);
  const cv = mid.length > 2 ? Math.sqrt(mid.reduce((s, v) => s + (v - mean) ** 2, 0) / mid.length) / Math.max(1, mean) : 1;
  const sideFrac = side / Math.max(1, spans.length);
  // con lo scheletro: un sacco è largo più o meno come le spalle viste dal telefono (0,55–1,6 volte)
  const ratio = expectW > 0 ? W / expectW : 1;
  const prior = expectW > 0 ? clamp((ratio - 0.25) / 0.3, 0.15, 1) * clamp((2.2 - ratio) / 0.6, 0.15, 1) : 1;
  const score = clamp((aspect - 0.8) / 1.2, 0, 1)
    * clamp((rect - 0.45) / 0.35, 0, 1)
    * clamp((solid - 0.45) / 0.35, 0, 1)
    * (1 - clamp(cv * 1.4, 0, 0.9))
    * (1 - clamp(sideFrac * 2, 0, 1))
    * (y0 === 0 && y1 === h - 1 ? 0.3 : 1)
    * clamp(area / (0.006 * w * h), 0, 1)
    * (W >= 4 ? 1 : 0)
    * prior;
  return { score, area, aspect, rect, solid, cv, H, W, y0, y1 };
}

// dalle righe della regione: larghezza vera, asse (anche inclinato), estremi, contorno
function bagGeometry(rowMin, rowMax, rowCnt, mask, w, h, seedY) {
  const rows = [];
  for (let y = 0; y < h; y += 1) if (rowCnt[y]) rows.push({ y, l: rowMin[y], r: rowMax[y], s: rowMax[y] - rowMin[y] + 1 });
  if (rows.length < 6) return null;
  // righe tagliate dalla persona (la regione tocca la maschera): non dicono la larghezza vera
  const cut = (r) => Boolean(mask) && [r.l - 1, r.l - 2, r.r + 1, r.r + 2].some((x) => x >= 0 && x < w && mask[r.y * w + x]);
  const free = rows.filter((r) => !cut(r));
  const ref = free.length >= 6 ? free : rows;
  const W0 = pct(ref.map((r) => r.s), 0.75);
  // righe "piene" (non tagliate da persona/logo): asse con i minimi quadrati
  const full = ref.filter((r) => r.s >= 0.8 * W0 && r.s <= 1.25 * W0);
  let a = median(rows.map((r) => (r.l + r.r) / 2)), b = 0;
  if (full.length >= 5) {
    const my = full.reduce((s, r) => s + r.y, 0) / full.length, mx = full.reduce((s, r) => s + (r.l + r.r) / 2, 0) / full.length;
    let sxy = 0, syy = 0;
    for (const r of full) { sxy += (r.y - my) * ((r.l + r.r) / 2 - mx); syy += (r.y - my) ** 2; }
    b = syy > 0 ? clamp(sxy / syy, -0.35, 0.35) : 0;
    a = mx - b * my;
  }
  const W = full.length >= 3 ? median(full.map((r) => r.s)) : W0;
  const cx = (y) => a + b * y;
  // riga coperta dalla persona: dentro la sagoma attesa c'è la maschera
  const covered = (y) => {
    if (!mask) return false;
    for (let x = Math.max(0, Math.round(cx(y) - W / 2)); x <= Math.min(w - 1, Math.round(cx(y) + W / 2)); x += 1) if (mask[y * w + x]) return true;
    return false;
  };
  // la corsa di righe "da sacco" più lunga che contiene il tocco (taglia catena, pavimento, colate)
  const good = new Map(rows.map((r) => [r.y, r]));
  const okRow = (y) => {
    const r = good.get(y);
    if (!r) return covered(y);
    const c = (r.l + r.r) / 2;
    return (r.s <= 1.6 * W && Math.abs(c - cx(y)) <= 0.6 * W && r.s >= 0.35 * W) || covered(y);
  };
  let ys = clamp(seedY, rows[0].y, rows[rows.length - 1].y);
  if (!okRow(ys)) ys = full.length ? full[Math.floor(full.length / 2)].y : rows[rows.length >> 1].y;
  let top = ys, bot = ys;
  while (top > 0 && okRow(top - 1)) top -= 1;
  while (bot < h - 1 && okRow(bot + 1)) bot += 1;
  // una riga coperta in fondo o in cima non allunga il sacco oltre la regione vera
  while (top < bot && !good.has(top)) top += 1;
  while (bot > top && !good.has(bot)) bot -= 1;
  const H = bot - top + 1;
  if (H < 8) return null;
  let coveredRows = 0;
  for (let y = top; y <= bot; y += 1) if (covered(y)) coveredRows += 1;
  const pad = 1.5; // la sfocatura mangia ~1,5 px per lato
  const half = W / 2 + pad;
  const yTop = top - pad, yBot = bot + 1 + pad;
  const xs = [cx(yTop) - half, cx(yTop) + half, cx(yBot) - half, cx(yBot) + half];
  // contorno leggero (12 righe): bordi veri dove la riga è piena, altrimenti il cilindro
  const outline = [];
  for (let k = 0; k <= 12; k += 1) {
    const y = Math.round(top + (k / 12) * (bot - top));
    const r = good.get(y);
    const fullRow = r && r.s >= 0.8 * W && r.s <= 1.25 * W && !covered(y);
    outline.push({ y: (y + 0.5) / h, l: ((fullRow ? r.l : cx(y) - W / 2) - pad + 0.5) / w, r: ((fullRow ? r.r : cx(y) + W / 2) + pad + 0.5) / w });
  }
  return {
    box: { x0: clamp(Math.min(...xs) / w, 0, 1), x1: clamp(Math.max(...xs) / w, 0, 1), y0: clamp(yTop / h, 0, 1), y1: clamp(yBot / h, 0, 1) },
    axis: { xTop: (cx(yTop) + 0.5) / w, xBot: (cx(yBot) + 0.5) / w },
    width: (W + 2 * pad) / w,
    aspect: ((H + 2 * pad) / (W + 2 * pad)),
    occluded: coveredRows / H,
    outline,
  };
}

// stima di ripiego quando il contorno non si trova: un sacco tipico (35 cm × 1,1 m) sotto il tocco
function guessBag(tap, points, img) {
  const x = clamp(tap?.x ?? 0.5, 0, 1), y = clamp(tap?.y ?? 0.4, 0, 1);
  const aspect = img?.width && img?.height ? img.width / img.height : 0.75;
  let torsoH = 0.22; // altezza del busto in frazione d'immagine (inquadratura a corpo intero)
  if (Array.isArray(points) && [11, 12, 23, 24].every((i) => vis(points[i]))) {
    torsoH = Math.abs((points[23].y + points[24].y) / 2 - (points[11].y + points[12].y) / 2) || torsoH;
  }
  const width = clamp((0.7 * torsoH) / aspect, 0.04, 0.4), height = clamp(2.2 * torsoH, 0.15, 0.9);
  const y0 = clamp(y - 0.3 * height, 0, 1 - height);
  return {
    box: { x0: clamp(x - width / 2, 0, 1), x1: clamp(x + width / 2, 0, 1), y0, y1: y0 + height },
    axis: { xTop: x, xBot: x }, width, aspect: (height / width) / aspect, occluded: 0, imgAspect: aspect,
    outline: Array.from({ length: 13 }, (_, k) => ({ y: y0 + (k / 12) * height, l: x - width / 2, r: x + width / 2 })),
    guessed: true,
  };
}

// centro del sacco all'altezza y (asse inclinato se il sacco pende o il telefono è storto)
export function axisX(bag, y, offset = 0) {
  const { y0, y1 } = bag.box;
  const u = y1 > y0 ? (y - y0) / (y1 - y0) : 0.5;
  return bag.axis.xTop + (bag.axis.xBot - bag.axis.xTop) * u + offset;
}

// ── 2. Zone e bersagli ──────────────────────────────────────────────────────

// Zone dal TUO corpo: testa all'altezza del viso (naso → mento), corpo al plesso/fegato
// (metà tra spalle e anche), basso alla coscia. Se lo scheletro manca: proporzioni del sacco.
// near = verso dove sta la persona rispetto al sacco (+1 destra, -1 sinistra nell'immagine).
// leadNear = il lato del braccio avanti è quello verso il telefono (posizione consigliata):
// allora il gancio avanti arriva sul bordo vicino a te, quello dietro sul bordo lontano.
export function bagZones(bag, points = null, { stance = 'orthodox' } = {}) {
  const { y0, y1 } = bag.box;
  const h = y1 - y0;
  let head = y0 + 0.22 * h, body = y0 + 0.52 * h, low = y0 + 0.85 * h, near = 0, leadNear = true, fromBody = false;
  const P = (i) => (Array.isArray(points) && vis(points[i], 0.4) ? points[i] : null);
  if (P(11) && P(12)) {
    const shY = (P(11).y + P(12).y) / 2, shX = (P(11).x + P(12).x) / 2;
    const hipY = P(23) && P(24) ? (P(23).y + P(24).y) / 2 : shY + 1.6 * Math.abs(P(11).x - P(12).x);
    const noseY = P(0) ? P(0).y : shY - 0.35 * (hipY - shY);
    head = noseY + 0.2 * (shY - noseY);
    body = shY + 0.5 * (hipY - shY);
    const kneeY = P(25) && P(26) ? (P(25).y + P(26).y) / 2 : hipY + 0.9 * (hipY - shY);
    low = hipY + 0.6 * (kneeY - hipY);
    near = Math.sign(shX - axisX(bag, shY)) || 0;
    // il braccio avanti è più vicino al telefono? (z MediaPipe: più piccolo = più vicino)
    const lead = stance === 'southpaw' ? 12 : 11, rear = lead === 11 ? 12 : 11;
    if (Number.isFinite(points[lead]?.z) && Number.isFinite(points[rear]?.z) && Math.abs(points[lead].z - points[rear].z) > 0.05) leadNear = points[lead].z < points[rear].z;
    fromBody = true;
  }
  // dentro il sacco, in ordine, mai appiccicate
  const m = 0.08 * h;
  head = clamp(head, y0 + m, y1 - 3 * m);
  body = clamp(body, head + 1.5 * m, y1 - 1.5 * m);
  low = clamp(low, body + m, y1 - 0.5 * m);
  return { head, body, low, near: near || 1, nearKnown: Boolean(near), leadNear, fromBody, r: 0.3 * bag.width };
}

const NO_TARGET = new Set(['clinch', 'slip', 'roll', 'parry', 'feint', 'level', 'check', 'guided']);
// Un bersaglio per ogni colpo della combo, nell'ordine. labels: i numeri della combo (1, 2, 3↓…).
// Diretti al centro della zona; ganci e calci circolari sul bordo del loro lato; montante sotto la
// testa; ginocchiata tra corpo e basso. Le coordinate sono normalizzate (0–1), come lo scheletro.
export function bagTargets(bag, zones, moveIds, { labels = [], stance = 'orthodox' } = {}) {
  const lead = stance === 'southpaw' ? 'R' : 'L', rear = lead === 'L' ? 'R' : 'L';
  const w = bag.width, r = zones.r;
  const out = [];
  const used = new Map();
  moveIds.forEach((id, i) => {
    const e = EXPECT[id];
    if (!e || NO_TARGET.has(e.kind)) return;
    const S = e.side === 'rear' ? rear : lead;
    // lato del bordo: il gancio avanti sul bordo vicino a te se il telefono è dal lato del braccio avanti
    const edgeSign = (e.side === 'rear') === zones.leadNear ? -zones.near : zones.near;
    const edge = (y) => axisX(bag, y) + edgeSign * 0.32 * w;
    let y, x, zone = e.level === 'body' ? 'body' : 'head', arrow = null, size = 1;
    if (e.kind === 'straight') { y = e.level === 'body' ? zones.body : zones.head; x = axisX(bag, y); }
    else if (e.kind === 'hook') { y = e.level === 'body' ? zones.body : zones.head; x = edge(y); arrow = edgeSign > 0 ? 'left' : 'right'; }
    else if (e.kind === 'uppercut') { y = zones.head + 0.45 * (zones.body - zones.head); x = axisX(bag, y); arrow = 'up'; }
    else if (e.kind === 'elbow') { y = zones.head; x = edge(y); size = 0.8; }
    else if (e.kind === 'knee') { y = zones.body + 0.6 * (zones.low - zones.body); x = axisX(bag, y); zone = 'body'; }
    else if (e.kind === 'teep') { y = zones.body; x = axisX(bag, y); zone = 'body'; }
    else if (e.kind === 'kick') {
      y = e.level === 'low' ? zones.low : e.level === 'head' ? zones.head : zones.body;
      x = edge(y); zone = e.level === 'low' ? 'low' : e.level === 'head' ? 'head' : 'body'; size = 1.15;
    } else return;
    // stesso posto già usato (jab-jab): il secondo scende un po'
    const key = `${Math.round(x * 200)}:${Math.round(y * 200)}`;
    const k = used.get(key) || 0; used.set(key, k + 1);
    out.push({ i, id, label: labels[i] ?? String(i + 1), x, y: y + k * 0.9 * r * (bag.imgAspect || 0.75), r: r * size, S, zone, kind: e.kind, arrow, limb: ['kick', 'knee', 'teep'].includes(e.kind) ? 'leg' : 'arm' });
  });
  return out;
}

// ROI per le miniature: parte alta del sacco, sopra la zona testa (le braccia non ci arrivano),
// larga 2 volte il sacco così entrano i due bordi con mezzo sacco di muro per lato: è lì che si vede
// lo spostamento, e i bordi restano dentro anche quando il sacco oscilla forte.
export function roiFor(bag, zones) {
  const { y0, y1 } = bag.box;
  const h = y1 - y0;
  const top = y0 - 0.04 * h;
  const headTop = zones ? zones.head - 1.3 * zones.r * (bag.imgAspect || 0.75) : y0 + 0.3 * h;
  const bottom = clamp(Math.min(headTop, y0 + 0.3 * h), y0 + 0.12 * h, y1);
  const cx = axisX(bag, (top + bottom) / 2);
  const w = 2 * bag.width;
  const x = clamp(cx - w / 2, 0, 1), y = clamp(top, 0, 1);
  return { x, y, w: clamp(w, 0.02, 1 - x), h: clamp(bottom - y, 0.02, 1 - y) };
}

// ── 3. Movimento del sacco dalle miniature ──────────────────────────────────

// spostamento sub-pixel di a rispetto a b (a[x] ≈ b[x - s]): ricerca intera + Lucas–Kanade 1D
export function profileShift(a, b, maxS = 4) {
  const n = a.length;
  let best = Infinity, bs = 0;
  for (let s = -maxS; s <= maxS; s += 1) {
    let sum = 0, cnt = 0;
    for (let x = Math.max(0, s); x < Math.min(n, n + s); x += 1) { const d = a[x] - b[x - s]; sum += d * d; cnt += 1; }
    if (cnt >= n / 2 && sum / cnt < best) { best = sum / cnt; bs = s; }
  }
  const at = (x) => { const i = Math.floor(x), f = x - i; return i < 0 || i + 1 >= n ? NaN : b[i] * (1 - f) + b[i + 1] * f; };
  let s = bs;
  for (let it = 0; it < 4; it += 1) {
    let num = 0, den = 0;
    for (let x = 1; x < n - 1; x += 1) {
      const bx = at(x - s), g = (at(x - s + 0.5) - at(x - s - 0.5));
      if (!Number.isFinite(bx) || !Number.isFinite(g)) continue;
      num += (bx - a[x]) * g; den += g * g;
    }
    if (den < 1e-6) break;
    const ds = clamp(num / den, -0.5, 0.5);
    s += ds;
    if (Math.abs(ds) < 0.005) break;
  }
  return { s: clamp(s, bs - 1, bs + 1), err: best };
}

// minimi quadrati di grado 1 o 2 (equazioni normali, 3×3 al massimo)
function polyFit(xs, ys, deg) {
  const n = deg + 1, M = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let i = 0; i < xs.length; i += 1) {
    const pw = [1, xs[i], xs[i] * xs[i]];
    for (let r = 0; r < n; r += 1) { for (let c = 0; c < n; c += 1) M[r][c] += pw[r] * pw[c]; M[r][n] += pw[r] * ys[i]; }
  }
  for (let c = 0; c < n; c += 1) {
    let piv = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return [ys.reduce((a, b) => a + b, 0) / ys.length, 0, 0];
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// thumb: Uint8Array 32×32 in grigio (dal worker). push() a ogni fotogramma; occluded = una mano o la
// testa dentro la ROI (quel fotogramma non vale). Restituisce posizione, velocità e l'eventuale impulso.
export function createBagMotion({ size = BAG.thumb } = {}) {
  let prevT = null, prevProf = null, prevNorm = null, ref = null, hist = [], since = -Infinity, block = -Infinity, skip = 0, pos = 0, quietUntil = -Infinity;
  let errs = {};
  const reset = () => { prevT = null; prevProf = null; prevNorm = null; ref = null; hist = []; since = -Infinity; block = -Infinity; skip = 0; pos = 0; quietUntil = -Infinity; errs = {}; };
  const noteErr = (key, v) => { const a = (errs[key] ||= []); a.push(Math.abs(v)); if (a.length > 30) a.shift(); };
  const sigmaOf = (key, fallback) => (errs[key]?.length >= 8 ? Math.max(key === 'e' ? 0.3 : 0.02, 1.4826 * median(errs[key])) : fallback);
  function push(thumb, t, { occluded = false } = {}) {
    if (!thumb || thumb.length !== size * size || !Number.isFinite(t)) return { usable: false, pos, vel: 0, impulse: null };
    let mean = 0;
    for (let i = 0; i < thumb.length; i += 1) mean += thumb[i];
    mean /= thumb.length;
    let v2 = 0;
    for (let i = 0; i < thumb.length; i += 1) v2 += (thumb[i] - mean) ** 2;
    const std = Math.sqrt(v2 / thumb.length);
    // normalizzata (deviazione 32): un cambio di esposizione non sembra un colpo
    const k = std > 1e-3 ? 32 / std : 0;
    const norm = new Float32Array(thumb.length);
    for (let i = 0; i < thumb.length; i += 1) norm[i] = (thumb[i] - mean) * k;
    const prof = new Float32Array(size);
    let tv = 0;
    for (let x = 0; x < size; x += 1) { let s = 0; for (let y = 0; y < size; y += 1) s += norm[y * size + x]; prof[x] = s / size; }
    // contrasto vero (prima della normalizzazione): il sacco si stacca dal muro?
    for (let x = 1; x < size; x += 1) tv += Math.abs(prof[x] - prof[x - 1]) / (k || 1);
    const usable = std >= BAG.minStd && tv >= BAG.minContrast;
    const out = { usable, pos, vel: 0, impulse: null, contrast: Math.round(tv), std: Math.round(std) };
    if (!prevProf || !usable || occluded) {
      // senza riferimento, cieco o coperto: si riparte puliti al prossimo fotogramma buono
      if (occluded || !usable) skip = 2;
      prevProf = usable && !occluded ? prof : null; prevNorm = usable && !occluded ? norm : null; prevT = t;
      if (usable && !occluded && !ref) ref = prof;
      return out;
    }
    const dt = Math.max(8, t - prevT);
    const vel = (profileShift(prof, prevProf, 3).s * 33) / dt;
    let shake = 0;
    for (let i = 0; i < norm.length; i += 1) shake += Math.abs(norm[i] - prevNorm[i]);
    shake = (shake / norm.length) * Math.sqrt(33 / dt);
    // posizione assoluta rispetto al sacco fermo (niente deriva); fuori scala → nuovo riferimento
    const abs = ref ? profileShift(prof, ref, 8) : { s: 0, err: 0 };
    pos = abs.err > 0.5 * 32 * 32 ? (ref = prof, 0) : abs.s;
    out.pos = pos; out.vel = vel;
    prevProf = prof; prevNorm = norm; prevT = t;
    if (skip > 0) { skip -= 1; return out; }
    hist.push({ t, v: vel, e: shake });
    while (hist.length && hist[0].t < t - BAG.baseMs - 200) hist.shift();
    // si confrontano gli ultimi 1–3 fotogrammi (media: meno rumore) con la tendenza di prima;
    // subito dopo un colpo la tendenza è corta e si guardano al massimo 2 fotogrammi
    const kMax = since > t - BAG.baseMs ? 2 : 3;
    const lag = kMax * 35;
    const base = hist.filter((s) => s.t >= Math.max(t - BAG.baseMs, since) && s.t <= t - lag);
    if (base.length < 3 || t < block) return out;
    // tendenza della velocità: retta (con abbastanza punti), costante subito dopo un colpo. La curva
    // dell'oscillazione non entra nella previsione (estrapolarla aggiunge rumore) ma nella soglia:
    // più il sacco oscilla forte, più deve essere netto il cambio di velocità.
    let pred, resid, curve = () => 0;
    const mt = base.reduce((s, p) => s + p.t, 0) / base.length;
    if (base.length >= 5) {
      const xs = base.map((p) => (p.t - mt) / 100), vs = base.map((p) => p.v);
      const c = polyFit(xs, vs, 1);
      pred = (tt) => c[0] + c[1] * ((tt - mt) / 100);
      resid = base.map((p) => Math.abs(p.v - pred(p.t)));
      if (base.length >= 9) { const q = polyFit(xs, vs, 2); curve = (tt) => Math.abs(q[2]) * ((tt - mt) / 100) ** 2; }
    } else {
      const mv = median(base.map((p) => p.v));
      pred = () => mv;
      resid = base.map((p) => Math.abs(p.v - mv));
    }
    // rumore VERO della previsione (fuori campione), misurato sull'ultimo secondo di fotogrammi tranquilli:
    // comprende anche l'errore della tendenza quando il sacco oscilla. Finché è poco, si usa il doppio
    // di quello dentro la tendenza (prudente).
    const local = 2 * Math.max(0.02, 1.4826 * median(resid));
    const tail = hist.filter((s) => s.t > t - lag && s.t > since).slice(-kMax);
    // impulso di velocità: la media degli ultimi k scarti, tutti nello stesso verso, oltre k volte il rumore
    let zv = 0, t0 = t, dv = 0;
    const means = {};
    for (let k = 1; k <= tail.length; k += 1) {
      const rs = tail.slice(-k).map((s) => s.v - pred(s.t));
      const mean = rs.reduce((a, b) => a + b, 0) / k;
      means[k] = mean;
      if (!rs.every((r) => Math.sign(r) === Math.sign(rs[0]))) continue;
      // sacco in movimento: la stima della velocità è più rumorosa (mosso, bordi che scivolano)
      const moving = BAG.movingNoise * Math.abs(pred(tail[tail.length - 1].t));
      const thrK = Math.max(BAG.impulseMin, BAG.impulseK * Math.max(sigmaOf(k, local / Math.sqrt(k)), moving) + curve(tail[tail.length - 1].t));
      let z = Math.abs(mean) / thrK;
      // subito dopo un colpo la tendenza è corta e il sacco accelera: deve essere anche un GRADINO
      // rispetto al fotogramma appena prima (l'oscillazione cambia velocità piano, un pugno di colpo)
      if (kMax === 2) {
        const before = hist[hist.length - 1 - k];
        const vk = tail.slice(-k).reduce((a, p) => a + p.v, 0) / k;
        z = before ? Math.min(z, Math.abs(vk - before.v) / thrK) : 0;
      }
      if (z > zv) { zv = z; t0 = tail[tail.length - k].t; dv = mean; }
    }
    // tremolio: deformazione o rotazione del sacco senza spostamento laterale
    const eBase = median(base.map((p) => p.e));
    const last = hist[hist.length - 1];
    const eLocal = 2 * Math.max(0.3, 1.4826 * median(base.map((p) => Math.abs(p.e - eBase))));
    const ze = (last.e - eBase) / Math.max(BAG.shakeMin, BAG.shakeK * sigmaOf('e', eLocal));
    const z = Math.max(zv, ze);
    if (z < 1 && t > quietUntil) {
      for (const k of Object.keys(means)) noteErr(k, means[k]);
      noteErr('e', last.e - eBase);
    }
    if (z >= 1) {
      if (ze > zv) t0 = last.t;
      out.impulse = { t: t0 - Math.min(dt, 40) / 2, z: Math.round(z * 100) / 100, dv: Math.round(dv * 100) / 100, kind: zv >= ze ? 'swing' : 'shake' };
      block = t + BAG.impRefractory;
      since = t + BAG.settleMs;
      quietUntil = t + 300;
    }
    return out;
  }
  return { push, reset, offset: () => pos };
}

// ── 4. Contatti ─────────────────────────────────────────────────────────────

const HAND = { L: [15, 17, 19], R: [16, 18, 20] };
const FOOT = { L: [27, 29, 31, 25], R: [28, 30, 32, 26] };

// distanza dal sacco in larghezze di sacco: 0 = sul bordo, < 0 dentro la sagoma
function bagDistance(bag, p, aspect, offset = 0) {
  const { y0, y1 } = bag.box, w = bag.width;
  const dx = (Math.abs(p.x - axisX(bag, p.y, offset)) - w / 2) / w;
  const out = p.y < y0 ? y0 - p.y : p.y > y1 ? p.y - y1 : 0;
  const dy = out / (w * aspect);
  return dy > 0 ? Math.hypot(Math.max(0, dx), dy) : dx;
}

export function contactZone(zones, y) {
  if (!zones) return 'head';
  return y < (zones.head + zones.body) / 2 ? 'head' : y < (zones.body + zones.low) / 2 ? 'body' : 'low';
}

// Rilevatore di contatti. push(points, t, { thumb, aspect }) a ogni fotogramma: restituisce i
// contatti nuovi. order(): l'ordine sinistra/destra della calibrazione (judge.engine.order) per
// raddrizzare gli scambi di MediaPipe, così 'L'/'R' sono gli stessi del motore dei colpi.
export function createBagContacts({ bag, zones = null, roi = null, order = null } = {}) {
  const motion = createBagMotion();
  const arms = { L: [], R: [] }, legs = { L: [], R: [] };
  let cands = [], imps = [], all = [], lastArrival = { L: -Infinity, R: -Infinity }, lastContact = {};
  let lastThumbT = -Infinity, lastUsable = false, lastImpulse = null;
  const reset = () => { motion.reset(); arms.L = []; arms.R = []; legs.L = []; legs.R = []; cands = []; imps = []; all = []; lastArrival = { L: -Infinity, R: -Infinity }; lastContact = {}; lastThumbT = -Infinity; lastUsable = false; lastImpulse = null; };
  const offsetX = () => (roi ? (motion.offset() * roi.w) / BAG.thumb : 0);
  const blind = (t) => !lastUsable || t - lastThumbT > 300;

  function fistOf(points, S, aspect) {
    const ps = HAND[S].map((i) => points[i]).filter((p) => vis(p));
    if (!ps.length) return null;
    const x = ps.reduce((s, p) => s + p.x, 0) / ps.length, y = ps.reduce((s, p) => s + p.y, 0) / ps.length;
    const d = Math.min(...ps.map((p) => bagDistance(bag, p, aspect, offsetX())));
    return { x, y, d };
  }
  const speed = (a, b, aspect) => (Math.hypot(b.x - a.x, (b.y - a.y) / aspect) / bag.width) / (Math.max(8, b.t - a.t) / 1000);

  function emit(c) {
    const key = c.limb + c.S;
    if (c.t - (lastContact[key] ?? -Infinity) < BAG.refractory) return null;
    lastContact[key] = c.t;
    const ev = { ...c, strength: Math.round(c.strength * 100) / 100 };
    all.push(ev);
    if (all.length > 200) all.shift();
    return ev;
  }
  const strengthOf = (vIn, z) => clamp((vIn != null ? 0.55 * Math.min(1, vIn / BAG.vStrong) : 0.3) + (z != null ? 0.45 * Math.min(1, z / BAG.zStrong) : 0), 0, 1);

  function push(pointsIn, t, { thumb = null, aspect = 1, occluded = null } = {}) {
    const fresh = [];
    if (!bag || !Array.isArray(pointsIn) || pointsIn.length < 29) return fresh;
    const points = order ? unflip(pointsIn, null, order()).points : pointsIn;
    // movimento del sacco: la miniatura vale solo se nessuna mano/testa è dentro la ROI
    if (thumb) {
      const inRoi = roi && [0, 13, 14, 15, 16, 19, 20].some((i) => vis(points[i]) && points[i].x > roi.x - 0.1 * roi.w && points[i].x < roi.x + 1.1 * roi.w && points[i].y > roi.y - 0.05 * roi.h && points[i].y < roi.y + 1.1 * roi.h);
      const m = motion.push(thumb, t, { occluded: occluded ?? inRoi });
      lastThumbT = t; lastUsable = m.usable;
      if (m.impulse) { imps.push({ ...m.impulse, used: false, seenAt: t }); lastImpulse = m.impulse; }
    }
    // arrivi: pugno che arriva vicino al bordo e si ferma di colpo
    for (const S of ['L', 'R']) {
      const f = fistOf(points, S, aspect);
      const h = arms[S];
      if (!f) { h.length = 0; continue; }
      h.push({ t, ...f });
      while (h.length > 12) h.shift();
      if (h.length < 3) continue;
      const k = h.length - 1, a = h[k - 1];
      const vIn = Math.max(speed(h[k - 2], a, aspect), h.length >= 4 ? speed(h[k - 3], h[k - 2], aspect) : 0);
      const vOut = speed(a, h[k], aspect);
      const dBefore = Math.max(h[k - 2].d, h.length >= 4 ? h[k - 3].d : -Infinity);
      const dAt = Math.min(a.d, h[k].d);
      if (vIn >= BAG.vMin && vOut <= BAG.stopRatio * vIn && dAt <= BAG.near && dBefore - a.d >= BAG.approach && a.t - lastArrival[S] > 150) {
        lastArrival[S] = a.t;
        cands.push({ t: a.t, S, x: a.x, y: a.y, d: dAt, vIn, used: false });
      }
    }
    // piedi e ginocchia: solo la distanza (i calci muovono sempre il sacco, la frenata non serve)
    for (const S of ['L', 'R']) {
      let best = null;
      for (const i of FOOT[S]) {
        const p = points[i];
        if (!vis(p)) continue;
        const d = bagDistance(bag, p, aspect, offsetX());
        if (!best || d < best.d) best = { t, d, x: p.x, y: p.y };
      }
      if (best) { legs[S].push(best); while (legs[S].length > 12) legs[S].shift(); }
    }
    // abbinamento arrivo ↔ movimento del sacco
    for (const imp of imps) {
      if (imp.used) continue;
      const options = cands.filter((c) => !c.used && imp.t - c.t >= BAG.win[0] && imp.t - c.t <= BAG.win[1]);
      if (options.length) {
        const c = options.sort((p, q) => Math.abs(imp.t - p.t - 30) - Math.abs(imp.t - q.t - 30))[0];
        c.used = true; imp.used = true;
        const ev = emit({ t: c.t, S: c.S, limb: 'arm', zone: contactZone(zones, c.y), strength: strengthOf(c.vIn, imp.z), x: c.x, y: c.y, sure: true, by: 'stop+bag' });
        if (ev) fresh.push(ev);
        continue;
      }
      if (t - imp.seenAt < BAG.impWait) continue;
      // il sacco si è mosso ma la frenata non si è vista (filtro, pugno coperto dal sacco):
      // vale il pugno più vicino al sacco che ci stava andando contro; poi i piedi (calci)
      imp.used = true;
      let bestArm = null;
      for (const S of ['L', 'R']) {
        const h = arms[S];
        const at = h.filter((s) => Math.abs(s.t - imp.t) <= 70);
        const before = h.filter((s) => s.t < imp.t - 40 && s.t >= imp.t - 220);
        if (!at.length || !before.length) continue;
        const dAt = Math.min(...at.map((s) => s.d)), dBefore = Math.max(...before.map((s) => s.d));
        const v = before.length >= 1 && at.length ? speed(before[0], at[0], aspect) : 0;
        if (dAt <= BAG.near && dBefore - dAt >= 2 * BAG.approach && v >= 0.6 * BAG.vMin && (!bestArm || dAt < bestArm.d)) {
          const s = at.reduce((p, q) => (q.d < p.d ? q : p));
          bestArm = { S, d: dAt, v, x: s.x, y: s.y };
        }
      }
      if (bestArm) {
        const ev = emit({ t: imp.t, S: bestArm.S, limb: 'arm', zone: contactZone(zones, bestArm.y), strength: strengthOf(bestArm.v, imp.z), x: bestArm.x, y: bestArm.y, sure: true, by: 'bag' });
        if (ev) fresh.push(ev);
        continue;
      }
      let bestLeg = null;
      for (const S of ['L', 'R']) {
        for (const q of legs[S]) {
          if (Math.abs(q.t - imp.t) > 90 || q.d > 1.5 * BAG.near) continue;
          if (!bestLeg || q.d < bestLeg.d) bestLeg = { S, d: q.d, x: q.x, y: q.y };
        }
      }
      if (bestLeg) {
        const ev = emit({ t: imp.t, S: bestLeg.S, limb: 'leg', zone: contactZone(zones, bestLeg.y), strength: strengthOf(null, imp.z), x: bestLeg.x, y: bestLeg.y, sure: true, by: 'bag' });
        if (ev) fresh.push(ev);
      }
    }
    // senza miniature utili: solo arrivi netti, segnati come "probabili"
    for (const c of cands) {
      if (c.used || !blind(t)) continue;
      if (c.d <= BAG.nearBlind && c.vIn >= BAG.vMinBlind) {
        c.used = true;
        const ev = emit({ t: c.t, S: c.S, limb: 'arm', zone: contactZone(zones, c.y), strength: strengthOf(c.vIn, null), x: c.x, y: c.y, sure: false, by: 'stop' });
        if (ev) fresh.push(ev);
      }
    }
    // un arrivo senza movimento del sacco entro la finestra = pugno fermato prima (o a vuoto)
    cands = cands.filter((c) => !c.used && t - c.t <= BAG.win[1] + 60);
    imps = imps.filter((i) => !i.used && t - i.seenAt <= 400);
    return fresh;
  }
  return {
    push, reset,
    contacts: (since = -Infinity) => all.filter((c) => c.t >= since),
    state: () => ({ offsetX: offsetX(), usable: lastUsable && !blind(lastThumbT), lastImpulse }),
  };
}

// ── 5. Colpi del motore ↔ contatti ──────────────────────────────────────────

// gestures: quelli di judge.gestures(); contacts: da createBagContacts. sideOf: judge.sideOf
// ({ lead: 'L', rear: 'R' }). Ogni gesto di braccio/gamba ritorna copiato con hit (a segno) e
// contact; se il contatto dice che ha colpito l'ALTRO braccio e nessun gesto di quel braccio è lì
// vicino, il lato si corregge (sideFromContact). Un contatto vale per un gesto solo.
export function matchContacts(gestures, contacts, { sideOf = { lead: 'L', rear: 'R' }, slack = 150 } = {}) {
  const roleOf = Object.fromEntries(Object.entries(sideOf).map(([role, S]) => [S, role]));
  const out = gestures.map((g) => ({ ...g, hit: false, contact: null }));
  const strikes = out.filter((g) => (g.limb === 'arm' || g.limb === 'leg') && g.kind !== 'drop');
  const pairs = [];
  for (const c of contacts) {
    for (const g of strikes) {
      if (g.limb !== (c.limb || 'arm')) continue;
      if (c.t < (g.start ?? g.peakT) - 80 || c.t > (g.end ?? g.peakT) + slack) continue;
      const S = sideOf[g.side];
      const sameSide = !S || S === c.S;
      pairs.push({ g, c, cost: Math.abs(c.t - (g.peakT ?? g.start)) + (sameSide ? 0 : 250) });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost);
  const usedC = new Set();
  for (const { g, c } of pairs) {
    if (g.hit || usedC.has(c)) continue;
    g.hit = true; g.contact = c; usedC.add(c);
    const S = sideOf[g.side];
    if (S && S !== c.S && c.sure !== false) {
      const otherBusy = strikes.some((o) => o !== g && o.limb === g.limb && sideOf[o.side] === c.S && c.t >= (o.start ?? o.peakT) - 150 && c.t <= (o.end ?? o.peakT) + 150);
      if (!otherBusy && roleOf[c.S]) {
        g.sideFromContact = g.side;
        g.side = roleOf[c.S];
        // un colpo riconosciuto dai tuoi esempi ma col braccio sbagliato: resta il tipo, non il nome
        if (g.move && EXPECT[g.move]?.side && EXPECT[g.move].side !== g.side) g.move = null;
      }
    }
  }
  const hits = out.filter((g) => g.hit).length;
  return { gestures: out, hits, contacts: contacts.length, unmatched: contacts.filter((c) => !usedC.has(c)) };
}

// colpi della combo a segno: un colpo con bersaglio conta se il gesto abbinato ha toccato il sacco
export function bagScore(result, targets) {
  const want = new Set(targets.map((tg) => tg.i));
  const hit = result.moves.map((mv, i) => want.has(i) && Boolean(mv.gesture?.hit));
  return { hit, hits: hit.filter(Boolean).length, total: want.size };
}

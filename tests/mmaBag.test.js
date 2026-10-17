import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBag, bagZones, bagTargets, roiFor, createBagMotion, createBagContacts, matchContacts, bagScore, profileShift, axisX, BAG } from '../lib/mmaBag.js';
import { judgeSequence } from '../lib/mmaComboJudge.js';

// ── Generatori sintetici ────────────────────────────────────────────────────
// Numeri casuali ripetibili (stesso risultato a ogni prova)
const rng = (seed = 1) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// Persona in guardia vista a ~45°: spalle a (sx, sy), busto lungo T (frazione d'altezza).
// Restituisce i 33 punti MediaPipe normalizzati. lw/rw: posizione dei polsi (se dati).
function person({ sx = 0.68, sy = 0.27, T = 0.23, aspect = 0.75, lw = null, rw = null, vis = 0.9 } = {}) {
  const P = Array.from({ length: 33 }, () => ({ x: sx, y: sy - 0.07, z: 0, visibility: vis }));
  const W = (0.4 * T) / aspect; // spalle larghe ~0,4 busti
  const set = (i, x, y, z = 0) => { P[i] = { x, y, z, visibility: vis }; };
  set(0, sx - 0.2 * W, sy - 0.3 * T);
  for (let i = 1; i <= 10; i += 1) set(i, sx - 0.2 * W + (i % 3 - 1) * 0.01, sy - 0.32 * T);
  set(11, sx - W / 2, sy, -0.1); set(12, sx + W / 2, sy, 0.1); // spalla sinistra (avanti) più vicina al telefono
  const L = lw || { x: sx - 0.6 * W, y: sy - 0.15 * T }, R = rw || { x: sx + 0.1 * W, y: sy - 0.12 * T };
  set(13, (P[11].x + L.x) / 2 + 0.02, sy + 0.25 * T); set(14, (P[12].x + R.x) / 2 + 0.02, sy + 0.25 * T);
  set(15, L.x, L.y); set(17, L.x - 0.008, L.y + 0.01); set(19, L.x - 0.012, L.y - 0.004); set(21, L.x - 0.006, L.y - 0.01);
  set(16, R.x, R.y); set(18, R.x - 0.008, R.y + 0.01); set(20, R.x - 0.012, R.y - 0.004); set(22, R.x - 0.006, R.y - 0.01);
  set(23, sx - 0.4 * W, sy + T); set(24, sx + 0.4 * W, sy + T);
  set(25, sx - 0.5 * W, sy + 1.8 * T); set(26, sx + 0.4 * W, sy + 1.8 * T);
  set(27, sx - 0.6 * W, sy + 2.6 * T); set(28, sx + 0.45 * W, sy + 2.6 * T);
  set(29, sx - 0.55 * W, sy + 2.65 * T); set(30, sx + 0.5 * W, sy + 2.65 * T);
  set(31, sx - 0.75 * W, sy + 2.65 * T); set(32, sx + 0.3 * W, sy + 2.65 * T);
  return P;
}

// Scena RGBA: muro (con eventuale arredamento), pavimento, catena, sacco cilindrico con ombra,
// eventuale logo, eventuale persona disegnata davanti. light < 1 = luce scarsa.
function scene({ w = 192, h = 256, bg = [205, 196, 178], floor = [128, 108, 90], bag = { x0: 0.3, x1: 0.45, y0: 0.12, y1: 0.62 }, color = [168, 34, 36],
  shade = 0.45, tilt = 0, noise = 4, light = 1, clutter = false, logo = false, who = null, clothes = [40, 60, 150], seed = 3 } = {}) {
  const r = rng(seed);
  const data = new Uint8ClampedArray(w * h * 4);
  const cx0 = ((bag.x0 + bag.x1) / 2) * w, half = ((bag.x1 - bag.x0) / 2) * w;
  const cx = (y) => cx0 + tilt * (y - bag.y0 * h);
  // persona: capsule semplici sopra i punti
  const segs = who ? [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 24], [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28]] : [];
  const P = who ? who.map((p) => [p.x * w, p.y * h]) : null;
  const T = who ? Math.hypot(P[11][0] - P[23][0], P[11][1] - P[23][1]) : 0;
  const inPerson = (x, y) => {
    if (!who) return false;
    if (Math.hypot(x - P[0][0], y - P[0][1]) < 0.28 * T) return true;
    // busto pieno
    const xs = [P[11][0], P[12][0], P[23][0], P[24][0]], ys = [P[11][1], P[23][1]];
    if (x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys)) return true;
    for (const [a, b] of segs) {
      const A = P[a], B = P[b], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - A[0]) * dx + (y - A[1]) * dy) / l2));
      if (Math.hypot(x - A[0] - u * dx, y - A[1] - u * dy) < 0.11 * T) return true;
    }
    return false;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let c;
      const vy = 0.85 + 0.15 * (1 - y / h); // luce che cala verso il basso
      if (y > 0.82 * h) c = floor.map((v) => v * 0.9);
      else c = bg.map((v) => v * vy);
      if (clutter) {
        // porta scura, mensola, quadro blu, poster
        if (x > 0.62 * w && x < 0.86 * w && y > 0.08 * h && y < 0.82 * h) c = [92, 72, 60];
        if (x > 0.04 * w && x < 0.24 * w && y > 0.3 * h && y < 0.34 * h) c = [70, 50, 40];
        if (x > 0.06 * w && x < 0.2 * w && y > 0.1 * h && y < 0.24 * h) c = [40, 80, 170];
        if (x > 0.5 * w && x < 0.58 * w && y > 0.4 * h && y < 0.55 * h) c = [230, 230, 220];
      }
      // catena
      if (Math.abs(x - cx(bag.y0 * h)) < 1 && y < bag.y0 * h) c = [60, 60, 60];
      // sacco
      const u = (x - cx(y)) / half;
      const yb = bag.y1 * h - half * 0.4; // fondo arrotondato
      const inBag = Math.abs(u) <= 1 && y >= bag.y0 * h && (y <= yb || Math.hypot(u, (y - yb) / (half * 0.4)) <= 1);
      if (inBag) {
        const f = 1 - shade * (u + 1) / 2 + 0.1 * Math.exp(-((u + 0.5) ** 2) * 20);
        c = color.map((v) => v * f);
        if (logo && Math.abs(u) < 0.5 && y > (bag.y0 + 0.08) * h && y < (bag.y0 + 0.16) * h) c = [235, 235, 235];
      }
      if (inPerson(x, y)) c = clothes.map((v, i) => v * (i === 0 && Math.abs(x - P[0][0]) < 0.28 * T && y < P[11][1] ? 1.8 : 1));
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k += 1) data[i + k] = c[k] * light + gauss(r) * noise;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} invece di ${b.toFixed(3)} (±${tol})`);
const checkBox = (res, bag, label, tolX = 0.025, tolY = 0.04) => {
  assert.equal(res.ok, true, `${label}: ${res.reason} ${res.hint} conf ${res.confidence}`);
  near(res.box.x0, bag.x0, tolX, `${label} x0`);
  near(res.box.x1, bag.x1, tolX, `${label} x1`);
  near(res.box.y0, bag.y0, tolY, `${label} y0`);
  near(res.box.y1, bag.y1, tolY, `${label} y1`);
};
const BAGBOX = { x0: 0.3, x1: 0.45, y0: 0.12, y1: 0.62 };

// ── 1. Analisi del sacco ────────────────────────────────────────────────────

test('sacco: rosso su muro chiaro, tocco al centro → contorno, asse e larghezza giusti', () => {
  const res = analyzeBag(scene(), { x: 0.37, y: 0.3 });
  checkBox(res, BAGBOX, 'muro chiaro');
  near(res.width, 0.15, 0.02, 'larghezza');
  near(axisX(res, 0.4), 0.375, 0.015, 'asse');
  assert.ok(res.confidence >= 0.5, `confidenza ${res.confidence}`);
  assert.equal(res.outline.length, 13);
});

test('sacco: lato in ombra forte e tocco sul lato in luce → prende tutto il cilindro', () => {
  const res = analyzeBag(scene({ shade: 0.7 }), { x: 0.32, y: 0.45 });
  checkBox(res, BAGBOX, 'ombra forte');
});

test('sacco: stanza piena di cose, logo bianco sul sacco, tocco sul logo vicino', () => {
  const bag = { x0: 0.34, x1: 0.48, y0: 0.15, y1: 0.66 };
  const res = analyzeBag(scene({ clutter: true, logo: true, bag, color: [40, 70, 160], seed: 7 }), { x: 0.41, y: 0.35 });
  checkBox(res, bag, 'stanza piena');
});

test('sacco: luce scarsa (un quarto della luce, rumore alto)', () => {
  const res = analyzeBag(scene({ light: 0.25, noise: 6, seed: 11 }), { x: 0.37, y: 0.35 });
  checkBox(res, BAGBOX, 'luce scarsa', 0.03, 0.05);
  assert.ok(res.gain > 1.5, 'il contrasto viene allargato');
});

test('sacco: nero su muro scuro', () => {
  const res = analyzeBag(scene({ bg: [52, 50, 48], floor: [35, 33, 30], color: [26, 26, 28], shade: 0.35, noise: 4, seed: 5 }), { x: 0.38, y: 0.4 });
  checkBox(res, BAGBOX, 'nero su scuro', 0.03, 0.05);
});

test('sacco: persona davanti a metà sacco (vestiti dello stesso colore) → larghezza vera dalle righe libere', () => {
  // persona con la spalla sinistra davanti alla metà destra del sacco
  const who = person({ sx: 0.47, sy: 0.3, T: 0.2 });
  const img = scene({ who, clothes: [160, 36, 38], seed: 9 });
  const res = analyzeBag(img, { x: 0.33, y: 0.2 }, { points: who });
  checkBox(res, BAGBOX, 'persona davanti', 0.03, 0.06);
  assert.ok(res.occluded > 0.1, `righe coperte ${res.occluded}`);
});

test('sacco: senza scheletro una persona con vestiti diversi non viene presa per sacco', () => {
  const who = person({ sx: 0.6, sy: 0.3, T: 0.2 });
  const res = analyzeBag(scene({ who, clothes: [40, 60, 150], seed: 4 }), { x: 0.37, y: 0.3 });
  checkBox(res, BAGBOX, 'persona di lato');
});

test('sacco: inclinato (oscilla o telefono storto) → asse inclinato', () => {
  const res = analyzeBag(scene({ tilt: 0.12, seed: 12 }), { x: 0.38, y: 0.3 });
  assert.equal(res.ok, true, res.hint);
  const slope = (res.axis.xBot - res.axis.xTop) * 192 / ((res.box.y1 - res.box.y0) * 256);
  near(slope, 0.12, 0.05, 'pendenza');
});

test('sacco: tocco sul muro vuoto → non ok, con stima di ripiego e un consiglio', () => {
  const res = analyzeBag(scene(), { x: 0.8, y: 0.4 });
  assert.equal(res.ok, false);
  assert.ok(res.hint.length > 5);
  assert.ok(res.box && res.box.x1 > res.box.x0);
});

test('sacco: tocco sulla persona → lo dice', () => {
  const who = person({ sx: 0.68, sy: 0.3, T: 0.22 });
  const res = analyzeBag(scene({ who }), { x: 0.68, y: 0.4 }, { points: who });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'person');
});

test('sacco: immagine assente o tocco non valido → nessun errore lanciato', () => {
  assert.equal(analyzeBag(null, { x: 0.5, y: 0.5 }).ok, false);
  assert.equal(analyzeBag(scene(), null).ok, false);
});

// ── 2. Zone e bersagli ──────────────────────────────────────────────────────

const BAG_OK = analyzeBag(scene(), { x: 0.37, y: 0.3 });
const GUARD = person();

test('zone: testa al viso, corpo a metà busto, dentro il sacco; persona a destra', () => {
  const z = bagZones(BAG_OK, GUARD);
  assert.equal(z.fromBody, true);
  near(z.head, 0.21, 0.02, 'testa');
  near(z.body, 0.385, 0.02, 'corpo');
  assert.ok(z.low > z.body && z.low < BAG_OK.box.y1);
  assert.equal(z.near, 1);
  assert.equal(z.leadNear, true);
});

test('zone: senza scheletro proporzioni del sacco; persona altissima → testa resta nel sacco', () => {
  const z = bagZones(BAG_OK, null);
  assert.equal(z.fromBody, false);
  assert.ok(z.head > BAG_OK.box.y0 && z.head < z.body && z.body < z.low);
  const tall = bagZones(BAG_OK, person({ sy: 0.05, T: 0.25 }));
  assert.ok(tall.head >= BAG_OK.box.y0 + 0.07 * (BAG_OK.box.y1 - BAG_OK.box.y0) - 1e-9);
});

test('bersagli: diretti al centro della testa, gancio sul bordo, montante sotto, corpo nella zona corpo, numeri della combo', () => {
  const z = bagZones(BAG_OK, GUARD);
  const moves = ['jab', 'cross', 'hook', 'uppercut', 'bodyHook', 'rearHook', 'slip', 'lowKick'];
  const t = bagTargets(BAG_OK, z, moves, { labels: ['1', '2', '3', '5', '3↓', '4', 'S', 'LK'] });
  const by = Object.fromEntries(t.map((x) => [x.id, x]));
  assert.equal(by.slip, undefined, 'la schivata non ha bersaglio');
  const ax = axisX(BAG_OK, z.head);
  near(by.jab.x, ax, 0.005, 'jab al centro');
  near(by.jab.y, z.head, 0.001, 'jab alla testa');
  assert.ok(by.cross.y > by.jab.y, 'diretto stesso posto: scende un po’ per non coprire il jab'.length > 0 ? true : false);
  assert.equal(by.jab.S, 'L'); assert.equal(by.cross.S, 'R');
  // gancio avanti sul bordo verso la persona (telefono dal lato del braccio avanti), gancio dietro sul bordo lontano
  assert.ok(by.hook.x > ax + 0.25 * BAG_OK.width, 'gancio avanti sul bordo vicino');
  assert.ok(by.rearHook.x < ax - 0.25 * BAG_OK.width, 'gancio dietro sul bordo lontano');
  assert.ok(by.uppercut.y > z.head && by.uppercut.y < z.body, 'montante sotto la testa');
  assert.equal(by.uppercut.arrow, 'up');
  near(by.bodyHook.y, z.body, 0.001, 'gancio al corpo');
  assert.equal(by.lowKick.limb, 'leg');
  assert.ok(by.lowKick.y > z.body);
  assert.deepEqual(t.map((x) => x.label), ['1', '2', '3', '5', '3↓', '4', 'LK']);
});

test('bersagli: telefono dal lato del braccio dietro → i ganci si scambiano di bordo', () => {
  const z = { ...bagZones(BAG_OK, GUARD), leadNear: false };
  const t = bagTargets(BAG_OK, z, ['hook', 'rearHook']);
  const ax = axisX(BAG_OK, z.head);
  assert.ok(t[0].x < ax && t[1].x > ax);
});

test('ROI: parte alta del sacco sopra la zona testa, larga 2 sacchi', () => {
  const z = bagZones(BAG_OK, GUARD);
  const roi = roiFor(BAG_OK, z);
  near(roi.w, 2 * BAG_OK.width, 0.01, 'larghezza');
  assert.ok(roi.y < BAG_OK.box.y0 + 0.01);
  assert.ok(roi.y + roi.h <= z.head - z.r * 0.75, 'non arriva alla testa');
  assert.ok(roi.h > 0.04);
});

// ── 3. Movimento del sacco ──────────────────────────────────────────────────

// miniatura 32×32: sacco scuro largo 16 colonne (ROI larga 2 sacchi) in posizione pos (sub-pixel), muro, rumore
function thumbAt(pos, { contrast = 80, bgLevel = 170, noise = 2.5, r = rng(1), exposure = 1, texture = true } = {}) {
  const t = new Uint8Array(32 * 32);
  const left = 8 + pos, right = 24 + pos;
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const cover = Math.max(0, Math.min(1, x + 1 - left)) - Math.max(0, Math.min(1, x + 1 - right)) ; // copertura del pixel
      const top = y < 4 ? 0 : 1;
      let v = bgLevel - (texture && x < 3 ? 25 : 0);
      v -= contrast * cover * top;
      t[y * 32 + x] = Math.max(0, Math.min(255, v * exposure + gauss(r) * noise));
    }
  }
  return t;
}

// sacco: oscillazione (ampiezza A px, periodo 2,6 s) + colpi { t, dv (px per 33 ms) } con un piccolo tremolio
function bagPath(t, { A = 0, punches = [] } = {}) {
  const w = (2 * Math.PI) / 2.6;
  let x = A * Math.sin((w * t) / 1000);
  for (const p of punches) {
    if (t <= p.t) continue;
    const s = (t - p.t) / 1000;
    x += ((p.dv * 1000) / 33 / w) * Math.sin(w * s) * Math.exp(-0.4 * s) + 0.25 * Math.abs(p.dv) / 0.4 * Math.sin(2 * Math.PI * 9 * s) * Math.exp(-s / 0.08);
  }
  return x;
}

function runMotion({ ms = 4000, A = 0, punches = [], thumb = {}, jitter = 4, exposureAt = null, occludeAt = null } = {}) {
  const m = createBagMotion();
  const r = rng(21), rj = rng(5);
  const imps = [];
  for (let t = 0; t < ms; t += 33 + Math.round((rj() - 0.5) * 2 * jitter)) {
    const exposure = exposureAt != null && t >= exposureAt ? 1.15 : 1;
    const occluded = occludeAt != null && t >= occludeAt[0] && t <= occludeAt[1];
    const out = m.push(thumbAt(bagPath(t, { A, punches }), { r, exposure, ...thumb }), t, { occluded });
    if (out.impulse) imps.push(out.impulse);
  }
  return imps;
}

test('movimento: spostamento sub-pixel del profilo misurato bene', () => {
  const r = rng(2);
  const prof = (pos) => { const th = thumbAt(pos, { noise: 0, r }); return Float32Array.from({ length: 32 }, (_, x) => th[10 * 32 + x]); };
  for (const s of [0.1, 0.35, -0.6, 1.4]) near(profileShift(prof(s), prof(0), 3).s, s, 0.06, `shift ${s}`);
});

test('movimento: sacco fermo con rumore → nessun colpo', () => {
  assert.equal(runMotion().length, 0);
});

test('movimento: sacco che oscilla forte (±3 px della miniatura) → nessun colpo', () => {
  assert.equal(runMotion({ A: 3 }).length, 0);
});

test('movimento: cambio di esposizione della camera → nessun colpo', () => {
  assert.equal(runMotion({ exposureAt: 2000 }).length, 0);
});

test('movimento: colpo (0,3 px per fotogramma in alto al sacco) → un impulso, subito', () => {
  const imps = runMotion({ punches: [{ t: 2000, dv: 0.3 }] });
  assert.equal(imps.length, 1, JSON.stringify(imps));
  assert.ok(imps[0].t >= 1990 && imps[0].t <= 2080, `t ${imps[0].t}`);
});

test('movimento: colpo debole (0,2 px) e colpo mentre il sacco oscilla contro', () => {
  assert.equal(runMotion({ punches: [{ t: 2000, dv: 0.2 }] }).length, 1);
  // a t=1950 il sacco va verso destra al massimo: il colpo lo rimanda a sinistra
  const imps = runMotion({ A: 3, punches: [{ t: 1950, dv: -0.35 }] });
  assert.equal(imps.length, 1, JSON.stringify(imps));
});

test('movimento: uno-due (colpi a 250 ms) → due impulsi', () => {
  const imps = runMotion({ punches: [{ t: 2000, dv: 0.3 }, { t: 2250, dv: 0.3 }] });
  assert.equal(imps.length, 2, JSON.stringify(imps));
});

test('movimento: sacco nero su muro scuro (contrasto 15) → vede il colpo, niente falsi', () => {
  const thumb = { contrast: 15, bgLevel: 45, noise: 3, texture: false };
  assert.equal(runMotion({ thumb }).length, 0);
  assert.equal(runMotion({ thumb, A: 2 }).length, 0);
  assert.equal(runMotion({ thumb, punches: [{ t: 2000, dv: 0.35 }] }).length, 1);
});

test('movimento: miniatura uniforme = cieco; mano dentro la ROI = fotogramma ignorato', () => {
  const m = createBagMotion();
  const flat = new Uint8Array(1024).fill(90);
  assert.equal(m.push(flat, 0).usable, false);
  assert.equal(runMotion({ punches: [{ t: 2000, dv: 0.3 }], occludeAt: [1950, 2200] }).length, 0);
});

// ── 4. Contatti ─────────────────────────────────────────────────────────────

const ZONES = bagZones(BAG_OK, GUARD);
const ROI = roiFor(BAG_OK, ZONES);
const GUARD_L = { x: GUARD[15].x, y: GUARD[15].y }, GUARD_R = { x: GUARD[16].x, y: GUARD[16].y };
const EDGE = BAG_OK.box.x1; // bordo del sacco verso la persona

// Una sessione: colpi { t, S, to: {x,y}, hit } — il pugno parte dalla guardia, accelera per 5
// fotogrammi, si ferma di colpo, resta 2 fotogrammi e torna in guardia rallentando. Il punto passa
// da un filtro leggero (come il One Euro del telefono). Se hit, il sacco riceve il colpo.
function session({ strikes = [], ms = 3000, A = 0, thumbs = true, kicks = [], extraBag = [] } = {}) {
  const r = rng(8), rt = rng(13);
  const det = createBagContacts({ bag: BAG_OK, zones: ZONES, roi: ROI });
  const punches = [...strikes.filter((s) => s.hit).map((s) => ({ t: s.t + 165 + 8, dv: s.dv ?? 0.3 })), ...kicks.map((k) => ({ t: k.t, dv: 0.6 })), ...extraBag];
  const smooth = { L: { ...GUARD_L }, R: { ...GUARD_R } };
  const found = [];
  for (let t = 0; t < ms; t += 33) {
    const want = { L: { ...GUARD_L }, R: { ...GUARD_R } };
    for (const s of strikes) {
      const k = (t - s.t) / 33, from = s.S === 'L' ? GUARD_L : GUARD_R;
      let u = null;
      if (k >= 0 && k <= 5) u = (k / 5) ** 1.6;
      else if (k > 5 && k <= 7) u = 1;
      else if (k > 7 && k <= 13) u = 1 - Math.sin(((k - 7) / 6) * Math.PI / 2);
      if (u != null) want[s.S] = { x: from.x + (s.to.x - from.x) * u, y: from.y + (s.to.y - from.y) * u };
    }
    for (const S of ['L', 'R']) {
      smooth[S].x += 0.75 * (want[S].x - smooth[S].x); smooth[S].y += 0.75 * (want[S].y - smooth[S].y);
    }
    const pts = person({ lw: { x: smooth.L.x + gauss(r) * 0.0015, y: smooth.L.y + gauss(r) * 0.0015 }, rw: { x: smooth.R.x + gauss(r) * 0.0015, y: smooth.R.y + gauss(r) * 0.0015 } });
    for (const kk of kicks) if (t >= kk.t - 100 && t <= kk.t + 60) { pts[27] = { x: EDGE + 0.01, y: ZONES.low, z: 0, visibility: 0.9 }; pts[31] = { x: EDGE, y: ZONES.low + 0.01, z: 0, visibility: 0.9 }; }
    const thumb = thumbs ? thumbAt(bagPath(t, { A, punches }), { r: rt }) : null;
    found.push(...det.push(pts, t, { thumb, aspect: 0.75 }));
  }
  return found;
}

const HEAD = (dx = 0.02) => ({ x: EDGE + dx, y: ZONES.head + 0.01 });
const BODY = (dx = 0.02) => ({ x: EDGE + dx, y: ZONES.body });

test('contatto: jab che arriva al sacco e lo muove → contatto L alla testa, al momento giusto', () => {
  const c = session({ strikes: [{ t: 1000, S: 'L', to: HEAD(), hit: true }] });
  assert.equal(c.length, 1, JSON.stringify(c));
  assert.equal(c[0].S, 'L');
  assert.equal(c[0].zone, 'head');
  assert.equal(c[0].limb, 'arm');
  assert.equal(c[0].sure, true);
  assert.ok(c[0].t >= 1130 && c[0].t <= 1240, `t ${c[0].t}`);
  assert.ok(c[0].strength > 0.3 && c[0].strength <= 1);
});

test('contatto: pugno che si ferma 30 cm prima del sacco → niente', () => {
  assert.equal(session({ strikes: [{ t: 1000, S: 'L', to: HEAD(0.13), hit: false }] }).length, 0);
});

test('contatto: pugno che arriva al bordo ma il sacco non si muove (fermato all’ultimo) → niente', () => {
  assert.equal(session({ strikes: [{ t: 1000, S: 'L', to: HEAD(0.03), hit: false }] }).length, 0);
});

test('contatto: diretto col braccio dietro e gancio al corpo → R testa, L corpo', () => {
  const c = session({ strikes: [{ t: 800, S: 'R', to: HEAD(), hit: true }, { t: 1800, S: 'L', to: BODY(), hit: true }] });
  assert.deepEqual(c.map((x) => [x.S, x.zone]), [['R', 'head'], ['L', 'body']]);
});

test('contatto: uno-due veloce (300 ms) → due contatti, L poi R', () => {
  const c = session({ strikes: [{ t: 1000, S: 'L', to: HEAD(), hit: true }, { t: 1300, S: 'R', to: HEAD(0.025), hit: true }] });
  assert.deepEqual(c.map((x) => x.S), ['L', 'R'], JSON.stringify(c));
});

test('contatto: le mani che tornano in guardia mentre il sacco oscilla non contano', () => {
  // un colpo vero, poi il sacco continua a oscillare e le mani tornano su più volte
  const c = session({ strikes: [{ t: 600, S: 'L', to: HEAD(), hit: true }], A: 2.5, ms: 4000 });
  assert.equal(c.length, 1, JSON.stringify(c));
});

test('contatto: sacco che si muove da solo (qualcuno lo spinge) senza pugni vicino → niente', () => {
  assert.equal(session({ extraBag: [{ t: 1500, dv: 0.5 }] }).length, 0);
});

test('contatto: calcio basso → contatto di gamba in basso', () => {
  const c = session({ kicks: [{ t: 1500 }] });
  assert.equal(c.length, 1, JSON.stringify(c));
  assert.equal(c[0].limb, 'leg');
  assert.equal(c[0].zone, 'low');
});

test('contatto: senza miniature (hook vecchio) solo arrivi netti, segnati come probabili', () => {
  const c = session({ thumbs: false, strikes: [{ t: 800, S: 'L', to: HEAD(0.005), hit: true }, { t: 1800, S: 'L', to: HEAD(0.13), hit: false }] });
  assert.equal(c.length, 1, JSON.stringify(c));
  assert.equal(c[0].sure, false);
});

// ── 5. Colpi del motore ↔ contatti ──────────────────────────────────────────

const G = (side, peakT, extra = {}) => ({ kind: 'strike', limb: 'arm', side, start: peakT - 120, end: peakT + 180, peakT, dur: 300, reach: 0.4, guardRatio: 1, returnMs: 200, maxExt: 1, peakVec: [-1, 0], ...extra });

test('abbinamento: colpo con contatto vicino = a segno; senza = non a segno', () => {
  const m = matchContacts([G('lead', 1100), G('rear', 1600)], [{ t: 1120, S: 'L', limb: 'arm', sure: true }]);
  assert.deepEqual(m.gestures.map((g) => g.hit), [true, false]);
  assert.equal(m.hits, 1);
});

test('abbinamento: il contatto corregge il braccio sbagliato del motore', () => {
  // il motore ha visto due colpi del braccio avanti; i contatti dicono L poi R
  const gs = [G('lead', 1100), G('lead', 1400, { move: 'jab' })];
  const m = matchContacts(gs, [{ t: 1110, S: 'L', limb: 'arm', sure: true }, { t: 1420, S: 'R', limb: 'arm', sure: true }], { sideOf: { lead: 'L', rear: 'R' } });
  assert.equal(m.gestures[1].side, 'rear');
  assert.equal(m.gestures[1].sideFromContact, 'lead');
  assert.equal(m.gestures[1].move, null, 'il nome "jab" non vale più col braccio dietro');
  const before = judgeSequence(['jab', 'cross'], gs), after = judgeSequence(['jab', 'cross'], m.gestures);
  assert.ok(after.total > before.total, `${before.total} → ${after.total}`);
  assert.equal(after.moves[1].status, 'ok');
  const score = bagScore(after, bagTargets(BAG_OK, ZONES, ['jab', 'cross']));
  assert.deepEqual(score, { hit: [true, true], hits: 2, total: 2 });
});

test('abbinamento: contatto "probabile" non cambia il braccio; contatto lontano nel tempo non vale', () => {
  const m = matchContacts([G('lead', 1100)], [{ t: 1110, S: 'R', limb: 'arm', sure: false }]);
  assert.equal(m.gestures[0].side, 'lead');
  assert.equal(matchContacts([G('lead', 1100)], [{ t: 1700, S: 'L', limb: 'arm' }]).hits, 0);
});

test('soglie documentate e coerenti', () => {
  assert.ok(BAG.near < 0.85, 'un pugno fermato a 30 cm (~0,85 sacchi) resta fuori');
  assert.ok(BAG.nearBlind < BAG.near && BAG.vMinBlind > BAG.vMin);
  assert.ok(BAG.win[0] < 0 && BAG.win[1] > 0);
});

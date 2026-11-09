import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND, createSoundFeatures, createSoundHits } from '../lib/mmaBagSound.js';
import { matchContacts, bagScore, bagTargets } from '../lib/mmaBag.js';
import { judgeSequence } from '../lib/mmaComboJudge.js';

// Segnali sintetici a 48 kHz: rumore di stanza, colpi di guanto (schiocco largo che si spegne in
// ~6 ms + tonfo basso a 90 Hz), voce (armoniche a 170–200 Hz in sillabe, con «t» e «k» secche),
// fiato «tss» e i bip dell'app. Niente file audio: tutto da formule, ripetibile.
const SR = 48000;
function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, g: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()) };
}
const scene = (ms, seed = 1, noise = 0.002) => { const r = rng(seed); const x = new Float32Array(Math.round((ms / 1000) * SR)); for (let i = 0; i < x.length; i += 1) x[i] = noise * r.g(); return { x, r }; };
function addHit({ x, r }, atMs, amp = 0.25) {
  const i0 = Math.round((atMs / 1000) * SR);
  for (let i = 0; i < 0.08 * SR && i0 + i < x.length; i += 1) {
    const t = i / SR, env = t < 0.0005 ? t / 0.0005 : Math.exp(-(t - 0.0005) / 0.006);
    x[i0 + i] += amp * env * r.g() + 0.6 * amp * Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t / 0.06);
  }
}
// sillaba: attacco morbido (coseno), tenuta, rilascio; plosive = colpetto secco di rumore prima della vocale
function addSyllable({ x, r }, atMs, { amp = 0.3, f0 = 185, len = 160, attack = 25, plosive = 0 } = {}) {
  const i0 = Math.round((atMs / 1000) * SR), n = Math.round((len / 1000) * SR), at = (attack / 1000) * SR, rel = 0.05 * SR;
  for (let i = 0; i < n && i0 + i < x.length; i += 1) {
    const env = i < at ? 0.5 - 0.5 * Math.cos((Math.PI * i) / at) : i > n - rel ? (n - i) / rel : 1;
    let v = 0;
    for (let k = 1; k <= 20; k += 1) v += Math.sin(2 * Math.PI * f0 * k * (i / SR)) / k;
    x[i0 + i] += amp * env * v * 0.5;
  }
  if (plosive) for (let i = 0; i < 0.012 * SR; i += 1) { const t = i / SR; x[Math.max(0, i0 - Math.round(0.012 * SR)) + i] += plosive * r.g() * (t < 0.001 ? t / 0.001 : Math.exp(-(t - 0.001) / 0.003)); }
}
function addHiss({ x, r }, atMs, { amp = 0.08, len = 180, attack = 15 } = {}) {
  const i0 = Math.round((atMs / 1000) * SR), n = Math.round((len / 1000) * SR), at = (attack / 1000) * SR;
  for (let i = 0; i < n && i0 + i < x.length; i += 1) x[i0 + i] += amp * r.g() * (i < at ? i / at : i > n - 0.06 * SR ? (n - i) / (0.06 * SR) : 1);
}
function addBeep({ x }, atMs, { f = 880, len = 80, amp = 0.3 } = {}) {
  const i0 = Math.round((atMs / 1000) * SR), n = Math.round((len / 1000) * SR);
  for (let i = 0; i < n && i0 + i < x.length; i += 1) x[i0 + i] += amp * Math.sin(2 * Math.PI * f * (i / SR)) * Math.min(1, i / (0.005 * SR), (n - i) / (0.02 * SR));
}
// come nel telefono: blocchi da 2048 campioni → energie → rilevatore
function detect(x, { speaking = () => false } = {}) {
  const feat = createSoundFeatures(SR), det = createSoundHits(), hits = [];
  for (let i = 0; i < x.length; i += 2048) {
    const t0 = 1000 + (i * 1000) / SR;
    for (const f of feat(x.subarray(i, i + 2048), t0)) hits.push(...det.push(f.e, f.t, { speaking: speaking(t0 - 1000) }));
  }
  return { hits: hits.map((h) => h.t - 1000), det };
}
// precisione e richiamo: un colpo vero è trovato se un rilevamento cade entro 5 ms
function score(found, truth, tol = 5) {
  const used = new Set();
  let tp = 0, err = 0;
  for (const t of truth) {
    const j = found.findIndex((f, k) => !used.has(k) && Math.abs(f - t) <= tol);
    if (j >= 0) { used.add(j); tp += 1; err = Math.max(err, Math.abs(found[j] - t)); }
  }
  return { tp, recall: tp / truth.length, precision: found.length ? tp / found.length : 1, fp: found.length - tp, maxErr: err };
}

test('suono: colpi nel rumore, col fiato e mentre parli: precisione e richiamo', () => {
  const s = scene(12000, 3);
  // 30 colpi, anche a coppie veloci (1-2 a 150–250 ms); uno su cinque debole (~24 dB sopra il fondo)
  const truth = [];
  let t = 600;
  for (let k = 0; k < 30; k += 1) { truth.push(t); t += k % 3 === 0 ? 150 + s.r.u() * 100 : 300 + s.r.u() * 200; }
  truth.forEach((at, k) => addHit(s, at, k % 5 === 4 ? 0.04 : 0.15 + 0.2 * s.r.u()));
  // fiato «tss» su un colpo forte su tre; tra 2 e 5 s Emanuele parla (con «t» e «k» secche)
  truth.forEach((at, k) => { if (k % 3 === 1 && k % 5 !== 4) addHiss(s, at - 5, { amp: 0.03 }); });
  for (let v = 2000; v < 5000; v += 210) addSyllable(s, v, { amp: 0.2, plosive: v % 420 === 2000 % 420 ? 0.05 : 0 });
  const { hits } = detect(s.x);
  const all = score(hits, truth);
  // mentre parli la soglia sale (deviazione del fondo): lì il microfono quasi non conta, conta la camera
  const quiet = score(hits.filter((h) => h < 2000 || h > 5400), truth.filter((h) => h < 2000 || h > 5400));
  assert.equal(all.fp, 0, JSON.stringify(all));
  assert.ok(quiet.recall >= 0.95, JSON.stringify(quiet));
  assert.ok(all.maxErr <= 3, `il suono dà il momento dell'impatto al ms: errore massimo ${all.maxErr} ms`);
});

test('suono: la sola voce, il fiato e i bip non sono colpi', () => {
  const s = scene(8000, 5);
  let t = 300;
  while (t < 7600) { addSyllable(s, t, { amp: 0.25 + 0.2 * s.r.u(), f0: 150 + 60 * s.r.u(), len: 120 + 120 * s.r.u(), attack: 15 + 25 * s.r.u(), plosive: s.r.u() < 0.4 ? 0.04 : 0 }); t += 180 + 120 * s.r.u(); }
  for (let k = 0; k < 6; k += 1) addHiss(s, 800 + k * 1100, { amp: 0.1 });
  for (let k = 0; k < 4; k += 1) addBeep(s, 1200 + k * 1700);
  assert.deepEqual(detect(s.x).hits, []);
});

test('suono: periodo refrattario di 80 ms', () => {
  const s = scene(2000, 7);
  addHit(s, 500); addHit(s, 540, 0.08);  // catena/eco più debole a 40 ms: un colpo solo
  addHit(s, 1000); addHit(s, 1120);      // due colpi veri a 120 ms: due
  const { hits } = detect(s.x);
  assert.equal(hits.length, 3, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0] - 500) <= 3 && Math.abs(hits[2] - 1120) <= 3);
});

test('suono: mentre parla il coach (e 400 ms dopo) non si ascolta', () => {
  const s = scene(3200, 9);
  addHit(s, 600); addHit(s, 1500); addHit(s, 2250); addHit(s, 2800);
  // la voce del coach esce dal telefono, vicinissima al microfono: forte e con le «t» secche
  for (let v = 1300; v < 1900; v += 200) addSyllable(s, v, { amp: 0.6, plosive: 0.3 });
  const { hits } = detect(s.x, { speaking: (t) => t >= 1250 && t < 2000 });
  assert.equal(hits.length, 2, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0] - 600) <= 3 && Math.abs(hits[1] - 2800) <= 3, JSON.stringify(hits));
});

test('suono: niente fondo, niente colpi; il rilevatore si azzera', () => {
  const det = createSoundHits();
  assert.deepEqual(det.push(NaN, 10), []);
  assert.deepEqual(det.push(1e-3, 0), [], 'il primo passo non ha fondo');
  det.reset();
  assert.deepEqual(det.all(), []);
});

// ── suono ↔ gesti e contatti ───────────────────────────────────────────────

const G = (side, peakT, extra = {}) => ({ kind: 'strike', limb: 'arm', side, start: peakT - 120, end: peakT + 180, peakT, dur: 300, reach: 0.4, guardRatio: 1, returnMs: 200, maxExt: 1, peakVec: [-1, 0], ...extra });
const L = SOUND.camLag;

test('abbinamento col suono: conferma il contatto e dà il momento dell\'impatto', () => {
  const m = matchContacts([G('lead', 1100), G('rear', 1400)], [{ t: 1110, S: 'L', limb: 'arm', zone: 'head', sure: true }], { sounds: [1104 - L] });
  assert.deepEqual(m.gestures.map((g) => g.hit), [true, false]);
  assert.equal(m.gestures[0].heard, 1104 - L, 'il tempo è quello del microfono');
  assert.equal(m.heard, 1);
});

test('abbinamento col suono: senza contatto il suono vicino al picco basta; lontano no', () => {
  const m = matchContacts([G('lead', 1100), G('rear', 1400)], [], { sounds: [1395 - L, 1700 - L] });
  assert.deepEqual(m.gestures.map((g) => g.hit), [false, true]);
  assert.equal(m.gestures[1].contact.by, 'sound');
  assert.equal(m.gestures[1].contact.sure, false);
  assert.equal(m.gestures[1].contact.zone, null, 'il suono non sa dove');
  // senza suoni (o senza l'opzione) tutto come prima
  assert.deepEqual(matchContacts([G('lead', 1100)], []).gestures.map((g) => g.hit), [false]);
  assert.equal(matchContacts([G('lead', 1100)], [], { sounds: null }).heard, 0);
});

test('abbinamento col suono: un suono vale per un colpo solo, il più vicino', () => {
  const m = matchContacts([G('lead', 1100), G('rear', 1180)], [], { sounds: [1170 - L] });
  assert.deepEqual(m.gestures.map((g) => g.hit), [false, true]);
});

test('punteggio: zona giusta e colpi sentiti', () => {
  const BAG = { box: { x0: 0.6, x1: 0.8, y0: 0.1, y1: 0.8 }, axis: { xTop: 0.7, xBot: 0.7 }, width: 0.2, imgAspect: 0.75 };
  const ZONES = { head: 0.25, body: 0.45, low: 0.7, near: 1, leadNear: true, r: 0.06 };
  const gs = [G('lead', 1100), G('rear', 1400), G('lead', 1700)];
  const contacts = [{ t: 1110, S: 'L', limb: 'arm', zone: 'head', sure: true }, { t: 1410, S: 'R', limb: 'arm', zone: 'head', sure: true }];
  const m = matchContacts(gs, contacts, { sideOf: { lead: 'L', rear: 'R' }, sounds: [1105 - L, 1702 - L] });
  // jab alla testa (giusto), diretto al corpo finito in testa (sbagliato), jab sentito ma senza zona
  const res = judgeSequence(['jab', 'bodyCross', 'jab'], m.gestures);
  const sc = bagScore(res, bagTargets(BAG, ZONES, ['jab', 'bodyCross', 'jab']));
  assert.equal(sc.hits, 3);
  assert.deepEqual(sc.zone, [true, false, null]);
  assert.equal(sc.zoneOk, 1);
  assert.equal(sc.zoneN, 2);
  assert.equal(sc.heard, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { MY_BAG, TORSO_CM, bestSeriesRank, createStrikeMeter, emptySpeed, punchMetrics, rankAtLeast, rankOf, readSpeed, scaleCheck, toKmh } from '../lib/mmaMetrics.js';
import { bagFromBand, findBand } from '../lib/mmaBag.js';
import { coachFeedback, judgeSequence, rateGesture, strikeIdFor } from '../lib/mmaComboJudge.js';

// Un diretto di profilo: spalle quasi sovrapposte, il pugno destro va verso destra e la spalla dietro lo segue.
// Di lato i piedi stanno alla stessa altezza nell'immagine (il piede avanti verso il bersaglio)
const SIDE_FEET = [{ x: 0.62, y: 0.9 }, { x: 0.4, y: 0.91 }];
const pose = ({ wrist = 0.4, rearSh = 0.46, leadSh = 0.5, feet = SIDE_FEET }) => {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  p[11] = { x: leadSh, y: 0.3 }; p[12] = { x: rearSh, y: 0.3 };
  p[13] = { x: leadSh, y: 0.42 }; p[15] = { x: leadSh, y: 0.3 };
  p[14] = { x: (rearSh + wrist) / 2, y: 0.34 }; p[16] = { x: wrist, y: 0.3 };
  p[23] = { x: 0.5, y: 0.5 }; p[24] = { x: 0.5, y: 0.5 };
  [p[27], p[28]] = feet;
  return p;
};
const cross = () => [0, 1, 2, 3, 4, 5, 6].map((i) => ({
  t: 1000 + i * 33,
  p: pose({ wrist: [0.4, 0.4, 0.42, 0.5, 0.6, 0.68, 0.7][i], rearSh: [0.46, 0.46, 0.47, 0.5, 0.53, 0.55, 0.56][i] }),
}));

test('velocità: la strada del pugno divisa per il tempo, in busti al secondo', () => {
  const m = punchMetrics(cross(), 'R', 1, { T: 0.2, leadS: 'L', peakT: 1000 + 6 * 33 });
  // massimo su due intervalli: da 0,42 a 0,60 in 66 ms = 2,73 unità/s = 13,6 busti/s
  assert.ok(Math.abs(m.speed - 13.64) < 0.2, `velocità ${m.speed}`);
  // fino al fotogramma 2 il pugno ha fatto meno del 10% della strada: la partenza è lì
  assert.equal(m.impactMs, 4 * 33);
});

test('rotazione: la spalla dietro che passa avanti dà gradi positivi; un jab fermo quasi zero', () => {
  const r = punchMetrics(cross(), 'R', 1, { T: 0.2, leadS: 'L', peakT: 1000 + 6 * 33 });
  assert.equal(r.side, true);
  assert.ok(r.rotation > 25, `rotazione ${r.rotation}`);
  const jab = cross().map((f, i) => ({ t: f.t, p: pose({ wrist: 0.4 + i * 0.05 }) }));
  const j = punchMetrics(jab, 'R', 1, { T: 0.2, leadS: 'L', peakT: jab[6].t });
  assert.ok(Math.abs(j.rotation) < 1);
});

test('rotazione: di fronte o in diagonale (piedi a profondità diverse) e senza piedi niente gradi', () => {
  const withFeet = (feet) => cross().map((f, i) => ({ t: f.t, p: pose({ wrist: [0.4, 0.4, 0.42, 0.5, 0.6, 0.68, 0.7][i], rearSh: [0.46, 0.46, 0.47, 0.5, 0.53, 0.55, 0.56][i], feet }) }));
  const peakT = 1000 + 6 * 33;
  // telefono davanti: le spalle in guardia sembrano strette lo stesso, ma il piede dietro è più lontano e più in alto
  const front = punchMetrics(withFeet([{ x: 0.52, y: 0.95 }, { x: 0.47, y: 0.84 }]), 'R', 1, { T: 0.2, leadS: 'L', peakT });
  assert.equal(front.side, true);
  assert.equal(front.rotation, null);
  // caviglie fuori dall'inquadratura: la vista non si conferma
  const hidden = punchMetrics(withFeet([{ x: 0.62, y: 1.1, visibility: 0.05 }, { x: 0.4, y: 1.1, visibility: 0.05 }]), 'R', 1, { T: 0.2, leadS: 'L', peakT });
  assert.equal(hidden.rotation, null);
  // piedi appena inclinati (15°): ancora di lato
  const tilt = Math.tan(15 * Math.PI / 180) * 0.22;
  assert.ok(punchMetrics(withFeet([{ x: 0.62, y: 0.9 }, { x: 0.4, y: 0.9 - tilt }]), 'R', 1, { T: 0.2, leadS: 'L', peakT }).rotation > 25);
});

test('di fronte al telefono rotazione e distensione non si inventano', () => {
  // spalle larghe 0,9 busti: si è di fronte
  const front = cross().map((f) => ({ t: f.t, p: pose({ wrist: 0.45, rearSh: 0.32, leadSh: 0.5 }) }));
  const m = punchMetrics(front, 'R', 1, { T: 0.2, leadS: 'L', peakT: front[6].t });
  assert.equal(m.side, false);
  assert.equal(m.rotation, null);
  assert.equal(m.ext, null);
});

test('gradi: stessi numeri del censimento BoxingVI; un colpo sconosciuto non ha grado', () => {
  assert.equal(rankOf('cross', 3), 'E');
  assert.equal(rankOf('cross', 8.4), 'B');
  assert.equal(rankOf('cross', 15), 'S');
  assert.equal(rankOf('bodyCross', 15), 'S');
  assert.equal(rankOf('teep', 15), null);
  assert.ok(rankAtLeast('B', 'C'));
  assert.ok(!rankAtLeast('D', 'C'));
  assert.ok(!rankAtLeast(null, 'E'));
});

test('scala: il sacco dà i cm del busto; se il conto è assurdo non si usa', () => {
  // sacco largo il 10% dell'immagine (aspect 0,75) → 26 cm = 0,075 altezze; busto 0,15 altezze = 52 cm
  const bag = { realCm: 26, width: 0.1, box: { y1: 0.5 } };
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  p[11] = p[12] = { x: 0.5, y: 0.3 }; p[23] = p[24] = { x: 0.5, y: 0.45 }; p[27] = p[28] = { x: 0.5, y: 0.742 };
  const s = scaleCheck(bag, p, 0.75);
  assert.equal(s.torsoCm, 52);
  assert.ok(Math.abs(s.floorErrCm) <= 1); // fondo sacco + 84 cm cade sui piedi
  // lo stipite scambiato per sacco: tre volte più largo, busto di 17 cm → scala scartata
  assert.equal(scaleCheck({ ...bag, width: 0.3 }, p, 0.75).torsoCm, null);
  assert.equal(scaleCheck({ width: 0.1, box: { y1: 0.5 } }, p, 0.75), null); // sacco non misurato
  assert.equal(Math.round(toKmh(10, TORSO_CM.fallback)), 18);
});

test('contatore: record, media di 5, calo nella serie; i record salvati valgono', () => {
  const g = (speed) => ({ limb: 'arm', side: 'rear', speed, peakT: speed, impactMs: 200, rotation: 30 });
  const meter = createStrikeMeter({ torsoCm: 50, records: { ...emptySpeed(), best: { cross: 12 } } });
  const first = meter.add(g(10), 'cross');
  assert.equal(first.isBest, false);
  assert.equal(first.bestKmh, 22);
  assert.equal(first.avgKmh, null); // con un colpo solo non c'è media
  for (const v of [10, 10, 9, 9, 8, 8]) meter.add(g(v), 'cross');
  const last = meter.add(g(7), 'cross');
  assert.equal(last.n, 8);
  assert.equal(last.drop, 20); // mediana primi 3 = 10, ultimi 3 = 8
  assert.equal(last.avgKmh, 14); // mediana ultimi 5 = 8 busti/s
  assert.equal(meter.add(g(13), 'cross').isBest, true);
  assert.equal(meter.add({ limb: 'leg', speed: 9 }, 'lowKick'), null);
  const session = meter.session(5);
  assert.equal(session.byMove.cross.n, 9);
  assert.equal(session.best.cross, 13);
});

test('percorso: il grado viene dalla mediana di una serie vera, non da un colpo solo', () => {
  assert.equal(bestSeriesRank({ sessions: [{ byMove: { cross: { n: 3, median: 15 } } }] }, 'cross'), null);
  assert.equal(bestSeriesRank({ sessions: [{ byMove: { cross: { n: 6, median: 6 } } }, { byMove: { cross: { n: 6, median: 9 } } }] }, 'cross'), 'B');
});

// un'immagine finta: parete grigia con una fascia arancione e un sacco nero
function image(w, h, band) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4, inBand = x >= band.x0 && x < band.x1 && y >= band.y0 && y < band.y1;
      const c = inBand ? [230, 120, 30] : [180, 185, 190];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

test('fascia arancione: larghezza e sacco dalle misure note, anche toccando il nero', () => {
  const img = image(480, 640, { x0: 217, x1: 250, y0: 270, y1: 281 });
  const b = findBand(img, { x: 0.49, y: 0.38 }); // tocco sopra la fascia
  assert.equal(b.px, 33);
  assert.ok(Math.abs(b.width - 33 / 480) < 1e-9);
  const bag = bagFromBand(b, 480 / 640, { x: 0.49, y: 0.38 });
  assert.equal(bag.realCm, MY_BAG.widthCm);
  // altezza = 92/26 larghezze, con la fascia al 42,5% dall'alto
  const hPx = (bag.box.y1 - bag.box.y0) * 640;
  assert.ok(Math.abs(hPx - 33 * (92 / 26)) < 0.5, `altezza ${hPx}`);
  assert.ok(Math.abs((((270 + 281) / 2) - bag.box.y0 * 640) / hPx - MY_BAG.bandFromTop) < 0.01);
  assert.equal(bag.outline.length, 13);
});

test('fascia arancione: niente arancione, tocco lontano o macchia alta → si torna al contorno', () => {
  assert.equal(findBand(image(480, 640, { x0: 0, x1: 0, y0: 0, y1: 0 }), { x: 0.5, y: 0.5 }), null);
  assert.equal(findBand(image(480, 640, { x0: 217, x1: 250, y0: 270, y1: 281 }), { x: 0.05, y: 0.95 }), null);
  assert.equal(findBand(image(480, 640, { x0: 217, x1: 250, y0: 200, y1: 400 }), { x: 0.5, y: 0.5 }), null);
  assert.equal(findBand(null, { x: 0.5, y: 0.5 }), null);
});

test('consigli: ogni correzione porta il numero misurato e l’obiettivo', () => {
  const g = { limb: 'arm', kind: 'straight', side: 'rear', level: 'head', guardRatio: 0.4, returnMs: 800, reason: 'return', rotation: 5, reachRatio: null, maxExt: 0.7, peakElbowGap: 0, lean: 0, sideOn: true };
  const rate = rateGesture(g);
  const by = Object.fromEntries(rate.issues.map((it) => [it.key, it.measure]));
  assert.match(by.guard, /40%.*70%/);
  assert.match(by.return, /800 ms.*600/);
  assert.match(by.rotate, /5 gradi.*12/);
  assert.match(by.extend, /70%.*80%/);
  // tutte le correzioni portano la misura
  assert.ok(rate.issues.every((it) => it.measure));
  const text = coachFeedback({ grade: 'good', moves: [{ status: 'ok', issues: rate.issues }] }, ['Diretto']);
  assert.match(text, /in guardia il 40% del colpo/);
});

test('senza sacco la vista è ignota: rotazione e distensione non tolgono punti', () => {
  const g = { limb: 'arm', kind: 'straight', side: 'rear', level: 'head', guardRatio: 1, returnMs: 200, reason: 'return', rotation: 5, reachRatio: null, maxExt: 0.5, peakElbowGap: 0, lean: 0 };
  assert.deepEqual(rateGesture(g).issues, []);
  assert.deepEqual(rateGesture({ ...g, sideOn: true }).issues.map((it) => it.key).sort(), ['extend', 'rotate']);
  // il confronto col TUO colpo non dipende dalla vista: resta valido anche senza sacco
  assert.deepEqual(rateGesture({ ...g, reachRatio: 0.6 }).issues.map((it) => it.key), ['extend']);
});

test('il giudizio della combo rispetta sideOn: stesso colpo, consiglio solo al sacco', () => {
  const g = { limb: 'arm', kind: 'straight', side: 'rear', level: 'head', start: 0, end: 300, guardRatio: 1, returnMs: 200, reason: 'return', rotation: 5, reachRatio: null, maxExt: 0.9, peakElbowGap: 0, lean: 0 };
  const keys = (x) => judgeSequence(['cross'], [x]).moves[0].issues.map((it) => it.key);
  assert.deepEqual(keys(g), []);
  assert.deepEqual(keys({ ...g, sideOn: true }), ['rotate']);
});

test('rotazione ignota (telefono di fronte): nessun consiglio inventato', () => {
  const g = { limb: 'arm', kind: 'straight', side: 'rear', level: 'head', guardRatio: 1, returnMs: 200, reason: 'return', rotation: null, reachRatio: null, peakElbowGap: 0, lean: 0 };
  assert.deepEqual(rateGesture(g).issues, []);
});

// Colpo non riconosciuto (revisione del 05/11): la velocità si mostra, ma grado e record no
test('contatore: colpo non riconosciuto mostra i km/h ma non tocca grado, record e sessione', () => {
  const m = createStrikeMeter({ torsoCm: 50 });
  const hit = m.add({ limb: 'arm', side: 'lead', speed: 8, peakT: 100 }, null);
  assert.equal(hit.rank, null);
  assert.equal(hit.bestKmh, null);
  assert.equal(hit.kmh, Math.round(toKmh(8, 50)));
  assert.equal(m.session(), null);
});

test('quale colpo conta: un gancio senza tipo deciso non diventa un jab', () => {
  const g = { limb: 'arm', kind: 'strike', side: 'lead', move: null };
  assert.equal(strikeIdFor(g), null);
  assert.equal(strikeIdFor(g, ['hook', 'cross']), 'hook');
  assert.equal(strikeIdFor(g, ['jab', 'hook']), null, 'due colpi diversi per lo stesso braccio: non si sceglie');
  assert.equal(strikeIdFor({ ...g, move: 'uppercut' }, ['jab']), 'uppercut');
  assert.equal(strikeIdFor({ limb: 'arm', kind: 'straight', side: 'rear', level: 'head' }), 'cross');
});

test('record: andata e ritorno, dati rovinati e memoria bloccata non rompono il coach', () => {
  const box = { v: null, getItem() { return this.v; } };
  box.v = JSON.stringify({ best: { jab: 7 }, sessions: [{ at: 1, byMove: { jab: { n: 5, median: 7 } } }] });
  assert.equal(readSpeed(box).best.jab, 7);
  assert.equal(bestSeriesRank(readSpeed(box), 'jab'), rankOf('jab', 7));
  box.v = '{"sessions":{},"best":3}';
  assert.deepEqual(readSpeed(box), emptySpeed());
  box.v = '{"sessions":[null]}';
  assert.equal(bestSeriesRank(readSpeed(box), 'jab'), null);
  assert.deepEqual(readSpeed({ getItem() { throw new Error('bloccata'); } }), emptySpeed());
  box.v = 'null';
  assert.deepEqual(readSpeed(box), emptySpeed());
});

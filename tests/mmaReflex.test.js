// Laboratorio riflessi (lib/mmaReflex.js): il tempo misurato deve essere quello vero.
// Il combattente finto parte a un istante che conosciamo: segnale a 1000 ms, colpo a 1000 + reazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge } from '../lib/mmaComboJudge.js';
import { CUES, DRILLS, REFLEX, REFLEX_KEY, addSession, drillStats, emptyHistory, loadHistory, onsetOf, effectorTracks, passed, planTrials, saveHistory, scoreTrial, summarize, unlockedDrills } from '../lib/mmaReflex.js';
import { synthSequence, calibrateJudge, realistic } from './helpers/synthFighter.js';

const CUE_AT = 1000;
// la partenza vera del combattente finto: l'ultimo fotogramma uguale al primo (poi il corpo si muove)
const trueStart = (frames) => { const p0 = JSON.stringify(frames[0].points); return frames[frames.findIndex((f) => JSON.stringify(f.points) !== p0) - 1].t; };
// risposta `moves` che parte circa `rt` ms dopo il segnale; fps del telefono; rumore come MediaPipe vero.
// r.true = la reazione vera (dai fotogrammi), r.err = misurata − vera
function trial(cue, moves, rt, { fps = 30, noisy = false, seed = 7, tempo = 1 } = {}) {
  const judge = calibrateJudge(createComboJudge());
  const clean = moves.length ? synthSequence(moves, { fps, tempo, lead: CUE_AT + rt }) : synthSequence([], { fps, lead: CUE_AT + 1500 });
  const frames = noisy ? realistic(clean, { sigma2d: 0.004, drop: 0.1, seed }) : clean;
  for (const f of frames) judge.push(f.world, f.t, f.points, 1);
  const r = scoreTrial({ cue, cueAt: CUE_AT, frames: judge.frames(), gestures: judge.gestures(), aspect: 1, lead: judge.lead });
  const real = moves.length ? Math.round(trueStart(clean) - CUE_AT) : null;
  return { ...r, true: real, err: r.rt != null && real != null ? r.rt - real : null };
}
// misurata entro 0–25 ms dopo la partenza vera (la soglia bassa arriva un attimo dopo)
const close = (r) => r.err != null && r.err >= -5 && r.err <= 25;

test('riflessi: jab 250 ms dopo il segnale → reazione misurata ~250 ms (30 e 20 fotogrammi al secondo)', () => {
  for (const fps of [30, 20]) {
    const r = trial('jab', ['jab'], 250, { fps });
    assert.equal(r.status, 'ok', JSON.stringify(r));
    assert.ok(close(r), `${fps} fps: reazione ${r.rt}, vera ${r.true}`);
    // il jab finto si distende in due tempi: ~360 ms dalla partenza al braccio disteso
    assert.ok(r.mt > 250 && r.mt < 420, `tempo del colpo ${r.mt}`);
    assert.equal(r.total, r.rt + r.mt);
    assert.equal(r.by, 'arm');
  }
});

test('riflessi: un colpo tirato al doppio della velocità ha un tempo del colpo molto più corto', () => {
  const slow = trial('jab', ['jab'], 260), fast = trial('jab', ['jab'], 260, { tempo: 0.5 });
  assert.equal(fast.status, 'ok');
  assert.ok(close(fast), `reazione ${fast.rt}, vera ${fast.true}`);
  assert.ok(fast.mt < slow.mt * 0.65, `veloce ${fast.mt} ms, lento ${slow.mt} ms`);
  assert.ok(fast.speed > slow.speed * 1.4, `velocità ${fast.speed} contro ${slow.speed} busti/s`);
});

test('riflessi: la partenza vera arriva prima di quella del motore dei colpi (che parte a 0,16 busti)', () => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(['cross'], { lead: CUE_AT + 300 })) judge.push(f.world, f.t, f.points, 1);
  const r = scoreTrial({ cue: 'cross', cueAt: CUE_AT, frames: judge.frames(), gestures: judge.gestures(), lead: judge.lead });
  const engineStart = judge.gestures().find((g) => g.limb === 'arm').start;
  assert.ok(engineStart - CUE_AT - r.rt >= 30, `motore ${engineStart - CUE_AT} ms, partenza ${r.rt} ms`);
});

test('riflessi: con tremolio e fotogrammi persi come su un telefono l\'errore resta piccolo', () => {
  const errs = [];
  for (const seed of [3, 7, 11, 19, 23, 31]) {
    const r = trial('jab', ['jab'], 280, { noisy: true, seed, fps: 25 });
    if (r.err != null) errs.push(r.err);
  }
  assert.ok(errs.length >= 5, `misurate ${errs.length} su 6`);
  const sorted = [...errs].sort((a, b) => a - b);
  assert.ok(Math.abs(sorted[sorted.length >> 1]) <= 40, `errori ${errs.join(', ')}`);
});

test('riflessi: partito 40 ms dopo il segnale = partenza anticipata (nessuno reagisce così presto)', () => {
  assert.equal(trial('jab', ['jab'], 40).status, 'early');
});

test('riflessi: ✋ e resti fermo = giusto; ✋ e tiri = hai abboccato', () => {
  assert.equal(trial('stop', [], 0).status, 'held');
  const bit = trial('stop', ['jab'], 300);
  assert.equal(bit.status, 'bit');
  assert.equal(bit.by, 'arm');
});

test('riflessi: segnale e nessuna risposta = mancato', () => {
  assert.equal(trial('jab', [], 0).status, 'miss');
});

test('riflessi: risposta sbagliata (jab al posto del calcio, calcio al posto del jab)', () => {
  assert.equal(trial('lowKick', ['jab'], 300).status, 'wrong');
  const r = trial('jab', ['lowKick'], 300);
  assert.equal(r.status, 'wrong');
  assert.ok(close(r), `reazione ${r.rt}, vera ${r.true}`);
});

test('riflessi: calcio basso giusto, misurato dalla partenza della gamba', () => {
  const r = trial('lowKick', ['lowKick'], 320);
  assert.equal(r.status, 'ok', JSON.stringify(r));
  assert.ok(close(r), `reazione ${r.rt}, vera ${r.true}`);
  assert.equal(r.by, 'leg');
});

test('riflessi: schiva e diretto giusti', () => {
  const r = trial('slipCross', ['slip', 'cross'], 280);
  assert.equal(r.status, 'ok', JSON.stringify(r));
  assert.ok(close(r), `reazione ${r.rt}, vera ${r.true}`);
});

test('riflessi: il ritardo della camera dichiarato dal telefono si toglie', () => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(['jab'], { lead: CUE_AT + 250 })) judge.push(f.world, f.t, f.points, 1);
  const args = { cue: 'jab', cueAt: CUE_AT, frames: judge.frames(), gestures: judge.gestures(), lead: judge.lead };
  assert.equal(scoreTrial(args).rt - scoreTrial({ ...args, lagMs: 60 }).rt, 60);
});

test('riflessi: col ritardo della camera tolto, una partenza troppo presto resta "partito prima"', () => {
  const judge = calibrateJudge(createComboJudge());
  for (const f of synthSequence(['jab'], { lead: CUE_AT + 130 })) judge.push(f.world, f.t, f.points, 1);
  const args = { cue: 'jab', cueAt: CUE_AT, frames: judge.frames(), gestures: judge.gestures(), lead: judge.lead };
  assert.equal(scoreTrial(args).status, 'ok'); // senza ritardo: 130 ms, al limite ma valido
  const r = scoreTrial({ ...args, lagMs: 80 }); // la camera mostrava 80 ms dopo: la partenza vera era a ~50 ms
  assert.equal(r.status, 'early');
  assert.ok(r.rt < 100, `reazione ${r.rt}`);
});

test('riflessi: un punto che tremava prima del segnale non decide la partenza', () => {
  const track = [];
  for (let t = 300; t <= 2000; t += 33) track.push({ t, xy: [Math.sin(t / 40) * 0.3, 0], T: 0.2 });
  assert.equal(onsetOf(track, CUE_AT).status, 'restless');
  assert.equal(onsetOf(track.filter((s) => s.t > 900), CUE_AT).status, 'noBase');
});

test('riflessi: piano delle prove — pesi, mai 4 uguali di fila, attesa casuale nei limiti', () => {
  let s = 42;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const d of DRILLS) {
    const plan = planTrials(d, rand);
    assert.equal(plan.length, d.trials);
    for (const p of plan) {
      assert.ok(CUES[p.cue] && d.cues[p.cue], p.cue);
      assert.ok(p.foreMs >= REFLEX.foreMin && p.foreMs <= REFLEX.foreMax);
    }
    for (let i = 3; i < plan.length; i += 1) if (Object.keys(d.cues).length > 1) assert.ok(!plan.slice(i - 3, i + 1).every((p) => p.cue === plan[i].cue), `${d.id}: 4 uguali di fila`);
  }
  const big = planTrials({ ...DRILLS[1], trials: 400 }, rand);
  const stops = big.filter((p) => p.cue === 'stop').length / 400;
  assert.ok(stops > 0.2 && stops < 0.4, `✋ ${stops}`);
});

test('riflessi: riassunto, superato, sblocco degli esercizi e progressi', () => {
  const ok = (rt) => ({ status: 'ok', rt, mt: 150, total: rt + 150, nogo: false, lagMs: 0 });
  const trials = [ok(300), ok(280), ok(260), ok(320), ok(290), ok(310), ok(270), { status: 'held', nogo: true }, { status: 'bit', nogo: true }, { status: 'early', nogo: false }, { status: 'unread', nogo: false }];
  const s = summarize(trials);
  assert.equal(s.n, 10);
  assert.equal(s.acc, 0.8);
  assert.equal(s.rt, 290);
  assert.equal(s.best, 260);
  assert.equal(s.mt, 150);
  assert.equal(s.early, 1);
  assert.equal(s.bit, 1);
  assert.equal(s.unread, 1);
  assert.ok(passed(s));
  assert.ok(!passed({ ...s, early: 2 }));
  assert.ok(!passed({ ...s, acc: 0.7 }));

  let h = emptyHistory();
  assert.deepEqual(unlockedDrills(h), ['puro']);
  h = addSession(h, 'puro', { ...s, acc: 0.6 }, 1);
  assert.deepEqual(unlockedDrills(h), ['puro']);
  h = addSession(h, 'puro', s, 2);
  assert.deepEqual(unlockedDrills(h), ['puro', 'nonAbboccare']);
  h = addSession(h, 'puro', { ...s, rt: 300 }, 3);
  h = addSession(h, 'puro', { ...s, rt: 250, best: 230 }, 4);
  const st = drillStats(h, 'puro');
  assert.equal(st.sessions, 4);
  assert.equal(st.best, 230);
  assert.equal(st.gain, 40); // prime 3 serie: mediana 290 → ultima 250
  assert.ok(st.passed);
});

test('riflessi: salvataggio con il prefisso del backup; un salvataggio rovinato non blocca', () => {
  assert.match(REFLEX_KEY, /^shadow_monarch_/);
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const h = addSession(emptyHistory(), 'puro', { n: 10, acc: 1, rt: 250 }, 5);
  assert.ok(saveHistory(h, storage));
  assert.deepEqual(loadHistory(storage), h);
  mem.set(REFLEX_KEY, '{rotto');
  assert.deepEqual(loadHistory(storage), emptyHistory());
  assert.deepEqual(loadHistory(null), emptyHistory());
});

test('riflessi: i punti del corpo si leggono in busti, rispetto al bacino', () => {
  const [f] = synthSequence([], { lead: 100 });
  const tr = effectorTracks([f], { lead: 'L' });
  assert.equal(tr.leadWrist.length, 1);
  assert.ok(Math.abs(tr.head[0].xy[1]) > 0.8, 'la testa sta circa un busto sopra il bacino');
});

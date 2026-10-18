// Registro degli allenamenti del coach con camera (lib/mmaTrain.js): clip etichettata di ogni
// ripetizione, giudizio di Emanuele (👍/👎 e colpi letti male), invio in sospeso, coda offline,
// lista del server (lib/mmaClipStore.js) e script di analisi (dati finti).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createComboJudge } from '../lib/mmaComboJudge.js';
import { createBagContacts, createBagMotion, BAG } from '../lib/mmaBag.js';
import {
  NO_VOTE, QUEUE_KEY, TRAIN_MAX_CHARS, WAIT, buildTrainClip, castVote, clipChars, createTrainPending,
  createTrainSender, fitClip, mergeQueue, toggleWrong, voteWait, withVote,
} from '../lib/mmaTrain.js';
import { planPoseClip } from '../lib/mmaClipStore.js';
import { dedupe, replayClip, summarize } from '../scripts/punch-training/allenamenti-veri.mjs';
import { synthSequence, realistic } from './helpers/synthFighter.js';

// una ripetizione sintetica come in app: guardia, "VIA" a 500 ms, colpi, giudizio del coach
function rep(moves, { seed = 7, tempo = 1, bag = false } = {}) {
  const all = realistic(synthSequence(moves, { tempo }), { seed, drop: 0 });
  const calib = all.slice(0, 16);
  const j = createComboJudge();
  for (const f of calib) j.calibrate(f.world, f.points, 0.75);
  for (const f of all) j.push(f.world, f.t, f.points, 0.75);
  const t0 = 500;
  const frames = j.frames().filter((f) => f.t >= t0 - 200);
  const gestures = j.gestures().filter((g) => g.start >= t0 - 700);
  const snap = bag ? {
    box: { x0: 0.6, x1: 0.78, y0: 0.1, y1: 0.75 }, axis: { xTop: 0.69, xBot: 0.7 }, width: 0.18, zones: { head: 0.22, body: 0.45, low: 0.66 },
    contacts: gestures.filter((g) => g.limb === 'arm').map((g) => ({ t: g.peakT + 20, S: g.S, limb: 'arm', zone: 'head', strength: 0.61, sure: true, by: 'stop+bag' })),
    motion: frames.map((f, i) => [f.t, Math.sin(i / 9) * 1.4, 0.21, 1.3, 1, 0]),
  } : null;
  const result = j.judgeRep(moves, { since: t0 - 700 });
  const clip = buildTrainClip({
    frames, from: t0 - 200, go: t0, calib, aspect: 0.75, rep: 1000 + seed, session: 1, n: seed,
    combo: { id: 'c1', name: moves.join('-') }, moves, stance: 'orthodox', result, gestures,
    bag: snap, bagScore: bag ? { hit: moves.map(() => true), hits: moves.length, total: moves.length } : null,
    phone: { model: 'lite', cam: 'user', stats: { resultsPerSec: 24.64, waitMs: 11, imageDelayMs: 38, synced: true } },
  });
  return { clip, result, gestures, frames };
}

test('registro: la clip porta scheletro, combo, giudizio del coach, gesti e telefono', () => {
  const { clip, result, gestures, frames } = rep(['jab', 'cross']);
  assert.equal(clip.ver, 'v7');
  assert.deepEqual(clip.expected, ['jab', 'cross']);
  assert.equal(clip.t[0], 0);
  assert.equal(clip.t.length, frames.length);
  assert.equal(clip.go, 200); // "VIA" 200 ms dopo l'inizio della clip
  assert.equal(clip.ok, null);
  assert.deepEqual(clip.wrong, []);
  assert.deepEqual(clip.coach.st, result.moves.map((m) => m.status));
  assert.equal(clip.coach.total, result.total);
  // ogni colpo atteso punta al gesto che il coach gli ha abbinato
  clip.coach.g.forEach((gi, i) => { if (result.moves[i].gesture) assert.equal(clip.seen[gi].start, Math.round(result.moves[i].gesture.start - frames[0].t)); });
  assert.equal(clip.seen.length, gestures.length);
  assert.ok(clip.seen.every((g) => ['S', 'start', 'peakT', 'end', 'reach', 'move', 'kind'].every((k) => k in g)));
  assert.equal(clip.bagOn, false);
  assert.equal(clip.bag, null);
  assert.deepEqual(clip.phone, { model: 'lite', cam: 'user', rps: 24.6, waitMs: 11, delayMs: 38, synced: true });
  assert.equal(clip.cal.w.length, 16); // la guardia per rigiocarla come in app
});

test('registro: al sacco rettangolo, contatti e movimento per fotogramma; peso sotto il limite', () => {
  const { clip, frames } = rep(['jab', 'cross', 'hook', 'cross'], { bag: true, tempo: 2.2 });
  assert.equal(clip.bagOn, true);
  assert.deepEqual(clip.bag.rect, [600, 100, 780, 750]);
  assert.equal(clip.bag.hits, 4);
  assert.ok(clip.bag.contacts.length >= 2);
  assert.ok(clip.bag.contacts.every((c) => ['t', 'S', 'zone', 'strength'].every((k) => k in c)));
  assert.equal(clip.bag.motion.t.length, frames.length);
  assert.equal(clip.bag.motion.x[0], 0);
  assert.equal(clip.bag.motion.v[0], 21);
  // ripetizione lunga (7 s a 30 al secondo): ~80.000 caratteri, il server ne accetta 150.000
  const chars = clipChars(clip);
  assert.ok(chars < 100000 && chars < TRAIN_MAX_CHARS, `${chars} caratteri`);
  const short = clipChars(rep(['jab', 'cross']).clip);
  assert.ok(short < 45000, `${short} caratteri`);
});

test('registro: clip troppo grande → via prima il 3D, poi il resto; mai oltre il limite', () => {
  const { clip } = rep(['jab', 'cross'], { bag: true });
  assert.equal(fitClip(clip), clip); // normale: intatta
  const small = fitClip(clip, clipChars(clip) - 100);
  assert.equal(small.w, null);
  assert.deepEqual(small.cut, ['w']);
  assert.ok(small.p.length === clip.p.length);
  const tiny = fitClip(clip, Math.round(clipChars({ ...clip, w: null }) * 0.6));
  assert.ok(tiny === null || clipChars(tiny) <= Math.round(clipChars({ ...clip, w: null }) * 0.6));
  assert.equal(fitClip(clip, 100), null);
  assert.equal(fitClip(null), null);
});

test('giudizio: 👍 / 👎, colpi letti male solo dopo il 👎, e dentro la clip', () => {
  let v = NO_VOTE;
  assert.equal(toggleWrong(v, 1), v); // senza 👎 i colpi non si segnano
  v = castVote(v, true);
  assert.deepEqual(v, { ok: true, wrong: [] });
  assert.equal(toggleWrong(v, 0), v);
  v = castVote(v, false);
  v = toggleWrong(v, 2); v = toggleWrong(v, 0); v = toggleWrong(v, 2); v = toggleWrong(v, 1);
  assert.deepEqual(v, { ok: false, wrong: [0, 1] }); // tocco due volte = tolto; in ordine
  assert.equal(toggleWrong(v, -1), v);
  assert.deepEqual(castVote(v, true), { ok: true, wrong: [] }); // 👍 dopo: niente colpi sbagliati
  assert.deepEqual(castVote(castVote(v, true), false), { ok: false, wrong: [] });
  const { clip } = rep(['jab', 'cross']);
  const voted = withVote(clip, v);
  assert.equal(voted.ok, false);
  assert.deepEqual(voted.wrong, [0, 1]);
  assert.equal(clip.ok, null); // l'originale non cambia
  assert.deepEqual(withVote(clip, { ok: true, wrong: [1] }).wrong, []);
  assert.equal(voteWait(NO_VOTE), WAIT.none);
  assert.ok(voteWait({ ok: true }) < voteWait({ ok: false, wrong: [] }));
});

test('invio in sospeso: parte col giudizio (dopo l\'attesa), alla ripetizione dopo, o dopo 20 s', () => {
  const sent = [];
  const timers = new Map();
  let id = 0;
  const later = (fn, ms) => { id += 1; timers.set(id, { fn, ms }); return id; };
  const cancel = (k) => timers.delete(k);
  const fire = () => { const [k, t] = [...timers.entries()].at(-1); timers.delete(k); t.fn(); return t.ms; };
  const p = createTrainPending({ send: (list) => sent.push(...list), later, cancel });
  const a = { v: 1, rep: 1, session: 1, t: [0], p: [null], w: [[0]] };
  p.hold(a);
  assert.equal(sent.length, 0);
  assert.equal(timers.size, 1);
  p.vote(castVote(NO_VOTE, false));
  p.vote(toggleWrong(castVote(NO_VOTE, false), 1)); // tocco su un colpo: l'attesa riparte
  assert.equal(timers.size, 1);
  assert.equal(fire(), WAIT.down);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].ok, false);
  assert.deepEqual(sent[0].wrong, [1]);
  assert.equal(p.flush(), false); // già partita: niente doppioni
  // giudizio cambiato dopo l'invio: riparte (l'analisi tiene l'ultima)
  p.vote(castVote(NO_VOTE, true));
  assert.equal(fire(), WAIT.up);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].ok, true);
  // nuova ripetizione senza giudizio: la precedente non riparte, questa esce dopo 20 s con ok null
  const b = { ...a, rep: 2 };
  p.hold(b);
  assert.equal(sent.length, 2);
  assert.equal(fire(), WAIT.none);
  assert.equal(sent[2].rep, 2);
  assert.equal(sent[2].ok, null);
  // ripetizione dopo prima del giudizio: parte subito con la nuova in sospeso
  p.hold({ ...a, rep: 3 });
  p.hold({ ...a, rep: 4 });
  assert.deepEqual(sent.map((c) => c.rep), [1, 1, 2, 3]);
  assert.equal(p.waiting(), true);
  p.flush(); // chiusura
  assert.deepEqual(sent.map((c) => c.rep), [1, 1, 2, 3, 4]);
  assert.equal(p.waiting(), false);
  p.hold(null); // registro spento: niente
  assert.equal(sent.length, 5);
});

test('coda offline: al massimo 20 clip o 1,5 MB, le più vecchie escono, niente doppioni', () => {
  const clip = (rep, size = 10) => ({ rep, session: 1, pad: 'x'.repeat(size) });
  const list = mergeQueue([], Array.from({ length: 25 }, (_, i) => clip(i)));
  assert.equal(list.length, 20);
  assert.equal(list[0].rep, 5); // le 5 più vecchie fuori
  const big = mergeQueue([clip(1, 600000), clip(2, 600000)], [clip(3, 600000)]);
  assert.deepEqual(big.map((c) => c.rep), [2, 3]);
  const same = mergeQueue([clip(1), clip(2)], [{ ...clip(1), ok: true }]);
  assert.deepEqual(same.map((c) => [c.rep, c.ok]), [[2, undefined], [1, true]]);
  assert.deepEqual(mergeQueue(null, [null, 'x', clip(9)]).map((c) => c.rep), [9]);
});

test('invio: rete assente → in coda sul telefono; alla volta dopo parte tutto, in ordine', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  let online = false;
  const calls = [];
  const post = async (items, chatId) => { calls.push({ reps: items.map((c) => c.rep), chatId }); return online ? 'ok' : 'retry'; };
  const s = createTrainSender({ storage: () => storage, post, chatId: () => '42' });
  const c = (rep) => ({ rep, session: 7, t: [0] });
  let r = await s.send([c(1)]);
  assert.deepEqual(r, { sent: 0, queued: 1, dropped: 0 });
  r = await s.send(Array.from({ length: 8 }, (_, i) => c(2 + i)));
  assert.equal(r.queued, 9);
  assert.equal(calls.length, 2); // al primo errore di rete niente altri tentativi
  assert.equal(s.queued(), 9);
  online = true;
  r = await s.send([c(20)]);
  assert.deepEqual(r, { sent: 10, queued: 0, dropped: 0 });
  assert.deepEqual(calls.slice(2).map((x) => x.reps), [[1, 2, 3, 4, 5, 6], [7, 8, 9, 20]]); // a gruppi di 6, le vecchie prima
  assert.equal(calls[2].chatId, '42');
  assert.equal(mem.has(QUEUE_KEY), false);
  // rifiutata dal server (400): non torna in coda
  const s2 = createTrainSender({ storage: () => storage, post: async () => 'drop' });
  assert.deepEqual(await s2.send([c(30)]), { sent: 0, queued: 0, dropped: 1 });
  // niente localStorage, post che esplode: nessun errore fuori
  const s3 = createTrainSender({ storage: () => { throw new Error('no'); }, post: async () => { throw new Error('rete'); } });
  assert.deepEqual(await s3.send([c(31)]), { sent: 0, queued: 1, dropped: 0 });
  // in fila: due invii insieme non si pestano
  const mem2 = new Map();
  const st2 = { getItem: (k) => mem2.get(k) ?? null, setItem: (k, v) => mem2.set(k, v), removeItem: (k) => mem2.delete(k) };
  const s4 = createTrainSender({ storage: () => st2, post: async () => 'retry' });
  await Promise.all([s4.send([c(40)]), s4.send([c(41)]), s4.retry()]);
  assert.deepEqual(JSON.parse(mem2.get(QUEUE_KEY)).map((x) => x.rep), [40, 41]);
});

test('server: kind train → lista mma_train (800, 180 giorni); gli altri kind come prima', () => {
  const now = new Date('2026-10-17T10:00:00Z');
  const t = planPoseClip({ kind: 'train', items: [{ rep: 1 }] }, '123', now);
  assert.equal(t.key, 'mma_train:123');
  assert.deepEqual(t.commands.at(-2), ['LTRIM', 'mma_train:123', '-800', '-1']);
  assert.deepEqual(t.commands.at(-1), ['EXPIRE', 'mma_train:123', String(180 * 86400)]);
  assert.deepEqual(JSON.parse(t.commands[0][2]), { rep: 1, kind: 'train', ts: '2026-10-17T10:00:00.000Z' });
  for (const kind of ['teach', 'rep', 'session', 'boh', undefined]) {
    const p = planPoseClip({ kind, items: [{ a: 1 }] }, '9', now);
    assert.equal(p.key, 'mma_clips:9');
    assert.equal(p.kind, kind === 'teach' || kind === 'session' ? kind : 'rep');
    assert.deepEqual(p.commands.slice(-2), [['LTRIM', 'mma_clips:9', '-150', '-1'], ['EXPIRE', 'mma_clips:9', String(120 * 86400)]]);
  }
  // limite di 150.000 caratteri e 8 clip per richiesta
  const huge = planPoseClip({ kind: 'train', items: [{ x: 'y'.repeat(150000) }] }, '1', now);
  assert.equal(huge.error, 'clip vuota o troppo grande');
  const many = planPoseClip({ kind: 'train', items: Array.from({ length: 12 }, (_, i) => ({ i })) }, '1', now);
  assert.equal(many.items.length, 8);
  assert.ok(planPoseClip({ kind: 'train', items: 'no' }, '1', now).error);
  // una clip vera al sacco (lunga) passa
  const { clip } = rep(['jab', 'cross', 'hook', 'cross'], { bag: true, tempo: 2.2 });
  assert.equal(planPoseClip({ kind: 'train', items: [fitClip(clip)] }, '1', now).items.length, 1);
});

test('sacco: il movimento di ogni fotogramma si legge senza cambiare i contatti', () => {
  const thumb = (shift) => Uint8Array.from({ length: BAG.thumb * BAG.thumb }, (_, i) => ((i % BAG.thumb) + shift) % 8 < 4 ? 40 : 200);
  const m = createBagMotion();
  m.push(thumb(0), 0);
  const out = m.push(thumb(0), 33);
  assert.ok(Number.isFinite(out.e)); // tremolio
  const bag = { box: { x0: 0.6, x1: 0.8, y0: 0.1, y1: 0.8 }, axis: { xTop: 0.7, xBot: 0.7 }, width: 0.2 };
  const det = createBagContacts({ bag });
  assert.equal(det.motion(), null);
  const pts = Array.from({ length: 33 }, () => ({ x: 0.2, y: 0.5, visibility: 1 }));
  det.push(pts, 0, { thumb: thumb(0) });
  det.push(pts, 33, { thumb: thumb(0) });
  assert.equal(det.motion().t, 33);
  assert.ok('pos' in det.motion() && 'vel' in det.motion());
  det.reset();
  assert.equal(det.motion(), null);
});

test('analisi: riepilogo, accordo, doppioni e rigioco nel motore di adesso (dati finti)', () => {
  const a = { ...rep(['jab', 'cross'], { seed: 1 }).clip, ok: true, kind: 'train' };
  const b = { ...rep(['jab', 'cross'], { seed: 2 }).clip, ok: false, wrong: [1], kind: 'train' };
  const c = { ...rep(['jab', 'cross', 'hook'], { seed: 3, bag: true }).clip, ok: null, kind: 'train' };
  const clips = dedupe([a, b, c, { ...c, ok: false, wrong: [] }]);
  assert.equal(clips.length, 3);
  const s = summarize(clips);
  assert.deepEqual(s.vote, { up: 1, down: 2, none: 0 });
  assert.equal(s.agree.reps, 1);
  assert.equal(s.agree.judged, 3);
  assert.deepEqual([s.agree.moves, s.agree.movesJudged], [3, 4]); // 👎 senza colpi segnati esclusi
  assert.deepEqual(Object.keys(s.wrong), ['cross|rear']);
  assert.equal(s.bag.reps, 1);
  assert.equal(s.bag.hits, 3);
  assert.ok(s.bag.contacts >= 2);
  assert.equal(s.phone.models.lite, 3);
  // rigiocata con la guardia salvata, la clip dà la stessa lettura dell'app
  const r = replayClip(a);
  assert.deepEqual(r.result.moves.map((m) => m.status), a.coach.st);
  assert.equal(replayClip({ ...a, w: null }), null); // senza 3D si salta
});

test('server: il gestore vero manda la clip train in mma_train e la rep in mma_clips (rete finta)', async () => {
  const { default: handler } = await import('../api/nvidia/visual.js');
  const old = { fetch: globalThis.fetch, url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  process.env.KV_REST_API_URL = 'https://kv.finto'; process.env.KV_REST_API_TOKEN = 'finto';
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const res = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} });
  const req = (poseClip) => ({ method: 'POST', headers: { origin: process.env.SITE_URL || 'https://solo-levelling-steel.vercel.app', 'x-forwarded-for': '10.9.9.9' }, body: { chatId: '77', poseClip } });
  try {
    const a = res();
    await handler(req({ kind: 'train', items: [{ rep: 1, ok: true }] }), a);
    assert.equal(a.code, 200);
    assert.deepEqual(a.body, { ok: true, stored: 1 });
    assert.equal(calls[0].url, 'https://kv.finto/pipeline');
    assert.deepEqual(calls[0].body.map((cmd) => cmd.slice(0, 2)), [['RPUSH', 'mma_train:77'], ['LTRIM', 'mma_train:77'], ['EXPIRE', 'mma_train:77']]);
    const b = res();
    await handler(req({ kind: 'rep', items: [{ rep: 2 }] }), b);
    assert.equal(calls[1].body[0][1], 'mma_clips:77');
    const c = res();
    await handler(req({ kind: 'train', items: [] }), c);
    assert.equal(c.code, 400);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = old.fetch;
    if (old.url === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = old.url;
    if (old.token === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = old.token;
  }
});

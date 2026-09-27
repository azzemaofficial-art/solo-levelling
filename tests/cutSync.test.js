import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage/window minimi per applyCutRemote
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const events = [];
globalThis.window = { dispatchEvent: (e) => events.push(e.type) };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const { applyCutRemote, CUT_PLAN_KEY } = await import('../src/utils/cutSync.js');
const read = () => JSON.parse(store.get(CUT_PLAN_KEY));

test('cutSync: creatina da Telegram segna la data e paga 10 XP una volta', () => {
  store.clear();
  const paid = [];
  applyCutRemote({ type: 'cut_creatine', date: '2026-09-29' }, (xp) => paid.push(xp));
  applyCutRemote({ type: 'cut_creatine', date: '2026-09-29' }, (xp) => paid.push(xp));
  assert.equal(read().creatineDate, '2026-09-29');
  assert.deepEqual(paid, [10]);
  assert.ok(events.includes('shadow_cut_sync'));
});

test('cutSync: sessione da Telegram segna lo slot della settimana corrente', () => {
  store.clear();
  store.set(CUT_PLAN_KEY, JSON.stringify({ trainingWeek: 2 }));
  const paid = [];
  applyCutRemote({ type: 'cut_session', date: '2026-10-03' }, (xp) => paid.push(xp)); // sabato
  assert.equal(read().completed['2-5'], true);
  assert.deepEqual(paid, [40]);
});

test('cutSync: premio già preso in app non si ripaga', () => {
  store.clear();
  store.set(CUT_PLAN_KEY, JSON.stringify({ xpAwarded: { 'creatine-2026-09-29': true } }));
  const paid = [];
  applyCutRemote({ type: 'cut_creatine', date: '2026-09-29' }, (xp) => paid.push(xp));
  assert.deepEqual(paid, []);
});

test('cutSync: payload sconosciuto o data invalida → nessun effetto', () => {
  store.clear();
  applyCutRemote({ type: 'cut_creatine', date: 'ieri' }, () => assert.fail());
  applyCutRemote({ type: 'altro', date: '2026-09-29' }, () => assert.fail());
  assert.equal(store.size, 0);
});

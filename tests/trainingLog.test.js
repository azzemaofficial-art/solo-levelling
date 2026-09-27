import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const log = await import('../src/utils/trainingLog.js');
const { applyCutRemote } = await import('../src/utils/cutSync.js');

test('diario: stesso allenamento lo stesso giorno non si duplica', () => {
  store.clear();
  assert.equal(log.logWorkout({ date: '2026-09-29', kind: 'strength', title: 'Forza A', minutes: 35 }), true);
  assert.equal(log.logWorkout({ date: '2026-09-29', kind: 'strength', title: 'Forza A', minutes: 35 }), false);
  assert.equal(log.readTrainingLog().length, 1);
});

test('diario: togliere la spunta toglie la voce, delete per id', () => {
  store.clear();
  log.logWorkout({ date: '2026-09-29', kind: 'strength', title: 'Forza A' });
  log.logWorkout({ date: '2026-09-30', kind: 'mma', title: 'Combo 1-2' });
  log.unlogWorkout({ date: '2026-09-29', kind: 'strength', title: 'Forza A' });
  assert.deepEqual(log.readTrainingLog().map((e) => e.title), ['Combo 1-2']);
  log.deleteWorkout(log.readTrainingLog()[0].id);
  assert.equal(log.readTrainingLog().length, 0);
});

test('diario: data del giorno nella settimana corrente (lunedì = 0)', () => {
  const sunday = new Date('2026-09-27T10:00:00');
  assert.equal(log.dateOfWeekday(0, sunday), '2026-09-21');
  assert.equal(log.dateOfWeekday(6, sunday), '2026-09-27');
});

test('diario: durata e tipo dal piano', () => {
  assert.equal(log.durationMinutes('30–40 min'), 35);
  assert.equal(log.durationMinutes('60 min'), 60);
  assert.equal(log.durationMinutes('—'), null);
  assert.equal(log.kindForSession('football'), 'football');
  assert.equal(log.kindForSession('optional'), 'mma');
});

test('diario: settimane attive di fila (≥ 3 allenamenti), la settimana in corso non la interrompe', () => {
  const now = new Date('2026-09-30T10:00:00'); // mercoledì
  const list = [];
  // due settimane precedenti con 3 allenamenti ciascuna, questa settimana 1
  for (const d of ['2026-09-15', '2026-09-16', '2026-09-18', '2026-09-22', '2026-09-24', '2026-09-26', '2026-09-29']) list.push({ date: d, title: 'x', kind: 'strength' });
  const s = log.trainingStats(list, now);
  assert.equal(s.streak, 2);
  assert.equal(s.thisWeek.length, 1);
});

test('telegram ✅: la sessione finisce nel diario con fonte telegram', () => {
  store.clear();
  applyCutRemote({ type: 'cut_session', date: '2026-09-29' }, () => {}); // martedì = Forza A
  const [entry] = log.readTrainingLog();
  assert.equal(entry.title, 'Forza A');
  assert.equal(entry.source, 'telegram');
  assert.equal(entry.minutes, 35);
});

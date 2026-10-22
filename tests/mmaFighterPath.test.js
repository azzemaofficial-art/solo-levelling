// Percorso del combattente e allenamento di oggi (lib/mmaFighterPath.js): si sale di tappa solo con le prove fatte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBOS } from '../src/data/mmaCombos.js';
import { mmaLessons } from '../src/data/mmaPath.js';
import { mmaCoaching } from '../src/data/mmaCoaching.js';
import { SECRET_MOVES, PATH_KEY } from '../lib/mmaSecretPath.js';
import { REFLEX_KEY, addSession, emptyHistory } from '../lib/mmaReflex.js';
import { COMBO_SCORES_KEY, FIGHTER_KEY, GATES, blockDone, comboForToday, currentStage, fighterState, freezeToday, gatesOf, markTodayDone, pathSummary, planToday, readFighter, recordComboScore, saveReached, toggleGym } from '../lib/mmaFighterPath.js';

const DAY = 86400000;
const NOW = Date.parse('2026-10-21T18:00:00');
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const passedRun = { n: 10, acc: 0.9, early: 0, rt: 280 };
const reflexWith = (ids, at = NOW - 10 * DAY) => ids.reduce((h, id) => addSession(h, id, passedRun, at), emptyHistory());
const learned = (n) => ({ learned: Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 1])), pending: null });
const clean = (ids) => Object.fromEntries(ids.map((id) => [id, { best: 85, last: 85, n: 1, at: NOW - 5 * DAY }]));
const levelIds = (level, n) => COMBOS.filter((c) => c.level === level).slice(0, n).map((c) => c.id);
// seduta del Coach Studio vista dalla camera (mode camera + enough, come la salva summarizeMmaSession)
const roundsSession = (completed, sec, at = NOW - 3 * DAY, lessonId = 'rounds', extra = {}) => ({ lessonId, completed, activeMs: completed * sec * 1000, date: new Date(at).toISOString(), mode: 'camera', enough: true, practiced: true, ...extra });
// lezioni brevi (2 × 1 min): praticate con la camera, ma non valgono come prova dei round
const baseLessons = () => mmaLessons.filter((l) => l.stage === 0).map((l) => roundsSession(2, 60, NOW - 20 * DAY, l.id));

// uno che ha finito la tappa 0
const stage0 = () => ({
  now: NOW,
  comboScores: clean(['1-2']), secret: learned(2), reflex: reflexWith(['puro']),
  sessions: [...baseLessons(), roundsSession(3, 120)], gym: { gymStart: NOW },
});

test('percorso: le chiavi entrano nel backup automatico (prefisso shadow_monarch_)', () => {
  for (const k of [COMBO_SCORES_KEY, FIGHTER_KEY]) assert.match(k, /^shadow_monarch_/);
});

test('percorso: si parte dalla tappa 0 con tutte le prove da fare', () => {
  const s = pathSummary({ now: NOW });
  assert.equal(s.stage, 0);
  assert.equal(s.ready, false);
  assert.equal(s.done, 0);
  assert.equal(s.gates.length, GATES[0].length);
  assert.ok(s.gates.every((g) => !g.done && g.need >= 1));
});

test('percorso: tutte le prove della tappa 0 → si passa alla tappa 1; ne manca una → si resta', () => {
  assert.equal(currentStage(stage0()), 1);
  for (const broken of [{ comboScores: clean([]) }, { secret: learned(1) }, { reflex: emptyHistory() }, { sessions: baseLessons() }, { sessions: [roundsSession(3, 120)] }, { gym: {} }]) {
    assert.equal(currentStage({ ...stage0(), ...broken }), 0, JSON.stringify(Object.keys(broken)));
  }
  const g = gatesOf({ ...stage0(), comboScores: { '1-2': { best: 62 } } }, 0).find((x) => x.id === 'combo12');
  assert.deepEqual([g.done, g.now, g.need], [false, 62, 80]);
});

test('percorso: i round contano solo se lunghi davvero (4 × 90 s non valgono 3 × 2 min)', () => {
  const rounds = (sessions) => gatesOf({ ...stage0(), sessions: [...baseLessons(), ...sessions] }, 0).find((x) => x.id === 'rounds3x2').done;
  assert.equal(rounds([roundsSession(4, 90, NOW, 'footwork')]), false);
  assert.equal(rounds([roundsSession(2, 120)]), false);
  assert.equal(rounds([{ ...roundsSession(3, 120), activeMs: 150000 }]), false); // fermo metà del tempo
  assert.equal(rounds([roundsSession(3, 120)]), true);
  assert.equal(rounds([roundsSession(3, 180)]), true);
  // senza camera (o con la camera che non ti vedeva) il timer da solo non basta
  assert.equal(rounds([roundsSession(3, 120, NOW, 'rounds', { mode: 'guided', enough: false })]), false);
  assert.equal(rounds([roundsSession(3, 120, NOW, 'rounds', { enough: false })]), false);
});

test('percorso: le lezioni contano solo fatte con la camera, non con la spunta a mano', () => {
  const lessons = (state) => gatesOf({ now: NOW, ...state }, 0).find((x) => x.id === 'lessons0');
  const flags = Object.fromEntries(mmaLessons.filter((l) => l.stage === 0).map((l) => [l.id, true]));
  assert.equal(lessons({ lessonsDone: flags }).now, 0);
  assert.equal(lessons({ sessions: baseLessons().map((h) => ({ ...h, mode: 'guided', enough: false })) }).now, 0);
  assert.equal(lessons({ sessions: baseLessons() }).done, true);
});

test('percorso: una tappa superata resta superata anche quando le sedute vecchie escono dal diario', () => {
  const storage = memory();
  saveReached(currentStage(stage0()), storage);
  const later = { ...stage0(), sessions: [], reached: readFighter(storage).reached };
  assert.equal(later.reached, 1);
  assert.equal(currentStage(later), 1);
  assert.equal(currentStage({ ...later, reached: 0 }), 0);
  saveReached(0, storage); // mai all'indietro
  assert.equal(readFighter(storage).reached, 1);
});

test('percorso: fino al primo incontro; i round "in forma" devono essere recenti', () => {
  const all = {
    ...stage0(),
    comboScores: clean([...levelIds(1, 6), '1-2', ...levelIds(2, 6), ...levelIds(3, 4)]),
    secret: learned(10), reflex: reflexWith(['puro', 'nonAbboccare', 'manoGamba', 'lati', 'schiva', 'leggi']),
    sessions: [...baseLessons(), roundsSession(4, 180, NOW - 5 * DAY)],
    gym: Object.fromEntries(GATES.flat().filter((g) => g.how === 'palestra').map((g) => [g.id, NOW])),
  };
  const s = pathSummary(all);
  assert.equal(s.stage, 4);
  assert.equal(s.ready, true);
  assert.equal(s.name, 'Pronto per il primo incontro');
  assert.equal(currentStage({ ...all, sessions: [...baseLessons(), roundsSession(4, 180, NOW - 60 * DAY)] }), 3);
  assert.equal(currentStage({ ...all, gym: { ...all.gym, medical: undefined } }), 3);
});

test('percorso: ogni mossa segreta ha la sua combo e la lezione «Round di shadow» ha testo e piano', () => {
  for (const m of SECRET_MOVES) assert.ok(COMBOS.some((c) => c.id === m.combo), m.combo);
  assert.ok(mmaLessons.some((l) => l.id === 'rounds'));
  assert.ok(mmaCoaching.rounds?.tag && mmaCoaching.rounds.measured);
  // prove raggiungibili: ci sono abbastanza combo per ogni livello richiesto
  for (const [level, need] of [[1, 6], [2, 6], [3, 4]]) assert.ok(COMBOS.filter((c) => c.level === level).length >= need, `livello ${level}`);
});

test('oggi: principiante, 40 minuti → riscaldamento, riflessi, tecnica, combo, round 3 × 2, defaticamento', () => {
  const p = planToday({ now: NOW }, { now: NOW });
  assert.deepEqual(p.blocks.map((b) => b.id), ['warmup', 'reflex', 'lesson', 'combo', 'rounds', 'cooldown']);
  assert.equal(p.blocks[1].drill, 'puro');
  assert.equal(p.blocks[2].lesson, 'stance');
  assert.equal(p.blocks[3].combo, '1-2');
  assert.deepEqual([p.blocks[4].rounds, p.blocks[4].sec], [3, 120]);
  assert.ok(p.minutes >= 35 && p.minutes <= 48, `${p.minutes} min`);
  assert.ok(p.blocks.at(-1).steps.some((x) => x.breath), 'respiro 5-5 nel defaticamento');
});

test('oggi: 20 minuti → niente lezione, 2 round corti; 60 minuti → più tecnica', () => {
  const short = planToday({ now: NOW }, { minutes: 20, now: NOW });
  assert.ok(!short.blocks.some((b) => b.kind === 'lesson'));
  assert.equal(short.blocks.find((b) => b.kind === 'rounds').rounds, 2);
  assert.ok(short.minutes <= 25, `${short.minutes} min`);
  const long = planToday({ now: NOW }, { minutes: 60, now: NOW });
  assert.equal(long.blocks.find((b) => b.kind === 'lesson').minutes, 15);
});

test('oggi: i riflessi si fanno da riposati e non tutti i giorni', () => {
  const yesterday = { now: NOW, reflex: reflexWith(['puro'], NOW - DAY) };
  assert.ok(!planToday(yesterday, { now: NOW }).blocks.some((b) => b.kind === 'reflex'));
  const today = { now: NOW, reflex: reflexWith(['puro'], NOW - 3600000) };
  const block = planToday(today, { now: NOW }).blocks.find((b) => b.kind === 'reflex');
  assert.equal(block.drill, 'nonAbboccare'); // «Riflesso puro» superato: tocca al successivo
  assert.ok(!blockDone(block, today, NOW));
  const done = { ...today, reflex: addSession(today.reflex, 'nonAbboccare', passedRun, NOW - 60000) };
  assert.ok(blockDone(block, done, NOW));
});

test('oggi: la combo della mossa segreta sbloccata ha la precedenza; poi la più vicina al traguardo', () => {
  assert.equal(comboForToday({ secret: learned(2) }, 1).combo.id, SECRET_MOVES[0].combo);
  assert.equal(comboForToday({ secret: learned(2), comboScores: clean([SECRET_MOVES[0].combo]) }, 1).combo.id === SECRET_MOVES[0].combo, false);
  const near = comboForToday({ comboScores: { '1-1-2': { best: 74, at: 1 }, '1-2-3': { best: 50, at: 1 } } }, 0);
  assert.equal(near.combo.id, '1-1-2');
  assert.match(near.why, /74/);
});

test('oggi: combo e round segnati fatti dai dati veri; riscaldamento con la spunta di oggi', () => {
  const p = planToday({ now: NOW }, { now: NOW });
  const combo = p.blocks.find((b) => b.kind === 'combo'), rounds = p.blocks.find((b) => b.kind === 'rounds');
  assert.ok(blockDone(combo, { comboScores: { [combo.combo]: { best: 60, at: NOW - 1000 } } }, NOW));
  assert.ok(!blockDone(combo, { comboScores: { [combo.combo]: { best: 60, at: NOW - DAY } } }, NOW));
  assert.ok(blockDone(rounds, { sessions: [roundsSession(3, 120, NOW - 1000)] }, NOW));
  // la versione breve (2 × 1 minuto) non spunta 3 round da 2 minuti
  assert.ok(!blockDone(rounds, { sessions: [roundsSession(2, 60, NOW - 1000)] }, NOW));
  const storage = memory();
  markTodayDone('warmup', storage, NOW);
  assert.ok(blockDone(p.blocks[0], fighterState({ storage, now: NOW }), NOW));
  assert.ok(!blockDone(p.blocks[0], fighterState({ storage, now: NOW + DAY }), NOW + DAY));
});

test('salvataggi: voto della combo (migliore e ultimo), spunte di palestra, stato letto da tutti i salvataggi', () => {
  const storage = memory();
  recordComboScore('1-2', 72, { storage, at: 1 });
  const r = recordComboScore('1-2', 64, { storage, at: 2 });
  assert.deepEqual(r, { best: 72, last: 64, n: 2, at: 2 });
  toggleGym('gymStart', storage, 5);
  assert.equal(readFighter(storage).gym.gymStart, 5);
  toggleGym('gymStart', storage);
  assert.equal(readFighter(storage).gym.gymStart, undefined);
  storage.setItem(PATH_KEY, JSON.stringify({ learned: { a: 1 } }));
  storage.setItem(REFLEX_KEY, JSON.stringify(reflexWith(['puro'])));
  const st = fighterState({ storage, mmaStore: { done: { stance: true }, history: [roundsSession(3, 120)] }, now: NOW });
  assert.equal(st.comboScores['1-2'].best, 72);
  assert.equal(Object.keys(st.secret.learned).length, 1);
  assert.equal(st.reflex.drills.puro.length, 1);
  assert.equal(st.minutes, 40);
  // salvataggi rovinati: niente crash, si riparte da vuoto
  for (const k of [COMBO_SCORES_KEY, FIGHTER_KEY, PATH_KEY, REFLEX_KEY]) storage.setItem(k, '{rotto');
  const broken = fighterState({ storage, now: NOW });
  assert.deepEqual([broken.comboScores, broken.gym, broken.today], [{}, {}, null]);
  assert.equal(pathSummary(broken).stage, 0);
  assert.doesNotThrow(() => fighterState({ storage: null }));
});

test('oggi: le scelte del giorno restano fisse; un blocco superato si spunta invece di cambiare', () => {
  const storage = memory();
  const morning = { now: NOW };
  const first = planToday(morning, { now: NOW });
  assert.equal(first.frozen, false);
  freezeToday(first.picks, storage, NOW);
  // durante il giorno: superato «Riflesso puro», 1-2 a 85, lezione «Base e guardia» fatta con la camera
  const later = { ...fighterState({ storage, now: NOW }), reflex: reflexWith(['puro'], NOW - 60000), comboScores: { '1-2': { best: 85, at: NOW - 30000 } }, sessions: [roundsSession(3, 120, NOW - 20000, 'stance')] };
  const p = planToday(later, { now: NOW });
  assert.equal(p.frozen, true);
  assert.deepEqual(p.blocks.map((b) => b.drill || b.combo || b.lesson).filter(Boolean), ['puro', 'stance', '1-2']);
  for (const id of ['reflex', 'lesson', 'combo']) assert.ok(blockDone(p.blocks.find((b) => b.id === id), later, NOW), id);
  // il giorno dopo si sceglie di nuovo: tocca a «Non abboccare» e a un'altra combo
  const next = planToday({ ...later, now: NOW + DAY }, { now: NOW + 2 * DAY });
  assert.equal(next.frozen, false);
  assert.equal(next.blocks.find((b) => b.kind === 'reflex').drill, 'nonAbboccare');
  assert.notEqual(next.blocks.find((b) => b.kind === 'combo').combo, '1-2');
  // una seconda apertura nello stesso giorno non cambia niente
  freezeToday({ ...first.picks, combo: '2-3-2' }, storage, NOW + 1000);
  assert.equal(readFighter(storage).today.picks.combo, '1-2');
});

test('salvataggi: voti rovinati o strani non bloccano né il percorso né il salvataggio a fine serie', () => {
  const storage = memory();
  storage.setItem(COMBO_SCORES_KEY, JSON.stringify({ '1-2': 7, '1-1-2': null, '2-3-2': { best: 'x' }, '1-2-3': { best: 70, at: 1 } }));
  assert.deepEqual(Object.keys(fighterState({ storage, now: NOW }).comboScores), ['1-2-3']);
  assert.equal(recordComboScore('1-2', 66, { storage, at: 3 }).best, 66);
  storage.setItem(COMBO_SCORES_KEY, '[1,2]');
  assert.doesNotThrow(() => recordComboScore('1-2', 50, { storage }));
  storage.setItem(REFLEX_KEY, JSON.stringify({ drills: { puro: {}, lati: [null, { rt: 300 }] } }));
  const st = fighterState({ storage, now: NOW });
  assert.deepEqual(st.reflex.drills, { lati: [{ rt: 300 }] });
  assert.doesNotThrow(() => planToday(st, { now: NOW }));
});

// Percorso dei segreti (lib/mmaSecretPath.js): insegna → verifica → promuovi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPECT, masterSecret, teachNextSecret } from '../lib/mmaComboJudge.js';
import { CHECK_REPS, PATH_KEY, SECRET_MOVES, checkRep, emptyPath, loadPath, rankOf, savePath, skipKeys, startSecret, unlockedMoves } from '../lib/mmaSecretPath.js';
import { COMBOS } from '../src/data/mmaCombos.js';
import { MOVES } from '../src/data/mmaMoves.js';

// ripetizione finta: il diretto visto, con o senza "l'altra mano è scesa"
const rep = (guardDown, { cross = true } = {}) => ({ moves: [
  { id: 'jab', gesture: {}, issues: [] },
  { id: 'cross', gesture: cross ? {} : null, issues: guardDown ? [{ key: 'guard', pts: 12, text: 'l’altra mano è scesa: tienila sulla guancia' }] : [] },
] });
const taught = () => startSecret(emptyPath(), masterSecret(rep(true)));

test('percorso: il segreto spiegato porta con sé l\'errore da verificare e la correzione corta', () => {
  const s = masterSecret(rep(true));
  assert.deepEqual([s.key, s.id, s.issue], ['guard', 'cross', 'guard']);
  assert.match(s.cue, /guancia/);
  assert.deepEqual(taught().pending, { key: 'guard', id: 'cross', issue: 'guard', cue: s.cue, tries: 0, ok: 0 });
});

test('percorso: 2 prove senza l\'errore → segreto applicato e imparato', () => {
  let { path, event } = checkRep(taught(), rep(false), 1000);
  assert.equal(event, null);
  ({ path, event } = checkRep(path, rep(false), 2000));
  assert.equal(event.type, 'applied');
  assert.deepEqual(path, { learned: { guard: 2000 }, pending: null });
});

test('percorso: errore ancora lì dopo 3 prove → si riprende più avanti, niente imparato', () => {
  let path = taught(), event = null;
  for (let i = 0; i < CHECK_REPS; i += 1) ({ path, event } = checkRep(path, rep(true)));
  assert.equal(event.type, 'retry');
  assert.match(event.cue, /guancia/);
  assert.deepEqual(path, { learned: {}, pending: null });
});

test('percorso: se il colpo del segreto non c\'è (o non è visto) la prova non conta', () => {
  const { path, event } = checkRep(taught(), rep(false, { cross: false }));
  assert.equal(event, null);
  assert.equal(path.pending.tries, 0);
});

test('percorso: un segreto alla volta; imparati e in prova non si rispiegano', () => {
  const p = taught();
  assert.equal(startSecret(p, { key: 'extend', id: 'jab', issue: 'extend' }), p);
  assert.deepEqual(skipKeys({ learned: { return: 1 }, pending: p.pending }), ['return', 'guard']);
  // con la guardia già imparata il maestro passa al segreto dopo
  const two = { moves: [{ id: 'jab', gesture: {}, issues: [{ key: 'return', pts: 8, text: 'richiama la mano più veloce' }] }, rep(true).moves[1]] };
  assert.equal(masterSecret(two, { skip: ['guard'] }).key, 'return');
});

test('percorso: con 2 segreti si diventa Allievo e si sblocca il gancio al fegato', () => {
  assert.equal(rankOf(emptyPath()).name, 'Prime armi');
  let path = { learned: { return: 1 }, pending: null };
  path = startSecret(path, masterSecret(rep(true)));
  let event;
  ({ path, event } = checkRep(path, rep(false)));
  ({ path, event } = checkRep(path, rep(false)));
  assert.equal(event.promoted.name, 'Allievo');
  assert.deepEqual(event.unlocked.map((m) => m.id), ['bodyHook']);
  assert.deepEqual(unlockedMoves(path).map((m) => m.id), ['bodyHook']);
  assert.equal(rankOf({ learned: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, 1])) }).name, 'Campione');
});

test('percorso: ogni mossa segreta è una mossa vera con una combo vera che la contiene', () => {
  for (const m of SECRET_MOVES) {
    assert.ok(MOVES[m.id], m.id);
    const combo = COMBOS.find((c) => c.id === m.combo);
    assert.ok(combo?.moves.includes(m.id), `${m.combo} non contiene ${m.id}`);
  }
});

test('percorso: si salvano solo i segreti imparati; un salvataggio rovinato non blocca', () => {
  assert.match(PATH_KEY, /^shadow_monarch_/, 'senza il prefisso il backup non lo copia');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  savePath({ learned: { guard: 5 }, pending: { key: 'extend' } }, storage);
  assert.deepEqual(JSON.parse(mem.get(PATH_KEY)), { learned: { guard: 5 } });
  assert.deepEqual(loadPath(storage), { learned: { guard: 5 }, pending: null });
  mem.set(PATH_KEY, '{rotto');
  assert.deepEqual(loadPath(storage), emptyPath());
  assert.deepEqual(loadPath(null), emptyPath());
});

// ripetizione pulita: ogni colpo visto, giusto e senza correzioni
const cleanRep = (ids) => ({ moves: ids.map((id) => ({ id, status: 'ok', gesture: { id }, issues: [], expected: EXPECT[id] })) });

test('percorso: ripetizione pulita → il maestro insegna un segreto nuovo che la camera sa verificare', () => {
  const s = teachNextSecret(cleanRep(['jab', 'cross']));
  assert.deepEqual([s.key, s.id, s.issue, s.fresh], ['extend', 'jab', 'extend', true]);
  assert.equal(teachNextSecret(cleanRep(['jab', 'lowKick'])).key, 'level:lowKick'); // prima l'altezza
  assert.equal(teachNextSecret(cleanRep(['jab']), { skip: ['extend', 'return', 'guard'] }), null);
  // con un errore no: lì parla il segreto dell'errore
  const withError = cleanRep(['jab', 'cross']);
  withError.moves[1] = { ...withError.moves[1], status: 'partial', issues: [{ key: 'guard', pts: 12, text: 'x' }] };
  assert.equal(teachNextSecret(withError), null);
  // mai rotazione o gomito: la camera non li misura, sarebbero "imparati" senza prova
  for (const id of ['hook', 'rearHook', 'cross']) assert.ok(!['rotate', 'elbow'].includes(teachNextSecret(cleanRep([id]))?.key));
});

test('percorso: chi lavora sempre pulito arriva lo stesso a Campione (10 segreti)', () => {
  let path = emptyPath();
  for (let lap = 0; lap < 20 && rankOf(path).learned < 10; lap += 1) {
    for (const c of COMBOS) {
      const res = cleanRep(c.moves);
      const check = checkRep(path, res);
      const skip = skipKeys(check.path);
      const secret = check.path.pending ? null : masterSecret(res, { skip }) || (check.event ? null : teachNextSecret(res, { skip }));
      path = startSecret(check.path, secret);
    }
  }
  assert.ok(rankOf(path).learned >= 10, `segreti imparati ${rankOf(path).learned}`);
  assert.equal(rankOf(path).name, 'Campione');
});

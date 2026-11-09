import test from 'node:test';
import assert from 'node:assert/strict';
import { restAdvice, restSpeech } from '../lib/mmaComboJudge.js';

const issue = (key, text, measure) => ({ key, text, measure });
const rep = (...issues) => ({ moves: [{ issues }] });
const rot = issue('rotate', 'ruota di più anca e spalla', 'rotazione circa 6 gradi, obiettivo almeno 12');
const guard = issue('guard', 'l’altra mano è scesa: tienila sulla guancia', 'in guardia il 50% del colpo, obiettivo 70%');

test('riposo: sceglie l’errore più frequente, con numero, perché ed esercizio', () => {
  const { focus, check } = restAdvice([rep(rot), rep(rot, guard), rep(guard, guard), rep(rot), rep()]);
  assert.equal(focus.key, 'rotate');
  assert.equal(focus.n, 3); // una ripetizione con due errori uguali conta una volta
  assert.equal(focus.total, 5);
  assert.match(focus.measure, /gradi/);
  assert.ok(focus.why && focus.drill);
  assert.equal(check, null);
});

test('riposo: controlla l’obiettivo della serie prima', () => {
  const prev = restAdvice([rep(rot), rep(rot), rep()]).focus; // 2 su 3
  const better = restAdvice([rep(rot), rep(), rep(), rep()], prev).check; // 1 su 4
  assert.equal(better.trend, 1);
  assert.equal(restAdvice([rep(rot), rep(rot), rep(rot)], prev).check.trend, -1);
  assert.match(restSpeech(restAdvice([rep(guard)], prev)), /migliorato.*Nel riposo.*pensa solo a questo/);
});

test('riposo: serie pulita, nessun focus', () => {
  assert.deepEqual(restAdvice([rep(), rep()]), { focus: null, check: null });
  assert.equal(restSpeech(restAdvice([])), '');
});

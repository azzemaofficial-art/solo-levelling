import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKER_RE, canonicalMarker, normalizeCoachingText, extractCommand } from '../lib/coachingText.js';

test('canonicalMarker normalizza i marker tronchi', () => {
  assert.equal(canonicalMarker('COMANDO'), 'COMANDO');
  assert.equal(canonicalMarker('ANDO'), 'COMANDO');    // troncato
  assert.equal(canonicalMarker('MANDO'), 'COMANDO');   // troncato
  assert.equal(canonicalMarker('OMANDO'), 'COMANDO');  // troncato
  assert.equal(canonicalMarker('VISTO'), 'VISTO');
  assert.equal(canonicalMarker('perche'), 'PERCHÉ');
  assert.equal(canonicalMarker(null), '');
});

test('MARKER_RE aggancia i marker a inizio riga', () => {
  assert.ok(MARKER_RE.test('COMANDO: Flessa il ginocchio'));
  assert.ok(MARKER_RE.test('ANDO: Flessa immediatamente'));
  assert.ok(MARKER_RE.test('BENE: Guardia alta'));
  assert.ok(!MARKER_RE.test('Flessa il ginocchio'));
});

test('normalizeCoachingText deduplica parole consecutive', () => {
  assert.equal(normalizeCoachingText('piede piede destro'), 'piede destro');
  assert.equal(normalizeCoachingText('porta   porta   il peso'), 'porta il peso');
  assert.equal(normalizeCoachingText('  spazi   multipli  '), 'spazi multipli');
  assert.equal(normalizeCoachingText(''), '');
  // non tocca ripetizioni legittime separate da altro testo
  assert.equal(normalizeCoachingText('piede destro e piede sinistro'), 'piede destro e piede sinistro');
});

test('extractCommand trova il comando anche con marker troncato', () => {
  const full = 'COMANDO: Alza il gomito\nBENE: Guardia solida';
  assert.equal(extractCommand(full), 'Alza il gomito');
  const truncated = 'ANDO: Flessa immediatamente gomiti e ginocchia\nPERCHÉ: iperestensione';
  assert.equal(extractCommand(truncated), 'Flessa immediatamente gomiti e ginocchia');
  assert.equal(extractCommand('nessun marker qui'), null);
  assert.equal(extractCommand(''), null);
});

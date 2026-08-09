import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREATHING_PROTOCOLS, BREATHING_IDS, getBreathingProtocol,
  cycleSeconds, protocolTotalSeconds, breathingOptions,
} from '../lib/breathingProtocols.js';

const VALID_PHASES = new Set(['inhale', 'hold', 'exhale', 'holdEmpty']);

test('tutti i protocolli hanno fasi valide e cue', () => {
  assert.ok(BREATHING_IDS.length >= 5, `protocolli: ${BREATHING_IDS.length}`);
  for (const p of Object.values(BREATHING_PROTOCOLS)) {
    assert.ok(p.name && p.emoji && p.benefit && p.when, `${p.id}: campi base`);
    assert.ok(Array.isArray(p.phases) && p.phases.length >= 2, `${p.id}: fasi >= 2`);
    assert.ok(p.rounds >= 1, `${p.id}: rounds`);
    for (const f of p.phases) {
      assert.ok(VALID_PHASES.has(f.type), `${p.id}: fase ${f.type} non valida`);
      assert.ok(f.seconds >= 1 && f.seconds <= 10, `${p.id}: durata fase ${f.seconds}`);
      assert.ok(f.cue, `${p.id}: cue per ${f.type}`);
    }
    // almeno un'inspirazione e un'espirazione
    assert.ok(p.phases.some((f) => f.type === 'inhale'), `${p.id}: manca inhale`);
    assert.ok(p.phases.some((f) => f.type === 'exhale'), `${p.id}: manca exhale`);
  }
});

test('getBreathingProtocol risolve e gestisce gli errori', () => {
  assert.equal(getBreathingProtocol('box')?.name, 'Box Breathing');
  assert.equal(getBreathingProtocol('BOX')?.id, 'box');
  assert.equal(getBreathingProtocol('inesistente'), null);
  assert.equal(getBreathingProtocol(null), null);
});

test('cycleSeconds e protocolTotalSeconds coerenti', () => {
  assert.equal(cycleSeconds('box'), 16);        // 4+4+4+4
  assert.equal(cycleSeconds('478'), 19);        // 4+7+8
  assert.equal(protocolTotalSeconds('box'), 16 * BREATHING_PROTOCOLS.box.rounds);
  assert.equal(protocolTotalSeconds('nope'), 0);
});

test('breathingOptions per la UI', () => {
  const opts = breathingOptions();
  assert.equal(opts.length, BREATHING_IDS.length);
  for (const o of opts) assert.ok(o.id && o.name && o.emoji && o.when);
});

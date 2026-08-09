import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREATHING_PROTOCOLS, BREATHING_IDS, getBreathingProtocol,
  cycleSeconds, protocolTotalSeconds, breathingOptions,
} from '../lib/breathingProtocols.js';

test('tutti i protocolli hanno la struttura della BreathingGuide', () => {
  assert.ok(BREATHING_IDS.length >= 6, `protocolli: ${BREATHING_IDS.length}`);
  for (const p of BREATHING_PROTOCOLS) {
    assert.ok(p.id && p.name && p.subtitle && p.when && p.cue, `${p.id}: campi base`);
    assert.ok(Array.isArray(p.phases) && p.phases.length >= 2, `${p.id}: fasi >= 2`);
    assert.ok(p.rounds >= 1, `${p.id}: rounds`);
    for (const f of p.phases) {
      assert.ok(f.label, `${p.id}: label fase`);
      assert.ok(typeof f.sec === 'number' && f.sec >= 0 && f.sec <= 60, `${p.id}: sec ${f.sec}`);
    }
    // il classificatore della guida si basa su queste parole: almeno un inspira/espira
    const labels = p.phases.map((f) => f.label.toLowerCase()).join(' ');
    assert.ok(labels.includes('inspira') || labels.includes('respira') || labels.includes('carica'), `${p.id}: manca fase di inspirazione`);
    assert.ok(labels.includes('espira') || labels.includes('sbuffo'), `${p.id}: manca fase di espirazione`);
  }
});

test('getBreathingProtocol risolve e gestisce gli errori', () => {
  assert.equal(getBreathingProtocol('box')?.name, 'Box Breathing');
  assert.equal(getBreathingProtocol('BOX')?.id, 'box');
  assert.equal(getBreathingProtocol('wimhof')?.caution ? true : false, true);
  assert.equal(getBreathingProtocol('inesistente'), null);
  assert.equal(getBreathingProtocol(null), null);
});

test('cycleSeconds e protocolTotalSeconds coerenti', () => {
  assert.equal(cycleSeconds('box'), 16);        // 4+4+4+4
  assert.equal(cycleSeconds('478'), 19);        // 4+7+8+0
  assert.equal(cycleSeconds('coherence'), 10);  // 5+5
  assert.equal(protocolTotalSeconds('box'), 16 * BREATHING_PROTOCOLS[0].rounds);
  assert.equal(protocolTotalSeconds('nope'), 0);
});

test('breathingOptions per la UI', () => {
  const opts = breathingOptions();
  assert.equal(opts.length, BREATHING_IDS.length);
  for (const o of opts) assert.ok(o.id && o.name && o.subtitle && o.when);
});

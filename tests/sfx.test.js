import test from 'node:test';
import assert from 'node:assert/strict';
import { playSfx, playMonsterGrowl, playEatCrunch, playBarRise, playEpicDing, playGong, playComboHit } from '../src/utils/sfx.js';

// In Node non c'è window/AudioContext: ogni funzione deve essere un no-op sicuro.
test('tutti i suoni sono no-op sicuri senza AudioContext (SSR)', () => {
  assert.doesNotThrow(() => playSfx('success'));
  assert.doesNotThrow(() => playSfx('eat', true, 'cyber'));
  assert.doesNotThrow(() => playSfx('super_combo'));
  assert.doesNotThrow(() => playSfx('levelup'));
  assert.doesNotThrow(() => playSfx('bar'));
  assert.doesNotThrow(() => playMonsterGrowl({ move: 'roar', intensity: 0.8 }));
  assert.doesNotThrow(() => playEatCrunch({}));
  assert.doesNotThrow(() => playBarRise({ from: 0.1, to: 0.9 }));
  assert.doesNotThrow(() => playEpicDing({}));
  assert.doesNotThrow(() => playGong({ power: 1.2 }));
  assert.doesNotThrow(() => playComboHit({ power: 0.6 }));
});

test('enabled=false non fa nulla (e non rompe)', () => {
  assert.doesNotThrow(() => playSfx('success', false));
  assert.doesNotThrow(() => playEatCrunch({ enabled: false }));
  assert.doesNotThrow(() => playGong({ enabled: false }));
});

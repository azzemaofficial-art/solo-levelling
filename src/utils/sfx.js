let audioCtx = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

const playSequence = (notes, volume = 0.035) => {
  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + 0.01;
  notes.forEach((note, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = note.type || 'triangle';
    osc.frequency.value = note.freq;

    gain.gain.setValueAtTime(0.0001, start + idx * note.step);
    gain.gain.exponentialRampToValueAtTime(volume, start + idx * note.step + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + idx * note.step + note.len);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + idx * note.step);
    osc.stop(start + idx * note.step + note.len + 0.02);
  });
};

export const playSfx = (name, enabled = true, theme = 'solo') => {
  if (!enabled) return;
  const library = {
    solo: {
      nav: { volume: 0.03, notes: [{ freq: 294, len: 0.09, step: 0.05, type: 'triangle' }, { freq: 349, len: 0.11, step: 0.05, type: 'triangle' }] },
      click: { volume: 0.02, notes: [{ freq: 220, len: 0.08, step: 0.05, type: 'square' }] },
      success: { volume: 0.042, notes: [{ freq: 392, len: 0.12, step: 0.08, type: 'triangle' }, { freq: 523, len: 0.13, step: 0.08, type: 'triangle' }, { freq: 659, len: 0.16, step: 0.08, type: 'triangle' }] },
      warning: { volume: 0.026, notes: [{ freq: 196, len: 0.09, step: 0.07, type: 'sawtooth' }, { freq: 185, len: 0.12, step: 0.07, type: 'sawtooth' }] },
      countdown: { volume: 0.024, notes: [{ freq: 587, len: 0.05, step: 0.04, type: 'square' }, { freq: 523, len: 0.05, step: 0.04, type: 'square' }] },
      streak: { volume: 0.05, notes: [{ freq: 392, len: 0.09, step: 0.06, type: 'triangle' }, { freq: 523, len: 0.11, step: 0.06, type: 'triangle' }, { freq: 659, len: 0.12, step: 0.06, type: 'triangle' }, { freq: 784, len: 0.18, step: 0.06, type: 'triangle' }] },
      crown_anthem: { volume: 0.052, notes: [{ freq: 392, len: 0.07, step: 0.045, type: 'triangle' }, { freq: 523, len: 0.08, step: 0.045, type: 'triangle' }, { freq: 659, len: 0.09, step: 0.045, type: 'triangle' }, { freq: 784, len: 0.11, step: 0.045, type: 'triangle' }, { freq: 1046, len: 0.16, step: 0.045, type: 'triangle' }] }
    },
    cyber: {
      nav: { volume: 0.03, notes: [{ freq: 440, len: 0.08, step: 0.05, type: 'triangle' }, { freq: 523, len: 0.09, step: 0.05, type: 'triangle' }] },
      click: { volume: 0.02, notes: [{ freq: 360, len: 0.07, step: 0.05, type: 'square' }] },
      success: { volume: 0.04, notes: [{ freq: 523, len: 0.11, step: 0.08, type: 'sine' }, { freq: 659, len: 0.11, step: 0.08, type: 'sine' }, { freq: 784, len: 0.14, step: 0.08, type: 'sine' }] },
      warning: { volume: 0.025, notes: [{ freq: 392, len: 0.08, step: 0.07, type: 'sawtooth' }, { freq: 330, len: 0.1, step: 0.07, type: 'sawtooth' }] },
      countdown: { volume: 0.025, notes: [{ freq: 740, len: 0.045, step: 0.04, type: 'square' }, { freq: 660, len: 0.045, step: 0.04, type: 'square' }] },
      streak: { volume: 0.048, notes: [{ freq: 523, len: 0.08, step: 0.05, type: 'sine' }, { freq: 659, len: 0.09, step: 0.05, type: 'sine' }, { freq: 880, len: 0.12, step: 0.05, type: 'triangle' }, { freq: 1046, len: 0.18, step: 0.05, type: 'triangle' }] },
      crown_anthem: { volume: 0.05, notes: [{ freq: 523, len: 0.07, step: 0.043, type: 'sine' }, { freq: 659, len: 0.08, step: 0.043, type: 'sine' }, { freq: 784, len: 0.09, step: 0.043, type: 'triangle' }, { freq: 1046, len: 0.11, step: 0.043, type: 'triangle' }, { freq: 1318, len: 0.16, step: 0.043, type: 'triangle' }] }
    }
  };

  const selectedTheme = library[theme] ? theme : 'solo';
  const preset = library[selectedTheme][name];
  if (!preset) return;
  playSequence(preset.notes, preset.volume);
};

export const playMonsterGrowl = ({ move = 'roar', intensity = 0.5, enabled = true } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime + 0.01;
  const clampedIntensity = Math.min(1, Math.max(0, intensity));
  const duration = move === 'dash' ? 0.24 : move === 'guard' ? 0.34 : 0.42;
  const baseFreq = move === 'dash' ? 108 : move === 'guard' ? 82 : 94;
  const peak = 0.016 + (clampedIntensity * 0.032);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(peak, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * (move === 'dash' ? 1.9 : 0.68), now + (duration * 0.9));

  const wobble = ctx.createOscillator();
  wobble.type = 'triangle';
  wobble.frequency.setValueAtTime(13 + (clampedIntensity * 18), now);
  const wobbleGain = ctx.createGain();
  wobbleGain.gain.value = move === 'guard' ? 6 : 12;
  wobble.connect(wobbleGain);
  wobbleGain.connect(osc.frequency);

  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.setValueAtTime(460 + (clampedIntensity * 260), now);
  bodyFilter.Q.value = 3.8;

  osc.connect(bodyFilter);
  bodyFilter.connect(master);

  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = (Math.random() * 2 - 1) * 0.7;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = move === 'guard' ? 130 : 210;
  noiseFilter.Q.value = 0.85;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.006 + (clampedIntensity * 0.02), now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  osc.start(now);
  wobble.start(now);
  noise.start(now);

  osc.stop(now + duration + 0.02);
  wobble.stop(now + duration + 0.02);
  noise.stop(now + duration + 0.02);
};

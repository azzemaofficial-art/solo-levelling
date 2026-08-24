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
      crown_anthem: { volume: 0.052, notes: [{ freq: 392, len: 0.07, step: 0.045, type: 'triangle' }, { freq: 523, len: 0.08, step: 0.045, type: 'triangle' }, { freq: 659, len: 0.09, step: 0.045, type: 'triangle' }, { freq: 784, len: 0.11, step: 0.045, type: 'triangle' }, { freq: 1046, len: 0.16, step: 0.045, type: 'triangle' }] },
      eat: { volume: 0.038, notes: [{ freq: 330, len: 0.07, step: 0.09, type: 'triangle' }, { freq: 262, len: 0.09, step: 0.09, type: 'triangle' }] },
      combo: { volume: 0.046, notes: [{ freq: 587, len: 0.06, step: 0.05, type: 'square' }, { freq: 740, len: 0.07, step: 0.05, type: 'square' }, { freq: 880, len: 0.09, step: 0.05, type: 'square' }] },
      super_combo: { volume: 0.056, notes: [{ freq: 523, len: 0.06, step: 0.04, type: 'triangle' }, { freq: 659, len: 0.06, step: 0.04, type: 'triangle' }, { freq: 784, len: 0.07, step: 0.04, type: 'triangle' }, { freq: 1046, len: 0.09, step: 0.04, type: 'triangle' }, { freq: 1318, len: 0.16, step: 0.04, type: 'triangle' }] },
      levelup: { volume: 0.055, notes: [{ freq: 659, len: 0.08, step: 0.06, type: 'triangle' }, { freq: 880, len: 0.09, step: 0.06, type: 'triangle' }, { freq: 1318, len: 0.2, step: 0.06, type: 'sine' }] },
      bar: { volume: 0.03, notes: [{ freq: 440, len: 0.06, step: 0.05, type: 'sine' }, { freq: 554, len: 0.08, step: 0.05, type: 'sine' }] }
    },
    cyber: {
      nav: { volume: 0.03, notes: [{ freq: 440, len: 0.08, step: 0.05, type: 'triangle' }, { freq: 523, len: 0.09, step: 0.05, type: 'triangle' }] },
      click: { volume: 0.02, notes: [{ freq: 360, len: 0.07, step: 0.05, type: 'square' }] },
      success: { volume: 0.04, notes: [{ freq: 523, len: 0.11, step: 0.08, type: 'sine' }, { freq: 659, len: 0.11, step: 0.08, type: 'sine' }, { freq: 784, len: 0.14, step: 0.08, type: 'sine' }] },
      warning: { volume: 0.025, notes: [{ freq: 392, len: 0.08, step: 0.07, type: 'sawtooth' }, { freq: 330, len: 0.1, step: 0.07, type: 'sawtooth' }] },
      countdown: { volume: 0.025, notes: [{ freq: 740, len: 0.045, step: 0.04, type: 'square' }, { freq: 660, len: 0.045, step: 0.04, type: 'square' }] },
      streak: { volume: 0.048, notes: [{ freq: 523, len: 0.08, step: 0.05, type: 'sine' }, { freq: 659, len: 0.09, step: 0.05, type: 'sine' }, { freq: 880, len: 0.12, step: 0.05, type: 'triangle' }, { freq: 1046, len: 0.18, step: 0.05, type: 'triangle' }] },
      crown_anthem: { volume: 0.05, notes: [{ freq: 523, len: 0.07, step: 0.043, type: 'sine' }, { freq: 659, len: 0.08, step: 0.043, type: 'sine' }, { freq: 784, len: 0.09, step: 0.043, type: 'triangle' }, { freq: 1046, len: 0.11, step: 0.043, type: 'triangle' }, { freq: 1318, len: 0.16, step: 0.043, type: 'triangle' }] },
      eat: { volume: 0.038, notes: [{ freq: 392, len: 0.07, step: 0.09, type: 'sine' }, { freq: 311, len: 0.09, step: 0.09, type: 'sine' }] },
      combo: { volume: 0.046, notes: [{ freq: 740, len: 0.06, step: 0.05, type: 'square' }, { freq: 880, len: 0.07, step: 0.05, type: 'square' }, { freq: 1046, len: 0.09, step: 0.05, type: 'square' }] },
      super_combo: { volume: 0.056, notes: [{ freq: 659, len: 0.06, step: 0.04, type: 'sine' }, { freq: 784, len: 0.06, step: 0.04, type: 'sine' }, { freq: 988, len: 0.07, step: 0.04, type: 'sine' }, { freq: 1318, len: 0.09, step: 0.04, type: 'triangle' }, { freq: 1760, len: 0.16, step: 0.04, type: 'triangle' }] },
      levelup: { volume: 0.055, notes: [{ freq: 784, len: 0.08, step: 0.06, type: 'sine' }, { freq: 1046, len: 0.09, step: 0.06, type: 'sine' }, { freq: 1568, len: 0.2, step: 0.06, type: 'sine' }] },
      bar: { volume: 0.03, notes: [{ freq: 523, len: 0.06, step: 0.05, type: 'sine' }, { freq: 659, len: 0.08, step: 0.05, type: 'sine' }] }
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

// ── SUONI EPICI — sintesi ricca, stile Solo Leveling/cinema ─────────────────
// Buffer di rumore bianco condiviso (creato pigramente).
let noiseCache = null;
const getNoise = (ctx) => {
  if (!noiseCache || noiseCache.sampleRate !== ctx.sampleRate) {
    noiseCache = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = noiseCache.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return noiseCache;
};

// Morso/crunch del cibo: due scoppi di rumore filtrato + piccolo thump.
export const playEatCrunch = ({ enabled = true } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const burst = (t, freq, gainPeak) => {
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainPeak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(t, Math.random() * 0.5, 0.1);
  };
  burst(now, 1900, 0.075);
  burst(now + 0.09, 1400, 0.06);
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(190, now);
  thump.frequency.exponentialRampToValueAtTime(120, now + 0.08);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, now);
  tg.gain.exponentialRampToValueAtTime(0.04, now + 0.012);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  thump.connect(tg); tg.connect(ctx.destination);
  thump.start(now); thump.stop(now + 0.12);
};

// Barra che sale: glissato ascendente la cui altezza segue il progresso (0..1).
export const playBarRise = ({ enabled = true, from = 0.2, to = 0.8 } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const f0 = 320 + clamp(from) * 500;
  const f1 = 320 + clamp(to) * 900;
  const dur = 0.34;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f0, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f0 + 1, f1), now + dur);
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(f0 * 2, now);
  shimmer.frequency.exponentialRampToValueAtTime(Math.max(f0 * 2 + 1, f1 * 2), now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.045, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  const g2 = ctx.createGain();
  g2.gain.value = 0.4;
  osc.connect(g);
  shimmer.connect(g2); g2.connect(g);
  g.connect(ctx.destination);
  osc.start(now); shimmer.start(now);
  osc.stop(now + dur + 0.02); shimmer.stop(now + dur + 0.02);
};

// Ding epico (level-up / sblocco): campana con armonici + scintillio finale.
export const playEpicDing = ({ enabled = true } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const bell = (freq, peak, decay, delay = 0) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + delay);
    g.gain.exponentialRampToValueAtTime(peak, now + delay + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
    o.connect(g); g.connect(ctx.destination);
    o.start(now + delay); o.stop(now + delay + decay + 0.02);
  };
  // Campana: fondamentale + parziali inarmonici
  bell(1046, 0.07, 1.1);
  bell(1046 * 2.01, 0.03, 0.8);
  bell(1046 * 2.98, 0.016, 0.5);
  // Scintillio ascendente prima della campana
  bell(1568, 0.02, 0.09, -0.001);
  bell(2093, 0.02, 0.12, 0.05);
};

// Gong profondo da SUPER combo: battimento lento + lavaggio di rumore grave.
export const playGong = ({ enabled = true, power = 1 } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const p = Math.min(1.5, Math.max(0.4, power));
  const dur = 1.6;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.09 * p, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  master.connect(ctx.destination);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 96;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 96 * 1.012; // battimento
  const o3 = ctx.createOscillator();
  o3.type = 'triangle';
  o3.frequency.value = 192 * 1.005;
  const g3 = ctx.createGain();
  g3.gain.value = 0.35;
  o1.connect(master); o2.connect(master);
  o3.connect(g3); g3.connect(master);
  const noise = ctx.createBufferSource();
  noise.buffer = getNoise(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.03 * p, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  noise.connect(lp); lp.connect(ng); ng.connect(master);
  [o1, o2, o3].forEach((o) => { o.start(now); o.stop(now + dur + 0.02); });
  noise.start(now, Math.random() * 0.4, 0.6);
};

// Colpo combo: thump discendente + click d'impatto. power scala l'intensità.
export const playComboHit = ({ enabled = true, power = 1 } = {}) => {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const p = Math.min(1.5, Math.max(0.4, power));
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(230, now);
  thump.frequency.exponentialRampToValueAtTime(65, now + 0.1);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, now);
  tg.gain.exponentialRampToValueAtTime(0.085 * p, now + 0.008);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  thump.connect(tg); tg.connect(ctx.destination);
  thump.start(now); thump.stop(now + 0.15);
  const click = ctx.createBufferSource();
  click.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2400;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.05 * p, now);
  cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  click.connect(hp); hp.connect(cg); cg.connect(ctx.destination);
  click.start(now, Math.random() * 0.5, 0.05);
};

// ── CAMPIONI REALI — public/sounds/*.mp3 (Mixkit, licenza libera) ───────────
// Primo avvio: fetch+decode asincrono e fallback sintetico; dal secondo in poi
// il campione è in cache. Ritorna true se ha suonato il campione.
const sampleCache = new Map();
export const playSample = (name, { enabled = true, volume = 0.5, rate = 1 } = {}) => {
  if (!enabled) return false;
  const ctx = getContext();
  if (!ctx) return false;
  const url = `/sounds/${name}.mp3`;
  const cached = sampleCache.get(url);
  if (cached === 'loading') return false;
  if (cached) {
    const src = ctx.createBufferSource();
    src.buffer = cached;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(ctx.destination);
    src.start(0);
    return true;
  }
  sampleCache.set(url, 'loading');
  fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? ctx.decodeAudioData(ab) : null))
    .then((buf) => {
      if (!buf) { sampleCache.delete(url); return; }
      sampleCache.set(url, buf);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g); g.connect(ctx.destination);
      src.start(0);
    })
    .catch(() => sampleCache.delete(url));
  return false;
};

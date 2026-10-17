// ─────────────────────────────────────────────────────────────────────────────
// Modellino del tipo di pugno: dalle misure del colpo (lib/mmaPunchInput.js) stima se era un
// diretto, un gancio o un montante. Addestrato sui pugni degli atleti BoxingVI (arXiv 2511.16524)
// visti come dal telefono e provato lasciando fuori un atleta alla volta
// (scripts/punch-training/README.md). JavaScript puro: ~9 000 pesi, meno di 0,1 ms per colpo.
// I pesi stanno in lib/mmaPunchWeights.js (generato da scripts/punch-training/esporta.py).
// Oggi l'app lo usa solo per dubitare dei "montanti" letti dalle regole (lib/mmaComboJudge.js):
// come tipo di pugno da solo non batte ancora "jab o diretto" su tutti gli atleti (vedi README).
// ─────────────────────────────────────────────────────────────────────────────

import { PUNCH_WEIGHTS } from './mmaPunchWeights.js';
import { INPUT_SIZE } from './mmaPunchInput.js';

export const KINDS = ['straight', 'hook', 'uppercut'];

// Rete piccola: ingresso standardizzato → strati nascosti (tanh) → uscita lineare
function forward(net, x) {
  if (!net || !Array.isArray(x) || x.length !== INPUT_SIZE) return null;
  let h = x.map((v, i) => (v - net.mu[i]) / (net.sd[i] || 1));
  net.layers.forEach((L, li) => {
    const out = new Array(L.b.length);
    for (let o = 0; o < L.b.length; o += 1) {
      let s = L.b[o];
      const row = o * h.length;
      for (let i = 0; i < h.length; i += 1) s += L.W[row + i] * h[i];
      out[o] = li < net.layers.length - 1 ? Math.tanh(s) : s;
    }
    h = out;
  });
  return h;
}

const softmax = (z) => { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };

// Probabilità dei tre tipi: { straight, hook, uppercut } (null se il colpo non ha misure)
export function kindProbs(input, net = PUNCH_WEIGHTS?.kind) {
  const z = forward(net, input);
  if (!z || !z.every(Number.isFinite)) return null;
  const p = softmax(z);
  return Object.fromEntries(KINDS.map((k, i) => [k, p[i]]));
}

export const hasPunchModel = () => Boolean(PUNCH_WEIGHTS?.kind);

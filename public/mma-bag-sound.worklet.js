// Microfono del sacco (src/utils/bagMic.js): passa i campioni all'app a blocchi da 2048 (~43 ms) con
// l'ora del primo campione sull'orologio dell'audio. Nessun calcolo qui: il rilevatore è in
// lib/mmaBagSound.js (testato). L'audio resta sul telefono: non si salva né si invia.
class MmaBagSound extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
    this.t0 = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    if (this.n + ch.length > this.buf.length) this.flush();
    if (this.n === 0) this.t0 = currentTime;
    this.buf.set(ch, this.n);
    this.n += ch.length;
    if (this.n === this.buf.length) this.flush();
    return true;
  }

  flush() {
    if (!this.n) return;
    const data = this.buf.slice(0, this.n);
    this.port.postMessage({ t: this.t0, data }, [data.buffer]);
    this.n = 0;
  }
}

registerProcessor('mma-bag-sound', MmaBagSound);

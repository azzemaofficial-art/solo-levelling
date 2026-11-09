import { createSoundFeatures, createSoundHits } from '../../lib/mmaBagSound';

// Microfono per i colpi al sacco (solo in modalità sacco). Privacy: l'audio resta sul telefono, i
// campioni passano dal rilevatore (lib/mmaBagSound.js) e si buttano; non si registra né si invia
// niente, escono solo i tempi dei colpi.
// Va chiamato DENTRO il tocco dell'utente: iOS Safari fa partire l'AudioContext solo lì.
// Senza AudioWorklet, senza microfono o col permesso negato: status 'none'/'denied', nessun errore,
// e il coach conta i colpi con la sola camera come prima.
export function openBagMic() {
  const A = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!A || !navigator.mediaDevices?.getUserMedia) return null;
  let ctx;
  try { ctx = new A(); ctx.resume?.().catch(() => {}); } catch { return null; }
  const det = createSoundHits();
  let stream = null, src = null, node = null, closed = false;
  const mic = { det, status: 'asking', stop };
  function stop() {
    closed = true;
    if (mic.status === 'on' || mic.status === 'asking') mic.status = 'off';
    try { if (node) node.port.onmessage = null; node?.disconnect(); src?.disconnect(); } catch { /* già staccati */ }
    stream?.getTracks().forEach((t) => t.stop());
    ctx.close?.().catch(() => {});
  }
  (async () => {
    try {
      if (!ctx.audioWorklet) throw Object.assign(new Error('no worklet'), { name: 'NotSupportedError' });
      // niente filtri del telefono: cancellazione dell'eco e riduzione del rumore smussano proprio lo schiocco
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
      await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}mma-bag-sound.worklet.js`);
      if (closed) return;
      src = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, 'mma-bag-sound');
      const feat = createSoundFeatures(ctx.sampleRate), lags = [];
      node.port.onmessage = ({ data }) => {
        // orologio dell'audio → performance.now() (quello dei fotogrammi): il ritardo di consegna più
        // piccolo degli ultimi ~3 s è il più vicino al vero, e segue la deriva tra i due orologi
        const end = (data.t + data.data.length / ctx.sampleRate) * 1000;
        lags.push(performance.now() - end);
        if (lags.length > 64) lags.shift();
        const t0 = data.t * 1000 + Math.min(...lags);
        // la voce del coach esce dal telefono a pochi cm dal microfono: mentre parla non si ascolta
        const speaking = Boolean(window.speechSynthesis?.speaking);
        for (const f of feat(data.data, t0)) det.push(f.e, f.t, { speaking });
      };
      src.connect(node);
      node.connect(ctx.destination); // l'uscita è silenzio: serve solo perché il nodo giri su ogni browser
      // iOS sospende l'audio (chiamata, altra app): si riprende appena si può
      ctx.onstatechange = () => { if (!closed && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
      mic.status = 'on';
    } catch (e) {
      stop();
      mic.status = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'none';
    }
  })();
  return mic;
}

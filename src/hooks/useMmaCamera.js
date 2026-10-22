import { useCallback, useEffect, useRef, useState } from 'react';
import { createFrameSync, createPoseView, SYNC, toImagePoint as mapToImage } from '../../lib/poseView.js';
const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[15,19],[16,20]];
// lato sinistro del corpo turchese, destro viola: capisci subito quale braccio ha visto
const LITE_ONLY = 'shadow_monarch_pose_lite_only'; // questo telefono non regge il modello full
export const TAP_TO_PLAY = 'Tocca il video per avviare la fotocamera.';
// lato lungo dell'immagine passata al modello: MediaPipe la riduce comunque a 256 px intorno al
// corpo, quindi 640 non perde dettaglio e costa meno della piena risoluzione da copiare e caricare
const ANALYSIS_SIDE = 640;
// se copiare un fotogramma costa più di così (ms, in media) il telefono fatica: si torna al video in diretta
const HEAVY_COPY_MS = 8;
const LEFT = [11,13,15,19,23,25,27,31], RIGHT = [12,14,16,20,24,26,28,32];
const sideColor = (a, b) => (LEFT.includes(a) && LEFT.includes(b) ? '109,226,211' : RIGHT.includes(a) && RIGHT.includes(b) ? '184,164,255' : '224,240,255');
function drawSkeleton(ctx, points, W, H) {
  if (!points?.length) return;
  const lw = Math.max(3, W / 160);
  ctx.lineCap = 'round';
  // visibilità già sfumata (lib/poseView.js): le linee svaniscono piano invece di lampeggiare.
  // Il bagliore è una seconda linea larga e trasparente: shadowBlur a 60 Hz rallenta l'iPhone.
  for (const glow of [true, false]) {
    for (const [a,b] of CONNECTIONS) {
      const A = points[a], B = points[b];
      if (!A || !B) continue;
      const vis = Math.min(A.visibility ?? 1, B.visibility ?? 1);
      const k = Math.min(1, Math.max(0, (vis - .3) / .35));
      if (k <= 0) continue;
      // punto stimato ma coperto (tre quarti) → tratteggiato e più tenue
      const hidden = vis < .55;
      if (glow && hidden) continue;
      ctx.setLineDash(!glow && hidden ? [lw * 1.5, lw * 1.5] : []);
      ctx.strokeStyle = `rgba(${sideColor(a, b)},${(glow ? .22 : hidden ? .45 : .9) * k})`;
      ctx.lineWidth = glow ? lw * 2.6 : lw;
      ctx.beginPath(); ctx.moveTo(A.x * W, A.y * H); ctx.lineTo(B.x * W, B.y * H); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  for (const i of [0,11,12,13,14,15,16,23,24,25,26,27,28]) {
    const p = points[i]; if (!p) continue;
    const k = Math.min(1, Math.max(0, ((p.visibility ?? 1) - .3) / .35)); if (k <= 0) continue;
    const r = i === 0 ? lw * 2.4 : i === 15 || i === 16 ? lw * 1.9 : lw * 1.1;
    ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r, 0, Math.PI*2);
    ctx.fillStyle = i === 15 || i === 16 ? '#ffcf99' : i === 0 ? 'rgba(224,240,255,.35)' : '#e0fff7'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// camera frontale specchiata via CSS (transform: scaleX(-1)) dai componenti
const mirroredOf = (el) => { try { const tr = getComputedStyle(el).transform; return Boolean(tr && tr !== 'none' && new DOMMatrixReadOnly(tr).a < 0); } catch { return false; } };
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// minInterval: ms minimi tra due fotogrammi analizzati (80 = ~12 fps per le lezioni;
// le combo chiedono 33 = fino a ~30 fps, perché un jab dura 150–200 ms).
// canSwap(): true quando si può passare al modello preciso (niente round/ripetizione in corso).
// overlay(ctx, W, H, points, now, info): disegno extra sopra lo scheletro, a ogni ridisegno, nelle
// stesse coordinate (punti 0–1 × W/H). info = { mirrored, frameTime, synced }.
// onFrame(points, time, aspect, world, extra): extra = { roiThumb } se c'è una zona (setRoi).
//
// Video e scheletro sincronizzati (17/10/2026): sul canvas si dipinge il fotogramma che il modello
// ha già letto, col SUO scheletro (lib/poseView.js → createFrameSync), ~50–70 ms dopo la diretta.
// Il <video> resta sotto, in play: quando il modello è lento o cambia modello si torna a lui.
export default function useMmaCamera(onFrame, { minInterval = 80, canSwap, overlay } = {}) {
  const videoRef = useRef(null), canvasRef = useRef(null), onFrameRef = useRef(onFrame), canSwapRef = useRef(canSwap), overlayRef = useRef(overlay);
  onFrameRef.current = onFrame; canSwapRef.current = canSwap; overlayRef.current = overlay;
  const runtime = useRef({ generation: 0 }), roiRef = useRef(null), statsRef = useRef({});
  const [status, setStatus] = useState('idle'), [error, setError] = useState(''), [profile, setProfile] = useState(null);
  const release = useCallback(() => {
    const r = runtime.current; r.generation++;
    cancelAnimationFrame(r.raf); clearTimeout(r.timeout);
    try { if (r.vfc != null) r.vfcVideo?.cancelVideoFrameCallback?.(r.vfc); } catch { /* già fermo */ }
    r.worker?.terminate(); r.stream?.getTracks().forEach(t => t.stop());
    // tele a misura zero: Safari libera subito la memoria (altrimenti la tiene fino al garbage collector)
    r.ring?.forEach((s) => { s.canvas.width = 0; s.canvas.height = 0; });
    r.worker = null; r.stream = null; r.ring = null; r.vfc = null; r.vfcVideo = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setStatus('idle'); }, [release]);
  useEffect(() => release, [release]);
  const start = useCallback(async (facing = 'user') => {
    release(); setError(''); setStatus('permission');
    const r = runtime.current, generation = r.generation;
    const current = () => runtime.current.generation === generation;
    const fail = message => { if (!current()) return; release(); setError(message); setStatus('error'); };
    if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) {
      fail('Questo browser non supporta il Coach con camera. Puoi usare la guida a round.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
      if (!current()) { stream.getTracks().forEach(t => t.stop()); return; }
      r.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => fail('La fotocamera si è disconnessa. Riaprila per continuare.'));
      setStatus('loading');
      const worker = new Worker(new URL('../workers/mmaPose.worker.js', import.meta.url));
      r.worker = worker;
      r.timeout = setTimeout(() => fail('Il modello non si è caricato. Controlla la connessione o continua con la guida a round.'), 35000);
      let busy = false, busySince = 0, lastSentT = -Infinity, upgradeReady = false, swapping = false;
      const view = createPoseView(), sync = createFrameSync();
      // nastro degli ultimi fotogrammi della camera (copie a piena risoluzione), per mostrarli in ritardo
      const ring = r.ring = [];
      let ringW = 0, ringH = 0, head = -1, latest = null, lastT = -Infinity, lastVideoTime = -1;
      let syncOn = minInterval < SYNC.maxGap, copyMs = 0, copies = 0;
      let small = null, smallCtx = null, lastVfcAt = 0, lastLoopAt = 0, polling = false, drawnT = null, overlayErr = false, mirrored = false, mirroredAt = -Infinity;
      const stats = statsRef.current = { results: 0, since: performance.now(), wait: 0, delay: 0, synced: false };
      worker.onerror = () => fail('Il riconoscimento non si è avviato. Riprova oppure usa la guida a round.');

      // tempo vero del fotogramma: quando è apparso nel video (presentationTime), regolare ogni ~33 ms.
      // Non captureTime: conterebbe anche il ritardo interno della camera, che la diretta ha uguale,
      // e il sincronizzatore lo scambierebbe per attesa del modello
      const frameTime = (now, meta) => (Number.isFinite(meta?.presentationTime) && meta.presentationTime <= now + 1 ? meta.presentationTime : now);
      // copia piccola per il modello: OffscreenCanvas → ImageBitmap senza attese; sennò la via vecchia
      const makeBitmap = (src, w, h) => {
        const k = Math.min(1, ANALYSIS_SIDE / Math.max(w, h)), sw = Math.round(w * k), sh = Math.round(h * k);
        try {
          if (typeof OffscreenCanvas === 'function') {
            if (!small || small.width !== sw || small.height !== sh) { small = new OffscreenCanvas(sw, sh); smallCtx = small.getContext('2d'); }
            smallCtx.drawImage(src, 0, 0, sw, sh);
            return small.transferToImageBitmap();
          }
        } catch { small = null; }
        return createImageBitmap(src);
      };
      // manda al modello l'ultimo fotogramma, appena è libero (non aspetta il prossimo aggiornamento dello schermo)
      const trySend = () => {
        if (!current() || busy || swapping || document.hidden || !latest || latest.sent) return;
        const now = performance.now();
        // modello preciso scaricato: cambio solo a fotogrammi fermi e in un momento tranquillo
        if (upgradeReady && canSwapRef.current?.()) { upgradeReady = false; swapping = true; busySince = now; worker.postMessage({ type: 'swap' }); return; }
        if (latest.t - lastSentT < minInterval - 4) return;
        const f = latest, src = f.src || videoRef.current;
        if (!src) return;
        f.sent = true; busy = true; busySince = now; lastSentT = f.t;
        const roi = roiRef.current;
        Promise.resolve().then(() => makeBitmap(src, ringW || src.videoWidth, ringH || src.videoHeight)).then((bitmap) => {
          if (!current()) { bitmap.close(); return; }
          worker.postMessage({ type: 'frame', bitmap, time: f.t, aspect: f.aspect, roi }, [bitmap]);
        }).catch(() => { busy = false; fail('La fotocamera non fornisce immagini leggibili. Riprova.'); });
      };
      // nuovo fotogramma della camera
      const capture = (t) => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !(t > lastT)) return;
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return;
        lastT = t;
        if (w !== ringW || h !== ringH) { ring.forEach((s) => { s.canvas.width = 0; s.canvas.height = 0; }); ring.length = 0; head = -1; ringW = w; ringH = h; sync.reset(); }
        latest = { t, aspect: w / h, sent: false, src: null };
        if (syncOn) {
          head = (head + 1) % SYNC.keep;
          let slot = ring[head];
          if (!slot) { const c = document.createElement('canvas'); c.width = w; c.height = h; slot = ring[head] = { canvas: c, ctx: c.getContext('2d', { alpha: false }), t: -1 }; }
          const t0 = performance.now();
          slot.ctx.drawImage(video, 0, 0, w, h); slot.t = t;
          copyMs += ((performance.now() - t0) - copyMs) * 0.1; copies += 1;
          if (copies > 30 && copyMs > HEAVY_COPY_MS) { syncOn = false; sync.reset(); }
          latest.src = slot.canvas;
          sync.frame(t);
        }
        trySend();
      };
      // requestVideoFrameCallback: una chiamata per ogni fotogramma nuovo, coi suoi metadati
      const watchVideo = (video) => {
        try { if (r.vfc != null) r.vfcVideo?.cancelVideoFrameCallback?.(r.vfc); } catch { /* già fermo */ }
        const cb = (now, meta) => {
          if (!current() || r.vfcVideo !== video || polling) return;
          r.vfc = video.requestVideoFrameCallback(cb); lastVfcAt = performance.now();
          // ritardo interno della camera (scatto → video), se il telefono lo dichiara: serve ai riflessi
          const lag = meta?.presentationTime - meta?.captureTime;
          if (Number.isFinite(lag) && lag > 0 && lag < 500) stats.camLag = stats.camLag == null ? lag : stats.camLag + (lag - stats.camLag) * 0.1;
          capture(frameTime(now, meta));
        };
        r.vfcVideo = video; r.vfc = video.requestVideoFrameCallback(cb); lastVfcAt = performance.now();
      };

      worker.onmessage = ({ data }) => {
        if (!current()) return;
        if (data.type === 'error') { fail(data.message); return; }
        if (data.type === 'upgradeReady') upgradeReady = true;
        // il worker torna al lite perché il full è lento: niente fotogrammi finché non ha finito
        if (data.type === 'swapping') { swapping = true; busySince = performance.now(); }
        if (data.type === 'swapped') {
          swapping = false; setProfile({ model: data.model });
          if (data.tooSlow) { try { localStorage.setItem(LITE_ONLY, '1'); } catch { /* storage */ } }
        }
        if (data.type === 'ready') { clearTimeout(r.timeout); setProfile({ model: data.model }); setStatus('ready'); loop(); }
        if (data.type === 'pose') {
          busy = false;
          const now = performance.now();
          stats.results += 1; stats.wait += ((now - data.time) - stats.wait) * 0.1;
          view.push(data.display || data.points, data.time);
          sync.result(data.time, data.display || data.points, now);
          trySend(); // il modello riparte subito sull'ultimo fotogramma, poi si giudica questo
          onFrameRef.current(data.points, data.time, data.aspect, data.world, { roiThumb: data.roiThumb });
        }
      };
      function loop() {
        if (!current()) return;
        r.raf = requestAnimationFrame(loop);
        const video = videoRef.current, canvas = canvasRef.current, now = performance.now();
        // fotogrammi nuovi: requestVideoFrameCallback col tempo vero; se manca (o smette di arrivare
        // col video in play) si torna a guardare se il video è andato avanti, come prima
        if (now - lastLoopAt > 500) lastVfcAt = now; // tornati dallo sfondo: non è un blocco
        lastLoopAt = now;
        if (video && !polling && typeof video.requestVideoFrameCallback === 'function' && r.vfcVideo !== video) watchVideo(video);
        if (!polling && video && (!r.vfcVideo || (!video.paused && now - lastVfcAt > 1500))) polling = true;
        if (polling && video && video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; capture(now); }
        if (busy && now - busySince > 5000) { fail('Il riconoscimento non risponde. Riprova con la camera o passa alla guida.'); return; }
        if (swapping) { if (now - busySince > 30000) fail('Il riconoscimento non risponde. Riprova con la camera o passa alla guida.'); }
        else trySend();
        // lo scheletro si ridisegna a ogni aggiornamento dello schermo, non solo quando il modello risponde
        if (!canvas || !ringW) return;
        if (canvas.width !== ringW || canvas.height !== ringH) { canvas.width = ringW; canvas.height = ringH; drawnT = null; }
        const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d'), draw = overlayRef.current;
        const shown = syncOn ? sync.pick(now) : null;
        const slot = shown && ring.find((s) => s.t === shown.t);
        let points;
        if (shown && slot) {
          // fotogramma letto + il suo scheletro: si ridipinge solo quando cambia (o se c'è un disegno extra)
          stats.synced = true;
          if (shown.t === drawnT && !draw) return;
          if (shown.t !== drawnT) stats.delay += ((latest ? latest.t - shown.t : 0) - stats.delay) * 0.1;
          drawnT = shown.t;
          ctx.drawImage(slot.canvas, 0, 0, W, H);
          points = shown.points;
        } else {
          // video in diretta sotto: canvas trasparente con lo scheletro previsto
          stats.synced = false; drawnT = null;
          ctx.clearRect(0, 0, W, H);
          points = view.frame(now);
        }
        drawSkeleton(ctx, points, W, H);
        if (draw) {
          if (now - mirroredAt > 1000) { mirrored = mirroredOf(canvas); mirroredAt = now; }
          ctx.save();
          try { draw(ctx, W, H, points || null, now, { mirrored, frameTime: shown && slot ? shown.t : null, synced: Boolean(shown && slot) }); }
          catch (e) { if (!overlayErr) { overlayErr = true; console.error('MMA overlay:', e); } }
          ctx.restore();
        }
      }
      let liteOnly = false; try { liteOnly = localStorage.getItem(LITE_ONLY) === '1'; } catch { /* storage */ }
      worker.postMessage({ type: 'init', liteOnly });
    } catch (e) {
      fail(e.name === 'NotAllowedError' ? 'Accesso alla fotocamera non consentito. Abilitalo nel browser oppure usa la guida senza camera.' : e.name === 'NotFoundError' ? 'Nessuna fotocamera disponibile. Puoi allenarti con la guida a round.' : 'Fotocamera occupata o non disponibile. Chiudi le altre app che la usano e riprova.');
    }
  }, [release, minInterval]);
  useEffect(() => {
    const video = videoRef.current, stream = runtime.current.stream;
    if (!stream || !video) return;
    // riassegnare lo stesso stream a ogni cambio di stato interrompeva il play() precedente
    // (AbortError) e lasciava un finto "tocca il video" che metteva in pausa la sessione
    if (video.srcObject !== stream) video.srcObject = stream;
    const playing = () => setError((e) => (e === TAP_TO_PLAY ? '' : e));
    video.addEventListener('playing', playing);
    if (video.paused) video.play().then(playing).catch((e) => { if (e?.name !== 'AbortError') setError(TAP_TO_PLAY); });
    return () => video.removeEventListener('playing', playing);
  }, [status]);
  // tocco sullo schermo → punto 0–1 dell'immagine (come i punti dello scheletro), con object-fit e specchio
  const toImagePoint = useCallback((clientX, clientY) => {
    const video = videoRef.current, el = canvasRef.current || video;
    if (!el || !video?.videoWidth) return null;
    return mapToImage(clientX, clientY, el.getBoundingClientRect(), video.videoWidth, video.videoHeight, getComputedStyle(el).objectFit || 'fill', mirroredOf(el));
  }, []);
  // zona dell'immagine (0–1) da seguire: il worker manda a ogni fotogramma un 32×32 in grigi (extra.roiThumb)
  const setRoi = useCallback((box) => {
    if (!box) { roiRef.current = null; return; }
    const x = clamp01(box.x), y = clamp01(box.y), w = Math.min(1 - x, clamp01(box.w)), h = Math.min(1 - y, clamp01(box.h));
    roiRef.current = w > 0 && h > 0 ? { x, y, w, h } : null;
  }, []);
  // un fotogramma intero rimpicciolito (lato lungo maxSide), in RGBA: per analizzare la scena al tocco
  const grabFrame = useCallback((maxSide = 256) => {
    const video = videoRef.current, w = video?.videoWidth, h = video?.videoHeight;
    if (!w || !h || video.readyState < 2) return null;
    const k = Math.min(1, maxSide / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    try {
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, cw, ch);
      return { width: cw, height: ch, data: ctx.getImageData(0, 0, cw, ch).data };
    } catch { return null; } finally { c.width = 0; c.height = 0; }
  }, []);
  // numeri per le prove sul telefono: risultati/s, attesa del risultato, ritardo dell'immagine
  const getStats = useCallback(() => {
    const s = statsRef.current, secs = (performance.now() - (s.since ?? 0)) / 1000;
    return { resultsPerSec: secs > 0 ? s.results / secs : 0, waitMs: Math.round(s.wait || 0), imageDelayMs: Math.round(s.delay || 0), synced: Boolean(s.synced), camLagMs: s.camLag != null ? Math.round(s.camLag) : null };
  }, []);
  return { videoRef, canvasRef, start, stop, status, error, profile, toImagePoint, setRoi, grabFrame, getStats };
}

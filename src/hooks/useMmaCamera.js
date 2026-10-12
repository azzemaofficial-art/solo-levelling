import { useCallback, useEffect, useRef, useState } from 'react';
import { createPoseView } from '../../lib/poseView.js';
const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[15,19],[16,20]];
// lato sinistro del corpo turchese, destro viola: capisci subito quale braccio ha visto
const LITE_ONLY = 'shadow_monarch_pose_lite_only'; // questo telefono non regge il modello full
export const TAP_TO_PLAY = 'Tocca il video per avviare la fotocamera.';
const LEFT = [11,13,15,19,23,25,27,31], RIGHT = [12,14,16,20,24,26,28,32];
const sideColor = (a, b) => (LEFT.includes(a) && LEFT.includes(b) ? '109,226,211' : RIGHT.includes(a) && RIGHT.includes(b) ? '184,164,255' : '224,240,255');
function drawSkeleton(ctx, points, W, H) {
  ctx.clearRect(0, 0, W, H);
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
// minInterval: ms minimi tra due fotogrammi analizzati (80 = ~12 fps per le lezioni;
// le combo chiedono 33 = fino a ~30 fps, perché un jab dura 150–200 ms).
// canSwap(): true quando si può passare al modello preciso (niente round/ripetizione in corso).
export default function useMmaCamera(onFrame, { minInterval = 80, canSwap } = {}) {
  const videoRef = useRef(null), canvasRef = useRef(null), onFrameRef = useRef(onFrame), canSwapRef = useRef(canSwap);
  onFrameRef.current = onFrame; canSwapRef.current = canSwap;
  const runtime = useRef({ generation: 0 });
  const [status, setStatus] = useState('idle'), [error, setError] = useState(''), [profile, setProfile] = useState(null);
  const release = useCallback(() => {
    const r = runtime.current; r.generation++;
    cancelAnimationFrame(r.raf); clearTimeout(r.timeout);
    r.worker?.terminate(); r.stream?.getTracks().forEach(t => t.stop());
    r.worker = null; r.stream = null;
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
      let busy = false, lastSent = -Infinity, lastVideoTime = -1, upgradeReady = false, swapping = false;
      const view = createPoseView();
      worker.onerror = () => fail('Il riconoscimento non si è avviato. Riprova oppure usa la guida a round.');
      worker.onmessage = ({ data }) => {
        if (!current()) return;
        if (data.type === 'error') { fail(data.message); return; }
        if (data.type === 'upgradeReady') upgradeReady = true;
        if (data.type === 'swapped') {
          swapping = false; lastSent = performance.now(); setProfile({ model: data.model });
          if (data.tooSlow) { try { localStorage.setItem(LITE_ONLY, '1'); } catch { /* storage */ } }
        }
        if (data.type === 'ready') { clearTimeout(r.timeout); setProfile({ model: data.model }); setStatus('ready'); loop(); }
        if (data.type === 'pose') {
          busy = false;
          onFrameRef.current(data.points, data.time, data.aspect, data.world);
          view.push(data.display || data.points, data.time);
        }
      };
      async function loop() {
        if (!current()) return;
        r.raf = requestAnimationFrame(loop);
        const video = videoRef.current, now = performance.now();
        // lo scheletro si ridisegna a ogni aggiornamento dello schermo, non solo quando il modello risponde
        const canvas = canvasRef.current;
        if (canvas && video?.videoWidth) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
          drawSkeleton(canvas.getContext('2d'), view.frame(now), canvas.width, canvas.height);
        }
        if (busy && now - lastSent > 5000) { fail('Il riconoscimento non risponde. Riprova con la camera o passa alla guida.'); return; }
        if (swapping) { if (now - lastSent > 30000) fail('Il riconoscimento non risponde. Riprova con la camera o passa alla guida.'); return; }
        // modello preciso scaricato: cambio solo a fotogrammi fermi e in un momento tranquillo
        if (upgradeReady && !busy && canSwapRef.current?.()) { upgradeReady = false; swapping = true; lastSent = now; worker.postMessage({ type: 'swap' }); return; }
        if (!video || video.readyState < 2 || document.hidden || busy || now - lastSent < minInterval || video.currentTime === lastVideoTime) return;
        busy = true; lastSent = now; lastVideoTime = video.currentTime;
        try {
          const bitmap = await createImageBitmap(video);
          if (!current()) { bitmap.close(); return; }
          worker.postMessage({ type: 'frame', bitmap, time: now, aspect: video.videoWidth / video.videoHeight }, [bitmap]);
        } catch { busy = false; fail('La fotocamera non fornisce immagini leggibili. Riprova.'); }
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
  return { videoRef, canvasRef, start, stop, status, error, profile };
}

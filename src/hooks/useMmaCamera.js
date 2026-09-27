import { useCallback, useEffect, useRef, useState } from 'react';
const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
export default function useMmaCamera(onFrame) {
  const videoRef = useRef(null), canvasRef = useRef(null), onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const runtime = useRef({ generation: 0 });
  const [status, setStatus] = useState('idle'), [error, setError] = useState('');
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
      if (!current()) { stream.getTracks().forEach(t => t.stop()); return; }
      r.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => fail('La fotocamera si è disconnessa. Riaprila per continuare.'));
      setStatus('loading');
      const worker = new Worker(new URL('../workers/mmaPose.worker.js', import.meta.url));
      r.worker = worker;
      r.timeout = setTimeout(() => fail('Il modello non si è caricato. Controlla la connessione o continua con la guida a round.'), 35000);
      let busy = false, lastSent = -Infinity, lastVideoTime = -1;
      worker.onerror = () => fail('Il riconoscimento non si è avviato. Riprova oppure usa la guida a round.');
      worker.onmessage = ({ data }) => {
        if (!current()) return;
        if (data.type === 'error') { fail(data.message); return; }
        if (data.type === 'ready') { clearTimeout(r.timeout); setStatus('ready'); loop(); }
        if (data.type === 'pose') {
          busy = false;
          onFrameRef.current(data.points, data.time, data.aspect);
          const canvas = canvasRef.current, video = videoRef.current;
          if (!canvas || !video) return;
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
          const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
          for (const [a,b] of CONNECTIONS) {
            const A = data.points[a], B = data.points[b];
            if (!A || !B || A.visibility < .65 || B.visibility < .65) continue;
            ctx.beginPath(); ctx.moveTo(A.x * canvas.width, A.y * canvas.height); ctx.lineTo(B.x * canvas.width, B.y * canvas.height);
            ctx.strokeStyle = '#6de2d3bb'; ctx.lineWidth = 3; ctx.stroke();
          }
          for (const i of [11,12,13,14,15,16,23,24,25,26,27,28]) {
            const p = data.points[i]; if (!p || p.visibility < .65) continue;
            ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI*2); ctx.fillStyle = i === 15 || i === 16 ? '#ffcf99' : '#e0fff7'; ctx.fill();
          }
        }
      };
      async function loop() {
        if (!current()) return;
        r.raf = requestAnimationFrame(loop);
        const video = videoRef.current, now = performance.now();
        if (busy && now - lastSent > 5000) { fail('Il riconoscimento non risponde. Riprova con la camera o passa alla guida.'); return; }
        if (!video || video.readyState < 2 || document.hidden || busy || now - lastSent < 80 || video.currentTime === lastVideoTime) return;
        busy = true; lastSent = now; lastVideoTime = video.currentTime;
        try {
          const bitmap = await createImageBitmap(video);
          if (!current()) { bitmap.close(); return; }
          worker.postMessage({ type: 'frame', bitmap, time: now, aspect: video.videoWidth / video.videoHeight }, [bitmap]);
        } catch { busy = false; fail('La fotocamera non fornisce immagini leggibili. Riprova.'); }
      }
      worker.postMessage({ type: 'init' });
    } catch (e) {
      fail(e.name === 'NotAllowedError' ? 'Accesso alla fotocamera non consentito. Abilitalo nel browser oppure usa la guida senza camera.' : e.name === 'NotFoundError' ? 'Nessuna fotocamera disponibile. Puoi allenarti con la guida a round.' : 'Fotocamera occupata o non disponibile. Chiudi le altre app che la usano e riprova.');
    }
  }, [release]);
  useEffect(() => {
    if (runtime.current.stream && videoRef.current) {
      videoRef.current.srcObject = runtime.current.stream;
      videoRef.current.play().catch(() => setError('Tocca il video per avviare la fotocamera.'));
    }
  }, [status]);
  return { videoRef, canvasRef, start, stop, status, error };
}

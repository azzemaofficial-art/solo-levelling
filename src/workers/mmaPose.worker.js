// Inference runs off the UI thread. No images are uploaded or persisted.
// Precisione: parte subito col modello "lite", scarica in sottofondo il "full" (più preciso
// su polsi e caviglie) e ci passa appena l'app lo permette (momento tranquillo, fotogrammi
// fermi). Se il telefono è troppo lento col full (> 55 ms a fotogramma) torna al lite e l'app
// se lo ricorda. Solo CPU: la GPU nei worker si blocca su alcuni browser (un blocco, non un errore:
// nessun ripiego sicuro, quindi niente GPU).
// L'immagine arriva già rimpicciolita (lato lungo 640, src/hooks/useMmaCamera.js) col tempo vero
// del fotogramma. Se l'app segue una zona (roi), si rimanda anche un 32×32 in grigi di quella zona.
// Ogni punto passa dal filtro One Euro: niente tremolio da fermo, niente ritardo nei colpi.
// Lo scheletro disegnato ha un filtro suo, più leggero (display): lo leviga il disegnatore a 60 Hz.
import { createImageFilter, createPoseFilter, DISPLAY_FILTER, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';

const VERSION = '0.10.18';
const MODELS = {
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};
let vision, files, detector, model = null, timings = [], lastTime = -1, noUpgrade = false, fullBytes = null, thumbCtx = null, loading = false;

// zona {x,y,w,h} (0–1 dell'immagine) → 32×32 in scala di grigi (Uint8Array, riga per riga)
function roiThumb(bitmap, roi) {
  if (!roi || typeof OffscreenCanvas !== 'function') return undefined;
  try {
    thumbCtx ||= new OffscreenCanvas(32, 32).getContext('2d', { willReadFrequently: true });
    const W = bitmap.width, H = bitmap.height;
    thumbCtx.drawImage(bitmap, roi.x * W, roi.y * H, Math.max(1, roi.w * W), Math.max(1, roi.h * H), 0, 0, 32, 32);
    const d = thumbCtx.getImageData(0, 0, 32, 32).data, g = new Uint8Array(1024);
    for (let i = 0; i < 1024; i += 1) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
    return g;
  } catch { return undefined; }
}
const imageFilter = createPoseFilter(IMAGE_FILTER), worldFilter = createPoseFilter(WORLD_FILTER), displayFilter = createImageFilter(DISPLAY_FILTER);

async function load(next, buffer) {
  const created = await vision.PoseLandmarker.createFromOptions(files, {
    baseOptions: { ...(buffer ? { modelAssetBuffer: buffer } : { modelAssetPath: MODELS[next] }), delegate: 'CPU' },
    runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5,
  });
  detector?.close?.();
  detector = created; model = next; timings = [];
}

async function prefetch() {
  if (noUpgrade) return;
  try {
    const res = await fetch(MODELS.full);
    if (!res.ok) return;
    fullBytes = new Uint8Array(await res.arrayBuffer());
    if (!noUpgrade) self.postMessage({ type: 'upgradeReady' });
  } catch { /* resta il lite */ }
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      noUpgrade = Boolean(data.liteOnly);
      vision = await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`);
      files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
      await load('lite');
      self.postMessage({ type: 'ready', model });
      prefetch();
    } catch (error) { console.error('MMA pose initialization:', error); self.postMessage({ type: 'error', detail: String(error?.message || error), message: 'Il riconoscimento non è disponibile. Riprova con una connessione attiva oppure usa la guida senza camera.' }); }
  }
  if (data.type === 'swap') {
    try { if (fullBytes && !noUpgrade) await load('full', fullBytes); } catch { noUpgrade = true; }
    fullBytes = null;
    self.postMessage({ type: 'swapped', model });
    return;
  }
  if (data.type === 'frame') {
    try {
      // MediaPipe vuole tempi strettamente crescenti
      const time = Math.max(data.time, lastTime + 1); lastTime = time;
      const t0 = performance.now();
      const result = detector.detectForVideo(data.bitmap, time);
      const ms = performance.now() - t0;
      const raw = result.landmarks[0] || [], rawWorld = result.worldLandmarks?.[0] || [];
      // world = coordinate 3D stimate in metri (origine tra le anche): servono al giudice delle combo
      const points = raw.length ? imageFilter.apply(raw, data.time) : (imageFilter.reset(), raw);
      const display = raw.length ? displayFilter.apply(raw, data.time, data.aspect) : (displayFilter.reset(), raw);
      const world = rawWorld.length ? worldFilter.apply(rawWorld, data.time) : (worldFilter.reset(), rawWorld);
      const thumb = roiThumb(data.bitmap, data.roi);
      // col full il telefono non sta dietro a un jab → torna al lite (e l'app lo ricorda).
      // Molto lento (> 110 ms) si vede già dopo 5 fotogrammi: prima ne servivano 20 (~20 s a 1 al secondo).
      timings.push(ms); if (timings.length > 20) timings.shift();
      const mid = [...timings].sort((a, b) => a - b)[Math.floor(timings.length / 2)];
      const tooSlow = model === 'full' && !loading && (timings.length >= 20 ? mid > 55 : timings.length >= 5 && mid > 110);
      // "swapping" PRIMA del risultato: l'app smette di mandare fotogrammi mentre si ricarica il lite.
      // Prima il fotogramma successivo passava ancora dal full, risultava lento e rilanciava il
      // caricamento (misurato con REA il 17/10: 11–13 ricariche di fila).
      if (tooSlow) { noUpgrade = true; loading = true; self.postMessage({ type: 'swapping' }); }
      self.postMessage({ type: 'pose', points, world, display, time: data.time, aspect: data.aspect, ms: Math.round(ms), roiThumb: thumb }, thumb ? [thumb.buffer] : []);
      if (tooSlow) {
        try { await load('lite'); } finally { loading = false; }
        self.postMessage({ type: 'swapped', model, tooSlow: true });
      }
    } catch { self.postMessage({ type: 'error', message: 'Il riconoscimento si è interrotto. La sessione è in pausa.' }); }
    finally { data.bitmap.close(); }
  }
};

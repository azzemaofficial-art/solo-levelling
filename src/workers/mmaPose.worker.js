// Inference runs off the UI thread. No images are uploaded or persisted.
// Precisione: parte subito col modello "lite", scarica in sottofondo il "full" (più preciso
// su polsi e caviglie) e ci passa appena l'app lo permette (momento tranquillo, fotogrammi
// fermi). Se il telefono è troppo lento col full (> 55 ms a fotogramma) torna al lite e l'app
// se lo ricorda. Solo CPU: la GPU nei worker si blocca su alcuni browser.
// Ogni punto passa dal filtro One Euro: niente tremolio da fermo, niente ritardo nei colpi.
import { createPoseFilter, IMAGE_FILTER, WORLD_FILTER } from '../../lib/poseFilter.js';

const VERSION = '0.10.18';
const MODELS = {
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};
let vision, files, detector, model = null, timings = [], lastTime = -1, noUpgrade = false, fullBytes = null;
const imageFilter = createPoseFilter(IMAGE_FILTER), worldFilter = createPoseFilter(WORLD_FILTER);

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
      const world = rawWorld.length ? worldFilter.apply(rawWorld, data.time) : (worldFilter.reset(), rawWorld);
      self.postMessage({ type: 'pose', points, world, time: data.time, aspect: data.aspect, ms: Math.round(ms) });
      // col full il telefono non sta dietro a un jab → torna al lite (e l'app lo ricorda)
      timings.push(ms); if (timings.length > 20) timings.shift();
      if (model === 'full' && timings.length >= 20 && [...timings].sort((a, b) => a - b)[10] > 55) {
        noUpgrade = true;
        await load('lite');
        self.postMessage({ type: 'swapped', model, tooSlow: true });
      }
    } catch { self.postMessage({ type: 'error', message: 'Il riconoscimento si è interrotto. La sessione è in pausa.' }); }
    finally { data.bitmap.close(); }
  }
};

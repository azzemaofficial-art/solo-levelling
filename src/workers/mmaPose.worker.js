// Inference runs off the UI thread. No images are uploaded or persisted.
let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const moduleUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
      const { FilesetResolver, PoseLandmarker } = await import(/* @vite-ignore */ moduleUrl);
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .65, minPosePresenceConfidence: .65, minTrackingConfidence: .65,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { console.error('MMA pose initialization:', error); self.postMessage({ type: 'error', detail: String(error?.message || error), message: 'Il riconoscimento non è disponibile. Riprova con una connessione attiva oppure usa la guida senza camera.' }); }
  }
  if (data.type === 'frame') {
    try {
      const result = detector.detectForVideo(data.bitmap, data.time);
      // world = coordinate 3D stimate in metri (origine tra le anche): servono al giudice delle combo
      self.postMessage({ type: 'pose', points: result.landmarks[0] || [], world: result.worldLandmarks?.[0] || [], time: data.time, aspect: data.aspect });
    } catch { self.postMessage({ type: 'error', message: 'Il riconoscimento si è interrotto. La sessione è in pausa.' }); }
    finally { data.bitmap.close(); }
  }
};

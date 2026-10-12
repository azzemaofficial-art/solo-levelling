// Lo scheletro DISEGNATO (solo grafica: il giudice dei colpi usa i punti veri del filtro).
// Il modello risponde ~25 volte al secondo e con ~45 ms di ritardo; lo schermo va a 60 Hz.
// Qui, a ogni aggiornamento dello schermo: si prevede di poco dove sta andando ogni punto
// (velocità degli ultimi risultati, al massimo hMax ms), e la visibilità sfuma invece di
// accendersi e spegnersi. Parametri tarati sui video in scripts/pose-training/.

// Tarati il 10/10/2026 su BoxingVI V7 (Lite a 25 fps, risultati in ritardo di 45 ms) contro lo
// scheletro di riferimento del dataset: rispetto al disegno "a scatti" −60% scatti delle braccia,
// −35% tremolio da fermo, scheletro un po' più attaccato al corpo durante i pugni.
export const VIEW = {
  hMax: 80,      // ms di previsione al massimo
  gain: 0.6,     // quanta parte della previsione si usa (1 = tutta)
  vSmooth: 0,    // levigatura della velocità tra un risultato e l'altro
  follow: 50,    // ms: lo scheletro scivola verso la nuova posizione invece di saltarci (0 = salta)
  visTau: 120,   // ms: tempo di dissolvenza della visibilità
  staleMs: 1500, // oltre, il risultato è vecchio: niente scheletro (mentre si cambia modello resta fermo)
};

export function createPoseView(opts = {}) {
  const o = { ...VIEW, ...opts };
  let cur = null, vel = null, shownVis = [], shown = [], lastNow = null;
  return {
    reset() { cur = null; vel = null; shownVis = []; shown = []; lastNow = null; },
    // nuovo risultato del modello: punti filtrati e istante del fotogramma letto
    push(points, t) {
      if (!Array.isArray(points) || !points.length) { cur = null; vel = null; shown = []; return; }
      const dt = cur ? t - cur.t : 0;
      if (cur && dt > 0 && dt <= 90) {
        const nv = points.map((p, i) => (p && cur.points[i] ? [(p.x - cur.points[i].x) / dt, (p.y - cur.points[i].y) / dt] : null));
        vel = vel ? nv.map((v, i) => (v && vel[i] ? [v[0] * (1 - o.vSmooth) + vel[i][0] * o.vSmooth, v[1] * (1 - o.vSmooth) + vel[i][1] * o.vSmooth] : v)) : nv;
      } else vel = null;
      cur = { t, points };
    },
    // punti da disegnare adesso (stesso orologio di t: performance.now())
    frame(now) {
      if (!cur || now - cur.t > o.staleMs) return null;
      const h = Math.max(0, Math.min(now - cur.t, o.hMax)) * o.gain;
      const step = lastNow == null ? 16 : Math.min(100, Math.max(0, now - lastNow));
      lastNow = now;
      const k = 1 - Math.exp(-step / o.visTau), f = o.follow > 0 ? 1 - Math.exp(-step / o.follow) : 1;
      return cur.points.map((p, i) => {
        if (!p) return p;
        const target = p.visibility ?? 1;
        shownVis[i] = shownVis[i] == null ? target : shownVis[i] + (target - shownVis[i]) * k;
        const v = vel?.[i];
        let x = p.x + (v ? v[0] * h : 0), y = p.y + (v ? v[1] * h : 0);
        const s = shown[i];
        if (s && f < 1) { x = s[0] + (x - s[0]) * f; y = s[1] + (y - s[1]) * f; }
        shown[i] = [x, y];
        return { x, y, visibility: shownVis[i] };
      });
    },
  };
}

// Lo scheletro DISEGNATO (solo grafica: il giudice dei colpi usa i punti veri del filtro).
// Dal 17/10/2026 di solito si mostra il fotogramma già letto col suo scheletro (createFrameSync, sotto);
// createPoseView resta per il video in diretta (modello lento, cambio di modello).
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

// ——— Video e scheletro sincronizzati (17/10/2026) ———
// Il video in diretta corre avanti e lo scheletro arriva ~45 ms dopo: durante un pugno resta
// indietro. Qui invece si mostra il fotogramma che il modello ha GIÀ letto, insieme al suo
// scheletro, con un piccolo ritardo costante (si adatta da solo tra dMin e dMax ms). I fotogrammi
// saltati dal modello prendono lo scheletro a metà tra i due risultati veri vicini (niente
// previsione). Così lo scarto che si vede è solo l'errore del modello. Tarato in scripts/pose-training/.
export const SYNC = {
  dMin: 20, dMax: 65, // ms di ritardo dell'immagine rispetto alla diretta
  q: 0.5,             // il ritardo copre metà dei fotogrammi recenti (gli altri aspettano il loro risultato)…
  win: 40,            // …contati sugli ultimi 40
  margin: 3,          // ms in più per sicurezza
  slew: 0.1,          // il ritardo cambia di al massimo 0,1 ms per ms: niente salti avanti o indietro
  maxGap: 70,         // ms tra due risultati, in media: se il modello risponde più di rado (lezioni a 12 fps) → video in diretta
  gapBand: 10,        // ± ms intorno a maxGap: si entra sotto 60 e si esce sopra 80, niente salti avanti e indietro
  liveAfter: 300,     // ms senza risultati nuovi (cambio modello, app in pausa) → video in diretta
  keep: 6,            // fotogrammi ricordati: quanti ne tiene in memoria il hook (6 × 33 ms = 200 ms)
  visTau: 120,        // ms: dissolvenza della visibilità
};
const EPS = 0.5;
const lerpPoints = (A, B, u) => A.map((p, j) => {
  const q = B[j];
  if (!p || !q) return p || q;
  return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, visibility: (p.visibility ?? 1) + ((q.visibility ?? 1) - (p.visibility ?? 1)) * u };
});

export function createFrameSync(opts = {}) {
  const o = { ...SYNC, ...opts };
  let frames, results, waits, gaps, D, shown, vis, lastNow, on;
  const reset = () => { frames = []; results = []; waits = []; gaps = []; D = o.dMax; shown = null; vis = []; lastNow = null; on = false; };
  reset();
  // scheletro del fotogramma t: il suo risultato, oppure a metà tra i due vicini; undefined = non ancora noto
  const pointsAt = (t) => {
    let i = results.length - 1;
    while (i >= 0 && results[i].t > t + EPS) i -= 1;
    const a = results[i], b = results[i + 1];
    if (!a) return undefined;
    if (t - a.t <= EPS) return a.points;
    if (!b) return undefined;
    if (!a.points || !b.points) return (t - a.t <= b.t - t ? a : b).points;
    return lerpPoints(a.points, b.points, (t - a.t) / (b.t - a.t));
  };
  return {
    reset,
    get delay() { return D; },
    // nuovo fotogramma della camera (stesso orologio dei risultati: performance.now())
    frame(t) {
      if (frames.length && t <= frames.at(-1).t) return;
      frames.push({ t, known: false });
      if (frames.length > o.keep) frames.shift();
    },
    // risultato del modello per il fotogramma t, ricevuto all'istante now (points vuoto = nessuno in scena)
    result(t, points, now) {
      const last = results.at(-1);
      if (last && t <= last.t) return;
      // dopo una pausa lunga (cambio modello) si riparte da capo, senza aspettare che la media si riprenda
      if (last && t - last.t > o.liveAfter) gaps = [];
      else if (last) { gaps.push(t - last.t); if (gaps.length > 15) gaps.shift(); }
      results.push({ t, points: points?.length ? points : null });
      if (results.length > o.keep + 4) results.shift();
      // da adesso questi fotogrammi si possono mostrare: quanto hanno dovuto aspettare
      for (const f of frames) if (!f.known && f.t <= t + EPS) { f.known = true; waits.push(now - f.t); }
      while (waits.length > o.win) waits.shift();
    },
    // cosa mostrare adesso: { t, points, changed } oppure null = video in diretta
    pick(now) {
      const step = lastNow == null ? 16 : Math.min(100, Math.max(0, now - lastNow));
      lastNow = now;
      const lr = results.at(-1), gap = gaps.length >= 3 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
      on = gap <= o.maxGap + (on ? o.gapBand : -o.gapBand);
      if (!lr || now - lr.t > o.liveAfter || !on) { shown = null; vis = []; return null; }
      if (waits.length) {
        const s = [...waits].sort((x, y) => x - y), want = Math.min(o.dMax, Math.max(o.dMin, s[Math.floor(o.q * (s.length - 1))] + o.margin));
        D += Math.max(-o.slew * step, Math.min(o.slew * step, want - D));
      }
      // il fotogramma più nuovo che è già "vecchio" di D ms e di cui si conosce lo scheletro
      const target = now - D;
      let f = null;
      for (const fr of frames) if (fr.t <= target && fr.t <= lr.t + EPS) f = fr;
      if (!f || (shown && f.t <= shown.t)) return shown && { ...shown, changed: false };
      const pts = pointsAt(f.t);
      if (pts === undefined) return shown && { ...shown, changed: false };
      const k = shown ? 1 - Math.exp(-(f.t - shown.t) / o.visTau) : 1;
      if (!pts) vis = [];
      const points = pts && pts.map((p, j) => {
        if (!p) return p;
        const v = p.visibility ?? 1;
        vis[j] = vis[j] == null ? v : vis[j] + (v - vis[j]) * k;
        return { x: p.x, y: p.y, visibility: vis[j] };
      });
      shown = { t: f.t, points, changed: true };
      return shown;
    },
  };
}

// Da un punto toccato sullo schermo a coordinate 0–1 dell'immagine della camera (come i punti
// dello scheletro). rect = riquadro dell'elemento (getBoundingClientRect), vw×vh = misure
// dell'immagine, fit = object-fit dell'elemento, mirrored = camera frontale specchiata via CSS.
// Fuori da 0–1 = fuori dall'immagine (bande nere di "contain" o parte tagliata da "cover").
export function toImagePoint(clientX, clientY, rect, vw, vh, fit = 'cover', mirrored = false) {
  if (!rect?.width || !rect?.height || !vw || !vh) return null;
  let sx = rect.width / vw, sy = rect.height / vh;
  if (fit === 'cover') sx = sy = Math.max(sx, sy);
  else if (fit === 'contain') sx = sy = Math.min(sx, sy);
  else if (fit === 'none') sx = sy = 1;
  else if (fit === 'scale-down') sx = sy = Math.min(1, sx, sy);
  const dw = vw * sx, dh = vh * sy;
  const x = (clientX - rect.left - (rect.width - dw) / 2) / dw, y = (clientY - rect.top - (rect.height - dh) / 2) / dh;
  return { x: mirrored ? 1 - x : x, y };
}

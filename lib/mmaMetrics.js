// Misure fisiche dei colpi (05/11/2026, «non misura velocità… rotazione… i consigli non vengono misurati»).
// Logica pura, dai punti 2D della camera: velocità di punta, tempo dalla partenza al colpo disteso,
// rotazione delle spalle, gomito, busto, distensione. La velocità si tiene in busti al secondo: non
// dipende dalla distanza dal telefono; i km/h vengono dalla scala (il busto in cm, misurato col sacco).
// Limite onesto, misurato su BoxingVI: due stimatori di posa sullo stesso colpo differiscono del 27%
// (mediana). Il singolo colpo è un «circa»; ciò che conta è la media di più colpi, e il confronto con te.

const J = { L: { sh: 11, el: 13, wr: 15 }, R: { sh: 12, el: 14, wr: 16 } };
const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

export const METRICS = {
  sideView: 0.72,     // spalle in guardia più strette di 0,72 busti: il telefono è di lato
  minTravel: 0.25,    // il pugno deve spostarsi di lato di almeno 0,25 busti, se no il verso non si legge
  shoulderW: 0.85,    // spalle viste di fronte, in busti: serve a passare dalla larghezza ai gradi
  startShare: 0.1,    // partenza: l'ultimo fotogramma entro il 10% della strada totale del pugno
  maxGapS: 0.2,       // un buco di fotogrammi più lungo non è una velocità
};

// Il sacco di Emanuele (foto e misure del 05/11/2026). Fascia arancione al 42,5% dall'alto, dalla foto.
// shortcut: misure di un solo sacco, per un altro sacco vanno rese impostabili
export const MY_BAG = { widthCm: 26, heightCm: 92, baseCm: 84, bandFromTop: 0.425 };

// Busto (spalle–anche) di un adulto: fuori da questi limiti la scala letta dal sacco è sbagliata
export const TORSO_CM = { min: 38, max: 68, fallback: 50 };
const TORSO_KEY = 'shadow_monarch_mma_torso_cm';

export function punchMetrics(seq, S, aspect = 1, { T, leadS, peakT } = {}) {
  const j = J[S];
  if (!j || !(T > 0)) return null;
  const frames = (seq || []).filter((f) => ok(f.p?.[j.wr]));
  if (frames.length < 3) return null;
  let peakI = frames.findIndex((f) => f.t >= peakT);
  if (peakI < 0) peakI = frames.length - 1;
  const wr = (f) => f.p[j.wr], w0 = wr(frames[0]), pk = frames[peakI].p;

  // velocità di punta su due intervalli: un intervallo solo è troppo rumoroso a 30 fotogrammi al secondo
  let speed = 0;
  for (let k = 2; k < Math.min(frames.length, peakI + 2); k += 1) {
    const a = wr(frames[k - 2]), b = wr(frames[k]), dt = (frames[k].t - frames[k - 2].t) / 1000;
    if (dt <= 0 || dt > METRICS.maxGapS) continue;
    speed = Math.max(speed, Math.hypot((b.x - a.x) * aspect, b.y - a.y) / T / dt);
  }

  // partenza vera: il motore si accende quando il colpo è già partito, quindi si cerca all'indietro
  const away = (f) => Math.hypot((wr(f).x - w0.x) * aspect, wr(f).y - w0.y);
  const total = away(frames[peakI]);
  let si = 0;
  for (let k = peakI; k >= 0; k -= 1) if (away(frames[k]) <= METRICS.startShare * total) { si = k; break; }

  // rotazione: quanto la spalla dietro passa davanti a quella avanti, nel verso del colpo
  const lead = J[leadS || 'L'], rear = J[(leadS || 'L') === 'L' ? 'R' : 'L'];
  const dx = wr(frames[peakI]).x - w0.x;
  const p0 = frames[0].p;
  const shoulders = frames.slice(0, Math.min(frames.length, peakI + 3)).filter((f) => ok(f.p[lead.sh]) && ok(f.p[rear.sh]));
  const guardW = ok(p0[lead.sh]) && ok(p0[rear.sh]) ? Math.abs(p0[rear.sh].x - p0[lead.sh].x) * aspect / T : Infinity;
  const side = guardW < METRICS.sideView;
  let rotation = null;
  if (side && Math.abs(dx) * aspect / T >= METRICS.minTravel && shoulders.length >= 2) {
    const dir = Math.sign(dx);
    const deg = (f) => Math.asin(clamp((((f.p[rear.sh].x - f.p[lead.sh].x) * aspect / T) * dir) / METRICS.shoulderW, -1, 1)) * 180 / Math.PI;
    rotation = r1(Math.max(...shoulders.map(deg)) - deg(shoulders[0]));
  }

  const has = (...ids) => ids.every((i) => ok(pk[i]));
  const elbowGap = has(j.el, j.wr) ? r2(Math.abs(pk[j.el].y - pk[j.wr].y) / T) : null;
  let lean = null;
  if (has(11, 12, 23, 24)) {
    const sx = (pk[11].x + pk[12].x) / 2 - (pk[23].x + pk[24].x) / 2, sy = (pk[11].y + pk[12].y) / 2 - (pk[23].y + pk[24].y) / 2;
    lean = r1(Math.atan2(Math.abs(sx) * aspect, Math.abs(sy)) * 180 / Math.PI);
  }
  // di fronte al telefono un braccio che viene verso la camera sembra corto: la distensione vale solo di lato
  let ext = null;
  if (side && has(j.sh, j.el, j.wr)) {
    const d = (a, b) => Math.hypot((pk[a].x - pk[b].x) * aspect, pk[a].y - pk[b].y);
    const arm = d(j.sh, j.el) + d(j.el, j.wr);
    if (arm > 0) ext = r2(d(j.sh, j.wr) / arm);
  }
  return { speed: r2(speed), impactMs: Math.round(peakT - frames[si].t), rotation, elbowGap, lean, ext, side };
}

// ── Gradi di velocità ──
// Percentili 10, 25, 50, 75, 90 della velocità di punta su BoxingVI (944 colpi di atleti, video a 24–30 fps,
// stessa formula e stesso motore dell'app). Grado S = più veloce del 90% di quei colpi. Il confronto è fra colpi
// visti allo stesso modo: una camera a 30 fps legge più basso dei sensori degli studi (élite circa 8 m/s).
const RANK_TABLE = {
  jab: [3.25, 4.84, 6.62, 8.38, 10.1],
  cross: [3.31, 5.01, 8.4, 11.18, 14.17],
  hook: [2.04, 3.09, 5.39, 7.17, 9.44],
  rearHook: [3.59, 5.17, 8.72, 12.58, 14.29],
  uppercut: [2.2, 3.31, 5.7, 7.14, 8.84],
  rearUppercut: [3.68, 5.27, 6.81, 9.5, 12.34],
};
const FAMILY = { bodyCross: 'cross', bodyHook: 'hook' };
const familyOf = (id) => FAMILY[id] || id;
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
export function rankOf(moveId, speed) {
  const t = RANK_TABLE[familyOf(moveId)];
  return t && Number.isFinite(speed) ? RANKS[t.filter((x) => speed >= x).length] : null;
}

// ── Scala: dal sacco ai centimetri ──
export const toKmh = (speed, torsoCm) => speed * (torsoCm / 100) * 3.6;

// T = busto in altezze d'immagine; il sacco è largo bagWidth (frazione della larghezza d'immagine).
// Se il busto che ne esce non è di un adulto, la scala è sbagliata e non si usa.
export function scaleCheck(bag, pose, aspect) {
  if (!bag?.realCm || !(bag.width > 0) || !(aspect > 0) || !Array.isArray(pose)) return null;
  const mean = (a, b) => (ok(pose[a]) && ok(pose[b]) ? { x: (pose[a].x + pose[b].x) / 2, y: (pose[a].y + pose[b].y) / 2 } : null);
  const sh = mean(11, 12), hip = mean(23, 24);
  if (!sh || !hip) return null;
  const perCm = (bag.width * aspect) / bag.realCm; // altezze d'immagine per centimetro
  const cm = Math.hypot((sh.x - hip.x) * aspect, sh.y - hip.y) / perCm;
  const feet = mean(27, 28);
  // seconda prova con i tuoi 84 cm: il fondo del sacco più 84 cm deve cadere sul pavimento, dove hai i piedi
  const floorErrCm = feet ? Math.round((feet.y - (bag.box.y1 + MY_BAG.baseCm * perCm)) / perCm) : null;
  return { torsoCm: cm >= TORSO_CM.min && cm <= TORSO_CM.max ? r1(cm) : null, measuredCm: r1(cm), floorErrCm };
}

export function readTorso() {
  try {
    const v = Number(localStorage.getItem(TORSO_KEY));
    return v >= TORSO_CM.min && v <= TORSO_CM.max ? v : null;
  } catch { return null; }
}
export const saveTorso = (cm) => { try { localStorage.setItem(TORSO_KEY, String(cm)); } catch { /* storage */ } };

// ── Contatore dei colpi di una serie, e record sul telefono ──
export const SPEED_KEY = 'shadow_monarch_mma_speed_v1';
export const emptySpeed = () => ({ best: {}, sessions: [] });
export function readSpeed(storage) {
  try {
    const x = JSON.parse((storage ?? globalThis.localStorage).getItem(SPEED_KEY) || '{}');
    return { best: x.best && typeof x.best === 'object' ? x.best : {}, sessions: Array.isArray(x.sessions) ? x.sessions.filter(Boolean) : [] };
  } catch { return emptySpeed(); }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

export function createStrikeMeter({ torsoCm, records = emptySpeed() }) {
  const list = [];
  const best = { ...records.best };
  return {
    // un colpo finito → cosa mostrare. Il grado grande è del colpo; la media di 5 è il numero affidabile.
    add(g, id) {
      if (g?.limb !== 'arm' || !(g.speed > 0)) return null;
      // colpo non riconosciuto: la velocità è vera, ma grado e record sarebbero di un altro colpo
      if (id == null) return { id: null, at: g.peakT, side: g.side, speed: g.speed, kmh: Math.round(toKmh(g.speed, torsoCm)), rank: null, impactMs: g.impactMs ?? null, rotation: g.rotation ?? null, rear: g.side === 'rear', isBest: false, bestKmh: null, avgKmh: null, avgRank: null, n: 0, drop: null };
      if (!RANK_TABLE[familyOf(id)]) return null;
      const fam = familyOf(id), same = () => list.filter((x) => x.fam === fam);
      list.push({ fam, speed: g.speed });
      const isBest = g.speed > (best[fam] || 0);
      if (isBest) best[fam] = g.speed;
      const all = same().map((x) => x.speed), last5 = all.slice(-5);
      const avg = all.length >= 3 ? median(last5) : null;
      // calo nella serie: i primi 3 contro gli ultimi 3 (servono almeno 8 colpi uguali)
      const drop = all.length >= 8 ? Math.round((1 - median(all.slice(-3)) / median(all.slice(0, 3))) * 100) : null;
      return {
        id, at: g.peakT, speed: g.speed, kmh: Math.round(toKmh(g.speed, torsoCm)), rank: rankOf(id, g.speed),
        impactMs: g.impactMs ?? null, rotation: g.rotation ?? null, rear: g.side === 'rear', isBest,
        bestKmh: Math.round(toKmh(best[fam], torsoCm)), avgKmh: avg != null ? Math.round(toKmh(avg, torsoCm)) : null,
        avgRank: avg != null ? rankOf(id, avg) : null, n: all.length, drop: drop > 0 ? drop : null,
      };
    },
    // a fine serie: mediana per colpo (per il Percorso) e nuovi record
    session(at = Date.now()) {
      if (!list.length) return null;
      const byMove = {};
      for (const fam of new Set(list.map((x) => x.fam))) {
        const s = list.filter((x) => x.fam === fam).map((x) => x.speed);
        byMove[fam] = { n: s.length, median: median(s) };
      }
      return { at, byMove, best };
    },
  };
}
export function saveSpeed(session) {
  if (!session) return;
  try {
    const h = readSpeed();
    localStorage.setItem(SPEED_KEY, JSON.stringify({ best: session.best, sessions: [...h.sessions, { at: session.at, byMove: session.byMove }].slice(-60) }));
  } catch { /* storage */ }
}
// Il grado migliore di un colpo, sulla mediana di una serie vera (almeno 5 colpi): è quello che vale nel Percorso
export const rankAtLeast = (rank, min) => rank != null && RANKS.indexOf(rank) >= RANKS.indexOf(min);
export function bestSeriesRank(records, moveId) {
  const fam = familyOf(moveId);
  const meds = (records?.sessions || []).map((s) => s.byMove?.[fam]).filter((m) => m?.n >= 5).map((m) => m.median);
  return meds.length ? rankOf(fam, Math.max(...meds)) : null;
}

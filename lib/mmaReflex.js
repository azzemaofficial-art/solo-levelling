// Laboratorio riflessi (21/10/2026, "esercizi specifici per la velocità, riflessi … devo poter combattere").
// Lo schermo lampeggia (colore + segno), tu rispondi; la camera misura:
//  - REAZIONE: dal segnale all'istante in cui il corpo LASCIA la guardia (non quando il colpo è già a metà:
//    il motore dei colpi parte da 0,16 busti, ~8 cm). Metodo dei laboratori di biomeccanica: prima del
//    segnale sei fermo, quella è la tua linea di base; la partenza è quando un punto del corpo esce dal suo
//    tremolio (soglia alta per essere sicuri, poi si torna indietro alla soglia bassa per l'istante giusto);
//  - TEMPO DEL COLPO: dalla partenza al colpo disteso (picco del gesto letto dal giudice);
//  - SCELTA: il colpo giusto per quel segnale (giudice delle combo), le partenze anticipate, e nel
//    "non abboccare" se sei rimasto fermo quando dovevi.
// Il telefono legge 20–25 fotogrammi al secondo: l'istante si ricava interpolando tra due fotogrammi
// (precisione di qualche centesimo). Il tempo misurato contiene il ritardo della camera: si toglie quando
// il telefono lo dichiara (captureTime), altrimenti resta uguale ogni volta e il confronto con te stesso vale.
// Logica pura e testabile; l'interfaccia è src/components/MmaReflexLab.jsx.
import { judgeSequence, visibleGestures } from './mmaComboJudge.js';

export const REFLEX_KEY = 'shadow_monarch_mma_reflex_v1';

export const REFLEX = {
  baseMs: 600,      // linea di base: da 0,6 s…
  baseGapMs: 150,   // …a 0,15 s prima del segnale (un movimento proprio sul segnale non la sporca)
  minBase: 4,       // fotogrammi minimi nella linea di base
  hiMin: 0.06,      // soglia alta: almeno 0,06 busti (~3 cm)…
  hiK: 2.5,         // …o 2,5 × il tremolio della linea di base
  loMin: 0.03,      // soglia bassa (l'istante vero della partenza): 0,03 busti…
  loK: 1.2,         // …o 1,2 × il tremolio
  restless: 0.2,    // un punto che tremava più di 0,2 busti prima del segnale non è affidabile
  moveMin: 0.12,    // un punto conta come risposta se poi si sposta di almeno 0,12 busti
  earlyMs: 100,     // nessuno reagisce prima di 100 ms: prima è una partenza anticipata
  windowMs: 1500,   // tempo per rispondere (con un calcio 2000)
  kickWindowMs: 2000,
  foreMin: 1200,    // attesa casuale prima del segnale, così non lo puoi indovinare
  foreMax: 3200,
  keep: 30,         // sedute tenute in memoria per esercizio
};

// I punti che possono rispondere: polsi, ginocchia (nel calcio parte prima il ginocchio), caviglie,
// testa (rispetto al bacino) e il bacino stesso
const EFFECTORS = ['leadWrist', 'rearWrist', 'leadKnee', 'rearKnee', 'leadAnkle', 'rearAnkle', 'head', 'hips'];
const JOINT = { leadWrist: { L: 15, R: 16 }, rearWrist: { L: 16, R: 15 }, leadKnee: { L: 25, R: 26 }, rearKnee: { L: 26, R: 25 }, leadAnkle: { L: 27, R: 28 }, rearAnkle: { L: 28, R: 27 } };

// I segnali: colore e segno sullo schermo (si vedono a 3 metri), cosa devi fare
export const CUES = {
  jab: { sign: '1', color: '#38d996', label: 'Jab', moves: ['jab'] },
  cross: { sign: '2', color: '#4fa3ff', label: 'Diretto', moves: ['cross'] },
  lowKick: { sign: '↓', color: '#b07bff', label: 'Calcio basso', moves: ['lowKick'] },
  slipCross: { sign: '⚠', color: '#ff7a45', label: 'Schiva e diretto', moves: ['slip', 'cross'] },
  stop: { sign: '✋', color: '#ff4d5e', label: 'Fermo', moves: [], nogo: true },
};

// Esercizi in ordine: dal più sicuro da misurare al più difficile. Si sbloccano uno dopo l'altro.
export const DRILLS = [
  { id: 'puro', name: 'Riflesso puro', cues: { jab: 1 }, trials: 10, what: 'Schermo verde → jab. Il tuo tempo di reazione semplice: la base di tutto.' },
  { id: 'nonAbboccare', name: 'Non abboccare', cues: { jab: 0.7, stop: 0.3 }, trials: 12, what: 'Verde → jab; rosso ✋ → resta fermo. In combattimento è non mordere le finte.' },
  { id: 'manoGamba', name: 'Mano o gamba', cues: { jab: 0.5, lowKick: 0.5 }, trials: 12, feet: true, what: '1 → jab, ↓ → calcio basso. Scegli in un lampo l’arma giusta.' },
  { id: 'lati', name: 'Destra o sinistra', cues: { jab: 0.5, cross: 0.5 }, trials: 12, what: '1 → jab, 2 → diretto. Il braccio giusto senza pensarci.' },
  { id: 'schiva', name: 'Schiva e rispondi', cues: { slipCross: 0.75, stop: 0.25 }, trials: 10, what: '⚠ arriva il suo jab → schiva e rispondi col diretto; ✋ → fermo.' },
  { id: 'leggi', name: 'Leggi e rispondi', cues: { jab: 0.25, cross: 0.25, lowKick: 0.2, slipCross: 0.15, stop: 0.15 }, trials: 15, feet: true, what: 'Tutti i segnali mescolati: come in un round vero.' },
];
export const drillById = (id) => DRILLS.find((d) => d.id === id) || DRILLS[0];
export const drillNeedsFeet = (drill) => Boolean(drill.feet) || Object.keys(drill.cues).some((c) => CUES[c].moves.some((m) => m === 'lowKick'));
export const windowOf = (cue) => (CUES[cue]?.moves.includes('lowKick') ? REFLEX.kickWindowMs : REFLEX.windowMs);

// Sequenza delle prove: segnali secondo i pesi, mai più di 3 uguali di fila, attesa casuale
export function planTrials(drill, rand = Math.random) {
  const entries = Object.entries(drill.cues);
  const out = [];
  for (let i = 0; i < drill.trials; i += 1) {
    // dopo 3 uguali di fila si sceglie tra gli altri segnali
    const tired = entries.length > 1 && out.length >= 3 && out.slice(-3).every((t) => t.cue === out[out.length - 1].cue) ? out[out.length - 1].cue : null;
    const pool = entries.filter(([c]) => c !== tired);
    let r = rand() * pool.reduce((s, [, w]) => s + w, 0);
    const cue = pool.find(([, w]) => (r -= w) < 0)?.[0] || pool[pool.length - 1][0];
    out.push({ cue, foreMs: Math.round(REFLEX.foreMin + rand() * (REFLEX.foreMax - REFLEX.foreMin)) });
  }
  return out;
}

const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= 0.3;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Posizione di ogni punto che risponde, in busti (la x corretta per il formato dell'immagine)
export function effectorTracks(frames, { aspect = 1, lead = 'L' } = {}) {
  const tracks = Object.fromEntries(EFFECTORS.map((k) => [k, []]));
  for (const f of frames) {
    const p = f.points;
    if (!p || ![11, 12, 23, 24].every((i) => ok(p[i]))) continue;
    const sh = mid(p[11], p[12]), hip = mid(p[23], p[24]);
    const T = Math.hypot((sh.x - hip.x) * aspect, sh.y - hip.y);
    if (!(T > 0.02)) continue;
    const at = (q, o) => [((q.x - o.x) * aspect) / T, (q.y - o.y) / T];
    for (const k of Object.keys(JOINT)) {
      const q = p[JOINT[k][lead]];
      if (ok(q)) tracks[k].push({ t: f.t, xy: at(q, hip), T });
    }
    if (ok(p[0])) tracks.head.push({ t: f.t, xy: at(p[0], hip), T });
    // il bacino rispetto all'immagine: un passo o un cambio di livello partono da lì
    tracks.hips.push({ t: f.t, xy: [(hip.x * aspect), hip.y], T, abs: true });
  }
  return tracks;
}

// Partenza di un punto: soglia alta per essere sicuri (2 fotogrammi di fila), poi indietro fino
// all'ultimo fotogramma sotto la soglia bassa e interpolazione (l'istante in cui ha lasciato la guardia)
export function onsetOf(track, cueAt, toMs = REFLEX.windowMs) {
  const from = cueAt - REFLEX.baseMs, baseEnd = cueAt - REFLEX.baseGapMs;
  const base = track.filter((s) => s.t >= from && s.t <= baseEnd);
  if (base.length < REFLEX.minBase) return { status: 'noBase' };
  // il bacino si misura in busti con il busto della linea di base (la sua posizione è nell'immagine)
  const Tb = base.reduce((s, b) => s + b.T, 0) / base.length;
  const scale = (s) => (s.abs ? [s.xy[0] / Tb, s.xy[1] / Tb] : s.xy);
  const c = base.map(scale).reduce((a, xy) => [a[0] + xy[0] / base.length, a[1] + xy[1] / base.length], [0, 0]);
  const dist = (s) => { const xy = scale(s); return Math.hypot(xy[0] - c[0], xy[1] - c[1]); };
  const noise = Math.max(...base.map(dist));
  if (noise > REFLEX.restless) return { status: 'restless', noise };
  const hi = Math.max(REFLEX.hiMin, noise * REFLEX.hiK), lo = Math.max(REFLEX.loMin, noise * REFLEX.loK);
  const after = track.filter((s) => s.t > baseEnd && s.t <= cueAt + toMs).map((s) => ({ t: s.t, d: dist(s) }));
  const seq = [{ t: base[base.length - 1].t, d: dist(base[base.length - 1]) }, ...after];
  const peak = after.reduce((m, s) => Math.max(m, s.d), 0);
  for (let i = 1; i < seq.length - 1; i += 1) {
    if (!(seq[i].d > hi && seq[i + 1].d > hi)) continue;
    let j = i - 1;
    while (j > 0 && seq[j].d > lo) j -= 1;
    const a = seq[j], b = seq[j + 1];
    const k = b.d > a.d ? Math.min(1, Math.max(0, (lo - a.d) / (b.d - a.d))) : 0;
    return { status: 'moved', t: a.t + k * (b.t - a.t), peak, noise, hi, lo };
  }
  return { status: 'still', peak, noise, hi, lo };
}

// Velocità massima di un punto tra due istanti (busti al secondo)
function peakSpeed(track, from, to) {
  let best = 0;
  for (let i = 1; i < track.length; i += 1) {
    const a = track[i - 1], b = track[i];
    if (b.t < from || a.t > to || b.abs || !(b.t > a.t)) continue;
    best = Math.max(best, Math.hypot(b.xy[0] - a.xy[0], b.xy[1] - a.xy[1]) / ((b.t - a.t) / 1000));
  }
  return best;
}

const LIMB_OF = { leadWrist: 'arm', rearWrist: 'arm', leadKnee: 'leg', rearKnee: 'leg', leadAnkle: 'leg', rearAnkle: 'leg', head: 'head', hips: 'body' };

// Una prova: cosa hai fatto dopo il segnale
//  status: ok · wrong (risposta sbagliata) · miss (niente) · early (partito prima) · held (fermo sul ✋, giusto)
//          · bit (hai abboccato al ✋) · unread (ti sei mosso ma il coach non ha letto il colpo) · restless · noBase
// answers: tutte le risposte possibili dell'esercizio (una risposta sbagliata è un colpo non richiesto,
// quindi si guardano tutti gli arti dell'esercizio, non solo quelli del segnale)
export const drillAnswers = (drill) => [...new Set(Object.keys(drill.cues).flatMap((c) => CUES[c].moves))];
const ALL_ANSWERS = [...new Set(Object.values(CUES).flatMap((c) => c.moves))];

export function scoreTrial({ cue, cueAt, frames, gestures, aspect = 1, lead = 'L', lagMs = 0, answers = ALL_ANSWERS }) {
  const spec = CUES[cue];
  const win = windowOf(cue);
  const tracks = effectorTracks(frames, { aspect, lead });
  const on = Object.fromEntries(EFFECTORS.map((k) => [k, onsetOf(tracks[k], cueAt, win)]));
  const usable = EFFECTORS.filter((k) => on[k].status !== 'noBase' && on[k].status !== 'restless');
  const base = { cue, cueAt, nogo: Boolean(spec.nogo), lagMs: lagMs || 0 };
  if (!usable.some((k) => ['leadWrist', 'rearWrist', 'head'].includes(k))) {
    return { ...base, status: EFFECTORS.some((k) => on[k].status === 'restless') ? 'restless' : 'noBase' };
  }
  // la risposta: il punto partito per primo tra quelli che poi si spostano davvero
  const movers = usable.filter((k) => on[k].status === 'moved' && on[k].peak >= REFLEX.moveMin).sort((a, b) => on[a].t - on[b].t);
  const first = movers[0] || null;
  const seen = visibleGestures(answers, (gestures || []).filter((g) => g.start >= cueAt - REFLEX.baseGapMs && g.start <= cueAt + win));
  const strong = seen.filter((g) => g.kind !== 'unclear');
  // la partenza vera = quando la camera la mostra meno il suo ritardo: vale sia per "partito prima" sia per il tempo
  const t0 = first ? on[first].t - (lagMs || 0) : null;
  if (first && t0 < cueAt + REFLEX.earlyMs) return { ...base, status: 'early', by: LIMB_OF[first], rt: Math.round(t0 - cueAt) };
  if (spec.nogo) return { ...base, status: first || strong.length ? 'bit' : 'held', by: first ? LIMB_OF[first] : null };
  if (!first) return { ...base, status: strong.length ? 'unread' : 'miss' };
  const rt = Math.round(t0 - cueAt);
  const res = judgeSequence(spec.moves, seen);
  // giusta: ogni colpo chiesto c'è (braccio/gamba e tipo giusti) e il primo gesto è proprio il primo colpo chiesto
  const right = res.moves.every((mv) => mv.gesture && !mv.issues.some((it) => ['side', 'kind'].includes(it.key))) && res.moves[0]?.gesture === seen[0];
  const firstMove = res.moves[0]?.gesture;
  // tempo del colpo: dalla partenza al colpo disteso (il primo colpo della risposta)
  const peakT = firstMove ? (firstMove.peakT ?? firstMove.end) : null;
  const mt = peakT != null && peakT > on[first].t ? Math.round(peakT - on[first].t) : null;
  const acting = firstMove ? (firstMove.limb === 'leg' ? (firstMove.side === 'lead' ? 'leadAnkle' : 'rearAnkle') : firstMove.limb === 'arm' ? (firstMove.side === 'lead' ? 'leadWrist' : 'rearWrist') : 'head') : first;
  const speed = peakT != null ? Math.round(peakSpeed(tracks[acting], on[first].t, peakT) * 10) / 10 : null;
  const status = !seen.length ? 'unread' : right ? 'ok' : 'wrong';
  return { ...base, status, rt, mt, total: mt != null ? rt + mt : null, speed, by: LIMB_OF[first], did: seen.map((g) => g.move || g.kind) };
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const quart = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };

// Riassunto di una serie: contano le prove valide (non quelle in cui non eri fermo o il colpo non è stato letto)
export function summarize(trials) {
  const valid = trials.filter((t) => !['restless', 'noBase', 'unread'].includes(t.status));
  const go = valid.filter((t) => !t.nogo), nogo = valid.filter((t) => t.nogo);
  const good = go.filter((t) => t.status === 'ok');
  const rts = good.map((t) => t.rt), mts = good.map((t) => t.mt).filter((x) => x != null);
  const totals = good.map((t) => t.total).filter((x) => x != null);
  return {
    n: valid.length,
    acc: valid.length ? Math.round(((good.length + nogo.filter((t) => t.status === 'held').length) / valid.length) * 100) / 100 : 0,
    rt: median(rts), best: rts.length ? Math.min(...rts) : null,
    spread: rts.length >= 4 ? quart(rts, 0.75) - quart(rts, 0.25) : null,
    mt: median(mts), total: median(totals),
    early: trials.filter((t) => t.status === 'early').length,
    bit: nogo.filter((t) => t.status === 'bit').length, nogo: nogo.length,
    wrong: go.filter((t) => t.status === 'wrong').length, miss: go.filter((t) => t.status === 'miss').length,
    unread: trials.filter((t) => t.status === 'unread').length,
    lagFixed: trials.some((t) => t.lagMs > 0),
  };
}

// Superato: abbastanza prove valide, almeno 8 su 10 giuste, al massimo una partenza anticipata
export const passed = (s) => Boolean(s) && s.n >= 8 && s.acc >= 0.8 && s.early <= 1;

export const emptyHistory = () => ({ drills: {} });

export function addSession(history, drillId, summary, at = Date.now()) {
  const list = [...(history?.drills?.[drillId] || []), { at, ...summary }].slice(-REFLEX.keep);
  return { ...history, drills: { ...(history?.drills || {}), [drillId]: list } };
}

// Un esercizio si apre quando quello prima è stato superato almeno una volta
export function unlockedDrills(history) {
  const open = [DRILLS[0].id];
  for (let i = 1; i < DRILLS.length; i += 1) {
    if (!(history?.drills?.[DRILLS[i - 1].id] || []).some(passed)) break;
    open.push(DRILLS[i].id);
  }
  return open;
}

// Come stai andando in un esercizio: ultima serie, record, e confronto con le prime serie
export function drillStats(history, drillId) {
  const list = history?.drills?.[drillId] || [];
  if (!list.length) return null;
  const rts = list.map((s) => s.rt).filter((x) => x != null);
  const last = list[list.length - 1];
  const firsts = rts.slice(0, 3);
  return {
    sessions: list.length, last,
    best: rts.length ? Math.min(...list.map((s) => s.best ?? s.rt).filter((x) => x != null)) : null,
    // guadagno: mediana delle prime 3 serie meno l'ultima (positivo = più veloce)
    gain: rts.length >= 4 && last.rt != null ? median(firsts) - last.rt : null,
    passed: list.some(passed),
  };
}

export function loadHistory(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(REFLEX_KEY);
    const h = raw ? JSON.parse(raw) : null;
    if (!h || typeof h.drills !== 'object' || !h.drills || Array.isArray(h.drills)) return emptyHistory();
    // solo liste di serie: un backup rovinato non deve bloccare la pagina
    const drills = {};
    for (const [id, list] of Object.entries(h.drills)) if (Array.isArray(list)) drills[id] = list.filter((x) => x && typeof x === 'object');
    return { drills };
  } catch { return emptyHistory(); }
}

export function saveHistory(history, storage = globalThis.localStorage) {
  try { storage?.setItem(REFLEX_KEY, JSON.stringify(history)); return true; } catch { return false; }
}

// Registro degli allenamenti veri del coach MMA con camera. Ogni ripetizione della combo diventa un
// esempio ETICHETTATO: cosa ha capito il coach + il giudizio di Emanuele (👍/👎 e i colpi letti male).
// Solo lo scheletro (lib/mmaClips.js), niente video. Va nella lista mma_train:<chatId> (kind train,
// lib/mmaClipStore.js). La clip resta in sospeso finché arriva il giudizio; se la rete manca resta in
// coda sul telefono e riparte alla volta dopo. Niente qui può bloccare l'allenamento.
import { encodeClip, readChatId } from './mmaClips.js';

export const TRAIN_VERSION = 'v7';
export const TRAIN_MAX_CHARS = 149000; // il server ne accetta 150.000, compresi kind e data
export const QUEUE_KEY = 'shadow_monarch_mma_train_queue';
export const QUEUE_LIMITS = { items: 20, chars: 1500000 };
const SWITCH_KEY = 'shadow_monarch_mma_train_log';

const r = Math.round;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const mil = (x) => (Number.isFinite(x) ? Math.round(x * 1000) : null); // 0–1 → millesimi

// Interruttore nel setup: acceso di default (l'ha chiesto Emanuele). Spento = nessuna clip train e la
// coda non ancora partita si butta.
export const readTrainLog = () => { try { return localStorage.getItem(SWITCH_KEY) !== '0'; } catch { return true; } };
export const saveTrainLog = (on) => {
  try { localStorage.setItem(SWITCH_KEY, on ? '1' : '0'); if (!on) localStorage.removeItem(QUEUE_KEY); } catch { /* storage */ }
};

// ── La clip della ripetizione ──────────────────────────────────────────────────
// frames: judge.frames() (già con sinistra/destra raddrizzati); from/to: finestra della ripetizione;
// go: il momento del "VIA"; calib: fotogrammi della guardia in calibrazione (per rigiocare la clip
// col motore com'era in app); result: il giudizio del coach; gestures: i gesti visti (al sacco quelli
// abbinati ai contatti); bag: useMmaBag().snapshot(); bagScore: colpi a segno; phone: modello e numeri
// della camera. Tutti i tempi sono in ms dall'inizio della clip.
export function buildTrainClip({
  frames, from = -Infinity, to = Infinity, go = null, calib = [], aspect = null,
  rep = null, session = null, n = null, combo = {}, moves = [], stance = 'orthodox', templates = false,
  result = null, gestures = [], bag = null, bagScore = null, phone = null,
} = {}) {
  const first = (frames || []).find((f) => f.t >= from && f.t <= to && Array.isArray(f.world) && f.world.length > 28);
  if (!first || !result) return null;
  const t0 = first.t;
  const rel = (t) => (Number.isFinite(t) ? r(t - t0) : null);
  const seen = (gestures || []).map((g) => ({
    move: g.move || null, kind: g.kind || null, limb: g.limb || null, S: g.S || null, side: g.side || null,
    start: rel(g.start), peakT: rel(g.peakT), end: rel(g.end), reach: r3(g.reach),
    ...(g.unsure ? { unsure: true } : {}),
    ...(g.hit != null ? { hit: Boolean(g.hit) } : {}),
    ...(g.sideFromContact ? { sideFromContact: g.sideFromContact } : {}),
  }));
  const mv = result.moves || [];
  const coach = {
    total: result.total ?? null, grade: result.grade || null,
    st: mv.map((m) => m.status),             // stato di ogni colpo atteso (ok, partial, missing, guided)
    sc: mv.map((m) => r(m.score || 0)),      // voto di ogni colpo
    g: mv.map((m) => (m.gesture ? (gestures || []).indexOf(m.gesture) : -1)), // gesto abbinato (indice in seen)
    is: mv.map((m) => (m.issues || []).map((it) => it.key).filter(Boolean)),   // problemi trovati
  };
  const cal = calib?.length ? encodeClip(calib.map((f, i) => ({ ...f, t: Number.isFinite(f.t) ? f.t : i * 33 }))) : null;
  const clip = encodeClip(frames, {
    from, to,
    ver: TRAIN_VERSION, rep, session, n,
    combo: combo?.id ?? null, name: combo?.name ?? null, expected: moves, stance, templates: Boolean(templates),
    bagOn: Boolean(bag), aspect: r3(aspect), go: rel(go),
    ok: null, wrong: [],
    coach, seen,
    bag: bag ? bagPart(bag, bagScore, rel, t0, to) : null,
    phone: phonePart(phone),
    cal: cal ? { j: cal.j, w: cal.w, p: cal.p } : null,
  });
  return clip;
}

// sacco: rettangolo e asse (millesimi dell'immagine), zone, contatti e movimento per fotogramma
function bagPart(bag, score, rel, t0, to) {
  const box = bag.box || {}, axis = bag.axis || {}, z = bag.zones;
  const motion = (bag.motion || []).filter((m) => m[0] >= t0 && m[0] <= to);
  return {
    rect: [mil(box.x0), mil(box.y0), mil(box.x1), mil(box.y1)], axis: [mil(axis.xTop), mil(axis.xBot)], width: mil(bag.width),
    zones: z ? [mil(z.head), mil(z.body), mil(z.low)] : null,
    hits: score ? score.hits : null, total: score ? score.total : null, hit: score ? score.hit.map((h) => (h ? 1 : 0)) : null,
    contacts: (bag.contacts || []).map((c) => ({ t: rel(c.t), S: c.S, limb: c.limb || 'arm', zone: c.zone, strength: c.strength, sure: c.sure !== false, by: c.by || null })),
    // per fotogramma: x spostamento e v velocità (centesimi di pixel della miniatura 32×32), e tremolio
    // (centesimi), u sacco visibile (1/0), z impulso (centesimi, 0 = niente)
    motion: {
      t: motion.map((m) => rel(m[0])),
      x: motion.map((m) => r((m[1] || 0) * 100)),
      v: motion.map((m) => r((m[2] || 0) * 100)),
      e: motion.map((m) => (Number.isFinite(m[3]) ? r(m[3] * 100) : null)),
      u: motion.map((m) => (m[4] ? 1 : 0)),
      z: motion.map((m) => r((m[5] || 0) * 100)),
    },
  };
}

function phonePart(phone) {
  if (!phone) return null;
  const s = phone.stats || {};
  return {
    model: phone.model || null, cam: phone.cam || null,
    rps: Number.isFinite(s.resultsPerSec) ? Math.round(s.resultsPerSec * 10) / 10 : null,
    waitMs: s.waitMs ?? null, delayMs: s.imageDelayMs ?? null, synced: s.synced ?? null,
  };
}

export const clipChars = (clip) => JSON.stringify(clip).length;

// Sotto il limite del server: prima via il 3D (w), poi il movimento del sacco per fotogramma, poi un
// fotogramma sì e uno no. "cut" dice cosa è stato tolto. Troppo grande comunque → null (non parte).
export function fitClip(clip, max = TRAIN_MAX_CHARS) {
  if (!clip) return null;
  let c = clip;
  if (clipChars(c) <= max) return c;
  c = { ...c, w: null, cut: ['w'] };
  if (clipChars(c) <= max) return c;
  if (c.bag?.motion) {
    c = { ...c, bag: { ...c.bag, motion: null }, cut: [...c.cut, 'bagMotion'] };
    if (clipChars(c) <= max) return c;
  }
  const half = (a) => (Array.isArray(a) ? a.filter((_, i) => i % 2 === 0) : a);
  c = { ...c, t: half(c.t), p: half(c.p), cut: [...c.cut, 'half'] };
  return clipChars(c) <= max ? c : null;
}

// ── Il giudizio di Emanuele ────────────────────────────────────────────────────
// ok: true (👍 ha capito), false (👎 non ha capito), null (nessun giudizio).
// wrong: indici dei colpi attesi letti male (si segnano toccando i colpi dopo il 👎).
export const NO_VOTE = Object.freeze({ ok: null, wrong: [] });
export const castVote = (vote, ok) => (ok ? { ok: true, wrong: [] } : { ok: false, wrong: [...(vote?.ok === false ? vote.wrong || [] : [])] });
export function toggleWrong(vote, i) {
  if (vote?.ok !== false || !Number.isInteger(i) || i < 0) return vote;
  const s = new Set(vote.wrong || []);
  if (s.has(i)) s.delete(i); else s.add(i);
  return { ok: false, wrong: [...s].sort((a, b) => a - b) };
}
export const withVote = (clip, vote) => (clip ? { ...clip, ok: vote?.ok ?? null, wrong: vote?.ok === false ? [...(vote.wrong || [])] : [] } : null);

// quanto aspettare prima di mandare: col 👍 poco (un ripensamento), col 👎 il tempo di toccare i colpi
export const WAIT = { none: 20000, up: 1500, down: 12000 };
export const voteWait = (vote) => (vote?.ok === true ? WAIT.up : vote?.ok === false ? WAIT.down : WAIT.none);

// Clip in sospeso della ripetizione appena finita. Parte: col giudizio (dopo l'attesa qui sopra),
// all'inizio della ripetizione dopo o alla chiusura (flush), o dopo 20 s senza giudizio. Se il
// giudizio cambia dopo l'invio, riparte la clip intera (l'analisi tiene l'ultima della ripetizione).
export function createTrainPending({ send, later = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) } = {}) {
  let p = null;
  const flush = () => {
    if (!p) return false;
    if (p.timer != null) { cancel(p.timer); p.timer = null; }
    if (p.sent) return false;
    p.sent = true;
    try { send([fitClip(withVote(p.clip, p.vote))]); } catch { /* mai bloccare l'allenamento */ }
    return true;
  };
  const arm = (ms) => { if (p.timer != null) cancel(p.timer); p.timer = later(flush, ms); };
  return {
    hold: (clip) => { flush(); p = clip ? { clip, vote: NO_VOTE, sent: false, timer: null } : null; if (p) arm(WAIT.none); },
    vote: (vote) => { if (!p) return; p.vote = vote; p.sent = false; arm(voteWait(vote)); },
    flush,
    waiting: () => Boolean(p && !p.sent),
  };
}

// ── Coda offline ────────────────────────────────────────────────────────────
// Le clip non partite restano sul telefono (localStorage): al massimo 20 o ~1,5 MB, le più vecchie
// escono per prime. La stessa ripetizione (session + rep) non entra due volte: vale l'ultima.
const keyOf = (c) => (c && c.rep != null ? `${c.session ?? ''}:${c.rep}` : null);
export function mergeQueue(list, items, { items: maxItems = QUEUE_LIMITS.items, chars: maxChars = QUEUE_LIMITS.chars } = {}) {
  const out = [];
  for (const it of [...(list || []), ...(items || [])]) {
    if (!it || typeof it !== 'object') continue;
    const k = keyOf(it);
    const j = k == null ? -1 : out.findIndex((o) => keyOf(o) === k);
    if (j >= 0) out.splice(j, 1);
    out.push(it);
  }
  const kept = [];
  let chars = 0;
  for (let i = out.length - 1; i >= 0 && kept.length < maxItems; i -= 1) {
    const c = clipChars(out[i]);
    if (chars + c > maxChars) break;
    chars += c; kept.unshift(out[i]);
  }
  return kept;
}

// Invio al server: 'ok', 'retry' (rete assente, server occupato: si riprova) o 'drop' (rifiutata)
export async function postTrain(items, chatId) {
  try {
    const res = await fetch('/api/nvidia/visual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, poseClip: { kind: 'train', items } }),
    });
    if (res.ok) return 'ok';
    return res.status === 429 || res.status >= 500 ? 'retry' : 'drop';
  } catch { return 'retry'; }
}

// Un invio alla volta (in fila): prima la coda vecchia, poi le clip nuove, a gruppi di 6. Al primo
// errore di rete il resto torna in coda senza altri tentativi.
export function createTrainSender({ storage = () => globalThis.localStorage, post = postTrain, chatId = readChatId, limits = QUEUE_LIMITS, group = 6 } = {}) {
  let chain = Promise.resolve();
  const store = () => { try { return storage() || null; } catch { return null; } };
  const readQ = () => { try { const v = JSON.parse(store()?.getItem(QUEUE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const writeQ = (list) => {
    try { const s = store(); if (!s) return; if (list.length) s.setItem(QUEUE_KEY, JSON.stringify(list)); else s.removeItem(QUEUE_KEY); } catch { /* memoria piena: pazienza */ }
  };
  async function run(fresh) {
    const queued = readQ();
    if (queued.length) writeQ([]);
    const list = mergeQueue(queued, fresh, { items: Infinity, chars: Infinity });
    const failed = [];
    let sent = 0, dropped = 0, offline = false;
    for (let i = 0; i < list.length; i += group) {
      const part = list.slice(i, i + group);
      let res = 'retry';
      if (!offline) { try { res = await post(part, chatId()); } catch { res = 'retry'; } }
      if (res === 'ok') sent += part.length;
      else if (res === 'retry') { failed.push(...part); offline = true; } else dropped += part.length;
    }
    if (failed.length) writeQ(mergeQueue(readQ(), failed, limits));
    return { sent, queued: failed.length, dropped };
  }
  const send = (clips) => {
    const fresh = (clips || []).filter(Boolean);
    chain = chain.then(() => run(fresh)).catch(() => ({ sent: 0, queued: 0, dropped: 0 }));
    return chain;
  };
  return { send, retry: () => send([]), queued: () => readQ().length };
}

export const trainSender = createTrainSender();

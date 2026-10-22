// Il percorso del combattente (21/10/2026, "tra x anni devo poter combattere in MMA").
// Le 4 tappe dell'Accademia (src/data/mmaPath.js) diventano un percorso con PROVE: si passa alla tappa
// dopo quando le prove sono fatte, non con una spunta. Tre tipi di prova:
//  - camera: misurate dal telefono (voto della combo con la camera, segreti imparati, riflessi superati);
//  - app: sedute a round del Coach Studio (minuti attivi davvero);
//  - palestra: quello che la camera non può vedere (lotta, sparring, visita medica, l'ok dell'istruttore).
// Tempi e regole dalla ricerca del 21/10 (fonti in docs/mma-coach-studio.md): prima gara dilettanti di solito
// 2–3 anni dopo l'inizio; dilettanti 3 round da 3 minuti con 1 di riposo; certificato agonistico completo.
// Più l'allenamento di oggi: il coach sceglie i blocchi dalla tappa e dai tuoi punti deboli.
import { COMBOS } from '../src/data/mmaCombos.js';
import { mmaLessons, mmaStages } from '../src/data/mmaPath.js';
import { loadPath, rankOf, unlockedMoves } from './mmaSecretPath.js';
import { DRILLS, drillStats, loadHistory, unlockedDrills } from './mmaReflex.js';

export const COMBO_SCORES_KEY = 'shadow_monarch_mma_combo_scores_v1';
export const FIGHTER_KEY = 'shadow_monarch_mma_fighter_v1';
export const COMBO_OK = 80; // voto medio con la camera per dire "combo pulita"
const DAY = 86400000;

const scoreOf = (s, id) => s.comboScores?.[id]?.best ?? 0;
const cleanAtLevel = (s, level) => COMBOS.filter((c) => c.level === level && scoreOf(s, c.id) >= COMBO_OK).length;
const learnedSecrets = (s) => rankOf(s.secret).learned;
const reflexPassed = (s, id) => Boolean(drillStats(s.reflex, id)?.passed);
// seduta vista davvero dalla camera (Coach Studio: almeno 15 s osservati e metà del tempo attivo)
const seen = (h) => h.mode === 'camera' && Boolean(h.enough);
const lessonSeen = (s, id) => (s.sessions || []).some((h) => h.lessonId === id && h.practiced && seen(h));
// n round finiti, lunghi davvero sec secondi (minuti attivi ≥ 85%: 4 round da 90 secondi non valgono 3 da 2 minuti)
const roundsOk = (h, n, sec) => {
  const done = h.completed || 0, active = h.activeMs || 0;
  return done >= n && active >= n * sec * 1000 * 0.85 && active / done >= sec * 1000 * 0.85;
};
const roundsDone = (s, n, sec, { since = 0 } = {}) => (s.sessions || []).some((h) => seen(h) && roundsOk(h, n, sec) && (Date.parse(h.date) || 0) >= since);
const gym = (s, id) => Boolean(s.gym?.[id]);

const count = (now, need) => ({ done: now >= need, now: Math.min(now, need), need });
const flag = (ok) => ({ done: Boolean(ok), now: ok ? 1 : 0, need: 1 });

// Le prove di ogni tappa: superarle tutte apre la tappa dopo
export const GATES = [
  [
    { id: 'lessons0', how: 'app', text: 'Le 5 lezioni della base fatte nel Coach Studio con la camera', test: (s) => count(mmaLessons.filter((l) => l.stage === 0 && lessonSeen(s, l.id)).length, 5) },
    { id: 'combo12', how: 'camera', text: `Combo 1-2 con la camera: media ${COMBO_OK}/100`, test: (s) => count(scoreOf(s, '1-2'), COMBO_OK) },
    { id: 'secrets2', how: 'camera', text: '2 segreti del maestro imparati (grado Allievo)', test: (s) => count(learnedSecrets(s), 2) },
    { id: 'reflexPuro', how: 'camera', text: 'Riflessi: «Riflesso puro» superato', test: (s) => flag(reflexPassed(s, 'puro')) },
    { id: 'rounds3x2', how: 'app', text: '3 round da 2 minuti nel Coach Studio, con la camera', test: (s) => flag(roundsDone(s, 3, 120)) },
    { id: 'gymStart', how: 'palestra', text: 'Prima lezione in una palestra (MMA, muay thai, boxe, lotta o BJJ)', test: (s) => flag(gym(s, 'gymStart')) },
  ],
  [
    { id: 'combosL1', how: 'camera', text: `6 combo di livello 1 pulite con la camera (media ${COMBO_OK})`, test: (s) => count(cleanAtLevel(s, 1), 6) },
    { id: 'combosL2a', how: 'camera', text: '2 combo di livello 2 pulite', test: (s) => count(cleanAtLevel(s, 2), 2) },
    { id: 'secrets4', how: 'camera', text: '4 segreti imparati (grado Combattente)', test: (s) => count(learnedSecrets(s), 4) },
    { id: 'reflexManoGamba', how: 'camera', text: 'Riflessi: «Mano o gamba» superato', test: (s) => flag(reflexPassed(s, 'manoGamba')) },
    { id: 'rounds3x3', how: 'app', text: '3 round da 3 minuti con la camera (come un incontro dilettanti)', test: (s) => flag(roundsDone(s, 3, 180)) },
    { id: 'gymRegular', how: 'palestra', text: 'In palestra almeno 2 volte a settimana da 2 mesi', test: (s) => flag(gym(s, 'gymRegular')) },
    { id: 'grappling', how: 'palestra', text: 'Basi di lotta e BJJ con l’istruttore: sprawl, rialzarsi, uscire da sotto', test: (s) => flag(gym(s, 'grappling')) },
  ],
  [
    { id: 'combosL2', how: 'camera', text: '6 combo di livello 2 pulite', test: (s) => count(cleanAtLevel(s, 2), 6) },
    { id: 'combosL3a', how: 'camera', text: '2 combo di livello 3 pulite', test: (s) => count(cleanAtLevel(s, 3), 2) },
    { id: 'secrets7', how: 'camera', text: '7 segreti imparati (grado Agonista)', test: (s) => count(learnedSecrets(s), 7) },
    { id: 'reflexSchiva', how: 'camera', text: 'Riflessi: «Schiva e rispondi» superato', test: (s) => flag(reflexPassed(s, 'schiva')) },
    { id: 'rounds4x3', how: 'app', text: '3 + 1 round da 3 minuti con la camera (il round in più è la riserva)', test: (s) => flag(roundsDone(s, 4, 180)) },
    { id: 'sparring', how: 'palestra', text: 'Sparring tecnico con l’istruttore: guantoni grandi, colpi alla testa leggeri', test: (s) => flag(gym(s, 'sparring')) },
    { id: 'wrestling', how: 'palestra', text: 'Lotta in piedi e a terra con l’istruttore: portare a terra, difendersi, rialzarsi', test: (s) => flag(gym(s, 'wrestling')) },
  ],
  [
    { id: 'secrets10', how: 'camera', text: '10 segreti imparati (grado Campione)', test: (s) => count(learnedSecrets(s), 10) },
    { id: 'reflexLeggi', how: 'camera', text: 'Riflessi: «Leggi e rispondi» superato', test: (s) => flag(reflexPassed(s, 'leggi')) },
    { id: 'combosL3', how: 'camera', text: '4 combo di livello 3 pulite', test: (s) => count(cleanAtLevel(s, 3), 4) },
    { id: 'roundsFresh', how: 'app', text: '3 + 1 round da 3 minuti con la camera negli ultimi 30 giorni', test: (s) => flag(roundsDone(s, 4, 180, { since: (s.now ?? Date.now()) - 30 * DAY })) },
    { id: 'medical', how: 'palestra', text: 'Certificato medico agonistico per l’MMA (visita sportiva, neurologo, otorino con esame dell’udito, elettroencefalogramma, oculista)', test: (s) => flag(gym(s, 'medical')) },
    { id: 'coachOk', how: 'palestra', text: 'Il tuo istruttore dice che sei pronto, dopo un camp di 8–12 settimane', test: (s) => flag(gym(s, 'coachOk')) },
  ],
];

// Quanto dura di solito ogni tappa (stima, non una regola: decide l'istruttore)
export const STAGE_TIME = ['mesi 0–3', 'mesi 3–9', 'mesi 9–18', 'mesi 18–30'];

export function gatesOf(state, stage) {
  return (GATES[stage] || []).map((g) => ({ id: g.id, how: g.how, text: g.text, ...g.test(state) }));
}

// La tappa in cui sei: la prima con una prova ancora da fare (4 = pronto per il primo incontro).
// Una tappa superata resta superata (state.reached): il diario del Coach Studio tiene solo le ultime 80 sedute.
export function currentStage(state) {
  for (let i = Math.min(state.reached || 0, GATES.length); i < GATES.length; i += 1) if (gatesOf(state, i).some((g) => !g.done)) return i;
  return GATES.length;
}

export function pathSummary(state) {
  const stage = currentStage(state);
  const gates = stage < GATES.length ? gatesOf(state, stage) : [];
  return {
    stage, ready: stage >= GATES.length,
    name: stage < GATES.length ? mmaStages[stage].name : 'Pronto per il primo incontro',
    time: STAGE_TIME[stage] || 'prima gara dilettanti: 3 round da 3 minuti',
    gates, done: gates.filter((g) => g.done).length,
  };
}

// ── Allenamento di oggi ────────────────────────────────────────────────
const WARMUP = [
  { text: 'Cammina sul posto e sciogli spalle e anche.', sec: 60 },
  { text: 'Saltelli leggeri sulle punte, ginocchia morbide.', sec: 60 },
  { text: 'Ruota busto e braccia, poi apri il petto.', sec: 45 },
  { text: 'Guardia: passi corti avanti, indietro e di lato.', sec: 60 },
  { text: 'Shadow lento: jab e diretto a metà velocità. Espira corto su ogni colpo: tss.', sec: 75 },
];
// recupero: 5 secondi dentro e 5 fuori (dopo lo sforzo ha abbassato il battito più del respiro "a scatola")
const COOLDOWN = [
  { text: 'Cammina piano e scuoti braccia e gambe.', sec: 45 },
  { text: 'Respiro lento: inspira dal naso per 5 secondi, espira per 5. Continua così.', sec: 90, breath: true },
  { text: 'Allunga spalle, petto e anche, senza molleggiare.', sec: 60 },
];
const ROUNDS = [{ rounds: 3, sec: 120 }, { rounds: 3, sec: 180 }, { rounds: 4, sec: 180 }, { rounds: 4, sec: 180 }];

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// La combo su cui lavorare: prima la mossa segreta sbloccata e non ancora pulita, poi la più vicina al traguardo
export function comboForToday(state, stage) {
  const maxLevel = Math.min(3, stage + 1);
  const secret = unlockedMoves(state.secret).map((m) => COMBOS.find((c) => c.id === m.combo)).find((c) => c && scoreOf(state, c.id) < COMBO_OK);
  if (secret) return { combo: secret, why: `la tua mossa segreta sbloccata: portala a ${COMBO_OK}` };
  const pool = COMBOS.filter((c) => c.level === maxLevel || c.level === Math.max(1, maxLevel - 1));
  const open = pool.filter((c) => scoreOf(state, c.id) < COMBO_OK);
  // prima quelle già provate e non ancora pulite (le più vicine al traguardo), poi le nuove in ordine
  const tried = open.filter((c) => state.comboScores?.[c.id]).sort((a, b) => scoreOf(state, b.id) - scoreOf(state, a.id));
  const pick = tried[0] || open[0] || pool.sort((a, b) => (state.comboScores?.[a.id]?.at || 0) - (state.comboScores?.[b.id]?.at || 0))[0];
  return pick ? { combo: pick, why: tried[0] ? `media ${scoreOf(state, pick.id)}: manca poco a ${COMBO_OK}` : open[0] ? 'nuova per la tua tappa' : 'ripasso: è la più vecchia' } : null;
}

// L'esercizio di riflessi giusto: il primo aperto e non ancora superato, se no l'ultimo aperto
export function reflexForToday(state) {
  const open = unlockedDrills(state.reflex);
  const id = open.find((d) => !drillStats(state.reflex, d)?.passed) || open[open.length - 1];
  return DRILLS.find((d) => d.id === id);
}

// Le scelte del giorno (tappa, esercizio di riflessi, lezione, combo). Si fissano alla prima apertura del giorno
// (freezeToday): così un blocco appena superato resta quello fatto, invece di diventare subito il successivo.
export function todayPicks(state, now = Date.now()) {
  const stage = Math.min(currentStage(state), GATES.length - 1);
  // riflessi: da riposati e 2–3 volte a settimana (la stanchezza li rende meno costanti)
  const lastReflex = Math.max(0, ...Object.values(state.reflex?.drills || {}).flat().map((x) => x.at || 0));
  const reflexDue = now - lastReflex >= 1.5 * DAY || sameDay(lastReflex, now);
  const drill = reflexDue ? reflexForToday(state) : null;
  const tech = mmaLessons.filter((l) => l.stage === stage && l.id !== 'rounds');
  const fresh = tech.find((l) => !lessonSeen(state, l.id));
  const lesson = fresh || tech[Math.floor(now / DAY) % tech.length];
  const pick = comboForToday(state, stage);
  return { stage, drill: drill?.id || null, lesson: lesson?.id || null, lessonWhy: fresh ? 'prossima lezione della tua tappa' : 'ripasso della tappa', combo: pick?.combo.id || null, comboWhy: pick?.why || '' };
}
const frozenPicks = (state, now) => (state.today?.picks && sameDay(state.today.date, now) ? state.today.picks : null);

export function planToday(state, { minutes = 40, now = Date.now() } = {}) {
  const frozen = frozenPicks(state, now);
  const p = frozen || todayPicks(state, now);
  const stage = Math.max(0, Math.min(Number(p.stage) || 0, GATES.length - 1));
  const blocks = [];
  const add = (b) => blocks.push(b);
  add({ id: 'warmup', kind: 'guided', title: 'Riscaldamento', minutes: 5, why: 'prepara articolazioni e respiro', steps: WARMUP });
  const drill = DRILLS.find((d) => d.id === p.drill);
  if (drill) add({ id: 'reflex', kind: 'reflex', title: `Riflessi · ${drill.name}`, minutes: 8, why: 'subito dopo il riscaldamento, quando sei fresco', drill: drill.id });
  const lesson = minutes >= 40 && mmaLessons.find((l) => l.id === p.lesson);
  if (lesson) add({ id: 'lesson', kind: 'lesson', title: `Tecnica · ${lesson.title}`, minutes: minutes >= 60 ? 15 : 10, why: p.lessonWhy || 'lezione della tua tappa', lesson: lesson.id });
  const combo = COMBOS.find((c) => c.id === p.combo);
  if (combo && (minutes >= 40 || !drill)) add({ id: 'combo', kind: 'combo', title: `Combo con la camera · ${combo.name}`, minutes: 8, why: p.comboWhy || 'combo della tua tappa', combo: combo.id });
  const r = minutes >= 40 ? ROUNDS[stage] : { rounds: 2, sec: 120 };
  add({ id: 'rounds', kind: 'rounds', title: `Round di shadow · ${r.rounds} × ${r.sec / 60} min`, minutes: Math.round((r.rounds * r.sec + (r.rounds - 1) * 60) / 60), why: 'il fiato da combattimento si costruisce a round; nel minuto di pausa respiro 5-5', rounds: r.rounds, sec: r.sec });
  add({ id: 'cooldown', kind: 'guided', title: 'Defaticamento e respiro 5-5', minutes: 3, why: 'abbassa il battito prima di finire', steps: COOLDOWN });
  const gymNote = stage >= 1 ? 'La lotta e il BJJ si imparano solo in palestra con un istruttore: almeno 2 volte a settimana, oltre a questo.' : 'Cerca una palestra di MMA, muay thai o lotta vicino a te: il coach ti prepara, ma a combattere si impara lì.';
  return { stage, minutes: blocks.reduce((s, b) => s + b.minutes, 0), blocks, gymNote, picks: p, frozen: Boolean(frozen) };
}

// Fatto oggi? Si guarda nei dati veri: riflessi salvati, voto della combo, seduta del Coach Studio
export function blockDone(block, state, now = Date.now()) {
  if (block.kind === 'reflex') return (state.reflex?.drills?.[block.drill] || []).some((x) => sameDay(x.at, now));
  if (block.kind === 'combo') return Boolean(state.comboScores?.[block.combo]?.at && sameDay(state.comboScores[block.combo].at, now));
  const today = (state.sessions || []).filter((h) => sameDay(Date.parse(h.date), now));
  // la lezione conta se praticata; i round se tutti finiti e lunghi davvero (la versione "breve" 2 × 1 min no)
  if (block.kind === 'lesson') return today.some((h) => h.lessonId === block.lesson && h.practiced);
  if (block.kind === 'rounds') return today.some((h) => h.lessonId === 'rounds' && roundsOk(h, block.rounds, block.sec));
  return Boolean(state.today?.date && sameDay(state.today.date, now) && state.today.done?.[block.id]);
}

// ── Salvataggi ─────────────────────────────────────────────────────────
const readJson = (storage, key) => { try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };

// Tutto quello che serve al percorso, letto dai salvataggi veri (mmaStore = readMmaStore() dell'Accademia)
export function fighterState({ mmaStore = {}, storage = globalThis.localStorage, now = Date.now() } = {}) {
  const f = readFighter(storage);
  return {
    now, lessonsDone: mmaStore.done || {}, sessions: Array.isArray(mmaStore.history) ? mmaStore.history.filter((h) => h && typeof h === 'object') : [],
    comboScores: readScores(storage), secret: loadPath(storage), reflex: loadHistory(storage), gym: f.gym, today: f.today, minutes: f.minutes, reached: f.reached,
  };
}

const isObj = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
// solo voti ben fatti: un backup rovinato non deve bloccare la pagina
function readScores(storage) {
  const raw = readJson(storage, COMBO_SCORES_KEY);
  return isObj(raw) ? Object.fromEntries(Object.entries(raw).filter(([, v]) => isObj(v) && Number.isFinite(v.best))) : {};
}

// voto della combo con la camera: il migliore e l'ultimo (dal coach con camera, a fine serie)
export function recordComboScore(comboId, avg, { at = Date.now(), storage = globalThis.localStorage } = {}) {
  const all = readScores(storage);
  const prev = all[comboId] || { best: 0, n: 0 };
  all[comboId] = { best: Math.max(prev.best || 0, avg), last: avg, n: (prev.n || 0) + 1, at };
  try { storage?.setItem(COMBO_SCORES_KEY, JSON.stringify(all)); } catch { /* memoria piena */ }
  return all[comboId];
}

export function readFighter(storage = globalThis.localStorage) {
  const f = readJson(storage, FIGHTER_KEY) || {};
  return {
    gym: isObj(f.gym) ? f.gym : {}, today: isObj(f.today) ? f.today : null, minutes: [20, 40, 60].includes(f.minutes) ? f.minutes : 40,
    reached: Number.isInteger(f.reached) && f.reached >= 0 && f.reached <= GATES.length ? f.reached : 0,
  };
}

export function saveFighter(patch, storage = globalThis.localStorage) {
  const next = { ...readFighter(storage), ...patch };
  try { storage?.setItem(FIGHTER_KEY, JSON.stringify(next)); } catch { /* memoria piena */ }
  return next;
}

// Le prove di palestra si spuntano a mano (la camera non c'è): si può anche togliere la spunta
export function toggleGym(id, storage = globalThis.localStorage, at = Date.now()) {
  const { gym: g } = readFighter(storage);
  const next = { ...g };
  if (next[id]) delete next[id]; else next[id] = at;
  return saveFighter({ gym: next }, storage);
}

// fissa le scelte di oggi alla prima apertura del giorno (le spunte di oggi restano)
export function freezeToday(picks, storage = globalThis.localStorage, now = Date.now()) {
  const { today } = readFighter(storage);
  const same = today && sameDay(today.date, now);
  if (same && today.picks) return readFighter(storage);
  return saveFighter({ today: { date: now, done: same && isObj(today.done) ? today.done : {}, picks } }, storage);
}

// una tappa superata non si perde più
export function saveReached(stage, storage = globalThis.localStorage) {
  const f = readFighter(storage);
  return stage > f.reached ? saveFighter({ reached: Math.min(stage, GATES.length) }, storage) : f;
}

export function markTodayDone(blockId, storage = globalThis.localStorage, now = Date.now()) {
  const { today } = readFighter(storage);
  const t = today && sameDay(today.date, now) ? today : { date: now, done: {} };
  return saveFighter({ today: { ...t, done: { ...t.done, [blockId]: true } } }, storage);
}

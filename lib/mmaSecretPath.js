// Il percorso dei segreti (21/10/2026, "i segreti me li insegna e verifica? … portiamo al prossimo livello").
// Insegna → verifica → promuovi:
//  1. il coach spiega UN segreto (masterSecret in lib/mmaComboJudge.js), uno alla volta come un maestro;
//  2. nelle ripetizioni dopo guarda lo STESSO colpo: se l'errore sparisce in 2 delle 3 prove
//     il segreto è applicato e resta imparato; altrimenti ripete la correzione corta e lo rispiega più avanti;
//  3. i segreti imparati fanno salire di grado, e ogni grado sblocca una mossa segreta
//     (una tecnica che il coach sa giudicare) con il suo segreto e la combo per allenarla.
// Logica pura e testabile; sul telefono si salvano solo i segreti imparati (loadPath/savePath).

// con il prefisso shadow_monarch_ entra nel backup automatico (App.jsx): cambiando telefono non si perde il grado
export const PATH_KEY = 'shadow_monarch_mma_secret_path_v1';
export const CHECK_REPS = 3; // prove per verificare un segreto
export const NEED_OK = 2;    // prove senza l'errore per dirlo applicato

export const RANKS = [
  { min: 0, name: 'Prime armi' },
  { min: 2, name: 'Allievo' },
  { min: 4, name: 'Combattente' },
  { min: 7, name: 'Agonista' },
  { min: 10, name: 'Campione' },
];

// Una mossa segreta per grado: solo colpi che il giudice riconosce, ognuno con una combo della libreria
export const SECRET_MOVES = [
  { id: 'bodyHook', combo: '3b-3', at: 2, text: 'Il gancio al fegato: scendi piegando le ginocchia verso il lato del colpo, gomito vicino al fianco, e il pugno entra sotto il suo gomito. Poi risali col gancio alla testa: per proteggere il fegato abbassa la guardia, e la testa resta aperta.' },
  { id: 'teep', combo: 'teep-1-2', at: 4, text: 'Il teep è il jab delle gambe: prima sale il ginocchio, poi spingi con la pianta del piede nella pancia, anca in avanti. Ferma chi avanza e ti dà la distanza giusta per l’1-2.' },
  { id: 'switchKick', combo: 'sw-2', at: 7, text: 'Lo switch kick nasce da un passo piccolo e veloce: il piede avanti torna indietro e l’anca gira subito, carica come una molla. Il diretto dopo arriva mentre lui pensa ancora alla tua gamba.' },
  { id: 'headKick', combo: '1-2-hk', at: 10, text: 'Il calcio alto si nasconde dietro i pugni: l’1-2 chiude la sua guardia al centro, il calcio arriva dal lato dove la mano non c’è più. Parte come il calcio al corpo: la differenza la fa l’anca che sale.' },
];

export const emptyPath = () => ({ learned: {}, pending: null });

export const learnedCount = (path) => Object.keys(path?.learned || {}).length;

export function rankOf(path) {
  const n = learnedCount(path);
  let i = 0;
  RANKS.forEach((r, k) => { if (n >= r.min) i = k; });
  return { ...RANKS[i], index: i, learned: n, next: RANKS[i + 1] || null };
}

export const unlockedMoves = (path) => SECRET_MOVES.filter((m) => learnedCount(path) >= m.at);

// Un segreto appena spiegato: da ora si verifica (uno alla volta)
export function startSecret(path, secret) {
  if (!secret || path.pending) return path;
  return { ...path, pending: { key: secret.key, id: secret.id, issue: secret.issue, cue: secret.cue || '', tries: 0, ok: 0 } };
}

// Una ripetizione finita: il segreto in prova è stato applicato?
// Conta solo se il colpo del segreto c'è ed è stato visto (se manca, quella prova non vale).
export function checkRep(path, result, now = Date.now()) {
  const p = path?.pending;
  if (!p) return { path, event: null };
  const mv = (result?.moves || []).find((m) => m.id === p.id && m.gesture);
  if (!mv) return { path, event: null };
  const still = mv.issues.some((it) => it.key === p.issue);
  const next = { ...p, tries: p.tries + 1, ok: p.ok + (still ? 0 : 1) };
  if (next.ok >= NEED_OK) {
    const after = { learned: { ...path.learned, [p.key]: now }, pending: null };
    const unlocked = SECRET_MOVES.filter((m) => learnedCount(after) >= m.at && learnedCount(path) < m.at);
    const promoted = rankOf(after).index > rankOf(path).index ? rankOf(after) : null;
    return { path: after, event: { type: 'applied', key: p.key, id: p.id, promoted, unlocked } };
  }
  if (next.tries >= CHECK_REPS) return { path: { ...path, pending: null }, event: { type: 'retry', key: p.key, id: p.id, cue: p.cue } };
  return { path: { ...path, pending: next }, event: null };
}

// Segreti da non spiegare adesso: già imparati o già in prova
export const skipKeys = (path) => [...Object.keys(path?.learned || {}), ...(path?.pending ? [path.pending.key] : [])];

// Salvataggio sul telefono: solo i segreti imparati (la prova in corso vale per questa sessione)
export function loadPath(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PATH_KEY);
    const learned = raw ? JSON.parse(raw)?.learned : null;
    return { learned: learned && typeof learned === 'object' ? learned : {}, pending: null };
  } catch { return emptyPath(); }
}

export function savePath(path, storage = globalThis.localStorage) {
  try { storage?.setItem(PATH_KEY, JSON.stringify({ learned: path.learned })); } catch { /* memoria piena o privata: pazienza */ }
}

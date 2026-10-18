// Dove finiscono le clip dello scheletro mandate dal coach MMA (api/nvidia/visual.js, poseClip).
// Logica pura: dice quale lista Upstash, quante clip tenere e per quanto. Testabile senza rete.
// - teach / rep / session: insegnamento e "Il coach ha sbagliato" → mma_clips:<chatId>
// - train: ogni ripetizione con il giudizio di Emanuele (registro degli allenamenti) → mma_train:<chatId>
export const CLIP_LISTS = {
  teach: { prefix: 'mma_clips', keep: 150, days: 120 },
  rep: { prefix: 'mma_clips', keep: 150, days: 120 },
  session: { prefix: 'mma_clips', keep: 150, days: 120 },
  train: { prefix: 'mma_train', keep: 800, days: 180 },
};
export const CLIP_MAX_CHARS = 150000; // una clip (già con kind e data) non può superarli
export const CLIP_MAX_ITEMS = 8;      // clip per richiesta

export function planPoseClip(poseClip, chatId, now = new Date()) {
  const kind = Object.prototype.hasOwnProperty.call(CLIP_LISTS, poseClip?.kind) ? poseClip.kind : 'rep';
  const list = CLIP_LISTS[kind];
  const items = (Array.isArray(poseClip?.items) ? poseClip.items : []).slice(0, CLIP_MAX_ITEMS)
    .map((it) => JSON.stringify({ ...it, kind, ts: now.toISOString() }))
    .filter((raw) => raw.length <= CLIP_MAX_CHARS);
  if (!items.length) return { error: 'clip vuota o troppo grande' };
  const key = `${list.prefix}:${chatId}`;
  return {
    kind, key, items,
    commands: [...items.map((raw) => ['RPUSH', key, raw]), ['LTRIM', key, String(-list.keep), '-1'], ['EXPIRE', key, String(list.days * 86400)]],
  };
}

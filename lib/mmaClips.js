// Clip di movimento per migliorare il coach: SOLO i punti dello scheletro (17 articolazioni),
// niente immagini né video. 3D in millimetri, 2D in millesimi dell'immagine, visibilità in %.
// Dal 21/10/2026 anche talloni e punte dei piedi (29-32): servono a misurare la rotazione del piede
// dietro nel diretto. Le clip vecchie restano leggibili: chi le legge usa l'elenco `j` della clip.
export const CLIP_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const BODY_JOINTS = CLIP_JOINTS.slice(0, 13);
const r = Math.round;

export function encodeClip(frames, { from = -Infinity, to = Infinity, ...meta } = {}) {
  const sel = (frames || []).filter((f) => f.t >= from && f.t <= to && Array.isArray(f.world) && f.world.length > 28);
  if (!sel.length) return null;
  const t0 = sel[0].t;
  // i piedi solo se ogni fotogramma li ha (una clip ha un solo elenco di articolazioni)
  const J = sel.every((f) => f.world.length > 32 && (!Array.isArray(f.points) || f.points.length > 32)) ? CLIP_JOINTS : BODY_JOINTS;
  return {
    v: 1, ...meta, j: J,
    t: sel.map((f) => r(f.t - t0)),
    w: sel.map((f) => J.flatMap((i) => [r(f.world[i].x * 1000), r(f.world[i].y * 1000), r((f.world[i].z || 0) * 1000)])),
    p: sel.map((f) => (Array.isArray(f.points) && f.points.length > 28 ? J.flatMap((i) => [r(f.points[i].x * 1000), r(f.points[i].y * 1000), r((f.points[i].visibility ?? 1) * 100)]) : null)),
  };
}

// Invio a gruppi (il server tiene le ultime 150 clip per utente)
export async function sendClips(clips, { chatId, kind } = {}) {
  const list = (clips || []).filter(Boolean);
  for (let i = 0; i < list.length; i += 6) {
    try {
      await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, poseClip: { kind, items: list.slice(i, i + 6) } }),
      });
    } catch { /* offline: pazienza, non blocca l'allenamento */ }
  }
}

export const readChatId = () => { try { return localStorage.getItem('shadow_monarch_tg_chat_id') || ''; } catch { return ''; } };

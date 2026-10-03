// Clip di movimento per migliorare il coach: SOLO i punti dello scheletro (13 articolazioni),
// niente immagini né video. 3D in millimetri, 2D in millesimi dell'immagine, visibilità in %.
export const CLIP_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const r = Math.round;

export function encodeClip(frames, { from = -Infinity, to = Infinity, ...meta } = {}) {
  const sel = (frames || []).filter((f) => f.t >= from && f.t <= to && Array.isArray(f.world) && f.world.length > 28);
  if (!sel.length) return null;
  const t0 = sel[0].t;
  return {
    v: 1, ...meta, j: CLIP_JOINTS,
    t: sel.map((f) => r(f.t - t0)),
    w: sel.map((f) => CLIP_JOINTS.flatMap((i) => [r(f.world[i].x * 1000), r(f.world[i].y * 1000), r((f.world[i].z || 0) * 1000)])),
    p: sel.map((f) => (Array.isArray(f.points) && f.points.length > 28 ? CLIP_JOINTS.flatMap((i) => [r(f.points[i].x * 1000), r(f.points[i].y * 1000), r((f.points[i].visibility ?? 1) * 100)]) : null)),
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

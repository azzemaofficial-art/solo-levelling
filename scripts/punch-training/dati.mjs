// Dati del banco di prova dei colpi (BoxingVI, arXiv 2511.16524). Tutto in tests/fixtures/private/
// (fuori da git: il repo è pubblico). Vedi README.md per come si preparano.
// - boxingvi-pugni.json.gz: per ogni video atleta, link, pugni etichettati (fotogrammi, tipo) e lo
//   scheletro AlphaPose di ogni pugno (indici MediaPipe).
// - boxingvi-lite/V<n>.json.gz: il video letto da MediaPipe Lite a 25 fps come al telefono (13 punti).
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const PRIV = new URL('../../tests/fixtures/private/', import.meta.url);
// (BOXINGVI_LITE = un'altra cartella, es. la copia completa fuori da iCloud)
const LITE = process.env.BOXINGVI_LITE ? pathToFileURL(process.env.BOXINGVI_LITE.replace(/\/?$/, '/')) : new URL('boxingvi-lite/', PRIV);
export const ARM_OF = { jab: 'lead', hook: 'lead', uppercut: 'lead', cross: 'rear', rearHook: 'rear', rearUppercut: 'rear' };
export const KIND_OF = { jab: 'straight', cross: 'straight', hook: 'hook', rearHook: 'hook', uppercut: 'uppercut', rearUppercut: 'uppercut' };
export const MOVE_OF = { lead: { straight: 'jab', hook: 'hook', uppercut: 'uppercut' }, rear: { straight: 'cross', hook: 'rearHook', uppercut: 'rearUppercut' } };
// V6 ha solo ganci e montanti etichettati (i diretti ci sono ma non hanno etichetta): niente "colpi inventati" lì
export const PARTIAL_LABELS = new Set([6]);

const gz = (u) => JSON.parse(gunzipSync(readFileSync(u)).toString());
export const available = () => existsSync(new URL('boxingvi-pugni.json.gz', PRIV));
export const hasStream = (v) => existsSync(new URL(`V${v}.json.gz`, LITE));

let cache = null;
export function loadPunches() {
  cache ??= gz(new URL('boxingvi-pugni.json.gz', PRIV));
  return cache;
}

// Guardia del video: il jab parte dal polso SINISTRO (destro per i mancini) nell'immagine AlphaPose
export function stanceOf(video, j) {
  const iL = j.indexOf(15), iR = j.indexOf(16);
  let l = 0, r = 0;
  for (const p of video.punches) {
    if (p.move !== 'jab' || p.ap.length < 3) continue;
    const d = (i) => Math.max(...p.ap.map((f) => Math.hypot(f[i * 2] - p.ap[0][i * 2], f[i * 2 + 1] - p.ap[0][i * 2 + 1])));
    if (d(iL) > d(iR)) l += 1; else r += 1;
  }
  return l >= r ? 'orthodox' : 'southpaw';
}

const blank = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
const blankW = () => Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));

// Un video letto da Lite: fotogrammi { t, points, world } (points = null se la persona non c'è) e
// pugni { move, arm, kind, t0, t1, ap } nello stesso tempo (ms dall'inizio del tratto letto)
export function loadStream(v) {
  const all = loadPunches();
  const video = all.videos.find((x) => x.v === v);
  const s = gz(new URL(`V${v}.json.gz`, LITE));
  const frames = s.frames.map(([t, p, w]) => {
    if (!p) return { t, points: null, world: null };
    const points = blank(), world = blankW();
    s.j.forEach((jj, k) => {
      points[jj] = { x: p[k * 3] / 1000, y: p[k * 3 + 1] / 1000, visibility: p[k * 3 + 2] / 100 };
      world[jj] = { x: w[k * 3] / 1000, y: w[k * 3 + 1] / 1000, z: w[k * 3 + 2] / 1000, visibility: p[k * 3 + 2] / 100 };
    });
    return { t, points, world };
  });
  const ms = (f) => (f * 1000) / s.fps_src - s.start_ms;
  const labels = video.punches.map((p) => ({ move: p.move, arm: ARM_OF[p.move], kind: KIND_OF[p.move], t0: ms(p.s), t1: ms(p.e), ap: p.ap }))
    .filter((l) => l.t0 >= 0 && l.t1 <= frames.at(-1).t);
  return { v, athlete: video.athlete, stance: stanceOf(video, all.j), aspect: s.aspect, frames, labels, j: all.j, fps: s.fps, fpsSrc: s.fps_src };
}

// AlphaPose di un pugno → fotogrammi { t, points } in coordinate MediaPipe (fps del video)
export function apFrames(label, j, fpsSrc, aspectFix = 1) {
  return label.ap.map((f, i) => {
    const points = blank();
    j.forEach((jj, k) => { points[jj] = { x: f[k * 2] / 1000, y: f[k * 2 + 1] / 1000, visibility: 1 }; });
    return { t: label.t0 + (i * 1000) / fpsSrc, points };
  });
}

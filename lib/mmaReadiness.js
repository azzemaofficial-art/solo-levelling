// "Sei pronto?" — controllo dell'inquadratura e della guardia prima di allenarsi.
// Tollerante per davvero: la guardia si misura in 3D (world landmarks), la mano
// dietro può essere coperta dal corpo quando sei di tre quarti, e un fotogramma
// storto non azzera la barra (sale piano, scende piano).

const inFrame = (p, vis = 0.5) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= vis && p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99;
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });

export const READY = {
  guardReach: 0.8,   // polso-naso entro 0,8 busti (~35–40 cm)
  guardDrop: 0.3,    // (3D, polso coperto) non più di 0,3 busti sotto la linea delle spalle
  guardLine: 0.02,   // (2D) polso sopra la linea della sua spalla
  profileDeg: 72,    // oltre = sei di profilo: la mano dietro sparisce
  tooCloseW: 0.62,   // spalle più larghe del 62% dell'immagine = troppo vicino
};

// Una mano è in guardia? Prima il 3D, se manca il 2D.
function handGuard(points, world, S, aspect) {
  const [sh, wr] = S === 'L' ? [11, 15] : [12, 16];
  // prima l'immagine: il pugno deve stare sopra la linea della SUA spalla (guardia vera)
  if (inFrame(points[wr], 0.4) && inFrame(points[sh], 0.4)) {
    const T = Math.hypot(((points[11].x + points[12].x) / 2 - (points[23].x + points[24].x) / 2) * aspect, (points[11].y + points[12].y) / 2 - (points[23].y + points[24].y) / 2) || 0.3;
    const reach = Math.hypot((points[wr].x - points[0].x) * aspect, points[wr].y - points[0].y) / T;
    return (points[wr].y - points[sh].y) / T < READY.guardLine && reach < READY.guardReach * 1.2;
  }
  // polso coperto (tre quarti): stima 3D, più tollerante
  if (world?.length > 28) {
    const torso = d3(mid(world[11], world[12]), mid(world[23], world[24])) || 0.5;
    const shY = (world[11].y + world[12].y) / 2;
    return d3(world[wr], world[0]) / torso < READY.guardReach && (world[wr].y - shY) / torso < READY.guardDrop;
  }
  const p = points;
  if (!inFrame(p[wr], 0.3) || !inFrame(p[sh], 0.3)) return false;
  const torso = Math.hypot(((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * aspect, (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2) || 0.3;
  const reach = Math.hypot((p[wr].x - p[0].x) * aspect, p[wr].y - p[0].y) / torso;
  return reach < READY.guardReach && (p[wr].y - (p[11].y + p[12].y) / 2) / torso < READY.guardDrop;
}

// Legge un fotogramma. needFeet: servono anche i piedi (calci, ginocchia, sprawl).
export function readPose(points, world, { aspect = 1, needFeet = false } = {}) {
  if (!Array.isArray(points) || points.length < 29) return { visible: false, ok: false, hint: 'Entra nell’inquadratura: mi servono testa, spalle e bacino.', key: 'frame' };
  const core = [0, 11, 12, 23, 24].every((i) => inFrame(points[i]));
  if (!core) {
    const headCut = points[0] && (points[0].y < 0.02 || (points[0].visibility ?? 0) < 0.5);
    const hipsCut = [23, 24].some((i) => !inFrame(points[i]));
    return { visible: false, ok: false, key: 'frame', hint: headCut && !hipsCut ? 'Abbassa un po’ il telefono o fai un passo indietro: non vedo la testa.' : hipsCut && !headCut ? 'Fai un passo indietro: mi serve anche il bacino.' : 'Entra nell’inquadratura: mi servono testa, spalle e bacino.' };
  }
  const feet = [27, 28].every((i) => inFrame(points[i], 0.4));
  const shoulderW = Math.abs(points[11].x - points[12].x) * aspect;
  const yaw = world?.length > 12 ? Math.atan2(Math.abs((world[12].z || 0) - (world[11].z || 0)), Math.abs(world[12].x - world[11].x)) * 180 / Math.PI : null;
  const guard = { L: handGuard(points, world, 'L', aspect), R: handGuard(points, world, 'R', aspect) };
  guard.both = guard.L && guard.R;
  let key = 'ok', hint = 'Perfetto, resta in guardia…';
  if (shoulderW > READY.tooCloseW) { key = 'close'; hint = 'Troppo vicino: fai un passo indietro.'; }
  else if (needFeet && !feet) { key = 'feet'; hint = 'Allontanati ancora: per i calci mi servono anche i piedi.'; }
  else if (yaw != null && yaw > READY.profileDeg) { key = 'profile'; hint = 'Sei di profilo: girati un po’ verso il telefono, di tre quarti.'; }
  else if (!guard.both) { key = 'guard'; hint = !guard.L && !guard.R ? 'Mani su, in guardia vicino al viso.' : 'Anche l’altra mano su, vicino alla guancia.'; }
  return { visible: true, full: feet, guard, yaw, key, hint, ok: key === 'ok' };
}

// Barra "pronto": sale in holdMs con posa buona, scende a metà velocità se no.
export function createReadiness({ holdMs = 1300 } = {}) {
  let progress = 0, lastT = null;
  return {
    reset() { progress = 0; lastT = null; },
    update(ok, t) {
      const dt = lastT == null ? 0 : Math.min(200, Math.max(0, t - lastT)); lastT = t;
      progress = Math.max(0, Math.min(1, progress + (ok ? dt / holdMs : -dt / (holdMs * 2))));
      return progress;
    },
    get progress() { return progress; },
    get done() { return progress >= 1; },
  };
}

// Posa nel formato dell'osservatore delle lezioni (lib/mmaCoachEngine.js, modalità external).
// busy = { L, R }: braccio impegnato in un colpo (dal giudice 3D) → non conta come guardia bassa.
export function observerPose(read, points, aspect = 1, busy = {}) {
  if (!read.visible) return { visible: false, full: false };
  const sh = { x: (points[11].x + points[12].x) / 2, y: (points[11].y + points[12].y) / 2 };
  const hip = { x: (points[23].x + points[24].x) / 2, y: (points[23].y + points[24].y) / 2 };
  const arm = (S) => ({ guard: read.guard[S], high: read.guard[S], extended: Boolean(busy[S]), angle: null });
  return {
    visible: true, full: read.full, arms: { L: arm('L'), R: arm('R') },
    lean: Math.atan2(Math.abs(sh.x - hip.x) * aspect, Math.abs(hip.y - sh.y)) * 180 / Math.PI,
    torso: Math.hypot((sh.x - hip.x) * aspect, sh.y - hip.y), center: sh, bothGuard: read.guard.both,
  };
}

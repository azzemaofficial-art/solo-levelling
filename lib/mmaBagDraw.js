// Disegno del sacco sopra la camera: contorno tenue e bersagli numerati che si accendono.
// Si chiama dall'overlay di useMmaCamera, dopo lo scheletro, nelle sue stesse coordinate
// (punti 0–1 × W/H, immagine NON specchiata). Il canvas è specchiato via CSS con la camera
// frontale: i numeri si raddrizzano a mano (state.mirrored).
//
// state = {
//   bag,            risultato di analyzeBag (outline, box)
//   mode,           'confirm' (contorno forte, da approvare) | 'live' (contorno tenue + bersagli)
//   targets,        da bagTargets
//   next,           i del colpo atteso adesso (-1 = nessuno)
//   hits,           { [i]: momento del contatto } colpi a segno
//   flashes,        [{ x, y, t, S }] contatti appena visti (anche fuori combo)
//   offsetX,        oscillazione del sacco (0–1 di larghezza), da createBagContacts().state()
//   mirrored,
// }

const SIDE = { L: '109,226,211', R: '184,164,255' };
const GOLD = '255,207,153';
const FLASH_MS = 420;

export function drawBag(ctx, W, H, state, now = 0) {
  const bag = state?.bag;
  if (!ctx || !bag?.outline?.length || !(W > 0) || !(H > 0)) return;
  const lw = Math.max(3, W / 160);
  const off = Number.isFinite(state.offsetX) ? state.offsetX : 0;
  const confirm = state.mode === 'confirm';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // contorno: lato sinistro dall'alto in basso, poi il destro dal basso in alto
  const pts = [...bag.outline.map((o) => [(o.l + off) * W, o.y * H]), ...bag.outline.slice().reverse().map((o) => [(o.r + off) * W, o.y * H])];
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (confirm) {
    // da approvare: ben visibile, che "respira" piano
    const a = 0.75 + 0.2 * Math.sin(now / 260);
    ctx.fillStyle = `rgba(${GOLD},.12)`; ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD},${a})`; ctx.lineWidth = lw * 1.1; ctx.setLineDash([]); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(224,240,255,.26)'; ctx.lineWidth = lw * 0.55; ctx.setLineDash([lw * 2, lw * 1.6]); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!confirm) {
    const hits = state.hits || {};
    const order = (state.targets || []).map((tg) => tg.i);
    const nextPos = order.indexOf(state.next);
    (state.targets || []).forEach((tg, k) => drawTarget(ctx, W, H, tg, {
      lw, off, now, mirrored: state.mirrored,
      hitAt: hits[tg.i],
      status: hits[tg.i] != null ? 'hit' : nextPos < 0 ? 'idle' : k === nextPos ? 'next' : k > nextPos ? 'later' : 'missed',
    }));
  }
  // contatti appena visti: un anello che si allarga e svanisce
  for (const f of state.flashes || []) {
    const age = now - f.t;
    if (!(age >= 0 && age < FLASH_MS)) continue;
    const u = age / FLASH_MS, rad = (0.08 + 0.1 * u) * bag.width * W * 3;
    ctx.strokeStyle = `rgba(${SIDE[f.S] || GOLD},${0.9 * (1 - u)})`;
    ctx.lineWidth = lw * (1.4 - 0.8 * u);
    ctx.beginPath(); ctx.arc((f.x + off) * W, f.y * H, rad, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawTarget(ctx, W, H, tg, { lw, off, now, mirrored, hitAt, status }) {
  const x = (tg.x + off) * W, y = tg.y * H, rad = Math.max(lw * 3, tg.r * W);
  const col = SIDE[tg.S] || GOLD;
  let ring = 0.35, fill = 0, width = lw * 0.7, text = 0.55;
  if (status === 'next') { const p = 0.5 + 0.5 * Math.sin(now / 150); ring = 0.65 + 0.3 * p; fill = 0.12 + 0.1 * p; width = lw * (1 + 0.25 * p); text = 1; }
  else if (status === 'later' || status === 'idle') { ring = 0.38; text = 0.6; }
  else if (status === 'missed') { ring = 0.16; text = 0.3; }
  else if (status === 'hit') { ring = 0.95; fill = 0.5; width = lw; text = 1; }
  ctx.setLineDash(status === 'missed' ? [lw, lw] : []);
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
  if (fill > 0) { ctx.fillStyle = `rgba(${col},${fill})`; ctx.fill(); }
  ctx.strokeStyle = `rgba(${col},${ring})`; ctx.lineWidth = width; ctx.stroke();
  ctx.setLineDash([]);
  // a segno: lampo bianco-oro che si allarga
  const age = hitAt != null ? now - hitAt : Infinity;
  if (age >= 0 && age < FLASH_MS) {
    const u = age / FLASH_MS;
    ctx.strokeStyle = `rgba(${GOLD},${1 - u})`; ctx.lineWidth = lw * (1.6 - u);
    ctx.beginPath(); ctx.arc(x, y, rad * (1 + 0.9 * u), 0, Math.PI * 2); ctx.stroke();
  }
  // freccia: da dove arriva il gancio (verso il bordo) o il montante (dal basso)
  if (tg.arrow && status !== 'missed') {
    const a = Math.min(1, ring + 0.1), s = rad * 0.45;
    ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    if (tg.arrow === 'up') { const by = y + rad * 1.55; ctx.moveTo(x - s, by + s * 0.6); ctx.lineTo(x, by); ctx.lineTo(x + s, by + s * 0.6); }
    else { const d = tg.arrow === 'left' ? -1 : 1, bx = x - d * rad * 1.55; ctx.moveTo(bx - d * s * 0.6, y - s); ctx.lineTo(bx, y); ctx.lineTo(bx - d * s * 0.6, y + s); }
    ctx.stroke();
  }
  // numero del colpo, dritto anche se il canvas è specchiato
  ctx.save();
  ctx.translate(x, y);
  if (mirrored) ctx.scale(-1, 1);
  ctx.fillStyle = status === 'hit' ? `rgba(15,20,30,${text})` : `rgba(240,248,255,${text})`;
  ctx.font = `800 ${Math.round(rad * 0.95)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(tg.label), 0, rad * 0.04);
  ctx.restore();
}

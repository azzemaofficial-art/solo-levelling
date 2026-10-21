// Allenamenti veri di Emanuele: il registro del coach con camera (kind train, lib/mmaTrain.js).
// Ogni ripetizione = scheletro + cosa ha capito il coach + il giudizio di Emanuele (👍/👎 e i colpi
// letti male). Niente video.
// 1. Legge mma_train:<chatId> da Upstash (KV_REST_API_URL e KV_REST_API_TOKEN dall'API di Vercel:
//    mai stamparli) oppure da un file già salvato (--file), e salva in
//    tests/fixtures/private/mma-train-<data>.json (fuori da git: il repo è pubblico).
// 2. Riepilogo: ripetizioni per giudizio, colpi letti male per tipo e braccio, sacco, accordo.
// 3. Rigioca ogni clip nel motore di adesso (come clip-vere.mjs): cosa direbbe OGGI il coach. Serve
//    a confrontare le versioni future: i 👍 devono restare uguali, i colpi del 👎 devono cambiare.
// Uso:
//   KV_REST_API_URL=… KV_REST_API_TOKEN=… node scripts/punch-training/allenamenti-veri.mjs <chatId>
//   node scripts/punch-training/allenamenti-veri.mjs --file tests/fixtures/private/mma-train-2026-10-17.json
//   (--out <file> per salvare altrove)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createComboJudge, judgeSequence, EXPECT } from '../../lib/mmaComboJudge.js';
import { matchContacts } from '../../lib/mmaBag.js';
import { MOVES } from '../../src/data/mmaMoves.js';
import { decode } from './clip-vere.mjs';
import { PRIV } from './dati.mjs';

const ARM_IT = { lead: 'avanti', rear: 'dietro' };
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const nameOf = (id) => MOVES[id]?.name || id;

// ── Lettura ─────────────────────────────────────────────────────────────────
export async function readKv(chatId, { url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN } = {}) {
  if (!url || !token) throw new Error('mancano KV_REST_API_URL e KV_REST_API_TOKEN (si prendono dall’API di Vercel)');
  const res = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['LRANGE', `mma_train:${chatId}`, '0', '-1']),
  });
  if (!res.ok) throw new Error(`Upstash: HTTP ${res.status}`);
  const { result } = await res.json();
  return (Array.isArray(result) ? result : []).map((raw) => { try { return JSON.parse(raw); } catch { return null; } }).filter(Boolean);
}

export function readFile(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(data) ? data : data.items || [];
}

// La stessa ripetizione può arrivare due volte (giudizio cambiato dopo l'invio): vale l'ultima
export function dedupe(items) {
  const byKey = new Map();
  items.forEach((c, i) => byKey.set(c.rep != null ? `${c.session ?? ''}:${c.rep}` : `#${i}`, c));
  return [...byKey.values()];
}

// ── Riepilogo ───────────────────────────────────────────────────────────────
export function summarize(clips) {
  const out = {
    reps: clips.length, sessions: new Set(clips.map((c) => c.session)).size,
    vote: { up: 0, down: 0, none: 0 },
    wrong: {},  // 'jab|lead' → { n, coach: { ok, partial, missing } }
    agree: { reps: 0, judged: 0, moves: 0, movesJudged: 0 },
    bag: { reps: 0, hits: 0, total: 0, contacts: 0, strikes: 0, matched: 0 },
    phone: { models: {}, rps: [] },
    combos: {},
  };
  for (const c of clips) {
    const expected = c.expected || [];
    const st = c.coach?.st || [];
    out.combos[c.name || c.combo || '?'] = (out.combos[c.name || c.combo || '?'] || 0) + 1;
    if (c.ok === true) out.vote.up += 1; else if (c.ok === false) out.vote.down += 1; else out.vote.none += 1;
    // accordo: 👍 = il coach ha letto bene; 👎 = no. Sui colpi contano solo i 👎 con i colpi segnati
    if (c.ok != null) { out.agree.judged += 1; if (c.ok) out.agree.reps += 1; }
    const judgedMoves = expected.filter((_, i) => st[i] !== 'guided').length;
    if (c.ok === true) { out.agree.movesJudged += judgedMoves; out.agree.moves += judgedMoves; }
    if (c.ok === false && c.wrong?.length) { out.agree.movesJudged += judgedMoves; out.agree.moves += judgedMoves - c.wrong.length; }
    for (const i of c.ok === false ? c.wrong || [] : []) {
      const id = expected[i];
      if (!id) continue;
      const key = `${id}|${EXPECT[id]?.side || '?'}`;
      const w = (out.wrong[key] ||= { n: 0, coach: {} });
      w.n += 1;
      w.coach[st[i] || '?'] = (w.coach[st[i] || '?'] || 0) + 1;
    }
    if (c.bag) {
      const b = out.bag;
      b.reps += 1; b.hits += c.bag.hits || 0; b.total += c.bag.total || 0;
      b.contacts += (c.bag.contacts || []).length;
      const strikes = (c.seen || []).filter((g) => (g.limb === 'arm' || g.limb === 'leg') && g.kind !== 'drop');
      b.strikes += strikes.length;
      b.matched += strikes.filter((g) => g.hit).length;
    }
    if (c.phone?.model) out.phone.models[c.phone.model] = (out.phone.models[c.phone.model] || 0) + 1;
    if (Number.isFinite(c.phone?.rps)) out.phone.rps.push(c.phone.rps);
  }
  return out;
}

// ── Rigioco nel motore di adesso ────────────────────────────────────────────
// Come in app: guardia dai fotogrammi di calibrazione salvati con la clip (se mancano, i primi della
// clip), poi un fotogramma alla volta; al sacco i contatti salvati si riabbinano ai colpi.
// NB: senza i "tuoi esempi" (Insegna i colpi): se la clip ha templates: true il nome del colpo può
// differire da quello visto in app (e a volte lo stato).
export function replayClip(c, { punchNet } = {}) {
  if (!Array.isArray(c.w) || !c.w.length || !Array.isArray(c.expected)) return null;
  const fr = decode(c);
  const aspect = c.aspect || 0.75;
  const j = createComboJudge({ stance: c.stance, punchNet });
  if (c.cal?.w?.length) {
    for (const f of decode({ j: c.cal.j || c.j, t: c.cal.w.map((_, i) => i * 33), w: c.cal.w, p: c.cal.p || [] })) j.calibrate(f.world, f.points, aspect);
  }
  let i = 0;
  while (!j.isCalibrated() && i < fr.length) { j.calibrate(fr[i].world, fr[i].points, aspect); i += 1; }
  for (; i < fr.length; i += 1) j.push(fr[i].world, fr[i].t, fr[i].points, aspect);
  const since = (c.go ?? 200) - 700;
  let gestures = j.gestures().filter((g) => g.start >= since);
  if (c.bag?.contacts?.length) gestures = matchContacts(gestures, c.bag.contacts, { sideOf: j.sideOf }).gestures;
  return { result: judgeSequence(c.expected, gestures), gestures };
}

// cosa ha letto il coach per ogni colpo atteso: nome (o tipo/braccio) + stato
const readOf = (g, status) => `${g ? g.move || `${g.kind}/${ARM_IT[g.side] || g.side}` : '–'} ${status}`;
export function compare(c, replay) {
  const st = c.coach?.st || [];
  const before = (c.expected || []).map((_, i) => readOf(c.seen?.[c.coach?.g?.[i]], st[i]));
  const now = replay.result.moves.map((m) => readOf(m.gesture, m.status));
  const changed = before.map((b, i) => b !== now[i]);
  return { before, now, changed, same: !changed.some(Boolean) };
}

export function replayAll(clips, opts) {
  const out = { played: 0, noWorld: 0, upSame: 0, up: 0, wrongChanged: 0, wrongTotal: 0, lines: [] };
  for (const c of clips) {
    const r = replayClip(c, opts);
    if (!r) { out.noWorld += 1; continue; }
    out.played += 1;
    const cmp = compare(c, r);
    if (c.ok === true) { out.up += 1; if (cmp.same) out.upSame += 1; }
    if (c.ok === false) for (const i of c.wrong || []) { out.wrongTotal += 1; if (cmp.changed[i]) out.wrongChanged += 1; }
    const v = c.ok === true ? '👍' : c.ok === false ? '👎' : '··';
    const marks = c.ok === false && c.wrong?.length ? ` [${c.wrong.map((i) => nameOf(c.expected[i])).join(', ')}]` : '';
    out.lines.push(`#${c.n ?? '?'} ${c.name || c.combo} ${v}${marks}${c.bagOn ? ' sacco' : ''}  prima: ${cmp.before.join(' · ')}  ora: ${cmp.now.join(' · ')}${cmp.same ? '' : '  ← cambia'}`);
  }
  return out;
}

export function report(clips, { replay = true } = {}) {
  const s = summarize(clips);
  const lines = [];
  const days = clips.map((c) => c.ts).filter(Boolean).sort();
  lines.push(`Registro allenamenti: ${s.reps} ripetizioni (${s.sessions} serie)${days.length ? `, dal ${days[0].slice(0, 10)} al ${days.at(-1).slice(0, 10)}` : ''}`);
  lines.push(`Combo: ${Object.entries(s.combos).map(([k, n]) => `${k} ${n}`).join(', ') || '–'}`);
  lines.push(`Giudizio: 👍 ${s.vote.up} · 👎 ${s.vote.down} · senza ${s.vote.none}`);
  lines.push(`Accordo coach–Emanuele: ripetizioni ${pct(s.agree.reps, s.agree.judged)} (${s.agree.reps} su ${s.agree.judged} giudicate) · colpi ${pct(s.agree.moves, s.agree.movesJudged)} (${s.agree.moves} su ${s.agree.movesJudged}; 👎 senza colpi segnati esclusi)`);
  const wrong = Object.entries(s.wrong).sort((a, b) => b[1].n - a[1].n);
  lines.push(wrong.length ? 'Colpi letti male (segnati dopo il 👎), per tipo e braccio:' : 'Colpi letti male: nessuno segnato.');
  for (const [key, w] of wrong) {
    const [id, side] = key.split('|');
    lines.push(`  ${nameOf(id)} (braccio ${ARM_IT[side] || side}): ${w.n} — il coach diceva: ${Object.entries(w.coach).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  }
  if (s.bag.reps) {
    const b = s.bag;
    lines.push(`Al sacco: ${b.reps} ripetizioni · a segno ${b.hits} su ${b.total} · contatti ${b.contacts}, colpi del coach ${b.strikes}, abbinati ${b.matched} (contatti senza colpo ${Math.max(0, b.contacts - b.matched)}, colpi senza contatto ${b.strikes - b.matched})`);
  } else lines.push('Al sacco: nessuna ripetizione.');
  const rps = s.phone.rps.length ? (s.phone.rps.reduce((a, b) => a + b, 0) / s.phone.rps.length).toFixed(1).replace('.', ',') : '–';
  lines.push(`Telefono: ${Object.entries(s.phone.models).map(([k, n]) => `${k} ${n}`).join(', ') || '–'} · ${rps} risultati/s in media`);
  if (replay) {
    const r = replayAll(clips);
    lines.push(`Rigiocate nel motore di adesso: ${r.played}${r.noWorld ? ` (${r.noWorld} senza 3D, saltate)` : ''}`);
    lines.push(`  👍 uguali a quello che aveva detto il coach: ${r.upSame} su ${r.up}`);
    lines.push(`  👎 colpi segnati che ora il coach legge diversamente: ${r.wrongChanged} su ${r.wrongTotal}`);
    lines.push(...r.lines.slice(-30).map((l) => `  ${l}`));
  }
  return { summary: s, text: lines.join('\n') };
}

// ── Da riga di comando ──────────────────────────────────────────────────────
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function main(argv) {
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const file = opt('--file'), outPath = opt('--out');
  let items;
  if (file) items = readFile(file);
  else {
    const chatId = argv.find((a) => /^\d+$/.test(a)) || process.env.MMA_CHAT_ID || String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/).filter(Boolean)[0];
    if (!chatId) { console.log('Manca il chatId: node scripts/punch-training/allenamenti-veri.mjs <chatId>'); process.exit(1); }
    items = await readKv(chatId);
    const dest = outPath ? pathToFileURL(outPath) : new URL(`mma-train-${localDay()}.json`, PRIV);
    mkdirSync(new URL('.', dest), { recursive: true });
    writeFileSync(dest, JSON.stringify({ fetchedAt: new Date().toISOString(), list: 'mma_train', count: items.length, items }));
    console.log(`Salvate ${items.length} clip in ${fileURLToPath(dest)}`);
  }
  const clips = dedupe(items.filter((c) => c && (c.kind === 'train' || c.ver)));
  if (!clips.length) { console.log('Nessuna ripetizione nel registro.'); return; }
  console.log(report(clips).text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.log(`Errore: ${String(e.message || e).slice(0, 200)}`); process.exit(1); });
}

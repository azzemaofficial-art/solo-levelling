// Taratura del motore dei colpi alla catena del telefono (~25 risultati al secondo, tempo vero del
// fotogramma): prova alcune soglie di lib/mmaStrikes.js (STRIKE) e misura visti / braccio / inventati.
// Onesta: si sceglie sugli atleti "scelta" e si controlla sugli altri, mai visti nella scelta.
// Uso: node scripts/punch-training/tara.mjs [atleti scelta, es. E,G] (gli altri sono il controllo)
import { STRIKE } from '../../lib/mmaStrikes.js';
import { available } from './dati.mjs';
import { loadAll, phoneFrames, play, score, table } from './banco.mjs';

if (!available()) { console.log('Mancano i dati privati (vedi README).'); process.exit(0); }
const streams = loadAll();
const pick = new Set((process.argv[2] || 'E,G').split(','));
const sets = { scelta: streams.filter((s) => pick.has(s.athlete)), controllo: streams.filter((s) => !pick.has(s.athlete)) };
const frames = new Map(streams.map((s) => [s, phoneFrames(s, 'subito')]));
const BASE = { ...STRIKE };

const GRID = [
  {},
  { on: 0.18 }, { on: 0.14 },
  { peakMin: 0.21 }, { peakMin: 0.24 },
  { dominance: 1.5 }, { dominance: 1.15 },
  { settleMs: 180 }, { settleMs: 260 },
  { againRise: 0.16 }, { againDrop: 0.45 },
  { minMs: 100 },
];

const measure = (set) => score(set.map((stream) => ({ stream, gs: play(stream, { frames: frames.get(stream), judgeOpts: { punchNet: null } }) })), { k: 0 });
const rows = { scelta: [], controllo: [] };
for (const change of GRID) {
  Object.assign(STRIKE, BASE, change);
  const name = Object.entries(change).map(([k, v]) => `${k}=${v}`).join(' ') || 'attuale';
  for (const which of ['scelta', 'controllo']) if (sets[which].length) rows[which].push([name.slice(0, 7), measure(sets[which]), name]);
  const s = rows.scelta.at(-1)?.[1], c = rows.controllo.at(-1)?.[1];
  console.log(`${name.padEnd(16)} scelta: visti ${Math.round(s.seen * 100)}% braccio ${Math.round(s.arm * 100)}% inventati ${s.extra.toFixed(1)}/min` + (c ? ` | controllo: visti ${Math.round(c.seen * 100)}% braccio ${Math.round(c.arm * 100)}% inventati ${c.extra.toFixed(1)}/min` : ''));
}
Object.assign(STRIKE, BASE);
for (const which of ['scelta', 'controllo']) if (rows[which].length) { console.log(which); console.log(table(rows[which].map(([n, s]) => [n, s]))); }

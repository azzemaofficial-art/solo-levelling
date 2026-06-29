#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  📚 Distillatore Knowledge Base — trasforma paper scientifici in PRINCIPI.
//  Uso:  node tools/knowledge.mjs
//  1) Metti i paper in:  <VAULT>/papers/   (.txt, .md, oppure .pdf se hai pdftotext)
//  2) Lancia il tool → distilla i NUOVI paper via AI (gratis) in principi azionabili
//  3) Scrive lib/knowledgeBase.js (usato da sito + bot) e memorie/scienza-nutrizione.md
//  4) git commit + push + deploy per far usare i nuovi principi all'assistente web
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const BASE = process.env.HIVE_BASE || 'https://solo-levelling-gold.vercel.app';
const VAULT = process.env.HIVE_VAULT || '/Users/emanueleazzini/Library/Mobile Documents/iCloud~md~obsidian/Documents/brain/progetti/shadow-coach';
const PAPERS = path.join(VAULT, 'papers');
const MANIFEST = path.join(PAPERS, '.processed.json');
const LIB_OUT = path.join(REPO, 'lib', 'knowledgeBase.js');
const MEM_OUT = path.join(VAULT, 'memorie', 'scienza-nutrizione.md');
const MAX_PRINCIPLES = 80;
const MAX_CHARS = 18000; // quanto testo del paper passare all'AI

const hasPdftotext = spawnSync('pdftotext', ['-v']).error == null;

function readPaper(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.txt' || ext === '.md') return fs.readFileSync(file, 'utf8');
  if (ext === '.pdf') {
    if (!hasPdftotext) return null;
    const r = spawnSync('pdftotext', ['-q', file, '-'], { maxBuffer: 50 * 1024 * 1024 });
    return r.status === 0 ? r.stdout.toString('utf8') : null;
  }
  return null;
}

async function distill(title, text) {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [
      { role: 'system', content: 'Sei uno scienziato della nutrizione e dello sport. Distilli un paper in PRINCIPI azionabili, concreti e specifici (con numeri/soglie quando ci sono). Niente fronzoli, niente "potrebbe": solo ciò che il paper supporta. Rispondi SOLO con JSON valido: {"topic":"area breve","principles":["frase azionabile 1","frase 2", ...]} — da 5 a 10 principi, in italiano, ognuno autosufficiente.' },
      { role: 'user', content: `TITOLO: ${title}\n\nTESTO (estratto):\n${text.slice(0, MAX_CHARS)}` },
    ] }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const raw = String(j?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const principles = Array.isArray(o.principles) ? o.principles.map((s) => String(s).trim()).filter((s) => s.length > 8).slice(0, 10) : [];
    return principles.length ? { topic: String(o.topic || 'nutrizione').slice(0, 40), principles } : null;
  } catch { return null; }
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { sources: [], principles: [] }; }
}
function saveManifest(m) { fs.mkdirSync(PAPERS, { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); }
const dedup = (arr) => { const seen = new Set(); return arr.filter((s) => { const k = s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }); };

function writeLib(principles, sources) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const body = `// ─────────────────────────────────────────────────────────────────────────────
//  Base di conoscenza distillata dai paper scientifici forniti dall'utente.
//  GENERATO da tools/knowledge.mjs — non modificare a mano (verrà sovrascritto).
//  Vuoto = nessuna iniezione nei prompt (comportamento neutro, zero overhead).
// ─────────────────────────────────────────────────────────────────────────────

export const NUTRITION_PRINCIPLES = [
${principles.map((p) => `  \`${esc(p)}\`,`).join('\n')}
];

export const KNOWLEDGE_SOURCES = [
${sources.map((s) => `  { title: \`${esc(s.title)}\`, topic: \`${esc(s.topic)}\`, principles: ${s.count} },`).join('\n')}
];

export function knowledgePrompt(max = 1800) {
  if (!Array.isArray(NUTRITION_PRINCIPLES) || !NUTRITION_PRINCIPLES.length) return '';
  let body = NUTRITION_PRINCIPLES.map((p, i) => \`\${i + 1}. \${p}\`).join('\\n');
  if (body.length > max) body = body.slice(0, max).replace(/\\n[^\\n]*$/, '') + '\\n…';
  return \`\\n\\nPRINCIPI SCIENTIFICI (distillati da paper forniti dall'utente — fonda i consigli su questi e citali quando pertinenti):\\n\${body}\`;
}
`;
  fs.writeFileSync(LIB_OUT, body);
}

function writeMemory(sources, principles) {
  fs.mkdirSync(path.dirname(MEM_OUT), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const md = `---
tipo: memoria
aggiornato: ${stamp}
---

# 📚 Scienza della Nutrizione — principi distillati

> Generato da \`tools/knowledge.mjs\` dai paper in \`papers/\`. ${principles.length} principi da ${sources.length} fonti.

## Principi
${principles.map((p) => `- ${p}`).join('\n')}

## Fonti elaborate
${sources.map((s) => `- **${s.title}** — _${s.topic}_ (${s.count} principi)`).join('\n') || '- (nessuna)'}
`;
  fs.writeFileSync(MEM_OUT, md);
}

async function main() {
  fs.mkdirSync(PAPERS, { recursive: true });
  const files = fs.readdirSync(PAPERS).filter((f) => !f.startsWith('.') && !f.startsWith('_') && /\.(txt|md|pdf)$/i.test(f));
  if (!files.length) {
    console.log(`📂 Nessun paper in: ${PAPERS}\n   Metti lì file .txt/.md${hasPdftotext ? '/.pdf' : ' (.pdf: installa poppler con "brew install poppler")'} e rilancia.`);
    return;
  }
  const man = loadManifest();
  const known = new Map(man.sources.map((s) => [s.file + ':' + s.hash, s]));
  let added = 0;

  for (const f of files) {
    const full = path.join(PAPERS, f);
    const text = readPaper(full);
    if (!text || text.trim().length < 200) { console.log(`⏭️  ${f} — illeggibile o troppo corto, salto.`); continue; }
    const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 12);
    if (known.has(f + ':' + hash)) { console.log(`✓ ${f} — già elaborato.`); continue; }
    const title = path.basename(f, path.extname(f)).replace(/[_-]+/g, ' ');
    process.stdout.write(`🧪 Distillo "${title}"… `);
    const out = await distill(title, text);
    if (!out) { console.log('fallito (AI), riprova più tardi.'); continue; }
    man.sources = man.sources.filter((s) => s.file !== f); // rimpiazza versioni vecchie dello stesso file
    man.sources.push({ file: f, title, topic: out.topic, hash, count: out.principles.length, processedAt: new Date().toISOString() });
    man.principles.push(...out.principles);
    added += out.principles.length;
    console.log(`+${out.principles.length} principi.`);
  }

  man.principles = dedup(man.principles).slice(-MAX_PRINCIPLES);
  saveManifest(man);
  writeLib(man.principles, man.sources);
  writeMemory(man.sources, man.principles);

  console.log(`\n✅ Knowledge base: ${man.principles.length} principi totali da ${man.sources.length} fonti (+${added} nuovi).`);
  console.log(`   → lib/knowledgeBase.js aggiornato.  → ${path.relative(VAULT, MEM_OUT)} nel vault.`);
  if (added) console.log(`   ⚠️  Per farli usare all'assistente WEB: git add -A && git commit && git push (poi deploy).`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

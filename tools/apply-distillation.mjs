#!/usr/bin/env node
// Applica distillazioni fatte da Claude (via chat, non AI gratuita) al manifest
// e rigenera lib/knowledgeBase.js + memorie/scienza-nutrizione.md.
// Uso: node tools/apply-distillation.mjs batch.json
// batch.json = { "nome-file.txt": { "topic": "...", "principles": ["...", ...] }, ... }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const VAULT = process.env.HIVE_VAULT || '/Users/emanueleazzini/Library/Mobile Documents/iCloud~md~obsidian/Documents/brain/progetti/shadow-coach';
const PAPERS = path.join(VAULT, 'papers');
const MANIFEST = path.join(PAPERS, '.processed.json');
const LIB_OUT = path.join(REPO, 'lib', 'knowledgeBase.js');
const MEM_OUT = path.join(VAULT, 'memorie', 'scienza-nutrizione.md');
const MAX_PRINCIPLES = 1800; // alzato da 1200 (raggiunto): la base continua a crescere ogni
// notte col Ricercatore Notturno, il retrieval inietta solo i top pertinenti quindi il cap
// alto non gonfia i prompt — evita solo di scartare principi validi quando la base cresce.

function fixTypos(s) {
  let t = ' ' + String(s) + ' ';
  const map = [
    [/\bdiguno\b/gi, 'digiuno'], [/\bAbattere\b/g, 'Abbattere'], [/\babattere\b/g, 'abbattere'],
    [/\bPrediliggere\b/g, 'Prediligi'], [/\bprediliggere\b/g, 'prediligi'],
    [/\bPriorizzare\b/g, 'Privilegia'], [/\bpriorizzare\b/g, 'privilegia'],
    [/\bPriorizza\b/g, 'Privilegia'], [/\bpriorizza\b/g, 'privilegia'],
    [/succ\s+succ/gi, 'succo'], [/\bsucc\b/gi, 'succo'],
    [/\bfinest\b/gi, 'finestre'], [/\beccess\b/gi, 'eccesso'],
    [/\bsession\b/gi, 'sessioni'], [/\bsession\//gi, 'sessioni/'],
    [/aggiuntivo ridurre/gi, 'aggiuntivo riduce'],
    [/lactate[- ]shuffle/gi, 'lactate-shuttle'], [/shuffle del lattato/gi, 'shuttle del lattato'],
    [/\bchilogramo\b/gi, 'chilogrammo'], [/proteine lento rilascio/gi, 'proteine a lento rilascio'],
    [/\bConsapevoli che\b/g, 'Sii consapevole che'],
    [/Evitare di fareamento all'integrazione/gi, 'Non fare affidamento sull’integrazione'],
    [/di fareamento/gi, 'di fare affidamento'], [/\bfareamento\b/gi, 'fare affidamento'],
    [/\s{2,}/g, ' '], [/\s+([,.;:])/g, '$1'],
  ];
  for (const [re, rep] of map) t = t.replace(re, rep);
  return t.trim();
}

function dedup(arr) {
  const seen = new Set();
  const out = [];
  for (const p of arr) {
    const key = p.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { sources: [], principles: [] }; }
}
function saveManifest(m) { fs.mkdirSync(PAPERS, { recursive: true }); fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2)); }

function writeLib(principles, sources) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const body = `// ─────────────────────────────────────────────────────────────────────────────
//  Base di conoscenza distillata dai paper scientifici forniti dall'utente.
//  GENERATO da tools/knowledge.mjs / tools/apply-distillation.mjs — non modificare a mano (verrà sovrascritto).
//  Vuoto = nessuna iniezione nei prompt (comportamento neutro, zero overhead).
// ─────────────────────────────────────────────────────────────────────────────

export const NUTRITION_PRINCIPLES = [
${principles.map((p) => `  \`${esc(p)}\`,`).join('\n')}
];

export const KNOWLEDGE_SOURCES = [
${sources.map((s) => `  { title: \`${esc(s.title)}\`, topic: \`${esc(s.topic)}\`, principles: ${s.count} },`).join('\n')}
];

// Retrieval leggero: ordina i principi per pertinenza a una query/contesto.
// Match per RADICE (prefisso 6 caratteri) così plurali/declinazioni combaciano.
function rootTokens(s) {
  return (s.toLowerCase().match(/[a-zA-Zà-ü]{4,}/g) || []).map((w) => w.slice(0, 6));
}
export function knowledgePromptFor(query, max = 30) {
  if (!NUTRITION_PRINCIPLES.length) return '';
  const qTokens = new Set(rootTokens(query || ''));
  if (!qTokens.size) return knowledgePrompt();
  const scored = NUTRITION_PRINCIPLES.map((p) => {
    const pTokens = rootTokens(p);
    let score = 0;
    for (const t of pTokens) if (qTokens.has(t)) score++;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, max);
  const chosen = top.length >= 5 ? top : scored.slice(0, max);
  const list = chosen.map((s) => s.p).slice(0, max);
  return \`\\n\\nCONOSCENZA SCIENTIFICA RILEVANTE (usa se pertinente, cita senza inventare):\\n\${list.map((p) => \`- \${p}\`).join('\\n')}\`;
}
export function knowledgePrompt(maxChars = 3500) {
  if (!NUTRITION_PRINCIPLES.length) return '';
  const out = [];
  let len = 0;
  for (const p of NUTRITION_PRINCIPLES) {
    if (len + p.length > maxChars) break;
    out.push(p); len += p.length;
  }
  return \`\\n\\nCONOSCENZA SCIENTIFICA DISTILLATA (usa se pertinente, non citare fonti specifiche, non inventare):\\n\${out.map((p) => \`- \${p}\`).join('\\n')}\`;
}
`;
  fs.mkdirSync(path.dirname(LIB_OUT), { recursive: true });
  fs.writeFileSync(LIB_OUT, body);
}

function writeMemory(sources, principles) {
  fs.mkdirSync(path.dirname(MEM_OUT), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const md = `---
tags: [scienza, nutrizione, coach, generato]
aggiornato: ${stamp}
---

# 📚 Scienza & Biohacking — principi distillati

> Generato da \`tools/knowledge.mjs\` / \`tools/apply-distillation.mjs\` dai paper in \`papers/\`. ${principles.length} principi da ${sources.length} fonti.

## Fonti
${sources.map((s) => `- **${s.title}** (${s.topic || 'n/d'}) — ${s.count} principi`).join('\n')}

## Principi
${principles.map((p) => `- ${p}`).join('\n')}
`;
  fs.writeFileSync(MEM_OUT, md);
}

const batchFile = process.argv[2];
if (!batchFile) { console.error('Uso: node apply-distillation.mjs batch.json'); process.exit(1); }
const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));

const man = loadManifest();
let added = 0;
for (const [file, out] of Object.entries(batch)) {
  const full = path.join(PAPERS, file);
  if (!fs.existsSync(full)) { console.log(`⚠️  ${file} non trovato, salto.`); continue; }
  const text = fs.readFileSync(full, 'utf8');
  const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 12);
  const title = path.basename(file, path.extname(file)).replace(/[_-]+/g, ' ');
  const principles = (out.principles || []).map((s) => String(s).trim()).filter((s) => s.length > 8).slice(0, 10);
  if (!principles.length) { console.log(`⏭️  ${file} — 0 principi, salto.`); continue; }
  man.sources = man.sources.filter((s) => s.file !== file);
  man.sources.push({ file, title, topic: String(out.topic || 'nutrizione').slice(0, 40), hash, count: principles.length, processedAt: new Date().toISOString() });
  man.principles.push(...principles);
  added += principles.length;
  console.log(`✓ ${file} +${principles.length} principi`);
}
man.principles = dedup(man.principles.map(fixTypos)).slice(-MAX_PRINCIPLES);
saveManifest(man);
writeLib(man.principles, man.sources);
writeMemory(man.sources, man.principles);
console.log(`\n✅ Knowledge base: ${man.principles.length} principi totali da ${man.sources.length} fonti (+${added} in questo batch).`);

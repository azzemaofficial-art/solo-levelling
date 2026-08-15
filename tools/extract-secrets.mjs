#!/usr/bin/env node
// extract-secrets.mjs — migra la knowledge base "segreti del maestro" dal
// ROTAZIONE FOCUS di api/nvidia/visual.js nei JSON strutturati.
//
// Legge il SORGENTE di api/nvidia/visual.js come TESTO (l'import del modulo non
// è affidabile: il file esporta un handler Vercel con dipendenze server-side).
// Individua il blocco `const SYSTEM_PROMPTS = { ... };` con un mini-scanner
// consapevole di template literal / interpolazioni ${...} / commenti, e per ogni
// disciplina estrae le righe numerate `N) testo`.
//
// Le interpolazioni tipo ${BASE_SOLO} dentro i template NON vengono espanse:
// restano testo letterale nel sorgente e non contengono righe numerate, quindi
// sono ignorate naturalmente (come da requisito).
//
// Output: un file per disciplina in lib/knowledge/secrets/<disciplina>.json
//   { "discipline": "muaythai", "secrets": [ { id, n, text, categoria, livello, lore, tags, errore } ] }
//
// EURISTICHE DI CLASSIFICAZIONE (prima approssimazione, verrà curata a mano):
// - categoria (il primo match vince, in quest'ordine):
//     mente          ← contiene "respir|fiato|paura|mente|spirito|intenzione"
//     tattica        ← contiene "ritmo|distanza|combo|counter|finta|press|timing"
//     condizionamento← contiene "condizionament|allena|ripeti|resistenza|forza"
//     storia         ← contiene nomi di maestri/leggende o "storia|tradizione|antich"
//     tecnica        ← default
// - lore: la riga inizia con un prefisso "da legenda" ("SEGRETO —", "MAE MAI SEGRETO —",
//   "BORAN —", "ANTICO —", "PRESSIONE —", "CLINCH NASCOSTO —", "RESPIRO GUERRIERO —")
//   oppure contiene "secondo la tradizione|tramand|leggenda".
// - livello: 1 se n<=10, 2 se n<=20, 3 se n<=28, 4 oltre; +1 se lore (cap 5).
// - tags: 1-3 keyword minuscole senza accenti derivate dalle parole PRIMA dei due punti
//   (prefisso lore rimosso, parentesi rimosse, stopword italiane rimosse, numeri puri scartati).
//   Es. "Roundhouse: ..." → ["roundhouse"]; "SEGRETO — Falling Step (Jack Dempsey): ..."
//   → ["falling","step"]. Fallback: prime parole del testo se la riga non ha i due punti.
// - errore: sempre "" per ora (curato in seguito).
// - text: VERBATIM dal sorgente (unicode esatto, compresi — e °).
//
// Uso: node tools/extract-secrets.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'api', 'nvidia', 'visual.js');
const OUT_DIR = path.join(REPO, 'lib', 'knowledge', 'secrets');

// ---------------------------------------------------------------------------
// 1. Estrazione del blocco SYSTEM_PROMPTS dal sorgente (testo, non import)
// ---------------------------------------------------------------------------

// Restituisce il contenuto TRA le graffe di `const SYSTEM_PROMPTS = { ... };`
// usando uno scanner a stati (code/template/interp/stringhe/commenti) così da
// non farsi ingannare da graffe o backtick dentro i template literal.
function extractSystemPromptsBlock(src) {
  const anchor = src.indexOf('const SYSTEM_PROMPTS = {');
  if (anchor === -1) throw new Error(`Blocco 'const SYSTEM_PROMPTS = {' non trovato in ${SRC}`);
  const start = src.indexOf('{', anchor);

  let depth = 0;
  let mode = 'code'; // code | template | interp | sq | dq | lc | bc
  const interpDepth = []; // profondità graffe per ogni ${...} attivo
  const codeMode = () => (interpDepth.length ? 'interp' : 'code');

  for (let i = start; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 'lc') { if (c === '\n') mode = codeMode(); continue; }
    if (mode === 'bc') { if (c === '*' && n === '/') { mode = codeMode(); i++; } continue; }
    if (mode === 'sq') { if (c === '\\') i++; else if (c === "'") mode = 'code'; continue; }
    if (mode === 'dq') { if (c === '\\') i++; else if (c === '"') mode = 'code'; continue; }
    if (mode === 'template') {
      if (c === '\\') { i++; continue; }
      if (c === '`') { mode = codeMode(); continue; }
      if (c === '$' && n === '{') { interpDepth.push(0); mode = 'interp'; i++; continue; }
      continue;
    }
    // code | interp
    if (c === '/' && n === '/') { mode = 'lc'; i++; continue; }
    if (c === '/' && n === '*') { mode = 'bc'; i++; continue; }
    if (c === "'") { mode = 'sq'; continue; }
    if (c === '"') { mode = 'dq'; continue; }
    if (c === '`') { mode = 'template'; continue; }
    if (c === '{') {
      if (mode === 'interp') interpDepth[interpDepth.length - 1]++;
      else depth++;
      continue;
    }
    if (c === '}') {
      if (mode === 'interp') {
        const top = interpDepth.length - 1;
        if (interpDepth[top] > 0) interpDepth[top]--;
        else { interpDepth.pop(); mode = 'template'; }
      } else {
        depth--;
        if (depth === 0) return src.slice(start + 1, i);
      }
    }
  }
  throw new Error('Chiusura del blocco SYSTEM_PROMPTS non trovata');
}

// Divide il blocco in { disciplina: contenutoTemplateLiteral }.
// Le chiavi sono indentate di 2 spazi nel sorgente (`  muaythai: \`...`);
// i template literal NON contengono backtick escapati (verificato sul sorgente),
// ma lo scan della chiusura gestisce comunque gli escape per robustezza.
function parseDisciplines(block) {
  const re = /^ {2}([A-Za-z0-9_]+): `/gm;
  const out = {};
  let m;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const openIdx = re.lastIndex - 1; // il backtick aperto
    let i = openIdx + 1;
    let content = null;
    while (i < block.length) {
      if (block[i] === '\\') { i += 2; continue; }
      if (block[i] === '`') { content = block.slice(openIdx + 1, i); break; }
      i++;
    }
    if (content === null) throw new Error(`Template literal non chiuso per la disciplina '${key}'`);
    if (out[key]) console.warn(`[warn] chiave duplicata '${key}': la seconda sovrascrive la prima`);
    out[key] = content;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Estrazione delle righe numerate `N) testo`
// ---------------------------------------------------------------------------

// Righe al formato `N) testo` a inizio riga. Testo verbatim fino a fine riga
// (parentesi, emoji, —, ° e caratteri italiani sono gestiti da .* che in JS
// non matcha i newline). L'interpolazione `${BASE_SOLO}` non matcha mai.
const LINE_RE = /^(\d+)\)\s*(.*)$/gm;

function extractLines(templateContent) {
  const lines = [];
  let m;
  while ((m = LINE_RE.exec(templateContent)) !== null) {
    lines.push({ n: parseInt(m[1], 10), text: m[2].replace(/\s+$/, '') });
  }
  return lines.sort((a, b) => a.n - b.n);
}

// ---------------------------------------------------------------------------
// 3. Euristica di classificazione
// ---------------------------------------------------------------------------

const CAT_MENTE = /respir|fiato|paura|mente|spirito|intenzione/i;
const CAT_TATTICA = /ritmo|distanza|combo|counter|finta|press|timing/i;
const CAT_CONDIZIONAMENTO = /condizionament|allena|ripeti|resistenza|forza/i;
const CAT_STORIA_WORDS = /storia|tradizione|antich/i;

// Nomi di maestri/leggende citati nel corpus (word-boundary per evitare falsi
// positivi — niente nomi troppo corti/ambigui come "Ali" che in italiano è una parola).
const LEGENDS = [
  'jack dempsey', 'dempsey', 'floyd mayweather', 'mayweather', 'willie pep',
  'saenchai', 'giorgio petrosyan', 'petrosyan', 'ip man', 'yip man',
  'bruce lee', 'muhammad ali', 'gracie', 'helio', 'rickson',
  'jigoro kano', 'kano', 'gichin funakoshi', 'funakoshi', 'masutatsu oyama', 'oyama',
  'dan gable', 'gable', 'viktor spiridonov', 'spiridonov', 'rich froning', 'froning', 'wim hof',
];
const LEGEND_RE = new RegExp(`\\b(?:${LEGENDS.map((l) => l.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

function categoria(text) {
  if (CAT_MENTE.test(text)) return 'mente';
  if (CAT_TATTICA.test(text)) return 'tattica';
  if (CAT_CONDIZIONAMENTO.test(text)) return 'condizionamento';
  if (LEGEND_RE.test(text) || CAT_STORIA_WORDS.test(text)) return 'storia';
  return 'tecnica';
}

// Prefissi "da legenda" (il più lungo prima, per l'alternanza regex).
const LORE_PREFIX_RE = /^(MAE MAI SEGRETO|CLINCH NASCOSTO|RESPIRO GUERRIERO|SEGRETO|PRESSIONE|BORAN|ANTICO)\s*—/;
const LORE_BODY_RE = /secondo la tradizione|tramand|leggenda/i;

function isLore(text) {
  return LORE_PREFIX_RE.test(text) || LORE_BODY_RE.test(text);
}

function livello(n, lore) {
  let l;
  if (n <= 10) l = 1;
  else if (n <= 20) l = 2;
  else if (n <= 28) l = 3;
  else l = 4;
  if (lore) l += 1;
  return Math.min(l, 5);
}

const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'e', 'ed', 'o', 'ma', 'che', 'non', 'come',
]);

function normalizeWord(w) {
  return w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(raw) {
  return [...new Set(
    normalizeWord(raw)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .filter((w) => !/^\d+$/.test(w)) // niente numeri puri come tag
      .filter((w) => !STOPWORDS.has(w)),
  )];
}

// Tag dalle parole PRIMA dei due punti: via il prefisso lore, via le parentesi
// (nomi propri tra parentesi non diventano tag), via le stopword.
function extractTags(text) {
  const colonIdx = text.indexOf(':');
  let prefix = colonIdx > 0 ? text.slice(0, colonIdx) : text;
  prefix = prefix.replace(LORE_PREFIX_RE, '');
  prefix = prefix.replace(/\([^)]*\)/gu, '');
  let tags = tokenize(prefix).slice(0, 3);
  if (tags.length === 0) tags = tokenize(text).slice(0, 3); // fallback: prime parole del testo
  return tags.length ? tags : ['tecnica']; // extrema ratio, non dovrebbe mai servire
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

function main() {
  const src = fs.readFileSync(SRC, 'utf8');
  const block = extractSystemPromptsBlock(src);
  const disciplines = parseDisciplines(block);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const report = [];
  let total = 0;
  for (const [key, content] of Object.entries(disciplines)) {
    const lines = extractLines(content);
    const secrets = lines.map(({ n, text }) => {
      const lore = isLore(text);
      return {
        id: `${key}-${String(n).padStart(3, '0')}`,
        n,
        text, // VERBATIM dal sorgente
        categoria: categoria(text),
        livello: livello(n, lore),
        lore,
        tags: extractTags(text),
        errore: '',
      };
    });
    fs.writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify({ discipline: key, secrets }, null, 2) + '\n');
    report.push({ key, count: secrets.length });
    total += secrets.length;
    if (secrets.length === 0) console.warn(`[anomaly] disciplina '${key}': 0 righe numerate estratte`);
  }

  console.log(`\nEstratti ${total} segreti da ${report.length} discipline → ${path.relative(REPO, OUT_DIR)}/\n`);
  for (const { key, count } of report) {
    console.log(`  ${key.padEnd(14)} ${String(count).padStart(3)} segreti`);
  }
  console.log(`\n  TOTALE         ${total}\n`);
}

main();

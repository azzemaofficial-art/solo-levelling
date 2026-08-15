#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Espansione della conoscenza del maestro: genera BOZZE di nuovi segreti per
// una disciplina usando un modello gratuito (OpenRouter :free o Groq).
//
//   node tools/secrets-expand.mjs <disciplina> [numero] [categoria]
//   es. node tools/secrets-expand.mjs muaythai 10 tattica
//
// Le bozze finiscono in lib/knowledge/secrets/drafts/<disciplina>-<ts>.draft.json
// e NON entrano nel coach finché non vengono curate e unite a mano nel JSON
// della disciplina (verificare verità, livello, tags, segno_visivo/errore).
// Regola d'oro del progetto: i segreti allucinati sono il rischio n.1 → cura umana.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRETS_DIR = path.join(ROOT, 'lib', 'knowledge', 'secrets');

// .env locale (senza dipendenze): legge solo le chiavi che servono
const loadEnv = () => {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
};
loadEnv();

const disc = String(process.argv[2] || '').toLowerCase().trim();
const count = Math.max(1, Math.min(30, parseInt(process.argv[3]) || 10));
const categoria = String(process.argv[4] || '').toLowerCase().trim();

const file = path.join(SECRETS_DIR, `${disc}.json`);
if (!disc || !fs.existsSync(file)) {
  console.error(`Disciplina mancante o sconosciuta: "${disc}". File atteso: ${file}`);
  process.exit(1);
}
const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
const existingTexts = existing.secrets.map((s) => s.text.toLowerCase().slice(0, 80));

const CATS = ['tecnica', 'tattica', 'mente', 'condizionamento', 'storia'];
const catIstr = CATS.includes(categoria) ? `Genera segreti SOLO di categoria "${categoria}".` : `Bilancia le categorie tra: ${CATS.join(', ')}.`;

const system = `Sei un enciclopedista di arti marziali e scienze motorie RIGOROSO. Generi segreti di allenamento REALI, concreti e verificabili.
VIETATO: inventare tecniche, attribuire citazioni false, esoterismo spacciato per tecnica, consigli pericolosi.
Se un "segreto" è in realtà tradizione/leggenda, segnalalo con lore=true.
Rispondi SOLO con un array JSON valido, senza testo intorno.`;

const user = `Genera ${count} SEGRETI NUOVI di ${existing.discipline} che NON duplichino questi già presenti (prime 80 lettere):
${existingTexts.slice(0, 40).map((t) => `- ${t}`).join('\n')}

${catIstr}

Ogni elemento DEVE avere esattamente questi campi:
{"text":"il segreto, una frase concreta e applicabile (max 200 caratteri)","categoria":"tecnica|tattica|mente|condizionamento|storia","livello":1-5,"lore":false,"tags":["1-3 parole chiave minuscole"],"errore":"il segno VISIVO/errore che dovrebbe attivare questo segreto (es. 'gomito che scende sotto la spalla'); vuoto se non applicabile"}

livello: 1=fondamenta, 2=base, 3=intermedio, 4=avanzato, 5=maestro.
Rispondi SOLO con l'array JSON.`;

async function callOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_FREE_MODEL || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return { text: data?.choices?.[0]?.message?.content || '', model };
}

async function callGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Groq ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return { text: data?.choices?.[0]?.message?.content || '', model: 'llama-3.3-70b-versatile' };
}

const parseArray = (raw) => {
  const m = String(raw).match(/\[[\s\S]*\]/);
  if (!m) throw new Error('nessun array JSON nella risposta');
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr)) throw new Error('la risposta non è un array');
  return arr.filter((s) => s && typeof s.text === 'string' && s.text.length > 15).map((s) => ({
    text: String(s.text).slice(0, 240),
    categoria: CATS.includes(s.categoria) ? s.categoria : 'tecnica',
    livello: Math.max(1, Math.min(5, parseInt(s.livello) || 2)),
    lore: s.lore === true,
    tags: Array.isArray(s.tags) ? s.tags.slice(0, 3).map((t) => String(t).toLowerCase().slice(0, 24)) : [],
    errore: String(s.errore || '').slice(0, 140),
    draft: true,
    source: 'llm-bozza-da-curare',
  }));
};

try {
  const out = (await callOpenRouter()) || (await callGroq());
  if (!out) {
    console.error('Nessuna chiave disponibile: serve OPENROUTER_API_KEY o GROQ_API_KEY (in .env o ambiente).');
    process.exit(1);
  }
  const drafts = parseArray(out.text);
  if (!drafts.length) {
    console.error('Il modello non ha prodotto bozze valide.');
    process.exit(1);
  }
  const draftsDir = path.join(SECRETS_DIR, 'drafts');
  fs.mkdirSync(draftsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(draftsDir, `${disc}-${ts}.draft.json`);
  fs.writeFileSync(dest, JSON.stringify({ discipline: disc, model: out.model, generated: ts, secrets: drafts }, null, 2));
  console.log(`✅ ${drafts.length} bozze generate con ${out.model}`);
  console.log(`📄 ${path.relative(ROOT, dest)}`);
  console.log('⚠️  CURA OBBLIGATORIA prima di unirle al JSON della disciplina: verifica verità, livello, tags, errore. I segreti allucinati sono il rischio n.1.');
} catch (e) {
  console.error('❌', e.message || e);
  process.exit(1);
}

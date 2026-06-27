#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  🐝 Ponte Alveare — porta i dati dal cloud al vault Obsidian.
//  Uso:  HIVE_SECRET=xxx node tools/obsidian-hive.mjs   (oppure --secret=xxx)
//  Scarica progresso apprendimento + campioni coach → aggiorna dataset, dashboard
//  e la memoria "su-di-me" (sintesi generata dall'AI gratis).
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.HIVE_BASE || 'https://solo-levelling-gold.vercel.app';
const SECRET = process.env.HIVE_SECRET || (process.argv.find((a) => a.startsWith('--secret=')) || '').split('=')[1] || '';
const VAULT = process.env.HIVE_VAULT || '/Users/emanueleazzini/Library/Mobile Documents/iCloud~md~obsidian/Documents/brain/progetti/shadow-coach';

if (!SECRET) { console.error('❌ Manca HIVE_SECRET (env o --secret=...).'); process.exit(1); }

const nowISO = new Date().toISOString();
const stamp = nowISO.slice(0, 16).replace('T', ' ');

async function main() {
  // 1) scarica i dati
  const r = await fetch(`${BASE}/api/telegram/learn-export?secret=${encodeURIComponent(SECRET)}`);
  if (!r.ok) { console.error(`❌ Export fallito: ${r.status} ${await r.text()}`); process.exit(1); }
  const data = await r.json();
  const L = data.learn || {};
  console.log(`📥 Scaricato: Lv ${L.level} · ${L.xp} XP · streak ${L.streak} · ${data.samples?.length || 0} campioni coach`);

  // 2) dataset/learning.csv — append snapshot
  const totDone = (L.gates || []).reduce((s, g) => s + (g.done || 0), 0);
  const totCorr = (L.gates || []).reduce((s, g) => s + (g.correct || 0), 0);
  const totTot = (L.gates || []).reduce((s, g) => s + (g.total || 0), 0);
  const acc = totTot ? Math.round((totCorr / totTot) * 100) : 0;
  appendCsv('dataset/learning.csv', `${nowISO},all,${L.xp},${L.level},${L.streak},${totDone},${acc}`);

  // 2b) dataset/coach-samples.csv — append nuovi campioni
  if (Array.isArray(data.samples) && data.samples.length) {
    for (const s of data.samples) {
      const a = s.angles || {};
      appendCsv('dataset/coach-samples.csv',
        [s.ts || '', csv(s.exercise), a.eL ?? '', a.eR ?? '', a.kL ?? '', a.kR ?? '', a.hL ?? '', a.hR ?? '', a.lean ?? '',
         csv((s.alerts || []).join('; ')), csv(s.verdict || ''), csv(s.label || '')].join(','));
    }
  }

  // 3) dashboard.md
  const gateRows = (L.gates || []).map((g) => {
    const pct = g.size ? Math.min(100, Math.round((g.done / g.size) * 100)) : 0;
    const gacc = g.total ? Math.round((g.correct / g.total) * 100) : 0;
    return `| ${g.emoji} ${g.name} | ${pct}% | ${gacc}% | ${g.total} |`;
  }).join('\n');
  write('dashboard.md',
`---
tipo: dashboard
aggiornato: ${stamp}
---

# 📊 Dashboard — Shadow Coach

> Aggiornata dal ponte il ${stamp}

## ⚡ Stato
- **Livello:** ${L.level}  ·  **XP:** ${L.xp}  ·  **Streak:** 🔥 ${L.streak} giorni
- **Da ripassare (SRS):** ${L.srsDue}
- **Precisione totale:** ${acc}%  ·  **Domande fatte:** ${totTot}

## 🚪 Gate
| Gate | Avanzamento | Precisione | Risposte |
|---|---|---|---|
${gateRows || '| — | — | — | — |'}

## 🥋 Coach dataset
- Campioni raccolti: **${countLines('dataset/coach-samples.csv') - 1}** (file \`dataset/coach-samples.csv\`)

---
*Fonte: cloud → ponte \`tools/obsidian-hive.mjs\`*
`);

  // 4) memoria su-di-me.md — sintesi AI
  const weak = (L.gates || []).filter((g) => g.total >= 3).sort((x, y) => (x.correct / x.total) - (y.correct / y.total))[0];
  const ctx = `Livello ${L.level}, ${L.xp} XP, streak ${L.streak} giorni, precisione ${acc}%. Gate: ` +
    (L.gates || []).map((g) => `${g.name} ${g.total ? Math.round((g.correct / g.total) * 100) : 0}% (${g.done}/${g.size})`).join(', ') +
    `. Campioni coach: ${data.samples?.length || 0}.`;
  let memory = '';
  try {
    const ai = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [
        { role: 'system', content: 'Sei la memoria di un coach personale. Dai dati, scrivi un breve profilo in italiano (~120 parole) su questa persona: cosa sta imparando, punti di forza, dove è debole, e 2 consigli mirati. Tono diretto e personale ("tu"). Solo testo semplice, niente markdown.' },
        { role: 'user', content: ctx },
      ] }),
    });
    const j = await ai.json();
    memory = String(j?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[#*`]/g, '').trim();
  } catch (_) {}
  if (memory) {
    updateBetween('su-di-me.md', memory + `\n\n*(aggiornato ${stamp})*`);
    console.log('🧠 Memoria "su-di-me" aggiornata dall\'AI.');
  }

  // tocca l'indice
  touchUpdated('🐝 Shadow Coach Hive.md');
  console.log('✅ Alveare aggiornato.');
}

// ── util ──
const fp = (rel) => path.join(VAULT, rel);
function write(rel, content) { fs.mkdirSync(path.dirname(fp(rel)), { recursive: true }); fs.writeFileSync(fp(rel), content); }
function appendCsv(rel, line) { fs.mkdirSync(path.dirname(fp(rel)), { recursive: true }); fs.appendFileSync(fp(rel), line + '\n'); }
function countLines(rel) { try { return fs.readFileSync(fp(rel), 'utf8').split('\n').filter(Boolean).length; } catch { return 1; } }
function csv(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function updateBetween(rel, body) {
  let t = ''; try { t = fs.readFileSync(fp(rel), 'utf8'); } catch {}
  const block = `<!-- HIVE:MEMORY:START -->\n${body}\n<!-- HIVE:MEMORY:END -->`;
  if (t.includes('HIVE:MEMORY:START')) t = t.replace(/<!-- HIVE:MEMORY:START -->[\s\S]*?<!-- HIVE:MEMORY:END -->/, block);
  else t += `\n\n${block}\n`;
  fs.writeFileSync(fp(rel), t);
}
function touchUpdated(rel) {
  try { let t = fs.readFileSync(fp(rel), 'utf8'); t = t.replace(/^aggiornato:.*$/m, `aggiornato: ${stamp}`); fs.writeFileSync(fp(rel), t); } catch {}
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

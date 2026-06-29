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

  // 2b) dataset/coach-samples.csv — append SOLO i nuovi (dedup per ts, niente duplicati a ogni run)
  if (Array.isArray(data.samples) && data.samples.length) {
    ensureHeader('dataset/coach-samples.csv', 'ts,exercise,eL,eR,kL,kR,hL,hR,lean,alerts,verdict,label');
    const have = existingKeys('dataset/coach-samples.csv', 0);
    for (const s of data.samples) {
      if (have.has(String(s.ts))) continue;
      const a = s.angles || {};
      appendCsv('dataset/coach-samples.csv',
        [s.ts || '', csv(s.exercise), a.eL ?? '', a.eR ?? '', a.kL ?? '', a.kR ?? '', a.hL ?? '', a.hR ?? '', a.lean ?? '',
         csv((s.alerts || []).join('; ')), csv(s.verdict || ''), csv(s.label || '')].join(','));
    }
  }

  // 2c) dataset/meals.csv — storico pasti (dedup per ts) + sintesi dieta
  const meals = Array.isArray(data.meals) ? data.meals : [];
  if (meals.length) {
    ensureHeader('dataset/meals.csv', 'ts,date,slot,name,kcal,protein,carbs,fat');
    const have = existingKeys('dataset/meals.csv', 0);
    for (const m of meals) {
      if (have.has(String(m.ts))) continue;
      appendCsv('dataset/meals.csv',
        [m.ts || '', m.date || '', csv(m.slot || ''), csv(m.name || ''), m.kcal ?? '', m.protein ?? '', m.carbs ?? '', m.fat ?? ''].join(','));
    }
  }
  const diet = dietSummary(meals);
  const P = data.profile || {};

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
- Campioni raccolti: **${Math.max(0, countLines('dataset/coach-samples.csv') - 1)}** (file \`dataset/coach-samples.csv\`)

## 🍝 Dieta
${diet.days ? `- Giorni tracciati: **${diet.days}**  ·  Pasti: **${diet.count}**
- Media/giorno: **${diet.kcal} kcal** · P ${diet.protein}g · C ${diet.carbs}g · G ${diet.fat}g
- Ultimi 7 giorni: **${diet.kcal7} kcal/die** · P ${diet.protein7}g` : '- *(ancora nessun pasto registrato — mandane uno al bot)*'}

## 🧍 Profilo corporeo
${profileLine(P) || '- *(nessuna misurazione — scrivi al bot es. "peso 78kg")*'}

---
*Fonte: cloud → ponte \`tools/obsidian-hive.mjs\`*
`);

  // 4) memoria su-di-me.md — sintesi AI
  const weak = (L.gates || []).filter((g) => g.total >= 3).sort((x, y) => (x.correct / x.total) - (y.correct / y.total))[0];
  const ctx = `Livello ${L.level}, ${L.xp} XP, streak ${L.streak} giorni, precisione ${acc}%. Gate: ` +
    (L.gates || []).map((g) => `${g.name} ${g.total ? Math.round((g.correct / g.total) * 100) : 0}% (${g.done}/${g.size})`).join(', ') +
    `. Campioni coach: ${data.samples?.length || 0}.` +
    (diet.days ? ` Dieta (${diet.days}gg, ${diet.count} pasti): media ${diet.kcal} kcal/die, ${diet.protein}g proteine, ${diet.carbs}g carbo, ${diet.fat}g grassi; ultimi 7gg ${diet.kcal7} kcal/die.` : ' Nessun pasto registrato.') +
    (profileLine(P) ? ` Profilo: ${profileLine(P).replace(/\n?- /g, ' ').trim()}.` : '');
  let memory = '';
  try {
    const ai = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [
        { role: 'system', content: 'Sei la memoria di un coach personale (apprendimento + allenamento + NUTRIZIONE). Dai dati, scrivi un breve profilo in italiano (~140 parole) su questa persona: cosa sta imparando, punti di forza, dove è debole, com\'è la sua dieta (calorie/proteine vs fisico e obiettivo) e 2-3 consigli mirati anche alimentari. Tono diretto e personale ("tu"). Solo testo semplice, niente markdown.' },
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
function ensureHeader(rel, header) { try { if (!fs.existsSync(fp(rel)) || !fs.readFileSync(fp(rel), 'utf8').trim()) write(rel, header + '\n'); } catch { write(rel, header + '\n'); } }
function existingKeys(rel, idx) {
  const set = new Set();
  try { fs.readFileSync(fp(rel), 'utf8').split('\n').filter(Boolean).slice(1).forEach((l) => set.add((l.split(',')[idx] || '').trim())); } catch {}
  return set;
}
// Sintesi dieta: medie/giorno su tutto lo storico e sugli ultimi 7 giorni
function dietSummary(meals) {
  if (!Array.isArray(meals) || !meals.length) return { days: 0, count: 0 };
  const byDay = {};
  for (const m of meals) {
    const d = m.date || String(m.ts || '').slice(0, 10);
    if (!d) continue;
    (byDay[d] = byDay[d] || { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    byDay[d].kcal += +m.kcal || 0; byDay[d].protein += +m.protein || 0; byDay[d].carbs += +m.carbs || 0; byDay[d].fat += +m.fat || 0;
  }
  const days = Object.keys(byDay).sort();
  const avg = (ds, k) => ds.length ? Math.round(ds.reduce((s, d) => s + byDay[d][k], 0) / ds.length) : 0;
  const last7 = days.slice(-7);
  return {
    days: days.length, count: meals.length,
    kcal: avg(days, 'kcal'), protein: avg(days, 'protein'), carbs: avg(days, 'carbs'), fat: avg(days, 'fat'),
    kcal7: avg(last7, 'kcal'), protein7: avg(last7, 'protein'),
  };
}
function profileLine(P) {
  if (!P || typeof P !== 'object') return '';
  const bits = [];
  if (P.weightKg != null) bits.push(`- Peso: **${P.weightKg} kg**${P.targetWeightKg != null ? ` (target ${P.targetWeightKg} kg)` : ''}`);
  if (P.heightCm != null) bits.push(`- Altezza: **${P.heightCm} cm**`);
  if (P.bodyFatPct != null) bits.push(`- Body fat: **${P.bodyFatPct}%**`);
  if (P.muscleMassKg != null) bits.push(`- Muscolo: **${P.muscleMassKg} kg**`);
  if (P.leanMassKg != null) bits.push(`- Massa magra: **${P.leanMassKg} kg**`);
  if (P.visceralFat != null) bits.push(`- Grasso viscerale: **${P.visceralFat}**`);
  if (P.age != null) bits.push(`- Età: **${P.age}**`);
  return bits.join('\n');
}
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

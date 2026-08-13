#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  🐝 Ponte Alveare — porta i dati dal cloud al vault Obsidian.
//  Uso:  HIVE_SECRET=xxx node tools/obsidian-hive.mjs   (oppure --secret=xxx)
//  Scarica progresso apprendimento + campioni coach → aggiorna dataset, dashboard
//  e la memoria "su-di-me" (sintesi generata dall'AI gratis).
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.HIVE_BASE || 'https://solo-levelling-steel.vercel.app';
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

  // 2d) SESSIONI COACH → dataset/sessions.csv (dedup per ts) + progressione allenamento.md
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  if (sessions.length) {
    ensureHeader('dataset/sessions.csv', 'ts,date,discipline,durationMin,sampleCount,score,xp,strengths,weaknesses,focusNext,nextDrill,techniqueSecret');
    const have = existingKeys('dataset/sessions.csv', 0);
    for (const s of sessions) {
      if (have.has(String(s.ts))) continue;
      appendCsv('dataset/sessions.csv',
        [s.ts || '', s.date || '', csv(s.discipline || s.mode || ''), s.durationMin ?? '', s.sampleCount ?? '',
         s.score ?? '', s.xp ?? '', csv((s.strengths || []).join('; ')), csv((s.weaknesses || []).join('; ')),
         csv((s.focusNext || []).join('; ')), csv(s.nextDrill || ''), csv(s.techniqueSecret || '')].join(','));
    }
  }
  const train = trainSummary(sessions);
  writeTrainingJournal(sessions, train);
  console.log(`🥋 Sessioni coach: ${sessions.length} (${train.count ? `voto medio ${train.avgScore}, ultimo ${train.lastScore}` : 'nessuna pagella'})`);

  // 2e) dataset/coach-progress.csv — progressione per disciplina (snapshot riscritto a ogni run)
  const prog = data.coachProgress && typeof data.coachProgress === 'object' ? data.coachProgress : {};
  const progRows = Object.entries(prog)
    .filter(([, p]) => p && typeof p === 'object')
    .map(([disc, p]) => [nowISO, csv(disc), Number(p.xp) || 0, Number(p.sessions) || 0, Number(p.best) || 0, Math.floor((Number(p.xp) || 0) / 150) + 1].join(','));
  if (progRows.length) {
    write('dataset/coach-progress.csv', `ts,discipline,xp,sessions,best,level\n${progRows.join('\n')}\n`);
    console.log(`🏆 Progressione coach: ${progRows.length} discipline`);
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

## 🥋 Allenamento
${train.count ? `- Sessioni: **${train.count}**  ·  Voto medio: **${train.avgScore}/100**  ·  Ultima: **${train.lastScore}/100** ${train.trendIcon}  ·  XP coach: **${train.xpTotal}**
- Ultima disciplina: **${train.lastDiscipline}** (${train.lastDate})
- 🎯 Focus prossima sessione: ${train.focusNext.length ? train.focusNext.map((f) => `**${f}**`).join(' · ') : '—'}
- ⚠️ Debolezze ricorrenti: ${train.topWeak.length ? train.topWeak.join(' · ') : '—'}
- 🥷 Da studiare: ${train.techniqueSecret || '—'}
- Campioni frame: **${Math.max(0, countLines('dataset/coach-samples.csv') - 1)}** · Diario: \`allenamento.md\`` : `- *(ancora nessuna sessione col Coach Live — apri il coach e allenati)*
- Campioni frame: **${Math.max(0, countLines('dataset/coach-samples.csv') - 1)}**`}

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
    (train.count ? ` Allenamento: ${train.count} sessioni, voto medio ${train.avgScore}/100 (ultima ${train.lastScore}, ${train.lastDiscipline}), trend ${train.trendWord}. Debolezze ricorrenti: ${train.topWeak.join(', ') || '-'}. Focus prossima: ${train.focusNext.join(', ') || '-'}.` : ' Nessuna sessione col coach.') +
    (diet.days ? ` Dieta (${diet.days}gg, ${diet.count} pasti): media ${diet.kcal} kcal/die, ${diet.protein}g proteine, ${diet.carbs}g carbo, ${diet.fat}g grassi; ultimi 7gg ${diet.kcal7} kcal/die.` : ' Nessun pasto registrato.') +
    (profileLine(P) ? ` Profilo: ${profileLine(P).replace(/\n?- /g, ' ').trim()}.` : '');
  let memory = '';
  try {
    // Da Node non c'è header Origin: il guard del proxy AI ci accetta via
    // x-solo-client (HIVE_SECRET è già una credenziale valida per il guard).
    const ai = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-solo-client': SECRET },
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

  // preferenze.md — dichiarate + apprese (ricette e allenamento), stile "più ti piace più mostro"
  writePreferences(data.webPrefs || {});
  console.log('🎛️ Preferenze aggiornate (dichiarate + apprese).');

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
// Sintesi allenamento: trend voti, debolezze ricorrenti, focus e segreto correnti
function trainSummary(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) return { count: 0, focusNext: [], topWeak: [] };
  const arr = sessions.slice();
  const scores = arr.map((s) => +s.score || 0);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const last = arr[arr.length - 1];
  const lastScore = +last.score || 0;
  const xpTotal = arr.reduce((a, s) => a + (+s.xp || 0), 0);
  // trend: ultima vs media delle precedenti
  const prev = scores.slice(0, -1);
  const prevAvg = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : lastScore;
  const delta = lastScore - prevAvg;
  const trendIcon = delta > 3 ? '📈' : delta < -3 ? '📉' : '➡️';
  const trendWord = delta > 3 ? 'in miglioramento' : delta < -3 ? 'in calo' : 'stabile';
  // debolezze ricorrenti (frequenza sulle ultime 8 sessioni)
  const freq = {};
  for (const s of arr.slice(-8)) for (const w of (s.weaknesses || [])) {
    const k = String(w).toLowerCase().slice(0, 60); freq[k] = (freq[k] || 0) + 1;
  }
  const topWeak = Object.entries(freq).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return {
    count: arr.length, avgScore, lastScore, xpTotal,
    lastDiscipline: last.discipline || last.mode || '—', lastDate: (last.date || last.ts || '').slice(0, 10),
    trendIcon, trendWord,
    focusNext: (last.focusNext || []).slice(0, 3),
    nextDrill: last.nextDrill || '',
    techniqueSecret: last.techniqueSecret || '',
    topWeak,
    spark: sparkline(scores.slice(-16)),
  };
}
function sparkline(nums) {
  if (!nums || !nums.length) return '';
  const bars = '▁▂▃▄▅▆▇█';
  const lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo || 1;
  return nums.map((n) => bars[Math.min(7, Math.round(((n - lo) / span) * 7))]).join('');
}
function writeTrainingJournal(sessions, train) {
  if (!train.count) return;
  const rows = sessions.slice(-20).reverse().map((s) => {
    const d = (s.date || s.ts || '').slice(0, 10);
    return `| ${d} | ${csv(s.discipline || s.mode || '')} | ${s.durationMin ?? '-'}m | **${s.score ?? '-'}** | ${mdCell((s.strengths || []).join('; '))} | ${mdCell((s.weaknesses || []).join('; '))} | ${mdCell((s.focusNext || []).join('; '))} |`;
  }).join('\n');
  write('allenamento.md',
`---
tipo: allenamento
aggiornato: ${stamp}
---

# 🥋 Diario Allenamento — Shadow Coach

> Il coach ricorda ogni sessione e alza l'asticella. Aggiornato dal ponte il ${stamp}

## 📈 Progressione
- **Sessioni:** ${train.count}  ·  **Voto medio:** ${train.avgScore}/100  ·  **Ultima:** ${train.lastScore}/100 ${train.trendIcon} (${train.trendWord})  ·  **XP coach:** ${train.xpTotal}
- **Andamento voti:** \`${train.spark}\`
- **🎯 Focus prossima sessione:** ${train.focusNext.length ? train.focusNext.map((f) => `**${f}**`).join(' · ') : '—'}
- **⚠️ Debolezze ricorrenti:** ${train.topWeak.length ? train.topWeak.join(' · ') : '—'}
- **🥷 Prossimo drill:** ${train.nextDrill || '—'}
- **📜 Da studiare:** ${train.techniqueSecret || '—'}

## 📓 Log sessioni (ultime 20)
| Data | Disciplina | Durata | Voto | Punti di forza | Da correggere | Focus prossima |
|---|---|---|---|---|---|---|
${rows}

---
*Fonte: Coach Live → KV \`coach_sessions\` → ponte \`tools/obsidian-hive.mjs\`*
`);
}
function mdCell(v) { return String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 90) || '—'; }

// Aggrega frequenza pesata per recency (stile "più ti piace/riesce, più pesa") da una lista di
// {tag/focus, score} — usato sia per le affinità ricette (like/dislike) sia per il focus allenamento
// (voto perfect/good/redo). Ritorna { liked:[...top], avoided:[...worst] }.
function weightedAffinity(rows, keyFn, scoreFn) {
  const score = {};
  rows.forEach((r, i) => {
    const boost = i >= rows.length - 30 ? 2 : 1;
    const k = keyFn(r);
    if (!k) return;
    score[k] = (score[k] || 0) + scoreFn(r) * boost;
  });
  const entries = Object.entries(score);
  const liked = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const avoided = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([k]) => k);
  return { liked, avoided };
}

// preferenze.md — dichiarate (dal pannello web) + apprese (feedback ricette + voti allenamento).
// Il "più ti piace/riesce, più te ne propongo" è visibile qui: le voci in cima sono quelle che il
// sistema userà di più nelle prossime ricette/combo (vedi computeFoodAffinity in SystemHub.jsx e
// il peso focusWeights in pickCombo, Coach.jsx — questo file è lo specchio leggibile di quei pesi).
function writePreferences(webPrefs) {
  const fp2 = webPrefs.foodPrefs || {};
  const declaredLines = [];
  if (fp2.diet) declaredLines.push(`- **Regime:** ${fp2.diet}`);
  if (fp2.allergies) declaredLines.push(`- **⚠️ Allergie (vincolo assoluto):** ${fp2.allergies}`);
  if (fp2.dislikes) declaredLines.push(`- **Non gradisce:** ${fp2.dislikes}`);
  if (fp2.likes) declaredLines.push(`- **Adora:** ${fp2.likes}`);
  if (fp2.cuisine) declaredLines.push(`- **Cucina preferita:** ${fp2.cuisine}`);
  if (fp2.spice && fp2.spice !== 'normale') declaredLines.push(`- **Piccantezza:** ${fp2.spice}`);
  if (fp2.maxPrepMin > 0) declaredLines.push(`- **Tempo prep max:** ${fp2.maxPrepMin} min`);

  const recipeFb = Array.isArray(webPrefs.recipeFeedback) ? webPrefs.recipeFeedback : [];
  const recipeAff = weightedAffinity(
    recipeFb.flatMap((r) => (r.tags || []).map((t) => ({ tag: String(t).toLowerCase(), liked: r.liked }))),
    (r) => r.tag,
    (r) => (r.liked === 'up' ? 1 : r.liked === 'down' ? -1 : 0),
  );

  const comboHist = Array.isArray(webPrefs.comboFocusHistory) ? webPrefs.comboFocusHistory : [];
  const byDiscipline = {};
  comboHist.forEach((h) => { (byDiscipline[h.mode] = byDiscipline[h.mode] || []).push(h); });
  const disciplineRows = Object.entries(byDiscipline).map(([mode, rows]) => {
    const aff = weightedAffinity(rows, (r) => r.focus, (r) => (r.grade === 'perfect' ? 2 : r.grade === 'good' ? 1 : -1));
    return `| ${mode} | ${rows.length} | ${aff.liked.slice(0, 3).join(', ') || '—'} | ${aff.avoided.slice(0, 2).join(', ') || '—'} |`;
  });

  write('preferenze.md',
`---
tipo: preferenze
aggiornato: ${stamp}
---

# 🎛️ Preferenze — Dichiarate e Apprese

> Il sistema impara dai tuoi 👍/👎 e dai tuoi voti in allenamento: più ti piace/riesce una cosa,
> più te la propone (stile "For You"). Qui vedi cosa ha imparato finora. Aggiornato il ${stamp}

## 📋 Dichiarate (dal pannello Recipe Forge)
${declaredLines.length ? declaredLines.join('\n') : '- *(nessuna preferenza dichiarata ancora — apri Recipe Forge → 🎛️ Preferenze)*'}

## 🍽️ Ricette — cosa hai imparato ad apprezzare
${recipeFb.length ? `- Feedback raccolti: **${recipeFb.length}**
- 👍 Apprezza spesso: ${recipeAff.liked.join(', ') || '—'}
- 👎 Da evitare: ${recipeAff.avoided.join(', ') || '—'}` : '- *(nessun feedback ancora — usa 👍/👎 sotto le ricette generate)*'}

## 🥋 Allenamento — focus che ti riescono meglio (per disciplina)
${disciplineRows.length ? `| Disciplina | Combo giudicate | 💪 Focus migliori | ⚠️ Da consolidare |
|---|---|---|---|
${disciplineRows.join('\n')}` : '- *(nessun dato ancora — usa la Combo Mode nel Coach Live)*'}

---
*Fonte: pannello web + Combo Mode → KV \`web_prefs\` → ponte \`tools/obsidian-hive.mjs\`*
`);
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

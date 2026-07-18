#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  🌙 Ricercatore Notturno — cerca da solo paper scientifici tutta la notte,
//  SENZA usare token di assistenti a pagamento. Fonti gratuite:
//   • PubMed E-utilities   (peer-reviewed, no key)
//   • Europe PMC           (abstract, no key)
//   • Semantic Scholar     (metadati + abstract, no key)
//   • Crossref             (metadati, no key)
//   • Tavily               (divulgazione/libri, SOLO se TAVILY_API_KEY presente)
//
//  Uso:   node tools/night-researcher.mjs [--limit N] [--distill] [--dry]
//  Scrive i nuovi studi come  papers/auto-YYYYMMDD-<slug>.txt  nel formato paper.
//  Con --distill (se ci sono le key AI) lancia anche tools/knowledge.mjs a fine giro.
//  La mattina: apri Obsidian, leggi i nuovi 'auto-*', tieni i buoni, butta il resto.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Repo reale (per trovare knowledge.mjs): quando lo script gira dalla copia locale
// fuori iCloud, __dirname non è il repo → punta esplicitamente al repo in iCloud.
const REPO = process.env.RESEARCH_REPO || '/Users/emanueleazzini/Library/Mobile Documents/com~apple~CloudDocs/solo levelling';
const VAULT = process.env.HIVE_VAULT || '/Users/emanueleazzini/Library/Mobile Documents/iCloud~md~obsidian/Documents/brain/progetti/shadow-coach';
const PAPERS = path.join(VAULT, 'papers');
const SEEN = path.join(PAPERS, '.night-seen.json');
const LOG = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); };

const args = process.argv.slice(2);
const LIMIT = Math.max(1, parseInt(args[find('--limit')] === undefined ? '12' : args[args.indexOf('--limit') + 1]) || 12);
const DO_DISTILL = args.includes('--distill');
const DRY = args.includes('--dry');
function find(f) { const i = args.indexOf(f); return i === -1 ? undefined : i + 1; }

// Carica TAVILY key opzionale da .env locale (mai stamparla)
let TAVILY_KEY = process.env.TAVILY_API_KEY || '';
try {
  if (!TAVILY_KEY && fs.existsSync(path.join(REPO, '.env'))) {
    const m = fs.readFileSync(path.join(REPO, '.env'), 'utf8').match(/TAVILY_API_KEY\s*=\s*(.+)/);
    if (m) TAVILY_KEY = m[1].trim().replace(/["']/g, '');
  }
} catch {}

// ─── TEMI CANDIDATI ──────────────────────────────────────────────────────────
// Ampia lista di temi di frontiera su nutrizione / longevità / salute / mente /
// performance. Ogni voce: { q: query PubMed (EN), slug, tag }. Lo script pesca a
// rotazione quelli non ancora coperti dai paper esistenti.
const SEED = [
  // — Nutrizione & metabolismo —
  { q: 'time restricted eating metabolic health randomized', slug: 'tre-salute-metabolica', tag: 'nutrizione' },
  { q: 'polyphenols gut microbiome health human trial', slug: 'polifenoli-microbioma', tag: 'nutrizione' },
  { q: 'postbiotics metabolic health randomized controlled', slug: 'postbiotici-metabolismo', tag: 'nutrizione' },
  { q: 'dietary fiber diversity microbiome inflammation', slug: 'fibre-diversita-microbioma', tag: 'nutrizione' },
  { q: 'meal timing circadian glucose metabolism', slug: 'timing-pasti-circadiano', tag: 'nutrizione' },
  { q: 'extra virgin olive oil polyphenols cardiovascular cognition', slug: 'evoo-polifenoli-salute', tag: 'nutrizione' },
  { q: 'legumes pulses mortality cardiovascular meta-analysis', slug: 'legumi-mortalita', tag: 'nutrizione' },
  { q: 'nuts consumption longevity cardiovascular cohort', slug: 'frutta-secca-longevita', tag: 'nutrizione' },
  { q: 'fermented foods immune microbiome randomized', slug: 'fermentati-immunita', tag: 'nutrizione' },
  { q: 'protein distribution muscle synthesis older adults', slug: 'proteine-distribuzione-anziani', tag: 'nutrizione' },
  { q: 'plant based diet inflammation biomarkers trial', slug: 'dieta-vegetale-infiammazione', tag: 'nutrizione' },
  { q: 'vinegar acetic acid postprandial glycemia', slug: 'aceto-glicemia', tag: 'nutrizione' },
  { q: 'food order carbohydrate last glucose response', slug: 'ordine-cibi-glicemia', tag: 'nutrizione' },
  { q: 'choline TMAO cardiovascular risk red meat', slug: 'colina-tmao-rischio', tag: 'nutrizione' },
  { q: 'anthocyanins berries cognition endothelial function', slug: 'antociani-cognizione', tag: 'nutrizione' },
  { q: 'magnesium glycinate sleep anxiety randomized', slug: 'magnesio-forme-sonno', tag: 'nutrizione' },
  { q: 'sulforaphane broccoli sprouts NRF2 human', slug: 'sulforafano-nrf2', tag: 'nutrizione' },
  { q: 'exogenous ketones cognition exercise performance', slug: 'chetoni-esogeni-cognizione', tag: 'nutrizione' },
  { q: 'apigenin luteolin neuroprotection sleep', slug: 'apigenina-neuroprotezione', tag: 'nutrizione' },
  { q: 'dietary nitrate beetroot blood pressure exercise', slug: 'nitrati-pressione-performance', tag: 'nutrizione' },
  { q: 'akkermansia muciniphila metabolic supplementation', slug: 'akkermansia-metabolismo', tag: 'nutrizione' },
  { q: 'omega 3 index cardiovascular mortality dose', slug: 'omega3-index-mortalita', tag: 'nutrizione' },
  { q: 'creatine cognition brain sleep deprivation', slug: 'creatina-cervello-sonno', tag: 'nutrizione' },
  { q: 'vitamin D supplementation mortality meta-analysis', slug: 'vitamina-d-mortalita-nuovo', tag: 'nutrizione' },
  { q: 'coffee consumption all-cause mortality dose response', slug: 'caffe-mortalita-dose', tag: 'nutrizione' },
  { q: 'green tea catechins metabolism weight', slug: 'te-verde-metabolismo', tag: 'nutrizione' },
  { q: 'ultra-processed food mortality NOVA cohort', slug: 'ultraprocessati-mortalita-nuovo', tag: 'nutrizione' },
  { q: 'added sugar cardiometabolic risk dose', slug: 'zucchero-rischio-nuovo', tag: 'nutrizione' },

  // — Longevità & geroscienza —
  { q: 'rapamycin lifespan healthspan human trial', slug: 'rapamicina-umani', tag: 'longevita' },
  { q: 'partial epigenetic reprogramming aging OSK', slug: 'riprogrammazione-parziale', tag: 'longevita' },
  { q: 'senolytics fisetin quercetin clinical trial', slug: 'senolitici-trial', tag: 'longevita' },
  { q: 'NAD+ precursors NMN NR aging human', slug: 'nad-precursori-umani', tag: 'longevita' },
  { q: 'spermidine autophagy longevity human cohort', slug: 'spermidina-autofagia', tag: 'longevita' },
  { q: 'taurine deficiency aging supplementation', slug: 'taurina-invecchiamento-nuovo', tag: 'longevita' },
  { q: 'urolithin A mitophagy muscle mitochondria', slug: 'urolitina-mitofagia', tag: 'longevita' },
  { q: 'GlyNAC glutathione mitochondria aging trial', slug: 'glynac-mitocondri', tag: 'longevita' },
  { q: 'IL-11 inhibition lifespan aging', slug: 'il11-lifespan', tag: 'longevita' },
  { q: 'plasma dilution therapeutic exchange rejuvenation', slug: 'plasma-diluizione', tag: 'longevita' },
  { q: 'epigenetic clock reversal intervention human', slug: 'orologio-epigenetico-reversibilita', tag: 'longevita' },
  { q: 'SGLT2 inhibitors longevity mortality all-cause', slug: 'sglt2-longevita', tag: 'longevita' },
  { q: 'acarbose 17-alpha-estradiol ITP lifespan', slug: 'geroprotettori-itp', tag: 'longevita' },
  { q: 'caloric restriction CALERIE humans aging', slug: 'restrizione-calorica-umani', tag: 'longevita' },
  { q: 'hyperbaric oxygen telomeres senescence trial', slug: 'ossigeno-iperbarico-telomeri', tag: 'longevita' },
  { q: 'muscle mass sarcopenia mortality older adults', slug: 'sarcopenia-mortalita', tag: 'longevita' },
  { q: 'blue zones lifestyle longevity determinants', slug: 'zone-blu-longevita', tag: 'longevita' },
  { q: 'intermittent hypoxia conditioning hormesis health', slug: 'ipossia-intermittente', tag: 'longevita' },
  { q: 'centenarian microbiome longevity signature', slug: 'microbioma-centenari', tag: 'longevita' },
  { q: 'lithium microdose longevity neuroprotection', slug: 'litio-microdose', tag: 'longevita' },

  // — Sonno & ritmi circadiani —
  { q: 'sleep regularity mortality cardiovascular cohort', slug: 'regolarita-sonno', tag: 'salute' },
  { q: 'deep slow wave sleep memory acoustic stimulation', slug: 'onde-lente-memoria', tag: 'salute' },
  { q: 'evening exercise sleep architecture', slug: 'esercizio-serale-sonno', tag: 'salute' },
  { q: 'glymphatic system sleep brain clearance', slug: 'glinfatico-cervello', tag: 'salute' },
  { q: 'morning light exposure circadian cortisol', slug: 'luce-mattutina-circadiano', tag: 'salute' },
  { q: 'social jetlag cardiometabolic risk chronotype', slug: 'social-jetlag', tag: 'salute' },
  { q: 'obstructive sleep apnea CPAP cardiovascular', slug: 'apnee-cpap', tag: 'salute' },
  { q: 'napping duration cognition cardiovascular', slug: 'sieste-cognizione', tag: 'salute' },

  // — Esercizio & performance —
  { q: 'VO2max cardiorespiratory fitness mortality', slug: 'vo2max-mortalita', tag: 'salute' },
  { q: 'grip strength biomarker mortality aging', slug: 'forza-presa-mortalita', tag: 'salute' },
  { q: 'exercise snacks sedentary interruption glucose', slug: 'exercise-snacks', tag: 'salute' },
  { q: 'zone 2 training mitochondria lactate threshold', slug: 'zone2-mitocondri', tag: 'salute' },
  { q: 'resistance training all-cause mortality dose', slug: 'forza-mortalita', tag: 'salute' },
  { q: 'muscle power output mortality older adults', slug: 'potenza-muscolare-mortalita', tag: 'salute' },
  { q: 'isometric exercise blood pressure wall sit', slug: 'isometrici-pressione', tag: 'salute' },
  { q: 'weekend warrior physical activity dementia', slug: 'weekend-warrior', tag: 'salute' },
  { q: 'HIIT 4x4 interval VO2max older adults', slug: 'hiit-4x4-anziani', tag: 'salute' },
  { q: 'daily steps mortality dose response', slug: 'passi-mortalita', tag: 'salute' },
  { q: 'walking speed gait mortality predictor', slug: 'velocita-cammino-mortalita', tag: 'salute' },
  { q: 'blood flow restriction training hypertrophy', slug: 'bfr-ipertrofia', tag: 'salute' },

  // — Mente, cervello & prevenzione —
  { q: 'exercise depression anxiety meta-analysis', slug: 'esercizio-depressione', tag: 'salute' },
  { q: 'hearing loss dementia hearing aids prevention', slug: 'udito-demenza', tag: 'salute' },
  { q: 'loneliness social isolation mortality inflammation', slug: 'solitudine-mortalita', tag: 'salute' },
  { q: 'chronic low grade inflammation IL-6 inflammaging', slug: 'inflammaging-il6', tag: 'salute' },
  { q: 'gut brain axis microbiome mood depression', slug: 'asse-intestino-cervello', tag: 'salute' },
  { q: 'periodontitis oral health cardiovascular systemic', slug: 'salute-orale-sistemica', tag: 'salute' },
  { q: 'time in nature stress cortisol immunity', slug: 'natura-stress-immunita', tag: 'salute' },
  { q: 'sauna bathing cardiovascular mortality', slug: 'sauna-mortalita', tag: 'salute' },
  { q: 'cold water immersion metabolism dopamine', slug: 'freddo-metabolismo-dopamina', tag: 'salute' },
  { q: 'mindfulness meditation telomeres cortisol', slug: 'mindfulness-telomeri', tag: 'salute' },
  { q: 'slow breathing HRV blood pressure resonance', slug: 'respiro-lento-hrv', tag: 'salute' },
  { q: 'women exercise dose mortality benefit sex difference', slug: 'donne-esercizio-mortalita', tag: 'salute' },
];

// ─── UTILITÀ ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Decodifica le entità HTML più comuni degli abstract (α, β, ≥, ×, &, …)
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ' '; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ' '; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}
async function getJSON(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: ctrl.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
async function getText(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.text() : null; }
  catch { return null; } finally { clearTimeout(t); }
}

// Coperto? confronto con gli slug dei .txt già presenti (parole chiave in comune)
function buildCovered() {
  const files = fs.existsSync(PAPERS) ? fs.readdirSync(PAPERS).filter((f) => f.endsWith('.txt')) : [];
  return files.map((f) => f.replace(/\.txt$/, '').replace(/^(n2|l2|s2|auto-\d+)-/, ''));
}
function isCovered(slug, covered) {
  const words = slug.split('-').filter((w) => w.length > 3);
  return covered.some((c) => {
    const cw = new Set(c.split('-'));
    const hits = words.filter((w) => cw.has(w)).length;
    return hits >= 2 || (words.length === 1 && cw.has(words[0]));
  });
}

// ─── FONTI ───────────────────────────────────────────────────────────────────
// PubMed: esearch → efetch (abstract in XML). Filtra ultimi 3 anni, review/RCT.
async function pubmed(q) {
  const term = encodeURIComponent(`${q} AND ("2023"[PDAT] : "3000"[PDAT])`);
  const s = await getJSON(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=1&sort=relevance&term=${term}`);
  const id = s?.esearchresult?.idlist?.[0];
  if (!id) return null;
  const xml = await getText(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${id}&rettype=abstract&retmode=xml`);
  if (!xml) return null;
  const pick = (re) => (xml.match(re) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = pick(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
  const abstract = [...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ');
  const journal = pick(/<Title>([\s\S]*?)<\/Title>/);
  const year = pick(/<Year>(\d{4})<\/Year>/);
  if (!abstract || abstract.length < 120) return null;
  return { source: `PubMed`, id, title, abstract, journal, year, ref: `PMID: ${id}` };
}
async function europepmc(q) {
  const d = await getJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q + ' AND (PUB_YEAR:[2023 TO 3000])')}&format=json&pageSize=1&resultType=core`);
  const r = d?.resultList?.result?.[0];
  if (!r?.abstractText || r.abstractText.length < 120) return null;
  return { source: 'Europe PMC', id: r.id, title: r.title, abstract: r.abstractText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), journal: r.journalTitle, year: r.pubYear, ref: r.pmid ? `PMID: ${r.pmid}` : (r.doi ? `DOI: ${r.doi}` : r.id) };
}
async function semanticscholar(q) {
  const d = await getJSON(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=1&year=2023-&fields=title,abstract,year,venue,externalIds`);
  const r = d?.data?.[0];
  if (!r?.abstract || r.abstract.length < 120) return null;
  return { source: 'Semantic Scholar', id: r.paperId, title: r.title, abstract: r.abstract.replace(/\s+/g, ' ').trim(), journal: r.venue, year: r.year, ref: r.externalIds?.DOI ? `DOI: ${r.externalIds.DOI}` : r.paperId };
}
async function tavily(q) {
  if (!TAVILY_KEY) return null;
  const d = await getJSON('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TAVILY_KEY, query: q, search_depth: 'basic', max_results: 3, include_answer: true }),
  });
  if (!d?.answer || d.answer.length < 120) return null;
  const src = (d.results || []).map((r) => r.title).slice(0, 2).join('; ');
  return { source: 'Web/Tavily', id: '', title: q, abstract: d.answer.replace(/\s+/g, ' ').trim(), journal: src, year: new Date().getFullYear(), ref: 'sintesi web' };
}

// Prova le fonti in ordine di rigore finché una restituisce un abstract usabile
async function research(seed) {
  for (const fn of [pubmed, europepmc, semanticscholar, tavily]) {
    try { const r = await fn(seed.q); if (r) return r; } catch {}
    await sleep(600);
  }
  return null;
}

function toPaper(seed, r) {
  return `FONTE: ${decodeEntities(r.title) || seed.q} — ${[r.journal, r.year].filter(Boolean).join(' ')} (${r.source}${r.ref ? ', ' + r.ref : ''}).

TEMA: ${seed.q} [tema: ${seed.tag}]

DATI CHIAVE (abstract originale):
${decodeEntities(r.abstract)}

CAVEAT: Abstract grezzo raccolto in automatico dal Ricercatore Notturno da ${r.source}. Va validato in fase di distillazione: verifica popolazione, dimensione del campione e se l'evidenza è su uomo o modello animale prima di trattarlo come principio.

IMPLICAZIONE PRATICA: (da estrarre in distillazione — un consiglio azionabile per allenamento/nutrizione/recupero).
`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(PAPERS)) fs.mkdirSync(PAPERS, { recursive: true });
  let seen = {};
  try { seen = JSON.parse(fs.readFileSync(SEEN, 'utf8')); } catch {}
  const covered = buildCovered();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // temi ancora da fare: non coperti da file esistenti e non già visti di recente
  const pool = SEED.filter((s) => !isCovered(s.slug, covered) && !seen[s.slug]);
  // se abbiamo esaurito i nuovi, riparti dai meno recenti (ricicla, cercando update)
  const queue = (pool.length ? pool : SEED.slice().sort((a, b) => (seen[a.slug] || 0) - (seen[b.slug] || 0)))
    .sort(() => Math.random() - 0.5).slice(0, LIMIT);

  LOG(`🌙 Ricercatore Notturno — ${queue.length} temi in coda (pool nuovi: ${pool.length}), Tavily: ${TAVILY_KEY ? 'on' : 'off'}, dry: ${DRY}`);
  let written = 0;
  for (const seed of queue) {
    const r = await research(seed);
    if (!r) { LOG(`  ✗ nessuna fonte per: ${seed.slug}`); seen[seed.slug] = Date.now(); continue; }
    const fname = `auto-${today}-${seed.slug}.txt`;
    const fpath = path.join(PAPERS, fname);
    if (DRY) { LOG(`  ~ [dry] ${fname}  ←  ${r.source}: ${(r.title || '').slice(0, 70)}`); }
    else if (fs.existsSync(fpath)) { LOG(`  · già presente: ${fname}`); }
    else { fs.writeFileSync(fpath, toPaper(seed, r)); written++; LOG(`  ✓ ${fname}  ←  ${r.source}`); }
    seen[seed.slug] = Date.now();
    await sleep(1200); // prudente: gentile con le API gratuite
  }
  if (!DRY) fs.writeFileSync(SEEN, JSON.stringify(seen, null, 2));
  LOG(`🌙 Fatto: ${written} nuovi paper scritti in papers/ (prefisso auto-${today}-).`);

  if (DO_DISTILL && written > 0 && !DRY) {
    LOG('⚗️  Distillazione in corso (tools/knowledge.mjs)…');
    const res = spawnSync('node', [path.join(REPO, 'tools', 'knowledge.mjs')], { cwd: REPO, stdio: 'inherit', env: process.env });
    LOG(`⚗️  Distillazione terminata (exit ${res.status}).`);
  }
})();

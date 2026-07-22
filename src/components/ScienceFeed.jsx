import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NUTRITION_PRINCIPLES, KNOWLEDGE_SOURCES } from '../../lib/knowledgeBase.js';
import { SCIENCE_HIGHLIGHTS, SCIENCE_CATEGORIES, scienceCategoryOf } from '../../lib/scienceHighlights.js';

// ─────────────────────────────────────────────────────────────────────────────
//  ScienceFeed — "Novità dagli Studi" vivo e personale.
//  Non più 22 card statiche: pesca dai 1463 principi reali distillati dai paper,
//  li adatta allo stato attuale dell'utente (sonno/stress/energia/intestino/fame)
//  e rende ogni scoperta AZIONABILE — chiedi al coach di applicarla, o salvala.
//  Props:
//    signals   : [{ key, label, emoji, query }] segnali derivati dai check-in
//    onAskCoach: (question:string) => void  invia una domanda al coach in-hub
//    onToast   : (msg:string) => void       feedback leggero (opzionale)
// ─────────────────────────────────────────────────────────────────────────────

const FAV_KEY = 'shadow_monarch_science_favorites';

// Mirror della tokenizzazione usata da knowledgeBase.knowledgePromptFor: match per
// RADICE (prefisso 6 caratteri) così plurali e declinazioni combaciano.
const rootTokens = (s) =>
  (String(s || '').toLowerCase().match(/[a-zà-ü]{4,}/g) || []).map((w) => w.slice(0, 6));

// I principi grezzi includono righe "FONTE: PMID…" e prefissi tipo "IMPLICAZIONE:".
// Qui li ripuliamo per la UI: le righe-fonte non si mostrano (ritornano null).
const cleanPrinciple = (p) => {
  const raw = String(p || '').trim();
  if (!raw || /^FONTE\s*:/i.test(raw)) return null;
  const stripped = raw.replace(/^(IMPLICAZIONE(?:\s+PRATICA)?|DATI\s+CHIAVE|TEMA|CAVEAT)\s*:\s*/i, '').trim();
  if (stripped.length < 12) return null;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};

// Ordina i principi (già puliti) per pertinenza a una query. Ritorna le stringhe pulite.
const searchPrinciples = (query, limit = 8) => {
  const qTokens = new Set(rootTokens(query));
  if (!qTokens.size) return [];
  const scored = [];
  for (const p of NUTRITION_PRINCIPLES) {
    const clean = cleanPrinciple(p);
    if (!clean) continue;
    let score = 0;
    for (const t of rootTokens(clean)) if (qTokens.has(t)) score++;
    if (score > 0) scored.push({ clean, score });
  }
  scored.sort((a, b) => b.score - a.score || a.clean.length - b.clean.length);
  // Dedup per prefisso (evita quasi-duplicati distillati da paper diversi).
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const key = s.clean.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.clean);
    if (out.length >= limit) break;
  }
  return out;
};

const loadFavorites = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
};

const ScienceFeed = ({ signals = [], onAskCoach, onToast }) => {
  const [view, setView] = useState('feed'); // 'feed' | 'search' | 'saved'
  const [filter, setFilter] = useState('all'); // 'all' | 'myth' | chiave categoria
  const [expandedId, setExpandedId] = useState(null);
  const [featured, setFeatured] = useState(() => Math.floor(Math.random() * SCIENCE_HIGHLIGHTS.length));
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(loadFavorites);

  const totalPrinciples = NUTRITION_PRINCIPLES.length;
  const totalSources = KNOWLEDGE_SOURCES.length;

  const persistFav = useCallback((next) => {
    setFavorites(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next.slice(0, 100))); } catch { /* quota */ }
  }, []);

  const isFav = useCallback((text) => favorites.some((f) => f.text === text), [favorites]);
  const toggleFav = useCallback((text, meta = {}) => {
    const next = isFav(text)
      ? favorites.filter((f) => f.text !== text)
      : [{ text, ...meta, ts: Date.now() }, ...favorites];
    persistFav(next);
    onToast?.(isFav(text) ? 'Rimossa dai preferiti' : '⭐ Salvata nei preferiti');
  }, [favorites, isFav, persistFav, onToast]);

  const askCoach = useCallback((subject) => {
    const q = `Approfondisci questa scoperta scientifica e dimmi COME applicarla al mio caso concreto, con passi pratici: "${subject}"`;
    onAskCoach?.(q);
    onToast?.('🧠 Ho chiesto al coach di applicarla a te');
  }, [onAskCoach, onToast]);

  // "Per te ora": per ogni segnale attivo, i migliori principi reali pertinenti.
  const personalized = useMemo(() => signals.slice(0, 4).map((sig) => ({
    ...sig,
    hits: searchPrinciples(sig.query, 3),
  })).filter((s) => s.hits.length), [signals]);

  const searchResults = useMemo(() => (query.trim().length >= 3 ? searchPrinciples(query, 14) : []), [query]);

  const shuffleFeatured = () => setFeatured((prev) => {
    if (SCIENCE_HIGHLIGHTS.length < 2) return prev;
    let n = prev; while (n === prev) n = Math.floor(Math.random() * SCIENCE_HIGHLIGHTS.length);
    return n;
  });

  const visibleHighlights = SCIENCE_HIGHLIGHTS.filter(
    (h) => filter === 'all' || (filter === 'myth' ? h.myth : h.cat === filter)
  );

  const tab = (key, label) => (
    <button onClick={() => setView(key)}
      className="text-[9px] font-bold px-2.5 py-1 rounded-lg transition-colors"
      style={view === key
        ? { background: 'rgba(56,189,248,0.28)', color: '#e0f2fe', border: '1px solid rgba(56,189,248,0.5)' }
        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(125,211,252,0.85)', border: '1px solid rgba(56,189,248,0.2)' }}>
      {label}
    </button>
  );

  // Riga-principio riutilizzabile (personalizzati, ricerca, preferiti): actionable.
  const PrincipleRow = ({ text, accent = '#7dd3fc' }) => (
    <div className="rounded-lg p-2.5 flex items-start gap-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: accent }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] leading-snug" style={{ color: 'rgba(237,242,247,0.92)' }}>{text}</p>
        <div className="flex gap-1.5 mt-1.5">
          <button onClick={() => askCoach(text)}
            className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md transition-colors"
            style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>🧠 Applica a me</button>
          <button onClick={() => toggleFav(text)}
            className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md transition-colors"
            style={isFav(text)
              ? { background: 'rgba(250,204,21,0.22)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.45)' }
              : { background: 'rgba(255,255,255,0.05)', color: 'rgba(226,232,240,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {isFav(text) ? '★ Salvata' : '☆ Salva'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(150deg, rgba(4,10,20,0.98), rgba(10,18,30,0.95) 55%, rgba(6,20,18,0.97))', border: '1px solid rgba(56,189,248,0.24)', boxShadow: '0 8px 34px rgba(14,165,233,0.1), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div className="pointer-events-none absolute -top-10 -left-8 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(56,189,248,0.16)' }} />
      <div className="pointer-events-none absolute -bottom-12 -right-6 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(52,211,153,0.12)' }} />
      <div className="p-4 relative z-10">
        {/* Header + stat live */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.36em] font-bold" style={{ color: 'rgba(125,211,252,0.95)' }}>◈ Live Science</p>
            <p className="text-sm font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Novità dagli Studi</p>
          </div>
          <div className="flex-shrink-0 text-right rounded-xl px-3 py-1.5" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)' }}>
            <p className="text-[13px] font-black leading-none" style={{ color: '#7dd3fc' }}>{totalPrinciples.toLocaleString('it-IT')}</p>
            <p className="text-[7px] uppercase tracking-wider font-bold mt-0.5" style={{ color: 'rgba(125,211,252,0.75)' }}>principi · {totalSources} fonti</p>
          </div>
        </div>

        {/* Tab: feed / cerca / salvate */}
        <div className="flex gap-1.5 mb-3">
          {tab('feed', '✦ Feed')}
          {tab('search', '🔍 Cerca tutto')}
          {tab('saved', `⭐ Salvate${favorites.length ? ` (${favorites.length})` : ''}`)}
        </div>

        {/* ── VIEW: FEED ── */}
        {view === 'feed' && (
          <>
            {/* Per te ora — personalizzato dai check-in */}
            {personalized.length > 0 && (
              <div className="mb-3 rounded-2xl p-3" style={{ background: 'linear-gradient(140deg, rgba(52,211,153,0.14), rgba(6,14,22,0.9) 70%)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <p className="text-[9px] uppercase tracking-[0.28em] font-bold mb-2" style={{ color: '#6ee7b7' }}>❯ Per te, ora</p>
                <div className="space-y-2.5">
                  {personalized.map((sig) => (
                    <div key={sig.key}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[13px]">{sig.emoji}</span>
                        <span className="text-[10px] font-bold text-white">{sig.label}</span>
                      </div>
                      <div className="space-y-1.5">
                        {sig.hits.map((t, i) => <PrincipleRow key={i} text={t} accent="#6ee7b7" />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perla del momento */}
            {(() => {
              const f = SCIENCE_HIGHLIGHTS[featured] || SCIENCE_HIGHLIGHTS[0];
              const cat = scienceCategoryOf(f.cat);
              return (
                <motion.div key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-3.5 mb-3 relative overflow-hidden"
                  style={{ background: `linear-gradient(140deg, ${cat.color}26, rgba(6,12,22,0.92) 70%)`, border: `1px solid ${cat.color}55`, boxShadow: `0 0 24px ${cat.color}1f` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] uppercase tracking-[0.3em] font-bold" style={{ color: cat.color }}>✦ Perla del momento</span>
                    <button onClick={shuffleFeatured}
                      className="text-[11px] w-7 h-7 rounded-lg flex items-center justify-center transition-transform hover:rotate-180"
                      style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}44`, color: cat.color }} title="Un'altra perla">🎲</button>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl leading-none flex-shrink-0" style={{ filter: `drop-shadow(0 0 8px ${cat.color}88)` }}>{f.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-white leading-tight">{f.punch}</p>
                      <p className="text-[10px] leading-snug mt-1" style={{ color: 'rgba(226,232,240,0.82)' }}>{f.detail}</p>
                      <div className="flex items-center flex-wrap gap-1.5 mt-2">
                        <span className="text-[7px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.emoji} {cat.label}</span>
                        {f.myth && <span className="text-[7px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.18)', color: '#fca5a5' }}>⚡ Mito sfatato</span>}
                        <button onClick={() => askCoach(`${f.punch} — ${f.detail}`)}
                          className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                          style={{ background: `${cat.color}26`, color: '#fff', border: `1px solid ${cat.color}55` }}>🧠 Applica a me</button>
                        <button onClick={() => toggleFav(`${f.punch} — ${f.detail}`, { cat: f.cat })}
                          className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                          style={isFav(`${f.punch} — ${f.detail}`)
                            ? { background: 'rgba(250,204,21,0.22)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.45)' }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}>
                          {isFav(`${f.punch} — ${f.detail}`) ? '★' : '☆'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Chip filtro categorie */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => setFilter('all')}
                className="text-[9px] font-bold px-2.5 py-1 rounded-full transition-colors"
                style={filter === 'all'
                  ? { background: 'rgba(56,189,248,0.28)', color: '#e0f2fe', border: '1px solid rgba(56,189,248,0.5)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(125,211,252,0.85)', border: '1px solid rgba(56,189,248,0.2)' }}>
                Tutte
              </button>
              <button onClick={() => setFilter('myth')}
                className="text-[9px] font-bold px-2.5 py-1 rounded-full transition-colors"
                style={filter === 'myth'
                  ? { background: 'rgba(248,113,113,0.28)', color: '#fee2e2', border: '1px solid rgba(248,113,113,0.5)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(252,165,165,0.9)', border: '1px solid rgba(248,113,113,0.22)' }}>
                ⚡ Miti sfatati
              </button>
              {SCIENCE_CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => setFilter(c.key)}
                  className="text-[9px] font-bold px-2.5 py-1 rounded-full transition-colors"
                  style={filter === c.key
                    ? { background: `${c.color}3d`, color: '#fff', border: `1px solid ${c.color}80` }
                    : { background: 'rgba(255,255,255,0.05)', color: c.color, border: `1px solid ${c.color}33` }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            {/* Griglia perle curate */}
            <div className="grid sm:grid-cols-2 gap-2">
              {visibleHighlights.map((h) => {
                const cat = scienceCategoryOf(h.cat);
                const open = expandedId === h.id;
                const favText = `${h.punch} — ${h.detail}`;
                return (
                  <motion.div key={h.id} layout
                    className="rounded-xl p-2.5 transition-colors"
                    style={{ background: open ? `${cat.color}1f` : 'rgba(255,255,255,0.035)', border: `1px solid ${open ? `${cat.color}66` : 'rgba(255,255,255,0.08)'}` }}>
                    <button onClick={() => setExpandedId(open ? null : h.id)} className="text-left w-full">
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-none flex-shrink-0 mt-0.5" style={{ filter: `drop-shadow(0 0 5px ${cat.color}66)` }}>{h.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-white leading-tight">{h.punch}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                            <span className="text-[7.5px] uppercase tracking-wide font-bold" style={{ color: cat.color }}>{h.tag}</span>
                            {h.myth && <span className="text-[7.5px] font-bold" style={{ color: '#fca5a5' }}>· ⚡ mito</span>}
                            {h.fresh && <span className="text-[7.5px] font-bold" style={{ color: '#7dd3fc' }}>· nuovo</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {open && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <p className="text-[10px] leading-snug mt-1.5" style={{ color: 'rgba(226,232,240,0.85)' }}>{h.detail}</p>
                          <div className="flex gap-1.5 mt-2">
                            <button onClick={() => askCoach(favText)}
                              className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                              style={{ background: `${cat.color}26`, color: '#fff', border: `1px solid ${cat.color}55` }}>🧠 Applica a me</button>
                            <button onClick={() => toggleFav(favText, { cat: h.cat })}
                              className="text-[8px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                              style={isFav(favText)
                                ? { background: 'rgba(250,204,21,0.22)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.45)' }
                                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}>
                              {isFav(favText) ? '★ Salvata' : '☆ Salva'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* ── VIEW: SEARCH (tutti i 1463 principi) ── */}
        {view === 'search' && (
          <div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
              placeholder="Cerca tra tutti i principi… es. sonno, creatina, glicemia"
              className="w-full text-[11px] rounded-xl px-3 py-2.5 mb-3 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(56,189,248,0.3)', color: '#fff' }} />
            {query.trim().length < 3 ? (
              <p className="text-[10px] text-center py-6" style={{ color: 'rgba(148,163,184,0.8)' }}>
                Digita almeno 3 lettere per cercare tra {totalPrinciples.toLocaleString('it-IT')} principi distillati da {totalSources} paper.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-[10px] text-center py-6" style={{ color: 'rgba(148,163,184,0.8)' }}>Nessun principio trovato per "{query}". Prova un sinonimo.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[8px] uppercase tracking-wider font-bold mb-1" style={{ color: 'rgba(125,211,252,0.8)' }}>{searchResults.length} risultati</p>
                {searchResults.map((t, i) => <PrincipleRow key={i} text={t} />)}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW: SAVED ── */}
        {view === 'saved' && (
          favorites.length === 0 ? (
            <p className="text-[10px] text-center py-6" style={{ color: 'rgba(148,163,184,0.8)' }}>
              Nessuna scoperta salvata. Tocca ☆ su qualsiasi principio per tenerlo qui.
            </p>
          ) : (
            <div className="space-y-1.5">
              {favorites.map((f, i) => <PrincipleRow key={i} text={f.text} accent="#fde68a" />)}
            </div>
          )
        )}

        <p className="text-[8px] mt-3 text-center" style={{ color: 'rgba(148,163,184,0.7)' }}>
          Distillate da {totalSources} paper scientifici · il Ricercatore Notturno ne aggiunge ogni notte
        </p>
      </div>
    </motion.div>
  );
};

export default ScienceFeed;

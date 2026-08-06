import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { requestSystemAI, looseJsonParse } from '../utils/aiClient';
import { getModelFor } from '../utils/aiModels';
import { applyXp } from '../utils/xpLogic';

// ─────────────────────────────────────────────────────────────────────────────
//  Français — corso di francese gamificato e adattivo.
//  Le lezioni sono generate dall'AI UNA SOLA VOLTA per unità e messe in cache
//  (localStorage): le sessioni successive e il ripasso riusano il contenuto →
//  consumo token quasi nullo a regime. XP/oro confluiscono nel profilo (playerStats).
//  Ogni risposta viene registrata (dati) e alimenta la coda di ripasso (spaced rep).
// ─────────────────────────────────────────────────────────────────────────────

// Scheletro curriculum: solo i TEMI (zero token). Il contenuto lo genera l'AI on-demand.
const CURRICULUM = [
  { level: 'A1', color: '#3b5fc4', units: [
    { id: 'a1-01', emoji: '👋', title: 'Saluti e presentazioni', topic: 'saluti, presentarsi, come stai, di dove sei' },
    { id: 'a1-02', emoji: '🔢', title: 'Numeri 0–20', topic: 'numeri da 0 a 20, contare, età' },
    { id: 'a1-03', emoji: '🗓️', title: 'Giorni e mesi', topic: 'giorni della settimana, mesi, che giorno è' },
    { id: 'a1-04', emoji: '👨‍👩‍👧', title: 'La famiglia', topic: 'membri della famiglia, possessivi mon/ma/mes' },
    { id: 'a1-05', emoji: '🍎', title: 'Al bar e al ristorante', topic: 'ordinare cibo e bevande, chiedere il conto, je voudrais, l’addition' },
    { id: 'a1-06', emoji: '🎨', title: 'Colori e oggetti', topic: 'colori, oggetti comuni, c’est / il y a' },
    { id: 'a1-07', emoji: '🕐', title: 'Orari e appuntamenti', topic: 'chiedere l’ora, orari di apertura, fissare un appuntamento' },
    { id: 'a1-08', emoji: '🏠', title: 'Hotel e alloggio', topic: 'prenotare una camera, fare il check-in, chiedere servizi e problemi in hotel' },
    { id: 'a1-09', emoji: '🧍', title: 'Verbi être & avoir', topic: 'presente di être e avoir, frasi semplici' },
    { id: 'a1-10', emoji: '🛒', title: 'Shopping e necessità', topic: 'negozi, taglie, prezzi, pagare, chiedere aiuto in farmacia' },
  ] },
  { level: 'A2', color: '#7c5cc4', units: [
    { id: 'a2-01', emoji: '🚆', title: 'Muoversi in viaggio', topic: 'stazione e aeroporto, biglietti, coincidenze, indicazioni e imprevisti' },
    { id: 'a2-02', emoji: '🕰️', title: 'Passato (passé composé)', topic: 'passé composé con avoir, participi comuni' },
    { id: 'a2-03', emoji: '🌤️', title: 'Il tempo e le stagioni', topic: 'meteo, stagioni, il fait beau/froid' },
    { id: 'a2-04', emoji: '💼', title: 'Lavoro e professioni', topic: 'professioni, descrivere il proprio lavoro' },
    { id: 'a2-05', emoji: '🩺', title: 'Salute in viaggio', topic: 'spiegare sintomi, farmacia, medico, emergenze e avoir mal à' },
    { id: 'a2-06', emoji: '🎭', title: 'Tempo libero', topic: 'hobby, faire du/de la, uscite' },
    { id: 'a2-07', emoji: '➡️', title: 'Futuro (futur proche)', topic: 'futur proche aller + infinito, progetti' },
    { id: 'a2-08', emoji: '🗣️', title: 'Opinioni', topic: 'esprimere opinioni, je pense que, perché' },
  ] },
  { level: 'B1', color: '#c45c8a', units: [
    { id: 'b1-01', emoji: '📖', title: 'Raccontare storie', topic: 'imparfait vs passé composé, raccontare al passato' },
    { id: 'b1-02', emoji: '🎯', title: 'Obiettivi e desideri', topic: 'conditionnel, je voudrais/j’aimerais, ipotesi' },
    { id: 'b1-03', emoji: '🧩', title: 'Pronomi complemento', topic: 'pronomi le/la/les, lui/leur, y, en' },
    { id: 'b1-04', emoji: '🌍', title: 'Attualità e società', topic: 'temi di attualità, argomentare, connettori' },
    { id: 'b1-05', emoji: '🎬', title: 'Cultura francese', topic: 'cinema, musica, abitudini culturali francesi' },
    { id: 'b1-06', emoji: '✍️', title: 'Subjonctif base', topic: 'subjonctif présent, il faut que, emozioni' },
  ] },
];

const ALL_UNITS = CURRICULUM.flatMap((l) => l.units.map((u) => ({ ...u, level: l.level, color: l.color })));
const unitById = (id) => ALL_UNITS.find((u) => u.id === id);

const LS = {
  progress: 'shadow_monarch_fr_progress',   // { [unitId]: {done,bestScore,seenAt} }
  cache: 'shadow_monarch_fr_cache_v3',      // v3: lezioni personalizzate sul profilo adattivo
  learner: 'shadow_monarch_fr_learner_v1',  // profilo adattivo: errori, abilità, velocità
  srs: 'shadow_monarch_fr_srs',             // { [itemKey]: {box,dueTs,lapses,seen} }
  streak: 'shadow_monarch_fr_streak',       // { count, lastDate }
  daily: 'shadow_monarch_fr_daily',         // { date, xp }
  log: 'shadow_monarch_fr_log',             // [ {unitId,item,correct,ms,ts} ] (cap 500)
};
const readLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
const DAILY_GOAL_XP = 60;
const LESSON_VERSION = 3;
const DEFAULT_LEARNER = {
  totalAnswers: 0, totalCorrect: 0, totalSessions: 0, avgResponseMs: 0,
  skills: {}, errors: {}, recentMistakes: [], lastFocus: '', lastSessionAt: '',
};

const French = ({ playerStats, setPlayerStats, soundEnabled = true, soundTheme = 'solo' }) => {
  const [view, setView] = useState('map');           // 'map' | 'loading' | 'lesson' | 'result'
  const [progress, setProgress] = useState(() => readLS(LS.progress, {}));
  const [cache, setCache] = useState(() => readLS(LS.cache, {}));
  const [learner, setLearner] = useState(() => ({ ...DEFAULT_LEARNER, ...readLS(LS.learner, {}) }));
  const [srs, setSrs] = useState(() => readLS(LS.srs, {}));
  const [streak, setStreak] = useState(() => readLS(LS.streak, { count: 0, lastDate: '' }));
  const [daily, setDaily] = useState(() => {
    const d = readLS(LS.daily, { date: todayStr(), xp: 0 });
    return d.date === todayStr() ? d : { date: todayStr(), xp: 0 };
  });

  const [activeUnit, setActiveUnit] = useState(null); // unit object (o {id:'review',...})
  const [queue, setQueue] = useState([]);             // esercizi della sessione
  const [idx, setIdx] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState(null);     // null | 'ok' | 'ko'
  const [loadErr, setLoadErr] = useState(null);
  const startRef = useRef(0);
  const gainedRef = useRef({ xp: 0, gold: 0 });
  const sessionAnswersRef = useRef([]);

  useEffect(() => { writeLS(LS.progress, progress); }, [progress]);
  useEffect(() => { writeLS(LS.cache, cache); }, [cache]);
  useEffect(() => { writeLS(LS.learner, learner); }, [learner]);
  useEffect(() => { writeLS(LS.srs, srs); }, [srs]);
  useEffect(() => { writeLS(LS.streak, streak); }, [streak]);
  useEffect(() => { writeLS(LS.daily, daily); }, [daily]);

  const beep = useCallback((ok) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = ok ? 660 : 180; o.type = ok ? 'sine' : 'sawtooth';
      g.gain.setValueAtTime(soundEnabled ? 0.06 : 0, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.start(); o.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  }, [soundEnabled]);

  // Unità sbloccate: la prima di ogni livello + tutte quelle dopo un'unità completata.
  const isUnlocked = useCallback((unit) => {
    const list = CURRICULUM.find((l) => l.level === unit.level).units;
    const pos = list.findIndex((u) => u.id === unit.id);
    if (pos === 0) return true;
    return !!progress[list[pos - 1].id]?.done;
  }, [progress]);

  const doneCount = useMemo(() => Object.values(progress).filter((p) => p?.done).length, [progress]);
  const reviewPool = useMemo(() => {
    const now = Date.now();
    return Object.entries(srs).filter(([, v]) => (v?.box || 0) < 5 && (v?.dueTs || 0) <= now).length;
  }, [srs]);

  // ── Generazione lezione (cache-first): niente token se già in cache ──
  const buildExercisesFromCache = (data, unit = null) => {
    const ex = Array.isArray(data?.exercises) ? data.exercises : [];
    return ex.map((e, i) => ({
      key: `${e.answer || e.q || i}`.toLowerCase().slice(0, 60),
      type: e.type === 'type' ? 'type' : 'mc',
      q: String(e.q || '').slice(0, 200),
      options: Array.isArray(e.options) ? e.options.map((o) => String(o).slice(0, 60)).slice(0, 4) : [],
      answer: String(e.answer || '').trim(),
      explain: String(e.explain || '').slice(0, 160),
      skill: String(e.skill || unit?.level || 'conversation').trim().slice(0, 40),
    })).filter((e) => e.q && e.answer && (e.type === 'type' || e.options.length >= 2));
  };

  const cleanLesson = (parsed, unit) => {
    const vocab = Array.isArray(parsed?.vocab)
      ? parsed.vocab
        .map((v) => ({ fr: String(v?.fr || '').trim(), it: String(v?.it || '').trim(), note: String(v?.note || '').trim() }))
        .filter((v) => v.fr && v.it)
        .filter((v, i, all) => all.findIndex((x) => x.fr.toLowerCase() === v.fr.toLowerCase()) === i)
        .slice(0, 8)
      : [];
    const exercises = buildExercisesFromCache(parsed, unit).filter((ex, i, all) => {
      const sameQuestion = all.findIndex((x) => x.q.toLowerCase() === ex.q.toLowerCase());
      if (sameQuestion !== i) return false;
      // Una scelta multipla senza risposta tra le opzioni genera una lezione falsa.
      return ex.type === 'type' || ex.options.some((o) => norm(o) === norm(ex.answer));
    }).slice(0, 9);
    if (vocab.length < 8 || exercises.length < 8) throw new Error(`Lezione ${unit.id} incompleta`);
    return {
      version: LESSON_VERSION,
      title: String(parsed?.title || unit.title).trim().slice(0, 80),
      objective: String(parsed?.objective || `Usare ${unit.topic} in frasi semplici.`).trim().slice(0, 180),
      explanation: String(parsed?.explanation || '').trim().slice(0, 700),
      pronunciation: String(parsed?.pronunciation || '').trim().slice(0, 260),
      examples: Array.isArray(parsed?.examples) ? parsed.examples.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3) : [],
      vocab,
      exercises,
      generatedAt: new Date().toISOString(),
    };
  };

  // Ultima rete: una lezione utilizzabile anche quando il provider è offline,
  // occupato o restituisce JSON corrotto. Non sostituisce l'AI: evita il blocco.
  const buildOfflineLesson = (unit) => {
    const vocab = [
      ['bonjour', 'buongiorno / salve'], ['s’il vous plaît', 'per favore'], ['merci', 'grazie'],
      ['je voudrais', 'vorrei'], ['où est… ?', 'dov’è… ?'], ['combien ça coûte ?', 'quanto costa?'],
      ['je ne comprends pas', 'non capisco'], ['pouvez-vous répéter ?', 'può ripetere?'],
    ].map(([fr, it]) => ({ fr, it, note: '' }));
    const exercises = [
      { type: 'mc', q: 'Come dici “vorrei” in francese?', options: ['Je voudrais', 'Je viens', 'Je prends', 'Je sais'], answer: 'Je voudrais', explain: 'Je voudrais è la formula educata per chiedere qualcosa.' },
      { type: 'mc', q: 'Scegli la frase per chiedere dove si trova qualcosa.', options: ['Où est… ?', 'C’est combien ?', 'À bientôt !', 'Je suis désolé.'], answer: 'Où est… ?', explain: 'Où est… ? significa “Dov’è…?”.' },
      { type: 'mc', q: 'Come chiedi il prezzo?', options: ['Combien ça coûte ?', 'Quelle est votre nom ?', 'Comment tu vas ?', 'Il est midi.'], answer: 'Combien ça coûte ?', explain: 'Combien ça coûte ? è la formula naturale per chiedere il prezzo.' },
      { type: 'type', q: 'Traduci in francese: “Buongiorno, per favore.”', answer: 'Bonjour, s’il vous plaît.', explain: 'Con una persona sconosciuta usa la forma cortese vous.' },
      { type: 'type', q: 'Traduci in francese: “Non capisco.”', answer: 'Je ne comprends pas.', explain: 'La negazione circonda il verbo: ne … pas.' },
      { type: 'type', q: 'Traduci in francese: “Può ripetere?”', answer: 'Pouvez-vous répéter ?', explain: 'Pouvez-vous è la forma cortese per chiedere “può…?”.' },
      { type: 'mc', q: 'Al ristorante, cosa significa “l’addition”?', options: ['Il conto', 'La prenotazione', 'La stazione', 'La camera'], answer: 'Il conto', explain: 'L’addition è il conto del ristorante.' },
      { type: 'type', q: 'Traduci in francese: “Grazie, arrivederci.”', answer: 'Merci, au revoir.', explain: 'Au revoir è il saluto standard per congedarsi.' },
      { type: 'mc', q: 'Quale frase è più adatta per chiedere aiuto?', options: ['Pouvez-vous m’aider ?', 'Je voudrais dormir.', 'Il fait lundi.', 'J’ai vingt ans.'], answer: 'Pouvez-vous m’aider ?', explain: 'Pouvez-vous m’aider ? significa “Può aiutarmi?”.' },
    ];
    return { version: LESSON_VERSION, title: `${unit.title} — base pratica`, objective: `Usare frasi essenziali per ${unit.topic}.`, explanation: 'Lezione di emergenza offline: frasi brevi, cortesi e riutilizzabili nella vita reale.', pronunciation: '', examples: ['Bonjour, je voudrais un café, s’il vous plaît. — Buongiorno, vorrei un caffè, per favore.'], vocab, exercises, generatedAt: new Date().toISOString(), offline: true };
  };

  const generateLesson = async (unit, compact = false) => {
    const skillEntries = Object.entries(learner.skills || {}).sort((a, b) => (a[1]?.accuracy || 0) - (b[1]?.accuracy || 0));
    const weakSkills = skillEntries.slice(0, 3).map(([name, data]) => `${name} (${Math.round((data.accuracy || 0) * 100)}%)`).join(', ') || 'nessun dato: fai una lezione equilibrata';
    const recentMistakes = (learner.recentMistakes || []).slice(-5).map((x) => x.text).filter(Boolean).join(' | ') || 'nessuna';
    const sys = `Sei un docente di francese madrelingua, specializzato in studenti italiani.
Progetta UNA micro-lezione eccellente sul tema "${unit.topic}" per livello ${unit.level}.
Deve insegnare una cosa precisa, farla usare subito e correggere gli errori tipici degli italiani.
Il profilo dello studente indica queste aree deboli: ${weakSkills}.
Gli ultimi errori da rinforzare sono: ${recentMistakes}.
Personalizza la lezione su questi dati, ma non parlare del profilo durante la lezione.
Rispondi SOLO con JSON valido, senza markdown e senza testo fuori dal JSON:
{"title":"titolo breve","objective":"obiettivo misurabile in italiano","explanation":"regola chiara in italiano con 1-2 errori tipici da evitare","pronunciation":"nota di pronuncia solo se utile","examples":["frase francese — traduzione italiana"],"vocab":[{"fr":"espressione francese","it":"traduzione italiana","note":"genere/uso o pronuncia, breve"}],"exercises":[
 {"type":"mc","skill":"vocabolo/grammatica/conversazione/viaggio","q":"consegna italiana non ambigua","options":["4 risposte francesi"],"answer":"una delle options, identica carattere per carattere","explain":"perché è corretta e perché l'errore tipico è sbagliato"},
 {"type":"type","skill":"vocabolo/grammatica/conversazione/viaggio","q":"Traduci in francese: frase italiana naturale","answer":"risposta francese esatta","explain":"correzione breve"}
]}
Regole obbligatorie: esattamente 8 vocaboli e 9 esercizi; almeno 3 type e almeno 3 mc; ogni mc ha una sola risposta corretta e answer coincide ESATTAMENTE con una option; non usare domande-trabocchetto o traduzioni multiple valide; usa accenti e apostrofi francesi corretti; frasi brevi e realistiche; non ripetere lo stesso vocabolo o esercizio; spiegazioni in italiano, risposte/esempi in francese.\nTema: ${unit.title} — ${unit.topic}.`;
    const data = await requestSystemAI({
      // Llama 3.3 70B è rapido e stabile per il francese; il proxy prova poi
      // Agnes/GPT-OSS/NVIDIA se Groq è in rate-limit o senza chiave.
      model: getModelFor('french') || 'groq:llama-3.3-70b-versatile',
      temperature: 0.35,
      max_tokens: compact ? 1600 : 2200,
      maxRetries: 0,
      timeoutMs: compact ? 12000 : 18000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `Genera la micro-lezione "${unit.title}" (${unit.topic}).` },
      ],
    });
    const parsed = looseJsonParse(data?.choices?.[0]?.message?.content, 'object');
    return cleanLesson(parsed, unit);
  };

  const startUnit = async (unit) => {
    setActiveUnit(unit); setLoadErr(null);
    let lesson = cache[unit.id]?.version === LESSON_VERSION ? cache[unit.id] : null;
    if (!lesson) {
      setView('loading');
      try {
        try {
          lesson = await generateLesson(unit);
        } catch (_) {
          // Seconda passata più corta: spesso salva i casi di output troncato
          // o di modello che aggiunge prosa al JSON.
          lesson = await generateLesson(unit, true);
        }
        setCache((prev) => ({ ...prev, [unit.id]: lesson })); // CACHE → mai più rigenerata
      } catch (e) {
        lesson = buildOfflineLesson(unit);
        // Non la mettiamo in cache: alla prossima apertura si ritenta l'AI.
        setLoadErr('Modalità offline: lezione base caricata. La versione AI verrà ritentata alla prossima apertura.');
      }
    }
    const items = [...lesson.exercises];
    // piccola mescolata per non memorizzare l'ordine
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    beginSession(unit, items.slice(0, 10));
  };

  // Ripasso: pesca gli item già visti e "deboli" dalla cache secondo la SRS.
  const startReview = () => {
    const now = Date.now();
    const due = Object.entries(srs)
      .filter(([, v]) => (v?.box || 0) < 5 && (v?.dueTs || 0) <= now)
      .map(([k]) => k);
    const pool = [];
    for (const [uid, lesson] of Object.entries(cache)) {
      for (const ex of buildExercisesFromCache(lesson)) {
        if (due.includes(ex.key)) pool.push(ex);
      }
    }
    if (!pool.length) { setLoadErr('Nessun ripasso in coda per ora — completa qualche lezione!'); return; }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    beginSession({ id: 'review', title: 'Ripasso', emoji: '🔁', color: '#22b07d', level: 'SRS' }, pool.slice(0, 12));
  };

  const beginSession = (unit, items) => {
    setActiveUnit(unit); setQueue(items); setIdx(0); setSessionCorrect(0);
    setAnswer(''); setPicked(null); setFeedback(null);
    gainedRef.current = { xp: 0, gold: 0 };
    sessionAnswersRef.current = [];
    startRef.current = performance.now();
    setView('lesson');
  };

  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[.!?]$/, '').replace(/\s+/g, ' ');

  const logAnswer = (ex, correct, ms) => {
    // dato grezzo (cap 500) — "raccogliere i miei dati"
    const log = readLS(LS.log, []);
    log.push({ u: activeUnit?.id, k: ex.key, c: correct ? 1 : 0, ms, t: Date.now() });
    writeLS(LS.log, log.slice(-500));
    // SRS a scatole (Leitner): giusto → sale di box e posticipa; sbagliato → box 1.
    setSrs((prev) => {
      const cur = prev[ex.key] || { box: 0, dueTs: 0, lapses: 0, seen: 0 };
      const box = correct ? Math.min(5, (cur.box || 0) + 1) : 1;
      const days = [0, 1, 2, 4, 8, 16][box] ?? 16;
      return { ...prev, [ex.key]: {
        box, dueTs: Date.now() + days * 86400000,
        lapses: (cur.lapses || 0) + (correct ? 0 : 1), seen: (cur.seen || 0) + 1,
      } };
    });
  };

  const submit = () => {
    if (feedback) return; // già valutato → passa avanti
    const ex = queue[idx];
    const given = ex.type === 'mc' ? picked : answer;
    if (given == null || (ex.type === 'type' && !given.trim())) return;
    const correct = norm(given) === norm(ex.answer);
    const ms = Math.round(performance.now() - startRef.current);
    sessionAnswersRef.current.push({ correct, skill: ex.skill || activeUnit?.level || 'conversation', text: ex.q, ms });
    logAnswer(ex, correct, ms);
    if (correct) { setSessionCorrect((c) => c + 1); gainedRef.current.xp += 8; gainedRef.current.gold += 3; }
    setFeedback(correct ? 'ok' : 'ko');
    beep(correct);
  };

  const next = () => {
    if (idx + 1 >= queue.length) return finishSession();
    setIdx((i) => i + 1); setAnswer(''); setPicked(null); setFeedback(null);
    startRef.current = performance.now();
  };

  const finishSession = () => {
    const total = queue.length || 1;
    const acc = sessionCorrect / total;
    const bonus = acc === 1 ? 20 : acc >= 0.8 ? 10 : 0; // bonus precisione
    const gxp = gainedRef.current.xp + bonus;
    const ggold = gainedRef.current.gold + Math.round(bonus / 2);

    // Memoria linguistica: non conserva solo il punteggio, ma individua le aree
    // deboli e la velocità reale di risposta per adattare le prossime lezioni.
    const answers = sessionAnswersRef.current;
    setLearner((prev) => {
      const next = { ...prev, skills: { ...(prev.skills || {}) }, errors: { ...(prev.errors || {}) }, recentMistakes: [...(prev.recentMistakes || [])] };
      const oldTotal = prev.totalAnswers || 0;
      const newTotal = oldTotal + answers.length;
      next.totalAnswers = newTotal;
      next.totalCorrect = (prev.totalCorrect || 0) + answers.filter((a) => a.correct).length;
      next.totalSessions = (prev.totalSessions || 0) + 1;
      const msTotal = answers.reduce((sum, a) => sum + a.ms, 0);
      next.avgResponseMs = Math.round((((prev.avgResponseMs || 0) * oldTotal) + msTotal) / Math.max(1, newTotal));
      answers.forEach((a) => {
        const key = a.skill || 'conversation';
        const current = next.skills[key] || { seen: 0, correct: 0, accuracy: 0, avgMs: 0 };
        current.seen += 1;
        if (a.correct) current.correct += 1;
        current.accuracy = current.correct / Math.max(1, current.seen);
        current.avgMs = Math.round(((current.avgMs || 0) * (current.seen - 1) + a.ms) / current.seen);
        next.skills[key] = current;
        if (!a.correct) {
          next.errors[key] = (next.errors[key] || 0) + 1;
          next.recentMistakes.push({ skill: key, text: a.text, at: Date.now() });
        }
      });
      next.recentMistakes = next.recentMistakes.slice(-20);
      next.lastFocus = Object.entries(next.skills).sort((a, b) => (a[1].accuracy || 0) - (b[1].accuracy || 0))[0]?.[0] || '';
      next.lastSessionAt = new Date().toISOString();
      return next;
    });

    // XP/oro nel profilo (modello sottrattivo condiviso: level*100 per salire).
    setPlayerStats((prev) => {
      const { level, exp } = applyXp(prev, gxp);
      return { ...prev, level, exp, gold: (prev?.gold || 0) + ggold };
    });

    // Streak giornaliera
    setStreak((prev) => {
      const t = todayStr();
      if (prev.lastDate === t) return prev;
      const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
      return { count: prev.lastDate === y ? (prev.count || 0) + 1 : 1, lastDate: t };
    });
    setDaily((prev) => ({ date: todayStr(), xp: (prev.date === todayStr() ? prev.xp : 0) + gxp }));

    // Progresso unità (non per il ripasso)
    if (activeUnit && activeUnit.id !== 'review') {
      const score = Math.round(acc * 100);
      setProgress((prev) => ({ ...prev, [activeUnit.id]: {
        done: true, bestScore: Math.max(score, prev[activeUnit.id]?.bestScore || 0), seenAt: Date.now(),
      } }));
    }
    gainedRef.current = { xp: gxp, gold: ggold };
    setView('result');
  };

  // ─────────────────────────── RENDER ───────────────────────────
  const accentBar = (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      <div style={{ background: '#2244bb', flex: 1 }} /><div style={{ background: '#f2f2f2', flex: 1 }} /><div style={{ background: '#e0243a', flex: 1 }} />
    </div>
  );

  if (view === 'lesson' && queue[idx]) {
    const ex = queue[idx];
    const pct = Math.round((idx / queue.length) * 100);
    const lessonGuide = activeUnit?.id !== 'review' ? cache[activeUnit?.id] : null;
    return (
      <div className="p-4 pb-24 min-h-full" style={{ background: 'radial-gradient(120% 80% at 50% -10%, rgba(59,95,196,0.14), transparent 60%)' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setView('map')} className="text-gray-400 text-lg leading-none">✕</button>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#3b5fc4,#e0243a)' }} animate={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-mono text-gray-400">{idx + 1}/{queue.length}</span>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-blue-300/80 mb-1">{activeUnit?.emoji} {activeUnit?.title}</p>
        <h2 className="text-lg font-black text-white mb-4 leading-snug" style={{ fontFamily: 'Russo One, sans-serif' }}>{ex.q}</h2>

        {idx === 0 && lessonGuide && (
          <div className="mb-4 rounded-2xl p-3 space-y-2" style={{ background: 'rgba(59,95,196,0.12)', border: '1px solid rgba(59,95,196,0.35)' }}>
            {lessonGuide.offline && <p className="text-[10px] uppercase tracking-widest text-amber-300">Modalità offline · contenuto base</p>}
            <p className="text-[10px] uppercase tracking-widest text-blue-200">Obiettivo</p>
            <p className="text-xs text-gray-200">{lessonGuide.objective}</p>
            {lessonGuide.explanation && <p className="text-[11px] text-gray-300 leading-relaxed">{lessonGuide.explanation}</p>}
            {lessonGuide.examples?.length > 0 && <p className="text-[11px] text-blue-100 italic">{lessonGuide.examples[0]}</p>}
            {lessonGuide.vocab?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lessonGuide.vocab.slice(0, 4).map((v) => <span key={v.fr} className="text-[10px] px-2 py-1 rounded-lg text-gray-200" style={{ background: 'rgba(255,255,255,0.08)' }}>{v.fr} · {v.it}</span>)}
              </div>
            )}
          </div>
        )}

        {ex.type === 'mc' ? (
          <div className="space-y-2">
            {ex.options.map((opt) => {
              const isPicked = picked === opt;
              const reveal = feedback && (opt === ex.answer || isPicked);
              const good = opt === ex.answer;
              return (
                <button key={opt} disabled={!!feedback} onClick={() => setPicked(opt)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors border"
                  style={reveal
                    ? (good ? { background: 'rgba(34,176,125,0.18)', borderColor: '#22b07d', color: '#7ff0c0' }
                            : { background: 'rgba(224,36,58,0.14)', borderColor: '#e0243a', color: '#ff9fab' })
                    : isPicked ? { background: 'rgba(59,95,196,0.22)', borderColor: '#3b5fc4', color: '#fff' }
                               : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#e5e7eb' }}>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input autoFocus value={answer} disabled={!!feedback}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Scrivi in francese…"
            className="w-full px-4 py-3 rounded-xl bg-black/40 border text-white text-sm focus:outline-none"
            style={{ borderColor: feedback === 'ok' ? '#22b07d' : feedback === 'ko' ? '#e0243a' : 'rgba(59,95,196,0.5)' }} />
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-xl p-3" style={{ background: feedback === 'ok' ? 'rgba(34,176,125,0.12)' : 'rgba(224,36,58,0.1)', border: `1px solid ${feedback === 'ok' ? '#22b07d' : '#e0243a'}` }}>
              <p className="text-sm font-black" style={{ color: feedback === 'ok' ? '#7ff0c0' : '#ff9fab' }}>
                {feedback === 'ok' ? '✓ Exact !' : `✗ Risposta: ${ex.answer}`}
              </p>
              {ex.explain && <p className="text-[11px] text-gray-300 mt-1">{ex.explain}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={feedback ? next : submit}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[358px] py-3.5 rounded-2xl text-sm font-black transition-colors"
          style={feedback
            ? { background: 'linear-gradient(135deg,#3b5fc4,#2244bb)', color: '#fff' }
            : (picked || answer.trim()) ? { background: 'linear-gradient(135deg,#e0243a,#b81c2f)', color: '#fff' }
                                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          {feedback ? (idx + 1 >= queue.length ? 'Termina →' : 'Continua →') : 'Verifica'}
        </button>
      </div>
    );
  }

  if (view === 'result') {
    const total = queue.length || 1;
    const acc = Math.round((sessionCorrect / total) * 100);
    return (
      <div className="p-4 pb-24 min-h-full flex flex-col items-center justify-center text-center" style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(59,95,196,0.16), transparent 60%)' }}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="text-6xl mb-3">
          {acc === 100 ? '🏆' : acc >= 80 ? '🎉' : '💪'}
        </motion.div>
        <h2 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'Russo One, sans-serif' }}>{activeUnit?.title}</h2>
        <p className="text-sm text-gray-400 mb-6">{sessionCorrect}/{total} corrette · {acc}%</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(59,95,196,0.14)', border: '1px solid rgba(59,95,196,0.4)' }}>
            <p className="text-2xl font-black text-blue-300">+{gainedRef.current.xp}</p><p className="text-[10px] uppercase tracking-widest text-gray-400">XP</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)' }}>
            <p className="text-2xl font-black text-amber-300">+{gainedRef.current.gold}</p><p className="text-[10px] uppercase tracking-widest text-gray-400">Oro</p>
          </div>
        </div>
        <button onClick={() => setView('map')} className="w-full max-w-xs py-3.5 rounded-2xl text-sm font-black text-white" style={{ background: 'linear-gradient(135deg,#3b5fc4,#2244bb)' }}>
          Continua
        </button>
      </div>
    );
  }

  if (view === 'loading') {
    return (
      <div className="p-4 min-h-full flex flex-col items-center justify-center text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="text-4xl mb-4">🥐</motion.div>
        <p className="text-sm font-black text-white mb-1">Preparo la lezione…</p>
        <p className="text-[11px] text-gray-400 max-w-[240px]">La genero una volta sola, poi resta salvata: le prossime volte è istantanea.</p>
      </div>
    );
  }

  // MAP
  const level = playerStats?.level || 1;
  const exp = playerStats?.exp || 0;
  const expNeed = level * 100;
  return (
    <div className="p-4 pb-24 min-h-full">
      <div className="mb-4">
        {accentBar}
        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-300/80">Cours de français</p>
            <h1 className="text-2xl font-black text-white leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>Français 🇫🇷</h1>
          </div>
          <div className="text-right">
            <p className="text-lg font-black" style={{ color: '#ff8a3d' }}>🔥 {streak.count || 0}</p>
            <p className="text-[9px] uppercase tracking-widest text-gray-500">streak</p>
          </div>
        </div>
      </div>

      {/* obiettivo giornaliero + livello */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl p-3" style={{ background: 'rgba(59,95,196,0.12)', border: '1px solid rgba(59,95,196,0.3)' }}>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Obiettivo di oggi</p>
          <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (daily.xp / DAILY_GOAL_XP) * 100)}%`, background: 'linear-gradient(90deg,#3b5fc4,#e0243a)' }} />
          </div>
          <p className="text-[10px] text-gray-300 font-mono">{Math.min(daily.xp, DAILY_GOAL_XP)}/{DAILY_GOAL_XP} XP</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)' }}>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Profilo</p>
          <p className="text-sm font-black text-white">Lv {level} · {doneCount}/{ALL_UNITS.length} lezioni</p>
          <div className="h-2 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (exp / expNeed) * 100)}%`, background: '#a78bfa' }} />
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl p-3" style={{ background: 'rgba(34,176,125,0.08)', border: '1px solid rgba(34,176,125,0.25)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300">French Brain</p>
          <span className="text-[10px] text-gray-500">{learner.totalAnswers || 0} risposte analizzate</span>
        </div>
        <p className="text-xs text-gray-200">
          {learner.totalAnswers
            ? `Il tuo prossimo focus: ${learner.lastFocus || 'conversazione'}. L’app sta adattando le lezioni ai tuoi errori.`
            : 'Completa la prima lezione: da lì inizierò a riconoscere i tuoi punti forti e deboli.'}
        </p>
      </div>

      {/* ripasso */}
      <button onClick={startReview} disabled={reviewPool === 0}
        className="w-full mb-4 rounded-2xl p-3 flex items-center justify-between transition-colors"
        style={reviewPool > 0 ? { background: 'rgba(34,176,125,0.14)', border: '1px solid #22b07d' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-sm font-black" style={{ color: reviewPool > 0 ? '#7ff0c0' : '#6b7280' }}>🔁 Ripasso intelligente</span>
        <span className="text-[11px] font-mono" style={{ color: reviewPool > 0 ? '#7ff0c0' : '#6b7280' }}>{reviewPool} da rivedere</span>
      </button>

      {loadErr && <p className="text-[11px] text-amber-300 mb-3 text-center">{loadErr}</p>}

      {/* mappa livelli */}
      {CURRICULUM.map((lvl) => (
        <div key={lvl.level} className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black px-2 py-0.5 rounded-md" style={{ background: `${lvl.color}22`, color: lvl.color, border: `1px solid ${lvl.color}66` }}>{lvl.level}</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {lvl.units.map((u) => {
              const p = progress[u.id];
              const unlocked = isUnlocked(u);
              const cached = !!cache[u.id];
              return (
                <button key={u.id} disabled={!unlocked} onClick={() => startUnit({ ...u, level: lvl.level, color: lvl.color })}
                  className="w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-colors"
                  style={{ opacity: unlocked ? 1 : 0.4, background: p?.done ? `${lvl.color}1a` : 'rgba(255,255,255,0.04)', border: `1px solid ${p?.done ? `${lvl.color}66` : 'rgba(255,255,255,0.08)'}` }}>
                  <span className="text-2xl flex-none">{unlocked ? u.emoji : '🔒'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white leading-tight">{u.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p?.done ? `✓ completata · ${p.bestScore}%` : cached ? 'pronta' : unlocked ? 'nuova' : 'bloccata'}</p>
                  </div>
                  {p?.done && <span className="text-[11px]" style={{ color: lvl.color }}>{p.bestScore === 100 ? '★' : '✓'}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-gray-500 text-center mt-2">Le lezioni si generano una volta e restano salvate offline. 🥖</p>
    </div>
  );
};

export default French;

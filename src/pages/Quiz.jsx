import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: 'Quale muscolo è considerato il più grande del corpo umano?',
    options: ['Bicipite brachiale', 'Gran dorsale', 'Gluteo massimo', 'Quadricipite femorale'],
    correct: 'C', topic: '💪 Anatomia',
  },
  {
    q: 'Quante calorie fornisce 1 grammo di proteine?',
    options: ['4 kcal', '7 kcal', '9 kcal', '2 kcal'],
    correct: 'A', topic: '🥗 Nutrizione',
  },
  {
    q: 'Nel Muay Thai, come si chiama il calcio frontale con la pianta del piede?',
    options: ['Low kick', 'Teep', 'Roundhouse', 'Sweep'],
    correct: 'B', topic: '🥊 Muay Thai',
  },
  {
    q: 'Qual è l\'integratore più studiato e supportato per aumentare la forza?',
    options: ['Creatina monoidrato', 'BCAA', 'L-Carnitina', 'Glutammina'],
    correct: 'A', topic: '💊 Integratori',
  },
  {
    q: 'Nella boxe, quanti round dura un match olimpico?',
    options: ['3 round × 2 min', '3 round × 3 min', '4 round × 3 min', '5 round × 2 min'],
    correct: 'B', topic: '🥊 Boxe',
  },
  {
    q: 'Il Krav Maga è nato in quale paese?',
    options: ['Russia', 'USA', 'Israele', 'Giappone'],
    correct: 'C', topic: '🥋 Arti Marziali',
  },
  {
    q: 'Quante calorie ha 1 grammo di grassi?',
    options: ['4 kcal', '7 kcal', '9 kcal', '11 kcal'],
    correct: 'C', topic: '🥗 Nutrizione',
  },
  {
    q: 'Nel BJJ, come si chiama la tecnica di sottomissione con leva al gomito?',
    options: ['Triangle choke', 'Rear naked choke', 'Armbar', 'Kimura'],
    correct: 'C', topic: '🥋 BJJ',
  },
  {
    q: 'Quante "armi" ha il Muay Thai (gli 8 arti)?',
    options: ['6 — pugni, calci, ginocchia', '8 — pugni, gomiti, ginocchia, calci', '4 — solo pugni e calci', '10 — incluse le spalle'],
    correct: 'B', topic: '🥊 Muay Thai',
  },
  {
    q: 'Quale aminoacido è il più importante per stimolare la sintesi proteica muscolare?',
    options: ['Leucina', 'Glutammina', 'Valina', 'Isoleucina'],
    correct: 'A', topic: '💊 Integratori',
  },
  {
    q: 'Il principio "SAID" nel fitness significa:',
    options: ['Strength Adds Injury Delay', 'Specific Adaptation to Imposed Demands', 'Speed And Intensity Development', 'Systematic Athletic Improvement Design'],
    correct: 'B', topic: '💪 Fitness',
  },
  {
    q: 'Qual è la capitale dell\'Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correct: 'C', topic: '🌍 Cultura Generale',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const OPTION_COLORS = [
  { bg: 'rgba(239,68,68,0.85)',    border: '#ef4444', icon: '▲' },
  { bg: 'rgba(59,130,246,0.85)',   border: '#3b82f6', icon: '◆' },
  { bg: 'rgba(234,179,8,0.85)',    border: '#eab308', icon: '●' },
  { bg: 'rgba(34,197,94,0.85)',    border: '#22c55e', icon: '■' },
];
const TIMER_SECONDS = 22;

// ─── Utility ──────────────────────────────────────────────────────────────────
function getRank(score, all) {
  return all.filter(s => s > score).length + 1;
}

// ─── Model Card ───────────────────────────────────────────────────────────────
function ModelCard({ contestant, answer, isCorrect, phase, correct }) {
  const thinking = phase === 'question' && !answer;
  const revealed = phase === 'reveal' || phase === 'scores';

  return (
    <motion.div
      layout
      className="flex items-center gap-2 px-3 py-2 rounded-2xl"
      style={{
        background: revealed
          ? isCorrect ? 'rgba(34,197,94,0.15)' : answer === '?' ? 'rgba(100,116,139,0.12)' : 'rgba(239,68,68,0.12)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${revealed
          ? isCorrect ? 'rgba(34,197,94,0.4)' : answer === '?' ? 'rgba(100,116,139,0.2)' : 'rgba(239,68,68,0.3)'
          : 'rgba(255,255,255,0.08)'}`,
        boxShadow: revealed && isCorrect ? `0 0 20px rgba(34,197,94,0.2)` : 'none',
      }}
      animate={revealed && isCorrect ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 0.4 }}
    >
      <span className="text-xl flex-shrink-0">{contestant.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white truncate">{contestant.name}</p>
        {thinking ? (
          <div className="flex gap-0.5 mt-0.5">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-1 h-1 rounded-full bg-gray-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        ) : revealed ? (
          <p className="text-[10px] font-black" style={{ color: contestant.color }}>
            {answer !== '?' ? answer : '—'} {revealed ? (isCorrect ? '✓' : answer !== '?' ? '✗' : '–') : ''}
          </p>
        ) : (
          <p className="text-[10px] text-emerald-400 font-bold">✓ risposto</p>
        )}
      </div>
      {revealed && (
        <span className="text-lg flex-shrink-0">
          {isCorrect ? '✅' : answer === '?' ? '⏱️' : '❌'}
        </span>
      )}
    </motion.div>
  );
}

// ─── Countdown Ring ───────────────────────────────────────────────────────────
function CountdownRing({ timeLeft, total }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = timeLeft / total;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? '#10b981' : pct > 0.25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <span className="absolute text-xl font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>{timeLeft}</span>
    </div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────
function Podium({ scores, contestants }) {
  const sorted = [...contestants].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const heights = [120, 160, 90];
  const podiumPos = [1, 0, 2];

  return (
    <div className="flex items-end justify-center gap-3 mt-4 mb-6">
      {podiumOrder.map((c, idx) => {
        const score = scores[c.id] || 0;
        const rank = podiumPos[idx] + 1;
        const medals = ['🥇', '🥈', '🥉'];
        return (
          <motion.div key={c.id} className="flex flex-col items-center gap-1"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: idx * 0.2 + 0.3, type: 'spring', stiffness: 200 }}>
            <span className="text-3xl">{c.emoji}</span>
            <p className="text-[10px] font-bold text-white text-center" style={{ maxWidth: 70 }}>{c.name.split(' ')[0]}</p>
            <p className="text-xs font-black" style={{ color: c.color }}>{score} pt</p>
            <div className="flex items-end justify-center rounded-t-xl"
              style={{ width: 72, height: heights[idx], background: `linear-gradient(180deg, ${c.color}55, ${c.color}22)`, border: `1px solid ${c.color}55`, boxShadow: `0 0 20px ${c.color}30` }}>
              <span className="text-3xl mb-2">{medals[rank - 1]}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Quiz() {
  const [phase, setPhase] = useState('lobby'); // lobby | question | loading | reveal | scores | final
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [scores, setScores] = useState({});
  const [contestants, setContestants] = useState([]);
  const [roundResults, setRoundResults] = useState(null); // { results, correct }
  const [pendingAnswers, setPendingAnswers] = useState({}); // id → answer (before reveal)
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]); // per domanda: { qIndex, results }
  const timerRef = useRef(null);
  const apiCalledRef = useRef(false);

  const question = QUESTIONS[qIndex];
  const totalQ = QUESTIONS.length;

  // ── Load contestants on mount ──
  useEffect(() => {
    fetch('/api/nvidia/quiz')
      .then(r => r.json())
      .then(d => {
        if (d.contestants) {
          setContestants(d.contestants);
          const initScores = {};
          d.contestants.forEach(c => { initScores[c.id] = 0; });
          setScores(initScores);
        }
      })
      .catch(() => {
        // fallback static list
        const fallback = [
          { id: 'kimi', name: 'Kimi K2.6', emoji: '🌙', color: '#06b6d4' },
          { id: 'mistral-large', name: 'Mistral Large', emoji: '🌪️', color: '#3b82f6' },
          { id: 'qwq', name: 'QwQ 80B', emoji: '🧩', color: '#8b5cf6' },
          { id: 'nemotron', name: 'Nemotron 120B', emoji: '⚡', color: '#f59e0b' },
          { id: 'step', name: 'Step 3.7', emoji: '🚀', color: '#10b981' },
          { id: 'medium', name: 'Mistral Medium', emoji: '🔮', color: '#f43f5e' },
        ];
        setContestants(fallback);
        const s = {}; fallback.forEach(c => { s[c.id] = 0; }); setScores(s);
      });
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'question') return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, qIndex]);

  // ── API call ──
  const callApi = useCallback(async () => {
    if (apiCalledRef.current) return;
    apiCalledRef.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/nvidia/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.q, options: question.options, correct: question.correct }),
      });
      const data = await res.json();
      // update pending answers as they come back
      const answers = {};
      data.results.forEach(r => { answers[r.id] = r.answer; });
      setPendingAnswers(answers);
      setRoundResults(data);
      setLoading(false);
      clearInterval(timerRef.current);
      setPhase('reveal');

      // update scores
      setScores(prev => {
        const next = { ...prev };
        data.results.forEach(r => {
          if (r.isCorrect) next[r.id] = (next[r.id] || 0) + 100;
        });
        return next;
      });
      setHistory(h => [...h, { qIndex, results: data.results }]);
    } catch {
      setLoading(false);
      setPhase('reveal');
    }
  }, [question, qIndex]);

  // ── Auto-call API when question phase starts ──
  useEffect(() => {
    if (phase === 'question') {
      apiCalledRef.current = false;
      setPendingAnswers({});
      setRoundResults(null);
      callApi();
    }
  }, [phase, qIndex]);

  // ── Auto-advance from reveal → scores after 2s ──
  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = setTimeout(() => setPhase('scores'), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Start quiz ──
  function startQuiz() {
    setQIndex(0);
    setTimeLeft(TIMER_SECONDS);
    const s = {}; contestants.forEach(c => { s[c.id] = 0; }); setScores(s);
    setHistory([]);
    setPhase('question');
  }

  // ── Next question ──
  function nextQuestion() {
    if (qIndex >= totalQ - 1) {
      setPhase('final');
    } else {
      setQIndex(i => i + 1);
      setTimeLeft(TIMER_SECONDS);
      setPhase('question');
    }
  }

  // ── Sorted leaderboard ──
  const leaderboard = [...contestants].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // LOBBY
  if (phase === 'lobby') {
    return (
      <div className="min-h-full pb-24 px-4 pt-8" style={{ background: '#030712' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">⚡ AI Arena</p>
            <h1 className="text-3xl font-black text-white mb-2" style={{ fontFamily: 'Russo One, sans-serif' }}>
              MODEL QUIZ
            </h1>
            <p className="text-sm text-gray-400">6 modelli NVIDIA NIM · {totalQ} domande · Chi ne sa di più?</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {contestants.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.color}40` }}>
                <span className="text-2xl">{c.emoji}</span>
                <div>
                  <p className="text-xs font-black text-white">{c.name.split(' ')[0]}</p>
                  <p className="text-[9px] text-gray-500">{c.name.split(' ').slice(1).join(' ')}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startQuiz}
            className="w-full py-4 rounded-2xl text-white font-black text-lg tracking-wide"
            style={{
              fontFamily: 'Russo One, sans-serif',
              background: 'linear-gradient(135deg, #7C3AED, #4f46e5)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
            }}>
            ⚡ START ARENA
          </motion.button>
          <p className="text-center text-[10px] text-gray-600 mt-3">Tutte le risposte vengono generate live dai modelli AI</p>
        </div>
      </div>
    );
  }

  // FINAL
  if (phase === 'final') {
    return (
      <div className="min-h-full pb-24 px-4 pt-6" style={{ background: '#030712' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">🏆 Fine Arena</p>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>CLASSIFICA FINALE</h1>
          </div>

          {contestants.length >= 3 && <Podium scores={scores} contestants={contestants} />}

          <div className="space-y-2 mb-6">
            {leaderboard.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: i === 0 ? `linear-gradient(135deg, ${c.color}20, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i === 0 ? c.color + '60' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: i === 0 ? `0 0 24px ${c.color}25` : 'none',
                }}>
                <span className="text-xl font-black w-6 text-center" style={{ color: i < 3 ? ['#fbbf24','#94a3b8','#cd7f32'][i] : '#6b7280' }}>
                  {i + 1}
                </span>
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{c.name}</p>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', width: '100%' }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: c.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(((scores[c.id] || 0) / (totalQ * 100)) * 100)}%` }}
                      transition={{ delay: i * 0.07 + 0.3, duration: 0.6 }} />
                  </div>
                </div>
                <p className="text-lg font-black" style={{ color: c.color, fontFamily: 'Russo One, sans-serif' }}>
                  {scores[c.id] || 0}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={startQuiz}
            className="w-full py-3.5 rounded-2xl text-white font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4f46e5)', boxShadow: '0 6px 20px rgba(124,58,237,0.35)' }}>
            🔄 RIVINCITA
          </motion.button>
        </div>
      </div>
    );
  }

  // SCORES (between questions)
  if (phase === 'scores') {
    return (
      <div className="min-h-full pb-24 px-4 pt-6" style={{ background: '#030712' }}>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Domanda {qIndex + 1}/{totalQ}</p>
            <h2 className="text-xl font-black text-white mt-1" style={{ fontFamily: 'Russo One, sans-serif' }}>Classifica</h2>
          </div>

          <div className="space-y-2 mb-6">
            {leaderboard.map((c, i) => (
              <motion.div key={c.id}
                layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.07)` }}>
                <span className="text-sm font-black w-5 text-center text-gray-500">{i + 1}</span>
                <span className="text-xl">{c.emoji}</span>
                <p className="flex-1 text-sm font-bold text-white">{c.name}</p>
                <p className="font-black text-base" style={{ color: c.color, fontFamily: 'Russo One, sans-serif' }}>
                  {scores[c.id] || 0}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={nextQuestion}
            className="w-full py-3.5 rounded-2xl text-white font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}>
            {qIndex >= totalQ - 1 ? '🏆 Risultati Finali' : `➡️ Prossima Domanda (${qIndex + 2}/${totalQ})`}
          </motion.button>
        </div>
      </div>
    );
  }

  // QUESTION + REVEAL
  const isReveal = phase === 'reveal';
  const correctLetter = question.correct;
  const correctIdx = ['A','B','C','D'].indexOf(correctLetter);

  return (
    <div className="min-h-full pb-24 px-4 pt-4" style={{ background: '#030712' }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">{question.topic}</p>
            <p className="text-xs text-gray-400">Domanda {qIndex + 1} di {totalQ}</p>
          </div>
          {!isReveal && <CountdownRing timeLeft={timeLeft} total={TIMER_SECONDS} />}
          {isReveal && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
              className="text-3xl">🎯</motion.div>
          )}
        </div>

        {/* Question */}
        <motion.div
          className="rounded-2xl p-4 mb-4 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 80 }}>
          <p className="text-base font-bold text-white leading-snug">{question.q}</p>
          {loading && (
            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest">I modelli stanno pensando...</p>
          )}
        </motion.div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {question.options.map((opt, i) => {
            const letter = ['A','B','C','D'][i];
            const col = OPTION_COLORS[i];
            const isCorrectOpt = letter === correctLetter;
            let bg = col.bg;
            let borderC = col.border;
            let opacity = 1;
            if (isReveal) {
              if (isCorrectOpt) {
                bg = 'rgba(34,197,94,0.9)';
                borderC = '#22c55e';
              } else {
                opacity = 0.35;
              }
            }
            return (
              <motion.div key={i}
                className="rounded-2xl p-3 flex items-center gap-2"
                style={{ background: bg, border: `2px solid ${borderC}`, opacity }}
                animate={isReveal && isCorrectOpt ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 0.4 }}>
                <span className="text-xl font-black text-white flex-shrink-0">{col.icon}</span>
                <p className="text-xs font-bold text-white leading-tight">{opt}</p>
                {isReveal && isCorrectOpt && <span className="ml-auto text-xl">✅</span>}
              </motion.div>
            );
          })}
        </div>

        {/* Model cards */}
        <div className="mb-4">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">
            {isReveal ? '▸ Risultati' : '▸ I modelli stanno rispondendo'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {contestants.map(c => {
              const ans = isReveal
                ? roundResults?.results?.find(r => r.id === c.id)?.answer ?? '?'
                : pendingAnswers[c.id];
              const correct = roundResults?.results?.find(r => r.id === c.id)?.isCorrect ?? false;
              return (
                <ModelCard key={c.id} contestant={c} answer={ans} isCorrect={correct}
                  phase={phase} correct={correctLetter} />
              );
            })}
          </div>
        </div>

        {/* Reveal stats */}
        <AnimatePresence>
          {isReveal && roundResults && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <p className="text-sm font-black text-white">
                {roundResults.results.filter(r => r.isCorrect).length} / {roundResults.results.length} modelli corretti
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Risposta: <span className="font-black text-emerald-300">{correctLetter}) {question.options[correctIdx]}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

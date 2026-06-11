import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── 20 Domande PhD-level: nutrizione, fitness, fisiologia molecolare ──────────
const QUESTIONS = [
  {
    q: 'Il "muscle full effect" (Norton & Layman) si verifica perché mTORC1 diventa refrattario alla leucina dopo circa 90-120 min. Cosa è NECESSARIO per la ri-sensibilizzazione?',
    options: [
      'Un bolo di glucosio per ripristinare il glicogeno',
      'Una fase di bassa leucinemia plasmatica (ritorno ai livelli basali)',
      'Un bolo di insulina esogena per azzerare l\'AMPK',
      'L\'attivazione di mTORC2 come trigger di recupero',
    ],
    correct: 'B', topic: '🔬 mTOR Signaling',
  },
  {
    q: 'La "Protein Leverage Hypothesis" di Simpson & Raubenheimer (2005) afferma che:',
    options: [
      'Le proteine hanno il maggiore potere saziante rispetto a carboidrati e grassi per caloria',
      'Gli organismi regolano l\'intake totale di cibo per raggiungere un target proteico fisso, aumentando le calorie totali se la dieta è povera di proteine',
      'Il rapporto ideale proteine/carboidrati è 1:4 per la performance atletica',
      'L\'eccesso proteico viene convertito preferenzialmente in grasso viscerale tramite lipogenesi de novo',
    ],
    correct: 'B', topic: '🧬 Appetite Science',
  },
  {
    q: 'L\'irisina (cleaved da FNDC5 durante l\'esercizio) agisce sul tessuto adiposo bianco principalmente inducendo:',
    options: [
      'Lipolisi diretta tramite attivazione della lipasi ormono-sensibile (HSL)',
      'Apoptosi degli adipociti ipertrofici tramite caspasi-3',
      '"Browning" — upregulation di UCP-1 che converte il tessuto da WAT a BAT-like',
      'Inibizione dell\'adipogenesi tramite downregulation di PPARγ2',
    ],
    correct: 'C', topic: '🔥 Exerkines',
  },
  {
    q: 'Il cortisolo cronico elevato causa catabolismo muscolare principalmente attraverso quale via molecolare?',
    options: [
      'Inibizione diretta dell\'IGF-1R → blocco della via PI3K/Akt',
      'Riduzione acuta della sintesi di testosterone testicolare tramite downregulation di StAR',
      'Upregulation di FoxO3a → trascrizione degli atrogeni MuRF-1 e MAFbx/Atrogina-1 → ubiquitin-proteasoma',
      'Soppressione del rilascio pulsatile di GH dall\'ipofisi anteriore',
    ],
    correct: 'C', topic: '🧪 Catabolismo',
  },
  {
    q: 'Il peptide intestinale PYY 3-36 induce sazietà principalmente agendo su:',
    options: [
      'Recettori NPY/Y2 nell\'ipotalamo (nucleo arcuato) → inibizione dei neuroni AgRP/NPY',
      'Recettori GLP-1R nelle cellule beta pancreatiche → rilascio di insulina',
      'Recettori CCK-A nel nervo vago → rallentamento dello svuotamento gastrico',
      'Recettori della leptina nel nucleo ventromediale → aumento del metabolismo basale',
    ],
    correct: 'A', topic: '🧬 Gut-Brain Axis',
  },
  {
    q: 'Nello studio di Sutton et al. (Cell Metabolism, 2018) sulla time-restricted eating (8h window, 6-settimane) in uomini pre-diabetici, qual era il risultato più sorprendente?',
    options: [
      'Perdita di peso doppia rispetto al controllo isocalorico',
      'Miglioramento dell\'insulino-sensibilità, pressione arteriosa e stress ossidativo SENZA perdita di peso rispetto al controllo',
      'Riduzione del testosterone del 18% per riduzione della finestra di sintesi notturna',
      'Aumento del VO2max del 12% indipendentemente dall\'esercizio',
    ],
    correct: 'B', topic: '⏱ Time-Restricted Eating',
  },
  {
    q: 'Il biomarker più specifico per misurare il catabolismo delle proteine miofibrillari (actina/miosina) in vivo è:',
    options: [
      'Azoto ureico plasmatico (BUN) — riflette il catabolismo proteico totale',
      '3-Methylhistidine urinario (3-MH) — non riciclabile, esce con le urine dopo proteolisi muscolare',
      'Creatinina sierica — prodotto del metabolismo della fosfocreatina',
      'Lattato deidrogenasi (LDH) — marker di danno cellulare muscolare generico',
    ],
    correct: 'B', topic: '🩺 Biomarkers',
  },
  {
    q: 'La Miostatina (GDF-8) inibisce l\'ipertrofia muscolare principalmente tramite:',
    options: [
      'Legame al recettore ActRIIB → attivazione Smad2/3 → upregulation di atrogeni e inibizione della via Akt/mTOR',
      'Inibizione diretta della creatina chinasi mitocondriale → riduzione ATP disponibile',
      'Downregulation delle cellule satellite tramite blocco del fattore di trascrizione MyoD',
      'Antagonismo competitivo con il recettore dell\'IGF-1 sui mioblasti',
    ],
    correct: 'A', topic: '🧬 Myostatin',
  },
  {
    q: 'Il "train low, compete high" strategy (allenamento con glicogeno depletato) upregula principalmente quale proteina per aumentare l\'ossidazione dei grassi a lungo termine?',
    options: [
      'GLUT4 sarcolemmale — aumenta il trasporto di glucosio per compensare',
      'FAT/CD36 + CPT-1 (carnitina palmitoyltransferasi-1) → maggiore trasporto di LCFA nel mitocondrio',
      'Piruvato deidrogenasi chinasi (PDK4) → riduce l\'ossidazione del glucosio in modo acuto',
      'Beta-ossidazione enzimi mitocondriali (HADH, SCHAD) tramite attivazione di PPARδ/β',
    ],
    correct: 'B', topic: '⚡ Training Adaptations',
  },
  {
    q: 'Secondo Churchward-Venne et al. (2012), aggiungere leucina extra a una dose sub-ottimale di whey (6.25g) porta la MPS allo stesso livello di 25g di whey. Qual è il meccanismo principale?',
    options: [
      'La leucina extra aumenta il rilascio di insulina, potenziando l\'uptake degli aminoacidi',
      'La leucina attiva mTORC1/p70S6K1 fungendo da "trigger metabolico" anche in assenza di aminoacidi sufficienti per la sintesi',
      'La leucina inibisce la proteolisi (via ubiquitin-proteasoma) riducendo il netto catabolico',
      'La leucina aumenta il flusso ematico muscolare tramite produzione di ossido nitrico',
    ],
    correct: 'B', topic: '🔬 Leucine Threshold',
  },
  {
    q: 'L\'allenamento in "Zona 2" (60-70% VO2max, lattato ~2 mmol/L) maximizza quale adattamento specifico rispetto ad altre zone?',
    options: [
      'Aumento del VO2max tramite stress cardiaco (Frank-Starling) e rimodellamento ventricolare',
      'Ipertrofia delle fibre di tipo II tramite reclutamento massimale delle unità motorie',
      'Biogenesi mitocondriale massimale tramite PGC-1α + aumento densità capillare + ottimizzazione del metabolismo lipidico a intensità aerobica',
      'Aumento della soglia lattacida tramite upregulation dei trasportatori MCT-4',
    ],
    correct: 'C', topic: '🏃 Zone 2 Training',
  },
  {
    q: 'Il protocollo originale di Bergström & Hultman (1967) per la "supercompensazione del glicogeno" prevedeva:',
    options: [
      'Solo 3 giorni di carbo loading ad alto indice glicemico prima della gara',
      'Settimana "Swedish Depletion": 3 giorni diet low-carb + allenamento depletante, poi 3 giorni high-carb → supercompensazione fino a 200% sopra baseline',
      'Iniezioni intramuscolari di glucosio nelle 12h pre-gara',
      'Digiuno prolungato di 24h seguito da un singolo pasto ad alto CI 2h prima della gara',
    ],
    correct: 'B', topic: '🍝 Glycogen Science',
  },
  {
    q: 'Le cellule satellite muscolari donano mionuclei alle fibre ipertrofiche per mantenere il rapporto nucleo/citoplasma. Secondo la "myonuclear domain theory", cosa succede dopo un periodo di detraining prolungato?',
    options: [
      'I mionuclei acquisiti tramite ipertrofia vengono rimossi per apoptosi entro 2-3 settimane',
      'I mionuclei extra persistono per mesi-anni ("muscle memory"), permettendo una re-ipertrofia più rapida al re-allenamento',
      'Le cellule satellite re-assorbono i mionuclei in eccesso tramite autofagia selettiva',
      'I mionuclei migrano nelle fibre di tipo I adiacenti per mantenere la massa totale',
    ],
    correct: 'B', topic: '🔬 Muscle Memory',
  },
  {
    q: 'Il microbioma intestinale produce "exerkine metabolites" (SCFA come butirrato, propionato) che influenzano la performance atletica principalmente come?',
    options: [
      'Substrato energetico diretto per le fibre muscolari di tipo I durante l\'esercizio aerobico prolungato',
      'Inibitori dell\'HDAC (deacetilasi istoniche) → modulazione epigenetica dei geni infiammatori + combustibile per gli enterociti → riduzione della permeabilità intestinale durante l\'esercizio',
      'Precursori del glicogeno epatico tramite gluconeogenesi dal propionato (via succinyl-CoA)',
      'Stimolatori del rilascio di GLP-1 e PYY → miglioramento della tolleranza al glucosio post-workout',
    ],
    correct: 'B', topic: '🦠 Microbiome & Performance',
  },
  {
    q: 'La phosphatidic acid (PA) da soia è studiata come booster dell\'ipertrofia perché attiva direttamente mTORC1 tramite:',
    options: [
      'Mimesi dell\'IGF-1: legame al dominio leucine-rich repeat del recettore insulinico',
      'Legame diretto al dominio FRB (FKBP12-rapamycin binding) di mTOR → attivazione indipendente dall\'upstream PI3K/Akt',
      'Inibizione di TSC2 (tuberina) → rimozione del freno su Rheb-GTP → attivazione di mTORC1',
      'Upregulation di Ragulator complex e RagA/B-GTP → localizzazione lisosomica di mTOR',
    ],
    correct: 'B', topic: '💊 Advanced Supplements',
  },
  {
    q: 'Nei pazienti anziani (>65 anni), l\'"anabolic resistance" può essere superata con quale strategia validata?',
    options: [
      'Ridurre le proteine animali e usare solo vegetali per ridurre l\'acidosi metabolica cronica',
      'Suddividere le proteine in micro-dosi da 5g ogni ora per mantenere l\'aminoacidemia costante',
      'Whey protein + leucina aggiuntiva (≥3g totali di leucina) per superare il threshold ridotto di sensibilità a mTORC1 negli anziani',
      'Combinare BCAA con creatina in rapporto 4:1 per attivare sia mTOR che la via AMPK-indipendente',
    ],
    correct: 'C', topic: '🧓 Sarcopenia',
  },
  {
    q: 'Il "glycemic index" (GI) è meno predittivo della risposta glicemica reale perché ignora principalmente:',
    options: [
      'Il contenuto di fibre del cibo — la fibra ritarda sempre l\'assorbimento in modo lineare',
      'Il "glycemic load" (GL = GI × grammi CHO/100): la quantità conta quanto la qualità; plus l\'effetto matrice, cottura e combinazione con proteine/grassi che alterano il rilascio',
      'La variabilità individuale del microbioma, che determina fino all\'80% della risposta glicemica personale (Zeevi et al., Cell 2015)',
      'Solo B e C sono corrette — il GI da solo è inutile clinicamente',
    ],
    correct: 'D', topic: '📊 Glicemia & Nutrizione',
  },
  {
    q: 'La creatina loading phase (20g/die × 5-7 giorni) vs maintenance dose (3-5g/die) producono alla fine lo stesso livello di saturazione muscolare. Qual è la differenza reale?',
    options: [
      'La loading phase accumula più creatina totale (il muscolo non è mai saturo a 3-5g/die)',
      'Solo la velocità di saturazione: loading → ~5-7 giorni vs maintenance → ~28 giorni per raggiungere lo stesso plateau di ~150-160 mmol/kg peso secco',
      'La loading phase attiva la sintesi endogena di creatina nel fegato tramite feedback positivo',
      'La loading phase aumenta la ritenzione idrica intracellulare permanentemente; la maintenance no',
    ],
    correct: 'B', topic: '💊 Creatina Avanzata',
  },
  {
    q: 'Nel digiuno intermittente 5:2 (500 kcal × 2 giorni non consecutivi), gli outcome metabolici a 6-12 mesi rispetto alla restrizione calorica continua isocalorica sono:',
    options: [
      'Significativamente superiori per la perdita di grasso viscerale e il miglioramento dell\'insulino-sensibilità',
      'Simili per gli outcome metabolici e di peso, ma con maggiore perdita di massa muscolare nel 5:2',
      'Sostanzialmente equivalenti negli outcome metabolici (peso, glicemia, lipidi), con il 5:2 che mostra migliore aderenza in alcuni sottogruppi ma non in tutti',
      'Inferiori per il profilo lipidico a causa dell\'effetto yo-yo calorico sui trigliceridi',
    ],
    correct: 'C', topic: '⏱ Digiuno Intermittente',
  },
  {
    q: 'L\'AMPKα2 (vs α1) è la principale isoforma che media l\'uptake di glucosio indipendente dall\'insulina durante l\'esercizio muscolare tramite:',
    options: [
      'Fosforilazione diretta di GLUT4 che aumenta la sua velocità di trasporto',
      'Attivazione di AS160/TBC1D4 → traslazione delle vescicole GLUT4 al sarcolemma via via separata da Akt',
      'Inibizione di IRS-1 Ser307 → paradossale aumento della sensibilità insulinica acuta',
      'Fosforilazione di PGC-1α → biogenesi mitocondriale acuta → maggiore capacità ossidativa per il glucosio',
    ],
    correct: 'B', topic: '⚡ Exercise Biochemistry',
  },
];

const OPTION_COLORS = [
  { bg: 'rgba(239,68,68,0.9)',   border: '#ef4444', glow: 'rgba(239,68,68,0.4)',   icon: '▲', label: 'A' },
  { bg: 'rgba(59,130,246,0.9)',  border: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  icon: '◆', label: 'B' },
  { bg: 'rgba(234,179,8,0.9)',   border: '#eab308', glow: 'rgba(234,179,8,0.4)',   icon: '●', label: 'C' },
  { bg: 'rgba(34,197,94,0.9)',   border: '#22c55e', glow: 'rgba(34,197,94,0.4)',   icon: '■', label: 'D' },
];
const TIMER_SECONDS = 22;
const RANK_MEDALS   = ['🥇', '🥈', '🥉'];

// ─── Countdown Ring ────────────────────────────────────────────────────────────
function CountdownRing({ timeLeft, total }) {
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const pct  = timeLeft / total;
  const off  = circ * (1 - pct);
  const col  = pct > 0.5 ? '#10b981' : pct > 0.25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 76, height: 76 }}>
      <svg width={76} height={76} className="-rotate-90">
        <circle cx={38} cy={38} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        <circle cx={38} cy={38} r={r} fill="none" stroke={col} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 8px ${col})` }} />
      </svg>
      <span className="absolute text-2xl font-black text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>{timeLeft}</span>
    </div>
  );
}

// ─── Option Button with live vote emojis ──────────────────────────────────────
function OptionButton({ letter, text, colorDef, votes, isReveal, isCorrect, answeredCount }) {
  const idx        = ['A','B','C','D'].indexOf(letter);
  const hasVotes   = votes.length > 0;
  let bg           = colorDef.bg;
  let border       = colorDef.border;
  let opacity      = 1;
  let glow         = 'none';

  if (isReveal) {
    if (isCorrect)    { bg = 'rgba(34,197,94,0.92)'; border = '#22c55e'; glow = `0 0 28px rgba(34,197,94,0.5), 0 0 60px rgba(34,197,94,0.2)`; }
    else              { opacity = 0.3; }
  } else if (hasVotes) {
    glow = `0 4px 20px ${colorDef.glow}`;
  }

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden"
      style={{ opacity }}
      animate={isReveal && isCorrect ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.5 }}>
      <div className="rounded-2xl p-3 flex flex-col gap-1.5"
        style={{ background: bg, border: `2px solid ${border}`, boxShadow: glow, minHeight: 64 }}>
        <div className="flex items-start gap-2.5">
          <span className="text-2xl font-black text-white flex-shrink-0 leading-none mt-0.5">{colorDef.icon}</span>
          <p className="text-[12px] font-bold text-white leading-snug flex-1">{text}</p>
          {isReveal && isCorrect && <span className="text-xl flex-shrink-0">✅</span>}
        </div>
        {/* Live vote emojis */}
        {(hasVotes || (isReveal && votes.length > 0)) && (
          <div className="flex gap-0.5 flex-wrap pl-8">
            {votes.map(v => (
              <motion.span key={v.id} className="text-base leading-none"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
                {v.emoji}
              </motion.span>
            ))}
            {votes.length > 0 && (
              <span className="text-[9px] text-white/70 self-center ml-1 font-bold">{votes.length}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Compact Model Pill (live) ─────────────────────────────────────────────────
function ModelPill({ contestant, liveAnswer, finalResult, phase, arrivalRank }) {
  const hasAnswered = !!liveAnswer?.answer;
  const isReveal    = phase === 'reveal' || phase === 'scores';
  const isCorrect   = finalResult?.isCorrect;
  const latencyMs   = liveAnswer?.latencyMs ?? 0;

  const pillBg = isReveal
    ? isCorrect ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)'
    : hasAnswered ? `${contestant.color}18` : 'rgba(255,255,255,0.04)';

  const pillBorder = isReveal
    ? isCorrect ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.3)'
    : hasAnswered ? `${contestant.color}55` : 'rgba(255,255,255,0.08)';

  return (
    <motion.div layout
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
      style={{ background: pillBg, border: `1px solid ${pillBorder}` }}>
      <span className="text-base flex-shrink-0">{contestant.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold text-white truncate leading-tight">{contestant.name.split(' ')[0]}</p>
        <AnimatePresence mode="wait">
          {!hasAnswered && !isReveal ? (
            <motion.div key="thinking" exit={{ opacity: 0 }} className="flex gap-0.5 mt-0.5">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1 h-1 rounded-full bg-gray-500"
                  animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </motion.div>
          ) : !isReveal ? (
            <motion.p key="live" className="text-[10px] font-black" style={{ color: contestant.color }}
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500 }}>
              → {liveAnswer.answer}
            </motion.p>
          ) : (
            <motion.p key="done" className="text-[9px] font-black"
              style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {finalResult?.answer || '?'} {isCorrect ? '✓' : '✗'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        {isReveal && <span className="text-sm">{isCorrect ? '✅' : finalResult?.answer === '?' ? '⏱' : '❌'}</span>}
        {!isReveal && arrivalRank && arrivalRank <= 3 && (
          <motion.span className="text-sm" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
            {RANK_MEDALS[arrivalRank - 1]}
          </motion.span>
        )}
        {latencyMs > 0 && (
          <span className="text-[7px] text-gray-600">{latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs/1000).toFixed(1)}s`}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Podium ────────────────────────────────────────────────────────────────────
function Podium({ scores, contestants }) {
  const sorted  = [...contestants].sort((a,b) => (scores[b.id]||0) - (scores[a.id]||0));
  const order   = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const heights = [120, 160, 90];
  const ranks   = [1, 0, 2];
  return (
    <div className="flex items-end justify-center gap-3 mt-4 mb-6">
      {order.map((c, idx) => {
        const score = scores[c.id] || 0;
        const rank  = ranks[idx] + 1;
        return (
          <motion.div key={c.id} className="flex flex-col items-center gap-1"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: idx * 0.2 + 0.3, type: 'spring', stiffness: 200 }}>
            <span className="text-3xl">{c.emoji}</span>
            <p className="text-[10px] font-bold text-white text-center" style={{ maxWidth: 68 }}>{c.name.split(' ')[0]}</p>
            <p className="text-xs font-black" style={{ color: c.color, fontFamily: 'Russo One, sans-serif' }}>{score}</p>
            <div className="flex items-end justify-center rounded-t-xl"
              style={{ width: 70, height: heights[idx], background: `linear-gradient(180deg, ${c.color}55, ${c.color}18)`, border: `1px solid ${c.color}55`, boxShadow: `0 0 24px ${c.color}30` }}>
              <span className="text-3xl mb-2">{['🥇','🥈','🥉'][rank-1]}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Quiz() {
  const [phase,        setPhase]        = useState('lobby');
  const [qIndex,       setQIndex]       = useState(0);
  const [timeLeft,     setTimeLeft]     = useState(TIMER_SECONDS);
  const [scores,       setScores]       = useState({});
  const [contestants,  setContestants]  = useState([]);
  const [roundResults, setRoundResults] = useState(null);
  const [liveAnswers,  setLiveAnswers]  = useState({});    // id → { answer, latencyMs }
  const [answerOrder,  setAnswerOrder]  = useState([]);
  const [votesPerOpt,  setVotesPerOpt]  = useState({ A:[], B:[], C:[], D:[] });
  const [loading,      setLoading]      = useState(false);
  const [history,      setHistory]      = useState([]);
  const timerRef    = useRef(null);
  const apiCalledRef = useRef(false);

  const question = QUESTIONS[qIndex];
  const totalQ   = QUESTIONS.length;

  // ── Load contestants ──
  useEffect(() => {
    fetch('/api/nvidia/quiz')
      .then(r => r.json())
      .then(d => {
        if (d.contestants) {
          setContestants(d.contestants);
          const s = {}; d.contestants.forEach(c => { s[c.id] = 0; }); setScores(s);
        }
      })
      .catch(() => {
        const fb = [
          { id:'kimi',         name:'Kimi K2.6',         emoji:'🌙', color:'#06b6d4', provider:'nvidia'     },
          { id:'mistral-large',name:'Mistral Large 675B', emoji:'🌪️', color:'#3b82f6', provider:'nvidia'     },
          { id:'qwq',          name:'QwQ 80B',            emoji:'🧩', color:'#8b5cf6', provider:'nvidia'     },
          { id:'nemotron',     name:'Nemotron 120B',      emoji:'⚡', color:'#f59e0b', provider:'nvidia'     },
          { id:'step',         name:'Step 3.7',           emoji:'🚀', color:'#10b981', provider:'nvidia'     },
          { id:'medium',       name:'Mistral Medium 3',   emoji:'🔮', color:'#f43f5e', provider:'nvidia'     },
          { id:'nemotron550',  name:'Nemotron 550B',      emoji:'🌀', color:'#a3e635', provider:'nvidia'     },
          { id:'gpt4o-mini',   name:'GPT-4o Mini',        emoji:'🤖', color:'#e5e7eb', provider:'openrouter' },
          { id:'gemini-flash', name:'Gemini Flash 1.5',   emoji:'💎', color:'#34d399', provider:'openrouter' },
          { id:'claude-haiku', name:'Claude Haiku 3.5',   emoji:'🦋', color:'#fb923c', provider:'openrouter' },
        ];
        setContestants(fb);
        const s = {}; fb.forEach(c => { s[c.id] = 0; }); setScores(s);
      });
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'question') return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, qIndex]);

  // ── SSE streaming ──
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

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const allResults = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'answer') {
              // Update live state — triggers pop animations
              setLiveAnswers(prev => ({ ...prev, [data.id]: { answer: data.answer, latencyMs: data.latencyMs } }));
              setAnswerOrder(prev => [...prev, data.id]);
              if (data.answer && data.answer !== '?') {
                setVotesPerOpt(prev => ({
                  ...prev,
                  [data.answer]: [...(prev[data.answer] || []), { id: data.id, emoji: data.emoji }],
                }));
              }
              allResults.push(data);
            } else if (data.type === 'done') {
              const final = data.results || allResults;
              setRoundResults({ results: final, correct: question.correct });
              setScores(prev => {
                const next = { ...prev };
                final.forEach(r => { if (r.isCorrect) next[r.id] = (next[r.id] || 0) + 100; });
                return next;
              });
              setHistory(h => [...h, { qIndex, results: final }]);
              setLoading(false);
              clearInterval(timerRef.current);
              setPhase('reveal');
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setLoading(false);
      setPhase('reveal');
    }
  }, [question, qIndex]);

  useEffect(() => {
    if (phase === 'question') {
      apiCalledRef.current = false;
      setLiveAnswers({});
      setAnswerOrder([]);
      setVotesPerOpt({ A:[], B:[], C:[], D:[] });
      setRoundResults(null);
      callApi();
    }
  }, [phase, qIndex]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = setTimeout(() => setPhase('scores'), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  function startQuiz() {
    setQIndex(0); setTimeLeft(TIMER_SECONDS);
    const s = {}; contestants.forEach(c => { s[c.id] = 0; }); setScores(s);
    setHistory([]); setPhase('question');
  }

  function nextQuestion() {
    if (qIndex >= totalQ - 1) setPhase('final');
    else { setQIndex(i => i + 1); setTimeLeft(TIMER_SECONDS); setPhase('question'); }
  }

  const leaderboard   = [...contestants].sort((a,b) => (scores[b.id]||0) - (scores[a.id]||0));
  const answeredCount = Object.keys(liveAnswers).length;
  const nvidiaCount   = contestants.filter(c => c.provider === 'nvidia').length;
  const orCount       = contestants.filter(c => c.provider === 'openrouter').length;

  // ─── LOBBY ────────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div className="min-h-full pb-24 px-4 pt-6" style={{ background: 'linear-gradient(180deg, #07050f 0%, #030712 100%)' }}>
      {/* Ambient blob */}
      <div style={{ position:'fixed', top:'15%', left:'50%', transform:'translateX(-50%)', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div className="max-w-lg mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.p className="text-[10px] text-violet-400/70 uppercase tracking-[0.25em] mb-2"
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
            ⚡ AI MODEL ARENA
          </motion.p>
          <motion.h1 className="text-4xl font-black text-white mb-1"
            style={{ fontFamily:'Russo One, sans-serif', background:'linear-gradient(135deg, #c4b5fd, #7C3AED, #06b6d4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15, type:'spring' }}>
            QUIZ ARENA
          </motion.h1>
          <motion.p className="text-sm text-gray-400 mb-3" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
            {contestants.length} modelli · {totalQ} domande super tecniche · SSE live
          </motion.p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background:'rgba(34,197,94,0.12)', color:'#34d399', border:'1px solid rgba(34,197,94,0.25)' }}>
              🔥 {nvidiaCount} NVIDIA NIM
            </span>
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background:'rgba(251,146,60,0.12)', color:'#fb923c', border:'1px solid rgba(251,146,60,0.25)' }}>
              ⚡ {orCount} OpenRouter
            </span>
          </div>
        </div>

        {/* Contestant grid */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {contestants.map((c, i) => (
            <motion.div key={c.id}
              initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2.5 p-2.5 rounded-2xl"
              style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${c.color}35`, boxShadow:`inset 0 1px 0 rgba(255,255,255,0.04)` }}>
              <span className="text-xl">{c.emoji}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate">{c.name.split(' ')[0]}</p>
                <p className="text-[8px] truncate font-medium" style={{ color: c.provider === 'openrouter' ? '#fb923c' : '#34d399' }}>
                  {c.provider === 'openrouter' ? '⚡ OR' : '🔥 NIM'} {c.name.split(' ').slice(1).join(' ')}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Start button */}
        <motion.button whileTap={{ scale:0.97 }} onClick={startQuiz}
          className="w-full py-4 rounded-2xl text-white font-black text-lg tracking-wide relative overflow-hidden"
          style={{ fontFamily:'Russo One, sans-serif', background:'linear-gradient(135deg, #7C3AED 0%, #4f46e5 50%, #06b6d4 100%)', boxShadow:'0 8px 40px rgba(124,58,237,0.45), 0 2px 8px rgba(0,0,0,0.4)' }}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5 }}>
          <motion.div className="absolute inset-0 rounded-2xl"
            style={{ background:'linear-gradient(135deg, rgba(255,255,255,0.12), transparent)' }}
            animate={{ opacity:[0.6,1,0.6] }} transition={{ duration:2, repeat:Infinity }} />
          <span className="relative z-10">⚡ START ARENA</span>
        </motion.button>
        <p className="text-center text-[10px] text-gray-600 mt-3">
          Vedi in live su quale risposta ogni modello vota • SSE streaming
        </p>
      </div>
    </div>
  );

  // ─── FINAL ────────────────────────────────────────────────────────────────
  if (phase === 'final') return (
    <div className="min-h-full pb-24 px-4 pt-6" style={{ background:'linear-gradient(180deg, #07050f 0%, #030712 100%)' }}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">🏆 Fine Arena</p>
          <h1 className="text-3xl font-black text-white" style={{ fontFamily:'Russo One, sans-serif' }}>CLASSIFICA FINALE</h1>
        </div>
        {contestants.length >= 3 && <Podium scores={scores} contestants={contestants} />}
        <div className="space-y-2 mb-6">
          {leaderboard.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.06 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: i===0 ? `linear-gradient(135deg, ${c.color}18, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.04)', border:`1px solid ${i===0 ? c.color+'50' : 'rgba(255,255,255,0.07)'}`, boxShadow: i===0 ? `0 0 24px ${c.color}20` : 'none' }}>
              <span className="text-xl font-black w-6 text-center" style={{ color: i<3 ? ['#fbbf24','#94a3b8','#cd7f32'][i] : '#6b7280' }}>{i+1}</span>
              <span className="text-2xl">{c.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-black text-white">{c.name}</p>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background:'rgba(255,255,255,0.08)' }}>
                  <motion.div className="h-full rounded-full" style={{ background:c.color }}
                    initial={{ width:0 }}
                    animate={{ width:`${Math.round(((scores[c.id]||0)/(totalQ*100))*100)}%` }}
                    transition={{ delay:i*0.06+0.3, duration:0.6 }} />
                </div>
              </div>
              <p className="text-lg font-black" style={{ color:c.color, fontFamily:'Russo One, sans-serif' }}>{scores[c.id]||0}</p>
            </motion.div>
          ))}
        </div>
        <motion.button whileTap={{ scale:0.97 }} onClick={startQuiz}
          className="w-full py-3.5 rounded-2xl text-white font-black text-sm"
          style={{ background:'linear-gradient(135deg, #7C3AED, #4f46e5)', boxShadow:'0 6px 20px rgba(124,58,237,0.35)' }}>
          🔄 RIVINCITA
        </motion.button>
      </div>
    </div>
  );

  // ─── SCORES ───────────────────────────────────────────────────────────────
  if (phase === 'scores') return (
    <div className="min-h-full pb-24 px-4 pt-6" style={{ background:'linear-gradient(180deg, #07050f 0%, #030712 100%)' }}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Domanda {qIndex+1}/{totalQ}</p>
          <h2 className="text-xl font-black text-white mt-1" style={{ fontFamily:'Russo One, sans-serif' }}>Classifica</h2>
        </div>
        <div className="space-y-2 mb-6">
          {leaderboard.map((c, i) => (
            <motion.div key={c.id} layout initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.05 }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-sm font-black w-5 text-center text-gray-500">{i+1}</span>
              <span className="text-xl">{c.emoji}</span>
              <p className="flex-1 text-sm font-bold text-white">{c.name}</p>
              <p className="font-black text-base" style={{ color:c.color, fontFamily:'Russo One, sans-serif' }}>{scores[c.id]||0}</p>
            </motion.div>
          ))}
        </div>
        <motion.button whileTap={{ scale:0.97 }} onClick={nextQuestion}
          className="w-full py-3.5 rounded-2xl text-white font-black text-sm"
          style={{ background:'linear-gradient(135deg, #10b981, #059669)', boxShadow:'0 6px 20px rgba(16,185,129,0.3)' }}>
          {qIndex >= totalQ-1 ? '🏆 Risultati Finali' : `➡️ Prossima (${qIndex+2}/${totalQ})`}
        </motion.button>
      </div>
    </div>
  );

  // ─── QUESTION + REVEAL ────────────────────────────────────────────────────
  const isReveal      = phase === 'reveal';
  const correctLetter = question.correct;
  const correctIdx    = ['A','B','C','D'].indexOf(correctLetter);

  return (
    <div className="min-h-full pb-24 px-3 pt-4" style={{ background:'linear-gradient(180deg, #07050f 0%, #030712 100%)' }}>
      <div className="max-w-lg mx-auto">

        {/* ── Header bar ── */}
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex-1 min-w-0">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.08)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background:'linear-gradient(90deg, #7C3AED, #06b6d4)' }}
                  initial={{ width:`${(qIndex/totalQ)*100}%` }}
                  animate={{ width:`${((qIndex+1)/totalQ)*100}%` }}
                  transition={{ duration:0.5 }} />
              </div>
              <span className="text-[9px] text-gray-500 flex-shrink-0">{qIndex+1}/{totalQ}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background:'rgba(124,58,237,0.2)', color:'#a78bfa', border:'1px solid rgba(124,58,237,0.3)' }}>
                {question.topic}
              </span>
              {!isReveal && loading && (
                <motion.span className="text-[9px] text-violet-400 font-bold"
                  animate={{ opacity:[1,0.4,1] }} transition={{ duration:1, repeat:Infinity }}>
                  ● LIVE {answeredCount}/{contestants.length}
                </motion.span>
              )}
            </div>
          </div>
          {!isReveal
            ? <CountdownRing timeLeft={timeLeft} total={TIMER_SECONDS} />
            : <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:400 }} className="text-4xl">🎯</motion.div>
          }
        </div>

        {/* ── Question card ── */}
        <motion.div className="rounded-2xl p-4 mb-4"
          layout
          style={{ background:'linear-gradient(145deg, rgba(124,58,237,0.08), rgba(6,182,212,0.05), rgba(255,255,255,0.03))', border:'1px solid rgba(124,58,237,0.25)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(124,58,237,0.1)' }}>
          <p className="text-[15px] font-bold text-white leading-snug text-center">{question.q}</p>
        </motion.div>

        {/* ── Options with live votes ── */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {question.options.map((opt, i) => {
            const letter = ['A','B','C','D'][i];
            return (
              <OptionButton key={i}
                letter={letter}
                text={opt}
                colorDef={OPTION_COLORS[i]}
                votes={votesPerOpt[letter] || []}
                isReveal={isReveal}
                isCorrect={letter === correctLetter}
                answeredCount={answeredCount}
              />
            );
          })}
        </div>

        {/* ── Model pills grid ── */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest">
              {isReveal ? '▸ Risultati modelli' : `▸ Live — ${answeredCount}/${contestants.length} risposto`}
            </p>
            {!isReveal && answeredCount > 0 && answeredCount < contestants.length && (
              <motion.p className="text-[8px] text-violet-400 font-bold"
                animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.2, repeat:Infinity }}>
                streaming ●
              </motion.p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {contestants.map(c => {
              const liveAns  = liveAnswers[c.id] ?? null;
              const finalRes = roundResults?.results?.find(r => r.id === c.id) ?? null;
              const rank     = answerOrder.indexOf(c.id);
              return (
                <ModelPill key={c.id} contestant={c} liveAnswer={liveAns} finalResult={finalRes}
                  phase={phase} arrivalRank={rank >= 0 ? rank+1 : null} />
              );
            })}
          </div>
        </div>

        {/* ── Reveal summary ── */}
        <AnimatePresence>
          {isReveal && roundResults && (
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              className="rounded-2xl p-3 text-center"
              style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)' }}>
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

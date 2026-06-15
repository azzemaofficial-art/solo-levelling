import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Quick prompts ─────────────────────────────────────────────────────────────
const COACH_QUICK = [
  { label: '🥩 Ricetta proteica', text: 'Dammi una ricetta ad alto contenuto proteico (almeno 40g di proteine) veloce da preparare, con macro completi.' },
  { label: '💊 Integratori base', text: 'Quali integratori base consiglia la scienza per un atleta naturale? Dosaggi e timing.' },
  { label: '📊 Macro per bulk', text: 'Come calcolo i macronutrienti per una fase di bulk pulita? Peso 75kg, altezza 178cm, alleno 4x settimana.' },
  { label: '🏋️ Scheda push/pull', text: 'Crea una scheda push/pull/legs 6 giorni per ipertrofia, livello intermedio, palestra.' },
  { label: '🥊 Conditioning MMA', text: 'Crea un piano di conditioning per un praticante di arti marziali miste, 3 sessioni/settimana.' },
  { label: '😴 Recupero e sonno', text: 'Come ottimizzare il recupero muscolare e il sonno per massimizzare i guadagni?' },
];

const TRAINER_QUICK = [
  { label: '🔥 Piano calorico', text: 'Calcolami il fabbisogno calorico giornaliero e i macro ideali. Peso 75kg, 178cm, 25 anni, maschio, allenamento 4x/settimana, obiettivo massa muscolare.' },
  { label: '🥗 Piano pasti 7gg', text: 'Crea un piano pasti completo per 7 giorni, ~2800 kcal/giorno, alto contenuto proteico (160g+), con ricette e macro per ogni pasto.' },
  { label: '💪 Scheda arti marziali', text: 'Crea una scheda di allenamento per migliorare forza esplosiva, mobilità e resistenza specifica per le arti marziali (3-4x settimana).' },
  { label: '🥊 Migliori esercizi', text: 'Quali sono i 10 esercizi più efficaci per un praticante di arti marziali che vuole migliorare potenza, velocità e resistenza?' },
  { label: '💊 Stack integratori', text: 'Costruisci uno stack di integratori evidence-based per un atleta di arti marziali: cosa prendere, quando, quanto.' },
  { label: '🍳 Ricetta post-workout', text: 'Dammi 3 ricette post-allenamento veloci, almeno 40g di proteine, con macro precisi.' },
];

// ─── Discipline ────────────────────────────────────────────────────────────────
const DISCIPLINE_GROUPS = [
  { label: '👤 Solo', items: [
    { id: 'muaythai',   emoji: '🥊', label: 'Muay Thai',   prompt: 'Guida la mia sessione di Muay Thai. Analizza tecnica, postura e di\' cosa fare.' },
    { id: 'boxing',     emoji: '🥊', label: 'Boxe',        prompt: 'Guida la mia sessione di boxe. Analizza guardia, colpi e footwork.' },
    { id: 'kickboxing', emoji: '🦵', label: 'Kickboxing',  prompt: 'Guida la mia sessione di kickboxing. Analizza pugni e calci.' },
    { id: 'karate',     emoji: '🥋', label: 'Karate',      prompt: 'Guida la mia sessione di karate. Analizza kihon, kata o kumite.' },
    { id: 'taekwondo',  emoji: '🦵', label: 'Taekwondo',   prompt: 'Guida la mia sessione di taekwondo. Analizza calci e poomsae.' },
    { id: 'bjj',        emoji: '🤼', label: 'BJJ',         prompt: 'Guida la mia sessione di BJJ. Analizza posizioni, guard e submission.' },
    { id: 'wrestling',  emoji: '🤼', label: 'Wrestling',   prompt: 'Guida la mia sessione di wrestling. Analizza stance, shot e mat work.' },
    { id: 'judo',       emoji: '🥋', label: 'Judo',        prompt: 'Guida la mia sessione di judo. Analizza kumi-kata e proiezioni.' },
    { id: 'mma',        emoji: '🏆', label: 'MMA',         prompt: 'Guida la mia sessione MMA. Analizza striking, grappling e transizioni.' },
    { id: 'kravmaga',   emoji: '⚔️', label: 'Krav Maga',  prompt: 'Guida la mia sessione di Krav Maga. Analizza efficacia e reattività.' },
  ]},
  { label: '👥 Con partner', items: [
    { id: 'sparring_muaythai', emoji: '🥊', label: 'Sparring MT',   prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Muay Thai.' },
    { id: 'sparring_boxing',   emoji: '🥊', label: 'Sparring Boxe', prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Boxe.' },
    { id: 'sparring_mma',      emoji: '🏆', label: 'Sparring MMA',  prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. MMA.' },
    { id: 'partner_drills',    emoji: '🤝', label: 'Drill coppia',  prompt: 'Stiamo facendo drill di coppia — valuta entrambi e proponi il drill successivo.' },
    { id: 'sparring_general',  emoji: '👥', label: 'Sparring free', prompt: 'Siamo in due — arbitraci liberamente e dai consigli a entrambi.' },
  ]},
  { label: '💪 Altro', items: [
    { id: 'fitness', emoji: '🏋️', label: 'Palestra', prompt: 'Guida il mio allenamento in palestra. Analizza forma ed esercizi.' },
    { id: 'general', emoji: '👁',  label: 'Generale', prompt: 'Analizza il movimento e guidami. Feedback libero.' },
  ]},
];

// ─── Curriculum ────────────────────────────────────────────────────────────────
const CURRICULUM = {
  muaythai: { name: 'Muay Thai', emoji: '🥊', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab e cross', 'Teep (calcio frontale)', 'Low kick', 'Shadowboxing 3×3min'], milestone: 'Esegui jab-cross-teep con forma corretta' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Mid/high kick', 'Combo 3-5 colpi', 'Parry e difesa', 'Clinch entry', 'Counter jab'], milestone: 'Sparring leggero 3 round' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Gomitate (6 tipi)', 'Ginocchiate in clinch', 'Sweeps', 'Teep come jab', 'Fight IQ base'], milestone: 'Match sparring completo con arbitro' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Clinch avanzato', 'K1 ruleset', 'Footwork da ring', 'Diagonali + teep', 'Fight camp strategy'], milestone: 'Competizione amatoriale' },
  ]},
  boxing: { name: 'Boxe', emoji: '🥊', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab', 'Cross', 'Gancio', 'Footwork base'], milestone: 'Combo 1-2 fluida × 50 ripetizioni' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Uppercut', 'Slip e roll', 'Parry', 'Combo 1-2-3', 'Corpo e testa'], milestone: '3 round sparring leggero' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Head movement', 'Counter-punching', 'Difesa nella corner', 'Feint', 'Jab multiplo'], milestone: 'Sparring 6 round con feedback' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Ring generalship', 'Distance management', 'Body shot setup', 'Fight IQ', 'Competition strategy'], milestone: 'Torneo amatoriale' },
  ]},
  kickboxing: { name: 'Kickboxing', emoji: '🦵', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab-cross', 'Roundhouse base', 'Front kick', 'Camera del calcio'], milestone: 'Roundhouse × 20 per lato con forma' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Side kick', 'Back kick', 'Combo pugno+calcio', 'Teep difensivo', 'Parata calci'], milestone: '3 round sparring leggero' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Spinning back kick', 'Flying knee', 'Switch kick', 'Catch and counter', 'Dutch combos'], milestone: 'K1 rules sparring' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Timing avanzato', 'Sweep counter', 'Feint calci', 'Clinch KB', 'Competition prep'], milestone: 'Competizione K1/Kickboxing' },
  ]},
  karate: { name: 'Karate', emoji: '🥋', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Zenkutsu-dachi', 'Oi-zuki', 'Age-uke / Gedan-barai', 'Kata Heian Shodan', 'Kiai e zanshin'], milestone: 'Heian Shodan da memoria' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Mae-geri / Mawashi-geri', 'Kizami-zuki', 'Ippon kumite base', 'Heian Nidan-Sandan', 'Hikite'], milestone: 'Kumite base 1-step sparring' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Yoko-geri / Ushiro-geri', 'Heian Yondan-Godan', 'Jiyu kumite', 'Bunkai applicazioni', 'Kime'], milestone: 'Jiyu kumite 3 minuti' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Bassai-Dai kata', 'WKF competition rules', 'Sanbon kumite', 'Kata avanzate', 'Gara regionale'], milestone: 'Gara WKF/WKSA' },
  ]},
  taekwondo: { name: 'Taekwondo', emoji: '🦵', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Ap-seogi / Ap-kubi', 'Ap-chagi (front kick)', 'Dollyo-chagi (roundhouse)', 'Naeryo-chagi (axe kick)', 'Poomsae Taeguk 1-2'], milestone: 'Taeguk 1 da memoria' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Yeop-chagi (side kick)', 'Dwi-chagi (back kick)', 'Spinning roundhouse', 'Taeguk 3-4', 'Difese di base'], milestone: 'Test cintura gialla' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Dwi-hurigi (spinning heel)', 'Flying side kick', 'Triple kick', 'Poomsae 5-6', 'Sparring WTF'], milestone: 'Sparring competition 3 round' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['540° kick', 'Olympic sparring strategy', 'Poomsae black belt', 'Electronic hogu', 'Gara nazionale'], milestone: 'Gara ITF/WTF' },
  ]},
  bjj: { name: 'BJJ', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Postura e base', 'Guard chiusa', 'Trap & roll (mount escape)', 'Hip escape (shrimping)', 'Rear naked choke'], milestone: 'Uscita da mount e guard 5 volte' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Armbar da guard', 'Triangle choke', 'Single leg takedown', 'Guard pass base', 'Back take'], milestone: 'Rolling 5 round senza gas out' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['De La Riva guard', 'X-guard', 'Heel hook entry', 'Kimura trap', 'Berimbolo intro'], milestone: 'Submission competition bianca/blu' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Worm guard', 'EBI overtime prep', 'Submission chains', 'No-gi specializzazione', 'Competition strategy'], milestone: 'Gara IBJJF/ADCC Trials' },
  ]},
  wrestling: { name: 'Wrestling', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Stance e movement', 'Penetration step', 'Double leg takedown', 'Single leg takedown', 'Sprawl'], milestone: 'Double leg da clinch 10 volte' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Low single', 'High crotch', 'Head lock', 'Granby roll', 'Mat work base'], milestone: '5 round drilling con partner' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Leg ride', 'Cradle (near/far)', 'Power half nelson', 'Throw by', 'Funk wrestling'], milestone: 'Match allenamento wrestling' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Scrambles avanzati', 'Cement job', 'Shooting combination', 'Greco-Romano throws', 'Competition prep'], milestone: 'Gara regionale / torneo MMA' },
  ]},
  judo: { name: 'Judo', emoji: '🥋', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Ukemi (cadute sicure)', 'Kumi-kata (grip)', 'O-soto-gari', 'O-goshi', 'Seoi-nage'], milestone: 'Caduta laterale/posteriore senza paura' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Tai-otoshi', 'Uchi-mata', 'Kuzushi (sbilancio)', 'Kesa-gatame', 'Tate-shiho-gatame'], milestone: 'Randori 3 round cintura gialla' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Ippon-seoi-nage', 'Ko-uchi/O-uchi-gari', 'Harai-goshi', 'Shime-waza', 'Kansetsu-waza'], milestone: 'Shiai (gara) locale' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Grip fighting avanzato', 'Renraku-waza (combo)', 'Ashi-waza', 'Kata avanzate', 'IJF competition rules'], milestone: 'Gara IJF/FIJLKAM' },
  ]},
  mma: { name: 'MMA', emoji: '🏆', levels: [
    { label: 'Fondamenta', weeks: '1-8',   color: 'emerald', topics: ['Striking base (boxe/MT)', 'Grappling base (wrestling/BJJ)', 'Clinch entry e exit', 'Takedown defense', 'Postura nel guard'], milestone: '2 sessioni/sett per 8 settimane' },
    { label: 'Tecnica',    weeks: '9-20',  color: 'blue',    topics: ['Transizioni striking→ground', 'Sprawl & brawl', 'Guard pass in MMA', 'Ground & pound', 'Cage work base'], milestone: 'MMA sparring leggero 3 round' },
    { label: 'Avanzato',   weeks: '21-36', color: 'orange',  topics: ['Dirty boxing nel clinch', 'Standing submission', 'Knee from clinch', 'Scrambles', 'Conditioning MMA-specifico'], milestone: 'Sparring full (protections) 5 round' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Game planning avversario', 'Weight cut basics', 'Fight camp periodization', 'Film study', 'Amateur MMA rules'], milestone: 'Match amatoriale MMA' },
  ]},
  kravmaga: { name: 'Krav Maga', emoji: '⚔️', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia naturale', 'Colpi base (palmo/gomito/ginocchio)', 'Caduta e rialzo', 'Difesa 360°', 'Choke release'], milestone: 'Difesa da choke in 1.5 secondi' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Difesa da pugni diretti', 'Difesa da calci', 'Bear hug releases (4 varianti)', 'Headlock escape', 'Ground defense'], milestone: 'Scenario drill con stress' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Difesa da coltello', 'Difesa da arma da fuoco', 'Aggressori multipli', 'Difesa in auto', 'Stress inoculation'], milestone: 'Scenario multiplo 3 minuti no-stop' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Weapon retention', 'Force continuum', 'Mission-specific training', 'Istruttore P1 prep', 'Scenario avanzati notturni'], milestone: 'Certificazione istruttore P1/P2' },
  ]},
};

// ─── Colori palette ────────────────────────────────────────────────────────────
const C = {
  emerald: { hex: '#10b981', glow: 'rgba(16,185,129,0.4)', bg: 'rgba(6,78,59,0.15)',  border: 'rgba(16,185,129,0.25)' },
  blue:    { hex: '#3b82f6', glow: 'rgba(59,130,246,0.4)', bg: 'rgba(30,58,138,0.15)', border: 'rgba(59,130,246,0.25)' },
  orange:  { hex: '#f97316', glow: 'rgba(249,115,22,0.4)', bg: 'rgba(124,45,18,0.15)', border: 'rgba(249,115,22,0.25)' },
  rose:    { hex: '#f43f5e', glow: 'rgba(244,63,94,0.4)',  bg: 'rgba(136,19,55,0.15)', border: 'rgba(244,63,94,0.25)'  },
  amber:   { hex: '#f59e0b', glow: 'rgba(245,158,11,0.4)', bg: 'rgba(120,53,15,0.15)', border: 'rgba(245,158,11,0.25)' },
  red:     { hex: '#ef4444', glow: 'rgba(239,68,68,0.5)',  bg: 'rgba(127,29,29,0.2)',  border: 'rgba(239,68,68,0.3)'  },
  violet:  { hex: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', bg: 'rgba(76,29,149,0.15)', border: 'rgba(139,92,246,0.25)' },
};

// ─── SVG Ring (progress circle) ───────────────────────────────────────────────
function Ring({ done, total, color = 'blue', size = 36, strokeW = 3, label }) {
  const col = C[color] || C.blue;
  const r = size / 2 - strokeW - 1;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const offset = circ * (1 - pct);
  const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(55,65,81,0.6)" strokeWidth={strokeW} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={col.hex} strokeWidth={strokeW}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease', filter: pct > 0 ? `drop-shadow(0 0 ${strokeW + 1}px ${col.hex})` : 'none' }} />
      </svg>
      {label && (
        <span className="absolute text-[9px] font-black" style={{ color: col.hex }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Gong (Web Audio) ─────────────────────────────────────────────────────────
function playGong(freq = 523) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 3);
  } catch {}
}

// ─── Parse AI punto assegnato ─────────────────────────────────────────────────
function parsePoint(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('🏆') && !/punto assegnato/i.test(line)) continue;
    const l = line.toLowerCase();
    if (l.includes('nessun punto') || l.includes('nessuno')) return null;
    if (l.includes('atleta a') || l.includes('🔴')) return 'a';
    if (l.includes('atleta b') || l.includes('🔵')) return 'b';
  }
  return null;
}

// ─── Round timer hook ─────────────────────────────────────────────────────────
function useRoundTimer({ rounds = 3, roundDuration = 180, restDuration = 60 }) {
  const timerRef = useRef({ phase: 'idle', currentRound: 1, timeLeft: roundDuration, intervalId: null });
  const [, forceUpdate] = useState(0);
  const configRef = useRef({ rounds, roundDuration, restDuration });
  configRef.current = { rounds, roundDuration, restDuration };

  const doTick = useCallback(() => {
    const t = timerRef.current;
    const { rounds: r, roundDuration: rd, restDuration: rest } = configRef.current;
    t.timeLeft -= 1;
    if (t.timeLeft <= 0) {
      if (t.phase === 'round') {
        if (t.currentRound >= r) {
          clearInterval(t.intervalId); t.intervalId = null;
          t.phase = 'finished'; t.timeLeft = 0;
          playGong(); setTimeout(() => playGong(440), 700);
        } else { t.phase = 'rest'; t.timeLeft = rest; playGong(); }
      } else if (t.phase === 'rest') {
        t.currentRound += 1; t.phase = 'round'; t.timeLeft = rd; playGong();
      }
    }
    forceUpdate((n) => n + 1);
  }, []);

  const start = useCallback(() => {
    const t = timerRef.current;
    clearInterval(t.intervalId);
    t.phase = 'round'; t.currentRound = 1; t.timeLeft = configRef.current.roundDuration;
    t.intervalId = setInterval(doTick, 1000);
    playGong(); forceUpdate((n) => n + 1);
  }, [doTick]);

  const stop = useCallback(() => {
    const t = timerRef.current;
    clearInterval(t.intervalId); t.intervalId = null;
    t.phase = 'idle'; t.currentRound = 1; t.timeLeft = configRef.current.roundDuration;
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current.intervalId), []);
  const t = timerRef.current;
  return { phase: t.phase, currentRound: t.currentRound, timeLeft: t.timeLeft, start, stop, totalRounds: rounds };
}

// ─── Match config (setup) ─────────────────────────────────────────────────────
function RoundConfig({ rounds, onRounds, roundDuration, onRoundDuration }) {
  return (
    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <p className="text-xs font-bold" style={{ color: C.violet.hex }}>⏱ Configura Match</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Round:</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 5, 10].map((r) => (
            <button key={r} onClick={() => onRounds(r)}
              className="w-9 h-9 rounded-xl text-xs font-black transition-all"
              style={rounds === r
                ? { background: C.violet.hex, color: '#fff', boxShadow: `0 4px 12px ${C.violet.glow}` }
                : { background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Min:</span>
        <div className="flex gap-1.5">
          {[{ l: "2'", v: 120 }, { l: "3'", v: 180 }, { l: "5'", v: 300 }].map(({ l, v }) => (
            <button key={v} onClick={() => onRoundDuration(v)}
              className="px-3 h-9 rounded-xl text-xs font-black transition-all"
              style={roundDuration === v
                ? { background: C.violet.hex, color: '#fff', boxShadow: `0 4px 12px ${C.violet.glow}` }
                : { background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Round timer display ──────────────────────────────────────────────────────
function RoundTimerDisplay({ timer, roundDuration, restDuration = 60 }) {
  const { phase, currentRound, timeLeft, totalRounds, start, stop } = timer;
  if (phase === 'idle') return null;

  const totalPhaseTime = phase === 'rest' ? restDuration : roundDuration;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const isDone = phase === 'finished';
  const isRest = phase === 'rest';

  const phaseColor = isDone ? C.emerald : isRest ? C.amber : C.red;
  const r = 42, circ = 2 * Math.PI * r;
  const pct = totalPhaseTime > 0 ? timeLeft / totalPhaseTime : 0;
  const offset = circ * (1 - pct);

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl flex items-center gap-4"
      style={{ background: phaseColor.bg, border: `1px solid ${phaseColor.border}` }}>
      {/* SVG Circular countdown */}
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(55,65,81,0.5)" strokeWidth="6" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={phaseColor.hex} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 8px ${phaseColor.hex})` }} />
        </svg>
        <div className="absolute text-center">
          {isDone
            ? <span className="text-2xl">✅</span>
            : <p className="text-xl font-black font-mono text-white leading-none">{mins}:{secs}</p>
          }
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black tracking-wide" style={{ color: phaseColor.hex }}>
          {isDone ? 'MATCH FINITO' : isRest ? 'RIPOSO' : `ROUND ${currentRound}`}
        </p>
        {!isDone && (
          <p className="text-xs text-gray-500 mt-0.5">
            {isRest ? `Round ${currentRound + 1}/${totalRounds} in arrivo` : `di ${totalRounds} round`}
          </p>
        )}
        {/* Mini round dots */}
        <div className="flex gap-1 mt-2">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{ background: i < currentRound ? phaseColor.hex : 'rgba(55,65,81,0.7)', boxShadow: i === currentRound - 1 && !isDone ? `0 0 6px ${phaseColor.hex}` : 'none' }} />
          ))}
        </div>
      </div>

      {/* Action button */}
      {!isDone
        ? <button onClick={stop} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>■</button>
        : <button onClick={start} className="px-3 py-2 rounded-xl text-xs font-black transition-all"
            style={{ background: C.emerald.hex, color: '#fff', boxShadow: `0 4px 12px ${C.emerald.glow}` }}>↺</button>
      }
    </motion.div>
  );
}

// ─── Score tracker ─────────────────────────────────────────────────────────────
function ScoreTracker({ score, onScore, lastPoint }) {
  const winner = score.a > score.b ? 'a' : score.b > score.a ? 'b' : null;

  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <p className="text-xs text-gray-500 font-bold text-center mb-3 tracking-widest">PUNTEGGIO MATCH</p>
      <div className="flex items-center justify-around">
        {/* Atleta A */}
        <div className="text-center">
          <p className="text-xs font-bold mb-2" style={{ color: C.red.hex }}>🔴 ATLETA A</p>
          <motion.p key={`a-${score.a}`}
            initial={{ scale: lastPoint === 'a' ? 1.5 : 1, opacity: lastPoint === 'a' ? 0.6 : 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-6xl font-black font-mono leading-none"
            style={{ color: C.red.hex, textShadow: score.a > 0 ? `0 0 30px ${C.red.glow}, 0 0 60px rgba(239,68,68,0.15)` : 'none' }}>
            {score.a}
          </motion.p>
          <div className="flex gap-1 justify-center mt-3">
            <button onClick={() => onScore('a', 1)}
              className="w-8 h-8 rounded-lg text-sm font-black transition-all"
              style={{ background: 'rgba(239,68,68,0.2)', color: C.red.hex, border: `1px solid ${C.red.border}` }}>+</button>
            <button onClick={() => onScore('a', -1)}
              className="w-8 h-8 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(55,65,81,0.4)', color: '#6b7280' }}>−</button>
          </div>
        </div>

        {/* Center VS */}
        <div className="text-center px-2">
          <p className="text-xl font-black text-gray-700">VS</p>
          <AnimatePresence mode="wait">
            {lastPoint && (
              <motion.div key={`${lastPoint}-${Date.now()}`}
                initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-1">
                <span className="text-lg">{lastPoint === 'a' ? '🔴' : '🔵'}</span>
                <p className="text-[10px] font-black" style={{ color: lastPoint === 'a' ? C.red.hex : '#60a5fa' }}>+1</p>
              </motion.div>
            )}
          </AnimatePresence>
          {winner && !lastPoint && (
            <p className="text-[10px] font-bold mt-1" style={{ color: winner === 'a' ? C.red.hex : '#60a5fa' }}>
              {winner === 'a' ? '🔴 WIN' : '🔵 WIN'}
            </p>
          )}
        </div>

        {/* Atleta B */}
        <div className="text-center">
          <p className="text-xs font-bold mb-2" style={{ color: '#60a5fa' }}>🔵 ATLETA B</p>
          <motion.p key={`b-${score.b}`}
            initial={{ scale: lastPoint === 'b' ? 1.5 : 1, opacity: lastPoint === 'b' ? 0.6 : 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-6xl font-black font-mono leading-none"
            style={{ color: '#60a5fa', textShadow: score.b > 0 ? `0 0 30px rgba(96,165,250,0.5), 0 0 60px rgba(96,165,250,0.15)` : 'none' }}>
            {score.b}
          </motion.p>
          <div className="flex gap-1 justify-center mt-3">
            <button onClick={() => onScore('b', 1)}
              className="w-8 h-8 rounded-lg text-sm font-black transition-all"
              style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>+</button>
            <button onClick={() => onScore('b', -1)}
              className="w-8 h-8 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(55,65,81,0.4)', color: '#6b7280' }}>−</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hook chat ─────────────────────────────────────────────────────────────────
function useChat(endpoint) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (userText, extraBody = {}) => {
    if (!userText.trim() || loading) return;
    setError(null);
    const userMsg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].slice(-12);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content, provider: data.provider }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally { setLoading(false); }
  }, [messages, loading, endpoint]);

  const clear = useCallback(() => { setMessages([]); setError(null); }, []);
  return { messages, loading, error, send, clear };
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
        style={isUser
          ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', borderBottomRightRadius: 4, boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }
          : { background: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(59,130,246,0.12)', color: '#e5e7eb', borderBottomLeftRadius: 4 }}>
        {!isUser && msg.provider && (
          <div className="text-xs mb-1.5 font-mono" style={{ color: C.blue.hex, opacity: 0.7 }}>🤖 {msg.provider}</div>
        )}
        {msg.content}
      </div>
    </motion.div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────
function ChatInput({ value, onChange, onSend, loading, placeholder }) {
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } };
  return (
    <div className="flex gap-2">
      <textarea value={value} onChange={onChange} onKeyDown={handleKey} placeholder={placeholder} rows={2}
        className="flex-1 px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-all"
        style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(8px)' }}
        onFocus={(e) => e.target.style.borderColor = 'rgba(59,130,246,0.4)'}
        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.07)'} />
      <button onClick={onSend} disabled={loading || !value.trim()}
        className="px-4 py-2 rounded-2xl text-white font-black text-lg self-stretch transition-all disabled:opacity-30"
        style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}>
        ↑
      </button>
    </div>
  );
}

// ─── Quick prompts grid ────────────────────────────────────────────────────────
function QuickGrid({ prompts, onSend, accentColor }) {
  const col = C[accentColor] || C.blue;
  return (
    <div className="grid grid-cols-2 gap-2">
      {prompts.map((p) => (
        <motion.button key={p.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => onSend(p.text)}
          className="text-left px-3 py-3 rounded-xl text-xs text-gray-200 transition-all"
          style={{ background: 'rgba(17,24,39,0.6)', border: `1px solid ${col.border}`, backdropFilter: 'blur(8px)' }}>
          <span className="font-bold">{p.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

// ─── Tab: Chat generale ────────────────────────────────────────────────────────
function CoachChat() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/coach');
  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && <QuickGrid prompts={COACH_QUICK} onSend={send} accentColor="blue" />}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>{messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}</AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(59,130,246,0.1)' }}>
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: C.blue.hex }}
                    animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <p className="text-center text-xs text-red-400 py-2">⚠️ {error}</p>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">🗑 Nuova conversazione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend} loading={loading} placeholder="Ricette, esercizi, integratori…" />
    </div>
  );
}

// ─── Tab: Personal Trainer ─────────────────────────────────────────────────────
function PersonalTrainer() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/trainer');
  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <>
          <div className="px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.12), rgba(180,83,9,0.08))', border: `1px solid ${C.amber.border}` }}>
            <p className="text-xs font-black" style={{ color: C.amber.hex }}>⚡ SHADOW COACH — Kimi K2.6</p>
            <p className="text-xs text-gray-500 mt-0.5">Personal trainer AI — calorie, macro, schede, arti marziali</p>
          </div>
          <QuickGrid prompts={TRAINER_QUICK} onSend={send} accentColor="amber" />
        </>
      )}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>{messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}</AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: 'rgba(17,24,39,0.8)', border: `1px solid ${C.amber.border}` }}>
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: C.amber.hex }}
                    animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <p className="text-center text-xs text-red-400 py-2">⚠️ {error}</p>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">🗑 Nuova sessione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend} loading={loading} placeholder="Piano calorico, scheda, integratori…" />
    </div>
  );
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const SESSIONS_KEY = 'shadow_monarch_live_sessions';
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } };
const saveSessions = (s) => { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s.slice(0, 10))); } catch {} };

const CURRICULUM_KEY = 'shadow_monarch_curriculum';
const loadCurrProgress = () => { try { return JSON.parse(localStorage.getItem(CURRICULUM_KEY) || '{}'); } catch { return {}; } };
const saveCurrProgress = (p) => { try { localStorage.setItem(CURRICULUM_KEY, JSON.stringify(p)); } catch {} };

// ─── Tab: Curriculum ──────────────────────────────────────────────────────────
function CurriculumCoach() {
  const [disc, setDisc] = useState('muaythai');
  const [expandedLevel, setExpandedLevel] = useState(0);
  const [progress, setProgress] = useState(() => loadCurrProgress());
  const [loadingTopic, setLoadingTopic] = useState(null);
  const [topicLesson, setTopicLesson] = useState(null);

  const curriculum = CURRICULUM[disc];
  const discProgress = progress[disc] || {};
  const getCompleted = (li) => new Set(discProgress[`l${li}`] || []);
  const totalDone = curriculum.levels.reduce((s, _, li) => s + getCompleted(li).size, 0);
  const totalTopics = curriculum.levels.reduce((s, l) => s + l.topics.length, 0);

  const toggleTopic = (li, ti) => {
    setProgress((prev) => {
      const dp = prev[disc] || {};
      const set = new Set(dp[`l${li}`] || []);
      if (set.has(ti)) set.delete(ti); else set.add(ti);
      const next = { ...prev, [disc]: { ...dp, [`l${li}`]: [...set] } };
      saveCurrProgress(next);
      return next;
    });
  };

  const learnTopic = async (topic, levelLabel) => {
    setLoadingTopic(topic);
    setTopicLesson(null);
    try {
      const prompt = `Insegnami: "${topic}" — ${curriculum.name}, livello ${levelLabel}.\n1) Cos'è e perché è fondamentale\n2) Come si esegue step-by-step\n3) Errori più comuni\n4) Drill pratico per impararlo\nRispondi in italiano, max 12 righe, tono da coach pratico.`;
      const res = await fetch('/api/nvidia/trainer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (res.ok) setTopicLesson({ topic, content: data.content, provider: data.provider });
    } catch {}
    finally { setLoadingTopic(null); }
  };

  const SOLO_DISCS = DISCIPLINE_GROUPS[0].items;
  const overallPct = totalTopics > 0 ? totalDone / totalTopics : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(79,70,229,0.08))', border: `1px solid ${C.violet.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-black tracking-wide" style={{ color: C.violet.hex }}>📚 CURRICULUM</p>
            <p className="text-sm font-bold text-white mt-0.5">{curriculum.name}</p>
          </div>
          <Ring done={totalDone} total={totalTopics} color="violet" size={52} strokeW={4}
            label={overallPct === 1 ? '✓' : `${Math.round(overallPct * 100)}%`} />
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.6)' }}>
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${C.violet.hex}, #4f46e5)`, width: `${overallPct * 100}%` }}
            layout transition={{ duration: 0.5 }} />
        </div>
        <p className="text-xs text-gray-600 mt-1">{totalDone}/{totalTopics} argomenti completati</p>
      </div>

      {/* Selector */}
      <div className="flex flex-wrap gap-1.5">
        {SOLO_DISCS.map((d) => {
          const dp = progress[d.id] || {};
          const done = Object.values(dp).reduce((s, arr) => s + arr.length, 0);
          const tot = CURRICULUM[d.id]?.levels.reduce((s, l) => s + l.topics.length, 0) || 0;
          const isActive = disc === d.id;
          return (
            <motion.button key={d.id} whileTap={{ scale: 0.95 }}
              onClick={() => { setDisc(d.id); setExpandedLevel(0); setTopicLesson(null); }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={isActive
                ? { background: C.violet.hex, color: '#fff', boxShadow: `0 4px 12px ${C.violet.glow}` }
                : { background: 'rgba(55,65,81,0.4)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
              {d.emoji} {d.label}
              {done > 0 && <span className="ml-1 opacity-70 text-[10px]">{done}/{tot}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Levels */}
      <div className="space-y-2">
        {curriculum.levels.map((level, li) => {
          const completed = getCompleted(li);
          const isUnlocked = li === 0 || getCompleted(li - 1).size === curriculum.levels[li - 1].topics.length;
          const pct = level.topics.length > 0 ? completed.size / level.topics.length : 0;
          const isOpen = expandedLevel === li;
          const col = C[level.color] || C.blue;
          const isDone = pct === 1;

          return (
            <div key={li} className="rounded-2xl overflow-hidden transition-all"
              style={{ border: `1px solid ${isOpen ? col.border : 'rgba(255,255,255,0.05)'}`, opacity: isUnlocked ? 1 : 0.45 }}>
              {/* Level header */}
              <motion.button whileTap={{ scale: 0.99 }}
                onClick={() => { if (isUnlocked) { setExpandedLevel(isOpen ? -1 : li); setTopicLesson(null); } }}
                disabled={!isUnlocked}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                style={{ background: isOpen ? col.bg : 'rgba(17,24,39,0.6)' }}>
                <Ring done={completed.size} total={level.topics.length} color={level.color} size={40} strokeW={3.5}
                  label={isDone ? '✓' : `${Math.round(pct * 100)}%`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">
                      {!isUnlocked ? '🔒 ' : isDone ? '✅ ' : ''}{level.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: col.bg, color: col.hex, border: `1px solid ${col.border}` }}>
                      Sett. {level.weeks}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{completed.size}/{level.topics.length} completati</p>
                </div>
                <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
              </motion.button>

              {/* Topics */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                      {level.topics.map((topic, ti) => {
                        const isDoneT = completed.has(ti);
                        const isLoadingT = loadingTopic === topic;
                        const isShown = topicLesson?.topic === topic;
                        return (
                          <div key={ti}>
                            <div className="flex items-center gap-2.5">
                              <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTopic(li, ti)}
                                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                                style={isDoneT ? { background: col.hex, boxShadow: `0 0 8px ${col.glow}` } : { background: 'rgba(55,65,81,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {isDoneT && <span className="text-white text-[10px] font-black">✓</span>}
                              </motion.button>
                              <span className={`flex-1 text-xs ${isDoneT ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{topic}</span>
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => isShown ? setTopicLesson(null) : learnTopic(topic, level.label)}
                                disabled={isLoadingT}
                                className="w-8 h-7 rounded-lg text-xs transition-all disabled:opacity-40 flex items-center justify-center"
                                style={isShown ? { background: col.hex, color: '#fff' } : { background: 'rgba(55,65,81,0.5)', color: '#9ca3af' }}>
                                {isLoadingT ? '⏳' : '📖'}
                              </motion.button>
                            </div>
                            <AnimatePresence>
                              {isShown && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="mt-2 ml-7 p-3 rounded-xl"
                                  style={{ background: 'rgba(17,24,39,0.9)', border: `1px solid ${col.border}`, backdropFilter: 'blur(8px)' }}>
                                  <p className="text-xs font-mono mb-1.5" style={{ color: col.hex, opacity: 0.8 }}>🤖 {topicLesson.provider || 'AI'} — {topic}</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{topicLesson.content}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {/* Milestone */}
                      <div className="mt-2 px-3 py-2.5 rounded-xl flex items-center gap-2"
                        style={isDone ? { background: col.bg, border: `1px solid ${col.border}` } : { background: 'rgba(17,24,39,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className="text-sm">{isDone ? '🏆' : '🎯'}</span>
                        <p className="text-xs" style={{ color: isDone ? col.hex : '#6b7280' }}>
                          <span className="font-bold">Milestone: </span>{level.milestone}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Visual Live Coach ────────────────────────────────────────────────────
const ALL_DISCIPLINES = DISCIPLINE_GROUPS.flatMap((g) => g.items);
const isSparring = (id) => id.startsWith('sparring_') || id === 'partner_drills';

function VisualCoach() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('setup');
  const [sessionContext, setSessionContext] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [mode, setMode] = useState('muaythai');
  const [pastSessions, setPastSessions] = useState(() => loadSessions());
  const [rounds, setRounds] = useState(3);
  const [roundDuration, setRoundDuration] = useState(180);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [lastPoint, setLastPoint] = useState(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);
  const sessionStartRef = useRef(null);
  const analyzingRef = useRef(false);

  const speakCoach = useCallback((text) => {
    if (!voiceOn || !window.speechSynthesis) return;
    // Non cancellare se sta ancora parlando — aspetta la fine
    if (window.speechSynthesis.speaking) return;
    const clean = text
      .replace(/\*\*/g, '').replace(/[*#_~`]/g, '')
      .replace(/[🥊📐➡️⚠️⭐👁🔴🔵🏆💪🎯]/gu, '')
      .replace(/\n+/g, '. ')
      .trim();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'it-IT';
    utt.rate = 1.15;
    utt.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const itVoice = voices.find((v) => v.lang === 'it-IT' || v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    window.speechSynthesis.speak(utt);
  }, [voiceOn]);

  const timer = useRoundTimer({ rounds, roundDuration, restDuration: 60 });
  const currentDisc = ALL_DISCIPLINES.find((d) => d.id === mode) || ALL_DISCIPLINES[0];
  const isPartnerMode = isSparring(mode);

  const handleScore = useCallback((who, delta) => {
    setScore((s) => ({ ...s, [who]: Math.max(0, s[who] + delta) }));
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStreaming(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setStreaming(true);
      } catch (err) { alert('Camera non accessibile: ' + err.message); }
    }
  };

  const startSession = async () => {
    sessionStartRef.current = Date.now();
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('live'); setAnalysis(null);
    await startCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    timer.stop();
    if (analysis?.content) {
      const duration = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
      const updated = [{ date: new Date().toLocaleDateString('it-IT'), mode, context: sessionContext, keyFeedback: analysis.content.slice(0, 200), duration }, ...pastSessions].slice(0, 10);
      saveSessions(updated); setPastSessions(updated);
    }
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('setup');
    clearInterval(autoTimerRef.current);
  };

  const buildPrompt = useCallback((basePrompt) => {
    let p = basePrompt || '';
    if (sessionContext.trim()) p += `\n\nSESSIONE ATTUALE: ${sessionContext.trim()}`;
    if (pastSessions.length > 0)
      p += `\n\nSESSIONI PRECEDENTI:\n` + pastSessions.slice(0, 2).map((s) => `- ${s.date} (${s.mode}): ${s.context} → ${s.keyFeedback}`).join('\n');
    return p;
  }, [sessionContext, pastSessions]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    analyzingRef.current = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, prompt: buildPrompt(currentDisc?.prompt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
      speakCoach(data.content);
      if (isSparring(mode) && data.content) {
        const point = parsePoint(data.content);
        if (point) {
          setScore((s) => ({ ...s, [point]: s[point] + 1 }));
          setLastPoint(point);
          setTimeout(() => setLastPoint(null), 2500);
        }
      }
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally { setAnalyzing(false); analyzingRef.current = false; }
  }, [mode, buildPrompt, currentDisc, speakCoach]);

  useEffect(() => {
    if (autoMode && streaming) {
      captureAndAnalyze();
      autoTimerRef.current = setInterval(captureAndAnalyze, 4000);
    } else { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(13,148,136,0.08))', border: `1px solid ${C.emerald.border}` }}>
          <p className="text-xs font-black tracking-wide" style={{ color: C.emerald.hex }}>📷 VISUAL LIVE COACH</p>
          <p className="text-xs text-gray-500 mt-0.5">Llama Vision 90B · 13 discipline · Solo / Sparring / Drill</p>
        </div>

        {DISCIPLINE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-bold text-gray-600 mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((d) => {
                const isActive = mode === d.id;
                const isSpar = isSparring(d.id);
                const col = isSpar ? C.violet : C.emerald;
                return (
                  <motion.button key={d.id} whileTap={{ scale: 0.93 }} onClick={() => setMode(d.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={isActive
                      ? { background: col.hex, color: '#fff', boxShadow: `0 4px 12px ${col.glow}` }
                      : { background: 'rgba(55,65,81,0.35)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {d.emoji} {d.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {isPartnerMode && (
          <div className="p-3 rounded-xl" style={{ background: C.violet.bg, border: `1px solid ${C.violet.border}` }}>
            <p className="text-xs font-bold" style={{ color: C.violet.hex }}>👥 Modalità partner attiva</p>
            <p className="text-xs text-gray-500 mt-0.5">Inquadrate entrambi — l'AI arbitra e dà punti in tempo reale</p>
          </div>
        )}

        {isPartnerMode && (
          <RoundConfig rounds={rounds} onRounds={setRounds} roundDuration={roundDuration} onRoundDuration={setRoundDuration} />
        )}

        <div>
          <p className="text-xs text-gray-600 mb-1.5">Descrivi la sessione <span className="text-gray-700">(opzionale)</span></p>
          <textarea value={sessionContext} onChange={(e) => setSessionContext(e.target.value)} rows={2}
            placeholder={isPartnerMode ? 'Es. Io e mio fratello — focus combo leggero…' : `Es. ${currentDisc?.label} – tecnica base…`}
            className="w-full px-3 py-2.5 text-sm text-white placeholder-gray-700 resize-none focus:outline-none transition-all"
            style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }} />
        </div>

        {pastSessions.length > 0 && (
          <div>
            <p className="text-xs text-gray-600 mb-1.5">Sessioni recenti</p>
            <div className="space-y-1">
              {pastSessions.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => { setMode(s.mode); setSessionContext(s.context); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-400 transition-all hover:text-gray-200"
                  style={{ background: 'rgba(17,24,39,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-gray-600">{s.date} · {s.mode}</span>
                  {s.duration > 0 && <span className="text-gray-700"> · {s.duration}min</span>}
                  <span className="mx-1 text-gray-700">·</span>
                  {s.context.slice(0, 42)}{s.context.length > 42 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <motion.button whileTap={{ scale: 0.98 }} onClick={startSession}
          className="w-full py-3.5 rounded-2xl text-white font-black text-sm transition-all"
          style={isPartnerMode
            ? { background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 6px 20px ${C.violet.glow}` }
            : { background: `linear-gradient(135deg, ${C.emerald.hex}, #0d9488)`, boxShadow: `0 6px 20px ${C.emerald.glow}` }}>
          {isPartnerMode ? `👥 Inizia Match (${rounds}×${roundDuration/60}min)` : '📷 Inizia Sessione Live'}
        </motion.button>
      </div>
    );
  }

  // ── Live ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Session header */}
      <div className="px-4 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: isPartnerMode ? C.violet.bg : C.emerald.bg, border: `1px solid ${isPartnerMode ? C.violet.border : C.emerald.border}` }}>
        <span className="text-lg">{currentDisc?.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white">{currentDisc?.label}</p>
          {sessionContext && <p className="text-xs text-gray-500 truncate">{sessionContext}</p>}
        </div>
        {isPartnerMode && <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: C.violet.bg, color: C.violet.hex, border: `1px solid ${C.violet.border}` }}>👥 PARTNER</span>}
      </div>

      {/* Timer + Score */}
      {isPartnerMode && (
        <>
          {timer.phase === 'idle'
            ? <motion.button whileTap={{ scale: 0.97 }} onClick={timer.start}
                className="w-full py-3 rounded-2xl text-white font-black text-sm"
                style={{ background: `linear-gradient(135deg, ${C.red.hex}, #b91c1c)`, boxShadow: `0 6px 20px ${C.red.glow}` }}>
                🔔 Inizia Round 1
              </motion.button>
            : <RoundTimerDisplay timer={timer} roundDuration={roundDuration} restDuration={60} />
          }
          <ScoreTracker score={score} onScore={handleScore} lastPoint={lastPoint} />
        </>
      )}

      {/* Camera */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-60"
        style={{ border: analyzing ? `2px solid ${C.blue.hex}` : streaming ? `2px solid ${C.emerald.hex}` : '2px solid rgba(255,255,255,0.04)', boxShadow: analyzing ? `0 0 20px ${C.blue.glow}` : streaming ? `0 0 12px ${C.emerald.glow}` : 'none', transition: 'all 0.3s ease' }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {streaming && (
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold"
              style={{ background: 'rgba(16,185,129,0.2)', color: C.emerald.hex, border: `1px solid ${C.emerald.border}`, backdropFilter: 'blur(8px)' }}>● LIVE</span>
            {autoMode && <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold animate-pulse"
              style={{ background: 'rgba(249,115,22,0.2)', color: C.orange.hex, border: `1px solid ${C.orange.border}` }}>AUTO</span>}
          </div>
        )}
        {analyzing && (
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-center py-2"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(17,24,39,0.9)', border: `1px solid ${C.blue.border}` }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.blue.hex }} />
              <span className="text-xs font-bold" style={{ color: C.blue.hex }}>Analisi AI in corso…</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.96 }} onClick={captureAndAnalyze} disabled={analyzing}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-black transition-all disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 4px 14px ${C.violet.glow}` }}>
          🔍 Analizza
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => setAutoMode((v) => !v)}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-black transition-all"
          style={autoMode
            ? { background: `linear-gradient(135deg, ${C.orange.hex}, #b45309)`, boxShadow: `0 4px 14px ${C.orange.glow}` }
            : { background: 'rgba(55,65,81,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {autoMode ? '⏸ Stop' : '▶ Auto'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setVoiceOn((v) => !v); if (voiceOn) window.speechSynthesis?.cancel(); }}
          className="px-3 py-2.5 rounded-xl text-white font-black transition-all"
          style={voiceOn
            ? { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }
            : { background: 'rgba(55,65,81,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          🔊
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={stopCamera}
          className="px-4 py-2.5 rounded-xl text-white font-black transition-all"
          style={{ background: 'rgba(185,28,28,0.3)', border: `1px solid ${C.red.border}` }}>
          ✕
        </motion.button>
      </div>

      {/* Analysis result — sempre visibile, non esce mai finché la sessione è attiva */}
      <div className="p-4 rounded-2xl min-h-[80px] transition-all duration-300"
        style={{ background: 'rgba(17,24,39,0.85)', border: `1px solid ${analyzing ? C.violet.border : C.blue.border}`, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 mb-2">
          {analyzing
            ? <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.violet.hex }} />
            : <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.blue.hex }} />}
          <p className="text-xs font-mono" style={{ color: analyzing ? C.violet.hex : C.blue.hex, opacity: 0.7 }}>
            {analyzing ? 'Analisi in corso…' : `${analysis?.provider || 'AI'} · ${currentDisc?.label} · ${analysis?.time || ''}`}
          </p>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
          {analysis?.content || (analyzing ? '' : 'Premi Analizza o attiva Auto per iniziare.')}
        </p>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'trainer',    label: '🏅 PT',    color: C.amber   },
  { id: 'curriculum', label: '📚 Piano', color: C.violet  },
  { id: 'chat',       label: '💬 Chat',  color: C.blue    },
  { id: 'visual',     label: '📷 Live',  color: C.emerald },
];

export default function Coach() {
  const [tab, setTab] = useState('trainer');

  return (
    <div className="min-h-full text-white pb-8" style={{ background: '#030712' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="mb-3">
            <h1 className="text-lg font-black" style={{ background: 'linear-gradient(135deg, #fff 30%, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ AI Coach
            </h1>
            <p className="text-xs" style={{ color: '#4b5563' }}>Kimi K2.6 · Llama Vision 90B · NVIDIA NIM</p>
          </div>
          <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {TABS.map((t) => (
              <motion.button key={t.id} onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.95 }}
                className="flex-1 py-2 rounded-xl text-xs font-black transition-all"
                style={tab === t.id
                  ? { background: `linear-gradient(135deg, ${t.color.hex}, ${t.color.hex}cc)`, color: '#fff', boxShadow: `0 4px 12px ${t.color.glow}` }
                  : { color: '#6b7280' }}>
                {t.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}>
            {tab === 'trainer'    && <PersonalTrainer />}
            {tab === 'curriculum' && <CurriculumCoach />}
            {tab === 'chat'       && <CoachChat />}
            {tab === 'visual'     && <VisualCoach />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

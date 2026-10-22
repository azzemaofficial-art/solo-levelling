import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Camera, Check, Dumbbell, Flame, Pause, Play, SkipForward, Timer, Volume2, VolumeX, Wind, X, Zap } from 'lucide-react';
import { mmaStages } from '../data/mmaPath';
import { blockDone, pathSummary, planToday } from '../../lib/mmaFighterPath';

// L'allenamento di oggi e il percorso del combattente (lib/mmaFighterPath.js), nella pagina Accademia.
// Qui solo la vista: lo stato arriva già letto dai salvataggi veri (fighterState).

const say = (text, on = true) => {
  if (!on || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    const v = window.speechSynthesis.getVoices().find((x) => /^it/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* niente voce */ }
};
// iOS fa parlare la voce solo dopo un tocco: la "sblocchiamo" nel tocco che apre il blocco
const unlockVoice = () => { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* niente voce */ } };

const ICON = { guided: Flame, reflex: Zap, lesson: BookOpen, combo: Camera, rounds: Timer };

export function MmaTodayCard({ state, now, onOpen, onMinutes, onFreeze }) {
  const plan = planToday(state, { minutes: state.minutes, now });
  // prima apertura del giorno: le scelte di oggi si fissano (un blocco superato resta quello fatto)
  useEffect(() => { if (!plan.frozen) onFreeze?.(plan.picks); }, [plan.frozen]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = plan.blocks.map((b) => blockDone(b, state, now));
  const count = done.filter(Boolean).length;
  const next = done.indexOf(false);
  return <section className="mma-today" aria-labelledby="mma-today-title">
    <div className="mma-today-top"><small>ALLENAMENTO DI OGGI · TAPPA 0{plan.stage + 1}</small><span>{count}/{plan.blocks.length}</span></div>
    <h2 id="mma-today-title">{next < 0 ? 'Fatto. Ottimo lavoro.' : `${plan.minutes} minuti, in quest’ordine.`}</h2>
    <div className="mma-today-len" role="radiogroup" aria-label="Quanto tempo hai oggi">{[20, 40, 60].map((m) => <button key={m} role="radio" aria-checked={state.minutes === m} className={state.minutes === m ? 'active' : ''} onClick={() => onMinutes(m)}>{m} min</button>)}</div>
    <ol className="mma-today-blocks">{plan.blocks.map((b, i) => {
      const Icon = ICON[b.kind] || Flame;
      return <li key={b.id}><button className={`${done[i] ? 'done' : ''} ${i === next ? 'next' : ''}`} onClick={() => { unlockVoice(); onOpen(b); }}>
        <span className="mma-today-no">{done[i] ? <Check size={15} /> : <Icon size={15} />}</span>
        <span><b>{b.title}</b><small>{b.minutes} min · {b.why}</small></span>
        <ArrowRight size={15} />
      </button></li>;
    })}</ol>
    <p className="mma-today-gym"><Dumbbell size={15} />{plan.gymNote}</p>
  </section>;
}

const HOW = { camera: ['Camera', Camera], app: ['App', Timer], palestra: ['Palestra', Dumbbell] };

export function MmaFighterPath({ state, onToggleGym }) {
  const s = pathSummary(state);
  return <section className="mma-path" aria-labelledby="mma-path-title">
    <div className="cut-section-title mma-section-title"><span>PERCORSO DEL COMBATTENTE</span><span>{s.ready ? 'PRONTO' : `${s.done}/${s.gates.length}`}</span></div>
    <div className="mma-path-steps" aria-hidden="true">{mmaStages.map((st, i) => <span key={st.id} className={i < s.stage ? 'done' : i === s.stage ? 'now' : ''}>{st.name}</span>)}<span className={s.ready ? 'now' : ''}>Primo incontro</span></div>
    <h3 id="mma-path-title">{s.ready ? 'Pronto per il primo incontro' : `Tappa 0${s.stage + 1} · ${s.name}`}</h3>
    <p className="mma-path-time">{s.ready
      ? 'Tutte le prove fatte. Scegli la gara con il tuo istruttore: dilettanti, 3 round da 3 minuti con 1 minuto di pausa.'
      : `Di solito ${s.time} dall’inizio, con 2–3 allenamenti di palestra a settimana. Passi alla tappa dopo quando tutte le prove sono fatte.`}</p>
    {!s.ready && <ul className="mma-path-gates">{s.gates.map((g) => {
      const [label, Icon] = HOW[g.how];
      return <li key={g.id} className={g.done ? 'done' : ''}>
        <span className="mma-path-how"><Icon size={13} />{label}</span>
        <p>{g.text}{!g.done && g.need > 1 && <small> · {g.now}/{g.need}</small>}</p>
        {g.how === 'palestra'
          ? <button aria-pressed={g.done} aria-label={`${g.done ? 'Togli la spunta' : 'Segna fatto'}: ${g.text}`} onClick={() => onToggleGym(g.id)}>{g.done ? <Check size={14} /> : 'Fatto?'}</button>
          : g.done ? <Check size={16} className="mma-path-ok" /> : null}
      </li>;
    })}</ul>}
    <p className="mma-path-note">Le prove con camera e app si spuntano da sole, con i tuoi dati veri. Quelle di palestra le segni tu: la camera lì non c’è, sii onesto.</p>
    <details className="mma-path-safety"><summary>Prima di combattere: sicurezza</summary><ul>
      <li>Per l’MMA con colpi alla testa serve il certificato medico agonistico: visita di medicina dello sport, neurologo, otorino con esame dell’udito, elettroencefalogramma, oculista.</li>
      <li>Niente sparring per 30 giorni dopo un incontro fermato per colpi, 60 dopo un KO, 90 se hai perso conoscenza; poi si riprende a gradini, con l’ok del medico.</li>
      <li>Sparring con guantoni da 12–22 once e colpi leggeri: il caschetto evita i tagli, non le commozioni cerebrali.</li>
      <li>La prima gara arriva di solito dopo 2–3 anni, alla fine di un camp di 8–12 settimane con il tuo istruttore.</li>
    </ul></details>
  </section>;
}

// Riscaldamento e defaticamento guidati a voce, passo per passo; nel respiro 5-5 il cerchio si gonfia e sgonfia
export function MmaGuided({ block, onDone, onClose }) {
  const steps = block.steps;
  const [st, setSt] = useState({ i: 0, left: steps[0].sec, end: false });
  const [paused, setPaused] = useState(false);
  // voce sì/no: la stessa scelta del coach con la camera e dei riflessi
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem('shadow_monarch_coach_voice') !== '0'; } catch { return true; } });
  const toggleVoice = () => setVoice((v) => {
    try { localStorage.setItem('shadow_monarch_coach_voice', v ? '0' : '1'); } catch { /* storage */ }
    if (v) window.speechSynthesis?.cancel();
    return !v;
  });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const step = steps[st.i];
  const elapsed = step.sec - st.left;
  const breathIn = elapsed % 10 < 5;

  useEffect(() => {
    if (paused || st.end) return undefined;
    const id = setInterval(() => setSt((p) => (p.left > 1 ? { ...p, left: p.left - 1 }
      : p.i + 1 < steps.length ? { i: p.i + 1, left: steps[p.i + 1].sec, end: false } : { ...p, left: 0, end: true })), 1000);
    return () => clearInterval(id);
  }, [paused, st.end, steps]);
  useEffect(() => { say(steps[st.i].text, voice); }, [st.i, steps]);
  // nel respiro: dopo la spiegazione, "dentro" e "fuori" ogni 5 secondi
  useEffect(() => { if (step.breath && !paused && elapsed >= 10 && elapsed % 5 === 0) say(breathIn ? 'Dentro' : 'Fuori', voice); }, [elapsed, step.breath, breathIn, paused, voice]);
  // a fine guida la voce finisce la sua frase anche se la guida si chiude; si zittisce solo chiudendo prima
  const endedRef = useRef(false);
  useEffect(() => { if (st.end) { endedRef.current = true; say('Fatto. Bel lavoro.', voice); doneRef.current(); } }, [st.end]);
  useEffect(() => () => { if (!endedRef.current) window.speechSynthesis?.cancel(); }, []);

  const skip = () => setSt((p) => (p.i + 1 < steps.length ? { i: p.i + 1, left: steps[p.i + 1].sec, end: false } : { ...p, left: 0, end: true }));
  // portale su <body>: sopra la barra di navigazione dell'app (come il player delle combo)
  return createPortal(<div className="mma-guided" role="dialog" aria-modal="true" aria-labelledby="mma-guided-title">
    <header><small>{block.title.toUpperCase()} · {st.i + 1}/{steps.length}</small><span><button onClick={toggleVoice} aria-pressed={voice} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'}>{voice ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><button onClick={onClose} aria-label="Chiudi"><X size={20} /></button></span></header>
    <h2 id="mma-guided-title">{step.text}</h2>
    {step.breath
      ? <div className={`mma-guided-breath ${breathIn ? 'in' : 'out'}`} aria-live="polite"><Wind size={22} /><b>{breathIn ? 'Dentro' : 'Fuori'}</b><small>{5 - (elapsed % 5)}</small></div>
      : <strong className="mma-guided-clock" aria-live="off">{Math.floor(st.left / 60)}:{String(st.left % 60).padStart(2, '0')}</strong>}
    <div className="mma-guided-bar" aria-hidden="true"><span style={{ width: `${(elapsed / step.sec) * 100}%` }} /></div>
    <ol className="mma-guided-steps">{steps.map((x, i) => <li key={i} className={i < st.i ? 'done' : i === st.i ? 'now' : ''}>{x.text}</li>)}</ol>
    <div className="mma-guided-actions">
      <button onClick={() => setPaused((p) => !p)}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? 'Riprendi' : 'Pausa'}</button>
      <button onClick={skip}><SkipForward size={17} />Avanti</button>
    </div>
  </div>, document.body);
}

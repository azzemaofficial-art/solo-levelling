import React, { lazy, Suspense, useState } from 'react';
import { ArrowRight, Camera, Check, ChevronDown, Focus, Volume2 } from 'lucide-react';
import ProtocolIcon from './ProtocolIcon';
import { mmaLessons, mmaRoundPlans, mmaStages } from '../data/mmaPath';
import { readMmaStore } from '../../lib/mmaCoachStorage';
import '../styles/mma-pro.css';
const MmaProCoach = lazy(() => import('./MmaProCoach'));
const MmaComboLibrary = lazy(() => import('./MmaComboLibrary'));

const KEY = 'shadow_monarch_mma_academy_v1';
const read = readMmaStore;

export default function MmaAcademy({ onNavigate }) {
  const [studioOpen, setStudioOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [done, setDone] = useState(() => read().done || {});
  const [lessonId, setLessonId] = useState(() => read().lessonId || 'stance');
  const [stage, setStage] = useState(() => Math.max(0, Math.min(mmaStages.length - 1, Number(read().stage) || 0)));
  const store = read();
  const lastSession = store.lastSession;
  const history = (Array.isArray(store.history) ? store.history : []).filter(item => item.version === 2);
  const closeStudio = () => { setStudioOpen(false); setDone(read().done || {}); setRevision(value => value + 1); };
  const lesson = mmaLessons.find((item) => item.id === lessonId) || mmaLessons[0];
  const stageLessons = mmaLessons.filter((item) => item.stage === stage);
  const practiced = mmaLessons.filter((item) => done[item.id]).length;
  const persist = (patch) => localStorage.setItem(KEY, JSON.stringify({ ...read(), done, lessonId, stage, ...patch }));
  const chooseLesson = (id) => { setLessonId(id); persist({ lessonId: id }); };
  const chooseStage = (index) => {
    setStage(index);
    const first = mmaLessons.find((item) => item.stage === index);
    if (first) setLessonId(first.id);
    persist({ stage: index, lessonId: first?.id || lessonId });
  };
  const markPracticed = () => {
    const next = { ...done, [lesson.id]: !done[lesson.id] };
    setDone(next);
    persist({ done: next });
  };
  const openLive = () => setStudioOpen(true);
  const openFullCurriculum = () => {
    try { localStorage.setItem('shadow_monarch_coach_open_tab', 'curriculum'); } catch {}
    onNavigate('coach');
  };

  return <>
    {studioOpen && <Suspense fallback={<div className="mma-pro" role="status"><div className="mma-pro-shell"><p>Preparo il Coach Studio…</p></div></div>}><MmaProCoach lesson={lesson} onClose={closeStudio} /></Suspense>}
    <section className="cut-page-head mma-head"><span className="cut-kicker">ACCADEMIA / MMA</span><h1>Impara.<br /><em>Combatti meglio.</em></h1><p>Parti da zero. Una tecnica, un errore da correggere, una sessione alla volta.</p><img src="/avatar7.png" alt="" /></section>
    <button className="mma-studio-entry" onClick={openLive}><Camera size={25} /><div><small>COACH STUDIO / NUOVO</small><h2>Osserva. Prova. Migliora.</h2><p>Schema della tecnica, round guidati e feedback locale.</p></div><ArrowRight size={18} /></button>
    <div className="mma-signal"><div><small>IL TUO PERCORSO</small><strong>{practiced}/{mmaLessons.length}</strong><span>lezioni praticate</span></div><div className="mma-signal-mark"><ProtocolIcon name="mma" size={29} /></div></div>
    {lastSession && <section className="mma-last-session"><div><small>ULTIMA PRATICA</small><strong>{mmaLessons.find((item) => item.id === lastSession.lessonId)?.title || 'Lezione MMA'}</strong><span>{new Date(lastSession.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {lastSession.version === 2 ? `${lastSession.completed}/${lastSession.rounds} round` : `${lastSession.rounds || 3} round completati`}</span></div><div className="mma-last-score"><small>{lastSession.version === 2 ? 'TEMPO ATTIVO' : 'POSA MEDIA'}</small><strong>{lastSession.version === 2 ? `${Math.round(lastSession.activeMs / 60000)} min` : lastSession.score == null ? '—' : `${lastSession.score}%`}</strong></div></section>}
    {lastSession?.focus && <p className="mma-pro-recommendation"><strong>Da portare nella prossima seduta:</strong> {lastSession.focus}</p>}
    <div className="cut-section-title mma-section-title"><span>IL VIAGGIO</span><span>BASE → PRATICA</span></div>
    <div className="mma-stage-list">{mmaStages.map((item, index) => <button key={item.id} onClick={() => chooseStage(index)} className={`mma-stage ${stage === index ? 'active' : ''} mma-tone-${item.tone}`}><span className="mma-stage-no">0{index + 1}</span><span><small>{item.period}</small><b>{item.name}</b></span><ChevronDown size={16} /></button>)}</div>
    <p className="mma-stage-goal">{mmaStages[stage].objective}</p>
    <div className="cut-section-title mma-section-title"><span>LEZIONI / {mmaStages[stage].name.toUpperCase()}</span><span>{stageLessons.filter((item) => done[item.id]).length}/{stageLessons.length}</span></div>
    <div className="mma-lesson-list">{stageLessons.map((item, index) => <button key={item.id} className={`mma-lesson ${lesson.id === item.id ? 'active' : ''}`} onClick={() => chooseLesson(item.id)}><span className="mma-lesson-index">{done[item.id] ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span><span><b>{item.title}</b><small>{item.duration}</small></span><ArrowRight size={15} /></button>)}</div>
    <section className="mma-lesson-detail" key={lesson.id}><div className="mma-lesson-top"><span>LEZIONE ATTIVA</span><strong>{lesson.duration}</strong></div><h2>{lesson.title}</h2><div className="mma-focus"><Focus size={17} /><p>{lesson.focus}</p></div><div className="mma-detail-row"><small>DRILL</small><p>{lesson.drill}</p></div><div className="mma-detail-row"><small>LA CAMERA OSSERVA</small><p>{lesson.camera}</p></div><div className="mma-detail-row"><small>CORREZIONE CHIAVE</small><p>{lesson.watch}</p></div><div className="mma-round-plan"><small>PIANO ROUND</small>{mmaRoundPlans[lesson.id].map((cue, index) => <p key={index}><b>{String(index + 1).padStart(2, '0')}</b>{cue}</p>)}</div><button className="mma-live" onClick={openLive}><Camera size={19} /><span>Apri Coach Studio<small>Prepara la lezione e scegli come allenarti</small></span><ArrowRight size={18} /></button><button className="mma-practiced" onClick={markPracticed}>{done[lesson.id] ? <Check size={16} /> : <Volume2 size={16} />}{done[lesson.id] ? 'Lezione praticata' : 'Segna pratica completata'}</button></section>
    {history.length > 0 && <section className="mma-pro-history" key={revision}><h3>Il tuo diario tecnico</h3>{history.slice(0, 4).map(item => <div key={item.id}><span>{new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span><div><b>{mmaLessons.find(l => l.id === item.lessonId)?.title || 'Pratica MMA'}</b><small>{item.completed}/{item.rounds} round · {item.mode === 'camera' ? `${item.coverage}% osservato` : 'guida senza camera'}{item.selfCheck?.length ? ` · ${item.selfCheck.length}/3 controlli personali` : ''}</small></div></div>)}</section>}
    <Suspense fallback={<p className="cut-fine">Carico le combo…</p>}><MmaComboLibrary /></Suspense>
    <section className="cut-section mma-guidance"><div className="cut-section-title"><span>COME SI CRESCE</span></div><p>Due sedute di calcio e due di forza restano la base del cut. Usa il mercoledì per 15–25 minuti di MMA tecnica; nelle settimane pesanti, fai solo guardia e footwork o riposa.</p><p>La camera misura postura e movimenti visibili. Prese, contatto, timing con un avversario e sicurezza nel grappling richiedono un istruttore e un partner.</p><button onClick={openFullCurriculum}>Apri curriculum completo <ArrowRight size={16} /></button></section>
  </>;
}

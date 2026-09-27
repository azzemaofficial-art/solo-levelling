import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import ProtocolIcon from './ProtocolIcon';
import { TRAINING_LOG_EVENT, WORKOUT_KINDS, dateOfWeekday, deleteWorkout, localDateKey, logWorkout, readTrainingLog, trainingStats } from '../utils/trainingLog';

const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function useTrainingLog() {
  const [log, setLog] = useState(readTrainingLog);
  useEffect(() => {
    const refresh = () => setLog(readTrainingLog());
    window.addEventListener(TRAINING_LOG_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(TRAINING_LOG_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  return log;
}

// Settimana a pallini (lun → dom): un pallino colorato per ogni allenamento del giorno.
export function TrainingWeekDots({ log, compact = false }) {
  const today = localDateKey();
  return <div className={`tlog-week ${compact ? 'compact' : ''}`} role="list" aria-label="Allenamenti di questa settimana">
    {DAY_LETTERS.map((letter, index) => {
      const date = dateOfWeekday(index);
      const items = log.filter((e) => e.date === date);
      return <div key={date} role="listitem" className={`tlog-day ${date === today ? 'today' : ''} ${items.length ? 'on' : ''}`} aria-label={`${letter}: ${items.length ? items.map((e) => e.title).join(', ') : 'nessun allenamento'}`}>
        <span className="tlog-dots">{items.length ? items.slice(0, 3).map((e) => <i key={e.id} style={{ background: WORKOUT_KINDS[e.kind]?.color }} />) : <i className="empty" />}</span>
        <small>{letter}</small>
      </div>;
    })}
  </div>;
}

const formatDay = (date) => {
  const today = localDateKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (date === today) return 'Oggi';
  if (date === localDateKey(y)) return 'Ieri';
  return new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Diario completo (pagina Progressi): riepilogo, settimana, aggiunta manuale, storico.
export default function TrainingLog() {
  const log = useTrainingLog();
  const stats = trainingStats(log);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('strength');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [when, setWhen] = useState('today');
  const [showAll, setShowAll] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    const d = new Date(); if (when === 'yesterday') d.setDate(d.getDate() - 1);
    logWorkout({ date: localDateKey(d), kind, title: title.trim() || WORKOUT_KINDS[kind].label, minutes, source: 'manual' });
    setTitle(''); setMinutes(''); setAdding(false);
  };

  const visible = showAll ? log : log.slice(0, 12);
  let lastDate = null;

  return <section className="cut-section tlog">
    <div className="cut-section-title"><span>DIARIO ALLENAMENTI</span><button type="button" onClick={() => setAdding((v) => !v)}>{adding ? 'Chiudi' : <><Plus size={15} /> Aggiungi</>}</button></div>
    <div className="tlog-stats">
      <div><b>{stats.thisWeek.length}</b><small>questa settimana</small></div>
      <div><b>{stats.month.length}</b><small>questo mese</small></div>
      <div><b>{stats.streak}</b><small>{stats.streak === 1 ? 'settimana attiva' : 'settimane attive'} di fila</small></div>
    </div>
    <TrainingWeekDots log={log} />
    {stats.minutes > 0 && <p className="cut-fine">{Math.round(stats.minutes / 60 * 10) / 10} ore di allenamento questo mese. Una settimana è "attiva" con almeno 3 allenamenti.</p>}

    {adding && <form className="tlog-form" onSubmit={submit}>
      <div className="tlog-kinds" role="radiogroup" aria-label="Tipo di allenamento">{Object.entries(WORKOUT_KINDS).map(([id, k]) => <button type="button" role="radio" aria-checked={kind === id} key={id} className={kind === id ? 'active' : ''} style={{ '--tone': k.color }} onClick={() => setKind(id)}><ProtocolIcon name={k.icon} size={18} />{k.label}</button>)}</div>
      <label>Cosa hai fatto <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`es. ${kind === 'cardio' ? 'Corsa 5 km' : kind === 'football' ? 'Calcetto con amici' : kind === 'mma' ? 'Sacco 3 round' : 'Palestra'}`} maxLength={80} /></label>
      <div className="tlog-row">
        <label>Minuti <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} placeholder="45" /></label>
        <div className="tlog-when" role="radiogroup" aria-label="Quando">{[['today', 'Oggi'], ['yesterday', 'Ieri']].map(([id, label]) => <button type="button" role="radio" aria-checked={when === id} key={id} className={when === id ? 'active' : ''} onClick={() => setWhen(id)}>{label}</button>)}</div>
      </div>
      <button className="cut-primary" type="submit">Segna come fatto <Plus size={17} /></button>
    </form>}

    {log.length === 0 ? <p className="tlog-empty">Ancora nessun allenamento. Quando premi <b>Segna come completata</b> in Training, <b>Fatto</b> su una lezione o combo MMA, o <b>✅</b> su Telegram, compare qui con la data.</p>
      : <ul className="tlog-list">{visible.map((e) => {
        const header = e.date !== lastDate ? formatDay(e.date) : null; lastDate = e.date;
        const k = WORKOUT_KINDS[e.kind] || WORKOUT_KINDS.other;
        return <React.Fragment key={e.id}>
          {header && <li className="tlog-date">{header}</li>}
          <li className="tlog-item" style={{ '--tone': k.color }}>
            <span className="tlog-icon"><ProtocolIcon name={k.icon} size={20} /></span>
            <span className="tlog-text"><b>{e.title}</b><small>{k.label}{e.minutes ? ` · ${e.minutes} min` : ''}{e.source === 'telegram' ? ' · da Telegram' : e.source === 'manual' ? ' · aggiunto a mano' : ''}</small></span>
            <button type="button" className="tlog-del" onClick={() => deleteWorkout(e.id)} aria-label={`Elimina ${e.title}`}><X size={16} /></button>
          </li>
        </React.Fragment>;
      })}</ul>}
    {log.length > 12 && <button type="button" className="cut-secondary" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Mostra meno' : `Mostra tutti (${log.length})`}</button>}
  </section>;
}

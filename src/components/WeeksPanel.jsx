import React, { useState } from 'react';
import { WORKOUT_KINDS, durationMinutes, localDateKey } from '../utils/trainingLog';
import { PLAN_WEEKS, estimateStrength, weekDates, weekRangeLabel } from '../utils/planWeeks';

const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const isRest = (s) => s.duration === '—';
const doneIn = (log, dates) => log.filter((e) => dates.includes(e.date));

// Home: a che settimana siamo, giorno per giorno (fatto / oggi / saltato), e l'avviso della sera prima.
export function ThisWeekCard({ log, days, week, start, onOpen }) {
  const dates = weekDates(week, start);
  const today = localDateKey();
  const done = doneIn(log, dates);
  const planned = days.filter((s) => !isRest(s) && s.type !== 'optional').length;
  const doneDays = dates.filter((d) => log.some((e) => e.date === d)).length;
  const t = new Date(); const tomorrow = days[(((t.getDay() + 6) % 7) + 1) % 7];
  const mins = durationMinutes(tomorrow.duration) || 0;
  const eveningHeads = mins >= 35 && !isRest(tomorrow) && tomorrow.type !== 'optional';
  return <section className="wk-card">
    <button type="button" className="wk-head" onClick={onOpen}><span><small>SETTIMANA</small><b>{week + 1}<i> / {PLAN_WEEKS}</i></b></span><em>{weekRangeLabel(week, start)}</em></button>
    <div className="wk-days" role="list">{days.map((s, i) => {
      const items = log.filter((e) => e.date === dates[i]);
      const state = items.length ? 'done' : dates[i] === today ? 'today' : isRest(s) ? 'rest' : dates[i] < today && s.type !== 'optional' ? 'missed' : 'todo';
      return <div role="listitem" key={dates[i]} className={`wk-day ${state} ${dates[i] === today ? 'now' : ''}`} aria-label={`${s.day}: ${s.short}, ${state === 'done' ? 'fatto' : state === 'missed' ? 'saltato' : 'da fare'}`}>
        <span>{items.length ? '✓' : isRest(s) ? '·' : LETTERS[i]}</span><small>{s.short.split(' ')[0]}</small>
      </div>;
    })}</div>
    <p className="cut-fine">{doneDays} giorni con allenamento · {planned} sedute previste · {done.reduce((n, e) => n + (e.minutes || 0), 0)} min totali</p>
    {done.length > 0 && <ul className="wk-list">{done.map((e) => <li key={e.id} style={{ '--tone': (WORKOUT_KINDS[e.kind] || WORKOUT_KINDS.other).color }}><b>{e.title}</b><small>{new Date(`${e.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}{e.minutes ? ` · ${e.minutes} min` : ''}</small></li>)}</ul>}
    {eveningHeads && <p className="wk-alert">🌙 <b>Stasera prepara domani:</b> {tomorrow.short} dura {tomorrow.duration}. Borsa pronta, acqua, sveglia: così domani parti subito.</p>}
  </section>;
}

const Line = ({ points, color, w = 300, h = 90, unit }) => {
  const ok = points.filter((p) => p.v != null);
  if (ok.length < 2) return <p className="cut-fine">Servono almeno due misure (trazioni o piegamenti + peso) per vedere la linea.</p>;
  const lo = Math.min(...ok.map((p) => p.v)); const hi = Math.max(...ok.map((p) => p.v)); const span = hi - lo || 1;
  const xy = (p, i) => `${(i / (ok.length - 1)) * (w - 20) + 10},${h - 12 - ((p.v - lo) / span) * (h - 28)}`;
  return <svg viewBox={`0 0 ${w} ${h}`} className="wk-line" role="img" aria-label={`da ${ok[0].v} a ${ok[ok.length - 1].v} ${unit}`}>
    <polyline fill="none" stroke={color} strokeWidth="2.5" points={ok.map(xy).join(' ')} />
    {ok.map((p, i) => <circle key={p.date} cx={xy(p, i).split(',')[0]} cy={xy(p, i).split(',')[1]} r="3.5" fill={color} />)}
    <text x="10" y="10" fontSize="10" fill="currentColor">{hi} {unit}</text><text x="10" y={h - 1} fontSize="10" fill="currentColor">{lo} {unit}</text>
  </svg>;
};

// Progressi: barre di tutte le 16 settimane (tocca per aprirne una) + forza stimata.
export function WeeksHistory({ log, progress, start, currentWeek }) {
  const [open, setOpen] = useState(currentWeek);
  const weeks = Array.from({ length: PLAN_WEEKS }, (_, w) => { const items = doneIn(log, weekDates(w, start)); return { w, items, mins: items.reduce((n, e) => n + (e.minutes || 0), 0) }; });
  const max = Math.max(3, ...weeks.map((x) => x.items.length));
  let bw = null;
  const pts = (progress || []).map((e) => { if (e.weight) bw = e.weight; return { date: e.date, ...estimateStrength(e, bw), load: e.load }; });
  const pull = pts.map((p) => ({ date: p.date, v: p.pull })); const push = pts.map((p) => ({ date: p.date, v: p.push }));
  const load = pts.map((p) => ({ date: p.date, v: p.load || null }));
  const sel = weeks[open];
  return <section className="cut-section wk-history">
    <div className="cut-section-title"><span>STORICO PER SETTIMANA</span></div>
    <div className="wk-bars" role="list">{weeks.map(({ w, items }) => <button type="button" role="listitem" key={w} className={`${w === open ? 'sel' : ''} ${w === currentWeek ? 'cur' : ''} ${w > currentWeek ? 'future' : ''}`} onClick={() => setOpen(w)} aria-label={`Settimana ${w + 1}: ${items.length} allenamenti`}>
      <i style={{ height: `${Math.max(4, (items.length / max) * 100)}%` }} /><small>{w + 1}</small></button>)}</div>
    <p className="cut-fine"><b>Settimana {open + 1}</b> · {weekRangeLabel(open, start)} · {sel.items.length} allenamenti, {sel.mins} min{open === currentWeek ? ' · questa è la settimana in corso' : ''}</p>
    {sel.items.length ? <ul className="wk-list">{sel.items.slice().reverse().map((e) => <li key={e.id} style={{ '--tone': (WORKOUT_KINDS[e.kind] || WORKOUT_KINDS.other).color }}><b>{e.title}</b><small>{new Date(`${e.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}{e.minutes ? ` · ${e.minutes} min` : ''}</small></li>)}</ul> : <p className="cut-fine">Nessun allenamento segnato in questa settimana.</p>}
    <div className="cut-section-title"><span>FORZA STIMATA</span></div>
    <p className="cut-fine">Dalle misure che inserisci (trazioni, piegamenti e peso). Formula di Epley: è una stima, non un test del massimale.</p>
    <small className="wk-cap">Trazioni · kg totali stimati</small><Line points={pull} color="#ffd184" unit="kg" />
    <small className="wk-cap">Piegamenti · kg stimati</small><Line points={push} color="#6de2d3" unit="kg" />
    <small className="wk-cap">Carico usato · kg</small><Line points={load} color="#b8a4ff" unit="kg" />
  </section>;
}

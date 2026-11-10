import React, { useState } from 'react';
import { ArrowRight, Check, Moon, X } from 'lucide-react';
import { WORKOUT_KINDS, durationMinutes, localDateKey } from '../utils/trainingLog';
import { PLAN_WEEKS, estimateStrength, weekDates, weekRangeLabel } from '../utils/planWeeks';

const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const isRest = (s) => s.duration === '—';
const doneIn = (log, dates) => log.filter((e) => dates.includes(e.date));

// Home: a che settimana siamo, i 7 giorni (fatto / oggi / saltato) e l'avviso della sera prima.
export function ThisWeekCard({ log, days, week, start, onOpen }) {
  const dates = weekDates(week, start);
  const today = localDateKey();
  const todayIndex = Math.max(0, dates.indexOf(today));
  const [pick, setPick] = useState(todayIndex);
  const done = doneIn(log, dates);
  const counted = (s) => !isRest(s) && s.type !== 'optional';
  const planned = days.filter(counted).length;
  const doneSessions = days.filter((s, i) => counted(s) && log.some((e) => e.date === dates[i])).length;
  const minutes = done.reduce((n, e) => n + (e.minutes || 0), 0);
  const tomorrow = days[(todayIndex + 1) % 7];
  const prepTonight = (durationMinutes(tomorrow.duration) || 0) >= 35 && counted(tomorrow);
  const stateOf = (s, i) => (log.some((e) => e.date === dates[i]) ? 'done' : isRest(s) ? 'rest' : dates[i] < today && s.type !== 'optional' ? 'missed' : 'todo');
  const picked = days[pick]; const pickedState = stateOf(picked, pick);
  const pickedItems = log.filter((e) => e.date === dates[pick]);
  return <section className="cut-section">
    <div className="cut-section-title"><span>LA TUA SETTIMANA</span><button onClick={onOpen}>Storico <ArrowRight size={15} /></button></div>
    <div className="wk-card">
      <div className="wk-top">
        <div><small>SETTIMANA · {weekRangeLabel(week, start).toUpperCase()}</small><b>{week + 1}<span>/{PLAN_WEEKS}</span></b></div>
        <div className="wk-score"><small>SEDUTE</small><b>{doneSessions}<span>/{planned}</span></b><em>{minutes} min</em></div>
      </div>
      <div className="wk-track" aria-hidden="true">{Array.from({ length: PLAN_WEEKS }, (_, w) => <i key={w} className={w < week ? 'past' : w === week ? 'now' : ''} />)}</div>
      <div className="wk-days" role="tablist" aria-label="Giorni della settimana">{days.map((s, i) => {
        const state = stateOf(s, i);
        return <button type="button" role="tab" aria-selected={pick === i} key={dates[i]} onClick={() => setPick(i)} className={`wk-day ${state} ${dates[i] === today ? 'now' : ''} ${pick === i ? 'sel' : ''}`} aria-label={`${s.day} ${Number(dates[i].slice(8))}: ${s.short}`}>
          <small>{LETTERS[i]}</small><span>{state === 'done' ? <Check size={15} strokeWidth={3} /> : state === 'rest' ? '' : state === 'missed' ? <X size={13} strokeWidth={3} /> : null}</span><em>{Number(dates[i].slice(8))}</em>
        </button>;
      })}</div>
      <div className={`wk-detail ${pickedState}`}>
        <small>{dates[pick] === today ? 'OGGI' : picked.day.toUpperCase()}{picked.duration !== '—' ? ` · ${picked.duration}` : ''}</small>
        <b>{picked.short}</b>
        <p>{pickedItems.length ? `Fatto: ${pickedItems.map((e) => `${e.title}${e.minutes ? ` (${e.minutes} min)` : ''}`).join(', ')}` : pickedState === 'missed' ? 'Non segnato. Si recupera venerdì.' : pickedState === 'rest' ? 'Riposo: fa parte del piano.' : 'Da fare.'}</p>
      </div>
    </div>
    {prepTonight && <div className="wk-alert"><span><Moon size={18} /></span><div><small>STASERA, PER DOMANI</small><b>{tomorrow.short} · {tomorrow.duration}</b><p>Seduta lunga: prepara borsa e acqua stasera e vai a letto in orario. Domani parti subito.</p></div></div>}
  </section>;
}

// Linea minima in SVG; il colore arriva dal CSS (--tone) così segue il tema della vista.
const Line = ({ points, w = 300, h = 70 }) => {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.v); const lo = Math.min(...vals); const span = Math.max(...vals) - lo || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (w - 12) + 6, h - 8 - ((p.v - lo) / span) * (h - 16)]);
  const d = xy.map(([x, y]) => `${x},${y}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="wk-line" aria-hidden="true">
    <polygon points={`${xy[0][0]},${h} ${d} ${xy[xy.length - 1][0]},${h}`} className="wk-area" />
    <polyline points={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    {xy.map(([x, y], i) => <circle key={points[i].date} cx={x} cy={y} r={i === xy.length - 1 ? 4.5 : 3} />)}
  </svg>;
};

// Progressi: barre di tutte le 16 settimane (tocca per aprirne una) + forza stimata.
export function WeeksHistory({ log, start, currentWeek }) {
  const [open, setOpen] = useState(currentWeek);
  const weeks = Array.from({ length: PLAN_WEEKS }, (_, w) => { const items = doneIn(log, weekDates(w, start)); return { w, items, mins: items.reduce((n, e) => n + (e.minutes || 0), 0) }; });
  const max = Math.max(3, ...weeks.map((x) => x.items.length));
  const sel = weeks[open];
  return <section className="cut-section wk-history">
    <div className="cut-section-title"><span>STORICO PER SETTIMANA</span></div>
    <div className="wk-bars" role="list">{weeks.map(({ w, items }) => <button type="button" role="listitem" key={w} className={`${w === open ? 'sel' : ''} ${w === currentWeek ? 'cur' : ''} ${w > currentWeek ? 'future' : ''}`} onClick={() => setOpen(w)} aria-label={`Settimana ${w + 1}: ${items.length} allenamenti`}>
      <i style={{ height: `${Math.max(4, (items.length / max) * 100)}%` }} /><small>{w + 1}</small></button>)}</div>
    <p className="cut-fine"><b>Settimana {open + 1}</b> · {weekRangeLabel(open, start)} · {sel.items.length} allenamenti, {sel.mins} min{open === currentWeek ? ' · questa è la settimana in corso' : ''}</p>
    {sel.items.length ? <ul className="wk-list">{sel.items.slice().reverse().map((e) => <li key={e.id} style={{ '--tone': (WORKOUT_KINDS[e.kind] || WORKOUT_KINDS.other).color }}><b>{e.title}</b><small>{new Date(`${e.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}{e.minutes ? ` · ${e.minutes} min` : ''}</small></li>)}</ul> : <p className="cut-fine">Nessun allenamento segnato in questa settimana.</p>}
  </section>;
}

// Scheda Forza: stima dalle misure (trazioni, piegamenti, peso, carico).
export function StrengthPanel({ progress, onAddMeasure }) {
  let bw = null;
  const pts = (progress || []).map((e) => { if (e.weight) bw = e.weight; return { date: e.date, ...estimateStrength(e, bw), load: e.load || null }; });
  const metrics = [
    { id: 'pull', label: 'TRAZIONI', hint: 'kg totali stimati, corpo compreso', tone: 'var(--lime)' },
    { id: 'push', label: 'PIEGAMENTI', hint: 'kg stimati (≈ 64% del peso)', tone: 'var(--accent-2)' },
    { id: 'load', label: 'CARICO USATO', hint: 'kg che hai segnato', tone: 'var(--accent-3)' },
  ].map((m) => ({ ...m, points: pts.filter((p) => p[m.id] != null).map((p) => ({ date: p.date, v: p[m.id] })) })).filter((m) => m.points.length);
  return <section className="cut-section">
    <div className="cut-section-title"><span>FORZA STIMATA</span></div>
    {metrics.length ? metrics.map((m) => {
      const first = m.points[0].v; const last = m.points[m.points.length - 1].v; const diff = last - first;
      return <div className="wk-metric" key={m.id} style={{ '--tone': m.tone }}>
        <div><small>{m.label}</small><b>{last}<span> kg</span></b><em>{m.points.length > 1 ? `${diff >= 0 ? '+' : ''}${diff} kg dalla prima misura` : 'prima misura: serve la seconda per la linea'}</em></div>
        <Line points={m.points} />
        <p>{m.hint}</p>
      </div>;
    }) : <div className="wk-metric wk-empty"><small>NESSUNA MISURA DI FORZA</small><b>Segna trazioni e piegamenti</b><p>Con il peso del mattino calcolo quanto sei forte e come cresci, settimana dopo settimana.</p></div>}
    <p className="cut-fine">Formula di Epley: peso × (1 + ripetizioni / 30). È una stima, non un test del massimale.</p>
    <button type="button" className="cut-secondary" onClick={onAddMeasure}>Inserisci una misura <ArrowRight size={16} /></button>
  </section>;
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Scheda Anno: tutto il percorso, dalla settimana 1 a oggi.
export function YearStats({ log, progress, start, currentWeek }) {
  const first = localDateKey(start);
  const mine = log.filter((e) => e.date >= first);
  const perWeek = Array.from({ length: currentWeek + 1 }, (_, w) => doneIn(mine, weekDates(w, start)).length);
  const active = perWeek.filter((n) => n >= 3).length;
  const best = Math.max(0, ...perWeek);
  let run = 0; let streak = 0;
  perWeek.forEach((n) => { run = n >= 3 ? run + 1 : 0; streak = Math.max(streak, run); });
  const hours = Math.round(mine.reduce((n, e) => n + (e.minutes || 0), 0) / 6) / 10;
  const months = {};
  mine.forEach((e) => { const k = e.date.slice(0, 7); months[k] = (months[k] || 0) + 1; });
  // tutti i mesi del piano (anche vuoti), dalla settimana 1 alla 16
  const keys = [...new Set(Array.from({ length: PLAN_WEEKS * 7 }, (_, d) => localDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + d)).slice(0, 7)))];
  const mMax = Math.max(1, ...Object.values(months));
  const kinds = Object.entries(WORKOUT_KINDS).map(([id, k]) => ({ ...k, n: mine.filter((e) => e.kind === id).length })).filter((k) => k.n);
  const weights = (progress || []).filter((e) => e.weight);
  const rec = (key) => Math.max(0, ...(progress || []).map((e) => e[key] || 0));
  const stat = (n, label) => <div><b>{n}</b><small>{label}</small></div>;
  return <section className="cut-section wk-year">
    <div className="cut-section-title"><span>IL TUO PERCORSO · SETTIMANA {currentWeek + 1} / {PLAN_WEEKS}</span></div>
    <div className="tlog-stats">{stat(mine.length, 'allenamenti')}{stat(hours, 'ore totali')}{stat(active, 'settimane attive')}</div>
    <div className="tlog-stats">{stat(best, 'record in una settimana')}{stat(streak, 'settimane attive di fila')}{stat(weights.length > 1 ? `${(weights[weights.length - 1].weight - weights[0].weight > 0 ? '+' : '')}${(weights[weights.length - 1].weight - weights[0].weight).toFixed(1).replace('.', ',')}` : '—', 'kg dal primo peso')}</div>
    <div className="cut-section-title"><span>ALLENAMENTI PER MESE</span></div>
    <div className="wk-months">{keys.map((k) => <div key={k} className={months[k] ? '' : 'empty'}><b>{months[k] || 0}</b><i style={{ height: `${((months[k] || 0) / mMax) * 100}%` }} /><small>{MONTHS[Number(k.slice(5)) - 1]}</small></div>)}</div>
    {kinds.length > 0 && <><div className="cut-section-title"><span>COSA HAI ALLENATO</span></div><ul className="wk-list">{kinds.map((k) => <li key={k.label} style={{ '--tone': k.color }}><b>{k.label}</b><small>{k.n}</small></li>)}</ul></>}
    <div className="cut-section-title"><span>RECORD</span></div>
    <div className="tlog-stats">{stat(rec('pullups') || '—', 'trazioni')}{stat(rec('pushups') || '—', 'piegamenti')}{stat(rec('load') ? `${rec('load')} kg` : '—', 'carico')}</div>
  </section>;
}

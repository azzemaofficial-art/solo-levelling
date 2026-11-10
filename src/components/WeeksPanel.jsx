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
  const pts = (progress || []).map((e) => { if (e.weight) bw = e.weight; return { date: e.date, ...estimateStrength(e, bw), load: e.load }; });
  const pull = pts.map((p) => ({ date: p.date, v: p.pull })); const push = pts.map((p) => ({ date: p.date, v: p.push }));
  const load = pts.map((p) => ({ date: p.date, v: p.load || null }));
  return <section className="cut-section wk-history">
    <div className="cut-section-title"><span>FORZA STIMATA</span></div>
    <p className="cut-fine">Dalle misure che inserisci (trazioni, piegamenti e peso). Formula di Epley: è una stima, non un test del massimale.</p>
    <small className="wk-cap">Trazioni · kg totali stimati</small><Line points={pull} color="#ffd184" unit="kg" />
    <small className="wk-cap">Piegamenti · kg stimati</small><Line points={push} color="#6de2d3" unit="kg" />
    <small className="wk-cap">Carico usato · kg</small><Line points={load} color="#b8a4ff" unit="kg" />
    <button type="button" className="cut-secondary" onClick={onAddMeasure}>Inserisci una misura</button>
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
  const keys = Object.keys(months).sort(); const mMax = Math.max(1, ...Object.values(months));
  const kinds = Object.entries(WORKOUT_KINDS).map(([id, k]) => ({ ...k, n: mine.filter((e) => e.kind === id).length })).filter((k) => k.n);
  const weights = (progress || []).filter((e) => e.weight);
  const rec = (key) => Math.max(0, ...(progress || []).map((e) => e[key] || 0));
  const stat = (n, label) => <div><b>{n}</b><small>{label}</small></div>;
  return <section className="cut-section wk-year">
    <div className="cut-section-title"><span>IL TUO PERCORSO · SETTIMANA {currentWeek + 1} / {PLAN_WEEKS}</span></div>
    <div className="tlog-stats">{stat(mine.length, 'allenamenti')}{stat(hours, 'ore totali')}{stat(active, 'settimane attive')}</div>
    <div className="tlog-stats">{stat(best, 'record in una settimana')}{stat(streak, 'settimane attive di fila')}{stat(weights.length > 1 ? `${(weights[weights.length - 1].weight - weights[0].weight > 0 ? '+' : '')}${(weights[weights.length - 1].weight - weights[0].weight).toFixed(1).replace('.', ',')}` : '—', 'kg dal primo peso')}</div>
    <div className="cut-section-title"><span>ALLENAMENTI PER MESE</span></div>
    {keys.length ? <div className="wk-months">{keys.map((k) => <div key={k}><i style={{ height: `${(months[k] / mMax) * 100}%` }} /><b>{months[k]}</b><small>{MONTHS[Number(k.slice(5)) - 1]}</small></div>)}</div> : <p className="cut-fine">Ancora nessun allenamento segnato.</p>}
    {kinds.length > 0 && <><div className="cut-section-title"><span>COSA HAI ALLENATO</span></div><ul className="wk-list">{kinds.map((k) => <li key={k.label} style={{ '--tone': k.color }}><b>{k.label}</b><small>{k.n}</small></li>)}</ul></>}
    <div className="cut-section-title"><span>RECORD</span></div>
    <div className="tlog-stats">{stat(rec('pullups') || '—', 'trazioni')}{stat(rec('pushups') || '—', 'piegamenti')}{stat(rec('load') ? `${rec('load')} kg` : '—', 'carico')}</div>
  </section>;
}

import React, { useId, useMemo } from 'react';

// Andamento del peso in SVG puro: il Cut è la home, recharts (~280KB) qui
// peserebbe su ogni apertura. Punti = pesate, linea = media mobile 7 giorni
// (è la tendenza che conta, non la singola pesata), tratteggio = obiettivo.
const W = 350;
const H = 170;
const PAD = { top: 16, right: 12, bottom: 24, left: 34 };
const DAY = 86400000;

const toTime = (date) => new Date(`${date}T12:00:00`).getTime();
const fmt = (value) => value.toLocaleString('it-IT', { maximumFractionDigits: 1 });

export function weightSeries(progress) {
  // Un valore per giorno (l'ultima pesata), in ordine di data.
  const byDay = new Map();
  progress.forEach((entry) => { if (entry?.weight > 0 && entry.date) byDay.set(entry.date, Number(entry.weight)); });
  const points = [...byDay.entries()].map(([date, weight]) => ({ date, t: toTime(date), weight })).sort((a, b) => a.t - b.t);
  return points.map((point) => {
    const recent = points.filter((other) => other.t <= point.t && other.t > point.t - 7 * DAY);
    return { ...point, avg: recent.reduce((sum, other) => sum + other.weight, 0) / recent.length };
  });
}

export default function WeightTrend({ progress = [], startWeight, targetWeight }) {
  const gradientId = useId().replace(/:/g, '');
  const series = useMemo(() => weightSeries(progress), [progress]);

  if (series.length < 2) {
    return <div className="cut-trend-empty">
      <svg viewBox="0 0 120 40" aria-hidden="true"><path d="M4 30 C 30 26, 40 12, 62 18 S 100 8, 116 6" /></svg>
      <p>{series.length ? 'Ancora una pesata e compare la tua curva.' : 'Registra due pesate del mattino e qui compare la tua curva.'}</p>
    </div>;
  }

  const weights = series.map((p) => p.weight).concat([targetWeight, startWeight].filter((v) => v > 0));
  const min = Math.floor(Math.min(...weights) - 0.5);
  const max = Math.ceil(Math.max(...weights) + 0.5);
  const t0 = series[0].t;
  const t1 = Math.max(series[series.length - 1].t, t0 + DAY);
  const x = (t) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (kg) => PAD.top + ((max - kg) / (max - min)) * (H - PAD.top - PAD.bottom);
  const avgPath = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(' ');
  const areaPath = `${avgPath} L${x(series[series.length - 1].t).toFixed(1)} ${H - PAD.bottom} L${x(t0).toFixed(1)} ${H - PAD.bottom} Z`;
  const latest = series[series.length - 1];
  const delta = latest.avg - (startWeight || series[0].weight);
  const ticks = [max, (max + min) / 2, min];
  const label = (p) => new Date(p.t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  return <figure className="cut-trend">
    <figcaption>
      <span><small>MEDIA 7 GIORNI</small><b>{fmt(latest.avg)} kg</b></span>
      <span className={delta <= 0 ? 'down' : 'up'}><small>DALL'INIZIO</small><b>{delta > 0 ? '+' : ''}{fmt(delta)} kg</b></span>
    </figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Media del peso: ${fmt(latest.avg)} kg, obiettivo ${fmt(targetWeight)} kg`}>
      <defs>
        <linearGradient id={`line-${gradientId}`} x1="0" x2="1"><stop offset="0" stopColor="var(--lime)" /><stop offset="1" stopColor="var(--accent-2)" /></linearGradient>
        <linearGradient id={`area-${gradientId}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--lime)" stopOpacity=".28" /><stop offset="1" stopColor="var(--lime)" stopOpacity="0" /></linearGradient>
      </defs>
      {ticks.map((kg) => <g key={kg} className="cut-trend-grid"><line x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)} /><text x={PAD.left - 6} y={y(kg) + 3}>{fmt(kg)}</text></g>)}
      {targetWeight > 0 && <g className="cut-trend-goal"><line x1={PAD.left} x2={W - PAD.right} y1={y(targetWeight)} y2={y(targetWeight)} /><text x={W - PAD.right} y={y(targetWeight) - 5}>obiettivo {fmt(targetWeight)}</text></g>}
      <path className="cut-trend-area" d={areaPath} fill={`url(#area-${gradientId})`} />
      <path className="cut-trend-line" d={avgPath} stroke={`url(#line-${gradientId})`} pathLength="1" />
      {series.map((p, i) => <circle key={p.date} className="cut-trend-dot" cx={x(p.t)} cy={y(p.weight)} r="3" style={{ animationDelay: `${0.4 + i * 0.04}s` }} />)}
      <circle className="cut-trend-now" cx={x(latest.t)} cy={y(latest.avg)} r="5" />
      <text className="cut-trend-axis" x={PAD.left} y={H - 6}>{label(series[0])}</text>
      <text className="cut-trend-axis end" x={W - PAD.right} y={H - 6}>{label(latest)}</text>
    </svg>
  </figure>;
}

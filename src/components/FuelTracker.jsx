import React, { useEffect, useMemo, useState } from 'react';
import { Check, Flame, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import CountUp from './CountUp';
import { ACTIVITY, FUEL_GOAL_KEY, fuelTargets, readFuelGoal, readFuelLog, recentFoods, slotForHour, writeFuelLog } from '../utils/fuelPlan';

// Diario calorie per chi non ha il menu fisso (es. Alessandro): sceglie cut o bulk,
// l'obiettivo si calcola sul suo corpo e inserisce da sé quello che mangia.
// Ogni cibo va anche nel diario dell'app (onLogFood), come i pasti mandati dal bot Telegram.

const SLOTS = [['colazione', 'Colazione'], ['pranzo', 'Pranzo'], ['merenda', 'Spuntino'], ['cena', 'Cena']];
const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (d = new Date()) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
const num = (v) => Number(String(v).replace(',', '.'));

export default function FuelTracker({ profile, saveProfile, weightKg, systemLogs = [], onLogFood, onUndoFood, onTargets }) {
  // l'obiettivo vive anche fuori dal profilo: si può scegliere prima di aver messo i propri dati
  const [goal, setGoalState] = useState(() => readFuelGoal(profile));
  const currentKg = weightKg || profile?.currentWeightKg || profile?.startWeightKg;
  const targets = fuelTargets({ sex: profile?.sex, age: profile?.age, heightCm: profile?.heightCm, weightKg: currentKg, activity: profile?.activity, goal });
  const [log, setLog] = useState(readFuelLog);
  const [name, setName] = useState(''), [kcal, setKcal] = useState(''), [protein, setProtein] = useState('');
  const [slot, setSlot] = useState(() => slotForHour(new Date().getHours() + new Date().getMinutes() / 60));
  const [setup, setSetup] = useState(() => ({ sex: profile?.sex || 'm', age: profile?.age ?? '', heightCm: profile?.heightCm ?? '', weightKg: currentKg || '', activity: profile?.activity || 'mid' }));
  const [setupError, setSetupError] = useState('');
  useEffect(() => { writeFuelLog(log); }, [log]);
  // l'obiettivo calcolato diventa quello dell'app (System, statistiche, promemoria)
  useEffect(() => { if (targets) onTargets?.(targets, goal); }, [targets?.kcal, targets?.protein, goal]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = isoDay();
  const items = log[today] || [];
  // il totale viene dal diario dell'app: include anche quello che arriva da Telegram
  const appToday = systemLogs.find((l) => l.date === ddmm());
  const eaten = Math.round(Math.max(Number(appToday?.consumed || 0), items.reduce((s, it) => s + it.kcal, 0)));
  const eatenProtein = Math.round(Math.max(Number(appToday?.protein || 0), items.reduce((s, it) => s + (it.protein || 0), 0)));
  const recents = useMemo(() => recentFoods(log), [log]);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const appDay = systemLogs.find((l) => l.date === ddmm(d));
    const own = (log[isoDay(d)] || []).reduce((s, it) => s + it.kcal, 0);
    return { label: d.toLocaleDateString('it-IT', { weekday: 'narrow' }), kcal: Math.round(Math.max(Number(appDay?.consumed || 0), own)), today: i === 6 };
  });
  const logged = week.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : 0;

  const add = (food) => {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: food.name.trim().slice(0, 40), kcal: Math.round(food.kcal), protein: Math.round(food.protein || 0), slot };
    if (!entry.name || !(entry.kcal > 0) || entry.kcal > 4000) return false;
    setLog((prev) => ({ ...prev, [today]: [...(prev[today] || []), entry] }));
    onLogFood?.({ type: 'meal', local: true, name: entry.name, kcal: entry.kcal, protein: entry.protein, slot: entry.slot });
    return true;
  };
  const submit = (event) => {
    event.preventDefault();
    if (add({ name, kcal: num(kcal), protein: num(protein) || 0 })) { setName(''); setKcal(''); setProtein(''); }
  };
  const remove = (entry) => {
    setLog((prev) => ({ ...prev, [today]: (prev[today] || []).filter((it) => it.id !== entry.id) }));
    onUndoFood?.({ type: 'undo_meal', local: true, name: entry.name, kcal: entry.kcal, protein: entry.protein });
  };
  const setGoal = (next) => {
    setGoalState(next);
    try { localStorage.setItem(FUEL_GOAL_KEY, next); } catch { /* storage */ }
    if (profile) saveProfile({ ...profile, goal: next });
  };
  const saveSetup = (event) => {
    event.preventDefault();
    const w = num(setup.weightKg), age = Math.round(num(setup.age)), h = Math.round(num(setup.heightCm));
    if (!(w >= 40 && w <= 200) || !(age >= 12 && age <= 90) || !(h >= 130 && h <= 220)) { setSetupError('Servono età (12–90), altezza (130–220 cm) e peso (40–200 kg).'); return; }
    setSetupError('');
    saveProfile({ ...(profile || {}), sex: setup.sex === 'f' ? 'f' : 'm', age, heightCm: h, startWeightKg: profile?.startWeightKg || w, targetWeightKg: profile?.targetWeightKg || w, currentWeightKg: w, activity: setup.activity, goal });
  };

  const pct = targets ? Math.min(1, eaten / targets.kcal) : 0;
  const left = targets ? targets.kcal - eaten : 0;
  const R = 52, C = 2 * Math.PI * R;
  const setupForm = <form className="cut-form fuel-setup" onSubmit={saveSetup}>
    <div className="cut-sex" role="radiogroup" aria-label="Sesso biologico, per la stima delle calorie">{[['m', 'Uomo'], ['f', 'Donna']].map(([v, l]) => <button type="button" role="radio" aria-checked={setup.sex === v} key={v} className={setup.sex === v ? 'active' : ''} onClick={() => setSetup((p) => ({ ...p, sex: v }))}>{l}</button>)}</div>
    <div className="cut-form-row"><label>Età<input inputMode="numeric" value={setup.age} onChange={(e) => setSetup((p) => ({ ...p, age: e.target.value }))} placeholder="es. 20" /></label><label>Altezza (cm)<input inputMode="numeric" value={setup.heightCm} onChange={(e) => setSetup((p) => ({ ...p, heightCm: e.target.value }))} placeholder="es. 180" /></label></div>
    <label>Peso attuale (kg)<input inputMode="decimal" value={setup.weightKg} onChange={(e) => setSetup((p) => ({ ...p, weightKg: e.target.value }))} placeholder="es. 72" /></label>
    <div className="fuel-activity" role="radiogroup" aria-label="Quanto ti alleni">{ACTIVITY.map((a) => <button type="button" role="radio" aria-checked={setup.activity === a.id} key={a.id} className={setup.activity === a.id ? 'active' : ''} onClick={() => setSetup((p) => ({ ...p, activity: a.id }))}><b>{a.label}</b><small>{a.note}</small></button>)}</div>
    {setupError && <p className="cut-error" role="alert">{setupError}</p>}
    <button className="cut-primary" type="submit">Calcola il mio obiettivo <Check size={17} /></button>
  </form>;

  return <div className={`fuel fuel-${goal}`}>
    <section className="cut-page-head"><span className="cut-kicker">IL TUO CARBURANTE</span><h1>{goal === 'bulk' ? <>Cresci.<br /><em>Pulito.</em></> : <>Asciuga.<br /><em>Con metodo.</em></>}</h1><p>Scegli l’obiettivo, segna quello che mangi: il resto lo calcola l’app.</p></section>

    <div className="fuel-goal" role="radiogroup" aria-label="Obiettivo">
      <button type="button" role="radio" aria-checked={goal === 'cut'} className={goal === 'cut' ? 'active' : ''} onClick={() => setGoal('cut')}><TrendingDown size={20} /><b>CUT</b><small>Perdi grasso, tieni il muscolo</small></button>
      <button type="button" role="radio" aria-checked={goal === 'bulk'} className={goal === 'bulk' ? 'active' : ''} onClick={() => setGoal('bulk')}><TrendingUp size={20} /><b>BULK</b><small>Metti massa, poco grasso</small></button>
    </div>

    {!targets ? <section className="cut-section"><div className="cut-section-title"><span>PRIMA, DUE NUMERI SU DI TE</span></div><p className="cut-fine">Servono per calcolare quante calorie ti servono davvero.</p>{setupForm}</section> : <>
      <section className="fuel-today">
        <svg viewBox="0 0 120 120" className="fuel-ring" aria-hidden="true"><circle cx="60" cy="60" r={R} className="fuel-ring-bg" /><circle cx="60" cy="60" r={R} className={`fuel-ring-fg ${left < 0 ? 'over' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 60 60)" /></svg>
        <div className="fuel-today-copy"><small>OGGI</small><strong><CountUp value={eaten} /> <span>/ {targets.kcal.toLocaleString('it-IT')} kcal</span></strong>
          <p className={left < 0 ? 'over' : ''}>{left >= 0 ? `Ti restano ${left.toLocaleString('it-IT')} kcal` : `Sei oltre di ${(-left).toLocaleString('it-IT')} kcal`}</p>
          <div className="fuel-protein" role="progressbar" aria-label="Proteine di oggi" aria-valuenow={eatenProtein} aria-valuemin={0} aria-valuemax={targets.protein}><i style={{ transform: `scaleX(${Math.min(1, eatenProtein / targets.protein)})` }} /></div>
          <em>Proteine {eatenProtein} / {targets.protein} g</em></div>
      </section>
      <div className="cut-macro-chips fuel-macros"><span>P {targets.protein} g</span><span>C {targets.carbs} g</span><span>G {targets.fat} g</span><span>{targets.weeklyKg > 0 ? '+' : ''}{targets.weeklyKg.toLocaleString('it-IT')} kg/sett.</span></div>

      <form className="cut-form fuel-add" onSubmit={submit}>
        <div className="fuel-slots" role="radiogroup" aria-label="Pasto">{SLOTS.map(([id, label]) => <button type="button" role="radio" aria-checked={slot === id} key={id} className={slot === id ? 'active' : ''} onClick={() => setSlot(id)}>{label}</button>)}</div>
        <label>Cosa hai mangiato<input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Pasta al tonno" maxLength={40} /></label>
        <div className="cut-form-row"><label>Calorie (kcal)<input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="es. 550" /></label><label>Proteine (g, facoltative)<input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="es. 30" /></label></div>
        <button className="cut-primary" type="submit" disabled={!name.trim() || !(num(kcal) > 0)}><Plus size={17} /> Aggiungi</button>
      </form>
      {recents.length > 0 && <section className="fuel-recents" aria-label="Riaggiungi un cibo recente"><small>DI NUOVO?</small><div>{recents.map((f) => <button type="button" key={f.name} onClick={() => add(f)}><Plus size={13} />{f.name}<em>{f.kcal}</em></button>)}</div></section>}

      <section className="cut-section"><div className="cut-section-title"><span>OGGI NEL PIATTO</span><Flame size={16} /></div>
        {items.length ? SLOTS.filter(([id]) => items.some((it) => it.slot === id)).map(([id, label]) => <div className="fuel-slot-group" key={id}><small>{label.toUpperCase()}</small>{items.filter((it) => it.slot === id).map((it) => <div className="fuel-item" key={it.id}><span>{it.name}</span><b>{it.kcal} kcal{it.protein ? <em> · {it.protein} g P</em> : null}</b><button type="button" aria-label={`Togli ${it.name}`} onClick={() => remove(it)}><X size={15} /></button></div>)}</div>)
          : <p className="cut-fine">Niente ancora. Aggiungi il primo pasto qui sopra, oppure scrivilo al bot Telegram.</p>}
        {Number(appToday?.consumed || 0) > items.reduce((s, it) => s + it.kcal, 0) + 5 && <p className="cut-fine">Nel totale ci sono anche pasti registrati dal bot Telegram o dal diario.</p>}
      </section>

      <section className="cut-section"><div className="cut-section-title"><span>LA TUA SETTIMANA</span><span>{avg ? `media ${avg.toLocaleString('it-IT')} kcal` : ''}</span></div>
        <div className="fuel-week" aria-label="Calorie degli ultimi 7 giorni">{week.map((d, i) => <div key={i} title={`${d.kcal} kcal`} className={`${d.today ? 'today' : ''} ${d.kcal > targets.kcal * 1.1 ? 'over' : d.kcal && d.kcal < targets.kcal * 0.8 ? 'under' : ''}`}><i style={{ height: `${d.kcal ? Math.max(4, Math.min(100, (d.kcal / (targets.kcal * 1.3)) * 100)) : 2}%` }} /></div>)}<b className="fuel-week-target" style={{ bottom: `${100 / 1.3}%` }} /></div>
        <div className="fuel-week-labels">{week.map((d, i) => <span key={i} className={d.today ? 'today' : ''}>{d.label}</span>)}</div>
        <p className="cut-fine">La linea è il tuo obiettivo. Conta la media della settimana, non il singolo giorno.</p>
      </section>

      <details className="cut-profile"><summary><span>I TUOI NUMERI</span><b>Modifica</b></summary>
        <p className="cut-fine fuel-explain">Mantenimento stimato ≈ {targets.tdee.toLocaleString('it-IT')} kcal (metabolismo {targets.bmr.toLocaleString('it-IT')} × attività). {goal === 'bulk' ? 'Bulk: +10% per crescere senza accumulare troppo grasso.' : 'Cut: −20% per perdere grasso senza mangiarti il muscolo.'} Se dopo 2–3 settimane il peso medio non si muove come previsto, aggiusta di 100–150 kcal.</p>
        {setupForm}
      </details>
    </>}
  </div>;
}

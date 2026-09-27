import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, PlayCircle, Plus, RotateCcw, Utensils } from 'lucide-react';
import ProtocolIcon from '../components/ProtocolIcon';
import { dayNames, evidence, mealWeeks, nutritionRules, phases, recipes, trainingDays } from '../data/cutPlan';
import { dayTargetFor, formatKg, useCutProfile } from '../utils/cutProfile';
import MmaAcademy from '../components/MmaAcademy';
import CountUp from '../components/CountUp';
import WeightTrend from '../components/WeightTrend';
import '../styles/cut-plan.css';

const KEY = 'shadow_monarch_cut_plan_v1';
const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const getMondayIndex = () => (new Date().getDay() + 6) % 7;
const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const round1 = (value) => Math.round(value * 10) / 10;
const isRestDay = (session) => session.duration === '—';
const toNumber = (value) => Number(String(value).replace(',', '.'));
const emptyProfileForm = (p) => ({
  sex: p?.sex || 'm', age: p?.age ?? '', heightCm: p?.heightCm ?? '',
  startWeightKg: p?.startWeightKg ?? '', targetWeightKg: p?.targetWeightKg ?? '', startWaistCm: p?.startWaistCm ?? '',
});

// XP per azione: ogni chiave si paga una volta sola (niente farming togliendo e rimettendo la spunta).
const XP = { session: 40, creatine: 10, measure: 15 };

export default function CutPlan({ view = 'today', onNavigate, systemLogs = [], onGainXp }) {
  const [profile, saveProfile] = useCutProfile();
  const [profileForm, setProfileForm] = useState(() => emptyProfileForm(profile));
  const [profileError, setProfileError] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [week, setWeek] = useState(() => Math.min(3, Math.max(0, Number(readSaved().week || 0))));
  const [trainingWeek, setTrainingWeek] = useState(() => Math.min(11, Math.max(0, Number(readSaved().trainingWeek || 0))));
  const [day, setDay] = useState(getMondayIndex);
  const [light, setLight] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [pushups, setPushups] = useState('');
  const [pullups, setPullups] = useState('');
  const [load, setLoad] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoId, setVideoId] = useState('1763945815001');
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ ...saved, week, trainingWeek })); }, [saved, week, trainingWeek]);
  const today = getMondayIndex();
  const selectedMeal = mealWeeks[week][day];
  const todayTraining = trainingDays[today];
  const currentPhase = phases[trainingWeek < 2 ? 0 : trainingWeek < 4 ? 1 : trainingWeek < 8 ? 2 : 3];
  const completed = saved.completed || {};
  const progress = saved.progress || [];
  const latest = progress[progress.length - 1];
  const latestWeight = [...progress].reverse().find((entry) => entry.weight)?.weight;
  const latestWaist = [...progress].reverse().find((entry) => entry.waist)?.waist;
  const todayKey = getLocalDateKey();
  const todayLog = systemLogs.find((log) => log.date === new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));

  const rewardOnce = (key, amount, message) => {
    if (saved.xpAwarded?.[key]) return;
    setSaved((prev) => ({ ...prev, xpAwarded: { ...(prev.xpAwarded || {}), [key]: true } }));
    onGainXp?.(amount, message);
  };
  const completeSession = (index) => {
    const key = `${trainingWeek}-${index}`;
    const nowDone = !completed[key];
    setSaved((prev) => ({ ...prev, completed: { ...(prev.completed || {}), [key]: !prev.completed?.[key] } }));
    if (nowDone) rewardOnce(`session-${key}`, XP.session, `${trainingDays[index].short} completata`);
  };
  const saveMeasure = (event) => {
    event.preventDefault();
    const kg = Number(String(weight).replace(',', '.'));
    const cm = Number(String(waist).replace(',', '.'));
    const push = Number(pushups); const pull = Number(pullups); const trainingLoad = Number(String(load).replace(',', '.'));
    if (![kg, cm, push, pull, trainingLoad].some((value) => value > 0)) return;
    if ((kg && (kg < 45 || kg > 180)) || (cm && (cm < 45 || cm > 180))) return;
    setSaved((prev) => ({ ...prev, progress: [...(prev.progress || []), { date: todayKey, weight: kg || null, waist: cm || null, pushups: push || null, pullups: pull || null, load: trainingLoad || null }] }));
    rewardOnce(`measure-${todayKey}`, XP.measure, 'Misura registrata');
    setWeight(''); setWaist(''); setPushups(''); setPullups(''); setLoad('');
  };
  const sessionIcon = (type) => <ProtocolIcon name={type === 'strength' ? 'program' : type === 'optional' ? 'mma' : type} size={23} />;
  const submitProfile = (event) => {
    event.preventDefault();
    const next = {
      sex: profileForm.sex === 'f' ? 'f' : 'm',
      age: Math.round(toNumber(profileForm.age)) || null,
      heightCm: Math.round(toNumber(profileForm.heightCm)) || null,
      startWeightKg: toNumber(profileForm.startWeightKg),
      targetWeightKg: toNumber(profileForm.targetWeightKg),
      startWaistCm: toNumber(profileForm.startWaistCm) || null,
    };
    if (!(next.startWeightKg >= 40 && next.startWeightKg <= 200) || !(next.targetWeightKg >= 40 && next.targetWeightKg <= 200)) {
      setProfileError('Inserisci peso di partenza e obiettivo tra 40 e 200 kg.');
      return;
    }
    setProfileError('');
    saveProfile({ ...(profile || {}), ...next });
  };
  const setProfileField = (field) => (event) => setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
  const kcalRange = [0, 1, 2, 3, 4, 5, 6].map((index) => dayTargetFor(profile, index));
  const rules = nutritionRules.map((rule, index) => {
    if (index === 0) return `Partenza indicativa: ${Math.min(...kcalRange).toLocaleString('it-IT')}–${Math.max(...kcalRange).toLocaleString('it-IT')} kcal in base alla giornata. Le porzioni sono una guida, non un obbligo matematico.`;
    if (index === 1 && profile) return rule.replace(/circa \d+–\d+ g al giorno/, `circa ${Math.round(profile.startWeightKg * 1.8 / 5) * 5}–${Math.round(profile.startWeightKg * 2 / 5) * 5} g al giorno`);
    return rule;
  });
  const goalSpan = profile ? profile.startWeightKg - profile.targetWeightKg : 0;
  const goalPct = profile && goalSpan ? Math.max(3, Math.min(100, ((profile.startWeightKg - (latestWeight || profile.startWeightKg)) / goalSpan) * 100)) : 3;
  const creatineTaken = saved.creatineDate === todayKey;
  const toggleCreatine = () => {
    setSaved((prev) => ({ ...prev, creatineDate: prev.creatineDate === todayKey ? '' : todayKey }));
    if (!creatineTaken) rewardOnce(`creatine-${todayKey}`, XP.creatine, 'Creatina presa');
  };

  return <main className={`cut-page cut-view-${view}`}>
    <header className="cut-topline"><span>SHADOW / 01</span><span>PROTOCOLLO CUT</span></header>
    {view === 'today' && <>
      <section className="cut-hero">
        <div className="cut-hero-copy"><span className="cut-kicker">IL TUO PERCORSO • 12 SETTIMANE</span><h1>Il prossimo<br /><em>livello.</em></h1><p>{profile ? `Da ${formatKg(profile.startWeightKg)} kg verso ${formatKg(profile.targetWeightKg)} kg. ` : ''}Forza, velocità e continuità. Una giornata alla volta.</p></div>
        <img src="/avatar8.png" alt="Guerriero in stile anime" className="cut-hero-art" />
        <div className="cut-hero-line" />
      </section>
      <section className="cut-status">
        <div><small>OBIETTIVO</small><strong>{profile ? <><CountUp value={profile.targetWeightKg} decimals={2} /> <span>kg</span></> : '—'}</strong></div><div><small>OGGI</small><strong><CountUp value={dayTargetFor(profile, today)} /> <span>kcal*</span></strong></div><div><small>FASE</small><strong>{currentPhase.name}</strong></div>
      </section>
      {!profile && <button className="cut-setup" onClick={() => onNavigate('progress')}><span><small>PRIMO PASSO</small><b>Imposta il tuo profilo</b><em>Peso, obiettivo e altezza: calorie e progressi si adattano a te.</em></span><ArrowRight size={18} /></button>}
      <p className="cut-fine">*Stima iniziale. Adattala alla media del peso, alla vita e all’energia negli allenamenti.</p>
      <section className="cut-section"><div className="cut-section-title"><span>OGGI / {dayNames[today].toUpperCase()}</span><button onClick={() => onNavigate('program')}>Settimana <ArrowRight size={15} /></button></div>
        <div className={`cut-feature cut-${todayTraining.type}`}><div className="cut-feature-icon">{sessionIcon(todayTraining.type)}</div><div>{todayTraining.duration !== '—' && <small>{todayTraining.duration}</small>}<h2>{todayTraining.short}</h2><p>{todayTraining.detail}</p></div></div>
        <div className="cut-actions"><button onClick={() => onNavigate('program')}>{isRestDay(todayTraining) ? 'Vedi la settimana' : 'Apri sessione'} <ArrowRight size={16} /></button><button onClick={() => onNavigate('food')}>Pasti di oggi <Utensils size={16} /></button></div>
      </section>
      <section className="cut-section"><div className="cut-section-title"><span>IL TUO SEGNALE</span><button onClick={() => onNavigate('progress')}>Progressi <ArrowRight size={15} /></button></div>
        <div className="cut-metrics"><div><small>PESO RECENTE</small><b>{latestWeight ? <><CountUp value={round1(latestWeight)} decimals={1} /> kg</> : 'Da registrare'}</b></div><div><small>GIROVITA</small><b>{latestWaist ? `${round1(latestWaist)} cm` : profile?.startWaistCm ? `${formatKg(profile.startWaistCm)} cm iniziali` : 'Da registrare'}</b></div></div>
        <p className="cut-fine">{todayLog?.consumed ? `Oggi hai registrato circa ${Math.round(todayLog.consumed)} kcal nel diario.` : 'Registra cibo e bevande nel diario, anche con quantità approssimative.'}</p>
      </section>
      <section className={`cut-creatine ${creatineTaken ? 'taken' : ''}`}><div className="cut-creatine-icon"><ProtocolIcon name="creatine" size={24} /></div><div><small>ABITUDINE QUOTIDIANA</small><h2>Creatina monoidrato</h2><p>3–5 g al giorno, se hai scelto di assumerla. Può far salire il peso iniziale per acqua nei muscoli.</p><button onClick={toggleCreatine}>{creatineTaken ? <Check size={15} /> : <Plus size={15} />}{creatineTaken ? 'Presa oggi' : <>Segna come presa <span className="cut-xp">+{XP.creatine} XP</span></>}</button></div></section>
      <section className="cut-section cut-brief"><span className="cut-kicker">LA REGOLA DI OGGI</span><p>{rules[today % rules.length]}</p></section>
    </>}

    {view === 'mma' && <MmaAcademy onNavigate={onNavigate} />}

    {view === 'food' && <>
      <section className="cut-page-head"><span className="cut-kicker">28 GIORNI • 4 SETTIMANE</span><h1>Mangia bene.<br /><em>Con gusto.</em></h1><p>Un piano vario che include già McDonald’s, pasta con carne di cavallo, pizza e ricette fit porn. Ripeti la rotazione nei tre mesi cambiando verdure, frutta e fonti proteiche equivalenti.</p></section>
      <div className="cut-week-picker"><button aria-label="Settimana precedente" onClick={() => setWeek((n) => Math.max(0, n - 1))}><ChevronLeft size={20} /></button><span>SETTIMANA <strong>{week + 1}</strong> / 4</span><button aria-label="Settimana successiva" onClick={() => setWeek((n) => Math.min(3, n + 1))}><ChevronRight size={20} /></button></div>
      <div className="cut-day-strip">{dayNames.map((name, index) => <button key={name} className={day === index ? 'active' : ''} onClick={() => setDay(index)}>{name.slice(0, 3)}</button>)}</div>
      <section className="cut-meal-head"><span>{selectedMeal.day}</span><strong>≈ {dayTargetFor(profile, day).toLocaleString('it-IT')} kcal</strong></section>
      {Object.entries({ Colazione: selectedMeal.breakfast, Pranzo: selectedMeal.lunch, Spuntino: selectedMeal.snack, Cena: selectedMeal.dinner }).map(([label, meal], index) => <div className={`cut-meal cut-meal-${index}`} key={label}><img className="cut-meal-image" src={selectedMeal.images[label]} alt={meal.split(':')[0]} loading="lazy" /><div className="cut-meal-copy"><span>0{index + 1} / {label}</span><p>{meal}</p></div></div>)}
      {selectedMeal.note && <p className="cut-note">{selectedMeal.note}</p>}
      <p className="cut-fine">Le calorie del giorno sono una stima. Quantità e prodotti reali possono cambiare molto il totale: usa il diario per calibrare le porzioni.</p>
      <button className="cut-primary" onClick={() => onNavigate('system')}>Registra ciò che hai mangiato <ArrowRight size={17} /></button>
      <section className="cut-section"><div className="cut-section-title"><span>FIT PORN / RICETTE</span><BookOpen size={16} /></div><div className="cut-recipes">{recipes.map((recipe) => <button className="cut-recipe" key={recipe.title} onClick={() => setSelectedRecipe(recipe)}><img src={recipe.image} alt="" /><span><small>{recipe.tag}</small><b>{recipe.title}</b></span><ArrowRight size={17} /></button>)}</div></section>
      <section className="cut-section"><div className="cut-section-title"><span>COME USARE IL PIANO</span></div>{rules.map((rule) => <p className="cut-rule" key={rule}>{rule}</p>)}</section>
    </>}

    {view === 'program' && <>
      <section className="cut-page-head"><span className="cut-kicker">CALCIO • FORZA • VELOCITÀ</span><h1>Allenati<br /><em>con metodo.</em></h1><p>Il calcio resta fisso lunedì e giovedì. I carichi più impegnativi per le gambe arrivano sabato.</p></section>
      <div className="cut-week-picker"><button aria-label="Settimana precedente" onClick={() => setTrainingWeek((n) => Math.max(0, n - 1))}><ChevronLeft size={20} /></button><span>SETTIMANA <strong>{trainingWeek + 1}</strong> / 12</span><button aria-label="Settimana successiva" onClick={() => setTrainingWeek((n) => Math.min(11, n + 1))}><ChevronRight size={20} /></button></div>
      <p className="cut-fine">Schema settimanale stabile, progressione graduale. Tieni la seduta opzionale solo se recuperi bene.</p>
      <p className="cut-note"><strong>{currentPhase.name}:</strong> {currentPhase.detail}</p>
      <div className="cut-phase-list">{phases.map((phase) => <details key={phase.weeks} open={phase.weeks === '1–2'}><summary><span>SETTIMANE {phase.weeks}</span><b>{phase.name}</b></summary><p>{phase.detail}</p></details>)}</div>
      <div className="cut-day-strip">{dayNames.map((name, index) => <button key={name} className={day === index ? 'active' : ''} onClick={() => setDay(index)}>{name.slice(0, 3)}</button>)}</div>
      <section className={`cut-feature cut-${trainingDays[day].type}`}><div className="cut-feature-icon">{sessionIcon(trainingDays[day].type)}</div><div>{trainingDays[day].duration !== '—' && <small>{trainingDays[day].duration}</small>}<h2>{trainingDays[day].short}</h2><p>{trainingDays[day].detail}</p></div></section>
      {trainingDays[day].exercises && <><button className={`cut-toggle ${light ? 'active' : ''}`} onClick={() => setLight((n) => !n)}>{light ? 'Versione leggera attiva' : 'Sono stanco: versione leggera'} <RotateCcw size={15} /></button><div className="cut-exercises">{(light ? trainingDays[day].exercises.filter((_, index) => index < 3) : trainingDays[day].exercises).map(([name, prescription], index) => <div className="cut-exercise" key={name}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{name}</b><small>{light && index > 0 ? '1–2 serie facili' : trainingWeek < 2 ? prescription.replace(/^3 ×/, '2 ×').replace(/^4–6 rip\./, '3–4 rip. al 70–80%') : prescription}</small></div></div>)}</div><p className="cut-fine">Riposa 60–90 s tra le serie; 90–120 s per le accelerazioni. Ferma la serie quando la tecnica peggiora.</p></>}
      {isRestDay(trainingDays[day]) ? <p className="cut-note">Giorno di riposo: niente da segnare. Il recupero fa parte del piano.</p> : <button className={`cut-primary ${completed[`${trainingWeek}-${day}`] ? 'done' : ''}`} onClick={() => completeSession(day)}>{completed[`${trainingWeek}-${day}`] ? <Check size={18} /> : <Plus size={18} />}{completed[`${trainingWeek}-${day}`] ? 'Sessione completata' : <>Segna come completata <span className="cut-xp">+{XP.session} XP</span></>}</button>}
      <section className="cut-section"><div className="cut-section-title"><span>VIDEO TECNICA</span><PlayCircle size={18} /></div><button className="cut-video" onClick={() => setVideoOpen((n) => !n)}><img src="/avatar7.png" alt="" /><span><PlayCircle size={28} /><b>{videoOpen ? 'Nascondi video' : 'Guarda le dimostrazioni'}</b><small>Riscaldamento, squat, trazioni • NHS</small></span></button>{videoOpen && <div className="cut-video-links"><div className="cut-video-tabs">{[['1763945815001', 'Warm-up'], ['1763919389001', 'Squat'], ['1763919425001', 'Trazioni']].map(([id, label]) => <button key={id} className={videoId === id ? 'active' : ''} onClick={() => setVideoId(id)}>{label}</button>)}</div><iframe key={videoId} className="cut-video-frame" title="Dimostrazione tecnica NHS" src={`https://players.brightcove.net/79855382001/EkC1XU82e_default/index.html?videoId=${videoId}`} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" /><a href="https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/" target="_blank" rel="noreferrer">Altri video NHS <ArrowRight size={15} /></a></div>}</section>
      <button className="cut-secondary" onClick={() => onNavigate('training')}>Apri il vecchio laboratorio allenamento <ArrowRight size={16} /></button>
    </>}

    {view === 'progress' && <>
      <section className="cut-page-head"><span className="cut-kicker">MISURA • ADATTA • CONTINUA</span><h1>Vedi il<br /><em>cambiamento.</em></h1><p>Conta la tendenza di più settimane, non il numero di una singola pesata.</p></section>
      {profile && <div className="cut-goal"><div><small>PARTENZA</small><b>{formatKg(profile.startWeightKg)} kg</b></div><div className="cut-goal-track" role="progressbar" aria-label="Avanzamento verso l'obiettivo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalPct)}><span style={{ transform: `scaleX(${goalPct / 100})` }} /></div><div><small>OBIETTIVO</small><b>{formatKg(profile.targetWeightKg)} kg</b></div></div>}
      <WeightTrend progress={progress} startWeight={profile?.startWeightKg} targetWeight={profile?.targetWeightKg} />
      <details className="cut-profile" open={!profile}><summary><span>IL TUO PROFILO</span><b>{profile ? 'Modifica' : 'Da impostare'}</b></summary>
        <form className="cut-form cut-profile-form" onSubmit={submitProfile}>
          <div className="cut-sex" role="radiogroup" aria-label="Sesso biologico, per la stima delle calorie">{[['m', 'Uomo'], ['f', 'Donna']].map(([value, label]) => <button type="button" role="radio" aria-checked={profileForm.sex === value} key={value} className={profileForm.sex === value ? 'active' : ''} onClick={() => setProfileForm((prev) => ({ ...prev, sex: value }))}>{label}</button>)}</div>
          <div className="cut-form-row"><label>Età<input inputMode="numeric" value={profileForm.age} onChange={setProfileField('age')} placeholder="es. 25" /></label><label>Altezza (cm)<input inputMode="numeric" value={profileForm.heightCm} onChange={setProfileField('heightCm')} placeholder="es. 178" /></label></div>
          <div className="cut-form-row"><label>Peso di partenza (kg)<input inputMode="decimal" value={profileForm.startWeightKg} onChange={setProfileField('startWeightKg')} placeholder="es. 80" required /></label><label>Obiettivo (kg)<input inputMode="decimal" value={profileForm.targetWeightKg} onChange={setProfileField('targetWeightKg')} placeholder="es. 76" required /></label></div>
          <label>Girovita iniziale (cm, facoltativo)<input inputMode="decimal" value={profileForm.startWaistCm} onChange={setProfileField('startWaistCm')} placeholder="es. 88" /></label>
          {profileError && <p className="cut-error" role="alert">{profileError}</p>}
          <button className="cut-primary" type="submit">Salva profilo <Check size={17} /></button>
        </form>
      </details>
      <form className="cut-form" onSubmit={saveMeasure}><label>Peso del mattino (kg)<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="es. 86,2" /></label><label>Girovita (cm)<input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="es. 91" /></label><label>Piegamenti consecutivi<input inputMode="numeric" value={pushups} onChange={(e) => setPushups(e.target.value)} placeholder="es. 30" /></label><label>Trazioni consecutive<input inputMode="numeric" value={pullups} onChange={(e) => setPullups(e.target.value)} placeholder="es. 3" /></label><label>Carico di riferimento (kg per manubrio)<input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} placeholder="es. 12" /></label><button className="cut-primary" type="submit">Salva misura <Plus size={17} />{!saved.xpAwarded?.[`measure-${todayKey}`] && <span className="cut-xp">+{XP.measure} XP</span>}</button></form>
      <section className="cut-section"><div className="cut-section-title"><span>STORICO MISURE</span></div>{progress.length ? [...progress].reverse().map((entry, index) => <div className="cut-history" key={`${entry.date}-${index}`}><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span><b>{entry.weight ? `${round1(entry.weight)} kg` : entry.pushups ? `${entry.pushups} pieg.` : '—'}</b><b>{entry.waist ? `${round1(entry.waist)} cm` : entry.pullups ? `${entry.pullups} traz.` : entry.load ? `${round1(entry.load)} kg` : '—'}</b></div>) : <p className="cut-fine">La prima misura del mattino avvierà lo storico dei progressi.</p>}</section>
      <section className="cut-section"><div className="cut-section-title"><span>CHECK OGNI 4 SETTIMANE</span></div><p className="cut-rule">Segna anche quante trazioni e piegamenti consecutivi riesci a fare e i carichi usati. Se forza, energia o prestazioni calano troppo, alleggerisci l’allenamento e rivedi l’apporto energetico.</p><p className="cut-rule">Le stime di massa grassa della bilancia OKOK servono solo come riferimento: peso medio, girovita e prestazioni sono più utili per questo percorso.</p></section>
      <section className="cut-section"><div className="cut-section-title"><span>FONTI DEL PROTOCOLLO</span></div>{evidence.map((source) => <a className="cut-source" href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={15} /></a>)}</section>
    </>}
    {selectedRecipe && <div className="cut-modal-backdrop" onClick={() => setSelectedRecipe(null)}><div className="cut-modal" onClick={(e) => e.stopPropagation()}><button className="cut-close" onClick={() => setSelectedRecipe(null)}>Chiudi</button><img src={selectedRecipe.image} alt="" /><small>{selectedRecipe.tag}</small><h2>{selectedRecipe.title}</h2><h3>Ingredienti</h3><p>{selectedRecipe.ingredients}</p><h3>Preparazione</h3><p>{selectedRecipe.steps}</p></div></div>}
  </main>;
}

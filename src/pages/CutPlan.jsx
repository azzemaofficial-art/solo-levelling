import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, PlayCircle, Plus, RotateCcw, Shuffle, ThumbsDown, ThumbsUp, Utensils } from 'lucide-react';
import ProtocolIcon from '../components/ProtocolIcon';
import { dayNames, evidence, mealWeeks, nutritionRules, phases as mainPhases, recipes, swapGroup, swapPools, trainingDays as mainDays } from '../data/cutPlan';
import { massaDishes, massaWeeks } from '../data/menuMassa';
import { massaEvidence, massaPhaseOf, massaPhases, massaRules, massaTrainingDays, massaWeekIndex, MASSA_START } from '../data/massaPlan';
import { alternativesFor, applyMealPrefs, applyMenu16, pickKey, recipeFor, togglePref, weekPrep, weekShopping } from '../utils/mealPrefs';
import { menu16Dishes, menu16Weeks } from '../data/menu16';
import MealAlternatives from '../components/MealAlternatives';
import { videosFor } from '../data/exerciseVideos';
import { dayTargetFor, formatKg, useCutProfile } from '../utils/cutProfile';
import { CUT_PLAN_KEY, CUT_SYNC_EVENT, CUT_XP } from '../utils/cutSync';
import { dateOfWeekday, durationMinutes, kindForSession, logWorkout, unlogWorkout } from '../utils/trainingLog';
import TrainingLog, { useTrainingLog } from '../components/TrainingLog';
import { StrengthPanel, ThisWeekCard, WeeksHistory, YearStats } from '../components/WeeksPanel';
import { PLAN_START, planWeekIndex, weekMonday } from '../utils/planWeeks';
import MmaAcademy from '../components/MmaAcademy';
import FuelTracker from '../components/FuelTracker';
import { fuelTargets, readFuelGoal, usesFixedMenu, usesMassPlan } from '../utils/fuelPlan';
import { summonChase } from '../components/DragonSky';
import CountUp from '../components/CountUp';
import WeightTrend from '../components/WeightTrend';
import '../styles/cut-plan.css';

const KEY = CUT_PLAN_KEY;
// piatti su cui si può mettere 👍 / 👎 (i pasti fissi no): src/utils/mealPrefs.js
const NEW_DISHES = [...menu16Dishes, ...massaDishes].filter((dish) => dish.family);
const SWAPPABLE = new Set([...Object.values(swapPools).flat().map((dish) => dish.id), ...NEW_DISHES.map((dish) => dish.id)]);
const DISH_TITLE = { ...Object.fromEntries(Object.values(swapPools).flat().map((dish) => [dish.id, recipeFor(dish.meal)?.title || dish.meal])), ...Object.fromEntries(NEW_DISHES.map((dish) => [dish.id, dish.title])) };
const OLD_WEEKS = mealWeeks.length;
const TOTAL_WEEKS = OLD_WEEKS + menu16Weeks.length;
const TRAINING_WEEKS = 16;
const doseLine = ([name, grams], people) => `${name} ${Math.round(grams * people)} g${/^uov/i.test(name) ? ` (≈ ${Math.max(1, Math.round((grams * people) / 50))} uova)` : ''}`;
const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const getMondayIndex = () => (new Date().getDay() + 6) % 7;
const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const round1 = (value) => Math.round(value * 10) / 10;
// Diagnostica effetti (draghi/animazioni) per capire da remoto perché un telefono non li mostra.
const clientInfo = () => {
  const read = (key) => { try { return localStorage.getItem(key) || 'auto'; } catch { return '?'; } };
  let reducedMotion = null;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* vecchi browser */ }
  return { reducedMotion, fxMode: read('shadow_monarch_fx_mode'), dragons: read('shadow_monarch_dragons'), ua: String(navigator.userAgent || '').slice(0, 180) };
};
const isRestDay = (session) => session.duration === '—';
const toNumber = (value) => Number(String(value).replace(',', '.'));
const emptyProfileForm = (p) => ({
  sex: p?.sex || 'm', age: p?.age ?? '', heightCm: p?.heightCm ?? '',
  startWeightKg: p?.startWeightKg ?? '', targetWeightKg: p?.targetWeightKg ?? '', startWaistCm: p?.startWaistCm ?? '',
});

// XP per azione: ogni chiave si paga una volta sola (niente farming togliendo e rimettendo la spunta).
const XP = CUT_XP;

export default function CutPlan({ view = 'today', onNavigate, systemLogs = [], onGainXp, onFoodEvent, onFuelTargets }) {
  const [profile, saveProfile] = useCutProfile();
  // il menu fisso è il piano di Emanuele; chiunque altro (es. Alessandro) conta le calorie da sé
  const [massPlan] = useState(() => { try { return usesMassPlan(localStorage.getItem('shadow_monarch_tg_chat_id')); } catch { return false; } });
  const [fixedMenu] = useState(() => { try { return massPlan || usesFixedMenu(localStorage.getItem('shadow_monarch_tg_chat_id')); } catch { return false; } });
  const trainingDays = massPlan ? massaTrainingDays : mainDays;
  // il carattere del manga si scarica solo per lui
  useEffect(() => {
    if (!massPlan || document.getElementById('manga-font')) return;
    const link = Object.assign(document.createElement('link'), { id: 'manga-font', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap' });
    document.head.appendChild(link);
  }, [massPlan]);
  const phases = massPlan ? massaPhases : mainPhases;
  const oldWeeks = massPlan ? 0 : OLD_WEEKS;
  const totalWeeks = massPlan ? massaWeeks.length : TOTAL_WEEKS;
  // le dosi massa sono già sue: niente riproporzione sul metabolismo
  const dayTarget = (index, base) => (massPlan ? base : dayTargetFor(profile, index, base));
  const trainingLog = useTrainingLog();
  const [profileForm, setProfileForm] = useState(() => emptyProfileForm(profile));
  const [profileError, setProfileError] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [week, setWeek] = useState(() => (massPlan ? massaWeekIndex() : Math.min(TOTAL_WEEKS - 1, Math.max(0, Number(readSaved().week || 0)))));
  // foto delle ricette nuove non ancora caricate: al loro posto un’icona
  // 👍 / 👎 sui piatti: salvati nel piano; un 👎 sostituisce quel piatto in tutte le settimane
  const mealPrefs = saved.mealPrefs || {};
  const plannedWeeks = useMemo(() => (massPlan ? applyMenu16(saved.mealPrefs || {}, saved.mealPicks || {}, massaWeeks, 0) : [...applyMealPrefs(mealWeeks, saved.mealPrefs || {}), ...applyMenu16(saved.mealPrefs || {}, saved.mealPicks || {})]), [massPlan, saved.mealPrefs, saved.mealPicks]);
  const people = saved.people || 1;
  const [altSlot, setAltSlot] = useState(null);
  const setMealPick = (slot, id) => {
    const key = pickKey(week, day, slot.label);
    setSaved((prev) => { const picks = { ...prev.mealPicks }; if (id) picks[key] = id; else delete picks[key]; return { ...prev, mealPicks: picks }; });
    setAltSlot(null);
  };
  const setMealPref = (id, value) => setSaved((prev) => ({ ...prev, mealPrefs: togglePref(prev.mealPrefs, id, value) }));
  const [missingImages, setMissingImages] = useState({});
  const imageMissing = (src) => setMissingImages((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
  const [trainingWeek, setTrainingWeek] = useState(() => planWeekIndex(new Date(), massPlan ? MASSA_START : PLAN_START));
  const [progressTab, setProgressTab] = useState('settimane');
  const planStart = massPlan ? MASSA_START : PLAN_START;
  const [day, setDay] = useState(getMondayIndex);
  const [light, setLight] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [pushups, setPushups] = useState('');
  const [pullups, setPullups] = useState('');
  const [load, setLoad] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [exerciseVideo, setExerciseVideo] = useState(null); // { name, index }
  useEffect(() => {
    if (!selectedRecipe) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSelectedRecipe(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRecipe]);
  const [videoId, setVideoId] = useState('1763945815001');
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ ...saved, week, trainingWeek })); }, [saved, week, trainingWeek]);
  // Promemoria Telegram serali (lib/cutReminders.js via remind): il server riceve solo
  // due date, e solo quando cambiano. Senza chat_id collegato non parte nulla.
  const lastWeighDate = [...(saved.progress || [])].reverse().find((entry) => entry.weight)?.date || null;
  const sessionDoneDate = saved.completed?.[`${trainingWeek}-${getMondayIndex()}`] ? getLocalDateKey() : null;
  const fuelGoal = readFuelGoal(profile);
  const fuel = fixedMenu ? null : fuelTargets({ sex: profile?.sex, age: profile?.age, heightCm: profile?.heightCm, weightKg: [...(saved.progress || [])].reverse().find((e) => e.weight)?.weight || profile?.currentWeightKg || profile?.startWeightKg, activity: profile?.activity, goal: fuelGoal });
  const targetFor = (index) => (fuel ? fuel.kcal : dayTarget(index, plannedWeeks[week][index].target));
  const kcalTargetsKey = [0, 1, 2, 3, 4, 5, 6].map(targetFor).join(',');
  // Spunte arrivate da Telegram (utils/cutSync): rileggi lo stato salvato.
  useEffect(() => {
    const onSync = () => setSaved(readSaved());
    window.addEventListener(CUT_SYNC_EVENT, onSync);
    return () => window.removeEventListener(CUT_SYNC_EVENT, onSync);
  }, []);
  useEffect(() => {
    let chatId = '';
    try { chatId = localStorage.getItem('shadow_monarch_tg_chat_id') || ''; } catch { /* storage bloccato */ }
    if (!/^\d+$/.test(chatId)) return undefined;
    const timer = setTimeout(() => {
      fetch('/api/telegram/remind', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, plan: massPlan ? 'massa' : null, creatineDate: saved.creatineDate || null, sessionDoneDate, lastWeighDate, kcalTargets: kcalTargetsKey.split(',').map(Number), client: clientInfo() }),
      }).catch(() => { /* offline: si riallinea al prossimo cambio */ });
    }, 1500);
    return () => clearTimeout(timer);
  }, [saved.creatineDate, sessionDoneDate, lastWeighDate, kcalTargetsKey]);
  const today = getMondayIndex();
  const selectedMeal = plannedWeeks[week][day];
  const mealSlots = selectedMeal.slots.map((slot) => [slot.label, slot.meal]);
  const slotImage = (label) => { const src = selectedMeal.slots.find((slot) => slot.label === label)?.image; return src && !missingImages[src] ? src : null; };
  const planTotals = mealSlots.reduce((sum, [, meal]) => {
    const recipe = recipeFor(meal);
    return { kcal: sum.kcal + (recipe?.kcal || 0), protein: sum.protein + (recipe?.protein || 0), fiber: sum.fiber + (recipe?.fiber || 0) };
  }, { kcal: 0, protein: 0, fiber: 0 });
  const openMeal = (label, meal, id) => {
    const recipe = recipeFor(meal);
    if (!recipe) return;
    setSelectedRecipe({ ...recipe, id, image: slotImage(label), tag: `${label} • ${recipe.time}` });
  };
  const peoplePicker = <div className="cut-people" role="group" aria-label="Persone a tavola"><span>PER QUANTE PERSONE</span>{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={people === n ? 'active' : ''} aria-pressed={people === n} onClick={() => setSaved((prev) => ({ ...prev, people: n }))}>{n}</button>)}</div>;
  // pollici: piccoli sulla scheda del pasto, grandi nella ricetta
  const thumbs = (id, big = false) => (
    <div className={big ? 'cut-thumbs cut-thumbs-big' : 'cut-thumbs'} role="group" aria-label="Ti piace questo piatto?">
      <button type="button" className={mealPrefs[id] === 'up' ? 'on up' : ''} aria-pressed={mealPrefs[id] === 'up'} aria-label="Mi piace" onClick={() => setMealPref(id, 'up')}><ThumbsUp size={big ? 17 : 15} />{big && ' Mi piace'}</button>
      <button type="button" className={mealPrefs[id] === 'down' ? 'on down' : ''} aria-pressed={mealPrefs[id] === 'down'} aria-label="Non mi piace: sostituiscilo" onClick={() => setMealPref(id, 'down')}><ThumbsDown size={big ? 17 : 15} />{big && ' Non mi piace'}</button>
    </div>
  );
  const likedIds = Object.keys(mealPrefs).filter((id) => mealPrefs[id] === 'up' && SWAPPABLE.has(id));
  const dislikedIds = Object.keys(mealPrefs).filter((id) => mealPrefs[id] === 'down' && SWAPPABLE.has(id));
  const todayTraining = trainingDays[today];
  const currentPhase = massPlan ? massaPhaseOf(trainingWeek) : phases[trainingWeek < 7 ? 0 : trainingWeek < 10 ? 1 : trainingWeek === 10 ? 2 : trainingWeek < 13 ? 3 : 4];
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
    // diario: data reale di quel giorno nella settimana in corso
    const session = trainingDays[index];
    const entry = { date: dateOfWeekday(index, weekMonday(trainingWeek, planStart)), kind: kindForSession(session.type), title: session.short };
    if (nowDone) logWorkout({ ...entry, minutes: durationMinutes(session.duration) });
    else unlogWorkout(entry);
    if (nowDone) rewardOnce(`session-${key}`, XP.session, `${session.short} completata`);
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
  const kcalRange = [0, 1, 2, 3, 4, 5, 6].map((index) => dayTarget(index, plannedWeeks[week][index].target));
  const rules = massPlan ? massaRules : nutritionRules.map((rule, index) => {
    if (index === 0 && fuel) return `Il tuo obiettivo: circa ${fuel.kcal.toLocaleString('it-IT')} kcal e ${fuel.protein} g di proteine al giorno (${fuelGoal === 'bulk' ? 'bulk' : 'cut'}). Conta la media della settimana, non il singolo giorno.`;
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

  return <main className={`cut-page cut-view-${view}${massPlan ? ' manga' : ''}`}>
    <header className="cut-topline"><span>SHADOW / 01</span><span>PROTOCOLLO {massPlan ? 'MASSA' : fixedMenu || fuelGoal === 'cut' ? 'CUT' : 'BULK'}</span></header>
    {view === 'today' && <>
      {massPlan ? <section className="manga-hero">
        <img className="manga-art" src={currentPhase.art} alt="" />
        <span className="manga-sfx" aria-hidden="true">ゴゴゴ</span>
        <div><span className="manga-chapter">第{trainingWeek + 1}話 · Capitolo {trainingWeek + 1}</span><h1>{currentPhase.name}</h1><p>Oggi circa {targetFor(today).toLocaleString('it-IT')} kcal. Si sale piano: 0,2–0,3 kg a settimana, muscolo prima del grasso.</p></div>
      </section> : <section className="cut-hero">
        <div className="cut-hero-copy"><span className="cut-kicker">IL TUO PERCORSO • {TRAINING_WEEKS} SETTIMANE</span><h1>Il prossimo<br /><em>livello.</em></h1><p>{!fixedMenu ? (fuel ? `${fuelGoal === 'bulk' ? 'Bulk' : 'Cut'}: circa ${fuel.kcal.toLocaleString('it-IT')} kcal e ${fuel.protein} g di proteine al giorno. ` : '') : profile ? `Da ${formatKg(profile.startWeightKg)} kg verso ${formatKg(profile.targetWeightKg)} kg. ` : ''}Forza, velocità e continuità. Una giornata alla volta.</p></div>
        <img src="/avatar8.png" alt="" className="cut-hero-art" /><button type="button" className="cut-hero-summon" onClick={summonChase} aria-label="Evoca il drago" />
        <div className="cut-hero-line" />
      </section>}
      <section className="cut-status">
        <div><small>OBIETTIVO</small><strong>{profile ? <><CountUp value={profile.targetWeightKg} decimals={2} /> <span>kg</span></> : '—'}</strong></div><div><small>OGGI</small><strong><CountUp value={targetFor(today)} /> <span>kcal*</span></strong></div><div><small>FASE</small><strong>{currentPhase.name}</strong></div>
      </section>
      {(fixedMenu ? !profile : !fuel) && <button className="cut-setup" onClick={() => onNavigate(fixedMenu ? 'progress' : 'food')}><span><small>PRIMO PASSO</small><b>Imposta il tuo profilo</b><em>Peso, obiettivo e altezza: calorie e progressi si adattano a te.</em></span><ArrowRight size={18} /></button>}
      <p className="cut-fine">*Stima iniziale. Adattala alla media del peso, alla vita e all’energia negli allenamenti.</p>
      <section className="cut-section"><div className="cut-section-title"><span>OGGI / {dayNames[today].toUpperCase()}</span><button onClick={() => onNavigate('program')}>Settimana <ArrowRight size={15} /></button></div>
        <div className={`cut-feature cut-${todayTraining.type}`}><div className="cut-feature-icon">{sessionIcon(todayTraining.type)}</div><div>{todayTraining.duration !== '—' && <small>{todayTraining.duration}</small>}<h2>{todayTraining.short}</h2><p>{todayTraining.detail}</p></div></div>
        <div className="cut-actions"><button onClick={() => onNavigate('program')}>{isRestDay(todayTraining) ? 'Vedi la settimana' : 'Apri sessione'} <ArrowRight size={16} /></button><button onClick={() => onNavigate('food')}>{fixedMenu ? 'Pasti di oggi' : 'Diario calorie'} <Utensils size={16} /></button></div>
      </section>
      <ThisWeekCard log={trainingLog} days={trainingDays} week={planWeekIndex(new Date(), planStart)} start={planStart} onOpen={() => onNavigate('progress')} />
      <section className="cut-section"><div className="cut-section-title"><span>IL TUO SEGNALE</span><button onClick={() => onNavigate('progress')}>Progressi <ArrowRight size={15} /></button></div>
        <div className="cut-metrics"><div><small>PESO RECENTE</small><b>{latestWeight ? <><CountUp value={round1(latestWeight)} decimals={1} /> kg</> : 'Da registrare'}</b></div><div><small>GIROVITA</small><b>{latestWaist ? `${round1(latestWaist)} cm` : profile?.startWaistCm ? `${formatKg(profile.startWaistCm)} cm iniziali` : 'Da registrare'}</b></div></div>
        <p className="cut-fine">{todayLog?.consumed ? `Oggi hai registrato circa ${Math.round(todayLog.consumed)} kcal nel diario.` : 'Registra cibo e bevande nel diario, anche con quantità approssimative.'}</p>
      </section>
      <section className={`cut-creatine ${creatineTaken ? 'taken' : ''}`}><div className="cut-creatine-icon"><ProtocolIcon name="creatine" size={24} /></div><div><small>ABITUDINE QUOTIDIANA</small><h2>Creatina monoidrato</h2><p>3–5 g al giorno, se hai scelto di assumerla. Può far salire il peso iniziale per acqua nei muscoli.</p><button onClick={toggleCreatine}>{creatineTaken ? <Check size={15} /> : <Plus size={15} />}{creatineTaken ? 'Presa oggi' : <>Segna come presa <span className="cut-xp">+{XP.creatine} XP</span></>}</button></div></section>
      <section className="cut-section cut-brief"><span className="cut-kicker">LA REGOLA DI OGGI</span><p>{rules[today % rules.length]}</p></section>
    </>}

    {view === 'mma' && <MmaAcademy onNavigate={onNavigate} />}

    {view === 'food' && !fixedMenu && <FuelTracker profile={profile} saveProfile={saveProfile} weightKg={latestWeight} systemLogs={systemLogs} onLogFood={onFoodEvent} onUndoFood={onFoodEvent} onTargets={onFuelTargets} />}
    {view === 'food' && fixedMenu && <>
      {massPlan ? <section className="cut-page-head"><span className="cut-kicker">{totalWeeks * 7} GIORNI • {totalWeeks} SETTIMANE</span><h1>Mangia.<br /><em>Cresci.</em></h1><p>Gli stessi piatti di Emanuele negli stessi giorni, con le dosi per mettere massa. Un piatto non ti piace? Cambialo tra le alternative: calorie e proteine restano in regola.</p></section> : <section className="cut-page-head"><span className="cut-kicker">{TOTAL_WEEKS * 7} GIORNI • {TOTAL_WEEKS} SETTIMANE</span><h1>Mangia bene.<br /><em>Con gusto.</em></h1><p>Cucina da tutto il mondo, pesce almeno 3 volte a settimana, dolci con la tua whey al cioccolato-wafer e alternative per ogni piatto. McDonald’s, pizza e cocktail restano fino alla settimana 14. Dal 28/12 il supercut: meno cereali e condimenti, stesse proteine.</p></section>}
      <div className="cut-week-picker"><button aria-label="Settimana precedente" onClick={() => setWeek((n) => Math.max(0, n - 1))}><ChevronLeft size={20} /></button><span>SETTIMANA <strong>{week + 1}</strong> / {totalWeeks}</span><button aria-label="Settimana successiva" onClick={() => setWeek((n) => Math.min(totalWeeks - 1, n + 1))}><ChevronRight size={20} /></button></div>
      <div className="cut-day-strip">{dayNames.map((name, index) => <button key={name} className={day === index ? 'active' : ''} onClick={() => setDay(index)}>{name.slice(0, 3)}</button>)}</div>
      <section className="cut-meal-head"><span>{selectedMeal.day}</span><strong>obiettivo ≈ {dayTarget(day, selectedMeal.target).toLocaleString('it-IT')} kcal</strong></section>
      <div className="cut-plan-totals"><span><small>NEL PIANO</small><b>≈ {planTotals.kcal.toLocaleString('it-IT')} kcal</b></span><span className={planTotals.protein < (massPlan ? 122 : 140) ? 'low' : ''}><small>PROTEINE</small><b>≈ {planTotals.protein} g</b></span><span className={planTotals.fiber < 25 ? 'low' : ''}><small>FIBRE</small><b>≈ {planTotals.fiber} g</b></span></div>
      {!massPlan && planTotals.protein < 140 && <p className="cut-note">Proteine un po’ basse oggi: aggiungi uno shake con la tua whey al cioccolato-wafer (30 g ≈ +23 g).</p>}

      {selectedMeal.slots.map((slot, index) => { const { id, label, meal, swappedFrom, swapReason } = slot; const recipe = recipeFor(meal); const canRate = Boolean(week < oldWeeks ? swapGroup(day, index) : slot.family); const alternatives = alternativesFor(slot, mealPrefs); return <div className={`cut-meal-row cut-meal-${index}`} key={label}><button type="button" className="cut-meal" onClick={() => openMeal(label, meal, id)} aria-label={`Ricetta: ${recipe?.title || label}`}>{slotImage(label) ? <img className="cut-meal-image" src={slotImage(label)} alt="" loading="lazy" onError={() => imageMissing(slotImage(label))} /> : <span className="cut-meal-image cut-meal-icon" aria-hidden="true"><ProtocolIcon name={/calcio/i.test(label) ? 'football' : 'food'} size={34} /></span>}<div className="cut-meal-copy"><span>0{index + 1} / {label}</span><p>{meal}</p>{swappedFrom && <small className="cut-meal-swap">{swapReason === 'scelta' ? `Scelto da te al posto di ${recipeFor(swappedFrom)?.title || swappedFrom}` : swapReason === 'gusto' ? `👎 al posto di ${recipeFor(swappedFrom)?.title || swappedFrom}` : `al posto di ${recipeFor(swappedFrom)?.title || swappedFrom}: tiene la settimana in equilibrio`}</small>}{recipe && <em className="cut-meal-macros">≈ {recipe.kcal} kcal · {recipe.protein} g proteine{recipe.tags?.includes('sera prima') ? ' · 🌙 sera prima' : ''} · <b>Ricetta</b></em>}</div><ArrowRight size={16} className="cut-meal-go" /></button>{canRate && thumbs(id)}{alternatives.length > 0 && <button type="button" className="cut-alt-open" onClick={() => setAltSlot(slot)}><Shuffle size={13} aria-hidden="true" /> {alternatives.length} alternative con gli stessi valori</button>}</div>; })}
      {selectedMeal.note && <p className="cut-note">{selectedMeal.note}</p>}
      {week >= oldWeeks && <section className="cut-section cut-week-tools">
        {peoplePicker}
        <details><summary>🛒 Spesa della settimana</summary><ul className="cut-shop">{weekShopping(plannedWeeks[week], people).map(([name, grams]) => <li key={name}><span>{name}</span><b>{grams >= 1000 ? `${(grams / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg` : `${Math.round(grams)} g`}</b></li>)}</ul><p className="cut-fine">Solo le ricette: piadine, pasti fissi e frutta a parte. Pollo, macinato e merluzzo costano meno comprati in blocco e congelati.</p></details>
        <details><summary>🍳 Il weekend prima: cosa preparare</summary><ul className="cut-shop">{weekPrep(plannedWeeks[week]).map((dish) => <li key={dish.id}><span>{dish.title}{dish.freezer ? ' · ❄️ si congela' : ''}</span><b>{dish.prepMin} min</b></li>)}</ul></details>
      </section>}
      <p className="cut-fine">Le calorie del giorno sono una stima. Quantità e prodotti reali possono cambiare molto il totale: usa il diario per calibrare le porzioni.</p>
      <button className="cut-primary" onClick={() => onNavigate('system')}>Registra ciò che hai mangiato <ArrowRight size={17} /></button>
      {!massPlan && <section className="cut-section"><div className="cut-section-title"><span>FIT PORN / RICETTE</span><BookOpen size={16} /></div><div className="cut-recipes">{recipes.filter((recipe) => mealPrefs[recipe.id] !== 'down').map((recipe) => <button className="cut-recipe" key={recipe.title} onClick={() => setSelectedRecipe(recipe)}>{missingImages[recipe.image] ? <i className="cut-recipe-icon" aria-hidden="true"><ProtocolIcon name="food" size={30} /></i> : <img src={recipe.image} alt="" onError={() => imageMissing(recipe.image)} />}<span><small>{recipe.tag}</small><b>{recipe.title}</b></span><ArrowRight size={17} /></button>)}</div></section>}
      <section className="cut-section cut-tastes"><div className="cut-section-title"><span>I TUOI GUSTI</span><ThumbsUp size={16} /></div>{likedIds.length || dislikedIds.length ? <><p className="cut-fine">👍 non vengono mai tolti e sono i primi sostituti. 👎 escono da tutte le settimane: al loro posto entra un piatto simile che tiene calorie, proteine, fibre, pesce e legumi in regola. Tocca un piatto per togliere il pollice.</p>{[[likedIds, 'up', '👍 Ti piacciono'], [dislikedIds, 'down', '👎 Non ti piacciono']].map(([ids, value, title]) => ids.length > 0 && <div className="cut-taste-group" key={value}><small>{title} · {ids.length}</small><div>{ids.map((id) => <button type="button" key={id} className={`cut-taste ${value}`} onClick={() => setMealPref(id, value)} aria-label={`Togli il pollice da ${DISH_TITLE[id]}`}>{DISH_TITLE[id]} <span aria-hidden="true">×</span></button>)}</div></div>)}</> : <p className="cut-fine">Metti 👍 o 👎 sui piatti del menu: li ricordo qui. Un 👎 sostituisce quel piatto in tutte le settimane con uno simile, senza uscire dalla dieta.</p>}</section>
      <section className="cut-section"><div className="cut-section-title"><span>COME USARE IL PIANO</span></div>{rules.map((rule) => <p className="cut-rule" key={rule}>{rule}</p>)}</section>
    </>}

    {view === 'program' && <>
      {massPlan ? <section className="cut-page-head"><span className="cut-kicker">3 SEDUTE • ≈ 45 MIN</span><h1>Allenati<br /><em>per crescere.</em></h1><p>Martedì, giovedì e sabato, sempre tutto il corpo. Martedì e sabato con Emanuele, giovedì per conto tuo.</p></section> : <section className="cut-page-head"><span className="cut-kicker">CALCIO • FORZA • VELOCITÀ</span><h1>Allenati<br /><em>con metodo.</em></h1><p>Il calcio resta fisso lunedì e giovedì. I carichi più impegnativi per le gambe arrivano sabato.</p></section>}
      <div className="cut-week-picker"><button aria-label="Settimana precedente" onClick={() => setTrainingWeek((n) => Math.max(0, n - 1))}><ChevronLeft size={20} /></button><span>SETTIMANA <strong>{trainingWeek + 1}</strong> / {TRAINING_WEEKS}</span><button aria-label="Settimana successiva" onClick={() => setTrainingWeek((n) => Math.min(TRAINING_WEEKS - 1, n + 1))}><ChevronRight size={20} /></button></div>
      <p className="cut-fine">{massPlan ? 'Scrivi il carico sotto ogni esercizio: più ripetizioni o più peso con la stessa tecnica vuol dire che stai crescendo. Quando arrivi in cima alle ripetizioni in tutte le serie, aumenta.' : 'Finché sei in deficit il muscolo cresce poco per tutti: se braccia e cosce non calano e le ripetizioni salgono, sta funzionando. Scrivi il carico sotto ogni esercizio, così vedi se avanzi.'}</p>
      <p className="cut-note"><strong>{currentPhase.name}:</strong> {currentPhase.detail}</p>
      <div className="cut-phase-list">{phases.map((phase) => <details key={phase.weeks}><summary><span>SETTIMANE {phase.weeks}</span><b>{phase.name}</b></summary><p>{phase.detail}</p></details>)}</div>
      <div className="cut-day-strip">{dayNames.map((name, index) => <button key={name} className={day === index ? 'active' : ''} onClick={() => setDay(index)}>{name.slice(0, 3)}</button>)}</div>
      <section className={`cut-feature cut-${trainingDays[day].type}`}><div className="cut-feature-icon">{sessionIcon(trainingDays[day].type)}</div><div>{trainingDays[day].duration !== '—' && <small>{trainingDays[day].duration}</small>}<h2>{trainingDays[day].short}</h2><p>{trainingDays[day].detail}</p></div></section>
      {trainingDays[day].focus && <p className="cut-note"><strong>Un solo obiettivo in campo:</strong> {trainingDays[day].focus}</p>}
      {trainingDays[day].exercises && <><button className={`cut-toggle ${light ? 'active' : ''}`} onClick={() => setLight((n) => !n)}>{light ? 'Versione leggera attiva' : 'Sono stanco: versione leggera'} <RotateCcw size={15} /></button><div className="cut-exercises">{(light ? trainingDays[day].exercises.filter(([, , info]) => info?.light) : trainingDays[day].exercises).map(([name, prescription, info = {}], index, list) => <React.Fragment key={name}>{info.block && info.block !== list[index - 1]?.[2]?.block && <h3 className="cut-block-title">{info.block}</h3>}<div className={`cut-exercise ${exerciseVideo?.name === name ? 'open' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><div className="cut-exercise-main"><b>{name}</b><small>{light && info.block?.startsWith('Superserie') ? '2 serie facili, 3 ripetizioni di margine' : (trainingWeek < 7 || trainingWeek === 10) && info.block?.startsWith('Superserie') ? prescription.replace(/^3 ×/, '2 ×') : prescription}</small>{info.cue && <small className="cut-exercise-cue">{info.cue}</small>}{info.block?.startsWith('Superserie') && <input className="cut-lift" aria-label={`Ultima volta: ${name}`} placeholder="Ultima volta, es. 16 kg × 12" value={saved.lifts?.[name] || ''} onChange={(e) => { const text = e.target.value.slice(0, 40); setSaved((prev) => ({ ...prev, lifts: { ...prev.lifts, [name]: text } })); }} />}
        {exerciseVideo?.name === name && (() => { const videos = videosFor(name); const current = videos[exerciseVideo.index] || videos[0]; return <div className="cut-exercise-video">
          {videos.length > 1 && <div className="cut-video-tabs">{videos.map((video, videoIndex) => <button type="button" key={video.id} className={videoIndex === exerciseVideo.index ? 'active' : ''} onClick={() => setExerciseVideo({ name, index: videoIndex })}>{video.label}</button>)}</div>}
          <iframe key={current.id} className="cut-video-frame" title={`Video tecnica: ${name}`} src={`https://www.youtube-nocookie.com/embed/${current.id}?rel=0&modestbranding=1&playsinline=1`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          <small className="cut-video-credit">Video di {current.channel} · YouTube, in inglese</small>
        </div>; })()}
      </div>{videosFor(name).length > 0 && <button type="button" className="cut-exercise-play" aria-expanded={exerciseVideo?.name === name} aria-label={`${exerciseVideo?.name === name ? 'Chiudi' : 'Guarda'} il video: ${name}`} onClick={() => setExerciseVideo((prev) => (prev?.name === name ? null : { name, index: 0 }))}><PlayCircle size={22} /></button>}</div></React.Fragment>)}</div><p className="cut-fine">{trainingDays[day].type === 'football' ? 'Dolore forte a femorali, inguine, tendine o ginocchio: fermati e dillo all’allenatore. Gambe pesanti o meno di 6 ore di sonno: fai solo i primi due punti. Femorali ancora rigidi dal sabato: scatti sotto l’85%.' : trainingDays[day].type === 'strength' ? 'Superserie: fai il primo esercizio, subito il secondo, poi riposa 75 secondi e ripeti. Negli esplosivi fermati appena rallenti. Tutto il resto: chiudi la serie vicino al limite, con tecnica pulita.' : 'Riposa 60–90 s tra le serie. Ferma la serie quando la tecnica peggiora.'}</p></>}
      {isRestDay(trainingDays[day]) ? <p className="cut-note">Giorno di riposo: niente da segnare. Il recupero fa parte del piano.</p> : <button className={`cut-primary ${completed[`${trainingWeek}-${day}`] ? 'done' : ''}`} onClick={() => completeSession(day)}>{completed[`${trainingWeek}-${day}`] ? <Check size={18} /> : <Plus size={18} />}{completed[`${trainingWeek}-${day}`] ? 'Sessione completata' : <>Segna come completata <span className="cut-xp">+{XP.session} XP</span></>}</button>}
      <section className="cut-section"><div className="cut-section-title"><span>VIDEO TECNICA</span><PlayCircle size={18} /></div><button className="cut-video" onClick={() => setVideoOpen((n) => !n)}><img src="/avatar7.png" alt="" /><span><PlayCircle size={28} /><b>{videoOpen ? 'Nascondi video' : 'Guarda le dimostrazioni'}</b><small>Riscaldamento, squat, trazioni • NHS</small></span></button>{videoOpen && <div className="cut-video-links"><div className="cut-video-tabs">{[['1763945815001', 'Warm-up'], ['1763919389001', 'Squat'], ['1763919425001', 'Trazioni']].map(([id, label]) => <button key={id} className={videoId === id ? 'active' : ''} onClick={() => setVideoId(id)}>{label}</button>)}</div><iframe key={videoId} className="cut-video-frame" title="Dimostrazione tecnica NHS" src={`https://players.brightcove.net/79855382001/EkC1XU82e_default/index.html?videoId=${videoId}`} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" /><a href="https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/" target="_blank" rel="noreferrer">Altri video NHS <ArrowRight size={15} /></a></div>}</section>
      <button className="cut-secondary" onClick={() => onNavigate('training')}>Apri il vecchio laboratorio allenamento <ArrowRight size={16} /></button>
    </>}

    {view === 'progress' && <>
      <section className="cut-page-head"><span className="cut-kicker">MISURA • ADATTA • CONTINUA</span><h1>Vedi il<br /><em>cambiamento.</em></h1><p>Conta la tendenza di più settimane, non il numero di una singola pesata.</p></section>
      <div className="wk-tabs" role="tablist" aria-label="Sezioni dei progressi">{[['anno', 'Anno'], ['settimane', 'Settimane'], ['forza', 'Forza'], ['corpo', 'Corpo'], ['profilo', 'Profilo']].map(([id, label]) => <button type="button" role="tab" aria-selected={progressTab === id} key={id} className={progressTab === id ? 'active' : ''} onClick={() => setProgressTab(id)}>{label}</button>)}</div>
      {progressTab === 'anno' && <YearStats log={trainingLog} progress={progress} start={planStart} currentWeek={planWeekIndex(new Date(), planStart)} />}
      {progressTab === 'settimane' && <>
        <WeeksHistory log={trainingLog} start={planStart} currentWeek={planWeekIndex(new Date(), planStart)} />
      <TrainingLog />
      </>}
      {progressTab === 'forza' && <StrengthPanel progress={progress} onAddMeasure={() => setProgressTab('corpo')} />}
      {progressTab === 'corpo' && <>
      {profile && <div className="cut-goal"><div><small>PARTENZA</small><b>{formatKg(profile.startWeightKg)} kg</b></div><div className="cut-goal-track" role="progressbar" aria-label="Avanzamento verso l'obiettivo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalPct)}><span style={{ transform: `scaleX(${goalPct / 100})` }} /></div><div><small>OBIETTIVO</small><b>{formatKg(profile.targetWeightKg)} kg</b></div></div>}
      <WeightTrend progress={progress} startWeight={profile?.startWeightKg} targetWeight={profile?.targetWeightKg} />
      <form className="cut-form" onSubmit={saveMeasure}><label>Peso del mattino (kg)<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="es. 86,2" /></label><label>Girovita (cm)<input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="es. 91" /></label><label>Piegamenti consecutivi<input inputMode="numeric" value={pushups} onChange={(e) => setPushups(e.target.value)} placeholder="es. 30" /></label><label>Trazioni consecutive<input inputMode="numeric" value={pullups} onChange={(e) => setPullups(e.target.value)} placeholder="es. 3" /></label><label>Carico di riferimento (kg per manubrio)<input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} placeholder="es. 12" /></label><button className="cut-primary" type="submit">Salva misura <Plus size={17} />{!saved.xpAwarded?.[`measure-${todayKey}`] && <span className="cut-xp">+{XP.measure} XP</span>}</button></form>
      <section className="cut-section"><div className="cut-section-title"><span>STORICO MISURE</span></div>{progress.length ? [...progress].reverse().map((entry, index) => <div className="cut-history" key={`${entry.date}-${index}`}><span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span><b>{entry.weight ? `${round1(entry.weight)} kg` : entry.pushups ? `${entry.pushups} pieg.` : '—'}</b><b>{entry.waist ? `${round1(entry.waist)} cm` : entry.pullups ? `${entry.pullups} traz.` : entry.load ? `${round1(entry.load)} kg` : '—'}</b></div>) : <p className="cut-fine">La prima misura del mattino avvierà lo storico dei progressi.</p>}</section>
      </>}
      {progressTab === 'profilo' && <>
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
      <section className="cut-section"><div className="cut-section-title"><span>CHECK OGNI 4 SETTIMANE</span></div><p className="cut-rule">Segna anche quante trazioni e piegamenti consecutivi riesci a fare e i carichi usati. Se forza, energia o prestazioni calano troppo, alleggerisci l’allenamento e rivedi l’apporto energetico.</p><p className="cut-rule">Le stime di massa grassa della bilancia OKOK servono solo come riferimento: peso medio, girovita e prestazioni sono più utili per questo percorso.</p></section>
      <section className="cut-section"><div className="cut-section-title"><span>FONTI DEL PROTOCOLLO</span></div>{(massPlan ? massaEvidence : evidence).map((source) => <a className="cut-source" href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={15} /></a>)}</section>
      </>}
    </>}
    {altSlot && <MealAlternatives slot={altSlot} dishes={alternativesFor(altSlot, mealPrefs)} plannedTitle={recipeFor(altSlot.swappedFrom)?.title} missingImages={missingImages} onImageMissing={imageMissing} onPick={(id) => setMealPick(altSlot, id)} onReset={() => setMealPick(altSlot, null)} onOpen={(dish) => setSelectedRecipe({ ...dish, tag: `${altSlot.label} • ${dish.time}` })} onClose={() => setAltSlot(null)} />}
    {selectedRecipe && <div className="cut-modal-backdrop" onClick={() => setSelectedRecipe(null)}><div className="cut-modal" role="dialog" aria-modal="true" aria-labelledby="cut-recipe-title" onClick={(e) => e.stopPropagation()}><button className="cut-close" onClick={() => setSelectedRecipe(null)}>Chiudi</button>{selectedRecipe.image && !missingImages[selectedRecipe.image] && <img src={selectedRecipe.image} alt="" onError={() => imageMissing(selectedRecipe.image)} />}<small>{selectedRecipe.tag}</small><h2 id="cut-recipe-title">{selectedRecipe.title}</h2>{SWAPPABLE.has(selectedRecipe.id) && <>{thumbs(selectedRecipe.id, true)}{mealPrefs[selectedRecipe.id] === 'down' && <p className="cut-thumbs-note">Fatto: non comparirà più nel piano, al suo posto c’è un piatto simile. Premi di nuovo 👎 per riaverlo.</p>}{mealPrefs[selectedRecipe.id] === 'up' && <p className="cut-thumbs-note">Salvato: non lo tolgo mai, ed è tra i primi sostituti.</p>}</>}{selectedRecipe.kcal && <div className="cut-macro-chips"><span>≈ {selectedRecipe.kcal} kcal</span><span>{selectedRecipe.protein} g proteine</span>{selectedRecipe.fiber != null && <span>{selectedRecipe.fiber} g fibre</span>}{selectedRecipe.cost != null && <span>≈ {selectedRecipe.cost.toFixed(2).replace('.', ',')} € a porzione</span>}{selectedRecipe.tags?.includes('sera prima') && <span>🌙 si prepara la sera prima</span>}</div>}{selectedRecipe.why && <p className="cut-fine">{selectedRecipe.why}</p>}<h3>Ingredienti</h3>{selectedRecipe.dose ? <>{peoplePicker}<ul className="cut-ingredients">{selectedRecipe.dose.map((item) => <li key={item[0]}>{doseLine(item, people)}</li>)}</ul></> : Array.isArray(selectedRecipe.ingredients) ? <ul className="cut-ingredients">{selectedRecipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{selectedRecipe.ingredients}</p>}<h3>Preparazione</h3>{Array.isArray(selectedRecipe.steps) ? <ol className="cut-steps">{selectedRecipe.steps.map((step) => <li key={step}>{step}</li>)}</ol> : <p>{selectedRecipe.steps}</p>}{selectedRecipe.kcal && <p className="cut-fine">Valori stimati sulle quantità indicate: condimenti e marche li cambiano. Registra nel diario quello che mangi davvero.</p>}</div></div>}
  </main>;
}

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Lightbulb, Trophy, ScanSearch, Play, Pause, Target, FlipHorizontal2, Volume2, VolumeX, Bone, X, Move, ThumbsUp, ThumbsDown } from 'lucide-react';
import { BREATHING_PROTOCOLS } from '../../lib/breathingProtocols.js';
import { getDiscipline } from '../../lib/martialKnowledge.js';
import { analyzeKinematics, fatigueFromTrend, detectKicks, kickLevelFromMatch } from '../../lib/kinematics.js';
import { createRepCounter } from '../../lib/repCounter.js';
import { techniquesByCat, CAT_LABEL } from '../../lib/techniques.js';
import { fighterLevel, pillarLevels, evalUnlock, lvlToFl, levelTitle } from '../../lib/progression.js';
import RepCoach from '../components/RepCoach';
import ShadowSparring from '../components/ShadowSparring';
import { masteryFromXp } from '../../lib/mastery.js';
import { playEpicDing, playComboHit, playSample } from '../utils/sfx';
import { speakSystem } from '../utils/systemVoice';
import ComboFx from '../components/ComboFx';
import QuestPanel from '../components/QuestPanel';
import SystemHud from '../components/SystemHud';
import AwakeningFx from '../components/AwakeningFx';
import { ShadowSoldier, ShadowRiseFx } from '../components/ShadowArmy';
import { secretsFor, secretOfTheDay } from '../../lib/coachSecrets.js';
import { MARKER_RE, canonicalMarker, normalizeCoachingText, extractCommand } from '../../lib/coachingText.js';
import { buildCoachWorkout } from '../../lib/workouts.js';
import { applyXp } from '../utils/xpLogic';
import '../styles/mma-studio.css';
import { describeProfile, readCutProfile } from '../utils/cutProfile';

// ─── Quick prompts ─────────────────────────────────────────────────────────────
// Il tab Live (camera) è il pezzo più pesante: si scarica solo quando lo apri.
const VisualCoach = lazy(() => import('./CoachVisual.jsx'));

// {PROFILE} viene sostituito col profilo Cut di chi usa questo telefono.
const personalizePrompts = (prompts) => {
  const summary = describeProfile(readCutProfile());
  return prompts.map((prompt) => ({ ...prompt, text: prompt.text.replace('{PROFILE}', summary) }));
};
const COACH_QUICK = [
  { label: '🗺️ Piano della settimana', text: 'Guarda il mio percorso e dimmi cosa allenare questa settimana per avvicinarmi alla prossima milestone: giorni, drill e obiettivi misurabili.' },
  { label: '🛡️ Difesa personale da 0', text: 'Voglio diventare fortissimo nella difesa personale partendo da zero. Costruiscimi il percorso: cosa imparare per primo, quante sessioni a settimana e come misurare i progressi.' },
  { label: '🥊 Sblocca la milestone', text: 'Analizza a che punto sono nel curriculum e dammi un drill specifico per superare la milestone del mio livello attuale.' },
  { label: '📊 Macro per il cut', text: '{PROFILE} Allenamento: calcio lunedì e giovedì e due sedute di forza. Aiutami a calibrare le porzioni sulle misure e sulla prestazione.' },
  { label: '🥋 Conditioning marziale', text: 'Crea un piano di conditioning per un praticante di arti marziali, 3 sessioni/settimana: esplosività, grip, collo, core.' },
  { label: '😴 Recupero e sonno', text: 'Come ottimizzare il recupero muscolare e il sonno per massimizzare i guadagni?' },
];

const TRAINER_QUICK = [
  { label: '🔥 Piano calorico', text: '{PROFILE} Allenamento: calcio lunedì e giovedì, forza due giorni; cut graduale. Stima un punto di partenza e spiegami come adattarlo alla media del peso, al girovita e all’energia.' },
  { label: '🥗 Piano pasti 7gg', text: 'Adatta una settimana del mio piano alimentare al cut. Mantieni McDonald’s mercoledì sera, pasta bianca e carne di cavallo sabato pranzo, pizza domenica sera e ricette fit porn negli altri pasti.' },
  { label: '💪 Scheda arti marziali', text: 'Crea una scheda di allenamento per migliorare forza esplosiva, mobilità e resistenza specifica per le arti marziali (3-4x settimana).' },
  { label: '🥊 Migliori esercizi', text: 'Quali sono i 10 esercizi più efficaci per un praticante di arti marziali che vuole migliorare potenza, velocità e resistenza?' },
  { label: '💊 Creatina', text: 'Spiegami in modo pratico cosa sappiamo sulla creatina monoidrato per allenamento di forza e sprint, dose quotidiana tipica, possibili effetti sul peso e quando parlarne con un professionista.' },
  { label: '🍳 Ricetta post-workout', text: 'Dammi 3 ricette post-allenamento veloci, almeno 40g di proteine, con macro precisi.' },
];

// ─── Discipline ────────────────────────────────────────────────────────────────
const DISCIPLINE_GROUPS = [
  { label: '👤 Solo', items: [
    { id: 'muaythai',   emoji: '🥊', label: 'Muay Thai',   prompt: 'Guida la mia sessione di Muay Thai. Analizza tecnica, postura e di\' cosa fare.' },
    { id: 'boxing',     emoji: '🥊', label: 'Boxe',        prompt: 'Guida la mia sessione di boxe. Analizza guardia, colpi e footwork.' },
    { id: 'kickboxing', emoji: '🦵', label: 'Kickboxing',  prompt: 'Guida la mia sessione di kickboxing. Analizza pugni e calci.' },
    { id: 'karate',     emoji: '🥋', label: 'Karate',      prompt: 'Guida la mia sessione di karate. Analizza kihon, kata o kumite.' },
    { id: 'taekwondo',  emoji: '🦵', label: 'Taekwondo',   prompt: 'Guida la mia sessione di taekwondo. Analizza calci e poomsae.' },
    { id: 'bjj',        emoji: '🤼', label: 'BJJ',         prompt: 'Guida la mia sessione di BJJ. Analizza posizioni, guard e submission.' },
    { id: 'wrestling',  emoji: '🤼', label: 'Wrestling',   prompt: 'Guida la mia sessione di wrestling. Analizza stance, shot e mat work.' },
    { id: 'judo',       emoji: '🥋', label: 'Judo',        prompt: 'Guida la mia sessione di judo. Analizza kumi-kata e proiezioni.' },
    { id: 'mma',        emoji: '🏆', label: 'MMA',         prompt: 'Guida la mia sessione MMA. Analizza striking, grappling e transizioni.' },
    { id: 'kravmaga',   emoji: '⚔️', label: 'Krav Maga',  prompt: 'Guida la mia sessione di Krav Maga. Analizza efficacia e reattività.' },
    { id: 'selfdefense', emoji: '🛡️', label: 'Difesa Personale', prompt: 'Guida la mia sessione di difesa personale. Analizza postura, colpi di base, uscite dalle prese e reattività.' },
    { id: 'capoeira',   emoji: '🌀', label: 'Capoeira',   prompt: 'Guida la mia sessione di Capoeira. Analizza ginga, movimenti e fluidità.' },
    { id: 'sambo',      emoji: '🤼', label: 'Sambo',      prompt: 'Guida la mia sessione di Sambo. Analizza takedown, controllo e submission.' },
    { id: 'hapkido',    emoji: '🔄', label: 'Hapkido',    prompt: 'Guida la mia sessione di Hapkido. Analizza leve articolari, proiezioni e calci.' },
    { id: 'wingchun',   emoji: '✋', label: 'Wing Chun',  prompt: 'Guida la mia sessione di Wing Chun. Analizza centreline, chain punch e chi sao.' },
    { id: 'kungfu',     emoji: '🐉', label: 'Kung Fu',    prompt: 'Guida la mia sessione di Kung Fu/Wushu. Analizza stance, forme e tecnica.' },
    { id: 'silat',      emoji: '🗡️', label: 'Silat',      prompt: 'Guida la mia sessione di Pencak Silat. Analizza posture basse, attacchi e geometria del movimento.' },
    { id: 'kendo',      emoji: '⚔️', label: 'Kendo',      prompt: 'Guida la mia sessione di Kendo. Analizza kamae, suburi e attacchi con shinai.' },
    { id: 'sanda',      emoji: '🥊', label: 'Sanda',      prompt: 'Guida la mia sessione di Sanda/Sanshou. Analizza pugni, calci, takedown e clinch.' },
    { id: 'pankration', emoji: '⚡', label: 'Pankration', prompt: 'Guida la mia sessione di Pankration. Analizza striking e grappling in stile antico greco.' },
    { id: 'systema',    emoji: '🌊', label: 'Systema',    prompt: 'Guida la mia sessione di Systema. Analizza respirazione, tensione muscolare e movimenti naturali.' },
    { id: 'lutalivre',  emoji: '🤼', label: 'Luta Livre', prompt: 'Guida la mia sessione di Luta Livre. Analizza clinch, takedown e submission a terra.' },
    { id: 'muayboran',  emoji: '🏺', label: 'Muay Boran', prompt: 'Guida la mia sessione di Muay Boran. Analizza le tecniche tradizionali thailandesi pre-ring.' },
    { id: 'kalaripayattu', emoji: '🐅', label: 'Kalaripayattu', prompt: 'Guida la mia sessione di Kalaripayattu. Analizza vadivu (posture animali), chuvadu (passi) e fluidità del corpo.' },
  ]},
  { label: '💪 Sport & Fitness', items: [
    { id: 'calisthenics', emoji: '💪', label: 'Calistenia',  prompt: 'Guida il mio allenamento a corpo libero. Analizza forma, range of motion e progressione.' },
    { id: 'crossfit',     emoji: '🏋️', label: 'CrossFit',    prompt: 'Guida il mio WOD. Analizza forma, sicurezza articolare e ritmo.' },
    { id: 'yoga',         emoji: '🧘', label: 'Yoga',         prompt: 'Guida la mia sessione di yoga. Analizza allineamento, respiro e postura nelle asana.' },
    { id: 'running',      emoji: '🏃', label: 'Corsa',        prompt: 'Analizza la mia tecnica di corsa. Controlla postura, cadenza e attacco del piede.' },
    { id: 'stretching',   emoji: '🤸', label: 'Mobilità',     prompt: 'Guida il mio stretching/mobilità. Analizza range of motion e progressione degli allungamenti.' },
  ]},
  { label: '👥 Con partner', items: [
    { id: 'sparring_muaythai', emoji: '🥊', label: 'Sparring MT',   prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Muay Thai.' },
    { id: 'sparring_boxing',   emoji: '🥊', label: 'Sparring Boxe', prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Boxe.' },
    { id: 'sparring_mma',      emoji: '🏆', label: 'Sparring MMA',  prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. MMA.' },
    { id: 'partner_drills',    emoji: '🤝', label: 'Drill coppia',  prompt: 'Stiamo facendo drill di coppia — valuta entrambi e proponi il drill successivo.' },
    { id: 'sparring_general',  emoji: '👥', label: 'Sparring free', prompt: 'Siamo in due — arbitraci liberamente e dai consigli a entrambi.' },
  ]},
  { label: '💪 Altro', items: [
    { id: 'fitness', emoji: '🏋️', label: 'Palestra', prompt: 'Guida il mio allenamento in palestra. Analizza forma ed esercizi.' },
    { id: 'breathing', emoji: '🌬️', label: 'Respiro', prompt: 'Guidami in una sessione di respirazione/meditazione. Scegli un protocollo e correggi la mia postura e il ritmo.' },
    { id: 'general', emoji: '👁',  label: 'Generale', prompt: 'Analizza il movimento e guidami. Feedback libero.' },
  ]},
];

// ─── Curriculum ────────────────────────────────────────────────────────────────
const CURRICULUM = {
  muaythai: { name: 'Muay Thai', emoji: '🥊', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab e cross', 'Teep (calcio frontale)', 'Low kick', 'Shadowboxing 3×3min'], milestone: 'Esegui jab-cross-teep con forma corretta' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Mid/high kick', 'Combo 3-5 colpi', 'Parry e difesa', 'Clinch entry', 'Counter jab'], milestone: 'Sparring leggero 3 round' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Gomitate (6 tipi)', 'Ginocchiate in clinch', 'Sweeps', 'Teep come jab', 'Fight IQ base'], milestone: 'Match sparring completo con arbitro' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Clinch avanzato', 'K1 ruleset', 'Footwork da ring', 'Diagonali + teep', 'Fight camp strategy'], milestone: 'Competizione amatoriale' },
  ]},
  boxing: { name: 'Boxe', emoji: '🥊', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab', 'Cross', 'Gancio', 'Footwork base'], milestone: 'Combo 1-2 fluida × 50 ripetizioni' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Uppercut', 'Slip e roll', 'Parry', 'Combo 1-2-3', 'Corpo e testa'], milestone: '3 round sparring leggero' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Head movement', 'Counter-punching', 'Difesa nella corner', 'Feint', 'Jab multiplo'], milestone: 'Sparring 6 round con feedback' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Ring generalship', 'Distance management', 'Body shot setup', 'Fight IQ', 'Competition strategy'], milestone: 'Torneo amatoriale' },
  ]},
  kickboxing: { name: 'Kickboxing', emoji: '🦵', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e stance', 'Jab-cross', 'Roundhouse base', 'Front kick', 'Camera del calcio'], milestone: 'Roundhouse × 20 per lato con forma' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Side kick', 'Back kick', 'Combo pugno+calcio', 'Teep difensivo', 'Parata calci'], milestone: '3 round sparring leggero' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Spinning back kick', 'Flying knee', 'Switch kick', 'Catch and counter', 'Dutch combos'], milestone: 'K1 rules sparring' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Timing avanzato', 'Sweep counter', 'Feint calci', 'Clinch KB', 'Competition prep'], milestone: 'Competizione K1/Kickboxing' },
  ]},
  karate: { name: 'Karate', emoji: '🥋', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Zenkutsu-dachi', 'Oi-zuki', 'Age-uke / Gedan-barai', 'Kata Heian Shodan', 'Kiai e zanshin'], milestone: 'Heian Shodan da memoria' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Mae-geri / Mawashi-geri', 'Kizami-zuki', 'Ippon kumite base', 'Heian Nidan-Sandan', 'Hikite'], milestone: 'Kumite base 1-step sparring' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Yoko-geri / Ushiro-geri', 'Heian Yondan-Godan', 'Jiyu kumite', 'Bunkai applicazioni', 'Kime'], milestone: 'Jiyu kumite 3 minuti' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Bassai-Dai kata', 'WKF competition rules', 'Sanbon kumite', 'Kata avanzate', 'Gara regionale'], milestone: 'Gara WKF/WKSA' },
  ]},
  taekwondo: { name: 'Taekwondo', emoji: '🦵', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Ap-seogi / Ap-kubi', 'Ap-chagi (front kick)', 'Dollyo-chagi (roundhouse)', 'Naeryo-chagi (axe kick)', 'Poomsae Taeguk 1-2'], milestone: 'Taeguk 1 da memoria' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Yeop-chagi (side kick)', 'Dwi-chagi (back kick)', 'Spinning roundhouse', 'Taeguk 3-4', 'Difese di base'], milestone: 'Test cintura gialla' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Dwi-hurigi (spinning heel)', 'Flying side kick', 'Triple kick', 'Poomsae 5-6', 'Sparring WTF'], milestone: 'Sparring competition 3 round' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['540° kick', 'Olympic sparring strategy', 'Poomsae black belt', 'Electronic hogu', 'Gara nazionale'], milestone: 'Gara ITF/WTF' },
  ]},
  bjj: { name: 'BJJ', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Postura e base', 'Guard chiusa', 'Trap & roll (mount escape)', 'Hip escape (shrimping)', 'Rear naked choke'], milestone: 'Uscita da mount e guard 5 volte' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Armbar da guard', 'Triangle choke', 'Single leg takedown', 'Guard pass base', 'Back take'], milestone: 'Rolling 5 round senza gas out' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['De La Riva guard', 'X-guard', 'Heel hook entry', 'Kimura trap', 'Berimbolo intro'], milestone: 'Submission competition bianca/blu' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Worm guard', 'EBI overtime prep', 'Submission chains', 'No-gi specializzazione', 'Competition strategy'], milestone: 'Gara IBJJF/ADCC Trials' },
  ]},
  wrestling: { name: 'Wrestling', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Stance e movement', 'Penetration step', 'Double leg takedown', 'Single leg takedown', 'Sprawl'], milestone: 'Double leg da clinch 10 volte' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Low single', 'High crotch', 'Head lock', 'Granby roll', 'Mat work base'], milestone: '5 round drilling con partner' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Leg ride', 'Cradle (near/far)', 'Power half nelson', 'Throw by', 'Funk wrestling'], milestone: 'Match allenamento wrestling' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Scrambles avanzati', 'Cement job', 'Shooting combination', 'Greco-Romano throws', 'Competition prep'], milestone: 'Gara regionale / torneo MMA' },
  ]},
  judo: { name: 'Judo', emoji: '🥋', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Ukemi (cadute sicure)', 'Kumi-kata (grip)', 'O-soto-gari', 'O-goshi', 'Seoi-nage'], milestone: 'Caduta laterale/posteriore senza paura' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Tai-otoshi', 'Uchi-mata', 'Kuzushi (sbilancio)', 'Kesa-gatame', 'Tate-shiho-gatame'], milestone: 'Randori 3 round cintura gialla' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Ippon-seoi-nage', 'Ko-uchi/O-uchi-gari', 'Harai-goshi', 'Shime-waza', 'Kansetsu-waza'], milestone: 'Shiai (gara) locale' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Grip fighting avanzato', 'Renraku-waza (combo)', 'Ashi-waza', 'Kata avanzate', 'IJF competition rules'], milestone: 'Gara IJF/FIJLKAM' },
  ]},
  mma: { name: 'MMA', emoji: '🏆', levels: [
    { label: 'Fondamenta', weeks: '1-8',   color: 'emerald', topics: ['Striking base (boxe/MT)', 'Grappling base (wrestling/BJJ)', 'Clinch entry e exit', 'Takedown defense', 'Postura nel guard'], milestone: '2 sessioni/sett per 8 settimane' },
    { label: 'Tecnica',    weeks: '9-20',  color: 'blue',    topics: ['Transizioni striking→ground', 'Sprawl & brawl', 'Guard pass in MMA', 'Ground & pound', 'Cage work base'], milestone: 'MMA sparring leggero 3 round' },
    { label: 'Avanzato',   weeks: '21-36', color: 'orange',  topics: ['Dirty boxing nel clinch', 'Standing submission', 'Knee from clinch', 'Scrambles', 'Conditioning MMA-specifico'], milestone: 'Sparring full (protections) 5 round' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Game planning avversario', 'Weight cut basics', 'Fight camp periodization', 'Film study', 'Amateur MMA rules'], milestone: 'Match amatoriale MMA' },
  ]},
  kravmaga: { name: 'Krav Maga', emoji: '⚔️', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia naturale', 'Colpi base (palmo/gomito/ginocchio)', 'Caduta e rialzo', 'Difesa 360°', 'Choke release'], milestone: 'Difesa da choke in 1.5 secondi' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Difesa da pugni diretti', 'Difesa da calci', 'Bear hug releases (4 varianti)', 'Headlock escape', 'Ground defense'], milestone: 'Scenario drill con stress' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Difesa da coltello', 'Difesa da arma da fuoco', 'Aggressori multipli', 'Difesa in auto', 'Stress inoculation'], milestone: 'Scenario multiplo 3 minuti no-stop' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Weapon retention', 'Force continuum', 'Mission-specific training', 'Istruttore P1 prep', 'Scenario avanzati notturni'], milestone: 'Certificazione istruttore P1/P2' },
  ]},

  selfdefense: { name: 'Difesa Personale', emoji: '🛡️', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Consapevolezza situazionale (scan 360°, uscite, mani dell\'aggressore)', 'Postura non-vittima e voce ferma ("STOP" + distanza)', 'Guardia naturale (mani aperte davanti, palmi avanti)', 'Palm heel strike e gomitata (bersagli: naso, mento, gola)', 'Ginocchiata all\'inguine + disimpegno immediato'], milestone: 'Sequenza voce→palm heel→ginocchiata→fuga eseguita fluida × 10' },
    { label: 'Tecnica',    weeks: '7-16',  color: 'blue',    topics: ['Difesa 360° da colpi circolari', 'Uscita da presa al polso, ai capelli e al collo (frontale/laterale)', 'Uscita da bear hug (davanti/dietro, braccia libere/bloccate)', 'Caduta sicura e rialzo tattico (technical stand-up)', 'Difesa a terra: calci dal suolo + rialzo e fuga'], milestone: 'Uscita da 5 prese diverse in meno di 2 secondi ciascuna' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['Stress inoculation: drill con fatica e sorpresa', 'Difesa da spinta+pugno (scenario più comune in strada)', 'Gestione di più aggressori: linea, angoli, non farsi circondare', 'Difesa da minaccia con oggetto contundente (distanza e barriere)', 'De-escalation verbale e lettura dei segnali pre-aggressione'], milestone: 'Scenario a sorpresa 2 minuti: de-escalation o neutralizzazione + fuga' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Scenari complessi: spazi chiusi, auto, ascensore', 'Protezione di terzi (familiare accanto)', 'Sparring protetto con scenario (aggressore attivo)', 'Aspetti legali della difesa legittima e proporzionalità', 'Integrazione striking+grappling sotto adrenalina'], milestone: 'Scenario completo con aggressore protetto: valutazione istruttore' },
  ]},

  capoeira: { name: 'Capoeira', emoji: '🌀', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Ginga (dondolio base)', 'Au (cartwheel)', 'Galpão e role (spostamenti)', 'Meia-lua de frente (calcio frontale)', 'Ritmo del berimbau e canto'], milestone: 'Ginga fluida per 3 minuti senza fermarsi' },
    { label: 'Tecnica',    weeks: '7-16',  color: 'blue',    topics: ['Armada (calcio rotante)', 'Queixada (calcio laterale)', 'Martelo (calcio col tallone)', 'Negativa e esquiva (schivate a terra)', 'Jogo (gioco dialogico con partner)'], milestone: 'Jogo base 5 minuti con partner' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['Macaco (acrobazia saltata)', 'Chapéu de couro (calcio invertito)', 'S-dobrado (sequenza acrobatica)', 'Rasteira (spazzata)', 'Malícia (inganno e lettura del partner)'], milestone: 'Batizado: presentazione nella roda ufficiale' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Parafuso (calcio volante rotante)', 'Au batido (cartwheel con calcio)', 'Angola vs Regional: stili a confronto', 'Musica e strumenti (berimbau, atabaque)', 'Insegnamento e direzione della roda'], milestone: 'Grado superiore e conduzione della roda' },
  ]},

  sambo: { name: 'Sambo', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Stance e kuzushi (sbilancio)', 'Cadute sicure (ukemi SAMBO)', 'Presa al bavero e cintura', 'Sgambetto (podnozhka)', 'Hip throw di base (podsad)'], milestone: 'Hip throw da entrambi i lati × 10' },
    { label: 'Tecnica',    weeks: '5-12',  color: 'blue',    topics: ['Zatsep (harai-goshi variante)', 'Presa alle gambe (double/single leg)', 'Controllo a terra (kesa/side)', 'Footlock base (achilles lock)', 'Grappling jacket sparring leggero'], milestone: 'Match Sport Sambo (no-strike) 3 round' },
    { label: 'Avanzato',   weeks: '13-24', color: 'orange',  topics: ['Heel hook e knee bar', 'Arm bar da standing e ground', 'Sambo rolling (transizioni veloci)', 'Combat Sambo striking base', 'Counter takedown e sprawl'], milestone: 'Torneo regionale Sport Sambo' },
    { label: 'Pro',        weeks: '25+',   color: 'rose',    topics: ['Combat Sambo (striking + grappling + weapon defense)', 'Analisi tattica avversario', 'Periodizzazione gara', 'Grip fighting avanzato', 'Preparazione atletica specifica'], milestone: 'Gara Combat Sambo o Campionato nazionale' },
  ]},

  hapkido: { name: 'Hapkido', emoji: '🔄', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Principi: Hwa (armonia), Won (circolo), Yu (flusso)', 'Postura e cadute (ukemi)', 'Rotazione del polso (leve di base)', 'Calcio frontale e laterale basso', 'Deflettere invece di bloccare'], milestone: 'Tre leve articolari di polso da entrambi i lati' },
    { label: 'Tecnica',    weeks: '5-14',  color: 'blue',    topics: ['Leve di gomito e spalla', 'Proiezioni da presa al polso', 'Calci a media e alta quota', 'Difesa da attacchi col pugno', 'Joint lock flow drill'], milestone: 'Sequenza di difesa da 5 attacchi diversi' },
    { label: 'Avanzato',   weeks: '15-28', color: 'orange',  topics: ['Calci saltati (spinning, flying)', 'Difesa a terra e rialzo', 'Proiezioni a due mani', 'Hapkido vs Hapkido (randori)', 'Difesa da armi (bastone, coltello base)'], milestone: 'Cintura nera 1° Dan: esame tecnico completo' },
    { label: 'Pro',        weeks: '29+',   color: 'rose',    topics: ['Difesa da armi da fuoco', 'Kyusho (punti vitali)', 'Hoshinsul (autodifesa avanzata)', 'Allenamento istruttori', 'Competizione internazionale IHF'], milestone: 'Dan superiore o certificazione istruttore IHF' },
  ]},

  wingchun: { name: 'Wing Chun', emoji: '✋', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Yee Gee Kim Yeung Ma (stance a cavallo)', 'Centreline theory (linea centrale)', 'Chain punch × 100 ogni sessione', 'Pak Sao (deviazione palmo)', 'Tan Sao / Bong Sao / Fook Sao (tre mani base)'], milestone: 'Siu Nim Tao (prima forma) da memoria' },
    { label: 'Tecnica',    weeks: '7-18',  color: 'blue',    topics: ['Chi Sao (mani appiccicose) base', 'Turning stance (Biu Ma)', 'Lap Sao (presa e tiro)', 'Pak Sao counter-punch combo', 'Chum Kiu (seconda forma)'], milestone: 'Chi Sao singola mano fluido 5 minuti' },
    { label: 'Avanzato',   weeks: '19-36', color: 'orange',  topics: ['Chi Sao doppia mano rolling', 'Wooden dummy (Muk Yan Jong) base 10 sezioni', 'Biu Gee (terza forma)', 'Sparring a distanza ravvicinata', 'Trapping hands avanzate'], milestone: 'Wooden dummy 116 tecniche complete' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Luk Dim Boon Kwan (palo lungo)', 'Bart Cham Dao (spade doppie)', 'Insegnamento e analisi concettuale', 'Seminari internazionali', 'Ricerca e confronto tra lignaggi (Ip Man, William Cheung, Wong Shun Leung)'], milestone: 'Certificazione Sifu nel proprio lignaggio' },
  ]},

  kungfu: { name: 'Kung Fu', emoji: '🐉', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Stance fondamentali (ma bu, gong bu, pu bu)', 'Pugni base (chong quan, biao quan)', 'Calci base (zheng ti, ce ti)', 'Rotolamento e cadute', 'Qigong base (respirazione e radicamento)'], milestone: 'Forma corta di base (5 tecniche) da memoria' },
    { label: 'Tecnica',    weeks: '7-20',  color: 'blue',    topics: ['Forma lunga (Chang Quan o Nan Quan)', 'Sparring a mani nude (San Shou base)', 'Uso del bastone (Gun)', 'Accelerazione e potenza nei colpi', 'Flessibilità e splits progressivi'], milestone: 'Gara di Wushu forme base (giudici)' },
    { label: 'Avanzato',   weeks: '21-40', color: 'orange',  topics: ['Forma avanzata (Nanquan/Changquan)', 'San Shou (Sanda) competitivo', 'Bastone avanzato e spada (Jian)', 'Tecniche aeree (wuying jiao, xuan feng jiao)', 'Qigong di livello avanzato'], milestone: 'Competizione Wushu regionale / Cintura arancione Sanda' },
    { label: 'Pro',        weeks: '41+',   color: 'rose',    topics: ['Specializzazione stile (Shaolin, Wing Chun, Tai Chi Chuan)', 'Armi multiple (dao, gun, jian, qiang)', 'Internal arts (Tai Chi, Ba Gua, Xing Yi)', 'Insegnamento e apertura scuola', 'Competizioni internazionali IWUF'], milestone: 'Medaglia in Wushu o Dan superiore nel proprio stile' },
  ]},

  silat: { name: 'Silat', emoji: '🗡️', levels: [
    { label: 'Fondamenta', weeks: '1-5',   color: 'emerald', topics: ['Langkah (passi geometrici)', 'Kuda-kuda (stance basse)', 'Serangan tangan (colpi di mano)', 'Tendangan (calci base)', 'Elakan (schivate angolate)'], milestone: 'Bunga (sequenza di apertura) da memoria' },
    { label: 'Tecnica',    weeks: '6-16',  color: 'blue',    topics: ['Jurus (forme di combattimento)', 'Kuncian (leve e blocchi articolari)', 'Sapuan (spazzate basse)', 'Combattimento a corta distanza', 'Silat con partner (buah)'], milestone: 'Jurus 1-5 con partner (buah pakai)' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['Silat con armi: parang (machete), tongkat (bastone)', 'Kerambit (coltello ad artiglio)', 'Multi-attaccante drill', 'Harimau style (stile tigre, combattimento a terra)', 'Silat Gayong / Cimande / Betawi: stili regionali'], milestone: 'Esibizione completa con arma tradizionale' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Pesilat (guerriero) avanzato', 'Insegnamento del proprio perguruan', 'Competizione PERSILAT internazionale', 'Silat spettacolo vs Silat combattimento', 'Connessione con la tradizione (budaya)'], milestone: 'Guru (insegnante) riconosciuto nel perguruan' },
  ]},

  kendo: { name: 'Kendo', emoji: '⚔️', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Seigan no kamae (guardia)', 'Fumikomi-ashi (passo sfondante)', 'Men-uchi (colpo alla testa)', 'Kote-uchi (colpo al polso)', 'Suburi × 200 ogni sessione'], milestone: 'Men e kote con forma corretta × 50 ripetizioni' },
    { label: 'Tecnica',    weeks: '7-18',  color: 'blue',    topics: ['Do-uchi (colpo al ventre)', 'Tsuki (affondo alla gola)', 'Kirikaeshi (taglio alternato)', 'Oji-waza (tecniche di risposta)', 'Jigeiko (sparring libero) base'], milestone: '3 kyū: esame con arbitro ufficiale' },
    { label: 'Avanzato',   weeks: '19-36', color: 'orange',  topics: ['Shikake-waza (attacco intenzionale)', 'Hiki-waza (colpi in arretramento)', 'Taiatari (corpo a corpo)', 'Nito-ryu (due shinai)', 'Shiai (torneo) regionale'], milestone: 'Shodan (1° Dan) — esame AJKF/IKEFI' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Dan avanzati (2°–5°)', 'Kata (Nihon Kendo no Kata, 10 forme)', 'Arbitraggio ufficiale', 'Naginata e iaido (stili correlati)', 'Competizioni internazionali FIK'], milestone: '3° Dan o arbitro nazionale certificato' },
  ]},

  sanda: { name: 'Sanda', emoji: '🥊', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Guardia e footwork Sanda', 'Jab-cross-gancio (tecnica pugilistica cinese)', 'Tui (calcio frontale spingente)', 'Bian tui (calcio circolare)', 'Zhai (take-down da clinch base)'], milestone: 'Combo jab-cross-tui × 20 per lato' },
    { label: 'Tecnica',    weeks: '5-14',  color: 'blue',    topics: ['Shuai-jiao (grappling cinese)', 'Clinch e spinta fuori dalla pedana', 'Calcio laterale alto', 'Difese da takedown', 'Sanda pad work 3×3 min'], milestone: '3 round sparring Sanda con arbitro' },
    { label: 'Avanzato',   weeks: '15-28', color: 'orange',  topics: ['Leg catch e counter', 'Spinning back kick', 'Takedown a doppia gamba', 'Combinazioni lunghe (5-7 colpi)', 'Tattica: scoring sul ring / pedana'], milestone: 'Torneo Sanda regionale (cintura base)' },
    { label: 'Pro',        weeks: '29+',   color: 'rose',    topics: ['Campionati nazionali WAKO/WKF', 'Film study e analisi avversari', 'Periodizzazione fight camp', 'Weight management', 'Sanda vs K1/MMA: adattamento tattico'], milestone: 'Campionato nazionale Sanda o cintura WKF' },
  ]},

  pankration: { name: 'Pankration', emoji: '⚡', levels: [
    { label: 'Fondamenta', weeks: '1-5',   color: 'emerald', topics: ['Stance antico greco (ortia stasis)', 'Pugni base (sferiamo)', 'Calci diretti e laterali', 'Cadute e prese a terra (pale)', 'Strangolamento posteriore base'], milestone: 'Sparring leggero no-gear 5 minuti' },
    { label: 'Tecnica',    weeks: '6-16',  color: 'blue',    topics: ['Striking in clinch (ano kato)', 'Takedown greco-romano', 'Guard position a terra', 'Braccio di ferro (ankyle)', 'Transizioni strike → grappling'], milestone: 'Match Pankration amatoriale moderno (FILA rules)' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['Submission chain', 'Sprawl e counter takedown', 'Ground & pound controllato', 'Condizionamento antico (dumbells, corsa)', 'Analisi combattimenti storici e moderni'], milestone: 'Torneo FILA Pankration / Grappling open' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Specializzazione striking o grappling', 'Competizioni internazionali UWW', 'Coaching e arbitraggio FILA', 'Connessione con le Olimpiadi antiche (studio)', 'Condizionamento atletico di alto livello'], milestone: 'Campionato mondiale UWW Pankration' },
  ]},

  systema: { name: 'Systema', emoji: '🌊', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Quattro pilastri: respirazione, relax, postura, movimento', 'Cadute sicure in ogni direzione', 'Camminata e respirazione quadrata', 'Colpi morbidi (senza rigidità)', 'Sfuggire dalla presa senza forza'], milestone: 'Caduta da qualsiasi direzione senza paura' },
    { label: 'Tecnica',    weeks: '7-18',  color: 'blue',    topics: ['Striking al sistema nervoso (bersagli specifici)', 'Leve articolari fluide', 'Movimento a spirale (sfera)', 'Difesa da più avversari (principio)', 'Knife defense intro (principi di movimento)'], milestone: 'Partner drill 20 minuti no-stop con respirazione controllata' },
    { label: 'Avanzato',   weeks: '19-36', color: 'orange',  topics: ['Combattimento a terra da qualsiasi posizione', 'Stress inoculation (freddo, paura, fatica)', 'Armi: coltello, bastone, pistola', 'Combattimento in spazio ridotto', 'Allenamento psicologico (paura controllata)'], milestone: 'Scenario multi-attaccante 3 minuti con armi di gomma' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Seminari con maestri certificati (Ryabko, Vasiliev)', 'Insegnamento Systema', 'Applicazioni militari/LE', 'Lavoro energetico (massa, struttura interna)', 'Integrazione con altre arti marziali'], milestone: 'Certificazione istruttore Systema HQ' },
  ]},

  lutalivre: { name: 'Luta Livre', emoji: '🤼', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Stance e grip senza kimono', 'Clinch e collar tie', 'Double leg takedown', 'Single leg e running the pipe', 'Rear naked choke e guillotine base'], milestone: 'Double leg pulito × 10 su partner' },
    { label: 'Tecnica',    weeks: '5-14',  color: 'blue',    topics: ['Achilles lock e toe hold', 'Kneebar base', 'Guard pass no-gi (torreando, over-under)', 'Back take da turtle', 'Rolling 5 round no-gi'], milestone: 'Submission competition no-gi principiante' },
    { label: 'Avanzato',   weeks: '15-28', color: 'orange',  topics: ['Heel hook (inside/outside)', 'Kimura trap system', 'Leg entanglement (50/50, saddle)', 'Scrambles e inversioni', 'Luta Livre vs BJJ: differenze tattiche'], milestone: 'Gara no-gi open / ADCC qualifiers' },
    { label: 'Pro',        weeks: '29+',   color: 'rose',    topics: ['EBI overtime prep', 'Submission chain avanzate', 'Specializzazione lower body o upper body', 'Coaching e analisi film', 'ADCC e competizioni mondiali no-gi'], milestone: 'ADCC Trials o campionato nazionale no-gi' },
  ]},

  muayboran: { name: 'Muay Boran', emoji: '🏺', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Mae mai (tecnica madre, 15 tecniche base)', 'Guardia Boran (mani al petto)', 'Teep con il tallone', 'Gomitate a corta distanza', 'Ram Muay (rituale pre-combattimento)'], milestone: 'Mae mai 1-5 da memoria con forma corretta' },
    { label: 'Tecnica',    weeks: '7-18',  color: 'blue',    topics: ['Luk mai (tecniche figlie, varianti avanzate)', 'Clinch tradizionale (chap ko)', 'Ginocchiate dal clinch (sapato kao)', 'Proiezioni e spazzate antiche', 'Calci saltati e volteggi'], milestone: 'Sequenza Mae mai completa (15 tecniche)' },
    { label: 'Avanzato',   weeks: '19-36', color: 'orange',  topics: ['Armi del corpo: testa, denti, morsi (Boran)', 'Tecniche proibite nel ring moderno', 'Kard Chuek (bendaggio a mani nude)', 'Applicazioni Boran in Muay Thai moderno', 'Studio dei Kru tradizionali (maestri storici)'], milestone: 'Dimostrazione pubblica Muay Boran × 5 tecniche luk mai' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Trasmissione della tradizione come Kru', 'Kard Chuek match (se disponibile)', 'Studio del Krabi Krabong (armi tradizionali thailandesi)', 'Ricerca storica e connessione culturale', 'Insegnamento certificato dalla Thailand Board of Muay Thai'], milestone: 'Certificazione Kru Muay Thai IFMA o WBMT' },
  ]},

  kalaripayattu: { name: 'Kalaripayattu', emoji: '🐅', levels: [
    { label: 'Fondamenta', weeks: '1-8',   color: 'emerald', topics: ['Chuvadu (posizioni dei passi base)', 'Vadivu: gaja (elefante) e simha (leone)', 'Meippayattu 1 (sequenza corpo)', 'Kaal eduppu (sollevamenti di gamba, 8 direzioni)', 'Flessibilità: ponte e affondo profondo'], milestone: 'Meippayattu 1 completa da memoria con kaal eduppu fluidi' },
    { label: 'Tecnica',    weeks: '9-20',  color: 'blue',    topics: ['Vadivu completi (8 posture animali)', 'Meippayattu 2-4', 'Salti e rotazioni (chattom, thirichil)', 'Verumkai: tecniche a mani nude base', 'Marma: introduzione ai punti vitali (teoria)'], milestone: 'Sequenza meippayattu 1-4 senza pause' },
    { label: 'Avanzato',   weeks: '21-40', color: 'orange',  topics: ['Kolthari: kettukari (bastone lungo)', 'Cheruvadi (bastone corto)', 'Otta (bastone curvo, forme avanzate)', 'Verumkai avanzato: leve e proiezioni', 'Combattimento condizionato con partner'], milestone: 'Forma completa con kettukari davanti al Gurukkal' },
    { label: 'Pro',        weeks: '41+',   color: 'rose',    topics: ['Ankathari: spada e scudo (val & paricha)', 'Urumi (spada flessibile, solo con maestro)', 'Marma chikitsa (studio dei punti vitali e cura)', 'Kalari come pratica completa: massaggio e medicina', 'Trasmissione della tradizione'], milestone: 'Riconoscimento del proprio Gurukkal e dimostrazione pubblica' },
  ]},

  calisthenics: { name: 'Calistenia', emoji: '💪', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Push-up (5×10 forma perfetta)', 'Pull-up australiano / pull-up assistito', 'Squat a corpo libero × 20', 'Plank 60 secondi', 'Hollow body hold 30 secondi'], milestone: '10 push-up + 5 pull-up + 20 squat senza fermarsi' },
    { label: 'Tecnica',    weeks: '7-18',  color: 'blue',    topics: ['Dip su parallele', 'Pull-up strict × 10', 'Pike push-up (prep handstand)', 'L-sit 10 secondi su parallele', 'Muscle-up negativo'], milestone: 'Muscle-up su sbarra (1 ripetizione pulita)' },
    { label: 'Avanzato',   weeks: '19-36', color: 'orange',  topics: ['Handstand push-up', 'Front lever progressioni (tucked → straddle → full)', 'Back lever', 'One-arm pull-up progressioni', 'Human flag base (obliquo)'], milestone: 'Front lever 5 secondi + Handstand 10 secondi' },
    { label: 'Pro',        weeks: '37+',   color: 'rose',    topics: ['Planche (straddle → full)', 'One-arm push-up con rotazione', '90° push-up (handstand push-up avanzato)', 'Iron cross su anelli (progressioni)', 'Freestyle calistenia: flow e combinazioni'], milestone: 'Planche straddle 5 sec + Full front lever 5 sec' },
  ]},

  crossfit: { name: 'CrossFit', emoji: '🏋️', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Squat, deadlift, press con forma (PVC)', 'Box jump basso', 'Rowing 500m a ritmo costante', 'Burpees × 10 senza pause', 'Air bike / skierg 5 minuti'], milestone: 'Murph scalato: 800m corsa + 50 pull-up assist + 100 push-up + 150 squat + 800m' },
    { label: 'Tecnica',    weeks: '5-16',  color: 'blue',    topics: ['Clean & jerk con bilanciere (tecnica)', 'Snatch con bilanciere', 'Kipping pull-up', 'Double-under × 50 senza errori', 'Toes-to-bar'], milestone: 'Rx su 3 WOD diversi (Fran, Helen, Grace)' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['Muscle-up su sbarra e anelli', 'Heavy barbell cycling (squat clean, snatch)', 'Handstand walk 10 metri', 'GHD sit-up e back extension', 'CrossFit Open: partecipazione'], milestone: 'CrossFit Open top 50% della propria categoria' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Pegboard, rope climb (no-legs)', 'Legless rope climb', 'Ring muscle-up × 10', 'Total carico Oly: >100% peso corporeo in snatch', 'CrossFit Quarterfinals/Semifinals qualificazione'], milestone: 'CrossFit Regionals qualification o Games athlete' },
  ]},

  yoga: { name: 'Yoga', emoji: '🧘', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Respiro ujjayi (pranayama base)', 'Surya Namaskar A (saluto al sole)', 'Warrior I e II (Virabhadrasana)', 'Downward dog (Adho Mukha Svanasana)', 'Savasana e rilassamento guidato'], milestone: 'Saluto al sole × 5 ripetizioni senza guide' },
    { label: 'Tecnica',    weeks: '7-20',  color: 'blue',    topics: ['Sequenza Ashtanga Primary Series (sezione in piedi)', 'Bilanciamenti: tree pose, warrior III, half moon', 'Backbend: cobra, upward dog, camel', 'Forward fold: paschimottanasana, janu sirsasana', 'Pranayama: nadi shodhana, kapalabhati'], milestone: 'Primary Series sezione in piedi + seduta fluida 45 min' },
    { label: 'Avanzato',   weeks: '21-40', color: 'orange',  topics: ['Inversioni: headstand (sirsasana), shoulderstand', 'Handstand (adho mukha vrksasana)', 'Primary Series completa Ashtanga', 'Yin yoga e yoga del restauro', 'Meditazione 20 minuti quotidiani'], milestone: 'Primary Series Ashtanga completa 90 minuti autonoma' },
    { label: 'Pro',        weeks: '41+',   color: 'rose',    topics: ['Secondary Series Ashtanga (backbend profondi)', 'Insegnamento 200h YTT (Yoga Teacher Training)', 'Specialty: Yin, Restorative, Hot Yoga, Kundalini', 'Adattamento yoga per atleti di arti marziali', 'Meditazione Vipassana o Vedanta avanzata'], milestone: 'Certificazione insegnante 200h RYT Yoga Alliance' },
  ]},

  running: { name: 'Corsa', emoji: '🏃', levels: [
    { label: 'Fondamenta', weeks: '1-6',   color: 'emerald', topics: ['Postura di corsa (cadenza 170+ spm)', 'Attacco col mesopiede (non col tallone)', 'Run/walk intervals: 1 min corsa / 2 min camminata', 'Core running: plank, bird-dog, single-leg stance', 'Stretching dinamico pre-corsa'], milestone: '3 km continui sotto 7:30/km senza fermarsi' },
    { label: 'Tecnica',    weeks: '7-16',  color: 'blue',    topics: ['5 km progressivi (obiettivo: sub 30 min)', 'Fartlek (variazioni di ritmo libere)', 'Interval training: 400m × 6 con recupero', 'Corsa in salita (forza + tecnica)', 'Foam rolling e recupero attivo'], milestone: '5 km in meno di 30 minuti' },
    { label: 'Avanzato',   weeks: '17-32', color: 'orange',  topics: ['10 km training plan', 'Tempo run (ritmo soglia 20-30 min)', 'Long run progressiva (fino a 16 km)', 'VO2max intervals (1000m × 5)', 'Nutrizione per la corsa e idratazione'], milestone: '10 km in meno di 55 minuti (o Half Marathon completata)' },
    { label: 'Pro',        weeks: '33+',   color: 'rose',    topics: ['Piano allenamento Maratona (16 settimane)', 'Marathon pace run (specifico)', 'Negative split strategy', 'Analisi biomeccanica (video e podoscopia)', 'Periodizzazione annuale con peaking'], milestone: 'Maratona completata (o 10 km sub 45 min / HM sub 2h)' },
  ]},

  stretching: { name: 'Mobilità', emoji: '🤸', levels: [
    { label: 'Fondamenta', weeks: '1-4',   color: 'emerald', topics: ['Mobilità dell\'anca (90/90, frog stretch)', 'Mobilità delle spalle (band pull-apart, shoulder CARs)', 'Mobilità toracica (libro aperto, cat-cow)', 'Allungamento ischio-crurali (PNF base)', 'Routine mattutina 10 min (joint circles)'], milestone: 'Toccare le dita dei piedi a gambe tese' },
    { label: 'Tecnica',    weeks: '5-14',  color: 'blue',    topics: ['Jefferson curl (flessione vertebra per vertebra)', 'Pike stretch progressivo', 'Squat profondo 3 minuti (goblet)', 'Straddle (apertura laterale) progressiva', 'Pancake stretch'], milestone: 'Straddle 90° con busto al pavimento' },
    { label: 'Avanzato',   weeks: '15-30', color: 'orange',  topics: ['Splits frontali (sinistra e destra)', 'Straddle splits (centro)', 'Ponte completo (wheel pose)', 'Shoulder dislocates con bacchetta', 'Active flexibility (gambe sollevate attivamente)'], milestone: 'Splits completi su entrambi i lati' },
    { label: 'Pro',        weeks: '31+',   color: 'rose',    topics: ['Oversplits (oltre 180°)', 'Contorsione controllata (back flexibility)', 'Mobilità integrata nel movimento atletico', 'FRC (Functional Range Conditioning)', 'Insegnamento mobilità ad altri atleti'], milestone: 'Oversplits + ponte con spalle aperte sopra le mani' },
  ]},
};

// ─── Colori palette ────────────────────────────────────────────────────────────
const C = {
  emerald: { hex: '#6de2d3', glow: 'rgba(109,226,211,0.36)', bg: 'rgba(18,88,85,0.18)', border: 'rgba(109,226,211,0.34)' },
  blue:    { hex: '#8fb9ff', glow: 'rgba(143,185,255,0.38)', bg: 'rgba(56,74,124,0.18)', border: 'rgba(143,185,255,0.32)' },
  orange:  { hex: '#ffac91', glow: 'rgba(255,172,145,0.38)', bg: 'rgba(120,64,53,0.18)', border: 'rgba(255,172,145,0.32)' },
  rose:    { hex: '#f43f5e', glow: 'rgba(244,63,94,0.4)',  bg: 'rgba(136,19,55,0.15)', border: 'rgba(244,63,94,0.25)'  },
  amber:   { hex: '#ffd184', glow: 'rgba(255,209,132,0.38)', bg: 'rgba(115,79,36,0.18)', border: 'rgba(255,209,132,0.32)' },
  red:     { hex: '#ef4444', glow: 'rgba(239,68,68,0.5)',  bg: 'rgba(127,29,29,0.2)',  border: 'rgba(239,68,68,0.3)'  },
  violet:  { hex: '#b8a4ff', glow: 'rgba(184,164,255,0.38)', bg: 'rgba(71,59,125,0.18)', border: 'rgba(184,164,255,0.32)' },
};

// ─── SVG Ring (progress circle) ───────────────────────────────────────────────
function Ring({ done, total, color = 'blue', size = 36, strokeW = 3, label }) {
  const col = C[color] || C.blue;
  const r = size / 2 - strokeW - 1;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const offset = circ * (1 - pct);
  const cx = size / 2;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(55,65,81,0.6)" strokeWidth={strokeW} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={col.hex} strokeWidth={strokeW}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease', filter: pct > 0 ? `drop-shadow(0 0 ${strokeW + 1}px ${col.hex})` : 'none' }} />
      </svg>
      {label && (
        <span className="absolute text-[9px] font-black" style={{ color: col.hex }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Gong (Web Audio) ─────────────────────────────────────────────────────────
function playGong(freq = 523) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 3);
  } catch {}
}

// ─── Lodi brevi del coach (rinforzo positivo quando correggi l'errore) ──────
const PRAISE = ['Così!', 'Bene così!', 'Perfetto, tienila!', 'Ecco, questo è il movimento!', 'Ottimo, continua così!'];

// ─── Parse AI punto assegnato ─────────────────────────────────────────────────
function parsePoint(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('🏆') && !/punto assegnato/i.test(line)) continue;
    const l = line.toLowerCase();
    if (l.includes('nessun punto') || l.includes('nessuno')) return null;
    if (l.includes('atleta a') || l.includes('🔴')) return 'a';
    if (l.includes('atleta b') || l.includes('🔵')) return 'b';
  }
  return null;
}

// ─── Round timer hook ─────────────────────────────────────────────────────────
function useRoundTimer({ rounds = 3, roundDuration = 180, restDuration = 60 }) {
  const timerRef = useRef({ phase: 'idle', currentRound: 1, timeLeft: roundDuration, intervalId: null });
  const [, forceUpdate] = useState(0);
  const configRef = useRef({ rounds, roundDuration, restDuration });
  configRef.current = { rounds, roundDuration, restDuration };

  const doTick = useCallback(() => {
    const t = timerRef.current;
    const { rounds: r, roundDuration: rd, restDuration: rest } = configRef.current;
    t.timeLeft -= 1;
    if (t.timeLeft <= 0) {
      if (t.phase === 'round') {
        if (t.currentRound >= r) {
          clearInterval(t.intervalId); t.intervalId = null;
          t.phase = 'finished'; t.timeLeft = 0;
          playGong(); setTimeout(() => playGong(440), 700);
        } else { t.phase = 'rest'; t.timeLeft = rest; playGong(); }
      } else if (t.phase === 'rest') {
        t.currentRound += 1; t.phase = 'round'; t.timeLeft = rd; playGong();
      }
    }
    forceUpdate((n) => n + 1);
  }, []);

  const start = useCallback(() => {
    const t = timerRef.current;
    clearInterval(t.intervalId);
    t.phase = 'round'; t.currentRound = 1; t.timeLeft = configRef.current.roundDuration;
    t.intervalId = setInterval(doTick, 1000);
    playGong(); forceUpdate((n) => n + 1);
  }, [doTick]);

  const stop = useCallback(() => {
    const t = timerRef.current;
    clearInterval(t.intervalId); t.intervalId = null;
    t.phase = 'idle'; t.currentRound = 1; t.timeLeft = configRef.current.roundDuration;
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current.intervalId), []);
  const t = timerRef.current;
  return { phase: t.phase, currentRound: t.currentRound, timeLeft: t.timeLeft, start, stop, totalRounds: rounds };
}

// ─── Match config (setup) ─────────────────────────────────────────────────────
function RoundConfig({ rounds, onRounds, roundDuration, onRoundDuration }) {
  return (
    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <p className="text-xs font-bold" style={{ color: C.violet.hex }}>⏱ Configura Match</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Round:</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 5, 10].map((r) => (
            <button key={r} onClick={() => onRounds(r)}
              className="w-9 h-9 rounded-xl text-xs font-black transition-all"
              style={rounds === r
                ? { background: C.violet.hex, color: '#fff', boxShadow: `0 4px 12px ${C.violet.glow}` }
                : { background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12">Min:</span>
        <div className="flex gap-1.5">
          {[{ l: "2'", v: 120 }, { l: "3'", v: 180 }, { l: "5'", v: 300 }].map(({ l, v }) => (
            <button key={v} onClick={() => onRoundDuration(v)}
              className="px-3 h-9 rounded-xl text-xs font-black transition-all"
              style={roundDuration === v
                ? { background: C.violet.hex, color: '#fff', boxShadow: `0 4px 12px ${C.violet.glow}` }
                : { background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Round timer display ──────────────────────────────────────────────────────
function RoundTimerDisplay({ timer, roundDuration, restDuration = 60 }) {
  const { phase, currentRound, timeLeft, totalRounds, start, stop } = timer;
  if (phase === 'idle') return null;

  const totalPhaseTime = phase === 'rest' ? restDuration : roundDuration;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const isDone = phase === 'finished';
  const isRest = phase === 'rest';

  const phaseColor = isDone ? C.emerald : isRest ? C.amber : C.red;
  const r = 42, circ = 2 * Math.PI * r;
  const pct = totalPhaseTime > 0 ? timeLeft / totalPhaseTime : 0;
  const offset = circ * (1 - pct);

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl flex items-center gap-4"
      style={{ background: phaseColor.bg, border: `1px solid ${phaseColor.border}` }}>
      {/* SVG Circular countdown */}
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(55,65,81,0.5)" strokeWidth="6" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={phaseColor.hex} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 8px ${phaseColor.hex})` }} />
        </svg>
        <div className="absolute text-center">
          {isDone
            ? <span className="text-2xl">✅</span>
            : <p className="text-xl font-black font-mono text-white leading-none">{mins}:{secs}</p>
          }
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black tracking-wide" style={{ color: phaseColor.hex }}>
          {isDone ? 'MATCH FINITO' : isRest ? 'RIPOSO' : `ROUND ${currentRound}`}
        </p>
        {!isDone && (
          <p className="text-xs text-gray-500 mt-0.5">
            {isRest ? `Round ${currentRound + 1}/${totalRounds} in arrivo` : `di ${totalRounds} round`}
          </p>
        )}
        {/* Mini round dots */}
        <div className="flex gap-1 mt-2">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all"
              style={{ background: i < currentRound ? phaseColor.hex : 'rgba(55,65,81,0.7)', boxShadow: i === currentRound - 1 && !isDone ? `0 0 6px ${phaseColor.hex}` : 'none' }} />
          ))}
        </div>
      </div>

      {/* Action button */}
      {!isDone
        ? <button onClick={stop} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(55,65,81,0.6)', color: '#9ca3af' }}>■</button>
        : <button onClick={start} className="px-3 py-2 rounded-xl text-xs font-black transition-all"
            style={{ background: C.emerald.hex, color: '#fff', boxShadow: `0 4px 12px ${C.emerald.glow}` }}>↺</button>
      }
    </motion.div>
  );
}

// ─── Score tracker ─────────────────────────────────────────────────────────────
function ScoreTracker({ score, onScore, lastPoint }) {
  const winner = score.a > score.b ? 'a' : score.b > score.a ? 'b' : null;

  return (
    <div className="p-4 rounded-2xl" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <p className="text-xs text-gray-500 font-bold text-center mb-3 tracking-widest">PUNTEGGIO MATCH</p>
      <div className="flex items-center justify-around">
        {/* Atleta A */}
        <div className="text-center">
          <p className="text-xs font-bold mb-2" style={{ color: C.red.hex }}>🔴 ATLETA A</p>
          <motion.p key={`a-${score.a}`}
            initial={{ scale: lastPoint === 'a' ? 1.5 : 1, opacity: lastPoint === 'a' ? 0.6 : 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-6xl font-black font-mono leading-none"
            style={{ color: C.red.hex, textShadow: score.a > 0 ? `0 0 30px ${C.red.glow}, 0 0 60px rgba(239,68,68,0.15)` : 'none' }}>
            {score.a}
          </motion.p>
          <div className="flex gap-1 justify-center mt-3">
            <button onClick={() => onScore('a', 1)}
              className="w-8 h-8 rounded-lg text-sm font-black transition-all"
              style={{ background: 'rgba(239,68,68,0.2)', color: C.red.hex, border: `1px solid ${C.red.border}` }}>+</button>
            <button onClick={() => onScore('a', -1)}
              className="w-8 h-8 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(55,65,81,0.4)', color: '#6b7280' }}>−</button>
          </div>
        </div>

        {/* Center VS */}
        <div className="text-center px-2">
          <p className="text-xl font-black text-gray-700">VS</p>
          <AnimatePresence mode="wait">
            {lastPoint && (
              <motion.div key={`${lastPoint}-${Date.now()}`}
                initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-1">
                <span className="text-lg">{lastPoint === 'a' ? '🔴' : '🔵'}</span>
                <p className="text-[10px] font-black" style={{ color: lastPoint === 'a' ? C.red.hex : '#60a5fa' }}>+1</p>
              </motion.div>
            )}
          </AnimatePresence>
          {winner && !lastPoint && (
            <p className="text-[10px] font-bold mt-1" style={{ color: winner === 'a' ? C.red.hex : '#60a5fa' }}>
              {winner === 'a' ? '🔴 WIN' : '🔵 WIN'}
            </p>
          )}
        </div>

        {/* Atleta B */}
        <div className="text-center">
          <p className="text-xs font-bold mb-2" style={{ color: '#60a5fa' }}>🔵 ATLETA B</p>
          <motion.p key={`b-${score.b}`}
            initial={{ scale: lastPoint === 'b' ? 1.5 : 1, opacity: lastPoint === 'b' ? 0.6 : 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-6xl font-black font-mono leading-none"
            style={{ color: '#60a5fa', textShadow: score.b > 0 ? `0 0 30px rgba(96,165,250,0.5), 0 0 60px rgba(96,165,250,0.15)` : 'none' }}>
            {score.b}
          </motion.p>
          <div className="flex gap-1 justify-center mt-3">
            <button onClick={() => onScore('b', 1)}
              className="w-8 h-8 rounded-lg text-sm font-black transition-all"
              style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>+</button>
            <button onClick={() => onScore('b', -1)}
              className="w-8 h-8 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(55,65,81,0.4)', color: '#6b7280' }}>−</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hook chat ─────────────────────────────────────────────────────────────────
function useChat(endpoint) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (userText, extraBody = {}) => {
    if (!userText.trim() || loading) return;
    setError(null);
    const userMsg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].slice(-12);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content, provider: data.provider }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally { setLoading(false); }
  }, [messages, loading, endpoint]);

  const clear = useCallback(() => { setMessages([]); setError(null); }, []);
  return { messages, loading, error, send, clear };
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-xs"
          style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.2), rgba(168,85,247,0.2))', border: '1px solid rgba(0,242,255,0.25)' }}>
          🤖
        </div>
      )}
      <div className="max-w-[85%] relative">
        {!isUser && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full" style={{ background: 'linear-gradient(180deg, #00f2ff, #a855f7)', opacity: 0.6 }} />
        )}
        <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${!isUser ? 'pl-5' : ''}`}
          style={isUser
            ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', borderRadius: '18px 18px 4px 18px', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }
            : { background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', color: '#e5e7eb', borderRadius: '18px 18px 18px 4px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {!isUser && msg.provider && (
            <div className="text-[10px] mb-1.5 font-mono tracking-wider" style={{ color: '#00f2ff', opacity: 0.6 }}>{msg.provider}</div>
          )}
          {msg.content}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────
function ChatInput({ value, onChange, onSend, loading, placeholder }) {
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } };
  return (
    <div className="flex gap-2 relative">
      <div className="flex-1 relative">
        <textarea value={value} onChange={onChange} onKeyDown={handleKey} placeholder={placeholder} rows={2}
          className="w-full px-4 py-3 text-sm text-white placeholder-gray-700 resize-none focus:outline-none transition-all"
          style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, backdropFilter: 'blur(12px)' }}
          onFocus={(e) => { e.target.style.borderColor = 'rgba(0,242,255,0.3)'; e.target.style.boxShadow = '0 0 0 1px rgba(0,242,255,0.1)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }} />
      </div>
      <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }} onClick={onSend} disabled={loading || !value.trim()}
        className="px-4 rounded-2xl text-white font-black text-xl self-stretch transition-all disabled:opacity-30 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 4px 20px rgba(37,99,235,0.4)', minWidth: 48 }}>
        {loading ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>◌</motion.span> : '↑'}
      </motion.button>
    </div>
  );
}

// ─── Quick prompts grid ────────────────────────────────────────────────────────
function QuickGrid({ prompts, onSend, accentColor }) {
  const col = C[accentColor] || C.blue;
  return (
    <motion.div className="grid grid-cols-2 gap-2"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      initial="hidden" animate="show">
      {prompts.map((p) => (
        <motion.button key={p.label}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.96 }}
          onClick={() => onSend(p.text)}
          className="hud-chip text-left px-3 py-3 rounded-xl text-xs text-gray-200 transition-all relative overflow-hidden"
          style={{ background: 'rgba(17,24,39,0.75)', border: `1px solid ${col.border}`, backdropFilter: 'blur(10px)' }}>
          <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${col.hex}44, transparent)` }} />
          <span className="font-bold text-[11px]">{p.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ─── Tab: Chat generale ────────────────────────────────────────────────────────
// PENDING_COACH_QUESTION_KEY: bridge cross-pagina — la pagina News ("Applica a me"
// su una scoperta scientifica) scrive qui e naviga a Coach; questo tab la consuma
// una sola volta all'apertura, invece di perdere la domanda cambiando pagina.
const PENDING_COACH_QUESTION_KEY = 'shadow_monarch_pending_coach_question';
function CoachChat() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/coach');
  const sendWithContext = useCallback((text) => send(text, { athleteContext: athleteSummary() }), [send]);
  const handleSend = () => { if (!input.trim()) return; sendWithContext(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    let pending;
    try { pending = localStorage.getItem(PENDING_COACH_QUESTION_KEY); } catch { pending = null; }
    if (pending) {
      try { localStorage.removeItem(PENDING_COACH_QUESTION_KEY); } catch {}
      sendWithContext(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <>
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))', border: `1px solid ${C.blue.border}` }}>
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6 40%, #6366f1 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
            <div className="relative px-4 py-3.5 overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
              <p className="text-xs font-black tracking-widest" style={{ color: C.blue.hex, fontFamily: 'Syne, sans-serif' }}>💬 AI COACH CHAT</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Arti Marziali · Percorso · Nutrizione · Recovery</p>
            </div>
          </div>
          <QuickGrid prompts={personalizePrompts(COACH_QUICK)} onSend={sendWithContext} accentColor="blue" />
        </>
      )}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>{messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}</AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>🤖</div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div className="flex gap-1.5 items-center">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: C.blue.hex }}
                    animate={{ y: [0,-5,0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <p className="text-center text-xs text-red-400 py-2">⚠️ {error}</p>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-700 hover:text-gray-500 transition-colors">🗑 Nuova conversazione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend} loading={loading} placeholder="Ricette, esercizi, integratori…" />
    </div>
  );
}

// ─── Tab: Personal Trainer ─────────────────────────────────────────────────────
function PersonalTrainer() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/trainer');
  const sendWithContext = useCallback((text) => send(text, { athleteContext: athleteSummary() }), [send]);
  const handleSend = () => { if (!input.trim()) return; sendWithContext(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <>
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))', border: `1px solid ${C.amber.border}` }}>
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #f59e0b 40%, #f97316 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
            <div className="relative px-4 py-3.5 overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)' }} />
              <p className="text-xs font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Syne, sans-serif' }}>⚡ SHADOW COACH</p>
              <p className="text-sm font-bold text-white mt-0.5">Kimi K2.6 — Personal Trainer AI</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Calorie · Macro · Schede · Arti Marziali</p>
            </div>
          </div>
          <QuickGrid prompts={personalizePrompts(TRAINER_QUICK)} onSend={sendWithContext} accentColor="amber" />
        </>
      )}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>{messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}</AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>🤖</div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: 'rgba(17,24,39,0.8)', border: `1px solid ${C.amber.border}` }}>
              <div className="flex gap-1.5 items-center">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: C.amber.hex }}
                    animate={{ y: [0,-5,0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <p className="text-center text-xs text-red-400 py-2">⚠️ {error}</p>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-700 hover:text-gray-500 transition-colors">🗑 Nuova sessione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend} loading={loading} placeholder="Piano calorico, scheda, integratori…" />
    </div>
  );
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const SESSIONS_KEY = 'shadow_monarch_live_sessions';
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } };
const saveSessions = (s) => { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s.slice(0, 10))); } catch {} };

const CURRICULUM_KEY = 'shadow_monarch_curriculum';
const loadCurrProgress = () => { try { return JSON.parse(localStorage.getItem(CURRICULUM_KEY) || '{}'); } catch { return {}; } };
const saveCurrProgress = (p) => { try { localStorage.setItem(CURRICULUM_KEY, JSON.stringify(p)); } catch {} };

// ─── Progressione per disciplina (XP accumulato dalle pagelle) ───────────────
// Fonte autorevole: KV coach_progress:<chatId> (visual.js sessionReport).
// Copia locale per mostrare il livello anche offline/subito.
const COACH_PROGRESS_KEY = 'shadow_monarch_coach_progress';
const loadCoachProgress = () => { try { return JSON.parse(localStorage.getItem(COACH_PROGRESS_KEY) || '{}'); } catch { return {}; } };
const saveCoachProgress = (p) => {
  try { localStorage.setItem(COACH_PROGRESS_KEY, JSON.stringify(p)); } catch {}
  try { window.dispatchEvent(new Event('coach-progress-updated')); } catch {} };

// ── LA SCALATA: persistenza giorni di allenamento + miglior Fight IQ ──
const TRAIN_DAYS_KEY = 'shadow_monarch_training_days';
const loadTrainDays = () => { try { return JSON.parse(localStorage.getItem(TRAIN_DAYS_KEY) || '[]'); } catch { return []; } };
const markTrainDay = () => {
  try {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const days = loadTrainDays();
    if (!days.includes(today)) localStorage.setItem(TRAIN_DAYS_KEY, JSON.stringify([...days, today].slice(-1200)));
  } catch {}
};
const FIGHT_META_KEY = 'shadow_monarch_fight_meta';
const loadFightMeta = () => { try { return JSON.parse(localStorage.getItem(FIGHT_META_KEY) || '{}'); } catch { return {}; } };
const saveFightIq = (iq) => {
  try {
    const meta = loadFightMeta();
    const best = Math.max(Number(meta.bestIq) || 0, Number(iq) || 0);
    localStorage.setItem(FIGHT_META_KEY, JSON.stringify({ ...meta, bestIq: best, lastIq: iq, rounds: (meta.rounds || 0) + 1 }));
  } catch {}
};
// Profilo del combattente: esperienza + costanza + combattimento → livello 1-100
function buildFighterProfile() {
  const prog = loadCoachProgress();
  const xp = Object.values(prog).reduce((a, d) => a + Math.max(0, Number(d?.xp) || 0), 0);
  const days = loadTrainDays().length;
  const scores = loadSessions().map((s) => Number(s?.score)).filter((v) => v > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const fightIq = Math.max(0, Number(loadFightMeta().bestIq) || 0);
  const profile = { xp, days, fightIq, avgScore };
  return { ...profile, level: fighterLevel(profile), pillars: pillarLevels(profile) };
}
// 150 XP per livello di competenza (una sessione vale ~10-100 XP dalla pagella).
const coachLevelOf = (xp) => Math.floor((Number(xp) || 0) / 150) + 1;
// Grado/cintura dalla knowledge base: un grado ogni 600 XP.
function coachRankOf(disciplineId, xp) {
  const d = getDiscipline(disciplineId);
  if (!d || !d.ranks?.length) return '';
  const idx = Math.min(d.ranks.length - 1, Math.floor((Number(xp) || 0) / 600));
  return d.ranks[idx];
}

// Blocco di contesto per i prompt AI: a che punto del percorso è l'allievo in
// questa disciplina. Così il coach allena verso la prossima milestone invece
// di dare feedback scollegati dal percorso.
const curriculumContext = (mode) => {
  const curr = CURRICULUM[mode];
  if (!curr) return '';
  const prog = loadCurrProgress()[mode] || {};
  const li = curr.levels.findIndex((l, i) => (prog[`l${i}`] || []).length < l.topics.length);
  if (li === -1) return `\n\nPERCORSO ALLIEVO — ${curr.name}: curriculum COMPLETATO. Coaching di perfezionamento livello Pro: dettagli fini, timing, tattica.`;
  const level = curr.levels[li];
  const done = new Set(prog[`l${li}`] || []);
  const doneList = level.topics.filter((_, ti) => done.has(ti));
  const todo = level.topics.filter((_, ti) => !done.has(ti)).slice(0, 3);
  return `\n\nPERCORSO ALLIEVO — ${curr.name}, livello ${level.label} (sett. ${level.weeks}):` +
    (doneList.length ? `\n- Già acquisiti: ${doneList.join(' · ')}` : '\n- Partito da zero: nessun argomento ancora completato, parla semplice e cura le basi') +
    `\n- DA IMPARARE ORA (priorità del coaching): ${todo.join(' · ')}` +
    `\n- Milestone da sbloccare: ${level.milestone}` +
    `\nOrienta comandi e drill verso questi argomenti, calibrando il vocabolario al livello ${level.label}.`;
};

// Riassunto atleta cross-disciplina per la chat coach: progresso curriculum
// reale + ultime sessioni live. Così la chat risponde conoscendo il percorso.
const athleteSummary = () => {
  const prog = loadCurrProgress();
  const lines = [];
  for (const [id, dp] of Object.entries(prog)) {
    const curr = CURRICULUM[id];
    if (!curr) continue;
    const done = Object.values(dp).reduce((s, arr) => s + arr.length, 0);
    if (!done) continue;
    const tot = curr.levels.reduce((s, l) => s + l.topics.length, 0);
    const li = curr.levels.findIndex((l, i) => (dp[`l${i}`] || []).length < l.topics.length);
    const lvl = li === -1 ? 'completato' : curr.levels[li].label;
    lines.push(`- ${curr.name}: ${done}/${tot} argomenti, livello ${lvl}${li !== -1 ? ` — prossima milestone: ${curr.levels[li].milestone}` : ''}`);
  }
  const sessions = loadSessions().slice(0, 3);
  if (sessions.length) {
    lines.push('Ultime sessioni live:');
    sessions.forEach((s) => lines.push(`- ${s.date} (${s.mode}): ${s.keyFeedback || s.context || ''}`.slice(0, 180)));
  }
  if (!lines.length) return 'Allievo appena partito da zero: nessun progresso registrato ancora. Costruisci le fondamenta.';
  return lines.join('\n');
};

// ── Esami milestone superati: { [disc]: { [levelIdx]: { score, date } } } ─────
const EXAMS_KEY = 'shadow_monarch_exams';
const loadExams = () => { try { return JSON.parse(localStorage.getItem(EXAMS_KEY) || '{}'); } catch { return {}; } };
const saveExams = (e) => { try { localStorage.setItem(EXAMS_KEY, JSON.stringify(e)); } catch {} };

// ── Date di completamento argomenti (per il ripasso): { 'disc:l0:2': ISOdate } ─
const CURR_DATES_KEY = 'shadow_monarch_curr_dates';
const loadCurrDates = () => { try { return JSON.parse(localStorage.getItem(CURR_DATES_KEY) || '{}'); } catch { return {}; } };
const markTopicDate = (disc, li, ti) => {
  try {
    const d = loadCurrDates();
    d[`${disc}:l${li}:${ti}`] = new Date().toISOString().slice(0, 10);
    localStorage.setItem(CURR_DATES_KEY, JSON.stringify(d));
  } catch {}
};

// ── Sessione live pre-configurata dal curriculum (deep-link tra tab) ──────────
const PENDING_LIVE_KEY = 'shadow_monarch_pending_live';
const setPendingLive = (p) => { try { localStorage.setItem(PENDING_LIVE_KEY, JSON.stringify(p)); } catch {} };
const takePendingLive = () => {
  try {
    const raw = localStorage.getItem(PENDING_LIVE_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_LIVE_KEY);
    return JSON.parse(raw);
  } catch { return null; }
};

// ── Rango disciplina stile Solo Leveling: livelli completati + esami ──────────
// E (novizio) → D/C/B (un rango per livello completato) → A (curriculum finito)
// → S (tutti e 4 gli esami milestone superati davanti al Maestro).
const RANK_LABELS = ['E', 'D', 'C', 'B', 'A', 'S'];
const disciplineRank = (disc) => {
  const curr = CURRICULUM[disc];
  if (!curr) return null;
  const dp = loadCurrProgress()[disc] || {};
  const levelsDone = curr.levels.filter((l, i) => (dp[`l${i}`] || []).length >= l.topics.length).length;
  const examsDone = Object.keys(loadExams()[disc] || {}).length;
  const idx = levelsDone >= curr.levels.length && examsDone >= curr.levels.length ? 5 : Math.min(levelsDone, 4);
  return { rank: RANK_LABELS[idx], levelsDone, examsDone };
};
// Grado → livello dei segreti rivelati (E=1 … A/S=5)
const secretLevelOf = (rankLetter) => Math.min(5, Math.max(1, RANK_LABELS.indexOf(rankLetter) + 1));
const secretLevelForMode = (mode) => {
  const base = String(mode || '').replace(/^(sparring|drill|partner)_/, '');
  const r = disciplineRank(base);
  return r ? secretLevelOf(r.rank) : 5; // senza curriculum → nessuna restrizione
};
const SECRET_RANK_KEY = 'shadow_monarch_secret_rank_seen';
const loadSeenRanks = () => { try { return JSON.parse(localStorage.getItem(SECRET_RANK_KEY) || '{}'); } catch { return {}; } };
const ARMY_KEY = 'shadow_monarch_army';
const loadArmy = () => { try { return JSON.parse(localStorage.getItem(ARMY_KEY) || '{}'); } catch { return {}; } };
const saveArmy = (a) => { try { localStorage.setItem(ARMY_KEY, JSON.stringify(a)); } catch {} };

// ── Prossimo obiettivo nel percorso: primo argomento non completato ───────────
const nextObjective = (disc) => {
  const curr = CURRICULUM[disc];
  if (!curr) return null;
  const dp = loadCurrProgress()[disc] || {};
  for (let li = 0; li < curr.levels.length; li++) {
    const level = curr.levels[li];
    const done = new Set(dp[`l${li}`] || []);
    const ti = level.topics.findIndex((_, i) => !done.has(i));
    if (ti !== -1) return { li, level, ti, topic: level.topics[ti], milestone: level.milestone, levelComplete: false };
    if (!loadExams()[disc]?.[li]) return { li, level, ti: -1, topic: null, milestone: level.milestone, levelComplete: true };
  }
  return null; // percorso completo, esami inclusi
};

// ── Ripasso spaced-repetition: argomenti completati da più di 21 giorni ───────
const REVIEW_AFTER_DAYS = 21;
const reviewTopics = (disc) => {
  const curr = CURRICULUM[disc];
  if (!curr) return [];
  const dp = loadCurrProgress()[disc] || {};
  const dates = loadCurrDates();
  const now = Date.now();
  const out = [];
  curr.levels.forEach((level, li) => {
    (dp[`l${li}`] || []).forEach((ti) => {
      const d = dates[`${disc}:l${li}:${ti}`];
      // argomenti senza data (completati prima di questa feature) non vanno in ripasso
      if (!d) return;
      const age = (now - new Date(d).getTime()) / 86400000;
      if (age > REVIEW_AFTER_DAYS && level.topics[ti]) out.push({ topic: level.topics[ti], level: level.label, days: Math.round(age) });
    });
  });
  return out.sort((a, b) => b.days - a.days).slice(0, 2);
};

// ── Titolo tradizionale del maestro per disciplina (persona realistica) ───────
const MASTER_TITLES = {
  muaythai: 'Kru', muayboran: 'Kru', boxing: 'Coach', kickboxing: 'Coach', sanda: 'Coach',
  mma: 'Coach', wrestling: 'Coach', lutalivre: 'Coach', pankration: 'Coach', sambo: 'Trener',
  karate: 'Sensei', judo: 'Sensei', kendo: 'Sensei', taekwondo: 'Sabum', hapkido: 'Sabum',
  bjj: 'Professor', capoeira: 'Mestre', silat: 'Guru', wingchun: 'Sifu', kungfu: 'Sifu',
  kravmaga: 'Istruttore', selfdefense: 'Istruttore', systema: 'Instruktor', kalaripayattu: 'Gurukkal',
};
const masterTitle = (mode) => MASTER_TITLES[mode] || 'Maestro';

// ── Reaction Trainer: comandi chiamati a voce, per famiglia di disciplina ─────
const REACTION_CALLS = {
  muaythai:    ['Jab!', 'Cross!', 'Teep!', 'Low kick!', 'Check!', 'Gomitata!', 'Ginocchiata!', 'Esci a quarantacinque!'],
  muayboran:   ['Jab!', 'Teep!', 'Gomitata!', 'Ginocchiata!', 'Check!', 'Sok Tad!'],
  boxing:      ['Jab!', 'Cross!', 'Gancio!', 'Slip!', 'Roll!', 'Doppio jab!', 'Esci dall\'angolo!', 'Corpo!'],
  kickboxing:  ['Jab!', 'Cross!', 'Roundhouse!', 'Teep!', 'Check!', 'Back kick!', 'Slip!'],
  taekwondo:   ['Ap chagi!', 'Dollyo!', 'Back kick!', 'Guardia!', 'Switch!', 'Doppio calcio!'],
  karate:      ['Kizami!', 'Gyaku-zuki!', 'Mae geri!', 'Mawashi!', 'Indietro!', 'Kiai!'],
  selfdefense: ['Palm strike!', 'Difesa 360!', 'Ginocchiata!', 'Scan!', 'Fuggi!', 'Voce: STOP!', 'Gomitata!'],
  kravmaga:    ['Palm strike!', 'Difesa 360!', 'Burst!', 'Ginocchiata!', 'Scan!', 'Disimpegno!'],
  bjj:         ['Sprawl!', 'Shrimp!', 'Bridge!', 'Technical stand-up!', 'Granby!'],
  wrestling:   ['Sprawl!', 'Level change!', 'Shot!', 'Circle!', 'Snap down!'],
  judo:        ['Kuzushi!', 'Entra!', 'Uchi-komi!', 'Tai-sabaki!', 'Difendi la presa!'],
  mma:         ['Jab!', 'Low kick!', 'Sprawl!', 'Level change!', 'Clinch!', 'Slip!', 'Esci!'],
  capoeira:    ['Ginga!', 'Esquiva!', 'Au!', 'Meia-lua!', 'Negativa!', 'Rasteira!'],
  sambo:       ['Presa!', 'Sgambetto!', 'Hip throw!', 'Sprawl!', 'Leva!', 'Entra!'],
  hapkido:     ['Leva al polso!', 'Proiezione!', 'Calcio basso!', 'Ruota!', 'Esci!'],
  wingchun:    ['Chain punch!', 'Pak sao!', 'Tan sao!', 'Bong sao!', 'Centro!', 'Lap sao!'],
  kungfu:      ['Ma bu!', 'Gong bu!', 'Chong quan!', 'Calcio frontale!', 'Blocca!', 'Cambio stance!'],
  silat:       ['Langkah!', 'Kuda-kuda!', 'Sapuan!', 'Elakan!', 'Colpo di palmo!'],
  kendo:       ['Men!', 'Kote!', 'Do!', 'Tsuki!', 'Kamae!', 'Fumikomi!'],
  sanda:       ['Jab!', 'Cross!', 'Bian tui!', 'Teep!', 'Takedown!', 'Clinch!'],
  pankration:  ['Colpo!', 'Takedown!', 'Sprawl!', 'Clinch!', 'A terra!', 'Rialzati!'],
  systema:     ['Respira!', 'Rilassa!', 'Cadi!', 'Rotola!', 'Devia!', 'Muoviti!'],
  lutalivre:   ['Sprawl!', 'Single leg!', 'Guillotine!', 'Scramble!', 'Back take!'],
  kalaripayattu: ['Vadivu!', 'Chuvadu!', 'Salto!', 'Abbassati!', 'Calcio alto!', 'Ruota!'],
  default:     ['Colpo!', 'Schiva!', 'Guardia!', 'Esci a sinistra!', 'Esci a destra!', 'Affonda!'],
};
const reactionCallsFor = (mode) => REACTION_CALLS[mode] || REACTION_CALLS.default;
const REACT_DIFFS = { facile: [4000, 6000], medio: [2800, 4200], duro: [1800, 3000] };

// ── Riscaldamento e defaticamento guidati (locali, zero AI) ───────────────────
const WARMUP_STEPS = [
  { name: 'Corsa sul posto', sec: 40, cue: 'Ginocchia alte, spalle sciolte, respira dal naso' },
  { name: 'Rotazioni: collo, spalle, anche', sec: 35, cue: 'Cerchi ampi e lenti, entrambe le direzioni' },
  { name: 'Jumping jack', sec: 35, cue: 'Ritmo costante, atterra morbido sull\'avampiede' },
  { name: 'Affondi dinamici + torsione', sec: 35, cue: 'Passo lungo, ginocchio sopra la caviglia' },
  { name: 'Shadow leggero della disciplina', sec: 45, cue: 'Tecniche al 50%, cerca fluidità non potenza' },
];
const COOLDOWN_STEPS = [
  { name: 'Respirazione 4-6', sec: 45, cue: 'Naso 4 secondi dentro, bocca 6 fuori: abbassa il battito' },
  { name: 'Flessori dell\'anca', sec: 35, cue: 'Affondo basso statico, bacino avanti, cambia lato a metà' },
  { name: 'Quadricipiti e ischio-crurali', sec: 35, cue: 'Tallone al gluteo, poi gamba tesa avanti' },
  { name: 'Spalle, tricipiti e collo', sec: 35, cue: 'Trazioni dolci, mai molleggiare' },
];

// ── Streak e minuti della settimana (dallo storico sessioni locale) ───────────
const sessionStats = () => {
  const ss = loadSessions();
  const days = new Set(ss.map((s) => s.date));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const key = new Date(Date.now() - i * 86400000).toLocaleDateString('it-IT');
    if (days.has(key)) streak++;
    else if (i === 0) continue; // oggi non ancora allenato: lo streak parte da ieri
    else break;
  }
  const weekMin = ss.reduce((acc, s) => {
    const [dd, mm, yy] = String(s.date || '').split('/');
    const t = new Date(`${yy}-${mm}-${dd}`).getTime();
    return acc + (Number.isFinite(t) && Date.now() - t < 7 * 86400000 ? (s.duration || 0) : 0);
  }, 0);
  return { streak, weekMin };
};

// ── TRONO DEL MONARCA: visione globale su TUTTE le discipline ────────────────
const monarchStats = () => {
  const prog = loadCurrProgress();
  const exams = loadExams();
  let topics = 0, done = 0, examsDone = 0, examsTot = 0;
  const active = [];
  for (const [id, curr] of Object.entries(CURRICULUM)) {
    const tot = curr.levels.reduce((s, l) => s + l.topics.length, 0);
    topics += tot;
    examsTot += curr.levels.length;
    const dp = prog[id] || {};
    const d = Object.values(dp).reduce((s, a) => s + a.length, 0);
    done += d;
    examsDone += Object.keys(exams[id] || {}).length;
    if (d > 0) active.push(id);
  }
  // gli esami pesano il triplo di un argomento: la maestria vera si dimostra
  const frac = topics + examsTot ? (done + examsDone * 3) / (topics + examsTot * 3) : 0;
  const rank = frac >= 0.999 ? 'S' : frac >= 0.75 ? 'A' : frac >= 0.5 ? 'B' : frac >= 0.25 ? 'C' : frac >= 0.08 ? 'D' : 'E';
  return { done, topics, examsDone, examsTot, active, rank, frac };
};

// Disciplina del giorno: tra quelle iniziate, la meno allenata di recente
const todaysDiscipline = () => {
  const { active } = monarchStats();
  const pool = active.length ? active : ['selfdefense'];
  const sessions = loadSessions();
  const lastByMode = {};
  sessions.forEach((s) => { if (!lastByMode[s.mode]) lastByMode[s.mode] = s.date; }); // storico: più recente prima
  const dateVal = (d) => {
    const [dd, mm, yy] = String(d || '').split('/');
    const t = new Date(`${yy}-${mm}-${dd}`).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  return [...pool].sort((a, b) => dateVal(lastByMode[a]) - dateVal(lastByMode[b]))[0];
};

// ── Storico radar competenze (trend nel tempo, per disciplina) ────────────────
const SKILLS_HIST_KEY = 'shadow_monarch_skills_history';
const pushSkillsHistory = (disc, skills) => {
  try {
    const h = JSON.parse(localStorage.getItem(SKILLS_HIST_KEY) || '[]');
    h.push({ disc, skills, date: new Date().toISOString().slice(0, 10) });
    localStorage.setItem(SKILLS_HIST_KEY, JSON.stringify(h.slice(-80)));
  } catch {}
};
const avgSkillsRecent = (n = 6) => {
  try {
    const h = JSON.parse(localStorage.getItem(SKILLS_HIST_KEY) || '[]').slice(-n);
    if (!h.length) return null;
    const keys = ['guardia', 'attacco', 'difesa', 'footwork', 'respiro'];
    const out = {};
    keys.forEach((k) => { out[k] = Math.round(h.reduce((s, e) => s + (e.skills?.[k] || 0), 0) / h.length); });
    return out;
  } catch { return null; }
};

// ── Overlay routine guidata (riscaldamento/defaticamento): timer + voce ───────
function RoutineOverlay({ title, emoji, color = 'orange', steps, voiceOn, onExit }) {
  const col = C[color] || C.orange;
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(steps[0]?.sec || 30);
  const speak = useCallback((text) => {
    if (!voiceOn || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT'; u.rate = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }, [voiceOn]);

  useEffect(() => { const s = steps[idx]; if (s) speak(`${s.name}. ${s.cue}`); }, [idx, steps, speak]);
  useEffect(() => {
    const t = setInterval(() => {
      setLeft((l) => {
        if (l > 1) return l - 1;
        setIdx((i) => {
          if (i + 1 >= steps.length) { playGong(659); speak('Fatto. Sei pronto.'); setTimeout(onExit, 1200); return i; }
          playGong(523);
          setLeft(steps[i + 1].sec);
          return i + 1;
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [steps, onExit, speak]);

  const step = steps[idx];
  const next = steps[idx + 1];
  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(3,7,18,0.96)', backdropFilter: 'blur(12px)' }}>
      <p className="text-xs font-black tracking-widest mb-6" style={{ color: col.hex, fontFamily: 'Syne, sans-serif' }}>{emoji} {title} · {idx + 1}/{steps.length}</p>
      <motion.p key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-black text-white text-center leading-tight">{step?.name}</motion.p>
      <p className="text-sm text-center mt-2" style={{ color: '#9ca3af' }}>{step?.cue}</p>
      <p className="text-6xl font-black font-mono mt-8" style={{ color: col.hex, textShadow: `0 0 24px ${col.glow}` }}>{left}</p>
      {next && <p className="text-xs mt-8" style={{ color: '#4b5563' }}>Dopo: {next.name}</p>}
      <div className="flex gap-1.5 mt-4">
        {steps.map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < idx ? col.hex : i === idx ? '#fff' : 'rgba(75,85,99,0.5)' }} />
        ))}
      </div>
      <button onClick={onExit} className="mt-10 px-6 py-2.5 rounded-xl text-xs font-bold text-gray-400"
        style={{ background: 'rgba(55,65,81,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>Salta</button>
    </div>,
    document.body
  );
}

// ── Radar SVG delle 5 competenze (pagella) ────────────────────────────────────
function SkillRadar({ skills, size = 170 }) {
  const AXES = [
    { key: 'guardia', label: 'Guardia' }, { key: 'attacco', label: 'Attacco' },
    { key: 'difesa', label: 'Difesa' }, { key: 'footwork', label: 'Footwork' },
    { key: 'respiro', label: 'Respiro' },
  ];
  const cx = size / 2, cy = size / 2, R = size / 2 - 26;
  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r) => AXES.map((_, i) => pt(i, r).join(',')).join(' ');
  const valPoly = AXES.map((ax, i) => pt(i, R * Math.max(0.06, (skills[ax.key] || 0) / 100)).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={poly(R * f)} fill="none" stroke="rgba(75,85,99,0.35)" strokeWidth="1" />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(75,85,99,0.25)" strokeWidth="1" />;
      })}
      <motion.polygon points={valPoly} fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth="2"
        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: `${cx}px ${cy}px` }} />
      {AXES.map((ax, i) => {
        const [x, y] = pt(i, R + 15);
        return (
          <text key={ax.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 700 }}>
            {ax.label} {skills[ax.key] || 0}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Tab: Curriculum ──────────────────────────────────────────────────────────
function CurriculumCoach({ onGoLive }) {
  const [disc, setDisc] = useState('mma');
  const [expandedLevel, setExpandedLevel] = useState(0);
  const [openTech, setOpenTech] = useState(null); // libreria tecniche: tecnica espansa
  const [progress, setProgress] = useState(() => loadCurrProgress());
  const [loadingTopic, setLoadingTopic] = useState(null);
  const [topicLesson, setTopicLesson] = useState(null);
  const [exams, setExams] = useState(() => loadExams());
  const [weekPlan, setWeekPlan] = useState(null);      // {content} | {loading:true}
  useEffect(() => { setExams(loadExams()); setOpenTech(null); }, [disc]); // gli esami li scrive la sessione live

  const curriculum = CURRICULUM[disc];
  const discProgress = progress[disc] || {};
  const getCompleted = (li) => new Set(discProgress[`l${li}`] || []);
  const totalDone = curriculum.levels.reduce((s, _, li) => s + getCompleted(li).size, 0);
  const totalTopics = curriculum.levels.reduce((s, l) => s + l.topics.length, 0);
  const objective = useMemo(() => nextObjective(disc), [disc, progress, exams]);
  const reviews = useMemo(() => reviewTopics(disc), [disc, progress]);
  const rank = useMemo(() => disciplineRank(disc), [disc, progress, exams]);

  // ── SEGRETI DEL MAESTRO: sblocco per grado + segreto del giorno ────────────
  const secretLevel = rank ? secretLevelOf(rank.rank) : 1;
  const discSecrets = useMemo(() => secretsFor(disc), [disc]);
  const unlockedSecrets = discSecrets.filter((s) => s.livello <= secretLevel);
  const todaySecret = useMemo(() => secretOfTheDay(disc), [disc]);
  const [awakening, setAwakening] = useState(null); // cinematica RISVEGLIO al cambio grado
  const [army, setArmy] = useState(loadArmy);        // 🗡️ armata delle ombre
  const [shadowRise, setShadowRise] = useState(null);
  const extractShadow = useCallback((d) => {
    const r = disciplineRank(d);
    const cur = loadArmy();
    if (!r || RANK_LABELS.indexOf(r.rank) < 4 || cur[d]) return;
    const next = { ...cur, [d]: { rank: r.rank, extractedAt: Date.now() } };
    saveArmy(next);
    setArmy(next);
    setShadowRise({ t: Date.now(), disc: CURRICULUM[d].name, rank: r.rank });
    setTimeout(() => speakSystem('Ombra estratta. Alzati e combatti per me.'), 1400);
  }, []);
  // ⚔ Maestria della disciplina (0-100, curva lentissima) — dall'XP coach
  const [discMastery, setDiscMastery] = useState(0);
  useEffect(() => {
    const update = () => setDiscMastery(masteryFromXp(loadCoachProgress()[disc]?.xp));
    update();
    window.addEventListener('coach-progress-updated', update);
    return () => window.removeEventListener('coach-progress-updated', update);
  }, [disc]);
  const [unlockModal, setUnlockModal] = useState(null);
  useEffect(() => {
    if (!rank) return;
    const seen = loadSeenRanks();
    const prev = seen[disc] || 'E';
    if (RANK_LABELS.indexOf(rank.rank) > RANK_LABELS.indexOf(prev)) {
      // Prima il RISVEGLIO, poi i segreti sbloccati
      setAwakening({ t: Date.now(), rank: rank.rank, disc: curriculum.name });
      speakSystem(`Risveglio registrato. Grado ${rank.rank} raggiunto in ${curriculum.name}.`);
      // Grado A/S → il Sistema estrae l'ombra della disciplina
      if (RANK_LABELS.indexOf(rank.rank) >= 4 && !loadArmy()[disc]) extractShadow(disc);
      const fresh = discSecrets.filter((s) => s.livello === secretLevelOf(rank.rank));
      if (fresh.length) {
        setUnlockModal({ rank: rank.rank, secrets: fresh.slice(0, 5), total: fresh.length });
        playSample('unlock', { volume: 0.5 });
      }
    }
    if (seen[disc] !== rank.rank) {
      try { localStorage.setItem(SECRET_RANK_KEY, JSON.stringify({ ...seen, [disc]: rank.rank })); } catch {}
    }
  }, [disc, rank, discSecrets]);

  const toggleTopic = (li, ti) => {
    setProgress((prev) => {
      const dp = prev[disc] || {};
      const set = new Set(dp[`l${li}`] || []);
      if (set.has(ti)) set.delete(ti); else { set.add(ti); markTopicDate(disc, li, ti); }
      const next = { ...prev, [disc]: { ...dp, [`l${li}`]: [...set] } };
      saveCurrProgress(next);
      return next;
    });
  };

  const learnTopic = async (topic, levelLabel) => {
    setLoadingTopic(topic);
    setTopicLesson(null);
    try {
      const prompt = `Insegnami: "${topic}" — ${curriculum.name}, livello ${levelLabel}.
1) Cos'è e perché è fondamentale (collegalo a ciò che so già, se il profilo lo dice)
2) Esecuzione step-by-step con riferimenti misurabili (angoli, altezze, distanze)
3) I 3 errori più comuni e come accorgersene da soli
4) Drill per impararlo OGGI: serie × ripetizioni + criterio di riuscita misurabile
5) Come si collega alla milestone del mio livello
Rispondi in italiano, max 15 righe, tono da maestro pratico.`;
      const res = await fetch('/api/nvidia/trainer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], athleteContext: athleteSummary() }),
      });
      const data = await res.json();
      if (res.ok) setTopicLesson({ topic, content: data.content, provider: data.provider });
    } catch {}
    finally { setLoadingTopic(null); }
  };

  // Piano settimanale generato dal Maestro sul percorso reale di questa disciplina
  const generateWeekPlan = async () => {
    setWeekPlan({ loading: true });
    try {
      const obj = nextObjective(disc);
      const prompt = `Costruisci il mio piano di allenamento per i prossimi 7 giorni in ${curriculum.name}.` +
        (obj && !obj.levelComplete ? ` Sono al livello ${obj.level.label}: il prossimo argomento da imparare è "${obj.topic}" e la milestone da sbloccare è "${obj.milestone}".` :
         obj?.levelComplete ? ` Ho completato gli argomenti del livello ${obj.level.label}: devo preparare l'ESAME della milestone "${obj.milestone}".` :
         ' Ho completato il curriculum: piano di perfezionamento livello Pro.') +
        `\nFormato: per ogni giorno (Lun-Dom) → focus, drill con serie/durata, criterio di riuscita. Includi 1-2 giorni di recupero attivo. Max 20 righe.`;
      const res = await fetch('/api/nvidia/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], athleteContext: athleteSummary() }),
      });
      const data = await res.json();
      setWeekPlan(res.ok ? { content: data.content } : null);
    } catch { setWeekPlan(null); }
  };

  // Manda alla sessione live pre-configurata (argomento o esame milestone)
  const trainLive = (context, exam = null) => {
    setPendingLive({ mode: disc, context, exam });
    onGoLive?.();
  };

  const SOLO_DISCS = [...DISCIPLINE_GROUPS[0].items, ...DISCIPLINE_GROUPS[1].items].filter((d) => CURRICULUM[d.id]);
  const overallPct = totalTopics > 0 ? totalDone / totalTopics : 0;

  return (
    <div className="space-y-4">
      {/* 👑 TRONO DEL MONARCA — la visione su TUTTE le discipline */}
      {(() => {
        const ms = monarchStats();
        const today = todaysDiscipline();
        const todayCurr = CURRICULUM[today];
        const avgSk = avgSkillsRecent();
        return (
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(139,92,246,0.08), rgba(3,7,18,0.9))', border: '1px solid rgba(251,191,36,0.3)' }}>
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #fbbf24 35%, #a855f7 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>👑 TRONO DEL MONARCA</p>
                  <p className="text-[11px] mt-1" style={{ color: '#9ca3af' }}>
                    {ms.done}/{ms.topics} tecniche · {ms.examsDone}/{ms.examsTot} esami · {ms.active.length} discipline attive
                  </p>
                </div>
                <div className="text-center flex-shrink-0">
                  <span className="text-3xl font-black" style={{ color: ms.rank === 'S' ? C.rose.hex : '#fbbf24', fontFamily: 'Syne, sans-serif', textShadow: '0 0 18px rgba(251,191,36,0.5)' }}>{ms.rank}</span>
                  <p className="text-[8px] font-mono tracking-widest" style={{ color: '#6b7280' }}>RANGO GLOBALE</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'rgba(55,65,81,0.5)' }}>
                <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #fbbf24, #a855f7)', width: `${Math.max(1, Math.round(ms.frac * 100))}%`, boxShadow: '0 0 8px rgba(251,191,36,0.4)' }} />
              </div>
              {todayCurr && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold" style={{ color: '#6b7280' }}>⚔️ OGGI IL TRONO CHIAMA</p>
                    <p className="text-xs font-black text-white truncate">{todayCurr.emoji} {todayCurr.name}{(() => { const o = nextObjective(today); return o && !o.levelComplete ? ` — ${o.topic}` : o?.levelComplete ? ' — esame milestone' : ''; })()}</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const o = nextObjective(today);
                      setPendingLive({ mode: today, context: o && !o.levelComplete ? `Obiettivo del percorso: imparare "${o.topic}" (livello ${o.level.label}). Guida drill e correzioni su QUESTO argomento.` : `Sessione di ${todayCurr.name} decisa dal percorso.` });
                      onGoLive?.();
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-black flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.1))', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>
                    📷 Rispondi
                  </motion.button>
                </div>
              )}
              {avgSk && (
                <div className="flex items-center gap-3 mt-2">
                  <SkillRadar skills={avgSk} size={130} />
                  <p className="text-[10px] leading-snug flex-1" style={{ color: '#6b7280' }}>
                    Il tuo profilo da guerriero: media delle ultime sessioni valutate dal Maestro. Le lacune si vedono — e si allenano.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(79,70,229,0.06))', border: `1px solid ${C.violet.border}` }}>
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6 40%, #4f46e5 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
        <div className="relative p-4 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', animation: 'drift-slow 10s ease-in-out infinite' }} />
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black tracking-widest" style={{ color: C.violet.hex, fontFamily: 'Syne, sans-serif' }}>📚 CURRICULUM</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-lg font-black text-white">{curriculum.name}</p>
                {rank && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black font-mono"
                    style={{ background: rank.rank === 'S' ? 'rgba(244,63,94,0.15)' : 'rgba(139,92,246,0.12)', color: rank.rank === 'S' ? C.rose.hex : C.violet.hex, border: `1px solid ${rank.rank === 'S' ? C.rose.border : C.violet.border}` }}>
                    RANGO {rank.rank}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{totalDone}/{totalTopics} argomenti · {rank?.examsDone || 0}/4 esami 🎓</p>
            </div>
            <Ring done={totalDone} total={totalTopics} color="violet" size={58} strokeW={4.5}
              label={overallPct === 1 ? '✓' : `${Math.round(overallPct * 100)}%`} />
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.5)' }}>
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${C.violet.hex}, #4f46e5, #00f2ff)`, width: `${overallPct * 100}%`, boxShadow: overallPct > 0 ? `0 0 8px ${C.violet.glow}` : 'none' }}
              layout transition={{ duration: 0.6 }} />
          </div>
        </div>
      </div>

      {/* ⌈ DAILY QUEST DEL SISTEMA ⌋ — la missione del giorno */}
      <QuestPanel />

      {/* ⚡ CINEMATICA RISVEGLIO — al passaggio di grado */}
      <AwakeningFx fx={awakening} onDone={() => setAwakening(null)} />
      {/* 🗡️ CINEMATICA ESTRAZIONE OMBRA */}
      <ShadowRiseFx fx={shadowRise} onDone={() => setShadowRise(null)} />

      {/* ⚔ MAESTRIA DELLA DISCIPLINA — sale solo con tanta pratica */}
      <div className="rounded-2xl px-4 py-2.5 flex items-center gap-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <p className="text-[8px] font-black tracking-[0.18em] whitespace-nowrap" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>⚔ MAESTRIA</p>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(55,65,81,0.5)' }}>
          <motion.div className="h-full rounded-full"
            animate={{ width: `${Math.max(1.5, discMastery)}%` }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.3, 1] }}
            style={{ background: 'linear-gradient(90deg, #b45309, #fbbf24, #fff)', boxShadow: '0 0 8px rgba(251,191,36,0.6)' }} />
        </div>
        <p className="text-[10px] font-black whitespace-nowrap" style={{ color: '#fff', fontFamily: 'Syne, sans-serif' }}>
          {discMastery}<span style={{ color: '#6b7280' }}>/100</span>
        </p>
      </div>

      {/* 🗝️ SEGRETI DEL MAESTRO — la conoscenza si sblocca col grado */}
      {discSecrets.length > 0 && (() => {
        const revealed = todaySecret && todaySecret.livello <= secretLevel;
        const nextLocked = discSecrets.find((s) => s.livello > secretLevel);
        return (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(17,24,39,0.9))', border: `1px solid ${C.amber.border}` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Syne, sans-serif' }}>🗝️ SEGRETO DEL GIORNO</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: 'rgba(55,65,81,0.4)', color: '#9ca3af' }}>
                {unlockedSecrets.length}/{discSecrets.length} rivelati · grado {rank?.rank || 'E'}
              </span>
            </div>
            {todaySecret && (revealed ? (
              <p className="text-sm text-white leading-snug"><span style={{ color: C.amber.hex }}>[{todaySecret.categoria}{todaySecret.lore ? ' · tradizione' : ''}]</span> {todaySecret.text}</p>
            ) : (
              <div className="relative">
                <p className="text-sm text-white leading-snug select-none" style={{ filter: 'blur(6px)', opacity: 0.55 }} aria-hidden>{todaySecret.text}</p>
                <p className="absolute inset-0 flex items-center justify-center text-xs font-black px-2 text-center" style={{ color: C.amber.hex }}>
                  🔒 Il Maestro lo rivelerà al grado {RANK_LABELS[Math.min(5, todaySecret.livello - 1)]}
                </p>
              </div>
            ))}
            {nextLocked && revealed && (
              <p className="text-[10px]" style={{ color: '#6b7280' }}>
                {discSecrets.filter((s) => s.livello === nextLocked.livello).length} segreti in attesa del grado {RANK_LABELS[Math.min(5, nextLocked.livello - 1)]}
              </p>
            )}
          </div>
        );
      })()}

      {/* 🗝️ CERIMONIA DI SBLOCCO — il Maestro rivela i segreti del nuovo grado */}
      <AnimatePresence>
        {unlockModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setUnlockModal(null)}>
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full rounded-2xl p-6 space-y-3"
              style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.14), rgba(17,24,39,0.98))', border: `1px solid ${C.amber.border}`, boxShadow: `0 0 40px ${C.amber.glow}` }}
              onClick={(e) => e.stopPropagation()}>
              <p className="text-center text-3xl">🗝️</p>
              <p className="text-center text-sm font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Syne, sans-serif' }}>SEGRETI SBLOCCATI — GRADO {unlockModal.rank}</p>
              <p className="text-center text-xs" style={{ color: '#9ca3af' }}>
                Il Maestro ti ritiene pronto. {unlockModal.total === 1 ? 'Un nuovo segreto' : `${unlockModal.total} nuovi segreti`} di {curriculum.name}{unlockModal.total > 5 ? ' — ecco i primi:' : ':'}
              </p>
              <div className="space-y-2">
                {unlockModal.secrets.map((s) => (
                  <div key={s.id} className="rounded-xl p-2.5" style={{ background: 'rgba(55,65,81,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-white leading-snug">{s.text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setUnlockModal(null)} className="w-full py-2.5 rounded-xl text-sm font-black" style={{ background: C.amber.hex, color: '#0b0b0f' }}>RICEVO L'INSEGNAMENTO</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⛰ LA SCALATA — livello combattente 1-100 dai tre pilastri */}
      {(() => {
        const fp = buildFighterProfile();
        const tt = levelTitle(fp.level);
        const PillarBar = ({ icon, label, val, sub }) => (
          <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black tracking-wider" style={{ color: '#fbbf24' }}>{icon} {label}</p>
              <p className="text-[9px] font-bold" style={{ color: '#94a3b8' }}>{sub}</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(51,65,85,0.6)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, val)}%`, background: 'linear-gradient(90deg,#b45309,#fbbf24)', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        );
        return (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(120,53,15,0.25), rgba(17,24,39,0.94))', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 26px rgba(251,191,36,0.12)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>⛰ LA SCALATA</p>
              <p className="text-sm font-black" style={{ color: '#fff', fontFamily: 'Syne, sans-serif' }}>{fp.level}<span style={{ color: '#78716c' }}>/100</span></p>
            </div>
            <div>
              <p className="text-base font-black tracking-wide" style={{ color: '#fde68a', fontFamily: 'Syne, sans-serif' }}>{tt.title}</p>
              <p className="text-[10px]" style={{ color: '#a8a29e' }}>{tt.sub}</p>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(51,65,85,0.6)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${Math.max(1, fp.level)}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.3, 1] }}
                style={{ background: 'linear-gradient(90deg,#b45309,#fbbf24,#fde68a)', boxShadow: '0 0 10px rgba(251,191,36,0.6)' }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PillarBar icon="🎖" label="ESPERIENZA" val={fp.pillars.esper} sub={`${fp.xp} XP`} />
              <PillarBar icon="⏳" label="COSTANZA" val={fp.pillars.costanza} sub={`${fp.days} giorni`} />
              <PillarBar icon="🥊" label="COMBATTI" val={fp.pillars.combat} sub={`IQ ${fp.fightIq} · ${fp.avgScore}`} />
            </div>
          </div>
        );
      })()}

      {/* 📖 LIBRERIA TECNICHE — posizioni/prese/combo/proiezioni, sblocco per LA SCALATA */}
      {Object.keys(techniquesByCat(disc)).length > 0 && (() => {
        const byCat = techniquesByCat(disc);
        const all = Object.values(byCat).flat();
        const fProfile = buildFighterProfile();
        const unlockedCount = all.filter((t) => evalUnlock(t, fProfile).unlocked).length;
        return (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(160deg, rgba(14,116,144,0.1), rgba(17,24,39,0.92))', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black tracking-widest" style={{ color: '#7dd3fc', fontFamily: 'Syne, sans-serif' }}>📖 TECNICHE</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
                {unlockedCount}/{all.length} · LIV {fProfile.level}
              </span>
            </div>
            {Object.entries(byCat).map(([cat, list]) => (
              <div key={cat}>
                <p className="text-[9px] font-black tracking-[0.2em] mb-1.5" style={{ color: '#64748b' }}>{CAT_LABEL[cat]}</p>
                <div className="space-y-1.5">
                  {list.map((t) => {
                    const u = evalUnlock(t, fProfile);
                    const unlocked = u.unlocked;
                    const open = openTech === t.id;
                    const reqFl = t.fl ?? lvlToFl(t.lvl);
                    const missingBits = [];
                    if (!unlocked) {
                      if (u.missing.level > 0) missingBits.push(`LIV ${reqFl}`);
                      if (u.missing.days > 0) missingBits.push(`${u.missing.days} giorni`);
                      if (u.missing.iq > 0) missingBits.push(`IQ ${u.missing.iq}`);
                    }
                    return (
                      <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(30,41,59,0.45)', border: `1px solid ${unlocked ? 'rgba(56,189,248,0.25)' : 'rgba(148,163,184,0.12)'}` }}>
                        <button onClick={() => unlocked && setOpenTech(open ? null : t.id)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                          style={{ cursor: unlocked ? 'pointer' : 'default' }}>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-bold truncate" style={{ color: unlocked ? '#e2e8f0' : '#475569', filter: unlocked ? 'none' : 'blur(3px)' }}>{t.name}</span>
                            {!unlocked && missingBits.length > 0 && (
                              <span className="block text-[8px] font-bold" style={{ color: '#78716c' }}>🔒 manca: {missingBits.join(' · ')}</span>
                            )}
                          </span>
                          <span className="text-[9px] font-black whitespace-nowrap shrink-0" style={{ color: unlocked ? '#7dd3fc' : '#475569' }}>
                            {unlocked ? (open ? '▲' : '▼') : `🔒 ${reqFl}`}
                          </span>
                        </button>
                        {open && unlocked && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {t.steps.map((s, i) => (
                              <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: '#cbd5e1' }}>
                                <span className="shrink-0 font-black" style={{ color: '#7dd3fc' }}>{i + 1}.</span>{s}
                              </p>
                            ))}
                            <p className="text-[9px] font-black tracking-widest pt-1" style={{ color: '#f87171' }}>⚠ ERRORI DA EVITARE</p>
                            {t.errori.map((e, i) => (
                              <p key={i} className="text-[10px] leading-snug flex gap-1.5" style={{ color: '#fca5a5' }}>
                                <span className="shrink-0">✗</span>{e}
                              </p>
                            ))}
                            <button onClick={() => trainLive(`Insegna la tecnica "${t.name}" (${CAT_LABEL[cat].replace(/^[^ ]+ /, '')}): guida questi step — ${t.steps.join(' / ')} — e correggimi dalla camera mentre la eseguo.`)}
                              className="w-full mt-1 py-2 rounded-lg text-[10px] font-black tracking-widest"
                              style={{ background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)', color: '#04121c', fontFamily: 'Syne, sans-serif' }}>
                              ▶ ALLENA ORA
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 🗡️ ARMATA DELLE OMBRE — ogni grado A/S estrae un soldato */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'linear-gradient(160deg, rgba(76,29,149,0.14), rgba(17,24,39,0.9))', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 22px rgba(139,92,246,0.12)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-black tracking-widest" style={{ color: '#c4b5fd', fontFamily: 'Syne, sans-serif' }}>🗡️ ARMATA DELLE OMBRE</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
            {Object.keys(army).filter((d) => CURRICULUM[d]).length}/{Object.keys(CURRICULUM).length}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.keys(CURRICULUM).map((d) => {
            const r = disciplineRank(d);
            const extracted = !!army[d];
            const eligible = r && RANK_LABELS.indexOf(r.rank) >= 4;
            return (
              <button key={d} onClick={() => extractShadow(d)} disabled={!eligible || extracted}
                className="flex flex-col items-center gap-1 shrink-0 rounded-xl p-2"
                style={{
                  minWidth: 76, cursor: eligible && !extracted ? 'pointer' : 'default',
                  background: extracted ? 'rgba(139,92,246,0.12)' : 'rgba(30,41,59,0.4)',
                  border: `1px solid ${extracted ? 'rgba(167,139,250,0.55)' : eligible ? 'rgba(251,191,36,0.5)' : 'rgba(148,163,184,0.12)'}`,
                }}>
                <ShadowSoldier extracted={extracted} size={40} glow={extracted} />
                <p className="text-[8px] font-black tracking-wider leading-none" style={{ color: extracted ? '#c4b5fd' : '#64748b' }}>
                  {CURRICULUM[d].name.split(' ')[0].toUpperCase()}
                </p>
                <p className="text-[7px] leading-none" style={{ color: eligible && !extracted ? '#fbbf24' : '#475569' }}>
                  {extracted ? `GRADO ${army[d].rank}` : eligible ? 'ESTRAI!' : 'GRADO A'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector */}
      <div className="flex flex-wrap gap-1.5">
        {SOLO_DISCS.map((d) => {
          const dp = progress[d.id] || {};
          const done = Object.values(dp).reduce((s, arr) => s + arr.length, 0);
          const tot = CURRICULUM[d.id]?.levels.reduce((s, l) => s + l.topics.length, 0) || 0;
          const isActive = disc === d.id;
          return (
            <motion.button key={d.id} whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}
              onClick={() => { setDisc(d.id); setExpandedLevel(0); setTopicLesson(null); }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all relative overflow-hidden"
              style={isActive
                ? { background: `linear-gradient(135deg, ${C.violet.hex}33, ${C.violet.hex}11)`, color: C.violet.hex, boxShadow: `0 0 0 1px ${C.violet.border}, 0 4px 14px ${C.violet.glow}`, border: `1px solid ${C.violet.border}` }
                : { background: 'rgba(55,65,81,0.35)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
              {isActive && <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', animation: 'chip-sheen 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />}
              {d.emoji} {d.label}
              {done > 0 && <span className="ml-1 opacity-60 text-[9px]">{done}/{tot}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* 🎯 Obiettivo di oggi: il percorso decide, tu esegui */}
      {objective ? (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(17,24,39,0.9))', border: `1px solid ${C.emerald.border}` }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-black tracking-widest" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>
              {objective.levelComplete ? '🎓 PRONTO PER L\'ESAME' : '🎯 OBIETTIVO DI OGGI'}
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(55,65,81,0.4)', color: '#9ca3af' }}>{objective.level.label}</span>
          </div>
          {objective.levelComplete ? (
            <p className="text-sm text-white font-bold">Hai completato gli argomenti del livello. Supera l'esame davanti al Maestro: <span style={{ color: C.emerald.hex }}>{objective.milestone}</span></p>
          ) : (
            <>
              <p className="text-sm text-white font-bold">{objective.topic}</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>Milestone del livello: {objective.milestone}</p>
            </>
          )}
          {reviews.length > 0 && (
            <p className="text-xs" style={{ color: C.amber.hex }}>🔁 Da ripassare: {reviews.map((r) => `${r.topic} (${r.days}gg fa)`).join(' · ')}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {!objective.levelComplete && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => learnTopic(objective.topic, objective.level.label)}
                className="px-3 py-2 rounded-xl text-xs font-bold" disabled={loadingTopic === objective.topic}
                style={{ background: 'rgba(139,92,246,0.12)', color: C.violet.hex, border: `1px solid ${C.violet.border}` }}>
                {loadingTopic === objective.topic ? '…' : '📖 Impara'}
              </motion.button>
            )}
            {!objective.levelComplete && (
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => trainLive(`Obiettivo del percorso: imparare "${objective.topic}" (livello ${objective.level.label}). Guida drill e correzioni su QUESTO argomento.`)}
                className="px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.12)', color: C.emerald.hex, border: `1px solid ${C.emerald.border}` }}>
                📷 Allena live
              </motion.button>
            )}
            {objective.levelComplete && (
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => trainLive(`ESAME MILESTONE (${objective.level.label}): ${objective.milestone}. Valuta severamente l'esecuzione della milestone.`,
                  { li: objective.li, label: objective.level.label, milestone: objective.milestone })}
                className="px-3 py-2 rounded-xl text-xs font-black"
                style={{ background: 'rgba(244,63,94,0.14)', color: C.rose.hex, border: `1px solid ${C.rose.border}`, boxShadow: `0 0 12px ${C.rose.glow}` }}>
                🎓 Esame live — {'>'}75/100 per la promozione
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.95 }} onClick={generateWeekPlan} disabled={weekPlan?.loading}
              className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.1)', color: C.amber.hex, border: `1px solid ${C.amber.border}` }}>
              {weekPlan?.loading ? '⏳ Il Maestro pianifica…' : '🗓️ Piano settimana'}
            </motion.button>
          </div>
          {weekPlan?.content && (
            <div className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap" style={{ background: 'rgba(3,7,18,0.6)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.06)' }}>
              {weekPlan.content}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(17,24,39,0.9))', border: `1px solid ${C.rose.border}` }}>
          <p className="text-sm font-black" style={{ color: C.rose.hex }}>👑 PERCORSO COMPLETATO — RANGO S</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Curriculum e tutti gli esami superati in {curriculum.name}. Mantieni il livello con sessioni live di perfezionamento.</p>
        </div>
      )}

      {/* 🎯 PARTI DA ZERO — la prima sessione passo-passo per chi inizia */}
      {totalDone === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 space-y-2.5"
          style={{ background: 'linear-gradient(160deg, rgba(251,191,36,0.1), rgba(17,24,39,0.94))', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.12)' }}>
          <p className="text-xs font-black tracking-widest" style={{ color: '#fbbf24', fontFamily: 'Syne, sans-serif' }}>
            🎯 PARTI DA ZERO — {curriculum.name.toUpperCase()}
          </p>
          <div className="space-y-1.5">
            {[
              `Prima mossa: impara "${objective?.topic || curriculum.levels[0].topics[0]}" — il maestro ti guarda dalla camera e ti corregge`,
              'Scalda il corpo col Conta Voce: 3 serie di pugni e squat',
              'Chiudi con 2 minuti di shadow lento: solo tecnica, zero fretta',
            ].map((step, i) => (
              <p key={i} className="text-[11px] leading-snug flex gap-2" style={{ color: '#e5e7eb' }}>
                <span className="font-black shrink-0" style={{ color: '#fbbf24' }}>{i + 1}.</span>{step}
              </p>
            ))}
          </div>
          {(() => {
            const s0 = (typeof secretsFor === 'function' ? secretsFor(disc) : [])[0];
            return s0 ? (
              <p className="text-[10px] leading-snug rounded-xl p-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}>
                🗝 Primo segreto del maestro: {s0.text}
              </p>
            ) : null;
          })()}
          <button onClick={() => trainLive(`Prima sessione da zero in ${curriculum.name}: insegna "${objective?.topic || curriculum.levels[0].topics[0]}" con drill semplici, guarda la camera e correggi tutto.`)}
            className="w-full py-2.5 rounded-xl text-xs font-black tracking-widest"
            style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', color: '#1c1204', fontFamily: 'Syne, sans-serif', boxShadow: '0 0 16px rgba(251,191,36,0.4)' }}>
            ▶ INIZIA LA PRIMA SESSIONE
          </button>
        </motion.div>
      )}

      {/* Levels */}
      <div className="space-y-2">
        {curriculum.levels.map((level, li) => {
          const completed = getCompleted(li);
          const isUnlocked = li === 0 || getCompleted(li - 1).size === curriculum.levels[li - 1].topics.length;
          const pct = level.topics.length > 0 ? completed.size / level.topics.length : 0;
          const isOpen = expandedLevel === li;
          const col = C[level.color] || C.blue;
          const isDone = pct === 1;

          return (
            <div key={li} className="rounded-2xl overflow-hidden transition-all"
              style={{ border: `1px solid ${isOpen ? col.border : 'rgba(255,255,255,0.05)'}`, opacity: isUnlocked ? 1 : 0.4, boxShadow: isOpen ? `0 4px 20px ${col.glow}22` : 'none' }}>
              {isOpen && <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${col.hex}88, transparent)` }} />}
              {/* Level header */}
              <motion.button whileTap={{ scale: 0.99 }}
                onClick={() => { if (isUnlocked) { setExpandedLevel(isOpen ? -1 : li); setTopicLesson(null); } }}
                disabled={!isUnlocked}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left relative overflow-hidden"
                style={{ background: isOpen ? `linear-gradient(135deg, ${col.bg}, rgba(17,24,39,0.9))` : 'rgba(17,24,39,0.7)' }}>
                {isOpen && <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: `linear-gradient(180deg, transparent, ${col.hex}, transparent)` }} />}
                <Ring done={completed.size} total={level.topics.length} color={level.color} size={42} strokeW={3.5}
                  label={isDone ? '✓' : `${Math.round(pct * 100)}%`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-white">
                      {!isUnlocked ? '🔒 ' : isDone ? '✅ ' : ''}{level.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono" style={{ background: col.bg, color: col.hex, border: `1px solid ${col.border}` }}>
                      SETT. {level.weeks}
                    </span>
                    {exams[disc]?.[li] && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black font-mono" style={{ background: 'rgba(244,63,94,0.12)', color: C.rose.hex, border: `1px solid ${C.rose.border}` }}>
                        🎓 {exams[disc][li].score}/100
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>{completed.size}/{level.topics.length} completati</p>
                </div>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}
                  className="text-gray-600 text-xs flex-shrink-0">▼</motion.span>
              </motion.button>

              {/* Topics */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                      {level.topics.map((topic, ti) => {
                        const isDoneT = completed.has(ti);
                        const isLoadingT = loadingTopic === topic;
                        const isShown = topicLesson?.topic === topic;
                        return (
                          <div key={ti}>
                            <div className="flex items-center gap-2.5">
                              <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTopic(li, ti)}
                                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                                style={isDoneT ? { background: col.hex, boxShadow: `0 0 8px ${col.glow}` } : { background: 'rgba(55,65,81,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {isDoneT && <span className="text-white text-[10px] font-black">✓</span>}
                              </motion.button>
                              <span className={`flex-1 text-xs ${isDoneT ? 'text-gray-600 line-through' : 'text-gray-300'}`}>{topic}</span>
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => isShown ? setTopicLesson(null) : learnTopic(topic, level.label)}
                                disabled={isLoadingT}
                                className="w-8 h-7 rounded-lg text-xs transition-all disabled:opacity-40 flex items-center justify-center"
                                style={isShown ? { background: col.hex, color: '#fff' } : { background: 'rgba(55,65,81,0.5)', color: '#9ca3af' }}>
                                {isLoadingT ? '⏳' : '📖'}
                              </motion.button>
                            </div>
                            <AnimatePresence>
                              {isShown && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="mt-2 ml-7 p-3 rounded-xl"
                                  style={{ background: 'rgba(17,24,39,0.9)', border: `1px solid ${col.border}`, backdropFilter: 'blur(8px)' }}>
                                  <p className="text-xs font-mono mb-1.5" style={{ color: col.hex, opacity: 0.8 }}>🤖 {topicLesson.provider || 'AI'} — {topic}</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{topicLesson.content}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {/* Milestone */}
                      <div className="mt-3 px-3 py-2.5 rounded-xl flex items-start gap-2.5 relative overflow-hidden"
                        style={isDone
                          ? { background: `linear-gradient(135deg, ${col.bg}, ${col.bg}88)`, border: `1px solid ${col.border}`, boxShadow: `0 0 16px ${col.glow}22` }
                          : { background: 'rgba(17,24,39,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {isDone && <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${col.hex}88, transparent)` }} />}
                        <span className="text-base mt-0.5">{isDone ? '🏆' : '🎯'}</span>
                        <div>
                          <p className="text-[10px] font-black tracking-widest mb-0.5" style={{ color: isDone ? col.hex : '#374151', fontFamily: 'Syne, sans-serif' }}>MILESTONE</p>
                          <p className="text-xs leading-relaxed" style={{ color: isDone ? col.hex : '#6b7280' }}>{level.milestone}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Combo Animator ────────────────────────────────────────────────────────────
// Joints: [head, neck, hip, shL, elL, hndL, shR, elR, hndR, hipL, knL, ftL, hipR, knR, ftR]
const POSES = {
  stance:      [[50,14],[50,34],[50,86],[37,40],[28,58],[25,72],[63,40],[72,56],[70,70],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  jab:         [[47,14],[50,34],[50,86],[37,40],[22,52],[10,62],[63,40],[72,56],[70,70],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  cross:       [[45,14],[48,34],[50,86],[37,42],[30,60],[26,74],[60,40],[44,48],[28,56],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  hook:        [[52,14],[50,34],[50,86],[37,42],[18,50],[30,62],[63,40],[72,56],[70,70],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  uppercut:    [[50,14],[50,34],[50,86],[37,42],[28,58],[26,72],[63,40],[68,64],[62,48],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  low_kick:    [[50,16],[50,34],[50,86],[35,42],[26,60],[22,74],[63,40],[72,56],[70,70],[43,92],[60,116],[78,138],[57,92],[62,124],[68,154]],
  body_kick:   [[50,16],[50,34],[50,86],[35,42],[26,60],[22,74],[63,40],[72,56],[70,70],[43,92],[62,106],[80,124],[57,92],[62,124],[68,154]],
  roundhouse:  [[50,16],[50,34],[50,86],[34,44],[24,62],[20,78],[63,44],[72,62],[70,78],[43,92],[64,84],[82,68],[57,92],[62,124],[68,154]],
  teep:        [[50,14],[52,34],[52,86],[38,42],[30,58],[26,72],[64,42],[73,58],[71,72],[45,92],[42,68],[44,50],[57,92],[62,122],[68,152]],
  knee:        [[50,14],[50,34],[50,86],[34,40],[26,56],[26,72],[66,40],[74,56],[74,72],[43,92],[40,70],[44,88],[57,92],[62,122],[68,152]],
  elbow:       [[50,14],[50,34],[50,86],[37,42],[26,52],[36,44],[63,40],[72,56],[70,70],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  side_kick:   [[50,14],[50,34],[50,86],[34,44],[24,60],[20,74],[63,44],[72,60],[70,74],[43,92],[65,92],[84,92],[57,92],[62,122],[68,152]],
  spinning:    [[50,14],[50,34],[50,86],[37,42],[30,58],[26,72],[63,42],[72,58],[70,72],[43,92],[30,118],[18,146],[57,92],[62,122],[68,152]],
  level_change:[[48,50],[48,65],[48,88],[36,68],[28,78],[22,88],[62,68],[70,78],[76,88],[42,94],[34,116],[28,146],[56,94],[64,116],[70,146]],
  clinch:      [[50,14],[50,34],[50,86],[34,40],[26,52],[28,66],[66,40],[74,52],[72,66],[43,92],[40,122],[34,152],[57,92],[62,122],[68,152]],
  sprawl:      [[50,22],[50,38],[50,80],[32,40],[22,54],[18,68],[68,40],[78,54],[82,68],[40,88],[32,112],[28,138],[60,88],[70,108],[76,136]],
  meditation:  [[50,40],[50,58],[50,86],[38,62],[42,74],[46,88],[62,62],[58,74],[54,88],[38,92],[36,108],[38,128],[62,92],[64,108],[62,128]],
};

const TECH_TO_POSE = {
  'jab':true,'Jab':true,'1':true,'Chok':true,'Kizami':true,'Double Jab':true,'Palm Strike':true,'Strike':true,'Chok-Teep':true,
  'cross':true,'Cross':true,'2':true,'Oi Zuki':true,'Gyaku Zuki':true,'Counter':true,
  'hook':true,'Hook':true,'3':true,'Gancio':true,'Gancio Corpo':true,
  'uppercut':true,'Uppercut':true,
  'low_kick':true,'Low Kick':true,'Tee Kha':true,
  'body_kick':true,'Body Kick':true,
  'roundhouse':true,'Roundhouse':true,'Mawashi Geri':true,'Dollyo':true,'High Kick':true,'Double Dollyo':true,'Dwi Chagi-Dollyo':true,'Jump Dollyo':true,'Ap-Dollyo':true,
  'teep':true,'Teep':true,'Front Kick':true,'Mae Geri':true,'Ap':true,'Ap Chagi':true,'Bênção':true,'Deng Tui':true,
  'side_kick':true,'Side Kick':true,'Yoko Geri':true,'Yeop Chagi':true,'Ce Deng Tui':true,
  'knee':true,'Knee':true,'Ginocchio':true,'Ginocchiata':true,'Kao Tone':true,'Kao Dode':true,'Groin':true,
  'elbow':true,'Elbow':true,'Gomitata':true,'Sok Ti':true,'Sok Tad':true,'Sok Ngad':true,
  'spinning':true,'Spinning':true,'Spinning Back Kick':true,'Spinning Hook':true,'Salab Fan Pla':true,'Dwi Chagi':true,
  'level_change':true,'Level Change':true,'Takedown':true,'Double Leg':true,'Doppia Gamba':true,'Burst':true,'Escape':true,
  'clinch':true,'Clinch':true,'Forearm Block':true,'360 Defense':true,
  'sprawl':true,'Sprawl':true,'Combo-Sprawl':true,
  'meditation':true,'Respiro':true,'Meditazione':true,
};

function resolvePose(tech) {
  const t = String(tech || '').trim();
  // exact match on pose key
  if (POSES[t]) return t;
  // check TECH_TO_POSE — if entry exists, derive pose key by lookup
  const poseMap = {
    'Jab':'jab','1':'jab','Chok':'jab','Kizami':'jab','Double Jab':'jab','Palm Strike':'jab','Strike':'jab',
    'Cross':'cross','2':'cross','Oi Zuki':'cross','Gyaku Zuki':'cross','Counter':'cross',
    'Hook':'hook','3':'hook','Gancio':'hook','Gancio Corpo':'hook',
    'Uppercut':'uppercut',
    'Low Kick':'low_kick','Tee Kha':'low_kick',
    'Body Kick':'body_kick',
    'Roundhouse':'roundhouse','Mawashi Geri':'roundhouse','Dollyo':'roundhouse','High Kick':'roundhouse',
    'Double Dollyo':'roundhouse','Jump Dollyo':'roundhouse','Ap-Dollyo':'roundhouse','Dwi Chagi-Dollyo':'roundhouse',
    'Teep':'teep','Front Kick':'teep','Mae Geri':'teep','Ap':'teep','Ap Chagi':'teep','Bênção':'teep','Deng Tui':'teep',
    'Side Kick':'side_kick','Yoko Geri':'side_kick','Yeop Chagi':'side_kick','Ce Deng Tui':'side_kick',
    'Knee':'knee','Ginocchio':'knee','Ginocchiata':'knee','Kao Tone':'knee','Kao Dode':'knee','Groin':'knee',
    'Elbow':'elbow','Gomitata':'elbow','Sok Ti':'elbow','Sok Tad':'elbow','Sok Ngad':'elbow',
    'Spinning Back Kick':'spinning','Spinning Hook':'spinning','Salab Fan Pla':'spinning','Dwi Chagi':'spinning',
    'Level Change':'level_change','Takedown':'level_change','Double Leg':'level_change','Doppia Gamba':'level_change','Burst':'level_change','Escape':'level_change',
    'Clinch':'clinch','Forearm Block':'clinch','360 Defense':'clinch',
    'Sprawl':'sprawl','Combo-Sprawl':'sprawl',
  };
  if (poseMap[t]) return poseMap[t];
  // partial match (case insensitive)
  const tl = t.toLowerCase();
  if (tl.includes('jab') || tl.includes('punch') || tl.includes('palm') || tl.includes('zuki')) return 'jab';
  if (tl.includes('cross')) return 'cross';
  if (tl.includes('hook') || tl.includes('gancio')) return 'hook';
  if (tl.includes('upper')) return 'uppercut';
  if (tl.includes('low kick') || tl.includes('tee kha')) return 'low_kick';
  if (tl.includes('body kick') || tl.includes('corpo')) return 'body_kick';
  if (tl.includes('round') || tl.includes('mawashi') || tl.includes('dollyo') || tl.includes('high kick')) return 'roundhouse';
  if (tl.includes('teep') || tl.includes('front kick') || tl.includes('mae geri') || tl.includes('bênção')) return 'teep';
  if (tl.includes('side kick') || tl.includes('yoko') || tl.includes('yeop')) return 'side_kick';
  if (tl.includes('knee') || tl.includes('ginoc') || tl.includes('kao')) return 'knee';
  if (tl.includes('elbow') || tl.includes('gomit') || tl.includes('sok')) return 'elbow';
  if (tl.includes('spin') || tl.includes('salab') || tl.includes('dwi')) return 'spinning';
  // grappling / atterramenti / proiezioni (incl. judo: gari/otoshi/uchimata, capoeira: rasteira)
  if (tl.includes('throw') || tl.includes('proiez') || tl.includes('proiett') || tl.includes('seoi') || tl.includes('nage') || tl.includes('toss') || tl.includes('sweep') || tl.includes('goshi') || tl.includes('sgamb') || tl.includes('gari') || tl.includes('otoshi') || tl.includes('uchimata') || tl.includes('uchi mata') || tl.includes('rasteira') || tl.includes('sapuan') || tl.includes('banting') || tl.includes('barai') || tl.includes('harai')) return 'throw';
  if (tl.includes('shoot') || tl.includes('double leg') || tl.includes('single leg') || tl.includes('takedown') || tl.includes('doppia gamba') || tl.includes('penetr')) return 'shoot';
  if (tl.includes('level') || tl.includes('burst')) return 'level_change';
  if (tl.includes('guard') || tl.includes('mount') || tl.includes('armbar') || tl.includes('choke') || tl.includes('strangol') || tl.includes('leva') || tl.includes('kimura') || tl.includes('triangle') || tl.includes('submission') || tl.includes('back take') || tl.includes('kuncian') || tl.includes('headlock') || tl.includes('leg lock')) return 'clinch';
  if (tl.includes('sprawl')) return 'sprawl';
  // Wing Chun sticky-hands (tan/bong/pak/fook/wu sao) = mani da guardia/deviazione
  if (tl.includes('clinch') || tl.includes('collar') || tl.includes('kumi') || tl.includes('sao')) return 'clinch';
  // Capoeira: calci circolari specifici
  if (tl.includes('queixada') || tl.includes('martelo') || tl.includes('meia lua')) return 'roundhouse';
  if (tl.includes('armada')) return 'spinning';
  // fitness / flow / yoga / respiro
  if (tl.includes('squat') || tl.includes('accosc') || tl.includes('air squat') || tl.includes('pistol')) return 'squat';
  if (tl.includes('push') || tl.includes('piegament') || tl.includes('dip')) return 'pushup';
  if (tl.includes('plank') || tl.includes('hollow') || tl.includes('dragon')) return 'plank';
  if (tl.includes('lunge') || tl.includes('affond')) return 'lunge';
  if (tl.includes('warrior') || tl.includes('guerrier') || tl.includes('virabhadra')) return 'warrior';
  if (tl.includes('tree') || tl.includes('albero') || tl.includes('vrks') || tl.includes('equilibr') || tl.includes('balance')) return 'tree';
  if (tl.includes('fold') || tl.includes('uttanasana') || tl.includes('avanti') || tl.includes('hamstring') || tl.includes('pinza')) return 'forward_fold';
  if (tl.includes('bridge') || tl.includes('ponte') || tl.includes('glute') || tl.includes('wheel') || tl.includes('cobra') || tl.includes('ruota')) return 'bridge';
  if (tl.includes('respir') || tl.includes('breath') || tl.includes('pranayam') || tl.includes('medita') || tl.includes('box breathing') || tl.includes('wim hof') || tl.includes('tummo')) return 'breathe';
  if (tl.includes('run') || tl.includes('cors') || tl.includes('sprint') || tl.includes('scatto') || tl.includes('jog') || tl.includes('cadenza')) return 'run';
  if (tl.includes('burpee') || tl.includes('thruster') || tl.includes('wall ball')) return 'squat';
  if (tl.includes('stretch') || tl.includes('allung') || tl.includes('mobilit') || tl.includes('pnf')) return 'forward_fold';
  return 'stance';
}

// ── FRAME ANNOTATO PER L'AI ─────────────────────────────────────────────────
// Sul frame spedito al modello disegniamo ciò che NOI abbiamo già misurato:
// scheletro colorato (giunti ROSSI dove c'è un alert certo), scia del movimento
// di polsi/caviglie e HUD con angoli e segnali. Il VLM così non misura più —
// legge fatti già verificati e interpreta la scena. Stessa resa con modelli free.
const ANNOT_CONN = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const alertJoints = (alerts) => {
  const red = new Set();
  for (const a of alerts || []) {
    const s = String(a).toLowerCase();
    const dx = s.includes('dx');
    if (s.includes('gomito')) (dx ? [12, 14, 16] : [11, 13, 15]).forEach((i) => red.add(i));
    if (s.includes('guardia') || s.includes('mano')) (dx ? [12, 16] : [11, 15]).forEach((i) => red.add(i));
    if (s.includes('ginocchio')) (dx ? [24, 26, 28] : [23, 25, 27]).forEach((i) => red.add(i));
    if (s.includes('anca')) (dx ? [12, 24] : [11, 23]).forEach((i) => red.add(i));
    if (s.includes('busto') || s.includes('schiena')) [11, 12, 23, 24].forEach((i) => red.add(i));
  }
  return red;
};
// Disegna il frame annotato e ritorna il base64 jpeg. `trail` = campioni
// {t, lw, rw, la, ra} accumulati nel loop MediaPipe (coordinate normalizzate).
function drawAnnotatedFrame(video, lm, pose, trail, maxDim = 512, quality = 0.68) {
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const sc = Math.min(1, maxDim / vw);
  const W = Math.round(vw * sc), H = Math.round(vh * sc);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(video, 0, 0, W, H);
  const rawB64 = () => c.toDataURL('image/jpeg', quality).split(',')[1];
  if (!lm || lm.length < 29) return rawB64();
  const X = (p) => p.x * W, Y = (p) => p.y * H;
  const vis = (i) => lm[i]?.visibility ?? 1;
  // 1) Scia del movimento: archi a dissolvenza (il modello vede il gesto in una foto)
  const drawTrail = (key, rgb) => {
    const pts = (trail || []).map((s) => s[key]).filter(Boolean);
    if (pts.length < 2) return;
    for (let i = 1; i < pts.length; i++) {
      const alpha = Math.round((i / pts.length) * 200);
      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(pts[i - 1]), Y(pts[i - 1]));
      ctx.lineTo(X(pts[i]), Y(pts[i]));
      ctx.stroke();
    }
  };
  drawTrail('lw', '255,196,0');   // polso sx
  drawTrail('rw', '255,120,0');   // polso dx
  drawTrail('la', '0,220,255');   // caviglia sx
  drawTrail('ra', '0,140,255');   // caviglia dx
  // 2) Scheletro: verde = ok, rosso = alert misurato dal sistema
  const red = alertJoints(pose?.alerts);
  ctx.lineWidth = 2;
  for (const [a, b] of ANNOT_CONN) {
    if (vis(a) < 0.35 || vis(b) < 0.35) continue;
    ctx.strokeStyle = (red.has(a) || red.has(b)) ? 'rgba(255,60,60,0.95)' : 'rgba(0,255,136,0.85)';
    ctx.beginPath(); ctx.moveTo(X(lm[a]), Y(lm[a])); ctx.lineTo(X(lm[b]), Y(lm[b])); ctx.stroke();
  }
  for (let i = 11; i <= 28; i++) {
    const p = lm[i];
    if (!p || vis(i) < 0.35) continue;
    ctx.fillStyle = red.has(i) ? '#ff3c3c' : '#00ff88';
    ctx.beginPath(); ctx.arc(X(p), Y(p), red.has(i) ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // 3) HUD: i fatti certi, scritti grandi (il modello legge, non stima)
  const hudLines = [];
  if (pose?.hint) {
    const seg = pose.hint.split(', ');
    for (let i = 0; i < seg.length; i += 4) hudLines.push(seg.slice(i, i + 4).join(', '));
  }
  (pose?.alerts || []).slice(0, 4).forEach((a) => hudLines.push('⚠ ' + a));
  if (hudLines.length) {
    const fs = Math.max(13, Math.round(W / 32));
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    hudLines.slice(0, 5).forEach((t, i) => {
      const y = 6 + i * (fs + 5);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t, 6, y);
      ctx.fillStyle = t.startsWith('⚠') ? '#ff6b6b' : '#ffffff';
      ctx.fillText(t, 6, y);
    });
  }
  return rawB64();
}

// ── SPECCHIO: confronta gli angoli REALI (MediaPipe) con quelli ideali della tecnica ──
// Deterministico e istantaneo: nessuna AI. Giunti ok/off + correzioni concrete.
const POSE_FAMILY = {
  jab: 'straight', cross: 'straight',
  hook: 'hook', uppercut: 'uppercut', elbow: 'hook',
  guard: 'guard', stance: 'guard', ready: 'guard', clinch: 'guard',
  squat: 'squat', lunge: 'lunge',
  teep: 'kick', roundhouse: 'kick', low_kick: 'kick', body_kick: 'kick', side_kick: 'kick', spinning: 'kick',
  knee: 'knee',
  plank: 'plank', pushup: 'pushup', bridge: 'bridge', tree: 'tree', warrior: 'warrior',
  forward_fold: 'forward_fold', run: 'run',
};
const jointAngle = (L, a, b, c) => {
  const A = L[a], B = L[b], C = L[c];
  if (!A || !B || !C) return null;
  const v1x = A.x - B.x, v1y = A.y - B.y, v2x = C.x - B.x, v2y = C.y - B.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return null;
  return Math.round((Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI);
};
const anglesFromLandmarks = (L) => {
  if (!L || L.length < 29) return null;
  const mid = (a, b, k) => (L[a] && L[b] ? (L[a][k] + L[b][k]) / 2 : null);
  const sx = mid(11, 12, 'x'), sy = mid(11, 12, 'y'), hx = mid(23, 24, 'x'), hy = mid(23, 24, 'y');
  const lean = (sx != null && hx != null) ? Math.round((Math.atan2(Math.abs(sx - hx), Math.abs(hy - sy) || 0.001) * 180) / Math.PI) : null;
  return {
    eL: jointAngle(L, 11, 13, 15), eR: jointAngle(L, 12, 14, 16),
    kL: jointAngle(L, 23, 25, 27), kR: jointAngle(L, 24, 26, 28),
    hL: jointAngle(L, 11, 23, 25), hR: jointAngle(L, 12, 24, 26), lean,
  };
};
const _rng = (v, lo, hi) => v != null && v >= lo && v <= hi;
function matchPose(a, key) {
  if (!a) return null;
  const J = {}; const hints = [];
  const mark = (name, ok, hint) => { J[name] = a[name] == null ? 'na' : (ok ? 'ok' : 'off'); if (a[name] != null && !ok && hint) hints.push(hint); };
  // Come mark(), ma il messaggio dipende dalla DIREZIONE dell'errore (troppo chiuso vs troppo aperto)
  // — evita correzioni ambigue tipo "piega il gomito" quando il gomito è già troppo piegato.
  const markDir = (name, lo, hi, hintLow, hintHigh) => {
    const v = a[name];
    if (v == null) { J[name] = 'na'; return; }
    const ok = v >= lo && v <= hi;
    J[name] = ok ? 'ok' : 'off';
    const h = v < lo ? hintLow : hintHigh;
    if (!ok && h) hints.push(h);
  };
  const extKey = (a.eL ?? -1) >= (a.eR ?? -1) ? 'eL' : 'eR';
  const gKey = extKey === 'eL' ? 'eR' : 'eL';
  const eMax = Math.max(a.eL ?? -1, a.eR ?? -1), eMin = Math.min(a.eL ?? 999, a.eR ?? 999);
  const kneesSoft = () => { mark('kL', _rng(a.kL, 148, 178), 'piega un filo le ginocchia, non bloccarle'); mark('kR', _rng(a.kR, 148, 178), null); };
  const torsoUp = (lim = 28) => { if (a.lean != null) { J.lean = a.lean <= lim ? 'ok' : 'off'; if (a.lean > lim) hints.push('raddrizza il busto'); } };
  const fam = POSE_FAMILY[key] || 'posture';

  if (fam === 'straight') {
    mark(extKey, eMax >= 150, 'estendi di più il braccio che colpisce, quasi dritto');
    mark(gKey, eMin <= 120, 'tieni l\'altra mano a guardia, gomito piegato');
    kneesSoft(); torsoUp();
  } else if (fam === 'hook') {
    mark(extKey, _rng(eMax, 70, 130), 'gancio: gomito a circa 90°, parallelo a terra');
    mark(gKey, eMin <= 120, 'guardia su con l\'altra mano'); kneesSoft(); torsoUp();
  } else if (fam === 'uppercut') {
    mark(extKey, _rng(eMax, 45, 110), 'montante: piega il gomito e sali dal basso');
    mark(gKey, eMin <= 120, 'guardia su'); kneesSoft(); torsoUp();
  } else if (fam === 'guard') {
    markDir('eL', 55, 118, 'apri leggermente il gomito, non serrarlo sul viso', 'piega di più il gomito, pugno vicino al mento');
    markDir('eR', 55, 118, null, null);
    kneesSoft(); torsoUp();
  } else if (fam === 'squat') {
    markDir('kL', 60, 120, 'scendi di più, cosce verso il parallelo', 'non scendere oltre, resta sul parallelo');
    markDir('kR', 60, 120, null, null);
    if (a.hL != null || a.hR != null) mark(a.hL <= a.hR ? 'hL' : 'hR', _rng(Math.min(a.hL ?? 999, a.hR ?? 999), 50, 130), 'fianchi indietro e giù');
    torsoUp(45);
  } else if (fam === 'lunge') {
    const kf = a.kL <= a.kR ? 'kL' : 'kR';
    markDir(kf, 70, 120, 'scendi di più con il ginocchio anteriore', 'non scendere oltre i 90°, rischi il ginocchio');
    torsoUp(30);
  } else if (fam === 'kick') {
    const kk = (a.kL ?? -1) >= (a.kR ?? -1) ? 'kL' : 'kR';
    mark(kk, (a[kk] ?? 0) >= 150, 'estendi la gamba che calcia');
    if (a.lean != null) { J.lean = a.lean <= 48 ? 'ok' : 'off'; if (a.lean > 48) hints.push('resta in equilibrio, non sbilanciarti troppo'); }
    mark(gKey, eMin <= 125, 'tieni le mani su mentre calci');
  } else if (fam === 'knee') {
    const hk = (a.hL ?? 999) <= (a.hR ?? 999) ? 'hL' : 'hR';
    mark(hk, (a[hk] ?? 999) <= 105, 'alza di più il ginocchio verso il bersaglio'); torsoUp(40);
  } else if (fam === 'plank') {
    // Plank su avambracci: gomito piegato a circa 90°, sotto la spalla.
    markDir('eL', 70, 110, 'gomito troppo chiuso, apri leggermente: deve restare sotto la spalla', 'gomito troppo aperto, portalo sotto la spalla (circa 90°)');
    markDir('eR', 70, 110, null, null);
    // L'anca (spalla-anca-ginocchio) misura quanto ci si allontana dalla linea retta, ma NON
    // distingue se il cedimento è verso il basso o un pike verso l'alto (in entrambi i casi
    // l'angolo si allontana da 180° in modo simile) — un solo hint non direzionale.
    const hk = (a.hL ?? 999) <= (a.hR ?? 999) ? 'hL' : 'hR';
    mark(hk, _rng(a[hk], 155, 180), 'allinea i fianchi: non farli cadere né alzarli troppo, corpo una linea retta');
  } else if (fam === 'pushup') {
    // Nota: il vero angolo di "tuck" del gomito rispetto al busto (~45° vs 90° a T) richiede
    // l'angolo di abduzione della spalla (anca-spalla-gomito), non disponibile in questo set
    // di angoli (eL/eR = solo spalla-gomito-polso). Approssimo con la profondità di
    // piegamento del gomito nella fase bassa della flessione.
    markDir('eL', 60, 100, 'non scendere troppo in basso, evita di schiacciare le spalle', 'scendi di più, petto vicino al pavimento');
    markDir('eR', 60, 100, null, null);
    const hk = (a.hL ?? 999) <= (a.hR ?? 999) ? 'hL' : 'hR';
    mark(hk, _rng(a[hk], 155, 180), 'tieni i fianchi allineati, corpo una linea retta');
  } else if (fam === 'bridge') {
    // Estensione dell'anca verso l'alto: più l'angolo si avvicina a 180° più il bacino è
    // sollevato. Il limite superiore (180°) è già il massimo matematico, quindi non serve un
    // hint per "troppo in alto". Movimento bilaterale (come lo squat): controlliamo entrambi
    // i lati, non solo uno, per non perdere l'errore sul fianco/ginocchio che sta peggio.
    markDir('hL', 150, 180, 'spingi di più con i talloni, alza il bacino verso l\'alto', null);
    markDir('hR', 150, 180, null, null);
    markDir('kL', 70, 110, 'ginocchia troppo chiuse, allarga leggermente l\'appoggio dei piedi', 'piega di più le ginocchia, piedi vicino ai glutei');
    markDir('kR', 70, 110, null, null);
  } else if (fam === 'tree') {
    // Equilibrio su una gamba: la gamba d'appoggio è quella più distesa (angolo maggiore).
    const kStand = (a.kL ?? -1) >= (a.kR ?? -1) ? 'kL' : 'kR';
    mark(kStand, _rng(a[kStand], 160, 180), 'raddrizza di più la gamba d\'appoggio, quasi dritta per l\'equilibrio');
    torsoUp(16); // soglia stretta: l'equilibrio richiede un busto ben verticale
  } else if (fam === 'warrior') {
    // Ginocchio anteriore a ~90° come nell'affondo, ma qui il busto resta ERETTO (non
    // inclinato come in 'lunge').
    const kf = (a.kL ?? 999) <= (a.kR ?? 999) ? 'kL' : 'kR';
    // Angolo piccolo = ginocchio più piegato del target (~90°) → rischio; angolo grande =
    // gamba troppo tesa, non abbastanza piegata.
    markDir(kf, 70, 120, 'non scendere oltre i 90°, proteggi il ginocchio', 'piega di più il ginocchio anteriore, cerca i 90°');
    torsoUp(20);
    // Braccia distese lateralmente (se rilevabili): gomiti quasi dritti
    mark('eL', _rng(a.eL, 150, 180), 'braccia più tese, allineate alle spalle');
    mark('eR', _rng(a.eR, 150, 180), null);
  } else if (fam === 'forward_fold') {
    // Qui l'obiettivo è l'OPPOSTO di torsoUp: vogliamo il busto piegato in avanti sulle
    // gambe, non verticale — quindi non riusiamo torsoUp(), verifichiamo l'hip hinge
    // direttamente sull'angolo anca (hL/hR): più piccolo = più piegato in avanti.
    const hk = (a.hL ?? 999) <= (a.hR ?? 999) ? 'hL' : 'hR';
    markDir(hk, 20, 90, 'non forzare troppo in avanti, allunga la schiena invece di accartocciarti', 'piega di più sui fianchi, avvicina il busto alle gambe');
    kneesSoft();
  } else if (fam === 'run') {
    // Un solo frame non permette di sapere con certezza quale gamba è in appoggio e quale in
    // sospensione, quindi non alterniamo kL/kR come in una vera falcata: verifichiamo solo
    // che ci sia un'asimmetria netta tra le ginocchia (segno di corsa in corso, non di corpo
    // fermo).
    if (a.kL != null && a.kR != null) {
      const kf = a.kL <= a.kR ? 'kL' : 'kR';
      mark(kf, Math.abs(a.kL - a.kR) >= 20, 'solleva di più il ginocchio della gamba libera, cerca una falcata più marcata');
    }
    // In corsa una leggera inclinazione in avanti è CORRETTA (non un errore come nel
    // torsoUp standard): troppo verticale frena il passo, troppo inclinato sbilancia.
    markDir('lean', 3, 15, 'inclinati leggermente in avanti, busto troppo verticale frena la falcata', 'piegati meno in avanti, rischi di sbilanciarti');
  } else { // posture — utile per qualsiasi movimento/asana
    kneesSoft(); torsoUp(35);
  }

  const vals = Object.values(J).filter((s) => s !== 'na');
  const score = vals.length ? Math.round((vals.filter((s) => s === 'ok').length / vals.length) * 100) : 0;
  return { score, joint: J, hints: hints.slice(0, 2) };
}

// Superficie di contatto ESATTA per tecnica: con cosa/dove colpisci — precisione chirurgica.
const STRIKE_SURFACE = {
  jab: 'nocche (indice-medio), braccio quasi dritto', cross: 'nocche, ruota il piede posteriore',
  hook: 'prime due nocche, gomito a 90°', uppercut: 'nocche, colpo dal basso verso il mento',
  elbow: 'punta del gomito (osso), non l\'avambraccio',
  knee: 'punto dell\'osso del ginocchio, non la coscia',
  teep: 'pianta/tallone del piede, gamba distesa', side_kick: 'tallone o lato esterno del piede',
  low_kick: 'terzo inferiore della tibia, non il piede', body_kick: 'terzo inferiore della tibia',
  roundhouse: 'collo del piede o tibia, ruota l\'anca', spinning: 'tallone, occhi sul bersaglio nel giro',
  clinch: 'presa salda, controlla non stringere', level_change: 'spalla nel busto avversario',
  throw: 'presa su manica/bavero + anca sotto il baricentro', shoot: 'spalla nell\'addome, mani dietro le ginocchia',
  sprawl: 'anche a terra, peso sulla schiena avversaria',
};
const strikeSurfaceFor = (poseKey) => STRIKE_SURFACE[poseKey] || '';

const _lerp = (a, b, f) => a + (b - a) * f;
const _lerpPose = (A, B, f) => A.map((pt, i) => [_lerp(pt[0], B[i][0], f), _lerp(pt[1], B[i][1], f)]);
const _easeOut = (x) => 1 - Math.pow(1 - x, 3);
const _easeIn = (x) => x * x * x;
// timeline del colpo su un ciclo (ms): scatta fuori → tiene → ritrae → guardia
const _throwT = (ms) => {
  const P = 1250, t = ms % P;
  if (t < 170) return _easeOut(t / 170);            // sferra (rapido)
  if (t < 400) return 1;                            // impatto (tiene)
  if (t < 640) return 1 - _easeIn((t - 400) / 240); // ritrae
  return 0;                                         // in guardia
};
const _prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// ── Pose RIVOLTE AL SACCO (fighter a sinistra, sacco a destra) ────────────────
// 15 giunti: [testa,collo,bacino, shL,elL,hndL, shR,elR,hndR, hipL,knL,ftL, hipR,knR,ftR]
// L'arto che colpisce raggiunge sempre il sacco a destra (x≈80) → tecnica leggibile.
const BAG_POSES = {
  guard:        [[34,16],[36,33],[38,84],[41,39],[46,48],[50,33],[31,39],[36,48],[44,33],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  jab:          [[34,16],[36,33],[38,84],[41,39],[58,48],[78,46],[31,39],[36,48],[44,33],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  cross:        [[35,16],[37,33],[38,84],[41,39],[46,48],[48,33],[34,40],[56,50],[80,48],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  hook:         [[34,16],[36,33],[38,84],[41,39],[62,44],[76,54],[31,39],[36,48],[44,33],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  uppercut:     [[34,16],[36,33],[38,84],[41,39],[46,48],[50,33],[33,44],[58,66],[74,50],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  elbow:        [[34,16],[36,33],[38,84],[41,39],[72,48],[60,40],[31,39],[35,52],[45,42],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  knee:         [[34,16],[36,33],[38,82],[41,39],[47,48],[54,52],[31,39],[35,48],[50,54],[42,86],[45,116],[48,150],[36,84],[62,90],[50,112]],
  teep:         [[33,16],[35,33],[37,84],[41,39],[47,52],[52,42],[31,39],[35,52],[45,42],[42,86],[54,84],[80,84],[34,86],[31,118],[28,152]],
  low_kick:     [[33,16],[35,33],[37,84],[41,39],[47,52],[52,42],[31,39],[35,52],[45,42],[42,86],[45,116],[48,150],[34,84],[52,106],[82,122]],
  body_kick:    [[32,18],[35,34],[37,84],[41,39],[47,52],[52,42],[31,39],[35,52],[45,42],[42,86],[45,116],[48,150],[34,82],[54,90],[84,92]],
  roundhouse:   [[32,18],[35,34],[37,84],[41,39],[47,52],[52,42],[31,39],[35,52],[45,42],[42,86],[45,116],[48,150],[34,80],[52,72],[86,60]],
  side_kick:    [[30,20],[33,36],[37,84],[30,40],[34,54],[38,64],[31,39],[35,52],[45,42],[42,86],[54,86],[84,86],[34,88],[30,120],[27,152]],
  spinning:     [[34,16],[36,33],[38,84],[41,39],[47,52],[52,44],[31,39],[35,52],[45,44],[42,86],[45,116],[48,150],[34,80],[54,74],[86,66]],
  level_change: [[34,40],[36,54],[38,92],[41,60],[54,74],[64,84],[31,60],[52,76],[62,86],[42,94],[46,120],[48,150],[34,94],[32,122],[28,152]],
  clinch:       [[34,16],[36,33],[38,84],[41,38],[54,44],[70,40],[31,38],[48,46],[68,44],[42,86],[45,116],[48,150],[34,86],[31,118],[28,152]],
  sprawl:       [[30,30],[33,44],[40,78],[38,50],[50,70],[58,86],[30,50],[46,72],[54,88],[42,84],[46,116],[54,150],[34,86],[30,120],[30,152]],
  meditation:   [[38,40],[38,56],[38,86],[30,62],[34,74],[44,80],[46,62],[42,74],[46,80],[30,90],[28,108],[40,120],[46,90],[48,108],[36,120]],
};
BAG_POSES.stance = BAG_POSES.guard;
// e = giunto che impatta, l = giunti dell'arto da evidenziare
const BAG_STRIKE = {
  jab: { e: 5, l: [3,4,5] }, cross: { e: 8, l: [6,7,8] }, hook: { e: 5, l: [3,4,5] },
  uppercut: { e: 8, l: [6,7,8] }, elbow: { e: 4, l: [3,4] }, knee: { e: 13, l: [12,13] },
  teep: { e: 11, l: [9,10,11] }, side_kick: { e: 11, l: [9,10,11] }, low_kick: { e: 14, l: [12,13,14] },
  body_kick: { e: 14, l: [12,13,14] }, roundhouse: { e: 14, l: [12,13,14] }, spinning: { e: 14, l: [12,13,14] },
  // clinch (leva/kimura/sao/kuncian...): presa con ENTRAMBE le braccia, non un pugno con una sola
  clinch: { e: 5, l: [3,4,5,6,7,8] }, level_change: { e: 8, l: [6,7,8] },
};
// Tecniche di PRESA/PROIEZIONE (grappling): grammatica visiva diversa dallo strike —
// entrambe le braccia evidenziate, avversario sbilanciato con forza, niente scintilla da pugno
// (che leggerebbe come un colpo percussivo invece che una leva/controllo).
const GRIP_TECH = new Set(['throw', 'clinch', 'shoot']);

// Movimenti SOLO (fitness/flow/yoga) — figura senza bersaglio. Base = 'ready'.
Object.assign(BAG_POSES, {
  ready:        [[38,16],[38,33],[38,86],[31,40],[29,56],[30,72],[45,40],[47,56],[46,72],[42,88],[42,118],[42,152],[34,88],[34,118],[34,152]],
  squat:        [[38,40],[38,54],[38,92],[40,56],[48,64],[58,70],[36,56],[46,64],[56,72],[42,94],[52,116],[50,150],[34,94],[30,116],[28,150]],
  pushup:       [[20,98],[30,100],[54,106],[30,100],[28,112],[26,124],[32,102],[30,114],[28,126],[54,106],[70,112],[86,118],[54,108],[70,114],[86,120]],
  plank:        [[20,96],[30,98],[56,104],[30,98],[26,110],[24,122],[32,100],[28,112],[26,124],[56,104],[72,110],[88,116],[56,106],[72,112],[88,118]],
  lunge:        [[40,20],[40,36],[40,88],[33,44],[31,60],[32,74],[47,44],[49,60],[48,74],[44,90],[52,120],[54,150],[36,90],[22,120],[18,150]],
  warrior:      [[40,22],[40,38],[40,86],[46,42],[58,42],[70,42],[34,42],[22,42],[10,42],[46,88],[56,118],[62,152],[34,88],[24,118],[18,152]],
  tree:         [[40,24],[40,40],[40,88],[36,44],[38,32],[40,20],[44,44],[42,32],[40,20],[42,90],[42,120],[42,152],[38,90],[26,104],[40,110]],
  forward_fold: [[40,60],[40,74],[40,86],[38,72],[38,90],[38,110],[42,72],[42,90],[42,110],[42,90],[42,120],[42,152],[38,90],[38,120],[38,152]],
  bridge:       [[18,120],[26,118],[50,104],[26,118],[22,128],[20,140],[28,118],[24,128],[22,140],[50,104],[64,116],[70,140],[50,106],[66,116],[72,140]],
  breathe:      [[40,18],[40,34],[40,88],[34,44],[38,64],[44,80],[46,44],[42,64],[36,80],[43,90],[43,120],[43,152],[37,90],[37,120],[37,152]],
  run:          [[42,18],[41,34],[40,86],[34,42],[28,52],[24,44],[47,42],[54,54],[60,48],[43,88],[36,112],[28,132],[37,88],[50,110],[62,128]],
  throw:        [[36,30],[38,44],[42,78],[44,44],[58,44],[72,52],[34,46],[30,60],[26,74],[46,80],[50,110],[54,140],[38,80],[30,110],[26,140]],
  shoot:        [[52,64],[46,72],[40,92],[50,74],[62,84],[74,92],[42,74],[52,86],[64,94],[42,94],[50,118],[58,148],[36,94],[34,120],[30,150]],
});
const SOLO_POSES = new Set(['ready','squat','pushup','plank','lunge','warrior','tree','forward_fold','bridge','breathe','run']);
const SOLO_STATIC = new Set(['plank','pushup','warrior','tree','bridge','forward_fold','ready']);
// grapple/atterramenti che raggiungono l'avversario — presa a due mani, non un colpo con una sola
const GRAPPLE_STRIKE = { throw: { e: 5, l: [3,4,5,6,7,8] }, shoot: { e: 8, l: [3,4,5,6,7,8] } };
// Avversario che subisce (guardia rivolta all'attaccante, lato destro)
const OPPONENT_POSE = [[86,20],[85,36],[84,86],[84,40],[82,54],[80,44],[88,40],[90,54],[92,44],[82,88],[82,120],[82,152],[88,88],[89,120],[92,152]];
// Scena per disciplina: 'bag' (colpi) | 'opponent' (partner/grappling) | 'solo' (movimento)
const DISCIPLINE_SCENE = {
  muaythai:'bag', boxing:'bag', kickboxing:'bag', muayboran:'bag', kravmaga:'bag', selfdefense:'bag', sanda:'bag',
  karate:'opponent', taekwondo:'opponent', mma:'opponent', judo:'opponent', wrestling:'opponent',
  bjj:'opponent', sambo:'opponent', lutalivre:'opponent', capoeira:'opponent', hapkido:'opponent',
  wingchun:'opponent', kungfu:'opponent', silat:'opponent', kendo:'opponent', pankration:'opponent',
  systema:'opponent', kalaripayattu:'opponent',
  yoga:'solo', stretching:'solo', calisthenics:'solo', crossfit:'solo', running:'solo',
  breathing:'solo', fitness:'solo', general:'solo',
};
const sceneFor = (mode) => DISCIPLINE_SCENE[mode] || (/sparring|partner|drill/.test(mode || '') ? 'opponent' : 'bag');

// ── OBIETTIVO dichiarato → template mirato (fallback locale, niente AI) ────────
// Parole chiave semplici: dal testo libero dell'utente (o dallo storico debolezze/focus)
// deriviamo un "obiettivo" che sceglie un circuito diverso, non solo un nome diverso.
const GOAL_KEYWORDS = [
  ['potenza',  /potenza|esplosiv|power|forza esplosiva|massima forza/i],
  ['cardio',   /cardio|resistenza|fiato|endurance|resistenz|no[\s-]?stop/i],
  ['tecnica',  /tecnica|precision|forma|coordinazione|allineamento/i],
  ['mobilita', /mobilit|recupero|flessibilit|rigidit|stretch|allunga/i],
  ['difesa',   /guardia|difesa|copertura|contropiede|counter|schivata|equilibrio|bilanciamento/i],
];
const resolveGoal = (text) => {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  for (const [tag, re] of GOAL_KEYWORDS) if (re.test(t)) return tag;
  return null;
};
// Debolezza ricorrente più recente per la disciplina corrente → stesso set di tag "obiettivo",
// così il circuito locale può indirizzarla anche senza input esplicito nella sessione attuale.
// ── MEMORIA DELL'ATLETA ──────────────────────────────────────────────────────
// Un maestro vero non ti vede per la prima volta a ogni colpo: ricorda i tuoi
// difetti di sempre, li caccia, e si accorge quando li hai risolti. Qui
// distilliamo lo storico locale in un profilo che il cervello AI userà live.
// Parti del corpo/concetti su cui si ancora un difetto ricorrente.
const BODY_ANCHORS = ['mento', 'guardia', 'mano', 'gomito', 'spalla', 'anca', 'ginocchio', 'piede', 'gamba', 'braccio', 'testa', 'sguardo', 'schiena', 'baricentro', 'equilibrio', 'respiro', 'rotazione', 'appoggio', 'distanza', 'ritmo'];
const anchorsOf = (text) => {
  const t = String(text || '').toLowerCase();
  return BODY_ANCHORS.filter((a) => t.includes(a));
};

function buildLearnerProfile(pastSessions, mode, insisted = []) {
  const baseMode = String(mode || '').replace(/^sparring_/, '');
  const mine = (pastSessions || []).filter((s) => s.mode === mode || s.mode === baseMode);
  if (!mine.length && !insisted.length) return null;

  const scored = mine.filter((s) => typeof s.score === 'number');
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;

  // Un difetto è RICORRENTE se la stessa ancora compare nelle debolezze di ≥2 sessioni.
  const seen = {};              // ancora → indici di sessione (0 = più recente)
  mine.forEach((s, i) => {
    const anchors = new Set((s.weaknesses || []).flatMap(anchorsOf));
    anchors.forEach((a) => { (seen[a] ||= []).push(i); });
  });

  const recurring = [];
  const mastered = [];
  Object.entries(seen).forEach(([anchor, idxs]) => {
    if (idxs.length < 2) return;
    // Presente ancora di recente (ultime 2 sessioni) → lo caccia. Sparito → risolto.
    const stillRecent = idxs.some((i) => i <= 1);
    // Testo reale della debolezza più recente su quest'ancora: molto più utile della sola parola.
    const src = mine[idxs[0]]?.weaknesses?.find((w) => anchorsOf(w).includes(anchor));
    (stillRecent ? recurring : mastered).push(src ? `${anchor}: ${src}` : anchor);
  });

  const last = mine[0] || {};
  const level = avgScore == null ? null : avgScore >= 80 ? 'avanzato' : avgScore >= 60 ? 'intermedio' : 'principiante';

  const profile = {
    sessions: mine.length,
    ...(avgScore != null && { avgScore }),
    ...(level && { level }),
    ...(recurring.length && { recurring: recurring.slice(0, 4) }),
    ...(mastered.length && { mastered: mastered.slice(0, 3) }),
    ...((last.focusNext || []).length && { focus: last.focusNext.slice(0, 3) }),
    ...(insisted.length && { insisted: insisted.slice(-4) }),
  };
  return Object.keys(profile).length ? profile : null;
}

const resolveGoalFromHistory = (pastSessions, mode) => {
  const recent = (pastSessions || []).find((s) => s.mode === mode && ((s.weaknesses || []).length || (s.focusNext || []).length));
  if (!recent) return null;
  const text = [...(recent.weaknesses || []), ...(recent.focusNext || [])].join(' ; ');
  return resolveGoal(text);
};

// ── Template striking/grappling (scena 'bag' | 'opponent') per obiettivo ───────
// picks: 3-4 combo pescati da COMBO_LIBRARY, già mischiati — ogni obiettivo li usa
// con un framing e un ritmo diversi, non solo rinominati.
function buildStrikeTemplate(goal, picks) {
  const c = (i, fallback) => picks[i] || fallback || 'Combo libera';
  if (goal === 'potenza') return [
    { name: 'Riscaldamento: sciolto e reattivo', durationSec: 30, focus: 'Muoviti sui piedi, scarica le spalle', watchFor: 'guardia alta, respiro libero' },
    { name: `${c(0)} — colpo singolo max potenza`, durationSec: 35, focus: 'Un colpo alla volta, tutta la catena cinetica', watchFor: 'radicamento a terra, anca che ruota' },
    { name: `${c(1)} — carico pesante`, durationSec: 45, focus: 'Esegui carico e scarico, cerca il colpo più duro', watchFor: 'espirazione secca ad ogni colpo' },
    { name: `${c(2, c(0))} — combo di potenza`, durationSec: 50, focus: 'Concatena a piena potenza, torna in guardia', watchFor: "niente colpi 'a vuoto', sempre stabile" },
    { name: 'Serie esplosiva finale', durationSec: 50, focus: 'Raffica di colpi al massimo sforzo, poi recupero', watchFor: 'tecnica che regge anche sotto sforzo' },
    { name: 'Scarico spalle e braccia', durationSec: 30, focus: 'Scuoti gli arti, respira lento', watchFor: 'spalle rilassate' },
  ];
  if (goal === 'cardio') return [
    { name: 'Riscaldamento in movimento', durationSec: 30, focus: 'Passo leggero continuo, mani alte', watchFor: 'fiato regolare' },
    { name: `${c(0)} — leggero e continuo`, durationSec: 40, focus: 'Colpi leggeri senza fermarti mai', watchFor: 'gambe sempre in movimento' },
    { name: `${c(1)} — ripetizioni no-stop`, durationSec: 45, focus: 'Alto volume, poca potenza per colpo', watchFor: 'respiro ritmico, niente apnea' },
    { name: `${c(2, c(0))} — cardio a onde`, durationSec: 45, focus: 'Alterna 10s intenso / 10s leggero', watchFor: 'recupero attivo, non fermarti' },
    { name: 'Round cardio no-stop', durationSec: 60, focus: 'Colpisci in continuo per tutto il round', watchFor: 'gestione del fiato' },
    { name: 'Defaticamento e respiro', durationSec: 35, focus: 'Rallenta gradualmente, respiro 1:2', watchFor: 'battito che scende' },
  ];
  if (goal === 'tecnica') return [
    { name: 'Riscaldamento tecnico', durationSec: 30, focus: 'Movimento lento, guardia curata', watchFor: 'postura pulita' },
    { name: `${c(0)} — isolato e lento`, durationSec: 40, focus: 'Ogni colpo al 50%, controlla la forma', watchFor: 'traiettoria dritta, ritorno in guardia' },
    { name: `${c(1)} — davanti allo specchio mentale`, durationSec: 45, focus: 'Immagina lo specchio, correggi ogni imprecisione', watchFor: 'allineamento anca-spalla-colpo' },
    { name: `${c(2, c(0))} — precisione crescente`, durationSec: 45, focus: 'Aumenta gradualmente la velocità mantenendo la forma', watchFor: 'nessun colpo impreciso' },
    { name: 'Combo a velocità controllata', durationSec: 45, focus: 'Concatena tutto con massima pulizia tecnica', watchFor: 'fluidità, zero tensione inutile' },
    { name: 'Mobilità e allineamento finale', durationSec: 30, focus: 'Sciogli anche e spalle', watchFor: 'range di movimento pieno' },
  ];
  if (goal === 'difesa') return [
    { name: 'Riscaldamento: guardia e passo', durationSec: 30, focus: 'Muoviti mantenendo sempre la guardia', watchFor: 'mani alte, mento basso' },
    { name: 'Guardia e parata', durationSec: 40, focus: 'Para colpi immaginari, resta compatto', watchFor: 'gomiti stretti al corpo' },
    { name: 'Schivata e contro', durationSec: 45, focus: 'Schiva lateralmente poi rispondi con un colpo', watchFor: 'testa fuori linea, contro immediato' },
    { name: `${c(0)} — con enfasi sul rientro in guardia`, durationSec: 45, focus: 'Dopo ogni tecnica torna subito in guardia solida', watchFor: 'zero pause scoperte' },
    { name: 'Difesa-contro in sequenza', durationSec: 50, focus: 'Alterna blocco/schivata e contrattacco rapido', watchFor: 'equilibrio durante il contro' },
    { name: 'Respiro e rilascio tensione', durationSec: 30, focus: 'Rilassa collo e spalle', watchFor: 'respiro lento e profondo' },
  ];
  // default: circuito misto (nessun obiettivo dichiarato) — come prima ma più ricco
  return [
    { name: 'Riscaldamento: guardia e movimento', durationSec: 35, focus: 'Muoviti sui piedi, mani alte, sciogli le spalle', watchFor: 'guardia alta, baricentro basso' },
    { name: c(0), durationSec: 40, focus: 'Esegui lento e pulito, torna sempre in guardia', watchFor: 'tecnica precisa, ritorno in guardia' },
    { name: c(1), durationSec: 40, focus: 'Aumenta leggermente il ritmo mantenendo la forma', watchFor: 'tecnica precisa, ritorno in guardia' },
    { name: c(2, c(0)), durationSec: 45, focus: 'Esegui con più intensità', watchFor: 'guardia sempre coperta' },
    { name: 'Combo libera', durationSec: 45, focus: 'Concatena le tecniche a tuo ritmo', watchFor: 'respiro e fluidità' },
    { name: 'Defaticamento', durationSec: 30, focus: 'Rallenta e respira profondamente', watchFor: 'spalle rilassate' },
  ];
}

// ── Template scena 'solo' (yoga/running/breathing/fitness...) per obiettivo ────
function buildYogaTemplate(goal) {
  if (goal === 'potenza') return [
    { name: 'Respiro e attivazione', durationSec: 30, focus: 'In piedi, attiva il core con qualche respiro profondo', watchFor: 'spalle basse' },
    { name: 'Chair Pose — tenuta', durationSec: 40, focus: 'Piega le ginocchia come su una sedia, braccia su', watchFor: 'peso sui talloni, schiena lunga' },
    { name: 'Plank alto — tenuta forza', durationSec: 45, focus: 'Corpo rigido, spingi le mani a terra', watchFor: 'niente cedimento lombare' },
    { name: 'Warrior III — equilibrio+forza', durationSec: 45, focus: 'Bilanciati su una gamba, tronco parallelo a terra', watchFor: 'core attivo, bacino in linea' },
    { name: 'Boat Pose — tenuta addominale', durationSec: 45, focus: 'V con corpo, gambe tese, petto alto', watchFor: 'schiena lunga non curva' },
    { name: 'Bridge — spinta glutei', durationSec: 40, focus: 'Spingi coi talloni, apri il petto', watchFor: 'glutei attivi' },
    { name: 'Respiro finale', durationSec: 35, focus: 'Rilascia le tensioni con respiro lento', watchFor: 'muscoli che si sciolgono' },
  ];
  if (goal === 'cardio') return [
    { name: 'Respiro dinamico', durationSec: 25, focus: 'Respiro rapido di attivazione', watchFor: 'petto e pancia si muovono insieme' },
    { name: 'Saluto al sole — flow lento', durationSec: 40, focus: 'Collega i movimenti al respiro', watchFor: 'transizioni fluide' },
    { name: 'Saluto al sole — flow veloce', durationSec: 45, focus: 'Stesso flow ma ritmo continuo, senza pause', watchFor: 'respiro che segue il ritmo' },
    { name: 'Warrior a Warrior — flow continuo', durationSec: 45, focus: "Passa da un lato all'altro senza fermarti", watchFor: 'fluidità, gambe attive' },
    { name: 'Vinyasa ripetuto', durationSec: 50, focus: 'Ripeti la sequenza flow al massimo ritmo sostenibile', watchFor: 'respiro che non si blocca' },
    { name: 'Defaticamento e respiro', durationSec: 35, focus: 'Rallenta gradualmente il flow', watchFor: 'battito che scende' },
  ];
  if (goal === 'tecnica') return [
    { name: 'Centratura e allineamento', durationSec: 30, focus: 'In piedi, allinea caviglie-anche-spalle', watchFor: 'peso distribuito equamente' },
    { name: 'Forward Fold — allineamento', durationSec: 40, focus: 'Piega dall\'anca, colonna lunga', watchFor: 'schiena lunga, non curva' },
    { name: 'Warrior II — precisione angoli', durationSec: 45, focus: 'Ginocchio esattamente sopra la caviglia, anche aperte', watchFor: 'angolo di 90° al ginocchio' },
    { name: 'Tree — equilibrio e postura', durationSec: 40, focus: "Un piede sull'interno coscia, bacino livellato", watchFor: 'bacino stabile, sguardo fisso' },
    { name: 'Triangle — allineamento laterale', durationSec: 40, focus: 'Fianco lungo, sguardo verso l\'alto', watchFor: 'busto su un solo piano' },
    { name: 'Bridge — controllo', durationSec: 40, focus: 'Sali e scendi con controllo, non di scatto', watchFor: 'movimento lento e guidato' },
    { name: 'Respiro finale', durationSec: 30, focus: 'Osserva l\'allineamento a occhi chiusi', watchFor: 'respiro calmo' },
  ];
  // default / mobilita: flessibilità (come prima, leggermente esteso)
  return [
    { name: 'Respiro e centratura', durationSec: 35, focus: 'In piedi, respira lento dal naso e allunga la colonna', watchFor: 'spalle basse e rilassate' },
    { name: 'Forward Fold', durationSec: 45, focus: 'Piega in avanti dall\'anca, ginocchia morbide', watchFor: 'schiena lunga, non curva' },
    { name: 'Warrior II', durationSec: 45, focus: 'Affondo laterale, braccia parallele a terra', watchFor: 'ginocchio anteriore sopra la caviglia' },
    { name: 'Tree — equilibrio', durationSec: 40, focus: "Un piede sull'interno coscia, sguardo fisso", watchFor: 'bacino stabile, respiro calmo' },
    { name: 'Bridge', durationSec: 40, focus: 'Spingi coi talloni, apri il petto', watchFor: 'glutei attivi, collo libero' },
    { name: 'Respiro finale', durationSec: 40, focus: 'Respiro 4-7-8, rilascia le tensioni', watchFor: 'pancia che si gonfia nell\'inspiro' },
  ];
}
function buildRunningTemplate(goal) {
  if (goal === 'potenza') return [
    { name: 'Riscaldamento articolare', durationSec: 30, focus: 'Caviglie e anche, movimenti ampi', watchFor: 'corpo sciolto' },
    { name: 'Skip alto', durationSec: 30, focus: 'Ginocchia su, braccia a 90°', watchFor: 'busto leggermente avanti' },
    { name: 'Balzi in avanti', durationSec: 35, focus: 'Spingi forte a ogni balzo', watchFor: 'atterraggio morbido sul mesopiede' },
    { name: 'Sprint breve massimale', durationSec: 30, focus: 'Massima velocità per pochi secondi', watchFor: 'braccia che spingono forte' },
    { name: 'Sprint ripetuti', durationSec: 45, focus: 'Alterna sprint corti e recupero camminato', watchFor: 'esplosività ad ogni partenza' },
    { name: 'Defaticamento e respiro', durationSec: 35, focus: 'Cammina e rallenta il battito', watchFor: 'respiro che si calma' },
  ];
  if (goal === 'cardio') return [
    { name: 'Riscaldamento leggero', durationSec: 30, focus: 'Corsa lenta sul posto', watchFor: 'respiro regolare' },
    { name: 'Corsa cadenza 180', durationSec: 45, focus: 'Passi rapidi e corti, ritmo costante', watchFor: 'contatto breve col suolo' },
    { name: 'Corsa a ritmo costante', durationSec: 50, focus: 'Mantieni un ritmo sostenibile e continuo', watchFor: 'respiro controllato, non affannoso' },
    { name: 'Fartlek leggero', durationSec: 50, focus: 'Alterna tratti più veloci e più lenti senza fermarti', watchFor: 'gestione del fiato' },
    { name: 'Corsa lunga a ritmo blando', durationSec: 55, focus: 'Resisti a ritmo basso ma costante', watchFor: 'postura che regge nel tempo' },
    { name: 'Defaticamento e respiro', durationSec: 40, focus: 'Rallenta e respira 1:2', watchFor: 'spalle rilassate' },
  ];
  if (goal === 'tecnica') return [
    { name: 'Attivazione mesopiede', durationSec: 30, focus: "Piccoli saltelli sul posto sull'avampiede", watchFor: 'appoggio leggero' },
    { name: 'Skip basso — cadenza', durationSec: 35, focus: 'Passi piccoli e rapidissimi', watchFor: 'cadenza alta, niente rimbalzo verticale' },
    { name: 'Corsa a braccia controllate', durationSec: 40, focus: "Concentrati solo sull'oscillazione delle braccia", watchFor: 'braccia a 90°, non incrociano il corpo' },
    { name: 'Corsa cadenza 180 — focus tecnico', durationSec: 45, focus: 'Passi rapidi e corti, mesopiede sotto il baricentro', watchFor: 'nessun rimbalzo, busto stabile' },
    { name: 'Corsa con controllo posturale', durationSec: 45, focus: 'Busto leggermente avanti, sguardo lontano', watchFor: 'postura che non collassa' },
    { name: 'Defaticamento e respiro', durationSec: 30, focus: 'Rallenta gradualmente', watchFor: 'respiro regolare' },
  ];
  // default / mobilita: come prima
  return [
    { name: 'Corsa sul posto', durationSec: 45, focus: 'Cadenza alta, piedi leggeri', watchFor: 'mesopiede sotto il baricentro' },
    { name: 'Skip alto', durationSec: 30, focus: 'Ginocchia su, braccia a 90°', watchFor: 'busto leggermente avanti' },
    { name: 'Affondi in camminata', durationSec: 40, focus: 'Passi lunghi e controllati', watchFor: 'ginocchio non oltre la punta' },
    { name: 'Corsa cadenza 180', durationSec: 50, focus: 'Passi rapidi e corti', watchFor: 'contatto breve col suolo' },
    { name: 'Defaticamento e respiro', durationSec: 40, focus: 'Rallenta e respira 1:2', watchFor: 'spalle rilassate' },
  ];
}
function buildBreathingTemplate(goal) {
  if (goal === 'potenza') return [
    { name: 'Respiro diaframmatico', durationSec: 35, focus: "Mano sull'ombelico, gonfia la pancia", watchFor: 'petto fermo, pancia che sale' },
    { name: 'Respiro di potenza — attivazione', durationSec: 40, focus: '3 respiri rapidi e profondi, poi espiro forte', watchFor: 'core che si attiva ad ogni espiro' },
    { name: 'Respiro tipo Wim Hof — 20 atti', durationSec: 45, focus: 'Respira rapido e profondo per 20 atti, poi trattieni', watchFor: 'niente tensione al collo' },
    { name: 'Espiro esplosivo ripetuto', durationSec: 40, focus: 'Inspira normale, espira con forza e suono', watchFor: 'addome che si contrae di scatto' },
    { name: 'Respiro di potenza — ripetizione', durationSec: 40, focus: 'Ripeti il ciclo rapido con più energia', watchFor: 'ritmo che resta controllato' },
    { name: 'Calma finale', durationSec: 35, focus: 'Respiro naturale, lascia scendere il battito', watchFor: 'battito che rallenta' },
  ];
  if (goal === 'cardio') return [
    { name: 'Respiro diaframmatico', durationSec: 30, focus: "Mano sull'ombelico, gonfia la pancia", watchFor: 'petto fermo, pancia che sale' },
    { name: 'Respiro ritmico 3:2', durationSec: 40, focus: 'Inspira 3 tempi, espira 2 — cammina o marcia sul posto', watchFor: 'ritmo che non si spezza' },
    { name: 'Respiro sotto sforzo leggero', durationSec: 45, focus: 'Sali le scale immaginarie mantenendo il respiro ritmico', watchFor: 'niente apnea sotto sforzo' },
    { name: 'Respiro di recupero attivo', durationSec: 45, focus: 'Alterna 20s intenso e respiro controllato, 20s calmo', watchFor: 'recupero rapido tra le fasi' },
    { name: 'Respiro a resistenza crescente', durationSec: 45, focus: "Allunga gradualmente l'espiro mantenendo il ritmo", watchFor: 'fiato che regge fino alla fine' },
    { name: 'Calma finale', durationSec: 35, focus: 'Respiro naturale, rallenta', watchFor: 'battito che scende' },
  ];
  if (goal === 'tecnica') return [
    { name: 'Osservazione del respiro', durationSec: 30, focus: 'Nota dove va naturalmente il tuo respiro', watchFor: 'nessuno sforzo, solo osservazione' },
    { name: 'Box breathing 4-4-4-4', durationSec: 45, focus: 'Inspira, tieni, espira, tieni — 4 secondi ciascuno', watchFor: 'ritmo costante e preciso' },
    { name: 'Respiro 4-7-8 — precisione conteggio', durationSec: 45, focus: 'Inspira 4, tieni 7, espira 8, conta con precisione', watchFor: 'espiro lungo e lento fino alla fine' },
    { name: 'Respiro alternato (nadi shodhana)', durationSec: 45, focus: 'Alterna le narici con le dita, ritmo regolare', watchFor: 'transizioni fluide tra le narici' },
    { name: 'Box breathing — conteggio esteso', durationSec: 40, focus: 'Stesso schema ma 5 secondi per fase', watchFor: 'precisione anche con conteggio più lungo' },
    { name: 'Calma finale', durationSec: 30, focus: 'Torna al respiro naturale osservandolo', watchFor: 'mente calma' },
  ];
  // default / mobilita: rilassante (come prima)
  return [
    { name: 'Respiro diaframmatico', durationSec: 40, focus: "Mano sull'ombelico, gonfia la pancia", watchFor: 'petto fermo, pancia che sale' },
    { name: 'Box breathing 4-4-4-4', durationSec: 45, focus: 'Inspira, tieni, espira, tieni — 4 secondi ciascuno', watchFor: 'ritmo costante' },
    { name: 'Respiro 4-7-8', durationSec: 45, focus: 'Inspira 4, tieni 7, espira 8', watchFor: 'espiro lungo e lento' },
    { name: 'Respiro di potenza', durationSec: 35, focus: '3 respiri rapidi, poi espiro forte', watchFor: 'core che si attiva' },
    { name: 'Calma finale', durationSec: 40, focus: 'Respiro naturale, mente vuota', watchFor: 'battito che rallenta' },
  ];
}
function buildFitnessTemplate(goal) {
  if (goal === 'potenza') return [
    { name: 'Riscaldamento articolare', durationSec: 30, focus: 'Mobilizza caviglie, anche e spalle', watchFor: 'corpo sciolto' },
    { name: 'Squat con salto', durationSec: 40, focus: "Scendi in squat, esplodi verso l'alto", watchFor: 'atterraggio morbido sulle ginocchia' },
    { name: 'Push-up esplosivo', durationSec: 40, focus: 'Spingi con forza da staccare le mani da terra (o massimo sforzo)', watchFor: 'core rigido, niente cedimento' },
    { name: 'Affondi con salto', durationSec: 45, focus: "Cambia gamba a mezz'aria con salto", watchFor: 'atterraggio controllato' },
    { name: 'Plank con spinta', durationSec: 45, focus: 'Da plank, spingi in alto ad ogni ripetizione', watchFor: 'bacino stabile durante lo sforzo' },
    { name: 'Serie esplosiva finale', durationSec: 45, focus: 'Combina squat-jump e push-up al massimo sforzo', watchFor: 'tecnica che regge sotto fatica' },
    { name: 'Defaticamento', durationSec: 30, focus: 'Scuoti gli arti, respira lento', watchFor: 'muscoli che si rilassano' },
  ];
  if (goal === 'cardio') return [
    { name: 'Riscaldamento cardio leggero', durationSec: 30, focus: 'Corsa sul posto leggera', watchFor: 'respiro che si scalda gradualmente' },
    { name: 'Mountain climber', durationSec: 40, focus: 'Ginocchia al petto alternate, ritmo veloce', watchFor: 'bacino stabile, non ondeggia' },
    { name: 'Burpee', durationSec: 45, focus: 'Squat-plank-push-up-salto, ritmo continuo', watchFor: 'fiato regolare tra le fasi' },
    { name: 'Corsa sul posto ad alta cadenza', durationSec: 45, focus: 'Ginocchia alte, braccia attive', watchFor: 'cadenza costante' },
    { name: 'Jumping jack ripetuti', durationSec: 45, focus: 'Ritmo continuo senza pause', watchFor: 'respiro che segue il movimento' },
    { name: 'Round cardio no-stop', durationSec: 50, focus: 'Alterna gli esercizi precedenti senza fermarti', watchFor: 'gestione del fiato' },
    { name: 'Defaticamento e respiro', durationSec: 35, focus: 'Rallenta e respira 1:2', watchFor: 'battito che scende' },
  ];
  if (goal === 'tecnica') return [
    { name: 'Attivazione e allineamento', durationSec: 30, focus: 'Controlla postura di base in piedi', watchFor: 'colonna neutra' },
    { name: 'Squat tempo lento (3-1-3)', durationSec: 40, focus: 'Scendi in 3 secondi, tieni 1, risali in 3', watchFor: 'ginocchia in linea coi piedi' },
    { name: 'Push-up controllato', durationSec: 40, focus: 'Scendi lento, gomiti a 45°, nessun rimbalzo', watchFor: 'corpo rigido tutto il tempo' },
    { name: 'Plank con attivazione core', durationSec: 45, focus: 'Contrai addome e glutei consapevolmente', watchFor: 'linea retta testa-bacino-talloni' },
    { name: 'Affondo con controllo', durationSec: 45, focus: "Scendi lento, verifica l'allineamento del ginocchio", watchFor: 'ginocchio posteriore quasi a terra, controllato' },
    { name: 'Sequenza a bassa velocità, alta precisione', durationSec: 40, focus: 'Ripeti gli esercizi a metà velocità curando la forma', watchFor: 'zero compensi' },
    { name: 'Defaticamento', durationSec: 30, focus: 'Respira e rilassa i muscoli lavorati', watchFor: 'tensione che si scioglie' },
  ];
  // default / mobilita: misto forza-cardio come prima, con mobilità finale
  return [
    { name: 'Squat', durationSec: 40, focus: 'Scendi lento, petto alto', watchFor: 'ginocchia in linea coi piedi' },
    { name: 'Push-up', durationSec: 40, focus: 'Corpo rigido, gomiti a 45°', watchFor: 'niente cedimento lombare' },
    { name: 'Plank', durationSec: 40, focus: 'Linea retta testa-bacino-talloni', watchFor: 'core attivo, bacino stabile' },
    { name: 'Affondi', durationSec: 45, focus: 'Alterna le gambe, busto dritto', watchFor: 'ginocchio posteriore quasi a terra' },
    { name: 'Corsa sul posto', durationSec: 45, focus: 'Cardio finale, cadenza alta', watchFor: 'respiro ritmico' },
    { name: 'Mobilità e stretching finale', durationSec: 35, focus: 'Allunga gambe e schiena con calma', watchFor: 'respiro lento' },
  ];
}
// timeline "ripetizione" (fitness/flow): scendi → tieni → risali → pausa
const _repT = (ms) => { const P = 1700, t = ms % P; if (t < 620) return _easeOut(t / 620); if (t < 900) return 1; if (t < 1500) return 1 - _easeIn((t - 900) / 600); return 0; };

// ── SCENA UNIVERSALE: attaccante + (sacco | avversario | nessuno) ─────────────
// Ogni disciplina ha la scena giusta. Colpo→bersaglio con impatto; fitness→ripetizioni;
// yoga/respiro→posa. Torso pieno, arti spessi, trail di movimento, griglia prospettica.
const StickFigure = React.memo(function StickFigure({ poseKey, color = '#00f2ff', size = 130, highlight = false, animate = true, scene = 'bag' }) {
  let key = BAG_POSES[poseKey] ? poseKey : (scene === 'solo' ? 'ready' : 'guard');
  if (scene === 'solo' && (key === 'guard' || key === 'stance')) key = 'ready';
  const strike = BAG_STRIKE[key] || GRAPPLE_STRIKE[key] || null;
  const isSolo = SOLO_POSES.has(key);
  const target = BAG_POSES[key];
  const base = BAG_POSES[isSolo ? 'ready' : 'guard'];
  const dynamic = !!strike || (isSolo && !SOLO_STATIC.has(key));
  const throwing = animate && dynamic && !_prefersReducedMotion();
  const hasTarget = !!strike && scene !== 'solo';
  const showBag = hasTarget && scene === 'bag';
  const showOpp = hasTarget && scene === 'opponent';
  const isBreath = key === 'breathe';

  const [t, setT] = useState(throwing ? 0 : 1);
  const rafRef = useRef(0);
  const lastRef = useRef(-1);
  const svgRef = useRef(null);
  const onScreenRef = useRef(true);
  // Ferma il motore quando la figura esce dallo schermo: zero lavoro sprecato.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { onScreenRef.current = e.isIntersecting; });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!throwing) { setT(1); return; }
    const tl = BAG_STRIKE[key] || GRAPPLE_STRIKE[key] ? _throwT : _repT;
    let start = 0;
    let lastCommit = 0;
    const loop = (now) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!onScreenRef.current) { start = 0; return; }             // fuori schermo: congela
      if (!start) start = now;
      if (now - lastCommit < 33) return;                            // ~30fps: metà dei re-render, fluidità identica
      const v = tl(now - start);
      if (Math.abs(v - lastRef.current) > 0.012) { lastRef.current = v; lastCommit = now; setT(v); }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [throwing, key]);

  const p = throwing ? _lerpPose(base, target, t) : target;
  const limb = strike ? strike.l : null;
  const STRIKE = '#ff7a1a';
  const uid = `${key}-${color.replace('#', '')}-${Math.round(size)}-${scene}`;
  const big = size >= 74;
  const gy = 158;
  const pulse = hasTarget ? Math.max(0, Math.min(1, (t - 0.64) / 0.34)) : 0;

  const arms = [[3,4],[4,5],[6,7],[7,8]];
  const legs = [[9,10],[10,11],[12,13],[13,14]];
  const isStrikeSeg = (a, b) => limb && limb.includes(a) && limb.includes(b);
  const hands = [5, 8], feet = [11, 14];
  const torso = `${p[3][0]},${p[3][1]} ${p[6][0]},${p[6][1]} ${p[12][0]},${p[12][1]} ${p[9][0]},${p[9][1]}`;
  const limbW = big ? 4.6 : 4;
  const legW = big ? 5.4 : 4.6;
  const gloveR = big ? 5.2 : 4.4;

  const isGrip = GRIP_TECH.has(key);
  const E = strike ? target[strike.e] : null;          // punto d'impatto/presa
  const bagRot = -pulse * 4, bagDx = pulse * 3.5;
  const oppRot = isGrip ? pulse * 24 : pulse * 7;        // presa/proiezione sbilancia MOLTO di più di un colpo
  const zoom = 1 + pulse * 0.03;                         // micro-zoom all'impatto

  // ghost dell'arto che colpisce a t precedenti → scia di velocità
  const trail = (throwing && strike && t > 0.18)
    ? [0.14, 0.28].map((d) => strike.l.map((j) => _lerpPose(base, target, Math.max(0, t - d))[j]))
    : [];

  return (
    <svg ref={svgRef} width={size} height={size * 1.5} viewBox="0 0 112 168" style={{ overflow: 'visible' }}>
      <defs>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`sh-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.4" /><stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`bag-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b45309" /><stop offset="45%" stopColor="#92400e" /><stop offset="100%" stopColor="#5b2c08" />
        </linearGradient>
        <radialGradient id={`flash-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#fde68a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`head-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* Griglia prospettica del pavimento */}
      <g opacity={0.12} stroke={color} strokeWidth={0.6}>
        <line x1={4} y1={152} x2={108} y2={152} />
        <line x1={-6} y1={166} x2={118} y2={166} />
        {[16, 40, 64, 88].map((x, i) => <line key={i} x1={x} y1={152} x2={x - 10 + i * 2} y2={166} />)}
      </g>
      {/* Ombra + terra */}
      <ellipse cx={44} cy={gy} rx={30} ry={4} fill={`url(#sh-${uid})`} />
      <line x1={8} y1={gy} x2={108} y2={gy} stroke={color} strokeWidth={1} strokeDasharray="2 5" opacity={0.28} />
      {/* Aura di energia a terra: divampa all'impatto */}
      {big && (
        <ellipse cx={44} cy={gy} rx={24 + pulse * 12} ry={3.2 + pulse * 1.6} fill="none"
          stroke={pulse > 0.2 ? STRIKE : color} strokeWidth={1.3} opacity={0.18 + pulse * 0.5}
          filter={pulse > 0.2 ? `url(#glow-${uid})` : undefined} />
      )}

      {/* SACCO da boxe */}
      {showBag && (
        <g transform={`rotate(${bagRot} 88 6) translate(${bagDx} 0)`} style={{ transition: 'transform 0.05s linear' }}>
          {big && <line x1={88} y1={0} x2={88} y2={30} stroke="#6b7280" strokeWidth={1.6} />}
          {big && <path d="M82 26 L94 26 L91 32 L85 32 Z" fill="#4b5563" />}
          <rect x={79} y={30} width={18} height={118} rx={8} fill={`url(#bag-${uid})`} stroke="#3a1d05" strokeWidth={1.2} />
          <line x1={79} y1={52} x2={97} y2={52} stroke="#3a1d05" strokeWidth={1.4} opacity={0.6} />
          <line x1={79} y1={112} x2={97} y2={112} stroke="#3a1d05" strokeWidth={1.4} opacity={0.6} />
          <rect x={82} y={34} width={5} height={110} rx={3} fill="#fff" opacity={0.10} />
        </g>
      )}
      {/* AVVERSARIO che subisce */}
      {showOpp && (
        <g transform={`rotate(${oppRot} 86 152)`} style={{ transition: 'transform 0.05s linear' }} opacity={0.6}>
          <polygon points={`${OPPONENT_POSE[3][0]},${OPPONENT_POSE[3][1]} ${OPPONENT_POSE[6][0]},${OPPONENT_POSE[6][1]} ${OPPONENT_POSE[12][0]},${OPPONENT_POSE[12][1]} ${OPPONENT_POSE[9][0]},${OPPONENT_POSE[9][1]}`} fill="#64748b" opacity={0.5} />
          {[[1,2],[3,4],[4,5],[6,7],[7,8],[9,10],[10,11],[12,13],[13,14]].map(([a, b], i) => (
            <line key={i} x1={OPPONENT_POSE[a][0]} y1={OPPONENT_POSE[a][1]} x2={OPPONENT_POSE[b][0]} y2={OPPONENT_POSE[b][1]} stroke="#94a3b8" strokeWidth={3.6} strokeLinecap="round" />
          ))}
          <circle cx={OPPONENT_POSE[0][0]} cy={OPPONENT_POSE[0][1]} r={8} fill="#64748b" stroke="#94a3b8" strokeWidth={1.4} />
        </g>
      )}

      {/* Fantasma della base (statico) */}
      {big && throwing && strike && (
        <g opacity={0.13} stroke="#94a3b8" fill="none" strokeLinecap="round">
          {[...arms, ...legs].map(([a, b], i) => (
            <line key={i} x1={base[a][0]} y1={base[a][1]} x2={base[b][0]} y2={base[b][1]} strokeWidth={3} />
          ))}
          <circle cx={base[0][0]} cy={base[0][1]} r={8} />
        </g>
      )}

      {/* Corpo (con micro-zoom all'impatto) */}
      <g transform={`translate(${44 * (1 - zoom)}, ${gy * (1 - zoom)}) scale(${zoom})`}>
        {/* Scia di velocità dell'arto */}
        {trail.map((pts, ti) => (
          <polyline key={`tr${ti}`} points={pts.map((q) => `${q[0]},${q[1]}`).join(' ')}
            fill="none" stroke={STRIKE} strokeWidth={limbW} strokeLinecap="round" opacity={0.22 - ti * 0.08} />
        ))}

        {/* Gambe */}
        {legs.map(([a, b], i) => {
          const s = isStrikeSeg(a, b);
          return <line key={`l${i}`} x1={p[a][0]} y1={p[a][1]} x2={p[b][0]} y2={p[b][1]}
            stroke={s ? STRIKE : color} strokeWidth={s ? legW + 1.4 : legW} strokeLinecap="round"
            filter={s ? `url(#glow-${uid})` : undefined} opacity={0.96} />;
        })}
        {feet.map((j) => {
          const s = limb && limb.includes(j);
          return <ellipse key={`f${j}`} cx={p[j][0] + 2} cy={p[j][1]} rx={4.4} ry={2.5} fill={s ? STRIKE : color} opacity={0.95} />;
        })}

        {/* Torso + colonna */}
        <polygon points={torso} fill={color} opacity={0.22} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
        <line x1={p[1][0]} y1={p[1][1]} x2={p[2][0]} y2={p[2][1]} stroke={color} strokeWidth={legW} strokeLinecap="round" opacity={0.9} />

        {/* Braccia */}
        {arms.map(([a, b], i) => {
          const s = isStrikeSeg(a, b);
          return <line key={`a${i}`} x1={p[a][0]} y1={p[a][1]} x2={p[b][0]} y2={p[b][1]}
            stroke={s ? STRIKE : color} strokeWidth={s ? limbW + 1.6 : limbW} strokeLinecap="round"
            filter={s ? `url(#glow-${uid})` : undefined} />;
        })}
        {hands.map((j) => {
          const s = limb && limb.includes(j);
          return <circle key={`h${j}`} cx={p[j][0]} cy={p[j][1]} r={s ? gloveR + 0.8 : gloveR}
            fill={s ? STRIKE : color} filter={s ? `url(#glow-${uid})` : undefined} stroke="#0b0e14" strokeWidth={0.8} />;
        })}

        {/* Collo + Testa */}
        <line x1={p[0][0]} y1={p[0][1] + 6} x2={p[1][0]} y2={p[1][1]} stroke={color} strokeWidth={legW - 1} strokeLinecap="round" opacity={0.85} />
        <circle cx={p[0][0]} cy={p[0][1]} r={9} fill={`url(#head-${uid})`} stroke={color} strokeWidth={1.6} />
        <circle cx={p[0][0] + 4} cy={p[0][1] - 1} r={1.7} fill="#0b0e14" opacity={0.75} />
      </g>

      {/* Anello del respiro (breathing) */}
      {isBreath && (
        <circle cx={p[2][0]} cy={(p[1][1] + p[2][1]) / 2} r={14 + t * 10} fill="none" stroke={color}
          strokeWidth={1.6} opacity={0.4 - t * 0.15} />
      )}

      {/* IMPATTO (colpo) vs CONTROLLO (presa/proiezione) — grammatica visiva diversa */}
      {E && pulse > 0.18 && !isGrip && (
        <g style={{ pointerEvents: 'none' }}>
          {/* Flash radiale dietro il punto d'impatto */}
          <circle cx={E[0]} cy={E[1]} r={5 + pulse * 15} fill={`url(#flash-${uid})`} opacity={Math.max(0, 1.15 - pulse)} />
          {/* Scintille irregolari (angoli/lunghezze fissi ma asimmetrici → sembra caotico, costa zero) */}
          {[[17, 11], [63, 7], [122, 13], [158, 8], [199, 12], [241, 6], [286, 10], [331, 14]].map(([deg, len]) => {
            const r = deg * Math.PI / 180;
            return <line key={deg} x1={E[0] + Math.cos(r) * 3 * pulse} y1={E[1] + Math.sin(r) * 3 * pulse}
              x2={E[0] + Math.cos(r) * len * pulse} y2={E[1] + Math.sin(r) * len * pulse}
              stroke="#fde68a" strokeWidth={1.6} strokeLinecap="round" opacity={pulse} />;
          })}
          {/* Detriti che volano via (puntini oltre le scintille) */}
          {[[40, 17], [140, 19], [255, 16], [310, 20]].map(([deg, dist]) => {
            const r = deg * Math.PI / 180;
            return <circle key={deg} cx={E[0] + Math.cos(r) * dist * pulse} cy={E[1] + Math.sin(r) * dist * pulse - pulse * pulse * 4}
              r={1.3} fill="#fff" opacity={Math.max(0, 1 - pulse * 0.9)} />;
          })}
          <circle cx={E[0]} cy={E[1]} r={4 + pulse * 9} fill="none" stroke={STRIKE} strokeWidth={2.2} opacity={1 - pulse} />
          <circle cx={E[0]} cy={E[1]} r={3 * pulse} fill="#fff" opacity={pulse * 0.9} />
        </g>
      )}
      {E && pulse > 0.18 && isGrip && (
        <g style={{ pointerEvents: 'none' }}>
          {/* anello di leva/controllo — non percussivo, ruota per suggerire torsione/proiezione */}
          <circle cx={E[0]} cy={E[1]} r={7 + pulse * 5} fill="none" stroke={STRIKE} strokeWidth={2.2}
            strokeDasharray="5 4" opacity={0.85} transform={`rotate(${pulse * 140} ${E[0]} ${E[1]})`} />
          <circle cx={E[0]} cy={E[1]} r={2.2} fill={STRIKE} opacity={pulse} />
        </g>
      )}
    </svg>
  );
});

// Durata per tecnica: abbastanza perché la figura sferri e ritragga il colpo, poi avanza.
const COMBO_MOVE_MS = 1550;
function ComboAnimator({ combo, color = '#00f2ff', mode, size = 108 }) {
  const techniques = (combo || '').split('-').map((t) => t.trim()).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // in | out (breve dissolvenza al cambio)
  const scene = sceneFor(mode);

  useEffect(() => { setIdx(0); setPhase('in'); }, [combo]);

  useEffect(() => {
    if (techniques.length <= 1) return;
    const id = setInterval(() => {
      setPhase('out');
      setTimeout(() => { setIdx((i) => (i + 1) % techniques.length); setPhase('in'); }, 180);
    }, COMBO_MOVE_MS);
    return () => clearInterval(id);
  }, [techniques.length, combo]);

  const tech = techniques[idx] || '';
  const poseKey = resolvePose(tech);
  const vis = phase === 'in';
  const multi = techniques.length > 1;

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {/* STEP tracker + barra di avanzamento */}
      {multi && (
        <div className="w-full max-w-[240px] flex flex-col items-center gap-1">
          <p className="text-[10px] font-black tracking-[0.18em] uppercase" style={{ color }}>
            Step {idx + 1}<span style={{ color: '#6b7280' }}> / {techniques.length}</span>
          </p>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((idx + 1) / techniques.length) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
          </div>
        </div>
      )}
      {/* Scena animata (fighter + bersaglio secondo la disciplina) dentro l'ARENA:
          riflettore dall'alto, riflesso a pavimento e particelle di energia (solo transform/opacity → GPU) */}
      <div className="relative flex items-center justify-center" style={{ contain: 'layout paint' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none rounded-2xl" style={{
          background: `radial-gradient(ellipse 75% 52% at 50% 12%, ${color}1f, transparent 62%), radial-gradient(ellipse 62% 30% at 50% 92%, ${color}30, transparent 72%)`,
        }} />
        {!_prefersReducedMotion() && [14, 38, 62, 84].map((x, i) => (
          <motion.span key={i} aria-hidden className="absolute bottom-2 w-1 h-1 rounded-full pointer-events-none"
            style={{ left: `${x}%`, background: color, boxShadow: `0 0 6px ${color}` }}
            animate={{ y: [-2, -56 - i * 8], opacity: [0, 0.7, 0], scale: [1, 0.5] }}
            transition={{ duration: 2.6 + i * 0.5, repeat: Infinity, delay: i * 0.65, ease: 'easeOut' }} />
        ))}
        <div style={{ opacity: vis ? 1 : 0, transform: `scale(${vis ? 1 : 0.94})`, transition: 'opacity 0.18s ease, transform 0.18s ease', filter: `drop-shadow(0 0 14px ${color}66)` }}>
          <StickFigure poseKey={poseKey} color={color} size={size} highlight scene={scene} />
        </div>
      </div>
      {/* Nome tecnica */}
      <p className="text-lg font-black tracking-wide text-center leading-tight"
        style={{ color, opacity: vis ? 1 : 0, transition: 'opacity 0.18s ease', textShadow: `0 0 14px ${color}` }}>
        {tech}
      </p>
      {/* COLPISCI CON — superficie di contatto esatta, precisione chirurgica */}
      {strikeSurfaceFor(poseKey) && (
        <p className="text-[11px] font-semibold text-center leading-snug px-2 max-w-[230px]"
          style={{ opacity: vis ? 0.95 : 0, transition: 'opacity 0.18s ease', color: '#fde68a' }}>
          🎯 <b className="uppercase tracking-wide" style={{ color: '#fbbf24' }}>Colpisci con:</b> {strikeSurfaceFor(poseKey)}
        </p>
      )}
      {/* Stepper numerato con connettori */}
      {multi && (
        <div className="flex items-center justify-center flex-wrap gap-0.5 max-w-[250px]">
          {techniques.map((tk, i) => {
            const done = i < idx, active = i === idx;
            return (
              <span key={i} className="inline-flex items-center gap-0.5">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all duration-200"
                  style={{
                    background: active ? color : done ? `${color}33` : 'transparent',
                    color: active ? '#0b0e14' : done ? color : '#6b7280',
                    border: `1px solid ${active ? color : done ? `${color}66` : '#374151'}`,
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                  }}>
                  <span className="opacity-70">{i + 1}</span>{tk}
                </span>
                {i < techniques.length - 1 && <span className="text-[10px]" style={{ color: done ? color : '#4b5563' }}>›</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Visual Live Coach ────────────────────────────────────────────────────
const ALL_DISCIPLINES = DISCIPLINE_GROUPS.flatMap((g) => g.items);
const isSparring = (id) => id.startsWith('sparring_') || id === 'partner_drills';

// ─── Protocolli di respirazione guidata ────────────────────────────────────────
// Ogni protocollo = fasi temporizzate (label + secondi). sec:0 = fase assente
// (es. niente ritenzione). `rounds` = quante volte ripetere il ciclo di fasi.
// Fonte unica: lib/breathingProtocols.js (import in testa al file).

// Classifica la fase per l'animazione dell'anello: espande su "inspira",
// contrae su "espira", resta ferma per ritenzioni/pause/altro.
const classifyBreathPhase = (label = '') => {
  const l = label.toLowerCase();
  if (l.includes('inspira') || l.includes('respira veloce') || l.includes('carica')) return 'in';
  if (l.includes('espira') || l.includes('sbuffo')) return 'out';
  return 'hold';
};

// ─── Guida visiva alla respirazione: anello che si espande/contrae a schermo
// pieno, seguendo le fasi temporizzate del protocollo selezionato. ─────────────
function BreathingGuide({ protocol, onExit, voiceOn, enqueueSpeak }) {
  const phases = React.useMemo(() => (protocol?.phases || []).filter((p) => (p.sec || 0) > 0), [protocol]);
  const totalRounds = Math.max(1, protocol?.rounds || 1);
  const [state, setState] = useState(() => ({ phaseIdx: 0, round: 1, secLeft: phases[0]?.sec || 1, done: phases.length === 0 }));
  const timerRef = useRef(null);
  const spokenKeyRef = useRef('');

  // reset quando cambia protocollo
  useEffect(() => {
    setState({ phaseIdx: 0, round: 1, secLeft: phases[0]?.sec || 1, done: phases.length === 0 });
    spokenKeyRef.current = '';
  }, [protocol, phases]);

  // countdown 1s — avanza fase/round quando il tempo scade
  useEffect(() => {
    clearInterval(timerRef.current);
    if (state.done || phases.length === 0) return undefined;
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.done) return prev;
        if (prev.secLeft > 1) return { ...prev, secLeft: prev.secLeft - 1 };
        let nextPhaseIdx = prev.phaseIdx + 1;
        let nextRound = prev.round;
        if (nextPhaseIdx >= phases.length) {
          nextPhaseIdx = 0;
          nextRound = prev.round + 1;
        }
        if (nextRound > totalRounds) return { ...prev, done: true };
        return { phaseIdx: nextPhaseIdx, round: nextRound, secLeft: phases[nextPhaseIdx]?.sec || 1, done: false };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state.done, phases, totalRounds]);

  // annuncio vocale del cambio fase (best-effort — richiede voiceOn + enqueueSpeak passati dal chiamante)
  useEffect(() => {
    if (state.done || phases.length === 0) return;
    const key = `${state.round}-${state.phaseIdx}`;
    if (spokenKeyRef.current === key) return;
    spokenKeyRef.current = key;
    // TODO: se in futuro serve una voce dedicata (più breve/diversa dal coach), separare la coda qui.
    if (voiceOn && typeof enqueueSpeak === 'function') {
      enqueueSpeak(phases[state.phaseIdx]?.label || '');
    }
  }, [state.phaseIdx, state.round, state.done, phases, voiceOn, enqueueSpeak]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!protocol) return null;
  const curPhase = phases[state.phaseIdx];
  const phaseKind = classifyBreathPhase(curPhase?.label);
  const phaseSec = curPhase?.sec || 1;
  const progress = Math.min(1, Math.max(0, (phaseSec - state.secLeft + 1) / phaseSec));
  const R_MIN = 46, R_MAX = 92;
  const r = phaseKind === 'in' ? R_MIN + (R_MAX - R_MIN) * progress
    : phaseKind === 'out' ? R_MAX - (R_MAX - R_MIN) * progress
    : R_MAX;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(circle at 50% 40%, rgba(6,20,18,0.97), rgba(4,8,10,0.99))', backdropFilter: 'blur(6px)' }}>
      <button onClick={onExit}
        className="absolute top-5 right-5 px-4 py-2 rounded-xl text-xs font-bold"
        style={{ background: 'rgba(55,65,81,0.5)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)' }}>
        ✕ Esci
      </button>

      <p className="text-[11px] font-black tracking-widest mb-1 text-center" style={{ color: C.emerald.hex, fontFamily: 'Syne, sans-serif' }}>
        {protocol.name?.toUpperCase()}
      </p>
      <p className="text-xs text-center mb-6 max-w-xs" style={{ color: '#6b7280' }}>{protocol.subtitle}</p>

      <svg width={220} height={220} viewBox="0 0 220 220" className="mb-6">
        <circle cx={110} cy={110} r={R_MAX + 8} fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth={1.5} />
        <circle cx={110} cy={110} r={r} fill="rgba(16,185,129,0.14)" stroke={C.emerald.hex} strokeWidth={2.5}
          style={{ transition: 'r 1s linear' }} />
        <text x={110} y={104} textAnchor="middle" fontSize={15} fontWeight={800} fill="#e5f7f0" style={{ fontFamily: 'Syne, sans-serif' }}>
          {(curPhase?.label || 'FINE').toUpperCase()}
        </text>
        <text x={110} y={132} textAnchor="middle" fontSize={30} fontWeight={900} fill={C.emerald.hex}>
          {state.done ? '✓' : state.secLeft}
        </text>
      </svg>

      <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>
        {state.done ? 'Sessione completata' : `Round ${state.round} / ${totalRounds}`}
      </p>
      {!state.done && curPhase && (
        <p className="text-[11px] text-center max-w-xs mb-2" style={{ color: '#4b5563' }}>{protocol.cue}</p>
      )}
      <p className="text-[10px] text-center max-w-xs" style={{ color: '#374151' }}>{protocol.when}</p>

      {state.done && (
        <button onClick={onExit}
          className="mt-6 px-6 py-3 rounded-xl text-white font-black text-sm"
          style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #0d9488)` }}>
          Fatto
        </button>
      )}
    </div>
  );
}


// ─── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'trainer',    label: 'PT',     icon: '🏅', color: C.amber   },
  { id: 'curriculum', label: 'Piano',  icon: '📚', color: C.violet  },
  { id: 'chat',       label: 'Chat',   icon: '💬', color: C.blue    },
  { id: 'visual',     label: 'Live',   icon: '📷', color: C.emerald },
];

export default function Coach({ playerStats, setPlayerStats, aiStatus }) {
  const [tab, setTab] = useState(() => {
    try {
      const requested = localStorage.getItem('shadow_monarch_coach_open_tab');
      if (['visual', 'curriculum', 'chat', 'trainer'].includes(requested)) return requested;
      return localStorage.getItem(PENDING_COACH_QUESTION_KEY) ? 'chat' : 'curriculum';
    } catch { return 'curriculum'; }
  });
  useEffect(() => {
    try { localStorage.removeItem('shadow_monarch_coach_open_tab'); } catch {}
  }, []);

  return (
    <div className="min-h-full text-white pb-8" style={{ background: '#0b0d19' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'rgba(11,13,25,0.94)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Animated top border */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #6de2d3 30%, #b8a4ff 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />

        <div className="relative px-4 pt-3 pb-3 max-w-2xl mx-auto overflow-hidden">
          {/* Ambient orbs */}
          <div className="absolute -top-6 -left-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,242,255,0.06) 0%, transparent 70%)', animation: 'drift-slow 8s ease-in-out infinite' }} />
          <div className="absolute -top-4 right-0 w-24 h-24 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)', animation: 'drift-slow 12s ease-in-out infinite reverse' }} />

          {/* Title row */}
          <div className="flex items-center justify-between mb-3 relative">
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none" style={{ fontFamily: 'Syne, sans-serif', background: 'linear-gradient(135deg, #ffffff 20%, #6de2d3 60%, #b8a4ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ⚡ COACH
              </h1>
              <p className="text-[10px] mt-1 font-mono tracking-widest" style={{ color: '#91a6ab' }}>TECNICA · PRATICA · PROGRESSI</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ fontFamily: 'Barlow Semi Condensed, sans-serif', background: 'rgba(109,226,211,0.08)', color: '#6de2d3', border: '1px solid rgba(109,226,211,0.3)' }}>MMA / DA ZERO</span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map((t) => (
              <motion.button key={t.id} onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.93 }}
                className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all relative overflow-hidden"
                style={tab === t.id
                  ? { background: `linear-gradient(135deg, ${t.color.hex}22, ${t.color.hex}11)`, color: t.color.hex, boxShadow: `0 0 0 1px ${t.color.border}, 0 4px 16px ${t.color.glow}`, border: `1px solid ${t.color.border}` }
                  : { color: '#4b5563', border: '1px solid transparent' }}>
                {tab === t.id && (
                  <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)', animation: 'chip-sheen 2.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                )}
                <span className="block text-base leading-none mb-0.5">{t.icon}</span>
                <span className="block text-[10px] tracking-wide" style={{ fontFamily: 'Syne, sans-serif', fontSize: '9px' }}>{t.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}>
            {tab === 'trainer'    && <PersonalTrainer />}
            {tab === 'curriculum' && <CurriculumCoach onGoLive={() => setTab('visual')} />}
            {tab === 'chat'       && <CoachChat />}
            {tab === 'visual'     && <Suspense fallback={<div className="p-6 text-xs text-cyan-200 uppercase tracking-widest">Carico la camera coach…</div>}><VisualCoach setPlayerStats={setPlayerStats} aiStatus={aiStatus} /></Suspense>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper usati anche dal tab Live (CoachVisual.jsx, caricato in lazy).
export { ALL_DISCIPLINES, BreathingGuide, C, COMBO_MOVE_MS, COOLDOWN_STEPS, CURRICULUM, Coach, ComboAnimator, DISCIPLINE_GROUPS, PRAISE, REACT_DIFFS, RoundConfig, RoundTimerDisplay, RoutineOverlay, ScoreTracker, SkillRadar, StickFigure, WARMUP_STEPS, _prefersReducedMotion, anchorsOf, anglesFromLandmarks, buildBreathingTemplate, buildFitnessTemplate, buildLearnerProfile, buildRunningTemplate, buildStrikeTemplate, buildYogaTemplate, coachLevelOf, coachRankOf, curriculumContext, disciplineRank, drawAnnotatedFrame, isSparring, jointAngle, loadCoachProgress, loadCurrProgress, loadExams, loadSessions, markTopicDate, markTrainDay, masterTitle, matchPose, nextObjective, parsePoint, playGong, pushSkillsHistory, reactionCallsFor, resolveGoal, resolveGoalFromHistory, resolvePose, saveCoachProgress, saveCurrProgress, saveExams, saveFightIq, saveSessions, sceneFor, secretLevelForMode, sessionStats, strikeSurfaceFor, takePendingLive, useRoundTimer };

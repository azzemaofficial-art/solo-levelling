import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Lightbulb, Trophy, ScanSearch, Play, Pause, Target, FlipHorizontal2, Volume2, VolumeX, Bone, X, Move, ThumbsUp, ThumbsDown } from 'lucide-react';

// ─── Quick prompts ─────────────────────────────────────────────────────────────
const COACH_QUICK = [
  { label: '🥩 Ricetta proteica', text: 'Dammi una ricetta ad alto contenuto proteico (almeno 40g di proteine) veloce da preparare, con macro completi.' },
  { label: '💊 Integratori base', text: 'Quali integratori base consiglia la scienza per un atleta naturale? Dosaggi e timing.' },
  { label: '📊 Macro per bulk', text: 'Come calcolo i macronutrienti per una fase di bulk pulita? Peso 75kg, altezza 178cm, alleno 4x settimana.' },
  { label: '🏋️ Scheda push/pull', text: 'Crea una scheda push/pull/legs 6 giorni per ipertrofia, livello intermedio, palestra.' },
  { label: '🥊 Conditioning MMA', text: 'Crea un piano di conditioning per un praticante di arti marziali miste, 3 sessioni/settimana.' },
  { label: '😴 Recupero e sonno', text: 'Come ottimizzare il recupero muscolare e il sonno per massimizzare i guadagni?' },
];

const TRAINER_QUICK = [
  { label: '🔥 Piano calorico', text: 'Calcolami il fabbisogno calorico giornaliero e i macro ideali. Peso 75kg, 178cm, 25 anni, maschio, allenamento 4x/settimana, obiettivo massa muscolare.' },
  { label: '🥗 Piano pasti 7gg', text: 'Crea un piano pasti completo per 7 giorni, ~2800 kcal/giorno, alto contenuto proteico (160g+), con ricette e macro per ogni pasto.' },
  { label: '💪 Scheda arti marziali', text: 'Crea una scheda di allenamento per migliorare forza esplosiva, mobilità e resistenza specifica per le arti marziali (3-4x settimana).' },
  { label: '🥊 Migliori esercizi', text: 'Quali sono i 10 esercizi più efficaci per un praticante di arti marziali che vuole migliorare potenza, velocità e resistenza?' },
  { label: '💊 Stack integratori', text: 'Costruisci uno stack di integratori evidence-based per un atleta di arti marziali: cosa prendere, quando, quanto.' },
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
  emerald: { hex: '#10b981', glow: 'rgba(16,185,129,0.4)', bg: 'rgba(6,78,59,0.15)',  border: 'rgba(16,185,129,0.25)' },
  blue:    { hex: '#3b82f6', glow: 'rgba(59,130,246,0.4)', bg: 'rgba(30,58,138,0.15)', border: 'rgba(59,130,246,0.25)' },
  orange:  { hex: '#f97316', glow: 'rgba(249,115,22,0.4)', bg: 'rgba(124,45,18,0.15)', border: 'rgba(249,115,22,0.25)' },
  rose:    { hex: '#f43f5e', glow: 'rgba(244,63,94,0.4)',  bg: 'rgba(136,19,55,0.15)', border: 'rgba(244,63,94,0.25)'  },
  amber:   { hex: '#f59e0b', glow: 'rgba(245,158,11,0.4)', bg: 'rgba(120,53,15,0.15)', border: 'rgba(245,158,11,0.25)' },
  red:     { hex: '#ef4444', glow: 'rgba(239,68,68,0.5)',  bg: 'rgba(127,29,29,0.2)',  border: 'rgba(239,68,68,0.3)'  },
  violet:  { hex: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', bg: 'rgba(76,29,149,0.15)', border: 'rgba(139,92,246,0.25)' },
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
function CoachChat() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/coach');
  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <>
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))', border: `1px solid ${C.blue.border}` }}>
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6 40%, #6366f1 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
            <div className="relative px-4 py-3.5 overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
              <p className="text-xs font-black tracking-widest" style={{ color: C.blue.hex, fontFamily: 'Orbitron, sans-serif' }}>💬 AI COACH CHAT</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Nutrizione · Allenamento · Recovery · Supplementi</p>
            </div>
          </div>
          <QuickGrid prompts={COACH_QUICK} onSend={send} accentColor="blue" />
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
  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
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
              <p className="text-xs font-black tracking-widest" style={{ color: C.amber.hex, fontFamily: 'Orbitron, sans-serif' }}>⚡ SHADOW COACH</p>
              <p className="text-sm font-bold text-white mt-0.5">Kimi K2.6 — Personal Trainer AI</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Calorie · Macro · Schede · Arti Marziali</p>
            </div>
          </div>
          <QuickGrid prompts={TRAINER_QUICK} onSend={send} accentColor="amber" />
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

// ─── Tab: Curriculum ──────────────────────────────────────────────────────────
function CurriculumCoach() {
  const [disc, setDisc] = useState('muaythai');
  const [expandedLevel, setExpandedLevel] = useState(0);
  const [progress, setProgress] = useState(() => loadCurrProgress());
  const [loadingTopic, setLoadingTopic] = useState(null);
  const [topicLesson, setTopicLesson] = useState(null);

  const curriculum = CURRICULUM[disc];
  const discProgress = progress[disc] || {};
  const getCompleted = (li) => new Set(discProgress[`l${li}`] || []);
  const totalDone = curriculum.levels.reduce((s, _, li) => s + getCompleted(li).size, 0);
  const totalTopics = curriculum.levels.reduce((s, l) => s + l.topics.length, 0);

  const toggleTopic = (li, ti) => {
    setProgress((prev) => {
      const dp = prev[disc] || {};
      const set = new Set(dp[`l${li}`] || []);
      if (set.has(ti)) set.delete(ti); else set.add(ti);
      const next = { ...prev, [disc]: { ...dp, [`l${li}`]: [...set] } };
      saveCurrProgress(next);
      return next;
    });
  };

  const learnTopic = async (topic, levelLabel) => {
    setLoadingTopic(topic);
    setTopicLesson(null);
    try {
      const prompt = `Insegnami: "${topic}" — ${curriculum.name}, livello ${levelLabel}.\n1) Cos'è e perché è fondamentale\n2) Come si esegue step-by-step\n3) Errori più comuni\n4) Drill pratico per impararlo\nRispondi in italiano, max 12 righe, tono da coach pratico.`;
      const res = await fetch('/api/nvidia/trainer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (res.ok) setTopicLesson({ topic, content: data.content, provider: data.provider });
    } catch {}
    finally { setLoadingTopic(null); }
  };

  const SOLO_DISCS = [...DISCIPLINE_GROUPS[0].items, ...DISCIPLINE_GROUPS[1].items].filter((d) => CURRICULUM[d.id]);
  const overallPct = totalTopics > 0 ? totalDone / totalTopics : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(79,70,229,0.06))', border: `1px solid ${C.violet.border}` }}>
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6 40%, #4f46e5 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
        <div className="relative p-4 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', animation: 'drift-slow 10s ease-in-out infinite' }} />
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black tracking-widest" style={{ color: C.violet.hex, fontFamily: 'Orbitron, sans-serif' }}>📚 CURRICULUM</p>
              <p className="text-lg font-black text-white mt-0.5">{curriculum.name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{totalDone}/{totalTopics} argomenti completati</p>
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
                          <p className="text-[10px] font-black tracking-widest mb-0.5" style={{ color: isDone ? col.hex : '#374151', fontFamily: 'Orbitron, sans-serif' }}>MILESTONE</p>
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
  // grappling / atterramenti / proiezioni
  if (tl.includes('throw') || tl.includes('proiez') || tl.includes('proiett') || tl.includes('seoi') || tl.includes('nage') || tl.includes('toss') || tl.includes('sweep') || tl.includes('goshi') || tl.includes('sgamb')) return 'throw';
  if (tl.includes('shoot') || tl.includes('double leg') || tl.includes('single leg') || tl.includes('takedown') || tl.includes('doppia gamba') || tl.includes('penetr')) return 'shoot';
  if (tl.includes('level') || tl.includes('burst')) return 'level_change';
  if (tl.includes('guard') || tl.includes('mount') || tl.includes('armbar') || tl.includes('choke') || tl.includes('strangol') || tl.includes('leva') || tl.includes('kimura') || tl.includes('triangle') || tl.includes('submission') || tl.includes('back take')) return 'clinch';
  if (tl.includes('sprawl')) return 'sprawl';
  if (tl.includes('clinch') || tl.includes('collar') || tl.includes('kumi')) return 'clinch';
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

// ── SPECCHIO: confronta gli angoli REALI (MediaPipe) con quelli ideali della tecnica ──
// Deterministico e istantaneo: nessuna AI. Giunti ok/off + correzioni concrete.
const POSE_FAMILY = {
  jab: 'straight', cross: 'straight',
  hook: 'hook', uppercut: 'uppercut', elbow: 'hook',
  guard: 'guard', stance: 'guard', ready: 'guard', clinch: 'guard',
  squat: 'squat', lunge: 'lunge',
  teep: 'kick', roundhouse: 'kick', low_kick: 'kick', body_kick: 'kick', side_kick: 'kick', spinning: 'kick',
  knee: 'knee',
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
    mark('eL', _rng(a.eL, 55, 118), 'mani su: gomiti piegati a guardia'); mark('eR', _rng(a.eR, 55, 118), null);
    kneesSoft(); torsoUp();
  } else if (fam === 'squat') {
    mark('kL', _rng(a.kL, 60, 120), 'scendi di più, cosce verso il parallelo'); mark('kR', _rng(a.kR, 60, 120), null);
    if (a.hL != null || a.hR != null) mark(a.hL <= a.hR ? 'hL' : 'hR', _rng(Math.min(a.hL ?? 999, a.hR ?? 999), 50, 130), 'fianchi indietro e giù');
    torsoUp(45);
  } else if (fam === 'lunge') {
    const kf = a.kL <= a.kR ? 'kL' : 'kR';
    mark(kf, _rng(a[kf], 70, 120), 'ginocchio anteriore a circa 90°'); torsoUp(30);
  } else if (fam === 'kick') {
    const kk = (a.kL ?? -1) >= (a.kR ?? -1) ? 'kL' : 'kR';
    mark(kk, (a[kk] ?? 0) >= 150, 'estendi la gamba che calcia');
    if (a.lean != null) { J.lean = a.lean <= 48 ? 'ok' : 'off'; if (a.lean > 48) hints.push('resta in equilibrio, non sbilanciarti troppo'); }
    mark(gKey, eMin <= 125, 'tieni le mani su mentre calci');
  } else if (fam === 'knee') {
    const hk = (a.hL ?? 999) <= (a.hR ?? 999) ? 'hL' : 'hR';
    mark(hk, (a[hk] ?? 999) <= 105, 'alza di più il ginocchio verso il bersaglio'); torsoUp(40);
  } else { // posture — utile per qualsiasi movimento/asana
    kneesSoft(); torsoUp(35);
  }

  const vals = Object.values(J).filter((s) => s !== 'na');
  const score = vals.length ? Math.round((vals.filter((s) => s === 'ok').length / vals.length) * 100) : 0;
  return { score, joint: J, hints: hints.slice(0, 2) };
}

// Quale estremità colpisce, per pose → indice giunto (5 = mano SX, 8 = mano DX, 11 = piede SX)
const STRIKE_ENDPOINT = {
  jab: 5, hook: 5, elbow: 5,
  cross: 8, uppercut: 8,
  low_kick: 11, body_kick: 11, roundhouse: 11, teep: 11, side_kick: 11, spinning: 11, knee: 11, level_change: 11,
};
// giunti dell'arto che colpisce (per evidenziarlo tutto)
const STRIKE_LIMB = { 5: [3, 4, 5], 8: [6, 7, 8], 11: [9, 10, 11] };

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
  clinch: { e: 5, l: [3,4,5] }, level_change: { e: 8, l: [6,7,8] },
};

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
// grapple/atterramenti che raggiungono l'avversario
const GRAPPLE_STRIKE = { throw: { e: 5, l: [3,4,5] }, shoot: { e: 8, l: [6,7,8] } };
// Avversario che subisce (guardia rivolta all'attaccante, lato destro)
const OPPONENT_POSE = [[86,20],[85,36],[84,86],[84,40],[82,54],[80,44],[88,40],[90,54],[92,44],[82,88],[82,120],[82,152],[88,88],[89,120],[92,152]];
// Scena per disciplina: 'bag' (colpi) | 'opponent' (partner/grappling) | 'solo' (movimento)
const DISCIPLINE_SCENE = {
  muaythai:'bag', boxing:'bag', kickboxing:'bag', muayboran:'bag', kravmaga:'bag', sanda:'bag',
  karate:'opponent', taekwondo:'opponent', mma:'opponent', judo:'opponent', wrestling:'opponent',
  bjj:'opponent', sambo:'opponent', lutalivre:'opponent', capoeira:'opponent', hapkido:'opponent',
  wingchun:'opponent', kungfu:'opponent', silat:'opponent', kendo:'opponent', pankration:'opponent',
  systema:'opponent', kalaripayattu:'opponent',
  yoga:'solo', stretching:'solo', calisthenics:'solo', crossfit:'solo', running:'solo',
  breathing:'solo', fitness:'solo', general:'solo',
};
const sceneFor = (mode) => DISCIPLINE_SCENE[mode] || (/sparring|partner|drill/.test(mode || '') ? 'opponent' : 'bag');
// timeline "ripetizione" (fitness/flow): scendi → tieni → risali → pausa
const _repT = (ms) => { const P = 1700, t = ms % P; if (t < 620) return _easeOut(t / 620); if (t < 900) return 1; if (t < 1500) return 1 - _easeIn((t - 900) / 600); return 0; };

// ── SCENA UNIVERSALE: attaccante + (sacco | avversario | nessuno) ─────────────
// Ogni disciplina ha la scena giusta. Colpo→bersaglio con impatto; fitness→ripetizioni;
// yoga/respiro→posa. Torso pieno, arti spessi, trail di movimento, griglia prospettica.
function StickFigure({ poseKey, color = '#00f2ff', size = 130, highlight = false, animate = true, scene = 'bag' }) {
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
  useEffect(() => {
    if (!throwing) { setT(1); return; }
    const tl = BAG_STRIKE[key] || GRAPPLE_STRIKE[key] ? _throwT : _repT;
    let start = 0;
    const loop = (now) => {
      if (!start) start = now;
      const v = tl(now - start);
      if (Math.abs(v - lastRef.current) > 0.012) { lastRef.current = v; setT(v); }
      rafRef.current = requestAnimationFrame(loop);
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

  const E = strike ? target[strike.e] : null;          // punto d'impatto
  const bagRot = -pulse * 4, bagDx = pulse * 3.5;
  const oppRot = pulse * 7;                              // avversario che arretra
  const zoom = 1 + pulse * 0.03;                         // micro-zoom all'impatto

  // ghost dell'arto che colpisce a t precedenti → scia di velocità
  const trail = (throwing && strike && t > 0.18)
    ? [0.14, 0.28].map((d) => strike.l.map((j) => _lerpPose(base, target, Math.max(0, t - d))[j]))
    : [];

  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 112 168" style={{ overflow: 'visible' }}>
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
        <circle cx={p[0][0]} cy={p[0][1]} r={9} fill={color} opacity={0.28} stroke={color} strokeWidth={1.6} />
        <circle cx={p[0][0] + 4} cy={p[0][1] - 1} r={1.7} fill="#0b0e14" opacity={0.75} />
      </g>

      {/* Anello del respiro (breathing) */}
      {isBreath && (
        <circle cx={p[2][0]} cy={(p[1][1] + p[2][1]) / 2} r={14 + t * 10} fill="none" stroke={color}
          strokeWidth={1.6} opacity={0.4 - t * 0.15} />
      )}

      {/* IMPATTO sul bersaglio */}
      {E && pulse > 0.18 && (
        <g style={{ pointerEvents: 'none' }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = deg * Math.PI / 180;
            return <line key={deg} x1={E[0]} y1={E[1]}
              x2={E[0] + Math.cos(r) * 9 * pulse} y2={E[1] + Math.sin(r) * 9 * pulse}
              stroke="#fde68a" strokeWidth={1.6} strokeLinecap="round" opacity={pulse} />;
          })}
          <circle cx={E[0]} cy={E[1]} r={4 + pulse * 7} fill="none" stroke={STRIKE} strokeWidth={2} opacity={1 - pulse} />
          <circle cx={E[0]} cy={E[1]} r={3 * pulse} fill="#fff" opacity={pulse * 0.9} />
        </g>
      )}
    </svg>
  );
}

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
      {/* Scena animata (fighter + bersaglio secondo la disciplina) */}
      <div style={{ opacity: vis ? 1 : 0, transform: `scale(${vis ? 1 : 0.94})`, transition: 'opacity 0.18s ease, transform 0.18s ease', filter: `drop-shadow(0 0 14px ${color}66)` }}>
        <StickFigure poseKey={poseKey} color={color} size={size} highlight scene={scene} />
      </div>
      {/* Nome tecnica */}
      <p className="text-lg font-black tracking-wide text-center leading-tight"
        style={{ color, opacity: vis ? 1 : 0, transition: 'opacity 0.18s ease', textShadow: `0 0 14px ${color}` }}>
        {tech}
      </p>
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

function VisualCoach() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('setup');
  const [sessionContext, setSessionContext] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [mode, setMode] = useState('muaythai');
  const [pastSessions, setPastSessions] = useState(() => loadSessions());
  const [rounds, setRounds] = useState(3);
  const [roundDuration, setRoundDuration] = useState(180);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [lastPoint, setLastPoint] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSlow, setVoiceSlow] = useState(true);   // voce lenta e scandita (default: più facile da seguire)
  const [skeletonOn, setSkeletonOn] = useState(true);
  const [centered, setCentered] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);
  const voicesRef = useRef([]);
  const sessionStartRef = useRef(null);
  const analyzingRef = useRef(false);
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const poseRef = useRef(null);
  const feedbackHistoryRef = useRef([]);
  const sessionFeedbacksRef = useRef([]);
  const speakQueueRef = useRef([]);   // coda comandi da mostrare/leggere uno alla volta
  const presentingRef = useRef(false); // true mentre un comando è a schermo + in lettura
  const lastLandmarksRef = useRef(null); // ultimi landmark MediaPipe → angoli reali per l'AI
  // ── SPECCHIO (corpo vs ideale) — feedback deterministico dallo scheletro ──
  const [mirrorOn, setMirrorOn] = useState(false);
  const [mirrorTech, setMirrorTech] = useState('guard');   // tecnica da rispecchiare (manuale)
  const [mirrorState, setMirrorState] = useState(null);    // {score, joint, hints}
  const [mirrorTargetKey, setMirrorTargetKey] = useState('guard');
  const mirrorOnRef = useRef(false);
  const mirrorTargetRef = useRef('guard');
  const mirrorMatchRef = useRef(null);
  const mirrorStateAtRef = useRef(0);
  const mirrorSpeakRef = useRef({ t: 0, msg: '' });
  const observationsRef = useRef([]);  // osservazioni accumulate in auto (osserva N → 1 verdetto)
  const [observeProgress, setObserveProgress] = useState(0);
  // ── Cattura dati per l'alveare: ogni verdetto = 1 campione (angoli + esito + 👍/👎) ──
  const pendingSampleRef = useRef(null); // ultimo verdetto in attesa di etichetta/invio
  const [sampleFeedback, setSampleFeedback] = useState(null); // null | 'shown' | 'up' | 'down'
  const [sampleCount, setSampleCount] = useState(0);          // campioni inviati in sessione
  const [framingHint, setFramingHint] = useState('');     // avviso "inquadra il corpo"
  const [trackQuality, setTrackQuality] = useState('none'); // full | upper | partial | none
  const [repCount, setRepCount] = useState(0);            // conta-ripetizioni (guidato)
  const repCountRef = useRef(0);
  const repPhaseRef = useRef('up');
  const guidedRunningRef = useRef(false);
  const VERDICT_EVERY = 3;             // il maestro osserva 3 momenti, poi dà UN verdetto
  // ── Modalità GUIDATA (circuito drill su misura) ─────────────────────────────
  const [guidedOn, setGuidedOn] = useState(false);
  const [guidedPlan, setGuidedPlan] = useState([]);        // [{name,durationSec,focus,watchFor}]
  const [guidedIdx, setGuidedIdx] = useState(0);
  const [guidedPhase, setGuidedPhase] = useState('idle');  // idle|gen|ready|running|review|done
  const [guidedTimeLeft, setGuidedTimeLeft] = useState(0);
  const [guidedReview, setGuidedReview] = useState(null);  // {good[],fix[],score,cue}
  const [guidedAutoAdvance, setGuidedAutoAdvance] = useState(false);
  const [guidedLoading, setGuidedLoading] = useState(false);
  const [guidedLevel, setGuidedLevel] = useState('intermedio');
  const guidedTimerRef = useRef(null);   // countdown 1s
  const guidedTickRef = useRef(null);    // osservazione durante il drill
  const guidedObsRef = useRef([]);       // osservazioni del drill corrente
  const [sessionAnalysis, setSessionAnalysis] = useState(null);
  const [analyzingSession, setAnalyzingSession] = useState(false);
  // ── Pagella di fine sessione (voto + progressione salvata su Obsidian) ──
  const sessionVerdictsRef = useRef([]);   // comandi chiave raccolti nella sessione
  const [sessionReport, setSessionReport] = useState(null); // {report:{...}} | {loading:true}

  // ── Modalità COMBO A COMANDO ─────────────────────────────────────────────────
  const [comboOn, setComboOn] = useState(false);
  const [comboPhase, setComboPhase] = useState('idle'); // idle|calling|go|judging|result
  const [currentCombo, setCurrentCombo] = useState('');
  const [comboCountdown, setComboCountdown] = useState(3);
  const [comboResult, setComboResult] = useState(null); // {grade, feedback, nextCombo}
  const [comboScore, setComboScore] = useState({ perfect: 0, good: 0, redo: 0 });
  const comboPhaseRef = useRef('idle');
  const comboTimerRef = useRef(null);

  const COMBO_LIBRARY = {
    boxing:     ['Jab-Cross', '1-2-3', 'Jab-Jab-Cross', '1-2-Gancio Corpo', 'Jab-Cross-Uppercut', '1-2-3-2', 'Jab-Cross-Corpo-Gancio', 'Double Jab-Cross-Uppercut-Gancio'],
    muaythai:   ['Jab-Cross', 'Jab-Cross-Low Kick', 'Teep-Cross-Hook', 'Cross-Hook-Body Kick', 'Jab-Jab-Cross-Low Kick', 'Double Jab-Cross-Hook', 'Teep-Jab-Cross-Hook', 'Low Kick-Jab-Cross-Ginocchio'],
    kickboxing: ['Jab-Cross-Roundhouse', 'Front Kick-Cross-Hook', 'Jab-Cross-Side Kick', 'Jab-Roundhouse-Cross', 'Cross-Hook-Body Kick', 'Jab-Cross-Spinning Back Kick'],
    mma:        ['Jab-Cross-Level Change', 'Teep-Cross-Takedown', 'Jab-Cross-Body-Clinch', 'Combo-Sprawl', 'Jab-Cross-Hook-Doppia Gamba', 'Low Kick-Cross-Double Leg'],
    karate:     ['Jab-Cross-Mawashi Geri', 'Kizami-Oi Zuki-Mae Geri', 'Gyaku Zuki-Mawashi Geri', 'Sanbon Zuki', 'Mae Geri-Mawashi Geri', 'Kizami-Gyaku-Yoko Geri'],
    taekwondo:  ['Dollyo-Ap-Dollyo', 'Yeop Chagi-Dollyo', 'Double Dollyo', 'Spinning Hook-Dollyo', 'Jump Dollyo-Dollyo', 'Dwi Chagi-Dollyo Chagi'],
    muayboran:  ['Jab-Cross-Tee Kha', 'Teep-Salab Fan Pla', 'Sok Ti-Sok Tad', 'Kao Tone-Kao Dode', 'Chok-Teep-Sok Ngad'],
    kravmaga:   ['Burst-Strike-Move', 'Palm Strike-Knee-Push', 'Eye Gouge-Groin-Disengage', 'Forearm Block-Counter-Disengage', '360 Defense-Counter-Escape'],
    default:    ['Jab-Cross', 'Jab-Cross-Hook', 'Hook-Cross-Hook', 'Cross-Hook-Cross', 'Jab-Jab-Cross-Hook', 'Combo veloce 4 colpi'],
  };

  const pickCombo = useCallback((exclude = '') => {
    const list = COMBO_LIBRARY[mode] || COMBO_LIBRARY.default;
    const filtered = list.filter((c) => c !== exclude);
    return filtered[Math.floor(Math.random() * filtered.length)] || list[0];
  }, [mode]);

  const stopCombo = useCallback(() => {
    clearTimeout(comboTimerRef.current);
    setComboOn(false);
    setComboPhase('idle');
    comboPhaseRef.current = 'idle';
    setCurrentCombo('');
    setComboResult(null);
  }, []);

  const runComboJudge = useCallback(async (combo) => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comboJudge: true, imageBase64, mimeType: 'image/jpeg', mode, targetCombo: combo }),
      });
      const data = await res.json();
      return data;
    } catch { return null; }
  }, [mode]);

  const currentComboRef = useRef('');
  const nextComboRoundRef = useRef(null);

  // ── Coda VOCALE (solo audio) — disaccoppiata dal display ────────────────────
  // Il testo a schermo si aggiorna SUBITO e RESTA (gestito in captureAndAnalyze);
  // qui gestiamo solo la voce, che legge un comando per intero prima del successivo.
  const speakNextRef = useRef(() => {});
  const speakNext = useCallback(() => {
    if (presentingRef.current) return;            // sta già leggendo → aspetta la fine
    if (!voiceOn || !window.speechSynthesis) { speakQueueRef.current = []; return; }
    const text = speakQueueRef.current.shift();
    if (text == null) return;

    const clean = String(text)
      .replace(/\*\*/g, '').replace(/[*#_~`]/g, '')
      .replace(/RIGA\s*\d+\s*[—-]/g, '')
      .replace(/\bBENE\s*:/gi, 'Bene,').replace(/\bPROVA\s*:/gi, 'Prova')
      .replace(/(COMANDO|VISTO|PERCHÉ|SITUAZIONE|ISTRUZIONE|PUNTO)\s*:/gi, '')
      .replace(/[^\x00-\x7F]/g, (c) => /\p{Emoji}/u.test(c) ? '' : c)
      .replace(/\n+/g, '. ')
      .trim();
    if (!clean) { speakNextRef.current(); return; }

    presentingRef.current = true;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      presentingRef.current = false;
      setTimeout(() => speakNextRef.current(), 150);
    };
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'it-IT'; utt.rate = voiceSlow ? 0.82 : 1.05; utt.pitch = 1;
    const itVoice = voicesRef.current.find((v) => v.lang === 'it-IT' || v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    utt.onend = advance;
    utt.onerror = advance;
    window.speechSynthesis.speak(utt);
    // Watchdog iOS Safari: se onend non scatta, avanza comunque dopo durata stimata
    setTimeout(advance, Math.min(18000, Math.max(3800, clean.length * (voiceSlow ? 125 : 95))));
  }, [voiceOn, voiceSlow]);
  speakNextRef.current = speakNext;

  // Accoda solo il TESTO per la voce. Cap a 2: evita backlog stantio in auto mode.
  const enqueueSpeak = useCallback((text) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([28, 16, 28]); // feedback aptico nuovo comando
    speakQueueRef.current.push(text);
    if (speakQueueRef.current.length > 2) speakQueueRef.current = speakQueueRef.current.slice(-2);
    speakNext();
  }, [speakNext]);

  const nextComboRound = useCallback((suggestedCombo) => {
    if (!comboPhaseRef.current || comboPhaseRef.current === 'idle') return;
    const combo = suggestedCombo || pickCombo(currentComboRef.current);
    currentComboRef.current = combo;
    setCurrentCombo(combo);
    setComboResult(null);
    setComboPhase('calling');
    comboPhaseRef.current = 'calling';
    const nTech = Math.max(1, combo.split('-').filter(Boolean).length);
    setComboCountdown(null);                 // fase DEMO: mostra la combo intera, nessun numero
    enqueueSpeak(`Guarda: ${combo}`, true);
    // 1) DEMO: lascia scorrere l'intera combo almeno una volta sulla figura animata
    const demoMs = Math.max(3400, nTech * COMBO_MOVE_MS + 500);
    // avvia il GO + giudizio quando finisce il conto alla rovescia
    const go = () => {
      setComboPhase('go');
      comboPhaseRef.current = 'go';
      enqueueSpeak('Via!', true);
      const execMs = Math.max(2400, nTech * 950);   // tempo d'esecuzione proporzionale ai colpi
      comboTimerRef.current = setTimeout(async () => {
        if (comboPhaseRef.current !== 'go') return;
        setComboPhase('judging');
        comboPhaseRef.current = 'judging';
        const result = await runComboJudge(combo);
        if (comboPhaseRef.current !== 'judging') return;
        const grade = result?.grade || 'good';
        setComboResult({ grade, feedback: result?.feedback || '', nextCombo: result?.nextCombo || '' });
        setComboScore((prev) => ({ ...prev, [grade]: (prev[grade] || 0) + 1 }));
        setComboPhase('result');
        comboPhaseRef.current = 'result';
        const ttsMsg = grade === 'perfect' ? `Perfetto! ${result?.feedback || ''}` : grade === 'good' ? `Buono. ${result?.feedback || ''}` : `Riprova. ${result?.feedback || ''}`;
        enqueueSpeak(ttsMsg, true);
        comboTimerRef.current = setTimeout(() => {
          if (comboPhaseRef.current !== 'result') return;
          nextComboRoundRef.current?.(result?.nextCombo || '');
        }, 3200);
      }, execMs);
    };
    // 2) dopo la demo → conto alla rovescia 3-2-1 → VIA
    comboTimerRef.current = setTimeout(() => {
      if (comboPhaseRef.current !== 'calling') return;
      enqueueSpeak(`Esegui tra tre`, true);
      let c = 3;
      const tick = () => {
        if (comboPhaseRef.current !== 'calling') return;
        if (c === 0) { go(); return; }
        setComboCountdown(c);
        c--;
        comboTimerRef.current = setTimeout(tick, 650);
      };
      tick();
    }, demoMs);
  }, [pickCombo, enqueueSpeak, runComboJudge]);

  nextComboRoundRef.current = nextComboRound;

  const startCombo = useCallback(() => {
    setComboScore({ perfect: 0, good: 0, redo: 0 });
    setComboOn(true);
    comboPhaseRef.current = 'calling';
    nextComboRound('');
  }, [nextComboRound]);

  // Precarica le voci appena disponibili (getVoices è asincrono su Chrome/Safari)
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // ── Sblocco TTS — DEVE girare dentro un gesto utente ────────────────────────
  // iOS Safari e Chrome bloccano speechSynthesis fuori da un'interazione: in auto
  // mode la voce parte da un timer, quindi senza questo "priming" non si sente nulla.
  const speechUnlockedRef = useRef(false);
  const unlockSpeech = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.lang = 'it-IT';
      synth.speak(u);
      synth.resume();
      speechUnlockedRef.current = true;
      const v = synth.getVoices();
      if (v && v.length) voicesRef.current = v;       // Safari popola le voci dopo il gesto
    } catch (_) {}
  }, []);

  // Keepalive: Chrome mette in pausa la sintesi dopo ~15s — la riattiviamo.
  useEffect(() => {
    if (!voiceOn) return;
    const id = setInterval(() => {
      const s = window.speechSynthesis;
      if (s && s.paused) s.resume();
    }, 5000);
    return () => clearInterval(id);
  }, [voiceOn]);

  const timer = useRoundTimer({ rounds, roundDuration, restDuration: 60 });
  const currentDisc = ALL_DISCIPLINES.find((d) => d.id === mode) || ALL_DISCIPLINES[0];
  const isPartnerMode = isSparring(mode);

  const handleScore = useCallback((who, delta) => {
    setScore((s) => ({ ...s, [who]: Math.max(0, s[who] + delta) }));
  }, []);

  const startCamera = async (facing = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStreaming(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setStreaming(true);
      } catch (err) { alert('Camera non accessibile: ' + err.message); }
    }
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    poseRef.current?.lm?.close();
    poseRef.current = null;
    setStreaming(false);
    await startCamera(next);
  };

  const startSession = async () => {
    sessionStartRef.current = Date.now();
    sessionVerdictsRef.current = [];      // nuova sessione → azzera i verdetti accumulati
    unlockSpeech();                       // gesto utente: sblocca la voce per l'auto mode
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('live'); setAnalysis(null);
    await startCamera();
  };

  // Fine sessione → il Maestro genera la pagella, la salva su KV (→ Obsidian) e la mostra.
  const requestSessionReport = useCallback(async ({ durationMin, verdicts, sampleCount: sc, context, discipline }) => {
    setSessionReport({ loading: true });
    try {
      const r = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionReport: true, mode: discipline, durationMin, sampleCount: sc,
          verdicts, context, level: guidedLevel,
        }),
      });
      const data = await r.json();
      if (r.ok && data.report) {
        setSessionReport({ report: data.report, discipline });
        // arricchisci lo storico locale con voto + focus (usato anche per la progressione dei drill)
        try {
          const rep = data.report;
          const enriched = [{
            date: new Date().toLocaleDateString('it-IT'), mode: discipline, context,
            keyFeedback: rep.title, duration: durationMin,
            score: rep.score, weaknesses: rep.weaknesses, focusNext: rep.focusNext,
          }, ...loadSessions()].slice(0, 10);
          saveSessions(enriched); setPastSessions(enriched);
        } catch (_) {}
      } else {
        setSessionReport(null);
      }
    } catch (_) {
      setSessionReport(null);
    }
  }, [guidedLevel]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    poseRef.current?.lm?.close();
    poseRef.current = null;
    timer.stop();
    const duration = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
    const verdicts = sessionVerdictsRef.current.slice();
    if (verdicts.length >= 2) {
      // Sessione con abbastanza dati → il Maestro genera la pagella (salva su Obsidian via KV)
      requestSessionReport({ durationMin: duration, verdicts, sampleCount, context: sessionContext, discipline: mode });
    } else if (analysis?.content) {
      // troppo poco per una pagella → salva solo il feedback chiave (comportamento precedente)
      const updated = [{ date: new Date().toLocaleDateString('it-IT'), mode, context: sessionContext, keyFeedback: analysis.content.slice(0, 200), duration }, ...pastSessions].slice(0, 10);
      saveSessions(updated); setPastSessions(updated);
    }
    sessionVerdictsRef.current = [];
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('setup');
    sessionFeedbacksRef.current = [];
    speakQueueRef.current = [];
    presentingRef.current = false;
    window.speechSynthesis?.cancel();
    setSessionAnalysis(null);
    clearInterval(autoTimerRef.current);
    clearInterval(guidedTimerRef.current); clearInterval(guidedTickRef.current);
    setGuidedOn(false); setGuidedPhase('idle'); setGuidedReview(null); setGuidedPlan([]); setGuidedIdx(0);
  };

  // ── Skeleton MediaPipe ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!streaming || !skeletonOn) {
      cancelAnimationFrame(rafRef.current);
      if (overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d');
        ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
      setCentered(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
        );
        if (!active) return;
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (!active) return;
        poseRef.current = { lm, DrawingUtils, PoseLandmarker };
        const loop = () => {
          if (!active) return;
          const video = videoRef.current;
          const canvas = overlayRef.current;
          if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
          // Align canvas to the actual displayed video area (object-contain letterbox)
          const vW = video.videoWidth || 640, vH = video.videoHeight || 480;
          const container = canvas.parentElement;
          if (container && vW > 0 && vH > 0) {
            const cW = container.clientWidth, cH = container.clientHeight;
            // object-cover: scala per RIEMPIRE, ritaglia l'eccesso (offset negativi)
            const scale = Math.max(cW / vW, cH / vH);
            const dW = Math.round(vW * scale), dH = Math.round(vH * scale);
            const dX = Math.round((cW - dW) / 2), dY = Math.round((cH - dH) / 2);
            canvas.width = dW; canvas.height = dH;
            canvas.style.left = dX + 'px'; canvas.style.top = dY + 'px';
            canvas.style.width = dW + 'px'; canvas.style.height = dH + 'px';
          } else {
            canvas.width = vW; canvas.height = vH;
          }
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const result = lm.detectForVideo(video, performance.now());
          if (result.landmarks.length > 0) {
            const du = new DrawingUtils(ctx);
            du.drawConnectors(result.landmarks[0], PoseLandmarker.POSE_CONNECTIONS,
              { color: 'rgba(0,255,136,0.8)', lineWidth: 2 });
            du.drawLandmarks(result.landmarks[0],
              { color: '#FF6B35', lineWidth: 1, radius: 4 });
            lastLandmarksRef.current = result.landmarks[0];   // per la precisione AI (angoli reali)
            // ── SPECCHIO: colora i giunti verde/rosso confrontando con la tecnica target ──
            if (mirrorOnRef.current) {
              const Lm = result.landmarks[0];
              const m = matchPose(anglesFromLandmarks(Lm), mirrorTargetRef.current || 'guard');
              mirrorMatchRef.current = m;
              if (m) {
                const JI = { eL: 13, eR: 14, kL: 25, kR: 26, hL: 23, hR: 24 };
                for (const jn in JI) {
                  const st = m.joint[jn]; if (!st || st === 'na') continue;
                  const P = Lm[JI[jn]]; if (!P) continue;
                  ctx.beginPath();
                  ctx.arc(P.x * canvas.width, P.y * canvas.height, 9, 0, Math.PI * 2);
                  ctx.fillStyle = st === 'ok' ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.9)';
                  ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
                }
                if (m.joint.lean && m.joint.lean !== 'na' && Lm[11] && Lm[12] && Lm[23] && Lm[24]) {
                  const sX = ((Lm[11].x + Lm[12].x) / 2) * canvas.width, sY = ((Lm[11].y + Lm[12].y) / 2) * canvas.height;
                  const hX = ((Lm[23].x + Lm[24].x) / 2) * canvas.width, hY = ((Lm[23].y + Lm[24].y) / 2) * canvas.height;
                  ctx.beginPath(); ctx.moveTo(sX, sY); ctx.lineTo(hX, hY);
                  ctx.strokeStyle = m.joint.lean === 'ok' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)'; ctx.lineWidth = 5; ctx.stroke();
                }
                const now = performance.now();
                if (now - mirrorStateAtRef.current > 180) { mirrorStateAtRef.current = now; setMirrorState(m); }
              }
            }
            // Conta-ripetizioni (guidato): oscillazione angolo ginocchio/gomito
            if (guidedRunningRef.current) {
              const L = result.landmarks[0];
              const a3 = (a, b, c) => {
                const A = L[a], B = L[b], C = L[c];
                if (!A || !B || !C) return null;
                const v1x = A.x - B.x, v1y = A.y - B.y, v2x = C.x - B.x, v2y = C.y - B.y;
                const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
                if (!d) return null;
                return (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI;
              };
              const kL = a3(23, 25, 27), kR = a3(24, 26, 28), eL = a3(11, 13, 15), eR = a3(12, 14, 16);
              let aa = null;
              if (kL != null || kR != null) aa = ((kL ?? kR) + (kR ?? kL)) / 2;
              else if (eL != null || eR != null) aa = ((eL ?? eR) + (eR ?? eL)) / 2;
              if (aa != null) {
                if (repPhaseRef.current === 'up' && aa < 95) repPhaseRef.current = 'down';
                else if (repPhaseRef.current === 'down' && aa > 155) { repPhaseRef.current = 'up'; repCountRef.current += 1; setRepCount(repCountRef.current); }
              }
            }
            const nose = result.landmarks[0][0];
            if (nose) setCentered(nose.x > 0.2 && nose.x < 0.8 && nose.y < 0.85 ? 'ok' : 'off');
          } else {
            lastLandmarksRef.current = null;
            setCentered('none');
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        // MediaPipe non disponibile su questo browser/dispositivo
      }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      poseRef.current?.lm?.close();
      poseRef.current = null;
      setCentered(null);
    };
  }, [streaming, skeletonOn]);

  // Specchio: sincronizza il ref on/off e reset stato
  useEffect(() => { mirrorOnRef.current = mirrorOn; if (!mirrorOn) setMirrorState(null); }, [mirrorOn]);
  // Specchio: la tecnica da rispecchiare segue il guidato/combo, altrimenti la scelta manuale
  useEffect(() => {
    let key;
    if (guidedOn && (guidedPhase === 'running' || guidedPhase === 'ready') && guidedPlan[guidedIdx]) {
      key = resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim());
    } else if (comboOn && currentCombo) {
      key = resolvePose(currentCombo.split('-')[0].trim());
    } else {
      key = mirrorTech;
    }
    mirrorTargetRef.current = key; setMirrorTargetKey(key);
  }, [guidedOn, guidedPhase, guidedIdx, guidedPlan, comboOn, currentCombo, mirrorTech]);

  // Specchio: legge a voce la correzione principale (max ogni 6s, solo se punteggio basso)
  useEffect(() => {
    if (!mirrorOn || !voiceOn || !mirrorState) return;
    const h = mirrorState.hints?.[0];
    if (!h || (mirrorState.score ?? 0) >= 70) return;
    const now = Date.now();
    if (now - mirrorSpeakRef.current.t > 6000 && h !== mirrorSpeakRef.current.msg) {
      mirrorSpeakRef.current = { t: now, msg: h };
      enqueueSpeak(h);
    }
  }, [mirrorState, mirrorOn, voiceOn, enqueueSpeak]);

  const buildPrompt = useCallback((basePrompt) => {
    let p = basePrompt || '';
    if (sessionContext.trim()) p += `\n\nSESSIONE ATTUALE: ${sessionContext.trim()}`;
    if (pastSessions.length > 0)
      p += `\n\nSESSIONI PRECEDENTI:\n` + pastSessions.slice(0, 2).map((s) => `- ${s.date} (${s.mode}): ${s.context} → ${s.keyFeedback}`).join('\n');
    const hist = feedbackHistoryRef.current;
    if (hist.length > 0)
      p += `\n\nFEEDBACK RECENTI (NON ripetere queste frasi, varia sempre il focus):\n` + hist.map((f, i) => `${i + 1}. ${f}`).join('\n');
    return p;
  }, [sessionContext, pastSessions]);

  // ── ALVEARE: invia un campione coach al cloud (KV → ponte Obsidian) ─────────
  const postSample = useCallback(async (row) => {
    if (!row) return;
    try {
      const r = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample: row, mode }),
      });
      if (r.ok) setSampleCount((n) => n + 1);
    } catch (_) { /* silenzioso: la cattura non deve mai disturbare la sessione */ }
  }, [mode]);

  // Mette in staging un nuovo verdetto: se ce n'era uno non etichettato, lo invia (label vuota).
  const stageSample = useCallback((verdict, angles, alerts) => {
    if (pendingSampleRef.current) postSample(pendingSampleRef.current); // flush del precedente
    pendingSampleRef.current = {
      exercise: mode,
      verdict: (verdict || '').split('\n')[0].slice(0, 200),
      angles: angles || {},
      alerts: alerts || [],
      label: '',
    };
    // Accumula la riga COMANDO/chiave per la pagella di fine sessione (max 40)
    const lines = String(verdict || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const key = (lines.find((l) => /^COMANDO\s*:/i.test(l)) || lines[0] || '').replace(/^COMANDO\s*:\s*/i, '').slice(0, 220);
    if (key) sessionVerdictsRef.current = [...sessionVerdictsRef.current, key].slice(-40);
    setSampleFeedback('shown');
  }, [mode, postSample]);

  // L'utente etichetta l'ultimo verdetto (👍 utile / 👎 sbagliato) → invio immediato.
  const labelSample = useCallback((label) => {
    const row = pendingSampleRef.current;
    if (!row) return;
    pendingSampleRef.current = null;
    postSample({ ...row, label });
    setSampleFeedback(label);
    setTimeout(() => setSampleFeedback(null), 1600);
  }, [postSample]);

  // Flush best-effort dell'ultimo campione non etichettato all'uscita (unmount / cambio disciplina).
  useEffect(() => () => {
    const row = pendingSampleRef.current;
    if (row && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/nvidia/visual',
          new Blob([JSON.stringify({ sample: row, mode })], { type: 'application/json' }));
      } catch (_) {}
      pendingSampleRef.current = null;
    }
  }, [mode]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    analyzingRef.current = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, prompt: buildPrompt(currentDisc?.prompt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      // Display SUBITO e persistente (non sparisce); la voce va in coda separata
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
      enqueueSpeak(data.content);
      stageSample(data.content, {}, []); // cattura per l'alveare (angoli non calcolati in manuale)
      // Store last 3 feedbacks to avoid repetition
      feedbackHistoryRef.current = [data.content.split('\n')[0], ...feedbackHistoryRef.current].slice(0, 3);
      // Accumulate all feedbacks for session analysis
      sessionFeedbacksRef.current = [...sessionFeedbacksRef.current, data.content].slice(0, 30);
      if (isSparring(mode) && data.content) {
        const point = parsePoint(data.content);
        if (point) {
          setScore((s) => ({ ...s, [point]: s[point] + 1 }));
          setLastPoint(point);
          setTimeout(() => setLastPoint(null), 2500);
        }
      }
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally { setAnalyzing(false); analyzingRef.current = false; }
  }, [mode, buildPrompt, currentDisc, enqueueSpeak, stageSample]);

  // ── PRECISIONE: angoli reali dallo scheletro + smoothing + framing + segnali ──
  const poseHistRef = useRef([]);
  const computePose = useCallback(() => {
    const lm = lastLandmarksRef.current;
    if (!lm || lm.length < 29) return { framingOk: false, quality: 'none', hint: '', alerts: [], angles: {} };
    const vis = (i) => lm[i]?.visibility ?? 1;
    const ang = (a, b, c) => {
      const A = lm[a], B = lm[b], C = lm[c];
      if (!A || !B || !C || vis(a) < 0.4 || vis(b) < 0.4 || vis(c) < 0.4) return null;
      const v1x = A.x - B.x, v1y = A.y - B.y, v2x = C.x - B.x, v2y = C.y - B.y;
      const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
      if (!d) return null;
      return Math.round((Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI);
    };
    // 1) framing/qualità tracking
    const core = vis(11) > 0.4 && vis(12) > 0.4 && vis(23) > 0.4 && vis(24) > 0.4;
    const legs = vis(25) > 0.4 || vis(26) > 0.4;
    const anyVis = lm.some((p) => (p?.visibility ?? 0) > 0.5);
    const quality = core ? (legs ? 'full' : 'upper') : (anyVis ? 'partial' : 'none');
    const framingOk = core;
    // 2) smoothing: mediana delle ultime 3 letture per stabilità
    const cur = { eL: ang(11, 13, 15), eR: ang(12, 14, 16), kL: ang(23, 25, 27), kR: ang(24, 26, 28), hL: ang(11, 23, 25), hR: ang(12, 24, 26) };
    const hist = [...poseHistRef.current, cur].slice(-3);
    poseHistRef.current = hist;
    const med = (k) => { const v = hist.map((h) => h[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const sm = { eL: med('eL'), eR: med('eR'), kL: med('kL'), kR: med('kR'), hL: med('hL'), hR: med('hR') };
    const sM = lm[11] && lm[12] ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 } : null;
    const hM = lm[23] && lm[24] ? { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 } : null;
    const lean = sM && hM ? Math.round((Math.atan2(Math.abs(sM.x - hM.x), Math.abs(hM.y - sM.y) || 0.001) * 180) / Math.PI) : null;
    const parts = [];
    const p = (lbl, v) => { if (v != null) parts.push(`${lbl} ${v}°`); };
    p('gomito sx', sm.eL); p('gomito dx', sm.eR); p('ginocchio sx', sm.kL); p('ginocchio dx', sm.kR); p('anca sx', sm.hL); p('anca dx', sm.hR);
    if (lean != null) parts.push(`busto ${lean}° dalla verticale`);
    // 3) segnali geometrici misurati (fatti certi per l'AI)
    const alerts = [];
    if (sm.eL != null && sm.eL > 168) alerts.push('gomito sx iperesteso');
    if (sm.eR != null && sm.eR > 168) alerts.push('gomito dx iperesteso');
    const striking = /box|mma|muay|kick|karate|taekwondo|sanda|kung|wing|krav|sambo|hapkido|judo|wrestl|bjj|luta|pankration|silat|systema|capoeira|kendo/i.test(mode);
    if (striking) {
      if (vis(15) > 0.4 && vis(11) > 0.4 && lm[15].y > lm[11].y + 0.08) alerts.push('guardia sx bassa (mano sotto la spalla)');
      if (vis(16) > 0.4 && vis(12) > 0.4 && lm[16].y > lm[12].y + 0.08) alerts.push('guardia dx bassa (mano sotto la spalla)');
    }
    if (lean != null && lean > 38) alerts.push('busto troppo inclinato');
    return { framingOk, quality, hint: parts.join(', '), alerts, angles: { ...sm, lean } };
  }, [mode]);

  // ── AUTO: il maestro osserva in silenzio, poi UN verdetto (no voce ogni tick) ──
  // Ogni tick = un'osservazione silenziosa accumulata. Al 3° tick → verdetto fuso e
  // letto UNA volta. Se un'osservazione vede rischio infortunio → verdetto SUBITO.
  const autoTick = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
    analyzingRef.current = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    // Downscale a max 512px → upload più leggero e analisi più veloce (performance)
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    const sc = Math.min(1, 512 / vw);
    canvas.width = Math.round(vw * sc); canvas.height = Math.round(vh * sc);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    const pose = computePose();
    // GATE inquadratura: se il corpo è solo parziale, niente analisi imprecisa
    if (skeletonOn && pose.quality === 'partial') {
      setFramingHint('Inquadra tutto il corpo nel riquadro'); setTrackQuality('partial');
      analyzingRef.current = false; return;
    }
    setFramingHint(''); setTrackQuality(pose.quality);
    const poseHint = pose.hint + (pose.alerts.length ? `. SEGNALI MISURATI (certi): ${pose.alerts.join('; ')}` : '');
    setAnalyzing(true);
    try {
      // 1) OSSERVAZIONE silenziosa (osservatori, niente cervello, niente voce)
      const obsRes = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, observeOnly: true, poseHint }),
      });
      const obsData = await obsRes.json();
      let reachedVerdict = false;
      if (obsRes.ok && obsData.observation) {
        const obsText = poseHint ? `${obsData.observation} [angoli: ${poseHint}]` : obsData.observation;
        observationsRef.current = [...observationsRef.current, obsText].slice(-VERDICT_EVERY);
        setObserveProgress(observationsRef.current.length);
        const urgent = obsData.risk || /infortun|rischio|pericol|cede|collass|iperesten/i.test(obsData.observation);
        reachedVerdict = urgent || observationsRef.current.length >= VERDICT_EVERY;
      }
      // 2) VERDETTO finale del maestro (parla UNA volta) — su tutte le osservazioni
      if (reachedVerdict) {
        const verRes = await fetch('/api/nvidia/visual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, observations: observationsRef.current, prompt: buildPrompt(currentDisc?.prompt), poseHint }),
        });
        const data = await verRes.json();
        if (verRes.ok && data.content) {
          setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
          enqueueSpeak(data.content);
          stageSample(data.content, pose.angles, pose.alerts); // cattura per l'alveare (angoli reali)
          feedbackHistoryRef.current = [data.content.split('\n')[0], ...feedbackHistoryRef.current].slice(0, 3);
          sessionFeedbacksRef.current = [...sessionFeedbacksRef.current, data.content].slice(0, 30);
          if (isSparring(mode) && data.content) {
            const point = parsePoint(data.content);
            if (point) { setScore((s) => ({ ...s, [point]: s[point] + 1 })); setLastPoint(point); setTimeout(() => setLastPoint(null), 2500); }
          }
        }
        observationsRef.current = [];
        setObserveProgress(0);
      }
    } catch (_) {
      // silenzioso: tieni l'ultimo verdetto a schermo
    } finally { setAnalyzing(false); analyzingRef.current = false; }
  }, [mode, buildPrompt, currentDisc, enqueueSpeak, computePose, skeletonOn, stageSample]);

  const analyzeSession = useCallback(async () => {
    const feedbacks = sessionFeedbacksRef.current;
    if (feedbacks.length === 0) return;
    setAnalyzingSession(true);
    try {
      const res = await fetch('/api/nvidia/visual-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks, discipline: currentDisc?.label, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore analisi sessione');
      setSessionAnalysis({ content: data.content, provider: data.provider });
    } catch (err) {
      setSessionAnalysis({ content: '⚠️ ' + err.message, provider: null });
    } finally {
      setAnalyzingSession(false);
    }
  }, [mode, currentDisc]);

  useEffect(() => {
    if (autoMode && streaming) {
      observationsRef.current = []; setObserveProgress(0);
      autoTick();
      autoTimerRef.current = setInterval(autoTick, 4000);
    } else {
      clearInterval(autoTimerRef.current);
      observationsRef.current = []; setObserveProgress(0);
    }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  // ── GUIDATO: genera circuito → drill (Via → timer+osserva → pagella) → next ──
  const stopGuidedTimers = useCallback(() => {
    clearInterval(guidedTimerRef.current); guidedTimerRef.current = null;
    clearInterval(guidedTickRef.current); guidedTickRef.current = null;
  }, []);

  // Piano LOCALE garantito — usato se l'AI non risponde: così il circuito parte SEMPRE.
  const buildLocalPlan = useCallback(() => {
    const scene = sceneFor(mode);
    const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    if (scene === 'solo') {
      if (mode === 'yoga' || mode === 'stretching') return [
        { name: 'Respiro e centratura', durationSec: 40, focus: 'In piedi, respira lento dal naso e allunga la colonna', watchFor: 'spalle basse e rilassate' },
        { name: 'Forward Fold', durationSec: 45, focus: 'Piega in avanti dall\'anca, ginocchia morbide', watchFor: 'schiena lunga, non curva' },
        { name: 'Warrior II', durationSec: 45, focus: 'Affondo laterale, braccia parallele a terra', watchFor: 'ginocchio anteriore sopra la caviglia' },
        { name: 'Tree — equilibrio', durationSec: 40, focus: 'Un piede sull\'interno coscia, sguardo fisso', watchFor: 'bacino stabile, respiro calmo' },
        { name: 'Bridge', durationSec: 40, focus: 'Spingi coi talloni, apri il petto', watchFor: 'glutei attivi, collo libero' },
        { name: 'Respiro finale', durationSec: 45, focus: 'Respiro 4-7-8, rilascia le tensioni', watchFor: 'pancia che si gonfia nell\'inspiro' },
      ];
      if (mode === 'running') return [
        { name: 'Corsa sul posto', durationSec: 45, focus: 'Cadenza alta, piedi leggeri', watchFor: 'mesopiede sotto il baricentro' },
        { name: 'Skip alto', durationSec: 30, focus: 'Ginocchia su, braccia a 90°', watchFor: 'busto leggermente avanti' },
        { name: 'Affondi in camminata', durationSec: 40, focus: 'Passi lunghi e controllati', watchFor: 'ginocchio non oltre la punta' },
        { name: 'Corsa cadenza 180', durationSec: 50, focus: 'Passi rapidi e corti', watchFor: 'contatto breve col suolo' },
        { name: 'Defaticamento e respiro', durationSec: 40, focus: 'Rallenta e respira 1:2', watchFor: 'spalle rilassate' },
      ];
      if (mode === 'breathing') return [
        { name: 'Respiro diaframmatico', durationSec: 45, focus: 'Mano sull\'ombelico, gonfia la pancia', watchFor: 'petto fermo, pancia che sale' },
        { name: 'Box breathing 4-4-4-4', durationSec: 50, focus: 'Inspira, tieni, espira, tieni — 4 secondi ciascuno', watchFor: 'ritmo costante' },
        { name: 'Respiro 4-7-8', durationSec: 50, focus: 'Inspira 4, tieni 7, espira 8', watchFor: 'espiro lungo e lento' },
        { name: 'Respiro di potenza', durationSec: 40, focus: '3 respiri rapidi, poi espiro forte', watchFor: 'core che si attiva' },
        { name: 'Calma finale', durationSec: 45, focus: 'Respiro naturale, mente vuota', watchFor: 'battito che rallenta' },
      ];
      return [
        { name: 'Squat', durationSec: 45, focus: 'Scendi lento, petto alto', watchFor: 'ginocchia in linea coi piedi' },
        { name: 'Push-up', durationSec: 40, focus: 'Corpo rigido, gomiti a 45°', watchFor: 'niente cedimento lombare' },
        { name: 'Plank', durationSec: 40, focus: 'Linea retta testa-bacino-talloni', watchFor: 'core attivo, bacino stabile' },
        { name: 'Affondi', durationSec: 45, focus: 'Alterna le gambe, busto dritto', watchFor: 'ginocchio posteriore quasi a terra' },
        { name: 'Corsa sul posto', durationSec: 45, focus: 'Cardio finale, cadenza alta', watchFor: 'respiro ritmico' },
      ];
    }
    // strike / opponent → usa i combo della disciplina
    const combos = COMBO_LIBRARY[mode] || COMBO_LIBRARY.default;
    const picks = shuffle(combos).slice(0, 4);
    return [
      { name: 'Riscaldamento: guardia e movimento', durationSec: 40, focus: 'Muoviti sui piedi, mani alte, sciogli le spalle', watchFor: 'guardia alta, baricentro basso' },
      ...picks.map((c) => ({ name: c, durationSec: 40, focus: 'Esegui lento e pulito, torna sempre in guardia', watchFor: 'tecnica precisa, ritorno in guardia' })),
      { name: 'Combo libera', durationSec: 45, focus: 'Concatena le tecniche a tuo ritmo', watchFor: 'respiro e fluidità' },
    ];
  }, [mode]);

  const generateGuidedPlan = useCallback(async () => {
    setGuidedLoading(true); setGuidedReview(null); setGuidedPhase('gen');
    let drills = null;
    try {
      // progressione: passa lo storico locale (voti + debolezze + focus) così i drill crescono
      const history = pastSessions
        .filter((s) => s.mode === mode && (s.score != null || s.focusNext?.length))
        .slice(0, 5)
        .map((s) => `${s.date} voto ${s.score ?? '-'}/100 · da migliorare: ${(s.weaknesses || []).join('; ') || '-'} · focus→ ${(s.focusNext || []).join('; ') || '-'}`);
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePlan: true, mode, goal: sessionContext, level: guidedLevel, context: sessionContext, history }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.drills) && data.drills.length) drills = data.drills;
    } catch (_) { /* rete/AI giù → fallback locale */ }
    // Fallback GARANTITO: se l'AI non produce nulla, usa il piano locale della disciplina.
    if (!drills || !drills.length) drills = buildLocalPlan();
    setGuidedPlan(drills); setGuidedIdx(0); setGuidedPhase('ready'); setGuidedLoading(false);
  }, [mode, sessionContext, guidedLevel, pastSessions, buildLocalPlan]);

  const finishDrillRef = useRef(() => {});
  const nextDrillRef = useRef(() => {});

  const finishDrill = useCallback(async () => {
    stopGuidedTimers(); guidedRunningRef.current = false;
    setGuidedPhase('review'); setGuidedLoading(true);
    const d = guidedPlan[guidedIdx] || {};
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillReview: true, mode, drill: d, observations: guidedObsRef.current }),
      });
      const data = await res.json();
      if (res.ok && data.review) {
        setGuidedReview(data.review);
        if (data.review.cue) enqueueSpeak(`${d.name}. ${data.review.cue}`);
        if (guidedAutoAdvance) setTimeout(() => nextDrillRef.current(), 7000);
      }
    } catch {} finally { setGuidedLoading(false); }
  }, [guidedPlan, guidedIdx, mode, enqueueSpeak, guidedAutoAdvance, stopGuidedTimers]);
  finishDrillRef.current = finishDrill;

  const startDrill = useCallback(() => {
    const d = guidedPlan[guidedIdx]; if (!d) return;
    guidedObsRef.current = []; setGuidedReview(null);
    repCountRef.current = 0; repPhaseRef.current = 'up'; setRepCount(0); guidedRunningRef.current = true; // conta-rip
    setGuidedPhase('running'); setGuidedTimeLeft(d.durationSec);
    unlockSpeech();
    enqueueSpeak(`Prossimo: ${d.name}. ${d.focus || ''}. Pronti, via!`);
    guidedTimerRef.current = setInterval(() => {
      setGuidedTimeLeft((t) => { if (t <= 1) { finishDrillRef.current(); return 0; } return t - 1; });
    }, 1000);
    guidedTickRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || analyzingRef.current) return;
      analyzingRef.current = true;
      try {
        const canvas = canvasRef.current, video = videoRef.current;
        canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
        const r = await fetch('/api/nvidia/visual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, observeOnly: true }) });
        const dt = await r.json();
        if (r.ok && dt.observation) guidedObsRef.current = [...guidedObsRef.current, dt.observation].slice(-8);
      } catch {} finally { analyzingRef.current = false; }
    }, 4000);
  }, [guidedPlan, guidedIdx, mode, enqueueSpeak, unlockSpeech]);

  const nextDrill = useCallback(() => {
    stopGuidedTimers(); setGuidedReview(null);
    setGuidedIdx((i) => {
      const ni = i + 1;
      if (ni >= guidedPlan.length) { setGuidedPhase('done'); return i; }
      setGuidedPhase('ready'); return ni;
    });
  }, [guidedPlan, stopGuidedTimers]);
  nextDrillRef.current = nextDrill;

  const startGuided = useCallback(() => {
    if (autoMode) setAutoMode(false);
    setGuidedOn(true);
    if (guidedPlan.length === 0) generateGuidedPlan();
    else setGuidedPhase('ready');
  }, [autoMode, guidedPlan, generateGuidedPlan]);

  const stopGuided = useCallback(() => {
    stopGuidedTimers(); guidedRunningRef.current = false;
    setGuidedOn(false); setGuidedPhase('idle'); setGuidedReview(null);
    window.speechSynthesis?.cancel();
  }, [stopGuidedTimers]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <div className="relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.12), rgba(13,148,136,0.06))', border: `1px solid ${C.emerald.border}` }}>
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #10b981 40%, #0d9488 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />
          <div className="relative px-4 py-3.5 overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', animation: 'drift-slow 8s ease-in-out infinite' }} />
            <p className="text-xs font-black tracking-widest" style={{ color: C.emerald.hex, fontFamily: 'Orbitron, sans-serif' }}>📷 VISUAL LIVE COACH</p>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Groq Scout · Cosmos · Gemma Brain · 27 discipline</p>
          </div>
        </div>

        {DISCIPLINE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-black text-gray-600 mb-2 tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif' }}>{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((d) => {
                const isActive = mode === d.id;
                const isSpar = isSparring(d.id);
                const col = isSpar ? C.violet : C.emerald;
                return (
                  <motion.button key={d.id} whileTap={{ scale: 0.91 }} whileHover={{ scale: 1.04 }} onClick={() => setMode(d.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative overflow-hidden"
                    style={isActive
                      ? { background: `linear-gradient(135deg, ${col.hex}33, ${col.hex}11)`, color: col.hex, boxShadow: `0 0 0 1px ${col.border}, 0 4px 14px ${col.glow}`, border: `1px solid ${col.border}` }
                      : { background: 'rgba(55,65,81,0.35)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {isActive && <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', animation: 'chip-sheen 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />}
                    {d.emoji} {d.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {isPartnerMode && (
          <div className="p-3 rounded-xl" style={{ background: C.violet.bg, border: `1px solid ${C.violet.border}` }}>
            <p className="text-xs font-bold" style={{ color: C.violet.hex }}>👥 Modalità partner attiva</p>
            <p className="text-xs text-gray-500 mt-0.5">Inquadrate entrambi — l'AI arbitra e dà punti in tempo reale</p>
          </div>
        )}

        {isPartnerMode && (
          <RoundConfig rounds={rounds} onRounds={setRounds} roundDuration={roundDuration} onRoundDuration={setRoundDuration} />
        )}

        <div>
          <p className="text-[10px] text-gray-600 mb-1.5 font-mono tracking-widest">DESCRIVI LA SESSIONE <span className="text-gray-700">(OPZIONALE)</span></p>
          <textarea value={sessionContext} onChange={(e) => setSessionContext(e.target.value)} rows={2}
            placeholder={isPartnerMode ? 'Es. Io e mio fratello — focus combo leggero…' : `Es. ${currentDisc?.label} – tecnica base…`}
            className="w-full px-4 py-3 text-sm text-white placeholder-gray-700 resize-none focus:outline-none transition-all"
            style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, backdropFilter: 'blur(8px)' }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(16,185,129,0.35)'; e.target.style.boxShadow = '0 0 0 1px rgba(16,185,129,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }} />
        </div>

        {pastSessions.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 mb-1.5 font-mono tracking-widest">SESSIONI RECENTI</p>
            <div className="space-y-1">
              {pastSessions.slice(0, 3).map((s, i) => (
                <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode(s.mode); setSessionContext(s.context); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all"
                  style={{ background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#4b5563' }}>{s.date} · {s.mode}</span>
                  {s.duration > 0 && <span style={{ color: '#374151' }}> · {s.duration}min</span>}
                  <span className="mx-1" style={{ color: '#374151' }}>·</span>
                  <span style={{ color: '#6b7280' }}>{s.context.slice(0, 42)}{s.context.length > 42 ? '…' : ''}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={startSession}
          className="w-full py-4 rounded-2xl text-white font-black text-sm transition-all relative overflow-hidden"
          style={isPartnerMode
            ? { background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 8px 28px ${C.violet.glow}` }
            : { background: `linear-gradient(135deg, ${C.emerald.hex}, #0d9488)`, boxShadow: `0 8px 28px ${C.emerald.glow}` }}>
          <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', animation: 'chip-sheen 2.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
          <span className="relative" style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em' }}>
            {isPartnerMode ? `👥 INIZIA MATCH — ${rounds}×${roundDuration/60}MIN` : '📷 INIZIA SESSIONE LIVE'}
          </span>
        </motion.button>
      </div>
    );
  }

  // ── Live — camera overlay (video a tutto schermo + comandi sovrapposti) ──────
  // Pattern app-fotocamera: video in absolute inset-0 come sfondo, tutti i
  // comandi in absolute ancorati top/bottom.
  // PORTAL su document.body: indispensabile perché un ancestor con transform
  // (il <motion.div> di framer-motion che anima i tab) renderebbe altrimenti
  // `position: fixed` relativo a sé, spingendo i comandi in fondo alla pagina
  // invece che al viewport. Il portal li àncora al viewport reale.
  return createPortal(
    <div className="coach-live-fs fixed inset-0 z-[100] bg-black overflow-hidden" style={{ touchAction: 'none', overscrollBehavior: 'none' }}>
      {/* VIDEO — sfondo a tutto schermo. Frontale = speculare (come un vero specchio) */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={overlayRef} className="absolute pointer-events-none" style={{ opacity: skeletonOn ? 1 : 0, transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />

      {/* TOP BAR — sovrapposta in alto */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2.5 px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 30%, transparent)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {currentDisc?.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>{currentDisc?.label?.toUpperCase()}</p>
          {analysis?.provider
            ? <p className="text-[10px] truncate mt-0.5 font-mono" style={{ color: C.violet.hex, opacity: 0.9 }}>🤖 {analysis.provider}</p>
            : sessionContext && <p className="text-[10px] truncate mt-0.5" style={{ color: '#9ca3af' }}>{sessionContext}</p>
          }
        </div>
        <div className="flex items-center gap-1.5">
          {streaming && (autoMode || guidedOn) && skeletonOn && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold inline-flex items-center gap-1" title="Qualità tracking corpo"
              style={{
                background: trackQuality === 'full' ? 'rgba(16,185,129,0.22)' : trackQuality === 'upper' ? 'rgba(56,189,248,0.2)' : trackQuality === 'partial' ? 'rgba(249,115,22,0.22)' : 'rgba(120,120,120,0.2)',
                color: trackQuality === 'full' ? C.emerald.hex : trackQuality === 'upper' ? '#38bdf8' : trackQuality === 'partial' ? C.orange.hex : '#9ca3af',
              }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
              {trackQuality === 'full' ? 'corpo pieno' : trackQuality === 'upper' ? 'busto' : trackQuality === 'partial' ? 'parziale' : 'no corpo'}
            </span>
          )}
          {streaming && <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'rgba(16,185,129,0.25)', color: C.emerald.hex, border: `1px solid ${C.emerald.border}`, animation: 'pulse-glow 2s ease-in-out infinite' }}>● LIVE</span>}
          {autoMode && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold inline-flex items-center gap-1.5" style={{ background: 'rgba(249,115,22,0.25)', color: C.orange.hex, border: `1px solid ${C.orange.border}` }}>
              AUTO
              <span className="flex gap-0.5">
                {Array.from({ length: VERDICT_EVERY }).map((_, i) => (
                  <motion.span key={i} className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: i < observeProgress ? C.orange.hex : 'rgba(249,115,22,0.25)' }}
                    animate={i === observeProgress ? { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] } : { scale: 1 }}
                    transition={{ duration: 0.9, repeat: Infinity }} />
                ))}
              </span>
            </span>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={stopCamera} aria-label="Chiudi sessione"
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(185,28,28,0.55)', border: `1px solid ${C.red.border}`, color: '#fff' }}>
            <X size={16} />
          </motion.button>
        </div>
      </div>

      {/* SPARRING: timer + score — sotto la top bar */}
      {isPartnerMode && (
        <div className="absolute inset-x-0 z-20 px-3 space-y-2" style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 52px)' }}>
          {timer.phase === 'idle'
            ? <motion.button whileTap={{ scale: 0.97 }} onClick={timer.start}
                className="w-full py-2.5 rounded-xl text-white font-black text-sm"
                style={{ background: `linear-gradient(135deg, ${C.red.hex}, #b91c1c)`, boxShadow: `0 4px 16px ${C.red.glow}` }}>
                🔔 Inizia Round 1
              </motion.button>
            : <RoundTimerDisplay timer={timer} roundDuration={roundDuration} restDuration={60} />
          }
          <ScoreTracker score={score} onScore={handleScore} lastPoint={lastPoint} />
        </div>
      )}

      {/* Avviso inquadratura — il corpo non è ben visibile per un'analisi precisa */}
      <AnimatePresence>
        {framingHint && (autoMode || guidedOn) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5"
            style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 56px)', background: 'rgba(249,115,22,0.92)', color: '#1a1208', boxShadow: '0 4px 18px rgba(249,115,22,0.4)' }}>
            <Move size={13} /> {framingHint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BLOCCO INFERIORE — feedback + comandi, ancorato in basso (sempre visibile) */}
      <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 65%, rgba(0,0,0,0.55) 88%, transparent)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

        {/* CARD GUIDATA — circuito drill su misura */}
        {guidedOn && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mx-3 mt-3 rounded-2xl p-4"
            style={{ background: 'rgba(6,20,16,0.94)', border: `1px solid ${C.emerald.border}`, backdropFilter: 'blur(8px)' }}>

            {guidedPhase === 'gen' && (
              <div className="text-center py-3">
                <p className="text-sm font-black" style={{ color: C.emerald.hex, fontFamily: 'Orbitron, sans-serif' }}>🎯 Genero il tuo circuito…</p>
                <p className="text-[11px] text-gray-500 mt-1">Esercizi su misura per {currentDisc?.label}</p>
              </div>
            )}

            {guidedPhase === 'ready' && guidedPlan[guidedIdx] && (
              <div className="space-y-3">
                {/* stepper del circuito */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-gray-500">ESERCIZIO {guidedIdx + 1}/{guidedPlan.length}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: C.emerald.hex }}>{guidedPlan[guidedIdx].durationSec}s</span>
                </div>
                <div className="flex gap-1">
                  {guidedPlan.map((_, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i < guidedIdx ? C.emerald.hex : i === guidedIdx ? '#fbbf24' : '#1f2937' }} />
                  ))}
                </div>
                {/* anteprima animata del movimento */}
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl p-1" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                    <StickFigure poseKey={resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())} color={C.emerald.hex} size={88} highlight scene={sceneFor(mode)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-black text-white leading-tight">{guidedPlan[guidedIdx].name}</p>
                    {guidedPlan[guidedIdx].focus && (
                      <p className="text-[12px] text-emerald-200/90 mt-1 leading-snug"><b className="uppercase text-[9px] tracking-wider opacity-70">Cosa fare</b><br />{guidedPlan[guidedIdx].focus}</p>
                    )}
                  </div>
                </div>
                {guidedPlan[guidedIdx].watchFor && (
                  <p className="text-[11px] text-amber-200/90 flex items-start gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}><Eye size={13} className="shrink-0 mt-0.5" /> <span><b className="uppercase text-[9px] tracking-wider opacity-70">Tieni d'occhio</b> · {guidedPlan[guidedIdx].watchFor}</span></p>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={startDrill}
                  className="w-full py-3.5 rounded-xl text-white font-black text-sm"
                  style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #047857)`, boxShadow: '0 4px 18px rgba(16,185,129,0.4)' }}>
                  ▶ Via — sono pronto
                </motion.button>
              </div>
            )}

            {guidedPhase === 'running' && guidedPlan[guidedIdx] && (
              <div className="text-center space-y-2">
                <p className="text-[10px] font-mono tracking-widest text-gray-500">ESERCIZIO {guidedIdx + 1}/{guidedPlan.length}</p>
                {/* movimento animato ben visibile */}
                <div className="flex justify-center" style={{ filter: `drop-shadow(0 0 14px ${C.emerald.hex}55)` }}>
                  <StickFigure poseKey={resolvePose((guidedPlan[guidedIdx].name || '').split(/[-–—,]/)[0].trim())} color={C.emerald.hex} size={104} highlight scene={sceneFor(mode)} />
                </div>
                <p className="text-lg font-black text-white leading-tight">{guidedPlan[guidedIdx].name}</p>
                {/* COSA FARE — grande e chiaro */}
                {guidedPlan[guidedIdx].focus && (
                  <p className="text-[13px] font-semibold text-emerald-200 leading-snug px-2">{guidedPlan[guidedIdx].focus}</p>
                )}
                <div className="flex items-center justify-center gap-5 pt-1">
                  <div>
                    <p className="text-5xl font-black text-white tabular-nums leading-none" style={{ fontFamily: 'Orbitron, sans-serif' }}>{Math.floor(guidedTimeLeft / 60)}:{String(guidedTimeLeft % 60).padStart(2, '0')}</p>
                    <p className="text-[8px] tracking-widest uppercase text-gray-500 mt-1">tempo</p>
                  </div>
                  <div className="w-px h-12" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <p className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: 'Orbitron, sans-serif', color: C.emerald.hex }}>{repCount}</p>
                    <p className="text-[8px] tracking-widest uppercase text-gray-500 mt-1">rip</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: `${guidedPlan[guidedIdx].durationSec ? (guidedTimeLeft / guidedPlan[guidedIdx].durationSec) * 100 : 0}%`, background: C.emerald.hex, transition: 'width 1s linear' }} />
                </div>
                {guidedPlan[guidedIdx].watchFor && <p className="text-[11px] text-amber-200/80 flex items-center justify-center gap-1.5"><Eye size={12} /> {guidedPlan[guidedIdx].watchFor}</p>}
                <button onClick={() => finishDrillRef.current()} className="text-[11px] text-gray-500 underline">termina ora</button>
              </div>
            )}

            {guidedPhase === 'review' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-gray-500">PAGELLA · {guidedPlan[guidedIdx]?.name}</span>
                  {guidedReview && <span className="text-base font-black" style={{ color: guidedReview.score >= 7 ? C.emerald.hex : guidedReview.score >= 5 ? C.orange.hex : C.red.hex }}>{guidedReview.score}/10</span>}
                </div>
                {guidedLoading && <p className="text-xs text-gray-500">⏳ Analizzo il drill…</p>}
                {guidedReview && (
                  <>
                    {guidedReview.good?.length > 0 && <div className="space-y-1">{guidedReview.good.map((g, i) => <p key={i} className="text-xs text-gray-200">✅ {g}</p>)}</div>}
                    {guidedReview.fix?.length > 0 && <div className="space-y-1">{guidedReview.fix.map((f, i) => <p key={i} className="text-xs" style={{ color: '#fca5a5' }}>❌ {f}</p>)}</div>}
                    {guidedReview.cue && <p className="text-sm font-bold text-white mt-1">🎯 {guidedReview.cue}</p>}
                  </>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => nextDrillRef.current()}
                  className="w-full py-3 rounded-xl text-white font-black text-sm mt-1"
                  style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)` }}>
                  {guidedIdx + 1 >= guidedPlan.length ? '🏁 Fine circuito' : 'Prossimo drill →'}
                </motion.button>
                <label className="flex items-center gap-2 text-[11px] text-gray-500">
                  <input type="checkbox" checked={guidedAutoAdvance} onChange={(e) => setGuidedAutoAdvance(e.target.checked)} /> auto-avanza dopo la pagella
                </label>
              </div>
            )}

            {guidedPhase === 'done' && (
              <div className="text-center space-y-2 py-2">
                <p className="text-lg font-black" style={{ color: C.emerald.hex }}>🎉 Circuito completato!</p>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setGuidedPlan([]); generateGuidedPlan(); }} className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs" style={{ background: `linear-gradient(135deg, ${C.emerald.hex}, #047857)` }}>🔄 Nuovo circuito</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={stopGuided} className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs" style={{ background: 'rgba(55,65,81,0.7)' }}>Esci</motion.button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── COMBO A COMANDO ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {comboOn && (
            <motion.div
              key="combo-overlay"
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="mx-3 mt-3 rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(124,58,237,0.14))', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 28px rgba(239,68,68,0.18)' }}>
              {/* Punteggio */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-[9px] font-mono tracking-widest font-bold text-red-400/90">🥊 COMBO MODE</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black" style={{ color: '#34d399' }}>✅ {comboScore.perfect}</span>
                  <span className="text-[10px] font-black" style={{ color: '#fbbf24' }}>👍 {comboScore.good}</span>
                  <span className="text-[10px] font-black" style={{ color: '#f87171' }}>🔄 {comboScore.redo}</span>
                  <button onClick={stopCombo} className="text-gray-500 hover:text-gray-300 ml-1"><X size={14} /></button>
                </div>
              </div>
              <div className="px-4 pb-4">
                {/* CALLING — DEMO (mostra la combo intera) poi conto alla rovescia */}
                {comboPhase === 'calling' && (
                  <div className="flex flex-col items-center py-2">
                    {/* Figura combattente animata al centro, ben grande */}
                    <ComboAnimator combo={currentCombo} color={C.orange.hex} mode={mode} size={128} />
                    {/* Fase demo vs conto alla rovescia */}
                    {comboCountdown == null ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full"
                          style={{ color: '#0b0e14', background: C.orange.hex }}>👁 Memorizza la combo</span>
                        <div className="flex gap-1 mt-1">{[0,1,2].map((i) => (
                          <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange.hex }}
                            animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }} />
                        ))}</div>
                      </motion.div>
                    ) : (
                      <div className="mt-1 flex flex-col items-center">
                        <p className="text-[9px] uppercase tracking-widest text-gray-400">Esegui tra…</p>
                        <motion.p key={comboCountdown} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-6xl font-black leading-none" style={{ color: '#f97316', textShadow: '0 0 24px rgba(249,115,22,0.5)' }}>{comboCountdown}</motion.p>
                      </div>
                    )}
                  </div>
                )}
                {/* GO! */}
                {comboPhase === 'go' && (
                  <div className="text-center py-3">
                    <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-5xl font-black" style={{ color: '#ef4444', textShadow: '0 0 30px rgba(239,68,68,0.6)' }}>VIA!</motion.p>
                    <p className="text-base font-black text-white mt-1">{currentCombo}</p>
                  </div>
                )}
                {/* JUDGING */}
                {comboPhase === 'judging' && (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-base font-black text-white">{currentCombo}</p>
                    <div className="flex justify-center gap-1">{[0,1,2].map((i) => (
                      <motion.span key={i} className="w-2 h-2 rounded-full" style={{ background: '#f97316' }}
                        animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.2 }} />
                    ))}</div>
                    <p className="text-[10px] text-gray-400">Il coach valuta…</p>
                  </div>
                )}
                {/* RESULT */}
                {comboPhase === 'result' && comboResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {comboResult.grade === 'perfect' ? '🌟' : comboResult.grade === 'good' ? '✅' : '🔄'}
                      </span>
                      <span className="text-sm font-black" style={{
                        color: comboResult.grade === 'perfect' ? '#34d399' : comboResult.grade === 'good' ? '#fbbf24' : '#f87171'
                      }}>
                        {comboResult.grade === 'perfect' ? 'PERFETTO!' : comboResult.grade === 'good' ? 'BUONO' : 'RIPROVA'}
                      </span>
                    </div>
                    {comboResult.feedback && <p className="text-[12px] text-gray-200 leading-snug">{comboResult.feedback}</p>}
                    <p className="text-[10px] text-gray-500">Prossimo combo in arrivo…</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEZIONE COMMENTI AI — il comando RESTA visibile; l'analisi è solo un puntino */}
        <AnimatePresence>
          {!guidedOn && !comboOn && (analysis || analyzing) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="px-3 pt-4 pb-1 max-h-[38vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-1.5">
                {analysis?.provider && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: C.violet.hex, background: 'rgba(139,92,246,0.15)' }}>🤖 {analysis.provider}</span>
                )}
                {/* Indicatore di analisi in corso — NON cancella il comando visibile */}
                {analyzing && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {[0,1,2].map((i) => (
                      <motion.span key={i} className="w-1 h-1 rounded-full inline-block" style={{ background: C.violet.hex }}
                        animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 0.7, repeat: Infinity, delay: i*0.16 }} />
                    ))}
                  </span>
                )}
                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${C.violet.hex}66, transparent)` }} />
                {sampleCount > 0 && (
                  <span className="text-[9px] font-mono font-bold flex-shrink-0" style={{ color: '#fbbf24' }} title="Campioni raccolti per l'alveare">🐝 {sampleCount}</span>
                )}
                {analysis?.time && <p className="text-[9px] font-mono flex-shrink-0" style={{ color: '#6b7280' }}>{analysis.time}</p>}
              </div>
              {analysis?.content
                ? (() => {
                    const parts = {};
                    String(analysis.content).split('\n').forEach((line) => {
                      const m = line.match(/^\s*(COMANDO|BENE|PROVA|VISTO|PERCH[ÉE]|SITUAZIONE|ISTRUZIONE|PUNTO)\s*:\s*(.*)/i);
                      if (m) parts[m[1].toUpperCase().replace('PERCHE', 'PERCHÉ')] = m[2].trim();
                    });
                    const cmd = parts.COMANDO || parts.ISTRUZIONE || parts.SITUAZIONE;
                    if (!cmd) return <p className="text-sm text-white leading-snug whitespace-pre-wrap font-medium">{analysis.content}</p>;
                    return (
                      <motion.div key={analysis.time}
                        initial={{ scale: 0.96, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                        className="rounded-xl px-3.5 py-3 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(124,58,237,0.10))', border: '1px solid rgba(16,185,129,0.35)', boxShadow: '0 0 24px rgba(16,185,129,0.18)' }}>
                        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(180deg, #10b981, #7c3aed)' }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/90 pl-1.5 mb-0.5">⚠️ Correggi</p>
                        <p className="text-[15px] font-black text-white leading-tight pl-1.5" style={{ letterSpacing: '-0.01em' }}>{cmd}</p>
                        {parts.BENE && <p className="mt-2 text-[12px] font-semibold text-emerald-300 pl-1.5 flex items-start gap-1.5"><span className="shrink-0">✅</span> <span><b className="uppercase text-[9px] tracking-wider opacity-80">Bene</b> · {parts.BENE}</span></p>}
                        {parts.PROVA && (() => {
                          const firstTech = parts.PROVA.split(/[→\-,· ]/)[0].trim();
                          const poseKey = resolvePose(firstTech);
                          return (
                            <div className="mt-1.5 rounded-lg px-1.5 py-1 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <div className="shrink-0" style={{ opacity: 0.92 }}>
                                <StickFigure poseKey={poseKey} color="#fbbf24" size={68} highlight scene={sceneFor(mode)} />
                              </div>
                              <p className="text-[12px] font-bold text-amber-200 flex items-start gap-1.5"><span className="shrink-0">🥊</span> <span><b className="uppercase text-[9px] tracking-wider opacity-80">Prova ora</b> · {parts.PROVA}</span></p>
                            </div>
                          );
                        })()}
                        {parts.VISTO && <p className="mt-1.5 text-[11px] text-emerald-200/80 pl-1.5 flex items-center gap-1.5"><Eye size={12} className="shrink-0" /> {parts.VISTO}</p>}
                        {parts.PERCHÉ && <p className="mt-0.5 text-[11px] text-violet-200/70 italic pl-1.5 flex items-center gap-1.5"><Lightbulb size={12} className="shrink-0" /> {parts.PERCHÉ}</p>}
                        {parts.PUNTO && <p className="mt-1 text-[11px] font-bold text-amber-300 pl-1.5 flex items-center gap-1.5"><Trophy size={12} className="shrink-0" /> {parts.PUNTO}</p>}
                        {/* 👍/👎 — etichetta il consiglio: alimenta il dataset dell'alveare */}
                        {sampleFeedback && (
                          <div className="mt-2.5 flex items-center gap-2 pl-1.5">
                            {sampleFeedback === 'up' || sampleFeedback === 'down' ? (
                              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                className="text-[11px] font-bold flex items-center gap-1"
                                style={{ color: sampleFeedback === 'up' ? '#34d399' : '#f87171' }}>
                                {sampleFeedback === 'up' ? <><ThumbsUp size={12} /> Salvato, grazie</> : <><ThumbsDown size={12} /> Annotato</>}
                              </motion.span>
                            ) : (
                              <>
                                <span className="text-[10px] text-gray-400">Consiglio giusto?</span>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => labelSample('up')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(16,185,129,0.4)' }} aria-label="Consiglio utile">
                                  <ThumbsUp size={13} className="text-emerald-300" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => labelSample('down')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.38)' }} aria-label="Consiglio sbagliato">
                                  <ThumbsDown size={13} className="text-red-300" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })()
                : <p className="text-xs font-bold" style={{ color: C.violet.hex, fontFamily: 'Orbitron, sans-serif' }}>Primo comando in arrivo…</p>
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* COMANDI principali */}
        <div className="px-3 pt-3 flex flex-col gap-2">
          {/* ── SPECCHIO: il tuo corpo vs l'ideale ──────────────────────────── */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setMirrorOn((v) => !v); if (!mirrorOn) { setSkeletonOn(true); unlockSpeech(); } }}
            className="w-full py-2.5 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2"
            style={mirrorOn
              ? { background: 'linear-gradient(135deg, #10b981, #0ea5e9)', boxShadow: '0 4px 18px rgba(14,165,233,0.4)' }
              : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            🪞 Specchio {mirrorOn ? 'ON' : 'OFF'}
          </motion.button>
          {mirrorOn && (() => {
            const sc = mirrorState?.score ?? 0;
            const scColor = sc >= 80 ? C.emerald.hex : sc >= 55 ? C.amber.hex : '#ef4444';
            const LBL = { guard: 'Guardia', jab: 'Jab', cross: 'Cross', hook: 'Gancio', uppercut: 'Montante', teep: 'Teep', roundhouse: 'Calcio', knee: 'Ginocchio', side_kick: 'Side kick', low_kick: 'Low kick', body_kick: 'Body kick', squat: 'Squat', pushup: 'Push-up', plank: 'Plank', lunge: 'Affondo', warrior: 'Warrior', tree: 'Albero', forward_fold: 'Piega', breathe: 'Respiro', run: 'Corsa', bridge: 'Ponte' };
            const chips = sceneFor(mode) === 'solo'
              ? ['squat', 'pushup', 'plank', 'lunge', 'warrior', 'tree', 'forward_fold', 'breathe']
              : ['guard', 'jab', 'cross', 'hook', 'uppercut', 'teep', 'roundhouse', 'knee'];
            const following = (guidedOn && (guidedPhase === 'running' || guidedPhase === 'ready')) || comboOn;
            return (
              <div className="rounded-2xl p-3 space-y-2.5" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.10))', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div className="flex items-center gap-3">
                  {/* anello punteggio */}
                  <div className="relative flex-shrink-0" style={{ width: 62, height: 62 }}>
                    <svg width={62} height={62} viewBox="0 0 62 62">
                      <circle cx={31} cy={31} r={26} fill="none" stroke="#1f2937" strokeWidth={6} />
                      <circle cx={31} cy={31} r={26} fill="none" stroke={scColor} strokeWidth={6} strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - sc / 100)}
                        transform="rotate(-90 31 31)" style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.2s' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-black" style={{ color: scColor }}>{sc}<span className="text-[9px]">%</span></span>
                    </div>
                  </div>
                  {/* figura target + nome */}
                  <div className="flex-shrink-0" style={{ opacity: 0.95 }}>
                    <StickFigure poseKey={mirrorTargetKey} color={C.emerald.hex} size={58} highlight scene={sceneFor(mode)} />
                  </div>
                  {/* correzioni */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-widest text-emerald-300/80">Rispecchi: <b className="text-emerald-200">{LBL[mirrorTargetKey] || mirrorTargetKey}</b></p>
                    {!mirrorState ? (
                      <p className="text-[11px] text-gray-400 mt-1">Inquadrati tutto e muoviti…</p>
                    ) : sc >= 82 ? (
                      <p className="text-[13px] font-bold text-emerald-300 mt-1">✓ Perfetto, tieni così!</p>
                    ) : mirrorState.hints?.length ? (
                      mirrorState.hints.map((h, i) => <p key={i} className="text-[12px] font-semibold text-red-300 mt-1 leading-snug">→ {h}</p>)
                    ) : (
                      <p className="text-[12px] text-amber-300 mt-1">Aggiusta i giunti rossi</p>
                    )}
                  </div>
                </div>
                {/* selettore tecnica (solo se non stai seguendo guidato/combo) */}
                {following ? (
                  <p className="text-[10px] text-center text-gray-400">Segue automaticamente l'esercizio in corso</p>
                ) : (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {chips.map((k) => (
                      <button key={k} onClick={() => setMirrorTech(k)}
                        className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 transition-all"
                        style={mirrorTech === k
                          ? { background: C.emerald.hex, color: '#0b0e14' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {LBL[k] || k}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-center text-emerald-300/60">🟢 giunto corretto · 🔴 da aggiustare — usa la fotocamera frontale (Gira)</p>
              </div>
            );
          })()}
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.93 }} onClick={captureAndAnalyze} disabled={analyzing}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all disabled:opacity-40 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 4px 18px ${C.violet.glow}` }}>
              <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', animation: 'chip-sheen 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />
              <span className="relative inline-flex items-center justify-center gap-1.5"><ScanSearch size={16} /> Analizza</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => { if (!autoMode && guidedOn) stopGuided(); setAutoMode((v) => !v); }}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={autoMode
                ? { background: `linear-gradient(135deg, ${C.orange.hex}, #b45309)`, boxShadow: `0 4px 18px ${C.orange.glow}` }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{autoMode ? <><Pause size={15} /> Stop Auto</> : <><Play size={15} /> Auto</>}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => guidedOn ? stopGuided() : startGuided()}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={guidedOn
                ? { background: 'linear-gradient(135deg, #10b981, #047857)', boxShadow: '0 4px 18px rgba(16,185,129,0.4)' }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{guidedOn ? <><X size={15} /> Esci</> : <><Target size={15} /> Guidato</>}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => comboOn ? stopCombo() : startCombo()}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={comboOn
                ? { background: 'linear-gradient(135deg, #dc2626, #9f1239)', boxShadow: '0 4px 18px rgba(220,38,38,0.5)' }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="inline-flex items-center justify-center gap-1.5">{comboOn ? <><X size={15} /> Stop</> : <>🥊 Combo</>}</span>
            </motion.button>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={flipCamera}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <FlipHorizontal2 size={14} /> Gira
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceOn((v) => { const nv = !v; if (nv) unlockSpeech(); else window.speechSynthesis?.cancel(); return nv; })}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={voiceOn
                ? { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 16px rgba(5,150,105,0.4)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Voce {voiceOn ? 'ON' : 'OFF'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVoiceSlow((v) => !v)}
              title={voiceSlow ? 'Voce lenta e scandita' : 'Voce a velocità normale'} aria-label="Velocità voce"
              className="px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center"
              style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {voiceSlow ? '🐢' : '🐇'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSkeletonOn((v) => !v)}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={skeletonOn
                ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.45)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Bone size={14} /> Scheletro
            </motion.button>
          </div>

          {/* ANALISI PROFONDA — appare dopo 3+ feedback */}
          <AnimatePresence>
            {sessionFeedbacksRef.current.length >= 3 && (
              <motion.button
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                whileTap={{ scale: 0.97 }} onClick={analyzeSession} disabled={analyzingSession}
                className="w-full py-3 rounded-xl text-white text-xs font-black transition-all disabled:opacity-40 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.35), rgba(16,185,129,0.2))', border: `1px solid ${C.emerald.border}`, color: C.emerald.hex }}>
                {analyzingSession ? '⏳ Analisi profonda in corso…' : `🧠 Analisi Profonda — cosa migliorare (${sessionFeedbacksRef.current.length} frame)`}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Session analysis modal */}
      <AnimatePresence>
        {sessionAnalysis && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setSessionAnalysis(null)}>
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: '#08090f', border: '1px solid rgba(20,184,166,0.25)', borderBottom: 'none' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black" style={{ color: C.emerald.hex, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>🧠 ANALISI SESSIONE</p>
                <button onClick={() => setSessionAnalysis(null)} className="text-gray-500 font-black text-lg leading-none">✕</button>
              </div>
              <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{sessionAnalysis.content}</p>
              {sessionAnalysis.provider && (
                <p className="text-[10px] font-mono mt-4" style={{ color: C.violet.hex, opacity: 0.6 }}>via {sessionAnalysis.provider} · {currentDisc?.label}</p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ── PAGELLA DI FINE SESSIONE ─────────────────────────────────────── */}
        {sessionReport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end"
            style={{ background: 'rgba(0,0,0,0.88)' }}
            onClick={() => !sessionReport.loading && setSessionReport(null)}>
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-h-[88vh] overflow-y-auto rounded-t-3xl p-5"
              style={{ background: '#08090f', border: '1px solid rgba(124,58,237,0.3)', borderBottom: 'none' }}
              onClick={(e) => e.stopPropagation()}>
              {sessionReport.loading ? (
                <div className="py-10 flex flex-col items-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full" style={{ border: `3px solid ${C.violet.hex}33`, borderTopColor: C.violet.hex }} />
                  <p className="text-sm font-bold text-white/80">Il Maestro sta valutando la sessione…</p>
                  <p className="text-[11px] text-gray-500">Salvo i progressi per la prossima volta</p>
                </div>
              ) : sessionReport.report && (() => {
                const R = sessionReport.report;
                const sc = R.score;
                const scColor = sc >= 80 ? C.emerald.hex : sc >= 60 ? C.amber.hex : sc >= 40 ? C.orange.hex : '#ef4444';
                return (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-black" style={{ color: C.violet.hex, fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>🥋 PAGELLA SESSIONE</p>
                      <button onClick={() => setSessionReport(null)} className="text-gray-500 font-black text-lg leading-none">✕</button>
                    </div>
                    {/* Voto + titolo */}
                    <div className="flex items-center gap-4 mb-4 mt-2">
                      <div className="relative flex-shrink-0" style={{ width: 78, height: 78 }}>
                        <svg width={78} height={78} viewBox="0 0 78 78">
                          <circle cx={39} cy={39} r={34} fill="none" stroke="#1f2937" strokeWidth={7} />
                          <motion.circle cx={39} cy={39} r={34} fill="none" stroke={scColor} strokeWidth={7} strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 34}
                            initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - sc / 100) }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            transform="rotate(-90 39 39)" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black" style={{ color: scColor }}>{sc}</span>
                          <span className="text-[8px] text-gray-500 -mt-0.5">/100</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-black text-white leading-tight">{R.title}</p>
                        <p className="text-[11px] mt-1" style={{ color: C.amber.hex }}>+{R.xp} XP · {currentDisc?.label}</p>
                        {R.coachNote && <p className="text-[11px] text-violet-200/80 italic mt-1 leading-snug">"{R.coachNote}"</p>}
                      </div>
                    </div>
                    {/* Punti di forza */}
                    {R.strengths?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1">✅ Punti di forza</p>
                        {R.strengths.map((s, i) => <p key={i} className="text-[12px] text-emerald-100/90 pl-1 leading-snug">· {s}</p>)}
                      </div>
                    )}
                    {/* Da correggere */}
                    {R.weaknesses?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/90 mb-1">⚠️ Da correggere</p>
                        {R.weaknesses.map((s, i) => <p key={i} className="text-[12px] text-orange-100/90 pl-1 leading-snug">· {s}</p>)}
                      </div>
                    )}
                    {/* Focus prossima sessione */}
                    {R.focusNext?.length > 0 && (
                      <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300 mb-1">🎯 La prossima volta</p>
                        {R.focusNext.map((s, i) => <p key={i} className="text-[12px] text-white/90 pl-1 leading-snug">· {s}</p>)}
                        {R.nextDrill && <p className="text-[12px] font-bold text-amber-200 mt-2 pl-1">🥊 Prova: {R.nextDrill}</p>}
                      </div>
                    )}
                    {/* Segreto da studiare */}
                    {R.techniqueSecret && (
                      <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">🥷 Segreto da studiare</p>
                        <p className="text-[12px] text-amber-100/90 pl-1 leading-snug">{R.techniqueSecret}</p>
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-center" style={{ color: C.violet.hex, opacity: 0.5 }}>salvato nell'alveare · migliorerai giorno dopo giorno</p>
                    <button onClick={() => setSessionReport(null)}
                      className="w-full mt-3 py-3 rounded-xl text-white text-sm font-black"
                      style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)` }}>Continua</button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'trainer',    label: 'PT',     icon: '🏅', color: C.amber   },
  { id: 'curriculum', label: 'Piano',  icon: '📚', color: C.violet  },
  { id: 'chat',       label: 'Chat',   icon: '💬', color: C.blue    },
  { id: 'visual',     label: 'Live',   icon: '📷', color: C.emerald },
];

export default function Coach() {
  const [tab, setTab] = useState('trainer');

  return (
    <div className="min-h-full text-white pb-8" style={{ background: '#030712' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: 'rgba(3,7,18,0.94)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Animated top border */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #00f2ff 30%, #a855f7 70%, transparent)', animation: 'frame-glow-shift 4s linear infinite', backgroundSize: '200% 100%' }} />

        <div className="relative px-4 pt-3 pb-3 max-w-2xl mx-auto overflow-hidden">
          {/* Ambient orbs */}
          <div className="absolute -top-6 -left-8 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,242,255,0.06) 0%, transparent 70%)', animation: 'drift-slow 8s ease-in-out infinite' }} />
          <div className="absolute -top-4 right-0 w-24 h-24 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)', animation: 'drift-slow 12s ease-in-out infinite reverse' }} />

          {/* Title row */}
          <div className="flex items-center justify-between mb-3 relative">
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none" style={{ fontFamily: 'Orbitron, sans-serif', background: 'linear-gradient(135deg, #ffffff 20%, #00f2ff 60%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ⚡ AI COACH
              </h1>
              <p className="text-[10px] mt-0.5 font-mono tracking-widest" style={{ color: '#374151' }}>GROQ SCOUT · COSMOS · GEMMA BRAIN · NVIDIA NIM</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'rgba(0,242,255,0.08)', color: '#00f2ff', border: '1px solid rgba(0,242,255,0.2)', animation: 'pulse-glow 2s ease-in-out infinite' }}>● SISTEMA ATTIVO</span>
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
                <span className="block text-[10px] tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px' }}>{t.label}</span>
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
            {tab === 'curriculum' && <CurriculumCoach />}
            {tab === 'chat'       && <CoachChat />}
            {tab === 'visual'     && <VisualCoach />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

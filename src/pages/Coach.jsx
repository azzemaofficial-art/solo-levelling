import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [voiceOn, setVoiceOn] = useState(false);
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
  const [sessionAnalysis, setSessionAnalysis] = useState(null);
  const [analyzingSession, setAnalyzingSession] = useState(false);

  // Precarica le voci appena disponibili (getVoices è asincrono su Chrome/Safari)
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

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
    utt.lang = 'it-IT'; utt.rate = 1.1; utt.pitch = 1;
    const itVoice = voicesRef.current.find((v) => v.lang === 'it-IT' || v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    utt.onend = advance;
    utt.onerror = advance;
    window.speechSynthesis.speak(utt);
    // Watchdog iOS Safari: se onend non scatta, avanza comunque dopo durata stimata
    setTimeout(advance, Math.min(15000, Math.max(3500, clean.length * 90)));
  }, [voiceOn]);
  speakNextRef.current = speakNext;

  // Accoda solo il TESTO per la voce. Cap a 2: evita backlog stantio in auto mode.
  const enqueueSpeak = useCallback((text) => {
    if (!text) return;
    speakQueueRef.current.push(text);
    if (speakQueueRef.current.length > 2) speakQueueRef.current = speakQueueRef.current.slice(-2);
    speakNext();
  }, [speakNext]);

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
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('live'); setAnalysis(null);
    await startCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    poseRef.current?.lm?.close();
    poseRef.current = null;
    timer.stop();
    if (analysis?.content) {
      const duration = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
      const updated = [{ date: new Date().toLocaleDateString('it-IT'), mode, context: sessionContext, keyFeedback: analysis.content.slice(0, 200), duration }, ...pastSessions].slice(0, 10);
      saveSessions(updated); setPastSessions(updated);
    }
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    setScore({ a: 0, b: 0 }); setLastPoint(null);
    setStep('setup');
    sessionFeedbacksRef.current = [];
    speakQueueRef.current = [];
    presentingRef.current = false;
    window.speechSynthesis?.cancel();
    setSessionAnalysis(null);
    clearInterval(autoTimerRef.current);
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
            const nose = result.landmarks[0][0];
            if (nose) setCentered(nose.x > 0.2 && nose.x < 0.8 && nose.y < 0.85 ? 'ok' : 'off');
          } else {
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
  }, [mode, buildPrompt, currentDisc, enqueueSpeak]);

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
      captureAndAnalyze();
      autoTimerRef.current = setInterval(captureAndAnalyze, 4000);
    } else { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

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
      {/* VIDEO — sfondo a tutto schermo */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={overlayRef} className="absolute pointer-events-none" style={{ opacity: skeletonOn ? 1 : 0 }} />

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
          {streaming && <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'rgba(16,185,129,0.25)', color: C.emerald.hex, border: `1px solid ${C.emerald.border}`, animation: 'pulse-glow 2s ease-in-out infinite' }}>● LIVE</span>}
          {autoMode && <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold" style={{ background: 'rgba(249,115,22,0.25)', color: C.orange.hex, border: `1px solid ${C.orange.border}`, animation: 'pulse-glow 1.2s ease-in-out infinite' }}>AUTO</span>}
          <motion.button whileTap={{ scale: 0.9 }} onClick={stopCamera}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
            style={{ background: 'rgba(185,28,28,0.55)', border: `1px solid ${C.red.border}`, color: '#fff' }}>
            ✕
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

      {/* BLOCCO INFERIORE — feedback + comandi, ancorato in basso (sempre visibile) */}
      <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 65%, rgba(0,0,0,0.55) 88%, transparent)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

        {/* SEZIONE COMMENTI AI — il comando RESTA visibile; l'analisi è solo un puntino */}
        <AnimatePresence>
          {(analysis || analyzing) && (
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
                {analysis?.time && <p className="text-[9px] font-mono flex-shrink-0" style={{ color: '#6b7280' }}>{analysis.time}</p>}
              </div>
              {analysis?.content
                ? <p className="text-sm text-white leading-snug whitespace-pre-wrap font-medium">{analysis.content}</p>
                : <p className="text-xs font-bold" style={{ color: C.violet.hex, fontFamily: 'Orbitron, sans-serif' }}>Primo comando in arrivo…</p>
              }
            </motion.div>
          )}
        </AnimatePresence>

        {/* COMANDI principali */}
        <div className="px-3 pt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.93 }} onClick={captureAndAnalyze} disabled={analyzing}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all disabled:opacity-40 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.violet.hex}, #4f46e5)`, boxShadow: `0 4px 18px ${C.violet.glow}` }}>
              <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', animation: 'chip-sheen 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />
              <span className="relative">🔍 Analizza</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={() => setAutoMode((v) => !v)}
              className="flex-1 py-3.5 rounded-xl text-white text-sm font-black transition-all relative overflow-hidden"
              style={autoMode
                ? { background: `linear-gradient(135deg, ${C.orange.hex}, #b45309)`, boxShadow: `0 4px 18px ${C.orange.glow}` }
                : { background: 'rgba(55,65,81,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {autoMode ? '⏸ Stop Auto' : '▶ Auto Analizza'}
            </motion.button>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={flipCamera}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              🔄 Gira
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setVoiceOn((v) => !v); if (voiceOn) window.speechSynthesis?.cancel(); }}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={voiceOn
                ? { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 16px rgba(5,150,105,0.4)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              🔊 Voce {voiceOn ? 'ON' : 'OFF'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSkeletonOn((v) => !v)}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={skeletonOn
                ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.45)' }
                : { background: 'rgba(55,65,81,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              🦴 Scheletro
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

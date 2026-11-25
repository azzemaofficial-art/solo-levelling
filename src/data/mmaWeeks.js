// L'MMA del mercoledì, settimana per settimana (25/11/2026: "ogni mercoledì mettimi già l'allenamento,
// incrementale, con i video YouTube; io premo il pulsante del coach e mi alleno").
// Settimane del piano da 16 (src/utils/planWeeks.js): oggi siamo alla 9. Progressione rivista da Fable:
// una tecnica nuova a settimana, ogni 4 un ripasso senza niente di nuovo, niente clinch né leve da solo.
// lesson = id in src/data/mmaPath.js (Coach Studio), combo = id in src/data/mmaCombos.js (combo con la camera:
// ogni ripetizione va sul server, lib/mmaTrain.js), video = chiave in src/data/exerciseVideos.js.
// rounds al posto della lezione nelle settimane di ripasso. phone: dove mettere il telefono quella settimana.
export const mmaWeeks = [
  { week: 9, title: 'Jab pulito', goal: 'Il jab parte dritto e torna per la stessa strada: è il colpo che apre tutto.', video: 'MMA · Jab', lesson: 'jab', combo: '1-2',
    tips: ['Espira corto su ogni jab: tss.', 'La mano dietro resta incollata alla guancia.', 'Torna in guardia prima del colpo dopo.'], phone: 'front' },
  { week: 10, title: 'Diretto e rotazione', goal: 'Il diretto parte dal piede dietro: tallone in fuori, anca, spalla, poi il braccio.', video: 'MMA · Diretto e rotazione', lesson: 'cross', combo: '1-1-2',
    tips: ['Ruota sulla punta del piede dietro.', 'Il mento resta dietro la spalla.', 'Prima lento e giusto, poi veloce.'], phone: 'side' },
  { week: 11, title: '1-2 col passo', goal: 'Unisci jab e diretto mentre ti muovi: entra col passo, esci di lato.', video: 'MMA · 1-2 col passo', lesson: 'one-two', combo: '1-2b',
    tips: ['Il passo e il jab arrivano insieme.', 'Al corpo scendi con le gambe, non con la schiena.', 'Dopo la combo esci a 45°.'], phone: 'side' },
  { week: 12, title: 'Ripasso: round di shadow', goal: 'Niente di nuovo: guardia, jab, diretto e passi in 3 round da 2 minuti.', video: 'MMA · Shadow', rounds: { rounds: 3, sec: 120 }, combo: '1-2',
    tips: ['Ogni colpo torna in guardia.', 'Respira nel minuto di pausa: 5 secondi dentro, 5 fuori.', 'Guardia alta anche quando sei stanco.'], phone: 'front' },
  { week: 13, title: 'Parata e risposta', goal: 'Para il jab con un tocco piccolo della mano dietro e rispondi subito con 1-2.', video: 'MMA · Parata', lesson: 'defense', combo: 'parry-1-2',
    tips: ['La parata è piccola: la mano non esce dal viso.', 'Rispondi appena hai parato.', 'Mai chiudere gli occhi.'], phone: 'front' },
  { week: 14, title: 'Schivata e diretto', goal: 'Sposta la testa fuori dalla linea piegando le ginocchia, poi rispondi col diretto.', video: 'MMA · Schivata', lesson: 'defense', combo: 'slip-2',
    tips: ['Piega le gambe, non solo il collo.', 'La testa esce di pochi centimetri.', 'Il diretto parte mentre rientri.'], phone: 'front' },
  { week: 15, title: 'Calcio frontale (teep)', goal: 'Il teep tiene lontano l’avversario: ginocchio su, spingi col tallone, torna in guardia.', video: 'MMA · Teep', lesson: 'kick', combo: 'teep-1-2',
    tips: ['Prima 10 a vuoto, poi al sacco leggero.', 'Basso, all’altezza della pancia: mai alto.', 'Le mani restano su mentre calci.'], phone: 'side' },
  { week: 16, title: 'Ripasso e prova', goal: 'La prova della tappa: 3 round da 2 minuti con la camera e la 1-2 sopra 80 di media.', video: 'MMA · Shadow', rounds: { rounds: 3, sec: 120 }, combo: '1-2',
    tips: ['Metti dentro tutto: jab, diretto, parata, schivata, teep.', 'Ogni round finisce in guardia.', 'Guarda i numeri della 1-2 della settimana 9: sei migliorato?'], phone: 'front' },
];

export const PHONE_TIP = {
  front: 'Telefono davanti a te, a 2–3 metri: si vedono guardia, distensione e ritorno.',
  side: 'Telefono di lato, a 2–3 metri, con i piedi dentro l’inquadratura: solo così il coach vede la rotazione.',
};

// sempre visibile nella card (revisione di Fable 25/11): ci si allena da soli, quindi prima la sicurezza
export const MMA_SAFETY = 'Fasce e guantoni al sacco, potenza al 50–60% nelle prime settimane, stop se senti dolore a polso, gomito o spalla.';

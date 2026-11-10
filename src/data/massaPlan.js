// Il piano «massa»: 3 sedute a corpo intero negli stessi giorni in cui si allena Emanuele.
// Martedì e sabato usano i suoi stessi esercizi, così si può fare allenamento insieme.
// Numeri dagli studi; divisione delle sedute e dosi esatte sono una scelta nostra.
const WARM = 'Riscaldamento', STRETCH = 'Stretching finale';
const rest = (day, detail) => ({ day, short: 'Riposo', type: 'recovery', duration: '—', detail });
const CUE = {
  panca: 'Gomiti a 45°, tricipite a terra un attimo, poi spingi senza rimbalzare.',
  sbarra: 'Scapole giù prima di tirare, petto verso la sbarra. Meno di 3? Negative da 4 secondi.',
  remo: 'Schiena piatta, gomito verso l’anca, giù lento fino in fondo.',
  bulgaro: 'Piede dietro su sedia o gradino, busto appena avanti. Spingi col tallone davanti.',
  stacco: 'Anche indietro, schiena piatta, manubri vicino alle gambe. Senti il dietro coscia che tira.',
  spinte: 'Addome stretto, schiena ferma. Manubri su e leggermente avanti.',
  piedi: 'Piedi su sedia, corpo dritto come una tavola. Scendi lento.',
  polpacci: 'Giù lento fino in fondo, pausa, poi su fino alla punta.',
};

export const massaTrainingDays = [
  rest('Lunedì', 'Oggi il muscolo cresce: mangia tutto il piano, cammina se ti va.'),
  { day: 'Martedì', short: 'Forza A', type: 'strength', duration: '≈ 45 min', detail: 'Tutto il corpo, con più parte alta. 8 esercizi su 10 sono quelli di Emanuele: se ci siete tutti e due, allenatevi insieme.', exercises: [
    ['Riscaldamento parte alta', '6 min', { block: WARM, light: true, cue: 'Segui il video, poi 1 serie leggera di piegamenti e 1 di rematore.' }],
    ['Distensioni a terra manubri', '3 × 8–15', { block: 'Superserie 1', light: true, cue: CUE.panca }],
    ['Trazioni', '3 × 3–8', { block: 'Superserie 1', light: true, cue: CUE.sbarra }],
    ['Rematore a un braccio', '3 × 10–15 / lato', { block: 'Superserie 2', cue: CUE.remo }],
    ['Alzate laterali', '2 × 12–20', { block: 'Superserie 2', cue: 'Spalle basse, gomiti appena piegati: sali fino all’altezza delle spalle.' }],
    ['Estensioni tricipiti sopra la testa', '2 × 10–15', { block: 'Superserie 3', cue: 'Gomiti stretti e fermi, scendi dietro la testa senza inarcare.' }],
    ['Curl bicipiti', '2 × 10–15', { block: 'Superserie 3', cue: 'Gomiti incollati ai fianchi, niente slancio, giù in 2–3 secondi.' }],
    ['Affondo bulgaro', '2 × 8–12 / lato', { block: 'Superserie 4', light: true, cue: CUE.bulgaro }],
    ['Stacco rumeno manubri', '2 × 10–15', { block: 'Superserie 4', cue: CUE.stacco }],
    ['Stretching finale parte alta', '5 min', { block: STRETCH, light: true, cue: 'Ti rilassa e tiene la mobilità. Non toglie i dolori: gli studi lo escludono.' }],
  ] },
  rest('Mercoledì', 'Riposo vero. Se Emanuele va al sacco e ti va, 15 minuti di tecnica leggera.'),
  { day: 'Giovedì', short: 'Forza C', type: 'strength', duration: '≈ 45 min', detail: 'La seduta in più, tutta tua: Emanuele oggi ha il calcio. Gambe per prime, quando sei fresco.', exercises: [
    ['Riscaldamento gambe', '6 min', { block: WARM, light: true, cue: 'Segui il video, poi 1 serie leggera di affondo per lato.' }],
    ['Affondo bulgaro', '3 × 8–12 / lato', { block: 'Superserie 1', light: true, cue: CUE.bulgaro }],
    ['Spinte spalle manubri', '3 × 8–12', { block: 'Superserie 1', light: true, cue: CUE.spinte }],
    ['Stacco rumeno manubri', '3 × 10–15', { block: 'Superserie 2', cue: CUE.stacco }],
    ['Rematore a un braccio', '2 × 10–15 / lato', { block: 'Superserie 2', cue: CUE.remo }],
    ['Piegamenti piedi rialzati', '3 × 8–20', { block: 'Superserie 3', light: true, cue: CUE.piedi }],
    ['Curl bicipiti', '2 × 10–15', { block: 'Superserie 3', cue: 'Gomiti incollati ai fianchi, niente slancio, giù in 2–3 secondi.' }],
    ['Polpacci su gradino', '3 × 12–20 / lato', { block: 'Polpacci', cue: CUE.polpacci }],
    ['Stretching finale gambe', '5 min', { block: STRETCH, light: true, cue: 'Ti rilassa e tiene la mobilità. Non toglie i dolori: gli studi lo escludono.' }],
  ] },
  rest('Venerdì', 'Riposo: domani si chiude la settimana. Non saltare i pasti.'),
  { day: 'Sabato', short: 'Forza B', type: 'strength', duration: '≈ 45 min', detail: 'Tutto il corpo, con più gambe. Stessi esercizi di Emanuele: se ci siete tutti e due, allenatevi insieme.', exercises: [
    ['Riscaldamento gambe', '6 min', { block: WARM, light: true, cue: 'Segui il video, poi 1 serie leggera di affondo per lato.' }],
    ['Affondo bulgaro', '3 × 8–12 / lato', { block: 'Superserie 1', light: true, cue: CUE.bulgaro }],
    ['Piegamenti piedi rialzati', '3 × 8–20', { block: 'Superserie 1', light: true, cue: CUE.piedi }],
    ['Stacco rumeno manubri', '2 × 10–15', { block: 'Superserie 2', light: true, cue: CUE.stacco }],
    ['Trazioni presa inversa', '3 × 3–8', { block: 'Superserie 2', cue: 'Palmi verso di te, scapole giù, mento sopra la sbarra.' }],
    ['Spinte spalle manubri', '2 × 8–12', { block: 'Superserie 3', cue: CUE.spinte }],
    ['Polpacci su gradino', '2 × 12–20 / lato', { block: 'Superserie 3', cue: CUE.polpacci }],
    ['Nordic curl', '2 × 4–6', { block: 'Femorali', cue: 'Ginocchia ferme, scendi più lento che puoi, poi aiutati con le mani per risalire.' }],
    ['Stretching finale gambe', '5 min', { block: STRETCH, light: true, cue: 'Ti rilassa e tiene la mobilità. Non toglie i dolori: gli studi lo escludono.' }],
  ] },
  rest('Domenica', 'Riposo e pasto dalla mamma. Domani pesati a digiuno, se è il giorno giusto.'),
];

const LAST_WEEK_OF_PHASE = [4, 7, 8, 15, 16];
export const massaPhases = [
  { weeks: '1–4', name: 'Primo arco', art: '/manga/arco-1.webp', detail: '2 giri per superserie e 3 ripetizioni di margine: impari gli esercizi senza dolori che ti fermano.' },
  { weeks: '5–7', name: 'Costruzione', art: '/manga/arco-2.webp', detail: 'Tutti i giri, 1–2 ripetizioni di margine. Arrivi in cima alle ripetizioni in ogni serie? Aumenta il carico.' },
  { weeks: '8', name: 'Scarico', art: '/manga/arco-3.webp', detail: '2 giri e 3 ripetizioni di margine: una settimana facile per assorbire il lavoro.' },
  { weeks: '9–15', name: 'Spinta', art: '/manga/arco-4.webp', detail: 'I 20 kg non bastano più? Vai a 15–30 ripetizioni e chiudi a 0–1 di margine: con carichi leggeri conta arrivare vicino al limite.' },
  { weeks: '16', name: 'Il bilancio', art: '/manga/arco-5.webp', detail: '2 giri e riprova i massimi di trazioni e piegamenti: guarda quanto sei salito da quando hai iniziato.' },
];
export const massaPhaseOf = (weekIndex) => massaPhases[Math.max(0, LAST_WEEK_OF_PHASE.findIndex((last) => weekIndex < last))];

export const massaRules = [
  'Pesati 3–4 mattine a settimana e guarda la media: conta quella, non il singolo giorno.',
  'Obiettivo 0,2–0,3 kg a settimana. Sotto 0,1 per due settimane? Aggiungi un Extra massa.',
  'Sopra 0,4 kg a settimana per due settimane? Togli un Extra massa: oltre si mette soprattutto grasso.',
  'Prima i piatti, poi lo spuntino: se un pasto non ti piace, cambialo tra le alternative invece di saltarlo.',
  'Proteine già comprese nei piatti: non servono altri shake oltre a quello dopo i pesi.',
  'Dormi 7–9 ore: il muscolo si costruisce quando riposi.',
];

// Il suo primo lunedì coincide con la settimana 7 di Emanuele: stessi piatti negli stessi giorni.
export const MASSA_START = new Date(2026, 10, 9);
export const massaWeeksSince = (now = new Date()) => Math.max(0, Math.floor((now - MASSA_START) / (7 * 864e5)));
export const massaWeekIndex = (now = new Date(), total = 10) => massaWeeksSince(now) % total;

export const massaEvidence = [
  { label: 'Helms 2023: surplus piccolo, meno grasso e stesso muscolo', url: 'https://pubmed.ncbi.nlm.nih.gov/37914977/' },
  { label: 'Iraki 2019: quanto mangiare per mettere massa', url: 'https://pubmed.ncbi.nlm.nih.gov/31247944/' },
  { label: 'Morton 2018: proteine, oltre 1,6 g/kg il guadagno si ferma', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/' },
  { label: 'Schoenfeld 2017: più serie a settimana, più muscolo', url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/' },
  { label: 'Schoenfeld 2019: a volume uguale la frequenza non cambia', url: 'https://pubmed.ncbi.nlm.nih.gov/30558493/' },
  { label: 'Schoenfeld 2017: carichi leggeri e pesanti fanno crescere', url: 'https://pubmed.ncbi.nlm.nih.gov/28834797/' },
];

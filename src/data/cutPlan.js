export const profile = {
  name: 'Emanuele', age: 23, heightCm: 185, startWeightKg: 86.45,
  targetWeightKg: 83, startWaistCm: 92, footballDays: [1, 4],
};

export const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const dayTargets = [2450, 2300, 2300, 2450, 2300, 2450, 2350];
export const nutritionRules = [
  'Partenza indicativa: 2.300–2.450 kcal in base alla giornata. Le porzioni sono una guida, non un obbligo matematico.',
  'Proteine: circa 155–170 g al giorno, distribuite tra i pasti. Verdura e frutta: almeno 400 g; fibra: almeno 25 g.',
  'Pesa al mattino 3–4 volte a settimana e guarda la media. Se dopo 3 settimane peso e vita non scendono, riduci di circa 100–150 kcal o aumenta il movimento quotidiano.',
  'Nei giorni di calcio tieni più carboidrati prima e dopo la sessione. Non compensare la pizza o il McDonald’s saltando i pasti.',
  'Per il pesce crudo scegli un esercizio affidabile che gestisca correttamente la sicurezza del prodotto.',
  'Tieni l’acqua a portata di mano durante il lavoro. Parti da circa 2 litri al giorno e bevi di più quando sudi durante il calcio.',
  'Prova ad avvicinarti a 8 ore di sonno quando aggiungi sprint e pesi: la qualità delle sedute dipende dal recupero.',
];

const breakfasts = [
  'Overnight oats: skyr 250 g, avena 60 g, frutti di bosco, 15 g pistacchi',
  'Waffle fit: 2 uova, yogurt greco 170 g, farina d’avena 60 g, crema 100% pistacchio 15 g',
  'Toast salato: pane integrale 100 g, 2 uova, ricotta magra 100 g, pomodoro',
  'Bowl tiramisù: skyr 250 g, avena 55 g, caffè, cacao, banana',
  'Piadina colazione: piadina integrale, fesa di tacchino 100 g, fiocchi di latte 100 g',
  'French toast: pane 100 g, 2 uova, yogurt 150 g, fragole',
  'Yogurt bowl croccante: greco 250 g, muesli senza zuccheri aggiunti 60 g, kiwi, noci 15 g',
];
const breakfastImages = ['oats-berries', 'pistachio-waffle', 'egg-ricotta-toast', 'tiramisu-oats', 'turkey-breakfast-wrap', 'french-toast', 'kiwi-yogurt-bowl'];
const lunches = [
  'Rice bowl: riso 100 g crudo, pollo 170 g, zucchine, olio EVO 10 g',
  'Pasta leggera: pasta 90 g cruda, tonno al naturale 140 g, pomodorini e rucola',
  'Cous cous: 95 g crudo, ceci 150 g cotti, feta 60 g, peperoni',
  'Poke: riso 100 g crudo, salmone idoneo al consumo crudo 150 g, edamame 100 g, verdure',
  'Wrap smash: 2 tortillas, macinato magro 160 g, lattuga, salsa yogurt',
  'Insalata di farro: farro 100 g crudo, sgombro 120 g, fagioli 100 g cotti, verdure',
  'Pasta al pesto leggero: pasta 90 g cruda, pesto 20 g, pollo 150 g, fagiolini',
];
const lunchImages = ['chicken-rice-bowl', 'tuna-pasta', 'chickpea-couscous', 'salmon-poke', 'smash-wrap', 'farro-mackerel', 'pesto-chicken-pasta'];
const dinners = [
  'Burger plate: burger magro 180 g, patate al forno 350 g, insalata, salsa yogurt',
  'Salmone 180 g, riso 80 g crudo, broccoli e limone',
  'Pollo croccante al forno 200 g, pane 90 g, verdure e salsa allo yogurt',
  'Poke casalinga: tonno cotto 170 g, riso 90 g crudo, avocado 60 g, carote',
  'Tacos fit: tortillas 2, tacchino 180 g, fagioli 120 g cotti, verdure',
  'Frittata: 3 uova, pane 100 g, spinaci e insalata',
  'Bistecca magra 180 g, patate 300 g, verdure grigliate e olio EVO 10 g',
];
const dinnerImages = ['smash-burger', 'salmon-rice', 'crispy-chicken-plate', 'tuna-poke', 'turkey-tacos', 'spinach-frittata', 'steak-potatoes'];
const snacks = [
  'Salato: skyr salato 170 g con cracker integrali 50 g',
  'Panino piccolo 80 g con bresaola 80 g e rucola',
  'Hummus 80 g, carote e 2 gallette; aggiungi un frutto',
  'Fiocchi di latte 200 g, pomodorini e pane 50 g',
  'Edamame 150 g e un frutto',
  'Yogurt greco 170 g, cacao e 15 g pistacchi',
  'Toast 70 g con tacchino 80 g',
];
const snackImages = ['skyr-crackers', 'bresaola-sandwich', 'hummus-carrots', 'cottage-cheese-toast', 'edamame-fruit', 'cocoa-yogurt', 'turkey-toast'];
const weeklyRotation = [
  [0, 1, 2, 3, 4, 5, 6],
  [3, 2, 5, 0, 6, 4, 1],
  [6, 4, 1, 5, 0, 2, 3],
  [2, 5, 3, 6, 1, 0, 4],
];

// Lunedì fisso (abitudine di Emanuele): cracker a metà mattina, 2 piadine tacchino e mozzarella
// light a pranzo, pre-calcio, pollo a cena.
const MONDAY_LUNCH = '2 piadine con tacchino e mozzarella light: 2 piadine, fesa di tacchino 140 g, mozzarella light 70 g, pomodoro e rucola';
const MONDAY_SNACK = 'Spuntino di metà mattina: cracker integrali 30 g';
const MONDAY_DINNER = 'Pollo alla piastra 200 g, riso 90 g crudo, verdure grigliate e olio EVO 10 g';
// Nei giorni di calcio (lun, gio) lo spuntino pre-partita è un pasto vero, contato nel totale.
export const PRE_FOOTBALL = 'Pre-calcio: banana + 2 fette di pane con miele';

export const mealWeeks = weeklyRotation.map((rotation, weekIndex) => rotation.map((n, day) => {
  const dinnerIndex = (n + weekIndex) % dinners.length;
  const lunchIndex = (n + weekIndex) % lunches.length;
  const snackIndex = (n + day) % snacks.length;
  const mondaySnack = day === 0;
  const special = day === 2 ? 'McDonald’s: scegli il panino che ti piace, porzione piccola/media di patatine e bevanda senza zuccheri; registra il pasto reale.'
    : day === 6 ? 'Pizza a scelta + contorno o insalata. Mangiala senza compensazioni punitive.'
      : day === 0 ? MONDAY_DINNER : dinners[dinnerIndex];
  return {
    day: dayNames[day], target: dayTargets[day],
    breakfast: breakfasts[n],
    lunch: day === 0 ? MONDAY_LUNCH : day === 5 ? 'Pasta bianca 100 g cruda con olio EVO 10 g + carne di cavallo 170–200 g + verdure' : lunches[lunchIndex],
    preFootball: day === 0 || day === 3 ? PRE_FOOTBALL : null,
    snack: mondaySnack ? MONDAY_SNACK : snacks[snackIndex],
    snackTime: mondaySnack ? 'morning' : 'afternoon',
    dinner: special,
    images: {
      Colazione: `/recipes/${breakfastImages[n]}.jpg`,
      Pranzo: `/recipes/${day === 0 ? 'turkey-breakfast-wrap' : day === 5 ? 'white-pasta-horse-steak' : lunchImages[lunchIndex]}.jpg`,
      Spuntino: `/recipes/${mondaySnack ? 'skyr-crackers' : snackImages[snackIndex]}.jpg`,
      Cena: `/recipes/${day === 0 ? 'chicken-rice-bowl' : day === 2 ? 'burger-fries' : day === 6 ? 'pizza' : dinnerImages[dinnerIndex]}.jpg`,
    },
    note: day === 0 || day === 3 ? 'Calcio la sera: il pre-calcio va 1–2 ore prima della partita; la cena dopo, con proteine e carboidrati per recuperare.'
      : day === 5 ? 'Se esci: alterna ogni cocktail con acqua. 3–4 cocktail possono incidere molto su calorie, sonno e recupero; ridurne il numero aiuta.'
        : day === 2 ? 'Il pranzo resta leggero per lavorare bene nel pomeriggio.'
          : day === 6 ? 'La pizza è già prevista nel piano.' : '',
  };
}));

export const recipes = [
  { title: 'Smash burger fit', tag: 'Cena • 20 min', image: '/recipes/smash-burger.jpg', ingredients: 'Burger magro 180 g, bun 90 g, cheddar 20 g, lattuga, pomodoro, salsa yogurt.', steps: 'Scotta il burger su piastra rovente, aggiungi cheddar; tosta il bun e monta con verdure e salsa. Servi con patate al forno.' },
  { title: 'Waffle al pistacchio', tag: 'Colazione • 15 min', image: '/recipes/pistachio-waffle.jpg', ingredients: '2 uova, farina d’avena 60 g, yogurt greco 170 g, crema 100% pistacchio 15 g.', steps: 'Mescola uova e farina, cuoci nella piastra. Completa con yogurt e pistacchio. Frutta a lato.' },
  { title: 'Crispy chicken wrap', tag: 'Pranzo • 20 min', image: '/recipes/crispy-wrap.jpg', ingredients: 'Pollo 180 g, piadina integrale, cornflakes non zuccherati 25 g, yogurt, paprika, insalata.', steps: 'Impana il pollo nei cornflakes e cuoci in forno o friggitrice ad aria. Chiudi nella piadina con yogurt e insalata.' },
  { title: 'Tiramisù overnight', tag: 'Colazione • 5 min', image: '/recipes/tiramisu-oats.jpg', ingredients: 'Skyr 250 g, avena 55 g, caffè, cacao amaro, banana.', steps: 'Alterna strati di avena bagnata nel caffè e skyr. Frigo tutta la notte, cacao e banana al mattino.' },
];

export const trainingDays = [
  { day: 'Lunedì', short: 'Calcio', type: 'football', duration: '60 min', detail: 'Seduta fissa. Dopo: cena con carboidrati e proteine.' },
  { day: 'Martedì', short: 'Forza A', type: 'strength', duration: '30–40 min', detail: 'Parte alta + core. Gambe leggere dopo il calcio.', exercises: [
    ['Piegamenti o distensioni manubri su panca', '3 × 8–12'], ['Trazioni assistite o negative controllate', '3 × 2–5'],
    ['Rematore manubrio', '3 × 10–12 / lato'], ['Affondi indietro leggeri', '2 × 8 / lato'], ['Spinte spalle manubri', '2 × 8–12'], ['Plank', '2 × 30–45 s'],
  ] },
  { day: 'Mercoledì', short: 'Bag / recupero', type: 'optional', duration: '15–25 min', detail: 'Opzionale: tecnica al sacco, senza sparring, o camminata e mobilità. Se stanco, riposo.' , exercises: [
    ['Footwork e guardia', '3 × 2 min'], ['Jab–cross al sacco, tecnica', '3 × 2 min'], ['Mobilità anche e caviglie', '6 min'],
  ] },
  { day: 'Giovedì', short: 'Calcio', type: 'football', duration: '60 min', detail: 'Seduta fissa. Nessun lavoro pesante per le gambe prima.' },
  { day: 'Venerdì', short: 'Scarico', type: 'recovery', duration: '20 min', detail: 'Camminata facile, mobilità o riposo completo.' },
  { day: 'Sabato', short: 'Velocità + Forza B', type: 'strength', duration: '40–50 min', detail: 'Sprint brevi prima dei pesi; interrompi se la velocità cala o senti dolore.', exercises: [
    ['Riscaldamento dinamico + 3 progressioni', '8–10 min'], ['Accelerazioni 10–20 m', '4–6 rip., recupero 90–120 s'],
    ['Goblet squat', '3 × 8–12'], ['Stacco rumeno manubri', '3 × 8–12'], ['Affondi indietro', '2 × 8 / lato'],
    ['Distensioni manubri su panca', '2 × 8–12'], ['Rematore manubri', '2 × 10–12'],
  ] },
  { day: 'Domenica', short: 'Riposo', type: 'recovery', duration: '—', detail: 'Passeggiata facile se ti va. Preparati per il calcio del lunedì.' },
];

export const phases = [
  { weeks: '1–2', name: 'Rientro', detail: '2 serie per esercizio, tecnica pulita, lascia 3–4 ripetizioni di margine. Sabato 3–4 accelerazioni al 70–80% o solo tecnica se indolenzito.' },
  { weeks: '3–4', name: 'Base', detail: 'Passa alle serie indicate. Lascia 2–3 ripetizioni di margine. Sabato 4 accelerazioni brevi, recupero completo.' },
  { weeks: '5–8', name: 'Costruzione', detail: 'Aumenta reps o carico quando completi tutte le serie con tecnica buona. Sabato 4–6 accelerazioni; una settimana più leggera se la fatica sale.' },
  { weeks: '9–12', name: 'Consolidamento', detail: 'Mantieni 2 sedute di forza e 2 di calcio. Sprint di qualità, poche ripetizioni. Ultima settimana più facile e confronta peso medio, vita, piegamenti, trazioni.' },
];

export const evidence = [
  { label: 'Alimentazione varia, frutta, verdura e fibra', url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' },
  { label: 'Proteine e preservazione della massa magra nel cut', url: 'https://pubmed.ncbi.nlm.nih.gov/25014731/' },
  { label: 'Deficit moderato e allenamento di forza', url: 'https://pubmed.ncbi.nlm.nih.gov/34623696/' },
  { label: 'Forza almeno 2 giorni a settimana', url: 'https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf' },
  { label: 'Video esercizi NHS', url: 'https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan-how-to-videos/' },
  { label: 'Alcol e salute', url: 'https://www.who.int/en/news-room/fact-sheets/detail/alcohol' },
];

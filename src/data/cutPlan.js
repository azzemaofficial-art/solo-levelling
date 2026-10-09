import { mealRecipes } from './mealRecipes.js';

export const profile = {
  name: 'Emanuele', age: 23, heightCm: 185, startWeightKg: 86.45,
  targetWeightKg: 83, startWaistCm: 92, footballDays: [1, 4],
};

export const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
// Lun e gio calcio (21:30–23:00, l’Apple Watch dice ~1.600 kcal ma nel calcio sovrastima: contiamo ~900–1.000);
// venerdì con 3–4 cocktail contati (~750 kcal); sabato e domenica latte e Gocciole; domenica pizza.
export const dayTargets = [2750, 2250, 2300, 2750, 2550, 2500, 2550];
export const nutritionRules = [
  'Partenza indicativa: 2.300–2.450 kcal in base alla giornata. Le porzioni sono una guida, non un obbligo matematico.',
  'Proteine: circa 155–170 g al giorno, distribuite tra i pasti. Verdura e frutta: almeno 400 g; fibra: almeno 25 g.',
  'Pesa al mattino 3–4 volte a settimana e guarda la media. Se dopo 3 settimane peso e vita non scendono, riduci di circa 100–150 kcal o aumenta il movimento quotidiano.',
  'Nei giorni di calcio (21:30–23:00) i carboidrati vanno soprattutto nella cena delle 18:45 e nello spuntino pre-partita; dopo, shake di proteine e qualcosa di leggero. Non compensare pizza, McDonald’s o cocktail saltando i pasti.',
  'Proteine in polvere (le tue, gusto chocowafer) solo dove servono: lo shake dopo il calcio e un misurino nel latte del weekend con le Gocciole. Negli altri pasti le proteine arrivano da skyr, albumi, yogurt, carne e pesce.',
  'Le calorie dell’Apple Watch negli sport a scatti come il calcio sono sovrastimate: per capire se mangi abbastanza guarda la media del peso della settimana, non il numero dell’orologio.',
  'Per il pesce crudo scegli un esercizio affidabile che gestisca correttamente la sicurezza del prodotto.',
  'Tieni l’acqua a portata di mano durante il lavoro. Parti da circa 2 litri al giorno e bevi di più quando sudi durante il calcio.',
  'Prova ad avvicinarti a 8 ore di sonno quando aggiungi sprint e pesi: la qualità delle sedute dipende dal recupero.',
];

// Pasti del menu: id → [testo esatto (= chiave della ricetta in mealRecipes.js), foto in /public/recipes].
// Le foto nuove le prepara Emanuele con ChatGPT (vedi docs/immagini-ricette.md): finché manca
// il file, la pagina mostra un'icona al posto della foto.
const M = {
  // colazioni dei giorni feriali (14: ognuna torna dopo almeno 2 settimane e mezzo)
  oats: ['Overnight oats: skyr 250 g, avena 60 g, frutti di bosco, 15 g pistacchi', 'oats-berries'],
  waffle: ['Waffle fit: 2 uova, yogurt greco 170 g, farina d’avena 60 g, crema 100% pistacchio 15 g', 'pistachio-waffle'],
  toast: ['Toast salato: pane integrale 100 g, 2 uova, ricotta magra 100 g, pomodoro', 'egg-ricotta-toast'],
  piadina: ['Piadina colazione: piadina integrale, fesa di tacchino 100 g, fiocchi di latte 100 g', 'turkey-breakfast-wrap'],
  french: ['French toast: pane 100 g, 2 uova, yogurt 150 g, fragole', 'french-toast'],
  yogurtBowl: ['Yogurt bowl croccante: greco 250 g, muesli senza zuccheri aggiunti 60 g, kiwi, noci 15 g', 'kiwi-yogurt-bowl'],
  b_pancake: ['Pancake alla banana: avena 50 g, 1 uovo, albume 150 g, banana, yogurt greco 100 g, frutti di bosco', 'protein-pancakes'],
  b_toastPB: ['Toast burro d’arachidi e banana: pane integrale 70 g, burro d’arachidi 15 g, banana, skyr 200 g', 'pb-banana-toast'],
  b_choco: ['Overnight oats al cioccolato: avena 60 g, latte 150 ml, skyr 150 g, cacao, lamponi, miele', 'chocolate-oats'],
  b_bagel: ['Bagel salmone e cipollotto: bagel 90 g, salmone affumicato 60 g, spalmabile light 40 g, cipollotto, skyr 150 g con miele', 'salmon-bagel'],
  b_omelette: ['Omelette cipollotto e feta: 3 uova, feta 30 g, cipollotto, pane integrale 60 g, pomodorini', 'scallion-omelette'],
  b_mango: ['Smoothie bowl al mango: skyr 300 g, mango 150 g, banana, granola 30 g, cocco', 'mango-smoothie-bowl'],
  b_porridge: ['Porridge mela e cannella: avena 60 g, latte 200 ml, skyr 150 g, mela, noci 10 g', 'apple-porridge'],
  b_sweetPancake: ['Pancake alla patata dolce: patata dolce cotta 100 g, avena 40 g, 1 uovo, albume 120 g, yogurt greco 100 g, sciroppo d’acero', 'sweet-potato-pancakes'],
  // colazione fissa di sabato e domenica
  b_gocciole: ['Latte e Gocciole: latte scremato 250 ml con proteine 25 g e 12 Gocciole', 'milk-gocciole'],
  // pranzi
  riceBowl: ['Rice bowl: riso 100 g crudo, pollo 170 g, zucchine, olio EVO 10 g', 'chicken-rice-bowl'],
  pastaTonno: ['Pasta leggera: pasta 90 g cruda, tonno al naturale 140 g, pomodorini e rucola', 'tuna-pasta'],
  couscous: ['Cous cous: 95 g crudo, ceci 150 g cotti, feta 60 g, peperoni', 'chickpea-couscous'],
  poke: ['Poke: riso 100 g crudo, salmone idoneo al consumo crudo 150 g, edamame 100 g, verdure', 'salmon-poke'],
  wrapSmash: ['Wrap smash: 2 tortillas, macinato magro 160 g, lattuga, salsa yogurt', 'smash-wrap'],
  farro: ['Insalata di farro: farro 100 g crudo, sgombro 120 g, fagioli 100 g cotti, verdure', 'farro-mackerel'],
  pesto: ['Pasta al pesto leggero: pasta 90 g cruda, pesto 20 g, pollo 150 g, fagiolini', 'pesto-chicken-pasta'],
  l_sweetBowl: ['Bowl patata dolce e pollo: patate dolci 250 g, pollo 160 g, avocado 50 g, spinacino, salsa yogurt e lime', 'sweet-potato-chicken-bowl'],
  l_beefNoodles: ['Noodles saltati al manzo: noodles di riso 80 g, manzo magro 150 g, peperoni, carote e cipollotto, olio di sesamo 8 g', 'beef-noodles'],
  l_venere: ['Riso venere, gamberi ed edamame: riso venere 80 g, gamberi 150 g, edamame 80 g, avocado 40 g, cetriolo, sesamo', 'black-rice-shrimp'],
  l_crispyBun: ['Panino pollo croccante: pane 100 g, pollo 150 g in panko, cavolo rosso, salsa yogurt e sriracha', 'crispy-chicken-sandwich'],
  l_coldPasta: ['Pasta fredda tonno e cipollotto: pasta 90 g, tonno al naturale 140 g, mais 50 g, pomodorini, cipollotto, olio EVO 10 g', 'cold-tuna-pasta'],
  l_burrito: ['Burrito bowl al tacchino: riso 80 g, macinato di tacchino 160 g, fagioli neri 100 g, mais, pico de gallo, yogurt greco, avocado', 'turkey-burrito-bowl'],
  l_gyudon: ['Gyudon: riso 90 g, manzo magro a fettine 150 g, cipolla, 1 uovo, soia e mirin, cipollotto', 'gyudon'],
  l_salad: ['Insalatona di pollo: pollo 180 g, insalata mista, avocado 40 g, mais 40 g, pane 40 g, olio EVO 5 g', 'chicken-salad'],
  // spuntini
  skyrSalato: ['Salato: skyr salato 170 g con cracker integrali 50 g', 'skyr-crackers'],
  bresaola: ['Panino piccolo 80 g con bresaola 80 g e rucola', 'bresaola-sandwich'],
  hummus: ['Hummus 80 g, carote e 2 gallette; aggiungi un frutto', 'hummus-carrots'],
  fiocchi: ['Fiocchi di latte 200 g, pomodorini e pane 50 g', 'cottage-cheese-toast'],
  edamame: ['Edamame 150 g e un frutto', 'edamame-fruit'],
  yogurtCacao: ['Yogurt greco 170 g, cacao e 15 g pistacchi', 'cocoa-yogurt'],
  toastTacchino: ['Toast 70 g con tacchino 80 g', 'turkey-toast'],
  s_skyrFruit: ['Skyr 170 g e un frutto', 'skyr-fruit'],
  s_pudding: ['Budino di skyr al cacao: skyr 200 g, cacao, miele, fondente 10 g', 'chocolate-skyr-pudding'],
  // cene
  d_teriyaki: ['Pollo teriyaki: pollo 200 g, riso 80 g, broccoli, salsa teriyaki fatta in casa, sesamo e cipollotto', 'chicken-teriyaki'],
  d_bibimbap: ['Bibimbap: riso 80 g, manzo magro 130 g, 1 uovo, spinaci, carote, zucchine, gochujang, olio di sesamo', 'bibimbap'],
  d_miso: ['Salmone al miso: salmone 180 g, patate dolci 250 g al forno, pak choi, glassa miso e miele', 'miso-salmon-sweet-potato'],
  d_friedRice: ['Riso saltato ai gamberi: riso 80 g (meglio del giorno prima), gamberi 180 g, 2 uova, piselli, carote, cipollotto, olio di sesamo', 'shrimp-fried-rice'],
  d_ramen: ['Ramen di pollo: noodles 80 g, pollo 160 g, uovo marinato, funghi, pak choi, mais, brodo al miso, cipollotto', 'chicken-ramen'],
  d_beefBroccoli: ['Manzo e broccoli: manzo magro 170 g, broccoli 200 g, riso jasmine 75 g, salsa di soia e ostrica, zenzero', 'beef-broccoli'],
  d_curry: ['Curry verde di pollo: pollo 180 g, latte di cocco light 120 ml, zucchine e peperoni, riso 70 g, basilico e lime', 'green-curry'],
  d_koreanTacos: ['Tacos coreani: 3 tortillas piccole, pollo 180 g al gochujang, insalata di cavolo e cipollotto, yogurt, sesamo', 'korean-chicken-tacos'],
  d_loaded: ['Patate dolci ripiene: patate dolci 300 g, macinato magro 150 g, fagioli neri, cheddar 20 g, yogurt greco e cipollotto', 'loaded-sweet-potato'],
  d_tataki: ['Tataki di tonno: tonno fresco 160 g in crosta di sesamo, soba 70 g, edamame, cetriolo, salsa soia e lime', 'tuna-tataki-soba'],
  d_padthai: ['Pad thai di pollo: noodles di riso 75 g, pollo 160 g, 1 uovo, germogli di soia, arachidi 12 g, lime e cipollotto', 'chicken-pad-thai'],
  d_smash: ['Smash burger e patate: burger magro 180 g, patate al forno 300 g, insalata, salsa yogurt', 'smash-burger'],
  d_meatballs: ['Polpette di tacchino agrodolci: macinato di tacchino 180 g, panko, cipollotto, salsa agrodolce, riso 75 g, verdure', 'turkey-meatballs'],
  polloCroccante: ['Pollo croccante al forno 200 g, pane 90 g, verdure e salsa allo yogurt', 'crispy-chicken-plate'],
  pokeTonno: ['Poke casalinga: tonno cotto 170 g, riso 90 g crudo, avocado 60 g, carote', 'tuna-poke'],
  tacosFit: ['Tacos fit: tortillas 2, tacchino 180 g, fagioli 120 g cotti, verdure', 'turkey-tacos'],
  frittata: ['Frittata: 3 uova, pane 100 g, spinaci e insalata', 'spinach-frittata'],
  bistecca: ['Bistecca magra 180 g, patate 300 g, verdure grigliate e olio EVO 10 g', 'steak-potatoes'],
  // cene del giovedì, prima del calcio
  p_pasta: ['Pasta al pomodoro con tacchino: pasta 110 g, passata, tacchino 150 g a straccetti, parmigiano 10 g, olio EVO 8 g', 'tomato-pasta-turkey'],
  p_gnocchi: ['Gnocchi al pomodoro e pollo: gnocchi 300 g, passata, pollo 140 g, basilico, parmigiano 10 g', 'gnocchi-chicken'],
  p_udon: ['Udon in brodo: udon 300 g, pollo 150 g, spinaci, brodo al miso, cipollotto', 'chicken-udon'],
  salmoneRiso: ['Salmone 180 g, riso 80 g crudo, broccoli e limone', 'salmon-rice'],
  // fissi
  cracker: ['Spuntino di metà mattina: cracker integrali 30 g', 'skyr-crackers'],
  piadine: ['2 piadine con tacchino e mozzarella light: 2 piadine, fesa di tacchino 140 g, mozzarella light 70 g, pomodoro e rucola', 'turkey-breakfast-wrap'],
  polloPiastra: ['Pollo alla piastra 200 g, riso 90 g crudo, verdure grigliate e olio EVO 10 g', 'chicken-rice-bowl'],
  mcd: ['McDonald’s: scegli il panino che ti piace, porzione piccola/media di patatine e bevanda senza zuccheri; registra il pasto reale.', 'burger-fries'],
  cavallo: ['Pasta bianca 100 g cruda con olio EVO 10 g + carne di cavallo 170–200 g + verdure', 'white-pasta-horse-steak'],
  pizza: ['Pizza a scelta + contorno o insalata. Mangiala senza compensazioni punitive.', 'pizza'],
  drinks: ['Uscita: 3–4 cocktail (contati nel piano)', null],
  // calcio (21:30–23:00)
  pre_banana: ['Pre-calcio: banana e 2 gallette con miele', null],
  pre_toast: ['Pre-calcio: toast 50 g con marmellata', null],
  post_banana: ['Dopo calcio: shake proteico 30 g con latte scremato, banana e 2 gallette', null],
  post_yogurt: ['Dopo calcio: yogurt greco 200 g con proteine 15 g, cornflakes 30 g e frutti di bosco', null],
  post_toast: ['Dopo calcio: shake proteico 30 g con latte scremato e toast 60 g con miele', null],
};

// Etichette dei pasti, nell'ordine della giornata (calcio lunedì e giovedì 21:30–23:00, uscita il venerdì)
const FOOTBALL_TAIL = ['Cena · 18:45', 'Pre-calcio · 20:45', 'Dopo calcio · 23:15'];
const LABELS = [
  ['Colazione', 'Spuntino', 'Pranzo', ...FOOTBALL_TAIL],
  ['Colazione', 'Pranzo', 'Spuntino', 'Cena'],
  ['Colazione', 'Pranzo', 'Spuntino', 'Cena'],
  ['Colazione', 'Pranzo', 'Spuntino', ...FOOTBALL_TAIL],
  ['Colazione', 'Pranzo', 'Spuntino', 'Cena', 'Uscita'],
  ['Colazione', 'Pranzo', 'Spuntino', 'Cena'],
  ['Colazione', 'Pranzo', 'Spuntino', 'Cena'],
];

// 6 settimane. Ordine trovato con una ricerca al computer (ottobre 2026): ogni giorno resta entro
// ±150 kcal dal suo obiettivo, proteine ≥ 150 g (≥ 140 col McDonald's, ≥ 145 con la pizza), ogni
// settimana almeno 3 piatti orientali e UNA volta le patate dolci (due erano troppe), le 18 cene
// di mar/ven/sab tutte diverse.
const WEEKS = [
  // settimana 1
  [
    ['b_toastPB', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_banana'],
    ['piadina', 'farro', 'skyrSalato', 'd_teriyaki'],
    ['waffle', 'l_sweetBowl', 's_pudding', 'mcd'],
    ['b_pancake', 'l_burrito', 'edamame', 'salmoneRiso', 'pre_toast', 'post_yogurt'],
    ['b_omelette', 'l_coldPasta', 's_skyrFruit', 'd_koreanTacos', 'drinks'],
    ['b_gocciole', 'cavallo', 'yogurtCacao', 'd_beefBroccoli'],
    ['b_gocciole', 'l_salad', 's_pudding', 'pizza'],
  ],
  // settimana 2
  [
    ['b_mango', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_toast'],
    ['french', 'poke', 'toastTacchino', 'd_curry'],
    ['oats', 'riceBowl', 'bresaola', 'mcd'],
    ['yogurtBowl', 'l_beefNoodles', 'hummus', 'p_udon', 'pre_toast', 'post_banana'],
    ['b_choco', 'pastaTonno', 's_pudding', 'd_loaded', 'drinks'],
    ['b_gocciole', 'cavallo', 'fiocchi', 'frittata'],
    ['b_gocciole', 'pastaTonno', 's_pudding', 'pizza'],
  ],
  // settimana 3
  [
    ['b_bagel', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_yogurt'],
    ['b_sweetPancake', 'couscous', 'skyrSalato', 'd_ramen'],
    ['b_porridge', 'l_crispyBun', 's_pudding', 'mcd'],
    ['toast', 'l_gyudon', 'edamame', 'p_pasta', 'pre_toast', 'post_toast'],
    ['b_toastPB', 'wrapSmash', 's_skyrFruit', 'd_tataki', 'drinks'],
    ['b_gocciole', 'cavallo', 'yogurtCacao', 'd_bibimbap'],
    ['b_gocciole', 'l_salad', 's_skyrFruit', 'pizza'],
  ],
  // settimana 4
  [
    ['piadina', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_banana'],
    ['waffle', 'pesto', 'toastTacchino', 'd_padthai'],
    ['b_pancake', 'l_venere', 'bresaola', 'mcd'],
    ['b_omelette', 'farro', 'hummus', 'p_gnocchi', 'pre_toast', 'post_yogurt'],
    ['b_mango', 'l_sweetBowl', 's_pudding', 'bistecca', 'drinks'],
    ['b_gocciole', 'cavallo', 'fiocchi', 'd_meatballs'],
    ['b_gocciole', 'l_salad', 's_pudding', 'pizza'],
  ],
  // settimana 5
  [
    ['french', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_toast'],
    ['oats', 'l_burrito', 'skyrSalato', 'pokeTonno'],
    ['yogurtBowl', 'l_coldPasta', 's_pudding', 'mcd'],
    ['b_choco', 'poke', 'edamame', 'salmoneRiso', 'pre_toast', 'post_banana'],
    ['b_bagel', 'riceBowl', 's_skyrFruit', 'd_smash', 'drinks'],
    ['b_gocciole', 'cavallo', 'yogurtCacao', 'd_miso'],
    ['b_gocciole', 'pastaTonno', 's_pudding', 'pizza'],
  ],
  // settimana 6
  [
    ['b_sweetPancake', 'cracker', 'piadine', 'polloPiastra', 'pre_banana', 'post_yogurt'],
    ['b_porridge', 'l_beefNoodles', 'toastTacchino', 'd_friedRice'],
    ['toast', 'pastaTonno', 'bresaola', 'mcd'],
    ['b_toastPB', 'couscous', 'hummus', 'p_udon', 'pre_toast', 'post_toast'],
    ['piadina', 'l_crispyBun', 's_pudding', 'polloCroccante', 'drinks'],
    ['b_gocciole', 'cavallo', 'fiocchi', 'tacosFit'],
    ['b_gocciole', 'l_salad', 's_skyrFruit', 'pizza'],
  ],
];

const NOTES = [
  'Calcio 21:30–23:00: la cena vera è alle 18:45 (carboidrati e proteine, pochi grassi), spuntino alle 20:45, dopo la partita shake e qualcosa di leggero. Niente pasto enorme alle 23: dormi meglio e recuperi lo stesso.',
  '',
  'McDonald’s la sera: è già contato. A colazione, pranzo e merenda tante proteine, perché il panino ne ha poche.',
  'Calcio 21:30–23:00: la cena vera è alle 18:45 (carboidrati e proteine, pochi grassi), spuntino alle 20:45, dopo la partita shake e qualcosa di leggero.',
  'Esci? Cena prima, mai a stomaco vuoto, e un bicchiere d’acqua tra un cocktail e l’altro. Gin tonic o vodka soda ≈ 100–190 kcal; mojito, piña colada e drink con succhi o panna ≈ 250–400.',
  'Sabato di sprint e forza: latte e Gocciole con le proteine nel latte, pranzo fisso pasta bianca e cavallo.',
  'La pizza è già prevista: pranzo leggero ma pieno di proteine, niente compensazioni.',
];

export const mealWeeks = WEEKS.map((week) => week.map((ids, day) => ({
  day: dayNames[day], target: dayTargets[day],
  slots: ids.map((id, i) => ({ id, label: LABELS[day][i], meal: M[id][0], image: M[id][1] ? `/recipes/${M[id][1]}.jpg` : null })),
  note: NOTES[day],
})));

// Sezione FIT PORN: le ricette più golose del menu (etichetta 'fit porn' in mealRecipes.js), ognuna con
// la sua foto e la ricetta completa, più due extra fuori calendario.
const FIT_PORN = Object.values(M)
  .filter(([text], i, all) => mealRecipes[text]?.tags?.includes('fit porn') && all.findIndex(([t]) => t === text) === i)
  .map(([text, img]) => ({ ...mealRecipes[text], image: `/recipes/${img}.jpg`, tag: `Fit porn • ${mealRecipes[text].time}` }));
export const recipes = [
  ...FIT_PORN,
  { title: 'Smash burger fit col panino', tag: 'Fit porn • 20 min', image: '/recipes/smash-burger.jpg', ingredients: 'Burger magro 180 g, bun 90 g, cheddar 20 g, lattuga, pomodoro, salsa yogurt.', steps: 'Scotta il burger su piastra rovente, aggiungi cheddar; tosta il bun e monta con verdure e salsa. Servi con patate al forno.' },
  { title: 'Crispy chicken wrap', tag: 'Fit porn • 20 min', image: '/recipes/crispy-wrap.jpg', ingredients: 'Pollo 180 g, piadina integrale, cornflakes non zuccherati 25 g, yogurt, paprika, insalata.', steps: 'Impana il pollo nei cornflakes e cuoci in forno o friggitrice ad aria. Chiudi nella piadina con yogurt e insalata.' },
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

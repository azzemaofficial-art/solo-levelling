import { mealRecipes } from './mealRecipes.js';

export const profile = {
  name: 'Emanuele', age: 23, heightCm: 185, startWeightKg: 86.45,
  targetWeightKg: 83, startWaistCm: 92, footballDays: [1, 4],
};

export const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
// Lun e gio calcio (21:30–23:00, l’Apple Watch dice ~1.600 kcal ma nel calcio sovrastima: contiamo ~900–1.000);
// venerdì massimo 2 cocktail (~375 kcal, contati); sabato e domenica latte, 8 Gocciole e un frutto; domenica
// pranzo dalla mamma (~800) e pizza la sera. Media ≈ 2.470 kcal/giorno: ≈ 0,45 kg a settimana (Helms 2014).
export const dayTargets = [2750, 2250, 2300, 2750, 2200, 2350, 2750];
export const nutritionRules = [
  'Partenza indicativa: 2.300–2.450 kcal in base alla giornata. Le porzioni sono una guida, non un obbligo matematico.',
  'Proteine: circa 155–170 g al giorno, distribuite tra i pasti. Verdura e frutta: almeno 400 g; fibra: almeno 25 g.',
  'Pesa al mattino 3–4 volte a settimana e guarda la media. Se dopo 3 settimane peso e vita non scendono, riduci di circa 100–150 kcal o aumenta il movimento quotidiano.',
  'Nei giorni di calcio (21:30–23:00) i carboidrati vanno soprattutto nella cena delle 18:45 e nello spuntino pre-partita; dopo, shake di proteine e qualcosa di leggero. Non compensare pizza, McDonald’s o cocktail saltando i pasti.',
  'Proteine in polvere (le tue, gusto chocowafer) solo dove servono: lo shake dopo il calcio e un misurino nel latte del weekend con le Gocciole. Negli altri pasti le proteine arrivano da skyr, albumi, yogurt, carne e pesce.',
  'Le calorie dell’Apple Watch negli sport a scatti come il calcio sono sovrastimate: per capire se mangi abbastanza guarda la media del peso della settimana, non il numero dell’orologio.',
  'Alcol: dopo l’allenamento riduce del 24–37% la costruzione del muscolo e peggiora il sonno. Il venerdì massimo 2 cocktail, con un bicchiere d’acqua in mezzo.',
  'Cucina asiatica: salsa di soia iposodica (20–40% di sale in meno), misurata col cucchiaio. Zenzero, aglio, cipollotto e aceto di riso danno sapore senza sale.',
  'Longevità: fibre almeno 25 g al giorno e frutta e verdura almeno 400 g sono le abitudini più legate a una vita lunga. Ogni giorno del piano le rispetta; il totale delle fibre è sopra i pasti.',
  'Ogni settimana: pesce almeno 2 volte, carne rossa al massimo 3 (cavallo compreso), affettati il meno possibile, legumi almeno 3 giorni, una manciata di frutta secca quando puoi, integrale dove non rovina il piatto (prima della partita meglio bianco: meno fibre, digestione più facile).',
  'Per il pesce crudo scegli un esercizio affidabile che gestisca correttamente la sicurezza del prodotto.',
  'Tieni l’acqua a portata di mano durante il lavoro. Parti da circa 2 litri al giorno e bevi di più quando sudi durante il calcio.',
  'Prova ad avvicinarti a 8 ore di sonno quando aggiungi sprint e pesi: la qualità delle sedute dipende dal recupero.',
];

// Pasti del menu: id → [testo esatto (= chiave della ricetta in mealRecipes.js), foto in /public/recipes].
// Le foto nuove le prepara Emanuele con ChatGPT (vedi docs/immagini-ricette.md): finché manca
// il file, la pagina mostra un'icona al posto della foto.
const M = {
  // colazioni dei giorni feriali (14: ognuna torna dopo almeno 2 settimane e mezzo)
  waffle: ['Waffle al cacao con frutti di bosco caldi: 2 uova, farina d’avena 50 g, cacao, yogurt greco 150 g, frutti di bosco, fondente 10 g', 'chocolate-waffle'],
  toast: ['Toast salato: pane integrale 100 g, 2 uova, ricotta magra 100 g, pomodoro', 'egg-ricotta-toast'],
  piadina: ['Piadina colazione: piadina integrale, fesa di tacchino 130 g, spalmabile light 30 g, spinacino', 'turkey-breakfast-wrap'],
  yogurtBowl: ['Yogurt bowl croccante: greco 250 g, muesli senza zuccheri aggiunti 60 g, kiwi, noci 15 g', 'kiwi-yogurt-bowl'],
  b_pancake: ['Pancake alla banana: avena 50 g, 1 uovo, albume 150 g, banana, yogurt greco 100 g, frutti di bosco', 'protein-pancakes'],
  b_toastPB: ['Toast burro d’arachidi e banana: pane integrale 70 g, burro d’arachidi 15 g, banana, skyr 200 g', 'pb-banana-toast'],
  b_choco: ['Overnight oats cioccolato e burro d’arachidi: avena 50 g, latte 150 ml, skyr 150 g, cacao, banana, burro d’arachidi 10 g', 'chocolate-oats'],
  b_omelette: ['Omelette cipollotto e feta: 3 uova, feta 30 g, cipollotto, pane integrale 60 g, pomodorini', 'scallion-omelette'],
  b_mango: ['Smoothie bowl al mango: skyr 300 g, mango 150 g, banana, granola 30 g, cocco', 'mango-smoothie-bowl'],
  b_porridge: ['Porridge mela e cannella: avena 60 g, latte 200 ml, skyr 150 g, mela, noci 10 g', 'apple-porridge'],
  b_tamago: ['Tamago sando: pane in cassetta 80 g, 3 uova sode, yogurt greco 50 g, senape e cipollotto, un kiwi', 'tamago-sando'],
  b_jianbing: ['Jianbing: crêpe con farina 50 g e 2 uova, tacchino 80 g, cipollotto, salsa hoisin 10 g, lattuga', 'jianbing'],
  // colazione fissa di sabato e domenica
  b_gocciole: ['Latte e Gocciole: latte scremato 250 ml con proteine 25 g, 8 Gocciole e un frutto', 'milk-gocciole'],
  // pranzi
  riceBowl: ['Rice bowl: riso integrale 100 g crudo, pollo 170 g, zucchine, olio EVO 10 g', 'chicken-rice-bowl'],
  pastaTonno: ['Pasta integrale tonno e ceci: pasta integrale 70 g, tonno al naturale 140 g, ceci 60 g, pomodorini e rucola', 'tuna-pasta'],
  wrapSmash: ['Wrap smash: 2 tortillas da 50 g, macinato magro 160 g, lattuga, salsa yogurt', 'smash-wrap'],
  farro: ['Insalata di farro: farro 100 g crudo, sgombro 120 g, fagioli 100 g cotti, verdure', 'farro-mackerel'],
  l_beefNoodles: ['Noodles saltati al manzo: noodles di riso 80 g, manzo magro 150 g, peperoni, carote e cipollotto, olio di sesamo 8 g', 'beef-noodles'],
  l_crispyBun: ['Panino pollo croccante: pane 100 g, pollo 150 g in panko, cavolo rosso, salsa yogurt, senape e miele', 'crispy-chicken-sandwich'],
  l_coldPasta: ['Pasta fredda tonno e cipollotto: pasta integrale 90 g, tonno al naturale 140 g, mais 50 g, pomodorini, cipollotto, olio EVO 10 g', 'cold-tuna-pasta'],
  l_burrito: ['Burrito bowl al tacchino: riso integrale 80 g, macinato di tacchino 160 g, fagioli neri 100 g, mais, pico de gallo, yogurt greco, avocado', 'turkey-burrito-bowl'],
  l_katsu: ['Bento katsu: pollo 170 g in panko al forno, riso 80 g, cavolo a julienne 150 g, salsa tonkatsu', 'chicken-katsu-bento'],
  l_oyakodon: ['Oyakodon: riso 90 g, pollo 160 g, 2 uova, cipolla, soia e mirin, cipollotto, spinaci al sesamo', 'oyakodon'],
  l_kimbap: ['Kimbap al tonno: riso 90 g, tonno al naturale 120 g, 1 uovo, carota, cetriolo, spinaci, alga nori', 'tuna-kimbap'],
  l_bulgogi: ['Bulgogi bowl: riso 80 g, manzo magro 150 g marinato in soia, pera e aglio, verdure saltate, sesamo', 'bulgogi-bowl'],
  // spuntini
  skyrSalato: ['Dip di skyr: skyr salato 170 g, cracker integrali 50 g e verdure crude 150 g', 'skyr-crackers'],
  bresaola: ['Panino piccolo 80 g con bresaola 80 g e rucola', 'bresaola-sandwich'],
  fiocchi: ['Caprese light: mozzarella light 125 g, pomodorini, basilico e pane 40 g', 'light-caprese'],
  edamame: ['Edamame 150 g e un frutto', 'edamame-fruit'],
  yogurtCacao: ['Yogurt greco 170 g, cacao e 15 g pistacchi', 'cocoa-yogurt'],
  s_yogurtNoci: ['Yogurt greco 170 g con noci 15 g, miele e frutti di bosco', 'yogurt-walnuts'],
  s_skyrFruit: ['Skyr 170 g, un frutto e mandorle 15 g', 'skyr-fruit'],
  s_pudding: ['Budino di skyr al cacao: skyr 200 g, cacao, miele, fondente 10 g', 'chocolate-skyr-pudding'],
  s_onigiri: ['Onigiri al tonno: riso 50 g, tonno al naturale 70 g, yogurt greco, alga nori', 'tuna-onigiri'],
  // cene
  d_teriyaki: ['Pollo teriyaki: pollo 200 g, riso 80 g, broccoli, salsa teriyaki fatta in casa, sesamo e cipollotto', 'chicken-teriyaki'],
  d_bibimbap: ['Bibimbap: riso 80 g, manzo magro 130 g, 1 uovo, spinaci, carote, zucchine, salsa di soia e miele, olio di sesamo', 'bibimbap'],
  d_ramen: ['Ramen di pollo: noodles 80 g, pollo 160 g, uovo marinato, funghi, pak choi, mais, brodo al miso, cipollotto', 'chicken-ramen'],
  d_beefBroccoli: ['Manzo e broccoli: manzo magro 170 g, broccoli 200 g, riso jasmine 75 g, salsa di soia e ostrica, zenzero', 'beef-broccoli'],
  d_curryJap: ['Curry giapponese di pollo: pollo 180 g, patate 150 g, carote, cipolla, curry delicato, riso 60 g', 'japanese-curry'],
  d_bulgogiTacos: ['Tacos bulgogi: 3 tortillas piccole, pollo 180 g marinato in soia e pera, insalata di cavolo e cipollotto, yogurt, sesamo', 'bulgogi-chicken-tacos'],
  d_loaded: ['Patatine dolci loaded: patatine di patate dolci in friggitrice 300 g, macinato magro 150 g, fagioli neri, cheddar 20 g, yogurt e cipollotto', 'loaded-sweet-fries'],
  d_padthai: ['Pad thai di pollo: noodles di riso 75 g, pollo 160 g, 1 uovo, germogli di soia, arachidi 12 g, lime e cipollotto', 'chicken-pad-thai'],
  d_smash: ['Smash burger e patatine di patate dolci: burger magro 180 g, patatine di patate dolci in friggitrice 300 g, insalata grande, salsa yogurt', 'smash-burger-sweet-fries'],
  d_meatballs: ['Polpette di tacchino agrodolci: macinato di tacchino 180 g, panko, cipollotto, salsa agrodolce, riso 75 g, verdure', 'turkey-meatballs'],
  d_okonomiyaki: ['Okonomiyaki fit: cavolo 250 g, farina 50 g, 2 uova + albume 100 g, pollo 100 g, salsa okonomi, maionese light 10 g', 'okonomiyaki'],
  polloCroccante: ['Pollo croccante al forno 200 g, pane 90 g, verdure e salsa allo yogurt', 'crispy-chicken-plate'],
  tacosFit: ['Tacos fit: tortillas 2, tacchino 180 g, fagioli 120 g cotti, verdure', 'turkey-tacos'],
  // cene del giovedì, prima del calcio
  p_pasta: ['Pasta al pomodoro con tacchino: pasta 110 g, passata, tacchino 150 g a straccetti, parmigiano 10 g, olio EVO 8 g', 'tomato-pasta-turkey'],
  p_gnocchi: ['Gnocchi al pomodoro e pollo: gnocchi 300 g, passata, pollo 140 g, basilico, parmigiano 10 g', 'gnocchi-chicken'],
  p_udon: ['Udon in brodo: udon 300 g, pollo 150 g, spinaci, brodo al miso, cipollotto', 'chicken-udon'],
  // fissi
  cracker: ['Spuntino di metà mattina: cracker integrali 30 g', 'skyr-crackers'],
  piadine: ['2 piadine con tacchino e mozzarella light: 2 piadine, fesa di tacchino 140 g, mozzarella light 70 g, pomodoro e rucola', 'turkey-breakfast-wrap'],
  mcd: ['McDonald’s: scegli il panino che ti piace, porzione piccola/media di patatine e bevanda senza zuccheri, poi un frutto a casa; registra il pasto reale.', 'burger-fries'],
  cavallo: ['Pasta bianca 100 g cruda con olio EVO 10 g + carne di cavallo 170–200 g + verdure', 'white-pasta-horse-steak'],
  pizza: ['Pizza a scelta + contorno o insalata. Mangiala senza compensazioni punitive.', 'pizza'],
  drinks2: ['Uscita: massimo 2 cocktail (contati nel piano)', null],
  // calcio (21:30–23:00)
  pre_banana: ['Pre-calcio: banana e 2 gallette con miele', null],
  pre_toast: ['Pre-calcio: toast 50 g con marmellata', null],
  post_banana: ['Dopo calcio: shake proteico 30 g con latte scremato, banana e 2 gallette', null],
  post_yogurt: ['Dopo calcio: yogurt greco 200 g con proteine 15 g, cornflakes 30 g e frutti di bosco', null],
  post_toast: ['Dopo calcio: shake proteico 30 g con latte scremato e toast 60 g con miele', null],
  oatsCheesecake: ['Overnight oats cheesecake: avena 50 g, latte 120 ml, skyr 170 g, frutti di bosco, biscotto digestive 15 g, miele', 'cheesecake-oats'],
  bananaBread: ['Banana bread fit: 2 fette (avena, banana, uova, noci) e skyr 150 g col miele', 'banana-bread'],
  l_peanutBowl: ['Chicken bowl con salsa alle arachidi: riso 80 g, pollo 160 g, cavolo e carote, salsa di burro d’arachidi, soia e lime', 'peanut-chicken-bowl'],
  l_tunaDon: ['Tuna mayo don: riso 90 g, tonno al naturale 120 g, maionese light e yogurt, edamame 60 g, cipollotto, alga nori', 'tuna-mayo-don'],
  l_butadon: ['Butadon: riso 90 g, lonza di maiale 150 g a fettine, cipolla, 1 uovo, soia e mirin, cipollotto, cetrioli', 'butadon'],
  d_cantonese: ['Riso alla cantonese con pollo: riso 80 g (del giorno prima), pollo 150 g, 2 uova, piselli, carote, cipollotto, olio di sesamo', 'cantonese-rice'],
  d_fishTacos: ['Fish tacos di merluzzo: 3 tortillas piccole, merluzzo 180 g, insalata di cavolo, salsa yogurt e lime', 'fish-tacos'],
  d_fishChips: ['Fish & chips fit: merluzzo 200 g in panko, patatine di patate dolci in friggitrice 250 g, salsa tartara light', 'fish-chips-sweet-fries'],
  d_lemonChicken: ['Pollo al limone cinese: pollo 180 g glassato al limone e miele, riso 75 g, verdure saltate', 'lemon-chicken'],
  d_yakitori: ['Yakitori di pollo e cipollotto: spiedini di pollo 180 g e cipollotto con salsa tare, riso 75 g, cetrioli', 'yakitori'],
  mon_kor: ['Pollo e riso alla coreana: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa di soia, miele, aglio e sesamo, cipollotto', 'korean-chicken-rice'],
  mon_ginger: ['Pollo e riso zenzero e cipollotto: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa cantonese di zenzero e cipollotto', 'ginger-scallion-chicken'],
  mon_lemon: ['Pollo e riso al limone ed erbe: pollo 200 g, riso 90 g con piselli 60 g, verdure grigliate, limone, rosmarino, olio EVO 10 g', 'lemon-herb-chicken-rice'],
  mon_teri: ['Pollo e riso teriyaki: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa teriyaki, cipollotto', 'chicken-teriyaki'],
  mon_mex: ['Pollo e riso alla messicana: pollo 200 g, riso 90 g, fagioli neri 60 g, pico de gallo, peperoni, lime, paprika', 'mexican-chicken-rice'],
  mon_thai: ['Pollo e riso thai al basilico (non piccante): pollo 200 g, riso 90 g, piselli 50 g, verdure, basilico, soia, lime', 'thai-basil-chicken-rice'],
  mamma: ['Pranzo dalla mamma: un piatto di primo, un secondo con verdure, niente bis', null],
  s_skyrPlain: ['Skyr 170 g e un frutto', 'skyr-fruit'],
  b_bagel: ['Bagel salmone e cipollotto: bagel 90 g, salmone affumicato 60 g, spalmabile light 40 g, cipollotto, skyr 150 g con miele', 'salmon-bagel'],
  l_poke: ['Poke al salmone crudo: riso 80 g, salmone 130 g, edamame 60 g, cetriolo, carote, cavolo, salsa soia, miele e sesamo', 'salmon-poke'],
  d_chirashi: ['Chirashi di salmone crudo: riso 80 g, salmone 140 g a fette, avocado 30 g, edamame, cetriolo, carote, soia e sesamo', 'salmon-chirashi'],
  d_salmonTeri: ['Salmone teriyaki: salmone 160 g glassato, riso 70 g, zucchine e pak choi, cipollotto e sesamo', 'salmon-teriyaki'],
  d_tataki: ['Tataki di tonno: tonno fresco 160 g in crosta di sesamo, soba 70 g, edamame, cetriolo, salsa soia e lime', 'tuna-tataki-soba'],
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

// 6 settimane, generate da scripts/menu/cerca-calendario.mjs (grammi di ogni ingrediente, valori CREA/USDA,
// prezzi indicativi): ogni giorno entro ±150 kcal dal suo obiettivo, proteine ≥ 150 g (≥ 140 col McDonald’s,
// ≥ 135 la domenica), fibre ≥ 25 g, frutta e verdura ≥ 400 g, grassi ≥ 15% e ≥ 45 g; ogni settimana pesce ≥ 2,
// carne rossa ≤ 3 (cavallo compreso), affettati ≤ 2, legumi almeno 3 giorni, patate dolci al massimo una volta e
// solo a patatine, pollo al forno al massimo una volta, almeno 7 piatti fit porn; ogni piatto sotto i 4 €.
// Lunedì: pollo e riso fisso, ogni settimana in una versione diversa. Domenica: pranzo dalla mamma.
const WEEKS = [
  // settimana 1
  [
    ['b_bagel', 'cracker', 'piadine', 'mon_kor', 'pre_banana', 'post_banana'],
    ['bananaBread', 'l_burrito', 'fiocchi', 'd_padthai'],
    ['piadina', 'l_katsu', 's_skyrFruit', 'mcd'],
    ['yogurtBowl', 'l_kimbap', 's_yogurtNoci', 'p_gnocchi', 'pre_toast', 'post_yogurt'],
    ['b_toastPB', 'pastaTonno', 's_yogurtNoci', 'd_bibimbap', 'drinks2'],
    ['b_gocciole', 'cavallo', 'edamame', 'd_yakitori'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
  // settimana 2
  [
    ['b_jianbing', 'cracker', 'piadine', 'mon_ginger', 'pre_banana', 'post_toast'],
    ['waffle', 'farro', 'skyrSalato', 'd_meatballs'],
    ['oatsCheesecake', 'l_oyakodon', 's_pudding', 'mcd'],
    ['b_mango', 'l_poke', 's_onigiri', 'p_pasta', 'pre_toast', 'post_banana'],
    ['b_omelette', 'wrapSmash', 's_skyrFruit', 'tacosFit', 'drinks2'],
    ['b_gocciole', 'cavallo', 'yogurtCacao', 'd_curryJap'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
  // settimana 3
  [
    ['b_tamago', 'cracker', 'piadine', 'mon_mex', 'pre_banana', 'post_yogurt'],
    ['b_porridge', 'l_bulgogi', 'bresaola', 'd_chirashi'],
    ['b_choco', 'l_tunaDon', 'fiocchi', 'mcd'],
    ['toast', 'riceBowl', 's_skyrFruit', 'p_udon', 'pre_toast', 'post_toast'],
    ['b_pancake', 'l_beefNoodles', 's_pudding', 'd_fishTacos', 'drinks2'],
    ['b_gocciole', 'cavallo', 's_yogurtNoci', 'd_fishChips'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
  // settimana 4
  [
    ['b_bagel', 'cracker', 'piadine', 'mon_thai', 'pre_banana', 'post_banana'],
    ['bananaBread', 'l_butadon', 'edamame', 'd_cantonese'],
    ['piadina', 'l_peanutBowl', 'skyrSalato', 'mcd'],
    ['yogurtBowl', 'l_crispyBun', 's_pudding', 'p_gnocchi', 'pre_toast', 'post_yogurt'],
    ['b_toastPB', 'l_coldPasta', 's_yogurtNoci', 'd_bulgogiTacos', 'drinks2'],
    ['b_gocciole', 'cavallo', 's_onigiri', 'd_loaded'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
  // settimana 5
  [
    ['b_jianbing', 'cracker', 'piadine', 'mon_lemon', 'pre_banana', 'post_toast'],
    ['waffle', 'l_burrito', 'yogurtCacao', 'd_salmonTeri'],
    ['oatsCheesecake', 'l_katsu', 'bresaola', 'mcd'],
    ['b_mango', 'l_kimbap', 'fiocchi', 'p_pasta', 'pre_toast', 'post_banana'],
    ['b_omelette', 'pastaTonno', 's_skyrFruit', 'd_smash', 'drinks2'],
    ['b_gocciole', 'cavallo', 's_skyrFruit', 'd_ramen'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
  // settimana 6
  [
    ['b_tamago', 'cracker', 'piadine', 'mon_teri', 'pre_banana', 'post_yogurt'],
    ['b_porridge', 'farro', 's_yogurtNoci', 'd_lemonChicken'],
    ['b_choco', 'l_oyakodon', 'edamame', 'mcd'],
    ['toast', 'l_poke', 'skyrSalato', 'p_udon', 'pre_toast', 'post_toast'],
    ['b_pancake', 'wrapSmash', 's_pudding', 'd_okonomiyaki', 'drinks2'],
    ['b_gocciole', 'cavallo', 's_pudding', 'd_tataki'],
    ['b_gocciole', 'mamma', 's_skyrPlain', 'pizza'],
  ],
];

const NOTES = [
  'Calcio 21:30–23:00: la cena vera è alle 18:45 (pollo e riso, ogni settimana in una versione diversa), spuntino alle 20:45, dopo la partita shake e qualcosa di leggero. Niente pasto enorme alle 23: dormi meglio e recuperi lo stesso.',
  '',
  'McDonald’s la sera: è già contato. A colazione, pranzo e merenda tante proteine, perché il panino ne ha poche.',
  'Calcio 21:30–23:00: la cena vera è alle 18:45 (carboidrati e proteine, pochi grassi), spuntino alle 20:45, dopo la partita shake e qualcosa di leggero.',
  'Esci? Massimo 2 cocktail, contati nel piano: cena prima, mai a stomaco vuoto, e un bicchiere d’acqua in mezzo. Gin tonic o vodka soda ≈ 100–190 kcal; mojito, piña colada e drink con succhi o panna ≈ 250–400. Domani ci sono sprint e pesi.',
  'Sabato di sprint e forza: latte con le proteine, 8 Gocciole e un frutto; pranzo fisso pasta bianca e cavallo.',
  'Pranzo dalla mamma: un piatto di primo, un secondo con verdure, niente bis. La pizza della sera è già prevista: niente compensazioni.',
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
  { label: 'Ritmo del cut 0,5–1% a settimana e proteine (Helms 2014)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/' },
  { label: 'Alcol dopo l’allenamento: −24–37% di sintesi muscolare (Parr 2014)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3922864/' },
  { label: 'Mangiare tardi: più fame, meno dispendio (Vujović 2022)', url: 'https://sleep.hms.harvard.edu/news/late-isocaloric-eating-increases-hunger-decreases-energy-expenditure-and-modifies-metabolic' },
  { label: 'Proteine prima di dormire e recupero (Res 2012)', url: 'https://pubmed.ncbi.nlm.nih.gov/22330017/' },
  { label: 'Fibre 25–29 g al giorno e mortalità (Reynolds 2019, Lancet)', url: 'https://www.foodnavigator.com/Article/2019/01/16/Quality-not-quantity-Study-links-minimally-processed-high-fibre-diets-with-reduced-mortality' },
  { label: 'Frutta e verdura fino a 800 g al giorno (Aune 2017)', url: 'https://www.sciencedaily.com/releases/2017/02/170223114807.htm' },
  { label: 'Frutta secca, una manciata al giorno (Aune 2016)', url: 'https://bmcmedicine.biomedcentral.com/track/pdf/10.1186/s12916-016-0730-3' },
  { label: 'Legumi e mortalità (meta-analisi)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5688364/' },
  { label: 'Cereali integrali, 90 g al giorno (Aune 2016, BMJ)', url: 'https://www.doi.org/10.1136/BMJ.I2716' },
  { label: 'Carne rossa massimo 3 porzioni, affettati il meno possibile (WCRF)', url: 'https://www.wcrf.org/our-cancer-prevention-recommendations/red-and-processed-meat' },
  { label: 'Pesce 2 volte a settimana (American Heart Association)', url: 'https://www.heart.org/en/news/2018/05/25/eating-fish-twice-a-week-reduces-heart-stroke-risk' },
  { label: 'Cibi ultra-processati: +500 kcal al giorno senza accorgersene (Hall 2019)', url: 'https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-weight-gain' },
  { label: 'Calorie degli smartwatch: errore sempre oltre il 20% (Shcherbina 2017)', url: 'https://www.doi.org/10.3390/JPM7020003' },
];

// Ricetta per ogni pasto del piano (chiave = testo esatto del pasto in cutPlan.js).
// kcal/proteine sono STIME da valori medi (CREA/USDA) sulle quantità scritte:
// condimenti extra, marche e porzioni reali le cambiano. Servono a orientarsi,
// il diario resta la misura vera.
export const mealRecipes = {
  // ── Colazioni ──
  'Overnight oats: skyr 250 g, avena 60 g, frutti di bosco, 15 g pistacchi': {
    title: 'Overnight oats ai frutti di bosco',
    time: '5 min + notte', kcal: 520, protein: 40,
    ingredients: ['Skyr bianco 250 g', 'Fiocchi d’avena 60 g', 'Frutti di bosco 100 g (anche surgelati)', 'Pistacchi sgusciati 15 g', 'Un goccio di latte o acqua se serve'],
    steps: ['In un barattolo mescola avena e skyr; allunga con 2–3 cucchiai di latte se è troppo denso.', 'Aggiungi metà dei frutti di bosco, chiudi e lascia in frigo tutta la notte.', 'Al mattino completa con il resto dei frutti e i pistacchi tritati grossolanamente.'],
  },
  'Waffle fit: 2 uova, yogurt greco 170 g, farina d’avena 60 g, crema 100% pistacchio 15 g': {
    title: 'Waffle fit al pistacchio',
    time: '15 min', kcal: 575, protein: 40,
    ingredients: ['Uova 2', 'Farina d’avena 60 g', 'Yogurt greco 170 g', 'Crema 100% pistacchio 15 g', 'Lievito per dolci ½ cucchiaino, cannella'],
    steps: ['Sbatti le uova con la farina d’avena, il lievito e 2 cucchiai dello yogurt fino a una pastella liscia.', 'Cuoci nella piastra per waffle calda e appena unta, 4–5 minuti finché è dorato.', 'Servi con il resto dello yogurt sopra e la crema di pistacchio a filo.'],
  },
  'Toast salato: pane integrale 100 g, 2 uova, ricotta magra 100 g, pomodoro': {
    title: 'Toast salato uova e ricotta',
    time: '10 min', kcal: 520, protein: 33,
    ingredients: ['Pane integrale 100 g (2–3 fette)', 'Uova 2', 'Ricotta magra 100 g', 'Pomodoro 1', 'Sale, pepe, origano'],
    steps: ['Tosta il pane.', 'Cuoci le uova strapazzate in padella antiaderente a fuoco medio-basso, senza grassi aggiunti.', 'Spalma la ricotta sul pane, aggiungi le uova e il pomodoro a fette; sale, pepe e origano.'],
  },
  'Bowl tiramisù: skyr 250 g, avena 55 g, caffè, cacao, banana': {
    title: 'Bowl tiramisù',
    time: '5 min + notte', kcal: 490, protein: 37,
    ingredients: ['Skyr 250 g', 'Fiocchi d’avena 55 g', 'Caffè espresso 1 tazzina', 'Cacao amaro 1 cucchiaino', 'Banana 1 piccola'],
    steps: ['Bagna l’avena con il caffè freddo.', 'In un bicchiere alterna strati di avena e skyr (dolcifica lo skyr se ti piace).', 'Frigo tutta la notte; al mattino cacao setacciato sopra e banana a rondelle.'],
  },
  'Piadina colazione: piadina integrale, fesa di tacchino 100 g, fiocchi di latte 100 g': {
    title: 'Piadina tacchino e fiocchi di latte',
    time: '5 min', kcal: 450, protein: 41,
    ingredients: ['Piadina integrale 1 (circa 75 g)', 'Fesa di tacchino 100 g', 'Fiocchi di latte 100 g', 'Qualche foglia di spinacino o rucola'],
    steps: ['Scalda la piadina in padella 1 minuto per lato.', 'Farcisci con fiocchi di latte, tacchino e verdura.', 'Chiudi a mezzaluna e ripassala 30 secondi per lato.'],
  },
  'French toast: pane 100 g, 2 uova, yogurt 150 g, fragole': {
    title: 'French toast con fragole',
    time: '10 min', kcal: 540, protein: 33,
    ingredients: ['Pane in cassetta o raffermo 100 g', 'Uova 2', 'Yogurt greco 150 g', 'Fragole 150 g', 'Cannella, un goccio di latte'],
    steps: ['Sbatti le uova con latte e cannella; immergi il pane da entrambi i lati.', 'Cuoci in padella antiaderente 2–3 minuti per lato finché è dorato.', 'Servi con yogurt e fragole tagliate.'],
  },
  'Yogurt bowl croccante: greco 250 g, muesli senza zuccheri aggiunti 60 g, kiwi, noci 15 g': {
    title: 'Yogurt bowl croccante',
    time: '3 min', kcal: 580, protein: 35,
    ingredients: ['Yogurt greco 250 g', 'Muesli senza zuccheri aggiunti 60 g', 'Kiwi 2', 'Noci 15 g'],
    steps: ['Metti lo yogurt nella ciotola.', 'Aggiungi il muesli all’ultimo momento, così resta croccante.', 'Completa con kiwi a cubetti e noci spezzate.'],
  },

  // ── Pranzi ──
  'Rice bowl: riso 100 g crudo, pollo 170 g, zucchine, olio EVO 10 g': {
    title: 'Rice bowl pollo e zucchine',
    time: '25 min', kcal: 665, protein: 48,
    ingredients: ['Riso 100 g crudo', 'Petto di pollo 170 g', 'Zucchine 200 g', 'Olio EVO 10 g', 'Salsa di soia, limone, paprika'],
    steps: ['Cuoci il riso in acqua salata.', 'Taglia il pollo a cubetti, condiscilo con paprika e cuocilo in padella 8–10 minuti; aggiungi le zucchine a rondelle negli ultimi 5.', 'Componi la bowl e condisci a crudo con olio, soia e limone.'],
  },
  'Pasta leggera: pasta 90 g cruda, tonno al naturale 140 g, pomodorini e rucola': {
    title: 'Pasta tonno e pomodorini',
    time: '15 min', kcal: 505, protein: 45,
    ingredients: ['Pasta 90 g cruda', 'Tonno al naturale 140 g sgocciolato', 'Pomodorini 150 g', 'Rucola', 'Aglio, peperoncino'],
    steps: ['Cuoci la pasta.', 'In padella salta i pomodorini tagliati con aglio e peperoncino per 5 minuti; aggiungi il tonno solo per scaldarlo.', 'Manteca la pasta con un mestolino d’acqua di cottura e chiudi con la rucola.'],
  },
  'Cous cous: 95 g crudo, ceci 150 g cotti, feta 60 g, peperoni': {
    title: 'Cous cous ceci e feta',
    time: '15 min', kcal: 720, protein: 33,
    ingredients: ['Cous cous 95 g', 'Ceci cotti 150 g', 'Feta 60 g', 'Peperoni 150 g', 'Menta o prezzemolo, limone'],
    steps: ['Versa sul cous cous lo stesso peso di acqua bollente salata, copri 5 minuti e sgrana con la forchetta.', 'Salta i peperoni a listarelle in padella finché sono morbidi.', 'Unisci ceci, peperoni, feta sbriciolata, erbe e limone.'],
  },
  'Poke: riso 100 g crudo, salmone idoneo al consumo crudo 150 g, edamame 100 g, verdure': {
    title: 'Poke al salmone',
    time: '20 min', kcal: 810, protein: 49,
    ingredients: ['Riso 100 g crudo (meglio da sushi)', 'Salmone abbattuto, idoneo al crudo, 150 g', 'Edamame sgusciati 100 g', 'Cetriolo, carota, cavolo viola', 'Salsa di soia, sesamo'],
    steps: ['Cuoci il riso e lascialo intiepidire (con un goccio d’aceto di riso se vuoi).', 'Taglia il salmone a cubetti e marinalo 5 minuti nella soia.', 'Componi la bowl a spicchi con riso, salmone, edamame e verdure; sesamo sopra.'],
  },
  'Wrap smash: 2 tortillas, macinato magro 160 g, lattuga, salsa yogurt': {
    title: 'Wrap smash burger',
    time: '15 min', kcal: 565, protein: 45,
    ingredients: ['Tortillas 2', 'Macinato magro di manzo 160 g', 'Lattuga, cipolla rossa', 'Yogurt greco 50 g, senape, cetriolino'],
    steps: ['Dividi il macinato in due palline e schiacciale forte sulla piastra rovente (smash): 2 minuti per lato, sale e pepe.', 'Prepara la salsa con yogurt, senape e cetriolino tritato.', 'Scalda le tortillas e farcisci con carne, salsa, lattuga e cipolla.'],
  },
  'Insalata di farro: farro 100 g crudo, sgombro 120 g, fagioli 100 g cotti, verdure': {
    title: 'Insalata di farro e sgombro',
    time: '30 min (o 5 con farro precotto)', kcal: 705, protein: 43,
    ingredients: ['Farro 100 g crudo', 'Sgombro al naturale 120 g', 'Fagioli cannellini cotti 100 g', 'Pomodorini, cetriolo, cipolla rossa', 'Limone, prezzemolo'],
    steps: ['Cuoci il farro 25–30 minuti (o usa quello precotto) e raffreddalo sotto l’acqua.', 'Taglia le verdure a dadini.', 'Unisci tutto con lo sgombro a pezzi, limone e prezzemolo.'],
  },
  'Pasta al pesto leggero: pasta 90 g cruda, pesto 20 g, pollo 150 g, fagiolini': {
    title: 'Pasta al pesto con pollo',
    time: '20 min', kcal: 620, protein: 49,
    ingredients: ['Pasta 90 g cruda', 'Pesto 20 g', 'Petto di pollo 150 g', 'Fagiolini 150 g'],
    steps: ['Cuoci i fagiolini nella stessa acqua della pasta (buttali 5 minuti prima).', 'Cuoci il pollo a straccetti in padella, 6–8 minuti.', 'Scola, condisci con il pesto allungato con un po’ d’acqua di cottura e unisci il pollo.'],
  },
  'Pasta bianca 100 g cruda con olio EVO 10 g + carne di cavallo 170–200 g + verdure': {
    title: 'Pasta bianca e cavallo',
    time: '15 min', kcal: 690, protein: 54,
    ingredients: ['Pasta 100 g cruda', 'Olio EVO 10 g', 'Bistecca o fettine di cavallo 170–200 g', 'Verdure a scelta 200 g', 'Parmigiano 5 g (facoltativo)'],
    steps: ['Cuoci la pasta e condiscila con l’olio a crudo.', 'Scotta la carne su piastra molto calda, 1–2 minuti per lato: il cavallo è magro e si asciuga se cuoce troppo.', 'Servi con le verdure grigliate o al vapore.'],
  },

  '2 piadine con tacchino e mozzarella light: 2 piadine, fesa di tacchino 140 g, mozzarella light 70 g, pomodoro e rucola': {
    title: '2 piadine tacchino e mozzarella light', time: '10 min', kcal: 850, protein: 59,
    ingredients: ['Piadine 2 (circa 90 g l’una; le integrali o “light” da 60 g fanno risparmiare ~200 kcal)', 'Fesa di tacchino 140 g', 'Mozzarella light 70 g', 'Pomodoro, rucola', 'Origano, pepe'],
    steps: ['Scalda le piadine in padella 1 minuto per lato.', 'Dividi mozzarella e tacchino tra le due, chiudi a mezzaluna e ripassale 1–2 minuti per lato finché la mozzarella si scioglie.', 'Apri e aggiungi pomodoro e rucola freschi. È il pasto più ricco del giorno: il lunedì c’è il calcio.'],
  },

  'Spuntino di metà mattina: cracker integrali 30 g': {
    title: 'Cracker di metà mattina', time: '1 min', kcal: 125, protein: 4,
    ingredients: ['Cracker integrali 30 g (una confezione monoporzione)', 'Acqua'],
    steps: ['Va bene così, è uno spuntino leggero.', 'Se a pranzo arrivi con troppa fame, aggiungi uno yogurt greco (≈ +100 kcal, +17 g proteine) o un frutto.'],
  },

  // ── Pre-calcio (lunedì e giovedì) ──
  'Pre-calcio: banana + 2 fette di pane con miele': {
    title: 'Pre-calcio veloce', time: '2 min', kcal: 300, protein: 7,
    ingredients: ['Banana 1', 'Pane 60 g (2 fette)', 'Miele 15 g', 'Acqua'],
    steps: ['Mangialo 1–2 ore prima della partita.', 'Carboidrati facili da digerire, pochi grassi e poche fibre: energia senza pesantezza.', 'Bevi 300–500 ml d’acqua nell’ora prima di giocare.'],
  },

  // ── Spuntini ──
  'Salato: skyr salato 170 g con cracker integrali 50 g': {
    title: 'Skyr salato e cracker',
    time: '2 min', kcal: 320, protein: 24,
    ingredients: ['Skyr 170 g', 'Cracker integrali 50 g', 'Sale, pepe, erba cipollina o paprika'],
    steps: ['Condisci lo skyr con sale, pepe ed erbe: diventa una crema salata.', 'Usalo come dip per i cracker.'],
  },
  'Panino piccolo 80 g con bresaola 80 g e rucola': {
    title: 'Panino bresaola e rucola',
    time: '2 min', kcal: 340, protein: 33,
    ingredients: ['Panino 80 g', 'Bresaola 80 g', 'Rucola', 'Limone'],
    steps: ['Apri il panino, farcisci con bresaola e rucola.', 'Qualche goccia di limone al posto della maionese.'],
  },
  'Hummus 80 g, carote e 2 gallette; aggiungi un frutto': {
    title: 'Hummus e verdure',
    time: '3 min', kcal: 410, protein: 10,
    ingredients: ['Hummus 80 g', 'Carote 2', 'Gallette di riso o mais 2', 'Frutto di stagione 1'],
    steps: ['Taglia le carote a bastoncini.', 'Pucciale nell’hummus insieme alle gallette; il frutto a parte.', 'È lo spuntino con meno proteine: se ti serve, aggiungi uno yogurt greco.'],
  },
  'Fiocchi di latte 200 g, pomodorini e pane 50 g': {
    title: 'Fiocchi di latte e pomodorini',
    time: '3 min', kcal: 350, protein: 29,
    ingredients: ['Fiocchi di latte 200 g', 'Pomodorini 100 g', 'Pane 50 g', 'Origano, pepe'],
    steps: ['Condisci i fiocchi di latte con pomodorini tagliati, origano e pepe.', 'Mangiali con il pane tostato.'],
  },
  'Edamame 150 g e un frutto': {
    title: 'Edamame e frutta',
    time: '5 min', kcal: 260, protein: 18,
    ingredients: ['Edamame 150 g (surgelati)', 'Frutto di stagione 1', 'Sale grosso'],
    steps: ['Lessa gli edamame 4–5 minuti (o microonde), scolali e sala.', 'Il frutto a parte.'],
  },
  'Yogurt greco 170 g, cacao e 15 g pistacchi': {
    title: 'Yogurt al cacao e pistacchi',
    time: '2 min', kcal: 215, protein: 21,
    ingredients: ['Yogurt greco 170 g', 'Cacao amaro 1 cucchiaino', 'Pistacchi 15 g'],
    steps: ['Mescola il cacao nello yogurt (dolcificante se ti serve).', 'Pistacchi tritati sopra.'],
  },
  'Toast 70 g con tacchino 80 g': {
    title: 'Toast al tacchino',
    time: '5 min', kcal: 265, protein: 24,
    ingredients: ['Pane per toast 70 g', 'Fesa di tacchino 80 g', 'Senape o un velo di formaggio spalmabile light'],
    steps: ['Farcisci il pane con tacchino e senape.', 'Tosta nel tostapane o in padella finché è croccante.'],
  },

  // ── Cene ──
  'Pollo alla piastra 200 g, riso 90 g crudo, verdure grigliate e olio EVO 10 g': {
    title: 'Pollo alla piastra con riso', time: '25 min', kcal: 680, protein: 55,
    ingredients: ['Petto di pollo 200 g', 'Riso basmati 90 g crudo', 'Zucchine e peperoni 200 g', 'Olio EVO 10 g', 'Limone, paprika, rosmarino'],
    steps: ['Cuoci il riso.', 'Batti il pollo a spessore uniforme, condiscilo con limone, paprika e sale e cuocilo sulla piastra calda 4–5 minuti per lato.', 'Griglia le verdure a fette; olio a crudo su tutto. Dopo il calcio: carboidrati + proteine per ricaricare e recuperare.'],
  },
  'Burger plate: burger magro 180 g, patate al forno 350 g, insalata, salsa yogurt': {
    title: 'Burger plate con patate',
    time: '40 min', kcal: 655, protein: 47,
    ingredients: ['Burger di manzo magro 180 g', 'Patate 350 g', 'Olio EVO 5 g, rosmarino', 'Insalata mista', 'Yogurt greco 50 g, senape, erbe'],
    steps: ['Taglia le patate a spicchi, condisci con olio e rosmarino e cuoci a 210 °C per 30–35 minuti (o friggitrice ad aria 20).', 'Cuoci il burger su piastra rovente 3–4 minuti per lato.', 'Servi con insalata e salsa di yogurt, senape ed erbe.'],
  },
  'Salmone 180 g, riso 80 g crudo, broccoli e limone': {
    title: 'Salmone, riso e broccoli',
    time: '25 min', kcal: 700, protein: 46,
    ingredients: ['Filetto di salmone 180 g', 'Riso 80 g crudo', 'Broccoli 250 g', 'Limone, aneto o prezzemolo'],
    steps: ['Cuoci il riso; i broccoli al vapore 6–8 minuti.', 'Cuoci il salmone dalla parte della pelle in padella calda, 4–5 minuti, poi 1–2 dall’altro lato.', 'Servi con limone ed erbe.'],
  },
  'Pollo croccante al forno 200 g, pane 90 g, verdure e salsa allo yogurt': {
    title: 'Pollo croccante al forno',
    time: '30 min', kcal: 620, protein: 60,
    ingredients: ['Petto di pollo 200 g', 'Cornflakes non zuccherati 20 g o pangrattato', 'Uovo o albume per impanare', 'Pane 90 g', 'Verdure 200 g, yogurt greco 50 g'],
    steps: ['Taglia il pollo a strisce, passalo nell’albume e poi nei cornflakes sbriciolati con paprika.', 'Forno a 200 °C per 18–20 minuti (o friggitrice ad aria 12), girando a metà.', 'Servi con pane, verdure e salsa allo yogurt.'],
  },
  'Poke casalinga: tonno cotto 170 g, riso 90 g crudo, avocado 60 g, carote': {
    title: 'Poke di tonno',
    time: '20 min', kcal: 660, protein: 56,
    ingredients: ['Tonno fresco 170 g (scottato) o al naturale', 'Riso 90 g crudo', 'Avocado 60 g', 'Carote, cetriolo', 'Salsa di soia, sesamo'],
    steps: ['Cuoci il riso.', 'Scotta il tonno 1 minuto per lato e taglialo a cubetti.', 'Componi la bowl con riso, tonno, avocado e verdure; soia e sesamo.'],
  },
  'Tacos fit: tortillas 2, tacchino 180 g, fagioli 120 g cotti, verdure': {
    title: 'Tacos fit al tacchino',
    time: '20 min', kcal: 650, protein: 59,
    ingredients: ['Tortillas 2', 'Macinato o straccetti di tacchino 180 g', 'Fagioli neri o borlotti cotti 120 g', 'Peperoni, cipolla, lattuga', 'Paprika, cumino, lime'],
    steps: ['Rosola il tacchino con cipolla e spezie per 8 minuti; aggiungi i fagioli per 2 minuti.', 'Scalda le tortillas in padella.', 'Riempi con carne, fagioli e verdure crude; lime sopra.'],
  },
  'Frittata: 3 uova, pane 100 g, spinaci e insalata': {
    title: 'Frittata agli spinaci',
    time: '15 min', kcal: 555, protein: 30,
    ingredients: ['Uova 3', 'Spinaci 150 g', 'Pane 100 g', 'Insalata', 'Olio 5 g, parmigiano 5 g facoltativo'],
    steps: ['Appassisci gli spinaci in padella con l’olio.', 'Versa le uova sbattute, cuoci a fuoco basso coperto 6–8 minuti, gira e finisci 2 minuti.', 'Servi con pane e insalata. Vuoi più proteine? Aggiungi 2 albumi.'],
  },
  'Bistecca magra 180 g, patate 300 g, verdure grigliate e olio EVO 10 g': {
    title: 'Bistecca e patate',
    time: '35 min', kcal: 600, protein: 48,
    ingredients: ['Bistecca magra (fesa, girello) 180 g', 'Patate 300 g', 'Zucchine e melanzane', 'Olio EVO 10 g, rosmarino'],
    steps: ['Lessa o cuoci al forno le patate a tocchetti (25–30 minuti).', 'Griglia le verdure a fette.', 'Scotta la bistecca 2–3 minuti per lato, riposo 2 minuti; olio a crudo su tutto.'],
  },
  'McDonald’s: scegli il panino che ti piace, porzione piccola/media di patatine e bevanda senza zuccheri; registra il pasto reale.': {
    title: 'McDonald’s',
    time: 'Fuori', kcal: 850, protein: 30,
    ingredients: ['Un panino a scelta (es. McChicken ~400 kcal, Big Mac ~510)', 'Patatine piccole (~230) o medie (~330)', 'Bevanda zero'],
    steps: ['Scegli il panino che ti va davvero: è previsto nel piano, niente sensi di colpa.', 'Patatine piccole o medie, non large; salse contate (una bustina ≈ 50–100 kcal).', 'Registra il pasto reale nel diario: le calorie ufficiali sono sul sito McDonald’s.'],
  },
  'Pizza a scelta + contorno o insalata. Mangiala senza compensazioni punitive.': {
    title: 'Pizza della domenica',
    time: 'Fuori', kcal: 1000, protein: 40,
    ingredients: ['Una pizza a scelta (una margherita ≈ 800–900 kcal)', 'Insalata o verdure grigliate'],
    steps: ['Scegli la pizza che ti piace; le farcite con salumi e formaggi extra arrivano a 1.100–1.300 kcal.', 'Parti dall’insalata: sazia e rallenta.', 'Niente digiuno il giorno dopo: il piano la prevede già.'],
  },
};

export const recipeFor = (meal) => mealRecipes[meal] || null;

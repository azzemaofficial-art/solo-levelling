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
    title: 'Waffle fit al pistacchio', tags: ['fit porn'],
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
  'Piadina colazione: piadina integrale, fesa di tacchino 100 g, fiocchi di latte 100 g': {
    title: 'Piadina tacchino e fiocchi di latte',
    time: '5 min', kcal: 450, protein: 41,
    ingredients: ['Piadina integrale 1 (circa 75 g)', 'Fesa di tacchino 100 g', 'Fiocchi di latte 100 g', 'Qualche foglia di spinacino o rucola'],
    steps: ['Scalda la piadina in padella 1 minuto per lato.', 'Farcisci con fiocchi di latte, tacchino e verdura.', 'Chiudi a mezzaluna e ripassala 30 secondi per lato.'],
  },
  'French toast: pane 100 g, 2 uova, yogurt 150 g, fragole': {
    title: 'French toast con fragole', tags: ['fit porn'],
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
    title: 'Poke al salmone', tags: ['orientale'],
    time: '20 min', kcal: 810, protein: 49,
    ingredients: ['Riso 100 g crudo (meglio da sushi)', 'Salmone abbattuto, idoneo al crudo, 150 g', 'Edamame sgusciati 100 g', 'Cetriolo, carota, cavolo viola', 'Salsa di soia, sesamo'],
    steps: ['Cuoci il riso e lascialo intiepidire (con un goccio d’aceto di riso se vuoi).', 'Taglia il salmone a cubetti e marinalo 5 minuti nella soia.', 'Componi la bowl a spicchi con riso, salmone, edamame e verdure; sesamo sopra.'],
  },
  'Wrap smash: 2 tortillas, macinato magro 160 g, lattuga, salsa yogurt': {
    title: 'Wrap smash burger', tags: ['fit porn'],
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
    title: 'Poke di tonno', tags: ['orientale'],
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

  // ══ Menu v2 (ottobre 2026): più varietà, cucina orientale, cipollotto, patate dolci, proteine in polvere ══
  // kcal/proteine calcolate ingrediente per ingrediente (valori medi CREA/USDA per 100 g, crudo).
  // Proteine in polvere (gusto chocowafer): whey ≈ 380 kcal e 78 g di proteine per 100 g (un misurino da 30 g
  // ≈ 115 kcal, 23 g). Solo dove servono: dopo il calcio e nel latte del weekend (richiesta del 9/10).

  // ── Colazioni nuove ──
  'Pancake alla banana: avena 50 g, 1 uovo, albume 150 g, banana, yogurt greco 100 g, frutti di bosco': {
    title: 'Pancake alla banana e frutti di bosco', tags: ['fit porn'],
    time: '10 min', kcal: 510, protein: 41,
    ingredients: ['Fiocchi d’avena 50 g (frullati)', 'Uovo 1 + albume 150 g', 'Mezza banana schiacciata', 'Yogurt greco 100 g, frutti di bosco 80 g', 'Sciroppo d’acero 10 g, cannella'],
    steps: ['Frulla avena, uovo, albume, banana e cannella: pastella densa e liscia (gli albumi fanno le proteine, niente polvere).', 'Cuoci 4–5 pancake in padella antiaderente appena unta, 1–2 minuti per lato.', 'Impila, metti sopra yogurt e frutti di bosco e chiudi con un filo di sciroppo d’acero.'],
  },
  'Toast burro d’arachidi e banana: pane integrale 70 g, burro d’arachidi 15 g, banana, skyr 200 g': {
    title: 'Toast burro d’arachidi e banana con skyr',
    time: '3 min', kcal: 460, protein: 33,
    ingredients: ['Pane integrale 70 g', 'Burro d’arachidi 15 g', 'Banana piccola', 'Skyr 200 g (anche con un cucchiaino di miele)'],
    steps: ['Tosta il pane e spalma il burro d’arachidi.', 'Banana a rondelle sopra.', 'Lo skyr a parte: sono le proteine della colazione.'],
  },
  'Overnight oats al cioccolato: avena 60 g, latte 150 ml, skyr 150 g, cacao, lamponi, miele': {
    title: 'Overnight oats al cioccolato e lamponi', tags: ['fit porn'],
    time: '5 min + notte', kcal: 460, protein: 32,
    ingredients: ['Fiocchi d’avena 60 g', 'Latte 150 ml', 'Skyr 150 g', 'Cacao amaro 8 g', 'Miele 5 g', 'Lamponi 80 g'],
    steps: ['In un barattolo mescola avena, latte, cacao e miele fino a sciogliere i grumi.', 'Aggiungi lo skyr a strati, chiudi e lascia in frigo tutta la notte.', 'Al mattino lamponi sopra: sembra un dolce al cucchiaio.'],
  },
  'Bagel salmone e cipollotto: bagel 90 g, salmone affumicato 60 g, spalmabile light 40 g, cipollotto, skyr 150 g con miele': {
    title: 'Bagel salmone e cipollotto', tags: ['cipollotto'],
    time: '5 min', kcal: 480, protein: 39,
    ingredients: ['Bagel 1 (90 g)', 'Salmone affumicato 60 g', 'Formaggio spalmabile light 40 g', 'Cipollotto 1, pepe nero', 'Skyr 150 g con un cucchiaino di miele'],
    steps: ['Tosta il bagel tagliato a metà.', 'Spalma il formaggio, adagia il salmone e cospargi di cipollotto a rondelle sottili e pepe.', 'A lato lo skyr col miele.'],
  },
  'Omelette cipollotto e feta: 3 uova, feta 30 g, cipollotto, pane integrale 60 g, pomodorini': {
    title: 'Omelette cipollotto e feta', tags: ['cipollotto'],
    time: '8 min', kcal: 470, protein: 32,
    ingredients: ['Uova 3', 'Feta 30 g', 'Cipollotto 1', 'Pane integrale 60 g', 'Pomodorini 100 g'],
    steps: ['Sbatti le uova con sale e pepe; affetta il cipollotto (il verde tienilo per la fine).', 'Versa in padella antiaderente calda, aggiungi feta sbriciolata e il bianco del cipollotto; piega quando è quasi rappresa.', 'Servi col verde del cipollotto sopra, pane tostato e pomodorini.'],
  },
  'Smoothie bowl al mango: skyr 300 g, mango 150 g, banana, granola 30 g, cocco': {
    title: 'Smoothie bowl al mango',
    time: '5 min', kcal: 500, protein: 38,
    ingredients: ['Skyr 300 g', 'Mango surgelato 150 g', 'Mezza banana', 'Granola 30 g', 'Cocco rapé 5 g'],
    steps: ['Frulla skyr, mango e banana: deve venire densa, da cucchiaio.', 'Versa nella ciotola.', 'Granola e cocco sopra all’ultimo, così restano croccanti.'],
  },
  'Porridge mela e cannella: avena 60 g, latte 200 ml, skyr 150 g, mela, noci 10 g': {
    title: 'Porridge mela e cannella',
    time: '7 min', kcal: 555, protein: 33,
    ingredients: ['Fiocchi d’avena 60 g', 'Latte 200 ml', 'Skyr 150 g', 'Mela 1', 'Noci 10 g, cannella'],
    steps: ['Cuoci avena e latte 4–5 minuti mescolando (o 2 minuti al microonde).', 'Fuori dal fuoco mescola lo skyr: diventa cremoso e pieno di proteine.', 'Sopra mela a cubetti saltata un minuto con la cannella, e noci.'],
  },
  'Pancake alla patata dolce: patata dolce cotta 100 g, avena 40 g, 1 uovo, albume 120 g, yogurt greco 100 g, sciroppo d’acero': {
    title: 'Pancake alla patata dolce e cannella', tags: ['patate dolci'],
    time: '10 min (con la patata dolce già cotta)', kcal: 455, protein: 37,
    ingredients: ['Patata dolce cotta 100 g (avanzata dalla cena o 5 min al microonde)', 'Fiocchi d’avena 40 g', 'Uovo 1 + albume 120 g', 'Yogurt greco 100 g, cannella', 'Sciroppo d’acero 10 g'],
    steps: ['Frulla patata dolce, avena, uovo, albume e cannella.', 'Cuoci piccoli pancake in padella antiaderente, 2 minuti per lato a fuoco medio.', 'Servi con yogurt e un filo di sciroppo d’acero.'],
  },
  'Latte e Gocciole: latte scremato 250 ml con proteine 25 g e 12 Gocciole': {
    title: 'Latte e Gocciole del weekend', tags: ['proteine in polvere'],
    time: '2 min', kcal: 890, protein: 38,
    ingredients: ['Latte scremato 250 ml', 'Proteine in polvere 25 g (gusto chocowafer)', '12 Gocciole (≈ 59 kcal l’una)'],
    steps: ['Sciogli le proteine nel latte (shaker o frullino), freddo o tiepido.', 'Conta 12 Gocciole e metti via il pacco: è la regola che fa funzionare il piano.', 'Rispetto a 15 Gocciole col latte normale: circa 110 kcal in meno e quasi il doppio di proteine.'],
  },

  // ── Pranzi nuovi ──
  'Bowl patata dolce e pollo: patate dolci 250 g, pollo 160 g, avocado 50 g, spinacino, salsa yogurt e lime': {
    title: 'Bowl patata dolce e pollo', tags: ['patate dolci'],
    time: '30 min (o la sera prima)', kcal: 560, protein: 48,
    ingredients: ['Patate dolci 250 g', 'Petto di pollo 160 g', 'Avocado 50 g', 'Spinacino 40 g', 'Yogurt greco 50 g, lime, olio EVO 5 g', 'Paprika affumicata, sale'],
    steps: ['Patate dolci a cubi con paprika e olio: forno a 210 °C per 25 minuti (o friggitrice ad aria 15).', 'Pollo a striscioline in padella, 6–8 minuti.', 'Ciotola: spinacino, patate, pollo, avocado a fette e salsa di yogurt e lime.'],
  },
  'Noodles saltati al manzo: noodles di riso 80 g, manzo magro 150 g, peperoni, carote e cipollotto, olio di sesamo 8 g': {
    title: 'Noodles saltati al manzo', tags: ['orientale', 'cipollotto'],
    time: '15 min', kcal: 620, protein: 43,
    ingredients: ['Noodles di riso 80 g', 'Manzo magro a striscioline 150 g', 'Peperoni e carote 200 g a julienne', 'Cipollotto 2', 'Olio di sesamo 8 g, salsa di soia 15 ml', 'Aglio, zenzero, peperoncino'],
    steps: ['Ammolla i noodles in acqua calda come da confezione.', 'In padella rovente (o wok) salta il manzo 2 minuti con olio di sesamo, aglio e zenzero; aggiungi le verdure per altri 3.', 'Unisci noodles e soia, salta un minuto e chiudi con tanto cipollotto fresco.'],
  },
  'Riso venere, gamberi ed edamame: riso venere 80 g, gamberi 150 g, edamame 80 g, avocado 40 g, cetriolo, sesamo': {
    title: 'Riso venere, gamberi ed edamame', tags: ['orientale'],
    time: '30 min (o la sera prima)', kcal: 625, protein: 46,
    ingredients: ['Riso venere 80 g', 'Gamberi sgusciati 150 g', 'Edamame 80 g', 'Avocado 40 g', 'Cetriolo', 'Sesamo 5 g, soia 10 ml, lime'],
    steps: ['Cuoci il riso venere (circa 18 minuti) e lascialo intiepidire.', 'Scotta i gamberi 2 minuti in padella; edamame 3 minuti in acqua bollente.', 'Componi la ciotola e condisci con soia, lime e sesamo tostato.'],
  },
  'Panino pollo croccante: pane 100 g, pollo 150 g in panko, cavolo rosso, salsa yogurt e sriracha': {
    title: 'Panino pollo croccante', tags: ['fit porn'],
    time: '20 min', kcal: 590, protein: 53,
    ingredients: ['Panino 100 g (tipo burger o ciabattina)', 'Petto di pollo 150 g', 'Panko 15 g, paprika', 'Cavolo rosso a julienne 60 g', 'Yogurt greco 60 g + sriracha a piacere', 'Olio 5 g (spray)'],
    steps: ['Batti il pollo sottile, passalo nel panko con la paprika e cuoci in friggitrice ad aria a 200 °C per 10–12 minuti.', 'Mescola yogurt e sriracha.', 'Panino tostato, salsa, cavolo e pollo croccante: schiaccia e taglia a metà.'],
  },
  'Pasta fredda tonno e cipollotto: pasta 90 g, tonno al naturale 140 g, mais 50 g, pomodorini, cipollotto, olio EVO 10 g': {
    title: 'Pasta fredda tonno e cipollotto', tags: ['cipollotto'],
    time: '15 min (o la sera prima)', kcal: 630, protein: 50,
    ingredients: ['Pasta corta 90 g', 'Tonno al naturale 140 g', 'Mais 50 g', 'Pomodorini 100 g', 'Cipollotto 1', 'Olio EVO 10 g, origano, limone'],
    steps: ['Cuoci la pasta al dente e raffreddala sotto l’acqua.', 'Mescola con tonno, mais, pomodorini e cipollotto a rondelle.', 'Condisci con olio, origano e scorza di limone: in frigo regge fino al giorno dopo.'],
  },
  'Burrito bowl al tacchino: riso 80 g, macinato di tacchino 160 g, fagioli neri 100 g, mais, pico de gallo, yogurt greco, avocado': {
    title: 'Burrito bowl al tacchino', tags: ['fit porn'],
    time: '20 min', kcal: 705, protein: 53,
    ingredients: ['Riso 80 g', 'Macinato di tacchino 160 g', 'Fagioli neri cotti 100 g', 'Mais 40 g', 'Pomodoro, cipolla rossa, coriandolo, lime (pico de gallo)', 'Yogurt greco 40 g, avocado 40 g', 'Cumino, paprika'],
    steps: ['Cuoci il riso; rosola il tacchino con cumino e paprika per 8 minuti.', 'Trita pomodoro, cipolla e coriandolo con il lime.', 'Ciotola a spicchi: riso, tacchino, fagioli, mais, pico de gallo, avocado e yogurt al centro.'],
  },
  'Gyudon: riso 90 g, manzo magro a fettine 150 g, cipolla, 1 uovo, soia e mirin, cipollotto': {
    title: 'Gyudon (riso e manzo alla giapponese)', tags: ['orientale', 'cipollotto'],
    time: '20 min', kcal: 670, protein: 48,
    ingredients: ['Riso 90 g', 'Manzo magro a fettine sottili 150 g', 'Cipolla 80 g', 'Uovo 1', 'Salsa di soia 15 ml, mirin 15 ml, zenzero', 'Cipollotto'],
    steps: ['Cuoci il riso.', 'Stufa la cipolla a spicchi con soia, mirin, zenzero e 50 ml d’acqua per 5 minuti; aggiungi il manzo e cuoci solo 2 minuti.', 'Versa su riso, uovo (morbido o in camicia) al centro e cipollotto sopra.'],
  },
  'Insalatona di pollo: pollo 180 g, insalata mista, avocado 40 g, mais 40 g, pane 40 g, olio EVO 5 g': {
    title: 'Insalatona di pollo (il pranzo della domenica)',
    time: '15 min', kcal: 500, protein: 51,
    ingredients: ['Petto di pollo 180 g', 'Insalata mista e pomodorini 200 g', 'Avocado 40 g', 'Mais 40 g', 'Pane 40 g a crostini', 'Olio EVO 5 g, aceto balsamico'],
    steps: ['Griglia il pollo e taglialo a fette.', 'Tosta il pane a cubetti in padella.', 'Insalata, pollo, avocado, mais e crostini: leggera ma piena di proteine, perché la sera c’è la pizza.'],
  },

  // ── Cene nuove ──
  'Pollo teriyaki: pollo 200 g, riso 80 g, broccoli, salsa teriyaki fatta in casa, sesamo e cipollotto': {
    title: 'Pollo teriyaki', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 685, protein: 59,
    ingredients: ['Petto o cosce di pollo senza pelle 200 g', 'Riso 80 g', 'Broccoli 150 g', 'Salsa di soia 20 ml, miele 12 g, zenzero, aglio', 'Sesamo 5 g, cipollotto', 'Olio 5 g'],
    steps: ['Cuoci il riso e i broccoli al vapore.', 'Rosola il pollo a pezzi 6 minuti; versa soia, miele, zenzero e aglio e fai ridurre finché la salsa diventa lucida e appiccicosa.', 'Su riso e broccoli, con sesamo e tanto cipollotto.'],
  },
  'Bibimbap: riso 80 g, manzo magro 130 g, 1 uovo, spinaci, carote, zucchine, gochujang, olio di sesamo': {
    title: 'Bibimbap', tags: ['orientale', 'fit porn'],
    time: '30 min', kcal: 685, protein: 47,
    ingredients: ['Riso 80 g', 'Manzo magro a striscioline 130 g', 'Uovo 1', 'Spinaci 100 g, carote e zucchine 160 g', 'Gochujang 15 g (pasta di peperoncino coreana)', 'Olio di sesamo 7 g, soia, aglio'],
    steps: ['Cuoci il riso; salta ogni verdura separatamente pochi minuti con un goccio di sesamo.', 'Rosola il manzo con soia e aglio; cuoci l’uovo all’occhio di bue con il tuorlo morbido.', 'Riso nella ciotola, verdure e manzo a spicchi, uovo al centro e gochujang: mescola tutto prima di mangiare.'],
  },
  'Salmone al miso: salmone 180 g, patate dolci 250 g al forno, pak choi, glassa miso e miele': {
    title: 'Salmone al miso con patate dolci', tags: ['orientale', 'patate dolci'],
    time: '35 min', kcal: 700, protein: 43,
    ingredients: ['Filetto di salmone 180 g', 'Patate dolci 250 g', 'Pak choi o bietole 150 g', 'Miso 10 g, miele 8 g, soia', 'Olio 5 g'],
    steps: ['Patate dolci a spicchi in forno a 210 °C per 25 minuti.', 'Spennella il salmone con miso, miele e soia e infornalo per gli ultimi 10–12 minuti: la glassa caramella.', 'Pak choi saltato 2 minuti in padella; impiatta con le patate dolci.'],
  },
  'Riso saltato ai gamberi: riso 80 g (meglio del giorno prima), gamberi 180 g, 2 uova, piselli, carote, cipollotto, olio di sesamo': {
    title: 'Riso saltato ai gamberi', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '20 min', kcal: 730, protein: 57,
    ingredients: ['Riso 80 g (cotto il giorno prima)', 'Gamberi sgusciati 180 g', 'Uova 2', 'Piselli 60 g, carote 50 g', 'Cipollotto 2', 'Olio di sesamo 8 g, soia 15 ml'],
    steps: ['Strapazza le uova nel wok e mettile da parte; salta i gamberi 2 minuti.', 'Salta piselli, carote e il bianco del cipollotto, poi il riso freddo a fuoco alto finché “scrocchia”.', 'Unisci uova, gamberi e soia; fuori dal fuoco tanto verde di cipollotto.'],
  },
  'Ramen di pollo: noodles 80 g, pollo 160 g, uovo marinato, funghi, pak choi, mais, brodo al miso, cipollotto': {
    title: 'Ramen di pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '30 min', kcal: 655, protein: 61,
    ingredients: ['Noodles da ramen 80 g', 'Petto di pollo 160 g', 'Uovo 1 (6 minuti e mezzo, marinato in soia)', 'Funghi 80 g, pak choi 100 g, mais 30 g', 'Miso 15 g, soia, zenzero, aglio, 500 ml d’acqua', 'Cipollotto, sesamo'],
    steps: ['Cuoci l’uovo 6 minuti e mezzo, raffreddalo, sbuccialo e lascialo nella soia mentre prepari il resto.', 'Brodo: acqua, zenzero e aglio; cuoci dentro pollo e funghi 10 minuti, poi sciogli il miso a fuoco spento.', 'Noodles nella ciotola, brodo, pollo a fette, pak choi, mais, uovo tagliato a metà e cipollotto.'],
  },
  'Manzo e broccoli: manzo magro 170 g, broccoli 200 g, riso jasmine 75 g, salsa di soia e ostrica, zenzero': {
    title: 'Manzo e broccoli', tags: ['orientale'],
    time: '25 min', kcal: 655, protein: 50,
    ingredients: ['Manzo magro a fettine 170 g', 'Broccoli 200 g', 'Riso jasmine 75 g', 'Salsa di soia 15 ml, salsa d’ostrica 10 g', 'Amido di mais 5 g, zenzero, aglio', 'Olio 7 g'],
    steps: ['Cuoci il riso; sbollenta i broccoli 2 minuti.', 'Infarina leggermente il manzo nell’amido e scottalo nel wok rovente un minuto per lato.', 'Aggiungi broccoli, soia, ostrica, zenzero e 3 cucchiai d’acqua: salsa lucida in un minuto.'],
  },
  'Curry verde di pollo: pollo 180 g, latte di cocco light 120 ml, zucchine e peperoni, riso 70 g, basilico e lime': {
    title: 'Curry verde di pollo', tags: ['orientale'],
    time: '25 min', kcal: 605, protein: 51,
    ingredients: ['Petto di pollo 180 g', 'Latte di cocco light 120 ml', 'Pasta di curry verde 15 g', 'Zucchine e peperoni 200 g', 'Riso 70 g', 'Basilico, lime'],
    steps: ['Cuoci il riso.', 'Sciogli la pasta di curry in padella con un po’ di latte di cocco, aggiungi pollo e verdure e cuoci 5 minuti.', 'Versa il resto del latte di cocco, cuoci altri 8 minuti; basilico e lime alla fine.'],
  },
  'Tacos coreani: 3 tortillas piccole, pollo 180 g al gochujang, insalata di cavolo e cipollotto, yogurt, sesamo': {
    title: 'Tacos coreani al pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 610, protein: 57,
    ingredients: ['Tortillas piccole 3 (90 g)', 'Petto di pollo 180 g', 'Gochujang 20 g, miele 5 g', 'Cavolo cappuccio e carote 120 g', 'Cipollotto, sesamo 3 g', 'Yogurt greco 50 g, lime'],
    steps: ['Marina il pollo a striscioline con gochujang e miele, poi cuocilo in padella rovente 6–7 minuti.', 'Cavolo e carote a julienne con lime e cipollotto.', 'Tortillas scaldate, insalata, pollo, una cucchiaiata di yogurt e sesamo.'],
  },
  'Patate dolci ripiene: patate dolci 300 g, macinato magro 150 g, fagioli neri, cheddar 20 g, yogurt greco e cipollotto': {
    title: 'Patate dolci ripiene (loaded)', tags: ['patate dolci', 'cipollotto', 'fit porn'],
    time: '40 min', kcal: 645, protein: 52,
    ingredients: ['Patate dolci 2 (300 g)', 'Macinato magro di manzo 150 g', 'Fagioli neri 80 g', 'Cheddar 20 g', 'Yogurt greco 50 g', 'Cipollotto, paprika affumicata, cumino'],
    steps: ['Cuoci le patate dolci intere a 200 °C per 35–40 minuti (o 8–10 al microonde, girandole).', 'Rosola il macinato con paprika e cumino, aggiungi i fagioli.', 'Apri le patate, riempile, cheddar sopra e 2 minuti di grill; yogurt e cipollotto per finire.'],
  },
  'Tataki di tonno: tonno fresco 160 g in crosta di sesamo, soba 70 g, edamame, cetriolo, salsa soia e lime': {
    title: 'Tataki di tonno e soba', tags: ['orientale'],
    time: '20 min', kcal: 620, protein: 59,
    ingredients: ['Tonno fresco 160 g (adatto al consumo poco cotto)', 'Sesamo 10 g', 'Soba (spaghetti di grano saraceno) 70 g', 'Edamame 60 g, cetriolo', 'Soia 15 ml, lime, olio di sesamo 5 g'],
    steps: ['Cuoci le soba, sciacquale fredde e condiscile con soia, lime e olio di sesamo.', 'Passa il tonno nel sesamo e scottalo in padella rovente 40 secondi per lato: dentro resta rosa.', 'Taglia a fette spesse e servi su soba, edamame e cetriolo.'],
  },
  'Pad thai di pollo: noodles di riso 75 g, pollo 160 g, 1 uovo, germogli di soia, arachidi 12 g, lime e cipollotto': {
    title: 'Pad thai di pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 720, protein: 56,
    ingredients: ['Noodles di riso 75 g', 'Petto di pollo 160 g', 'Uovo 1', 'Germogli di soia 80 g', 'Arachidi 12 g tritate', 'Soia 15 ml, zucchero di canna 8 g, lime, cipollotto, olio 7 g'],
    steps: ['Ammolla i noodles; salta il pollo a striscioline nel wok 5 minuti.', 'Spingi il pollo di lato, strapazza l’uovo, poi aggiungi noodles, soia, zucchero e lime.', 'Germogli all’ultimo minuto; servi con arachidi, cipollotto e uno spicchio di lime.'],
  },
  'Smash burger e patate: burger magro 180 g, patate al forno 300 g, insalata, salsa yogurt': {
    title: 'Smash burger e patate al forno', tags: ['fit porn'],
    time: '40 min', kcal: 555, protein: 50,
    ingredients: ['Macinato magro di manzo 180 g', 'Patate 300 g', 'Olio EVO 5 g, paprika, rosmarino', 'Insalata e cetriolini', 'Yogurt greco 50 g, senape, ketchup a piacere'],
    steps: ['Patate a spicchi con paprika, rosmarino e olio: forno a 220 °C per 30 minuti (o friggitrice ad aria 20).', 'Due palline di carne schiacciate forte sulla piastra rovente: 2 minuti per lato, crosticina scura.', 'Servi con le patate, insalata e salsa di yogurt e senape.'],
  },
  'Polpette di tacchino agrodolci: macinato di tacchino 180 g, panko, cipollotto, salsa agrodolce, riso 75 g, verdure': {
    title: 'Polpette di tacchino agrodolci', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '30 min', kcal: 665, protein: 48,
    ingredients: ['Macinato di tacchino 180 g', 'Panko 15 g', 'Cipollotto 2, zenzero', 'Salsa: passata 30 g, miele 10 g, soia 15 ml, aceto di riso', 'Riso 75 g', 'Verdure saltate 100 g, olio 7 g'],
    steps: ['Impasta tacchino, panko, cipollotto tritato e zenzero; forma 10–12 polpette.', 'Rosolale in padella 8–10 minuti, poi versa la salsa e lasciala glassare.', 'Su riso e verdure, con altro cipollotto sopra.'],
  },

  // ── Cene del giovedì (prima del calcio: tanti carboidrati, pochi grassi) ──
  'Pasta al pomodoro con tacchino: pasta 110 g, passata, tacchino 150 g a straccetti, parmigiano 10 g, olio EVO 8 g': {
    title: 'Pasta al pomodoro con tacchino',
    time: '20 min', kcal: 700, protein: 55,
    ingredients: ['Pasta 110 g', 'Passata 150 g, basilico', 'Fesa di tacchino a straccetti 150 g', 'Parmigiano 10 g', 'Olio EVO 8 g, aglio'],
    steps: ['Sugo veloce: aglio, olio e passata per 10 minuti.', 'Straccetti di tacchino in padella 4 minuti, poi nel sugo.', 'Manteca la pasta nel sugo; parmigiano e basilico. Da mangiare entro le 18:45.'],
  },
  'Gnocchi al pomodoro e pollo: gnocchi 300 g, passata, pollo 140 g, basilico, parmigiano 10 g': {
    title: 'Gnocchi al pomodoro e pollo',
    time: '20 min', kcal: 725, protein: 50,
    ingredients: ['Gnocchi di patate 300 g', 'Passata 150 g', 'Petto di pollo 140 g a cubetti', 'Basilico, parmigiano 10 g', 'Olio EVO 5 g'],
    steps: ['Rosola il pollo a cubetti, aggiungi la passata e cuoci 10 minuti.', 'Lessa gli gnocchi: sono pronti quando salgono a galla.', 'Saltali nel sugo con basilico e parmigiano.'],
  },
  'Udon in brodo: udon 300 g, pollo 150 g, spinaci, brodo al miso, cipollotto': {
    title: 'Udon in brodo con pollo', tags: ['orientale', 'cipollotto'],
    time: '20 min', kcal: 610, protein: 50,
    ingredients: ['Udon freschi 300 g', 'Petto di pollo 150 g', 'Spinaci 80 g', 'Miso 15 g, soia, zenzero', 'Cipollotto'],
    steps: ['Porta a bollore 500 ml d’acqua con zenzero; cuoci il pollo a fette 8 minuti.', 'Aggiungi udon e spinaci per 2–3 minuti; a fuoco spento sciogli il miso.', 'In ciotola con tanto cipollotto. Leggero da digerire prima della partita.'],
  },

  // ── Pre e dopo calcio (partita 21:30–23:00) ──
  'Pre-calcio: banana e 2 gallette con miele': {
    title: 'Pre-calcio veloce', time: '2 min', kcal: 200, protein: 3,
    ingredients: ['Banana 1', 'Gallette di riso 2', 'Miele 10 g', 'Acqua 300–500 ml'],
    steps: ['Verso le 20:45, 45–60 minuti prima della partita.', 'Solo carboidrati facili: la cena vera l’hai già fatta alle 18:45.', 'Bevi 300–500 ml d’acqua nell’ora prima di giocare.'],
  },
  'Pre-calcio: toast 50 g con marmellata': {
    title: 'Pre-calcio: toast e marmellata', time: '3 min', kcal: 180, protein: 5,
    ingredients: ['Pane 50 g', 'Marmellata 20 g', 'Acqua 300–500 ml'],
    steps: ['Verso le 20:45.', 'Pochi grassi e poche fibre: energia pronta senza pesantezza.', 'Bevi 300–500 ml d’acqua nell’ora prima di giocare.'],
  },
  'Dopo calcio: shake proteico 30 g con latte scremato, banana e 2 gallette': {
    title: 'Dopo calcio: shake e banana', tags: ['proteine in polvere'],
    time: '2 min', kcal: 365, protein: 35,
    ingredients: ['Proteine in polvere 30 g (chocowafer)', 'Latte scremato 250 ml', 'Banana 1', 'Gallette di riso 2'],
    steps: ['Prepara lo shaker prima di uscire: a fine partita aggiungi solo il latte (o bevilo con acqua e prendi il latte a casa).', 'Banana e gallette appena arrivi.', 'Basta così: alle 23 niente pasto enorme, dormi meglio e recuperi lo stesso.'],
  },
  'Dopo calcio: yogurt greco 200 g con proteine 15 g, cornflakes 30 g e frutti di bosco': {
    title: 'Dopo calcio: yogurt proteico croccante', tags: ['proteine in polvere'],
    time: '2 min', kcal: 350, protein: 35,
    ingredients: ['Yogurt greco 200 g', 'Proteine in polvere 15 g (chocowafer)', 'Cornflakes 30 g', 'Frutti di bosco 100 g (anche surgelati)'],
    steps: ['Mescola yogurt e proteine fino a una crema liscia.', 'Cornflakes e frutti di bosco sopra all’ultimo.', 'Fresco e leggero: alle 23 recuperi senza appesantirti.'],
  },
  'Dopo calcio: shake proteico 30 g con latte scremato e toast 60 g con miele': {
    title: 'Dopo calcio: shake e toast al miele', tags: ['proteine in polvere'],
    time: '3 min', kcal: 390, protein: 37,
    ingredients: ['Proteine in polvere 30 g (chocowafer)', 'Latte scremato 250 ml', 'Pane 60 g', 'Miele 10 g'],
    steps: ['Shake appena finisci di giocare.', 'Toast col miele a casa.', 'Poi a letto: carboidrati e proteine bastano per recuperare.'],
  },

  // ── Spuntini nuovi ──
  'Skyr 170 g e un frutto': {
    title: 'Skyr e frutta',
    time: '1 min', kcal: 185, protein: 19,
    ingredients: ['Skyr 170 g', 'Una mela o un altro frutto', 'Cannella a piacere'],
    steps: ['Skyr in una ciotola con cannella.', 'Il frutto a fette sopra o a parte.', 'Perfetto il venerdì: leggero e proteico prima di uscire.'],
  },
  'Budino di skyr al cacao: skyr 200 g, cacao, miele, fondente 10 g': {
    title: 'Budino di skyr al cacao', tags: ['fit porn'],
    time: '3 min', kcal: 235, protein: 25,
    ingredients: ['Skyr 200 g', 'Cacao amaro 8 g', 'Miele 10 g', 'Cioccolato fondente 85% 10 g'],
    steps: ['Mescola skyr, cacao e miele fino a una crema lucida (se è troppo densa, un cucchiaio di latte).', 'Grattugia il fondente sopra.', '10 minuti in frigo e sembra un budino vero.'],
  },

  // ── Venerdì sera ──
  'Uscita: 3–4 cocktail (contati nel piano)': {
    title: 'Venerdì: cocktail contati', time: 'Fuori', kcal: 750, protein: 0,
    ingredients: ['Gin tonic ≈ 170–190 kcal · vodka soda ≈ 100 · spritz ≈ 150–170', 'Moscow mule ≈ 180 · mojito ≈ 220–250', 'Piña colada o cocktail con panna ≈ 300–400', 'Una birra media (0,4 l) ≈ 170–200'],
    steps: ['Cena prima di uscire: mai bere a stomaco vuoto.', 'Un bicchiere d’acqua tra un cocktail e l’altro; preferisci i drink con acqua tonica o soda a quelli con succhi e panna.', 'Il 3° e il 4° cocktail sono quelli che pesano di più su sonno e recupero: se ne salti uno, sabato giochi meglio.'],
  },
};

export const recipeFor = (meal) => mealRecipes[meal] || null;

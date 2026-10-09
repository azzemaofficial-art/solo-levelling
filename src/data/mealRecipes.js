// Ricetta per ogni pasto del piano (chiave = testo esatto del pasto in cutPlan.js).
// kcal/proteine sono STIME da valori medi (CREA/USDA) sulle quantità scritte:
// condimenti extra, marche e porzioni reali le cambiano. Servono a orientarsi,
// il diario resta la misura vera.
export const mealRecipes = {
  // ── Colazioni ──
  'Waffle al cacao con frutti di bosco caldi: 2 uova, farina d’avena 50 g, cacao, yogurt greco 150 g, frutti di bosco, fondente 10 g': {
    title: 'Waffle al cacao con frutti di bosco caldi', tags: ['dolce', 'fit porn'],
    time: '15 min', kcal: 575, protein: 39, fiber: 14, fv: 100, cost: 2.66,
    ingredients: ['Uova 2', 'Farina d’avena 50 g', 'Cacao amaro 8 g, lievito ½ cucchiaino', 'Yogurt greco 150 g', 'Frutti di bosco surgelati 100 g', 'Sciroppo d’acero 10 g, fondente 85% 10 g'],
    steps: ['Mescola uova, farina d’avena, cacao, lievito e 2 cucchiai di yogurt; cuoci nella piastra per waffle 4–5 minuti.', 'Scalda i frutti di bosco in padella con lo sciroppo d’acero finché fanno una salsa.', 'Waffle, yogurt sopra, frutti di bosco caldi che colano e fondente fuso a filo.'],
  },
  'Toast salato: pane integrale 100 g, 2 uova, ricotta magra 100 g, pomodoro': {
    title: 'Toast salato uova e ricotta',
    time: '10 min', kcal: 525, protein: 33, fiber: 9, fv: 120, cost: 1.80,
    ingredients: ['Pane integrale 100 g (2–3 fette)', 'Uova 2', 'Ricotta magra 100 g', 'Pomodoro 1', 'Sale, pepe, origano'],
    steps: ['Tosta il pane.', 'Cuoci le uova strapazzate in padella antiaderente a fuoco medio-basso, senza grassi aggiunti.', 'Spalma la ricotta sul pane, aggiungi le uova e il pomodoro a fette; sale, pepe e origano.'],
  },
  'Piadina colazione: piadina integrale, fesa di tacchino 130 g, spalmabile light 30 g, spinacino': {
    title: 'Piadina tacchino e spalmabile', tags: ['affettati'],
    time: '5 min', kcal: 410, protein: 37, fiber: 5, fv: 30, cost: 3.26,
    ingredients: ['Piadina integrale 1 (circa 75 g)', 'Fesa di tacchino 130 g', 'Formaggio spalmabile light 30 g', 'Spinacino o rucola'],
    steps: ['Scalda la piadina in padella 1 minuto per lato.', 'Spalma il formaggio, poi tacchino e verdura.', 'Chiudi a mezzaluna e ripassala 30 secondi per lato.'],
  },
  'Yogurt bowl croccante: greco 250 g, muesli senza zuccheri aggiunti 60 g, kiwi, noci 15 g': {
    title: 'Yogurt bowl croccante', tags: ['dolce'],
    time: '3 min', kcal: 570, protein: 35, fiber: 10, fv: 150, cost: 2.29,
    ingredients: ['Yogurt greco 250 g', 'Muesli senza zuccheri aggiunti 60 g', 'Kiwi 2', 'Noci 15 g'],
    steps: ['Metti lo yogurt nella ciotola.', 'Aggiungi il muesli all’ultimo momento, così resta croccante.', 'Completa con kiwi a cubetti e noci spezzate.'],
  },

  // ── Pranzi ──
  'Rice bowl: riso integrale 100 g crudo, pollo 170 g, zucchine, olio EVO 10 g': {
    title: 'Rice bowl pollo e zucchine', tags: ['sera prima'],
    time: '35 min (riso integrale) o la sera prima', kcal: 685, protein: 51, fiber: 8, fv: 200, cost: 2.48,
    ingredients: ['Riso integrale 100 g crudo', 'Petto di pollo 170 g', 'Zucchine 200 g', 'Olio EVO 10 g', 'Salsa di soia iposodica, limone, paprika'],
    steps: ['Cuoci il riso integrale (circa 30 minuti, o usa quello precotto).', 'Taglia il pollo a cubetti, condiscilo con paprika e cuocilo in padella 8–10 minuti; aggiungi le zucchine a rondelle negli ultimi 5.', 'Componi la bowl e condisci a crudo con olio, soia e limone.'],
  },
  'Pasta integrale tonno e ceci: pasta integrale 70 g, tonno al naturale 140 g, ceci 60 g, pomodorini e rucola': {
    title: 'Pasta integrale tonno, ceci e pomodorini', tags: ['pesce', 'legumi'],
    time: '15 min', kcal: 510, protein: 51, fiber: 13, fv: 180, cost: 2.74,
    ingredients: ['Pasta integrale 70 g cruda', 'Tonno al naturale 140 g sgocciolato', 'Ceci cotti 60 g', 'Pomodorini 150 g', 'Rucola', 'Aglio, prezzemolo'],
    steps: ['Cuoci la pasta.', 'In padella salta i pomodorini tagliati con aglio per 5 minuti; aggiungi ceci e tonno solo per scaldarli.', 'Manteca la pasta con un mestolino d’acqua di cottura e chiudi con la rucola.'],
  },
  'Wrap smash: 2 tortillas da 50 g, macinato magro 160 g, lattuga, salsa yogurt': {
    title: 'Wrap smash burger', tags: ['fit porn', 'carne rossa'],
    time: '15 min', kcal: 555, protein: 48, fiber: 5, fv: 80, cost: 2.81,
    ingredients: ['Tortillas 2 da 50 g', 'Macinato magro di manzo 160 g', 'Lattuga, cipolla rossa', 'Yogurt greco 50 g, senape, cetriolino'],
    steps: ['Dividi il macinato in due palline e schiacciale forte sulla piastra rovente (smash): 2 minuti per lato, sale e pepe.', 'Prepara la salsa con yogurt, senape e cetriolino tritato.', 'Scalda le tortillas e farcisci con carne, salsa, lattuga e cipolla.'],
  },
  'Insalata di farro: farro 100 g crudo, sgombro 120 g, fagioli 100 g cotti, verdure': {
    title: 'Insalata di farro e sgombro', tags: ['pesce', 'legumi', 'sera prima'],
    time: '30 min (o 5 con farro precotto)', kcal: 700, protein: 48, fiber: 17, fv: 150, cost: 2.88,
    ingredients: ['Farro 100 g crudo', 'Sgombro al naturale 120 g', 'Fagioli cannellini cotti 100 g', 'Pomodorini, cetriolo, cipolla rossa', 'Limone, prezzemolo'],
    steps: ['Cuoci il farro 25–30 minuti (o usa quello precotto) e raffreddalo sotto l’acqua.', 'Taglia le verdure a dadini.', 'Unisci tutto con lo sgombro a pezzi, limone e prezzemolo.'],
  },
  'Pasta bianca 100 g cruda con olio EVO 10 g + carne di cavallo 170–200 g + verdure': {
    title: 'Pasta bianca e cavallo', tags: ['carne rossa'],
    time: '15 min', kcal: 715, protein: 54, fiber: 7, fv: 200, cost: 4.45,
    ingredients: ['Pasta 100 g cruda', 'Olio EVO 10 g', 'Bistecca o fettine di cavallo 170–200 g', 'Verdure a scelta 200 g', 'Parmigiano 5 g (facoltativo)'],
    steps: ['Cuoci la pasta e condiscila con l’olio a crudo.', 'Scotta la carne su piastra molto calda, 1–2 minuti per lato: il cavallo è magro e si asciuga se cuoce troppo.', 'Servi con le verdure grigliate o al vapore.'],
  },

  '2 piadine con tacchino e mozzarella light: 2 piadine, fesa di tacchino 140 g, mozzarella light 70 g, pomodoro e rucola': {
    title: '2 piadine tacchino e mozzarella light', tags: ['affettati'], time: '10 min', kcal: 850, protein: 59, fiber: 7, fv: 80, cost: 4.43,
    ingredients: ['Piadine 2 (circa 90 g l’una; le integrali o “light” da 60 g fanno risparmiare ~200 kcal)', 'Fesa di tacchino 140 g', 'Mozzarella light 70 g', 'Pomodoro, rucola', 'Origano, pepe'],
    steps: ['Scalda le piadine in padella 1 minuto per lato.', 'Dividi mozzarella e tacchino tra le due, chiudi a mezzaluna e ripassale 1–2 minuti per lato finché la mozzarella si scioglie.', 'Apri e aggiungi pomodoro e rucola freschi. È il pasto più ricco del giorno: il lunedì c’è il calcio.'],
  },

  'Spuntino di metà mattina: cracker integrali 30 g': {
    title: 'Cracker di metà mattina', time: '1 min', kcal: 125, protein: 3, fiber: 3, fv: 0, cost: 0.21,
    ingredients: ['Cracker integrali 30 g (una confezione monoporzione)', 'Acqua'],
    steps: ['Va bene così, è uno spuntino leggero.', 'Se a pranzo arrivi con troppa fame, aggiungi uno yogurt greco (≈ +100 kcal, +17 g proteine) o un frutto.'],
  },

  // ── Spuntini ──
  'Dip di skyr: skyr salato 170 g, cracker integrali 50 g e verdure crude 150 g': {
    title: 'Dip di skyr con cracker e verdure crude',
    time: '5 min', kcal: 355, protein: 26, fiber: 8, fv: 150, cost: 1.58,
    ingredients: ['Skyr 170 g', 'Cracker integrali 50 g', 'Carote, cetrioli e peperoni a bastoncini 150 g', 'Sale, pepe, erba cipollina o paprika dolce'],
    steps: ['Condisci lo skyr con sale, pepe ed erbe: diventa una crema salata.', 'Taglia le verdure a bastoncini.', 'Intingi verdure e cracker nella crema.'],
  },
  'Panino piccolo 80 g con bresaola 80 g e rucola': {
    title: 'Panino bresaola e rucola', tags: ['affettati'],
    time: '2 min', kcal: 345, protein: 33, fiber: 3, fv: 40, cost: 3.14,
    ingredients: ['Panino 80 g', 'Bresaola 80 g', 'Rucola', 'Limone'],
    steps: ['Apri il panino, farcisci con bresaola e rucola.', 'Qualche goccia di limone al posto della maionese.'],
  },
  'Caprese light: mozzarella light 125 g, pomodorini, basilico e pane 40 g': {
    title: 'Caprese light',
    time: '3 min', kcal: 350, protein: 31, fiber: 4, fv: 150, cost: 1.62,
    ingredients: ['Mozzarella light 125 g', 'Pomodorini 150 g', 'Basilico, origano, pepe', 'Pane 40 g'],
    steps: ['Taglia mozzarella e pomodorini.', 'Condisci con basilico, origano e pepe (l’olio qui non serve).', 'Pane tostato a lato.'],
  },
  'Edamame 150 g e un frutto': {
    title: 'Edamame e frutta', tags: ['legumi'],
    time: '5 min', kcal: 265, protein: 17, fiber: 11, fv: 150, cost: 1.20,
    ingredients: ['Edamame 150 g (surgelati)', 'Frutto di stagione 1', 'Sale grosso'],
    steps: ['Lessa gli edamame 4–5 minuti (o microonde), scolali e sala.', 'Il frutto a parte.'],
  },
  'Yogurt greco 170 g, cacao e 15 g pistacchi': {
    title: 'Yogurt al cacao e pistacchi',
    time: '2 min', kcal: 210, protein: 21, fiber: 3, fv: 0, cost: 1.38,
    ingredients: ['Yogurt greco 170 g', 'Cacao amaro 1 cucchiaino', 'Pistacchi 15 g'],
    steps: ['Mescola il cacao nello yogurt (dolcificante se ti serve).', 'Pistacchi tritati sopra.'],
  },

  // ── Cene ──
  'Tacos fit: tortillas 2, tacchino 180 g, fagioli 120 g cotti, verdure': {
    title: 'Tacos fit al tacchino', tags: ['legumi'],
    time: '20 min', kcal: 595, protein: 55, fiber: 13, fv: 150, cost: 2.84,
    ingredients: ['Tortillas 2', 'Macinato o straccetti di tacchino 180 g', 'Fagioli neri o borlotti cotti 120 g', 'Peperoni, cipolla, lattuga', 'Paprika, cumino, lime'],
    steps: ['Rosola il tacchino con cipolla e spezie per 8 minuti; aggiungi i fagioli per 2 minuti.', 'Scalda le tortillas in padella.', 'Riempi con carne, fagioli e verdure crude; lime sopra.'],
  },
  'McDonald’s: scegli il panino che ti piace, porzione piccola/media di patatine e bevanda senza zuccheri, poi un frutto a casa; registra il pasto reale.': {
    title: 'McDonald’s',
    time: 'Fuori', kcal: 930, protein: 30, fiber: 10, fv: 150,
    ingredients: ['Un panino a scelta (es. McChicken ~400 kcal, Big Mac ~510)', 'Patatine piccole (~230) o medie (~330)', 'Bevanda zero', 'Un frutto a casa (mela, pera, arancia)'],
    steps: ['Scegli il panino che ti va davvero: è previsto nel piano, niente sensi di colpa.', 'Patatine piccole o medie, non large; salse contate (una bustina ≈ 50–100 kcal).', 'A casa un frutto: è il giorno con meno frutta e verdura della settimana. Registra il pasto reale nel diario.'],
  },
  'Pizza a scelta + contorno o insalata. Mangiala senza compensazioni punitive.': {
    title: 'Pizza della domenica',
    time: 'Fuori', kcal: 1000, protein: 40, fiber: 8, fv: 100,
    ingredients: ['Una pizza a scelta (una margherita ≈ 800–900 kcal)', 'Insalata o verdure grigliate'],
    steps: ['Scegli la pizza che ti piace; le farcite con salumi e formaggi extra arrivano a 1.100–1.300 kcal.', 'Parti dall’insalata: sazia e rallenta.', 'Niente digiuno il giorno dopo: il piano la prevede già.'],
  },

  // ══ Menu v2 (ottobre 2026): più varietà, cucina orientale, cipollotto, patate dolci, proteine in polvere ══
  // kcal/proteine calcolate ingrediente per ingrediente (valori medi CREA/USDA per 100 g, crudo).
  // Proteine in polvere (gusto chocowafer): whey ≈ 380 kcal e 78 g di proteine per 100 g (un misurino da 30 g
  // ≈ 115 kcal, 23 g). Solo dove servono: dopo il calcio e nel latte del weekend (richiesta del 9/10).

  // ── Colazioni nuove ──
  'Pancake alla banana: avena 50 g, 1 uovo, albume 150 g, banana, yogurt greco 100 g, frutti di bosco': {
    title: 'Pancake alla banana e frutti di bosco', tags: ['fit porn', 'dolce'],
    time: '10 min', kcal: 510, protein: 41, fiber: 11, fv: 140, cost: 2.60,
    ingredients: ['Fiocchi d’avena 50 g (frullati)', 'Uovo 1 + albume 150 g', 'Mezza banana schiacciata', 'Yogurt greco 100 g, frutti di bosco 80 g', 'Sciroppo d’acero 10 g, cannella'],
    steps: ['Frulla avena, uovo, albume, banana e cannella: pastella densa e liscia (gli albumi fanno le proteine, niente polvere).', 'Cuoci 4–5 pancake in padella antiaderente appena unta, 1–2 minuti per lato.', 'Impila, metti sopra yogurt e frutti di bosco e chiudi con un filo di sciroppo d’acero.'],
  },
  'Toast burro d’arachidi e banana: pane integrale 70 g, burro d’arachidi 15 g, banana, skyr 200 g': {
    title: 'Toast burro d’arachidi e banana con skyr', tags: ['dolce'],
    time: '3 min', kcal: 460, protein: 33, fiber: 8, fv: 80, cost: 1.54,
    ingredients: ['Pane integrale 70 g', 'Burro d’arachidi 15 g', 'Banana piccola', 'Skyr 200 g (anche con un cucchiaino di miele)'],
    steps: ['Tosta il pane e spalma il burro d’arachidi.', 'Banana a rondelle sopra.', 'Lo skyr a parte: sono le proteine della colazione.'],
  },
  'Overnight oats cioccolato e burro d’arachidi: avena 50 g, latte 150 ml, skyr 150 g, cacao, banana, burro d’arachidi 10 g': {
    title: 'Overnight oats cioccolato, banana e burro d’arachidi', tags: ['dolce', 'sera prima', 'fit porn'],
    time: '5 min la sera prima', kcal: 480, protein: 33, fiber: 10, fv: 60, cost: 1.37,
    ingredients: ['Fiocchi d’avena 50 g', 'Latte 150 ml', 'Skyr 150 g', 'Cacao amaro 8 g', 'Mezza banana', 'Burro d’arachidi 10 g'],
    steps: ['La sera: mescola avena, latte e cacao; aggiungi lo skyr e metti in frigo.', 'Al mattino: banana a rondelle sopra.', 'Burro d’arachidi scaldato 10 secondi a filo: colata lucida sul cioccolato.'],
  },
  'Omelette cipollotto e feta: 3 uova, feta 30 g, cipollotto, pane integrale 60 g, pomodorini': {
    title: 'Omelette cipollotto e feta', tags: ['cipollotto'],
    time: '8 min', kcal: 470, protein: 32, fiber: 7, fv: 130, cost: 1.71,
    ingredients: ['Uova 3', 'Feta 30 g', 'Cipollotto 1', 'Pane integrale 60 g', 'Pomodorini 100 g'],
    steps: ['Sbatti le uova con sale e pepe; affetta il cipollotto (il verde tienilo per la fine).', 'Versa in padella antiaderente calda, aggiungi feta sbriciolata e il bianco del cipollotto; piega quando è quasi rappresa.', 'Servi col verde del cipollotto sopra, pane tostato e pomodorini.'],
  },
  'Smoothie bowl al mango: skyr 300 g, mango 150 g, banana, granola 30 g, cocco': {
    title: 'Smoothie bowl al mango', tags: ['fit porn', 'dolce'],
    time: '5 min', kcal: 500, protein: 38, fiber: 7, fv: 210, cost: 2.96,
    ingredients: ['Skyr 300 g', 'Mango surgelato 150 g', 'Mezza banana', 'Granola 30 g', 'Cocco rapé 5 g'],
    steps: ['Frulla skyr, mango e banana: deve venire densa, da cucchiaio.', 'Versa nella ciotola.', 'Granola e cocco sopra all’ultimo, così restano croccanti.'],
  },
  'Porridge mela e cannella: avena 60 g, latte 200 ml, skyr 150 g, mela, noci 10 g': {
    title: 'Porridge mela e cannella', tags: ['dolce'],
    time: '7 min', kcal: 555, protein: 33, fiber: 10, fv: 150, cost: 1.60,
    ingredients: ['Fiocchi d’avena 60 g', 'Latte 200 ml', 'Skyr 150 g', 'Mela 1', 'Noci 10 g, cannella'],
    steps: ['Cuoci avena e latte 4–5 minuti mescolando (o 2 minuti al microonde).', 'Fuori dal fuoco mescola lo skyr: diventa cremoso e pieno di proteine.', 'Sopra mela a cubetti saltata un minuto con la cannella, e noci.'],
  },
  'Latte e Gocciole: latte scremato 250 ml con proteine 25 g, 8 Gocciole e un frutto': {
    title: 'Latte e Gocciole del weekend', tags: ['proteine in polvere'],
    time: '2 min', kcal: 745, protein: 35, fiber: 7, fv: 160, cost: 1.83,
    ingredients: ['Latte scremato 250 ml', 'Proteine in polvere 25 g (gusto chocowafer)', '8 Gocciole (≈ 59 kcal l’una)', 'Una pera (o 2 kiwi): più fibre della mela'],
    steps: ['Sciogli le proteine nel latte (shaker o frullino), freddo o tiepido.', 'Conta 8 Gocciole e metti via il pacco; il frutto dà volume e fibre senza molte calorie.', 'Rispetto a 15 Gocciole col latte normale: circa 260 kcal in meno e quasi il doppio di proteine.'],
  },

  // ── Pranzi nuovi ──
  'Noodles saltati al manzo: noodles di riso 80 g, manzo magro 150 g, peperoni, carote e cipollotto, olio di sesamo 8 g': {
    title: 'Noodles saltati al manzo', tags: ['orientale', 'cipollotto', 'carne rossa'],
    time: '15 min', kcal: 620, protein: 43, fiber: 6, fv: 230, cost: 3.72,
    ingredients: ['Noodles di riso 80 g', 'Manzo magro a striscioline 150 g', 'Peperoni e carote 200 g a julienne', 'Cipollotto 2', 'Olio di sesamo 8 g, salsa di soia 15 ml', 'Aglio, zenzero'],
    steps: ['Ammolla i noodles in acqua calda come da confezione.', 'In padella rovente (o wok) salta il manzo 2 minuti con olio di sesamo, aglio e zenzero; aggiungi le verdure per altri 3.', 'Unisci noodles e soia, salta un minuto e chiudi con tanto cipollotto fresco.'],
  },
  'Panino pollo croccante: pane 100 g, pollo 150 g in panko, cavolo rosso, salsa yogurt, senape e miele': {
    title: 'Panino pollo croccante', tags: ['fit porn', 'pollo al forno'],
    time: '20 min', kcal: 605, protein: 53, fiber: 5, fv: 60, cost: 2.24,
    ingredients: ['Panino 100 g (tipo burger o ciabattina)', 'Petto di pollo 150 g', 'Panko 15 g, paprika dolce', 'Cavolo rosso a julienne 60 g', 'Yogurt greco 60 g, senape, miele 5 g', 'Olio 5 g (spray)'],
    steps: ['Batti il pollo sottile, passalo nel panko con la paprika dolce e cuoci in friggitrice ad aria a 200 °C per 10–12 minuti.', 'Mescola yogurt, senape e miele: salsa honey mustard.', 'Panino tostato, salsa, cavolo e pollo croccante: schiaccia e taglia a metà.'],
  },
  'Pasta fredda tonno e cipollotto: pasta integrale 90 g, tonno al naturale 140 g, mais 50 g, pomodorini, cipollotto, olio EVO 10 g': {
    title: 'Pasta fredda tonno e cipollotto', tags: ['cipollotto', 'pesce', 'sera prima'],
    time: '15 min (o la sera prima)', kcal: 615, protein: 50, fiber: 11, fv: 170, cost: 2.78,
    ingredients: ['Pasta integrale corta 90 g', 'Tonno al naturale 140 g', 'Mais 50 g', 'Pomodorini 100 g', 'Cipollotto 1', 'Olio EVO 10 g, origano, limone'],
    steps: ['Cuoci la pasta al dente e raffreddala sotto l’acqua.', 'Mescola con tonno, mais, pomodorini e cipollotto a rondelle.', 'Condisci con olio, origano e scorza di limone: in frigo regge fino al giorno dopo.'],
  },
  'Burrito bowl al tacchino: riso integrale 80 g, macinato di tacchino 160 g, fagioli neri 100 g, mais, pico de gallo, yogurt greco, avocado': {
    title: 'Burrito bowl al tacchino', tags: ['fit porn', 'legumi', 'sera prima'],
    time: '30 min (riso integrale) o la sera prima', kcal: 700, protein: 54, fiber: 15, fv: 160, cost: 2.94,
    ingredients: ['Riso integrale 80 g', 'Macinato di tacchino 160 g', 'Fagioli neri cotti 100 g', 'Mais 40 g', 'Pomodoro, cipolla rossa, coriandolo, lime (pico de gallo)', 'Yogurt greco 40 g, avocado 40 g', 'Cumino, paprika dolce'],
    steps: ['Cuoci il riso integrale; rosola il tacchino con cumino e paprika per 8 minuti.', 'Trita pomodoro, cipolla e coriandolo con il lime.', 'Ciotola a spicchi: riso, tacchino, fagioli, mais, pico de gallo, avocado e yogurt al centro.'],
  },

  // ── Cene nuove ──
  'Bibimbap: riso 80 g, manzo magro 130 g, 1 uovo, spinaci, carote, zucchine, salsa di soia e miele, olio di sesamo': {
    title: 'Bibimbap', tags: ['orientale', 'fit porn', 'carne rossa'],
    time: '30 min', kcal: 690, protein: 48, fiber: 7, fv: 260, cost: 3.44,
    ingredients: ['Riso 80 g', 'Manzo magro a striscioline 130 g', 'Uovo 1', 'Spinaci 100 g, carote e zucchine 160 g', 'Salsa: soia iposodica 10 ml, miele 5 g, sesamo 3 g', 'Olio di sesamo 7 g, aglio'],
    steps: ['Cuoci il riso; salta ogni verdura separatamente pochi minuti con un goccio di sesamo.', 'Rosola il manzo con soia e aglio; cuoci l’uovo all’occhio di bue con il tuorlo morbido.', 'Riso nella ciotola, verdure e manzo a spicchi, uovo al centro e salsa dolce di soia e miele: mescola tutto prima di mangiare (versione senza piccante).'],
  },
  'Ramen di pollo: noodles 80 g, pollo 160 g, uovo marinato, funghi, pak choi, mais, brodo al miso, cipollotto': {
    title: 'Ramen di pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '30 min', kcal: 655, protein: 61, fiber: 8, fv: 230, cost: 3.53,
    ingredients: ['Noodles da ramen 80 g', 'Petto di pollo 160 g', 'Uovo 1 (6 minuti e mezzo, marinato in soia)', 'Funghi 80 g, pak choi 100 g, mais 30 g', 'Miso 15 g, soia, zenzero, aglio, 500 ml d’acqua', 'Cipollotto, sesamo'],
    steps: ['Cuoci l’uovo 6 minuti e mezzo, raffreddalo, sbuccialo e lascialo nella soia mentre prepari il resto.', 'Brodo: acqua, zenzero e aglio; cuoci dentro pollo e funghi 10 minuti, poi sciogli il miso a fuoco spento.', 'Noodles nella ciotola, brodo, pollo a fette, pak choi, mais, uovo tagliato a metà e cipollotto.'],
  },
  'Curry giapponese di pollo: pollo 180 g, patate 150 g, carote, cipolla, curry delicato, riso 60 g': {
    title: 'Curry giapponese di pollo', tags: ['orientale', 'fit porn'],
    time: '35 min', kcal: 685, protein: 53, fiber: 10, fv: 180, cost: 2.54,
    ingredients: ['Petto di pollo 180 g a pezzi', 'Patate 150 g, carote 100 g, cipolla 80 g', 'Curry in polvere delicato 6 g, farina 10 g', 'Brodo vegetale 300 ml, un cucchiaino di miele', 'Riso 60 g', 'Olio 5 g'],
    steps: ['Rosola cipolla e pollo nell’olio, aggiungi patate e carote a tocchetti.', 'Spolvera curry e farina, mescola un minuto, versa il brodo e cuoci 20 minuti finché la salsa è densa e lucida.', 'Servi col riso accanto, alla giapponese: dolce e delicato, per niente piccante.'],
  },
  'Tacos bulgogi: 3 tortillas piccole, pollo 180 g marinato in soia e pera, insalata di cavolo e cipollotto, yogurt, sesamo': {
    title: 'Tacos bulgogi di pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 590, protein: 58, fiber: 7, fv: 160, cost: 2.87,
    ingredients: ['Tortillas piccole 3 (90 g)', 'Petto di pollo 180 g', 'Marinata: soia iposodica 15 ml, pera grattugiata 20 g, miele 5 g, aglio', 'Cavolo cappuccio e carote 120 g', 'Cipollotto, sesamo 3 g', 'Yogurt greco 50 g, lime'],
    steps: ['Marina il pollo a striscioline 15 minuti in soia, pera, miele e aglio (la pera lo rende tenero e dolce), poi cuocilo in padella rovente 6–7 minuti.', 'Cavolo e carote a julienne con lime e cipollotto.', 'Tortillas scaldate, insalata, pollo glassato, una cucchiaiata di yogurt e sesamo.'],
  },
  'Patatine dolci loaded: patatine di patate dolci in friggitrice 300 g, macinato magro 150 g, fagioli neri, cheddar 20 g, yogurt e cipollotto': {
    title: 'Patatine dolci loaded', tags: ['cipollotto', 'fit porn', 'carne rossa', 'legumi', 'patate dolci'],
    time: '30 min', kcal: 705, protein: 53, fiber: 16, fv: 80, cost: 3.54,
    ingredients: ['Patate dolci 300 g a bastoncini', 'Olio 5 g (spray)', 'Macinato magro di manzo 150 g', 'Fagioli neri 80 g', 'Cheddar 20 g', 'Yogurt greco 50 g, pomodoro a cubetti, cipollotto, paprika dolce, cumino'],
    steps: ['Patatine di patate dolci in friggitrice ad aria 200 °C per 15–18 minuti.', 'Rosola il macinato con paprika e cumino, aggiungi i fagioli.', 'Patatine nel piatto, carne e fagioli sopra, cheddar, 1 minuto in friggitrice per farlo filare; yogurt, pomodoro e cipollotto.'],
  },
  'Pad thai di pollo: noodles di riso 75 g, pollo 160 g, 1 uovo, germogli di soia, arachidi 12 g, lime e cipollotto': {
    title: 'Pad thai di pollo', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 720, protein: 56, fiber: 4, fv: 100, cost: 3.11,
    ingredients: ['Noodles di riso 75 g', 'Petto di pollo 160 g', 'Uovo 1', 'Germogli di soia 80 g', 'Arachidi 12 g tritate', 'Soia 15 ml, zucchero di canna 8 g, lime, cipollotto, olio 7 g'],
    steps: ['Ammolla i noodles; salta il pollo a striscioline nel wok 5 minuti.', 'Spingi il pollo di lato, strapazza l’uovo, poi aggiungi noodles, soia, zucchero e lime.', 'Germogli all’ultimo minuto; servi con arachidi, cipollotto e uno spicchio di lime.'],
  },
  'Smash burger e patatine di patate dolci: burger magro 180 g, patatine di patate dolci in friggitrice 300 g, insalata grande, salsa yogurt': {
    title: 'Smash burger e patatine di patate dolci', tags: ['fit porn', 'carne rossa', 'patate dolci'],
    time: '30 min', kcal: 645, protein: 50, fiber: 12, fv: 150, cost: 3.60,
    ingredients: ['Macinato magro di manzo 180 g', 'Patate dolci 300 g a bastoncini', 'Olio 5 g (spray), paprika', 'Insalata grande e cetriolini 150 g, condita con olio EVO 5 g', 'Salsa burger: yogurt greco 50 g, senape, un cucchiaino di ketchup, cetriolino tritato'],
    steps: ['Patatine di patate dolci in friggitrice ad aria 200 °C per 15–18 minuti, scuotendo a metà.', 'Due palline di carne schiacciate forte sulla piastra rovente: 2 minuti per lato, crosticina scura.', 'Servi con le patatine, l’insalata e la salsa burger.'],
  },
  'Polpette di tacchino agrodolci: macinato di tacchino 180 g, panko, cipollotto, salsa agrodolce, riso 75 g, verdure': {
    title: 'Polpette di tacchino agrodolci', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '30 min', kcal: 665, protein: 48, fiber: 4, fv: 150, cost: 2.54,
    ingredients: ['Macinato di tacchino 180 g', 'Panko 15 g', 'Cipollotto 2, zenzero', 'Salsa: passata 30 g, miele 10 g, soia 15 ml, aceto di riso', 'Riso 75 g', 'Verdure saltate 100 g, olio 7 g'],
    steps: ['Impasta tacchino, panko, cipollotto tritato e zenzero; forma 10–12 polpette.', 'Rosolale in padella 8–10 minuti, poi versa la salsa e lasciala glassare.', 'Su riso e verdure, con altro cipollotto sopra.'],
  },

  // ── Menu v3: più fit porn a colazione e a pranzo (idee coreane, giapponesi, cinesi; niente piccante) ──
  'Tamago sando: pane in cassetta 80 g, 3 uova sode, yogurt greco 50 g, senape e cipollotto, un kiwi': {
    title: 'Tamago sando (panino giapponese all’uovo)', tags: ['orientale', 'cipollotto', 'fit porn', 'sera prima'],
    time: '10 min (uova sode pronte dalla sera)', kcal: 505, protein: 33, fiber: 5, fv: 90, cost: 1.58,
    ingredients: ['Pane in cassetta 80 g (2 fette spesse)', 'Uova 3, sode', 'Yogurt greco 50 g al posto della maionese', 'Senape, sale, pepe, cipollotto', 'Un kiwi'],
    steps: ['Schiaccia le uova sode con yogurt, senape, sale, pepe e cipollotto tritato: crema morbida.', 'Spalmala alta fra le due fette, premi, togli la crosta se vuoi.', 'Taglia a metà in diagonale: è il panino all’uovo dei konbini, ma senza maionese. Kiwi a lato.'],
  },
  'Jianbing: crêpe con farina 50 g e 2 uova, tacchino 80 g, cipollotto, salsa hoisin 10 g, lattuga': {
    title: 'Jianbing (crêpe cinese di strada)', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '10 min', kcal: 435, protein: 39, fiber: 2, fv: 50, cost: 1.66,
    ingredients: ['Farina 50 g + 80 ml d’acqua', 'Uova 2', 'Fesa di tacchino 80 g', 'Cipollotto e coriandolo (o prezzemolo)', 'Salsa hoisin 10 g (dolce, non piccante)', 'Lattuga'],
    steps: ['Stendi la pastella sottile in una padella grande antiaderente; quando si stacca, rompi sopra le uova e spalmale su tutta la crêpe.', 'Cospargi di cipollotto, gira, spennella la hoisin.', 'Aggiungi tacchino e lattuga, piega in quattro: croccante fuori, morbida dentro.'],
  },
  'Bento katsu: pollo 170 g in panko al forno, riso 80 g, cavolo a julienne 150 g, salsa tonkatsu': {
    title: 'Bento katsu di pollo', tags: ['orientale', 'fit porn', 'pollo al forno'],
    time: '25 min', kcal: 615, protein: 52, fiber: 5, fv: 150, cost: 2.34,
    ingredients: ['Petto di pollo 170 g', 'Panko 20 g, albume 20 g', 'Riso 80 g', 'Cavolo cappuccio a julienne 150 g', 'Salsa tonkatsu 15 g'],
    steps: ['Batti il pollo, passalo nell’albume e poi nel panko; forno ventilato a 210 °C (o friggitrice ad aria) per 15 minuti, girandolo a metà.', 'Cuoci il riso.', 'Bento: riso, una montagna di cavolo, cotoletta tagliata a strisce e salsa tonkatsu a zig-zag.'],
  },
  'Oyakodon: riso 90 g, pollo 160 g, 2 uova, cipolla, soia e mirin, cipollotto, spinaci al sesamo': {
    title: 'Oyakodon (pollo e uovo su riso)', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '20 min', kcal: 725, protein: 62, fiber: 5, fv: 170, cost: 2.88,
    ingredients: ['Riso 90 g', 'Petto o coscia di pollo 160 g a bocconcini', 'Uova 2', 'Cipolla 60 g', 'Soia iposodica 15 ml, mirin 10 ml, 60 ml d’acqua', 'Cipollotto', 'Spinaci 100 g con sesamo (gomae)'],
    steps: ['Cuoci il riso; sbollenta gli spinaci un minuto, strizzali e condiscili con un pizzico di sesamo e soia.', 'In un padellino sobbolli cipolla, soia, mirin e acqua; aggiungi il pollo e cuoci 6–7 minuti.', 'Versa le uova sbattute appena, coperchio 1 minuto: devono restare cremose. Fai scivolare sul riso, cipollotto sopra, spinaci a lato.'],
  },
  'Kimbap al tonno: riso 90 g, tonno al naturale 120 g, 1 uovo, carota, cetriolo, spinaci, alga nori': {
    title: 'Kimbap al tonno', tags: ['orientale', 'fit porn', 'pesce', 'sera prima'],
    time: '20 min (si prepara anche la sera)', kcal: 590, protein: 45, fiber: 4, fv: 120, cost: 2.53,
    ingredients: ['Riso 90 g, un goccio di aceto di riso', 'Tonno al naturale 120 g con un cucchiaio di yogurt', 'Uovo 1 (frittatina a strisce)', 'Carota, cetriolo, spinaci 120 g', 'Alghe nori 2 fogli', 'Olio di sesamo 3 g, sesamo 3 g'],
    steps: ['Cuoci il riso e condiscilo con aceto e olio di sesamo.', 'Sulla nori stendi il riso, poi in fila tonno, frittatina, carota, cetriolo e spinaci.', 'Arrotola stretto con un canovaccio, spennella di sesamo e taglia a rondelle.'],
  },
  'Bulgogi bowl: riso 80 g, manzo magro 150 g marinato in soia, pera e aglio, verdure saltate, sesamo': {
    title: 'Bulgogi bowl', tags: ['orientale', 'fit porn', 'carne rossa'],
    time: '20 min (+ marinatura)', kcal: 610, protein: 43, fiber: 5, fv: 170, cost: 3.11,
    ingredients: ['Riso 80 g', 'Manzo magro a fettine sottili 150 g', 'Marinata: soia iposodica 15 ml, pera grattugiata 30 g, miele 5 g, aglio', 'Verdure saltate 140 g (carote, zucchine, cipollotto)', 'Olio di sesamo 4 g, sesamo 3 g'],
    steps: ['Marina il manzo almeno 15 minuti (anche dalla sera prima).', 'Scottalo in padella rovente 2 minuti: si caramella.', 'Su riso e verdure, sesamo sopra. Dolce e saporito, niente piccante.'],
  },
  'Okonomiyaki fit: cavolo 250 g, farina 50 g, 2 uova + albume 100 g, pollo 100 g, salsa okonomi, maionese light 10 g': {
    title: 'Okonomiyaki fit col pollo', tags: ['orientale', 'fit porn'],
    time: '25 min', kcal: 590, protein: 57, fiber: 8, fv: 260, cost: 2.57,
    ingredients: ['Cavolo cappuccio 250 g tritato fine', 'Farina 50 g', 'Uova 2 + albume 100 g', 'Petto di pollo 100 g a dadini piccoli', 'Salsa okonomi (o tonkatsu) 15 g', 'Maionese light 10 g, cipollotto'],
    steps: ['Mescola cavolo, farina, uova, albume e pollo: impasto denso.', 'Cuoci in padella antiaderente come una grande frittella, 5–6 minuti per lato a fuoco medio.', 'Righe di salsa okonomi e maionese incrociate, cipollotto sopra: tanto volume, poche calorie, pochi euro.'],
  },
  'Onigiri al tonno: riso 50 g, tonno al naturale 70 g, yogurt greco, alga nori': {
    title: 'Onigiri al tonno', tags: ['orientale', 'fit porn', 'pesce'],
    time: '10 min (riso già cotto)', kcal: 265, protein: 23, fiber: 1, fv: 10, cost: 1.20,
    ingredients: ['Riso 50 g (cotto e tiepido)', 'Tonno al naturale 70 g', 'Yogurt greco 15 g, un pizzico di sale', 'Alga nori, cipollotto'],
    steps: ['Mescola tonno, yogurt e cipollotto.', 'Con le mani bagnate e salate forma un triangolo di riso con il tonno al centro.', 'Avvolgi la base nella nori: si porta dappertutto.'],
  },

  'Yogurt greco 170 g con noci 15 g, miele e frutti di bosco': {
    title: 'Yogurt greco, noci e frutti di bosco',
    time: '2 min', kcal: 255, protein: 20, fiber: 4, fv: 50, cost: 1.53,
    ingredients: ['Yogurt greco 170 g', 'Noci 15 g', 'Miele 5 g', 'Frutti di bosco 50 g'],
    steps: ['Yogurt nella ciotola.', 'Noci spezzate, frutti di bosco e un filo di miele.', 'Noci e frutti di bosco: frutta secca e polifenoli, due delle abitudini più legate alla longevità.'],
  },

  'Overnight oats cheesecake: avena 50 g, latte 120 ml, skyr 170 g, frutti di bosco, biscotto digestive 15 g, miele': {
    title: 'Overnight oats cheesecake ai frutti di bosco', tags: ['dolce', 'sera prima', 'fit porn'],
    time: '5 min la sera prima', kcal: 485, protein: 31, fiber: 11, fv: 100, cost: 2.03,
    ingredients: ['Fiocchi d’avena 50 g', 'Latte 120 ml', 'Skyr 170 g', 'Frutti di bosco surgelati 100 g', '1 biscotto digestive (15 g)', 'Miele 5 g, scorza di limone'],
    steps: ['La sera: scalda i frutti di bosco 2 minuti al microonde e schiacciali con una forchetta (composta).', 'Nel barattolo: avena e latte, poi lo skyr mescolato col miele e la scorza di limone, poi la composta. Frigo.', 'Al mattino sbriciola sopra il digestive: base croccante come una cheesecake.'],
  },
  'Banana bread fit: 2 fette (avena, banana, uova, noci) e skyr 150 g col miele': {
    title: 'Banana bread fit (lo fai la domenica, dura 4 colazioni)', tags: ['dolce', 'sera prima', 'fit porn'],
    time: '2 min (si cuoce la domenica: 10 min + 40 di forno)', kcal: 420, protein: 28, fiber: 6, fv: 70, cost: 1.29,
    ingredients: ['Per lo stampo (4 porzioni): avena 160 g frullata, 3 banane mature, 2 uova, 80 ml di latte, noci 30 g, lievito, cannella', 'Per colazione: 2 fette (¼ dello stampo)', 'Skyr 150 g con un cucchiaino di miele'],
    steps: ['Domenica: schiaccia le banane, mescola con uova, latte, avena frullata, lievito e cannella; noci spezzate dentro e sopra.', 'Forno a 180 °C per 35–40 minuti; fai raffreddare e taglia in 8 fette (in frigo 5 giorni).', 'Al mattino 2 fette, tiepide 20 secondi al microonde, con lo skyr al miele.'],
  },
  'Chicken bowl con salsa alle arachidi: riso 80 g, pollo 160 g, cavolo e carote, salsa di burro d’arachidi, soia e lime': {
    title: 'Chicken bowl con salsa alle arachidi', tags: ['orientale', 'fit porn'],
    time: '20 min (riso pronto dalla sera)', kcal: 600, protein: 49, fiber: 6, fv: 170, cost: 2.19,
    ingredients: ['Riso 80 g', 'Petto di pollo 160 g', 'Cavolo cappuccio e carote 160 g a julienne', 'Salsa: burro d’arachidi 12 g, soia iposodica 10 ml, miele 5 g, succo di lime, 2 cucchiai d’acqua calda'],
    steps: ['Cuoci il riso (meglio la sera prima: raffreddato e riscaldato alza meno la glicemia).', 'Pollo a striscioline in padella 6–8 minuti.', 'Sbatti la salsa con l’acqua calda finché è liscia e lucida; versala su riso, verdure croccanti e pollo.'],
  },
  'Tuna mayo don: riso 90 g, tonno al naturale 120 g, maionese light e yogurt, edamame 60 g, cipollotto, alga nori': {
    title: 'Tuna mayo don (riso giapponese col tonno)', tags: ['orientale', 'cipollotto', 'fit porn', 'pesce', 'legumi'],
    time: '10 min (riso pronto)', kcal: 590, protein: 47, fiber: 6, fv: 90, cost: 2.70,
    ingredients: ['Riso 90 g', 'Tonno al naturale 120 g', 'Maionese light 10 g + yogurt greco 20 g', 'Edamame surgelati 60 g', 'Cetriolo 80 g', 'Cipollotto, alga nori, soia iposodica 5 ml'],
    steps: ['Scalda il riso; edamame 3 minuti in acqua bollente.', 'Mescola tonno, maionese, yogurt e un goccio di soia: crema di tonno.', 'Riso, tonno al centro, edamame e cetriolo ai lati, cipollotto e nori a striscioline sopra.'],
  },
  'Butadon: riso 90 g, lonza di maiale 150 g a fettine, cipolla, 1 uovo, soia e mirin, cipollotto, cetrioli': {
    title: 'Butadon (riso e maiale alla giapponese)', tags: ['orientale', 'cipollotto', 'fit porn', 'carne rossa'],
    time: '20 min', kcal: 720, protein: 48, fiber: 5, fv: 200, cost: 2.34,
    ingredients: ['Riso 90 g', 'Lonza di maiale a fettine sottili 150 g', 'Cipolla 80 g', 'Uovo 1', 'Salsa: soia iposodica 15 ml, mirin 15 ml, zenzero', 'Cipollotto', 'Cetrioli 100 g con aceto di riso'],
    steps: ['Cuoci il riso; cetrioli a fettine con aceto di riso.', 'Cipolla stufata 5 minuti con soia, mirin, zenzero e 50 ml d’acqua; aggiungi la lonza e cuoci 2–3 minuti finché si glassa.', 'Su riso, uovo morbido al centro, cipollotto sopra, cetrioli a lato. Costa la metà del manzo.'],
  },
  'Riso alla cantonese con pollo: riso 80 g (del giorno prima), pollo 150 g, 2 uova, piselli, carote, cipollotto, olio di sesamo': {
    title: 'Riso alla cantonese con pollo', tags: ['orientale', 'cipollotto', 'fit porn', 'legumi'],
    time: '20 min', kcal: 745, protein: 60, fiber: 6, fv: 90, cost: 2.71,
    ingredients: ['Riso 80 g (cotto il giorno prima)', 'Petto di pollo 150 g a dadini', 'Uova 2', 'Piselli 60 g, carote 60 g', 'Cipollotto 2', 'Olio di sesamo 8 g, soia iposodica 15 ml'],
    steps: ['Strapazza le uova nel wok e mettile da parte; salta il pollo 5 minuti.', 'Salta piselli, carote e il bianco del cipollotto, poi il riso freddo a fuoco alto finché “scrocchia”.', 'Unisci uova, pollo e soia; fuori dal fuoco tanto verde di cipollotto.'],
  },
  'Fish tacos di merluzzo: 3 tortillas piccole, merluzzo 180 g, insalata di cavolo, salsa yogurt e lime': {
    title: 'Fish tacos di merluzzo', tags: ['fit porn', 'pesce'],
    time: '20 min', kcal: 545, protein: 48, fiber: 7, fv: 190, cost: 3.04,
    ingredients: ['Tortillas piccole 3 (90 g)', 'Merluzzo surgelato 180 g', 'Paprika dolce, cumino, sale', 'Cavolo cappuccio 120 g, pomodoro e cipolla rossa 60 g', 'Salsa: yogurt greco 60 g, lime, aglio, prezzemolo', 'Olio 5 g'],
    steps: ['Scongela il merluzzo, asciugalo, condiscilo con paprika e cumino e scottalo in padella 3 minuti per lato; sfaldalo a pezzi.', 'Cavolo a julienne con lime e sale; salsa di yogurt, lime e aglio.', 'Tortillas calde, cavolo, pesce, pomodoro e cipolla, salsa a filo. Il pesce surgelato vale quanto il fresco e costa meno.'],
  },
  'Fish & chips fit: merluzzo 200 g in panko, patatine di patate dolci in friggitrice 250 g, salsa tartara light': {
    title: 'Fish & chips fit con patatine di patate dolci', tags: ['fit porn', 'pesce', 'patate dolci'],
    time: '30 min', kcal: 560, protein: 50, fiber: 11, fv: 120, cost: 3.54,
    ingredients: ['Merluzzo surgelato 200 g', 'Panko 20 g, albume 20 g', 'Patate dolci 250 g', 'Olio 5 g (spray), paprika', 'Salsa tartara: yogurt greco 40 g, cetriolini, capperi, limone', 'Insalata 120 g'],
    steps: ['Patate dolci a bastoncini con olio e paprika: friggitrice ad aria 200 °C per 15–18 minuti, scuotendo a metà.', 'Pesce nell’albume e nel panko, friggitrice ad aria 200 °C per 10–12 minuti.', 'Salsa tartara con yogurt, cetriolini e capperi tritati e limone. La friggitrice ad aria usa il 70–80% di olio in meno.'],
  },
  'Pollo al limone cinese: pollo 180 g glassato al limone e miele, riso 75 g, verdure saltate': {
    title: 'Pollo al limone alla cinese', tags: ['orientale', 'fit porn'],
    time: '25 min', kcal: 655, protein: 52, fiber: 5, fv: 180, cost: 2.58,
    ingredients: ['Petto di pollo 180 g a bocconcini', 'Amido di mais 10 g, albume 20 g', 'Salsa: succo di 1 limone, miele 12 g, un cucchiaio d’acqua', 'Riso 75 g', 'Peperoni, zucchine e cipollotto 150 g', 'Olio 7 g'],
    steps: ['Passa il pollo nell’albume e nell’amido; doralo in padella con l’olio 6–7 minuti.', 'Versa limone, miele e acqua: in un minuto diventa una glassa lucida e appiccicosa.', 'Con riso e verdure saltate, cipollotto sopra.'],
  },
  'Yakitori di pollo e cipollotto: spiedini di pollo 180 g e cipollotto con salsa tare, riso 75 g, cetrioli': {
    title: 'Yakitori di pollo e cipollotto (negima)', tags: ['orientale', 'cipollotto', 'fit porn'],
    time: '25 min', kcal: 635, protein: 52, fiber: 5, fv: 180, cost: 2.69,
    ingredients: ['Coscia o petto di pollo 180 g a cubetti', 'Cipollotti 3 (la parte bianca a tocchetti)', 'Salsa tare: soia iposodica 15 ml, mirin 10 ml, miele 8 g', 'Riso 75 g', 'Cetrioli e insalata 120 g', 'Sesamo 3 g, olio 5 g'],
    steps: ['Infila pollo e cipollotto alternati sugli spiedini.', 'Cuocili su piastra o griglia 8–10 minuti girandoli; negli ultimi 2 spennella la tare più volte finché è lucida.', 'Sul riso con sesamo, cetrioli a lato.'],
  },
  'Pollo e riso alla coreana: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa di soia, miele, aglio e sesamo, cipollotto': {
    title: 'Pollo e riso alla coreana', tags: ['orientale', 'cipollotto', 'fit porn', 'legumi'],
    time: '25 min', kcal: 785, protein: 64, fiber: 9, fv: 220, cost: 3.19,
    ingredients: ['Petto di pollo 200 g', 'Riso 90 g', 'Verdure saltate 200 g, edamame 50 g', 'Salsa: soia iposodica 15 ml, miele 8 g, aglio, olio di sesamo 3 g', 'Sesamo 3 g, cipollotto, olio 5 g'],
    steps: ['Cuoci il riso.', 'Pollo a pezzi in padella 7–8 minuti; versa soia, miele e aglio e fai glassare.', 'Su riso e verdure, sesamo e tanto cipollotto. Dolce e saporito, niente piccante.'],
  },
  'Pollo e riso zenzero e cipollotto: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa cantonese di zenzero e cipollotto': {
    title: 'Pollo e riso con salsa zenzero e cipollotto', tags: ['orientale', 'cipollotto', 'legumi'],
    time: '25 min', kcal: 760, protein: 63, fiber: 9, fv: 230, cost: 3.10,
    ingredients: ['Petto di pollo 200 g', 'Riso 90 g', 'Verdure al vapore 200 g, edamame 50 g', 'Salsa: cipollotto 30 g e zenzero tritati, olio caldo 10 g, soia iposodica 10 ml, sale'],
    steps: ['Cuoci il riso e il pollo in acqua appena bollente 12 minuti (resta morbidissimo), poi taglialo a fette.', 'Cipollotto e zenzero tritati in una ciotola; versa sopra l’olio bollente (sfrigola) e aggiungi la soia.', 'Pollo sul riso, salsa abbondante sopra, verdure a lato: la salsa classica cantonese.'],
  },
  'Pollo e riso al limone ed erbe: pollo 200 g, riso 90 g con piselli 60 g, verdure grigliate, limone, rosmarino, olio EVO 10 g': {
    title: 'Pollo e riso al limone ed erbe', tags: ['legumi'],
    time: '25 min', kcal: 735, protein: 59, fiber: 9, fv: 220, cost: 2.85,
    ingredients: ['Petto di pollo 200 g', 'Riso 90 g e piselli 60 g', 'Verdure grigliate 200 g', 'Marinata: limone, rosmarino, aglio, olio EVO 10 g, pepe'],
    steps: ['Marina il pollo 10 minuti in limone, aglio, rosmarino e olio.', 'Piastra rovente, 5 minuti per lato; cuoci il riso.', 'Fette di pollo sul riso con le verdure, il fondo di cottura e scorza di limone sopra.'],
  },
  'Pollo e riso teriyaki: pollo 200 g, riso 90 g, edamame 50 g, verdure, salsa teriyaki, cipollotto': {
    title: 'Pollo e riso teriyaki', tags: ['orientale', 'cipollotto', 'fit porn', 'legumi'],
    time: '25 min', kcal: 745, protein: 63, fiber: 8, fv: 220, cost: 3.12,
    ingredients: ['Petto o coscia di pollo 200 g', 'Riso 90 g', 'Verdure 200 g, edamame 50 g', 'Salsa teriyaki: soia iposodica 15 ml, miele 10 g, zenzero, aglio', 'Cipollotto, olio 5 g'],
    steps: ['Cuoci il riso.', 'Rosola il pollo 6 minuti, versa la salsa e fai ridurre finché è lucida.', 'Su riso e verdure con tanto cipollotto.'],
  },
  'Pollo e riso alla messicana: pollo 200 g, riso 90 g, fagioli neri 60 g, pico de gallo, peperoni, lime, paprika': {
    title: 'Pollo e riso alla messicana', tags: ['legumi'],
    time: '25 min', kcal: 735, protein: 61, fiber: 11, fv: 270, cost: 2.94,
    ingredients: ['Petto di pollo 200 g', 'Riso 90 g, fagioli neri 60 g', 'Peperoni e cipolla 200 g', 'Pico de gallo: pomodoro, cipolla rossa, coriandolo o prezzemolo, lime (60 g)', 'Paprika dolce, cumino, olio 7 g'],
    steps: ['Pollo a strisce con paprika e cumino, saltato con peperoni e cipolla.', 'Cuoci il riso con un pizzico di cumino.', 'Riso, pollo e peperoni, pico de gallo fresco sopra e uno spicchio di lime.'],
  },
  'Pollo e riso thai al basilico (non piccante): pollo 200 g, riso 90 g, piselli 50 g, verdure, basilico, soia, lime': {
    title: 'Pollo e riso thai al basilico (senza piccante)', tags: ['orientale', 'legumi'],
    time: '20 min', kcal: 720, protein: 60, fiber: 8, fv: 210, cost: 2.87,
    ingredients: ['Petto di pollo 200 g tritato al coltello', 'Riso 90 g', 'Fagiolini, peperoni e piselli 250 g', 'Salsa: soia iposodica 10 ml, miele 5 g, lime, aglio', 'Basilico abbondante, olio 7 g'],
    steps: ['Cuoci il riso.', 'Salta aglio e pollo tritato a fuoco alto 5 minuti, poi le verdure 3 minuti.', 'Salsa e una manciata di basilico a fine cottura; servi col riso e lime. È il pad krapow, senza peperoncino.'],
  },
  'Pranzo dalla mamma: un piatto di primo, un secondo con verdure, niente bis': {
    title: 'Pranzo della domenica dalla mamma',
    time: 'Da mamma', kcal: 800, protein: 45, fiber: 8, fv: 0,
    ingredients: ['Un piatto di primo (porzione normale, circa 80–100 g di pasta o riso)', 'Un secondo di carne o pesce con verdure', 'Frutta a fine pasto (il dolce solo ogni tanto)'],
    steps: ['Goditelo: è contato nel piano (circa 800 kcal).', 'Le regole sono solo due: niente bis del primo, e verdure nel piatto.', 'La sera c’è la pizza: il pranzo non va saltato né ridotto per “compensare”.'],
  },
  'Skyr 170 g e un frutto': {
    title: 'Skyr e frutta',
    time: '1 min', kcal: 185, protein: 19, fiber: 4, fv: 150, cost: 1.15,
    ingredients: ['Skyr 170 g', 'Una mela o un altro frutto', 'Cannella a piacere'],
    steps: ['Skyr con cannella.', 'Il frutto a fette sopra.', 'Proteine prima della pizza della sera.'],
  },
  'Bagel salmone e cipollotto: bagel 90 g, salmone affumicato 60 g, spalmabile light 40 g, cipollotto, skyr 150 g con miele': {
    title: 'Bagel salmone e cipollotto', tags: ['cipollotto', 'fit porn', 'pesce'],
    time: '5 min', kcal: 480, protein: 39, fiber: 2, fv: 20, cost: 4.04,
    ingredients: ['Bagel 1 (90 g)', 'Salmone affumicato 60 g', 'Formaggio spalmabile light 40 g', 'Cipollotto 1, pepe nero, scorza di limone', 'Skyr 150 g con un cucchiaino di miele'],
    steps: ['Tosta il bagel tagliato a metà.', 'Spalma il formaggio, adagia il salmone e cospargi di cipollotto a rondelle sottili, pepe e scorza di limone.', 'A lato lo skyr col miele.'],
  },
  'Poke al salmone crudo: riso 80 g, salmone 130 g, edamame 60 g, cetriolo, carote, cavolo, salsa soia, miele e sesamo': {
    title: 'Poke al salmone crudo', tags: ['orientale', 'fit porn', 'pesce', 'legumi'],
    time: '15 min (riso pronto dalla sera)', kcal: 700, protein: 42, fiber: 7, fv: 120, cost: 3.88,
    ingredients: ['Salmone “idoneo al consumo crudo” (già abbattuto) oppure congelato in freezer a −18 °C per almeno 96 ore (Ministero della Salute), 130 g', 'Riso 80 g (meglio da sushi), aceto di riso', 'Edamame 60 g', 'Cetriolo, carote, cavolo viola 120 g', 'Salsa poke: soia iposodica 10 ml, miele 5 g, sesamo 5 g, un goccio di lime'],
    steps: ['Riso cotto e condito con aceto di riso, lasciato intiepidire (o pronto dalla sera).', 'Salmone a cubetti marinato 5 minuti nella salsa poke.', 'Ciotola: riso, salmone al centro, edamame e verdure a spicchi, sesamo sopra.'],
  },
  'Chirashi di salmone crudo: riso 80 g, salmone 140 g a fette, avocado 30 g, edamame, cetriolo, carote, soia e sesamo': {
    title: 'Chirashi di salmone crudo', tags: ['orientale', 'fit porn', 'pesce', 'legumi'],
    time: '20 min', kcal: 715, protein: 41, fiber: 8, fv: 130, cost: 4.16,
    ingredients: ['Salmone “idoneo al consumo crudo” (già abbattuto) oppure congelato in freezer a −18 °C per almeno 96 ore (Ministero della Salute), 140 g', 'Riso 80 g con aceto di riso', 'Avocado 30 g', 'Edamame 40 g', 'Cetriolo e carote 100 g', 'Soia iposodica 10 ml, sesamo 3 g, alga nori'],
    steps: ['Riso cotto, condito con aceto di riso e lasciato intiepidire.', 'Salmone a fette sottili con il coltello ben affilato.', 'Riso nella ciotola, fette di salmone a ventaglio sopra, avocado, edamame e verdure attorno; soia a parte, sesamo e nori.'],
  },
  'Salmone teriyaki: salmone 160 g glassato, riso 70 g, zucchine e pak choi, cipollotto e sesamo': {
    title: 'Salmone teriyaki', tags: ['orientale', 'cipollotto', 'fit porn', 'pesce'],
    time: '20 min', kcal: 670, protein: 41, fiber: 5, fv: 170, cost: 4.35,
    ingredients: ['Filetto di salmone 160 g (anche surgelato)', 'Riso 70 g', 'Zucchine e pak choi 150 g', 'Salsa teriyaki: soia iposodica 15 ml, miele 10 g, zenzero, aglio', 'Cipollotto, sesamo 3 g'],
    steps: ['Cuoci il riso; salta le verdure 3 minuti.', 'Salmone in padella dal lato della pelle 4 minuti, giralo, versa la salsa e fai glassare 2 minuti spennellando.', 'Su riso e verdure, cipollotto e sesamo sopra.'],
  },
  'Tataki di tonno: tonno fresco 160 g in crosta di sesamo, soba 70 g, edamame, cetriolo, salsa soia e lime': {
    title: 'Tataki di tonno e soba', tags: ['orientale', 'fit porn', 'pesce', 'legumi'],
    time: '20 min', kcal: 620, protein: 59, fiber: 9, fv: 80, cost: 6.33,
    ingredients: ['Tonno fresco 160 g (idoneo al consumo poco cotto, o congelato 96 ore a −18 °C)', 'Sesamo 10 g', 'Soba (spaghetti di grano saraceno) 70 g', 'Edamame 60 g, cetriolo', 'Soia iposodica 15 ml, lime, olio di sesamo 5 g'],
    steps: ['Cuoci le soba, sciacquale fredde e condiscile con soia, lime e olio di sesamo.', 'Passa il tonno nel sesamo e scottalo in padella rovente 40 secondi per lato: dentro resta rosa.', 'Taglia a fette spesse e servi su soba, edamame e cetriolo.'],
  },
  // ── Cene del giovedì (prima del calcio: tanti carboidrati, pochi grassi) ──
  'Pasta al pomodoro con tacchino: pasta 110 g, passata, tacchino 150 g a straccetti, parmigiano 10 g, olio EVO 8 g': {
    title: 'Pasta al pomodoro con tacchino',
    time: '20 min', kcal: 700, protein: 55, fiber: 5, fv: 150, cost: 2.32,
    ingredients: ['Pasta 110 g', 'Passata 150 g, basilico', 'Fesa di tacchino a straccetti 150 g', 'Parmigiano 10 g', 'Olio EVO 8 g, aglio'],
    steps: ['Sugo veloce: aglio, olio e passata per 10 minuti.', 'Straccetti di tacchino in padella 4 minuti, poi nel sugo.', 'Manteca la pasta nel sugo; parmigiano e basilico. Da mangiare entro le 18:45.'],
  },
  'Gnocchi al pomodoro e pollo: gnocchi 300 g, passata, pollo 140 g, basilico, parmigiano 10 g': {
    title: 'Gnocchi al pomodoro e pollo',
    time: '20 min', kcal: 725, protein: 50, fiber: 7, fv: 150, cost: 2.63,
    ingredients: ['Gnocchi di patate 300 g', 'Passata 150 g', 'Petto di pollo 140 g a cubetti', 'Basilico, parmigiano 10 g', 'Olio EVO 5 g'],
    steps: ['Rosola il pollo a cubetti, aggiungi la passata e cuoci 10 minuti.', 'Lessa gli gnocchi: sono pronti quando salgono a galla.', 'Saltali nel sugo con basilico e parmigiano.'],
  },
  'Udon in brodo: udon 300 g, pollo 150 g, spinaci, brodo al miso, cipollotto': {
    title: 'Udon in brodo con pollo', tags: ['orientale', 'cipollotto'],
    time: '20 min', kcal: 610, protein: 50, fiber: 7, fv: 100, cost: 3.73,
    ingredients: ['Udon freschi 300 g', 'Petto di pollo 150 g', 'Spinaci 80 g', 'Miso 15 g, soia, zenzero', 'Cipollotto'],
    steps: ['Porta a bollore 500 ml d’acqua con zenzero; cuoci il pollo a fette 8 minuti.', 'Aggiungi udon e spinaci per 2–3 minuti; a fuoco spento sciogli il miso.', 'In ciotola con tanto cipollotto. Leggero da digerire prima della partita.'],
  },

  // ── Pre e dopo calcio (partita 21:30–23:00) ──
  'Pre-calcio: banana e 2 gallette con miele': {
    title: 'Pre-calcio veloce', time: '2 min', kcal: 200, protein: 3, fiber: 4, fv: 120, cost: 0.44,
    ingredients: ['Banana 1', 'Gallette di riso 2', 'Miele 10 g', 'Acqua 300–500 ml'],
    steps: ['Verso le 20:45, 45–60 minuti prima della partita.', 'Solo carboidrati facili: la cena vera l’hai già fatta alle 18:45.', 'Bevi 300–500 ml d’acqua nell’ora prima di giocare.'],
  },
  'Pre-calcio: toast 50 g con marmellata': {
    title: 'Pre-calcio: toast e marmellata', time: '3 min', kcal: 180, protein: 5, fiber: 2, fv: 0, cost: 0.27,
    ingredients: ['Pane 50 g', 'Marmellata 20 g', 'Acqua 300–500 ml'],
    steps: ['Verso le 20:45.', 'Pochi grassi e poche fibre: energia pronta senza pesantezza.', 'Bevi 300–500 ml d’acqua nell’ora prima di giocare.'],
  },
  'Dopo calcio: shake proteico 30 g con latte scremato, banana e 2 gallette': {
    title: 'Dopo calcio: shake e banana', tags: ['proteine in polvere'],
    time: '2 min', kcal: 365, protein: 35, fiber: 4, fv: 120, cost: 1.42,
    ingredients: ['Proteine in polvere 30 g (chocowafer)', 'Latte scremato 250 ml', 'Banana 1', 'Gallette di riso 2'],
    steps: ['Prepara lo shaker prima di uscire: a fine partita aggiungi solo il latte (o bevilo con acqua e prendi il latte a casa).', 'Banana e gallette appena arrivi.', 'Basta così: alle 23 niente pasto enorme, dormi meglio e recuperi lo stesso.'],
  },
  'Dopo calcio: yogurt greco 200 g con proteine 15 g, cornflakes 30 g e frutti di bosco': {
    title: 'Dopo calcio: yogurt proteico croccante', tags: ['proteine in polvere'],
    time: '2 min', kcal: 350, protein: 35, fiber: 6, fv: 100, cost: 2.30,
    ingredients: ['Yogurt greco 200 g', 'Proteine in polvere 15 g (chocowafer)', 'Cornflakes 30 g', 'Frutti di bosco 100 g (anche surgelati)'],
    steps: ['Mescola yogurt e proteine fino a una crema liscia.', 'Cornflakes e frutti di bosco sopra all’ultimo.', 'Fresco e leggero: alle 23 recuperi senza appesantirti.'],
  },
  'Dopo calcio: shake proteico 30 g con latte scremato e toast 60 g con miele': {
    title: 'Dopo calcio: shake e toast al miele', tags: ['proteine in polvere'],
    time: '3 min', kcal: 390, protein: 37, fiber: 2, fv: 0, cost: 1.36,
    ingredients: ['Proteine in polvere 30 g (chocowafer)', 'Latte scremato 250 ml', 'Pane 60 g', 'Miele 10 g'],
    steps: ['Shake appena finisci di giocare.', 'Toast col miele a casa.', 'Poi a letto: carboidrati e proteine bastano per recuperare.'],
  },

  // ── Spuntini nuovi ──
  'Skyr 170 g, un frutto e mandorle 15 g': {
    title: 'Skyr, frutta e mandorle',
    time: '1 min', kcal: 275, protein: 22, fiber: 5, fv: 150, cost: 1.36,
    ingredients: ['Skyr 170 g', 'Una mela o un altro frutto', 'Mandorle 15 g (una piccola manciata)', 'Cannella a piacere'],
    steps: ['Skyr in una ciotola con cannella.', 'Il frutto a fette e le mandorle sopra.', 'La frutta secca ogni giorno è una delle abitudini più legate a una vita lunga (Aune 2016).'],
  },
  'Budino di skyr al cacao: skyr 200 g, cacao, miele, fondente 10 g': {
    title: 'Budino di skyr al cacao', tags: ['fit porn'],
    time: '3 min', kcal: 235, protein: 25, fiber: 4, fv: 0, cost: 1.37,
    ingredients: ['Skyr 200 g', 'Cacao amaro 8 g', 'Miele 10 g', 'Cioccolato fondente 85% 10 g'],
    steps: ['Mescola skyr, cacao e miele fino a una crema lucida (se è troppo densa, un cucchiaio di latte).', 'Grattugia il fondente sopra.', '10 minuti in frigo e sembra un budino vero.'],
  },

  // ── Venerdì sera ──
  'Uscita: massimo 2 cocktail (contati nel piano)': {
    title: 'Venerdì: massimo 2 cocktail', time: 'Fuori', kcal: 375, protein: 0, fiber: 0, fv: 0,
    ingredients: ['Gin tonic ≈ 170–190 kcal · vodka soda ≈ 100 · spritz ≈ 150–170', 'Moscow mule ≈ 180 · mojito ≈ 220–250', 'Piña colada o cocktail con panna ≈ 300–400 (meglio evitarli)', 'Una birra media (0,4 l) ≈ 170–200'],
    steps: ['Cena prima di uscire: mai bere a stomaco vuoto.', 'Un bicchiere d’acqua tra un cocktail e l’altro; scegli drink con acqua tonica o soda, non con succhi e panna.', 'Perché due: l’alcol riduce del 24–37% la costruzione del muscolo dopo l’allenamento (Parr 2014) e peggiora il sonno, e sabato ci sono sprint e pesi.'],
  },
};

export const recipeFor = (meal) => mealRecipes[meal] || null;

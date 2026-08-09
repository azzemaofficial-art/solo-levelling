// ─────────────────────────────────────────────────────────────────────────────
// CONOSCENZA MARZIALE — il "cervello da maestro" del Live Coach.
//
// Ogni disciplina porta: filosofia & disciplina, guardia, tecniche fondamentali
// con cue biomeccanici + errori comuni + correzioni, respirazione specifica,
// combo autentiche (seed per il generatore), gradi per la progressione.
//
// Usato da: prompt di analisi (visual.js), cue deterministici dello Specchio,
// generatore combo/circuiti, insegnamento durante la scansione, gamification.
// Regola: cue corti e imperativi (il coach parla mentre ti muovi).
// ─────────────────────────────────────────────────────────────────────────────

export const MARTIAL_DISCIPLINES = {

  muaythai: {
    id: 'muaythai', name: 'Muay Thai', emoji: '🇹🇭', family: 'striking',
    origin: 'Thailandia — "l\'arte delle otto armi": pugni, gomiti, ginocchia, tibie.',
    philosophy: 'Rispetto rituale e durezza: il wai khru onora i maestri prima del combattimento. La potenza nasce dalla calma, non dalla fretta.',
    etiquette: ['Wai khru: saluto rituale prima di allenarsi', 'Rispetto assoluto di maestro e compagno', 'Mai colpire forte senza accordo nel clinch di prova'],
    stance: {
      name: 'Guardia muay thai',
      cues: ['Piedi larghezza spalle, posteriore leggermente aperto', 'Peso centrale, tallone posteriore appena sollevato', 'Mani alte alle sopracciglia, gomiti stretti a proteggere il corpo', 'Mento basso, sguardo attraverso le mani'],
      errors: [
        { if: 'mani sotto le spalle', fix: 'mani alle sopracciglia, gomiti incollati alle costole' },
        { if: 'peso sulla gamba anteriore', fix: 'peso al centro: devi poter calciare con entrambe' },
      ],
    },
    breathing: {
      principle: 'Espira corta e secca a ogni colpo ("ish"), inspira dal naso in guardia. Mai apnea nelle combinazioni.',
      patterns: [
        { name: 'Ritmo da combattimento', rhythm: 'inspira 2s / espira 1s a ogni colpo', use: 'durante combo e sparring leggero' },
        { name: 'Respiro del clinch', rhythm: 'inspira 3s / espira 3s profonda', use: 'nel clinch per non andare in apnea sotto sforzo' },
      ],
    },
    techniques: [
      { id: 'jab', it: 'Jab', type: 'punch', how: ['spalla avanti senza caricare', 'ruota il pugno all\'ultimo', 'ritorna in guardia prima di respirare'], mistakes: [{ if: 'carichi il colpo arretrando la spalla', fix: 'parti da fermo: il jab è velocità, non carico' }], drill: '3×20 jab al sacco contando il ritmo' },
      { id: 'cross', it: 'Cross (diretto)', type: 'punch', how: ['ruota tallone e anca posteriore', 'il pugno segue l\'anca, non il contrario', 'spalla opposta protegge il mento'], mistakes: [{ if: 'braccio "spinge" senza rotazione', fix: 'immagina di avvitare il tallone posteriore nel pavimento' }], drill: '100 cross lenti con rotazione esagerata, poi 50 veloci' },
      { id: 'hook', it: 'Gancio', type: 'punch', how: ['gomito a 90°, parallelo al pavimento', 'ruota anca e piede d\'appoggio', 'colpisci con le prime due nocche'], mistakes: [{ if: 'gomito basso (swing)', fix: 'gomito all\'altezza della spalla, arco stretto' }], drill: 'ganci al sacco alternando altezza corpo/testa' },
      { id: 'elbow', it: 'Gomitata', type: 'elbow', how: ['taglia con la punta del gomito', 'ruota l\'anca come per un gancio stretto', 'l\'altra mano resta alta'], mistakes: [{ if: 'colpisci con l\'avambraccio', fix: 'solo la punta del gomito: accorcia la distanza' }], drill: 'gomitate orizzontali e discendenti alternate, 3×10' },
      { id: 'teep', it: 'Teep (calcio frontale)', type: 'kick', how: ['ginocchio su prima di spingere', 'colpisci con la pianta del piede', 'spingi il bacino avanti, busto leggermente indietro'], mistakes: [{ if: 'spingi senza alzare il ginocchio', fix: 'camera alta: il ginocchio punta il petto dell\'avversario prima dell\'estensione' }], drill: 'teep al muro o al sacco: 3×15 cercando la spinta lunga' },
      { id: 'roundhouse', it: 'Calcio circolare (middle kick)', type: 'kick', how: ['step d\'appoggio a 45°', 'ruota l\'anca completamente', 'colpisci con la tibia, piede rilassato', 'il braccio opposto bilancia'], mistakes: [{ if: 'calci di ginocchio (anca chiusa)', fix: 'apri l\'anca: la tibia arriva come una frusta da fuori' }], drill: 'roundhouse al sacco alternando guardia, 50 per lato' },
      { id: 'knee', it: 'Ginocchiata', type: 'knee', how: ['afferra la nuca (clinch) o visualizzala', 'spingi il bacino avanti mentre il ginocchio sale', 'tieni la schiena dell\'avversario curva'], mistakes: [{ if: 'salti senza controllare la distanza', fix: 'prima il controllo del collo, poi il ginocchio' }], drill: 'ginocchiate al sacco con presa simulata, 3×12 per lato' },
      { id: 'lowkick', it: 'Low kick', type: 'kick', how: ['step esterno corto', 'ruota l\'anca, tibia contro coscia', 'braccio opposto scende per l\'equilibrio'], mistakes: [{ if: 'calci alto senza motivo', fix: 'il low kick è preciso: mira appena sopra il ginocchio esterno' }], drill: 'low kick al sacco pesante, 3×15 per lato' },
    ],
    combosSeed: [
      'jab-cross-gancio sinistro-middle kick destro',
      'teep sinistro-finto teep-roundhouse destro',
      'jab-cross-ginocchiata destra (clinch)',
      'gomitata orizzontale-gancio-teep',
    ],
    ranks: ['Kru (allievo)', 'Luk kru', 'Nak muay', 'Fighter', 'Kru assistant', 'Maestro'],
  },

  boxing: {
    id: 'boxing', name: 'Boxe', emoji: '🥊', family: 'striking',
    origin: 'Inghilterra — la "nobile arte": solo pugni, footwork e difesa.',
    philosophy: 'Colpisci senza essere colpito. La boxe è footwork prima che pugni: posizione, angolo, tempo.',
    etiquette: ['Saluto (tocco dei guantoni) a inizio e fine round', 'Mai parlare durante le riprese di lavoro', 'Proteggi sempre il compagno nei drill'],
    stance: {
      name: 'Guardia ortodossa',
      cues: ['Piede posteriore a 45°, tallone leggermente alzato', 'Mani alle guance, gomiti bassi a coprire il corpo', 'Mento incassato nella spalla anteriore', 'Peso distribuito 50/50, pronto a scivolare'],
      errors: [
        { if: 'mani basse o larghe', fix: 'nocche alle guance, gomiti incollati al tronco' },
        { if: 'piedi incrociati', fix: 'mai incrociare: passi corti e piedi sempre "a orologio"' },
      ],
    },
    breathing: {
      principle: 'Espirazione corta ("shh") a ogni pugno: l\'aria che esce irrigidisce il core all\'impatto.',
      patterns: [
        { name: 'Metronomo dei pugni', rhythm: 'inspira 2 colpi / espira 2 colpi', use: 'sacco e shadow boxing' },
        { name: 'Reset difensivo', rhythm: 'inspira profonda 3s dopo ogni scambio', use: 'tra le combinazioni, in guardia' },
      ],
    },
    techniques: [
      { id: 'jab', it: 'Jab', type: 'punch', how: ['parte dalla guardia senza telegrafare', 'estensione completa, spalla al mento', 'ritorno più veloce dell\'andata'], mistakes: [{ if: 'allunghi il passo prima del pugno', fix: 'il pugno parte mentre il piede scivola, non prima' }], drill: 'shadow: solo jab per 3 round, cercando il doppio jab' },
      { id: 'cross', it: 'Diretto', type: 'punch', how: ['rotazione anca-tallone', 'linea retta verso il bersaglio', 'la mano opposta resta incollata al mento'], mistakes: [{ if: 'il gomito si allarga', fix: 'il diretto è un binario: gomito che sfiora il fianco' }], drill: '1-2 al sacco con pausa di verifica ogni 10 colpi' },
      { id: 'hook', it: 'Gancio', type: 'punch', how: ['gomito a 90°', 'il piede perno ruota', 'peso sulla gamba anteriore nel gancio davanti'], mistakes: [{ if: 'carichi caricando il braccio indietro', fix: 'il gancio nasce dall\'anca, il braccio è solo il terminale' }], drill: 'ganci al sacco in coppia: sinistro al corpo, destro alla testa' },
      { id: 'uppercut', it: 'Montante', type: 'punch', how: ['ginocchia flesse, scendi di pochi cm', 'risali ruotando l\'anca', 'corto: è un colpo da distanza stretta'], mistakes: [{ if: 'ti sbilanci avanti', fix: 'il montante è verticale: testa sopra il bacino' }], drill: 'montanti al sacco basso, 3×12 per lato' },
      { id: 'slip', it: 'Slip (scivolamento)', type: 'defense', how: ['sposta solo la testa, non il peso', 'piega leggermente il ginocchio opposto', 'resta sempre in guardia'], mistakes: [{ if: 'sposti tutto il corpo', fix: 'solo la testa esce dalla linea: il corpo resta centrato' }], drill: 'corda tesa all\'altezza delle spalle: scivola sotto avanzando' },
      { id: 'parry', it: 'Parata', type: 'defense', how: ['piccolo tocco con la mano opposta', 'devia, non bloccare', 'la parata apre il tuo colpo'], mistakes: [{ if: 'pari troppo largo', fix: 'parata di 5 cm: abbastanza da deviare, non da aprirti' }], drill: 'con compagno: jab lenti, para e rispondi col diretto' },
      { id: 'roll', it: 'Roll (bob and weave)', type: 'defense', how: ['scendi di gambe, non di schiena', 'disegna una U sotto il colpo', 'risali dall\'altro lato carico'], mistakes: [{ if: 'ti pieghi in vita', fix: 'ginocchia: la schiena resta dritta' }], drill: 'corda o elastico: 3 round di roll continui' },
    ],
    combosSeed: [
      'jab-diretto-gancio sinistro',
      'jab-slip-diretto al corpo',
      'doppio jab-roll-gancio destro',
      'diretto-montante sinistro-diretto',
    ],
    ranks: ['Novizio', 'Guantone bianco', 'Guantone rosso', 'Competitore', 'Esperto', 'Maestro del ring'],
  },

  kickboxing: {
    id: 'kickboxing', name: 'Kickboxing', emoji: '🦵', family: 'striking',
    origin: 'Olanda/Giappone — pugni della boxe + calci: ritmo e pressione.',
    philosophy: 'Flusso continuo: mani per aprire, gambe per finire. La combo non finisce finché non decide chi la porta.',
    etiquette: ['Saluto al compagno prima dei drill', 'Controllo sempre nei calci alla testa', 'Rispetto dei turni di lavoro'],
    stance: {
      name: 'Guardia kick',
      cues: ['Più laterale della boxe', 'Peso leggermente sulla gamba posteriore per calciare rapido', 'Mani alte, gomiti che coprono le costole', 'Passi corti, mai piedi uniti'],
      errors: [
        { if: 'tacco posteriore incollato', fix: 'tallone posteriore attivo: sei sempre pronto a calciare' },
        { if: 'busto troppo eretto', fix: 'leggera flessione: sei un bersaglio più piccolo' },
      ],
    },
    breathing: {
      principle: 'Espirazione a ogni colpo, ritmo costante: la kickboxing è volume, non singolo colpo.',
      patterns: [
        { name: 'Ritmo olandese', rhythm: 'inspira 2s / espira a ogni colpo in combo', use: 'combinazioni mani-gambe' },
        { name: 'Recupero attivo', rhythm: '4s inspira / 4s espira in guardia', use: 'tra le serie al sacco' },
      ],
    },
    techniques: [
      { id: 'jab', it: 'Jab', type: 'punch', how: ['veloce e leggero', 'apre sempre la combinazione', 'ritorno immediato in guardia'], mistakes: [{ if: 'cerchi potenza nel jab', fix: 'il jab misura e disturba: la potenza arriva dopo' }], drill: 'jab-cross ripetuti 3 round' },
      { id: 'cross', it: 'Diretto', type: 'punch', how: ['rotazione completa dell\'anca', 'spinge attraverso il bersaglio', 'copri il mento con la spalla opposta'], mistakes: [{ if: 'perdi l\'equilibrio in avanti', fix: 'colpisci "attraverso", ma il peso resta centrato' }], drill: '1-2 + low kick, 50 ripetizioni' },
      { id: 'hook', it: 'Gancio', type: 'punch', how: ['gomito parallelo al pavimento', 'rotazione secca del tronco', 'corto e preciso'], mistakes: [{ if: 'arco troppo ampio', fix: 'stringi: il gancio lungo si vede arrivare' }], drill: 'gancio-cross alternati al sacco' },
      { id: 'lowkick', it: 'Low kick', type: 'kick', how: ['step a 45° esterno', 'tibia contro la coscia', 'braccio opposto scende a bilanciare'], mistakes: [{ if: 'calci con il piede', fix: 'è la tibia che taglia: punta del piede rilassata' }], drill: 'low kick alternati, 3×20' },
      { id: 'middlekick', it: 'Middle kick', type: 'kick', how: ['step d\'appoggio e rotazione d\'anca', 'tibia contro costole', 'ritorno rapido in guardia'], mistakes: [{ if: 'telegrafi alzando il braccio prima', fix: 'mani ferme fino all\'ultimo: parte prima l\'anca' }], drill: 'middle kick al sacco, 3×15 per lato' },
      { id: 'highkick', it: 'High kick', type: 'kick', how: ['stessa meccanica del middle, più in alto', 'flessibilità prima della potenza', 'guardia alta mentre calci'], mistakes: [{ if: 'ti pieghi indietro esagerando', fix: 'busto leggermente indietro, mai crollare: equilibrio prima dell\'altezza' }], drill: 'high kick lenti alla sbarra o al compagno con scudo' },
      { id: 'frontkick', it: 'Calcio frontale', type: 'kick', how: ['ginocchio su, poi spinta della pianta', 'tiene la distanza', 'ottimo stop sulle avanzate'], mistakes: [{ if: 'spingi col piede piatto', fix: 'dita verso l\'alto, pianta contro il bersaglio' }], drill: 'front kick di controllo su scudo, 3×12' },
    ],
    combosSeed: [
      'jab-cross-low kick destro',
      'jab-cross-gancio-middle kick',
      'finto jab-high kick sinistro',
      'front kick sinistro-1-2-low kick',
    ],
    ranks: ['Cintura bianca', 'Gialla', 'Arancione', 'Verde', 'Blu', 'Marrone', 'Nera'],
  },

  karate: {
    id: 'karate', name: 'Karate', emoji: '🥋', family: 'striking',
    origin: 'Okinawa/Giappone — "mano vuota": colpi lineari, kihon e kata.',
    philosophy: 'Karate ni sente nashi: il karate non colpisce per primo. Tecnica, controllo e cortesia vengono prima della forza.',
    etiquette: ['Rei (inchino) entrando nel dojo, al maestro e al compagno', 'Kiai sul colpo finale', 'Unghie corte, karategi pulito'],
    stance: {
      name: 'Hanmi / Zenkutsu-dachi',
      cues: ['Corpo a 45° (hanmi): bersaglio ridotto', 'Zenkutsu: 60% peso davanti, piede posteriore dritto', 'Pugni ai fianchi in attesa (kamae)', 'Radicamento: spingi il pavimento'],
      errors: [
        { if: 'piedi larghi quanto le spalle in zenkutsu', fix: 'larghezza naturale: la stabilità viene dalla lunghezza del passo' },
        { if: 'spalle tese e alte', fix: 'spalle basse: la potenza sale dal pavimento' },
      ],
    },
    breathing: {
      principle: 'Ibuki: espirazione sonora e contratta dal tanden (sotto l\'ombelico) sul colpo; inspirazione silenziosa.',
      patterns: [
        { name: 'Respiro del kihon', rhythm: 'inspira 2s / espira contratta 1s con kiai', use: 'kata e tecnica fondamentale' },
        { name: 'Mokuso', rhythm: '6s inspira / 6s espira seduti', use: 'inizio e fine allenamento: calma la mente' },
      ],
    },
    techniques: [
      { id: 'kizamizuki', it: 'Kizami-zuki (jab avanzato)', type: 'punch', how: ['il pugno parte insieme al passo', 'anca che accompagna, non precede', 'ritorno immediato in hanmi'], mistakes: [{ if: 'passi e poi colpisci', fix: 'pugno e passo sono un solo movimento' }], drill: 'kizami-zuki su bersaglio avanzando, 3×20' },
      { id: 'gyakuzuki', it: 'Gyaku-zuki (diretto opposto)', type: 'punch', how: ['rotazione dell\'anca da hanmi a shomen', 'pugno che ruota all\'ultimo istante', 'contrazione finale di tutto il corpo (kime)'], mistakes: [{ if: 'spingi col braccio', fix: 'l\'anca porta il pugno: il braccio arriva solo alla fine' }], drill: 'gyaku-zuki fermi davanti allo specchio, kime evidente' },
      { id: 'maegeri', it: 'Mae-geri (calcio frontale)', type: 'kick', how: ['ginocchio alto, punta tirata indietro', 'colpisci con la pianta (koshi)', 'ritiro del ginocchio veloce quanto l\'estensione'], mistakes: [{ if: 'il piede colpisce con le dita', fix: 'dita iperestese indietro: si colpisce con la pianta' }], drill: 'mae-geri lenti alla cintura del compagno, 3×10 per gamba' },
      { id: 'mawashigeri', it: 'Mawashi-geri (circolare)', type: 'kick', how: ['ginocchio su verso il bersaglio', 'rotazione dell\'anca e del piede perno', 'colpisci con il collo del piede o la tibia'], mistakes: [{ if: 'il ginocchio punta fuori', fix: 'ginocchio che mira il bersaglio, poi si "srotola" la gamba' }], drill: 'mawashi-geri a scudo alternando altezza' },
      { id: 'yokogeri', it: 'Yoko-geri (calcio laterale)', type: 'kick', how: ['corpo completamente laterale', 'colpisci con il taglio del piede (sokuto)', 'spingi il bacino nel colpo'], mistakes: [{ if: 'colpisci con la pianta', fix: 'rotazione del piede: è il taglio esterno che colpisce' }], drill: 'yoko-geri keage (risalente) al sacco, 3×10' },
      { id: 'uke', it: 'Age-uke / Gedan-barai (parate)', type: 'defense', how: ['para col lato dell\'avambraccio', 'il blocco finisce con contrazione', 'l\'altro pugno resta al fianco (hikite)'], mistakes: [{ if: 'pari molle', fix: 'la parata è un colpo contro l\'arto avversario' }], drill: 'parate alternate su attacco lento del compagno' },
      { id: 'kata', it: 'Kata (forma)', type: 'form', how: ['sequenza codificata di tecniche', 'ritmo: lenta preparazione, esplosione nel kime', 'sguardo (zanshin) sempre dove colpisci'], mistakes: [{ if: 'uniformi la velocità', fix: 'il kata respira: momenti lenti e kiai esplosivi' }], drill: 'Heian Shodan 5 volte cercando un solo kime perfetto' },
    ],
    combosSeed: [
      'kizami-zuki-gyaku-zuki',
      'age-uke-contrattacco gyaku-zuki',
      'mae-geri di controllo-gyaku-zuki',
      'finto mawashi-geri basso-kizami-zuki',
    ],
    ranks: ['Bianca (10° kyu)', 'Gialla (8°)', 'Arancione (7°)', 'Verde (6°)', 'Blu (4°)', 'Marrone (1°)', 'Nera (1° dan+)'],
  },

  taekwondo: {
    id: 'taekwondo', name: 'Taekwondo', emoji: '🦶', family: 'striking',
    origin: 'Corea — la via del piede: i calci più spettacolari delle arti marziali.',
    philosophy: 'Cortesia, integrità, perseveranza, autocontrollo, spirito indomabile: i cinque principi prima della tecnica.',
    etiquette: ['Inchino al maestro e alla bandiera', 'Rispetto assoluto dei gradi di cintura', 'Urla (kihap) nei momenti chiave'],
    stance: {
      name: 'Ap-seogi / guardia laterale',
      cues: ['Corpo quasi laterale al bersaglio', 'Peso sulla gamba posteriore (70%)', 'Mano anteriore bassa per misurare, posteriore alta', 'Rimbalzo leggero sulle gambe: sempre pronto a calciare'],
      errors: [
        { if: 'frontale come nella boxe', fix: 'ruota di più: il taekwondo vive di fianco' },
        { if: 'gambe rigide', fix: 'leggero molleggio: il calcio parte dal rimbalzo' },
      ],
    },
    breathing: {
      principle: 'Kihap: espirazione esplosiva che accompagna ogni calcio importante e contrae il core.',
      patterns: [
        { name: 'Respiro del calciatore', rhythm: 'inspira in guardia / kihap sul calcio', use: 'tutte le tecniche di gamba' },
        { name: 'Recupero tra le serie', rhythm: '4s / 4s nasale', use: 'tra le serie di calci' },
      ],
    },
    techniques: [
      { id: 'apchagi', it: 'Ap-chagi (frontale)', type: 'kick', how: ['ginocchio al petto', 'frustata della pianta del piede', 'ritiro rapido del ginocchio'], mistakes: [{ if: 'spingi invece di frustare', fix: 'ginocchio perno, il piede scatta come una frusta' }], drill: 'ap-chagi alternati al bersaglio alto, 3×15' },
      { id: 'dollyochagi', it: 'Dollyo-chagi (circolare)', type: 'kick', how: ['ginocchio su, corpo ruota', 'colpisci con il collo del piede', 'anca completamente ruotata all\'impatto'], mistakes: [{ if: 'anca chiusa', fix: 'il petto guarda il soffitto all\'impatto: apri tutto' }], drill: 'dollyo-chagi a scudo, 50 per gamba' },
      { id: 'yeopchagi', it: 'Yeop-chagi (laterale)', type: 'kick', how: ['corpo completamente laterale', 'tacco che spinge in linea retta', 'braccia in opposizione per l\'equilibrio'], mistakes: [{ if: 'calcio "a cucchiaio"', fix: 'linea retta: il yeop-chagi sfonda, non aggira' }], drill: 'yeop-chagi al sacco pesante, potenza controllata' },
      { id: 'dwit chagi', it: 'Dwi-chagi (calcio all\'indietro)', type: 'kick', how: ['sguardo oltre la spalla prima', 'tacco in linea retta verso il bersaglio', 'pivot completo del piede perno'], mistakes: [{ if: 'guardi il bersaglio solo alla fine', fix: 'la testa guida: guarda prima, calcia dopo' }], drill: 'dwi-chagi lenti con spotter, 3×8 per lato' },
      { id: 'naeryochagi', it: 'Naeryo-chagi (ascendente)', type: 'kick', how: ['gamba tesa che sale oltre la testa', 'flessibilità e controllo', 'il busto si apre all\'indietro'], mistakes: [{ if: 'pieghi il ginocchio', fix: 'gamba tesa: è un\'ascia che scende dall\'alto' }], drill: 'naeryo-chagi lenti, mobilità prima della velocità' },
      { id: 'poomse', it: 'Poomse (forma)', type: 'form', how: ['sequenza codificata', 'equilibrio su ogni transizione', 'sguardo e kihap nei punti chiave'], mistakes: [{ if: 'corri attraverso la forma', fix: 'ogni tecnica ha il suo respiro' }], drill: 'Taegeuk 1 ripetuto 5 volte con pause di controllo' },
    ],
    combosSeed: [
      'ap-chagi-dollyo-chagi alto',
      'finto yeop-chagi-dwi-chagi',
      'dollyo-chagi-naeryo-chagi',
      'doppio ap-chagi-dollyo-chagi girato',
    ],
    ranks: ['Bianca', 'Gialla', 'Verde', 'Blu', 'Rossa', 'Nera (1° dan+)'],
  },

  bjj: {
    id: 'bjj', name: 'Brazilian Jiu-Jitsu', emoji: '🥋', family: 'grappling',
    origin: 'Brasile (dal judo giapponese) — portare a terra e sottomettere: la leva batte la forza.',
    philosophy: 'Posizione prima della sottomissione. Pazienza e respirazione: chi si agita si stanca, chi respira pensa.',
    etiquette: ['Saluto al compagno prima e dopo il roll', 'Mai applicare con violenza una leva', 'Tappare subito e spesso: l\'ego resta fuori'],
    stance: {
      name: 'Base / guardia',
      cues: ['In piedi: ginocchia flesse, peso basso, gomiti dentro', 'A terra: gomiti incollati alle costole', 'Guardia chiusa: controllo con anche e gambe', 'Mai dare il collo o i polsi'],
      errors: [
        { if: 'braccia tese e larghe', fix: 'gomiti dentro: le braccia tese sono inviti a leve e strangolamenti' },
        { if: 'pancia piatta a terra nella guardia', fix: 'anche mobili: la guardia vive sulle anche' },
      ],
    },
    breathing: {
      principle: 'Respira sempre, soprattutto nelle posizioni scomode: l\'apnea è il primo segnale di panico.',
      patterns: [
        { name: 'Respiro da roll', rhythm: '4s inspira / 4s espira nasale', use: 'durante il grappling, sempre dal naso' },
        { name: 'Reset sotto pressione', rhythm: 'espirazione lunga 6s quando sei schiacciato', use: 'sotto montaggio o side control: calma prima di muovere' },
      ],
    },
    techniques: [
      { id: 'closedguard', it: 'Guardia chiusa', type: 'position', how: ['caviglie incrociate dietro la schiena', 'controlla polsi e postura', 'rompi la postura prima di attaccare'], mistakes: [{ if: 'tieni le braccia distese sul petto', fix: 'afferra polsi/maniche e tira la postura giù' }], drill: 'da guardia chiusa: rompi la postura 10 volte senza farla risalire' },
      { id: 'hipescape', it: 'Fuga d\'anca (shrimping)', type: 'movement', how: ['spalla a terra, guarda il soffitto', 'spingi col piede e scivola col sedere', 'crea spazio per rientrare in guardia'], mistakes: [{ if: 'rotoli sulla pancia', fix: 'resta di fianco: la fuga vive sul fianco' }], drill: 'shrimping su e giù per il materasso, 10 passaggi' },
      { id: 'upakimura', it: 'Upa (ponte) dalla montaggio', type: 'escape', how: ['afferra il braccio e il piede dello stesso lato', 'ponte esplosivo verso quel lato', 'ginocchio che entra a recuperare la guardia'], mistakes: [{ if: 'ponti al centro', fix: 'ponte verso il braccio controllato: rotola l\'avversario' }], drill: 'upa a vuoto 3×10, poi col compagno che resiste al 30%' },
      { id: 'armbar', it: 'Armbar', type: 'submission', how: ['controlla il polso al petto', 'anca sotto la spalla, ginocchio sulla faccia', 'estendi l\'anca, non tirare il braccio'], mistakes: [{ if: 'tiri il braccio a braccia', fix: 'è l\'anca che estende: le braccia tengono solo la posizione' }], drill: 'armbar dalla guardia chiusa, 20 ripetizioni lente' },
      { id: 'triangle', it: 'Triangolo', type: 'submission', how: ['gambe attorno a collo e braccio', 'taglia l\'angolo a 90°', 'ginocchio sulla spalla, tira la testa giù'], mistakes: [{ if: 'chiudi senza tagliare l\'angolo', fix: 'prima l\'angolo: le gambe da sole non bastano' }], drill: 'triangolo a vuoto 3×10 cercando l\'angolo perfetto' },
      { id: 'rear naked choke', it: 'Rear naked choke', type: 'submission', how: ['presa a "cintura di sicurezza"', 'gomito sotto il mento', 'chiudi con il bicipite contro la carotide, non col muscolo'], mistakes: [{ if: 'stringi con le mani', fix: 'espandi il petto e porta i ganci: sono le scapole a chiudere' }], drill: 'dalla schiena: posizione prima della presa, 20 ripetizioni' },
      { id: 'sweep', it: 'Raschiata (scissor sweep)', type: 'sweep', how: ['ginocchio al petto, stinco sulla pancia', 'taglio a forbice delle gambe', 'tira verso di te mentre tagli'], mistakes: [{ if: 'spingi via l\'avversario', fix: 'tira E taglia insieme: la forbice funziona in opposizione' }], drill: 'scissor sweep su compagno cooperativo, 3×10' },
    ],
    combosSeed: [
      'rompi postura → armbar finto → triangolo',
      'upakimura → recupero guardia → raschiata',
      'fuga d\'anca → ginocchio dentro → controllo schiena',
      'armbar dalla guardia → transizione triangolo',
    ],
    ranks: ['Bianca', 'Blu', 'Viola', 'Marrone', 'Nera'],
  },

  judo: {
    id: 'judo', name: 'Judo', emoji: '🥋', family: 'grappling',
    origin: 'Giappone (Jigoro Kano) — "via della cedevolezza": usa la forza dell\'avversario.',
    philosophy: 'Seiryoku zenyo: massimo risultato col minimo sforzo. Jita kyoei: mutua prosperità. Cadere bene è la prima vittoria.',
    etiquette: ['Rei (inchino) sempre: dojo, compagno, tatami', 'Judo pulito: niente prese sporche', 'Aiuta chi impara a cadere'],
    stance: {
      name: 'Shizentai (posizione naturale)',
      cues: ['Piedi larghezza spalle, ginocchia morbide', 'Presa sul judogi: manica + bavero', 'Postura eretta: chi si piega perde l\'equilibrio', 'Sensibilità nelle mani: senti il peso dell\'altro'],
      errors: [
        { if: 'presa bassa e rigida', fix: 'presa alta e morbida: le mani sentono, non stringono' },
        { if: 'busto piegato avanti', fix: 'eretto: il piegato si fa proiettare' },
      ],
    },
    breathing: {
      principle: 'Espirazione nello sforzo del kake (esecuzione), mai apnea: il respiro lega kuzushi, tsukuri e kake.',
      patterns: [
        { name: 'Respiro della proiezione', rhythm: 'inspira nel kuzushi / espira nel kake', use: 'ogni tecnica di lancio' },
        { name: 'Calma del randori', rhythm: '4s / 4s tra gli attacchi', use: 'per non andare in debito di ossigeno' },
      ],
    },
    techniques: [
      { id: 'ukemi', it: 'Ukemi (cadute)', type: 'movement', how: ['mento al petto, mai mano piatta', 'braccio che batte a 45°', 'il corpo rotola, non si schianta'], mistakes: [{ if: 'atterri sul braccio teso', fix: 'il braccio batte il tatami, non lo sostiene' }], drill: '20 ukemi posteriori, 20 laterali, 10 anteriori a lezione' },
      { id: 'osaekomi', it: 'Osaekomi-waza (immobilizzazioni)', type: 'position', how: ['petto contro petto, anche basse', 'controllo della testa o del braccio', 'resta pesante: il peso è il tuo judogi invisibile'], mistakes: [{ if: 'tieni il peso alto sui gomiti', fix: 'sciogliti sull\'avversario: più sei piatto, più sei pesante' }], drill: 'kesa-gatame 3×30 secondi col compagno che tenta la fuga' },
      { id: 'ogoshi', it: 'O-goshi (grande anca)', type: 'throw', how: ['kuzushi: tira in avanti-alto', 'anche sotto le sue, più basse', 'ruota e carica sulla schiena'], mistakes: [{ if: 'tiri a braccia', fix: 'le gambe piegano e le anche caricano: le braccia guidano soltanto' }], drill: 'o-goshi a vuoto 3×10, poi su compagno cooperativo' },
      { id: 'deashibarai', it: 'De-ashi-barai (spazzata avanzata)', type: 'throw', how: ['tempismo sul passo, non forza', 'spazzata col piede mentre l\'altro avanza', 'mani che guidano nella stessa direzione'], mistakes: [{ if: 'spazzi quando il peso è già sull\'altro piede', fix: 'anticipa il trasferimento: si spazza il piede che sta per posarsi' }], drill: 'spazzate in movimento col compagno che cammina' },
      { id: 'seoinage', it: 'Seoi-nage (proiezione di spalla)', type: 'throw', how: ['entra girando le spalle', 'gomito basso sotto l\'ascella', 'proietta piegando le gambe, non la schiena'], mistakes: [{ if: 'entri alto', fix: 'scendi sotto il suo baricentro: chi entra basso proietta' }], drill: 'seoi-nage a vuoto 30 ripetizioni, velocità crescente' },
      { id: 'kesagatame', it: 'Kesa-gatame', type: 'position', how: ['fianco contro fianco, testa controllata', 'gambe aperte a base larga', 'segui ogni sua rotazione con le anche'], mistakes: [{ if: 'gambe strette', fix: 'apri la base: gambe larghe = stabilità' }], drill: 'transizioni da kesa a yoko-shiho, 3×5' },
    ],
    combosSeed: [
      'o-goshi finto → de-ashi-barai',
      'spinta → o-soto-gari in risposta alla resistenza',
      'seoi-nage → passaggio a kesa-gatame',
      'kuzushi frontale → tomoe-nage',
    ],
    ranks: ['Bianca (6° kyu)', 'Gialla', 'Arancione', 'Verde', 'Blu', 'Marrone (1° kyu)', 'Nera (dan)'],
  },

  wrestling: {
    id: 'wrestling', name: 'Lotta', emoji: '🤼', family: 'grappling',
    origin: 'Una delle arti più antiche — controllo, proiezioni e schienamento senza leve.',
    philosophy: 'Pressione costante e posizione dominante: chi controlla il centro controlla il match. La lotta si vince col fiato.',
    etiquette: ['Stretta di mano prima e dopo', 'Controllo delle proiezioni in allenamento', 'Igiene: unghie corte, niente pelle scoperta infetta'],
    stance: {
      name: 'Stance da lotta',
      cues: ['Testa alta, sguardo avanti', 'Ginocchia flesse, peso sugli avampiedi', 'Gomiti dentro, mani che controllano', 'Schiena dritta, anche basse'],
      errors: [
        { if: 'testa bassa', fix: 'dove va la testa va il corpo: guarda l\'avversario' },
        { if: 'gambe incrociate nei passi', fix: 'passi trascinati: mai incrociare, mai saltellare' },
      ],
    },
    breathing: {
      principle: 'Respiro potente e ritmico: la lotta è anaerobica, allenati a respirare sotto pressione.',
      patterns: [
        { name: 'Respiro da takedown', rhythm: 'inspira in stance / espira esplosiva nell\'ingresso', use: 'ogni tentativo di atterramento' },
        { name: 'Recupero tra i periodi', rhythm: '6s / 2s per abbassare il battito', use: 'pause e riposi' },
      ],
    },
    techniques: [
      { id: 'stance_motion', it: 'Stance & motion', type: 'movement', how: ['passi corti e trascinati', 'mai piedi uniti o incrociati', 'cambio di livello fluido'], mistakes: [{ if: 'saltelli', fix: 'scivola: il saltello ti fa atterrare' }], drill: 'shadow wrestling: stance e spostamenti 3×2 minuti' },
      { id: 'levelchange', it: 'Cambio di livello', type: 'movement', how: ['scendi di gambe, non di schiena', 'testa resta alta', 'il livello basso prepara l\'ingresso'], mistakes: [{ if: 'pieghi la vita', fix: 'ginocchia e anche: la testa resta su' }], drill: 'level change ripetuti, 3×15' },
      { id: 'doubleleg', it: 'Double leg', type: 'takedown', how: ['level change + passo lungo', 'spalla al fianco, testa dentro', 'guida con la testa e le anche'], mistakes: [{ if: 'entri alto e lontano', fix: 'vicino e basso: la distanza è il nemico del double' }], drill: 'double leg a vuoto sul materasso, 30 ingressi' },
      { id: 'singleleg', it: 'Single leg', type: 'takedown', how: ['afferra una gamba al ginocchio', 'testa dentro o fuori a seconda del finish', 'cammina la gamba e guida'], mistakes: [{ if: 'tiri la gamba verso di te', fix: 'solleva e sposta: la gamba si gestisce, non si strappa' }], drill: 'single leg con finish alternati, 3×10' },
      { id: 'sprawl', it: 'Sprawl (difesa)', type: 'defense', how: ['anche indietro e in basso', 'petto sulla schiena dell\'avversario', 'peso che schiaccia, non mani che spingono'], mistakes: [{ if: 'difendi con le mani', fix: 'sono le anche che tornano indietro: le mani controllano dopo' }], drill: 'sprawl a comando (voce o fischio), 3×20' },
      { id: 'gutwrench', it: 'Gut wrench', type: 'turn', how: ['presa alla vita da dietro', 'rotazione esplosiva sulle anche', 'resta incollato durante il giro'], mistakes: [{ if: 'tiri solo con le braccia', fix: 'il giro parte dalle anche e dalle gambe' }], drill: 'gut wrench su compagno prono, 3×8 per lato' },
    ],
    combosSeed: [
      'finto double leg → single leg',
      'push sulla testa → double leg',
      'sprawl → passaggio dietro → gut wrench',
      'ankle pick dalla pressione delle mani',
    ],
    ranks: ['Principiante', 'Intermedio', 'Avanzato', 'Competitore', 'Elite'],
  },

  mma: {
    id: 'mma', name: 'MMA', emoji: '🧬', family: 'hybrid',
    origin: 'Misto di striking e grappling — l\'arte che integra tutte le arti.',
    philosophy: 'Adattabilità: non esiste stile puro, esiste ciò che funziona nelle tre fasi (distanza, clinch, terra).',
    etiquette: ['Massimo controllo nei drill misti', 'Mai colpi veri a terra senza protezioni', 'Rispetto dei limiti del compagno'],
    stance: {
      name: 'Guardia MMA',
      cues: ['Più frontale della muay thai (difesa dai takedown)', 'Mani leggermente più basse e avanzate', 'Peso pronto a difendere le gambe', 'Distanza gestita col jab e col front kick'],
      errors: [
        { if: 'guardia alta e rigida da kickboxer', fix: 'mani più avanti: devi vedere e fermare gli ingressi' },
        { if: 'peso sulla gamba anteriore', fix: 'peso centrale: devi poter calciare e difendere i takedown' },
      ],
    },
    breathing: {
      principle: 'Gestione del ritmo su 3 fasi: respira in distanza, controlla il fiato nel clinch, calma a terra.',
      patterns: [
        { name: 'Reset tra le fasi', rhythm: 'espirazione lunga nel passaggio di fase', use: 'quando il combattimento cambia distanza' },
        { name: 'Respiro da ground and pound', rhythm: 'espira a ogni colpo, mai apnea', use: 'lavoro a terra' },
      ],
    },
    techniques: [
      { id: 'jab_range', it: 'Jab di gestione', type: 'punch', how: ['misura la distanza', 'disturba gli ingressi', 'apre il takedown o il calcio'], mistakes: [{ if: 'jab solo per colpire', fix: 'in MMA il jab è soprattutto controllo della distanza' }], drill: 'jab + arretramento, 3 round' },
      { id: 'cross', it: 'Diretto', type: 'punch', how: ['meccanica classica', 'attenzione al livello: può partire il takedown', 'ritorno con mani pronte alla difesa'], mistakes: [{ if: 'ti sbilanci col cross', fix: 'colpisci col peso centrato: il cross sbilanciato regala il takedown' }], drill: '1-2 con sprawl a comando ogni 10 colpi' },
      { id: 'wallwalk', it: 'Wall walk', type: 'movement', how: ['dalla schiena risali sulle gambe', 'mani a terra, piedi che camminano verso il muro', 'usato per simulare la risalita dalla gabbia'], mistakes: [{ if: 'risali con la schiena curva', fix: 'core attivo, corpo in linea' }], drill: '3×5 wall walk lenti' },
      { id: 'sprawl_brawl', it: 'Sprawl and brawl', type: 'defense', how: ['difendi il takedown', 'risali subito in guardia', 'colpisci mentre l\'avversario è sbilanciato'], mistakes: [{ if: 'restare a terra dopo lo sprawl', fix: 'sprawl e risali: la lotta in piedi è il tuo piano' }], drill: 'sprawl + 1-2 immediato, 3×15' },
      { id: 'groundandpound', it: 'Ground and pound', type: 'position', how: ['base stabile sopra l\'avversario', 'colpi controllati con la base', 'una mano lavora, una controlla'], mistakes: [{ if: 'colpisci senza base', fix: 'prima la base, poi i colpi: chi perde la base viene ribaltato' }], drill: 'ground and pound controllato su scudo a terra' },
      { id: 'getup', it: 'Technical get-up', type: 'movement', how: ['dalla guardia risali tecnico', 'mani che controllano, piedi che si posizionano', 'mai alzarsi dando la schiena'], mistakes: [{ if: 'ti alzi frontale', fix: 'risali laterale con controllo: mai regalare la schiena' }], drill: 'technical stand-up 3×10 per lato' },
    ],
    combosSeed: [
      'jab-cross → level change → double leg',
      'teep di controllo → 1-2 → clinch con ginocchiata',
      'sprawl → gancio → ripresa distanza',
      'finto takedown → montante',
    ],
    ranks: ['Dilettante', 'Intermedio', 'Avanzato', 'Semi-pro', 'Professionista'],
  },

  kravmaga: {
    id: 'kravmaga', name: 'Krav Maga', emoji: '🛡️', family: 'selfdefense',
    origin: 'Israele — sistema di autodifesa militare: semplicità e efficacia sotto stress.',
    philosophy: 'Nessuna regola, nessun ego: neutralizzare la minaccia e uscire. Semplicità sotto stress batte bellezza in palestra.',
    etiquette: ['Controllo assoluto nei drill con contatto', 'Mai tecniche pericolose senza supervisione', 'Scenario prima della tecnica: si ragiona su contesto'],
    stance: {
      name: 'Guardia passiva/attiva',
      cues: ['Passiva: mani aperte avanti ("calma, non voglio problemi")', 'Attiva: guardia alta senza telegrafare', 'Peso pronto a esplodere o a scappare', 'Sguardo periferico: cerca le uscite'],
      errors: [
        { if: 'mani nei fianchi o in tasca', fix: 'mani sempre disponibili: la guardia passiva è già una guardia' },
        { if: 'frontale e statico', fix: 'leggero angolo, sempre in movimento minimo' },
      ],
    },
    breathing: {
      principle: 'Sotto adrenalina il respiro si accorcia: allenati a espirare in modo esplosivo e a parlare ("indietro!") mentre agisci.',
      patterns: [
        { name: 'Respiro da stress', rhythm: 'espirazione corta e sonora a ogni tecnica', use: 'tutti i drill di autodifesa' },
        { name: 'Recupero post-scenario', rhythm: '4s / 6s per abbassare l\'adrenalina', use: 'dopo il drill: torna calmo' },
      ],
    },
    techniques: [
      { id: 'burst', it: 'Burst (esplosione)', type: 'concept', how: ['esplosione immediata di colpi multipli', 'avanzamento continuo', 'fine quando la minaccia è neutralizzata o sei fuori'], mistakes: [{ if: 'colpisci e aspetti', fix: 'il burst è un fiume: colpi continui finché non sei sicuro' }], drill: 'burst su scudo: 5 colpi + uscita, 3×10' },
      { id: 'palmstrike', it: 'Colpo a palmo', type: 'strike', how: ['tacco del palmo al mento/naso', 'dita verso l\'alto, polso dritto', 'più sicuro del pugno senza guanti'], mistakes: [{ if: 'colpisci con le dita', fix: 'è il talco del palmo che colpisce: dita indietro' }], drill: 'palm strike alternati su scudo, 3×15' },
      { id: 'groinkick', it: 'Calcio all\'inguine', type: 'kick', how: ['ginocchio che sale come il teep', 'impatto veloce e ritratto', 'usato per creare spazio, non per finire'], mistakes: [{ if: 'cerchi potenza esagerata', fix: 'velocità e sorpresa: poi scappi o esplodi' }], drill: 'calcio controllato al bersaglio basso, 3×10' },
      { id: 'chokedefense', it: 'Difesa da strangolamento', type: 'defense', how: ['mento giù, mani immediate al polso', 'girati verso il pollice (punto debole)', 'contrattacco immediato e uscita'], mistakes: [{ if: 'tiri il braccio senza girarti', fix: 'la rotazione del corpo apre la presa, non la forza delle braccia' }], drill: 'difese da presa frontale lenta, 3×8' },
      { id: 'wristrelease', it: 'Liberazione dal polso', type: 'defense', how: ['ruota verso il pollice della presa', 'tutto il corpo partecipa', 'subito distanza o contrattacco'], mistakes: [{ if: 'tiri contro le dita', fix: 'si scappa dal pollice: è il punto debole di ogni presa' }], drill: 'liberazioni da presa singola e doppia, 3×8' },
      { id: 'scanexit', it: 'Scan e uscita', type: 'concept', how: ['dopo la neutralizzazione: scansione 360°', 'cerchi armi, complici, uscite', 'muoviti verso l\'uscita'], mistakes: [{ if: 'restare fermo a guardare', fix: 'scan e muoviti: lo scenario finisce solo quando sei al sicuro' }], drill: 'ogni drill finisce con scan verbale: "via libera, esco"' },
    ],
    combosSeed: [
      'difesa da pugno → burst → scan e uscita',
      'presa al bavero → palm strike → ginocchiata → uscita',
      'strangolamento → rotazione → colpo all\'inguine → fuga',
      'bastone corto: difesa → disarmo → distanza',
    ],
    ranks: ['Praticante 1', 'Praticante 2', 'Praticante 3', 'Graduato 1', 'Graduato 2', 'Esperto'],
  },

  capoeira: {
    id: 'capoeira', name: 'Capoeira', emoji: '🎶', family: 'hybrid',
    origin: 'Brasile (radici africane) — lotta danzata: ginga, musica e malizia.',
    philosophy: 'Malizia e fluidità: la capoeira si gioca, non si combatte. Il corpo inganna mentre la musica guida.',
    etiquette: ['Rispetto della roda e del berimbau', 'Si entra e si esce con malizia, non con aggressività', 'Saluto ai musicisti'],
    stance: {
      name: 'Ginga',
      cues: ['movimento continuo a triangolo', 'braccia che proteggono il viso in opposizione', 'ginocchia sempre morbide', 'mai fermi: la ginga è respiro'],
      errors: [
        { if: 'ginga rigida e simmetrica', fix: 'la ginga è asimmetrica e viva: cambia ritmo' },
        { if: 'piedi piatti e pesanti', fix: 'avampiedi: devi poter scivolare' },
      ],
    },
    breathing: {
      principle: 'Il respiro segue il ritmo del berimbau: inspira nella ginga, espira nelle tecniche.',
      patterns: [
        { name: 'Respiro della roda', rhythm: 'inspira 2 tempi / espira sulla tecnica', use: 'durante il gioco' },
        { name: 'Calma nella roda', rhythm: '4s / 4s nella ginga', use: 'per durare nel gioco senza fiatone' },
      ],
    },
    techniques: [
      { id: 'ginga', it: 'Ginga', type: 'movement', how: ['triangolo continuo di passi', 'braccia in opposizione', 'sguardo sempre sull\'altro'], mistakes: [{ if: 'ginga sul posto', fix: 'la ginga viaggia: avanti, indietro, laterale' }], drill: '5 minuti di ginga continua a ritmo' },
      { id: 'esquiva', it: 'Esquiva (schivata)', type: 'defense', how: ['scendi di lato o indietro', 'una mano a terra', 'resta pronto a contrattaccare'], mistakes: [{ if: 'arretrare dritto', fix: 'la esquiva esce dalla linea: laterale o in rotazione' }], drill: 'esquive su attacco lento, 3×10' },
      { id: 'meialua', it: 'Meia lua de compasso', type: 'kick', how: ['mani a terra, sguardo tra le braccia', 'gamba che frusta dall\'alto', 'rotazione completa delle anche'], mistakes: [{ if: 'guardia assente', fix: 'una mano protegge sempre, anche a terra' }], drill: 'meia lua alternata, 3×8 per lato' },
      { id: 'armada', it: 'Armada', type: 'kick', how: ['calcio circolare in rotazione', 'braccia che guidano la rotazione', 'tacco che sfiora il bersaglio'], mistakes: [{ if: 'rotazione incompleta', fix: 'completa il giro: l\'armada finisce dove è iniziata' }], drill: 'armada lenta 3×8, poi a ritmo' },
      { id: 'au', it: 'Aú (ruota)', type: 'movement', how: ['mani a terra in sequenza', 'gambe aperte in aria', 'atterraggio in ginga'], mistakes: [{ if: 'testa che guarda in basso', fix: 'sguardo verso dove vai: la ruota segue lo sguardo' }], drill: 'aú lenti su materasso, 10 ripetizioni' },
    ],
    combosSeed: [
      'ginga → esquiva → meia lua',
      'au → armada',
      'finta di ginga → queixada',
      'esquiva baixa → rasteira',
    ],
    ranks: ['Corda crua', 'Corda verde', 'Amarela', 'Azul', 'Marrone', 'Preto (Mestre)'],
  },
};

// ID disciplina → alias accettati (dai prompt e dai mode del sito)
const ALIASES = {
  muaythai: ['muay thai', 'muay', 'thai'],
  boxing: ['boxe', 'box', 'pugilato'],
  kickboxing: ['kick', 'kb'],
  karate: ['shotokan'],
  taekwondo: ['tkd', 'taekwondo'],
  bjj: ['jiu jitsu', 'jiujitsu', 'jiu-jitsu', 'grappling'],
  judo: [],
  wrestling: ['lotta', 'wrestle'],
  mma: [],
  kravmaga: ['krav maga', 'krav', 'autodifesa'],
  capoeira: [],
};

export const DISCIPLINE_IDS = Object.keys(MARTIAL_DISCIPLINES);

export function getDiscipline(idOrName) {
  if (!idOrName) return null;
  const key = String(idOrName).toLowerCase().trim();
  if (MARTIAL_DISCIPLINES[key]) return MARTIAL_DISCIPLINES[key];
  for (const [id, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(key)) return MARTIAL_DISCIPLINES[id];
  }
  return null;
}

// Prompt compatto per l'AI di analisi (visual.js / coach): insegna al modello
// cosa osservare in questa disciplina, con la voce del maestro.
export function coachKnowledgePrompt(disciplineId) {
  const d = getDiscipline(disciplineId);
  if (!d) return '';
  const techLines = d.techniques.map((t) =>
    `- ${t.it}: ${t.how.join('; ')}. Errori tipici: ${t.mistakes.map((m) => `${m.if} → ${m.fix}`).join(' | ')}`
  ).join('\n');
  return (
    `Sei un maestro esperto di ${d.name}. ${d.origin}\n` +
    `Filosofia: ${d.philosophy}\n` +
    `Guardia (${d.stance.name}): ${d.stance.cues.join('; ')}\n` +
    `Respirazione: ${d.breathing.principle}\n` +
    `Tecniche e correzioni:\n${techLines}\n` +
    `Correggi sempre con la formula: COSA VEDI → PERCHÉ È UN PROBLEMA → COME SI CORREGGE (1 cue pratico).`
  );
}

// Lista per menu/toggle della UI
export function disciplineOptions() {
  return DISCIPLINE_IDS.map((id) => {
    const d = MARTIAL_DISCIPLINES[id];
    return { id, name: d.name, emoji: d.emoji, family: d.family };
  });
}

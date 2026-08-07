// ─────────────────────────────────────────────────────────────────────────────
//  Scheletro del curriculum di Francese: solo i TEMI (zero token, zero I/O).
//  Fonte UNICA condivisa da app web (src/pages/French.jsx) e bot Telegram
//  (api/telegram/webhook.js) — un solo posto da aggiornare, niente drift.
// ─────────────────────────────────────────────────────────────────────────────

export const FR_CURRICULUM = [
  { level: 'A1', color: '#3b5fc4', units: [
    { id: 'a1-01', emoji: '👋', title: 'Saluti e presentazioni', topic: 'saluti, presentarsi, come stai, di dove sei' },
    { id: 'a1-02', emoji: '🔢', title: 'Numeri 0–20', topic: 'numeri da 0 a 20, contare, età' },
    { id: 'a1-03', emoji: '🗓️', title: 'Giorni e mesi', topic: 'giorni della settimana, mesi, che giorno è' },
    { id: 'a1-04', emoji: '👨‍👩‍👧', title: 'La famiglia', topic: 'membri della famiglia, possessivi mon/ma/mes' },
    { id: 'a1-05', emoji: '🍎', title: 'Al bar e al ristorante', topic: 'ordinare cibo e bevande, chiedere il conto, je voudrais, l’addition' },
    { id: 'a1-06', emoji: '🎨', title: 'Colori e oggetti', topic: 'colori, oggetti comuni, c’est / il y a' },
    { id: 'a1-07', emoji: '🕐', title: 'Orari e appuntamenti', topic: 'chiedere l’ora, orari di apertura, fissare un appuntamento' },
    { id: 'a1-08', emoji: '🏠', title: 'Hotel e alloggio', topic: 'prenotare una camera, fare il check-in, chiedere servizi e problemi in hotel' },
    { id: 'a1-09', emoji: '🧍', title: 'Verbi être & avoir', topic: 'presente di être e avoir, frasi semplici' },
    { id: 'a1-10', emoji: '🛒', title: 'Shopping e necessità', topic: 'negozi, taglie, prezzi, pagare, chiedere aiuto in farmacia' },
    { id: 'a1-11', emoji: '📐', title: 'Articoli e genere', topic: 'le/la/les, un/une/des, maschile e femminile dei nomi' },
    { id: 'a1-12', emoji: '⚡', title: 'Verbi in -er', topic: 'presente dei verbi regolari in -er, parler/aimer/habiter' },
    { id: 'a1-13', emoji: '🚫', title: 'La negazione', topic: 'ne...pas, ne...jamais, ne...plus, frasi negative' },
    { id: 'a1-14', emoji: '🧑‍🎨', title: 'Aggettivi qualificativi', topic: 'accordo degli aggettivi, descrivere persone e cose' },
    { id: 'a1-15', emoji: '🛋️', title: 'La casa e le stanze', topic: 'stanze della casa, mobili, preposizioni di luogo' },
    { id: 'a1-16', emoji: '🥖', title: 'Al mercato', topic: 'cibo, quantità (un peu de, beaucoup de), fare la spesa' },
    { id: 'a1-17', emoji: '🧭', title: 'Chiedere indicazioni', topic: 'indicazioni per strada, tout droit, à gauche/à droite' },
    { id: 'a1-18', emoji: '⚽', title: 'Sport e attività', topic: 'faire du sport, jouer à/de, attività quotidiane' },
    { id: 'a1-19', emoji: '🐶', title: 'Animali e natura', topic: 'animali comuni, la campagna, gusti e preferenze' },
    { id: 'a1-20', emoji: '📱', title: 'Telefono e tecnologia', topic: 'rispondere al telefono, messaggi, vocabolario tech di base' },
  ] },
  { level: 'A2', color: '#7c5cc4', units: [
    { id: 'a2-01', emoji: '🚆', title: 'Muoversi in viaggio', topic: 'stazione e aeroporto, biglietti, coincidenze, indicazioni e imprevisti' },
    { id: 'a2-02', emoji: '🕰️', title: 'Passato (passé composé)', topic: 'passé composé con avoir, participi comuni' },
    { id: 'a2-03', emoji: '🌤️', title: 'Il tempo e le stagioni', topic: 'meteo, stagioni, il fait beau/froid' },
    { id: 'a2-04', emoji: '💼', title: 'Lavoro e professioni', topic: 'professioni, descrivere il proprio lavoro' },
    { id: 'a2-05', emoji: '🩺', title: 'Salute in viaggio', topic: 'spiegare sintomi, farmacia, medico, emergenze e avoir mal à' },
    { id: 'a2-06', emoji: '🎭', title: 'Tempo libero', topic: 'hobby, faire du/de la, uscite' },
    { id: 'a2-07', emoji: '➡️', title: 'Futuro (futur proche)', topic: 'futur proche aller + infinito, progetti' },
    { id: 'a2-08', emoji: '🗣️', title: 'Opinioni', topic: 'esprimere opinioni, je pense que, perché' },
    { id: 'a2-09', emoji: '📊', title: 'Passato con être', topic: 'passé composé con être, verbi di movimento, accordo participio' },
    { id: 'a2-10', emoji: '🔁', title: 'Verbi pronominali', topic: 'se lever, se laver, routine quotidiana riflessiva' },
    { id: 'a2-11', emoji: '⚖️', title: 'Comparativi e superlativi', topic: 'plus/moins/aussi que, le plus, confrontare cose' },
    { id: 'a2-12', emoji: '❗', title: 'L’imperativo', topic: 'imperativo affermativo e negativo, dare istruzioni e consigli' },
    { id: 'a2-13', emoji: '🏙️', title: 'La città e il quartiere', topic: 'edifici pubblici, mezzi di trasporto urbani, orientarsi' },
    { id: 'a2-14', emoji: '🎉', title: 'Feste e tradizioni', topic: 'festività francesi, auguri, inviti ed eventi' },
    { id: 'a2-15', emoji: '✉️', title: 'Scrivere un’email', topic: 'registro formale/informale, formule di apertura e chiusura' },
    { id: 'a2-16', emoji: '👥', title: 'Pronomi tonici e y/en', topic: 'moi/toi/lui/elle, il vocalico y ed en di base' },
  ] },
  { level: 'B1', color: '#c45c8a', units: [
    { id: 'b1-01', emoji: '📖', title: 'Raccontare storie', topic: 'imparfait vs passé composé, raccontare al passato' },
    { id: 'b1-02', emoji: '🎯', title: 'Obiettivi e desideri', topic: 'conditionnel, je voudrais/j’aimerais, ipotesi' },
    { id: 'b1-03', emoji: '🧩', title: 'Pronomi complemento', topic: 'pronomi le/la/les, lui/leur, y, en' },
    { id: 'b1-04', emoji: '🌍', title: 'Attualità e società', topic: 'temi di attualità, argomentare, connettori' },
    { id: 'b1-05', emoji: '🎬', title: 'Cultura francese', topic: 'cinema, musica, abitudini culturali francesi' },
    { id: 'b1-06', emoji: '✍️', title: 'Subjonctif base', topic: 'subjonctif présent, il faut que, emozioni' },
    { id: 'b1-07', emoji: '🔮', title: 'Il futuro semplice', topic: 'futur simple, previsioni e promesse' },
    { id: 'b1-08', emoji: '🌀', title: 'Il gerundio', topic: 'en + participio presente, azioni simultanee' },
    { id: 'b1-09', emoji: '💬', title: 'Discorso indiretto', topic: 'il a dit que, riportare frasi altrui al presente e al passato' },
    { id: 'b1-10', emoji: '🔗', title: 'Connettori logici', topic: 'cependant, donc, par conséquent, strutturare un discorso' },
    { id: 'b1-11', emoji: '🧑‍💼', title: 'Il colloquio di lavoro', topic: 'CV, punti di forza, rispondere a domande di colloquio' },
    { id: 'b1-12', emoji: '✈️', title: 'Viaggiare in modo sostenibile', topic: 'ambiente, trasporti alternativi, esprimere preoccupazioni' },
    { id: 'b1-13', emoji: '🗳️', title: 'Dibattere un’opinione', topic: 'd’un côté...de l’autre, essere d’accordo/in disaccordo con sfumature' },
    { id: 'b1-14', emoji: '🏛️', title: 'Storia e geografia francese', topic: 'regioni di Francia, eventi storici principali, piccoli aneddoti' },
  ] },
  { level: 'B2', color: '#c47a3b', units: [
    { id: 'b2-01', emoji: '🎓', title: 'Subjonctif avanzato', topic: 'subjonctif dopo bien que, à moins que, sfumature di dubbio' },
    { id: 'b2-02', emoji: '🎭', title: 'Registro formale vs informale', topic: 'differenze di registro, tu/vous, linguaggio colloquiale francese' },
    { id: 'b2-03', emoji: '📝', title: 'Argomentare per iscritto', topic: 'struttura di un saggio breve, tesi e antitesi, connettori avanzati' },
    { id: 'b2-04', emoji: '📚', title: 'Letteratura francese', topic: 'autori celebri, estratti semplificati, commentare un testo' },
    { id: 'b2-05', emoji: '🤝', title: 'Negoziare e persuadere', topic: 'linguaggio della negoziazione, proporre e controproporre' },
    { id: 'b2-06', emoji: '📈', title: 'Economia e attualità', topic: 'vocabolario economico di base, commentare notizie' },
    { id: 'b2-07', emoji: '🗿', title: 'Espressioni idiomatiche', topic: 'modi di dire francesi comuni e il loro uso naturale' },
    { id: 'b2-08', emoji: '🎤', title: 'Presentazioni orali', topic: 'struttura di una presentazione, gestire domande del pubblico' },
    { id: 'b2-09', emoji: '⏳', title: 'Tempi composti avanzati', topic: 'plus-que-parfait, futur antérieur, sequenze temporali complesse' },
    { id: 'b2-10', emoji: '🧠', title: 'Il condizionale passato', topic: 'conditionnel passé, rimpianti e ipotesi non realizzate' },
  ] },
];

export const FR_ALL_UNITS = FR_CURRICULUM.flatMap((l) => l.units.map((u) => ({ ...u, level: l.level, color: l.color })));
export const frUnitById = (id) => FR_ALL_UNITS.find((u) => u.id === id);
export const frUnitByIndex = (idx) => FR_ALL_UNITS[Math.max(0, Math.min(FR_ALL_UNITS.length - 1, idx || 0))];

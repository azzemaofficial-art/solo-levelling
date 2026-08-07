// ─────────────────────────────────────────────────────────────────────────────
//  Gate della Conoscenza — Fase 2: multi-Gate + SRS (ripasso spaziato) + Boss.
//  Logica pura (niente I/O). Persistenza KV e invio Telegram in webhook.js.
// ─────────────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'];
// Giorno calendario in fuso Europe/Rome (non UTC): streak e scadenze SRS devono
// scattare a mezzanotte italiana, non alle 01:00/02:00 ora locale.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
const today = () => dayFmt.format(new Date());
const addDays = (n) => dayFmt.format(new Date(Date.now() + n * 86400000));
const SRS_DAYS = [1, 2, 4, 8, 16, 35]; // intervalli per box

// ── GATE (corsi strutturati, in ordine) ─────────────────────────────────────
export const GATES = {
  'prog-ia': {
    name: 'Programmazione + IA', emoji: '🟩', course: [
      { m: 'Fondamenti', q: 'A cosa serve una <b>variabile</b>?', a: ['Memorizzare un valore riutilizzabile', 'Spegnere il programma', 'Disegnare a schermo'], correct: 0, exp: 'Una variabile è un contenitore con un nome che memorizza un valore.' },
      { m: 'Fondamenti', q: 'Cosa fa un <b>ciclo (loop)</b>?', a: ['Ripete istruzioni più volte', 'Cancella i file', 'Crea una variabile'], correct: 0, exp: 'Un loop ripete un blocco finché una condizione è vera.' },
      { m: 'Fondamenti', q: 'Una <b>funzione</b> serve a…', a: ['Raggruppare codice riutilizzabile', 'Aumentare la RAM', 'Colorare il testo'], correct: 0, exp: 'Impacchetta una logica sotto un nome, richiamabile con input diversi.' },
      { m: 'Fondamenti', q: 'Cos\'è un <b>array</b>?', a: ['Una lista ordinata di elementi', 'Un singolo numero', 'Un errore'], correct: 0, exp: 'Collezione ordinata: [10,20,30], accesso per indice (da 0).' },
      { m: 'Fondamenti', q: 'Cosa significa <b>"bug"</b>?', a: ['Un errore nel codice', 'Una funzione veloce', 'Un tipo di variabile'], correct: 0, exp: 'Difetto che fa comportare male il programma. Debug = correggerlo.' },
      { m: 'IA: concetti', q: 'Cos\'è il <b>Machine Learning</b>?', a: ['Imparare schemi dai dati, non da regole scritte a mano', 'Un linguaggio', 'Un tipo di PC'], correct: 0, exp: 'Il modello impara dai dati a fare previsioni.' },
      { m: 'IA: concetti', q: '<b>Training</b> vs <b>inference</b>?', a: ['Training = impara; inference = usa ciò che ha imparato', 'Sinonimi', 'Inference prima del training'], correct: 0, exp: 'Training è la fase di apprendimento; inference è l\'uso.' },
      { m: 'IA: concetti', q: 'Cos\'è l\'<b>overfitting</b>?', a: ['Memorizza il training e generalizza male', 'Modello troppo piccolo', 'Modello troppo veloce'], correct: 0, exp: 'Impara "a memoria" e fallisce su dati nuovi.' },
      { m: 'IA: concetti', q: 'Cosa NON è vero dell\'IA generativa?', a: ['Dice sempre la verità con certezza', 'Genera contenuti nuovi', 'Può sbagliare'], correct: 0, exp: 'Produce contenuti plausibili ma non garantiti veri: verifica.' },
      { m: 'LLM', q: 'Cos\'è un <b>token</b>?', a: ['Un pezzo di testo che il modello elabora', 'Una password', 'Un file'], correct: 0, exp: 'Parole o frammenti: costi e limiti si misurano in token.' },
      { m: 'LLM', q: 'Cosa fa un LLM in sostanza?', a: ['Predice il token successivo più probabile', 'Cerca su Google', 'Esegue codice'], correct: 0, exp: 'Genera testo prevedendo un token alla volta dal contesto.' },
      { m: 'LLM', q: 'Cos\'è la <b>context window</b>?', a: ['Quanto testo tiene a mente in una volta', 'La finestra del browser', 'La GPU'], correct: 0, exp: 'Limite di token considerati; oltre, dimentica le parti vecchie.' },
      { m: 'LLM', q: 'Cos\'è un\'<b>allucinazione</b>?', a: ['Inventa info false ma plausibili', 'Va in crash', 'Risponde lento'], correct: 0, exp: 'Afferma cose convincenti ma sbagliate: verifica i fatti.' },
      { m: 'LLM', q: '<b>Temperature</b> alta rende l\'output…', a: ['Più creativo/vario (meno preciso)', 'Più veloce', 'Più corto'], correct: 0, exp: 'Alta = creatività; bassa = preciso (utile per JSON/codice).' },
      { m: 'Prompt', q: 'Un buon prompt è…', a: ['Specifico su compito, contesto e formato', 'Il più corto possibile', 'Solo emoji'], correct: 0, exp: 'Specificità vince: cosa vuoi, contesto, formato di output.' },
      { m: 'Prompt', q: 'Cos\'è il <b>few-shot</b>?', a: ['Dare esempi nel prompt per guidare l\'output', 'Usare pochi token', 'Poche domande'], correct: 0, exp: '2-3 esempi input→output: il modello imita lo schema.' },
      { m: 'Prompt', q: 'Assegnare un <b>ruolo</b> serve a…', a: ['Orientare tono e competenza', 'Velocizzare', 'Ridurre i costi'], correct: 0, exp: 'Il system prompt imposta prospettiva e stile.' },
      { m: 'Prompt', q: 'Per <b>JSON valido</b> conviene…', a: ['Chiedere il formato e mostrare lo schema', 'Sperare', 'Alzare la temperature'], correct: 0, exp: 'Specifica lo schema, chiedi "SOLO JSON", temperature bassa.' },
      { m: 'Coding+IA', q: 'Codice scritto dall\'IA: dovresti sempre…', a: ['Leggerlo e testarlo', 'Copiarlo a occhi chiusi', 'Disattivare i test'], correct: 0, exp: 'Accelera ma può sbagliare: sei tu il responsabile.' },
      { m: 'Coding+IA', q: 'Limite reale degli assistenti AI?', a: ['Possono inventare API inesistenti', 'Non sanno scrivere testo', 'Solo offline'], correct: 0, exp: 'Possono "allucinare" metodi: verifica nella documentazione.' },
      { m: 'Web/Tool', q: 'Cos\'è un\'<b>API</b>?', a: ['Un modo per far comunicare due programmi', 'Un linguaggio', 'Un editor'], correct: 0, exp: 'Un\'API è un\'interfaccia: il tuo codice chiede dati/azioni a un altro servizio.' },
      { m: 'Web/Tool', q: 'A cosa serve <b>async/await</b>?', a: ['Gestire operazioni lente senza bloccare il programma', 'Velocizzare la CPU', 'Creare variabili'], correct: 0, exp: 'await aspetta un\'operazione asincrona (es. una rete) senza congelare tutto il resto.' },
      { m: 'Web/Tool', q: 'Cos\'è <b>Git</b>?', a: ['Un controllo di versione del codice', 'Un linguaggio', 'Un browser'], correct: 0, exp: 'Git traccia le modifiche: puoi tornare indietro, ramificare, collaborare. GitHub lo ospita online.' },
      { m: 'Web/Tool', q: 'Cosa significa <b>open source</b>?', a: ['Codice pubblico, leggibile e modificabile', 'Codice a pagamento', 'Codice segreto'], correct: 0, exp: 'Il codice è aperto: chiunque può vederlo, usarlo e contribuire (secondo licenza).' },
      { m: 'Web/Tool', q: 'Cos\'è una <b>API key</b>?', a: ['Una credenziale per usare un servizio', 'Una password del wifi', 'Un tipo di loop'], correct: 0, exp: 'È una chiave segreta che identifica te quando chiami un\'API. Non condividerla mai.' },
      { m: 'IA avanzata', q: 'Cos\'è il <b>fine-tuning</b>?', a: ['Riaddestrare un modello su dati specifici', 'Spegnere il modello', 'Tradurre il testo'], correct: 0, exp: 'Fine-tuning = specializzare un modello pre-addestrato sui tuoi dati per un compito.' },
      { m: 'IA avanzata', q: 'Cos\'è un <b>embedding</b>?', a: ['Una rappresentazione numerica del significato', 'Un\'immagine', 'Un file audio'], correct: 0, exp: 'Trasforma testo in vettori di numeri: testi simili hanno vettori vicini (usato nella ricerca semantica).' },
      { m: 'IA avanzata', q: 'Cos\'è la <b>RAG</b> (Retrieval-Augmented Generation)?', a: ['Dare al modello documenti esterni da cui rispondere', 'Un tipo di GPU', 'Un linguaggio'], correct: 0, exp: 'RAG: recuperi documenti pertinenti e li passi al modello → risposte aggiornate e fondate sui tuoi dati.' },
      { m: 'IA avanzata', q: 'Cos\'è un <b>agente AI</b>?', a: ['Un\'IA che usa strumenti e compie azioni in autonomia', 'Un chatbot muto', 'Un database'], correct: 0, exp: 'Un agente pianifica e usa tool (cerca, scrive file, chiama API) per raggiungere un obiettivo.' },
      { m: 'IA avanzata', q: 'Perché verificare sempre il codice generato dall\'IA?', a: ['Può sembrare corretto ma contenere bug sottili', 'È sempre perfetto', 'Per rallentare'], correct: 0, exp: 'L\'IA produce codice plausibile ma non garantito: leggi, testa, capisci prima di usarlo.' },
    ],
  },
  english: {
    name: 'Inglese', emoji: '🟦', course: [
      { m: 'Phrasal', q: '"give up" significa…', a: ['Arrendersi', 'Iniziare', 'Regalare'], correct: 0, exp: 'give up = arrendersi/smettere. "Don\'t give up."' },
      { m: 'Phrasal', q: '"look forward to" significa…', a: ['Non vedere l\'ora', 'Guardare avanti per strada', 'Dimenticare'], correct: 0, exp: 'I look forward to seeing you = non vedo l\'ora di vederti.' },
      { m: 'Phrasal', q: '"turn off" significa…', a: ['Spegnere', 'Accendere', 'Girare'], correct: 0, exp: 'turn off the light = spegni la luce. (turn on = accendere)' },
      { m: 'Grammar', q: 'Passato di "go" è…', a: ['went', 'goed', 'gone (con have)'], correct: 0, exp: 'go → went (past simple); gone è il participio (have gone).' },
      { m: 'Grammar', q: 'Comparativo di "good" è…', a: ['better', 'gooder', 'more good'], correct: 0, exp: 'good → better → the best (irregolare).' },
      { m: 'Grammar', q: 'Plurale di "child" è…', a: ['children', 'childs', 'childes'], correct: 0, exp: 'child → children (irregolare).' },
      { m: 'Grammar', q: '"used to" esprime…', a: ['Un\'abitudine passata', 'Il futuro', 'Un ordine'], correct: 0, exp: 'I used to play = una volta giocavo (non più).' },
      { m: 'Vocab', q: '"borrow" vs "lend": tu prendi in prestito →', a: ['borrow', 'lend', 'rent out'], correct: 0, exp: 'borrow = prendere in prestito; lend = dare in prestito.' },
      { m: 'Vocab', q: '"make" o "do"? __ a decision', a: ['make', 'do', 'have'], correct: 0, exp: 'make a decision/mistake; do homework/the dishes.' },
      { m: 'Prepos', q: 'Preposizione: "__ night" (di notte)', a: ['at', 'in', 'on'], correct: 0, exp: 'at night, in the morning, on Monday.' },
      { m: 'Grammar', q: '"I have __ that film" (visto)', a: ['seen', 'saw', 'see'], correct: 0, exp: 'Present perfect: have + participio (seen).' },
      { m: 'Vocab', q: '"advice" (consiglio) è…', a: ['Non numerabile (no "advices")', 'Sempre plurale', 'Un verbo'], correct: 0, exp: 'advice è uncountable: "some advice", non "advices".' },
      { m: 'Grammar', q: '"would rather" significa…', a: ['Preferirei', 'Dovrei', 'Vorrei dire'], correct: 0, exp: 'I would rather stay = preferirei restare.' },
      { m: 'Vocab', q: '"actually" significa…', a: ['In realtà / veramente', 'Attualmente', 'Velocemente'], correct: 0, exp: 'False friend! actually = in realtà; "attualmente" = currently.' },
      { m: 'Vocab', q: '"library" significa…', a: ['Biblioteca', 'Libreria (negozio)', 'Libro'], correct: 0, exp: 'False friend! library = biblioteca; "libreria/negozio" = bookshop.' },
      { m: 'Phrasal', q: '"set up" significa…', a: ['Configurare / impostare', 'Sedersi', 'Spegnere'], correct: 0, exp: 'set up the account = configura l\'account.' },
      { m: 'Phrasal', q: '"run out of" significa…', a: ['Esaurire / finire', 'Correre fuori', 'Iniziare'], correct: 0, exp: 'I ran out of milk = ho finito il latte.' },
      { m: 'Grammar', q: 'Passato di "buy" è…', a: ['bought', 'buyed', 'boughted'], correct: 0, exp: 'buy → bought (irregolare).' },
      { m: 'Grammar', q: '"__ apples" (meno, numerabile)', a: ['fewer', 'less', 'fewest'], correct: 0, exp: 'fewer + numerabili (apples); less + non numerabili (water).' },
      { m: 'Grammar', q: '"I have lived here __ 2020"', a: ['since', 'for', 'from'], correct: 0, exp: 'since + punto nel tempo (2020); for + durata (3 years).' },
      { m: 'Grammar', q: '"by" o "until"? "Finish it __ Friday" (entro)', a: ['by', 'until', 'since'], correct: 0, exp: 'by = entro (scadenza); until = fino a (durata continua).' },
      { m: 'Vocab', q: '"to afford" significa…', a: ['Potersi permettere', 'Offrire', 'Sforzarsi'], correct: 0, exp: 'I can\'t afford it = non posso permettermelo.' },
      { m: 'Vocab', q: '"to attend" (a meeting) significa…', a: ['Partecipare / presenziare', 'Aspettare', 'Attendere al telefono'], correct: 0, exp: 'False friend! attend = partecipare; "attendere" = to wait.' },
    ],
  },
  french: {
    name: 'Français', emoji: '🇫🇷', course: [
      { m: 'Saluti', q: '"Bonjour" si usa…', a: ['Di giorno, formale e informale', 'Solo di sera', 'Solo per dire addio'], correct: 0, exp: 'Bonjour = buongiorno, va bene a qualsiasi ora di giorno.' },
      { m: 'Saluti', q: '"Comment ça va?" significa…', a: ['Come va?', 'Come ti chiami?', 'Di dove sei?'], correct: 0, exp: 'Comment ça va? = come va? Si risponde "Ça va bien, merci".' },
      { m: 'Saluti', q: '"Enchanté(e)" si dice quando…', a: ['Conosci qualcuno per la prima volta', 'Saluti un amico', 'Chiedi scusa'], correct: 0, exp: 'Enchanté(e) = piacere (di conoscerti).' },
      { m: 'Numeri', q: '"Vingt" è il numero…', a: ['20', '12', '2'], correct: 0, exp: 'vingt = 20. douze = 12, deux = 2.' },
      { m: 'Numeri', q: '"Soixante-dix" è…', a: ['70', '60', '17'], correct: 0, exp: 'In francese 70 si dice letteralmente "sessanta-dieci".' },
      { m: 'Verbi', q: '"Je suis" è la 1ª persona di…', a: ['être (essere)', 'avoir (avere)', 'aller (andare)'], correct: 0, exp: 'être: je suis, tu es, il/elle est…' },
      { m: 'Verbi', q: '"J\'ai" significa…', a: ['Io ho', 'Io sono', 'Io vado'], correct: 0, exp: 'avoir: j\'ai, tu as, il/elle a…' },
      { m: 'Verbi', q: '"Ils ont" significa…', a: ['Loro hanno', 'Loro sono', 'Loro vanno'], correct: 0, exp: 'avoir: nous avons, vous avez, ils/elles ont.' },
      { m: 'Articoli', q: '"La table" — che genere?', a: ['Femminile', 'Maschile', 'Neutro'], correct: 0, exp: 'table è femminile → la table. Il francese non ha il neutro.' },
      { m: 'Articoli', q: '"Un homme" — che genere?', a: ['Maschile', 'Femminile', 'Neutro'], correct: 0, exp: 'homme è maschile → un homme (la "h" è muta).' },
      { m: 'Vocab', q: '"Merci beaucoup" significa…', a: ['Grazie mille', 'Prego', 'Scusa'], correct: 0, exp: 'merci beaucoup = grazie mille. "De rien" = prego.' },
      { m: 'Vocab', q: '"S\'il vous plaît" significa…', a: ['Per favore (formale)', 'Grazie', 'Scusa'], correct: 0, exp: 'S\'il vous plaît (formale) / s\'il te plaît (informale) = per favore.' },
      { m: 'False friend', q: '"Librairie" significa…', a: ['Libreria (negozio)', 'Biblioteca', 'Libro'], correct: 0, exp: 'Falso amico! librairie = negozio di libri; biblioteca = bibliothèque.' },
      { m: 'False friend', q: '"Attendre" significa…', a: ['Aspettare', 'Attendere alla cassa', 'Comprendere'], correct: 0, exp: 'Falso amico grammaticale: attendre = aspettare (non "attendere" nel senso di partecipare).' },
      { m: 'False friend', q: '"Journée" significa…', a: ['Giornata', 'Giornale', 'Viaggio'], correct: 0, exp: 'journée = giornata (durata); jour = giorno. "Giornale" = journal.' },
      { m: 'Cibo', q: '"Je voudrais un café" significa…', a: ['Vorrei un caffè', 'Ho un caffè', 'Mi piace il caffè'], correct: 0, exp: 'Je voudrais = vorrei, forma cortese per ordinare.' },
      { m: 'Cibo', q: '"L\'addition, s\'il vous plaît" si dice per chiedere…', a: ['Il conto', 'Il menu', 'Un tavolo'], correct: 0, exp: 'l\'addition = il conto al ristorante.' },
      { m: 'Grammatica', q: 'Negazione corretta di "Je parle français"?', a: ['Je ne parle pas français', 'Je non parle français', 'Je parle non français'], correct: 0, exp: 'La negazione francese "avvolge" il verbo: ne + verbo + pas.' },
      { m: 'Grammatica', q: '"Mon", "ma", "mes" sono…', a: ['Aggettivi possessivi (mio/mia/miei)', 'Articoli determinativi', 'Pronomi soggetto'], correct: 0, exp: 'mon (masch.), ma (femm.), mes (plurale) = il mio/la mia/i miei.' },
      { m: 'Grammatica', q: 'Come si forma il plurale regolare in francese?', a: ['Aggiungendo -s (spesso muta)', 'Aggiungendo -i', 'Cambiando l\'ultima vocale'], correct: 0, exp: 'Regola generale: + s (silenziosa nel parlato). Eccezioni: -eau→-eaux, -al→-aux.' },
      { m: 'Orari', q: '"Quelle heure est-il?" significa…', a: ['Che ore sono?', 'Che giorno è?', 'Dove sei?'], correct: 0, exp: 'Quelle heure est-il? = che ore sono? Si risponde "Il est... heures".' },
      { m: 'Tempo', q: '"Il fait beau" significa…', a: ['Fa bel tempo', 'Fa freddo', 'Piove'], correct: 0, exp: 'il fait beau/froid/chaud = fa bello/freddo/caldo (espressioni meteo con "faire").' },
      { m: 'Passato', q: 'Il passé composé si forma di solito con…', a: ['avoir/être + participio passato', 'Solo il verbo coniugato', 'être + infinito'], correct: 0, exp: 'J\'ai mangé (avoir), je suis allé(e) (être con verbi di movimento).' },
      { m: 'Pronomi', q: '"Je le vois" — "le" sostituisce…', a: ['Un complemento oggetto maschile', 'Un soggetto', 'Un luogo'], correct: 0, exp: 'le/la/les = pronomi complemento oggetto diretto, prima del verbo.' },
      { m: 'Numeri', q: '"Cent" è il numero…', a: ['100', '1000', '10'], correct: 0, exp: 'cent = 100. mille = 1000, dix = 10.' },
      { m: 'Numeri', q: '"Quatre-vingts" è…', a: ['80', '40', '14'], correct: 0, exp: 'Letteralmente "quattro-venti" (4×20) = 80.' },
      { m: 'Verbi', q: '"Je vais" è la 1ª persona di…', a: ['aller (andare)', 'avoir (avere)', 'faire (fare)'], correct: 0, exp: 'aller: je vais, tu vas, il/elle va…' },
      { m: 'Verbi', q: '"Nous faisons" significa…', a: ['Noi facciamo', 'Noi siamo', 'Noi andiamo'], correct: 0, exp: 'faire: je fais, tu fais, il fait, nous faisons…' },
      { m: 'Verbi', q: '"Je veux" significa…', a: ['Io voglio', 'Io posso', 'Io devo'], correct: 0, exp: 'vouloir (volere): je veux, tu veux, il veut…' },
      { m: 'Verbi', q: '"Tu peux" significa…', a: ['Tu puoi', 'Tu vuoi', 'Tu devi'], correct: 0, exp: 'pouvoir (potere): je peux, tu peux, il peut…' },
      { m: 'Verbi', q: '"Il faut" significa…', a: ['Bisogna / È necessario', 'Piace', 'Manca'], correct: 0, exp: 'il faut + infinito = bisogna fare qualcosa (impersonale).' },
      { m: 'Verbi', q: '"Je m\'appelle" significa…', a: ['Io mi chiamo', 'Io chiamo', 'Tu ti chiami'], correct: 0, exp: 'Verbo pronominale s\'appeler: je m\'appelle, tu t\'appelles…' },
      { m: 'Verbi -er', q: '"Vous parlez" significa…', a: ['Voi parlate', 'Voi ascoltate', 'Voi rispondete'], correct: 0, exp: 'parler (parlare): je parle, tu parles, vous parlez…' },
      { m: 'Verbi -er', q: '"Elles aiment" significa…', a: ['Loro (f) amano/piacciono', 'Lei ama', 'Loro odiano'], correct: 0, exp: 'aimer (amare/piacere): elles aiment.' },
      { m: 'Casa', q: '"La cuisine" significa…', a: ['La cucina', 'La camera', 'Il bagno'], correct: 0, exp: 'cuisine = cucina (stanza). "Cucina" nel senso di cibo = cuisine anche.' },
      { m: 'Casa', q: '"La chambre" significa…', a: ['La camera da letto', 'Il soggiorno', 'Il corridoio'], correct: 0, exp: 'chambre = camera da letto; salon = soggiorno.' },
      { m: 'Shopping', q: '"C\'est combien?" significa…', a: ['Quanto costa?', 'Dov\'è?', 'A che ora?'], correct: 0, exp: 'C\'est combien? = quanto costa? (chiedere il prezzo).' },
      { m: 'Shopping', q: '"Je fais du shopping" — "faire du/de la" indica…', a: ['Un\'attività che si pratica', 'Un possesso', 'Un obbligo'], correct: 0, exp: 'faire du sport/du shopping/de la cuisine = praticare un\'attività.' },
      { m: 'Indicazioni', q: '"Tout droit" significa…', a: ['Sempre dritto', 'A destra', 'Dietro'], correct: 0, exp: 'tout droit = sempre dritto; à gauche/à droite = a sinistra/destra.' },
      { m: 'Indicazioni', q: '"C\'est loin d\'ici?" significa…', a: ['È lontano da qui?', 'Dov\'è la stazione?', 'È aperto?'], correct: 0, exp: 'loin = lontano; près = vicino.' },
      { m: 'Aggettivi', q: 'Femminile di "petit" (piccolo)?', a: ['petite', 'petita', 'petitesse'], correct: 0, exp: 'Regola generale: + e per il femminile. petit → petite.' },
      { m: 'Aggettivi', q: 'Femminile di "beau" (bello)?', a: ['belle', 'beaue', 'beause'], correct: 0, exp: 'beau è irregolare: beau → belle (come nouveau → nouvelle).' },
      { m: 'Negazione', q: '"Je n\'ai rien" significa…', a: ['Non ho niente', 'Non ho più niente', 'Non ho mai niente'], correct: 0, exp: 'ne...rien = niente; ne...plus = non...più; ne...jamais = mai.' },
      { m: 'Domande', q: '"Où habites-tu?" significa…', a: ['Dove abiti?', 'Come stai?', 'Chi sei?'], correct: 0, exp: 'où = dove; habiter = abitare.' },
      { m: 'Domande', q: '"Pourquoi" significa…', a: ['Perché', 'Quando', 'Come'], correct: 0, exp: 'pourquoi = perché; parce que = perché (risposta, "because").' },
      { m: 'Futuro', q: '"Je vais manger" — che tempo è?', a: ['Futur proche (aller + infinito)', 'Passato', 'Condizionale'], correct: 0, exp: 'futur proche: aller (coniugato) + infinito = sto per / farò.' },
      { m: 'Futuro', q: '"Nous allons partir" significa…', a: ['Stiamo per partire', 'Siamo partiti', 'Partiremmo'], correct: 0, exp: 'aller (nous allons) + infinito (partir) = futur proche.' },
      { m: 'Comparativi', q: '"Plus grand que" significa…', a: ['Più grande di', 'Meno grande di', 'Grande quanto'], correct: 0, exp: 'plus...que = più...di; moins...que = meno...di; aussi...que = tanto quanto.' },
      { m: 'Imperativo', q: '"Ferme la porte!" (a "tu") — che modo è?', a: ['Imperativo', 'Infinito', 'Condizionale'], correct: 0, exp: 'Imperativo alla 2ª persona: fermer → ferme (senza "tu" davanti).' },
      { m: 'Tempo libero', q: '"Faire du vélo" significa…', a: ['Andare in bicicletta', 'Cucinare', 'Fare la spesa'], correct: 0, exp: 'faire du vélo/de la natation/du sport = pratica di sport.' },
      { m: 'Salute', q: '"J\'ai mal à la tête" significa…', a: ['Ho mal di testa', 'Ho fame', 'Sono stanco'], correct: 0, exp: 'avoir mal à + parte del corpo = avere dolore lì.' },
      { m: 'Lavoro', q: '"Je travaille" significa…', a: ['Io lavoro', 'Io studio', 'Io riposo'], correct: 0, exp: 'travailler = lavorare: je travaille, tu travailles…' },
      { m: 'Opinioni', q: '"Je pense que" significa…', a: ['Penso che', 'Spero che', 'Dubito che'], correct: 0, exp: 'je pense que = penso che, per introdurre un\'opinione.' },
      { m: 'Passato', q: '"J\'ai mangé" significa…', a: ['Ho mangiato', 'Mangio', 'Mangerò'], correct: 0, exp: 'passé composé con avoir: j\'ai + participio passato (mangé).' },
      { m: 'Passato', q: '"Je suis allé(e)" significa…', a: ['Sono andato/a', 'Vado', 'Andrò'], correct: 0, exp: 'Verbi di movimento usano être: je suis allé(e), participio accorda col soggetto.' },
      { m: 'Pronomi tonici', q: '"Et toi?" significa…', a: ['E tu?', 'E io?', 'E lui?'], correct: 0, exp: 'toi = pronome tonico "tu"; moi = io; lui = lui.' },
      { m: 'Pronomi y/en', q: '"J\'y vais" significa…', a: ['Ci vado (in quel luogo)', 'Ne ho', 'Lo vedo'], correct: 0, exp: 'y sostituisce un luogo già menzionato: j\'y vais = ci vado.' },
      { m: 'False friend', q: '"Sensible" significa…', a: ['Sensibile (emotivo)', 'Sensato/ragionevole', 'Semplice'], correct: 0, exp: 'Falso amico! sensible = sensibile; "sensato" = raisonnable.' },
      { m: 'False friend', q: '"Blessé" significa…', a: ['Ferito', 'Benedetto', 'Fortunato'], correct: 0, exp: 'Falso amico! blessé = ferito; "benedetto" = béni.' },
      { m: 'False friend', q: '"Grand" significa…', a: ['Grande/alto', 'Grasso', 'Grave'], correct: 0, exp: 'grand = grande/alto (persone); "grasso" = gros.' },
      { m: 'Idiomi', q: '"Ça marche" significa…', a: ['Va bene / funziona', 'Cammina', 'Corri'], correct: 0, exp: 'Espressione colloquiale: ça marche = ok, va bene, siamo d\'accordo.' },
      { m: 'Idiomi', q: '"Bonne chance!" significa…', a: ['Buona fortuna!', 'Buon appetito!', 'Buon viaggio!'], correct: 0, exp: 'bonne chance = buona fortuna; bon appétit = buon appetito.' },
      { m: 'Cultura', q: 'Qual è la capitale della Francia?', a: ['Parigi', 'Lione', 'Marsiglia'], correct: 0, exp: 'Paris è la capitale; Lyon e Marseille sono altre grandi città.' },
      { m: 'Cultura', q: 'Il 14 luglio in Francia si festeggia…', a: ['La presa della Bastiglia (festa nazionale)', 'Il Natale', 'Ferragosto'], correct: 0, exp: '14 juillet = Fête Nationale, in ricordo della presa della Bastiglia (1789).' },
    ],
  },
  sapere: {
    name: 'Cultura & Sapere', emoji: '🟪', course: [
      { m: 'Scienza', q: 'Formula chimica dell\'acqua?', a: ['H₂O', 'CO₂', 'O₂'], correct: 0, exp: 'Acqua = H₂O: due idrogeni e un ossigeno.' },
      { m: 'Scienza', q: 'Organo che pompa il sangue?', a: ['Il cuore', 'I polmoni', 'Il fegato'], correct: 0, exp: 'Il cuore pompa il sangue nel corpo.' },
      { m: 'Scienza', q: 'Gas che respiriamo per vivere?', a: ['Ossigeno', 'Azoto', 'Elio'], correct: 0, exp: 'Respiriamo ossigeno (O₂) ed espelliamo CO₂.' },
      { m: 'Scienza', q: 'La fotosintesi produce…', a: ['Ossigeno', 'Anidride carbonica', 'Metano'], correct: 0, exp: 'Le piante usano CO₂+luce e rilasciano ossigeno.' },
      { m: 'Spazio', q: 'Pianeta più grande del sistema solare?', a: ['Giove', 'Saturno', 'Terra'], correct: 0, exp: 'Giove è il più grande, un gigante gassoso.' },
      { m: 'Spazio', q: 'Primo uomo sulla Luna?', a: ['Neil Armstrong (1969)', 'Yuri Gagarin', 'Buzz Aldrin'], correct: 0, exp: 'Armstrong, missione Apollo 11, 1969. Gagarin = primo in orbita.' },
      { m: 'Storia', q: 'Caduta del Muro di Berlino?', a: ['1989', '1945', '2001'], correct: 0, exp: '9 novembre 1989: fine simbolica della Guerra Fredda.' },
      { m: 'Arte', q: 'Chi dipinse la Gioconda?', a: ['Leonardo da Vinci', 'Michelangelo', 'Raffaello'], correct: 0, exp: 'La Gioconda (Mona Lisa) è di Leonardo, al Louvre.' },
      { m: 'Geografia', q: 'Capitale dell\'Australia?', a: ['Canberra', 'Sydney', 'Melbourne'], correct: 0, exp: 'Canberra (non Sydney, errore comune).' },
      { m: 'Matematica', q: 'Valore approssimato di π (pi greco)?', a: ['3,14', '2,72', '1,61'], correct: 0, exp: 'π ≈ 3,14159. (2,72 ≈ e; 1,61 ≈ sezione aurea.)' },
      { m: 'Scienza', q: 'Cosa contiene il DNA?', a: ['L\'informazione genetica', 'Energia pura', 'Ossigeno'], correct: 0, exp: 'Il DNA codifica le istruzioni genetiche degli esseri viventi.' },
      { m: 'Geografia', q: 'Quanti sono i continenti (modello classico)?', a: ['7', '4', '10'], correct: 0, exp: 'Modello a 7: Africa, Asia, Europa, Nord/Sud America, Oceania, Antartide.' },
      { m: 'Scienza', q: 'Velocità della luce ~', a: ['300.000 km/s', '300 km/h', '30.000 km/s'], correct: 0, exp: '~299.792 km/s nel vuoto.' },
      { m: 'Storia', q: 'In che secolo siamo (anni 2000)?', a: ['XXI', 'XX', 'XIX'], correct: 0, exp: 'Dal 2001 siamo nel XXI secolo (21°).' },
      { m: 'Geografia', q: 'Capitale d\'Italia?', a: ['Roma', 'Milano', 'Napoli'], correct: 0, exp: 'Roma è la capitale d\'Italia.' },
      { m: 'Geografia', q: 'Continente più grande?', a: ['Asia', 'Africa', 'America'], correct: 0, exp: 'L\'Asia è il più grande per superficie e popolazione.' },
      { m: 'Spazio', q: 'Quanti pianeti nel sistema solare?', a: ['8', '9', '7'], correct: 0, exp: '8 dal 2006 (Plutone è "pianeta nano").' },
      { m: 'Arte', q: 'Chi scrisse la Divina Commedia?', a: ['Dante Alighieri', 'Petrarca', 'Boccaccio'], correct: 0, exp: 'Dante, "il sommo poeta".' },
      { m: 'Storia', q: 'In che anno Colombo arrivò in America?', a: ['1492', '1342', '1592'], correct: 0, exp: '1492, finanziato dalla Spagna.' },
      { m: 'Scienza', q: 'Principale gas serra di origine umana?', a: ['Anidride carbonica (CO₂)', 'Ossigeno', 'Elio'], correct: 0, exp: 'La CO₂ da combustibili fossili è il principale driver del riscaldamento.' },
      { m: 'Scienza', q: 'Quante ossa ha un adulto (circa)?', a: ['206', '106', '306'], correct: 0, exp: 'Circa 206 (i neonati ne hanno di più, poi si fondono).' },
      { m: 'Scienza', q: 'Su una scala, i terremoti si misurano con…', a: ['La magnitudo (Richter)', 'I gradi Celsius', 'I decibel'], correct: 0, exp: 'Magnitudo (energia); i decibel sono il suono, i Celsius la temperatura.' },
      { m: 'Geografia', q: 'Lingua più parlata come madrelingua?', a: ['Cinese mandarino', 'Inglese', 'Spagnolo'], correct: 0, exp: 'Il mandarino ha più madrelingua; l\'inglese vince come seconda lingua globale.' },
      { m: 'Matematica', q: 'Quanto fa 15% di 200?', a: ['30', '15', '45'], correct: 0, exp: '15% = 0,15 × 200 = 30.' },
    ],
  },
  scienza: {
    name: 'Scienza e Biohacking', emoji: '🔬', course: [
      { m: 'Sonno', q: 'Dormire <5h per 1 settimana abbassa il <b>testosterone</b> di…', a: ['10-15% (come invecchiare di 10-15 anni)', '1-2%', 'Nessun effetto'], correct: 0, exp: 'Leproult & Van Cauter (JAMA 2011): il sonno è l\'anabolico più potente e gratis.' },
      { m: 'Proteine', q: 'Per massimizzare la sintesi muscolare, proteine per <b>pasto</b>…', a: ['~0,4 g/kg (circa 30-40g)', 'Più possibile, oltre 100g', 'Solo dopo l\'allenamento'], correct: 0, exp: 'Phillips & van Loon: oltre ~0,4 g/kg a pasto l\'eccesso viene ossidato. Serve ~2,5-3g di leucina.' },
      { m: 'Cardio', q: 'Il miglior predittore di longevità tra questi è…', a: ['Il VO2max (fitness cardiorespiratoria)', 'Il peso sulla bilancia', 'Il BMI'], correct: 0, exp: 'Mandsager (JAMA 2018): fitness elite = -80% mortalità, nessun tetto. Essere non-fit pesa come fumare.' },
      { m: 'Sonno', q: 'La <b>caffeina</b> presa 6 ore prima di dormire…', a: ['Riduce comunque il sonno profondo', 'Non ha alcun effetto', 'Aiuta a dormire'], correct: 0, exp: 'Drake 2013: -1,2h di sonno; emivita ~5-6h. Ultimo caffè entro le 14-15.' },
      { m: 'Cervello', q: 'Il cervello elimina le scorie (pulizia glinfatica) soprattutto…', a: ['Nel sonno profondo', 'Durante l\'esercizio', 'Mentre mangi'], correct: 0, exp: 'In veglia la pulizia cala del 90%. Dormire sul fianco destro la favorisce; lo zolpidem la blocca.' },
      { m: 'Integratori', q: 'La <b>creatina</b> (oltre al muscolo) aiuta anche…', a: ['La cognizione, specie sotto privazione di sonno', 'La vista', 'L\'abbronzatura'], correct: 0, exp: 'Gordji-Nejad 2024: sostiene fosfocreatina/ATP cerebrali; +10% memoria di lavoro da stanchi.' },
      { m: 'Cardio', q: 'L\'allenamento in <b>Zona 2</b> serve a…', a: ['Costruire mitocondri e bruciare grassi', 'Massimizzare la forza', 'Aumentare la massa'], correct: 0, exp: 'San Millán: intensità conversazionale, lattato <2 mmol. Base aerobica con fatica minima.' },
      { m: 'Recupero', q: 'Per rinforzare i <b>tendini</b>, la gelatina/collagene va presa…', a: ['~30-60 min PRIMA di un breve carico, con vitamina C', 'Dopo l\'allenamento', 'A stomaco vuoto la sera'], correct: 0, exp: 'Baar (AJCN 2017): 15g + vit C prima → sintesi di collagene raddoppiata. I tendini si nutrono col movimento.' },
      { m: 'Calore', q: 'Usare la <b>sauna</b> 4-7 volte a settimana è associato a…', a: ['Forte calo della mortalità cardiovascolare', 'Aumento di rischio', 'Nessun effetto'], correct: 0, exp: 'Coorte finlandese KIHD: fino a -77%. Sessioni di ~19+ min a ~75-80°C.' },
      { m: 'Cervello', q: 'La <b>doccia fredda</b> aumenta la dopamina di circa…', a: ['250%, per oltre 2 ore senza crash', '10% per 5 minuti', 'Zero'], correct: 0, exp: 'Šrámek 2000: a 14°C, noradrenalina +530%, dopamina +250%. Energia e focus puliti.' },
      { m: 'Circadiano', q: 'La <b>luce del mattino</b> serve a…', a: ['Regolare l\'orologio biologico e il sonno serale', 'Solo a vedere meglio', 'Far ingrassare'], correct: 0, exp: 'Czeisler: melatonina serale ~12-14h dopo la luce del mattino. Luce blu la sera la rimanda.' },
      { m: 'Intestino', q: 'Per la diversità del microbioma, a breve termine funzionano meglio…', a: ['I cibi fermentati (yogurt, kefir, kimchi)', 'Solo la fibra', 'I cibi proteici'], correct: 0, exp: 'Sonnenburg (Cell 2021): i fermentati abbassano 19 proteine infiammatorie; la sola fibra no (a 10 settimane).' },
      { m: 'Pressione', q: 'I <b>nitrati</b> della barbabietola abbassano la pressione perché…', a: ['Diventano ossido nitrico (vasodilatazione)', 'Sono diuretici', 'Contengono potassio'], correct: 0, exp: 'Meta-analisi: ~-5 mmHg sistolica. Anche le verdure a foglia verde sono ricche di nitrati.' },
      { m: 'Ormoni', q: 'L\'<b>ashwagandha</b> in giovani che si allenano ha aumentato…', a: ['Il testosterone (vs placebo)', 'Il colesterolo', 'La fame'], correct: 0, exp: 'Wankhede 2015: +96 ng/dL vs +18 placebo, meno grasso, più forza, meno cortisolo.' },
      { m: 'Metabolismo', q: 'Mangiare <b>presto</b> (cena anticipata) migliora insulina e pressione…', a: ['Anche senza perdere peso', 'Solo se dimagrisci', 'Mai'], correct: 0, exp: 'Sutton (Cell Metab 2018): l\'insulina lavora meglio nella prima metà della giornata.' },
      { m: 'Stress', q: 'Respirare a ~<b>6 respiri al minuto</b>…', a: ['Massimizza l\'HRV e abbassa stress/pressione', 'Aumenta l\'ansia', 'Non fa nulla'], correct: 0, exp: 'È la "frequenza di risonanza": cuore e respiro si sincronizzano. Gratis, 5-10 min/die.' },
      { m: 'Cuore', q: 'La <b>vitamina K2</b> (MK-7) serve a…', a: ['Dirigere il calcio alle ossa, via dalle arterie', 'Sciogliere i grassi', 'Dormire'], correct: 0, exp: 'Knapen/Rotterdam: attiva la MGP, riduce calcificazione arteriosa. Sinergica con la vitamina D.' },
      { m: 'Sonno', q: 'Un aiuto semplice e sicuro per addormentarsi è…', a: ['~3g di glicina prima di dormire', 'Un caffè', 'Allenarsi alle 23'], correct: 0, exp: 'Glicina abbassa la temperatura corporea centrale (segnale di sonno); anche il magnesio aiuta.' },
      { m: 'Mitocondri', q: 'L\'<b>urolitina A</b> migliora i muscoli perché…', a: ['Attiva la mitofagia (ricicla mitocondri vecchi)', 'Aumenta il testosterone', 'È uno stimolante'], correct: 0, exp: 'Precursori in melograno, noci, frutti di bosco (solo ~40% delle persone la produce).' },
      { m: 'Metabolismo', q: 'La <b>berberina</b> è soprannominata…', a: ['"La metformina della natura" (glicemia/lipidi)', 'Vitamina del sole', 'Ormone della crescita'], correct: 0, exp: 'Attiva l\'AMPK come l\'esercizio. Quasi un farmaco: cautela e interazioni. Non sostituisce dieta/movimento.' },
    ],
  },
};

export const GATE_IDS = Object.keys(GATES);

// Baseline curata (snapshot) — le domande generate dall'AI si APPENDONO a questa.
const BASE = {};
for (const g of GATE_IDS) BASE[g] = GATES[g].course.slice();
// Carica/aggiorna il pool generato per un gate (append-only → gli indici restano stabili).
export function loadGen(gate, gen) {
  if (!GATES[gate]) return;
  GATES[gate].course = BASE[gate].concat(Array.isArray(gen) ? gen : []);
}
export const baseCount = (gate) => (BASE[gate] ? BASE[gate].length : 0);
// Stem (testo) delle domande esistenti, per evitare duplicati in generazione
export const existingStems = (gate) => (GATES[gate]?.course || []).map((x) => String(x.q).replace(/<[^>]+>/g, '')).slice(-40);

export const levelOf = (xp) => Math.floor((xp || 0) / 100) + 1;
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

// ── LIVELLO DI STUDIO adattivo (1-10): sale se rispondi giusto, scende se sbagli ──
export const MAX_STUDY_LEVEL = 10;
const STUDY_TIERS = [
  { min: 1, label: 'Base', emoji: '🌱' },
  { min: 3, label: 'Intermedio', emoji: '📘' },
  { min: 5, label: 'Avanzato', emoji: '🔥' },
  { min: 7, label: 'Esperto', emoji: '⚡' },
  { min: 9, label: 'Maestro', emoji: '👑' },
];
export function studyLabel(level) {
  const lv = Math.max(1, Math.min(MAX_STUDY_LEVEL, level || 1));
  let t = STUDY_TIERS[0];
  for (const tier of STUDY_TIERS) if (lv >= tier.min) t = tier;
  return { level: lv, label: t.label, emoji: t.emoji };
}
// Parola-chiave difficoltà per la generazione domande in base al livello
export const difficultyForLevel = (level) => {
  const lv = Math.max(1, Math.min(MAX_STUDY_LEVEL, level || 1));
  if (lv <= 2) return 'facile (concetti base, definizioni)';
  if (lv <= 4) return 'intermedia (applicazione pratica dei concetti)';
  if (lv <= 6) return 'avanzata (numeri, dosi, meccanismi, soglie)';
  if (lv <= 8) return 'difficile (sfumature, eccezioni, confronti tra studi)';
  return 'molto difficile (casi limite, ragionamento, integrazione di più principi)';
};

export function initLearn() {
  return { xp: 0, streak: 0, lastDay: '', prog: {}, srs: [], pending: null, activeGate: 'prog-ia', boss: null };
}

// Migra/normalizza lo stato (compatibilità col vecchio MVP a singolo gate)
export function normalize(state) {
  const s = state ? { ...state } : initLearn();
  if (!s.prog) s.prog = {};
  if (s.idx != null && !s.prog['prog-ia']) { s.prog['prog-ia'] = { idx: s.idx, correct: s.correct || 0, total: s.total || 0, done: s.done || 0 }; delete s.idx; }
  if (!Array.isArray(s.srs)) s.srs = [];
  if (!s.activeGate || !GATES[s.activeGate]) s.activeGate = 'prog-ia';
  if (s.boss === undefined) s.boss = null;
  if (!s.prog[s.activeGate]) s.prog[s.activeGate] = { idx: 0, correct: 0, total: 0, done: 0 };
  return s;
}

const gateProg = (s, g) => (s.prog[g] || (s.prog[g] = { idx: 0, correct: 0, total: 0, done: 0 }));
export const rankOf = (s, g) => { const p = gateProg(s, g); const tot = GATES[g].course.length; return RANKS[Math.min(RANKS.length - 1, Math.floor(((p.done || 0) / tot) * RANKS.length))]; };

// Telegram (parse_mode HTML) rompe l'invio se trova un '<' letterale (es. "<5h",
// "lattato <2"). Escapa i '<' che NON fanno parte dei tag consentiti <b>/<i>.
export const safeHtml = (s) => String(s ?? '')
  .replace(/&(?!(?:amp|lt|gt|quot);)/g, '&amp;')
  .replace(/<(?!\/?[biu]>)/g, '&lt;');

function renderQ(gate, qid, { review = false, boss = false, n = 0, of = 0, level = 0 } = {}) {
  const G = GATES[gate];
  const q = G.course[qid] || G.course[0]; // fallback se il qid (es. pool generato non caricato) è fuori range
  const lv = level ? (() => { const s = studyLabel(level); return ` · ${s.emoji} Lv ${s.level} ${s.label}`; })() : '';
  const tag = (boss ? `🐉 <b>BOSS</b> ${n}/${of}` : review ? '🔁 <b>Ripasso</b>' : `Domanda ${qid + 1}/${G.course.length}`) + lv;
  // Mescola le opzioni: la risposta giusta NON è più sempre la A. La callback_data
  // porta l'indice ORIGINALE, così la correzione resta corretta senza stato extra.
  const order = q.a.map((_, i) => i).sort(() => Math.random() - 0.5);
  const text = `${G.emoji} <b>${G.name}</b> · <i>${safeHtml(q.m)}</i>\n${tag}\n\n${safeHtml(q.q)}\n\n` +
    order.map((orig, d) => `${LETTERS[d]}) ${safeHtml(q.a[orig])}`).join('\n');
  const prefix = boss ? 'bq' : 'lq';
  const inline_keyboard = [order.map((orig, d) => ({ text: LETTERS[d], callback_data: `${prefix}|${gate}|${qid}|${orig}` }))];
  return { gate, qid, text, keyboard: { inline_keyboard } };
}

// Prossima domanda normale: prima un ripasso SRS scaduto DELLA MATERIA scelta, altrimenti avanti nel gate
export function nextQuestion(state, gateOverride) {
  const s = normalize(state);
  const gate = gateOverride && GATES[gateOverride] ? gateOverride : s.activeGate;
  // ripassa SOLO domande della materia attiva/scelta E solo se la domanda è caricata (evita crash
  // e impedisce che i ripassi di un'altra materia "dirottino" il gate che hai scelto).
  const p = gateProg(s, gate);
  const due = s.srs.find((it) => it.gate === gate && it.due <= today() && GATES[gate].course[it.qid]);
  if (due) return { ...renderQ(due.gate, due.qid, { review: true, level: p.level }), review: true };
  const len = GATES[gate].course.length;
  let qid;
  if ((p.idx || 0) < len) {
    qid = p.idx || 0; // ancora domande mai viste: avanti in ordine
  } else {
    // POOL ESAURITO: niente wrap "stesse domande". Scegli a caso una NON vista di recente,
    // così finché l'AI non genera nuove domande il ripasso resta vario.
    const recent = Array.isArray(p.recent) ? p.recent : [];
    const fresh = [...Array(len).keys()].filter((i) => !recent.includes(i));
    const pool = fresh.length ? fresh : [...Array(len).keys()];
    qid = pool[Math.floor(Math.random() * pool.length)];
  }
  return { ...renderQ(gate, qid, { level: p.level }), review: false };
}

function srsUpdate(s, gate, qid, correct) {
  const i = s.srs.findIndex((it) => it.gate === gate && it.qid === qid);
  if (correct) {
    if (i >= 0) {
      const box = (s.srs[i].box || 0) + 1;
      if (box >= SRS_DAYS.length) s.srs.splice(i, 1);             // imparata: esce dal ripasso
      else { s.srs[i].box = box; s.srs[i].due = addDays(SRS_DAYS[box]); }
    }
  } else {
    if (i >= 0) { s.srs[i].box = 0; s.srs[i].due = addDays(SRS_DAYS[0]); }
    else s.srs.push({ gate, qid, box: 0, due: addDays(SRS_DAYS[0]) });
  }
}

export function gradeAnswer(state, gate, qid, opt) {
  const s = normalize(state);
  if (!s.pending || s.pending.gate !== gate || s.pending.qid !== qid) return { ok: false, state: s };
  const wasReview = !!s.pending.review;
  const q = GATES[gate].course[qid];
  const correct = opt === q.correct;
  const xpGained = correct ? (wasReview ? 10 : 15) : 3;
  s.xp += xpGained;
  const p = gateProg(s, gate);
  p.total += 1;
  if (correct) p.correct += 1;
  const len = GATES[gate].course.length;
  if (!wasReview) { p.idx = (p.idx || 0) + 1; p.done = Math.min(len, (p.done || 0) + 1); }
  // Ricorda le ultime servite per evitare ripetizioni quando il pool è esaurito
  p.recent = [qid, ...(Array.isArray(p.recent) ? p.recent : [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, Math.max(1, Math.min(10, Math.floor(len / 2))));
  srsUpdate(s, gate, qid, correct);
  // LIVELLO DI STUDIO adattivo: giusto → +1, sbagliato → -1 (limiti 1-10)
  const prevLevel = p.level || 1;
  p.level = Math.max(1, Math.min(MAX_STUDY_LEVEL, prevLevel + (correct ? 1 : -1)));
  const levelDelta = p.level - prevLevel;
  const d = today(); if (s.lastDay !== d) { s.streak = (s.streak || 0) + 1; s.lastDay = d; }
  s.pending = null;
  return { ok: true, correct, exp: `${q.exp}${correct ? '' : `\n✔️ Giusta: <b>${q.a[q.correct]}</b>`}`, xpGained, review: wasReview, level: p.level, levelDelta, gate, state: s };
}

// ── BOSS QUIZ (6 domande, niente spiegazioni, bonus finale) ──────────────────
export function startBoss(state, gateOverride) {
  const s = normalize(state);
  const gate = gateOverride && GATES[gateOverride] ? gateOverride : s.activeGate;
  const n = Math.min(6, GATES[gate].course.length);
  const ids = [...GATES[gate].course.keys()].sort(() => Math.random() - 0.5).slice(0, n);
  s.boss = { gate, ids, cur: 0, score: 0 };
  s.pending = null;
  return s;
}
export function bossQuestion(state) {
  const s = normalize(state);
  if (!s.boss) return null;
  const { gate, ids, cur } = s.boss;
  const qid = ids[cur];
  return renderQ(gate, qid, { boss: true, n: cur + 1, of: ids.length });
}
export function gradeBoss(state, gate, qid, opt) {
  const s = normalize(state);
  if (!s.boss || s.boss.gate !== gate) return { ok: false, state: s };
  const q = GATES[gate].course[qid];
  const correct = opt === q.correct;
  if (correct) s.boss.score += 1;
  s.boss.cur += 1;
  const done = s.boss.cur >= s.boss.ids.length;
  if (done) {
    const score = s.boss.score, of = s.boss.ids.length;
    const bonus = score * 12 + (score === of ? 40 : 0); // perfetto = +40
    s.xp += bonus;
    const d = today(); if (s.lastDay !== d) { s.streak = (s.streak || 0) + 1; s.lastDay = d; }
    s.boss = null;
    return { ok: true, correct, done: true, score, of, bonus, state: s };
  }
  return { ok: true, correct, done: false, state: s };
}

export function progressLine(state) {
  const s = normalize(state);
  const p = gateProg(s, s.activeGate);
  const acc = p.total ? Math.round((p.correct / p.total) * 100) : 0;
  return `⚡ Lv ${levelOf(s.xp)} · ${s.xp} XP · 🔥 ${s.streak || 0}gg · rank ${rankOf(s, s.activeGate)} · ${acc}%`;
}

export function progressCard(state) {
  const s = normalize(state);
  const due = s.srs.filter((it) => it.due <= today()).length;
  const gates = GATE_IDS.map((g) => {
    const p = gateProg(s, g), tot = GATES[g].course.length;
    const pct = Math.min(100, Math.round(((p.done || 0) / tot) * 100));
    return `${GATES[g].emoji} ${GATES[g].name}: ${pct}% · rank ${rankOf(s, g)}${g === s.activeGate ? ' ◀︎' : ''}`;
  }).join('\n');
  return (
    `🚪 <b>Gate della Conoscenza</b>\n\n` +
    `⚡ Livello <b>${levelOf(s.xp)}</b> · <b>${s.xp || 0}</b> XP\n` +
    `🔥 Streak: <b>${s.streak || 0}</b> giorni\n` +
    `🔁 Da ripassare oggi: <b>${due}</b>\n\n` +
    `${gates}\n\n` +
    `/quiz per continuare · /gate per cambiare materia · /boss per la sfida`
  );
}

export function gateButtons() {
  // 2 bottoni per riga: con 5 materie una riga sola diventa troppo stretta su mobile.
  const buttons = GATE_IDS.map((g) => ({ text: `${GATES[g].emoji} ${GATES[g].name}`, callback_data: `lg|${g}` }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}

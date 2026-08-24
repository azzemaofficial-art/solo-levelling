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
      { m: 'Fondamenti', q: 'Cos\'è una <b>condizione if</b>?', a: ['Esegue codice solo se una condizione è vera', 'Ripete un blocco per sempre', 'Definisce una variabile'], correct: 0, exp: 'if (condizione) { ... } esegue il blocco solo se la condizione è vera.' },
      { m: 'Fondamenti', q: 'Cos\'è un <b>oggetto</b> in programmazione?', a: ['Una struttura che raggruppa dati e funzioni correlate', 'Un file eseguibile', 'Un tipo di errore'], correct: 0, exp: 'Un oggetto ha proprietà (dati) e metodi (funzioni) che agiscono su quei dati.' },
      { m: 'Fondamenti', q: 'Cosa significa <b>booleano</b>?', a: ['Un valore vero/falso', 'Un numero decimale', 'Un testo'], correct: 0, exp: 'Boolean: true o false, usato per condizioni e logica.' },
      { m: 'Fondamenti', q: 'Cos\'è la <b>ricorsione</b>?', a: ['Una funzione che chiama sé stessa', 'Un ciclo infinito per errore', 'Una variabile globale'], correct: 0, exp: 'Una funzione ricorsiva risolve un problema chiamando sé stessa su un caso più piccolo.' },
      { m: 'Fondamenti', q: 'Cos\'è un <b>oggetto JSON</b>?', a: ['Un formato dati testuale chiave-valore', 'Un linguaggio di programmazione', 'Un database'], correct: 0, exp: 'JSON = JavaScript Object Notation, formato leggero per scambiare dati.' },
      { m: 'Fondamenti', q: 'Cos\'è una <b>libreria</b> (o "package")?', a: ['Codice riutilizzabile scritto da altri', 'Un tipo di variabile', 'Un errore di sintassi'], correct: 0, exp: 'Una libreria fornisce funzioni pronte all\'uso, così non reinventi la ruota.' },
      { m: 'Fondamenti', q: 'Cosa fa un <b>compilatore</b>?', a: ['Traduce il codice sorgente in linguaggio macchina', 'Esegue il codice riga per riga', 'Cancella i bug'], correct: 0, exp: 'Il compilatore traduce tutto il codice PRIMA dell\'esecuzione (a differenza di un interprete).' },
      { m: 'Fondamenti', q: 'Qual è la differenza tra <b>compilato</b> e <b>interpretato</b>?', a: ['Il compilato traduce tutto prima, l\'interpretato riga per riga durante l\'esecuzione', 'Sono sinonimi', 'L\'interpretato è sempre più veloce'], correct: 0, exp: 'Python è interpretato, C è compilato: compromessi diversi tra velocità di sviluppo e di esecuzione.' },
      { m: 'Strutture dati', q: 'Cos\'è uno <b>stack</b>?', a: ['Struttura LIFO (ultimo entrato, primo uscito)', 'Una lista ordinata a caso', 'Un tipo di database'], correct: 0, exp: 'Stack = pila: aggiungi/togli solo dall\'alto (Last In First Out).' },
      { m: 'Strutture dati', q: 'Cos\'è una <b>queue</b> (coda)?', a: ['Struttura FIFO (primo entrato, primo uscito)', 'Un tipo di array bidimensionale', 'Una funzione ricorsiva'], correct: 0, exp: 'Queue = coda: il primo elemento aggiunto è il primo a uscire.' },
      { m: 'Strutture dati', q: 'Cos\'è un <b>dizionario/hash map</b>?', a: ['Struttura chiave-valore per accesso rapido', 'Una lista ordinata per indice', 'Un tipo di ciclo'], correct: 0, exp: 'Hash map: accedi al valore tramite una chiave, molto più veloce di cercare in una lista.' },
      { m: 'Complessità', q: 'Cosa indica la <b>Big O notation</b>?', a: ['Come cresce il tempo/spazio di un algoritmo al crescere dei dati', 'Il numero di righe di codice', 'Il linguaggio usato'], correct: 0, exp: 'O(n), O(n²), O(log n)... descrivono l\'efficienza di un algoritmo in scala.' },
      { m: 'Complessità', q: 'Un algoritmo <b>O(n²)</b> rispetto a <b>O(n)</b> è…', a: ['Più lento su input grandi', 'Sempre più veloce', 'Identico'], correct: 0, exp: 'O(n²) cresce molto più velocemente di O(n): con dati grandi diventa un collo di bottiglia.' },
      { m: 'Web', q: 'Cos\'è <b>HTTP</b>?', a: ['Il protocollo usato per comunicare sul web', 'Un linguaggio di programmazione', 'Un database'], correct: 0, exp: 'HTTP definisce come client e server si scambiano richieste e risposte sul web.' },
      { m: 'Web', q: 'Cosa significa lo stato <b>404</b>?', a: ['Risorsa non trovata', 'Richiesta riuscita', 'Errore del server'], correct: 0, exp: '404 Not Found = la risorsa richiesta non esiste sul server.' },
      { m: 'Web', q: 'Cosa significa lo stato <b>500</b>?', a: ['Errore interno del server', 'Richiesta riuscita', 'Non autorizzato'], correct: 0, exp: '500 Internal Server Error = qualcosa è andato storto lato server.' },
      { m: 'Web', q: 'Differenza tra <b>GET</b> e <b>POST</b>?', a: ['GET legge dati, POST li invia/crea', 'Sono identici', 'GET è più sicuro di POST'], correct: 0, exp: 'GET recupera dati (idempotente); POST invia dati per creare/modificare qualcosa.' },
      { m: 'Web', q: 'Cos\'è <b>JSON.parse</b>?', a: ['Converte una stringa JSON in un oggetto', 'Converte un oggetto in stringa', 'Cancella un oggetto'], correct: 0, exp: 'JSON.parse legge testo JSON e lo trasforma in un oggetto usabile; JSON.stringify fa l\'opposto.' },
      { m: 'Web', q: 'Cos\'è <b>CSS</b>?', a: ['Il linguaggio che definisce lo stile grafico di una pagina', 'La struttura della pagina', 'La logica della pagina'], correct: 0, exp: 'HTML = struttura, CSS = stile, JavaScript = comportamento.' },
      { m: 'Database', q: 'Cos\'è una <b>query SQL</b>?', a: ['Un comando per interrogare/modificare un database relazionale', 'Un tipo di variabile', 'Un file di configurazione'], correct: 0, exp: 'SELECT, INSERT, UPDATE, DELETE sono comandi SQL base per lavorare coi dati.' },
      { m: 'Database', q: 'Cos\'è una <b>chiave primaria</b>?', a: ['Un identificatore unico per ogni riga di una tabella', 'Una password del database', 'Un tipo di indice sbagliato'], correct: 0, exp: 'La primary key garantisce che ogni record sia identificabile in modo univoco.' },
      { m: 'Database', q: 'Cosa fa un <b>indice</b> in un database?', a: ['Velocizza le ricerche su una colonna', 'Cancella dati duplicati', 'Cripta i dati'], correct: 0, exp: 'Un indice è come l\'indice di un libro: velocizza la ricerca a scapito di un po\' di spazio extra.' },
      { m: 'Git', q: 'Cos\'è un <b>commit</b>?', a: ['Uno snapshot salvato delle modifiche al codice', 'Un errore di sintassi', 'Un tipo di branch'], correct: 0, exp: 'Ogni commit registra un punto nella storia del progetto, con un messaggio descrittivo.' },
      { m: 'Git', q: 'A cosa serve un <b>branch</b>?', a: ['Sviluppare in parallelo senza toccare il codice principale', 'Cancellare la storia del progetto', 'Comprimere i file'], correct: 0, exp: 'Un branch è una linea di sviluppo separata, poi unita (merge) al ramo principale.' },
      { m: 'Git', q: 'Cos\'è un <b>merge conflict</b>?', a: ['Quando due modifiche allo stesso codice non si combinano automaticamente', 'Un errore di rete', 'Un tipo di commit'], correct: 0, exp: 'Va risolto manualmente scegliendo quale versione (o combinazione) tenere.' },
      { m: 'IA: concetti', q: 'Cos\'è un <b>parametro</b> di un modello IA?', a: ['Un valore interno appreso durante il training', 'Un\'opzione scelta dall\'utente', 'Un tipo di GPU'], correct: 0, exp: 'I modelli hanno miliardi di parametri: numeri regolati durante l\'addestramento per fare previsioni.' },
      { m: 'IA: concetti', q: 'Cos\'è il <b>deep learning</b>?', a: ['Machine learning con reti neurali a più livelli', 'Un sinonimo di IA generativa', 'Un linguaggio di programmazione'], correct: 0, exp: 'Le reti profonde (deep) hanno molti strati che estraggono pattern via via più astratti.' },
      { m: 'IA: concetti', q: 'Cos\'è una <b>rete neurale</b>?', a: ['Un modello ispirato al cervello, fatto di nodi connessi', 'Un tipo di database', 'Un protocollo di rete'], correct: 0, exp: 'Neuroni artificiali organizzati in strati, connessi da pesi che si aggiustano durante il training.' },
      { m: 'LLM', q: 'Cosa significa <b>LLM</b>?', a: ['Large Language Model', 'Low Level Machine', 'Linear Learning Method'], correct: 0, exp: 'LLM = modello linguistico di grandi dimensioni, addestrato su enormi quantità di testo.' },
      { m: 'LLM', q: 'Cos\'è il <b>system prompt</b>?', a: ['Le istruzioni iniziali che definiscono comportamento e ruolo del modello', 'La domanda dell\'utente', 'Un errore del modello'], correct: 0, exp: 'Il system prompt imposta contesto, tono e regole prima che l\'utente scriva.' },
      { m: 'LLM', q: 'Cos\'è il <b>fine-tuning con RLHF</b>?', a: ['Addestramento guidato da feedback umano sulle preferenze', 'Un tipo di GPU', 'Compressione del modello'], correct: 0, exp: 'RLHF (Reinforcement Learning from Human Feedback) allinea il modello alle preferenze umane.' },
      { m: 'LLM', q: 'Cos\'è la <b>quantizzazione</b> di un modello?', a: ['Ridurre la precisione numerica per risparmiare memoria/velocità', 'Aumentare i parametri', 'Cancellare dati di training'], correct: 0, exp: 'Es. da 16-bit a 4-bit: modello più leggero, con una piccola perdita di qualità.' },
      { m: 'Prompt', q: 'Cos\'è il <b>chain-of-thought</b> prompting?', a: ['Chiedere al modello di ragionare passo passo', 'Concatenare più prompt in un file', 'Un errore comune da evitare'], correct: 0, exp: '"Pensa passo passo" spesso migliora l\'accuratezza su problemi complessi.' },
      { m: 'Prompt', q: 'Perché limitare la <b>lunghezza del contesto</b> in un prompt aiuta?', a: ['Riduce costi e rischio di perdere focus su informazioni chiave', 'Rende il modello più lento', 'Non ha alcun effetto'], correct: 0, exp: 'Contesto più corto e mirato spesso produce risposte più precise e più economiche.' },
      { m: 'Sicurezza', q: 'Cos\'è il <b>prompt injection</b>?', a: ['Un tentativo di manipolare l\'IA con istruzioni nascoste nell\'input', 'Un tipo di virus tradizionale', 'Un bug del compilatore'], correct: 0, exp: 'Testo malevolo nascosto in un documento/pagina può provare a dirottare le istruzioni del modello.' },
      { m: 'Sicurezza', q: 'Cos\'è una <b>SQL injection</b>?', a: ['Inserire codice SQL malevolo tramite un campo di input', 'Un tipo di backup', 'Un protocollo di rete'], correct: 0, exp: 'Senza validare l\'input, un attaccante può manipolare le query del database.' },
      { m: 'Sicurezza', q: 'Perché non si devono mai <b>hardcodare le password</b> nel codice?', a: ['Finiscono nel repository e chiunque le legge', 'Rallentano il programma', 'Occupano troppa memoria'], correct: 0, exp: 'Le credenziali vanno in variabili d\'ambiente/secret manager, mai committate nel codice.' },
      { m: 'Cloud', q: 'Cos\'è il <b>serverless</b>?', a: ['Il codice gira su richiesta, senza gestire un server sempre acceso', 'Un\'app senza backend', 'Un tipo di database'], correct: 0, exp: 'Il provider (es. Vercel, AWS Lambda) fa partire la funzione solo quando serve.' },
      { m: 'Cloud', q: 'Cos\'è una <b>API REST</b>?', a: ['Un\'interfaccia web che usa HTTP e risorse identificate da URL', 'Un linguaggio di programmazione', 'Un tipo di database'], correct: 0, exp: 'REST organizza le API attorno a risorse (es. /users/123) e verbi HTTP standard.' },
      { m: 'Cloud', q: 'Cos\'è un <b>webhook</b>?', a: ['Un URL che un servizio chiama automaticamente quando succede un evento', 'Una password API', 'Un tipo di cache'], correct: 0, exp: 'Invece di controllare continuamente, il servizio ti "chiama" quando c\'è qualcosa di nuovo.' },
      { m: 'Testing', q: 'Cos\'è un <b>test unitario</b>?', a: ['Verifica automaticamente il comportamento di una piccola parte di codice', 'Un test fatto a mano una volta sola', 'Un tipo di deploy'], correct: 0, exp: 'Gli unit test isolano una funzione e verificano che si comporti come previsto.' },
      { m: 'Testing', q: 'Perché è utile la <b>Continuous Integration</b> (CI)?', a: ['Esegue automaticamente test e controlli ad ogni modifica', 'Sostituisce completamente i test manuali', 'Serve solo per grandi aziende'], correct: 0, exp: 'CI intercetta bug presto, prima che raggiungano produzione.' },
      { m: 'Fondamenti', q: 'Cos\'è uno <b>scope</b> di una variabile?', a: ['La porzione di codice dove la variabile è visibile/accessibile', 'Il tipo di dato', 'Il valore iniziale'], correct: 0, exp: 'Una variabile locale esiste solo dentro la funzione dove è definita.' },
      { m: 'Fondamenti', q: 'Cos\'è un <b>callback</b>?', a: ['Una funzione passata come argomento, chiamata più tardi', 'Un errore di rete', 'Un tipo di ciclo'], correct: 0, exp: 'Es. in JS: array.map(callback) chiama la funzione per ogni elemento.' },
      { m: 'Fondamenti', q: 'Differenza tra <b>== e ===</b> in JavaScript?', a: ['=== confronta anche il tipo, == converte i tipi prima', 'Sono identici', '== è più sicuro'], correct: 0, exp: '1 == "1" è true (conversione), 1 === "1" è false (tipo diverso).' },
      { m: 'Fondamenti', q: 'Cos\'è <b>null</b> rispetto a <b>undefined</b> (in JS)?', a: ['null è un\'assenza intenzionale, undefined è "non ancora assegnato"', 'Sono sinonimi perfetti', 'null è un errore'], correct: 0, exp: 'undefined = variabile dichiarata ma senza valore; null = valore vuoto assegnato apposta.' },
      { m: 'Fondamenti', q: 'Cos\'è la <b>destrutturazione</b> (destructuring)?', a: ['Estrarre valori da un array/oggetto in variabili separate', 'Cancellare un oggetto', 'Un tipo di errore'], correct: 0, exp: 'const { nome } = utente; estrae "nome" direttamente dall\'oggetto utente.' },
      { m: 'Fondamenti', q: 'Cosa fa l\'operatore <b>spread (...)</b>?', a: ['Espande gli elementi di un array/oggetto', 'Divide una stringa', 'Cancella duplicati'], correct: 0, exp: '[...arr1, ...arr2] unisce due array copiandone gli elementi.' },
      { m: 'Strutture dati', q: 'Cos\'è un <b>set</b>?', a: ['Una collezione di valori unici, senza duplicati', 'Una lista ordinata con duplicati permessi', 'Un tipo di funzione'], correct: 0, exp: 'Un Set memorizza automaticamente solo valori distinti.' },
      { m: 'Strutture dati', q: 'Cos\'è un <b>albero binario</b>?', a: ['Struttura dati dove ogni nodo ha al massimo 2 figli', 'Una lista con due elementi', 'Un tipo di ciclo annidato'], correct: 0, exp: 'Usato per ricerche efficienti (es. Binary Search Tree) e molte altre applicazioni.' },
      { m: 'Algoritmi', q: 'Cos\'è la <b>ricerca binaria</b>?', a: ['Dimezza lo spazio di ricerca ad ogni passo su dati ordinati', 'Controlla ogni elemento uno per uno', 'Funziona solo su testo'], correct: 0, exp: 'Molto più veloce (O(log n)) della ricerca lineare, ma richiede dati già ordinati.' },
      { m: 'Algoritmi', q: 'Cos\'è l\'<b>ordinamento (sorting)</b>?', a: ['Disporre elementi secondo un criterio (es. crescente)', 'Cercare un elemento', 'Cancellare duplicati'], correct: 0, exp: 'Bubble sort, quick sort, merge sort sono algoritmi diversi con efficienze diverse.' },
      { m: 'Paradigmi', q: 'Cos\'è la <b>programmazione a oggetti</b> (OOP)?', a: ['Organizzare il codice attorno a oggetti con stato e comportamento', 'Scrivere solo funzioni pure', 'Un linguaggio specifico'], correct: 0, exp: 'Classi, ereditarietà, incapsulamento sono concetti chiave dell\'OOP.' },
      { m: 'Paradigmi', q: 'Cos\'è la <b>programmazione funzionale</b>?', a: ['Basata su funzioni pure, senza modificare stato esterno', 'Un sinonimo di OOP', 'Solo per matematici'], correct: 0, exp: 'Evita side-effect: stessa input → stesso output, sempre, senza modificare nulla fuori dalla funzione.' },
      { m: 'Paradigmi', q: 'Cos\'è l\'<b>ereditarietà</b> in OOP?', a: ['Una classe eredita proprietà e metodi da un\'altra', 'Copiare manualmente il codice', 'Un tipo di errore'], correct: 0, exp: 'class Cane extends Animale eredita comportamenti comuni, evitando duplicazione.' },
      { m: 'Web', q: 'Cos\'è il <b>DOM</b>?', a: ['La rappresentazione ad albero di una pagina HTML', 'Un linguaggio di stile', 'Un database'], correct: 0, exp: 'Document Object Model: JavaScript lo usa per leggere/modificare la pagina dinamicamente.' },
      { m: 'Web', q: 'Cos\'è <b>CORS</b>?', a: ['Meccanismo che controlla quali domini possono chiamare un\'API', 'Un tipo di database', 'Un linguaggio di stile'], correct: 0, exp: 'Cross-Origin Resource Sharing protegge da richieste non autorizzate da altri siti.' },
      { m: 'Web', q: 'Cos\'è un <b>cookie</b>?', a: ['Un piccolo dato salvato dal browser per ricordare informazioni', 'Un tipo di API', 'Un errore del server'], correct: 0, exp: 'Usato spesso per sessioni di login e preferenze utente.' },
      { m: 'Web', q: 'Cos\'è <b>localStorage</b>?', a: ['Uno spazio del browser per salvare dati persistenti lato client', 'Un database sul server', 'Un tipo di cookie temporaneo'], correct: 0, exp: 'A differenza dei cookie, non viene inviato automaticamente ad ogni richiesta al server.' },
      { m: 'Web', q: 'Cosa significa <b>responsive design</b>?', a: ['Il layout si adatta a schermi di dimensioni diverse', 'Il sito risponde velocemente', 'Il sito ha animazioni'], correct: 0, exp: 'CSS media query e layout flessibili adattano l\'interfaccia a mobile/desktop.' },
      { m: 'Database', q: 'Cos\'è la <b>normalizzazione</b> di un database?', a: ['Organizzare i dati per ridurre ridondanza', 'Cancellare vecchi dati', 'Criptare le tabelle'], correct: 0, exp: 'Dividere i dati in tabelle correlate evita duplicazioni e inconsistenze.' },
      { m: 'Database', q: 'Cos\'è una <b>join</b> in SQL?', a: ['Combina righe di due o più tabelle basandosi su una relazione', 'Cancella una tabella', 'Crea un backup'], correct: 0, exp: 'INNER JOIN, LEFT JOIN... uniscono dati correlati sparsi su più tabelle.' },
      { m: 'Database', q: 'Cos\'è un database <b>NoSQL</b>?', a: ['Un database non relazionale (es. documenti, chiave-valore)', 'Un database senza query', 'Un sinonimo di SQL'], correct: 0, exp: 'MongoDB, Redis: più flessibili per dati non tabellari, a scapito di alcune garanzie.' },
      { m: 'DevOps', q: 'Cos\'è <b>Docker</b>?', a: ['Uno strumento per pacchettizzare app in container isolati', 'Un linguaggio di programmazione', 'Un database'], correct: 0, exp: 'Un container include tutto il necessario per far girare l\'app ovunque allo stesso modo.' },
      { m: 'DevOps', q: 'Cos\'è il <b>deploy continuo</b>?', a: ['Ogni modifica approvata va automaticamente in produzione', 'Rilasci manuali una volta al mese', 'Un tipo di test'], correct: 0, exp: 'Riduce il tempo tra scrivere codice e vederlo live, con test automatici a protezione.' },
      { m: 'DevOps', q: 'Cos\'è una <b>variabile d\'ambiente</b>?', a: ['Un valore di configurazione esterno al codice (es. chiavi API)', 'Una variabile globale nel codice', 'Un tipo di funzione'], correct: 0, exp: 'Permette di cambiare configurazione (dev/produzione) senza toccare il codice sorgente.' },
      { m: 'IA: concetti', q: 'Cos\'è il <b>transfer learning</b>?', a: ['Riusare un modello pre-addestrato per un nuovo compito simile', 'Trasferire dati tra database', 'Un tipo di GPU'], correct: 0, exp: 'Risparmia tempo/dati: parti da un modello che già "sa" molto e lo specializzi.' },
      { m: 'IA: concetti', q: 'Cos\'è il <b>dataset di training</b>?', a: ['I dati usati per addestrare il modello', 'I dati usati per testarlo alla fine', 'Le impostazioni del modello'], correct: 0, exp: 'Il modello impara pattern da questi dati; il test set verifica poi la generalizzazione.' },
      { m: 'IA: concetti', q: 'Cosa sono i <b>bias</b> in un modello IA?', a: ['Distorsioni sistematiche ereditate dai dati di training', 'Errori di sintassi nel codice', 'Un tipo di ottimizzazione'], correct: 0, exp: 'Se i dati riflettono pregiudizi, il modello può riprodurli nelle sue risposte.' },
      { m: 'LLM', q: 'Cos\'è un <b>modello multimodale</b>?', a: ['Elabora più tipi di input: testo, immagini, audio', 'Un modello con più versioni', 'Un modello open source'], correct: 0, exp: 'GPT-4o o Gemini possono "vedere" immagini e "sentire" audio, non solo leggere testo.' },
      { m: 'LLM', q: 'Cos\'è il <b>function calling</b> (tool use)?', a: ['Il modello può richiamare funzioni/strumenti esterni durante la risposta', 'Chiamare una funzione nel codice tradizionale', 'Un errore di API'], correct: 0, exp: 'Il modello decide di usare un tool (es. calcolatrice, ricerca web) e ne integra il risultato.' },
      { m: 'LLM', q: 'Cos\'è un <b>modello open-weight</b>?', a: ['I pesi del modello sono scaricabili e modificabili liberamente', 'Un modello gratuito ma chiuso', 'Un modello senza parametri'], correct: 0, exp: 'Es. Llama, Mistral: puoi scaricarli ed eseguirli sui tuoi server, a differenza dei modelli solo-API.' },
      { m: 'Prompt', q: 'Cos\'è lo <b>zero-shot prompting</b>?', a: ['Chiedere un compito senza fornire esempi', 'Fornire zero istruzioni al modello', 'Un errore comune'], correct: 0, exp: 'Il modello deve capire il compito solo dalla descrizione, senza esempi guida.' },
      { m: 'Prompt', q: 'Perché suddividere un compito complesso in <b>step più piccoli</b> aiuta il prompt?', a: ['Riduce errori e rende il ragionamento più tracciabile', 'Aumenta sempre il costo inutilmente', 'Non cambia nulla'], correct: 0, exp: 'Un prompt "fai tutto in un colpo" spesso produce risultati peggiori di una sequenza di step chiari.' },
      { m: 'Sicurezza', q: 'Cos\'è il <b>rate limiting</b> su un\'API?', a: ['Limita il numero di richieste in un dato tempo', 'Rallenta di proposito il server', 'Un tipo di crittografia'], correct: 0, exp: 'Protegge da abusi/scanner che farebbero troppe richieste in poco tempo.' },
      { m: 'Sicurezza', q: 'Cos\'è l\'<b>autenticazione a due fattori</b> (2FA)?', a: ['Richiede due prove di identità (es. password + codice)', 'Due password diverse per lo stesso account', 'Un tipo di backup'], correct: 0, exp: 'Anche se la password viene rubata, serve il secondo fattore per accedere.' },
      { m: 'Sicurezza', q: 'Perché è importante il <b>HTTPS</b> rispetto a HTTP?', a: ['Cripta la comunicazione tra client e server', 'È solo più veloce', 'Serve solo per i pagamenti'], correct: 0, exp: 'Senza HTTPS, i dati (incluse password) viaggiano in chiaro e sono intercettabili.' },
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
      { m: 'Grammar', q: 'Passato di "go" è "went"; il participio passato è…', a: ['gone', 'went', 'goed'], correct: 0, exp: 'I have gone (participio, con have); I went (passato semplice).' },
      { m: 'Grammar', q: 'Passato di "eat" è…', a: ['ate', 'eated', 'eaten (senza have)'], correct: 0, exp: 'eat → ate (passato) → eaten (participio, con have).' },
      { m: 'Grammar', q: '"If I __ rich, I would travel" (condizionale 2°)', a: ['were', 'am', 'was going to be'], correct: 0, exp: 'Second conditional: if + past simple, would + infinito. "were" per tutte le persone in questo uso.' },
      { m: 'Grammar', q: '"She has been living here __ 5 years"', a: ['for', 'since', 'during'], correct: 0, exp: 'for + durata (5 years); since + punto nel tempo (2020).' },
      { m: 'Grammar', q: '"I wish I __ more time" (desiderio irrealizzabile)', a: ['had', 'have', 'will have'], correct: 0, exp: 'I wish + past simple esprime un desiderio non realizzato nel presente.' },
      { m: 'Grammar', q: 'Comparativo di "far" (lontano) è…', a: ['farther/further', 'farer', 'more far'], correct: 0, exp: 'far → farther/further (irregolare) → farthest/furthest.' },
      { m: 'Grammar', q: '"She __ to the gym every day" (abitudine)', a: ['goes', 'go', 'is going'], correct: 0, exp: 'Present simple per abitudini: she goes (3ª persona + s).' },
      { m: 'Grammar', q: '"I __ my homework when she called" (azione interrotta)', a: ['was doing', 'did', 'do'], correct: 0, exp: 'Past continuous per un\'azione in corso interrotta da un\'altra (past simple: called).' },
      { m: 'Grammar', q: '"This is the book __ I told you about"', a: ['that/which', 'who', 'whose'], correct: 0, exp: 'that/which per cose; who per persone; whose per il possesso.' },
      { m: 'Grammar', q: '"The book __ cover is red" (possesso)', a: ['whose', 'who', 'which'], correct: 0, exp: 'whose indica appartenenza, anche per oggetti in inglese formale.' },
      { m: 'Grammar', q: '"He said he __ tired" (discorso indiretto)', a: ['was', 'is', 'has been'], correct: 0, exp: 'Nel discorso indiretto al passato, il presente diventa passato: "I am" → "he was".' },
      { m: 'Grammar', q: '"By next year, I __ here for a decade" (futuro anteriore)', a: ['will have worked', 'will work', 'work'], correct: 0, exp: 'Future perfect: will have + participio, per un\'azione completata entro un punto futuro.' },
      { m: 'Grammar', q: '"__ you help me?" (richiesta cortese)', a: ['Could', 'Must', 'Shall'], correct: 0, exp: 'Could you...? è la forma cortese standard per chiedere un favore.' },
      { m: 'Grammar', q: '"You __ smoke here" (divieto)', a: ['must not / mustn\'t', 'don\'t have to', 'may not have to'], correct: 0, exp: 'mustn\'t = divieto assoluto; don\'t have to = non è necessario (ma è permesso).' },
      { m: 'Phrasal', q: '"put off" significa…', a: ['Rimandare', 'Indossare', 'Spegnere'], correct: 0, exp: 'put off a meeting = rimandare un incontro.' },
      { m: 'Phrasal', q: '"bring up" significa…', a: ['Sollevare un argomento / crescere (un figlio)', 'Portare fuori', 'Alzare il volume'], correct: 0, exp: 'to bring up a topic = sollevare un argomento; to bring up a child = crescere un figlio.' },
      { m: 'Phrasal', q: '"take off" significa…', a: ['Decollare / togliersi (vestiti)', 'Prendere in prestito', 'Portare via'], correct: 0, exp: 'The plane took off = l\'aereo è decollato; take off your coat = togliti il cappotto.' },
      { m: 'Phrasal', q: '"come across" significa…', a: ['Imbattersi per caso in qualcosa', 'Attraversare la strada', 'Venire da qualcuno'], correct: 0, exp: 'I came across an old photo = mi sono imbattuto per caso in una vecchia foto.' },
      { m: 'Phrasal', q: '"get along (with)" significa…', a: ['Andare d\'accordo con qualcuno', 'Recuperare tempo', 'Portare avanti un progetto'], correct: 0, exp: 'We get along well = andiamo molto d\'accordo.' },
      { m: 'Phrasal', q: '"figure out" significa…', a: ['Capire/risolvere qualcosa', 'Disegnare una figura', 'Uscire fuori'], correct: 0, exp: 'I finally figured it out = alla fine l\'ho capito/risolto.' },
      { m: 'Phrasal', q: '"break down" significa…', a: ['Guastarsi / crollare emotivamente', 'Rompere una porta', 'Interrompere una riunione'], correct: 0, exp: 'The car broke down = l\'auto si è guastata; he broke down in tears = è scoppiato a piangere.' },
      { m: 'Vocab', q: '"eventually" significa…', a: ['Alla fine / col tempo', 'Eventualmente/forse', 'Immediatamente'], correct: 0, exp: 'False friend! eventually = alla fine; "eventualmente" = possibly/if necessary.' },
      { m: 'Vocab', q: '"sensible" significa…', a: ['Sensato/ragionevole', 'Sensibile (emotivo)', 'Sensoriale'], correct: 0, exp: 'False friend! sensible = sensato; "sensibile" = sensitive.' },
      { m: 'Vocab', q: '"fabric" significa…', a: ['Tessuto/stoffa', 'Fabbrica', 'Fabbricato'], correct: 0, exp: 'False friend! fabric = tessuto; "fabbrica" = factory.' },
      { m: 'Vocab', q: '"eventually" vs "finally": qual è più neutro?', a: ['eventually (senza sforzo implicito)', 'finally (implica difficoltà superate)', 'Sono identici sempre'], correct: 0, exp: 'finally spesso implica che ci sia voluto sforzo/attesa; eventually è più neutro.' },
      { m: 'Vocab', q: '"to embarrass" significa…', a: ['Mettere in imbarazzo', 'Abbracciare', 'Imbarcare'], correct: 0, exp: 'False friend! embarrass = imbarazzare; "abbracciare" = to hug/embrace.' },
      { m: 'Vocab', q: '"a factory" significa…', a: ['Una fabbrica', 'Un fattore', 'Una fattoria'], correct: 0, exp: 'factory = fabbrica; "fattoria" = farm; "fattore" = factor.' },
      { m: 'Vocab', q: '"lecture" significa…', a: ['Una lezione universitaria/conferenza', 'La lettura', 'Un libro'], correct: 0, exp: 'False friend! lecture = lezione/conferenza; "lettura" = reading.' },
      { m: 'Vocab', q: '"to pretend" significa…', a: ['Fingere', 'Pretendere', 'Prevedere'], correct: 0, exp: 'False friend! pretend = fingere; "pretendere" = to demand/expect.' },
      { m: 'Vocab', q: '"eventually" and "actually" sono entrambi…', a: ['False friend comuni per gli italiani', 'Sinonimi perfetti', 'Parole rare'], correct: 0, exp: 'Entrambi ingannano: eventually ≠ eventualmente, actually ≠ attualmente.' },
      { m: 'Prepos', q: 'Preposizione: "good __ maths" (bravo in)', a: ['at', 'in', 'on'], correct: 0, exp: 'good at + materia/abilità = bravo in.' },
      { m: 'Prepos', q: 'Preposizione: "married __ someone"', a: ['to', 'with', 'for'], correct: 0, exp: 'married to someone (non "with", errore comune per italiani).' },
      { m: 'Prepos', q: 'Preposizione: "depend __ the weather"', a: ['on', 'of', 'from'], correct: 0, exp: 'depend on = dipendere da.' },
      { m: 'Prepos', q: 'Preposizione: "listen __ music"', a: ['to', 'at', 'for'], correct: 0, exp: 'listen to music (il verbo "to" è quasi sempre necessario con listen).' },
      { m: 'Idioms', q: '"It\'s raining cats and dogs" significa…', a: ['Piove a dirotto', 'Fa freddo', 'C\'è vento forte'], correct: 0, exp: 'Idioma per una pioggia molto intensa.' },
      { m: 'Idioms', q: '"break the ice" significa…', a: ['Rompere l\'imbarazzo iniziale in una situazione sociale', 'Rompere qualcosa di fragile', 'Fare freddo'], correct: 0, exp: 'Usato spesso all\'inizio di un incontro/presentazione per allentare la tensione.' },
      { m: 'Idioms', q: '"once in a blue moon" significa…', a: ['Molto raramente', 'Ogni notte', 'Molto spesso'], correct: 0, exp: 'Un evento rarissimo, come una "luna blu" (fenomeno raro).' },
      { m: 'Idioms', q: '"a piece of cake" significa…', a: ['Una cosa facilissima', 'Un dolce buonissimo', 'Un problema serio'], correct: 0, exp: 'It was a piece of cake = è stato facilissimo.' },
      { m: 'Idioms', q: '"hit the books" significa…', a: ['Mettersi a studiare intensamente', 'Colpire qualcuno con un libro', 'Comprare libri'], correct: 0, exp: 'Espressione informale per "studiare sodo".' },
      { m: 'Business', q: '"deadline" significa…', a: ['La scadenza', 'Una riunione', 'Un obiettivo a lungo termine'], correct: 0, exp: 'deadline = data entro cui completare qualcosa.' },
      { m: 'Business', q: '"to negotiate" significa…', a: ['Negoziare', 'Rifiutare', 'Firmare'], correct: 0, exp: 'to negotiate a deal = negoziare un accordo.' },
      { m: 'Business', q: '"stakeholder" significa…', a: ['Chi ha un interesse in un progetto/azienda', 'Un investitore soltanto', 'Un dipendente qualsiasi'], correct: 0, exp: 'Termine ampio: include investitori, dipendenti, clienti, chiunque sia coinvolto.' },
      { m: 'Pronuncia', q: 'La "th" in "think" si pronuncia…', a: ['Con la lingua tra i denti (suono sordo)', 'Come una "t" normale', 'Come una "s"'], correct: 0, exp: 'Suono unico dell\'inglese, spesso difficile per italiani (θ sordo vs ð sonoro in "this").' },
      { m: 'Ascolto', q: '"Gonna" nel parlato informale sta per…', a: ['going to', 'gone to', 'get on'], correct: 0, exp: 'gonna = contrazione informale di "going to" (I\'m gonna go = I\'m going to go).' },
      { m: 'Ascolto', q: '"Wanna" sta per…', a: ['want to', 'was not', 'will not'], correct: 0, exp: 'wanna = contrazione informale di "want to".' },
      { m: 'Scrittura', q: 'In un\'email formale, come si apre di solito?', a: ['Dear Mr./Ms. [Cognome]', 'Hey!', 'Yo,'], correct: 0, exp: 'Dear + titolo/cognome è lo standard per email professionali in inglese.' },
      { m: 'Scrittura', q: '"I would appreciate it if..." si usa per…', a: ['Fare una richiesta cortese e formale', 'Rifiutare qualcosa', 'Scusarsi'], correct: 0, exp: 'Formula tipica delle email formali per chiedere qualcosa con garbo.' },
      { m: 'Cultura', q: '"Brexit" si riferisce a…', a: ['L\'uscita del Regno Unito dall\'Unione Europea', 'Una crisi economica USA', 'Un trattato commerciale asiatico'], correct: 0, exp: 'Brexit = "British Exit", referendum del 2016 e uscita effettiva nel 2020.' },
      { m: 'Cultura', q: 'Qual è la differenza tra "British English" e "American English" in "colour/color"?', a: ['Ortografia diversa, stessa parola', 'Significati diversi', 'Pronuncia identica sempre'], correct: 0, exp: 'colour (UK) vs color (US): differenze ortografiche sistematiche tra le due varianti.' },
      { m: 'Vocab', q: '"to lend" vs "to borrow": tu presti a qualcuno →', a: ['lend', 'borrow', 'rent'], correct: 0, exp: 'lend = prestare (dare); borrow = prendere in prestito.' },
      { m: 'Vocab', q: '"a stranger" significa…', a: ['Uno sconosciuto', 'Uno strano', 'Un forestiero ostile'], correct: 0, exp: 'False friend! stranger = sconosciuto; "strano" = weird/strange.' },
      { m: 'Grammar', q: '"There is a lot of/There are a lot of": con "milk"?', a: ['There is (non numerabile)', 'There are', 'Entrambi indifferentemente'], correct: 0, exp: 'milk è non numerabile → there is a lot of milk.' },
      { m: 'Grammar', q: '"neither...nor" significa…', a: ['Né...né', 'O...o', 'Sia...sia'], correct: 0, exp: 'Neither the tea nor the coffee is good = né il tè né il caffè sono buoni.' },
      { m: 'Grammar', q: '"as...as" si usa per…', a: ['Un paragone di uguaglianza', 'Un superlativo', 'Un\'eccezione'], correct: 0, exp: 'as tall as = alto quanto (uguaglianza); taller than = comparativo.' },
      { m: 'Grammar', q: '"I\'d rather __ than __" (preferenza)', a: ['stay / go', 'staying / going', 'to stay / to go'], correct: 0, exp: 'would rather + infinito senza to: I\'d rather stay than go.' },
      { m: 'Grammar', q: '"despite" e "although" si usano diversamente perché…', a: ['despite + sostantivo/gerundio, although + frase completa', 'Sono perfettamente intercambiabili', 'despite è informale'], correct: 0, exp: 'Despite the rain (nome) / Although it rained (frase con verbo coniugato).' },
      { m: 'Grammar', q: '"the more, the merrier" è un esempio di…', a: ['Struttura comparativa parallela', 'Condizionale', 'Discorso indiretto'], correct: 0, exp: 'the + comparativo, the + comparativo = più cose succedono, più conseguenza.' },
      { m: 'Grammar', q: '"I used to smoke but I don\'t anymore" — "used to" indica…', a: ['Un\'abitudine passata che non esiste più', 'Un\'abitudine attuale', 'Un obbligo'], correct: 0, exp: 'used to + infinito = qualcosa che facevi regolarmente nel passato, ora no.' },
      { m: 'Grammar', q: '"I\'m used to waking up early" — "be used to" indica…', a: ['Essere abituato a qualcosa (nel presente)', 'Un\'abitudine passata', 'Un obbligo futuro'], correct: 0, exp: 'be used to + -ing = essere abituato a; diverso da "used to" (abitudine passata).' },
      { m: 'Grammar', q: '"Not only __ she sing, but she also dances" (inversione)', a: ['does', 'she', 'is'], correct: 0, exp: 'Dopo "not only" all\'inizio frase, l\'ordine si inverte come in una domanda: does she.' },
      { m: 'Phrasal', q: '"look after" significa…', a: ['Prendersi cura di', 'Cercare', 'Guardare indietro'], correct: 0, exp: 'look after a child = prendersi cura di un bambino.' },
      { m: 'Phrasal', q: '"call off" significa…', a: ['Annullare', 'Chiamare a distanza', 'Rispondere al telefono'], correct: 0, exp: 'They called off the meeting = hanno annullato la riunione.' },
      { m: 'Phrasal', q: '"carry on" significa…', a: ['Continuare', 'Portare con sé', 'Fermarsi'], correct: 0, exp: 'Carry on with your work = continua il tuo lavoro.' },
      { m: 'Phrasal', q: '"get over" significa…', a: ['Superare (una difficoltà/malattia)', 'Attraversare la strada', 'Ottenere di più'], correct: 0, exp: 'It took months to get over the flu = ci sono voluti mesi per riprendersi dall\'influenza.' },
      { m: 'Phrasal', q: '"give in" significa…', a: ['Arrendersi/cedere', 'Dare in prestito', 'Entrare'], correct: 0, exp: 'After hours of arguing, he gave in = dopo ore di discussione, ha ceduto.' },
      { m: 'Vocab', q: '"to realize" significa…', a: ['Rendersi conto', 'Realizzare (costruire)', 'Riuscire'], correct: 0, exp: 'False friend parziale! to realize = rendersi conto; "realizzare un progetto" = to carry out/achieve.' },
      { m: 'Vocab', q: '"eventually vs. finally": quale implica sforzo/attesa lunga?', a: ['finally', 'eventually', 'Nessuno dei due'], correct: 0, exp: 'finally spesso implica sollievo dopo un\'attesa; eventually è più neutro nel tempo.' },
      { m: 'Vocab', q: '"to support" significa…', a: ['Sostenere/appoggiare', 'Sopportare (tollerare)', 'Supportare tecnicamente solo'], correct: 0, exp: 'False friend parziale! "sopportare" nel senso di tollerare = to stand/to bear.' },
      { m: 'Vocab', q: '"comprehensive" significa…', a: ['Completo/esauriente', 'Comprensivo (empatico)', 'Comprensibile'], correct: 0, exp: 'False friend! comprehensive = esauriente; "comprensivo" (persona) = understanding.' },
      { m: 'Vocab', q: '"terrific" significa…', a: ['Fantastico/eccezionale', 'Terrificante', 'Terribile'], correct: 0, exp: 'False friend! terrific = fantastico (positivo); "terrificante" = terrifying.' },
      { m: 'Vocab', q: '"eventually" in una frase come "I eventually understood" significa…', a: ['Alla fine ho capito', 'Forse ho capito', 'Ho quasi capito'], correct: 0, exp: 'Conferma: eventually = alla fine/col tempo, MAI "eventualmente" (that/perhaps).' },
      { m: 'Prepos', q: 'Preposizione: "afraid __ spiders"', a: ['of', 'from', 'for'], correct: 0, exp: 'afraid of = avere paura di.' },
      { m: 'Prepos', q: 'Preposizione: "interested __ history"', a: ['in', 'for', 'to'], correct: 0, exp: 'interested in = interessato a.' },
      { m: 'Prepos', q: 'Preposizione: "different __ what I expected"', a: ['from', 'of', 'than (anche accettato in USA)'], correct: 0, exp: 'different from è lo standard britannico; different than è comune in US English.' },
      { m: 'Idioms', q: '"under the weather" significa…', a: ['Sentirsi poco bene', 'Fare brutto tempo', 'Essere di ottimo umore'], correct: 0, exp: 'I\'m feeling a bit under the weather = mi sento un po\' giù/malaticcio.' },
      { m: 'Idioms', q: '"cost an arm and a leg" significa…', a: ['Costare moltissimo', 'Essere pericoloso', 'Richiedere sforzo fisico'], correct: 0, exp: 'This car cost an arm and a leg = quest\'auto è costata un occhio della testa.' },
      { m: 'Idioms', q: '"the ball is in your court" significa…', a: ['Tocca a te decidere/agire', 'Hai vinto', 'È troppo tardi'], correct: 0, exp: 'Espressione presa dal tennis: ora è il tuo turno di agire.' },
      { m: 'Idioms', q: '"to hit the nail on the head" significa…', a: ['Dire/fare esattamente la cosa giusta', 'Fallire completamente', 'Lavorare con un martello'], correct: 0, exp: 'You hit the nail on the head! = hai colto esattamente nel segno!' },
      { m: 'Business', q: '"to outsource" significa…', a: ['Affidare a terzi/esternalizzare', 'Assumere internamente', 'Licenziare'], correct: 0, exp: 'to outsource a task = affidarla a un fornitore esterno invece di farla internamente.' },
      { m: 'Business', q: '"revenue" significa…', a: ['Il fatturato/ricavo', 'Il profitto netto', 'La spesa'], correct: 0, exp: 'revenue = ricavi totali; profit = ricavi meno costi.' },
      { m: 'Ascolto', q: '"Dunno" nel parlato informale sta per…', a: ['don\'t know', 'do not now', 'down now'], correct: 0, exp: 'dunno = contrazione informale di "don\'t know".' },
      { m: 'Scrittura', q: '"Looking forward to hearing from you" si usa per…', a: ['Chiudere un\'email aspettando una risposta', 'Rifiutare una proposta', 'Aprire un\'email'], correct: 0, exp: 'Formula di chiusura molto comune nelle email professionali in inglese.' },
      { m: 'Cultura', q: 'Cos\'è il "Fahrenheit" usato principalmente negli USA?', a: ['Una scala di misura della temperatura', 'Una moneta storica', 'Un\'unità di lunghezza'], correct: 0, exp: '0°C = 32°F; una scala diversa da quella Celsius usata nel resto del mondo.' },
      { m: 'Pronuncia', q: 'La "r" a fine parola in "car" (British English) è…', a: ['Spesso non pronunciata (non-rhotic)', 'Sempre pronunciata forte', 'Muta anche in American English'], correct: 0, exp: 'British English standard è non-rotico: "car" suona come "cah". American English è invece rotico.' },
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
      { m: 'Numeri', q: '"Trente-trois" è…', a: ['33', '30', '13'], correct: 0, exp: 'trente-trois = 33 (trente + trois).' },
      { m: 'Numeri', q: '"Quatre-vingt-onze" è…', a: ['91', '81', '19'], correct: 0, exp: 'quatre-vingt-onze = 4×20+11 = 91.' },
      { m: 'Numeri', q: '"Premier" significa…', a: ['Primo', 'Secondo', 'Ultimo'], correct: 0, exp: 'premier/première = primo/a (ordinale, irregolare).' },
      { m: 'Giorni', q: '"Lundi" significa…', a: ['Lunedì', 'Domenica', 'Martedì'], correct: 0, exp: 'lundi = lunedì; i giorni non si scrivono maiuscoli in francese.' },
      { m: 'Giorni', q: '"Aujourd\'hui" significa…', a: ['Oggi', 'Domani', 'Ieri'], correct: 0, exp: 'aujourd\'hui = oggi; demain = domani; hier = ieri.' },
      { m: 'Mesi', q: '"Décembre" è…', a: ['Dicembre', 'Ottobre', 'Novembre'], correct: 0, exp: 'décembre = dicembre, ultimo mese dell\'anno.' },
      { m: 'Famiglia', q: '"Le frère" significa…', a: ['Il fratello', 'La sorella', 'Il padre'], correct: 0, exp: 'frère = fratello; sœur = sorella.' },
      { m: 'Famiglia', q: '"Les grands-parents" significa…', a: ['I nonni', 'I genitori', 'I cugini'], correct: 0, exp: 'grands-parents = nonni; parents = genitori.' },
      { m: 'Vestiti', q: '"Un pantalon" significa…', a: ['Un paio di pantaloni', 'Una camicia', 'Un cappotto'], correct: 0, exp: 'pantalon è singolare in francese (a differenza dell\'italiano "pantaloni").' },
      { m: 'Vestiti', q: '"Des chaussures" significa…', a: ['Scarpe', 'Calzini', 'Guanti'], correct: 0, exp: 'chaussures = scarpe (sempre plurale in questo senso); chaussettes = calzini.' },
      { m: 'Meteo', q: '"Il pleut" significa…', a: ['Piove', 'Nevica', 'Tira vento'], correct: 0, exp: 'il pleut = piove; il neige = nevica; il y a du vent = tira vento.' },
      { m: 'Meteo', q: '"Il fait froid" significa…', a: ['Fa freddo', 'Fa caldo', 'C\'è nebbia'], correct: 0, exp: 'il fait froid/chaud = fa freddo/caldo.' },
      { m: 'Professioni', q: '"Un médecin" significa…', a: ['Un medico', 'Un maestro', 'Un avvocato'], correct: 0, exp: 'médecin = medico (sostantivo invariabile per genere).' },
      { m: 'Professioni', q: '"Une infirmière" significa…', a: ['Un\'infermiera', 'Una maestra', 'Un\'avvocata'], correct: 0, exp: 'infirmière = infermiera; infirmier = infermiere.' },
      { m: 'False friend', q: '"Docteur" davanti a un cognome si usa per…', a: ['Medici e dottori di ricerca, come in italiano', 'Solo professori universitari', 'Solo avvocati'], correct: 0, exp: 'Uso simile all\'italiano: Docteur Martin = Dottor Martin.' },
      { m: 'False friend', q: '"Rester" significa…', a: ['Rimanere', 'Riposare', 'Resistere'], correct: 0, exp: 'Falso amico! rester = rimanere; "riposare" = se reposer.' },
      { m: 'False friend', q: '"Demander" significa…', a: ['Chiedere', 'Richiedere con urgenza', 'Comandare'], correct: 0, exp: 'Falso amico! demander = chiedere (semplice); non implica urgenza o comando.' },
      { m: 'False friend', q: '"Assister à" significa…', a: ['Partecipare/assistere a un evento', 'Aiutare qualcuno', 'Insistere'], correct: 0, exp: 'assister à un concert = andare/essere presente a un concerto.' },
      { m: 'Verbi', q: '"Je dois" significa…', a: ['Io devo', 'Io do', 'Io divido'], correct: 0, exp: 'devoir (dovere): je dois, tu dois, il doit…' },
      { m: 'Verbi', q: '"Ils prennent" significa…', a: ['Loro prendono', 'Loro danno', 'Loro portano'], correct: 0, exp: 'prendre (prendere): je prends, tu prends, ils prennent.' },
      { m: 'Verbi', q: '"Vous savez" significa…', a: ['Voi sapete', 'Voi potete', 'Voi volete'], correct: 0, exp: 'savoir (sapere): je sais, tu sais, vous savez.' },
      { m: 'Verbi', q: '"Elle vient" significa…', a: ['Lei viene', 'Lei va', 'Lei vive'], correct: 0, exp: 'venir (venire): je viens, tu viens, elle vient.' },
      { m: 'Verbi', q: '"Nous voyons" significa…', a: ['Noi vediamo', 'Noi vogliamo', 'Noi viviamo'], correct: 0, exp: 'voir (vedere): je vois, tu vois, nous voyons.' },
      { m: 'Verbi', q: '"Je connais" significa…', a: ['Io conosco', 'Io so (un fatto)', 'Io credo'], correct: 0, exp: 'connaître = conoscere (persone/luoghi); savoir = sapere (fatti/come fare).' },
      { m: 'Preposizioni', q: '"Chez moi" significa…', a: ['A casa mia', 'Con me', 'Vicino a me'], correct: 0, exp: 'chez + persona = a casa di / dallo studio di (es. chez le médecin).' },
      { m: 'Preposizioni', q: '"Avec" significa…', a: ['Con', 'Senza', 'Per'], correct: 0, exp: 'avec = con; sans = senza; pour = per.' },
      { m: 'Preposizioni', q: '"Entre" significa…', a: ['Tra/fra', 'Dentro', 'Sopra'], correct: 0, exp: 'entre = tra/fra (due cose); dans = dentro; sur = sopra.' },
      { m: 'Aggettivi', q: 'Femminile di "heureux" (felice)?', a: ['heureuse', 'heureuxe', 'heureuce'], correct: 0, exp: 'Aggettivi in -eux → -euse al femminile: heureux → heureuse.' },
      { m: 'Aggettivi', q: 'Femminile di "sportif" (sportivo)?', a: ['sportive', 'sportife', 'sportifesse'], correct: 0, exp: 'Aggettivi in -if → -ive al femminile: sportif → sportive.' },
      { m: 'Colori', q: '"Rouge" significa…', a: ['Rosso', 'Rosa', 'Arancione'], correct: 0, exp: 'rouge = rosso; rose = rosa; orange = arancione.' },
      { m: 'Corpo', q: '"La main" significa…', a: ['La mano', 'Il piede', 'Il braccio'], correct: 0, exp: 'main = mano; pied = piede; bras = braccio.' },
      { m: 'Emozioni', q: '"J\'ai peur" significa…', a: ['Ho paura', 'Ho fretta', 'Ho ragione'], correct: 0, exp: 'avoir peur = avere paura (come avoir faim/soif/raison).' },
      { m: 'Emozioni', q: '"Je suis content(e)" significa…', a: ['Sono contento/a', 'Sono stanco/a', 'Sono in ritardo'], correct: 0, exp: 'content(e) = contento/a; fatigué(e) = stanco/a.' },
      { m: 'Tempo', q: '"Demain matin" significa…', a: ['Domani mattina', 'Ieri sera', 'Stasera'], correct: 0, exp: 'demain matin = domani mattina; hier soir = ieri sera.' },
      { m: 'Quantità', q: '"Beaucoup de" significa…', a: ['Molto/molti di', 'Poco di', 'Nessuno di'], correct: 0, exp: 'beaucoup de = molto/i; un peu de = un po\' di; pas de = nessuno/niente.' },
      { m: 'Quantità', q: '"Trop" significa…', a: ['Troppo', 'Abbastanza', 'Appena'], correct: 0, exp: 'trop = troppo; assez = abbastanza.' },
      { m: 'Cibo', q: '"Le petit-déjeuner" significa…', a: ['La colazione', 'Il pranzo', 'La merenda'], correct: 0, exp: 'petit-déjeuner = colazione; déjeuner = pranzo; dîner = cena.' },
      { m: 'Cibo', q: '"J\'ai faim" significa…', a: ['Ho fame', 'Ho sete', 'Ho sonno'], correct: 0, exp: 'avoir faim = avere fame; avoir soif = avere sete.' },
      { m: 'Trasporti', q: '"Le train" significa…', a: ['Il treno', 'L\'autobus', 'La metro'], correct: 0, exp: 'train = treno; bus = autobus; métro = metropolitana.' },
      { m: 'Città', q: '"La rue" significa…', a: ['La strada', 'La piazza', 'Il ponte'], correct: 0, exp: 'rue = strada/via; place = piazza; pont = ponte.' },
      { m: 'Futuro semplice', q: '"Je serai" è il futuro di…', a: ['être (sarò)', 'avoir (avrò)', 'faire (farò)'], correct: 0, exp: 'futur simple di être: je serai, tu seras, il sera… (irregolare).' },
      { m: 'Futuro semplice', q: '"Nous aurons" significa…', a: ['Noi avremo', 'Noi saremo', 'Noi faremo'], correct: 0, exp: 'futur simple di avoir: nous aurons (irregolare).' },
      { m: 'Condizionale', q: '"Je voudrais" è il condizionale di…', a: ['vouloir (vorrei)', 'pouvoir (potrei)', 'devoir (dovrei)'], correct: 0, exp: 'je voudrais = vorrei, forma cortese molto usata.' },
      { m: 'Condizionale', q: '"J\'aimerais" significa…', a: ['Mi piacerebbe / vorrei', 'Amo', 'Amerò'], correct: 0, exp: 'conditionnel di aimer: j\'aimerais = mi piacerebbe.' },
      { m: 'Subjonctif', q: '"Il faut que je parte" — perché il subjonctif?', a: ['Dopo "il faut que" (necessità)', 'È sempre indicativo', 'È un errore'], correct: 0, exp: 'il faut que, je veux que, bien que richiedono il subjonctif.' },
      { m: 'Plus-que-parfait', q: '"J\'avais mangé" significa…', a: ['Avevo mangiato (prima di un\'altra azione passata)', 'Ho mangiato', 'Mangerò'], correct: 0, exp: 'plus-que-parfait: avoir/être all\'imperfetto + participio passato.' },
      { m: 'Discorso indiretto', q: '"Il a dit qu\'il viendrait" significa…', a: ['Ha detto che sarebbe venuto', 'Dice che viene', 'Ha detto che è venuto'], correct: 0, exp: 'Discorso indiretto al passato: il futuro diventa condizionale.' },
      { m: 'Connettori', q: '"Cependant" significa…', a: ['Tuttavia', 'Quindi', 'Inoltre'], correct: 0, exp: 'cependant = tuttavia; donc = quindi; de plus = inoltre.' },
      { m: 'Connettori', q: '"Par conséquent" significa…', a: ['Di conseguenza', 'Al contrario', 'Per esempio'], correct: 0, exp: 'par conséquent = di conseguenza; par contre = al contrario; par exemple = per esempio.' },
      { m: 'Registro', q: '"Tu" si usa con…', a: ['Amici, famiglia, coetanei (informale)', 'Sempre, anche con sconosciuti', 'Solo per iscritto'], correct: 0, exp: '"vous" è la forma formale/di rispetto o plurale; "tu" è informale.' },
      { m: 'Idiomi', q: '"C\'est la vie" significa…', a: ['È la vita (così va la vita)', 'È bello', 'È finita'], correct: 0, exp: 'Espressione fatalista molto comune: "così va la vita".' },
      { m: 'Idiomi', q: '"Il pleut des cordes" significa…', a: ['Piove a dirotto', 'Fa molto freddo', 'C\'è vento forte'], correct: 0, exp: 'Idioma: letteralmente "piove corde" = piove tantissimo.' },
      { m: 'Idiomi', q: '"Avoir le cafard" significa…', a: ['Essere giù di morale', 'Avere fretta', 'Essere arrabbiati'], correct: 0, exp: 'Idioma colloquiale: avere la malinconia/essere depressi.' },
      { m: 'Geografia', q: 'La Francia confina con…', a: ['Spagna, Italia, Germania (tra gli altri)', 'Solo con l\'Italia', 'Solo con la Spagna'], correct: 0, exp: 'La Francia confina con 8 paesi: Spagna, Italia, Germania, Belgio, ecc.' },
      { m: 'Geografia', q: 'Qual è il fiume più lungo di Francia?', a: ['La Loira', 'La Senna', 'Il Rodano'], correct: 0, exp: 'La Loire (Loira) è il fiume più lungo; la Senna attraversa Parigi.' },
      { m: 'Letteratura', q: 'Chi scrisse "Les Misérables"?', a: ['Victor Hugo', 'Molière', 'Voltaire'], correct: 0, exp: 'Victor Hugo, pubblicato nel 1862.' },
      { m: 'Espressioni', q: '"À bientôt" significa…', a: ['A presto', 'Arrivederci per sempre', 'Buonanotte'], correct: 0, exp: 'à bientôt = a presto; au revoir = arrivederci; bonne nuit = buonanotte.' },
      { m: 'Espressioni', q: '"Pas de problème" significa…', a: ['Nessun problema', 'C\'è un problema', 'Forse un problema'], correct: 0, exp: 'pas de + nome (senza articolo) dopo negazione = nessuno/niente.' },
      { m: 'Numeri ordinali', q: '"Deuxième" significa…', a: ['Secondo', 'Due', 'Dodicesimo'], correct: 0, exp: 'deuxième = secondo (ordinale); deux = due (cardinale).' },
      { m: 'Tempo', q: '"Il y a deux ans" significa…', a: ['Due anni fa', 'Tra due anni', 'Da due anni'], correct: 0, exp: 'il y a + tempo = fa (nel passato); dans + tempo = tra (nel futuro).' },
      { m: 'Verbi pronominali', q: '"Nous nous levons" significa…', a: ['Noi ci alziamo', 'Noi ci laviamo', 'Noi ci sediamo'], correct: 0, exp: 'se lever (alzarsi): je me lève, tu te lèves, nous nous levons.' },
      { m: 'Gerundio', q: '"En mangeant" significa…', a: ['Mangiando', 'Da mangiare', 'Per mangiare'], correct: 0, exp: 'gérondif: en + participio presente = azione simultanea (mangiando).' },
      { m: 'Negoziare', q: '"Je propose que..." si usa per…', a: ['Fare una proposta', 'Rifiutare', 'Scusarsi'], correct: 0, exp: 'je propose que = espressione per aprire una proposta/negoziazione.' },
      { m: 'Presentazioni orali', q: '"Pour conclure" si usa per…', a: ['Concludere un discorso', 'Iniziare un discorso', 'Fare una domanda'], correct: 0, exp: 'pour conclure = per concludere; pour commencer = per iniziare.' },
      { m: 'Verbi', q: '"Ils doivent" significa…', a: ['Loro devono', 'Loro possono', 'Loro vogliono'], correct: 0, exp: 'devoir: nous devons, vous devez, ils doivent.' },
      { m: 'Verbi', q: '"Nous pouvons" significa…', a: ['Noi possiamo', 'Noi dobbiamo', 'Noi sappiamo'], correct: 0, exp: 'pouvoir: nous pouvons, vous pouvez, ils peuvent.' },
      { m: 'Verbi', q: '"Elle dort" significa…', a: ['Lei dorme', 'Lei mangia', 'Lei corre'], correct: 0, exp: 'dormir: je dors, tu dors, elle dort.' },
      { m: 'Verbi', q: '"Je finis" significa…', a: ['Io finisco', 'Io comincio', 'Io continuo'], correct: 0, exp: 'finir (2° gruppo, -ir): je finis, tu finis, il finit.' },
      { m: 'Verbi', q: '"Vous choisissez" significa…', a: ['Voi scegliete', 'Voi perdete', 'Voi trovate'], correct: 0, exp: 'choisir (-ir regolare): je choisis, vous choisissez.' },
      { m: 'Numeri', q: '"Deux cents" è…', a: ['200', '20', '2000'], correct: 0, exp: 'deux cents = 200 (cent prende la -s al plurale senza altro numero dopo).' },
      { m: 'Numeri', q: '"Un million" è…', a: ['1.000.000', '1.000', '100.000'], correct: 0, exp: 'million = milione; mille = mille (invariabile).' },
      { m: 'Domande', q: '"Qui est-ce?" significa…', a: ['Chi è?', 'Che cos\'è?', 'Dov\'è?'], correct: 0, exp: 'qui = chi (persone); qu\'est-ce que = che cosa.' },
      { m: 'Domande', q: '"Qu\'est-ce que c\'est?" significa…', a: ['Che cos\'è?', 'Chi è?', 'Come si chiama?'], correct: 0, exp: 'qu\'est-ce que c\'est = che cos\'è (per oggetti/cose).' },
      { m: 'Domande', q: '"Combien de temps?" significa…', a: ['Quanto tempo?', 'Che tempo fa?', 'A che ora?'], correct: 0, exp: 'combien de temps = quanto tempo (durata).' },
      { m: 'Preposizioni', q: '"Depuis" significa…', a: ['Da (un momento nel passato fino a ora)', 'Fino a', 'Prima di'], correct: 0, exp: 'depuis 2020 = dal 2020 (a oggi); jusqu\'à = fino a; avant = prima di.' },
      { m: 'Preposizioni', q: '"Pendant" significa…', a: ['Durante/per (una durata)', 'Dopo', 'Verso'], correct: 0, exp: 'pendant les vacances = durante le vacanze; pendant 3 heures = per 3 ore.' },
      { m: 'Aggettivi', q: 'Femminile di "nouveau" (nuovo)?', a: ['nouvelle', 'nouveaue', 'nouveause'], correct: 0, exp: 'nouveau è irregolare (come beau): nouveau → nouvelle.' },
      { m: 'Aggettivi', q: 'Plurale di "cheval" (cavallo)?', a: ['chevaux', 'chevals', 'chevales'], correct: 0, exp: 'Nomi in -al spesso fanno il plurale in -aux: cheval → chevaux.' },
      { m: 'Vestiti', q: '"Un manteau" significa…', a: ['Un cappotto', 'Un maglione', 'Una sciarpa'], correct: 0, exp: 'manteau = cappotto; pull = maglione; écharpe = sciarpa.' },
      { m: 'Casa', q: '"Le salon" significa…', a: ['Il soggiorno', 'La cucina', 'Il bagno'], correct: 0, exp: 'salon = soggiorno; salle de bains = bagno.' },
      { m: 'Casa', q: '"Au rez-de-chaussée" significa…', a: ['Al pianterreno', 'Al primo piano', 'In cantina'], correct: 0, exp: 'rez-de-chaussée = pianterreno; premier étage = primo piano.' },
      { m: 'Tempo libero', q: '"Aller au cinéma" significa…', a: ['Andare al cinema', 'Guardare la TV', 'Leggere un libro'], correct: 0, exp: 'aller au + luogo = andare a (con contrazione à + le = au).' },
      { m: 'Lavoro', q: '"Un entretien d\'embauche" significa…', a: ['Un colloquio di lavoro', 'Un contratto', 'Uno stipendio'], correct: 0, exp: 'entretien d\'embauche = colloquio di lavoro (embaucher = assumere).' },
      { m: 'Salute', q: '"Je me sens malade" significa…', a: ['Mi sento male', 'Mi sento bene', 'Sono stanco'], correct: 0, exp: 'se sentir + aggettivo = sentirsi (in un certo modo).' },
      { m: 'Attualità', q: '"L\'environnement" significa…', a: ['L\'ambiente', 'L\'economia', 'La società'], correct: 0, exp: 'environnement = ambiente (tema ricorrente in temi di attualità).' },
      { m: 'Registro formale', q: '"Veuillez trouver ci-joint" si usa…', a: ['In un\'email formale, per allegati', 'Per salutare un amico', 'Al telefono'], correct: 0, exp: 'Formula tipica delle email formali/professionali francesi.' },
      { m: 'Letteratura', q: 'Chi scrisse "Le Petit Prince"?', a: ['Antoine de Saint-Exupéry', 'Albert Camus', 'Jean-Paul Sartre'], correct: 0, exp: 'Pubblicato nel 1943, uno dei libri francesi più tradotti al mondo.' },
      { m: 'Cultura', q: 'Qual è la moneta usata in Francia?', a: ['Euro', 'Franco', 'Sterlina'], correct: 0, exp: 'La Francia usa l\'euro dal 2002 (prima il franco francese).' },
      { m: 'Geografia', q: 'Qual è la montagna più alta d\'Europa occidentale, in Francia?', a: ['Mont Blanc', 'Mont Ventoux', 'Puy de Dôme'], correct: 0, exp: 'Il Mont Blanc (4.809 m) è la vetta più alta delle Alpi occidentali.' },
      { m: 'Ironia/stile', q: '"C\'est pas mal" (colloquiale) significa…', a: ['Non è niente male / è buono', 'È terribile', 'Non lo so'], correct: 0, exp: 'Litote colloquiale: minimizza per dire che è positivo.' },
      { m: 'Discorso', q: '"D\'ailleurs" significa…', a: ['Del resto / peraltro', 'Comunque', 'Per esempio'], correct: 0, exp: 'd\'ailleurs = aggiunge un\'informazione a supporto di quanto detto.' },
      { m: 'Discorso', q: '"En revanche" significa…', a: ['Invece / al contrario', 'Inoltre', 'Perciò'], correct: 0, exp: 'en revanche = introduce un contrasto, come "par contre".' },
      { m: 'Espressioni', q: '"Ça vaut le coup" significa…', a: ['Ne vale la pena', 'Fa male', 'È troppo caro'], correct: 0, exp: 'Espressione idiomatica: vale la pena provare/fare qualcosa.' },
      { m: 'Espressioni', q: '"Je n\'en peux plus" significa…', a: ['Non ne posso più', 'Non lo voglio', 'Non capisco'], correct: 0, exp: 'Esprime esasperazione/stanchezza estrema.' },
      { m: 'Corpo', q: '"Les yeux" significa…', a: ['Gli occhi', 'Le orecchie', 'I capelli'], correct: 0, exp: 'œil (singolare) → yeux (plurale irregolare) = occhio/occhi.' },
      { m: 'Animali', q: '"Un chat" significa…', a: ['Un gatto', 'Un cane', 'Un uccello'], correct: 0, exp: 'chat = gatto; chien = cane; oiseau = uccello.' },
      { m: 'Scuola', q: '"Un devoir" significa…', a: ['Un compito (per casa)', 'Un dovere morale', 'Un diritto'], correct: 0, exp: 'devoir come sostantivo = compito scolastico; come verbo = dovere.' },
      { m: 'Tecnologia', q: '"Un ordinateur portable" significa…', a: ['Un computer portatile', 'Uno smartphone', 'Un tablet'], correct: 0, exp: 'ordinateur portable = laptop; ordinateur = computer fisso.' },
      { m: 'Aeroporto', q: '"Où est l\'embarquement?" significa…', a: ['Dov\'è l\'imbarco?', 'Dov\'è il ritiro bagagli?', 'Dov\'è il check-in?'], correct: 0, exp: 'embarquement = imbarco; enregistrement = check-in; retrait des bagages = ritiro bagagli.' },
      { m: 'Aeroporto', q: '"Ma valise n\'est pas arrivée" significa…', a: ['La mia valigia non è arrivata', 'Ho perso il volo', 'Il mio volo è in ritardo'], correct: 0, exp: 'Frase utile allo sportello bagagli smarriti (objets trouvés / bagages perdus).' },
      { m: 'Aeroporto', q: '"Le vol est retardé" significa…', a: ['Il volo è in ritardo', 'Il volo è cancellato', 'Il volo è in orario'], correct: 0, exp: 'retardé = in ritardo; annulé = cancellato; à l\'heure = in orario.' },
      { m: 'Aeroporto', q: '"Carte d\'embarquement" significa…', a: ['Carta d\'imbarco', 'Passaporto', 'Biglietto del treno'], correct: 0, exp: 'carte d\'embarquement = boarding pass; passeport = passaporto.' },
      { m: 'Stazione/Taxi', q: '"Je voudrais un aller-retour pour Paris" significa…', a: ['Vorrei un biglietto andata e ritorno per Parigi', 'Vorrei un biglietto di sola andata', 'Vorrei prenotare un hotel a Parigi'], correct: 0, exp: 'aller-retour = andata e ritorno; aller simple = sola andata.' },
      { m: 'Stazione/Taxi', q: '"Vous pouvez m\'emmener à cette adresse?" significa…', a: ['Può portarmi a questo indirizzo?', 'Dov\'è questo indirizzo?', 'Quanto costa fino a qui?'], correct: 0, exp: 'Frase tipica per un taxi/VTC, mostrando l\'indirizzo scritto o sul telefono.' },
      { m: 'Stazione/Taxi', q: '"Le quai numéro 3" significa…', a: ['Il binario numero 3', 'Il vagone numero 3', 'La porta numero 3'], correct: 0, exp: 'quai = binario (in stazione) o banchina (in porto).' },
      { m: 'Hotel', q: '"J\'ai une réservation au nom de..." significa…', a: ['Ho una prenotazione a nome di...', 'Vorrei prenotare a nome di...', 'Cerco un hotel vicino a...'], correct: 0, exp: 'Frase standard per il check-in in hotel.' },
      { m: 'Hotel', q: '"La climatisation ne marche pas" significa…', a: ['L\'aria condizionata non funziona', 'Il riscaldamento è troppo alto', 'La doccia non funziona'], correct: 0, exp: 'ne marche pas / ne fonctionne pas = non funziona — utile per segnalare problemi in camera.' },
      { m: 'Hotel', q: '"À quelle heure est le petit-déjeuner?" significa…', a: ['A che ora è la colazione?', 'Dov\'è la colazione?', 'Quanto costa la colazione?'], correct: 0, exp: 'petit-déjeuner = colazione; chiedere l\'orario è frase utilissima in hotel.' },
      { m: 'Hotel', q: '"Pouvez-vous appeler un taxi, s\'il vous plaît?" significa…', a: ['Può chiamare un taxi, per favore?', 'Dov\'è la fermata del taxi?', 'Il taxi è già arrivato?'], correct: 0, exp: 'Richiesta cortese tipica alla reception dell\'hotel.' },
      { m: 'Emergenze', q: '"J\'ai perdu mon passeport" significa…', a: ['Ho perso il passaporto', 'Ho dimenticato il passaporto', 'Il mio passaporto è scaduto'], correct: 0, exp: 'perdre (perdere): j\'ai perdu = ho perso — frase da sapere a memoria in viaggio.' },
      { m: 'Emergenze', q: '"Appelez une ambulance!" significa…', a: ['Chiami un\'ambulanza!', 'Chiami la polizia!', 'Chiami i pompieri!'], correct: 0, exp: 'ambulance = ambulanza; police = polizia; pompiers = vigili del fuoco.' },
      { m: 'Emergenze', q: '"Où est l\'hôpital le plus proche?" significa…', a: ['Dov\'è l\'ospedale più vicino?', 'Dov\'è la farmacia più vicina?', 'Dov\'è il medico di turno?'], correct: 0, exp: 'le plus proche = il più vicino — struttura utile per qualsiasi "dov\'è il/la ___ più vicino/a?".' },
      { m: 'Emergenze', q: '"On m\'a volé mon sac" significa…', a: ['Mi hanno rubato la borsa', 'Ho perso la borsa', 'La mia borsa è rotta'], correct: 0, exp: 'voler = rubare; on m\'a volé = mi hanno rubato (forma impersonale "on").' },
      { m: 'Ristorante', q: '"Je suis allergique aux fruits de mer" significa…', a: ['Sono allergico ai frutti di mare', 'Non mi piacciono i frutti di mare', 'Vorrei frutti di mare'], correct: 0, exp: 'allergique à = allergico a — fondamentale da saper dire chiaramente al ristorante.' },
      { m: 'Ristorante', q: '"C\'est végétarien?" significa…', a: ['È vegetariano?', 'È piccante?', 'È fresco?'], correct: 0, exp: 'végétarien/végétarienne = vegetariano/a; sans viande = senza carne.' },
      { m: 'Ristorante', q: '"Nous sommes quatre" significa…', a: ['Siamo in quattro', 'Sono le quattro', 'Costa quattro euro'], correct: 0, exp: 'Frase per prenotare un tavolo: nous sommes + numero = siamo in [numero].' },
      { m: 'Ristorante', q: '"Séparément ou ensemble?" (chiesto dal cameriere) significa…', a: ['Conti separati o insieme?', 'Dentro o fuori?', 'Antipasto o dolce?'], correct: 0, exp: 'Domanda tipica al momento di pagare il conto in un gruppo.' },
      { m: 'Soldi', q: '"Vous acceptez la carte?" significa…', a: ['Accettate la carta (di credito)?', 'Accettate contanti?', 'Dov\'è il bancomat?'], correct: 0, exp: 'carte (bancaire) = carta di credito/debito; espèces = contanti.' },
      { m: 'Soldi', q: '"Où est le distributeur le plus proche?" significa…', a: ['Dov\'è il bancomat più vicino?', 'Dov\'è la banca più vicina?', 'Dov\'è il cambio valuta?'], correct: 0, exp: 'distributeur (automatique de billets) = bancomat/ATM.' },
      { m: 'Telefono/Wifi', q: '"Quel est le mot de passe du wifi?" significa…', a: ['Qual è la password del wifi?', 'C\'è il wifi qui?', 'Il wifi non funziona'], correct: 0, exp: 'mot de passe = password — una delle domande più usate in viaggio.' },
      { m: 'Indicazioni', q: '"C\'est à combien de minutes à pied?" significa…', a: ['Quanti minuti a piedi?', 'A che distanza in auto?', 'A che ora apre?'], correct: 0, exp: 'à pied = a piedi; à combien de minutes = quanti minuti (di distanza).' },
      { m: 'Indicazioni', q: '"Vous êtes perdu(e)?" significa…', a: ['Si è perso/a?', 'Ha fretta?', 'Ha bisogno di aiuto?'], correct: 0, exp: 'être perdu(e) = essere perso/a — potresti sentirtelo chiedere se hai l\'aria confusa con una mappa.' },
      { m: 'Meteo/small talk', q: '"Il fait un temps magnifique aujourd\'hui" significa…', a: ['Fa un tempo magnifico oggi', 'Farà brutto tempo domani', 'Ieri pioveva molto'], correct: 0, exp: 'Frase da small talk molto comune, utile per rompere il ghiaccio in viaggio.' },
      { m: 'Auto a noleggio', q: '"Je voudrais louer une voiture" significa…', a: ['Vorrei noleggiare un\'auto', 'Vorrei comprare un\'auto', 'Vorrei parcheggiare qui'], correct: 0, exp: 'louer = noleggiare/affittare; une voiture de location = un\'auto a noleggio.' },
      { m: 'Museo/spiaggia', q: '"Le musée est ouvert jusqu\'à quelle heure?" significa…', a: ['Fino a che ora è aperto il museo?', 'Quanto costa il biglietto del museo?', 'Dov\'è l\'ingresso del museo?'], correct: 0, exp: 'ouvert jusqu\'à = aperto fino a; entrée = ingresso; billet = biglietto.' },
      { m: 'Cortesia viaggio', q: '"Excusez-moi de vous déranger" significa…', a: ['Mi scusi per il disturbo', 'Con permesso, passo', 'Non ho capito bene'], correct: 0, exp: 'Formula cortese per attirare l\'attenzione di qualcuno prima di fare una domanda.' },
      { m: 'Cortesia viaggio', q: '"Vous parlez anglais?" significa…', a: ['Parla inglese?', 'Capisce l\'inglese?', 'È inglese?'], correct: 0, exp: 'Utile se il tuo francese si blocca: chiedere di passare all\'inglese.' },
      { m: 'Cortesia viaggio', q: '"Pourriez-vous parler plus lentement, s\'il vous plaît?" significa…', a: ['Potrebbe parlare più lentamente, per favore?', 'Potrebbe ripetere il prezzo?', 'Potrebbe scrivermelo?'], correct: 0, exp: 'pourriez-vous = condizionale molto cortese di pouvoir; plus lentement = più lentamente.' },
      { m: 'Farmacia', q: '"J\'ai besoin d\'un médicament contre le mal de tête" significa…', a: ['Ho bisogno di una medicina per il mal di testa', 'Ho bisogno di un medico', 'Devo prenotare una visita'], correct: 0, exp: 'avoir besoin de = aver bisogno di; contre + disturbo = medicina "contro" quel disturbo.' },
      { m: 'Bagagli', q: '"Où puis-je laisser mes bagages?" significa…', a: ['Dove posso lasciare i bagagli?', 'Dove ritiro i bagagli?', 'I bagagli sono già arrivati?'], correct: 0, exp: 'laisser = lasciare/depositare; consigne (à bagages) = deposito bagagli.' },
      { m: 'Prenotazioni', q: '"Est-ce que c\'est complet?" significa…', a: ['È al completo?', 'È incluso?', 'È vicino?'], correct: 0, exp: 'complet = al completo/tutto esaurito — utile per hotel, ristoranti, treni.' },
      { m: 'Contrattempi', q: '"J\'ai raté mon train" significa…', a: ['Ho perso il treno', 'Ho preso il treno', 'Il treno è in ritardo'], correct: 0, exp: 'rater = mancare/perdere (un mezzo, un\'occasione): j\'ai raté = ho perso.' },
      { m: 'Contrattempi', q: '"Il y a une grève des transports" significa…', a: ['C\'è uno sciopero dei trasporti', 'C\'è un guasto ai trasporti', 'I trasporti sono gratuiti oggi'], correct: 0, exp: 'grève = sciopero — informazione utile e purtroppo frequente in Francia.' },
    ],
  },
  polish: {
    name: 'Polski', emoji: '🇵🇱', course: [
      { m: 'Saluti', q: '"Cześć" si usa…', a: ['Tra amici, sia per salutare che per accomiatarsi', 'Solo la mattina', 'Solo in modo formale'], correct: 0, exp: 'Cześć = ciao, informale, va bene per salutare e per dirsi arrivederci.' },
      { m: 'Saluti', q: '"Dzień dobry" significa…', a: ['Buongiorno (formale)', 'Buonasera', 'Buonanotte'], correct: 0, exp: 'Dzień dobry = buongiorno/buon pomeriggio, formale; Dobry wieczór = buonasera.' },
      { m: 'Saluti', q: '"Jak się masz?" significa…', a: ['Come stai?', 'Come ti chiami?', 'Di dove sei?'], correct: 0, exp: 'Jak się masz? = come stai? (informale); risposta comune: "W porządku" (tutto ok).' },
      { m: 'Saluti', q: '"Miło mi" significa…', a: ['Piacere (di conoscerti)', 'Grazie mille', 'Mi dispiace'], correct: 0, exp: 'Miło mi (poznać) = piacere di conoscerti.' },
      { m: 'Numeri', q: '"Dwadzieścia" è…', a: ['20', '12', '2'], correct: 0, exp: 'dwadzieścia = 20; dwanaście = 12; dwa = 2.' },
      { m: 'Numeri', q: '"Sto" è…', a: ['100', '10', '1000'], correct: 0, exp: 'sto = 100; dziesięć = 10; tysiąc = 1000.' },
      { m: 'Verbo być', q: '"Jestem" significa…', a: ['Io sono', 'Io ho', 'Io vado'], correct: 0, exp: 'być (essere): jestem, jesteś, jest, jesteśmy, jesteście, są.' },
      { m: 'Verbo być', q: '"Oni są" significa…', a: ['Loro sono', 'Loro hanno', 'Loro vanno'], correct: 0, exp: 'być (3ª pl.): oni/one są = loro sono.' },
      { m: 'Verbo mieć', q: '"Mam" significa…', a: ['Io ho', 'Io sono', 'Io faccio'], correct: 0, exp: 'mieć (avere): mam, masz, ma, mamy, macie, mają.' },
      { m: 'Verbo mieć', q: '"Czy masz czas?" significa…', a: ['Hai tempo?', 'Che ore sono?', 'Dove vai?'], correct: 0, exp: 'czy introduce una domanda sì/no; masz = 2ª persona di mieć.' },
      { m: 'Generi', q: 'Un nome che finisce in consonante è di solito…', a: ['Maschile', 'Femminile', 'Neutro'], correct: 0, exp: 'Regola generale: consonante → maschile, -a → femminile, -o/-e → neutro.' },
      { m: 'Generi', q: 'Un nome che finisce in "-a" è di solito…', a: ['Femminile', 'Maschile', 'Neutro'], correct: 0, exp: 'kobieta (donna), książka (libro): terminazione -a tipicamente femminile.' },
      { m: 'Generi', q: 'Un nome che finisce in "-o" è di solito…', a: ['Neutro', 'Maschile', 'Femminile'], correct: 0, exp: 'dziecko (bambino), okno (finestra): terminazione -o tipicamente neutra.' },
      { m: 'Cibo', q: '"Poproszę" si usa per…', a: ['Ordinare cortesemente qualcosa', 'Ringraziare', 'Salutare'], correct: 0, exp: 'poproszę kawę = vorrei un caffè, per favore — la forma cortese più comune.' },
      { m: 'Cibo', q: '"Smacznego!" significa…', a: ['Buon appetito!', 'Alla salute!', 'Grazie!'], correct: 0, exp: 'Si dice prima di iniziare a mangiare, come "bon appétit".' },
      { m: 'Vocab', q: '"Dziękuję" significa…', a: ['Grazie', 'Prego', 'Scusa'], correct: 0, exp: 'Dziękuję = grazie; Proszę = prego (risposta a un ringraziamento, o "per favore").' },
      { m: 'Vocab', q: '"Przepraszam" significa…', a: ['Scusa/mi scusi', 'Per favore', 'Arrivederci'], correct: 0, exp: 'Przepraszam = scusa (anche per attirare l\'attenzione, come "excuse me").' },
      { m: 'Grammatica', q: 'La negazione "nie" si posiziona…', a: ['Prima del verbo', 'Dopo il verbo', 'Alla fine della frase'], correct: 0, exp: 'Nie rozumiem = non capisco. "nie" va sempre prima del verbo.' },
      { m: 'Grammatica', q: '"Mój" significa…', a: ['Il mio (maschile)', 'La mia (femminile)', 'I miei (plurale)'], correct: 0, exp: 'mój (m.), moja (f.), moje (n./pl.) = il mio/la mia/i miei, si accordano col genere.' },
      { m: 'Orari', q: '"Która godzina?" significa…', a: ['Che ore sono?', 'Che giorno è?', 'Quanto costa?'], correct: 0, exp: 'Która godzina? = che ore sono?' },
      { m: 'Tempo', q: '"Jest zimno" significa…', a: ['Fa freddo', 'Fa caldo', 'Piove'], correct: 0, exp: 'jest zimno/ciepło/gorąco = fa freddo/caldo/molto caldo (espressioni impersonali).' },
      { m: 'Biernik', q: 'Il caso Biernik (accusativo) si usa soprattutto per…', a: ['Il complemento oggetto diretto', 'Il soggetto', 'Il possesso'], correct: 0, exp: 'Mam psa (ho un cane) — "psa" è biernik, il caso del complemento oggetto.' },
      { m: 'Passato', q: 'Il passato maschile singolare finisce tipicamente in…', a: ['-łem (io) / -łeś (tu) / -ł (lui)', '-am / -asz / -a', '-ę / -esz / -e'], correct: 0, exp: 'Robiłem = ho fatto (io, maschile); robiłam = ho fatto (io, femminile).' },
      { m: 'Lavoro', q: '"Pracuję" significa…', a: ['Io lavoro', 'Io studio', 'Io riposo'], correct: 0, exp: 'pracować (lavorare): pracuję, pracujesz, pracuje.' },
      { m: 'Salute', q: '"Boli mnie głowa" significa…', a: ['Ho mal di testa', 'Ho fame', 'Sono stanco'], correct: 0, exp: 'boli mnie + parte del corpo (al mianownik) = mi fa male.' },
      { m: 'Tempo libero', q: '"Lubię czytać" significa…', a: ['Mi piace leggere', 'Odio leggere', 'Devo leggere'], correct: 0, exp: 'lubić + infinito = piacere fare qualcosa (lubię, lubisz, lubi).' },
      { m: 'Futuro', q: '"Będę pracować" significa…', a: ['Lavorerò', 'Ho lavorato', 'Sto lavorando'], correct: 0, exp: 'Futuro dei verbi imperfettivi: będę + infinito (o forma coniugata).' },
      { m: 'Aspetto verbale', q: 'La differenza tra verbi perfettivi e imperfettivi riguarda…', a: ['Se l\'azione è completata o in corso/ripetuta', 'Il genere del soggetto', 'Il tempo verbale in italiano'], correct: 0, exp: 'Tratto unico delle lingue slave: pisać (scrivere, in corso) vs napisać (scrivere, completato).' },
      { m: 'Comparativi', q: '"Większy" significa…', a: ['Più grande', 'Più piccolo', 'Grande quanto'], correct: 0, exp: 'większy (comparativo di duży) = più grande; największy = il più grande.' },
      { m: 'Imperativo', q: '"Chodź!" significa…', a: ['Vieni! (imperativo)', 'Vai!', 'Aspetta!'], correct: 0, exp: 'Imperativo di chodzić (camminare/venire): Chodź! = vieni!' },
      { m: 'Città', q: '"Ulica" significa…', a: ['La via/strada', 'La piazza', 'Il ponte'], correct: 0, exp: 'ulica = via; plac = piazza; most = ponte.' },
      { m: 'Feste', q: '"Wesołych Świąt!" si dice per…', a: ['Auguri di Natale', 'Buon compleanno', 'Buona Pasqua'], correct: 0, exp: 'Wesołych Świąt = buone feste (Natale); Wesołego Alleluja = buona Pasqua.' },
      { m: 'Condizionale', q: '"Chciałbym" significa…', a: ['Vorrei (uomo che parla)', 'Voglio', 'Volevo'], correct: 0, exp: 'chciałbym (m.) / chciałabym (f.) = vorrei, condizionale di chcieć.' },
      { m: 'Celownik', q: 'Il caso Celownik (dativo) si usa per…', a: ['Il destinatario dell\'azione', 'Il complemento oggetto diretto', 'Il mezzo con cui si fa qualcosa'], correct: 0, exp: 'Daję mu prezent (gli do un regalo) — "mu" è celownik.' },
      { m: 'Opinioni', q: '"Myślę, że..." significa…', a: ['Penso che...', 'Spero che...', 'Dubito che...'], correct: 0, exp: 'myśleć że = pensare che, per introdurre un\'opinione.' },
      { m: 'Narzędnik', q: 'Il caso Narzędnik (strumentale) risponde alla domanda…', a: ['Con che cosa? / Con chi?', 'Chi? / Che cosa?', 'Dove?'], correct: 0, exp: 'Jadę autobusem (vado in autobus) — "autobusem" è narzędnik, il mezzo.' },
      { m: 'Connettori', q: '"Jednak" significa…', a: ['Tuttavia/però', 'Quindi', 'Inoltre'], correct: 0, exp: 'jednak = tuttavia; więc = quindi; poza tym = inoltre.' },
      { m: 'Colloquio', q: '"Moje mocne strony to..." significa…', a: ['I miei punti di forza sono...', 'Il mio lavoro è...', 'La mia esperienza è...'], correct: 0, exp: 'Espressione tipica per parlare dei propri punti di forza in un colloquio.' },
      { m: 'Miejscownik', q: 'Il caso Miejscownik (locativo) si usa sempre…', a: ['Dopo preposizioni come w, na, o', 'Da solo, senza preposizione', 'Solo con i verbi di movimento'], correct: 0, exp: 'W Polsce (in Polonia) — "Polsce" è miejscownik, richiesto dopo "w".' },
      { m: 'Registro', q: '"Pan/Pani" si usa per…', a: ['Rivolgersi formalmente a qualcuno (Lei)', 'Parlare con gli amici', 'Rivolgersi a un bambino'], correct: 0, exp: 'Pan (uomo) / Pani (donna) = forma di cortesia, equivalente al "Lei" italiano.' },
      { m: 'Idiomi', q: '"Nie mój cyrk, nie moje małpy" significa…', a: ['Non sono affari miei', 'Sono molto impegnato', 'Mi piace il circo'], correct: 0, exp: 'Idioma colloquiale (lett. "non il mio circo, non le mie scimmie") = non sono affari miei.' },
      { m: 'Idiomi', q: '"Bułka z masłem" significa…', a: ['Una cosa facilissima', 'Una colazione tipica', 'Un problema serio'], correct: 0, exp: 'Idioma (lett. "panino col burro") = un gioco da ragazzi, facilissimo.' },
      { m: 'Cultura', q: 'Qual è la capitale della Polonia?', a: ['Varsavia', 'Cracovia', 'Danzica'], correct: 0, exp: 'Warszawa (Varsavia) è la capitale; Kraków (Cracovia) è l\'ex capitale storica.' },
      { m: 'Cultura', q: 'Qual è la moneta polacca?', a: ['Złoty', 'Euro', 'Corona'], correct: 0, exp: 'La Polonia usa lo złoty (PLN), non l\'euro.' },
      { m: 'Letteratura', q: 'Chi ha vinto il Nobel per la Letteratura tra gli autori polacchi?', a: ['Wisława Szymborska (tra altri)', 'Solo autori russi', 'Nessun polacco'], correct: 0, exp: 'La Polonia ha diversi Nobel per la letteratura: Sienkiewicz, Miłosz, Szymborska, Tokarczuk.' },
      { m: 'Geografia', q: 'La Polonia si affaccia su…', a: ['Il Mar Baltico', 'Il Mar Nero', 'Il Mediterraneo'], correct: 0, exp: 'Morze Bałtyckie (Mar Baltico) bagna la costa nord della Polonia.' },
      { m: 'Pronuncia', q: 'La lettera "ł" si pronuncia come…', a: ['La "w" inglese di "water"', 'Una "l" normale', 'Una "u" muta'], correct: 0, exp: 'ł si pronuncia come la "w" inglese: Łódź si legge circa "Wuutch".' },
      { m: 'Pronuncia', q: '"Cz" si pronuncia come…', a: ['La "c" dolce italiana di "cena"', 'La "k" dura', 'La "s" sibilante'], correct: 0, exp: 'cz = suono simile a "c" di "cena" ma più duro/retroflesso.' },
      { m: 'Vocab', q: '"Proszę" può significare…', a: ['Prego / per favore / ecco a te (a seconda del contesto)', 'Solo grazie', 'Solo scusa'], correct: 0, exp: 'Parola versatile: risposta a un ringraziamento, richiesta cortese, o porgere qualcosa.' },
      { m: 'Famiglia', q: '"Rodzice" significa…', a: ['I genitori', 'I fratelli', 'I nonni'], correct: 0, exp: 'rodzice = genitori; rodzeństwo = fratelli/sorelle (collettivo); dziadkowie = nonni.' },
      { m: 'Vestiti', q: '"Kurtka" significa…', a: ['Una giacca', 'Un cappello', 'Delle scarpe'], correct: 0, exp: 'kurtka = giacca; czapka = cappello; buty = scarpe.' },
      { m: 'Trasporti', q: '"Pociąg" significa…', a: ['Il treno', 'L\'autobus', 'L\'aereo'], correct: 0, exp: 'pociąg = treno; autobus = autobus; samolot = aereo.' },
      { m: 'Corpo', q: '"Ręka" significa…', a: ['La mano/braccio', 'Il piede', 'La testa'], correct: 0, exp: 'ręka = mano/braccio; noga = gamba/piede; głowa = testa.' },
      { m: 'Emozioni', q: '"Cieszę się" significa…', a: ['Sono contento/felice', 'Sono triste', 'Sono arrabbiato'], correct: 0, exp: 'cieszyć się = essere felice/contento (verbo riflessivo).' },
      { m: 'Numeri', q: '"Trzydzieści" è…', a: ['30', '13', '3'], correct: 0, exp: 'trzydzieści = 30; trzynaście = 13; trzy = 3.' },
      { m: 'Numeri', q: '"Tysiąc" è…', a: ['1000', '100', '10.000'], correct: 0, exp: 'tysiąc = 1000 (invariabile come "mille" in italiano).' },
      { m: 'Verbi -ować', q: '"Kupuję" significa…', a: ['Io compro', 'Io vendo', 'Io pago'], correct: 0, exp: 'kupować (comprare): kupuję, kupujesz, kupuje.' },
      { m: 'Verbi -ować', q: '"On pracuje" significa…', a: ['Lui lavora', 'Lui studia', 'Lui riposa'], correct: 0, exp: 'pracować: on/ona pracuje (3ª persona singolare).' },
      { m: 'Cibo', q: '"Dużo" significa…', a: ['Molto/molti', 'Poco', 'Niente'], correct: 0, exp: 'dużo = molto/i; mało = poco/pochi.' },
      { m: 'Animali', q: '"Pies" significa…', a: ['Il cane', 'Il gatto', 'L\'uccello'], correct: 0, exp: 'pies = cane; kot = gatto; ptak = uccello.' },
      { m: 'Tecnologia', q: '"Telefon komórkowy" significa…', a: ['Il telefono cellulare', 'Il computer', 'La televisione'], correct: 0, exp: 'telefon komórkowy = cellulare (lett. "telefono a cellula/cella").' },
      { m: 'Cortesia', q: '"Pan/Pani" con un cognome si usa per…', a: ['Rivolgersi formalmente a qualcuno', 'Parlare di sé stessi', 'Solo tra amici'], correct: 0, exp: 'Pan Kowalski / Pani Kowalska = Signor/Signora Kowalski, forma di rispetto.' },
      { m: 'Numeri ordinali', q: '"Pierwszy" significa…', a: ['Primo', 'Secondo', 'Ultimo'], correct: 0, exp: 'pierwszy = primo; drugi = secondo; trzeci = terzo (irregolari, come in molte lingue).' },
      { m: 'Date', q: '"Dziesiątego maja" significa…', a: ['Il dieci maggio', 'Dieci maggio (durata)', 'Ogni maggio'], correct: 0, exp: 'Le date usano il genitivo ordinale: dziesiątego (di) maja.' },
      { m: 'Passato perfettivo', q: '"Zjadłem" (perfettivo) rispetto a "jadłem" (imperfettivo) indica…', a: ['Un\'azione completata (ho finito di mangiare)', 'Un\'azione ripetuta', 'Un\'azione futura'], correct: 0, exp: 'zjeść (perfettivo) = mangiare fino alla fine; jeść (imperfettivo) = l\'atto di mangiare, in corso.' },
      { m: 'Cucina', q: '"Proszę pokroić" significa…', a: ['Per favore, tagli/taglia (imperativo cortese)', 'Per favore, cucini', 'Per favore, lavi'], correct: 0, exp: 'proszę + infinito è una forma cortese/impersonale per dare istruzioni, tipica delle ricette.' },
      { m: 'Cucina', q: '"Pierogi" sono…', a: ['Ravioli ripieni tipici polacchi', 'Una zuppa', 'Un dolce'], correct: 0, exp: 'Pierogi: pasta ripiena (patate/formaggio, carne, frutta), piatto simbolo della Polonia.' },
      { m: 'Dopełniacz', q: 'Il caso Dopełniacz (genitivo) si usa dopo…', a: ['Una negazione o un\'espressione di quantità', 'Un verbo di movimento', 'Un aggettivo possessivo'], correct: 0, exp: 'Nie mam czasu (non ho tempo) — "czasu" è dopełniacz, richiesto dopo la negazione.' },
      { m: 'Ordine delle parole', q: 'In polacco l\'ordine delle parole è…', a: ['Piuttosto libero, grazie ai casi che marcano il ruolo', 'Rigido come in inglese', 'Sempre verbo-soggetto-oggetto'], correct: 0, exp: 'I casi indicano la funzione grammaticale, quindi l\'ordine può cambiare per enfasi.' },
      { m: 'Stampa', q: '"Według najnowszych danych" significa…', a: ['Secondo i dati più recenti', 'Secondo l\'opinione pubblica', 'Nonostante i dati'], correct: 0, exp: 'Espressione tipica del linguaggio giornalistico per introdurre statistiche.' },
      { m: 'Diritto', q: '"Sejm" è…', a: ['La camera bassa del parlamento polacco', 'Il presidente', 'Un tribunale locale'], correct: 0, exp: 'Sejm = camera bassa del parlamento; Senat = camera alta.' },
      { m: 'Scienza', q: '"Badanie naukowe" significa…', a: ['Una ricerca scientifica', 'Un esperimento fallito', 'Un\'ipotesi'], correct: 0, exp: 'badanie naukowe = studio/ricerca scientifica; badacz = ricercatore.' },
      { m: 'Ironia', q: 'Uno "understatement" in polacco spesso usa…', a: ['Diminutivi o toni minimizzanti per essere ironici', 'Solo il superlativo', 'Sempre l\'imperativo'], correct: 0, exp: 'Come in molte lingue, minimizzare ("niezła robota" = non male, detto di qualcosa di ottimo) crea ironia.' },
      { m: 'Dialetti', q: '"Gwara śląska" si riferisce…', a: ['Al dialetto della Slesia', 'Alla lingua ufficiale', 'A un\'antica forma scritta'], correct: 0, exp: 'La Slesia (Śląsk) ha una gwara (parlata regionale) distintiva, con parole proprie.' },
      { m: 'Dati', q: '"Wzrost o 10%" significa…', a: ['Un aumento del 10%', 'Un calo del 10%', 'Una stabilità del 10%'], correct: 0, exp: 'wzrost = crescita/aumento; spadek = calo/diminuzione.' },
      { m: 'Etica', q: '"Z jednej strony... z drugiej strony..." si usa per…', a: ['Presentare due lati di un dilemma', 'Dare un ordine', 'Fare una domanda diretta'], correct: 0, exp: 'Letteralmente "da un lato... dall\'altro" = per bilanciare pro e contro.' },
      { m: 'Scrittura', q: 'Un registro letterario polacco tende a usare…', a: ['Frasi più elaborate e lessico ricercato', 'Solo frasi brevissime', 'Solo il presente'], correct: 0, exp: 'Come in italiano, il registro letterario si distingue per costruzioni più complesse.' },
      { m: 'Cultura', q: 'Chi è il papa polacco più famoso?', a: ['Giovanni Paolo II (Karol Wojtyła)', 'Pio XI', 'Paolo VI'], correct: 0, exp: 'Karol Wojtyła, papa dal 1978 al 2005, prima figura polacca a diventare papa.' },
      { m: 'Cultura', q: 'Qual è il piatto nazionale associato alla Polonia insieme ai pierogi?', a: ['Bigos (stufato di cavolo e carne)', 'Paella', 'Risotto'], correct: 0, exp: 'Bigos è uno stufato tradizionale a base di crauti, cavolo e carne.' },
      { m: 'Storia', q: 'In che anno la Polonia è entrata nell\'Unione Europea?', a: ['2004', '1989', '1999'], correct: 0, exp: 'La Polonia è entrata nella UE il 1° maggio 2004, insieme ad altri 9 paesi.' },
      { m: 'Geografia', q: 'Qual è la città portuale principale della Polonia?', a: ['Danzica (Gdańsk)', 'Cracovia', 'Wrocław'], correct: 0, exp: 'Gdańsk (Danzica) è il principale porto polacco sul Baltico.' },
      { m: 'Pronuncia', q: '"Rz" si pronuncia come…', a: ['Simile al suono di "ż" (una "j" francese sonora)', 'Come "r" seguita da "z" separate', 'Muta, non si pronuncia'], correct: 0, exp: 'rz ha lo stesso suono di ż in quasi tutti i casi (differiscono solo nella scrittura storica).' },
      { m: 'Pronuncia', q: '"Ą" e "ę" sono…', a: ['Vocali nasali (come in francese)', 'Consonanti doppie', 'Lettere mute'], correct: 0, exp: 'ą si pronuncia simile a "on", ę simile a "en" — vocali nasali uniche del polacco.' },
      { m: 'Idiomi', q: '"Rzucać grochem o ścianę" significa…', a: ['Parlare a vuoto, sprecare fiato', 'Essere molto fortunati', 'Lavorare sodo'], correct: 0, exp: 'Idioma (lett. "lanciare piselli contro il muro") = parlare senza essere ascoltati.' },
      { m: 'Idiomi', q: '"Mieć muchy w nosie" significa…', a: ['Essere di cattivo umore', 'Essere molto felici', 'Essere stanchi'], correct: 0, exp: 'Idioma (lett. "avere mosche nel naso") = essere irritati/di cattivo umore.' },
      { m: 'Registro', q: 'Passare da "ty" a "Pan/Pani" con qualcuno segnala…', a: ['Un cambiamento verso un tono più formale/rispettoso', 'Rabbia', 'Confusione'], correct: 0, exp: 'Il cambio di registro è un segnale sociale importante in polacco, come in molte lingue slave.' },
      { m: 'Negoziare', q: '"Proponuję, żeby..." si usa per…', a: ['Fare una proposta', 'Rifiutare', 'Scusarsi'], correct: 0, exp: 'proponuję żeby = propongo che, per aprire una negoziazione.' },
      { m: 'Presentazioni', q: '"Podsumowując" si usa per…', a: ['Riassumere/concludere', 'Iniziare', 'Fare una domanda'], correct: 0, exp: 'podsumowując = riassumendo, tipico per chiudere una presentazione.' },
      { m: 'Aspetto verbale', q: 'La coppia "pisać/napisać" indica…', a: ['Scrivere (in corso) / scrivere (completato)', 'Due verbi senza relazione', 'Presente e passato'], correct: 0, exp: 'Coppia aspettuale classica: pisać (imperfettivo) vs napisać (perfettivo, azione completata).' },
      { m: 'Vestiti', q: '"Sukienka" significa…', a: ['Un vestito da donna', 'Una giacca', 'Un cappello'], correct: 0, exp: 'sukienka = vestito/abito femminile; kurtka = giacca.' },
      { m: 'Casa', q: '"Mieszkanie" significa…', a: ['L\'appartamento', 'La casa singola', 'Il garage'], correct: 0, exp: 'mieszkanie = appartamento; dom = casa (anche nel senso di "abitazione" in generale).' },
      { m: 'Lavoro', q: '"Umowa o pracę" significa…', a: ['Il contratto di lavoro', 'Lo stipendio', 'Il colloquio'], correct: 0, exp: 'umowa o pracę = contratto di lavoro (a tempo indeterminato/determinato).' },
      { m: 'Salute', q: '"Recepta" significa…', a: ['La ricetta medica', 'Una ricetta di cucina', 'Un appuntamento'], correct: 0, exp: 'Falso amico! recepta = ricetta medica; przepis = ricetta di cucina.' },
      { m: 'Meteo', q: '"Pada deszcz" significa…', a: ['Piove', 'Nevica', 'C\'è vento'], correct: 0, exp: 'pada deszcz = piove; pada śnieg = nevica.' },
      { m: 'Trasporti', q: '"Bilet w jedną stronę" significa…', a: ['Un biglietto di sola andata', 'Un biglietto di andata e ritorno', 'Un abbonamento'], correct: 0, exp: 'w jedną stronę = sola andata; tam i z powrotem = andata e ritorno.' },
      { m: 'Corpo', q: '"Serce" significa…', a: ['Il cuore', 'Il fegato', 'Lo stomaco'], correct: 0, exp: 'serce = cuore; wątroba = fegato; żołądek = stomaco.' },
      { m: 'Feste', q: '"Wielkanoc" significa…', a: ['Pasqua', 'Natale', 'Capodanno'], correct: 0, exp: 'Wielkanoc = Pasqua; Boże Narodzenie = Natale; Nowy Rok = Capodanno.' },
      { m: 'Connettori', q: '"Dlatego" significa…', a: ['Perciò/per questo', 'Tuttavia', 'Inoltre'], correct: 0, exp: 'dlatego = perciò/quindi; jednak = tuttavia; poza tym = inoltre.' },
      { m: 'Opinioni', q: '"Uważam, że..." significa…', a: ['Ritengo che...', 'Dubito che...', 'Spero che...'], correct: 0, exp: 'uważać że = ritenere/pensare che, forma più decisa di myśleć że.' },
      { m: 'Celownik', q: '"Daję mu" significa…', a: ['Gli do (a lui)', 'Lo vedo', 'Lo prendo'], correct: 0, exp: 'mu = celownik (dativo) del pronome "on" (lui): a lui/gli.' },
      { m: 'Narzędnik', q: '"Jadę pociągiem" significa…', a: ['Vado in treno', 'Vado al treno', 'Aspetto il treno'], correct: 0, exp: 'pociągiem = narzędnik (strumentale) di pociąg: indica il mezzo di trasporto.' },
      { m: 'Miejscownik', q: '"W Warszawie" significa…', a: ['A Varsavia', 'Verso Varsavia', 'Da Varsavia'], correct: 0, exp: 'Warszawie = miejscownik (locativo) di Warszawa, richiesto dopo "w" (in/a).' },
      { m: 'Saluti', q: '"Dobranoc" significa…', a: ['Buonanotte', 'Buonasera', 'A presto'], correct: 0, exp: 'Dobranoc = buonanotte (per congedarsi la sera tardi); Dobry wieczór = buonasera.' },
      { m: 'Saluti', q: '"Do zobaczenia" significa…', a: ['Ci vediamo / a presto', 'Buongiorno', 'Piacere'], correct: 0, exp: 'Do zobaczenia = ci vediamo, alternativa informale a "do widzenia".' },
      { m: 'Numeri', q: '"Czterdzieści" è…', a: ['40', '14', '4'], correct: 0, exp: 'czterdzieści = 40; czternaście = 14; cztery = 4.' },
      { m: 'Numeri', q: '"Pięćset" è…', a: ['500', '50', '5000'], correct: 0, exp: 'pięćset = 500 (pięć = 5, set/sto = base per le centinaia).' },
      { m: 'Verbi', q: '"Idę" significa…', a: ['Io vado (a piedi)', 'Io vengo', 'Io corro'], correct: 0, exp: 'iść (andare a piedi): idę, idziesz, idzie — distinto da jechać (andare con un mezzo).' },
      { m: 'Verbi', q: '"Jadę" significa…', a: ['Io vado (con un mezzo)', 'Io mangio', 'Io aspetto'], correct: 0, exp: 'jechać (andare con un mezzo): jadę, jedziesz, jedzie.' },
      { m: 'Verbi', q: '"Widzę" significa…', a: ['Io vedo', 'Io guardo', 'Io cerco'], correct: 0, exp: 'widzieć (vedere): widzę, widzisz, widzi.' },
      { m: 'Verbi', q: '"Wiem" significa…', a: ['Io so (un fatto)', 'Io conosco (una persona)', 'Io penso'], correct: 0, exp: 'wiedzieć = sapere (fatti); znać = conoscere (persone/luoghi) — distinzione come in francese/tedesco.' },
      { m: 'Verbi', q: '"Znam go" significa…', a: ['Lo conosco', 'Lo vedo', 'Lo aspetto'], correct: 0, exp: 'znać (conoscere): znam, znasz, zna + complemento in biernik (go = lui).' },
      { m: 'Verbi', q: '"Mówię po polsku" significa…', a: ['Parlo polacco', 'Capisco il polacco', 'Studio il polacco'], correct: 0, exp: 'mówić po polsku = parlare (in) polacco; po + lingua = "in [lingua]".' },
      { m: 'Preposizioni', q: '"Z" (+ genitivo) significa…', a: ['Da/di (provenienza)', 'Con (compagnia, + strumentale)', 'Senza'], correct: 0, exp: 'z Polski = dalla Polonia (genitivo); attenzione: "z" può reggere anche lo strumentale per "con".' },
      { m: 'Preposizioni', q: '"Do" significa…', a: ['Verso/fino a/a (direzione)', 'Da (provenienza)', 'Con'], correct: 0, exp: 'jadę do Warszawy = vado a Varsavia; do + genitivo indica la destinazione.' },
      { m: 'Aggettivi', q: 'Femminile di "dobry" (buono)?', a: ['dobra', 'dobre', 'dobrzy'], correct: 0, exp: 'dobry (m.) → dobra (f.) → dobre (n.): accordo di genere tipico degli aggettivi.' },
      { m: 'Aggettivi', q: 'Plurale maschile-personale di "dobry"?', a: ['dobrzy', 'dobre', 'dobra'], correct: 0, exp: 'Il plurale maschile-personale (persone di sesso maschile) ha una forma speciale: dobrzy panowie.' },
      { m: 'Colori', q: '"Czerwony" significa…', a: ['Rosso', 'Blu', 'Verde'], correct: 0, exp: 'czerwony = rosso; niebieski = blu; zielony = verde.' },
      { m: 'Vestiti', q: '"Buty" significa…', a: ['Scarpe', 'Calzini', 'Guanti'], correct: 0, exp: 'buty = scarpe; skarpetki = calzini; rękawiczki = guanti.' },
      { m: 'Casa', q: '"Kuchnia" significa…', a: ['La cucina', 'La camera', 'Il bagno'], correct: 0, exp: 'kuchnia = cucina; sypialnia = camera da letto; łazienka = bagno.' },
      { m: 'Tempo libero', q: '"Chodzę na siłownię" significa…', a: ['Vado in palestra', 'Vado a nuotare', 'Vado a correre'], correct: 0, exp: 'siłownia = palestra; chodzić na + luogo (accusativo) = frequentare abitualmente.' },
      { m: 'Lavoro', q: '"Szukam pracy" significa…', a: ['Cerco lavoro', 'Ho un lavoro', 'Amo il mio lavoro'], correct: 0, exp: 'szukać + genitivo = cercare; pracy è il genitivo di praca (lavoro).' },
      { m: 'Salute', q: '"Apteka" significa…', a: ['La farmacia', 'L\'ospedale', 'L\'ambulatorio'], correct: 0, exp: 'apteka = farmacia; szpital = ospedale; przychodnia = ambulatorio.' },
      { m: 'Attualità', q: '"Środowisko" significa…', a: ['L\'ambiente (ecologico)', 'La società', 'L\'economia'], correct: 0, exp: 'środowisko = ambiente (naturale); ochrona środowiska = tutela ambientale.' },
      { m: 'Registro', q: '"Serdecznie pozdrawiam" si usa…', a: ['Per chiudere un\'email cordialmente', 'Per iniziare una telefonata', 'Per scusarsi'], correct: 0, exp: 'Formula tipica di chiusura di email semi-formali, equivalente a "cordiali saluti".' },
      { m: 'Idiomi', q: '"Nie ma róży bez kolców" significa…', a: ['Non c\'è rosa senza spine', 'Chi cerca trova', 'Meglio tardi che mai'], correct: 0, exp: 'Proverbio quasi identico all\'italiano: ogni cosa buona ha un lato negativo.' },
      { m: 'Idiomi', q: '"Co ma piernik do wiatraka?" significa…', a: ['Cosa c\'entra? (due cose non collegate)', 'È tutto pronto', 'Ho fame'], correct: 0, exp: 'Idioma (lett. "cosa c\'entra il panpepato col mulino a vento?") = due cose senza relazione.' },
      { m: 'Cultura', q: 'Qual è lo sport più popolare in Polonia?', a: ['Il calcio', 'Il basket', 'Il rugby'], correct: 0, exp: 'Piłka nożna (calcio) è lo sport più seguito in Polonia.' },
      { m: 'Cultura', q: 'Chi ha composto musica celebre tra i polacchi?', a: ['Fryderyk Chopin', 'Ludwig van Beethoven', 'Johann Sebastian Bach'], correct: 0, exp: 'Chopin, compositore romantico polacco, tra i più famosi al mondo.' },
      { m: 'Geografia', q: 'Qual è la catena montuosa principale della Polonia?', a: ['I Tatra (Tatry)', 'Le Alpi', 'I Carpazi orientali'], correct: 0, exp: 'I Tatry sono la parte più alta dei Carpazi, al confine con la Slovacchia.' },
      { m: 'Storia', q: 'Cosa fu Solidarność (Solidarność)?', a: ['Il sindacato/movimento che sfidò il regime comunista', 'Un trattato di pace', 'Una squadra di calcio'], correct: 0, exp: 'Solidarność, guidato da Lech Wałęsa, fu decisivo nella caduta del comunismo in Polonia.' },
      { m: 'Pronuncia', q: '"Ś", "ć", "ź" sono…', a: ['Consonanti "morbide" (palatalizzate)', 'Vocali nasali', 'Lettere mute'], correct: 0, exp: 'Versioni palatalizzate/morbide di s, c, z — un tratto distintivo del polacco.' },
      { m: 'Comparativi', q: '"Najlepszy" significa…', a: ['Il migliore', 'Migliore', 'Buono'], correct: 0, exp: 'dobry → lepszy (migliore) → najlepszy (il migliore): comparativo/superlativo irregolare.' },
      { m: 'Imperativo', q: '"Proszę usiąść" significa…', a: ['Prego, si sieda', 'Prego, si alzi', 'Prego, aspetti'], correct: 0, exp: 'proszę + infinito = forma cortese di imperativo, molto comune nel registro formale.' },
      { m: 'Città', q: '"Skrzyżowanie" significa…', a: ['L\'incrocio', 'Il marciapiede', 'Il semaforo'], correct: 0, exp: 'skrzyżowanie = incrocio; chodnik = marciapiede; sygnalizacja świetlna = semaforo.' },
      { m: 'Feste', q: '"Boże Narodzenie" significa…', a: ['Natale', 'Pasqua', 'Capodanno'], correct: 0, exp: 'Boże Narodzenie (lett. "nascita di Dio") = Natale.' },
      { m: 'Email', q: '"Szanowni Państwo" si usa…', a: ['All\'inizio di un\'email molto formale', 'Per salutare un amico', 'Per chiudere una telefonata'], correct: 0, exp: 'Szanowni Państwo = "Egregi Signori", formula di apertura molto formale.' },
      { m: 'Sostenibilità', q: '"Odnawialne źródła energii" significa…', a: ['Fonti di energia rinnovabile', 'Combustibili fossili', 'Energia nucleare'], correct: 0, exp: 'odnawialny = rinnovabile; źródło energii = fonte di energia.' },
      { m: 'Dibattito', q: '"Nie zgadzam się" significa…', a: ['Non sono d\'accordo', 'Sono d\'accordo', 'Non capisco'], correct: 0, exp: 'zgadzać się = essere d\'accordo; nie zgadzam się = non sono d\'accordo.' },
      { m: 'Colloquio', q: '"Doświadczenie zawodowe" significa…', a: ['Esperienza professionale', 'Formazione scolastica', 'Aspettative salariali'], correct: 0, exp: 'doświadczenie zawodowe = esperienza lavorativa, voce tipica di un CV.' },
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
      { m: 'Storia', q: 'Chi fu il primo imperatore romano?', a: ['Augusto', 'Giulio Cesare', 'Nerone'], correct: 0, exp: 'Augusto (Ottaviano) fu il primo imperatore, dal 27 a.C.; Cesare fu dittatore, non imperatore.' },
      { m: 'Storia', q: 'In che anno iniziò la Prima Guerra Mondiale?', a: ['1914', '1918', '1939'], correct: 0, exp: '1914-1918; la Seconda Guerra Mondiale fu 1939-1945.' },
      { m: 'Storia', q: 'Chi scoprì la penicillina?', a: ['Alexander Fleming', 'Louis Pasteur', 'Marie Curie'], correct: 0, exp: 'Fleming, 1928, per caso osservando una muffa che uccideva batteri.' },
      { m: 'Storia', q: 'Cosa fu la Rivoluzione Francese?', a: ['Il rovesciamento della monarchia in Francia (1789)', 'Una guerra tra Francia e Inghilterra', 'L\'unificazione italiana'], correct: 0, exp: '1789: fine della monarchia assoluta, nascita di ideali di libertà/uguaglianza/fraternità.' },
      { m: 'Storia', q: 'In che anno cadde l\'Impero Romano d\'Occidente?', a: ['476 d.C.', '1453 d.C.', '1000 d.C.'], correct: 0, exp: '476 d.C., con la deposizione di Romolo Augustolo. 1453 è la caduta di Costantinopoli.' },
      { m: 'Geografia', q: 'Qual è il fiume più lungo del mondo?', a: ['Il Nilo (o il Rio delle Amazzoni, dibattuto)', 'Il Mississippi', 'Il Danubio'], correct: 0, exp: 'Nilo e Rio delle Amazzoni si contendono il primato a seconda del metodo di misura.' },
      { m: 'Geografia', q: 'Qual è il deserto più grande del mondo?', a: ['Il Sahara (o l\'Antartide, se si contano i deserti freddi)', 'Il Gobi', 'Il Kalahari'], correct: 0, exp: 'Il Sahara è il più grande deserto caldo; l\'Antartide è tecnicamente il deserto più grande in assoluto (poca precipitazione).' },
      { m: 'Geografia', q: 'Qual è lo stato più popoloso del mondo?', a: ['India', 'Cina', 'USA'], correct: 0, exp: 'L\'India ha superato la Cina in popolazione nel 2023.' },
      { m: 'Geografia', q: 'Quale oceano è il più grande?', a: ['Il Pacifico', 'L\'Atlantico', 'L\'Indiano'], correct: 0, exp: 'Il Pacifico copre più di un terzo della superficie terrestre.' },
      { m: 'Scienza', q: 'Qual è l\'elemento chimico più abbondante nell\'universo?', a: ['Idrogeno', 'Ossigeno', 'Carbonio'], correct: 0, exp: 'L\'idrogeno costituisce circa il 75% della materia ordinaria dell\'universo.' },
      { m: 'Scienza', q: 'Quanti cromosomi ha una cellula umana normale?', a: ['46 (23 coppie)', '23', '92'], correct: 0, exp: '23 coppie di cromosomi = 46 totali, in ogni cellula somatica.' },
      { m: 'Scienza', q: 'Cosa misura la scala pH?', a: ['Acidità/basicità di una soluzione', 'La temperatura', 'La densità'], correct: 0, exp: 'pH 7 = neutro; <7 acido; >7 basico (alcalino).' },
      { m: 'Scienza', q: 'Qual è la funzione principale dei globuli rossi?', a: ['Trasportare ossigeno nel sangue', 'Combattere le infezioni', 'Coagulare il sangue'], correct: 0, exp: 'L\'emoglobina nei globuli rossi lega l\'ossigeno e lo distribuisce ai tessuti.' },
      { m: 'Scienza', q: 'Cos\'è un vaccino?', a: ['Stimola il sistema immunitario a riconoscere un patogeno', 'Un antibiotico', 'Un antidolorifico'], correct: 0, exp: 'Espone il corpo a una versione innocua/parziale del patogeno per creare memoria immunitaria.' },
      { m: 'Spazio', q: 'Quanto dura in media un\'orbita di Marte attorno al Sole?', a: ['Circa 2 anni terrestri (687 giorni)', '1 anno terrestre', '10 anni terrestri'], correct: 0, exp: 'Marte è più lontano dal Sole della Terra, quindi impiega più tempo a completare l\'orbita.' },
      { m: 'Spazio', q: 'Cos\'è un buco nero?', a: ['Una regione con gravità così forte che nulla, luce inclusa, può sfuggirne', 'Una stella spenta e fredda', 'Uno spazio vuoto senza materia'], correct: 0, exp: 'Si forma dal collasso gravitazionale di stelle massicce.' },
      { m: 'Spazio', q: 'Qual è la stella più vicina alla Terra (dopo il Sole)?', a: ['Proxima Centauri', 'Sirio', 'Alpha Centauri A'], correct: 0, exp: 'Proxima Centauri è a circa 4,2 anni luce, la più vicina in assoluto dopo il Sole.' },
      { m: 'Arte', q: 'A quale movimento artistico appartiene Van Gogh?', a: ['Post-impressionismo', 'Cubismo', 'Rinascimento'], correct: 0, exp: 'Van Gogh è associato al post-impressionismo, fine \'800.' },
      { m: 'Arte', q: 'Chi dipinse la Cappella Sistina?', a: ['Michelangelo', 'Leonardo da Vinci', 'Raffaello'], correct: 0, exp: 'Michelangelo affrescò la volta (1508-1512) e il Giudizio Universale.' },
      { m: 'Arte', q: 'Dove si trova il Colosseo?', a: ['Roma', 'Atene', 'Napoli'], correct: 0, exp: 'Il Colosseo è a Roma, costruito nel I secolo d.C.' },
      { m: 'Musica', q: 'Chi compose "Le quattro stagioni"?', a: ['Antonio Vivaldi', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart'], correct: 0, exp: 'Vivaldi, compositore veneziano del periodo barocco.' },
      { m: 'Letteratura', q: 'Chi scrisse "I Promessi Sposi"?', a: ['Alessandro Manzoni', 'Giovanni Verga', 'Italo Calvino'], correct: 0, exp: 'Manzoni, pubblicato nella versione definitiva nel 1840-42.' },
      { m: 'Letteratura', q: 'Chi scrisse "Romeo e Giulietta"?', a: ['William Shakespeare', 'Charles Dickens', 'Oscar Wilde'], correct: 0, exp: 'Shakespeare, tragedia scritta intorno al 1595.' },
      { m: 'Economia', q: 'Cos\'è l\'inflazione?', a: ['L\'aumento generalizzato dei prezzi nel tempo', 'La diminuzione dei prezzi', 'Il tasso di disoccupazione'], correct: 0, exp: 'L\'inflazione riduce il potere d\'acquisto della moneta nel tempo.' },
      { m: 'Economia', q: 'Cos\'è il PIL (prodotto interno lordo)?', a: ['Il valore totale di beni e servizi prodotti in un paese in un anno', 'Il debito pubblico', 'Il tasso di cambio'], correct: 0, exp: 'Indicatore chiave della dimensione economica di un paese.' },
      { m: 'Filosofia', q: 'Chi disse "Penso, dunque sono"?', a: ['René Descartes', 'Platone', 'Immanuel Kant'], correct: 0, exp: '"Cogito ergo sum", fondamento del razionalismo cartesiano.' },
      { m: 'Filosofia', q: 'Chi fu il maestro di Aristotele?', a: ['Platone', 'Socrate', 'Pitagora'], correct: 0, exp: 'Aristotele studiò nell\'Accademia di Platone, che a sua volta fu allievo di Socrate.' },
      { m: 'Matematica', q: 'Qual è la radice quadrata di 144?', a: ['12', '14', '11'], correct: 0, exp: '12 × 12 = 144.' },
      { m: 'Matematica', q: 'Cos\'è un numero primo?', a: ['Divisibile solo per 1 e per sé stesso', 'Un numero pari', 'Un numero negativo'], correct: 0, exp: 'Es. 2, 3, 5, 7, 11... (2 è l\'unico numero primo pari).' },
      { m: 'Geografia', q: 'Quanti fusi orari ha la Russia?', a: ['11', '5', '24'], correct: 0, exp: 'La Russia, il paese più esteso al mondo, attraversa 11 fusi orari.' },
      { m: 'Geografia', q: 'Qual è la nazione più piccola del mondo?', a: ['Città del Vaticano', 'Monaco', 'San Marino'], correct: 0, exp: 'Il Vaticano ha circa 0,49 km², il più piccolo stato sovrano al mondo.' },
      { m: 'Scienza', q: 'Cosa producono i mitocondri nella cellula?', a: ['Energia (ATP)', 'Proteine', 'DNA'], correct: 0, exp: 'I mitocondri sono le "centrali energetiche" della cellula.' },
      { m: 'Scienza', q: 'Qual è la temperatura di ebollizione dell\'acqua a livello del mare?', a: ['100°C', '90°C', '120°C'], correct: 0, exp: '100°C a pressione atmosferica standard (1 atm); cambia con l\'altitudine.' },
      { m: 'Storia', q: 'Chi fu il primo presidente degli Stati Uniti?', a: ['George Washington', 'Abraham Lincoln', 'Thomas Jefferson'], correct: 0, exp: 'Washington, presidente dal 1789 al 1797.' },
      { m: 'Storia', q: 'Cosa fu la Guerra Fredda?', a: ['Il confronto ideologico USA-URSS senza conflitto diretto (1947-1991)', 'Una guerra combattuta nel circolo polare', 'Un conflitto commerciale attuale'], correct: 0, exp: 'Tensione globale tra blocco occidentale (USA/NATO) e blocco sovietico, senza scontro militare diretto.' },
      { m: 'Attualità', q: 'Cos\'è l\'ONU?', a: ['Un\'organizzazione internazionale per pace e cooperazione tra stati', 'Un trattato commerciale europeo', 'Una banca centrale'], correct: 0, exp: 'Organizzazione delle Nazioni Unite, fondata nel 1945 dopo la Seconda Guerra Mondiale.' },
      { m: 'Sport', q: 'Ogni quanti anni si tengono le Olimpiadi estive?', a: ['4 anni', '2 anni', 'Ogni anno'], correct: 0, exp: 'Le Olimpiadi estive e invernali si alternano ogni 2 anni, ciascuna con cadenza quadriennale.' },
      { m: 'Sport', q: 'In quale sport si usa il termine "slam dunk"?', a: ['Basket', 'Tennis', 'Volley'], correct: 0, exp: 'Schiacciata a canestro, gesto atletico tipico del basket.' },
      { m: 'Lingue', q: 'Quante lingue ufficiali ha la Svizzera?', a: ['4 (tedesco, francese, italiano, romancio)', '2', '1'], correct: 0, exp: 'La Svizzera è multilingue: tedesco, francese, italiano e romancio.' },
      { m: 'Curiosità', q: 'Qual è l\'animale terrestre più veloce?', a: ['Il ghepardo', 'Il leone', 'Il cavallo'], correct: 0, exp: 'Il ghepardo può raggiungere circa 100-120 km/h in corsa.' },
      { m: 'Curiosità', q: 'Qual è il mammifero più grande al mondo?', a: ['La balenottera azzurra', 'L\'elefante africano', 'La balena grigia'], correct: 0, exp: 'La balenottera azzurra può superare i 30 metri e 150 tonnellate, il più grande animale mai esistito.' },
      { m: 'Storia', q: 'Chi fu Napoleone Bonaparte?', a: ['Imperatore francese che conquistò gran parte d\'Europa', 'Re d\'Inghilterra', 'Un generale romano'], correct: 0, exp: 'Napoleone si autoproclamò imperatore nel 1804, fu sconfitto definitivamente a Waterloo (1815).' },
      { m: 'Storia', q: 'Cosa fu il Rinascimento?', a: ['Un periodo di rinascita culturale e artistica in Europa (XIV-XVI sec.)', 'Un\'epoca di guerre religiose', 'Il periodo del colonialismo'], correct: 0, exp: 'Iniziato in Italia, riscoprì l\'arte e il pensiero classico: Leonardo, Michelangelo, Raffaello.' },
      { m: 'Storia', q: 'In che anno finì la Seconda Guerra Mondiale?', a: ['1945', '1944', '1950'], correct: 0, exp: '1945: resa della Germania a maggio, del Giappone a settembre.' },
      { m: 'Storia', q: 'Chi fu Cleopatra?', a: ['L\'ultima regina dell\'Egitto tolemaico', 'Una regina romana', 'Una dea egizia'], correct: 0, exp: 'Cleopatra VII, alleata prima di Cesare poi di Marco Antonio, morì nel 30 a.C.' },
      { m: 'Geografia', q: 'Qual è la capitale del Giappone?', a: ['Tokyo', 'Kyoto', 'Osaka'], correct: 0, exp: 'Tokyo è la capitale dal 1868; Kyoto fu capitale storica per secoli prima.' },
      { m: 'Geografia', q: 'Qual è il paese più esteso del mondo?', a: ['Russia', 'Canada', 'Cina'], correct: 0, exp: 'La Russia copre circa 17 milioni di km², più del doppio del Canada (secondo).' },
      { m: 'Geografia', q: 'Su quale continente si trova l\'Egitto?', a: ['Africa', 'Asia', 'Medio Oriente (continente a sé)'], correct: 0, exp: 'L\'Egitto è in Africa nord-orientale, con il Sinai che si estende in Asia.' },
      { m: 'Scienza', q: 'Cos\'è la fotosintesi clorofilliana?', a: ['Il processo con cui le piante producono energia dalla luce', 'La respirazione delle piante', 'La crescita delle radici'], correct: 0, exp: 'Le piante convertono luce, acqua e CO₂ in glucosio e ossigeno.' },
      { m: 'Scienza', q: 'Cos\'è un anticorpo?', a: ['Una proteina del sistema immunitario che riconosce patogeni', 'Un tipo di cellula del sangue', 'Un ormone'], correct: 0, exp: 'Gli anticorpi si legano specificamente a un antigene per neutralizzarlo.' },
      { m: 'Scienza', q: 'Cosa sono le placche tettoniche?', a: ['Grandi blocchi della crosta terrestre in movimento', 'Strati dell\'atmosfera', 'Tipi di rocce vulcaniche'], correct: 0, exp: 'Il loro movimento causa terremoti, vulcani e la formazione di montagne.' },
      { m: 'Scienza', q: 'Cos\'è l\'effetto serra?', a: ['Trattenimento del calore nell\'atmosfera da parte di alcuni gas', 'Il riscaldamento diretto dal sole', 'La rotazione terrestre'], correct: 0, exp: 'CO₂, metano e altri gas trattengono il calore, fenomeno naturale ma amplificato dall\'uomo.' },
      { m: 'Spazio', q: 'Cos\'è una supernova?', a: ['L\'esplosione catastrofica di una stella morente', 'La nascita di una stella', 'Un tipo di galassia'], correct: 0, exp: 'Una supernova può brillare più di un\'intera galassia per un breve periodo.' },
      { m: 'Spazio', q: 'Quanto tempo impiega la luce del Sole a raggiungere la Terra?', a: ['Circa 8 minuti', 'Istantaneamente', 'Circa 1 ora'], correct: 0, exp: 'La luce viaggia a ~300.000 km/s; il Sole è a ~150 milioni di km da noi.' },
      { m: 'Arte', q: 'Chi scolpì il "David"?', a: ['Michelangelo', 'Donatello', 'Bernini'], correct: 0, exp: 'Michelangelo, 1501-1504, oggi alla Galleria dell\'Accademia a Firenze.' },
      { m: 'Arte', q: 'Cos\'è il Cubismo?', a: ['Un movimento artistico che scompone le forme in geometrie', 'Uno stile fotorealistico', 'Un movimento architettonico'], correct: 0, exp: 'Picasso e Braque furono i pionieri, primi \'900.' },
      { m: 'Musica', q: 'Quanti anni visse Mozart?', a: ['35', '56', '70'], correct: 0, exp: 'Mozart morì a soli 35 anni (1756-1791), lasciando comunque un\'opera immensa.' },
      { m: 'Letteratura', q: 'Chi scrisse "1984"?', a: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury'], correct: 0, exp: 'Orwell, pubblicato nel 1949, distopia sul totalitarismo e la sorveglianza.' },
      { m: 'Letteratura', q: 'Chi scrisse "Cent\'anni di solitudine"?', a: ['Gabriel García Márquez', 'Jorge Luis Borges', 'Pablo Neruda'], correct: 0, exp: 'Márquez, premio Nobel, capolavoro del realismo magico latinoamericano.' },
      { m: 'Economia', q: 'Cos\'è la Borsa (mercato azionario)?', a: ['Un mercato dove si comprano/vendono quote di aziende', 'Una banca centrale', 'Un\'agenzia fiscale'], correct: 0, exp: 'Le azioni rappresentano una quota di proprietà di un\'azienda.' },
      { m: 'Economia', q: 'Cos\'è la disoccupazione?', a: ['La percentuale di persone in cerca di lavoro senza trovarlo', 'Il numero di aziende fallite', 'Il tasso di inflazione'], correct: 0, exp: 'Indicatore chiave della salute del mercato del lavoro di un paese.' },
      { m: 'Filosofia', q: 'Cos\'è lo stoicismo?', a: ['Una filosofia che insegna ad accettare ciò che non si può controllare', 'Una religione politeista', 'Una teoria scientifica'], correct: 0, exp: 'Scuola filosofica greco-romana (Seneca, Epitteto, Marco Aurelio) su virtù e autocontrollo.' },
      { m: 'Filosofia', q: 'Chi scrisse "Così parlò Zarathustra"?', a: ['Friedrich Nietzsche', 'Karl Marx', 'Arthur Schopenhauer'], correct: 0, exp: 'Nietzsche, opera filosofica che introduce concetti come l\'oltre-uomo (Übermensch).' },
      { m: 'Matematica', q: 'Cos\'è il teorema di Pitagora?', a: ['a² + b² = c² in un triangolo rettangolo', 'Una formula per l\'area del cerchio', 'Un teorema sui numeri primi'], correct: 0, exp: 'Relazione tra i cateti (a,b) e l\'ipotenusa (c) di un triangolo rettangolo.' },
      { m: 'Matematica', q: 'Quanto fa 7 al quadrato?', a: ['49', '14', '77'], correct: 0, exp: '7² = 7 × 7 = 49.' },
      { m: 'Geografia', q: 'Qual è la vetta più alta del mondo?', a: ['Everest', 'K2', 'Kilimangiaro'], correct: 0, exp: 'L\'Everest, 8.849 metri, sul confine tra Nepal e Tibet.' },
      { m: 'Geografia', q: 'In quale continente si trova il deserto del Gobi?', a: ['Asia', 'Africa', 'Australia'], correct: 0, exp: 'Il Gobi si estende tra Mongolia e Cina settentrionale.' },
      { m: 'Scienza', q: 'Cosa studia la genetica?', a: ['L\'ereditarietà e la variazione dei caratteri biologici', 'Il comportamento animale', 'Le rocce e i minerali'], correct: 0, exp: 'Studia come i geni trasmettono caratteristiche da una generazione all\'altra.' },
      { m: 'Scienza', q: 'Cos\'è un ecosistema?', a: ['Una comunità di organismi che interagiscono col loro ambiente', 'Un tipo di clima', 'Un singolo organismo'], correct: 0, exp: 'Include organismi viventi e componenti non viventi (acqua, suolo, clima) in interazione.' },
      { m: 'Attualità', q: 'Cos\'è il cambiamento climatico?', a: ['Il riscaldamento globale a lungo termine causato principalmente dall\'uomo', 'Un fenomeno stagionale naturale', 'Un evento meteorologico isolato'], correct: 0, exp: 'Guidato principalmente dalle emissioni di gas serra da attività umane.' },
      { m: 'Attualità', q: 'Cos\'è l\'intelligenza artificiale generativa?', a: ['IA capace di creare nuovi contenuti (testo, immagini)', 'Un tipo di robot fisico', 'Un sistema operativo'], correct: 0, exp: 'Modelli come ChatGPT o Midjourney generano contenuti nuovi basandosi su pattern appresi.' },
      { m: 'Sport', q: 'Quanti giocatori ci sono in una squadra di calcio in campo?', a: ['11', '10', '12'], correct: 0, exp: '11 giocatori per squadra, incluso il portiere.' },
      { m: 'Sport', q: 'In quale paese sono nate le Olimpiadi moderne?', a: ['Grecia (rinate ad Atene nel 1896)', 'Francia', 'Italia'], correct: 0, exp: 'Le Olimpiadi antiche erano greche; quelle moderne rinacquero ad Atene nel 1896.' },
      { m: 'Lingue', q: 'Da quale lingua deriva la maggior parte del vocabolario italiano?', a: ['Il latino', 'Il greco antico', 'Il francese'], correct: 0, exp: 'L\'italiano è una lingua romanza, evoluta direttamente dal latino volgare.' },
      { m: 'Curiosità', q: 'Quanto dura in media la gestazione di un elefante?', a: ['Circa 22 mesi', 'Circa 9 mesi', 'Circa 12 mesi'], correct: 0, exp: 'La più lunga gestazione tra i mammiferi terrestri, circa 22 mesi.' },
      { m: 'Curiosità', q: 'Qual è il metallo più abbondante nella crosta terrestre?', a: ['Alluminio', 'Ferro', 'Rame'], correct: 0, exp: 'L\'alluminio è il metallo più abbondante; il ferro è il più abbondante in assoluto (incluso il nucleo).' },
      { m: 'Curiosità', q: 'Quante ossa ha uno squalo?', a: ['Zero (lo scheletro è cartilagineo)', 'Circa 100', 'Circa 206 come l\'uomo'], correct: 0, exp: 'Gli squali hanno uno scheletro di cartilagine, non di osso.' },
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
      { m: 'Sonno', q: 'La temperatura ideale della camera per dormire bene è circa…', a: ['18-19°C', '24-25°C', 'Non conta'], correct: 0, exp: 'Il corpo deve abbassare la temperatura interna per addormentarsi: una stanza fresca aiuta il processo.' },
      { m: 'Sonno', q: 'Il sonno REM è importante soprattutto per…', a: ['Memoria, apprendimento e regolazione emotiva', 'La crescita muscolare', 'La digestione'], correct: 0, exp: 'Il sonno profondo (non-REM) recupera il corpo; il REM consolida memoria ed elaborazione emotiva.' },
      { m: 'Proteine', q: 'La leucina è importante perché…', a: ['Attiva direttamente la sintesi proteica muscolare (via mTOR)', 'È l\'unico aminoacido essenziale', 'Serve solo per l\'energia'], correct: 0, exp: 'La leucina è il "grilletto" molecolare che avvia la sintesi proteica; carne, uova, whey ne sono ricche.' },
      { m: 'Cardio', q: 'L\'allenamento HIIT rispetto al cardio steady-state…', a: ['Fa risparmiare tempo con benefici cardiovascolari comparabili', 'È sempre superiore in ogni contesto', 'Non ha alcun beneficio metabolico'], correct: 0, exp: 'HIIT (alta intensità a intervalli) è efficiente nel tempo; entrambi gli approcci hanno un ruolo nella programmazione.' },
      { m: 'Forza', q: 'Per la crescita muscolare (ipertrofia), il range di ripetizioni più studiato è…', a: ['6-15 ripetizioni circa, con vicinanza al cedimento', 'Solo 1-3 ripetizioni massimali', 'Solo oltre 30 ripetizioni'], correct: 0, exp: 'Il volume totale e la prossimità al cedimento contano più del range esatto, ma 6-15 è il più efficiente.' },
      { m: 'Integratori', q: 'La <b>vitamina D</b> si comporta più come…', a: ['Un ormone, con recettori in quasi tutti i tessuti', 'Solo una vitamina per le ossa', 'Un elettrolita'], correct: 0, exp: 'La vitamina D regola centinaia di geni; la carenza è associata a molti esiti negativi oltre le ossa.' },
      { m: 'Integratori', q: 'Gli <b>omega-3</b> (EPA/DHA) sono associati principalmente a…', a: ['Salute cardiovascolare e riduzione dell\'infiammazione', 'Aumento della massa muscolare', 'Miglioramento della vista notturna'], correct: 0, exp: 'Pesce grasso o integratori: EPA/DHA modulano l\'infiammazione sistemica.' },
      { m: 'Integratori', q: 'Il <b>magnesio</b> è coinvolto in circa…', a: ['300+ reazioni enzimatiche nel corpo', '10 reazioni enzimatiche', 'Nessuna reazione diretta, solo trasporto'], correct: 0, exp: 'Magnesio: sonno, funzione muscolare, glicemia, pressione — un minerale centrale e spesso carente.' },
      { m: 'Stress', q: 'Il <b>cortisolo cronicamente elevato</b> è associato a…', a: ['Accumulo di grasso addominale e peggior recupero', 'Aumento della massa muscolare', 'Miglior qualità del sonno'], correct: 0, exp: 'Lo stress cronico mantiene il cortisolo alto, con effetti negativi su composizione corporea e recupero.' },
      { m: 'Digiuno', q: 'Il <b>digiuno intermittente</b> funziona principalmente perché…', a: ['Spesso riduce l\'introito calorico complessivo', 'Ha un effetto metabolico magico indipendente dalle calorie', 'Aumenta il metabolismo basale del 50%'], correct: 0, exp: 'La finestra ristretta spesso porta a mangiare meno in totale: l\'effetto principale resta il deficit calorico.' },
      { m: 'Idratazione', q: 'Una disidratazione anche lieve (2% del peso corporeo) può…', a: ['Ridurre performance fisica e cognitiva', 'Non avere alcun effetto misurabile', 'Migliorare la concentrazione'], correct: 0, exp: 'Studi mostrano cali di forza, resistenza e attenzione già con disidratazione lieve.' },
      { m: 'Postura', q: 'Stare seduti troppo a lungo è un fattore di rischio indipendente da…', a: ['Quanto ci si allena nel resto della giornata', 'Nient\'altro, l\'esercizio compensa sempre tutto', 'La dieta'], correct: 0, exp: 'La sedentarietà prolungata ha effetti negativi propri, anche in chi si allena regolarmente ("active couch potato").' },
      { m: 'Invecchiamento', q: 'La <b>sarcopenia</b> è…', a: ['La perdita di massa e forza muscolare legata all\'età', 'Una malattia delle ossa', 'Un tipo di artrite'], correct: 0, exp: 'Inizia già dai 30-40 anni se non contrastata con allenamento di forza e proteine adeguate.' },
      { m: 'Cuore', q: 'Il colesterolo <b>LDL</b> è spesso chiamato…', a: ['Colesterolo "cattivo" (associato a rischio cardiovascolare)', 'Colesterolo "buono"', 'Un ormone'], correct: 0, exp: 'HDL è considerato protettivo; LDL alto è un fattore di rischio per malattie cardiovascolari.' },
      { m: 'Cervello', q: 'L\'esercizio fisico regolare è associato a…', a: ['Maggiore neuroplasticità e funzione cognitiva', 'Nessun effetto sul cervello', 'Riduzione della memoria a breve termine'], correct: 0, exp: 'L\'attività aerobica aumenta il BDNF, un fattore che favorisce la crescita di nuove connessioni neurali.' },
      { m: 'Infiammazione', q: 'Gli zuccheri raffinati in eccesso sono associati a…', a: ['Infiammazione cronica di basso grado', 'Riduzione dell\'infiammazione', 'Nessun effetto sull\'infiammazione'], correct: 0, exp: 'Un consumo cronico elevato di zuccheri semplici è collegato a marker infiammatori più alti.' },
      { m: 'Ormoni', q: 'Il testosterone tende a diminuire naturalmente…', a: ['Con l\'età, a partire circa dai 30 anni', 'Non cambia mai con l\'età', 'Aumenta sempre con l\'età'], correct: 0, exp: 'Cala gradualmente (~1%/anno dopo i 30), influenzato anche da sonno, stress, grasso corporeo.' },
      { m: 'Alcol', q: 'L\'alcol, anche in quantità moderate, ha un impatto negativo su…', a: ['Qualità del sonno profondo e recupero', 'Solo il fegato, nient\'altro', 'Nessun sistema se bevuto la sera'], correct: 0, exp: 'Anche una quantità moderata riduce il sonno REM/profondo, indipendentemente da quanto ci si sente "addormentati".' },
      { m: 'Postura/Mobilità', q: 'Lo <b>stretching statico prima</b> di un allenamento di forza intenso può…', a: ['Ridurre temporaneamente la forza massimale', 'Aumentare sempre la performance', 'Prevenire tutti gli infortuni'], correct: 0, exp: 'Meglio un riscaldamento dinamico prima, stretching statico dopo o in sessioni separate.' },
      { m: 'Digestione', q: 'La fibra alimentare aiuta soprattutto perché…', a: ['Nutre il microbioma e regola la glicemia post-pasto', 'Fornisce molte calorie', 'Sostituisce le proteine'], correct: 0, exp: 'La fibra fermentabile nutre i batteri intestinali benefici e rallenta l\'assorbimento degli zuccheri.' },
      { m: 'Sole', q: 'L\'esposizione solare moderata (senza scottarsi) è utile principalmente per…', a: ['Sintesi di vitamina D e regolazione del ritmo circadiano', 'Abbronzatura estetica soltanto', 'Nessun beneficio, solo rischio'], correct: 0, exp: 'La luce solare mattutina regola anche il ritmo circadiano, oltre a produrre vitamina D nella pelle.' },
      { m: 'Recupero', q: 'Il <b>DOMS</b> (dolore muscolare ritardato) indica…', a: ['Microdanno muscolare da un nuovo stimolo, non necessariamente un buon allenamento', 'Che l\'allenamento è stato inutile', 'Un infortunio grave sempre'], correct: 0, exp: 'Il DOMS non è un indicatore affidabile di efficacia: si può crescere anche senza grande indolenzimento.' },
      { m: 'Grassi', q: 'I grassi monoinsaturi (es. olio d\'oliva, avocado) sono associati a…', a: ['Miglior profilo lipidico e salute cardiovascolare', 'Aumento del colesterolo cattivo', 'Nessun beneficio rispetto ai grassi saturi'], correct: 0, exp: 'La dieta mediterranea, ricca di grassi monoinsaturi, è tra le più studiate per la salute cardiovascolare.' },
      { m: 'Sonno', q: 'La luce blu di schermi la sera ritarda il sonno principalmente perché…', a: ['Sopprime la produzione di melatonina', 'Riscalda gli occhi', 'Aumenta il battito cardiaco'], correct: 0, exp: 'La luce blu (schermi, LED) inganna il cervello facendogli credere che sia ancora giorno, ritardando la melatonina.' },
      { m: 'Sonno', q: 'Dormire in un ambiente completamente buio aiuta perché…', a: ['Anche piccole quantità di luce possono disturbare il sonno profondo', 'Il buio non ha alcun effetto sul sonno', 'Serve solo per abitudine'], correct: 0, exp: 'Anche luci deboli (es. standby elettronici) possono ridurre la qualità del sonno in alcuni soggetti.' },
      { m: 'Proteine', q: 'Le proteine complete contengono…', a: ['Tutti e 9 gli aminoacidi essenziali in quantità adeguate', 'Solo aminoacidi non essenziali', 'Solo leucina'], correct: 0, exp: 'Carne, uova, latticini, soia sono fonti proteiche complete; molti vegetali sono parziali (vanno combinati).' },
      { m: 'Proteine', q: 'Distribuire le proteine in <b>più pasti</b> nella giornata (vs. concentrarle in uno) tende a…', a: ['Massimizzare meglio la sintesi proteica nell\'arco delle 24h', 'Non fare alcuna differenza', 'Essere sempre peggio'], correct: 0, exp: 'La sintesi proteica ha una finestra limitata per pasto: distribuire l\'introito è generalmente più efficiente.' },
      { m: 'Cardio', q: 'Il <b>VO2max</b> misura…', a: ['La capacità massima di consumo di ossigeno durante sforzo', 'La frequenza cardiaca a riposo', 'La pressione sanguigna massima'], correct: 0, exp: 'Indicatore chiave di fitness cardiorespiratoria e longevità, migliorabile con allenamento aerobico.' },
      { m: 'Cardio', q: 'La frequenza cardiaca a riposo bassa (in un atleta allenato) indica generalmente…', a: ['Un cuore efficiente che pompa più sangue per battito', 'Un problema cardiaco', 'Scarsa forma fisica'], correct: 0, exp: 'L\'allenamento aerobico aumenta la gittata sistolica, riducendo i battiti necessari a riposo.' },
      { m: 'Forza', q: 'Il <b>sovraccarico progressivo</b> è il principio secondo cui…', a: ['Bisogna aumentare gradualmente lo stimolo per continuare a progredire', 'Bisogna sempre usare lo stesso peso', 'Più riposo è sempre meglio'], correct: 0, exp: 'Senza aumentare gradualmente carico/volume/intensità, il corpo smette di adattarsi.' },
      { m: 'Forza', q: 'L\'allenamento della forza nell\'anziano è associato a…', a: ['Riduzione del rischio di cadute e mantenimento dell\'autonomia', 'Nessun beneficio dopo i 65 anni', 'Aumento del rischio di fratture'], correct: 0, exp: 'Contrasta la sarcopenia e migliora equilibrio, forza funzionale e qualità di vita.' },
      { m: 'Integratori', q: 'La <b>vitamina C</b> aiuta l\'assorbimento di…', a: ['Ferro non-eme (di origine vegetale)', 'Calcio', 'Vitamina D'], correct: 0, exp: 'Abbinare fonti di vitamina C (agrumi, peperoni) a legumi/cereali migliora l\'assorbimento del ferro.' },
      { m: 'Integratori', q: 'Lo <b>zinco</b> è coinvolto in…', a: ['Sistema immunitario e sintesi proteica/ormonale', 'Solo nella vista', 'Solo nella coagulazione'], correct: 0, exp: 'Lo zinco è cofattore in centinaia di enzimi; la carenza può indebolire le difese immunitarie.' },
      { m: 'Stress', q: 'La meditazione/mindfulness regolare è associata a…', a: ['Riduzione misurabile dei livelli di cortisolo e stress percepito', 'Nessun effetto fisiologico misurabile', 'Aumento dell\'ansia'], correct: 0, exp: 'Studi con MRI mostrano anche cambiamenti strutturali in aree cerebrali legate a stress ed emozioni.' },
      { m: 'Digiuno', q: 'Il digiuno prolungato (oltre 24-48h) richiede…', a: ['Cautela e supervisione, specie per alcune condizioni di salute', 'Nessuna precauzione particolare', 'È sempre sicuro per chiunque'], correct: 0, exp: 'A differenza del digiuno intermittente breve, digiuni lunghi hanno rischi maggiori e vanno gestiti con attenzione.' },
      { m: 'Postura', q: 'Una scrivania regolabile in piedi (standing desk) usata TUTTO il giorno…', a: ['Non è necessariamente meglio: serve alternanza, non stare fermi in piedi', 'Elimina tutti i rischi della sedentarietà', 'È sempre peggio di stare seduti'], correct: 0, exp: 'La chiave è il movimento e l\'alternanza di posizioni, non sostituire una postura statica con un\'altra.' },
      { m: 'Cuore', q: 'La pressione arteriosa "normale" di riferimento è circa…', a: ['120/80 mmHg', '140/100 mmHg', '90/50 mmHg sempre ottimale'], correct: 0, exp: '120/80 è il riferimento classico; valori persistentemente più alti aumentano il rischio cardiovascolare.' },
      { m: 'Cervello', q: 'Il <b>digital detox</b> (pause dagli schermi) è associato a…', a: ['Miglior umore e concentrazione in molti studi', 'Nessun beneficio misurabile mai', 'Peggioramento della memoria'], correct: 0, exp: 'L\'uso eccessivo di social/schermi è correlato a peggior benessere soggettivo in diversi studi osservazionali.' },
      { m: 'Infiammazione', q: 'Il <b>digiuno intermittente</b> e la restrizione calorica moderata sono studiati anche per…', a: ['Possibili effetti su longevità e marker infiammatori', 'Aumentare sempre la massa muscolare', 'Curare qualsiasi malattia'], correct: 0, exp: 'La ricerca su restrizione calorica e longevità è promettente ma non definitiva sull\'uomo.' },
      { m: 'Ormoni', q: 'Il sonno insufficiente cronico è collegato a…', a: ['Alterazione di leptina e grelina (ormoni della fame), più fame', 'Nessun effetto sull\'appetito', 'Riduzione dell\'appetito'], correct: 0, exp: 'Poco sonno abbassa la leptina (sazietà) e alza la grelina (fame), favorendo la sovralimentazione.' },
      { m: 'Postura/Mobilità', q: 'La mobilità articolare (es. anche, spalle) tende a…', a: ['Peggiorare con la sedentarietà se non allenata attivamente', 'Rimanere sempre costante senza lavoro dedicato', 'Migliorare da sola col solo passare del tempo'], correct: 0, exp: '"Use it or lose it": la mobilità richiede movimento regolare a range completo per mantenersi.' },
      { m: 'Digestione', q: 'I probiotici (integratori) sono più utili quando…', a: ['Usati in contesti specifici (es. dopo antibiotici), non come panacea generale', 'Servono sempre a tutti indistintamente', 'Non hanno mai alcun effetto'], correct: 0, exp: 'L\'evidenza è più solida per ceppi/contesti specifici che per un uso generico "per la salute".' },
      { m: 'Sole', q: 'L\'uso di protezione solare (SPF) sul viso quotidianamente aiuta a…', a: ['Prevenire il photoaging (invecchiamento cutaneo da UV)', 'Bloccare completamente la vitamina D sempre', 'Non ha alcun effetto sulla pelle'], correct: 0, exp: 'I raggi UVA penetrano anche con cielo nuvoloso e contribuiscono all\'invecchiamento cutaneo nel tempo.' },
      { m: 'Recupero', q: 'Il <b>riposo attivo</b> (movimento leggero) tra sessioni intense può…', a: ['Favorire il recupero rispetto al riposo totale immobile', 'Peggiorare sempre il recupero', 'Essere identico al riposo completo'], correct: 0, exp: 'Movimento leggero (camminata, mobilità) favorisce il flusso sanguigno e lo smaltimento di metaboliti.' },
      { m: 'Metabolismo', q: 'Il <b>NEAT</b> (Non-Exercise Activity Thermogenesis) indica…', a: ['Le calorie bruciate con attività quotidiane non strutturate (camminare, stare in piedi)', 'Solo le calorie bruciate in palestra', 'Il metabolismo basale a riposo assoluto'], correct: 0, exp: 'Il NEAT può variare enormemente tra persone e spiega gran parte della differenza nel dispendio calorico totale.' },
      { m: 'Longevità', q: 'I "Blue Zones" (zone blu) sono regioni del mondo note per…', a: ['Un\'alta concentrazione di persone che vivono oltre i 100 anni', 'Il clima più freddo del pianeta', 'La maggiore densità di popolazione'], correct: 0, exp: 'Okinawa, Sardegna, Ikaria... aree studiate per stili di vita associati a longevità eccezionale.' },
      { m: 'Sonno', q: 'Il "jet lag sociale" indica…', a: ['Il disallineamento tra orari di sonno nei giorni feriali e nel weekend', 'Il fuso orario dei viaggi aerei', 'L\'insonnia cronica'], correct: 0, exp: 'Dormire molto diverso tra settimana e weekend confonde l\'orologio biologico, simile a un jet lag.' },
      { m: 'Sonno', q: 'I sonnellini (power nap) ideali per non disturbare il sonno notturno durano circa…', a: ['10-20 minuti', '2-3 ore', 'Tutto il pomeriggio'], correct: 0, exp: 'Nap brevi evitano di entrare in sonno profondo, da cui è difficile risvegliarsi senza "sonnolenza da inerzia".' },
      { m: 'Proteine', q: 'Le fonti proteiche vegetali (legumi, tofu) rispetto a quelle animali…', a: ['Possono coprire il fabbisogno se variate e in quantità adeguata', 'Sono sempre insufficienti per la massa muscolare', 'Contengono più proteine a parità di peso'], correct: 0, exp: 'Con pianificazione (variare fonti, quantità maggiori), una dieta vegetale può soddisfare il fabbisogno proteico.' },
      { m: 'Cardio', q: 'La "zona 2" di allenamento corrisponde a un\'intensità in cui…', a: ['Si riesce ancora a parlare con relativa facilità', 'Ci si sente al massimo sforzo', 'Il battito supera il 95% del massimale'], correct: 0, exp: 'Zona 2: intensità conversazionale, base per costruire capacità aerobica senza affaticamento eccessivo.' },
      { m: 'Forza', q: 'Il riscaldamento specifico prima di sollevare pesi pesanti serve principalmente a…', a: ['Preparare articolazioni/sistema nervoso al carico specifico', 'Bruciare più calorie durante la sessione', 'Sostituire lo stretching'], correct: 0, exp: 'Serie progressive con carichi crescenti preparano il corpo al peso di lavoro, riducendo il rischio infortuni.' },
      { m: 'Integratori', q: 'La <b>caffeina</b> come ausilio ergogenico è più efficace se assunta…', a: ['30-60 minuti prima dell\'attività fisica', 'Subito dopo l\'allenamento', 'Solo la sera'], correct: 0, exp: 'Il picco plasmatico della caffeina si raggiunge dopo 30-60 minuti, ideale per la performance.' },
      { m: 'Integratori', q: 'Il <b>ferro</b> è particolarmente rilevante per…', a: ['Il trasporto di ossigeno, specie in atlete/donne con mestruazioni abbondanti', 'La sola funzione visiva', 'Il sonno'], correct: 0, exp: 'Il ferro è componente dell\'emoglobina; la carenza (anemia) causa stanchezza e riduce la performance.' },
      { m: 'Stress', q: 'La respirazione diaframmatica lenta attiva…', a: ['Il sistema nervoso parasimpatico ("riposa e digerisci")', 'Solo il sistema muscolare delle gambe', 'Il sistema digestivo esclusivamente'], correct: 0, exp: 'Respirare lentamente dal diaframma stimola il nervo vago, abbassando stress e frequenza cardiaca.' },
      { m: 'Postura', q: 'Il "text neck" (collo da smartphone) è causato da…', a: ['Tenere il collo flesso in avanti a lungo guardando il telefono', 'Dormire troppo', 'Bere poca acqua'], correct: 0, exp: 'La flessione prolungata del collo aumenta il carico sulla colonna cervicale, causando tensione/dolore.' },
      { m: 'Cuore', q: 'La variabilità della frequenza cardiaca (<b>HRV</b>) più alta è generalmente associata a…', a: ['Miglior capacità di recupero e adattamento allo stress', 'Peggiore salute cardiovascolare', 'Nessuna informazione utile'], correct: 0, exp: 'Un\'HRV più alta riflette un sistema nervoso autonomo flessibile e ben recuperato.' },
      { m: 'Cervello', q: 'L\'apprendimento di una nuova abilità (es. musica, lingua) in età adulta…', a: ['Favorisce la neuroplasticità a qualsiasi età', 'È impossibile dopo i 25 anni', 'Non ha effetti sul cervello'], correct: 0, exp: 'Il cervello mantiene capacità plastiche per tutta la vita, anche se con qualche differenza rispetto all\'infanzia.' },
      { m: 'Infiammazione', q: 'Gli acidi grassi omega-6 in eccesso rispetto agli omega-3 sono associati a…', a: ['Un profilo più pro-infiammatorio', 'Riduzione dell\'infiammazione', 'Nessun effetto sull\'equilibrio infiammatorio'], correct: 0, exp: 'Il rapporto omega-6/omega-3 nella dieta moderna è spesso sbilanciato verso il pro-infiammatorio.' },
      { m: 'Ormoni', q: 'L\'esposizione a luce intensa la sera (es. locali illuminati) può…', a: ['Ritardare il rilascio di melatonina', 'Non avere alcun effetto ormonale', 'Anticipare il sonno'], correct: 0, exp: 'Come gli schermi, anche luci ambientali intense la sera possono disturbare l\'orologio biologico.' },
      { m: 'Digestione', q: 'Mangiare lentamente e masticare bene favorisce…', a: ['Miglior digestione e maggior senso di sazietà', 'Solo un piacere estetico, nessun effetto reale', 'Peggior assorbimento dei nutrienti'], correct: 0, exp: 'Ci vogliono ~20 minuti perché i segnali di sazietà raggiungano il cervello: mangiare in fretta porta a mangiare troppo.' },
      { m: 'Metabolismo', q: 'Il "metabolismo lento" come causa di sovrappeso è…', a: ['Raramente la causa principale, spesso sovrastimata', 'Sempre la causa principale del sovrappeso', 'Impossibile da misurare in ogni caso'], correct: 0, exp: 'Le differenze metaboliche tra individui esistono ma sono spesso meno determinanti dell\'introito calorico totale.' },
      { m: 'Esercizio', q: 'L\'allenamento di forza nelle donne…', a: ['Non porta a un\'ipertrofia eccessiva per ragioni ormonali (meno testosterone)', 'Rende sempre "troppo muscolose"', 'È sconsigliato per motivi di salute'], correct: 0, exp: 'Un mito comune: i livelli ormonali femminili rendono l\'ipertrofia estrema molto più difficile da raggiungere.' },
      { m: 'Sonno', q: 'La caffeina blocca principalmente…', a: ['I recettori dell\'adenosina, la molecola che dà sonnolenza', 'La produzione di melatonina direttamente', 'Il battito cardiaco'], correct: 0, exp: 'L\'adenosina si accumula durante il giorno inducendo sonnolenza; la caffeina ne blocca i recettori temporaneamente.' },
      { m: 'Longevità', q: 'L\'attività fisica regolare è associata a una riduzione della mortalità per tutte le cause di circa…', a: ['20-30% o più, a seconda della dose', 'Solo 1-2%, effetto trascurabile', 'Nessun effetto misurabile'], correct: 0, exp: 'Numerosi studi di coorte mostrano riduzioni sostanziali di mortalità associate all\'attività fisica regolare.' },
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

const gateProg = (s, g) => {
  const p = s.prog[g] || (s.prog[g] = { idx: 0, correct: 0, total: 0, done: 0 });
  if (!Array.isArray(p.mastered)) p.mastered = []; // qid azzeccati almeno una volta: esclusi dalla rotazione finché non li sbagli
  return p;
};
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
    // POOL ESAURITO: non ripescare le domande già azzeccate (mastered) — solo
    // quelle mai padroneggiate o tornate in gioco perché sbagliate di nuovo.
    // Se le hai padroneggiate TUTTE, allora sì, si ricomincia a girare (non c'è
    // altro da mostrare), ma evitando comunque le ultime servite di recente.
    const recent = Array.isArray(p.recent) ? p.recent : [];
    const mastered = p.mastered;
    const unmastered = [...Array(len).keys()].filter((i) => !mastered.includes(i));
    const base = unmastered.length ? unmastered : [...Array(len).keys()];
    const fresh = base.filter((i) => !recent.includes(i));
    const pool = fresh.length ? fresh : base;
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
  // Mastered: giusta → esce dalla rotazione casuale; sbagliata → ci rientra
  // (oltre al ripasso SRS ravvicinato gestito sotto).
  if (correct) { if (!p.mastered.includes(qid)) p.mastered.push(qid); }
  else { const mi = p.mastered.indexOf(qid); if (mi >= 0) p.mastered.splice(mi, 1); }
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

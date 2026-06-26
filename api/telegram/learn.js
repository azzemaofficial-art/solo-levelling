// ─────────────────────────────────────────────────────────────────────────────
//  Gate della Conoscenza — Fase 2: multi-Gate + SRS (ripasso spaziato) + Boss.
//  Logica pura (niente I/O). Persistenza KV e invio Telegram in webhook.js.
// ─────────────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'];
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
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
};

export const GATE_IDS = Object.keys(GATES);
export const levelOf = (xp) => Math.floor((xp || 0) / 100) + 1;
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

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

function renderQ(gate, qid, { review = false, boss = false, n = 0, of = 0 } = {}) {
  const G = GATES[gate], q = G.course[qid];
  const tag = boss ? `🐉 <b>BOSS</b> ${n}/${of}` : review ? '🔁 <b>Ripasso</b>' : `Domanda ${qid + 1}/${G.course.length}`;
  const text = `${G.emoji} <b>${G.name}</b> · <i>${q.m}</i>\n${tag}\n\n${q.q}\n\n` + q.a.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n');
  const prefix = boss ? 'bq' : 'lq';
  const inline_keyboard = [q.a.map((_, i) => ({ text: LETTERS[i], callback_data: `${prefix}|${gate}|${qid}|${i}` }))];
  return { gate, qid, text, keyboard: { inline_keyboard } };
}

// Prossima domanda normale: prima un ripasso SRS scaduto, altrimenti avanti nel gate
export function nextQuestion(state, gateOverride) {
  const s = normalize(state);
  const due = s.srs.find((it) => it.due <= today() && GATES[it.gate]);
  if (due) return { ...renderQ(due.gate, due.qid, { review: true }), review: true };
  const gate = gateOverride && GATES[gateOverride] ? gateOverride : s.activeGate;
  const qid = (gateProg(s, gate).idx || 0) % GATES[gate].course.length;
  return { ...renderQ(gate, qid, {}), review: false };
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
  if (!wasReview) { p.idx = (p.idx || 0) + 1; p.done = Math.min(GATES[gate].course.length, (p.done || 0) + 1); }
  srsUpdate(s, gate, qid, correct);
  const d = today(); if (s.lastDay !== d) { s.streak = (s.streak || 0) + 1; s.lastDay = d; }
  s.pending = null;
  return { ok: true, correct, exp: `${q.exp}${correct ? '' : ` (Giusta: ${LETTERS[q.correct]})`}`, xpGained, review: wasReview, state: s };
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
  return { inline_keyboard: [GATE_IDS.map((g) => ({ text: `${GATES[g].emoji} ${GATES[g].name}`, callback_data: `lg|${g}` }))] };
}

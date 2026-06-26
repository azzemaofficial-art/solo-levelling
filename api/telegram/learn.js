// ─────────────────────────────────────────────────────────────────────────────
//  Gate della Conoscenza — corso "Programmazione + IA" (quiz-first, stile corso)
//  Logica pura (niente I/O): curriculum + grading + rendering. La persistenza KV
//  e l'invio Telegram stanno in webhook.js.
// ─────────────────────────────────────────────────────────────────────────────

export const GATE = { id: 'prog-ia', name: 'Programmazione + IA', emoji: '🟩' };

// Corso strutturato in moduli, in ordine. Ogni domanda: { m, q, a[], correct, exp }
export const COURSE = [
  // ── Modulo 1 — Fondamenti di programmazione ──
  { m: 'Fondamenti', q: 'A cosa serve una <b>variabile</b>?', a: ['Memorizzare un valore riutilizzabile', 'Spegnere il programma', 'Disegnare a schermo'], correct: 0, exp: 'Una variabile è un contenitore con un nome che memorizza un valore (numero, testo, ecc.) per riusarlo.' },
  { m: 'Fondamenti', q: 'Cosa fa un <b>ciclo (loop)</b>?', a: ['Ripete istruzioni più volte', 'Cancella i file', 'Crea una variabile'], correct: 0, exp: 'Un loop (for/while) ripete un blocco di codice finché una condizione è vera — evita di scrivere lo stesso codice N volte.' },
  { m: 'Fondamenti', q: 'Una <b>funzione</b> serve a…', a: ['Raggruppare codice riutilizzabile in un blocco con un nome', 'Aumentare la RAM', 'Colorare il testo'], correct: 0, exp: 'Una funzione impacchetta una logica sotto un nome: la richiami quando vuoi, anche con input diversi (parametri).' },
  { m: 'Fondamenti', q: 'In <code>if (x &gt; 10)</code> cosa rappresenta <code>x &gt; 10</code>?', a: ['Una condizione (vero/falso)', 'Una variabile', 'Un commento'], correct: 0, exp: 'È una condizione booleana: vale true o false e decide se eseguire il blocco dentro l\'if.' },
  { m: 'Fondamenti', q: 'Cos\'è un <b>array</b>?', a: ['Una lista ordinata di elementi', 'Un singolo numero', 'Un errore'], correct: 0, exp: 'Un array è una collezione ordinata: [10, 20, 30]. Accedi per indice (parte da 0).' },
  { m: 'Fondamenti', q: 'Cosa significa <b>"bug"</b>?', a: ['Un errore nel codice', 'Una funzione veloce', 'Un tipo di variabile'], correct: 0, exp: 'Un bug è un difetto che fa comportare male il programma. "Debug" = trovarlo e correggerlo.' },

  // ── Modulo 2 — Concetti di IA ──
  { m: 'IA: concetti', q: 'Cos\'è il <b>Machine Learning</b>?', a: ['Imparare schemi dai dati invece di regole scritte a mano', 'Un linguaggio di programmazione', 'Un tipo di computer'], correct: 0, exp: 'Nel ML il modello impara dai dati a fare previsioni, invece di seguire regole programmate esplicitamente.' },
  { m: 'IA: concetti', q: 'Differenza tra <b>training</b> e <b>inference</b>?', a: ['Training = il modello impara; inference = il modello usa ciò che ha imparato', 'Sono sinonimi', 'Inference avviene prima del training'], correct: 0, exp: 'Training è la fase (lenta, costosa) in cui il modello apprende; inference è quando lo usi per rispondere.' },
  { m: 'IA: concetti', q: 'Cos\'è il <b>dataset</b>?', a: ['L\'insieme di dati usati per addestrare/valutare il modello', 'Il codice del modello', 'La GPU'], correct: 0, exp: 'Il dataset è la raccolta di esempi da cui il modello impara. Qualità dei dati = qualità del modello.' },
  { m: 'IA: concetti', q: 'Cos\'è l\'<b>overfitting</b>?', a: ['Il modello memorizza i dati di training e generalizza male sui nuovi', 'Il modello è troppo piccolo', 'Il modello è troppo veloce'], correct: 0, exp: 'Overfitting: impara "a memoria" il training e fallisce su dati nuovi. Si combatte con più dati, regolarizzazione, ecc.' },
  { m: 'IA: concetti', q: 'Una <b>rete neurale</b> è ispirata a…', a: ['I neuroni del cervello', 'I circuiti elettrici delle case', 'I database SQL'], correct: 0, exp: 'È fatta di "neuroni" artificiali in strati che si passano segnali pesati — vagamente ispirati al cervello.' },
  { m: 'IA: concetti', q: 'Cosa NON è vero dell\'IA generativa?', a: ['Capisce sempre la verità con certezza', 'Genera testo/immagini nuove', 'Può sbagliare'], correct: 0, exp: 'L\'IA generativa produce contenuti plausibili ma NON ha una garanzia di verità: va sempre verificata.' },

  // ── Modulo 3 — Come funzionano gli LLM ──
  { m: 'LLM', q: 'Cos\'è un <b>token</b> in un LLM?', a: ['Un pezzo di testo (parola o sotto-parola) che il modello elabora', 'Una password', 'Un file'], correct: 0, exp: 'Gli LLM lavorano a token: parole o frammenti. Costo e limiti si misurano in token, non in caratteri.' },
  { m: 'LLM', q: 'Cosa fa un LLM, in sostanza?', a: ['Predice il token successivo più probabile', 'Cerca su Google', 'Esegue codice'], correct: 0, exp: 'Un LLM genera testo predicendo, un token alla volta, qual è il più probabile dato il contesto.' },
  { m: 'LLM', q: 'Cos\'è la <b>context window</b>?', a: ['Quanto testo il modello può "tenere a mente" in una volta', 'La finestra del browser', 'La velocità della GPU'], correct: 0, exp: 'È il limite di token (input+output) che il modello considera. Oltre, "dimentica" le parti più vecchie.' },
  { m: 'LLM', q: 'Cos\'è un\'<b>allucinazione</b>?', a: ['Quando il modello inventa info false ma plausibili', 'Quando va in crash', 'Quando risponde lento'], correct: 0, exp: 'L\'LLM può produrre affermazioni convincenti ma sbagliate: verifica sempre i fatti importanti.' },
  { m: 'LLM', q: 'La <b>temperature</b> alta rende l\'output…', a: ['Più creativo/vario (ma meno preciso)', 'Più veloce', 'Più corto'], correct: 0, exp: 'Temperature alta = più casualità/creatività; bassa = più deterministico e preciso (utile per JSON/codice).' },
  { m: 'LLM', q: 'Perché stessi prompt danno a volte risposte diverse?', a: ['C\'è casualità nel campionamento dei token', 'Il modello cambia ogni giorno', 'È un bug'], correct: 0, exp: 'Il sampling introduce variabilità (specie con temperature > 0). Per ripetibilità si abbassa la temperature.' },

  // ── Modulo 4 — Prompt engineering ──
  { m: 'Prompt', q: 'Qual è il modo migliore per un buon prompt?', a: ['Essere specifico su compito, contesto e formato di output', 'Scrivere il meno possibile', 'Usare solo emoji'], correct: 0, exp: 'Specificità vince: di\' cosa vuoi, dai contesto e indica il formato (es. "rispondi in JSON con campi x,y").' },
  { m: 'Prompt', q: 'Cos\'è il <b>few-shot prompting</b>?', a: ['Dare alcuni esempi nel prompt per guidare l\'output', 'Usare pochi token', 'Fare poche domande'], correct: 0, exp: 'Few-shot = includi 2-3 esempi input→output. Il modello imita lo schema: spesso migliora molto la qualità.' },
  { m: 'Prompt', q: 'Assegnare un <b>ruolo</b> ("Sei un esperto di…") serve a…', a: ['Orientare tono e competenza della risposta', 'Velocizzare il modello', 'Ridurre i costi'], correct: 0, exp: 'Il ruolo (system prompt) imposta prospettiva e stile: "Sei un nutrizionista preciso…" cambia le risposte.' },
  { m: 'Prompt', q: 'Per ottenere <b>JSON valido</b> conviene…', a: ['Chiedere esplicitamente il formato e mostrarne lo schema', 'Sperare vada bene', 'Alzare la temperature'], correct: 0, exp: 'Specifica lo schema esatto e chiedi "SOLO JSON". Temperature bassa aiuta la struttura.' },
  { m: 'Prompt', q: 'Il <b>chain-of-thought</b> ("ragiona passo passo") aiuta…', a: ['Nei problemi che richiedono ragionamento a step', 'A risparmiare token', 'A generare immagini'], correct: 0, exp: 'Far ragionare il modello a step migliora compiti logici/matematici, al costo di più token.' },
  { m: 'Prompt', q: 'Se la risposta è troppo lunga, cosa chiedi?', a: ['Un vincolo esplicito ("max 3 frasi")', 'Di alzare la temperature', 'Di usare più token'], correct: 0, exp: 'Vincoli espliciti su lunghezza/formato ("massimo 3 punti elenco") controllano l\'output.' },

  // ── Modulo 5 — Programmare con l'IA ──
  { m: 'Coding+IA', q: 'Usando l\'IA per scrivere codice, dovresti sempre…', a: ['Leggere e testare il codice prima di fidarti', 'Copiarlo senza guardare', 'Disattivare i test'], correct: 0, exp: 'L\'IA accelera ma può sbagliare: rivedi e testa. Sei tu responsabile del codice che spedisci.' },
  { m: 'Coding+IA', q: 'Per far correggere un bug all\'IA, cosa dai?', a: ['Il codice + l\'errore esatto + cosa ti aspetti', 'Solo "non funziona"', 'Niente, indovina lei'], correct: 0, exp: 'Contesto preciso = fix preciso: incolla l\'errore, il codice rilevante e il comportamento atteso.' },
  { m: 'Coding+IA', q: 'Qual è un limite reale degli assistenti AI di coding?', a: ['Possono inventare API/funzioni inesistenti', 'Non sanno scrivere testo', 'Funzionano solo offline'], correct: 0, exp: 'Possono "allucinare" metodi che non esistono: verifica nella documentazione reale.' },
  { m: 'Coding+IA', q: 'Modo efficace di lavorare con l\'IA su un progetto?', a: ['Passi piccoli e verificabili, un pezzo alla volta', 'Chiedere tutto in un colpo gigante', 'Mai dare contesto'], correct: 0, exp: 'Iterazioni piccole e testabili battono il "fai tutto": meno errori, più controllo.' },
  { m: 'Coding+IA', q: 'Cos\'è un <b>MCP / tool</b> per un agente AI?', a: ['Uno strumento esterno che l\'IA può usare (es. cercare, leggere file)', 'Un linguaggio nuovo', 'Una GPU'], correct: 0, exp: 'I tool danno "braccia" all\'IA: leggere file, chiamare API, eseguire azioni oltre al solo testo.' },
];

export const TOTAL = COURSE.length;
export const levelOf = (xp) => Math.floor((xp || 0) / 100) + 1;
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
export const rankOf = (state) => RANKS[Math.min(RANKS.length - 1, Math.floor(((state?.done || 0) / TOTAL) * RANKS.length))];

export function initLearn() {
  return { idx: 0, xp: 0, streak: 0, lastDay: '', correct: 0, total: 0, done: 0, pending: null };
}

const today = () => new Date().toISOString().slice(0, 10);

// Costruisce la prossima domanda (in ordine, poi cicla). Non muta lo stato.
export function nextQuestion(state) {
  const qid = (state.idx || 0) % TOTAL;
  const q = COURSE[qid];
  const letters = ['A', 'B', 'C', 'D'];
  const text =
    `${GATE.emoji} <b>${GATE.name}</b> · <i>${q.m}</i>\n` +
    `Domanda ${qid + 1}/${TOTAL}\n\n` +
    `${q.q}\n\n` +
    q.a.map((opt, i) => `${letters[i]}) ${opt}`).join('\n');
  const inline_keyboard = [q.a.map((_, i) => ({ text: letters[i], callback_data: `lq|${qid}|${i}` }))];
  return { qid, text, keyboard: { inline_keyboard } };
}

// Valuta una risposta. Ritorna { ok, correct, exp, xpGained, state } (state aggiornato).
export function gradeAnswer(state, qid, opt) {
  const s = { ...state };
  if (s.pending !== qid) return { ok: false, state: s }; // già risposta o non in attesa
  const q = COURSE[qid];
  const correct = opt === q.correct;
  const xpGained = correct ? 15 : 3;
  s.xp = (s.xp || 0) + xpGained;
  s.total = (s.total || 0) + 1;
  s.done = (s.done || 0) + 1;
  if (correct) s.correct = (s.correct || 0) + 1;
  // streak: +1 al primo quiz di un nuovo giorno
  const d = today();
  if (s.lastDay !== d) { s.streak = (s.streak || 0) + 1; s.lastDay = d; }
  s.idx = (s.idx || 0) + 1;
  s.pending = null;
  const correctLetter = ['A', 'B', 'C', 'D'][q.correct];
  return { ok: true, correct, exp: `${q.exp}${correct ? '' : ` (Giusta: ${correctLetter})`}`, xpGained, state: s };
}

export function progressLine(state) {
  const lvl = levelOf(state.xp);
  const acc = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  return `⚡ Lv ${lvl} · ${state.xp} XP · 🔥 ${state.streak || 0}gg · rank ${rankOf(state)} · ${acc}% giuste`;
}

export function progressCard(state) {
  const lvl = levelOf(state.xp);
  const pct = Math.min(100, Math.round(((state.done || 0) / TOTAL) * 100));
  return (
    `${GATE.emoji} <b>Gate: ${GATE.name}</b>\n\n` +
    `⚡ Livello <b>${lvl}</b> · <b>${state.xp || 0}</b> XP\n` +
    `🔥 Streak: <b>${state.streak || 0}</b> giorni\n` +
    `🎖️ Rank Gate: <b>${rankOf(state)}</b>\n` +
    `📚 Avanzamento corso: <b>${pct}%</b>\n` +
    `🎯 Precisione: <b>${state.total ? Math.round((state.correct / state.total) * 100) : 0}%</b> (${state.correct || 0}/${state.total || 0})\n\n` +
    `Scrivi /quiz per continuare a salire di livello.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIBRERIA TECNICHE — posizioni, prese, combo, proiezioni per disciplina.
// Ogni tecnica ha steps (come si fa) ed errori (cosa NON fare). Si sbloccano
// col grado (stesso gate dei segreti) e si possono portare in sessione live:
// il maestro le insegna guardandoti dalla camera.
// ─────────────────────────────────────────────────────────────────────────────

export const TECHNIQUES = {
  mma: [
    // ── POSIZIONI ──
    { id: 'pos-guardia', name: 'Guardia (in piedi)', cat: 'posizione', lvl: 1,
      steps: ['Piedi larghezza spalle, dominante dietro', 'Ginocchia leggermente flesse, peso sull\'avampiede', 'Mani alte a proteggere il mento, gomiti stretti al corpo', 'Mento basso, sguardo sull\'avversario'],
      errori: ['Mani basse o larghe che scoprono il mento', 'Peso sui talloni: non puoi muoverti'] },
    { id: 'pos-guardia-terra', name: 'Guardia chiusa (a terra)', cat: 'posizione', lvl: 2,
      steps: ['Schiena a terra, gambe attorno alla vita dell\'avversario', 'Caviglie incrociate, ginocchia strette', 'Mani che controllano polsi/collo', 'Anche mobili: mai statico'],
      errori: ['Gambe aperte: l\'avversario passa', 'Braccia distese che si fanno intrappolare'] },
    { id: 'pos-mount', name: 'Mount (monta)', cat: 'posizione', lvl: 2,
      steps: ['Siediti alto sul petto dell\'avversario', 'Ginocchia strette sotto le sue ascelle', 'Piedi agganciati, anche pesanti', 'Mani libere per colpire o controllare'],
      errori: ['Peso troppo avanti: ti ribalta', 'Ginocchia larghe: scivola fuori'] },
    { id: 'pos-side', name: 'Side Control (controllo laterale)', cat: 'posizione', lvl: 2,
      steps: ['Petto contro petto, perpendicolare all\'avversario', 'Peso nelle anche e nel petto, non nelle ginocchia', 'Un braccio sotto il collo, uno sotto il braccio lontano', 'Avanza di mezza posizione a ogni suo respiro'],
      errori: ['Ginocchia a terra che lasciano spazio', 'Testa bassa che prende ginocchiate'] },
    { id: 'pos-back', name: 'Back Control (controllo schiena)', cat: 'posizione', lvl: 3,
      steps: ['Petto contro la sua schiena, fianchi attaccati', 'Hooks dentro con le gambe (piedi a uncino)', 'Seatbelt: un braccio sotto l\'ascella, uno sopra il collo', 'Testa incollata alla sua schiena, segui ogni movimento'],
      errori: ['Incrociare i piedi: li blocca e si gira', 'Hooks superficiali che scivolano'] },

    // ── PRESE ──
    { id: 'pre-underhook', name: 'Underhook (sotto-braccio)', cat: 'presa', lvl: 2,
      steps: ['Passa il braccio sotto l\'ascella dell\'avversario', 'Mano che afferra la sua schiena/spalla', 'Testa dal lato dell\'underhook', 'Stringi il gomito al corpo'],
      errori: ['Testa dal lato sbagliato: prende la schiena', 'Braccio disteso che non controlla'] },
    { id: 'pre-collar', name: 'Collar Tie (presa al collo)', cat: 'presa', lvl: 2,
      steps: ['Mano dietro il collo dell\'avversario', 'Avambraccio che preme sulla clavicola', 'Gomito alto, tira il collo verso il basso', 'Usala per rompere la postura'],
      errori: ['Presa solo con le dita: scivola', 'Tirare senza muovere i piedi'] },
    { id: 'pre-wrist', name: 'Wrist Control (controllo polso)', cat: 'presa', lvl: 3,
      steps: ['Afferra il polso con presa 2-contro-1', 'Tira il polso verso il suo fianco opposto', 'Rompe la sua guardia e apre i colpi', 'Transizione: da qui partono shot e back take'],
      errori: ['Tirare verso di sé invece che di lato', 'Perdere il controllo del corpo'] },
    { id: 'pre-bodylock', name: 'Body Lock (cintura al corpo)', cat: 'presa', lvl: 3,
      steps: ['Braccia attorno alla vita/schiena', 'Mani giunte (gabel o S-grip)', 'Anche basse, testa contro il suo petto', 'Stringi a ogni suo espiro'],
      errori: ['Presa alta sul petto: ti scappa', 'Testa lontana che prende gomitate'] },
    { id: 'pre-overhook', name: 'Overhook (sopra-braccio)', cat: 'presa', lvl: 3,
      steps: ['Passa il braccio sopra il suo braccio', 'Controlla il suo bicipite/tricipite', 'Usalo per difendere e contrattaccare', 'Combina con l\'underhook dall\'altro lato'],
      errori: ['Overhook senza pressione: inutile', 'Lasciare spazio sotto il braccio'] },

    // ── COMBO ──
    { id: 'cmb-12', name: 'Jab-Cross (1-2)', cat: 'combo', lvl: 1,
      steps: ['Jab: pugno guida dritto, rapido, torna subito', 'Cross: pugno potente con rotazione dell\'anca', 'Peso che si trasferisce da dietro a davanti', 'Torna in guardia dopo ogni colpo'],
      errori: ['Jab spinto invece che scattante', 'Cross senza rotazione: solo braccio'] },
    { id: 'cmb-123', name: '1-2-Hook (Jab-Cross-Gancio)', cat: 'combo', lvl: 2,
      steps: ['Jab per aprire la guardia', 'Cross per spostare la sua testa', 'Hook al mento/corpo con rotazione completa', 'Ogni colpo prepara il successivo'],
      errori: ['Hook largo e telegrafato', 'Piedi fermi durante la combo'] },
    { id: 'cmb-12-low', name: '1-2-Low Kick', cat: 'combo', lvl: 2,
      steps: ['Jab-cross per alzare la sua guardia', 'Low kick alla coscia (gamba d\'appoggio)', 'Rotazione dell\'anca nel calcio', 'Torna in guardia subito'],
      errori: ['Calcio senza setup: viene visto', 'Restare sbilanciato dopo il calcio'] },
    { id: 'cmb-jab-shot', name: 'Jab → Level Change → Shot', cat: 'combo', lvl: 2,
      steps: ['Jab per fissare lo sguardo in alto', 'Level change: scendi come per un colpo', 'Shot: entra con double o single leg', 'Testa che guida il cambio di livello'],
      errori: ['Level change senza il jab: ti vede', 'Shot con la testa bassa: ginocchiate'] },
    { id: 'cmb-123-low', name: '1-2-3-Low Kick', cat: 'combo', lvl: 3,
      steps: ['Jab, cross, hook per spostarlo', 'Low kick finale alla gamba carica', 'Fluido: nessun pausa tra i colpi', 'Chiudi in guardia o entra nel clinch'],
      errori: ['Combo a scatti: perdi il ritmo', 'Ultimo colpo senza intenzione'] },

    // ── PROIEZIONI / TAKEDOWN ──
    { id: 'tkd-sprawl', name: 'Sprawl (difesa takedown)', cat: 'proiezione', lvl: 1,
      steps: ['Quando entra, butta le gambe indietro', 'Anche a terra, peso sulle sue spalle', 'Petto che spinge la sua testa/schiena', 'Poi risali e contrattacca'],
      errori: ['Arretrare invece di sprawlare', 'Sprawl senza peso sulle spalle'] },
    { id: 'tkd-double', name: 'Double Leg', cat: 'proiezione', lvl: 2,
      steps: ['Level change + passo dentro', 'Testa contro il suo fianco (mai davanti)', 'Braccia dietro le ginocchia', 'Solleva/spingi e guida a terra'],
      errori: ['Testa davanti: ginocchiate e sprawl', 'Entrare da troppo lontano'] },
    { id: 'tkd-single', name: 'Single Leg', cat: 'proiezione', lvl: 3,
      steps: ['Afferra una gamba sotto il ginocchio', 'Testa contro il suo fianco', 'Solleva la gamba e rompi l\'equilibrio', 'Cammina avanti e porta giù'],
      errori: ['Gamba tenuta lontana dal corpo', 'Non rompere la postura'] },
    { id: 'tkd-ankle', name: 'Ankle Pick', cat: 'proiezione', lvl: 3,
      steps: ['Dal clinch/collar tie, mano alla caviglia', 'Tira la caviglia e spingi la spalla opposta', 'Movimento rapido e a sorpresa', 'Funziona quando il peso è sulla gamba avanti'],
      errori: ['Telegrafare la discesa', 'Tirare senza spingere la spalla'] },
    { id: 'tkd-trip', name: 'Trip (sgambetto)', cat: 'proiezione', lvl: 3,
      steps: ['Dal clinch, piede che aggancia la sua caviglia', 'Rotazione del corpo che lo porta giù', 'Usa anche e spalle, non solo la gamba', 'Combina con una spinta al petto'],
      errori: ['Solo gamba: facile da difendere', 'Perdere il proprio equilibrio'] },
  ],
};

export const CAT_LABEL = {
  posizione: '🧍 Posizioni',
  presa: '🤼 Prese',
  combo: '🥊 Combo',
  proiezione: '🤸 Proiezioni',
};

export function techniquesFor(discipline) {
  return TECHNIQUES[discipline] || [];
}

export function techniquesByCat(discipline) {
  const list = techniquesFor(discipline);
  const byCat = {};
  for (const t of list) {
    if (!byCat[t.cat]) byCat[t.cat] = [];
    byCat[t.cat].push(t);
  }
  return byCat;
}

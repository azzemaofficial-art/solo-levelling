# MMA Coach Studio

Entry: MMA Academy → Coach Studio. The studio is lazy-loaded independently of the legacy multi-discipline Coach. Telegram integration is unchanged.

## Components

- `MmaProCoach.jsx`: setup, calibration, warmup, rounds, rest, pause, report, reflection.
- `MmaTechnique.jsx`: explicitly schematic, step-selectable illustrations; never presented as expert video.
- `useMmaCamera.js`: camera lifecycle, failure handling and throttled frame delivery.
- `mmaPose.worker.js`: pinned MediaPipe 0.10.18, CPU inference in a classic dedicated worker. Keep the worker classic: this version's WASM loader calls `importScripts`, which fails inside a module worker.
- `mmaCoachEngine.js`: browser-independent observation and session state machines.
- `mmaCoachStorage.js`: bounded local history, preserves existing Academy data.

## Observation rules

Confidence threshold 0.65, in-frame upper-body joints; calibration additionally requires both feet, a stable guard and an upright torso for two continuous seconds. Image aspect ratio is applied before angle calculations.

Slow straight punches require a guard, confirmed extension and stable return. A single noisy extension frame cannot count. The anatomical lead arm is selected by the user, independently of mirrored video. A 1–2 requires a lead-to-rear order with temporally separate returns. Lost landmarks, long frame gaps and pauses discard partial gestures.

These are **unvalidated 2D heuristics**, not a professional technique grade. They do not measure fist alignment, impact, power, tactical quality or 3D joint mechanics. Kicks are guided without a technique score; sprawls and clinch use guided mode only.

Frame processing occurs locally. No recording or image uploads. The browser downloads MediaPipe code, WASM and model assets. The studio has no metered AI calls.

## Timing and records

- 3-minute guided warmup unless already warmed up; 5-second preparation.
- Lesson-specific rounds, 60-second rests; short session is 2 × 60 seconds.
- Pause on background, stalled video or sustained tracking loss; explicit resume.
- Report uses actual work and observed time, not elapsed time in setup/rest.
- A session with under 15 seconds of work is not persisted.
- Camera practice is marked only after a completed round, 30 seconds of work, at least 15 seconds observed, and at least 50% coverage.
- Guided practice is labeled as guided and never gets camera metrics.
- Reflections and effort are user-reported; high effort within 48 hours suggests the short session.

## Validation

`node --test tests/mmaCoach.test.js`: calibration, occlusion, image aspect ratio, cycle completion, handedness, ordering, noise, frame gaps, pauses, timers and storage.

Browser checks: model loads and processes a synthetic empty frame in the worker; guided countdown, pause/resume, report and discard; desktop and 390-pixel layouts. No camera permission was granted and no real-person tracking accuracy is claimed. Real-device trials in varied light, framing and stance remain necessary before relaxing detection thresholds.

References are linked in the studio's “Metodo e limiti” panel: England Boxing coaching handbook (basic striking) and Google's Pose Landmarker documentation.

## Coach con camera sulle combo (MmaComboTrainer)

Entry: MMA → Combo → una combo → “Allenala con il coach”. Stesso worker MediaPipe del Coach Studio, ma a ~30 fps (`useMmaCamera(onFrame, { minInterval: 33 })`) e con le coordinate 3D stimate (`worldLandmarks`, metri, origine tra le anche).

- `lib/mmaComboJudge.js`: calibrazione sulla guardia personale (busto, braccia, distanza pugni-naso, rotazione spalle, altezza testa, appoggio piedi); segmentazione di ogni gesto (arto fuori dalla guardia → 150 ms di calma); classificazione in diretto / gancio / montante (anche al corpo), gomito, clinch, ginocchiata, teep, calcio basso/corpo/testa, switch kick, check, schivata, rotolamento, parata, finta, cambio di livello; la mano che cade non è un colpo. `judgeRep` allinea attesi e visti con distanza di modifica e valuta guardia dell’altra mano, distensione, ritorno, rotazione, gomito nel gancio, mani alte nei calci, sbilanciamento, ritmo. “Perfetta” solo senza errori importanti.
- Soglie in `THRESH`: tarate su un atleta sintetico 3D (`tests/helpers/synthFighter.js`) con rumore di 1,5 cm e fotogrammi persi. **Da ritarare con prove reali**: nessuna accuratezza su persone vere è ancora dichiarata.
- Atterramenti (double leg, sprawl) sono guidati, non giudicati. Niente potenza, impatto o precisione millimetrica: una camera sola.
- Replay: si registrano solo i punti del corpo della ripetizione (niente video) e si ridisegnano al rallentatore con i segni sugli errori, accanto al manichino.

## Tracciamento v2 (Coach Studio + combo)

- **Modello adattivo** (`src/workers/mmaPose.worker.js`): parte con `pose_landmarker_lite` su CPU, scarica `pose_landmarker_full` in sottofondo e ci passa solo quando la pagina lo consente (`useMmaCamera(..., { canSwap })`: mai durante un round o una ripetizione). Se il full supera 55 ms di mediana torna al lite e il telefono viene ricordato (`shadow_monarch_pose_lite_only`). GPU esclusa: nei worker il primo `detectForVideo` si bloccava in Chromium headless e non è verificabile su iPhone.
- **Filtro One Euro** (`lib/poseFilter.js`) su punti 2D e 3D: circa −50% di tremolio da fermo, picco di un jab da 100 ms conservato oltre l’80%.
- **Pronto a mani libere** (`lib/mmaReadiness.js`): guardia misurata in 3D, mano dietro coperta accettata (tre quarti), barra che sale in 1,3 s e scende a metà velocità. Suggerimenti vocali: troppo vicino, piedi fuori, di profilo, mani basse. Il Coach Studio parte da solo; se perde il corpo per 2,5 s va in pausa e riparte da solo dopo 1 s che ti rivede.
- **Coach Studio con il giudice 3D**: i colpi delle lezioni non passano più dalla macchina a stati 2D a 12 fps ma da `createComboJudge` a ~30 fps; ogni colpo ha nome, voto e al massimo una correzione vocale ogni 3,5 s (`rateGesture`). Il motore 2D resta come ripiego (`createMmaObserver` senza `external`).
- **Fix camera**: riassegnare lo stesso stream a ogni cambio di stato interrompeva `play()` (AbortError) e lasciava un finto “Tocca il video”, che metteva in pausa la sessione appena partita.
- **Giudice**: un colpo netto che torna in guardia si chiude subito (1-1-2 veloce senza pause = tre colpi); clinch con isteresi di 150 ms; ginocchio del calcio dal secondo valore più alto (un fotogramma rumoroso non trasforma un check in calcio); `abort()` butta via i gesti a metà.

Validazione: `tests/mmaTracking.test.js` (filtro, pronto, 1-1-2 veloce a 15 fps, combo con tremolio di 2 cm filtrato, colpo singolo, abort). End-to-end nel browser con pose sintetiche: partenza senza tocchi, 4 jab e 4 cross contati su 4 e 4, correzione sulla guardia, ripresa automatica dopo l’uscita dall’inquadratura. MediaPipe reale in Chromium: lite → full in circa 2 s, stabile.

## Il coach impara i tuoi colpi (v3, dopo la prima prova su iPhone)

Prova reale (3 ottobre 2026): la guardia bassa non veniva segnalata, nelle combo "non ho visto X" e colpi in più mai fatti.

- **Guardia**: il controllo di partenza (3D, 0,8 busti dal naso) era usato anche in sessione e considerava "in guardia" una mano al petto. Ora la guardia è il pugno sopra la linea della **sua spalla nell'immagine 2D** (`postureOf`, `THRESH.guardDown`); il Coach Studio dice "Mano sinistra/destra su!" dopo 0,7 s di fila (nessun colpo, neanche al corpo, resta giù così a lungo).
- **Colpi non visti / colpi in più**: con la profondità schiacciata come la stima MediaPipe su telefono (atleta sintetico con z × 0,4, rumore 2D e 3D, colpi veloci) le regole fisse riproducono esattamente il problema: 36 mancati e 36 in più su 20 combo di pugni. Rimedi:
  - attivazione anche dallo spostamento 2D del polso rispetto al naso (`THRESH.out2d`), normalizzato sul busto in calibrazione;
  - **insegnamento** (`src/components/MmaTeach.jsx`, `lib/mmaTemplates.js`): 3 esempi per colpo, k-NN con scala per caratteristica dalla varianza dentro il colpo; un gesto lontano da ogni esempio resta `unclear` e non è mai un colpo in più. Sullo stesso test: 0 mancati e 0 in più; controllo incrociato degli esempi al 100%;
  - distensione e rotazione si confrontano con il colpo insegnato (`reachRatio`, `rotRef`), non con soglie 3D assolute che la profondità schiacciata falsa;
  - un colpo partito fino a 0,7 s prima del "via" vale (`judgeRep(..., { since })`); un gesto poco chiaro nel posto di un colpo atteso è "parziale", non "non visto".
- **Dati veri**: le clip (solo 13 punti dello scheletro, niente video, `lib/mmaClips.js`) dell'insegnamento, con consenso, e delle ripetizioni segnalate con "Il coach ha sbagliato" vanno in KV `mma_clips:<chatId>` (ultime 150, 120 giorni) tramite `/api/nvidia/visual` `{ poseClip }`. Servono a ritarare il riconoscimento su movimenti reali.

## Prime clip vere (v4, 4 ottobre 2026)

Tre ripetizioni 1-2 segnalate con "Il coach ha sbagliato" (iPhone, 30 fps, articolazioni visibili al 93–100%, nessun colpo insegnato). Il coach vedeva calci bassi, clinch e ganci: voti 0–11. Le clip si rigiocano offline nel giudice; i test `tests/mmaRealClips.test.js` le usano da `tests/fixtures/private/` (**escluso da git: il repo è pubblico**), altrimenti si saltano.

Cosa mostravano i dati:
- **Calci fantasma**: da fermo MediaPipe vede le due caviglie a 13 cm di altezza diversa; con un solo "pavimento" la gamba dietro risultava sempre sollevata. Ora ogni caviglia ha il suo riferimento (`base.ankleY`).
- **Clinch fantasma**: la guardia reale ha già le braccia avanti in 3D (distensione 0,65–0,75); ora il clinch è relativo alla tua guardia.
- **Colpi tirati verso la camera**: il pugno si avvicina al naso nell'immagine e in 3D la distensione quasi non cambia (0,68 → 0,69, la profondità va perfino al contrario). Segnali tarati sulle clip: spostamento 2D del polso (fermo ≤ 0,10, jab ≥ 0,17 → soglia `move2d` 0,14), allungamento del braccio nell'immagine (`grow2d`) con un riferimento che segue piano la guardia (`refMs`), isteresi per la fine del colpo, rimbalzi < 90 ms scartati, "pugno fermo da 0,2 s = nuova guardia", movimento comune delle due mani = testa/corpo, non pugno.
- **Guardia**: i pugni in guardia stanno sulla linea delle spalle; la mano abbassata è ora relativa alla TUA guardia (0,15 busti sotto) o al petto; la guardia bassa di partenza diventa un consiglio detto una volta.
- **Combo**: si cercano solo gli arti della combo (in una 1-2 i piedi non contano).

Risultato sulle clip vere: senza esempi niente più calci o clinch, 0–2 gesti in più; con i tuoi colpi come esempi (incrociando le clip) 100, 76 e 72: jab e diretto riconosciuti in tutte e tre. Le regole fisse invece restano inaffidabili quando si tira verso la camera, quindi l'insegnamento è il primo passo nel coach delle combo e nelle lezioni di pugni. Durante l'insegnamento un pezzo di colpo (andata o ritorno spezzati) non diventa un esempio (`addTeachSample`).

## v5 (6 ottobre 2026): braccia solo in 2D, insegnamento a comando, telefono di lato

**Cosa hanno mostrato le clip** (28 dell'insegnamento del 5 ottobre più una ripetizione con gli esempi attivi):
- Molti "esempi" della v1 non contenevano nessun colpo: finestre di 1,6 s piatte o con le mani al petto. L'insegnamento prendeva qualsiasi movimento del braccio.
- Con i colpi tirati verso il telefono il 3D è inutilizzabile: il polso del jab "va giù e indietro", e la profondità di un diretto risulta 50 cm lontano dalla camera.
- Nelle rotazioni MediaPipe scambia sinistra e destra e "inventa" braccia aperte a T.
- Video pubblici di pugilato (Wikimedia, pubblico dominio/CC) passati nello stesso MediaPipe confermano il limite: di fronte e da vicino lo scheletro resta fermo sul petto; con luce dura segue l'ombra sul muro.

**Motore 2D** (`lib/mmaStrikes.js`):
- polso rispetto al centro delle spalle, in busti dell'immagine;
- un colpo è il braccio che si sposta (avvio 0,16, fine 0,09) **e si allunga più dell'altro**, perché la mano che para si accorcia;
- guardia di riferimento che segue piano i tuoi aggiustamenti;
- un colpo "va e torna": se la mano resta giù è un cambio di guardia;
- correzione degli scambi sinistra/destra (`unflip`);
- buchi di fotogrammi tollerati;
- gomitate solo se il gomito si muove tanto e il pugno no.

Tarato sulle clip vere: guardia ferma < 0,10, jab 0,19–0,31, diretto 0,44–0,51.

**Giudice:**
- senza esempi un colpo è "del braccio avanti/dietro" (`kind: 'strike'`) e vale come il colpo atteso di quel braccio;
- il tipo (diretto, gancio, montante) lo decidono solo i tuoi esempi;
- niente correzioni 3D sulle braccia (rotazione, gomito, sbilanciamento);
- la mano che scende dritta mentre l'altra colpisce è "l'altra mano è scesa", non un colpo in più;
- nelle combo senza schivate i movimenti della testa non contano.

**Esempi v2** (`lib/mmaTemplates.js`, chiave `_v2`; gli esempi v1 vengono ignorati):
- traiettoria del pugno (16 punti) confrontata con DTW;
- tolleranza ricavata dalla variabilità dei tuoi colpi;
- `cameraCheck`: se jab e diretto si muovono meno di 0,3 nell'immagine, stai colpendo verso il telefono.

**Insegnamento a comando** (`MmaTeach.jsx`):
1. guardia ferma 0,6 s, poi "VAI!";
2. vale il colpo più ampio del braccio giusto partito entro 1,6 s;
3. se hai usato l'altro braccio o il colpo non si è visto, te lo dice e si ripete;
4. barre in diretta per ogni braccio;
5. le clip inviate includono il momento del via.

**Posizione** (`MmaCameraSetup.jsx`): telefono davanti ma a circa 45° dal lato del braccio avanti, a 2–3 m; colpi verso un bersaglio davanti, non verso il telefono.

**Risultati sulle ripetizioni vere**, simulando la chiusura della ripetizione come nel coach e senza esempi: 0→100, 0→84, 6→100. La quarta (rotazioni forti e scambi di lato) resta difficile.

## Gambe in 2D, gesti mostrati e segreto del maestro (21 ottobre 2026)

Nella prova del 20/10 tutte le 1-2 avevano 👎: il coach vedeva calci, ginocchiate e schivate mai fatte (il piede dietro che ruota nel diretto) e non vedeva il calcio basso.

**Gambe** (`lib/mmaLegs.js`, in 2D come le braccia; il 3D delle gambe aveva profondità invertita e lati scambiati):
- riferimento: il piede d'appoggio nell'immagine (telefono fermo), che segue lentamente quando il piede è fermo e basso;
- continuità delle etichette: se le due caviglie (e ginocchia) "si scambiano" da un fotogramma all'altro, si scambiano indietro;
- calcio riconosciuto dalla forma, non dallo spostamento (un passo sposta il piede quanto un calcio): stinco ≥ 55° dalla verticale, coscia ≥ 20°, caviglia veloce, distanza ≥ 0,7 busti; può atterrare avanti;
- ginocchiata (gamba dietro) / check (gamba avanti): coscia ≥ 40°, ginocchio salito, la gamba torna dov'era;
- altezza dalla coscia: basso < 60°, corpo < 115°, alto oltre;
- calcio con la gamba avanti: teep o calcio non si distinguono da una camera (`typeSure: false`), vale come quello chiesto.

**Gesti mostrati** (`visibleGestures`, usato dal giudice, dall'etichetta in diretta e dall'elenco a fine serie): solo gli arti della combo (in una 1-2 niente gambe); niente mano che scende, braccia nel clinch o nella schivata; le braccia che partono durante un calcio (fino a 0,4 s dopo il picco) sono bilanciamento, non pugni. Nell'etichetta in diretta e nel Pro Coach si aspetta la fine del calcio prima di scrivere un colpo di braccio.

**Correzioni**: nel calcio conta la mano dell'altro lato (il braccio del lato che calcia scende a bilanciare, è giusto). Sotto la correzione, una volta per serie per errore, il **segreto del maestro** (`masterSecret`): il perché della correzione (catena del corpo), prima per tecnica, lato e altezza.

**Clip**: 17 articolazioni (talloni e punte 29–32) per misurare in futuro la rotazione del piede dietro; la calibrazione salva il suo elenco (`cal.j`). Le clip a 13 restano leggibili.

**Banco** `node scripts/punch-training/gambe.mjs [--dettagli]` (ripetizioni vere private + BoxingVI): pulite 1→8 su 16; gambe in più 33→0; calci 4/4 (gamba e altezza giuste); BoxingVI 46→0,3 gesti di gamba inventati al minuto. Il banco dei pugni non cambia.

**Provato e scartato**: rotazione del bacino dalla linea anche/spalle nell'immagine. Distingue diretto e jab solo in 2 video BoxingVI su 5 (AUC 0,85–0,95 contro ≈ 0,5) e in 1 serie su 3 delle ripetizioni vere: nessuna correzione "ruota l'anca" finché la misura non è affidabile.

**Revisione** (stesso giorno): un gesto di gamba con la gamba che sparisce si chiude (prima restava acceso e bloccava la fine della ripetizione); nessun gesto oltre 1,8 s; dopo una pausa (VIA, buco, fuori inquadratura) i nomi delle gambe si rileggono dagli appoggi; un braccio "poco chiaro" non vale come calcio.

**Limiti**: soglie del calcio tarate su 4 calci bassi veri; calci al corpo/alti, teep, ginocchiata e check provati solo sull'atleta sintetico.

## Percorso dei segreti: insegna → verifica → promuovi (21 ottobre 2026)

`lib/mmaSecretPath.js` (logica pura, `tests/mmaSecretPath.test.js`):
1. **Insegna**: un segreto alla volta (`masterSecret`, che ora porta anche l'errore da verificare `issue` e la correzione corta `cue`), sullo schermo e a voce.
2. **Verifica**: nelle 3 ripetizioni dopo si guarda lo stesso colpo; senza l'errore in 2 → «Segreto applicato!» e il segreto è imparato; altrimenti «lo riprendiamo più avanti». Una ripetizione in cui quel colpo non c'è (o non è visto) non conta.
3. **Promuovi**: i segreti imparati (salvati sul telefono, chiave `shadow_monarch_mma_secret_path_v1`, così entra nel backup automatico) danno il grado: Prime armi (0), Allievo (2), Combattente (4), Agonista (7), Campione (10). Ogni grado sblocca una mossa segreta con il suo segreto e la combo per allenarla: gancio al fegato (`3b-3`), teep (`teep-1-2`), switch kick (`sw-2`), calcio alla testa (`1-2-hk`).

Grado e mosse segrete compaiono a fine serie. Sulle 16 ripetizioni vere del 20-21/10 il percorso insegna la guardia e il ritorno della mano, li verifica (2 prove pulite) e arriva ad Allievo. Limite: "applicato" non è "padroneggiato": se l'errore torna, torna la correzione corta, ma il segreto resta imparato.

## Laboratorio riflessi, percorso del combattente e allenamento di oggi (21 ottobre 2026)

Obiettivo di Emanuele: un coach che lo guidi dalle prime armi fino a poter fare un primo incontro di MMA dilettanti.

**Laboratorio riflessi** (`lib/mmaReflex.js`, `src/components/MmaReflexLab.jsx`, chiave `shadow_monarch_mma_reflex_v1`).
- Come si svolge:
  - stai fermo in guardia; dopo un'attesa casuale di 1,2–3,2 s lo schermo si colora con un segno;
  - rispondi col colpo giusto oppure resti fermo (✋).
- La partenza si misura per ogni punto del corpo: polsi, ginocchia, caviglie, testa e bacino, in "busti".
  - Il rumore da fermo si misura 600–150 ms prima del segnale.
  - Soglia alta: max(0,06; 2,5 × rumore) per 2 fotogrammi di fila. Poi si torna indietro fino alla soglia bassa e si interpola.
- Il segnale è il rAF in cui il colore appare davvero. Se il telefono dà `captureTime`, si toglie il ritardo della camera (`camLagMs` in `useMmaCamera`).
- Validato su dati sintetici con tremolio da telefono, errore mediano della partenza:
  - jab: +16 ms (contro +80 del motore dei colpi);
  - diretto: +9 ms;
  - calcio basso: +26 ms;
  - schiva e diretto: +19 ms.
- Sulle clip vere le partenze anticipate (passi, rimbalzi) erano frequenti, per questo l'attesa riparte se ti muovi.
- 6 esercizi in ordine, sbloccati uno alla volta. Superato = almeno 8 prove valide, 80% giuste, al massimo 1 partenza anticipata.

**Percorso del combattente** (`lib/mmaFighterPath.js`, `src/components/MmaToday.jsx`): le 4 tappe dell'Accademia diventano prove misurate.
- Fonti dei dati: lezioni (`done` dell'Accademia), voto medio della combo con la camera (`shadow_monarch_mma_combo_scores_v1`, scritto da `MmaComboTrainer` a fine serie), segreti imparati, esercizi riflessi superati, sedute a round del Coach Studio.
  - Un round conta solo se dura davvero quanto deve: minuti attivi ≥ 85%, anche in media per round.
- Le prove di palestra si spuntano a mano (`shadow_monarch_mma_fighter_v1`): lotta, sparring con istruttore, certificato medico, ok dell'istruttore.
- Tappa 4 = «Pronto per il primo incontro».

**Allenamento di oggi** (`planToday`), in 20, 40 o 60 minuti, in quest'ordine:
1. riscaldamento guidato a voce;
2. riflessi, da riposati e solo se non fatti ieri;
3. tecnica (lezione della tappa);
4. combo con la camera: prima la mossa segreta sbloccata, poi quella più vicina a 80;
5. «Round di shadow» (nuova lezione `rounds`): 3×2, 3×3 o 4×3 minuti a seconda della tappa;
6. defaticamento con respiro 5-5.

Ogni blocco si spunta da solo leggendo i dati veri. Nel Coach Studio la pausa tra i round ora guida il respiro 5-5.

**Ricerca usata** (21/10/2026):
- Reazione semplice a una luce: 231 ms in media, 218 ms a 18–24 anni (Frontiers Hum Neurosci 2015, https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2015.00131/full).
- Telefoni e tablet aggiungono 57–70 ms, con poca variazione (https://www.biorxiv.org/content/10.1101/639351.full.pdf). Per questo ti confronti solo con te stesso.
- 45 combattenti MMA: reazione 266 ms più 115 ms di movimento (https://pmc.ncbi.nlm.nih.gov/articles/PMC6994193/).
- Allenamento dei riflessi: migliora la reazione (SMD −0,82) con circa 10 minuti, 1–3 volte a settimana, da riposati (https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1697425/full).
- Gli esperti battono i principianti nel leggere attacchi veri, non nei test generici (https://pmc.ncbi.nlm.nih.gov/articles/PMC9650920/). Per questo gli esercizi usano colpi veri come risposta.
- Recupero dopo sforzo: respiro 5 s dentro / 5 s fuori, battito 155 contro 165 del respiro a scatola (https://acikerisim.bartin.edu.tr/entities/publication/c1eb6ff2-232a-42a5-bd2d-81bb0555175c/full).
- Primo incontro circa 2,4–2,7 anni dopo l'inizio; dilettanti con circa 3,9 sedute di combattimento a settimana (Barley & Harms 2021).
- Dilettanti IMMAF: 3 round da 3 minuti con 1 minuto di pausa (https://immaf.org/wp-content/uploads/2025/11/MMA-UNIFIED-RULES-FOR-AMATEUR-JUNIOR-SENIOR-January-2021.pdf).
- Italia: per l'MMA con colpi alla testa serve il certificato agonistico completo (visita sportiva, neurologo, otorino con esame dell'udito, EEG, oculista; Federkombat 2025).
- Medici di bordo ring (ARP): niente sparring per 30, 60 o 90 giorni dopo uno stop per colpi, un KO o un KO con perdita di coscienza; guantoni da sparring 12–22 oz (https://combatsportslaw.com/wp-content/uploads/2014/01/arp-medical-recommendations-to-improve-boxing-safety.pdf).
- Il caschetto riduce i tagli, non le commozioni (https://lida.sport-iat.de/ta/Record/4093047?lng=en).

**Dopo la revisione** (stessa sera):
- Prove «app»: valgono solo le sedute del Coach Studio viste davvero dalla camera (`mode: 'camera'` e `enough`). Non bastano la spunta a mano «Segna pratica completata» né un timer senza camera.
- Una tappa superata resta superata (`reached` in `shadow_monarch_mma_fighter_v1`), perché il diario del Coach Studio tiene solo le ultime 80 sedute.
- Le scelte del giorno (esercizio di riflessi, lezione, combo, tappa) si fissano alla prima apertura (`freezeToday`). Così un blocco superato si spunta, invece di diventare subito il successivo. I round si spuntano solo se tutti finiti e lunghi davvero.
- Riflessi: il ritardo della camera si toglie anche dal controllo «partito prima» (prima un anticipo poteva valere come record).
- Segreti: con una ripetizione pulita il maestro insegna lo stesso un segreto nuovo (`teachNextSecret`), ma solo tra quelli che la camera sa verificare: altezza dei colpi, distensione, ritorno, guardia, guardia nei calci. Un atleta che non sbaglia mai arriva comunque a Campione (provato con un test che simula 20 giri di combo pulite).
- Salvataggi rovinati (voti, storico riflessi) vengono ripuliti e non bloccano più la pagina. La prova dei riflessi si chiude anche se esci dall'inquadratura dopo il segnale.

**Limiti onesti**
- La reazione misurata contiene il ritardo della camera, se il telefono non lo dichiara.
- Lotta, prese e sparring non si vedono con una camera: per questo le prove di palestra si spuntano a mano.
- La validazione della partenza è sintetica. Il ciclo completo con una persona vera va provato sul telefono.

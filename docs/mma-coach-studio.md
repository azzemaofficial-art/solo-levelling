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

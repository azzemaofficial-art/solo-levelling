# 🥋 Coach V2 — Masterplan (per esecuzione da parte di Sonnet)

> Autore del piano: Opus. Esecutore: Sonnet. Obiettivo: coach super professionale e "attivo".
> Regola d'oro: ogni modifica → `npm run build` verde + (dove serve) test Node inline dei falsi positivi. Commit atomici, messaggi chiari, push su `main` (deploy Vercel automatico).

---

## 0. LA SCOPERTA CHE CAMBIA TUTTO — figure 3D già possibili

Il progetto ha **già** tutta l'infrastruttura per un umanoide 3D animato con mocap reale:
- Deps installate: `three@0.183`, `@react-three/fiber@8`, `@react-three/drei@9`.
- `src/pages/MixamoLab.jsx` (556 righe) = pipeline FUNZIONANTE: carica un rig FBX base (T-pose) + clip di animazione separate (`idle/walk/attack/block/hit/death/taunt`), le fonde con `AnimationMixer`/`useAnimations`, `SkeletonUtils.clone`, fit-to-ground, `OrbitControls`.
- Asset in `public/models/mixamo-test/` (base.fbx + clip .fbx) → prova già girante alla pagina "lab".

**Conseguenza**: il problema "teep e cross non si capiscono / le figure sembrano tutte uguali" NON si risolve ritoccando le pose SVG 2D (sono intrinsecamente ambigue in 2D statico). Si risolve mostrando un **umanoide 3D che esegue la mocap reale della tecnica**, ruotabile. Un cross e un teep in 3D sono inequivocabili; ogni disciplina ha la sua guardia/stance.

Il 2D SVG resta come **fallback leggero** (device deboli / caricamento) e come mini-anteprima, ma la star diventa il 3D.

---

## 1. LE 10 MACRO-MIGLIORIE

Legenda: 🎨 = richiede iterazione visiva con screenshot dell'utente · 🤖 = candidata ad agente in background · ⚙️ = logica/dati testabili in autonomia.

### MACRO 1 — Figure leggibili: 2D multi-keyframe SUBITO + 3D mocap come flagship 🎨
**Pain**: "teep non capisco, cross nemmeno; le figure sembrano uguali tra discipline."
**Decisione (doppio binario, deciso con l'utente)**: non bloccare la leggibilità aspettando gli asset 3D. Due track paralleli:

**Track A — 2D MULTI-KEYFRAME (immediato, zero asset, anche fallback permanente)**
Oggi `StickFigure` interpola solo 2 pose (guardia↔colpo): un teep e un cross morfano in modo simile → ambigui. Upgrade: ogni tecnica diventa una **sequenza di 4-6 keyframe** che descrive l'ARCO reale del movimento, interpolati nel tempo. Esempi:
- cross: guardia → caricamento (rotazione tallone/anca) → estensione → impatto → ritorno.
- teep: guardia → camera del ginocchio (ginocchio su) → spinta pianta del piede → ritorno.
- roundhouse: guardia → step d'appoggio → rotazione anca 45° → frusta della tibia → ritorno.
Inoltre **stance idle per-disciplina** diverse (boxe alta e stretta, muay thai eretta, karate hanmi, taekwondo laterale, BJJ bassa). File: rifattorizzare `BAG_POSES`/`StickFigure` in `src/pages/Coach.jsx` verso `TECH_KEYFRAMES = { tech: [pose1..poseN] }` + `DISCIPLINE_STANCE[mode]`. Da iterare con screenshot dell'utente.
**Acceptance A**: teep, cross, roundhouse, ginocchiata sono riconoscibili a colpo d'occhio e diversi tra loro; 3 discipline mostrano stance chiaramente diverse.

**Track B — 3D MOCAP (flagship, quando gli asset ci sono)**
Nuovo `src/pages/coach/Fighter3D.jsx` che riusa i pattern di `MixamoLab.jsx`: rig base + clip FBX per tecnica, `poseKey→clip`, crossfade, `OrbitControls`, stance idle per-disciplina, fallback a Track A se WebGL assente/`prefers-reduced-motion`/iPhone in difficoltà. Integrato in `ComboAnimator` e pannello PROVA dietro toggle "3D".
**Acceptance B**: Muay Thai vs Boxe vs Taekwondo visibilmente diversi, tecnica inequivocabile, ruotabile, ≥30fps su iPhone, 1 istanza per volta.
**Sequenza**: Track A subito (sblocca la chiarezza) → §4 pipeline asset automatica → Fighter3D proof con asset di test → sostituzione con clip arti marziali → mappa completa per-disciplina.

### MACRO 2 — Libreria combo 10x, per livello, mai ripetitiva 🤖⚙️
**Pain**: "le combo sono le stesse."
**Cosa**: espandere `COMBO_LIBRARY` (in `src/pages/Coach.jsx`) da ~6-8 a **15-25 combo per disciplina**, ognuna taggata `{ combo, level: 'base'|'intermedio'|'avanzato', focus: 'potenza'|'velocità'|'difesa'|'counter'|'clinch' }`. Riscrivere `pickCombo` per: (1) non ripetere le ultime N mostrate (ring buffer), (2) filtrare per livello dell'utente (dal `pastSessions`/pagella), (3) rotazione pesata sui focus. Aggiungere "combo del giorno" deterministica (seed = data).
**Acceptance**: 20 estrazioni consecutive senza ripetizioni immediate; combo coerenti col livello; ogni disciplina ha combo autentiche (no boxing-style generico su BJJ/yoga).
**Nota agente**: dati + logica pura, testabile con test Node → ottimo per background agent.

### MACRO 3 — Coach ATTIVO: sessione strutturata a round ⚙️🎨
**Pain**: oggi le combo sono isolate; manca la sensazione di "lezione vera".
**Cosa**: modalità "Allenamento" = sessione a fasi con campanella e timer: Riscaldamento → Round tecnica → Round combo (intensità crescente) → Condizionamento → Defaticamento. Timer round/riposo configurabile (3×3min, 5×2min...), bell audio, countdown vocale, HUD round. Riusa il timer già presente.
**Acceptance**: parte una sessione completa senza toccare nulla, con transizioni vocali e campanella; l'utente segue come una classe.

### MACRO 4 — Respirazione guidata visiva 🤖🎨
**Pain**: richiesta esplicita "respirazioni".
**Cosa**: coach respiro dedicato con guida visiva (cerchio/onda che si espande = inspira, tiene, si contrae = espira), preset: Box 4-4-4-4, 4-7-8, Wim Hof, Nadi Shodhana, Respiro del guerriero (pre-combattimento). Sincronizzato con voce lenta + aptica (`navigator.vibrate`). Inseribile come fase pre/post round (aggancia MACRO 3) e come disciplina `breathing` a sé.
**Acceptance**: selezioni un protocollo, l'animazione guida il ritmo, la voce scandisce; funziona offline (nessuna AI).
**Nota agente**: i protocolli (dati + testi) sono generabili in background; l'animazione visiva serve iterazione.

### MACRO 5 — Specchio 2.0: più tecniche, hold, freeze-frame ⚙️🎨
**Pain**: lo Specchio è "molto utile" → potenziarlo.
**Cosa**: estendere `matchPose`/`POSE_FAMILY` a molte più tecniche con target angolari precisi; aggiungere drill "mantieni la posizione" (check isometrico X secondi con punteggio nel tempo); "freeze-frame" = cattura la tua posa e confrontala affiancata all'ideale; punteggio medio del round. Confermare/curare le soglie con screenshot reali.
**Acceptance**: lo Specchio funziona su ≥15 tecniche con correzioni direzionali (già introdotte per guardia/squat/affondo); nessun falso "rosso" quando la posa è corretta.
**Nota agente**: le soglie angolari sono dati testabili in background, MA vanno validate con screenshot dell'utente (§4).

### MACRO 6 — Circuiti intelligenti e progressivi 🤖⚙️
**Pain**: richiesta "circuiti".
**Cosa**: template di circuito per obiettivo (potenza / cardio / tecnica / mobilità / recupero) × disciplina; il generatore (`buildLocalPlan` + `generatePlan` backend) sceglie e scala la difficoltà da storico + punteggi Specchio; progressione settimanale visibile. Fallback locale già esistente → arricchirlo con i template.
**Acceptance**: "Guidato" propone circuiti diversi e via via più difficili in base ai voti passati; sempre funzionante anche senza AI.

### MACRO 7 — Feedback ibrido a bassa latenza ⚙️
**Cosa**: separare nettamente due canali: (1) **deterministico istantaneo** dagli angoli scheletro (nessuna AI, <50ms) per cue immediati ("gomito basso", "estendi il calcio"); (2) **AI** solo per la sfumatura/pagella, throttlato. Aggiungere **rep-quality** (non solo conteggio: "3 buone, 2 con schiena curva"). Ridurre l'attesa percepita con skeleton-cue mentre l'AI pensa.
**Acceptance**: durante un drill vedi correzioni entro pochi decimi di secondo senza dipendere dall'AI; l'AI aggiunge profondità senza bloccare.

### MACRO 8 — Voce e presenza del coach ⚙️🎨
**Cosa**: 2-3 "personalità" coach selezionabili (calmo maestro / duro da bordo ring / motivatore), pacing migliore, conta-ripetizioni a voce, annunci di round, callout motivazionali contestuali. Usa `speechSynthesis` (già presente) + selezione voce IT.
**Acceptance**: cambi personalità e cambia tono/frequenza dei cue; conta le rep ad alta voce nei drill.

### MACRO 9 — Gamification & ranking 🤖⚙️
**Cosa**: XP per padronanza tecnica (da punteggi Specchio + combo perfette), sistema cinture/gradi per disciplina, streak, "tecnica sbloccata", sfida giornaliera. Si aggancia a `coach_sessions`/pagelle già esistenti e all'Obsidian bridge.
**Acceptance**: fai una sessione → guadagni XP visibili, avanzi di grado, la sfida del giorno appare.

### MACRO 10 — Storico & dashboard in-app 🎨⚙️
**Cosa**: vista in-app che legge `coach_sessions` (via l'endpoint export già esistente o KV) → grafici progressi (voto nel tempo, sparkline), heatmap tecniche allenate, focus ricorrenti — senza aprire Obsidian. Riusa `charts` (già nel bundle) e lo stile app.
**Acceptance**: apri "Storico" nel Coach e vedi trend voti + tecniche più/meno allenate.

---

## 2. FASI DI ESECUZIONE CONSIGLIATE (per Sonnet)

**FASE A — Vinci il problema visivo (priorità #1 dell'utente)**
1. MACRO 1 proof-of-concept: `Fighter3D` con gli asset di test esistenti dentro il Coach (dietro un toggle "3D"), fallback a 2D. Screenshot all'utente.
2. Con le clip arti marziali (§4): mappare jab/cross/teep/kick/… e le stance per-disciplina.

**FASE B — Coach attivo (in parallelo, agenti in background)**
3. MACRO 2 (combo 10x) — agente.
4. MACRO 6 (circuiti) — agente.
5. MACRO 4 (respirazione, protocolli) — agente per i dati, poi UI.
6. MACRO 5 (soglie Specchio extra tecniche) — agente per le soglie, validazione con screenshot.

**FASE C — Struttura & presenza**
7. MACRO 3 (round strutturati) + MACRO 8 (voce/personalità).
8. MACRO 7 (feedback ibrido/rep-quality).

**FASE D — Meta**
9. MACRO 9 (gamification) + MACRO 10 (dashboard).

---

## 3. AGENTI IN BACKGROUND — come spezzarli (pattern già collaudato in questa repo)

Regole per ogni agente (ripetere nel prompt): un solo file quando possibile; `node --check` + `npm run build` obbligatori; **test Node inline dei falsi positivi** per ogni nuova regex/soglia (lezione già appresa: parole italiane comuni come "avanti/ponte/corsa/guardia" o numeri nudi collidono col testo libero AI → servono pattern stretti o override `_STRICT`); commit+push solo se verde; niente modifiche a firme/logica esistenti, solo aggiunte.

- **Agente Combo** (MACRO 2): espande `COMBO_LIBRARY` con tag livello/focus + riscrive `pickCombo` anti-ripetizione. Test: 20 estrazioni senza ripetizione immediata; coerenza livello.
- **Agente Circuiti** (MACRO 6): template circuiti per obiettivo×disciplina in `buildLocalPlan` + hint progressione nel prompt `generatePlan`.
- **Agente Respirazione** (MACRO 4): oggetto `BREATHING_PROTOCOLS` (nome, fasi [inhale/hold/exhale/holdEmpty] in secondi, benefici, quando usarlo, testo guida) + cue vocali.
- **Agente Allineamenti/Specchio** (MACRO 5): estende `POSE_FAMILY`/`matchPose` con nuove tecniche e soglie angolari + messaggi direzionali. DEVE produrre un test che verifica: posa corretta → verde, posa sbagliata nelle 2 direzioni → messaggio giusto. Soglie da validare poi con screenshot utente.
- **Agente Conoscenza cue** (opzionale): amplia i cue deterministici istantanei (MACRO 7) mappando ogni errore-angolo → frase secca.

I 3D/UI (MACRO 1,3,8,10) NON vanno ad agente cieco: richiedono iterazione con screenshot.

---

## 4. COSA SERVE DALL'UTENTE (prima di partire)

1. **Screenshot** (per calibrare):
   - Figura combo di **teep** e **cross** attuali (quelle "non si capiscono").
   - Combo mid-animazione di **2-3 discipline diverse** (es. Boxe, Muay Thai, BJJ) per confermare che "sembrano uguali".
   - Lo **Specchio** in guardia con i giunti colorati (per tarare le soglie MACRO 5).
2. **Asset 3D — pipeline AUTOMATICA (deciso con l'utente)**: niente download manuale mossa-per-mossa (troppe, troppo lento). Strategia:
   - Sonnet costruisce `tools/mixamo-fetch.mjs`: uno script che, dato il **bearer token Adobe dell'utente** (`MIXAMO_TOKEN` env) + `X-Api-Key`, itera su una LISTA di animazioni e le scarica in blocco via l'API interna Mixamo (GET prodotto → POST export FBX-senza-skin → poll stato → download) in `public/models/coach/*.fbx`. Un agente lo esegue in una sessione (il token dura ~poco → batch unico). Riferimenti: implementazioni open-source "mixamo batch downloader" da studiare per il flusso esatto.
   - **Cosa fa l'utente (una volta, ~2-5 min)**: login su mixamo.com → devtools → Network → copia `Authorization: Bearer …` e `X-Api-Key` da una richiesta → li passa allo script (env). Uso personale col proprio account.
   - **Lista animazioni** (Sonnet la definisce completa; seed): Fighting Idle, Boxing Idle, Muay Thai stance, Jab, Cross Punch, Hook Punch, Uppercut, Body Jab, Elbow strikes, Front Kick, Roundhouse Kick, Side Kick, Knee, Low Kick, Spinning kicks, Capoeira, MMA kicks, Takedown/Shoot, Sprawl, ecc. → per disciplina.
   - **Se il flusso Mixamo risulta troppo fragile/ostico**: fallback su pacchetti mocap direttamente scaricabili (Rokoko free fight/martial-arts packs, repo GitHub di animazioni CC0 fbx/glb) che l'agente può prendere senza token. In ultima istanza, il **Track A 2D multi-keyframe** (già ottimo e senza asset) copre tutto.
3. **Priorità (deciso)**: **MACRO 1 Track A (2D keyframe) + MACRO 2 (combo 10x, agente) in parallelo**, poi la pipeline asset + Fighter3D. Agenti in background da lanciare: **Combo, Circuiti, Respirazione, Allineamenti/Specchio** (tutti e 4).

---

## 5. RISORSE / "SKILL" DA USARE (GitHub e non)

- **Già installate, nessun nuovo pacchetto necessario**: `three`, `@react-three/fiber`, `@react-three/drei` (`useFBX`, `useAnimations`, `OrbitControls`, `Html`), `three/examples/jsm/utils/SkeletonUtils` (clone rig), `framer-motion`, `@mediapipe/tasks-vision` (già via CDN nel Coach), `charts` (per MACRO 10).
- **Asset mocap gratuiti**: Mixamo (Adobe) — primario; Rokoko free packs — alternativa; Ready Player Me — avatar personalizzabile opzionale (.glb).
- **Skill Claude Code da invocare durante l'esecuzione**: `ui-ux-pro-max` (decisioni UI/UX su HUD round, dashboard, pannello 3D), `artifact-design` (se si vuole un report/anteprima condivisibile).
- **Riferimenti tecnici**: pattern FBX+AnimationMixer già in `MixamoLab.jsx` (fonte di verità interna); three.js forum su blend FBX/Mixamo per il crossfade senza T-pose flash.
- **Nessun costo AI extra** per gran parte: Specchio, respirazione, rep-quality, cue deterministici, timer, 3D sono **tutti locali** (perfetto viste le chiavi gratuite). L'AI resta solo per pagella/sfumatura.

---

## 6. RISCHI & MITIGAZIONI

- **Perf 3D su iPhone**: 1 sola istanza 3D per volta, `dpr` limitato, modello light, pausa animazioni fuori vista, fallback 2D. Testare su device reale (screenshot/feedback).
- **Peso asset FBX**: preferire GLB compresso (Draco) dove possibile; lazy-load per disciplina.
- **Regex/soglie**: SEMPRE test falsi positivi (vedi §3).
- **CSP**: l'app principale carica già risorse esterne (MediaPipe) → nessun blocco; gli asset 3D sono locali (`/models/`).

---

*Fine masterplan. Aggiornare questo file se la strategia cambia.*

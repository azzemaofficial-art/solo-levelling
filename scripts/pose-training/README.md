# Allenamento dello scheletro sui video

Questi programmi tarano lo scheletro del coach MMA usando un video vero, invece di andare a occhio.

- **Studente:** il video BoxingVI V7 letto da MediaPipe Lite a 25 fotogrammi al secondo, come fa il telefono.
- **Maestro:** gli scheletri AlphaPose del dataset dentro i 195 pugni etichettati. Sono levigati guardando anche i fotogrammi dopo, una cosa che si può fare solo su un video registrato.

I dati stanno in `tests/fixtures/private/`, che è fuori da git perché il repository è pubblico:

- `boxingvi-v7-lite.json`
- `boxingvi-v7-alphapose.npy`

Senza questi due file, i programmi si fermano subito e lo dicono.

## Comandi

```bash
node scripts/pose-training/allena-sincro.mjs        # prima/dopo: video in diretta contro fotogramma letto + suo scheletro
node scripts/pose-training/allena-sincro.mjs cerca 40  # prova 40 ricette del filtro del disegno nello schema sincronizzato
node scripts/pose-training/allena-disegno.mjs 300   # cerca la ricetta del disegno (filtro + disegnatore a 60 Hz)
node scripts/pose-training/prova-giudice.mjs        # il giudice dei colpi legge meglio con un altro filtro? e con la catena nuova?
```

## Cosa misurano

Tutte le misure sono in "busti": 1 è la lunghezza del busto nell'immagine.

- **staccato:** quanto lo scheletro disegnato resta lontano dal braccio vero durante i pugni.
- **scatti:** i salti visibili quando arriva un risultato nuovo.
- **fermo:** il tremolio quando sei fermo in guardia.
- **salti:** la percentuale di istanti con un punto del braccio a più di mezzo busto dal posto giusto.

La simulazione tiene conto che il risultato del modello arriva 45 ms dopo il fotogramma che ha letto.

## Risultati del 10 ottobre 2026

| | prima | dopo |
|---|---|---|
| scatti delle braccia | 0,089 | 0,036 |
| scatti del busto | 0,031 | 0,009 |
| tremolio da fermo (braccia) | 0,15 | 0,10 |
| staccato durante i pugni (braccia) | 0,252 | 0,237 |

Cosa è cambiato:

- Lo scheletro si ridisegna a ogni aggiornamento dello schermo, 60 volte al secondo, invece che 25.
- Invece di saltare alla posizione nuova ci scivola in 50 ms, con una breve previsione del movimento: `lib/poseView.js`.
- Il disegno ha un filtro suo, più leggero: `DISPLAY_FILTER`.

Il giudice dei colpi non cambia, resta su `IMAGE_FILTER`. Nessun filtro alternativo ha migliorato la seconda metà del video, quella non usata per scegliere.

Una pista resta aperta. Con i punti senza filtro e soglia di inizio colpo a 0,19 (picco 0,26, 110 ms):

- il braccio giusto passa da 55-63% a 66-69% in entrambe le metà;
- però si inventano circa 2-4 colpi in più al minuto.

Prima di usarla va provata sulle clip vere del telefono, perché cambia anche le misure degli esempi insegnati.

## Video e scheletro sincronizzati (17 ottobre 2026)

Il problema: il video si vedeva in diretta, lo scheletro arrivava 45-60 ms dopo. Durante un pugno
restava indietro rispetto al braccio, e la previsione correggeva solo in parte.

La soluzione: sul canvas si dipinge il fotogramma che il modello ha già letto, insieme al suo
scheletro (`createFrameSync` in `lib/poseView.js`, usato da `src/hooks/useMmaCamera.js`).

- I fotogrammi saltati dal modello prendono lo scheletro a metà tra i due risultati veri vicini.
- Se il risultato non è ancora arrivato si tiene l'ultimo fotogramma noto: niente previsioni.
- Il ritardo dell'immagine si adatta da solo all'attesa del modello, tra 20 e 65 ms; un fotogramma
  il cui risultato tarda di più resta in attesa (si vede ancora quello prima).
- Il modello riceve subito l'ultimo fotogramma appena è libero, rimpicciolito a 640 px di lato
  lungo, col tempo vero del fotogramma (`requestVideoFrameCallback`).
- Se il modello risponde di rado (lezioni a 12 fps), si ferma o il telefono fatica a copiare i
  fotogrammi, si torna al video in diretta con lo scheletro previsto, come prima.

### Come si misura adesso

La misura del 10/10 confrontava lo scheletro con il corpo all'istante esatto dello schermo (60 Hz).
Il video però cambia immagine solo 25-30 volte al secondo. Ora si confronta con il corpo
nell'immagine davvero mostrata (`ref = 'frame'` in `misura.mjs`), per entrambe le catene.

La simulazione del telefono (`schedule` in `misura.mjs`) riproduce le due catene:

- **prima:** si legge un fotogramma quando lo schermo si aggiorna, `createImageBitmap` a piena
  risoluzione (6 ms), tempo del rAF;
- **dopo:** si legge l'ultimo fotogramma appena il modello è libero (copia piccola, ~1 ms).

Il modello impiega 33, 40 o 45 ms a fotogramma (± 8 ms, seme fisso). Il telefono a 33 ms
corrisponde ai ~20 risultati al secondo misurati sul telefono vero.

### Risultati (telefono simulato a 33 ms; tra parentesi 40 e 45 ms)

| | prima | dopo |
|---|---|---|
| staccato durante i pugni (braccia) | 0,231 (0,255 · 0,271) | 0,111 (0,111 · 0,111) |
| scatti delle braccia | 0,102 (0,103 · 0,102) | 0,061 (0,057 · 0,054) |
| tremolio da fermo (braccia) | 0,151 (0,154 · 0,156) | 0,069 (0,067 · 0,064) |
| salti oltre mezzo busto | 7,6% (10,3% · 12,2%) | 1,4% (1,4% · 1,4%) |
| risultati al secondo | 19,8 (17,5 · 16,1) | 25,0 (22,4 · 20,3) |
| ritardo dell'immagine, media | 0 ms | 48 ms (67 · 72) |
| ritardo dell'immagine, 90% | 0 ms | 67 ms (100 · 100) |

Il video del dataset va a 25 fotogrammi al secondo, il telefono a 30: sul telefono l'immagine sale
a 30 quando il modello sta al passo. Il ritardo si somma a quello della camera, uguale nelle due catene.

Un filtro del disegno regolato apposta (`allena-sincro.mjs cerca 40`) migliora il punteggio solo
del 2,6%, ed è scelto sugli stessi dati: resta `DISPLAY_FILTER`. Coprire il 90% dei fotogrammi
invece del 50% alza il ritardo senza ridurre lo staccato: `q = 0,5`, `dMax = 65`.

### Il giudice dei colpi con la catena nuova

Stesso filtro (`IMAGE_FILTER`). Media di 9 prove: 3 telefoni × 3 semi, tutto il video.

| | prima | dopo |
|---|---|---|
| colpi visti | 73,6% ± 2,9 | 76,6% ± 1,5 |
| braccio giusto | 48,9% ± 2,5 | 55,4% ± 3,8 |
| colpi inventati al minuto | 21,1 ± 0,7 | 23,2 ± 0,6 |

I colpi inventati in più vengono dai risultati in più, non dai tempi nuovi: con la cadenza vecchia
e il tempo vero i numeri restano uguali (74,0% · 48,4% · 21,9). La catena nuova porta il telefono
alla condizione su cui il giudice è stato tarato: 25 fotogrammi al secondo, 22-25 inventati al minuto.

Non misurato: l'effetto dell'immagine a 640 px sui punti del modello. MediaPipe ritaglia il corpo e
lo riduce a 256 px; con il corpo intero in una 640×480 il ritaglio è di ~400 px, quindi non dovrebbe
cambiare niente. Da verificare su un video vero.

## Prossimo passo, con una connessione normale

`estrai-scheletro.py` legge un video in modalità `image`: ogni fotogramma da solo, senza levigatura interna. Con il modello Heavy dà un maestro su tutto il video, non solo dentro i pugni.

```bash
python estrai-scheletro.py video.mp4 heavy.json heavy 0 960 image   # maestro
python estrai-scheletro.py video.mp4 lite.json lite 25 960           # studente, come il telefono
```

Serve `mediapipe==0.10.21` in un ambiente Python 3.11: la versione 1.0.1 sul Mac si blocca.

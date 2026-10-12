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
node scripts/pose-training/allena-disegno.mjs 300   # cerca la ricetta del disegno (filtro + disegnatore a 60 Hz)
node scripts/pose-training/prova-giudice.mjs        # il giudice dei colpi legge meglio con un altro filtro?
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

## Prossimo passo, con una connessione normale

`estrai-scheletro.py` legge un video in modalità `image`: ogni fotogramma da solo, senza levigatura interna. Con il modello Heavy dà un maestro su tutto il video, non solo dentro i pugni.

```bash
python estrai-scheletro.py video.mp4 heavy.json heavy 0 960 image   # maestro
python estrai-scheletro.py video.mp4 lite.json lite 25 960           # studente, come il telefono
```

Serve `mediapipe==0.10.21` in un ambiente Python 3.11: la versione 1.0.1 sul Mac si blocca.

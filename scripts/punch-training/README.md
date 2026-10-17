# Allenamento dei colpi (pugni) del coach MMA

Questi programmi servono a capire **quanto bene il coach riconosce i pugni** e a migliorarlo con
dati veri, invece di andare a occhio. Usano BoxingVI (articolo arXiv 2511.16524): 10 video di
pugilato su YouTube con 5451 pugni etichettati a mano (jab, diretto, gancio e montante, avanti e
dietro) e lo scheletro di ogni pugno calcolato da AlphaPose.

Gli atleti sono 8: lo stesso pugile compare in V1 e V6 (atleta A) e in V7 e V8 (atleta F).

| video | atleta | pugni |
|---|---|---|
| V1, V6 | A | 1866 + 685 (V6: etichettati solo ganci e montanti) |
| V2 | B | 232 |
| V3 | C | 815 |
| V4 | D | 560 |
| V5 | E | 598 |
| V7, V8 | F | 195 + 199 |
| V9 | G | 149 |
| V10 | H | 152 |

## La regola d'oro: un atleta lasciato fuori

Ogni prova si fa su un atleta che il modellino **non ha mai visto** in addestramento. Così il numero
dice come andrà con una persona nuova (cioè con te), non quanto il modellino ha imparato a memoria.

## I dati (fuori da git: il repository è pubblico)

- `tests/fixtures/private/boxingvi-pugni.json.gz` (2,5 MB): per ogni video link, atleta, pugni
  etichettati e lo scheletro AlphaPose di ogni pugno, già con i numeri dei punti di MediaPipe.
- `tests/fixtures/private/boxingvi-lite/V<n>.json.gz` (~1 MB l'uno): il video letto da MediaPipe
  Lite come fa il telefono (640 px, 25 fotogrammi al secondo). Se stanno altrove: `BOXINGVI_LITE=<cartella>`.

Senza questi file i programmi lo dicono e si fermano.

## Preparare i dati (una volta sola, ~20 minuti a video)

Serve un Python 3.11 a parte (non quello del Mac), per esempio in una cartella temporanea:

```bash
python3.11 -m venv venv && venv/bin/pip install numpy pandas openpyxl odfpy gdown scikit-learn mediapipe==0.10.21 yt-dlp
venv/bin/python -I scripts/punch-training/prepara-boxingvi.py <cartella_download> tests/fixtures/private/boxingvi-pugni.json.gz
venv/bin/python -I scripts/punch-training/estrai-video.py 7 tests/fixtures/private/boxingvi-pugni.json.gz tests/fixtures/private/boxingvi-lite <cartella_video>
```

`estrai-video.py` scarica il video, lo legge solo dove ci sono i pugni (al massimo 6 minuti) e poi
lo **cancella**. Uno alla volta: MediaPipe occupa tutto il processore.

## I programmi

| programma | cosa fa |
|---|---|
| `banco.mjs` | il banco di prova: per ogni atleta pugni visti, braccio giusto, tipo giusto, colpi inventati al minuto, ritardo. Confronta il motore attuale con quello nuovo |
| `tara.mjs` | prova soglie diverse del motore (`STRIKE` in `lib/mmaStrikes.js`): sceglie su alcuni atleti, controlla sugli altri |
| `eventi.mjs` | prepara gli esempi per l'addestramento: ogni colpo trovato dal motore vero, con le misure che vede l'app |
| `rumore.mjs` | misura quanto è "sporco" lo scheletro del telefono rispetto ad AlphaPose (serve a sporcare gli esempi nello stesso modo) |
| `allena.py` | addestra e prova il modellino del tipo di pugno, un atleta fuori alla volta |
| `allena-colpo.py` | prova un modellino "è un pugno di questo braccio?" (non è entrato nell'app, vedi sotto) |
| `esporta.py` | addestra il modellino finale e scrive i pesi in `lib/mmaPunchWeights.js` |
| `clip-vere.mjs` | controllo sulle clip vere di Emanuele (solo in locale) |

```bash
node scripts/punch-training/banco.mjs 0          # senza tuoi esempi
node scripts/punch-training/banco.mjs 3          # con 3 tuoi esempi per tipo ("Insegna i colpi")
node scripts/punch-training/eventi.mjs esempi.json 4
OMP_NUM_THREADS=1 venv/bin/python -I scripts/punch-training/allena.py esempi.json mlp32,mlp64
OMP_NUM_THREADS=1 venv/bin/python -I scripts/punch-training/esporta.py esempi.json lib/mmaPunchWeights.js mlp64
# prova onesta del motore nuovo: un modellino per atleta, addestrato senza di lui
for a in B C D E F G; do OMP_NUM_THREADS=1 venv/bin/python -I scripts/punch-training/esporta.py esempi.json pesi/pesi-$a.json mlp64 --senza $a; done
BOXINGVI_PESI=pesi node scripts/punch-training/banco.mjs 0
node scripts/punch-training/tara.mjs E,G
node scripts/punch-training/clip-vere.mjs
```

`OMP_NUM_THREADS=1`: con il Mac carico i calcoli "a più fili" girano a vuoto e diventano lentissimi.

## Il modellino dei pugni

1. Il motore dei colpi (`lib/mmaStrikes.js`) trova il pugno come prima.
2. `lib/mmaPunchInput.js` lo riassume in 136 numeri: 10 istantanee del braccio (6 dalla guardia al
   punto più lontano, 4 dal punto più lontano al rientro), sempre rispetto al corpo e girate in modo
   che destri, mancini e video allo specchio si leggano uguali. Più le misure del braccio.
3. `lib/mmaPunchModel.js` (una rete piccolissima: 64 neuroni, ~9 000 pesi, 67 KB, meno di 0,1 ms)
   dà la probabilità di diretto, gancio e montante.

Per addestrarlo gli scheletri AlphaPose vengono "sporcati" come quelli del telefono (rumore misurato
sul V7, fotogrammi persi, salti dei polsi) e variati: allo specchio, più vicini o lontani, inclinati,
visti da un altro angolo. Più i video letti davvero da MediaPipe Lite.

**Cosa fa oggi nell'app (dal 17/10/2026):** solo una cosa. Quando le regole leggono un "montante"
(la mano scende e poi sale) il modellino dice quanto è probabile; se lo dà sotto il 25%, nella combo
quel colpo vale come "colpo del braccio giusto, tipo non deciso" (come un jab o un diretto non
classificato). Il nome nell'allenamento libero non cambia.

## Risultati (17/10/2026, catena del telefono ~25 al secondo, 6 atleti Lite, ognuno provato col modellino addestrato SENZA di lui)

| atleta | pugni | visti | braccio giusto | inventati/min | combo ok prima → dopo |
|---|---|---|---|---|---|
| B (V2) | 232 | 53% | 34% | 19,6 | 32% → 33% |
| C (V3) | 381 | 57% | 39% | 27,4 | 35% → 38% |
| D (V4) | 311 | 64% | 45% | 31,5 | 41% → 45% |
| E (V5) | 598 | 84% | 75% | 18,0 | 65% → 74% |
| F (V7) | 195 | 73% | 51% | 19,5 | 49% → 50% |
| G (V9) | 108 | 49% | 29% | 15,8 | 28% → 29% |
| tutti | 1825 | 68% | 52% | 21,5 | 47% → 51% |

- "Montanti" delle regole su pugni veri: 163, giusti solo 57 (35%). Col dubbio del modellino ne
  restano 54, giusti 41 (76%): tolti 93 sbagliati e 16 giusti (che nella combo valgono comunque).
- Clip vere di Emanuele: identiche (nelle sue 1-2 le regole non leggono montanti).
- Visti, braccio, inventati e ritardo non cambiano: il motore che trova i colpi è lo stesso.
- I colpi "inventati" sono sovrastimati: le etichette di BoxingVI non segnano tutti i pugni.

## Piste provate e NON entrate nell'app (con i numeri)

- **Il modellino che dà il tipo a ogni colpo** (al posto di "jab o diretto"): sui pugni col braccio
  giusto, atleti Lite mai visti, 63% contro 55% di "sempre diretto" e 42% dei tuoi 3 esempi per tipo.
  Ma nel banco completo vale solo +1 punto (43% → 44%), ganci 0% → 26% e montanti 28% → 47% però
  diretti 91% → 77%, e l'atleta C (quasi solo diretti) scende dal 55% al 37%. Non basta.
- **I tuoi esempi + il modellino** ("Insegna i colpi" prima, il modellino dove gli esempi non
  decidono): 38% → 39%, C 29% → 17%. Il modellino che smentisce gli esempi: meglio su E ed F, peggio
  su D e G. Restano gli esempi da soli.
- **"È un pugno di questo braccio?"** (`allena-colpo.py`) per correggere il braccio sbagliato o
  scartare colpi inventati: scambiando il braccio aggiusta 458 colpi ma ne rompe 1023 (AlphaPose);
  scartando i colpi deboli toglie 48 colpi inventati ma perde 24 pugni veri. No.
- **Soglie del motore a 25 al secondo** (`tara.mjs`, scelta su E+G, controllo su F): nessuna migliora
  entrambi. `peakMin` 0,24 toglie colpi inventati (17,4 → 13,0 al minuto) ma perde pugni veri anche
  sul controllo (visti 73% → 71%). Il motore resta com'è. Tutti i fotogrammi o la catena del telefono
  danno gli stessi numeri.
- Non letti (spazio su disco sotto i 23 GB): V1, V6, V8; V10 non si scarica (YouTube risponde 403).

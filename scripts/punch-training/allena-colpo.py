# "È un pugno di QUESTO braccio?" — un punteggio per ogni braccio, dalle stesse misure del modellino
# dei colpi. Serve a due cose: (1) quando il motore dà il colpo al braccio sbagliato (l'altro braccio
# si muove con la rotazione), (2) a scartare colpi inventati (mani che tornano in guardia, aggiustamenti).
# Prova onesta: un atleta lasciato fuori a turno. Positivi = pugni veri col braccio giusto;
# negativi = il braccio fermo durante un pugno vero, colpi dati al braccio sbagliato, colpi in più
# (AlphaPose: tutti falsi per costruzione; Lite: solo quelli dentro le combo etichettate).
# Uso: OMP_NUM_THREADS=1 python -I allena-colpo.py <eventi.json> [modelli]
import sys, json
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier


def make(kind):
    if kind.startswith('lr'):
        return LogisticRegression(C=float(kind[2:] or 0.3), max_iter=3000)
    h = tuple(int(x) for x in kind[3:].split('x'))
    return MLPClassifier(hidden_layer_sizes=h, activation='tanh', alpha=3e-3, max_iter=300, early_stopping=True, random_state=0)


# le misure del braccio (colonne 110–132) ci sono solo per il braccio del colpo: qui non si usano,
# altrimenti il modello imparerebbe "misure presenti = braccio giusto"
FEAT = slice(110, 133)


def main():
    rows = [r for r in json.load(open(sys.argv[1]))['rows'] if r['input'] and r['inputOther']]
    kinds = sys.argv[2].split(',') if len(sys.argv) > 2 else ['lr0.3']
    ath = np.array([r['athlete'] for r in rows]); src = np.array([r['src'] for r in rows]); aug = np.array([r['aug'] for r in rows])
    lab = np.array([r['lab'] for r in rows]); combo = np.array([bool(r['combo']) for r in rows]); partial = np.array([bool(r['partial']) for r in rows])
    I = np.array([r['input'] for r in rows]); O = np.array([r['inputOther'] for r in rows])
    I[:, FEAT] = 0; O[:, FEAT] = 0
    # campioni: (ingresso, 1 = è il braccio che colpisce)
    clean_neg = (lab == 'extra') & ((src == 'ap') | (combo & ~partial))
    Xs = np.concatenate([I[lab == 'right'], O[lab == 'right'], I[lab == 'wrong'], O[lab == 'wrong'], I[clean_neg]])
    ys = np.concatenate([np.ones((lab == 'right').sum()), np.zeros((lab == 'right').sum()), np.zeros((lab == 'wrong').sum()), np.ones((lab == 'wrong').sum()), np.zeros(clean_neg.sum())])
    As = np.concatenate([ath[lab == 'right'], ath[lab == 'right'], ath[lab == 'wrong'], ath[lab == 'wrong'], ath[clean_neg]])
    print('campioni', len(ys), 'positivi', int(ys.sum()))
    for kind in kinds:
        tot = {}
        for A in sorted(set(ath)):
            tr = As != A
            mu, sd = Xs[tr].mean(0), Xs[tr].std(0) + 1e-6
            m = make(kind).fit((Xs[tr] - mu) / sd, ys[tr])
            p = lambda X: m.predict_proba((X - mu) / sd)[:, 1]
            for ts in ['ap', 'lite']:
                te = (ath == A) & (src == ts) & (aug == 0)
                if te.sum() < 20:
                    continue
                pi, po = p(I[te]), p(O[te])
                L = lab[te]
                d = tot.setdefault(ts, {'right': 0, 'wrong': 0, 'fix': {}, 'break': {}, 'extra': 0, 'drop': {}, 'keep': {}, 'n_right': 0})
                d['right'] += (L == 'right').sum(); d['wrong'] += (L == 'wrong').sum()
                for mg in [0.0, 0.2, 0.4, 0.6]:
                    d['fix'][mg] = d['fix'].get(mg, 0) + ((L == 'wrong') & (po - pi > mg)).sum()
                    d['break'][mg] = d['break'].get(mg, 0) + ((L == 'right') & (po - pi > mg)).sum()
                ce = (L == 'extra') & (combo[te] & ~partial[te] if ts == 'lite' else True)
                d['extra'] += ce.sum()
                best = np.maximum(pi, po)
                for th in [0.1, 0.2, 0.3, 0.4]:
                    d['drop'][th] = d['drop'].get(th, 0) + (ce & (best < th)).sum()
                    d['keep'][th] = d['keep'].get(th, 0) + (((L == 'right') | (L == 'wrong')) & (best < th)).sum()
        for ts, d in tot.items():
            print(f'{kind} {ts}: pugni col braccio giusto {d["right"]}, sbagliato {d["wrong"]}, colpi in più (puliti) {d["extra"]}')
            print('   scambio se l\'altro braccio supera di: ' + ' | '.join(f'{mg}: aggiusta {d["fix"][mg]} rompe {d["break"][mg]}' for mg in d['fix']))
            print('   scarto se nessun braccio supera: ' + ' | '.join(f'{th}: scarta {d["drop"][th]} in più, perde {d["keep"][th]} pugni veri' for th in d['drop']))


if __name__ == '__main__':
    main()

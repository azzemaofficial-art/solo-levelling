# Addestra il modellino del tipo di pugno (diretto / gancio / montante) su TUTTI gli atleti e scrive
# i pesi in lib/mmaPunchWeights.js (JavaScript puro, letto da lib/mmaPunchModel.js).
# La scelta della rete viene dalle prove "un atleta lasciato fuori" di allena.py.
# Con --senza E lascia fuori l'atleta E e scrive solo i pesi in JSON: serve al banco di prova
# (banco.mjs) per provare il motore nuovo su un atleta che il modellino non ha mai visto.
# Uso: OMP_NUM_THREADS=1 python -I esporta.py <eventi.json> <lib/mmaPunchWeights.js | pesi.json> [rete] [--senza E]
import sys, json, datetime
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression

KINDS = ['straight', 'hook', 'uppercut']


def make(kind):
    if kind.startswith('lr'):
        return LogisticRegression(C=float(kind[2:] or 0.3), max_iter=3000)
    h = tuple(int(x) for x in kind[3:].split('x'))
    return MLPClassifier(hidden_layer_sizes=h, activation='tanh', alpha=3e-3, max_iter=300, early_stopping=True, random_state=0)


def athlete_weights(ath):
    w = np.ones(len(ath))
    for a in set(ath):
        w[ath == a] = 1.0 / (ath == a).sum()
    return w * len(ath) / w.sum()


def pack(m, mu, sd):
    r = lambda a: [float(round(x, 4)) for x in np.asarray(a).ravel()]
    if isinstance(m, LogisticRegression):
        layers = [{'W': r(m.coef_), 'b': r(m.intercept_)}]
    else:
        # sklearn tiene i pesi come (ingressi × uscite): in JS servono per riga di uscita
        layers = [{'W': r(W.T), 'b': r(b)} for W, b in zip(m.coefs_, m.intercepts_)]
    return {'mu': r(mu), 'sd': r(sd), 'layers': layers}


def main():
    args = [a for a in sys.argv[1:]]
    skip = None
    if '--senza' in args:
        k = args.index('--senza'); skip = args[k + 1]; del args[k:k + 2]
    src, dest = args[0], args[1]
    net = args[2] if len(args) > 2 else 'mlp32'
    rows = [r for r in json.load(open(src))['rows'] if r['input'] and r['lab'] == 'right' and r['athlete'] != skip]
    X = np.array([r['input'] for r in rows]); y = np.array([KINDS.index(r['kind']) for r in rows]); ath = np.array([r['athlete'] for r in rows])
    # colonne sempre uguali (il primo istante è lo zero di tutto): scala 1, non 0
    mu, sd = X.mean(0), X.std(0)
    sd[sd < 1e-3] = 1.0
    m = make(net)
    if net.startswith('mlp'):
        m.fit((X - mu) / sd, y)
    else:
        m.fit((X - mu) / sd, y, sample_weight=athlete_weights(ath))
    kind = pack(m, mu, sd)
    n_w = sum(len(L['W']) + len(L['b']) for L in kind['layers'])
    if skip:
        json.dump({'kind': kind}, open(dest, 'w'), separators=(',', ':'))
        print('scritto', dest, n_w, 'pesi, senza', skip)
        return
    head = ('// Generato da scripts/punch-training/esporta.py il ' + datetime.date.today().isoformat() + ': NON modificare a mano.\n'
            f'// Pesi del modellino del tipo di pugno ({net}, {n_w} pesi), addestrato su {len(rows)} pugni\n'
            f'// di {len(set(ath))} atleti BoxingVI visti come dal telefono. Vedi lib/mmaPunchModel.js.\n')
    with open(dest, 'w') as f:
        f.write(head + 'export const PUNCH_WEIGHTS = ' + json.dumps({'kind': kind}, separators=(',', ':')) + ';\n')
    print('scritto', dest, n_w, 'pesi')


if __name__ == '__main__':
    main()

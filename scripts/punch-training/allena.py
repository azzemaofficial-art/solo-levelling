# Addestra il modellino dei colpi (diretto / gancio / montante) e lo prova in modo onesto:
# ogni atleta viene lasciato fuori a turno (mai la stessa persona in addestramento e in prova).
# Confronta: esempi tuoi da soli (come l'app fino al 17/10), modellino da solo, modellino + esempi tuoi.
# Uso: OMP_NUM_THREADS=1 python -I allena.py <eventi.json> [modelli separati da virgola] [uscita_pesi.json]
# (OMP_NUM_THREADS=1: con il Mac carico i calcoli a più fili girano a vuoto e diventano lentissimi)
import sys, json
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier

KINDS = ['straight', 'hook', 'uppercut']
ARM_SCALE = np.array([0.371, 0.296, 0.298, 0.478, 0.261, 0.147, 0.359, 0.119, 0.315, 0.223, 0.48, 0.229, 0.302, 0.202, 0.736, 0.556, 77.2, 105, 0.192, 0.221, 0.136, 0.226, 0.338])
BETAS = [0.25, 0.5, 1.0, 2.0]
THETAS = [0.5, 0.6, 0.7, 0.8]


def make(kind):
    if kind.startswith('lr'):
        return LogisticRegression(C=float(kind[2:] or 0.3), max_iter=3000)
    if kind == 'hgb':
        return HistGradientBoostingClassifier(max_depth=4, max_iter=200, learning_rate=0.08, random_state=0)
    h = tuple(int(x) for x in kind[3:].split('x'))
    return MLPClassifier(hidden_layer_sizes=h, activation='tanh', alpha=3e-3, max_iter=300, early_stopping=True, random_state=0)


def knn_dist(test_f, ex_f, ex_y, k=3):
    # come lib/mmaTemplates.js: distanza in "deviazioni standard", media dei k esempi più vicini per tipo
    out = np.full((len(test_f), 3), np.inf)
    for c in range(3):
        E = ex_f[ex_y == c]
        if not len(E):
            continue
        d = np.sqrt((((test_f[:, None, :] - E[None, :, :]) / ARM_SCALE) ** 2).sum(-1))
        d.sort(axis=1)
        out[:, c] = d[:, :k].mean(1)
    return out


def personal(P, F, y, arm, idx, k_ex=3):
    # i primi k_ex colpi di ogni tipo (per braccio) diventano "i tuoi esempi"; si prova sugli altri
    ex, rest, cnt = [], [], {}
    for i in idx:
        key = (arm[i], y[i])
        if cnt.get(key, 0) < k_ex:
            cnt[key] = cnt.get(key, 0) + 1; ex.append(i)
        else:
            rest.append(i)
    ex, rest = np.array(ex, int), np.array(rest, int)
    ok = {'esempi': 0, 'modello': 0, **{f'mix{b}': 0 for b in BETAS}}
    for a in ['lead', 'rear']:
        r_, e_ = rest[arm[rest] == a], ex[arm[ex] == a]
        if not len(r_):
            continue
        ok['modello'] += (P[r_].argmax(1) == y[r_]).sum()
        if not len(e_):
            for b in BETAS:
                ok[f'mix{b}'] += (P[r_].argmax(1) == y[r_]).sum()
            continue
        D = knn_dist(F[r_], F[e_], y[e_])
        ok['esempi'] += (D.argmin(1) == y[r_]).sum()
        Dn = np.where(np.isinf(D), D[np.isfinite(D)].max() if np.isfinite(D).any() else 10, D)
        for b in BETAS:
            L = np.log(P[r_] + 1e-4) - b * (Dn - Dn.min(1, keepdims=True))
            ok[f'mix{b}'] += (L.argmax(1) == y[r_]).sum()
    return {k: (v, len(rest)) for k, v in ok.items()}


def main():
    data = json.load(open(sys.argv[1]))['rows']
    rows = [r for r in data if r['input'] and r['lab'] == 'right']
    X = np.array([r['input'] for r in rows], dtype=np.float64)
    y = np.array([KINDS.index(r['kind']) for r in rows])
    ath = np.array([r['athlete'] for r in rows]); src = np.array([r['src'] for r in rows]); aug = np.array([r['aug'] for r in rows])
    arm = np.array([r['arm'] for r in rows])
    F = np.array([r['f'] if r['f'] else [0] * 23 for r in rows], dtype=np.float64)
    hasF = np.array([bool(r['f']) for r in rows])
    print('esempi', len(rows), {a: int((ath == a).sum()) for a in sorted(set(ath))}, 'lite', int((src == 'lite').sum()))
    kinds = sys.argv[2].split(',') if len(sys.argv) > 2 else ['lr', 'mlp32']
    res = {}
    for A in sorted(set(ath)):
        tr = ath != A
        # ogni atleta pesa uguale (A ha 10 volte i pugni di G)
        w = np.ones(len(rows))
        for B in set(ath[tr]):
            w[ath == B] = 1.0 / (ath[tr] == B).sum()
        w = w * tr.sum() / w[tr].sum()
        mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-6
        Xs = (X - mu) / sd
        for kind in kinds:
            m = make(kind)
            if kind.startswith('mlp'):
                m.fit(Xs[tr], y[tr])
            else:
                m.fit(Xs[tr], y[tr], sample_weight=w[tr])
            P = m.predict_proba(Xs)
            for ts in ['ap', 'lite']:
                te = (ath == A) & (src == ts) & (aug == 0)
                if te.sum() < 10:
                    continue
                res.setdefault((kind, ts), {})[A] = ((P[te].argmax(1) == y[te]).sum(), int(te.sum()))
                res.setdefault(('sempre-diretto', ts), {})[A] = ((y[te] == 0).sum(), int(te.sum()))
                # soglia: sotto, il coach non decide e resta sul colpo base del braccio (diretto)
                for th in THETAS:
                    pick = np.where(P[te].max(1) >= th, P[te].argmax(1), 0)
                    res.setdefault((f'{kind}@{th}', ts), {})[A] = ((pick == y[te]).sum(), int(te.sum()))
                    sure = P[te].max(1) >= th
                    res.setdefault((f'{kind}@{th}-decisi', ts), {})[A] = ((P[te].argmax(1)[sure] == y[te][sure]).sum(), int(sure.sum()))
                for name, v in personal(P, F, y, arm, np.where(te & hasF)[0]).items():
                    res.setdefault((f'{kind}+{name}' if name != 'esempi' else 'esempi3', ts), {})[A] = v
    for key, d in sorted(res.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        tot = sum(a for a, n in d.values()) / max(1, sum(n for _, n in d.values()))
        mean_ath = np.mean([a / n for a, n in d.values() if n])
        print(f'{key[0]:>16} {key[1]:>4}  tutti {tot:.3f}  media atleti {mean_ath:.3f}  ' + ' '.join(f'{A}:{a / max(1, n):.2f}' for A, (a, n) in sorted(d.items())))


if __name__ == '__main__':
    main()

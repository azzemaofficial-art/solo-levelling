# Prepara il dataset BoxingVI (arXiv 2511.16524) per il coach dei colpi.
# 1. Scarica dalla cartella pubblica di Google Drive scheletri AlphaPose (.npy) ed etichette (.xlsx)
#    dei 10 video, se non ci sono già.
# 2. Scrive un file compatto con, per ogni video: link, atleta, pugni (fotogramma di inizio e fine,
#    tipo) e lo scheletro AlphaPose di ogni pugno convertito negli indici MediaPipe.
# Uso: python -I prepara-boxingvi.py <cartella_download> <file_uscita.json.gz>
# Serve un Python con gdown, openpyxl, odfpy, pandas, numpy (vedi README).
import sys, os, json, gzip
import numpy as np
import pandas as pd

FOLDER = '1Vyl8twJQ1qkqEPwhvfsrJsJ8nLQ92uoy'
# stessi atleti: V1+V6, V7+V8 (dal confronto dei video); gli altri sono persone diverse
ATHLETE = {1: 'A', 6: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 7: 'F', 8: 'F', 9: 'G', 10: 'H'}
# COCO-17 → indici MediaPipe (naso, occhi, orecchie, spalle, gomiti, polsi, fianchi, ginocchia, caviglie)
COCO2MP = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
MOVE = {'jab': 'jab', 'cross': 'cross', 'lead hook': 'hook', 'rear hook': 'rearHook', 'lead uppercut': 'uppercut', 'rear uppercut': 'rearUppercut'}


def download(dl):
    if os.path.exists(os.path.join(dl, 'Skeleton_data', 'V10.npy')):
        return
    import gdown
    gdown.download_folder(id=FOLDER, output=dl, quiet=True)


def labels_of(path):
    # i 10 file hanno colonne diverse: inizio = primo numero della riga, fine = secondo, tipo = prima scritta nota
    x = pd.read_excel(path, header=None)
    out = []
    for row in x.itertuples(index=False):
        nums = [v for v in row if isinstance(v, (int, float, np.integer, np.floating)) and not pd.isna(v)]
        names = [MOVE[str(v).strip().lower()] for v in row if isinstance(v, str) and str(v).strip().lower() in MOVE]
        if len(nums) >= 2 and names:
            out.append((int(nums[0]), int(nums[1]), names[0]))
    return out


def main():
    dl, dest = sys.argv[1], sys.argv[2]
    download(dl)
    links = pd.read_excel(os.path.join(dl, 'RGB_videos', 'Meta_data.ods'), engine='odf', header=None)
    link = {str(r[0]).strip(): str(r[1]).strip() for r in links.itertuples(index=False)}
    videos = []
    for v in range(1, 11):
        lab = labels_of(os.path.join(dl, 'Annotation_files', f'V{v}.xlsx'))
        sk = np.load(os.path.join(dl, 'Skeleton_data', f'V{v}.npy'), allow_pickle=False)
        punches = []
        # [x, y] per giunto, in millesimi dell'immagine (COCO → MediaPipe)
        enc = lambda p: [int(round(float(c) * 1000)) for xy in p for c in xy]
        if sk.ndim == 4 and sk.shape[1] == 1:
            # V6: scheletro di TUTTO il video, una riga per fotogramma con [fotogramma, x, y] per giunto
            rows = {int(r[0, 0, 0]): r[0, :, 1:] for r in sk}
            for s, e, mv in lab:
                fr = [enc(rows[f]) for f in range(s, e + 1) if f in rows]
                punches.append({'s': s, 'e': e, 'move': mv, 'ap': fr})
        else:
            # gli altri: un pugno per riga, fotogrammi da inizio a fine, poi zeri fino a 25
            if len(lab) != sk.shape[0]:
                print(f'V{v}: {len(lab)} etichette ma {sk.shape[0]} scheletri: tengo i primi {min(len(lab), sk.shape[0])}')
            for k in range(min(len(lab), sk.shape[0])):
                s, e, mv = lab[k]
                fr = []
                for f in range(sk.shape[1]):
                    if not np.any(sk[k, f]):
                        break
                    fr.append(enc(sk[k, f]))
                punches.append({'s': s, 'e': e, 'move': mv, 'ap': fr})
        punches.sort(key=lambda p: p['s'])
        url = link.get(f'V{v}', '')
        yt = url.split('v=')[1].split('&')[0] if 'v=' in url else ''
        videos.append({'v': v, 'athlete': ATHLETE[v], 'yt': yt, 'punches': punches})
        print(f'V{v} atleta {ATHLETE[v]}: {len(punches)} pugni')
    data = {'note': 'BoxingVI (arXiv 2511.16524): etichette e scheletri AlphaPose dei pugni, uso locale.', 'j': COCO2MP, 'videos': videos}
    with gzip.open(dest, 'wt') as f:
        json.dump(data, f, separators=(',', ':'))
    print('scritto', dest, os.path.getsize(dest) // 1024, 'KB')


if __name__ == '__main__':
    main()

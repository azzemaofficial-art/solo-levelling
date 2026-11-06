#!/usr/bin/env python3
# Genera src/data/menu16.js (settimane 7-16 del piano) da ricette.json e ingredienti.json.
# Uso: python3 scripts/menu/sedici/genera.py   Si ferma con un errore se una regola del piano salta.
import collections, json, os, random, re, subprocess

S = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(S)))
U = json.load(open(f'{S}/ingredienti.json'))
RICETTE = json.load(open(f'{S}/ricette.json'))
OLD = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import { mealWeeks } from './src/data/cutPlan.js'; import { mealRecipes } from './src/data/mealRecipes.js';
const o = {}; mealWeeks.flat().forEach((d) => d.slots.forEach((s) => { const r = mealRecipes[s.meal]; o[s.id] = { id: s.id, meal: s.meal, image: s.image, kcal: r.kcal, p: r.protein, fib: r.fiber, fv: r.fv }; }));
console.log(JSON.stringify(o));'''], cwd=ROOT))

FV = re.compile(r'cipoll|pomodor|peperon|lattuga|rucola|finocchi|germogli|cetriol|carot|zucchin|spinac|cavol|verza|broccol|pak choi|funghi|fagiolin|insalata|porro|porri|mais|piselli|passata|banana|frutti di bosco|\bmel[ae]\b|melanzan|arancia|ananas|avocado|fragol|kiwi|mango|\bper[ae]\b|sedano|zucca|bietol|asparag|lamponi|mirtilli|pesca|ciliegie|uva\b|radicchio|scalogno|cipollotto|daikon|ravanell|barbabietol|pompelmo', re.I)
NOFV = re.compile(r'succo|brodo|olio|farina|aceto', re.I)
RED = re.compile(r'manzo|scamone|lonza|maiale|speck|agnello|salsiccia|pancetta|guanciale|bresaola|chorizo', re.I)
LEG = re.compile(r'lenticch|fagioli\b|\bceci\b|edamame', re.I)
TUNA = re.compile(r'tonno', re.I)
BAN = re.compile(r'peperoncin|gochujang|sriracha|curry verde|kimchi|jalape|cayenna|harissa|sambal|tabasco|fiocchi di latte|tiramis|french toast|pesto', re.I)
# kcal di ogni tipo di piatto: (settimane 7-13, supercut 14-16). Stessa cifra = alternative davvero equivalenti.
TARGET = {'colazione': (460, 420), 'spuntino': (220, 170), 'piatto': (660, 550), 'pesce': (660, 550), 'pollo-riso-lun': (830, 790), 'cena-calcio': (830, 790)}
TOLL = 60

def macro(items):
    t = [0, 0, 0, 0, 0]; fv = 0
    for name, g in items:
        v = U.get(name)
        if v is None: continue  # spezie: incidono pochissimo
        for i in range(5): t[i] += v[i] * g / 100
        if FV.search(name) and not NOFV.search(name): fv += g
    return {'kcal': round(t[0]), 'p': round(t[1]), 'f': round(t[2]), 'c': round(t[3]), 'fib': round(t[4]), 'fv': round(fv)}

def scala(items, k):
    # riduce o aumenta solo cereali, zuccheri e grassi: le proteine restano intatte
    out = []
    for n, g in items:
        v = U.get(n)
        lean = v and v[0] > 0 and v[1] * 4 / v[0] >= .25
        if v and not lean and v[0] >= 100:
            g = max(1, round(g * k / 5) * 5) if g >= 20 else max(1, round(g * k))
        out.append([n, g])
    return out

def adatta(items, target):
    lo, hi = .45, 1.35
    for _ in range(14):
        k = (lo + hi) / 2
        if macro(scala(items, k))['kcal'] > target: hi = k
        else: lo = k
    return scala(items, (lo + hi) / 2)

is_sweet = lambda r: 'whey' in str(r['porzione_g']).lower()

def tipo(r):
    s = r['slot']
    if r['fonte'] == 'pesce': return 'pesce'
    return 'piatto' if s in ('pranzo', 'cena') else 'spuntino' if s in ('spuntino', 'dolce') else s

def famiglia(r):
    # stessa famiglia = cambio libero: pesce, legumi, carne rossa e tonno restano nei limiti della settimana
    t = tipo(r)
    if t == 'pesce': return 'pesce-tonno' if r['tuna'] else 'pesce'
    if r['red']: return t + '-rossa'
    if t == 'piatto': return 'piatto-legumi' if r['leg'] else 'piatto'
    if t == 'spuntino': return 'spuntino-legumi' if r['leg'] else 'spuntino'
    return t

def testo(title, items):
    # la whey al cioccolato-wafer va sempre in vista: Emanuele vuole vederla usata
    main = [f'{n.lower()} {g} g' for n, g in sorted(items, key=lambda x: 'whey' not in x[0].lower()) if g >= 15 and U.get(n)][:4]
    return f'{title}: ' + ', '.join(main)

R = {}
for r in RICETTE:
    assert r['id'] not in R, r['id']
    assert not BAN.search(r['titolo'] + str(r['porzione_g'])), f"ingrediente vietato in {r['id']}"
    r['red'] = any(RED.search(n) and 'brodo' not in n.lower() and g >= 50 for n, g in r['porzione_g'])
    r['leg'] = any(LEG.search(n) and g >= 50 for n, g in r['porzione_g'])
    r['tuna'] = any(TUNA.search(n) for n, _ in r['porzione_g'])
    R[r['id']] = r

DISHES, FIT, SCARTATI = [], {}, []
for r in R.values():
    for ph, target in zip('ms', TARGET[tipo(r)]):
        items = adatta(r['porzione_g'], target); m = macro(items)
        if abs(m['kcal'] - target) > TOLL: SCARTATI.append((r['id'], ph, m['kcal'])); continue
        we, wk = r.get('tempo_weekend_min') or 0, r.get('tempo_settimana_min') or 0
        FIT[r['id'], ph] = {'id': r['id'], 'nome': r['titolo'], 'porz': items, **m, 'r': r}
        DISHES.append({'id': r['id'], 'phase': ph, 'meal': testo(r['titolo'], items), 'title': r['titolo'], 'cuisine': r['cucina'], 'why': r['perche_food_porn'],
            'time': f'{we} min nel weekend, {wk} min quel giorno' if we else f'{wk} min', 'prepMin': we, 'freezer': bool(r.get('congelabile')),
            'kcal': m['kcal'], 'protein': m['p'], 'fat': m['f'], 'carbs': m['c'], 'fiber': m['fib'], 'fv': m['fv'], 'cost': r['costo_euro'],
            'family': famiglia(r), 'whey': is_sweet(r), 'image': f"/recipes/{r['id']}.webp", 'dose': items, 'steps': r['passi'] + (['Conservazione: ' + r['come_conservare']] if r.get('come_conservare') else [])})

# il testo del pasto è la chiave della ricetta: se i primi ingredienti non cambiano tra le fasi, va distinto
visti = collections.defaultdict(set)
for x in DISHES:
    if x['meal'] in visti and x['id'] in visti[x['meal']]: x['meal'] += ' · dosi supercut'
    visti[x['meal']].add(x['id'])

FIXED_NEW = {  # pasti fissi con dosi nuove rispetto alle settimane 1-6: nome, testo, kcal, proteine, fibre, frutta e verdura, ingredienti, passi
 'f_piadina1': ('1 piadina col doppio tacchino', '1 piadina col doppio tacchino: piadina, fesa di tacchino 200 g, mozzarella light 60 g, insalata e pomodoro', 600, 60, 4, 80, ['1 piadina', 'Fesa di tacchino 200 g', 'Mozzarella light 60 g', 'Insalata e pomodoro 80 g'], ['Scalda la piadina in padella, farcisci con tacchino, mozzarella e verdura, richiudi e scalda ancora 1 minuto per lato.']),
 'f_gocciole4': ('Latte e 4 Gocciole', 'Latte e 4 Gocciole: latte scremato 250 ml con proteine 25 g, 4 Gocciole e un frutto', 510, 33, 6, 160, ['Latte scremato 250 ml', 'Whey 25 g', '4 Gocciole', '1 frutto'], ['Sciogli le proteine nel latte, poi Gocciole e frutto.']),
 'f_cavallo_s': ('Pasta e cavallo, versione supercut', 'Pasta bianca 70 g cruda con olio EVO 5 g + carne di cavallo 200 g + verdure', 560, 50, 6, 200, ['Pasta 70 g', 'Olio EVO 5 g', 'Carne di cavallo 200 g', 'Verdure 200 g'], ['Cuoci la pasta, condisci con l’olio; carne in padella ben calda, verdure a parte.']),
 'f_mamma_s': ('Dalla mamma: solo secondo', 'Pranzo dalla mamma: solo il secondo e tanta verdura, niente primo', 500, 45, 8, 300, ['Secondo di carne o pesce', 'Verdure a volontà'], ['Salta il primo in queste ultime due settimane.']),
 'f_post_s': ('Dopo calcio leggero', 'Dopo calcio: shake proteico 30 g con latte scremato e 2 gallette', 250, 32, 1, 0, ['Whey 30 g', 'Latte scremato 250 ml', '2 gallette'], ['Agita lo shake e aggiungi la creatina 3–5 g, gallette a parte.']),
 'f_shake': ('Shake e creatina', 'Shake di whey 30 g con acqua + creatina 3–5 g a fine allenamento', 115, 23, 0, 0, ['Whey 30 g', 'Creatina monoidrata 3–5 g', 'Acqua'], ['Agita e bevi a fine allenamento.']),
 'f_shake0': ('Shake', 'Shake di whey 30 g con acqua', 115, 23, 0, 0, ['Whey 30 g', 'Acqua'], ['Agita e bevi.']),
 'f_contorno': ('Contorno e frutta', 'Contorno: verdura 200 g condita con limone e un frutto', 130, 3, 8, 350, ['Verdura di stagione 200 g', 'Limone', '1 frutto'], ['Al vapore o in padella antiaderente, con limone e un pizzico di sale.']),
 'f_contorno2': ('Contorno doppio e frutta', 'Contorno: verdura 400 g condita con limone e due frutti', 260, 6, 16, 700, ['Verdura di stagione 400 g', 'Limone', '2 frutti'], ['Al vapore o in padella antiaderente, con limone e un pizzico di sale.']),
 'f_edamame': ('Edamame e frutta', 'Edamame 150 g e un frutto', 265, 18, 11, 150, ['Edamame surgelati 150 g', '1 frutto'], ['Lessa gli edamame 4 minuti, sale grosso sopra.']),
}
for fid, (title, meal, kc, p, fib, fv, ing, steps) in FIXED_NEW.items():
    DISHES.append({'id': fid, 'phase': None, 'meal': meal, 'title': title, 'time': '5 min', 'kcal': kc, 'protein': p, 'fiber': fib, 'fv': fv, 'family': None, 'image': None, 'ingredients': ing, 'steps': steps})

def fx(key):
    if key in FIXED_NEW:
        t = FIXED_NEW[key]; o = {'id': key, 'meal': t[1], 'image': None, 'kcal': t[2], 'p': t[3], 'fib': t[4], 'fv': t[5]}
    else: o = OLD[key]
    return {**o, 'fisso': True, 'red': key in ('cavallo', 'f_cavallo_s', 'mcd'), 'leg': key == 'f_edamame', 'tuna': False, 'pesce': False}

ok_both = lambda r: (r['id'], 'm') in FIT and (r['id'], 's') in FIT
def cat(fam): return [r for r in R.values() if famiglia(r) in fam and ok_both(r)]
NON_CAL = {'dutch-baby-al-cioccolato', 'gelato-proteico-al-cioccolato', 'mochi-proteici-al-cioccolato', 'hotteok-cioccolato-e-noci', 'hummus-proteico-con-pita'}  # non si rigenerano: restano tra le alternative
LUN_ROT = ['pre_banana', 'post_banana'], ['pre_toast', 'post_toast']

def build(seed):
    rnd = random.Random(seed)
    sh = lambda L: rnd.sample(L, len(L))
    dolci = sh([r for r in cat({'colazione'}) if is_sweet(r) and r['id'] not in NON_CAL]); salate = sh([r for r in cat({'colazione'}) if not is_sweet(r)])
    giri = [0, 0]
    mon, thu = sh(cat({'pollo-riso-lun', 'pollo-riso-lun-rossa'})), sh(cat({'cena-calcio', 'cena-calcio-rossa'}))
    leg, gen, red = cat({'piatto-legumi'}), cat({'piatto'}), cat({'piatto-rossa'})
    fish = cat({'pesce', 'pesce-tonno'})
    snacks = sh([r for r in cat({'spuntino'}) if r['id'] not in NON_CAL and is_sweet(r)])
    humm = R['hummus-proteico-con-pita']
    used = collections.Counter(); W = []; ib = 0
    for w in range(7, 17):
        ph = 's' if w >= 14 else 'm'; nosg = w >= 15
        rec = lambda r: {**FIT[r['id'], ph], 'fisso': False, 'red': r['red'], 'leg': r['leg'], 'tuna': r['tuna'], 'pesce': r['fonte'] == 'pesce', 'fam': famiglia(r), 'phase': ph}
        mod, thd = mon[(w - 7) % len(mon)], thu[(w - 7) % len(thu)]
        if mod['red'] and thd['red']: raise ValueError  # con cavallo e McDonald's sarebbero 4 rosse
        red_week = [mod['red'] or thd['red']]; tuna_week = [False]; seen = set()
        def pick(pool):
            for r in sorted(pool, key=lambda r: (used[r['id']], rnd.random())):
                if r['id'] in seen or (r['red'] and red_week[0]) or (r['tuna'] and tuna_week[0]): continue
                seen.add(r['id']); used[r['id']] += 1; red_week[0] |= r['red']; tuna_week[0] |= r['tuna']
                return rec(r)
            raise ValueError
        def col():
            # ogni 5 colazioni, 4 dolci con la whey al cioccolato-wafer e 1 salata
            nonlocal ib
            salata = ib % 5 == 4; ib += 1
            pool = salate if salata else dolci
            giri[salata] += 1
            return rec(pool[giri[salata] % len(pool)])
        any_dish = gen + red
        pre, post = LUN_ROT[w % 2]; pre2, post2 = LUN_ROT[(w + 1) % 2]
        days = [
         [('Colazione', col()), ('Pranzo', fx('f_piadina1')), ('Cena · 18:45', rec(mod)), ('Pre-calcio · 20:45', fx(pre)), ('Dopo calcio · 23:15', fx('f_post_s' if ph == 's' else post))],
         [('Colazione', col()), ('Pranzo', pick(leg)), ('Spuntino', rec(snacks[(w - 7) % len(snacks)])), ('Cena', pick(fish)), ('Dopo i pesi', fx('f_shake'))],
         # quarto pesce a settimane alterne, a pranzo: le linee guida per il cut arrivano a 3-4
         [('Colazione', col()), ('Pranzo', pick(fish) if w % 2 == 0 else pick(any_dish)), ('Spuntino', fx('f_edamame') if w % 2 else rec(humm)), ('Cena', fx('mcd') if not nosg else pick(gen))],
         [('Colazione', col()), ('Pranzo', pick(any_dish)), ('Cena · 18:45', rec(thd)), ('Pre-calcio · 20:45', fx(pre2)), ('Dopo calcio · 23:15', fx('f_post_s' if ph == 's' else post2))],
         [('Colazione', col()), ('Pranzo', pick(any_dish)), ('Cena', pick(fish)), ('Dopo allenamento', fx('f_shake'))] + ([] if nosg else [('Uscita', fx('drinks2'))]),
         [('Colazione', fx('f_gocciole4') if not nosg else col()), ('Pranzo', fx('f_cavallo_s' if ph == 's' else 'cavallo')), ('Spuntino', fx('f_edamame')), ('Cena', pick(fish)), ('Dopo i pesi', fx('f_shake'))],
         [('Colazione', fx('f_gocciole4') if not nosg else col()), ('Pranzo', fx('f_mamma_s' if nosg else 'mamma')), ('Cena', fx('pizza') if not nosg else pick(gen))],
        ]
        for d, day in enumerate(days):
            if d == 6 and not nosg: day.insert(2, ('Spuntino', fx('f_shake0')))
            lack = lambda D: sum(m['fv'] for _, m in D) < 400 or sum(m['fib'] for _, m in D) < 25
            if lack(day):
                day.append(('Contorno', fx('f_contorno')))
                if lack(day): day[-1] = ('Contorno', fx('f_contorno2'))
        W.append(days)
    return W

PMIN = [150, 150, 130, 150, 150, 150, 120]
def score(W):
    bad = 0
    for wk in W:
        for d, day in enumerate(wk):
            bad += max(0, PMIN[d] - sum(m['p'] for _, m in day)) + 2 * max(0, 25 - sum(m['fib'] for _, m in day)) + max(0, 400 - sum(m['fv'] for _, m in day)) / 20
            bad += max(0, sum(m['kcal'] for _, m in day) - 2750) / 10
    return bad

best = None
for s in range(800):
    try: W = build(s)
    except (ValueError, StopIteration): continue
    x = score(W)
    if best is None or x < best[0]: best = (x, s, W)
print('seed', best[1], 'penalita', round(best[0], 1)); W = best[2]

DN = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
SALE = re.compile(r'McDonald|Pizza|cocktail|Gocciole')
weeks = []; usati = collections.Counter()
for i, wk in enumerate(W):
    n = i + 7; days = []; totali = []
    for d, day in enumerate(wk):
        k = sum(m['kcal'] for _, m in day); p = sum(m['p'] for _, m in day); totali.append((k, p, sum(m['fib'] for _, m in day), sum(m['fv'] for _, m in day)))
        note = None
        if d == 0 and n == 14: note = 'Supercut, dal 28/12: meno cereali e condimenti, stesse proteine. Gli sgarri restano ancora per questa settimana.'
        if d == 0 and n == 15: note = 'Ultime due settimane: niente McDonald’s, pizza, cocktail e Gocciole.'
        if d in (0, 3) and note is None: note = 'Calcio alle 21:30: i carboidrati stanno nella cena delle 18:45 e nel pre-partita. Creatina a fine partita, nello shake.'
        days.append({'day': DN[d], 'target': round(k / 50) * 50, 'note': note, 'slots': [{'id': m['id'], 'label': l, 'meal': next(x for x in DISHES if x['id'] == m['id'] and x['phase'] == m['phase'])['meal'] if not m['fisso'] else m['meal'], 'image': (f"/recipes/{m['id']}.webp" if not m['fisso'] else m['image']), 'family': m.get('fam'), 'phase': m.get('phase')} for l, m in day]})
        for _, m in day:
            if not m['fisso']: usati[m['id']] += 1
    meals = [m for day in wk for _, m in day]
    pesce = sum(m['pesce'] for m in meals); rossa = sum(m['red'] for m in meals); tonno = sum(m['tuna'] for m in meals); legd = sum(any(m['leg'] for _, m in day) for day in wk)
    avg = round(sum(t[0] for t in totali) / 7)
    whey = sum(1 for m in meals if not m['fisso'] and is_sweet(m['r']))
    costo = sum(m['r']['costo_euro'] for m in meals if not m['fisso'])
    print(n, 'media', avg, 'P', round(sum(t[1] for t in totali) / 7), 'min kcal', min(t[0] for t in totali), 'min P', min(t[1] for t in totali), '| fib<25', sum(t[2] < 25 for t in totali), 'fv<400', sum(t[3] < 400 for t in totali), '| pesce', pesce, 'rossa', rossa, 'tonno', tonno, 'legumi', legd, 'whey', whey, '| ricette €', round(costo))
    assert 3 <= pesce <= 4 and rossa <= 3 and tonno <= 1 and legd >= 3 and whey >= 4, f'settimana {n}'
    for d in (1, 4): assert any(m['pesce'] and l == 'Cena' for l, m in wk[d]), f'sett {n}: manca il pesce a {DN[d]}'
    for d in (0, 3): assert not any(m['leg'] for l, m in wk[d] if l.startswith('Cena')), 'legumi prima del calcio'
    if n >= 15: assert not SALE.search(' '.join(m.get('nome') or m['meal'] for m in meals)), f'sgarro in settimana {n}'
    weeks.append(days)

assert len({x['meal'] for x in DISHES}) == len(DISHES), 'due piatti con lo stesso testo'
assert not [x for x in DISHES if x['phase'] and re.search(r'\d+\s*(g|ml)\b', ' '.join(x['steps'][:-1]))], 'grammi nei passi: le dosi cambiano con la fase'
print('ricette', len(R), 'usate nel calendario', len(usati), 'piu ripetuta', usati.most_common(1)[0], 'piatti scartati per una fase', SCARTATI[:12])
fam = collections.Counter((x['family'], x['phase']) for x in DISHES if x['family'])
print('famiglie', sorted(fam.items()))
out = '// Generato da scripts/menu/sedici/genera.py: non modificare a mano.\n// kcal e proteine sono stime da valori medi CREA/USDA sulle dosi scritte.\n'
out += 'export const menu16Weeks = ' + json.dumps(weeks, ensure_ascii=False) + ';\n'
out += 'export const menu16Dishes = ' + json.dumps(DISHES, ensure_ascii=False, separators=(',', ':')).replace('},{"id"', '},\n{"id"') + ';\n'
open(f'{ROOT}/src/data/menu16.js', 'w').write(out)
print('scritto', round(len(out) / 1024), 'KB')

# ── Dose «massa»: stesse ricette e stessi giorni del calendario, per chi mette massa ──
# Salgono solo le fonti di carboidrati e poco i grassi; le proteine restano. Spezie e condimenti non si toccano.
MASSA = {'colazione': 600, 'spuntino': 300, 'piatto': 850, 'pesce': 850, 'pollo-riso-lun': 950, 'cena-calcio': 950}
K_MASSA = 2.2  # oltre, il piatto cambia natura: meglio il pane a parte
MENO_PROTEINE = .65  # le ricette sono pensate per un taglio: per la massa bastano 1,6-2,2 g/kg (Morton 2018)
UOVA = re.compile(r'uov|albume', re.I)
OBIETTIVO_PESI, OBIETTIVO_RIPOSO = 3200, 3000

def scala_massa(items, k):
    out = []
    for n, g in items:
        v = U.get(n)
        if v and v[0] >= 60 and g >= 15 and not UOVA.search(n):
            if v[1] * 4 / v[0] >= .5: g = max(15, round(g * MENO_PROTEINE / 5) * 5)
            elif v[3] * 4 / v[0] >= .5: g = max(5, round(g * (min(k, 1.5) if 'patat' in n.lower() else k) / 5) * 5)  # patate: oltre è troppo volume, il resto lo fa il pane
            elif v[2] * 9 / v[0] >= .6: g = round(g * min(k, 1.3))
        out.append([n, g])
    return out

def adatta_massa(items, target, side):
    lo, hi = .8, K_MASSA
    for _ in range(14):
        k = (lo + hi) / 2
        if macro(scala_massa(items, k))['kcal'] > target: hi = k
        else: lo = k
    it = scala_massa(items, lo)
    manca = target - macro(it)['kcal']
    if manca > 30:  # shortcut: il contorno è sempre lo stesso per tipo di piatto, basta per arrivare alle calorie
        g = round(manca / U[side][0] * 100 / 10) * 10
        if g: it = it + [[side, g]]
    return it

SIDE = {'colazione': 'Banana', 'spuntino': 'Banana', 'piatto': 'pane rustico', 'pesce': 'pane rustico', 'pollo-riso-lun': 'pane rustico', 'cena-calcio': 'pane rustico'}
MASSA_DISHES, A_FIT = [], {}
for r in R.values():
    t = tipo(r); items = adatta_massa(r['porzione_g'], MASSA[t], SIDE[t]); m = macro(items)
    if abs(m['kcal'] - MASSA[t]) > TOLL: SCARTATI.append((r['id'], 'a', m['kcal'])); continue
    base = next(x for x in DISHES if x['id'] == r['id'])
    A_FIT[r['id']] = {'id': r['id'], 'nome': r['titolo'], 'porz': items, **m, 'r': r}
    MASSA_DISHES.append({**base, 'phase': 'a', 'meal': testo(r['titolo'], items), 'kcal': m['kcal'], 'protein': m['p'], 'fat': m['f'], 'carbs': m['c'], 'fiber': m['fib'], 'fv': m['fv'], 'dose': items})

# Pasti fissi con le sue dosi: nome, testo, kcal, proteine, fibre, frutta e verdura, ingredienti, passi. Valori stimati come quelli sopra.
FISSI_MASSA = {
 'a_piadina': ('2 piadine col tacchino', '2 piadine col tacchino: 2 piadine, fesa di tacchino 120 g, mozzarella light 80 g, insalata e pomodoro', 850, 50, 7, 80, ['2 piadine', 'Fesa di tacchino 120 g', 'Mozzarella light 80 g', 'Insalata e pomodoro'], ['Scalda le piadine in padella, farcisci e chiudi.']),
 'a_gocciole': ('Latte e 6 Gocciole', 'Latte e 6 Gocciole: latte parzialmente scremato 300 ml con proteine 25 g, 6 Gocciole e un frutto', 600, 34, 6, 160, ['Latte parzialmente scremato 300 ml', 'Whey 25 g', '6 Gocciole', '1 frutto'], ['Sciogli le proteine nel latte freddo, poi Gocciole e frutto.']),
 'a_cavallo': ('Pasta e cavallo, dose massa', 'Pasta bianca 150 g cruda con olio EVO 15 g + carne di cavallo 150 g + verdure', 960, 55, 8, 200, ['Pasta 150 g', 'Olio EVO 15 g', 'Carne di cavallo 150 g', 'Verdure 200 g'], ['Cuoci la pasta, scotta la carne e condisci con olio a crudo.']),
 'a_mamma': ('Dalla mamma, dose massa', 'Pranzo dalla mamma: un piatto abbondante di primo, un secondo con verdure e pane', 1100, 50, 8, 200, ['Primo abbondante', 'Secondo di carne o pesce', 'Verdure', 'Pane'], ['Goditelo: oggi il bis di primo è previsto.']),
 'a_shake': ('Shake, banana e creatina', 'Shake di whey 25 g con latte parzialmente scremato 300 ml + banana + creatina 3–5 g a fine allenamento', 340, 29, 3, 120, ['Whey 25 g', 'Latte parzialmente scremato 300 ml', '1 banana', 'Creatina monoidrata 3–5 g'], ['Frulla o agita, poi mangia la banana.']),
}
for fid, (title, meal, kc, p, fib, fv, ing, steps) in FISSI_MASSA.items():
    MASSA_DISHES.append({'id': fid, 'phase': None, 'meal': meal, 'title': title, 'time': '5 min', 'kcal': kc, 'protein': p, 'fiber': fib, 'fv': fv, 'family': None, 'image': None, 'ingredients': ing, 'steps': steps})

# Lo spuntino in più che fa la differenza: 3 scelte equivalenti, si cambiano tra loro come le altre alternative
EXTRA = {
 'extra-yogurt-avena': ('Coppa di yogurt greco, avena e banana', [['Yogurt greco 0%', 150], ["Fiocchi d'avena", 60], ['Banana', 120], ['miele', 15]], ['Mescola yogurt e avena, taglia la banana sopra, finisci col miele.']),
 'extra-panino-tacchino': ('Panino al tacchino e un frutto', [['pane rustico', 110], ['fesa di tacchino a fette', 50], ['mandorle', 10], ['Banana', 100]], ['Farcisci il pane col tacchino; mandorle e banana a parte.']),
 'extra-latte-mandorle': ('Latte, mandorle e avena', [['Latte parzialmente scremato', 300], ['mandorle', 25], ["Fiocchi d'avena", 40], ['Banana', 100]], ['Avena nel latte per 5 minuti, mandorle e banana sopra.']),
}
for eid, (title, items, steps) in EXTRA.items():
    m = macro(items)
    A_FIT[eid] = {'id': eid, 'nome': title, 'porz': items, **m, 'r': None}
    MASSA_DISHES.append({'id': eid, 'phase': 'a', 'meal': testo(title, items), 'title': title, 'cuisine': None, 'why': 'Calorie facili da mangiare, senza appesantire i piatti.', 'time': '5 min', 'prepMin': 0, 'freezer': False, 'kcal': m['kcal'], 'protein': m['p'], 'fat': m['f'], 'carbs': m['c'], 'fiber': m['fib'], 'fv': m['fv'], 'cost': 2, 'family': 'extra', 'whey': False, 'image': None, 'dose': items, 'steps': steps})
EXTRA_IDS = list(EXTRA)

visti_a = {x['meal'] for x in DISHES}
for x in MASSA_DISHES:
    if x['meal'] in visti_a: x['meal'] += ' · dosi massa'
    visti_a.add(x['meal'])

MAP_FISSI = {'f_piadina1': 'a_piadina', 'f_gocciole4': 'a_gocciole', 'cavallo': 'a_cavallo', 'f_cavallo_s': 'a_cavallo', 'mamma': 'a_mamma', 'f_mamma_s': 'a_mamma'}
TOGLI = re.compile(r'^(pre_|post_|f_post_s|drinks2|f_shake$|f_contorno)')
PESI = (1, 3, 5)  # martedì, giovedì, sabato
BY_FIT = lambda i: next((x for x in MASSA_DISHES if x['id'] == i and x['phase'] == 'a'), None)
FIX_A = {x['id']: x for x in MASSA_DISHES if x['phase'] is None}
massa_weeks = []; tot_a = []
for i, wk in enumerate(W):
    days = []
    for d, day in enumerate(wk):
        slots = []
        for label, m in day:
            label = label.split(' · ')[0]
            if m['fisso']:
                if TOGLI.match(m['id']): continue
                fid = MAP_FISSI.get(m['id'], m['id'])
                if fid in FIX_A:
                    x = FIX_A[fid]; slots.append({'id': fid, 'label': label, 'meal': x['meal'], 'image': None, 'kcal': x['kcal'], 'p': x['protein'], 'fib': x['fiber'], 'fv': x['fv'], 'family': None, 'phase': None})
                else: slots.append({'id': m['id'], 'label': label, 'meal': m['meal'], 'image': m['image'], 'kcal': m['kcal'], 'p': m['p'], 'fib': m['fib'], 'fv': m['fv'], 'family': None, 'phase': None})
            else:
                x = BY_FIT(m['id'])
                if not x: raise SystemExit(f"ricetta senza dose massa nel calendario: {m['id']}")
                slots.append({'id': x['id'], 'label': label, 'meal': x['meal'], 'image': x['image'], 'kcal': x['kcal'], 'p': x['protein'], 'fib': x['fiber'], 'fv': x['fv'], 'family': x['family'], 'phase': 'a'})
        if d in PESI:
            x = FIX_A['a_shake']; slots.append({'id': 'a_shake', 'label': 'Dopo i pesi', 'meal': x['meal'], 'image': None, 'kcal': x['kcal'], 'p': x['protein'], 'fib': x['fiber'], 'fv': x['fv'], 'family': None, 'phase': None})
        obiettivo = OBIETTIVO_PESI if d in PESI else OBIETTIVO_RIPOSO
        for n in range(2):  # lo spuntino in più entra solo se avvicina il giorno all'obiettivo
            x = BY_FIT(EXTRA_IDS[(i + d + n) % len(EXTRA_IDS)]); now = sum(s['kcal'] for s in slots)
            if abs(now + x['kcal'] - obiettivo) >= abs(now - obiettivo): break
            slots.append({'id': x['id'], 'label': 'Extra massa' + (' 2' if n else ''), 'meal': x['meal'], 'image': None, 'kcal': x['kcal'], 'p': x['protein'], 'fib': x['fiber'], 'fv': x['fv'], 'family': 'extra', 'phase': 'a'})
        fib = sum(s['fib'] for s in slots); fv = sum(s['fv'] for s in slots)
        if fib < 25 or fv < 400:
            c = 'f_contorno' if fib + 8 >= 25 and fv + 350 >= 400 else 'f_contorno2'; o = fx(c)
            slots.append({'id': c, 'label': 'Contorno', 'meal': o['meal'], 'image': None, 'kcal': o['kcal'], 'p': o['p'], 'fib': o['fib'], 'fv': o['fv'], 'family': None, 'phase': None})
        k = sum(s['kcal'] for s in slots); p = sum(s['p'] for s in slots); f = sum(s['fib'] for s in slots); v = sum(s['fv'] for s in slots)
        tot_a.append((i, d, k, p, f, v, sum((BY_FIT(s['id']) or {}).get('fat', 0) for s in slots)))
        days.append({'day': DN[d], 'target': round(k / 50) * 50, 'note': 'Giorno di pesi: i carboidrati prima e lo shake subito dopo.' if d in PESI else None,
                     'slots': [{k2: s[k2] for k2 in ('id', 'label', 'meal', 'image', 'family', 'phase')} for s in slots]})
    massa_weeks.append(days)

assert not [x for x in SCARTATI if x[1] == 'a'], 'ricetta senza dose massa'
assert len({x['meal'] for x in MASSA_DISHES}) == len(MASSA_DISHES), 'due piatti massa con lo stesso testo'
ks = [t[2] for t in tot_a]; ps = [t[3] for t in tot_a]
print('massa: kcal media', round(sum(ks) / len(ks)), 'min', min(ks), 'max', max(ks), '| proteine media', round(sum(ps) / len(ps)), 'min', min(ps), 'max', max(ps), '| fib<25', sum(t[4] < 25 for t in tot_a), 'fv<400', sum(t[5] < 400 for t in tot_a), '| testi con suffisso', sum(' · dosi massa' in x['meal'] for x in MASSA_DISHES))
big = sorted((x for x in MASSA_DISHES if x.get('dose')), key=lambda x: -max(g for _, g in x['dose']))[:6]
print('dosi piu grandi', [(x['id'][:18], *max(x['dose'], key=lambda d: d[1])) for x in big])
print('con pane a parte', sum(any(n == 'pane rustico' for n, _ in x['dose']) for x in MASSA_DISHES if x.get('dose') and x['family'] != 'extra'), 'con banana', sum(any(n == 'Banana' for n, _ in x['dose']) for x in MASSA_DISHES if x.get('dose') and x['family'] != 'extra'))
out = '// Generato da scripts/menu/sedici/genera.py: non modificare a mano.\n// Le stesse ricette di menu16.js con le dosi per mettere massa. kcal e proteine sono stime.\n'
out += 'export const massaWeeks = ' + json.dumps(massa_weeks, ensure_ascii=False) + ';\n'
out += 'export const massaDishes = ' + json.dumps(MASSA_DISHES, ensure_ascii=False, separators=(',', ':')).replace('},{"id"', '},\n{"id"') + ';\n'
open(f'{ROOT}/src/data/menuMassa.js', 'w').write(out)
print('scritto massa', round(len(out) / 1024), 'KB')

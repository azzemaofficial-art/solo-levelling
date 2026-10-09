// Menu di Emanuele: tabella nutrizionale e grammi di ogni ricetta (fonte dei valori kcal, proteine,
// fibre e frutta/verdura scritti in src/data/mealRecipes.js). Per cambiare il menu: modifica qui,
// poi `node scripts/menu/cerca-calendario.mjs` (cerca l'ordine delle 6 settimane che rispetta tutte
// le regole) e `node scripts/menu/controlla-calendario.mjs` (verifica giorno per giorno).
// Tabella nutrizionale (per 100 g, crudo salvo indicazione; valori medi CREA/USDA):
// [kcal, proteine, grassi, carboidrati, fibre, gruppo]
// gruppi: v = verdura, f = frutta, l = legumi, n = frutta secca/semi, p = pesce, r = carne rossa,
//         k = carne lavorata, g = cereale integrale, x = altro
export const DB = {
  riso: [358, 7, 0.6, 79, 1.3, 'x'], risoVenere: [350, 8, 2.5, 75, 4, 'g'], risoInt: [350, 7.5, 2.7, 73, 3.5, 'g'], pasta: [355, 12.5, 1.5, 71, 3, 'x'], pastaInt: [340, 13, 2.5, 64, 8, 'g'],
  noodlesRiso: [360, 6, 0.6, 82, 1.6, 'x'], ramen: [350, 11, 1.5, 72, 3, 'x'], soba: [340, 14, 1, 71, 4, 'g'], udon: [130, 3.5, 0.5, 27, 1.2, 'x'],
  gnocchi: [150, 4, 0.3, 33, 1.6, 'x'], farro: [335, 15, 2.5, 67, 7, 'g'], avena: [370, 13, 7, 59, 10, 'g'], farina: [350, 11, 1, 73, 2.2, 'x'],
  paneInt: [245, 9, 3, 41, 7, 'g'], pane: [270, 9, 1.5, 55, 3, 'x'], paneCassetta: [270, 8, 4, 50, 3, 'x'], bagel: [260, 10, 1.5, 51, 2.3, 'x'],
  tortilla: [300, 8, 7, 50, 3, 'x'], piadina: [320, 8, 10, 50, 3, 'x'], piadinaInt: [300, 9, 9, 45, 6, 'g'], gallette: [380, 8, 3, 80, 4, 'g'],
  cornflakes: [370, 7, 0.9, 84, 3, 'x'], granola: [450, 10, 15, 64, 8, 'g'], muesli: [360, 10, 6, 62, 8, 'g'], panko: [370, 12, 4, 72, 3, 'x'],
  cracker: [420, 11, 13, 63, 9, 'g'], digestive: [470, 7, 20, 64, 3.5, 'x'],
  pataDolce: [86, 1.6, 0.1, 20, 3, 'x'], patate: [77, 2, 0.1, 17, 2.2, 'x'],
  banana: [89, 1.1, 0.3, 23, 2.6, 'f'], mela: [52, 0.3, 0.2, 14, 2.4, 'f'], kiwi: [61, 1.1, 0.5, 15, 3, 'f'], bosco: [50, 1, 0.4, 11, 5, 'f'],
  mango: [60, 0.8, 0.4, 15, 1.6, 'f'], fragole: [32, 0.7, 0.3, 8, 2, 'f'], pera: [57, 0.4, 0.1, 15, 3.1, 'f'], avocado: [160, 2, 15, 9, 7, 'f'], limone: [29, 1, 0.3, 9, 2.8, 'f'],
  miele: [304, 0.3, 0, 82, 0, 'x'], acero: [260, 0, 0, 67, 0, 'x'], zucchero: [390, 0, 0, 100, 0, 'x'], marmellata: [220, 0.5, 0, 55, 1, 'x'],
  cacao: [230, 20, 14, 58, 33, 'x'], fondente: [600, 10, 46, 30, 11, 'x'], cocco: [660, 6, 64, 24, 16, 'n'],
  skyr: [63, 11, 0.2, 4, 0, 'x'], greco: [65, 10, 1, 4, 0, 'x'], latteScr: [34, 3.4, 0.1, 5, 0, 'x'], latte: [46, 3.3, 1.6, 5, 0, 'x'],
  spalmabile: [155, 7, 12, 5, 0, 'x'], feta: [265, 14, 21, 4, 0, 'x'], cheddar: [400, 25, 33, 1, 0, 'x'], parmigiano: [390, 33, 28, 0, 0, 'x'],
  mozzLight: [165, 20, 9, 1.5, 0, 'x'], ricottaMagra: [110, 9, 6, 4, 0, 'x'],
  whey: [380, 78, 5, 8, 0, 'x'], uovo: [127, 12.4, 9, 0.7, 0, 'x'], albume: [48, 11, 0.2, 0.7, 0, 'x'],
  pollo: [110, 23.3, 1.5, 0, 0, 'x'], tacchino: [107, 24, 1, 0, 0, 'x'], tacchinoAff: [100, 21, 1.5, 1, 0, 'k'], macTacchino: [110, 21, 2.5, 0, 0, 'x'],
  manzo: [130, 22, 4.5, 0, 0, 'r'], lonza: [146, 21, 6.5, 0, 0, 'r'], macManzo: [125, 21, 5, 0, 0, 'r'], cavallo: [120, 21, 4, 0.5, 0, 'r'], bresaola: [150, 32, 2.6, 0.5, 0, 'k'],
  salmone: [200, 20, 13, 0, 0, 'p'], salmoneAff: [117, 18, 4.5, 0, 0, 'p'], tonnoFresco: [110, 24, 1, 0, 0, 'p'], tonnoNat: [105, 25, 0.8, 0, 0, 'p'],
  gamberi: [85, 18, 1, 0.5, 0, 'p'], sgombro: [190, 20, 12, 0, 0, 'p'], merluzzo: [80, 18, 0.7, 0, 0, 'p'], branzino: [100, 20, 2, 0, 0, 'p'],
  edamame: [125, 11, 5, 9, 5, 'l'], fagioli: [100, 7, 0.5, 17, 6.5, 'l'], ceci: [130, 7, 2, 20, 6, 'l'], piselli: [80, 5.5, 0.4, 14, 5, 'l'], lenticchie: [115, 9, 0.4, 20, 8, 'l'],
  tofu: [130, 14, 7.5, 2, 1, 'l'], mais: [85, 3, 1.2, 17, 2, 'v'],
  arachidi: [600, 26, 49, 16, 8.5, 'n'], burroArachidi: [600, 25, 50, 20, 6, 'n'], noci: [680, 15, 65, 14, 6.7, 'n'], pistacchi: [600, 20, 45, 28, 10, 'n'],
  cremaPistacchio: [600, 20, 50, 20, 8, 'n'], sesamo: [570, 18, 50, 23, 12, 'n'], mandorle: [600, 21, 50, 22, 12, 'n'],
  olio: [900, 0, 100, 0, 0, 'x'], olioSesamo: [884, 0, 100, 0, 0, 'x'], pesto: [450, 5, 45, 6, 2, 'x'],
  soia: [60, 8, 0, 6, 0.8, 'x'], miso: [200, 12, 6, 26, 5, 'x'], curryPolvere: [325, 13, 14, 55, 33, 'x'], mirin: [260, 0, 0, 43, 0, 'x'],
  ostrica: [100, 2, 0.3, 22, 0.3, 'x'], amido: [350, 0, 0, 88, 0.9, 'x'], tonkatsu: [130, 1, 0.2, 30, 0.6, 'x'], maioLight: [300, 1, 30, 6, 0, 'x'],
  hoisin: [220, 3, 3, 44, 3, 'x'], senape: [100, 6, 6, 6, 3, 'x'],
  passata: [25, 1.3, 0.2, 4, 1.3, 'v'], verdure: [25, 1.5, 0.3, 4, 2, 'v'], spinaci: [23, 2.9, 0.4, 3.6, 2.2, 'v'], broccoli: [34, 2.8, 0.4, 7, 2.6, 'v'],
  funghi: [22, 3, 0.3, 3, 1, 'v'], cipollotto: [32, 1.8, 0.2, 7, 2.6, 'v'], cipolla: [40, 1, 0.1, 9, 1.7, 'v'], germogli: [30, 3, 0.2, 6, 1.8, 'v'],
  cavolo: [25, 1.3, 0.1, 6, 2.5, 'v'], fagiolini: [31, 1.8, 0.2, 7, 2.7, 'v'],
};
// pezzi o piatti fuori casa: [kcal, proteine, grassi, carboidrati, fibre]
export const FIXED = {
  gocciola: [59, 0.8, 2.6, 7.7, 0.3],
  mcd: [850, 30, 38, 95, 6], // panino medio + patatine piccole/medie + bibita zero
  pizza: [1000, 40, 33, 135, 8], // pizza a scelta + insalata
  drinks2: [375, 0, 0, 25, 0], // 2 cocktail: il resto delle calorie è alcol
  mamma: [800, 45, 28, 90, 8], // pranzo della domenica dalla mamma: primo normale + secondo + verdure, niente bis
};

// Ricette del menu (id di cutPlan.js) → ingredienti in grammi
export const RECIPES = {
  // colazioni
  oats: [['skyr', 250], ['avena', 60], ['bosco', 100], ['pistacchi', 15]],
  waffle: [['uovo', 110], ['avena', 50], ['cacao', 8], ['greco', 150], ['bosco', 100], ['acero', 10], ['fondente', 10]],
  toast: [['paneInt', 100], ['uovo', 110], ['ricottaMagra', 100], ['verdure', 120]],
  piadina: [['piadinaInt', 75], ['tacchinoAff', 130], ['spalmabile', 30], ['spinaci', 30]],
  french: [['paneCassetta', 100], ['uovo', 110], ['greco', 150], ['fragole', 150], ['latte', 30]],
  yogurtBowl: [['greco', 250], ['muesli', 60], ['kiwi', 150], ['noci', 15]],
  b_pancake: [['avena', 50], ['uovo', 55], ['albume', 150], ['banana', 60], ['greco', 100], ['bosco', 80], ['acero', 10]],
  b_toastPB: [['paneInt', 70], ['burroArachidi', 15], ['banana', 80], ['skyr', 200]],
  b_choco: [['avena', 50], ['latte', 150], ['skyr', 150], ['cacao', 8], ['banana', 60], ['burroArachidi', 10]],
  b_bagel: [['bagel', 90], ['salmoneAff', 60], ['spalmabile', 40], ['cipollotto', 15], ['skyr', 150], ['miele', 5]],
  b_omelette: [['uovo', 165], ['feta', 30], ['cipollotto', 30], ['paneInt', 60], ['verdure', 100]],
  b_mango: [['skyr', 300], ['mango', 150], ['banana', 60], ['granola', 30], ['cocco', 5]],
  b_porridge: [['avena', 60], ['latte', 200], ['skyr', 150], ['mela', 150], ['noci', 10]],
  b_sweetPancake: [['pataDolce', 105], ['avena', 40], ['uovo', 55], ['albume', 120], ['greco', 100], ['acero', 10]],
  b_tamago: [['paneCassetta', 80], ['uovo', 165], ['greco', 50], ['cipollotto', 10], ['kiwi', 75]],
  b_jianbing: [['farina', 50], ['uovo', 110], ['tacchino', 80], ['cipollotto', 15], ['hoisin', 10], ['verdure', 30]],
  b_gocciole: [['latteScr', 250], ['whey', 25], ['gocciola', 8], ['pera', 160]],
  // pranzi
  riceBowl: [['risoInt', 100], ['pollo', 170], ['verdure', 200], ['olio', 10], ['soia', 10]],
  pastaTonno: [['pastaInt', 70], ['tonnoNat', 140], ['ceci', 60], ['verdure', 180]],
  poke: [['riso', 100], ['salmone', 150], ['edamame', 100], ['verdure', 120], ['soia', 10], ['sesamo', 5]],
  wrapSmash: [['tortilla', 100], ['macManzo', 160], ['verdure', 80], ['greco', 50]],
  farro: [['farro', 100], ['sgombro', 120], ['fagioli', 100], ['verdure', 150]],
  pesto: [['pastaInt', 90], ['pesto', 20], ['pollo', 150], ['fagiolini', 150]],
  l_sweetBowl: [['pataDolce', 250], ['pollo', 160], ['avocado', 50], ['spinaci', 40], ['greco', 50], ['olio', 5]],
  l_beefNoodles: [['noodlesRiso', 80], ['manzo', 150], ['verdure', 200], ['cipollotto', 30], ['olioSesamo', 8], ['soia', 15]],
  l_venere: [['risoVenere', 80], ['gamberi', 150], ['edamame', 80], ['avocado', 40], ['verdure', 80], ['sesamo', 5], ['soia', 10]],
  l_crispyBun: [['pane', 100], ['pollo', 150], ['panko', 15], ['greco', 60], ['miele', 5], ['cavolo', 60], ['olio', 5]],
  l_coldPasta: [['pastaInt', 90], ['tonnoNat', 140], ['mais', 50], ['verdure', 100], ['cipollotto', 20], ['olio', 10]],
  l_burrito: [['risoInt', 80], ['macTacchino', 160], ['fagioli', 100], ['mais', 40], ['verdure', 80], ['greco', 40], ['avocado', 40]],
  l_gyudon: [['riso', 90], ['manzo', 150], ['cipolla', 80], ['uovo', 55], ['soia', 15], ['mirin', 15], ['cipollotto', 15], ['verdure', 100]],
  l_salad: [['pollo', 180], ['verdure', 200], ['avocado', 40], ['mais', 40], ['ceci', 60], ['pane', 20], ['olio', 5]],
  l_katsu: [['pollo', 170], ['panko', 20], ['albume', 20], ['riso', 80], ['cavolo', 150], ['tonkatsu', 15]],
  l_oyakodon: [['riso', 90], ['pollo', 160], ['uovo', 110], ['cipolla', 60], ['soia', 15], ['mirin', 10], ['cipollotto', 10], ['spinaci', 100]],
  l_kimbap: [['riso', 90], ['tonnoNat', 120], ['uovo', 55], ['verdure', 120], ['sesamo', 3], ['olioSesamo', 3]],
  l_bulgogi: [['riso', 80], ['manzo', 150], ['pera', 30], ['soia', 15], ['miele', 5], ['sesamo', 3], ['verdure', 140], ['olioSesamo', 4]],
  // spuntini
  skyrSalato: [['skyr', 170], ['cracker', 50], ['verdure', 150]],
  bresaola: [['pane', 80], ['bresaola', 80], ['verdure', 30], ['limone', 10]],
  fiocchi: [['mozzLight', 125], ['verdure', 150], ['pane', 40]], // caprese light
  edamame: [['edamame', 150], ['mela', 150]],
  yogurtCacao: [['greco', 170], ['cacao', 5], ['pistacchi', 15]],
  toastTacchino: [['paneCassetta', 70], ['tacchinoAff', 80], ['senape', 5]],
  s_skyrFruit: [['skyr', 170], ['mela', 150], ['mandorle', 15]],
  s_yogurtNoci: [['greco', 170], ['noci', 15], ['miele', 5], ['bosco', 50]],
  s_pudding: [['skyr', 200], ['cacao', 8], ['miele', 10], ['fondente', 10]],
  s_onigiri: [['riso', 50], ['tonnoNat', 70], ['greco', 15], ['cipollotto', 5]],
  // cene
  d_teriyaki: [['pollo', 200], ['riso', 80], ['broccoli', 150], ['soia', 20], ['miele', 12], ['sesamo', 5], ['cipollotto', 15], ['olio', 5]],
  d_bibimbap: [['riso', 80], ['manzo', 130], ['uovo', 55], ['spinaci', 100], ['verdure', 160], ['soia', 10], ['miele', 5], ['olioSesamo', 7], ['sesamo', 3]],
  d_miso: [['salmone', 180], ['pataDolce', 250], ['verdure', 150], ['miso', 10], ['miele', 8], ['olio', 5]],
  d_friedRice: [['riso', 80], ['gamberi', 180], ['uovo', 110], ['piselli', 60], ['verdure', 50], ['cipollotto', 30], ['soia', 15], ['olioSesamo', 8]],
  d_ramen: [['ramen', 80], ['pollo', 160], ['uovo', 55], ['funghi', 80], ['verdure', 100], ['mais', 30], ['miso', 15], ['soia', 10], ['cipollotto', 20], ['sesamo', 3]],
  d_beefBroccoli: [['manzo', 150], ['broccoli', 200], ['riso', 75], ['soia', 15], ['ostrica', 10], ['amido', 5], ['olio', 7]],
  d_curryJap: [['pollo', 180], ['patate', 150], ['verdure', 100], ['cipolla', 80], ['curryPolvere', 6], ['farina', 10], ['riso', 60], ['olio', 5]],
  d_bulgogiTacos: [['tortilla', 90], ['pollo', 180], ['soia', 15], ['pera', 20], ['miele', 5], ['cavolo', 120], ['greco', 50], ['cipollotto', 15], ['sesamo', 3]],
  d_loaded: [['pataDolce', 300], ['olio', 5], ['macManzo', 150], ['fagioli', 80], ['cheddar', 20], ['greco', 50], ['cipollotto', 15], ['verdure', 60]],
  d_tataki: [['tonnoFresco', 160], ['sesamo', 10], ['soba', 70], ['edamame', 60], ['verdure', 80], ['soia', 15], ['olioSesamo', 5]],
  d_padthai: [['noodlesRiso', 75], ['pollo', 160], ['uovo', 55], ['germogli', 80], ['arachidi', 12], ['soia', 15], ['zucchero', 8], ['cipollotto', 20], ['olio', 7]],
  d_smash: [['macManzo', 180], ['pataDolce', 300], ['olio', 10], ['greco', 50], ['verdure', 150]],
  d_meatballs: [['macTacchino', 180], ['panko', 15], ['cipollotto', 20], ['passata', 30], ['miele', 10], ['soia', 15], ['riso', 75], ['olio', 7], ['verdure', 100]],
  d_okonomiyaki: [['cavolo', 250], ['farina', 50], ['uovo', 110], ['albume', 100], ['pollo', 100], ['tonkatsu', 15], ['maioLight', 10], ['cipollotto', 10]],
  polloCroccante: [['pollo', 200], ['cornflakes', 20], ['albume', 30], ['pane', 90], ['verdure', 200], ['greco', 50]],
  pokeTonno: [['tonnoFresco', 170], ['riso', 90], ['avocado', 60], ['verdure', 100], ['soia', 10], ['sesamo', 3]],
  tacosFit: [['tortilla', 80], ['macTacchino', 180], ['fagioli', 120], ['verdure', 150]],
  bistecca: [['manzo', 180], ['patate', 300], ['verdure', 200], ['olio', 10]],
  // giovedì (prima del calcio)
  p_pasta: [['pasta', 110], ['passata', 150], ['tacchino', 150], ['parmigiano', 10], ['olio', 8]],
  p_gnocchi: [['gnocchi', 300], ['passata', 150], ['pollo', 140], ['olio', 5], ['parmigiano', 10]],
  p_udon: [['udon', 300], ['pollo', 150], ['spinaci', 80], ['miso', 15], ['cipollotto', 20]],
  salmoneRiso: [['salmone', 180], ['riso', 80], ['broccoli', 250], ['limone', 20]],
  // calcio
  pre_banana: [['banana', 120], ['gallette', 16], ['miele', 10]],
  pre_toast: [['pane', 50], ['marmellata', 20]],
  post_banana: [['whey', 30], ['latteScr', 250], ['banana', 120], ['gallette', 16]],
  post_yogurt: [['greco', 200], ['whey', 15], ['cornflakes', 30], ['bosco', 100]],
  post_toast: [['whey', 30], ['latteScr', 250], ['pane', 60], ['miele', 10]],
  // fissi
  cracker: [['cracker', 30]],
  piadine: [['piadina', 180], ['tacchinoAff', 140], ['mozzLight', 70], ['verdure', 80]],
  polloPiastra: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 10]],
  cavallo: [['pasta', 100], ['olio', 10], ['cavallo', 185], ['verdure', 200]],

  // ── v5 (ottobre 2026): economico, salse buone, più dolce a colazione, patate dolci solo a patatine ──
  oatsCheesecake: [['avena', 50], ['latte', 120], ['skyr', 170], ['bosco', 100], ['digestive', 15], ['miele', 5]],
  bananaBread: [['avena', 40], ['banana', 70], ['uovo', 30], ['latte', 20], ['noci', 8], ['skyr', 150], ['miele', 5]],
  l_peanutBowl: [['riso', 80], ['pollo', 160], ['cavolo', 80], ['verdure', 80], ['burroArachidi', 12], ['soia', 10], ['miele', 5], ['limone', 10]],
  l_tunaDon: [['riso', 90], ['tonnoNat', 120], ['maioLight', 10], ['greco', 20], ['cipollotto', 10], ['edamame', 60], ['soia', 5], ['verdure', 80]],
  d_cantonese: [['riso', 80], ['pollo', 150], ['uovo', 110], ['piselli', 60], ['verdure', 60], ['cipollotto', 30], ['soia', 15], ['olioSesamo', 8]],
  d_fishTacos: [['tortilla', 90], ['merluzzo', 180], ['cavolo', 120], ['greco', 60], ['limone', 10], ['verdure', 60], ['olio', 5]],
  d_fishChips: [['merluzzo', 200], ['panko', 20], ['albume', 20], ['pataDolce', 250], ['olio', 5], ['greco', 40], ['verdure', 120]],
  d_lemonChicken: [['pollo', 180], ['amido', 10], ['albume', 20], ['limone', 30], ['miele', 12], ['riso', 75], ['verdure', 150], ['olio', 7]],
  mon_kor: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 5], ['olioSesamo', 3], ['soia', 15], ['miele', 8], ['sesamo', 3], ['cipollotto', 20], ['edamame', 50]],
  mon_ginger: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 10], ['cipollotto', 30], ['soia', 10], ['edamame', 50]],
  mon_lemon: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 10], ['limone', 20], ['piselli', 60]],
  mon_teri: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 5], ['soia', 15], ['miele', 10], ['cipollotto', 15], ['edamame', 50]],
  mon_mex: [['pollo', 200], ['riso', 90], ['verdure', 260], ['olio', 7], ['limone', 10], ['fagioli', 60]],
  mon_thai: [['pollo', 200], ['riso', 90], ['verdure', 200], ['olio', 7], ['soia', 10], ['miele', 5], ['limone', 10], ['piselli', 50]],
  mamma: [['mamma', 1]],
  // v6: più pesce e salmone (anche crudo, abbattuto o congelato 96 ore a −18 °C)
  l_poke: [['riso', 80], ['salmone', 130], ['edamame', 60], ['verdure', 120], ['soia', 10], ['miele', 5], ['sesamo', 5]],
  d_chirashi: [['riso', 80], ['salmone', 140], ['verdure', 100], ['edamame', 40], ['avocado', 30], ['soia', 10], ['sesamo', 3]],
  d_salmonTeri: [['salmone', 160], ['riso', 70], ['verdure', 150], ['soia', 15], ['miele', 10], ['cipollotto', 15], ['sesamo', 3]],
  l_butadon: [['riso', 90], ['lonza', 150], ['cipolla', 80], ['uovo', 55], ['soia', 15], ['mirin', 15], ['cipollotto', 15], ['verdure', 100]],
  d_yakitori: [['pollo', 180], ['cipollotto', 60], ['soia', 15], ['mirin', 10], ['miele', 8], ['riso', 75], ['verdure', 120], ['sesamo', 3], ['olio', 5]],
  s_skyrPlain: [['skyr', 170], ['mela', 150]],
  mcd: [['mcd', 1], ['mela', 150]], pizza: [['pizza', 1]], drinks2: [['drinks2', 1]],
};

export function analyze(list) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, veg: 0, fruit: 0, legumes: 0, nuts: 0, wholeGrain: 0, fish: 0, red: 0, processed: 0 };
  for (const [name, g] of list) {
    const fx = FIXED[name];
    const v = fx ? null : DB[name];
    if (!fx && !v) throw new Error('manca ' + name);
    const [k, p, f, c, fi] = fx ? fx.map((x) => x * g) : v.slice(0, 5).map((x) => (x * g) / 100);
    t.kcal += k; t.protein += p; t.fat += f; t.carbs += c; t.fiber += fi;
    if (v) {
      const grp = v[5];
      if (grp === 'v') t.veg += g; if (grp === 'f') t.fruit += g; if (grp === 'l') t.legumes += g; if (grp === 'n') t.nuts += g;
      if (grp === 'g') t.wholeGrain += g; if (grp === 'p' && g >= 50) t.fish += 1; if (grp === 'r' && g >= 80) t.red += 1; if (grp === 'k' && g >= 40) t.processed += 1;
    }
    if (name === 'pizza') t.veg += 100; // l'insalata a lato
  }
  return t;
}

// Prezzi indicativi €/kg (supermercato/discount italiano, 2026; stime per confrontare le ricette, non listino)
export const PRICE = {
  riso: 2.5, risoInt: 3, risoVenere: 6, pasta: 1.6, pastaInt: 2.2, noodlesRiso: 8, ramen: 8, soba: 10, udon: 6, gnocchi: 3, farro: 4, avena: 2, farina: 1,
  paneInt: 4, pane: 3, paneCassetta: 4, bagel: 8, tortilla: 6, piadina: 6, piadinaInt: 7, gallette: 8, cornflakes: 4, granola: 8, muesli: 6, panko: 7, cracker: 7, digestive: 4,
  pataDolce: 3, patate: 1.5, banana: 1.8, mela: 2, kiwi: 3, bosco: 8, mango: 7, fragole: 6, pera: 2.5, avocado: 10, limone: 2.5,
  miele: 10, acero: 25, zucchero: 1.2, marmellata: 6, cacao: 15, fondente: 15, cocco: 12,
  skyr: 5, greco: 5, latteScr: 1.3, latte: 1.4, spalmabile: 9, feta: 12, cheddar: 12, parmigiano: 20, mozzLight: 9, ricottaMagra: 6,
  whey: 25, uovo: 4.5, albume: 5, pollo: 9, tacchino: 11, tacchinoAff: 18, macTacchino: 9, manzo: 15, lonza: 8, macManzo: 11, cavallo: 20, bresaola: 35,
  salmone: 22, salmoneAff: 35, tonnoFresco: 30, tonnoNat: 14, gamberi: 15, sgombro: 15, merluzzo: 10, branzino: 15,
  edamame: 6, fagioli: 3, ceci: 3, piselli: 3, lenticchie: 3, tofu: 8, mais: 4,
  arachidi: 8, burroArachidi: 8, noci: 15, pistacchi: 30, cremaPistacchio: 35, sesamo: 10, mandorle: 14,
  olio: 9, olioSesamo: 15, pesto: 12, soia: 6, miso: 12, curryPolvere: 20, mirin: 10, ostrica: 10, amido: 4, tonkatsu: 10, maioLight: 6, hoisin: 10, senape: 6,
  passata: 1.5, verdure: 2.5, spinaci: 4, broccoli: 3, funghi: 6, cipollotto: 4, cipolla: 1.5, germogli: 6, cavolo: 1.5, fagiolini: 4,
};
export const PRICE_FIXED = { gocciola: 0.06, mcd: 9, pizza: 10, drinks2: 16, mamma: 0 };
export function cost(list) {
  let e = 0;
  for (const [name, g] of list) e += PRICE_FIXED[name] != null ? PRICE_FIXED[name] * g : ((PRICE[name] ?? 5) * g) / 1000;
  return Math.round(e * 100) / 100;
}

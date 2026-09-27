// Libreria combo MMA: pugni, pugni + calci, gomiti e ginocchia, difesa e contrattacco,
// lotta. moves = id in mmaMoves.js. level: 1 base, 2 intermedio, 3 avanzato.
export const COMBO_CATEGORIES = [
  { id: 'boxing', name: 'Pugni', tone: '#6de2d3' },
  { id: 'kicks', name: 'Pugni + calci', tone: '#ffd184' },
  { id: 'clinch', name: 'Gomiti e ginocchia', tone: '#ff8fd8' },
  { id: 'defense', name: 'Difesa e contro', tone: '#8fb9ff' },
  { id: 'wrestling', name: 'Lotta', tone: '#b8a4ff' },
];

export const LEVELS = { 1: 'Base', 2: 'Intermedio', 3: 'Avanzato' };

const c = (id, category, level, name, moves, why) => ({ id, category, level, name, moves, why });

export const COMBOS = [
  // ── Pugni ──
  c('1-2', 'boxing', 1, '1-2', ['jab', 'cross'], 'La combinazione di base: il jab misura la distanza, il diretto chiude.'),
  c('1-1-2', 'boxing', 1, '1-1-2', ['jab', 'jab', 'cross'], 'Il doppio jab fa alzare la guardia e apre il diretto.'),
  c('1-2-3', 'boxing', 1, '1-2-3', ['jab', 'cross', 'hook'], 'Il gancio arriva dal lato che si scopre dopo il diretto.'),
  c('2-3-2', 'boxing', 2, '2-3-2', ['cross', 'hook', 'cross'], 'Ritmo destra-sinistra-destra: tre colpi forti con rotazione continua.'),
  c('1-2-3-2', 'boxing', 2, '1-2-3-2', ['jab', 'cross', 'hook', 'cross'], 'La combo lunga classica: finisci sempre con la mano posteriore in guardia.'),
  c('1-6-3-2', 'boxing', 3, '1-6-3-2', ['jab', 'rearUppercut', 'hook', 'cross'], 'Montante sotto la guardia alta, poi gancio e diretto sopra.'),
  c('1-2-5-2', 'boxing', 2, '1-2-5-2', ['jab', 'cross', 'uppercut', 'cross'], 'Il montante anteriore sorprende chi chiude la guardia dopo il 1-2.'),
  c('3b-3', 'boxing', 2, 'Gancio corpo + gancio testa', ['bodyHook', 'hook'], 'Stessa mano, due livelli: il corpo fa abbassare le mani, la testa si scopre.'),
  c('1-2b', 'boxing', 1, 'Jab + diretto al corpo', ['jab', 'bodyCross'], 'Jab alto per coprire la visuale, diretto basso allo stomaco.'),
  c('6-3-2', 'boxing', 3, '6-3-2', ['rearUppercut', 'hook', 'cross'], 'Combo da corta distanza per uscire dal clinch colpendo.'),

  // ── Pugni + calci ──
  c('1-2-lk', 'kicks', 1, '1-2 + low kick', ['jab', 'cross', 'lowKick'], 'La combo più usata in MMA: il diretto carica il peso sulla gamba avanti, il low kick la colpisce.'),
  c('1-2-3-lk', 'kicks', 2, '1-2-3 + low kick', ['jab', 'cross', 'hook', 'lowKick'], 'Il gancio sposta il peso dell’avversario sulla gamba avanti: calcialo lì.'),
  c('1-bk', 'kicks', 1, 'Jab + calcio al corpo', ['jab', 'bodyKick'], 'Il jab fa alzare le mani, il calcio arriva al fianco scoperto.'),
  c('1-2-hk', 'kicks', 3, '1-2 + calcio alla testa', ['jab', 'cross', 'headKick'], 'Dopo il 1-2 l’avversario si copre al centro: il calcio arriva dall’esterno.'),
  c('teep-1-2', 'kicks', 1, 'Teep + 1-2', ['teep', 'jab', 'cross'], 'Il teep ferma chi avanza, poi entri tu con il 1-2.'),
  c('sw-2', 'kicks', 2, 'Switch kick + diretto', ['switchKick', 'cross'], 'Dopo il calcio atterri già in posizione per il diretto.'),
  c('1-2-3-bk', 'kicks', 2, '1-2-3 + calcio al corpo', ['jab', 'cross', 'hook', 'bodyKick'], 'Chiudi la combo pugni con il calcio del lato opposto al gancio.'),
  c('lk-2', 'kicks', 2, 'Low kick + diretto', ['lowKick', 'cross'], 'Calcio-pugno: dopo il low kick il piede torna giù e il diretto parte subito.'),
  c('2-3-lk', 'kicks', 2, '2-3 + low kick', ['cross', 'hook', 'lowKick'], 'Variante corta: diretto e gancio portano il peso avanti, poi la gamba.'),

  // ── Gomiti e ginocchia ──
  c('1-2-e1', 'clinch', 2, '1-2 + gomito anteriore', ['jab', 'cross', 'leadElbow'], 'Chiudi la distanza con il 1-2 e finisci da vicino con il gomito.'),
  c('1-e2', 'clinch', 2, 'Jab + gomito posteriore', ['jab', 'rearElbow'], 'Il jab copre l’entrata, il gomito posteriore arriva da vicino.'),
  c('3-e2', 'clinch', 3, 'Gancio + gomito posteriore', ['hook', 'rearElbow'], 'Dal gancio anteriore la rotazione continua nel gomito posteriore.'),
  c('clinch-k2', 'clinch', 2, 'Clinch + doppia ginocchiata', ['clinch', 'rearKnee', 'rearKnee'], 'Presa al collo, rompi la postura e porta due ginocchiate.'),
  c('1-2-clinch-k', 'clinch', 3, '1-2 + clinch + ginocchiata', ['jab', 'cross', 'clinch', 'rearKnee'], 'Entra colpendo, afferra la testa e finisci con il ginocchio.'),

  // ── Difesa e contro ──
  c('slip-2', 'defense', 1, 'Schivata + diretto', ['slip', 'cross'], 'Schivi il jab verso l’esterno e rispondi subito con il diretto.'),
  c('parry-1-2', 'defense', 1, 'Parata + 1-2', ['parry', 'jab', 'cross'], 'Devii il jab e rientri con la tua combinazione.'),
  c('roll-3', 'defense', 2, 'Rotolamento + gancio', ['roll', 'hook'], 'Passi sotto il suo gancio e risali colpendo con il tuo.'),
  c('check-2', 'defense', 2, 'Check + diretto', ['check', 'cross'], 'Pari il low kick con la tibia e rispondi mentre ha ancora una gamba in aria.'),
  c('slip-3b', 'defense', 2, 'Schivata + gancio al corpo', ['slip', 'bodyHook'], 'La schivata ti porta già in basso: colpisci il corpo.'),
  c('slip-2-3', 'defense', 3, 'Schivata + 2-3', ['slip', 'cross', 'hook'], 'Contrattacco completo dopo la schivata del jab.'),

  // ── Lotta ──
  c('1-2-dl', 'wrestling', 2, '1-2 + double leg', ['jab', 'cross', 'levelChange', 'doubleLeg'], 'I pugni alti fanno alzare la guardia, poi cambi livello e vai alle gambe.'),
  c('feint-dl', 'wrestling', 2, 'Finta + double leg', ['feint', 'levelChange', 'doubleLeg'], 'La finta di jab fa reagire in alto: tu entri in basso.'),
  c('sprawl-1-2', 'wrestling', 1, 'Sprawl + 1-2', ['sprawl', 'jab', 'cross'], 'Difendi l’atterramento, rialzati e colpisci per primo.'),
  c('1-sprawl-lk', 'wrestling', 2, 'Jab + sprawl + low kick', ['jab', 'sprawl', 'lowKick'], 'Scambio completo: attacchi, difendi il suo tentativo, chiudi con la gamba.'),
];

export const combosByCategory = () => COMBO_CATEGORIES.map((cat) => ({ ...cat, combos: COMBOS.filter((combo) => combo.category === cat.id) }));

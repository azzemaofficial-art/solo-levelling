// Un video di tecnica per ogni esercizio del piano (chiave = nome in cutPlan.js).
// Verificati via oEmbed YouTube (esistono e sono incorporabili) il 2026-09-27 e il 2026-11-05.
// Scelti per fonte (enti di formazione, fisioterapisti, coach) e chiarezza, non per
// popolarità. I video sono in inglese: la dimostrazione conta più del parlato.
const V = (id, channel, label = 'Tecnica') => ({ id, channel, label });

const chinNegative = V('3w8Pnbl70SQ', 'Calixpert', 'Negative');
const pogo = V('RscEOoPvJr4', 'Parisi Speed School', 'Pogo');

export const exerciseVideos = {
  // Calcio (verificati 2026-11-05)
  'Marcia e oscillazioni gambe': [V('RSJIp7e7fyY', 'FIFA 11+', 'Corsa di riscaldamento')],
  'World’s greatest stretch e affondo laterale': [V('-CiWQ2IvY34', 'Squat University', 'Stretch'), V('0jmD_WDBkVs', 'Parisi Speed School', 'Affondo laterale')],
  'A-march e A-skip': [V('bISzKMBflPM', 'Parisi Speed School')],
  'Pogo e salto in lungo': [pogo, V('Uh4AraiUD64', 'Parisi Speed School', 'Salto in lungo')],
  'Scatti brevi': [V('u_lE_VMnYfU', 'Parisi Speed School', 'Spinta iniziale')],
  'Scatti lanciati': [V('kFLwmd0yzOU', 'Matt Tometz', 'Scatti lanciati')],
  'Bound laterale e pogo': [V('QI8ipVFtbHY', 'Parisi Speed School', 'Bound'), pogo],
  'Frenate e ripartenze': [V('1pW4o51MusI', 'Parisi Speed School', 'Frenata')],
  // Forza A
  'Riscaldamento parte alta': [V('uodkIIcXtRk', 'mobility by julia reppel', 'Routine 5 min')],
  'Piegamenti esplosivi': [V('FCNy_ZpF-aI', 'Feldkamp Performance Factory')],
  'Rotazione esplosiva con elastico': [V('0AHBdvW5iaM', 'Kristian Leach')],
  'Distensioni a terra manubri': [V('Bx4QPVH-J1g', 'Colossus Fitness')],
  'Trazioni': [V('s9MlTeJHwAI', 'CrossFit Invictus'), chinNegative],
  'Rematore a un braccio': [V('tLnlWj7LQ34', 'Buff Dudes')],
  'Alzate laterali': [V('pgrWjBfaFe8', 'Colossus Fitness')],
  'Estensioni tricipiti sopra la testa': [V('-Vyt2QdsR7E', 'ScottHermanFitness')],
  'Curl bicipiti': [V('XE_pHwbst04', 'Fit Father Project')],
  'Rullo addominale': [V('6LrMOI0VN3I', 'Fit Drills AG')],
  'Copenhagen': [V('KZMIND6LvRY', 'Ky Wynne Physio')],
  'Stretching finale parte alta': [V('OUlBO3g0OIY', 'mobility by julia reppel', 'Routine 5 min')],
  // Forza B
  'Riscaldamento gambe': [V('QLkLKfL_7F0', 'Tom Peto Training', 'Routine 5 min')],
  'Salto verticale': [V('wEHNn6RJd14', 'Depth Training and Physiotherapy')],
  'Affondo bulgaro': [V('fSyiHxm1Igw', 'Squat University')],
  'Piegamenti piedi rialzati': [V('QBlYp-EwHlo', 'PureGym')],
  'Stacco rumeno manubri': [V('aa57T45iFSE', 'NASM'), V('FQKfr1YDhEk', 'ScottHermanFitness', 'Spiegato')],
  'Trazioni presa inversa': [V('Ln3gAdHr8MM', 'Paul Hadfield'), chinNegative],
  'Spinte spalle manubri': [V('fuQpuu--bMI', 'That Fit Friend')],
  'Polpacci su gradino': [V('ElcvJ0kjt6c', 'Runna')],
  'Nordic curl': [V('v31DMiLfM4U', 'E3 Rehab')],
  'Stretching finale gambe': [V('myN0dGpJabc', 'Tom Peto Training', 'Routine 5 min')],
  // Mercoledì al sacco
  'Footwork e guardia': [V('Q3siDY1a6PI', 'Hayabusa')],
  'Jab–cross al sacco, tecnica': [V('RRYNJt9Whv8', 'Joslin’s MMA')],
  'Mobilità anche e caviglie': [V('2aXdnJbX-pM', 'Julia Reppel', 'Routine 10 min')],
};

export const videosFor = (exercise) => exerciseVideos[exercise] || [];

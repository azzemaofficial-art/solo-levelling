// Un video di tecnica per ogni esercizio del piano (chiave = nome in cutPlan.js).
// Tutti verificati il 2026-09-27 via oEmbed YouTube: esistono e sono incorporabili.
// Scelti per fonte (enti di formazione, fisioterapisti, coach) e chiarezza, non per
// popolarità. I video sono in inglese: la dimostrazione conta più del parlato.
const V = (id, channel, label = 'Tecnica') => ({ id, channel, label });

const pushUp = V('WDIpL0pjun0', 'NASM', 'Piegamenti');
const dbBench = V('sTYWWaunX8o', 'Born Fitness', 'Distensioni manubri');
const row = V('tLnlWj7LQ34', 'Buff Dudes');
const reverseLunge = V('u_zSfK5ZFU4', 'BuiltLean');

export const exerciseVideos = {
  'Piegamenti o distensioni manubri su panca': [pushUp, dbBench],
  'Distensioni manubri su panca': [dbBench],
  'Trazioni assistite o negative controllate': [V('s9MlTeJHwAI', 'CrossFit Invictus')],
  'Rematore manubrio': [row],
  'Rematore manubri': [row],
  'Affondi indietro leggeri': [reverseLunge],
  'Affondi indietro': [reverseLunge],
  'Spinte spalle manubri': [V('fuQpuu--bMI', 'That Fit Friend')],
  'Plank': [V('A2b2EmIg0dA', 'E3 Rehab')],
  'Footwork e guardia': [V('Q3siDY1a6PI', 'Hayabusa')],
  'Jab–cross al sacco, tecnica': [V('RRYNJt9Whv8', 'Joslin’s MMA')],
  'Mobilità anche e caviglie': [V('2aXdnJbX-pM', 'Julia Reppel', 'Routine 10 min')],
  'Riscaldamento dinamico + 3 progressioni': [V('LtK_Qnye5w4', 'Soccerspective', 'Riscaldamento')],
  'Accelerazioni 10–20 m': [V('BpWhprv5PLw', 'Outperform · Ken Harnden')],
  'Goblet squat': [V('BR4tlEE_A98', 'FIT.nl')],
  'Stacco rumeno manubri': [V('aa57T45iFSE', 'NASM')],
};

export const videosFor = (exercise) => exerciseVideos[exercise] || [];

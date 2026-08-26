// ─────────────────────────────────────────────────────────────────────────────
// DAILY QUEST del Sistema — come in Solo Leveling: ogni giorno il Sistema
// assegna una missione di allenamento. Deterministica (stessa quest per tutti
// nello stesso giorno), scalata sul livello di maestria della disciplina.
// ─────────────────────────────────────────────────────────────────────────────

// unit: 'rip' = ripetizioni · 'sec' = secondi · 'min' = minuti
const POOLS = {
  muaythai: [
    { name: 'Jab al sacco', unit: 'rip' }, { name: 'Cross potente', unit: 'rip' },
    { name: 'Roundhouse (gamba dominante)', unit: 'rip' }, { name: 'Teep di controllo', unit: 'rip' },
    { name: 'Ginocchiate alternate', unit: 'rip' }, { name: 'Gomiti orizzontali', unit: 'rip' },
    { name: 'Plank del guerriero', unit: 'sec' }, { name: 'Corda immaginaria', unit: 'min' },
    { name: 'Squat jump esplosivi', unit: 'rip' }, { name: 'Shadow sparring lento', unit: 'min' },
  ],
  boxing: [
    { name: 'Jab in estensione', unit: 'rip' }, { name: 'Jab-cross a catena', unit: 'rip' },
    { name: 'Gancio al corpo', unit: 'rip' }, { name: 'Montante con rotazione', unit: 'rip' },
    { name: 'Schivate sul posto', unit: 'rip' }, { name: 'Doppio passo + cross', unit: 'rip' },
    { name: 'Plank pugilato', unit: 'sec' }, { name: 'Footwork a triangolo', unit: 'min' },
    { name: 'Shadowboxing fluido', unit: 'min' }, { name: 'Piegamenti esplosivi', unit: 'rip' },
  ],
  karate: [
    { name: 'Choku zuki (pugno diretto)', unit: 'rip' }, { name: 'Gyaku zuki', unit: 'rip' },
    { name: 'Mae geri', unit: 'rip' }, { name: 'Mawashi geri', unit: 'rip' },
    { name: 'Kata lento e perfetto', unit: 'min' }, { name: 'Kiba dachi (posizione)', unit: 'sec' },
    { name: 'Age uke + contrattacco', unit: 'rip' }, { name: 'Squat isometrici', unit: 'sec' },
    { name: 'Kiai di potenza', unit: 'rip' }, { name: 'Respirazione ibuki', unit: 'min' },
  ],
  taekwondo: [
    { name: 'Ap chagi', unit: 'rip' }, { name: 'Roundhouse kick', unit: 'rip' },
    { name: 'Calcio laterale', unit: 'rip' }, { name: 'Calcio all\'indietro', unit: 'rip' },
    { name: 'Calcio girato', unit: 'rip' }, { name: 'Camera del ginocchio alta', unit: 'sec' },
    { name: 'Stretching dinamico anche', unit: 'min' }, { name: 'Poomae (forma) lento', unit: 'min' },
    { name: 'Squat jump', unit: 'rip' }, { name: 'Equilibrio su una gamba', unit: 'sec' },
  ],
  bjj: [
    { name: 'Fuga d\'anca (shrimp)', unit: 'rip' }, { name: 'Technical standup', unit: 'rip' },
    { name: 'Ponte e rotolamento', unit: 'rip' }, { name: 'Grip fighting immaginario', unit: 'sec' },
    { name: 'Drill di guardia chiusa', unit: 'min' }, { name: 'Inversioni lente', unit: 'rip' },
    { name: 'Plank dell\'atleta', unit: 'sec' }, { name: 'Mobilizzazione anche', unit: 'min' },
    { name: 'Piegamenti profondi', unit: 'rip' }, { name: 'Respirazione diaframmatica', unit: 'min' },
  ],
  mma: [
    { name: 'Jab-cross-level change', unit: 'rip' }, { name: 'Sprawl esplosivo', unit: 'rip' },
    { name: 'Calcio al corpo', unit: 'rip' }, { name: 'Ginocchiate da clinch', unit: 'rip' },
    { name: 'Shadow wrestling', unit: 'min' }, { name: 'Sit-out', unit: 'rip' },
    { name: 'Plank da combattimento', unit: 'sec' }, { name: 'Burpees del fighter', unit: 'rip' },
    { name: "Lavoro a terra (shrimp+standup)", unit: 'min' }, { name: 'Respiro tattico', unit: 'min' },
  ],
  kali: [
    { name: 'Angoli 1-2 col bastone', unit: 'rip' }, { name: 'Sinawali lento', unit: 'min' },
    { name: 'Witik di precisione', unit: 'rip' }, { name: 'Abanico corto', unit: 'rip' },
    { name: 'Footwork a triangolo', unit: 'min' }, { name: 'Redonda continua', unit: 'sec' },
    { name: 'Flow drill immaginario', unit: 'min' }, { name: 'Presa e rotazione polso', unit: 'rip' },
    { name: 'Plank dell\'arciere', unit: 'sec' }, { name: 'Passaggio arma immaginario', unit: 'rip' },
  ],
  sanda: [
    { name: 'Side kick al ginocchio', unit: 'rip' }, { name: 'Pugno-catena-presa', unit: 'rip' },
    { name: 'Kick catch immaginario', unit: 'rip' }, { name: "Entrata doppio livello", unit: 'rip' },
    { name: 'Proiezione d\'ombra', unit: 'rip' }, { name: 'Squat da lancio', unit: 'rip' },
    { name: 'Plank del lottatore', unit: 'sec' }, { name: 'Gioco di piedi circolare', unit: 'min' },
    { name: 'Piegamenti a tempo', unit: 'rip' }, { name: 'Respiro del lanciatore', unit: 'min' },
  ],
  judo: [
    { name: 'Uchikomi immaginario', unit: 'rip' }, { name: 'Squat da proiezione', unit: 'rip' },
    { name: 'Piegamenti judogi', unit: 'rip' }, { name: 'Equilibri su una gamba', unit: 'sec' },
    { name: 'Rotolamenti (ukemi) lenti', unit: 'rip' }, { name: 'Ponte potente', unit: 'rip' },
    { name: 'Plank del judoka', unit: 'sec' }, { name: 'Grip shadow', unit: 'min' },
    { name: 'Mobilizzazione anche', unit: 'min' }, { name: 'Respirazione zazen', unit: 'min' },
  ],
  yoga: [
    { name: 'Saluto al sole', unit: 'rip' }, { name: 'Guerriero II', unit: 'sec' },
    { name: 'Equilibrio dell\'albero', unit: 'sec' }, { name: 'Cane a faccia in giù', unit: 'sec' },
    { name: 'Torsione da seduti', unit: 'sec' }, { name: 'Respiro del vincitore', unit: 'min' },
    { name: 'Ponte lento', unit: 'rip' }, { name: 'Gatto-mucca consapevole', unit: 'rip' },
    { name: 'Piegamento avanti profondo', unit: 'sec' }, { name: 'Meditazione del guerriero', unit: 'min' },
  ],
  running: [
    { name: 'Corsa lenta continua', unit: 'min' }, { name: 'Scatti brevi', unit: 'rip' },
    { name: 'Squat a corpo libero', unit: 'rip' }, { name: 'Affondi camminati', unit: 'rip' },
    { name: 'Plank del corridore', unit: 'sec' }, { name: 'Caviglie elastiche', unit: 'rip' },
    { name: 'Respiro ritmico 3:2', unit: 'min' }, { name: 'Skip alto', unit: 'sec' },
    { name: 'Allungo defaticante', unit: 'min' }, { name: 'Corsa calciata', unit: 'sec' },
  ],
};

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export const QUEST_DISCIPLINES = Object.keys(POOLS);

// Il Sistema sceglie la disciplina del giorno (deterministica per data)
export function questDiscipline(dateKey) {
  const keys = QUEST_DISCIPLINES;
  return keys[hashStr(`qdisc:${dateKey}`) % keys.length];
}

// 3 esercizi distinti per il giorno. Ritorna { disc, date, exercises:[{name,unit,target}] }
export function dailyQuest(dateKey, lvl = 0) {
  const disc = questDiscipline(dateKey);
  const pool = POOLS[disc] || POOLS.muaythai;
  const picked = [];
  let s = hashStr(`q:${disc}:${dateKey}`);
  while (picked.length < 3 && picked.length < pool.length) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const ex = pool[s % pool.length];
    if (!picked.some((p) => p.name === ex.name)) picked.push(ex);
  }
  const level = Math.min(5, Math.max(0, Math.round(lvl)));
  return {
    disc,
    date: dateKey,
    exercises: picked.map((ex) => ({ ...ex, target: questTarget(ex, level) })),
  };
}

// Obiettivi scalati sul livello di maestria (0-5)
export function questTarget(ex, lvl) {
  const l = Math.min(5, Math.max(0, Math.round(lvl || 0)));
  if (ex.unit === 'rip') return Math.round((18 + l * 8) / 5) * 5;   // 20 → 55
  if (ex.unit === 'sec') return 20 + l * 10;                         // 20 → 70
  if (ex.unit === 'min') return 2 + l;                               // 2 → 7
  return 10;
}

// XP della quest: base + livello + bonus streak (cap 30 giorni)
export function questXp(lvl, streak) {
  const l = Math.min(5, Math.max(0, Math.round(lvl || 0)));
  return 100 + l * 50 + Math.min(Math.max(0, streak || 0), 30) * 5;
}

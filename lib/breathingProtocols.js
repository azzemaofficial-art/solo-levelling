// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOLLI DI RESPIRAZIONE — fonte unica per il Coach (MACRO 4 masterplan).
//
// Formato allineato alla BreathingGuide di Coach.jsx: fasi [{label, sec}],
// rounds = ripetizioni del ciclo. La guida visiva classifica le fasi da label
// (classifyBreathPhase): "inspira/respira/carica" → espande, "espira/sbuffo"
// → contrae, altro → pausa. Nessuna AI: funziona offline.
// ─────────────────────────────────────────────────────────────────────────────

export const BREATHING_PROTOCOLS = [
  {
    id: 'box',
    name: 'Box Breathing',
    subtitle: 'Calma e controllo sotto pressione (Navy SEAL)',
    phases: [
      { label: 'Inspira', sec: 4 },
      { label: 'Trattieni', sec: 4 },
      { label: 'Espira', sec: 4 },
      { label: 'Trattieni', sec: 4 },
    ],
    rounds: 6,
    when: 'Prima di uno sparring, in un momento di stress, per abbassare il battito rapidamente',
    cue: 'Respira come se stessi disegnando i quattro lati di un quadrato',
  },
  {
    id: '478',
    name: '4-7-8',
    subtitle: 'Calma profonda, pre-sonno, pre-gara',
    phases: [
      { label: 'Inspira', sec: 4 },
      { label: 'Trattieni', sec: 7 },
      { label: 'Espira', sec: 8 },
      { label: 'Pausa', sec: 0 },
    ],
    rounds: 4,
    when: 'Prima di dormire, prima di una gara/verifica, o quando la mente corre e serve staccare',
    cue: 'Espira dalla bocca con un leggero soffio, come se spegnessi una candela lontana',
  },
  {
    id: 'wimhof',
    name: 'Wim Hof (semplificato)',
    subtitle: 'Iperventilazione controllata + ritenzione',
    phases: [
      { label: 'Respira veloce', sec: 30 },
      { label: 'Espira e trattieni', sec: 15 },
      { label: 'Inspira e trattieni 10s', sec: 10 },
      { label: 'Recupero', sec: 5 },
    ],
    rounds: 3,
    when: 'Al mattino a stomaco vuoto, per energia e resistenza al freddo/stress — mai in acqua o alla guida',
    cue: '30 respiri profondi e veloci (pieno-vuoto), poi svuota i polmoni e resta in apnea finché senti il bisogno di respirare',
    caution: 'Solo seduto/sdraiato. Mai prima di nuotare o guidare.',
  },
  {
    id: 'nadishodhana',
    name: 'Nadi Shodhana',
    subtitle: 'Respirazione alternata, equilibrio yoga',
    phases: [
      { label: 'Inspira narice sx', sec: 4 },
      { label: 'Trattieni (chiudi entrambe)', sec: 4 },
      { label: 'Espira narice dx', sec: 4 },
      { label: 'Inspira narice dx', sec: 4 },
    ],
    rounds: 5,
    when: 'A inizio o fine sessione yoga, per riequilibrare mente e sistema nervoso',
    cue: 'Pollice destro chiude la narice destra, anulare la sinistra — alterna a ogni fase',
  },
  {
    id: 'warrior',
    name: 'Respiro del guerriero',
    subtitle: 'Carica pre-combattimento (Muay Thai)',
    phases: [
      { label: 'Sbuffo corto', sec: 2 },
      { label: 'Sbuffo corto', sec: 2 },
      { label: 'Inspira e carica', sec: 3 },
      { label: 'Espira esplosiva', sec: 1 },
    ],
    rounds: 8,
    when: 'Nel corner prima della campana, o subito prima di un round di sparring, per attivare il sistema nervoso',
    cue: 'Due sbuffi corti dal naso come un toro, poi carica e libera l\'aria con un colpo secco, come su un pao',
  },
  {
    id: 'coherence',
    name: 'Coerenza cardiaca 5-5',
    subtitle: 'Uso quotidiano, recupero, baseline',
    phases: [
      { label: 'Inspira', sec: 5 },
      { label: 'Espira', sec: 5 },
    ],
    rounds: 6,
    when: 'Ogni giorno, 3 volte al giorno (mattina, pranzo, sera) — o nei minuti dopo l\'allenamento per il recupero',
    cue: 'Nessuna ritenzione: un flusso continuo, come un\'onda che sale e scende senza pause',
  },
];

export const BREATHING_IDS = BREATHING_PROTOCOLS.map((p) => p.id);

export function getBreathingProtocol(id) {
  const key = String(id || '').toLowerCase();
  return BREATHING_PROTOCOLS.find((p) => p.id === key) || null;
}

// Durata di un ciclo e dell'intero protocollo (fasi con sec > 0).
export function cycleSeconds(protocol) {
  const p = typeof protocol === 'string' ? getBreathingProtocol(protocol) : protocol;
  if (!p) return 0;
  return p.phases.reduce((sum, f) => sum + (f.sec || 0), 0);
}

export function protocolTotalSeconds(id) {
  const p = getBreathingProtocol(id);
  if (!p) return 0;
  return cycleSeconds(p) * (p.rounds || 1);
}

// Lista per la UI
export function breathingOptions() {
  return BREATHING_PROTOCOLS.map((p) => ({
    id: p.id, name: p.name, subtitle: p.subtitle, when: p.when,
  }));
}

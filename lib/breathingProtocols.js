// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOLLI DI RESPIRAZIONE (MACRO 4 del Coach V2 masterplan).
//
// Dati puri per il coach respiro: guida visiva (cerchio che si espande =
// inspira, tiene, si contrae = espira) + voce + aptica. Nessuna AI: funziona
// offline. Le fasi sono in secondi; holdEmpty = pausa a polmoni vuoti.
// ─────────────────────────────────────────────────────────────────────────────

export const BREATHING_PROTOCOLS = {
  box: {
    id: 'box', name: 'Box Breathing', emoji: '⬛', seconds: 240,
    phases: [
      { type: 'inhale', seconds: 4, cue: 'Inspira dal naso, pancia che si espande' },
      { type: 'hold', seconds: 4, cue: 'Tieni: spalle rilassate' },
      { type: 'exhale', seconds: 4, cue: 'Espira lento dalla bocca' },
      { type: 'holdEmpty', seconds: 4, cue: 'Pausa a polmoni vuoti, resta calmo' },
    ],
    benefit: 'Calma il sistema nervoso e aumenta la concentrazione sotto stress.',
    when: 'Prima dello sparring, tra i round, dopo un drill intenso.',
    rounds: 8,
  },
  '478': {
    id: '478', name: '4-7-8 (rilascio profondo)', emoji: '🌙', seconds: 19,
    phases: [
      { type: 'inhale', seconds: 4, cue: 'Inspira dal naso in silenzio' },
      { type: 'hold', seconds: 7, cue: 'Tieni: il corpo si rilassa' },
      { type: 'exhale', seconds: 8, cue: 'Espira dalla bocca con un suono morbido' },
    ],
    benefit: 'Attiva il parasimpatico: recupero rapido e sonno migliore.',
    when: 'Defaticamento, sera, dopo allenamenti serali.',
    rounds: 6,
  },
  wimhof: {
    id: 'wimhof', name: 'Wim Hof (energia)', emoji: '❄️', seconds: 30,
    phases: [
      { type: 'inhale', seconds: 2, cue: 'Inspira profondo e veloce, senza forzare' },
      { type: 'exhale', seconds: 1, cue: 'Lascia andare l\'aria, senza spingere' },
    ],
    benefit: 'Ossigenazione e carica: 30 respiri veloci poi ritenzione.',
    when: 'Prima dell\'allenamento, mai in acqua o alla guida.',
    rounds: 30,
    caution: 'Fai le ritenzioni solo seduto/sdraiato. Mai prima di nuotare.',
  },
  nadishodhana: {
    id: 'nadishodhana', name: 'Nadi Shodhana (narici alternate)', emoji: '☯️', seconds: 32,
    phases: [
      { type: 'inhale', seconds: 4, cue: 'Inspira dalla narice sinistra' },
      { type: 'hold', seconds: 4, cue: 'Tieni dolcemente' },
      { type: 'exhale', seconds: 4, cue: 'Espira dalla narice destra' },
      { type: 'inhale', seconds: 4, cue: 'Inspira dalla narice destra' },
      { type: 'hold', seconds: 4, cue: 'Tieni dolcemente' },
      { type: 'exhale', seconds: 4, cue: 'Espira dalla narice sinistra' },
      { type: 'holdEmpty', seconds: 4, cue: 'Pausa, poi riparti da sinistra' },
    ],
    benefit: 'Equilibra i due emisferi, calma la mente prima della tecnica.',
    when: 'Prima dei kata/poomse, o per ritrovare il focus.',
    rounds: 6,
  },
  warrior: {
    id: 'warrior', name: 'Respiro del guerriero', emoji: '⚔️', seconds: 12,
    phases: [
      { type: 'inhale', seconds: 3, cue: 'Inspira gonfiando il diaframma' },
      { type: 'hold', seconds: 2, cue: 'Comprimi: l\'aria è benzina' },
      { type: 'exhale', seconds: 3, cue: 'Espira con un "ish" corto e potente' },
      { type: 'holdEmpty', seconds: 1, cue: 'Pronto: guardia alta' },
    ],
    benefit: 'Il ritmo del combattimento: sincronizza respiro e colpi.',
    when: 'Shadow boxing, sacco, prima di ogni round.',
    rounds: 12,
  },
  recovery: {
    id: 'recovery', name: 'Recupero 4-6', emoji: '💚', seconds: 20,
    phases: [
      { type: 'inhale', seconds: 4, cue: 'Inspira dal naso, spalle che scendono' },
      { type: 'exhale', seconds: 6, cue: 'Espira lungo: il battito rallenta' },
    ],
    benefit: 'Abbassa il battito tra le serie e tra i round.',
    when: 'Ogni pausa: 5-10 cicli bastano.',
    rounds: 10,
  },
};

export const BREATHING_IDS = Object.keys(BREATHING_PROTOCOLS);

export function getBreathingProtocol(id) {
  return BREATHING_PROTOCOLS[String(id || '').toLowerCase()] || null;
}

// Durata totale di un ciclo (tutte le fasi) e dell'intero protocollo.
export function cycleSeconds(protocol) {
  const p = typeof protocol === 'string' ? getBreathingProtocol(protocol) : protocol;
  if (!p) return 0;
  return p.phases.reduce((sum, f) => sum + f.seconds, 0);
}

export function protocolTotalSeconds(id) {
  const p = getBreathingProtocol(id);
  if (!p) return 0;
  return cycleSeconds(p) * (p.rounds || 1);
}

// Lista per la UI
export function breathingOptions() {
  return BREATHING_IDS.map((id) => {
    const p = BREATHING_PROTOCOLS[id];
    return { id, name: p.name, emoji: p.emoji, benefit: p.benefit, when: p.when };
  });
}

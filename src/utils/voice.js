let lastSpeechAt = 0;

const DARK_VOICE_HINTS = [
  'male',
  'man',
  'paolo',
  'luca',
  'giorgio',
  'federico',
  'google italiano',
  'it-it'
];

const pickPreferredVoice = (voices) => {
  if (!voices || voices.length === 0) return null;
  const normalized = voices.map((voice) => ({ ...voice, key: `${voice.name || ''} ${voice.lang || ''}`.toLowerCase() }));
  return (
    normalized.find((voice) => voice.lang?.toLowerCase().startsWith('it') && DARK_VOICE_HINTS.some((hint) => voice.key.includes(hint))) ||
    normalized.find((voice) => voice.lang?.toLowerCase().startsWith('it')) ||
    normalized.find((voice) => DARK_VOICE_HINTS.some((hint) => voice.key.includes(hint))) ||
    normalized.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
    null
  );
};

const VOICE_PACKS = {
  dark: {
    milestone_claim: [
      "Milestone confermata. Il potere cresce.",
      "Ricompensa assorbita. Avanzamento stabile.",
      "Obiettivo conquistato. Continua la caccia."
    ],
    quest_clear: [
      "Quest giornaliera completata.",
      "Missione conclusa. Nessuna esitazione.",
      "Progressione valida. Procedi."
    ],
    shield_buy: [
      "Streak shield acquisito.",
      "Protezione attiva contro la rottura catena.",
      "Scudo registrato nel sistema."
    ],
    workout_evoked: [
      "Protocollo evocato. Preparazione in corso.",
      "Nuova caccia caricata.",
      "Sequenza di allenamento pronta."
    ],
    workout_start: [
      "Sessione avviata. Muoviti.",
      "Gate aperto. Inizia il raid.",
      "Cronometro attivo. Nessuna pausa."
    ],
    workout_clear: [
      "Workout clear. Potere incrementato.",
      "Raid completato. Risorse acquisite.",
      "Sessione conclusa. Dominio confermato."
    ],
    insufficient_gold: [
      "Oro insufficiente.",
      "Risorse non adeguate.",
      "Credito non disponibile."
    ]
  },
  system: {
    milestone_claim: ["Milestone unlocked."],
    quest_clear: ["Daily quest complete."],
    shield_buy: ["Streak shield online."],
    workout_evoked: ["Workout protocol generated."],
    workout_start: ["Training sequence started."],
    workout_clear: ["Training complete."],
    insufficient_gold: ["Not enough gold."]
  }
};

const pickLine = (eventId, pack = 'dark') => {
  const selectedPack = VOICE_PACKS[pack] ? pack : 'dark';
  const options = VOICE_PACKS[selectedPack][eventId];
  if (!options || options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
};

export const speakLine = (text, enabled = true) => {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
  const now = Date.now();
  if (now - lastSpeechAt < 700) return;
  lastSpeechAt = now;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 0.84 + Math.random() * 0.05;
  utterance.pitch = 0.62 + Math.random() * 0.06;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices?.() || [];
  const preferred = pickPreferredVoice(voices);
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export const speakEvent = (eventId, enabled = true, pack = 'dark') => {
  const line = pickLine(eventId, pack);
  if (!line) return;
  speakLine(line, enabled);
};

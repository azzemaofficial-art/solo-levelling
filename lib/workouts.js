// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT DEL MAESTRO — generatore di allenamenti guidati dalla knowledge base.
// Struttura: riscaldamento → tecniche della disciplina (insegnate a voce e
// corrette live dallo specchio) → condizionamento → respiro finale.
// Deterministico per seed: stesso seed → stesso workout, seed diverso → rotazione.
// ─────────────────────────────────────────────────────────────────────────────
import { getDiscipline } from './martialKnowledge.js';

// Tipo di tecnica (knowledge base) → posa target dello specchio (POSE_FAMILY).
export const WORKOUT_MIRROR = {
  punch: ['jab', 'cross'], elbow: ['elbow'],
  kick: ['roundhouse', 'teep', 'low_kick'], knee: ['knee'], strike: ['cross'],
  takedown: ['stance'], throw: ['stance'], sweep: ['stance'], turn: ['stance'],
  position: ['guard'], submission: ['guard'], escape: ['guard'],
  defense: ['guard'], movement: ['stance'], form: ['stance'], concept: ['stance'],
};
export const VALID_WORKOUT_POSES = new Set([...Object.values(WORKOUT_MIRROR).flat(), 'run', 'squat', 'guard']);

export function buildCoachWorkout(disciplineId, seed = 0) {
  const d = getDiscipline(disciplineId);
  const techs = d ? d.techniques.filter((t) => WORKOUT_MIRROR[t.type]) : [];
  // ruota il pool in base al seed → workout diverso ogni volta, riproducibile a parità di seed
  const s = Math.abs(seed) % Math.max(1, techs.length);
  const pool = techs.length ? [...techs.slice(s), ...techs.slice(0, s)] : [];
  const picked = pool.slice(0, Math.min(4, pool.length));
  return [
    { name: 'Riscaldamento', emoji: '🔥', seconds: 45, mirror: 'run', teach: 'Corsa leggera sul posto, spalle sciolte, respira dal naso.' },
    ...picked.map((t) => ({
      name: t.it, emoji: d?.emoji || '🥋', seconds: 40,
      mirror: WORKOUT_MIRROR[t.type][Math.abs(seed) % WORKOUT_MIRROR[t.type].length],
      teach: t.how.slice(0, 2).join('. '), drill: t.drill,
      mistakes: t.mistakes?.[0] ? `Se ${t.mistakes[0].if}: ${t.mistakes[0].fix}` : '',
    })),
    { name: 'Condizionamento', emoji: '💪', seconds: 40, mirror: 'squat', teach: 'Squat a corpo libero: scendi controllato, ginocchia in linea con le punte.' },
    { name: 'Respiro finale', emoji: '🫁', seconds: 30, mirror: 'guard', teach: d ? d.breathing.principle : 'Inspira dal naso, espira lento dalla bocca.' },
  ];
}

// Durata totale (per mostrare "4-7 min" nella UI)
export function workoutDurationSeconds(disciplineId, seed = 0) {
  return buildCoachWorkout(disciplineId, seed).reduce((sum, p) => sum + p.seconds, 0);
}

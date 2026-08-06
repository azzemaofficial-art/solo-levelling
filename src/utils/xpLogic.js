// ─────────────────────────────────────────────────────────────────────────────
// UNICA fonte di verità per XP/livelli del personaggio (playerStats).
//
// Modello — quello usato da tutte le pagine (Boss, Quests, French, SystemHub):
// `exp` è il progresso DENTRO il livello corrente; servono `level * 100` XP
// per passare al livello successivo.
//
// Fino ad agosto 2026 ogni pagina aveva la sua copia: App.jsx usava exp
// CUMULATIVA (level = floor(exp/100)+1), Boss/Quests/French usavano exp
// sottrattiva. Scrivendo sullo stesso playerStats i due modelli si
// cancellavano a vicenda (multi level-up silenziosi o livello che oscillava).
// Ogni guadagno di XP deve passare da applyXp().
// ─────────────────────────────────────────────────────────────────────────────

export const xpNeededFor = (level) => (Math.max(1, Math.floor(Number(level) || 1))) * 100;

// Aggiunge XP al profilo e ritorna il nuovo { level, exp, levelsGained }.
// `stats` può essere parziale/undefined; gained negativo viene ignorato
// (le penalità di XP non fanno parte del modello attuale).
export function applyXp(stats, gained) {
  let level = Math.max(1, Math.floor(Number(stats?.level) || 1));
  let exp = Math.max(0, Number(stats?.exp) || 0) + Math.max(0, Number(gained) || 0);
  let levelsGained = 0;
  while (exp >= xpNeededFor(level) && levelsGained < 500) {
    exp -= xpNeededFor(level);
    level += 1;
    levelsGained += 1;
  }
  return { level, exp, levelsGained };
}

// Percentuale di avanzamento nel livello corrente (0-100) per le progress bar.
export function expProgressPct(stats) {
  const level = Math.max(1, Math.floor(Number(stats?.level) || 1));
  const exp = Math.max(0, Number(stats?.exp) || 0);
  return Math.min(100, (exp / xpNeededFor(level)) * 100);
}

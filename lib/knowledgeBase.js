// ─────────────────────────────────────────────────────────────────────────────
//  Base di conoscenza distillata dai paper scientifici forniti dall'utente.
//  GENERATO da tools/knowledge.mjs — non modificare a mano (verrà sovrascritto).
//  Vuoto = nessuna iniezione nei prompt (comportamento neutro, zero overhead).
// ─────────────────────────────────────────────────────────────────────────────

// Ogni principio è una frase azionabile e concreta, distillata da un paper.
export const NUTRITION_PRINCIPLES = [];

// Metadati delle fonti elaborate (per trasparenza / citazioni).
export const KNOWLEDGE_SOURCES = [];

// Blocco di testo compatto da iniettare nel system prompt dell'assistente.
// Ritorna '' se non ci sono principi → non gonfia il prompt quando è vuoto.
export function knowledgePrompt(max = 1800) {
  if (!Array.isArray(NUTRITION_PRINCIPLES) || !NUTRITION_PRINCIPLES.length) return '';
  let body = NUTRITION_PRINCIPLES.map((p, i) => `${i + 1}. ${p}`).join('\n');
  if (body.length > max) body = body.slice(0, max).replace(/\n[^\n]*$/, '') + '\n…';
  return `\n\nPRINCIPI SCIENTIFICI (distillati da paper forniti dall'utente — fonda i consigli su questi e citali quando pertinenti):\n${body}`;
}

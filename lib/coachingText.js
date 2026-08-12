// ─────────────────────────────────────────────────────────────────────────────
// Normalizzazione dei cue di coaching prodotti dai modelli AI (visual.js).
//
// I modelli a volte:
//  - troncano il marker di riga: "ANDO:" invece di "COMANDO:" (o "MANDO:")
//  - duplicano parole: "piede piede" / suffissi fusi tipo "allinearloallo"
// Prima di mostrare, parlare o salvare un cue lo normalizziamo qui.
// ─────────────────────────────────────────────────────────────────────────────

// Marker di riga attesi nel formato del maestro. Accetta anche varianti
// tronche del COMANDO (ANDO/MANDO/OMANDO…) e le normalizza in canonicalMarker.
export const MARKER_RE = /^([A-ZÀ]{0,4}(?:ANDO|OMANDO)|BENE|PROVA|VISTO|PERCH[ÉE]|SITUAZIONE|ISTRUZIONE|PUNTO)\s*:\s*/;

// Riporta una variante di marker al nome canonico ("ANDO"→"COMANDO").
export function canonicalMarker(marker) {
  const k = String(marker || '').toUpperCase().replace('PERCHE', 'PERCHÉ');
  if (/[A-ZÀ]*ANDO$/.test(k) || k === 'OMANDO') return 'COMANDO';
  return k;
}

// Pulizia generale del testo: rimuove parole consecutive duplicate e
// comprime gli spazi. Non tocca il contenuto legittimo.
export function normalizeCoachingText(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\b([a-zA-Zà-ù]{3,})\s+\1\b/gi, '$1') // "piede piede" → "piede"
    .replace(/\s+/g, ' ')
    .trim();
}

// Estrae la riga COMANDO da un output multi-riga del maestro, tollerando
// marker tronchi. Ritorna null se non c'è una riga di comando.
export function extractCommand(content) {
  if (!content) return null;
  for (const line of String(content).split('\n')) {
    const m = line.match(MARKER_RE);
    if (m && canonicalMarker(m[1]) === 'COMANDO') {
      return normalizeCoachingText(line.slice(m[0].length));
    }
  }
  return null;
}

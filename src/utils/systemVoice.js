// ─────────────────────────────────────────────────────────────────────────────
// VOCE DEL SISTEMA — fredda, robotica, stile Solo Leveling.
// Non è il Maestro: è il Sistema che notifica gli eventi (quest, gradi, ombre).
// Rispetta il toggle suoni globale e aggiunge blip di apertura/chiusura.
// ─────────────────────────────────────────────────────────────────────────────
import { playSfx } from './sfx';

const soundOn = () => {
  try { return window.localStorage.getItem('shadow_monarch_sound') !== '0'; } catch { return true; }
};

let voicesCache = null;
const pickItalianVoice = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (!voicesCache) {
    voicesCache = window.speechSynthesis.getVoices();
    if (!voicesCache.length) {
      // iOS carica le voci in ritardo
      window.speechSynthesis.onvoiceschanged = () => { voicesCache = window.speechSynthesis.getVoices(); };
      return null;
    }
  }
  return voicesCache.find((v) => /^it/i.test(v.lang)) || null;
};

// Annuncio del Sistema. max ~1 frase: il Sistema è sintetico, non chiacchiera.
export function speakSystem(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !soundOn()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.pitch = 0.5;   // voce bassa e metallica
    u.rate = 1.02;   // leggermente rapida: è una notifica
    u.volume = 1;
    const v = pickItalianVoice();
    if (v) u.voice = v;
    playSfx('countdown', true, 'cyber');
    u.onend = () => { try { playSfx('countdown', true, 'cyber'); } catch {} };
    window.speechSynthesis.speak(u);
  } catch {}
}

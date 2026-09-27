import { useCallback, useState } from 'react';
import { dayTargets, profile as basePlanProfile } from '../data/cutPlan';

// Profilo del Protocollo Cut, legato al browser come il chat_id Telegram:
// ogni telefono vede i propri numeri, non quelli di chi ha scritto il piano.
const KEY = 'shadow_monarch_cut_profile_v1';
const TG_ID_KEY = 'shadow_monarch_tg_chat_id';
const EMANUELE_CHAT_ID = '264863579';

const readChatId = () => {
  try { return window.localStorage.getItem(TG_ID_KEY) || ''; } catch { return ''; }
};

const defaultProfile = () => (readChatId() === EMANUELE_CHAT_ID
  ? { ...basePlanProfile, sex: 'm' }
  : null);

export const readCutProfile = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && saved.startWeightKg > 0 && saved.targetWeightKg > 0) return saved;
  } catch { /* profilo corrotto: si riparte dal default */ }
  return defaultProfile();
};

export function useCutProfile() {
  const [profile, setProfile] = useState(readCutProfile);
  const saveProfile = useCallback((next) => {
    setProfile(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage pieno o bloccato */ }
  }, []);
  return [profile, saveProfile];
}

// Mifflin-St Jeor: serve solo a riscalare i target del piano (scritti per il
// profilo base) sul metabolismo di chi lo usa.
const bmr = ({ sex, age, heightCm, startWeightKg }) =>
  10 * startWeightKg + 6.25 * heightCm - 5 * age + (sex === 'f' ? -161 : 5);

export const dayTargetFor = (profile, dayIndex) => {
  const base = dayTargets[dayIndex];
  if (!profile?.age || !profile?.heightCm) return base;
  const ratio = bmr(profile) / bmr({ ...basePlanProfile, sex: 'm' });
  return Math.round((base * ratio) / 50) * 50;
};

export const formatKg = (value) => `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;

export const describeProfile = (profile) => {
  if (!profile) return 'Non ho ancora impostato il mio profilo: chiedimi età, altezza, peso e obiettivo prima di dare numeri.';
  const parts = [
    profile.age && `${profile.age} anni`,
    profile.heightCm && `${profile.heightCm} cm`,
    `${formatKg(profile.startWeightKg)} kg`,
  ].filter(Boolean);
  return `Usa il mio profilo: ${parts.join(', ')}. Voglio arrivare gradualmente a circa ${formatKg(profile.targetWeightKg)} kg.`;
};

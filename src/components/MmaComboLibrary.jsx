import React, { Suspense, lazy, useState } from 'react';
import { ArrowRight, Check, GraduationCap } from 'lucide-react';
import { loadTemplates } from '../../lib/mmaTemplates';
import MmaComboPlayer from './MmaComboPlayer';
import { COMBOS, COMBO_CATEGORIES, LEVELS } from '../data/mmaCombos';
import { MOVES } from '../data/mmaMoves';

const MmaTeach = lazy(() => import('./MmaTeach'));
const KEY = 'shadow_monarch_mma_combos_v1';
const readStance = () => { try { return localStorage.getItem('shadow_monarch_mma_stance') === 'southpaw' ? 'southpaw' : 'orthodox'; } catch { return 'orthodox'; } };
const readLearned = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
// iOS lascia parlare la sintesi vocale solo dopo un tocco: la "sblocchiamo" nel tap che apre la combo.
const unlockVoice = () => {
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* niente voce */ }
};

// Libreria di tutte le combo MMA, divise per categoria; ognuna si apre nel player
// dove il coach la insegna colpo per colpo.
export default function MmaComboLibrary() {
  const [category, setCategory] = useState('boxing');
  const [openId, setOpenId] = useState(null);
  const [learned, setLearned] = useState(readLearned);
  const [teachOpen, setTeachOpen] = useState(false);
  const [taught, setTaught] = useState(() => loadTemplates(readStance()));
  const list = COMBOS.filter((combo) => combo.category === category);
  const open = COMBOS.find((combo) => combo.id === openId);
  const toggleLearned = (id) => setLearned((prev) => {
    const next = { ...prev };
    if (next[id]) delete next[id]; else next[id] = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage */ }
    return next;
  });

  return <section className="cut-section mma-combos">
    {open && <MmaComboPlayer combo={open} learned={Boolean(learned[open.id])} onLearned={() => toggleLearned(open.id)} onClose={() => setOpenId(null)} />}
    <div className="cut-section-title mma-section-title"><span>COMBO MMA · IL COACH TE LE INSEGNA</span><span>{Object.keys(learned).filter((id) => COMBOS.some((c) => c.id === id)).length}/{COMBOS.length}</span></div>
    {teachOpen && <Suspense fallback={null}><MmaTeach onClose={() => { setTeachOpen(false); setTaught(loadTemplates(readStance())); }} /></Suspense>}
    <button className={`mma-teach-banner ${taught ? 'done' : ''}`} onClick={() => { unlockVoice(); setTeachOpen(true); }}><GraduationCap size={22} /><span><b>{taught ? `Il coach conosce ${new Set(taught.items.map((it) => it.move)).size} tuoi colpi` : 'Insegna i tuoi colpi al coach'}</b><small>{taught ? 'Rifallo se cambi posto o angolo della camera.' : '2 minuti con la camera: poi riconosce te, i tuoi colpi e il tuo angolo.'}</small></span><ArrowRight size={17} /></button>
    <div className="mma-combo-cats" role="tablist">{COMBO_CATEGORIES.map((cat) => <button key={cat.id} role="tab" aria-selected={category === cat.id} className={category === cat.id ? 'active' : ''} style={{ '--tone': cat.tone }} onClick={() => setCategory(cat.id)}>{cat.name}<em>{COMBOS.filter((c) => c.category === cat.id).length}</em></button>)}</div>
    <div className="mma-combo-list">{list.map((combo) => <button key={combo.id} className={`mma-combo-card ${learned[combo.id] ? 'learned' : ''}`} onClick={() => { unlockVoice(); setOpenId(combo.id); }}>
      <span className="mma-combo-card-top"><b>{combo.name}</b><small className={`lvl-${combo.level}`}>{LEVELS[combo.level]}</small></span>
      <span className="mma-combo-chips">{combo.moves.map((id, index) => <i key={`${id}-${index}`}>{MOVES[id].num}</i>)}</span>
      <span className="mma-combo-why">{combo.why}</span>
      {learned[combo.id] ? <Check size={18} className="mma-combo-go" /> : <ArrowRight size={18} className="mma-combo-go" />}
    </button>)}</div>
    <p className="cut-fine">Colpi con i guanti e con controllo. Gomiti, ginocchiate e atterramenti solo in palestra, con istruttore e protezioni.</p>
  </section>;
}

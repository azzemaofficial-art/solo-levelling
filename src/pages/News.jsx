import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import ScienceFeed from '../components/ScienceFeed.jsx';
import { NUTRITION_PRINCIPLES, KNOWLEDGE_SOURCES } from '../../lib/knowledgeBase.js';

// ─────────────────────────────────────────────────────────────────────────────
//  News — "Novità dagli Studi" come destinazione di primo livello (menu home),
//  non più sepolta a metà scroll di System. Stessa logica di personalizzazione
//  di ScienceFeed (segnali dai check-in), qui derivata da playerStats così la
//  pagina è autonoma e raggiungibile da qualunque punto dell'app.
// ─────────────────────────────────────────────────────────────────────────────

const OBJECTIVE_SIGNAL = {
  cut: { label: 'Obiettivo: definizione', query: 'deficit calorico sazietà proteine massa magra grasso perdita peso' },
  bulk: { label: 'Obiettivo: massa', query: 'ipertrofia proteine creatina leucina sintesi muscolare volume allenamento' },
  recomp: { label: 'Obiettivo: ricomposizione', query: 'proteine composizione corporea forza muscolo grasso recupero' },
  longevity: { label: 'Obiettivo: longevità', query: 'longevità VO2max forza presa autofagia infiammazione sarcopenia' },
};

const News = ({ playerStats = {}, onAskCoach, onToast }) => {
  const signals = useMemo(() => {
    const s = [];
    const morning = playerStats.lastMorningCheckin || {};
    const evening = playerStats.lastEveningCheckin || {};
    const stress = Math.max(Number(morning.stress || 0), Number(evening.stress || 0));
    if (Number(morning.sleepQuality || 7) <= 5 || Number(morning.sleepHours || 7) < 6.5 || Number(morning.awakenings || 0) >= 3)
      s.push({ key: 'sonno', label: 'Sonno da sistemare', emoji: '🌙', query: 'sonno risveglio riposato melatonina qualità profondo caffeina luce blu circadiano' });
    if (stress >= 6)
      s.push({ key: 'stress', label: 'Stress alto', emoji: '🧘', query: 'stress cortisolo mindfulness respirazione meditazione ansia HRV resilienza' });
    if (Number(morning.energy ?? playerStats.energyLevel ?? 6) <= 4)
      s.push({ key: 'energia', label: 'Energia bassa', emoji: '⚡', query: 'energia fatica stanchezza caffeina ferro mitocondri glicemia pisolino' });
    if (Number(evening.bloating || 4) >= 6 || Number(evening.digestion || 6) <= 4)
      s.push({ key: 'intestino', label: 'Digestione ballerina', emoji: '🦠', query: 'intestino microbiota fibra gonfiore digestione probiotici butirrato fermentati' });
    if (Number(evening.craving || 5) >= 7 || Number(evening.hunger || 5) >= 8)
      s.push({ key: 'appetito', label: 'Fame e voglie alte', emoji: '🍽️', query: 'sazietà proteine fame grelina leptina fibra zucchero glicemia voglie' });
    const o = OBJECTIVE_SIGNAL[String(playerStats.objective || 'recomp')] || OBJECTIVE_SIGNAL.recomp;
    s.push({ key: 'obiettivo', label: o.label, emoji: '🎯', query: o.query });
    return s;
  }, [playerStats]);

  return (
    <div className="p-4 pt-8 pb-24 min-h-full bg-void-black">
      {/* Hero — perché questa pagina esiste, non un titolo e basta */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 relative overflow-hidden rounded-2xl p-4"
        style={{ background: 'linear-gradient(150deg, rgba(6,14,26,0.98), rgba(10,20,34,0.94) 60%, rgba(6,20,18,0.96))', border: '1px solid rgba(56,189,248,0.28)', boxShadow: '0 10px 36px rgba(14,165,233,0.14)' }}>
        <div className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(56,189,248,0.14)' }} />
        <p className="text-[9px] uppercase tracking-[0.4em] font-bold" style={{ color: 'rgba(125,211,252,0.95)' }}>◈ Ricercatore Notturno</p>
        <h1 className="text-xl font-black text-white mt-1 leading-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>Novità dagli Studi</h1>
        <p className="text-[11px] mt-1.5 leading-snug max-w-[46ch]" style={{ color: 'rgba(203,213,225,0.82)' }}>
          Ogni notte scandaglio nuovi paper scientifici e li trasformo in principi azionabili. Qui trovi quelli pertinenti a te ora — non i soliti consigli generici.
        </p>
        <div className="flex gap-2 mt-3">
          <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)' }}>
            <p className="text-sm font-black leading-none" style={{ color: '#7dd3fc' }}>{NUTRITION_PRINCIPLES.length.toLocaleString('it-IT')}</p>
            <p className="text-[7px] uppercase tracking-wider font-bold mt-0.5" style={{ color: 'rgba(125,211,252,0.75)' }}>principi</p>
          </div>
          <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <p className="text-sm font-black leading-none" style={{ color: '#34d399' }}>{KNOWLEDGE_SOURCES.length.toLocaleString('it-IT')}</p>
            <p className="text-[7px] uppercase tracking-wider font-bold mt-0.5" style={{ color: 'rgba(110,231,183,0.8)' }}>fonti / paper</p>
          </div>
        </div>
      </motion.div>

      <ScienceFeed signals={signals} onAskCoach={onAskCoach} onToast={onToast} />
    </div>
  );
};

export default News;

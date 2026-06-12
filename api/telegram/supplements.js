// Notifica Telegram integratori personalizzata — chiamata da cron-job.org 1x/giorno
// Suggerisce integratori in base a obiettivo, ora del giorno, profilo

const SLOT_SUPPLEMENTS = {
  morning: [
    { emoji: '☀️', name: 'Vitamina D3', dose: '1000-2000 IU', note: 'con colazione' },
    { emoji: '🔵', name: 'Creatina', dose: '5g', note: 'ogni giorno' },
    { emoji: '⚪', name: 'Multivitaminico', dose: '1 cps', note: 'con colazione' },
    { emoji: '🟤', name: 'Probiotico', dose: '1 cps', note: 'stomaco vuoto' },
  ],
  preworkout: [
    { emoji: '⚡', name: 'Creatina', dose: '3-5g', note: 'se non presa mattino' },
    { emoji: '🔴', name: 'Elettroliti', dose: '1 serving', note: 'pre/durante' },
    { emoji: '🟠', name: 'Caffeina', dose: '100-200mg', note: 'opzionale' },
  ],
  postworkout: [
    { emoji: '🥛', name: 'Whey Protein', dose: '25-35g', note: 'entro 30 min' },
    { emoji: '🔵', name: 'Creatina', dose: '5g', note: 'se non presa mattino' },
    { emoji: '🔴', name: 'Elettroliti', dose: '1 serving', note: 'recupero' },
  ],
  evening: [
    { emoji: '🟡', name: 'Omega-3', dose: '1000-2000mg EPA+DHA', note: 'con cena' },
    { emoji: '🟣', name: 'Magnesio', dose: '200-350mg', note: 'sera per sonno' },
    { emoji: '🌙', name: 'Caseina', dose: '25-30g', note: 'opzionale pre-sonno' },
  ],
};

function getSlot(utcHour) {
  const itHour = (utcHour + 2) % 24;
  if (itHour >= 7 && itHour < 11) return 'morning';
  if (itHour >= 15 && itHour < 18) return 'preworkout';
  if (itHour >= 18 && itHour < 21) return 'postworkout';
  if (itHour >= 21 || itHour < 1) return 'evening';
  return null;
}

export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancante' });
  }

  const utcHour = new Date().getUTCHours();
  const slot = getSlot(utcHour);

  if (!slot) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'Nessun slot attivo a questa ora' });
  }

  const supplements = SLOT_SUPPLEMENTS[slot] || [];

  const slotEmoji = { morning: '🌅', preworkout: '⚡', postworkout: '💪', evening: '🌙' }[slot];
  const slotLabel = { morning: 'Mattino', preworkout: 'Pre-workout', postworkout: 'Post-workout', evening: 'Sera' }[slot];

  const supList = supplements.map((s) => `${s.emoji} <b>${s.name}</b> — ${s.dose} <i>(${s.note})</i>`).join('\n');

  const message = `${slotEmoji} <b>Integratori ${slotLabel}</b>\n\n${supList}\n\n` +
    `💡 <i>Basato su profilo recomp. Scrivi <b>/integratori</b> al bot per lista completa.</i>\n\n` +
    `<a href="https://solo-levelling-gold.vercel.app">📱 Shadow Monarch System</a>`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.description || 'Telegram error');
    return res.status(200).json({ ok: true, slot, utcHour });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Telegram reminder — chiamato da cron-job.org 5x/giorno
// 5 job separati chiamano questo endpoint agli orari: 08:00 12:00 16:00 19:00 21:00 UTC
// Invia il promemoria del momento giusto + un nudge scientifico che ruota ogni giorno.

// Per ogni slot: un pool di messaggi (pasto + abitudine/integratore fondati sui paper).
// Ruotano per giorno dell'anno → ogni giorno un consiglio diverso, mai lo stesso a raffica.
const SLOTS = {
  8: { label: '🌅 Mattino', pool: [
    'Colazione + 30-40g di proteine: la sintesi muscolare riparte. Loggala! 🥣',
    '☀️ Esci alla luce naturale entro 30-60 min dal risveglio (5-15 min): regola energia e sonno della sera.',
    '💧 Inizia idratandoti. E se prendi creatina, ~5g vanno bene a qualsiasi ora — falla diventare abitudine.',
    'Caffè sì, ma l\'ultimo entro le 14-15: la caffeina dura ~5-6h e taglia il sonno profondo.',
    'Colazione proteica > zuccherata: stabilizza energia e fame fino a pranzo. Logga i macro!',
  ] },
  12: { label: '☀️ Pranzo', pool: [
    'Ora di pranzo! Punta a ~34-40g di proteine di qualità. Loggalo 🍽️',
    'Dopo pranzo: 10 minuti di camminata → picco glicemico più basso e meno sonnolenza. 🚶',
    'Riempi metà piatto di verdura: fibra (mira a 25-30g/die) = -15-30% mortalità. Logga il pasto!',
    'Concentra i carboidrati nella prima metà della giornata: l\'insulina lavora meglio ora.',
  ] },
  16: { label: '🍎 Pomeriggio', pool: [
    'Spuntino? Yogurt/kefir o frutta + noci. I fermentati nutrono il microbioma. Logga 🥤',
    '💧 Check acqua: sei a metà giornata, reidratati. Disidratazione = meno energia e forza.',
    'Cala di energia? Una doccia fredda o 2 min d\'aria fresca danno una sveglia pulita (dopamina).',
    'Allenamento oggi? Caffeina ~3-6 mg/kg 30-60 min prima migliora forza e resistenza.',
  ] },
  19: { label: '🌙 Cena', pool: [
    'Cena (meglio non troppo tardi)! Loggala 🍲. Cena leggera e anticipata = sonno e glicemia migliori.',
    'Stasera abbassa luci e schermi 1-2h prima di dormire: la luce blu rimanda la melatonina.',
    'Magnesio (bisglicinato) e/o ~3g di glicina prima di dormire aiutano ad addormentarsi.',
    'Evita l\'alcol: peggiora sonno profondo, recupero e testosterone. Logga la cena!',
  ] },
  21: { label: '🌃 Fine giornata', pool: [
    'Hai loggato tutto? Controlla i macro di oggi 📊',
    'Punta a 7-9h di sonno: <5h per una settimana = testosterone -10-15%. A letto in orario! 😴',
    'Domani: prepara la giornata. Costanza > intensità. Controlla i macro di oggi.',
    'Riposo = crescita. Il sonno profondo "lava" il cervello e ripara i muscoli. Buonanotte 🌙',
  ] },
};

export default async function handler(req, res) {
  const botToken = process.env.SHADOW_BOT_TOKEN;
  // SHADOW_BOT_CHAT_ID può contenere più ID (allow-list multi-utente, separati da
  // virgola): questo è un promemoria personale, va solo al primo (il proprietario).
  const chatId = String(process.env.SHADOW_BOT_CHAT_ID || '').split(/[\s,]+/)[0];
  if (!botToken || !chatId) return res.status(500).json({ error: 'SHADOW_BOT_TOKEN o SHADOW_BOT_CHAT_ID mancante' });

  const now = new Date();
  const slot = SLOTS[now.getUTCHours()] || { label: '📋 Promemoria', pool: ['Ricordati di loggare i tuoi pasti oggi!'] };
  // giorno dell'anno → ruota il messaggio del pool
  const dayOfYear = Math.floor((now - new Date(now.getUTCFullYear(), 0, 0)) / 86400000);
  const text = slot.pool[dayOfYear % slot.pool.length];

  const message = `${slot.label}\n\n${text}\n\n<a href="https://solo-levelling-steel.vercel.app">📱 Apri Shadow Monarch System</a>`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.description || 'Telegram error');
    return res.status(200).json({ ok: true, slot: slot.label });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

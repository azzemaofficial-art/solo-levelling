// Telegram meal reminder — chiamato da cron-job.org 5x/giorno
// 5 job separati chiamano questo endpoint agli orari: 08:00 12:00 16:00 19:00 21:00 UTC
// Invia il messaggio giusto in base all'ora italiana corrente

const MEAL_SLOTS = [
  { utcHour: 8,  label: '🌅 Colazione',    text: 'Hai fatto colazione? Logga calorie, proteine e macro! 🥣' },
  { utcHour: 12, label: '☀️ Pranzo',        text: 'Ora di pranzo! Ricordati di loggare il pasto 🍽️' },
  { utcHour: 16, label: '🍎 Spuntino',      text: 'Spuntino pomeridiano? Logga quello che mangi 🥤' },
  { utcHour: 19, label: '🌙 Cena',          text: 'Cena time! Logga il pasto serale 🍲' },
  { utcHour: 21, label: '🌃 Fine giornata', text: 'Fine giornata — hai loggato tutto? Controlla i macro di oggi 📊' },
];

export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancante' });
  }

  const now = new Date();
  const utcHour = now.getUTCHours();
  const slot = MEAL_SLOTS.find((s) => s.utcHour === utcHour);

  const label = slot?.label || '📋 Promemoria';
  const text = slot?.text || 'Ricordati di loggare i tuoi pasti oggi!';

  const message = `${label}\n\n${text}\n\n<a href="https://solo-levelling-gold.vercel.app">📱 Apri Shadow Monarch System</a>`;

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );
    const data = await telegramRes.json();
    if (!data.ok) throw new Error(data.description || 'Telegram error');

    return res.status(200).json({ ok: true, slot: label, utcHour });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

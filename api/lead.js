const { sql, ensureSchema } = require('./_db');

async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const body = await res.json();
    if (body.ok) return { ok: true };
    return { ok: false, error: body.description || 'Неизвестная ошибка Telegram API' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const data = req.body || {};
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const country = String(data.country || '').trim();
  const model = String(data.model || '').trim();
  const budget = String(data.budget || '').trim();
  const source = String(data.source || '').trim();

  await ensureSchema();

  let leadId;
  try {
    const inserted = await sql`
      INSERT INTO leads (name, phone, country, model, budget, source, telegram_ok)
      VALUES (${name}, ${phone}, ${country}, ${model}, ${budget}, ${source}, false)
      RETURNING id
    `;
    leadId = inserted[0].id;
  } catch (err) {
    console.error('Не удалось сохранить заявку в БД:', err);
    res.status(500).json({ ok: false, error: 'не удалось сохранить заявку' });
    return;
  }

  const lines = ['\u{1F697} Новая заявка с сайта RUSHAUTO'];
  const fieldLabels = [
    ['name', 'Имя'],
    ['country', 'Направление'],
    ['model', 'Марка/модель'],
    ['budget', 'Бюджет'],
    ['phone', 'Телефон'],
    ['source', 'Источник'],
  ];
  for (const [key, label] of fieldLabels) {
    const value = { name, country, model, budget, phone, source }[key];
    if (value) lines.push(`${label}: ${value}`);
  }

  const tg = await sendToTelegram(lines.join('\n'));
  if (tg.ok) {
    await sql`UPDATE leads SET telegram_ok = true WHERE id = ${leadId}`;
  } else {
    console.error('Telegram send failed (заявка всё равно сохранена в БД):', tg.error);
  }

  // Заявка уже сохранена в БД, поэтому отвечаем клиенту успехом
  // даже если пересылка в Telegram не удалась — данные не потеряны.
  res.status(200).json({ ok: true });
};

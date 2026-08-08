const { pool, ensureSchema } = require('./_db');

async function sendViaBot(token, chatId, text) {
  if (!token || !chatId) {
    return { ok: false, error: 'токен или chat_id не заданы' };
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

async function sendToTelegram(text) {
  return sendViaBot(process.env.TELEGRAM_BOT_TOKEN_2, process.env.TELEGRAM_CHAT_ID_2, text);
}

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_PER_WINDOW = 3;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  const data = req.body || {};

  // Honeypot: скрытое поле, которое обычные пользователи не видят и не
  // заполняют, а простые спам-боты — заполняют. Тихо "принимаем" заявку,
  // чтобы бот не понял, что его отфильтровали.
  if (String(data.website || '').trim()) {
    res.status(200).json({ ok: true });
    return;
  }

  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const country = String(data.country || '').trim();
  const model = String(data.model || '').trim();
  const bodyType = String(data.bodyType || '').trim();
  const year = String(data.year || '').trim();
  const exteriorColor = String(data.exteriorColor || '').trim();
  const interiorColor = String(data.interiorColor || '').trim();
  const budget = String(data.budget || '').trim();
  const source = String(data.source || '').trim();
  const ip = getClientIp(req);

  await ensureSchema();

  if (ip) {
    const recent = await pool.query(
      `SELECT COUNT(*) FROM leads WHERE ip = $1 AND created_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
      [ip]
    );
    if (Number(recent.rows[0].count) >= RATE_LIMIT_MAX_PER_WINDOW) {
      res.status(429).json({ ok: false, error: 'Слишком много заявок подряд. Попробуйте позже или напишите в WhatsApp.' });
      return;
    }
  }

  let leadId;
  try {
    const inserted = await pool.query(
      `INSERT INTO leads (name, phone, country, model, body_type, year, exterior_color, interior_color, budget, source, ip, telegram_ok)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING id`,
      [name, phone, country, model, bodyType, year, exteriorColor, interiorColor, budget, source, ip]
    );
    leadId = inserted.rows[0].id;
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
    ['bodyType', 'Тип кузова'],
    ['year', 'Год выпуска'],
    ['exteriorColor', 'Цвет кузова'],
    ['interiorColor', 'Цвет салона'],
    ['budget', 'Бюджет'],
    ['phone', 'Телефон'],
    ['source', 'Источник'],
  ];
  for (const [key, label] of fieldLabels) {
    const value = { name, country, model, bodyType, year, exteriorColor, interiorColor, budget, phone, source }[key];
    if (value) lines.push(`${label}: ${value}`);
  }

  const tg = await sendToTelegram(lines.join('\n'));
  if (tg.ok) {
    await pool.query('UPDATE leads SET telegram_ok = true WHERE id = $1', [leadId]);
  } else {
    console.error('Telegram send failed (заявка всё равно сохранена в БД):', tg.error);
  }

  // Заявка уже сохранена в БД, поэтому отвечаем клиенту успехом
  // даже если пересылка в Telegram не удалась — данные не потеряны.
  res.status(200).json({ ok: true });
};

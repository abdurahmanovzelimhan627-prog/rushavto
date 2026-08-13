const { pool, ensureSchema } = require('./_db');

const RULES_TEXT =
  'Здравствуйте! Это бот RUSHAUTO для приёма заявок с сайта.\n\n' +
  'Перед началом использования, пожалуйста, ознакомьтесь:\n' +
  '— бот сохраняет ваш Telegram ID, имя пользователя и историю сообщений в этом чате;\n' +
  '— данные обрабатываются в соответствии с Политикой обработки персональных данных: https://24rushauto.ru/privacy.html\n' +
  '— нажимая «Согласен(на)», вы подтверждаете согласие на обработку этих данных.\n\n' +
  'Без согласия бот не сможет продолжить работу с вами.';

const CONSENT_CALLBACK = 'consent_accept';

async function callTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN_2;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function sendRules(chatId, username, firstName) {
  await pool.query(
    `INSERT INTO bot_consents (chat_id, username, first_name, rules_shown_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (chat_id) DO UPDATE SET username = $2, first_name = $3`,
    [chatId, username || null, firstName || null]
  );
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text: RULES_TEXT,
    reply_markup: {
      inline_keyboard: [[{ text: '✅ Согласен(на)', callback_data: CONSENT_CALLBACK }]],
    },
  });
}

async function hasConsented(chatId) {
  const result = await pool.query('SELECT consented_at FROM bot_consents WHERE chat_id = $1', [chatId]);
  return result.rows.length > 0 && result.rows[0].consented_at !== null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).end();
    return;
  }

  const update = req.body || {};
  await ensureSchema();

  try {
    // Нажатие кнопки согласия — сохраняем точную дату/время клика,
    // а не только сам факт согласия.
    if (update.callback_query && update.callback_query.data === CONSENT_CALLBACK) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;

      await pool.query(
        `UPDATE bot_consents SET consented_at = now() WHERE chat_id = $1`,
        [chatId]
      );
      await callTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Спасибо, согласие получено' });
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: 'Согласие получено. Сюда автоматически будут приходить новые заявки на подбор авто с сайта — отвечать в этом чате не нужно.',
      });
      res.status(200).json({ ok: true });
      return;
    }

    const message = update.message;
    if (message && message.chat) {
      const chatId = message.chat.id;
      const consented = await hasConsented(chatId);
      if (!consented) {
        // До получения согласия бот не обрабатывает содержимое сообщений —
        // на любое сообщение отвечаем только правилами и кнопкой согласия.
        await sendRules(chatId, message.from && message.from.username, message.from && message.from.first_name);
        res.status(200).json({ ok: true });
        return;
      }
      // Согласие уже есть — дальнейшая обработка обычных сообщений
      // (в этом боте после согласия отдельных команд не предусмотрено).
    }
  } catch (err) {
    console.error('Ошибка обработки Telegram webhook:', err);
  }

  res.status(200).json({ ok: true });
};

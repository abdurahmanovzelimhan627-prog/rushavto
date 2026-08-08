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
  const message = update.message;

  if (message && message.text === '/start') {
    const token = process.env.TELEGRAM_BOT_TOKEN_2;
    const chatId = message.chat.id;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Здравствуйте! Это бот RUSHAUTO для приёма заявок с сайта. Сюда автоматически будут приходить новые заявки на подбор авто — отвечать в этом чате не нужно.',
        }),
      });
    } catch (err) {
      console.error('Не удалось отправить приветствие:', err);
    }
  }

  res.status(200).json({ ok: true });
};

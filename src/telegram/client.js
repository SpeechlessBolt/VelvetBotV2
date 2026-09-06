const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function assertConfigured() {
  if (!BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN.');
}

async function api(method, payload = {}) {
  assertConfigured();
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data).slice(0, 800)}`);
  }
  return data.result;
}

function sendMessage(chatId, text, options = {}) {
  return api('sendMessage', { chat_id: chatId, text, ...options });
}

function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return api('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    ...(showAlert ? { show_alert: true } : {}),
  });
}

function copyMessage(toChatId, fromChatId, messageId, options = {}) {
  return api('copyMessage', {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: messageId,
    ...options,
  });
}

function setWebhook(url, secretToken) {
  return api('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

function getWebhookInfo() {
  return api('getWebhookInfo');
}

module.exports = {
  api,
  sendMessage,
  answerCallbackQuery,
  copyMessage,
  setWebhook,
  getWebhookInfo,
};

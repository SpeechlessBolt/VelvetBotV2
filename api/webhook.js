const { isAdmin, getForwardTarget, markUpdate, unmarkUpdate } = require('../src/storage/state');
const { claimAdmin } = require('../src/admin/auth');
const { showAdminHome, handleAdminCallback, handleAdminStateMessage } = require('../src/admin/panel');
const { sendMessage } = require('../src/telegram/client');
const { routeAdminReply } = require('../src/tickets/service');
const { startUser, goHome, handleUserCallback, handleUserMessage } = require('../src/users/handler');

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
}

function commandParts(text = '') {
  if (!text.startsWith('/')) return null;
  const parts = text.trim().split(/\s+/);
  const command = parts.shift().split('@')[0].toLowerCase();
  return { command, args: parts };
}

async function processMessage(message) {
  if (!message?.from?.id || !message?.chat?.id) return;
  const userId = message.from.id;
  const cmd = commandParts(message.text);

  if (cmd?.command === '/claim') {
    const code = cmd.args.join(' ');
    const result = await claimAdmin(userId, code);
    if (result.ok) {
      await sendMessage(userId, '✅ Human-admin access granted. Use /admin.');
      return;
    }
    if (result.reason === 'not_configured') {
      await sendMessage(userId, 'ADMIN_CLAIM_CODE is not configured on the server.');
      return;
    }
    await sendMessage(userId, '❌ Invalid admin claim code.');
    return;
  }

  const admin = await isAdmin(userId);

  if (cmd?.command === '/admin') {
    if (!admin) return sendMessage(userId, 'You are not an admin.');
    return showAdminHome(userId);
  }

  if (cmd?.command === '/cancel' && admin) {
    // Admin-state handler knows how to cancel active editing. If no state is active,
    // it simply falls through to the normal user flow.
    const handled = await handleAdminStateMessage(message);
    if (handled) return;
  }

  if (cmd?.command === '/start') return startUser(message);
  if (cmd?.command === '/menu') return goHome(userId);

  // Human admin replies get priority over editor/user state.
  if (admin && message.reply_to_message?.message_id) {
    const target = await getForwardTarget(userId, message.reply_to_message.message_id);
    if (target) {
      const result = await routeAdminReply(message, target);
      if (!result.ok) await sendMessage(userId, 'That ticket is already closed.');
      return;
    }
  }

  if (admin) {
    const handled = await handleAdminStateMessage(message);
    if (handled) return;
  }

  const handledByUserFlow = await handleUserMessage(message);
  if (!handledByUserFlow && !cmd) {
    await sendMessage(userId, 'Use /start or /menu to open the menu.');
  }
}

async function processCallback(callback) {
  if (!callback?.from?.id) return;
  const data = callback.data || '';
  if (data.startsWith('a:')) {
    if (!(await isAdmin(callback.from.id))) return;
    return handleAdminCallback(callback);
  }
  if (data.startsWith('u:')) return handleUserCallback(callback);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret) return res.status(500).json({ ok: false, error: 'WEBHOOK_SECRET missing' });
  const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (receivedSecret !== expectedSecret) return res.status(401).json({ ok: false });

  let update;
  try {
    update = parseBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const updateId = update.update_id;
  let marked = false;
  try {
    if (updateId !== undefined) {
      const markResult = await markUpdate(updateId);
      if (markResult === null) return res.status(200).json({ ok: true, duplicate: true });
      marked = true;
    }

    if (update.message) await processMessage(update.message);
    else if (update.callback_query) await processCallback(update.callback_query);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    if (marked && updateId !== undefined) {
      try { await unmarkUpdate(updateId); } catch {}
    }
    // A real failure returns 500 so Telegram can retry. update_id deduplication keeps
    // successful retries from being processed twice.
    return res.status(500).json({ ok: false });
  }
};

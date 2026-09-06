const { getFlow, getConfig, getOrCreateUser, saveUser } = require('../storage/state');
const { getNode } = require('../flow/model');
const { sendMessage, answerCallbackQuery } = require('../telegram/client');
const { sendContent, summarizeMessage } = require('../telegram/content');
const { inlineKeyboard, button } = require('../telegram/keyboards');
const { renderNode, renderRoot } = require('./render');
const { openTicket, relayUserMessage, closeTicket } = require('../tickets/service');

async function startUser(message) {
  const chatId = message.from.id;
  const [flow, config] = await Promise.all([getFlow(), getConfig()]);
  const user = await getOrCreateUser(chatId);

  if (user.activeTicket) await closeTicket(user, 'user', config, true);
  user.currentNodeId = flow.rootId;
  user.pendingQuestionNodeId = null;

  user.firstName = message.from.first_name || null;
  user.lastName = message.from.last_name || null;
  user.username = message.from.username || null;
  user.displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';

  if (!user.username) {
    user.awaitingName = true;
    await saveUser(chatId, user);
    return sendMessage(chatId, '⚠️ You do not have a Telegram username. Please create one in Telegram Settings, then return and press /start again.');
  }

  user.awaitingName = false;
  await saveUser(chatId, user);
  return renderRoot(chatId, flow, config);
}

async function goHome(userId) {
  const [flow, config] = await Promise.all([getFlow(), getConfig()]);
  const user = await getOrCreateUser(userId);
  if (user.activeTicket) await closeTicket(user, 'user', config, true);
  user.currentNodeId = flow.rootId;
  user.pendingQuestionNodeId = null;
  user.awaitingName = false;
  await saveUser(userId, user);
  return renderRoot(userId, flow, config);
}

async function handleUserCallback(callback) {
  const chatId = callback.from.id;
  const data = callback.data || '';
  const [flow, config] = await Promise.all([getFlow(), getConfig()]);
  const user = await getOrCreateUser(chatId);

  if (data === 'u:exit') {
    await answerCallbackQuery(callback.id).catch(() => {});
    if (user.activeTicket) await closeTicket(user, 'user', config, true);
    await sendMessage(chatId, config.texts.chat_closed_by_user);
    const node = getNode(flow, user.currentNodeId) || getNode(flow, flow.rootId);
    return renderNode(chatId, flow, node, config, { sendContent: false, prompt: config.texts.choose_option });
  }

  if (user.activeTicket) {
    return answerCallbackQuery(callback.id, 'Leave the current chat first.', true).catch(() => {});
  }

  await answerCallbackQuery(callback.id).catch(() => {});

  if (data === 'u:home') {
    user.currentNodeId = flow.rootId;
    user.pendingQuestionNodeId = null;
    await saveUser(chatId, user);
    return renderRoot(chatId, flow, config);
  }

  if (data === 'u:back') {
    const current = getNode(flow, user.currentNodeId) || getNode(flow, flow.rootId);
    const parent = getNode(flow, current.parentId) || getNode(flow, flow.rootId);
    user.currentNodeId = parent.id;
    user.pendingQuestionNodeId = null;
    await saveUser(chatId, user);
    return renderNode(chatId, flow, parent, config);
  }

  if (data.startsWith('u:n:')) {
    const nodeId = data.slice('u:n:'.length);
    const node = getNode(flow, nodeId);
    if (!node) return sendMessage(chatId, 'That option no longer exists. Please use /menu.');

    user.currentNodeId = node.id;
    user.pendingQuestionNodeId = null;
    await saveUser(chatId, user);

    if (node.action === 'question') {
      user.pendingQuestionNodeId = node.id;
      await saveUser(chatId, user);
      return sendContent(chatId, node.content);
    }

    if (node.action === 'chat') {
      const opened = await openTicket(user, flow, node);
      if (!opened.ok) return sendMessage(chatId, config.texts.no_admins);
      const exitMarkup = inlineKeyboard([
        [button(config.texts.exit_chat_label, 'u:exit')],
      ]);
      return sendContent(chatId, node.content, { reply_markup: exitMarkup });
    }

    return renderNode(chatId, flow, node, config);
  }
}

async function handleUserMessage(message) {
  const chatId = message.from.id;
  const [flow, config] = await Promise.all([getFlow(), getConfig()]);
  const user = await getOrCreateUser(chatId);

  if (user.awaitingName) {
    if (!message.text?.trim()) {
      await sendMessage(chatId, 'Please send your name/ID as text.');
      return true;
    }
    user.displayName = message.text.trim().slice(0, 80);
    user.awaitingName = false;
    await saveUser(chatId, user);
    if (config.texts.name_saved) await sendMessage(chatId, config.texts.name_saved);
    await renderRoot(chatId, flow, config);
    return true;
  }

  if (user.pendingQuestionNodeId) {
    const node = getNode(flow, user.pendingQuestionNodeId);
    if (!node) {
      user.pendingQuestionNodeId = null;
      await saveUser(chatId, user);
      await sendMessage(chatId, 'That question no longer exists.');
      return true;
    }

    user.answers = user.answers || {};
    user.answers[node.id] = {
      label: node.label,
      summary: summarizeMessage(message),
      answeredAt: Date.now(),
    };
    user.pendingQuestionNodeId = null;
    user.currentNodeId = node.id;
    await saveUser(chatId, user);

    if (node.afterAnswerContent) await sendContent(chatId, node.afterAnswerContent);
    else if (config.texts.question_saved) await sendMessage(chatId, config.texts.question_saved);

    await renderNode(chatId, flow, node, config, { sendContent: false, prompt: config.texts.choose_option });
    return true;
  }

  if (user.activeTicket) {
    const result = await relayUserMessage(user, message);
    if (!result.ok) {
      await closeTicket(user, 'system', config, false);
      await sendMessage(chatId, config.texts.no_admins);
    }
    return true;
  }

  return false;
}

module.exports = { startUser, goHome, handleUserCallback, handleUserMessage };

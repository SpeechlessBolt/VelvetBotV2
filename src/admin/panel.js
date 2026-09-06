const {
  getFlow,
  saveFlow,
  getConfig,
  saveConfig,
  getAdminState,
  saveAdminState,
  clearAdminState,
  getStats,
  getUser,
  saveUser,
} = require('../storage/state');
const { sendMessage, answerCallbackQuery } = require('../telegram/client');
const { contentFromMessage } = require('../telegram/content');
const { inlineKeyboard, button } = require('../telegram/keyboards');
const {
  ACTION_NAMES,
  defaultContentForAction,
} = require('../flow/defaults');
const {
  getNode,
  getChildren,
  createNode,
  deleteSubtree,
  moveSibling,
  getPath,
} = require('../flow/model');
const { closeTicket } = require('../tickets/service');
const { renderNode } = require('../users/render');

const TEXT_LABELS = {
  ask_name: 'Name question',
  name_saved: 'After name is saved',
  question_saved: 'Default after-answer message',
  no_admins: 'No admin available',
  chat_closed_by_user: 'Chat closed by user',
  chat_closed_by_admin: 'Chat closed by admin',
  back_label: 'Back button label',
  home_label: 'Home button label',
  exit_chat_label: 'Leave-chat button label',
  choose_option: 'Generic choose-option prompt',
};

async function showAdminHome(chatId) {
  await clearAdminState(chatId);
  return sendMessage(chatId, '🛠 Admin panel\n\nEverything the user sees can be built from the Flow Builder.', {
    reply_markup: inlineKeyboard([
      [button('🧩 Flow Builder', 'a:flow:root')],
      [button('✏️ System texts', 'a:texts'), button('⚙️ Settings', 'a:settings')],
      [button('📊 Stats', 'a:stats')],
    ]),
  });
}

async function showNodeEditor(chatId, nodeId) {
  const flow = await getFlow();
  const node = getNode(flow, nodeId);
  if (!node) return sendMessage(chatId, 'That node no longer exists.');

  await clearAdminState(chatId);
  const children = getChildren(flow, node);
  const path = node.id === flow.rootId ? 'Home' : getPath(flow, node.id).join(' › ');
  const lines = [
    '🧩 FLOW BUILDER',
    '',
    `Path: ${path}`,
    `Button label: ${node.label}`,
    `Action: ${ACTION_NAMES[node.action] || node.action}`,
    `Child buttons: ${children.length}`,
  ];

  if (node.action === 'question') {
    lines.push(`After-answer content: ${node.afterAnswerContent ? 'custom' : 'default system text'}`);
  }

  const rows = [];
  for (const child of children) rows.push([button(`➡️ ${child.label}`, `a:flow:${child.id}`)]);
  rows.push([button('➕ Add button here', `a:add:${node.id}`)]);
  if (node.id !== flow.rootId) {
    rows.push([
      button('✏️ Label', `a:label:${node.id}`),
      button('🔄 Action', `a:action:${node.id}`),
    ]);
  }
  rows.push([
    button('📝 Edit content', `a:content:${node.id}`),
    button('🧹 Clear content', `a:clear:${node.id}`),
  ]);
  if (node.action === 'question') {
    rows.push([button('✅ Edit after-answer content', `a:after:${node.id}`)]);
  }
  if (node.id !== flow.rootId) {
    rows.push([
      button('⬆️ Move up', `a:up:${node.id}`),
      button('⬇️ Move down', `a:down:${node.id}`),
    ]);
    rows.push([button('🗑 Delete button + children', `a:del:${node.id}`)]);
    rows.push([button('⬅️ Parent', `a:flow:${node.parentId}`), button('🏠 Admin', 'a:home')]);
  } else {
    rows.push([button('🏠 Admin', 'a:home')]);
  }

  return sendMessage(chatId, lines.join('\n'), { reply_markup: inlineKeyboard(rows) });
}

async function showActionPicker(chatId, nodeId) {
  return sendMessage(chatId, 'Choose what this button should do:', {
    reply_markup: inlineKeyboard([
      [button('📂 Show categories/buttons', `a:setact:${nodeId}:menu`)],
      [button('💬 Send something', `a:setact:${nodeId}:message`)],
      [button('❓ Ask the user something', `a:setact:${nodeId}:question`)],
      [button('👤 Start human-admin chat', `a:setact:${nodeId}:chat`)],
      [button('⬅️ Cancel', `a:flow:${nodeId}`)],
    ]),
  });
}

async function showNewActionPicker(chatId) {
  return sendMessage(chatId, 'Now choose what the new button should do:', {
    reply_markup: inlineKeyboard([
      [button('📂 Show categories/buttons', 'a:newact:menu')],
      [button('💬 Send something', 'a:newact:message')],
      [button('❓ Ask the user something', 'a:newact:question')],
      [button('👤 Start human-admin chat', 'a:newact:chat')],
      [button('❌ Cancel', 'a:home')],
    ]),
  });
}

async function showTexts(chatId) {
  const rows = Object.entries(TEXT_LABELS).map(([key, label]) => [button(label, `a:text:${key}`)]);
  rows.push([button('⬅️ Admin', 'a:home')]);
  return sendMessage(chatId, '✏️ SYSTEM TEXTS\n\nPick a user-facing text/label to edit.', {
    reply_markup: inlineKeyboard(rows),
  });
}

async function showSettings(chatId) {
  const config = await getConfig();
  const value = config.settings.askNameOnFirstStart ? 'ON ✅' : 'OFF ❌';
  return sendMessage(chatId, `⚙️ SETTINGS\n\nAsk new users for a name/ID: ${value}`, {
    reply_markup: inlineKeyboard([
      [button('Toggle name question', 'a:toggle:name')],
      [button('⬅️ Admin', 'a:home')],
    ]),
  });
}

async function handleAdminCallback(callback) {
  const chatId = callback.from.id;
  const data = callback.data || '';
  await answerCallbackQuery(callback.id).catch(() => {});

  if (data === 'a:home') return showAdminHome(chatId);
  if (data === 'a:texts') return showTexts(chatId);
  if (data === 'a:settings') return showSettings(chatId);
  if (data === 'a:stats') {
    const stats = await getStats();
    return sendMessage(chatId, `📊 STATS\n\nUsers: ${stats.users}\nTickets created: ${stats.tickets}\nAdmins: ${stats.admins}`, {
      reply_markup: inlineKeyboard([[button('⬅️ Admin', 'a:home')]]),
    });
  }

  if (data === 'a:toggle:name') {
    const config = await getConfig();
    config.settings.askNameOnFirstStart = !config.settings.askNameOnFirstStart;
    await saveConfig(config);
    return showSettings(chatId);
  }

  if (data.startsWith('a:flow:')) return showNodeEditor(chatId, data.slice('a:flow:'.length));

  if (data.startsWith('a:add:')) {
    const parentId = data.slice('a:add:'.length);
    await saveAdminState(chatId, { mode: 'new_label', parentId });
    return sendMessage(chatId, 'Send the exact label for the new button.\n\nExample: 🎭 Start roleplay\n\nSend /cancel to stop.');
  }

  if (data.startsWith('a:label:')) {
    const nodeId = data.slice('a:label:'.length);
    await saveAdminState(chatId, { mode: 'edit_label', nodeId });
    return sendMessage(chatId, 'Send the new button label. Send /cancel to stop.');
  }

  if (data.startsWith('a:action:')) return showActionPicker(chatId, data.slice('a:action:'.length));

  if (data.startsWith('a:setact:')) {
    const [, , nodeId, action] = data.split(':');
    const flow = await getFlow();
    const node = getNode(flow, nodeId);
    if (!node) return sendMessage(chatId, 'Node not found.');
    node.action = action;
    if (!node.content) node.content = defaultContentForAction(action);
    if (action !== 'question') node.afterAnswerContent = null;
    await saveFlow(flow);
    return showNodeEditor(chatId, nodeId);
  }

  if (data.startsWith('a:newact:')) {
    const action = data.slice('a:newact:'.length);
    const state = await getAdminState(chatId);
    if (!state || state.mode !== 'new_action' || !state.parentId || !state.label) {
      return sendMessage(chatId, 'That draft expired. Start Add button again.');
    }
    const flow = await getFlow();
    const node = createNode(flow, state.parentId, state.label, action, defaultContentForAction(action));
    await saveFlow(flow);
    await clearAdminState(chatId);
    await sendMessage(chatId, '✅ Button created. Now edit its content if needed.');
    return showNodeEditor(chatId, node.id);
  }

  if (data.startsWith('a:content:')) {
    const nodeId = data.slice('a:content:'.length);
    await saveAdminState(chatId, { mode: 'capture_content', nodeId });
    return sendMessage(chatId, 'Send the exact content users should receive.\n\nSupported: text, photo, video, animation/GIF, document, audio, voice, sticker, or video note. Formatting/entities are preserved.\n\nSend /cancel to stop.');
  }

  if (data.startsWith('a:after:')) {
    const nodeId = data.slice('a:after:'.length);
    await saveAdminState(chatId, { mode: 'capture_after', nodeId });
    return sendMessage(chatId, 'Send the content users should receive AFTER answering this question.\n\nSend /default to use the global default again, or /cancel to stop.');
  }

  if (data.startsWith('a:clear:')) {
    const nodeId = data.slice('a:clear:'.length);
    const flow = await getFlow();
    const node = getNode(flow, nodeId);
    if (!node) return sendMessage(chatId, 'Node not found.');
    node.content = null;
    await saveFlow(flow);
    return showNodeEditor(chatId, nodeId);
  }

  if (data.startsWith('a:up:') || data.startsWith('a:down:')) {
    const up = data.startsWith('a:up:');
    const nodeId = data.slice(up ? 'a:up:'.length : 'a:down:'.length);
    const flow = await getFlow();
    moveSibling(flow, nodeId, up ? 'up' : 'down');
    await saveFlow(flow);
    return showNodeEditor(chatId, nodeId);
  }

  if (data.startsWith('a:del:')) {
    const nodeId = data.slice('a:del:'.length);
    const flow = await getFlow();
    const node = getNode(flow, nodeId);
    if (!node || nodeId === flow.rootId) return sendMessage(chatId, 'That button cannot be deleted.');
    return sendMessage(chatId, `Delete “${node.label}” AND every button under it?`, {
      reply_markup: inlineKeyboard([
        [button('🗑 Yes, delete subtree', `a:yesdel:${nodeId}`)],
        [button('❌ Cancel', `a:flow:${nodeId}`)],
      ]),
    });
  }

  if (data.startsWith('a:yesdel:')) {
    const nodeId = data.slice('a:yesdel:'.length);
    const flow = await getFlow();
    const node = getNode(flow, nodeId);
    if (!node || nodeId === flow.rootId) return sendMessage(chatId, 'Nothing to delete.');
    const parentId = node.parentId;
    deleteSubtree(flow, nodeId);
    await saveFlow(flow);
    await sendMessage(chatId, '✅ Deleted.');
    return showNodeEditor(chatId, parentId);
  }

  if (data.startsWith('a:text:')) {
    const key = data.slice('a:text:'.length);
    if (!TEXT_LABELS[key]) return sendMessage(chatId, 'Unknown text key.');
    const config = await getConfig();
    await saveAdminState(chatId, { mode: 'edit_system_text', key });
    return sendMessage(
      chatId,
      `Editing: ${TEXT_LABELS[key]}\n\nCurrent value:\n${config.texts[key]}\n\nSend the new value. Send /empty for blank or /cancel to stop.`
    );
  }

  if (data.startsWith('a:ct:')) {
    const [, , userId, ticketId] = data.split(':');
    const user = await getUser(userId);
    if (!user?.activeTicket || Number(user.activeTicket.id) !== Number(ticketId)) {
      return sendMessage(chatId, 'That ticket is already closed.');
    }
    const config = await getConfig();
    await closeTicket(user, 'admin', config, true);
    await sendMessage(Number(userId), config.texts.chat_closed_by_admin).catch(() => {});
    const flow = await getFlow();
    const node = getNode(flow, user.currentNodeId) || getNode(flow, flow.rootId);
    await renderNode(Number(userId), flow, node, config, {
      sendContent: false,
      prompt: config.texts.choose_option,
    }).catch(() => {});
    return sendMessage(chatId, `✅ Ticket #${ticketId} closed.`);
  }
}

async function handleAdminStateMessage(message) {
  const adminId = message.from.id;
  const state = await getAdminState(adminId);
  if (!state) return false;

  if (message.text === '/cancel') {
    await clearAdminState(adminId);
    await sendMessage(adminId, 'Cancelled.');
    await showAdminHome(adminId);
    return true;
  }

  if (state.mode === 'new_label') {
    if (!message.text?.trim()) {
      await sendMessage(adminId, 'Please send a text label for the button.');
      return true;
    }
    const label = message.text.trim().slice(0, 64);
    await saveAdminState(adminId, { mode: 'new_action', parentId: state.parentId, label });
    await showNewActionPicker(adminId);
    return true;
  }

  if (state.mode === 'edit_label') {
    if (!message.text?.trim()) {
      await sendMessage(adminId, 'Please send a text label.');
      return true;
    }
    const flow = await getFlow();
    const node = getNode(flow, state.nodeId);
    if (!node) {
      await clearAdminState(adminId);
      await sendMessage(adminId, 'Node not found.');
      return true;
    }
    node.label = message.text.trim().slice(0, 64);
    await saveFlow(flow);
    await clearAdminState(adminId);
    await showNodeEditor(adminId, node.id);
    return true;
  }

  if (state.mode === 'capture_content' || state.mode === 'capture_after') {
    if (state.mode === 'capture_after' && message.text === '/default') {
      const flow = await getFlow();
      const node = getNode(flow, state.nodeId);
      if (node) {
        node.afterAnswerContent = null;
        await saveFlow(flow);
      }
      await clearAdminState(adminId);
      await showNodeEditor(adminId, state.nodeId);
      return true;
    }

    const content = contentFromMessage(message);
    if (!content) {
      await sendMessage(adminId, 'That message type is not supported for saved content. Try text/photo/video/document/audio/voice/sticker.');
      return true;
    }
    const flow = await getFlow();
    const node = getNode(flow, state.nodeId);
    if (!node) {
      await clearAdminState(adminId);
      await sendMessage(adminId, 'Node not found.');
      return true;
    }
    if (state.mode === 'capture_after') node.afterAnswerContent = content;
    else node.content = content;
    await saveFlow(flow);
    await clearAdminState(adminId);
    await sendMessage(adminId, '✅ Saved.');
    await showNodeEditor(adminId, node.id);
    return true;
  }

  if (state.mode === 'edit_system_text') {
    if (message.text === undefined) {
      await sendMessage(adminId, 'System text/labels must be text.');
      return true;
    }
    const config = await getConfig();
    config.texts[state.key] = message.text === '/empty' ? '' : message.text;
    await saveConfig(config);
    await clearAdminState(adminId);
    await sendMessage(adminId, '✅ Saved.');
    await showTexts(adminId);
    return true;
  }

  return false;
}

module.exports = {
  showAdminHome,
  handleAdminCallback,
  handleAdminStateMessage,
};

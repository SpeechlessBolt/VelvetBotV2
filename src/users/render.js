const { sendContent } = require('../telegram/content');
const { sendMessage } = require('../telegram/client');
const { inlineKeyboard, button } = require('../telegram/keyboards');
const { getChildren, getNode } = require('../flow/model');

function navigationRows(flow, node, config) {
  const children = getChildren(flow, node);
  const rows = children.map((child) => [button(child.label, `u:n:${child.id}`)]);

  if (node.id !== flow.rootId) {
    rows.push([
      button(config.texts.back_label, 'u:back'),
      button(config.texts.home_label, 'u:home'),
    ]);
  }
  return rows;
}

async function renderNode(chatId, flow, node, config, options = {}) {
  const rows = navigationRows(flow, node, config);
  const markup = inlineKeyboard(rows);
  if (options.sendContent === false) {
    const prompt = options.prompt || 'Choose an option:';
    return sendMessage(chatId, prompt, rows.length ? { reply_markup: markup } : {});
  }
  return sendContent(chatId, node.content, rows.length ? { reply_markup: markup } : {});
}

async function renderRoot(chatId, flow, config) {
  return renderNode(chatId, flow, getNode(flow, flow.rootId), config);
}

module.exports = { navigationRows, renderNode, renderRoot };

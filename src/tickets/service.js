const {
  getAdmins,
  nextTicketId,
  rememberForward,
  getUser,
  saveUser,
} = require('../storage/state');
const { sendMessage, copyMessage } = require('../telegram/client');
const { inlineKeyboard, button } = require('../telegram/keyboards');
const { getPath } = require('../flow/model');

function answerSummary(user) {
  const entries = Object.values(user.answers || {});
  if (!entries.length) return '';
  return entries
    .map((a) => `• ${a.label}: ${a.summary}`)
    .join('\n')
    .slice(0, 2500);
}

async function openTicket(user, flow, node) {
  const admins = await getAdmins();
  if (!admins.length) return { ok: false, reason: 'no_admins' };

  const ticketId = await nextTicketId();
  user.activeTicket = {
    id: ticketId,
    nodeId: node.id,
    openedAt: Date.now(),
  };
  user.currentNodeId = node.id;
  user.pendingQuestionNodeId = null;
  await saveUser(user.id, user);

  const path = getPath(flow, node.id).join(' › ') || 'Home';
  const answers = answerSummary(user);
  const text = [
    `🟢 Ticket #${ticketId} opened`,
    `User: ${user.displayName || 'Unknown'}\nUsername: @${user.username || 'none'}\nTelegram ID: ${user.id}`,
    `Path: ${path}`,
    answers ? `\nCollected answers:\n${answers}` : '',
    '\nReply to this message or to any relayed user message to answer.',
  ].filter(Boolean).join('\n');

  for (const adminId of admins) {
    try {
      const sent = await sendMessage(adminId, text, {
        reply_markup: inlineKeyboard([
          [button('🔴 Close ticket', `a:ct:${user.id}:${ticketId}`)],
        ]),
      });
      await rememberForward(adminId, sent.message_id, { userId: user.id, ticketId });
    } catch (error) {
      console.error(`Could not notify admin ${adminId}:`, error.message);
    }
  }

  return { ok: true, ticketId };
}

async function relayUserMessage(user, message) {
  const admins = await getAdmins();
  if (!admins.length) return { ok: false, reason: 'no_admins' };
  if (!user.activeTicket) return { ok: false, reason: 'no_ticket' };

  const ticketId = user.activeTicket.id;
  let delivered = 0;

  for (const adminId of admins) {
    try {
      const header = await sendMessage(
        adminId,
        `🎫 #${ticketId} • ${user.displayName || 'User'}\nReply to this header or the message below.`,
        {
          reply_markup: inlineKeyboard([
            [button('🔴 Close ticket', `a:ct:${user.id}:${ticketId}`)],
          ]),
        }
      );
      await rememberForward(adminId, header.message_id, { userId: user.id, ticketId });

      const copied = await copyMessage(adminId, user.id, message.message_id);
      await rememberForward(adminId, copied.message_id, { userId: user.id, ticketId });
      delivered++;
    } catch (error) {
      console.error(`Relay to admin ${adminId} failed:`, error.message);
    }
  }
  return { ok: delivered > 0, delivered };
}

async function closeTicket(user, reason, config, notifyAdmins = true) {
  if (!user?.activeTicket) return null;
  const ticket = user.activeTicket;
  user.activeTicket = null;
  await saveUser(user.id, user);

  if (notifyAdmins) {
    const admins = await getAdmins();
    const label = reason === 'admin' ? 'closed by an admin' : 'closed by the user';
    for (const adminId of admins) {
      sendMessage(adminId, `🔴 Ticket #${ticket.id} ${label}.`).catch(() => {});
    }
  }
  return ticket;
}

async function routeAdminReply(adminMessage, target) {
  const user = await getUser(target.userId);
  if (!user?.activeTicket || Number(user.activeTicket.id) !== Number(target.ticketId)) {
    return { ok: false, reason: 'closed' };
  }

  await copyMessage(user.id, adminMessage.chat.id, adminMessage.message_id);
  return { ok: true };
}

module.exports = {
  openTicket,
  relayUserMessage,
  closeTicket,
  routeAdminReply,
};

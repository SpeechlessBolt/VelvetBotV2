const { getJSON, setJSON, incr, sadd, scard, set, del } = require('./redis');
const { defaultFlow, DEFAULT_CONFIG } = require('../flow/defaults');

const KEYS = {
  flow: 'v2:flow',
  config: 'v2:config',
  admins: 'v2:admins',
  ticketCounter: 'v2:counter:ticket',
  usersSet: 'v2:users',
};

async function getFlow() {
  let flow = await getJSON(KEYS.flow);
  if (!flow) {
    flow = defaultFlow();
    await setJSON(KEYS.flow, flow);
  }
  return flow;
}

async function saveFlow(flow) {
  await setJSON(KEYS.flow, flow);
}

async function getConfig() {
  const saved = await getJSON(KEYS.config, {});
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    settings: { ...DEFAULT_CONFIG.settings, ...(saved.settings || {}) },
    texts: { ...DEFAULT_CONFIG.texts, ...(saved.texts || {}) },
  };
}

async function saveConfig(config) {
  await setJSON(KEYS.config, config);
}

async function getAdmins() {
  return await getJSON(KEYS.admins, []);
}

async function saveAdmins(admins) {
  await setJSON(KEYS.admins, [...new Set(admins.map(Number))]);
}

async function isAdmin(userId) {
  return (await getAdmins()).includes(Number(userId));
}

async function getUser(userId) {
  return await getJSON(`v2:user:${userId}`, null);
}

function blankUser(userId) {
  return {
    id: Number(userId),
    displayName: null,
    currentNodeId: 'root',
    awaitingName: false,
    pendingQuestionNodeId: null,
    answers: {},
    activeTicket: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function getOrCreateUser(userId) {
  let user = await getUser(userId);
  if (!user) {
    user = blankUser(userId);
    await saveUser(userId, user);
  }
  await sadd(KEYS.usersSet, userId);
  return user;
}

async function saveUser(userId, user) {
  user.updatedAt = Date.now();
  await setJSON(`v2:user:${userId}`, user);
}

async function getAdminState(adminId) {
  return await getJSON(`v2:adminstate:${adminId}`, null);
}

async function saveAdminState(adminId, state) {
  await setJSON(`v2:adminstate:${adminId}`, state);
}

async function clearAdminState(adminId) {
  await del(`v2:adminstate:${adminId}`);
}

async function nextTicketId() {
  return incr(KEYS.ticketCounter);
}

async function rememberForward(adminChatId, messageId, target) {
  await setJSON(`v2:fwd:${adminChatId}:${messageId}`, target, { ex: 60 * 60 * 24 * 14 });
}

async function getForwardTarget(adminChatId, messageId) {
  return getJSON(`v2:fwd:${adminChatId}:${messageId}`, null);
}

async function markUpdate(updateId) {
  return set(`v2:update:${updateId}`, '1', { ex: 60 * 60 * 24, nx: true });
}

async function unmarkUpdate(updateId) {
  await del(`v2:update:${updateId}`);
}

async function getStats() {
  return {
    users: await scard(KEYS.usersSet),
    tickets: Number((await getJSON(KEYS.ticketCounter, 0)) || 0),
    admins: (await getAdmins()).length,
  };
}

module.exports = {
  getFlow,
  saveFlow,
  getConfig,
  saveConfig,
  getAdmins,
  saveAdmins,
  isAdmin,
  getUser,
  getOrCreateUser,
  saveUser,
  getAdminState,
  saveAdminState,
  clearAdminState,
  nextTicketId,
  rememberForward,
  getForwardTarget,
  markUpdate,
  unmarkUpdate,
  getStats,
};

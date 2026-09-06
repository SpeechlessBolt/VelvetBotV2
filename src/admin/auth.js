const crypto = require('crypto');
const { getAdmins, saveAdmins, isAdmin } = require('../storage/state');

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

async function claimAdmin(userId, code) {
  const expected = process.env.ADMIN_CLAIM_CODE;
  if (!expected) return { ok: false, reason: 'not_configured' };
  if (!safeEqual(code, expected)) return { ok: false, reason: 'bad_code' };

  const admins = await getAdmins();
  if (!admins.includes(Number(userId))) {
    admins.push(Number(userId));
    await saveAdmins(admins);
  }
  return { ok: true };
}

module.exports = { claimAdmin, isAdmin };

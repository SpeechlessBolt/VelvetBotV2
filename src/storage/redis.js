const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function assertConfigured() {
  if (!url || !token) {
    throw new Error(
      'Missing Upstash Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }
}

async function command(args) {
  assertConfigured();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args.map((v) => String(v))),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash Redis HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`Upstash Redis error: ${data.error}`);
  return data.result;
}

async function get(key) {
  return command(['GET', key]);
}

async function set(key, value, options = {}) {
  const args = ['SET', key, value];
  if (options.ex) args.push('EX', options.ex);
  if (options.nx) args.push('NX');
  return command(args);
}

async function del(key) {
  return command(['DEL', key]);
}

async function incr(key) {
  return Number(await command(['INCR', key]));
}

async function sadd(key, member) {
  return Number(await command(['SADD', key, member]));
}

async function scard(key) {
  return Number(await command(['SCARD', key]));
}

async function smembers(key) {
  return await command(['SMEMBERS', key]);
}

async function getJSON(key, fallback = null) {
  const raw = await get(key);
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function setJSON(key, value, options = {}) {
  return set(key, JSON.stringify(value), options);
}

module.exports = {
  command,
  get,
  set,
  del,
  incr,
  sadd,
  scard,
  smembers,
  getJSON,
  setJSON,
};

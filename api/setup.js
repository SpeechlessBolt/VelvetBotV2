const { setWebhook, getWebhookInfo } = require('../src/telegram/client');

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const host = req.headers.host;
  if (host) return `https://${host}`;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) return res.status(500).json({ ok: false, error: 'SETUP_SECRET missing' });
  if (req.query?.secret !== setupSecret) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ ok: false, error: 'WEBHOOK_SECRET missing' });

  const baseUrl = getBaseUrl(req);
  if (!baseUrl) return res.status(500).json({ ok: false, error: 'Could not determine public URL' });

  try {
    const webhookUrl = `${baseUrl}/api/webhook`;
    const result = await setWebhook(webhookUrl, webhookSecret);
    const info = await getWebhookInfo();
    return res.status(200).json({ ok: true, webhookUrl, result, info });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

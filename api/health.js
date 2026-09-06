module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    app: 'telegram-roleplay-bot-v2',
    time: new Date().toISOString(),
  });
};

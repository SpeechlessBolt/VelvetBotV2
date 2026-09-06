function inlineKeyboard(rows) {
  return { inline_keyboard: rows.filter((row) => row?.length) };
}

function button(text, callback_data) {
  return { text, callback_data };
}

module.exports = { inlineKeyboard, button };

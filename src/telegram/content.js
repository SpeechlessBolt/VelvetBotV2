const { api, sendMessage } = require('./client');

function contentFromMessage(message) {
  if (message.text !== undefined) {
    return {
      type: 'text',
      text: message.text,
      entities: message.entities || undefined,
    };
  }
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return media('photo', photo.file_id, message);
  }
  if (message.video) return media('video', message.video.file_id, message);
  if (message.animation) return media('animation', message.animation.file_id, message);
  if (message.document) return media('document', message.document.file_id, message);
  if (message.audio) return media('audio', message.audio.file_id, message);
  if (message.voice) return media('voice', message.voice.file_id, message);
  if (message.video_note) return { type: 'video_note', fileId: message.video_note.file_id };
  if (message.sticker) return { type: 'sticker', fileId: message.sticker.file_id };
  return null;
}

function media(type, fileId, message) {
  return {
    type,
    fileId,
    caption: message.caption || undefined,
    captionEntities: message.caption_entities || undefined,
  };
}

async function sendContent(chatId, content, options = {}) {
  const replyMarkup = options.reply_markup;
  if (!content) {
    return sendMessage(chatId, 'Choose an option:', replyMarkup ? { reply_markup: replyMarkup } : {});
  }

  if (content.type === 'text') {
    return sendMessage(chatId, content.text || ' ', {
      ...(content.entities ? { entities: content.entities } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  const methodByType = {
    photo: ['sendPhoto', 'photo'],
    video: ['sendVideo', 'video'],
    animation: ['sendAnimation', 'animation'],
    document: ['sendDocument', 'document'],
    audio: ['sendAudio', 'audio'],
    voice: ['sendVoice', 'voice'],
    video_note: ['sendVideoNote', 'video_note'],
    sticker: ['sendSticker', 'sticker'],
  };

  const entry = methodByType[content.type];
  if (!entry) return sendMessage(chatId, '[Unsupported saved content]');

  const [method, field] = entry;
  const payload = { chat_id: chatId, [field]: content.fileId };
  if (content.caption) payload.caption = content.caption;
  if (content.captionEntities) payload.caption_entities = content.captionEntities;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return api(method, payload);
}

function summarizeMessage(message, max = 220) {
  let text = '';
  if (message.text) text = message.text;
  else if (message.caption) text = message.caption;

  const kind = message.text
    ? 'Text'
    : message.photo
      ? 'Photo'
      : message.video
        ? 'Video'
        : message.animation
          ? 'Animation'
          : message.document
            ? 'Document'
            : message.audio
              ? 'Audio'
              : message.voice
                ? 'Voice'
                : message.sticker
                  ? 'Sticker'
                  : message.video_note
                    ? 'Video note'
                    : 'Message';

  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (text.length > max) text = `${text.slice(0, max - 1)}…`;
  return text ? `${kind}: ${text}` : `[${kind}]`;
}

module.exports = { contentFromMessage, sendContent, summarizeMessage };

function textContent(text) {
  return { type: 'text', text };
}

function defaultFlow() {
  return {
    version: 2,
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        parentId: null,
        label: 'Home',
        action: 'menu',
        content: textContent('Welcome! Choose an option below.'),
        afterAnswerContent: null,
        children: [],
      },
    },
  };
}

const DEFAULT_CONFIG = {
  version: 2,
  settings: {
    askNameOnFirstStart: true,
  },
  texts: {
    ask_name: 'Before we start, what name or ID would you like to go by? Just type it and send it.',
    name_saved: 'Perfect — you’re all set.',
    question_saved: 'Got it.',
    no_admins: 'No human admin is available right now. Please try again later.',
    chat_closed_by_user: 'The conversation has been closed. You can choose another option below.',
    chat_closed_by_admin: 'The admin closed this conversation. You can choose another option below.',
    back_label: '⬅️ Back',
    home_label: '🏠 Home',
    exit_chat_label: '⬅️ Leave chat',
    choose_option: 'Choose an option:',
  },
};

const ACTION_NAMES = {
  menu: '📂 Menu / category',
  message: '💬 Send content',
  question: '❓ Ask a question',
  chat: '👤 Start human chat',
};

function defaultContentForAction(action) {
  if (action === 'question') return textContent('Please send your answer.');
  if (action === 'chat') return textContent('You are connected to a human admin. Send your message here.');
  if (action === 'message') return textContent('This is an editable message.');
  return textContent('Choose an option below.');
}

module.exports = {
  textContent,
  defaultFlow,
  DEFAULT_CONFIG,
  ACTION_NAMES,
  defaultContentForAction,
};

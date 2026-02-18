const { logger } = require('../utils/logger');

function isAuthorized(chatId) {
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!allowed) {
    logger.warn('TELEGRAM_ALLOWED_CHAT_ID not set — rejecting all');
    return false;
  }
  return String(chatId) === String(allowed);
}

module.exports = { isAuthorized };

const TelegramBot = require('node-telegram-bot-api');
const { isAuthorized } = require('./middleware');
const {
  handleStart,
  handleAgentes,
  handleConteudo,
  handleAgendamentos,
  handlePausar,
  handleAjuda,
  handleStatus,
  handleFreeMessage,
} = require('./handlers');
const { logger } = require('../utils/logger');
require('dotenv').config();

function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const bot = new TelegramBot(token, { polling: true });

  function guard(chatId) {
    if (!isAuthorized(chatId)) {
      logger.warn('Unauthorized access attempt', { chatId });
      bot.sendMessage(chatId, 'Acesso nao autorizado.');
      return false;
    }
    return true;
  }

  bot.onText(/\/start/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStart(bot, msg);
  });

  bot.onText(/\/agentes/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgentes(bot, msg);
  });

  bot.onText(/\/conteudo(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleConteudo(bot, msg, match?.[1]?.trim());
  });

  bot.onText(/\/agendamentos/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgendamentos(bot, msg);
  });

  bot.onText(/\/pausar(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handlePausar(bot, msg, match?.[1]?.trim());
  });

  bot.onText(/\/ajuda/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAjuda(bot, msg);
  });

  bot.onText(/\/status/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStatus(bot, msg);
  });

  // Free messages — skip commands
  bot.on('message', (msg) => {
    if (!guard(msg.chat.id)) return;
    if (!msg.text || msg.text.startsWith('/')) return;
    handleFreeMessage(bot, msg);
  });

  bot.on('polling_error', (err) => {
    logger.error('Telegram polling error', { error: err.message });
  });

  logger.info('Telegram bot started (polling mode)');
  return bot;
}

module.exports = { createBot };

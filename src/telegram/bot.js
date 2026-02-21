'use strict';

const TelegramBot = require('node-telegram-bot-api');
const {
  handleStart,
  handleAgentes,
  handleConteudo,
  handleFormatCallback,
  handleImageCallback,
  handleCaptionCallback,
  handleResearchCallback,
  handleAgendamentos,
  handlePausar,
  handleDisparar,
  handleAjuda,
  handleStatus,
  handleBranding,
  handleFreeMessage,
  handleCriarAgente,
  handlePipeline,
  handleInstagramCallback,
  handleInstagram,
  handleInvite,
  handleInvites,
} = require('./handlers');
const { logger } = require('../utils/logger');

function createBot(tenant) {
  const token = tenant?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Bot token not available');

  const bot = new TelegramBot(token, { polling: true });

  // Guard: only allow messages from this tenant's chat
  function guard(chatId) {
    const allowedChatId = tenant?.chat_id || process.env.TELEGRAM_ALLOWED_CHAT_ID;
    if (!allowedChatId || String(chatId) !== String(allowedChatId)) {
      logger.warn('Unauthorized access attempt', { chatId, tenantId: tenant?.id });
      bot.sendMessage(chatId, 'Acesso nao autorizado.');
      return false;
    }
    return true;
  }

  bot.onText(/\/start/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStart(bot, msg, tenant);
  });

  bot.onText(/\/agentes/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgentes(bot, msg, tenant);
  });

  bot.onText(/\/criar_agente/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleCriarAgente(bot, msg, tenant);
  });

  bot.onText(/\/conteudo(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleConteudo(bot, msg, match?.[1]?.trim(), tenant);
  });

  bot.onText(/\/agendamentos/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgendamentos(bot, msg, tenant);
  });

  bot.onText(/\/pausar(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handlePausar(bot, msg, match?.[1]?.trim(), tenant);
  });

  bot.onText(/\/disparar(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleDisparar(bot, msg, match?.[1]?.trim(), tenant);
  });

  bot.onText(/\/ajuda/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAjuda(bot, msg, tenant);
  });

  bot.onText(/\/status/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStatus(bot, msg, tenant);
  });

  bot.onText(/\/branding(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleBranding(bot, msg, tenant, match?.[1]?.trim());
  });

  bot.onText(/\/pipeline/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handlePipeline(bot, msg, tenant);
  });

  bot.onText(/\/instagram(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleInstagram(bot, msg, tenant, match?.[1]?.trim());
  });

  bot.onText(/\/invite$/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleInvite(bot, msg, tenant);
  });

  bot.onText(/\/invites/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleInvites(bot, msg, tenant);
  });

  // Inline button callbacks
  bot.on('callback_query', (query) => {
    if (!guard(query.message.chat.id)) return;
    if (query.data?.startsWith('format:')) {
      handleFormatCallback(bot, query, tenant);
    } else if (query.data?.startsWith('research:')) {
      handleResearchCallback(bot, query, tenant);
    } else if (query.data === 'image:generate') {
      handleImageCallback(bot, query, tenant);
    } else if (query.data?.startsWith('caption:')) {
      handleCaptionCallback(bot, query, tenant);
    } else if (query.data?.startsWith('instagram:')) {
      handleInstagramCallback(bot, query, tenant);
    }
  });

  // Free messages — skip commands
  bot.on('message', (msg) => {
    if (!guard(msg.chat.id)) return;
    if (!msg.text || msg.text.startsWith('/')) return;
    handleFreeMessage(bot, msg, tenant);
  });

  // Polling failure tracking for auto-deactivation
  let pollingFailures = 0;
  bot.on('polling_error', (err) => {
    pollingFailures++;
    logger.error('Telegram polling error', { error: err.message, tenantId: tenant?.id, failures: pollingFailures });
    if (pollingFailures >= 4) {
      logger.error('Too many polling failures — emitting deactivate', { tenantId: tenant?.id });
      bot.emit('tenant_deactivate', tenant?.id);
    }
  });

  // Reset failure counter on successful activity
  bot.on('message', () => { pollingFailures = 0; });
  bot.on('callback_query', () => { pollingFailures = 0; });

  logger.info('Bot started', { tenantId: tenant?.id, name: tenant?.name });
  return bot;
}

module.exports = { createBot };

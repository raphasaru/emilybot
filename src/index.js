require('dotenv').config();
const express = require('express');
const { createBot } = require('./telegram/bot');
const { logger } = require('./utils/logger');
const cronManager = require('./scheduler/cronManager');
const { onCronResearchReady } = require('./telegram/handlers');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const bot = createBot();

// Init cron jobs — load from DB and register
const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
if (chatId) {
  cronManager.init(bot, chatId, onCronResearchReady).catch((err) => {
    logger.error('CronManager init failed', { error: err.message });
  });
} else {
  logger.warn('TELEGRAM_ALLOWED_CHAT_ID not set — cron notifications disabled');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

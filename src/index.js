require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { logger } = require('./utils/logger');
const botManager = require('./tenant/botManager');
const { startAutoRefresh } = require('./services/igTokenRefresh');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason?.message || String(reason) });
});

const UPLOADS_DIR = path.join(__dirname, '../uploads/images');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use('/images', express.static(UPLOADS_DIR));

app.get('/health', (req, res) => {
  const instances = botManager.getInstances();
  res.json({
    status: 'ok',
    activeBots: instances.size,
    timestamp: new Date().toISOString(),
  });
});

// Boot all tenant bots
botManager.startAll().then(() => {
  // IG token auto-refresh — notifies tenant via their bot instance
  startAutoRefresh((chatId, message) => {
    for (const [, instance] of botManager.getInstances()) {
      if (String(instance.tenant?.chat_id) === String(chatId)) {
        instance.bot.sendMessage(chatId, message).catch(() => {});
        break;
      }
    }
  });
}).catch((err) => {
  logger.error('BotManager startAll failed', { error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

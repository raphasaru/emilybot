require('dotenv').config();
const express = require('express');
const { logger } = require('./utils/logger');
const botManager = require('./tenant/botManager');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason?.message || String(reason) });
});

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  const instances = botManager.getInstances();
  res.json({
    status: 'ok',
    activeBots: instances.size,
    timestamp: new Date().toISOString(),
  });
});

// Boot all tenant bots
botManager.startAll().catch((err) => {
  logger.error('BotManager startAll failed', { error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

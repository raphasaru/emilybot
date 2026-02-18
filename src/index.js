require('dotenv').config();
const express = require('express');
const { createBot } = require('./telegram/bot');
const { logger } = require('./utils/logger');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Telegram bot (polling)
const bot = createBot();

// Start HTTP server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

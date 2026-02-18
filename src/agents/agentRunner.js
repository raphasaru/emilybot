const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildMessages(systemPrompt, input) {
  if (Array.isArray(input)) return input;
  return [{ role: 'user', content: input }];
}

async function runAgent(systemPrompt, input, { model = 'claude-haiku-4-5-20251001', maxTokens = 4096 } = {}) {
  const messages = buildMessages(systemPrompt, input);
  logger.debug('Running agent', { model, messageCount: messages.length });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  logger.debug('Agent response', { length: text.length });
  return text;
}

module.exports = { runAgent, buildMessages };

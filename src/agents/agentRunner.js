const axios = require('axios');
const { logger } = require('../utils/logger');

const MODEL_MAP = {
  haiku: 'gemini-2.0-flash-lite',
  sonnet: 'gemini-2.0-flash',
  opus: 'gemini-2.5-pro-exp-03-25',
};

function extractText(input) {
  if (Array.isArray(input)) {
    const last = [...input].reverse().find((m) => m.role === 'user');
    return last ? last.content : '';
  }
  return input;
}

async function runAgent(systemPrompt, input, { model = 'haiku', maxTokens = 4096 } = {}) {
  const message = extractText(input);
  const modelId = MODEL_MAP[model] || model;
  logger.debug('Running agent via Gemini', { model: modelId, messageLength: message.length });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  };

  try {
    const { data } = await axios.post(url, body);
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    logger.debug('Agent response received', { length: text.length });
    return text;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Gemini API error', { error: msg });
    throw new Error(`Agent call failed: ${msg}`);
  }
}

function buildMessages(systemPrompt, input) {
  if (Array.isArray(input)) return input;
  return [{ role: 'user', content: input }];
}

module.exports = { runAgent, buildMessages };

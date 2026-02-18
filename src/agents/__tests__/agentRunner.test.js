const { buildMessages } = require('../agentRunner');

describe('buildMessages', () => {
  test('wraps string input as user message', () => {
    const msgs = buildMessages('You are a bot.', 'Hello');
    expect(msgs).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('returns history array as-is', () => {
    const history = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];
    const msgs = buildMessages('Prompt', history);
    expect(msgs).toEqual(history);
  });
});

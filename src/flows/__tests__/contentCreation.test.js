jest.mock('../../database/supabase', () => ({ supabase: {} }));
jest.mock('../../agents/agentRunner', () => ({ runAgent: jest.fn() }));
jest.mock('../../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const { buildFlowPipeline, extractJsonFromText } = require('../contentCreation');

describe('buildFlowPipeline', () => {
  test('sorts agents by position_in_flow ascending', () => {
    const agents = [
      { name: 'formatador', position_in_flow: 3 },
      { name: 'pesquisador', position_in_flow: 1 },
      { name: 'redator', position_in_flow: 2 },
    ];
    const pipeline = buildFlowPipeline(agents);
    expect(pipeline.map((a) => a.name)).toEqual(['pesquisador', 'redator', 'formatador']);
  });
});

describe('extractJsonFromText', () => {
  test('extracts JSON from text with surrounding content', () => {
    const text = 'Here is the response:\n{"ideas": [{"title": "test"}]}\nEnd.';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ ideas: [{ title: 'test' }] });
  });

  test('returns null for invalid JSON', () => {
    const result = extractJsonFromText('no json here');
    expect(result).toBeNull();
  });

  test('parses clean JSON string', () => {
    const result = extractJsonFromText('{"format": "post_unico", "content": "hello"}');
    expect(result).toEqual({ format: 'post_unico', content: 'hello' });
  });
});

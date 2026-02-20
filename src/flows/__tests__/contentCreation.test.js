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

const { runAgent } = require('../../agents/agentRunner');
const { supabase } = require('../../database/supabase');

describe('runResearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls only the pesquisador agent and returns researchText + remainingAgents', async () => {
    const mockAgents = [
      { id: '1', name: 'pesquisador', display_name: 'Pesquisador', system_prompt: 'sp1', position_in_flow: 1, is_active: true },
      { id: '2', name: 'redator', display_name: 'Redator', system_prompt: 'sp2', position_in_flow: 2, is_active: true },
      { id: '3', name: 'formatador', display_name: 'Formatador', system_prompt: 'sp3', position_in_flow: 3, is_active: true },
    ];

    supabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockAgents, error: null }),
    });

    runAgent.mockResolvedValue('1. Ideia A\n2. Ideia B\n3. Ideia C');

    const { runResearch } = require('../contentCreation');
    const result = await runResearch('IA');

    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent).toHaveBeenCalledWith('sp1', expect.stringContaining('IA'), { geminiApiKey: undefined });
    expect(result.researchText).toBe('1. Ideia A\n2. Ideia B\n3. Ideia C');
    expect(result.remainingAgents).toHaveLength(2);
    expect(result.sourceUrls).toEqual([]);
  });
});

describe('runContentFromResearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('runs remaining agents and saves draft', async () => {
    const remainingAgents = [
      { id: '2', name: 'redator', display_name: 'Redator', system_prompt: 'sp2', position_in_flow: 2 },
      { id: '3', name: 'formatador', display_name: 'Formatador', system_prompt: 'sp3', position_in_flow: 3 },
    ];

    supabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'draft-123' }, error: null }),
    });

    runAgent
      .mockResolvedValueOnce('texto do redator')
      .mockResolvedValueOnce('conteudo final formatado');

    const { runContentFromResearch } = require('../contentCreation');
    const result = await runContentFromResearch(
      'pesquisa texto aqui',
      'Ideia A sobre IA',
      'post_unico',
      remainingAgents
    );

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(result.final_content).toBe('conteudo final formatado');
    expect(result.draft_id).toBe('draft-123');
  });
});

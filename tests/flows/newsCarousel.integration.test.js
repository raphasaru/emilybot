jest.mock('axios');
jest.mock('../../src/database/supabase', () => {
  const mockChain = (finalValue) => {
    const chain = {};
    ['select', 'eq', 'not', 'order', 'insert'].forEach((method) => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    chain.single = jest.fn().mockResolvedValue(finalValue);
    // For loadPipeline which awaits the chain directly (no .single())
    chain.then = (resolve) => resolve(finalValue);
    return chain;
  };

  return {
    supabase: {
      from: jest.fn((table) => {
        if (table === 'agents') {
          return mockChain({
            data: [
              { name: 'pesquisador', display_name: 'Pesquisador', system_prompt: 'Research prompt', position_in_flow: 1, role: 'researcher' },
              { name: 'redator', display_name: 'Redator', system_prompt: 'Writer prompt', position_in_flow: 2, role: 'writer' },
              { name: 'formatador', display_name: 'Formatador', system_prompt: 'Formatter prompt', position_in_flow: 3, role: 'formatter' },
            ],
            error: null,
          });
        }
        // content_drafts
        return mockChain({ data: { id: 'test-draft-id' }, error: null });
      }),
    },
  };
});

const axios = require('axios');
const { runContentFlow } = require('../../src/flows/contentCreation');

describe('carrossel_noticias integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns sourceUrls from Brave search through full flow', async () => {
    // Mock Brave search
    axios.get.mockResolvedValueOnce({
      data: {
        web: {
          results: [
            { url: 'https://techcrunch.com/gemini', title: 'Gemini Pro 3.1', description: 'Google launched Gemini Pro 3.1' },
            { url: 'https://theverge.com/gemini', title: 'Gemini Update', description: 'New Gemini features' },
          ],
        },
      },
    });

    // Mock Gemini API calls (pesquisador, redator, formatador)
    const mockGeminiResponse = (text) => ({
      data: { candidates: [{ content: { parts: [{ text }] } }] },
    });

    axios.post
      .mockResolvedValueOnce(mockGeminiResponse('{"ideas":[{"title":"Gemini Pro 3.1 launched"}]}'))
      .mockResolvedValueOnce(mockGeminiResponse('{"title":"Gemini Pro 3.1","body":"Google launched new model"}'))
      .mockResolvedValueOnce(
        mockGeminiResponse(
          JSON.stringify({
            format: 'carrossel_noticias',
            source_url: 'https://techcrunch.com/gemini',
            content: [
              { type: 'capa', headline: 'Gemini Pro 3.1', source: 'TechCrunch' },
              { type: 'resumo', title: 'O que e?', body: 'Google lancou o Gemini Pro 3.1' },
              { type: 'cta', question: 'Ja testou?', action: 'Siga' },
            ],
          })
        )
      );

    const result = await runContentFlow('Gemini Pro 3.1', 'carrossel_noticias', {
      geminiApiKey: 'test-key',
      braveSearchKey: 'test-brave',
      tenantId: 'test-tenant',
    });

    // Verify sourceUrls returned
    expect(result.sourceUrls).toBeDefined();
    expect(result.sourceUrls).toHaveLength(2);
    expect(result.sourceUrls[0].url).toBe('https://techcrunch.com/gemini');
    expect(result.sourceUrls[0].title).toBe('Gemini Pro 3.1');

    // Verify content was produced
    expect(result.final_content).toContain('carrossel_noticias');
    expect(result.draft_id).toBe('test-draft-id');

    // Verify Brave was called with right params
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search',
      expect.objectContaining({
        params: { q: 'Gemini Pro 3.1', count: 5 },
      })
    );
  });
});

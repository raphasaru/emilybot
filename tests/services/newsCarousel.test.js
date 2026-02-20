jest.mock('axios');
const { generateNewsCarouselSlides, parseNewsCarouselSlides } = require('../../src/services/imageGenerator');

describe('generateNewsCarouselSlides', () => {
  it('generates PNG buffers for each slide', async () => {
    const slides = [
      { type: 'capa', headline: 'Gemini Pro 3.1 Launched', source: 'TechCrunch' },
      { type: 'resumo', title: 'O que e?', body: 'Google lancou o Gemini Pro 3.1 com melhorias significativas.' },
      { type: 'pontos', title: 'Pontos-chave', items: ['Mais rapido', 'Mais barato', 'Multimodal'] },
      { type: 'impacto', title: 'Por que importa?', body: 'Concorrencia direta com GPT-5.' },
      { type: 'cta', question: 'Voce ja testou?', action: 'Siga para mais novidades' },
    ];

    const branding = {
      primary_color: '#FF5722',
      secondary_color: '#1A1A2E',
      text_color: '#FFFFFF',
      display_name: 'Test User',
      username: '@testuser',
    };

    const result = await generateNewsCarouselSlides(slides, branding, null);
    expect(result).toHaveLength(5);
    for (const { buf, caption } of result) {
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(100);
      expect(caption).toBeDefined();
    }
  });

  it('works with og:image buffer', async () => {
    // Create a minimal valid PNG buffer (1x1 red pixel)
    const { createCanvas } = require('@napi-rs/canvas');
    const tiny = createCanvas(100, 100);
    const tctx = tiny.getContext('2d');
    tctx.fillStyle = '#FF0000';
    tctx.fillRect(0, 0, 100, 100);
    const ogBuf = await tiny.encode('png');

    const slides = [
      { type: 'capa', headline: 'Test with image', source: 'Test' },
    ];

    const result = await generateNewsCarouselSlides(slides, {}, ogBuf);
    expect(result).toHaveLength(1);
    expect(result[0].buf).toBeInstanceOf(Buffer);
  });
});

describe('parseNewsCarouselSlides', () => {
  it('parses structured JSON', () => {
    const json = JSON.stringify({
      format: 'carrossel_noticias',
      source_url: 'https://example.com',
      content: [{ type: 'capa', headline: 'Test' }],
    });

    const { slides, sourceUrl } = parseNewsCarouselSlides(json);
    expect(slides).toHaveLength(1);
    expect(sourceUrl).toBe('https://example.com');
  });

  it('parses JSON wrapped in code blocks', () => {
    const content = '```json\n{"content":[{"type":"capa","headline":"Test"}]}\n```';
    const { slides } = parseNewsCarouselSlides(content);
    expect(slides).toHaveLength(1);
  });

  it('throws on invalid content', () => {
    expect(() => parseNewsCarouselSlides('not json')).toThrow();
  });
});

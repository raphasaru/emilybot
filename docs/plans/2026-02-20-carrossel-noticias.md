# Carrossel de Notícias Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `carrossel_noticias` format — news carousel slides composed with Canvas (og:image from source + branding), not Recraft.

**Architecture:** Brave Search returns URLs alongside text. After pipeline (pesquisador→redator→formatador) produces structured slide content, we fetch the article's og:image, then compose each slide with `@napi-rs/canvas` using tenant branding. 5-7 slides: capa (og:image + headline), resumo, pontos-chave, impacto, CTA.

**Tech Stack:** @napi-rs/canvas (already installed), axios, existing pipeline agents

---

### Task 1: Modify searchBrave to return URLs

**Files:**
- Modify: `src/flows/contentCreation.js:24-44` (searchBrave)
- Modify: `src/flows/contentCreation.js:68-71` (runResearch caller)

**Step 1: Update searchBrave return type**

Change `searchBrave` to return `{ text, urls }` instead of just a string. `urls` is array of `{url, title}`.

```js
async function searchBrave(topic, braveSearchKey) {
  const key = braveSearchKey || process.env.BRAVE_SEARCH_KEY;
  if (!key) {
    logger.warn('BRAVE_SEARCH_KEY not set — skipping web search');
    return null;
  }

  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: { q: topic, count: 5 },
      headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' },
      timeout: 8000,
    });

    const results = response.data?.web?.results || [];
    const text = results.map((r) => `- ${r.title} (${r.url}): ${r.description || ''}`).join('\n');
    const urls = results.map((r) => ({ url: r.url, title: r.title }));
    return { text, urls };
  } catch (err) {
    logger.warn('Brave Search failed', { error: err.message });
    return null;
  }
}
```

**Step 2: Update runResearch to use new return shape**

```js
async function runResearch(topics, tenantKeys) {
  logger.info('Running research phase', { topics });

  const pipeline = await loadPipeline(tenantKeys?.tenantId);
  const [researcher, ...remainingAgents] = pipeline;

  const searchData = await searchBrave(topics, tenantKeys?.braveSearchKey);
  const searchContext = searchData?.text
    ? `\n\nContexto de tendencias atual (pesquisa web):\n${searchData.text}`
    : '';

  const input = `Tema: ${topics}${searchContext}`;
  const researchText = await runAgent(researcher.system_prompt, input, { geminiApiKey: tenantKeys?.geminiApiKey });

  return { researchText, remainingAgents, sourceUrls: searchData?.urls || [] };
}
```

**Step 3: Run tests**

Run: `npm test`
Expected: existing tests pass (searchBrave mocks may need update)

**Step 4: Commit**

```bash
git add src/flows/contentCreation.js
git commit -m "refactor: searchBrave returns {text, urls} for og:image extraction"
```

---

### Task 2: Add og:image fetcher

**Files:**
- Create: `src/utils/ogImage.js`
- Create: `tests/utils/ogImage.test.js`

**Step 1: Write failing test**

```js
const { fetchOgImage } = require('../../src/utils/ogImage');
const axios = require('axios');

jest.mock('axios');

describe('fetchOgImage', () => {
  afterEach(() => jest.resetAllMocks());

  it('extracts og:image and downloads it', async () => {
    const html = '<html><head><meta property="og:image" content="https://example.com/img.jpg"></head></html>';
    axios.get
      .mockResolvedValueOnce({ data: html })
      .mockResolvedValueOnce({ data: Buffer.from('fake-image') });

    const buf = await fetchOgImage('https://example.com/article');
    expect(buf).toBeInstanceOf(Buffer);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('returns null when no og:image found', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html><head></head></html>' });
    const buf = await fetchOgImage('https://example.com/no-image');
    expect(buf).toBeNull();
  });

  it('returns null on network error', async () => {
    axios.get.mockRejectedValueOnce(new Error('timeout'));
    const buf = await fetchOgImage('https://example.com/fail');
    expect(buf).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/utils/ogImage.test.js --verbose`
Expected: FAIL — module not found

**Step 3: Implement**

```js
const axios = require('axios');
const { logger } = require('./logger');

async function fetchOgImage(url) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmilyBot/1.0)' },
      maxContentLength: 2 * 1024 * 1024, // 2MB max for HTML
    });

    const match = String(html).match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || String(html).match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    if (!match?.[1]) {
      logger.debug('No og:image found', { url });
      return null;
    }

    const imgUrl = match[1].startsWith('http') ? match[1] : new URL(match[1], url).href;
    const { data: imgData } = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max for image
    });

    return Buffer.from(imgData);
  } catch (err) {
    logger.warn('fetchOgImage failed', { url, error: err.message });
    return null;
  }
}

module.exports = { fetchOgImage };
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/utils/ogImage.test.js --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/ogImage.js tests/utils/ogImage.test.js
git commit -m "feat: og:image fetcher for news carousel source images"
```

---

### Task 3: Add news carousel canvas compositor

**Files:**
- Modify: `src/services/imageGenerator.js` (add generateNewsCarouselSlide + helper)

**Step 1: Write failing test**

Create `tests/services/newsCarousel.test.js`:

```js
jest.mock('axios');
const axios = require('axios');
const { generateNewsCarouselSlides } = require('../../src/services/imageGenerator');

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

    const ogImageBuf = null; // no og:image — should still work with fallback

    const result = await generateNewsCarouselSlides(slides, branding, ogImageBuf);
    expect(result).toHaveLength(5);
    for (const { buf, caption } of result) {
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(100);
      expect(caption).toBeDefined();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/services/newsCarousel.test.js --verbose`
Expected: FAIL — generateNewsCarouselSlides not exported

**Step 3: Implement canvas compositor**

Add to `src/services/imageGenerator.js` before `module.exports`:

```js
// --- News Carousel (carrossel_noticias) — canvas-based ---
const NEWS_W = 1080;
const NEWS_H = 1350;
const NEWS_PAD = 60;
const NEWS_FONT = 'Inter, "DejaVu Sans", sans-serif, "Color Emoji"';

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function newsBaseBg(ctx, branding) {
  const bg = branding.secondary_color || '#1A1A2E';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, NEWS_W, NEWS_H);

  // subtle gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 0, NEWS_H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, NEWS_W, NEWS_H);
}

function newsAccentBar(ctx, branding) {
  ctx.fillStyle = branding.primary_color || '#FF5722';
  ctx.fillRect(0, 0, NEWS_W, 6);
}

function newsSlideIndicator(ctx, slideNum, total, branding) {
  const dotR = 5;
  const gap = 16;
  const totalW = total * dotR * 2 + (total - 1) * gap;
  let x = (NEWS_W - totalW) / 2;
  const y = NEWS_H - 40;

  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(x + dotR, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === slideNum ? (branding.primary_color || '#FF5722') : 'rgba(255,255,255,0.3)';
    ctx.fill();
    x += dotR * 2 + gap;
  }
}

function newsBrandingFooter(ctx, branding) {
  const name = branding.display_name || 'EmilyBot';
  const handle = branding.username ? `@${branding.username.replace(/^@/, '')}` : '';
  ctx.font = `bold 24px ${NEWS_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(handle || name, NEWS_W - NEWS_PAD, NEWS_H - 60);
  ctx.textAlign = 'left';
}

async function renderNewsCapa(slide, branding, ogImageBuf, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  // Background: og:image or solid color
  if (ogImageBuf) {
    try {
      const img = await loadImage(ogImageBuf);
      const scale = Math.max(NEWS_W / img.width, NEWS_H * 0.65 / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (NEWS_W - sw) / 2, 0, sw, sh);
      // dark overlay for text readability
      const grad = ctx.createLinearGradient(0, 0, 0, NEWS_H);
      grad.addColorStop(0, 'rgba(0,0,0,0.2)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, branding.secondary_color || '#1A1A2E');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, NEWS_W, NEWS_H);
    } catch {
      newsBaseBg(ctx, branding);
    }
  } else {
    newsBaseBg(ctx, branding);
  }

  newsAccentBar(ctx, branding);

  // "NOTICIA" badge
  ctx.font = `bold 20px ${NEWS_FONT}`;
  ctx.fillStyle = branding.primary_color || '#FF5722';
  const badgeText = 'NOTICIA';
  const badgeW = ctx.measureText(badgeText).width + 24;
  drawRoundedRect(ctx, NEWS_PAD, NEWS_H * 0.55, badgeW, 34, 6);
  ctx.fillStyle = branding.primary_color || '#FF5722';
  ctx.fill();
  ctx.font = `bold 20px ${NEWS_FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badgeText, NEWS_PAD + 12, NEWS_H * 0.55 + 24);

  // Headline
  ctx.font = `bold 48px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  const headlineLines = wrapTextCanvas(ctx, slide.headline || '', NEWS_W - NEWS_PAD * 2);
  let y = NEWS_H * 0.55 + 70;
  for (const line of headlineLines.slice(0, 4)) {
    ctx.fillText(line, NEWS_PAD, y);
    y += 58;
  }

  // Source badge
  if (slide.source) {
    ctx.font = `18px ${NEWS_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`via ${slide.source}`, NEWS_PAD, y + 10);
  }

  newsBrandingFooter(ctx, branding);
  newsSlideIndicator(ctx, 0, total, branding);

  return canvas.encode('png');
}

async function renderNewsContentSlide(slide, branding, slideIdx, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  newsBaseBg(ctx, branding);
  newsAccentBar(ctx, branding);

  // Type label
  const labels = { resumo: 'RESUMO', pontos: 'PONTOS-CHAVE', impacto: 'IMPACTO' };
  ctx.font = `bold 18px ${NEWS_FONT}`;
  ctx.fillStyle = branding.primary_color || '#FF5722';
  ctx.fillText(labels[slide.type] || slide.type?.toUpperCase() || '', NEWS_PAD, 80);

  // Title
  ctx.font = `bold 42px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  const titleLines = wrapTextCanvas(ctx, slide.title || '', NEWS_W - NEWS_PAD * 2);
  let y = 140;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, NEWS_PAD, y);
    y += 52;
  }

  y += 30;

  // Body or items
  if (slide.type === 'pontos' && Array.isArray(slide.items)) {
    ctx.font = `32px ${NEWS_FONT}`;
    ctx.fillStyle = branding.text_color || '#FFFFFF';
    for (const item of slide.items.slice(0, 6)) {
      // bullet dot
      ctx.beginPath();
      ctx.arc(NEWS_PAD + 8, y - 10, 6, 0, Math.PI * 2);
      ctx.fillStyle = branding.primary_color || '#FF5722';
      ctx.fill();

      ctx.fillStyle = branding.text_color || '#FFFFFF';
      const itemLines = wrapTextCanvas(ctx, item, NEWS_W - NEWS_PAD * 2 - 40);
      for (const line of itemLines.slice(0, 2)) {
        ctx.fillText(line, NEWS_PAD + 30, y);
        y += 44;
      }
      y += 20;
    }
  } else if (slide.body) {
    ctx.font = `30px ${NEWS_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const bodyLines = wrapTextCanvas(ctx, slide.body, NEWS_W - NEWS_PAD * 2);
    for (const line of bodyLines.slice(0, 18)) {
      ctx.fillText(line, NEWS_PAD, y);
      y += 42;
    }
  }

  newsBrandingFooter(ctx, branding);
  newsSlideIndicator(ctx, slideIdx, total, branding);

  return canvas.encode('png');
}

async function renderNewsCta(slide, branding, slideIdx, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  newsBaseBg(ctx, branding);
  newsAccentBar(ctx, branding);

  // Large question
  ctx.font = `bold 46px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  const qLines = wrapTextCanvas(ctx, slide.question || '', NEWS_W - NEWS_PAD * 2);
  let y = NEWS_H * 0.35;
  for (const line of qLines.slice(0, 3)) {
    ctx.textAlign = 'center';
    ctx.fillText(line, NEWS_W / 2, y);
    y += 58;
  }

  // Action text
  if (slide.action) {
    y += 30;
    ctx.font = `28px ${NEWS_FONT}`;
    ctx.fillStyle = branding.primary_color || '#FF5722';
    ctx.textAlign = 'center';
    ctx.fillText(slide.action, NEWS_W / 2, y);
  }

  ctx.textAlign = 'left';

  // Profile + handle
  y += 80;
  const name = branding.display_name || 'EmilyBot';
  const handle = branding.username ? `@${branding.username.replace(/^@/, '')}` : '';
  ctx.font = `bold 28px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(name, NEWS_W / 2, y);
  if (handle) {
    ctx.font = `22px ${NEWS_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(handle, NEWS_W / 2, y + 34);
  }

  ctx.textAlign = 'left';
  newsSlideIndicator(ctx, slideIdx, total, branding);

  return canvas.encode('png');
}

async function generateNewsCarouselSlides(slides, branding = {}, ogImageBuf = null) {
  logger.info('Generating news carousel slides', { count: slides.length });
  const total = slides.length;
  const results = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    let buf;

    if (slide.type === 'capa') {
      buf = await renderNewsCapa(slide, branding, ogImageBuf, total);
    } else if (slide.type === 'cta') {
      buf = await renderNewsCta(slide, branding, i, total);
    } else {
      buf = await renderNewsContentSlide(slide, branding, i, total);
    }

    results.push({ buf, caption: `${i + 1}/${total}` });
  }

  return results;
}
```

Add `generateNewsCarouselSlides` to `module.exports`.

**Step 4: Run test to verify it passes**

Run: `npx jest tests/services/newsCarousel.test.js --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/imageGenerator.js tests/services/newsCarousel.test.js
git commit -m "feat: canvas-based news carousel compositor"
```

---

### Task 4: Add carrossel_noticias format to pipeline

**Files:**
- Modify: `src/flows/contentCreation.js:83-88` (formatNotes)
- Modify: `src/flows/contentCreation.js:122-138` (runContentFlow — pass sourceUrls)

**Step 1: Add formatNotes for carrossel_noticias**

Add to the `formatNotes` object in `runContentFromResearch`:

```js
carrossel_noticias:
  '\n\nIMPORTANTE: Carrossel de NOTICIA. Gere um JSON com 5-7 slides. Estrutura obrigatoria:\n' +
  '{"format":"carrossel_noticias","source_url":"URL da fonte principal","content":[\n' +
  '  {"type":"capa","headline":"titulo impactante da noticia","source":"nome do site fonte"},\n' +
  '  {"type":"resumo","title":"O que e?","body":"resumo claro da novidade em 2-3 frases"},\n' +
  '  {"type":"pontos","title":"Pontos-chave","items":["ponto 1","ponto 2","ponto 3","ponto 4"]},\n' +
  '  {"type":"impacto","title":"Por que importa?","body":"analise do impacto para o publico"},\n' +
  '  {"type":"cta","question":"pergunta engajante","action":"Siga para mais novidades"}\n' +
  '],"publishing_notes":"..."}\n' +
  'Pode ter 5-7 slides. Tipos extras permitidos: resumo, pontos, impacto (repita conforme necessario). Capa sempre primeiro, CTA sempre ultimo.',
```

**Step 2: Update runContentFlow to return sourceUrls**

```js
async function runContentFlow(topic, format = 'post_unico', tenantKeys) {
  logger.info('Starting content flow', { topic, format });

  const { researchText, remainingAgents, sourceUrls } = await runResearch(topic, tenantKeys);
  const researchParsed = extractJsonFromText(researchText);

  const { draft_id, final_content } = await runContentFromResearch(
    researchText,
    researchParsed?.ideas?.[0]?.title || topic,
    format,
    remainingAgents,
    tenantKeys
  );

  return { draft_id, final_content, all_results: { pesquisador: researchText }, sourceUrls };
}
```

**Step 3: Add parseNewsCarouselSlides parser**

Add to `src/services/imageGenerator.js` alongside `parseCarouselCards`:

```js
function parseNewsCarouselSlides(finalContent) {
  try {
    const parsed = JSON.parse(finalContent);
    const content = parsed.content;
    if (Array.isArray(content)) return { slides: content, sourceUrl: parsed.source_url || null };
    if (typeof content === 'string') return { slides: JSON.parse(content), sourceUrl: parsed.source_url || null };
  } catch {}

  const match = finalContent.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return { slides: JSON.parse(match[0]), sourceUrl: null };
    } catch {}
  }
  throw new Error('Nao foi possivel extrair slides do conteudo de noticias');
}
```

Export it.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/flows/contentCreation.js src/services/imageGenerator.js
git commit -m "feat: carrossel_noticias format notes + sourceUrls in flow"
```

---

### Task 5: Wire up in handlers.js

**Files:**
- Modify: `src/telegram/handlers.js`

**Step 1: Add format button**

Add to `FORMAT_BUTTONS` array (after Carrossel row):

```js
[
  { text: '📰 Notícia', callback_data: 'format:carrossel_noticias' },
],
```

Update `formatLabels` in `handleFormatCallback`:

```js
carrossel_noticias: 'Carrossel Notícia',
```

**Step 2: Add import for new functions**

Update the require from imageGenerator at top of handlers.js:

```js
const { generatePostUnico, generateCarouselImages, parseCarouselCards, generateNewsCarouselSlides, parseNewsCarouselSlides } = require('../services/imageGenerator');
const { fetchOgImage } = require('../utils/ogImage');
```

**Step 3: Offer image generation for carrossel_noticias**

In `runContentAndSend` (line ~455), change the format check:

```js
if (['post_unico', 'carrossel', 'carrossel_noticias'].includes(format)) {
  pendingImageFlows.set(String(chatId), {
    format,
    final_content: result.final_content,
    draft_id: result.draft_id,
    chatId,
    sourceUrls: result.sourceUrls || [],
  });
```

Same change in `runResearchContentAndSend` (line ~480) — but `runContentFromResearch` doesn't return sourceUrls. We need to pass sourceUrls through. Add `sourceUrls` param:

Update `runResearchContentAndSend` signature to accept `sourceUrls`:

```js
async function runResearchContentAndSend(bot, chatId, topic, format, researchText, remainingAgents, tenant, sourceUrls) {
```

And at the image flow setup:

```js
if (['post_unico', 'carrossel', 'carrossel_noticias'].includes(format)) {
  pendingImageFlows.set(chatIdStr, {
    format,
    final_content: result.final_content,
    draft_id: result.draft_id,
    chatId,
    sourceUrls: sourceUrls || [],
  });
```

Update all callers of `runResearchContentAndSend` to pass `sourceUrls` (most pass `[]` or empty).

**Step 4: Handle image generation in handleImageCallback**

Add after the `format === 'carrossel'` block (before closing of `handleImageCallback`):

```js
if (format === 'carrossel_noticias') {
  await bot.sendMessage(chatId, '📰 Gerando carrossel de noticia...');
  try {
    let contentToUse = final_content;
    if (draft_id) {
      const { data: freshDraft } = await supabase.from('content_drafts').select('final_content').eq('id', draft_id).single();
      if (freshDraft?.final_content) contentToUse = freshDraft.final_content;
    }

    const { slides, sourceUrl } = parseNewsCarouselSlides(contentToUse);
    await bot.sendMessage(chatId, `📋 ${slides.length} slides. Buscando imagem da fonte...`);

    // Try og:image from source_url in content, then from sourceUrls, then null
    const { sourceUrls: flowUrls } = pendingData || {};
    const urlToFetch = sourceUrl || flowUrls?.[0]?.url || null;
    let ogImageBuf = null;
    if (urlToFetch) {
      ogImageBuf = await fetchOgImage(urlToFetch);
    }

    await bot.sendMessage(chatId, ogImageBuf ? '🖼️ Imagem encontrada! Gerando slides...' : '⚡ Sem imagem da fonte. Gerando com fundo solido...');

    const images = await generateNewsCarouselSlides(slides, tenant?.branding, ogImageBuf);
    const uploadedUrls = [];
    for (let i = 0; i < images.length; i++) {
      const { buf, caption } = images[i];
      await bot.sendPhoto(chatId, buf, { caption }, { filename: `news_${i + 1}.png`, contentType: 'image/png' });
      if (draft_id) {
        try {
          const url = saveImageLocally(buf, tenant.id, draft_id, `news_${i + 1}.png`);
          uploadedUrls.push(url);
        } catch (upErr) {
          logger.warn('News slide save failed', { error: upErr.message, index: i });
        }
      }
    }
    if (draft_id && uploadedUrls.length) {
      await supabase.from('content_drafts').update({ image_urls: uploadedUrls }).eq('id', draft_id);
    }
    await bot.sendMessage(chatId, '✅ Carrossel de noticia gerado!');
    pendingCaptionFlows.set(chatIdStr, { format, final_content: contentToUse, draft_id });
    await bot.sendMessage(chatId, '📝 Quer a legenda desse carrossel?', {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Sim, gerar legenda', callback_data: 'caption:generate' },
          { text: '❌ Não', callback_data: 'caption:skip' },
        ]],
      },
    });
  } catch (err) {
    logger.error('News carousel failed', { error: err.message });
    await bot.sendMessage(chatId, `❌ Erro ao gerar carrossel de noticia: ${err.message}`);
  }
}
```

Note: we need to preserve `sourceUrls` in the pendingImageFlows data. Update `handleImageCallback` to extract it:

```js
const { format, final_content, draft_id, sourceUrls } = pendingImageFlows.get(chatIdStr);
```

And use `sourceUrls` instead of `flowUrls` in the news carousel block.

**Step 5: Add extractCleanPreview for carrossel_noticias**

Add after the `format === 'carrossel'` preview case:

```js
if (format === 'carrossel_noticias') {
  const parsed = parseJson(finalContent);
  if (parsed) {
    const cards = Array.isArray(parsed.content) ? parsed.content : (Array.isArray(parsed) ? parsed : null);
    if (cards) {
      return cards
        .map((c, i) => {
          const title = c.headline || c.title || '';
          const body = c.body || (c.items ? c.items.join(', ') : '') || '';
          return `Slide ${i + 1} [${c.type}]: ${title}${body ? `\n${body}` : ''}`;
        })
        .join('\n\n');
    }
  }
  return finalContent;
}
```

**Step 6: Update Emily prompt**

Add to `BASE_EMILY_PROMPT` and the tenant-specific variant, a new ACAO hint (or just let the existing `[ACAO:CONTEUDO]` handle it — the user says "carrossel de noticia" and Emily routes to format selection where `carrossel_noticias` is an option).

No new action needed — the existing flow handles it: user asks about news → Emily detects content intent → format buttons include the new option.

**Step 7: Update /ajuda**

Add `carrossel_noticias` mention to help text (optional, low priority).

**Step 8: Commit**

```bash
git add src/telegram/handlers.js
git commit -m "feat: wire carrossel_noticias format in handlers"
```

---

### Task 6: Integration test + smoke test

**Files:**
- Create: `tests/flows/newsCarousel.integration.test.js`

**Step 1: Write integration test**

```js
jest.mock('axios');
jest.mock('../../src/database/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'test-draft-id' } }),
    })),
  },
}));

const { runContentFlow } = require('../../src/flows/contentCreation');

describe('carrossel_noticias flow', () => {
  it('returns sourceUrls from Brave search', async () => {
    const axios = require('axios');

    // Mock Brave search
    axios.get.mockResolvedValueOnce({
      data: {
        web: {
          results: [
            { url: 'https://techcrunch.com/article', title: 'Gemini Pro 3.1', description: 'Google launched...' },
          ],
        },
      },
    });

    // Mock Gemini API calls (pesquisador, redator, formatador)
    axios.post
      .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: '{"ideas":[{"title":"Gemini Pro 3.1"}]}' }] } }] } })
      .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: '{"title":"Gemini","body":"test"}' }] } }] } })
      .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: '{"format":"carrossel_noticias","content":[{"type":"capa","headline":"Test"}]}' }] } }] } });

    const result = await runContentFlow('Gemini Pro 3.1', 'carrossel_noticias', { geminiApiKey: 'test-key', braveSearchKey: 'test-brave' });

    expect(result.sourceUrls).toBeDefined();
    expect(result.sourceUrls[0].url).toBe('https://techcrunch.com/article');
  });
});
```

**Step 2: Run tests**

Run: `npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/flows/newsCarousel.integration.test.js
git commit -m "test: integration test for carrossel_noticias flow"
```

---

## Summary of changes

| File | Change |
|------|--------|
| `src/flows/contentCreation.js` | searchBrave returns `{text, urls}`, runResearch returns `sourceUrls`, formatNotes for new format |
| `src/utils/ogImage.js` | NEW — fetchOgImage(url) → Buffer |
| `src/services/imageGenerator.js` | generateNewsCarouselSlides + parseNewsCarouselSlides + canvas render helpers |
| `src/telegram/handlers.js` | Format button, image generation handler, preview extractor, sourceUrls threading |
| `tests/utils/ogImage.test.js` | NEW — unit tests |
| `tests/services/newsCarousel.test.js` | NEW — canvas output tests |
| `tests/flows/newsCarousel.integration.test.js` | NEW — flow integration test |

## Unresolved questions

1. Fontes Inter Bold/Regular ja instaladas cobrem o tamanho 48px bem? Ou precisa de fonte extra pra headlines?
2. og:image de alguns sites pode ser bloqueado por CORS/bot protection — fallback e fundo solido, suficiente?
3. Precisa adaptar o dashboard pra previsualizar `carrossel_noticias`?

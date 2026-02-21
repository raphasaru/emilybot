const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
// Register bundled Inter font for text rendering
const INTER_DIR = path.join(__dirname, '../../assets/fonts');
try {
  GlobalFonts.registerFromPath(path.join(INTER_DIR, 'Inter-Regular.ttf'), 'Inter');
  GlobalFonts.registerFromPath(path.join(INTER_DIR, 'Inter-Bold.ttf'), 'Inter');
} catch {}
// Register color emoji font — try macOS then common Linux paths
const EMOJI_FONT_PATHS = [
  '/System/Library/Fonts/Apple Color Emoji.ttc',
  '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
  '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
  '/usr/share/fonts/google-noto-emoji-color-fonts/NotoColorEmoji.ttf',
];
for (const p of EMOJI_FONT_PATHS) {
  if (fs.existsSync(p)) { try { GlobalFonts.registerFromPath(p, 'Color Emoji'); } catch {} break; }
}
const { logger } = require('../utils/logger');

const PROFILE_PIC_PATH = path.join(__dirname, '../../saru-profile.png');

async function callRecraftImage(prompt) {
  const { data } = await axios.post(
    'https://fal.run/fal-ai/recraft/v4/text-to-image',
    { prompt, image_size: 'portrait_4_3' },
    {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      timeout: 120000,
    }
  );
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai nao retornou imagem');
  const { data: imgData } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  // fal.ai returns WebP — re-encode as PNG so IG API accepts the file
  const img = await loadImage(Buffer.from(imgData));
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  return c.encode('png');
}

// IDV2: post_unico — canvas rendering (color emoji, pixel-perfect layout)
function wrapTextCanvas(ctx, text, maxWidth) {
  const lines = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    const words = para.split(' ');
    let cur = '';
    for (const w of words) {
      const candidate = cur ? cur + ' ' + w : w;
      if (ctx.measureText(candidate).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// Default IDV loaded from .md file, overridable per tenant via carousel_idv column
const DEFAULT_IDV_PATH = path.join(__dirname, '../../assets/idv/default-carousel.md');
function getDefaultIdv() {
  return fs.readFileSync(DEFAULT_IDV_PATH, 'utf-8').trim();
}

function buildCarouselCardPrompt(card, index, total, idvBase) {
  return idvBase || getDefaultIdv();
}

async function loadProfilePic(profilePicUrl) {
  if (profilePicUrl) {
    try {
      const { data } = await axios.get(profilePicUrl, { responseType: 'arraybuffer', timeout: 15000 });
      return await loadImage(Buffer.from(data));
    } catch (err) {
      logger.warn('Failed to load tenant profile pic, falling back to default', { error: err.message });
    }
  }
  return loadImage(PROFILE_PIC_PATH);
}

async function condenseTextForPost(text, geminiApiKey) {
  if (text.length <= 400) return text;
  const { runAgent } = require('../agents/agentRunner');
  const prompt = `Adapte o texto abaixo para caber em no máximo 400 caracteres. Mantenha o impacto e a mensagem principal. Não corte — reescreva de forma mais concisa. Retorne APENAS o texto adaptado, sem aspas, sem explicações.\n\nTexto:\n${text}`;
  try {
    const result = await runAgent('Você é um especialista em copywriting conciso para redes sociais.', prompt, { model: 'haiku', maxTokens: 500, geminiApiKey });
    return result.trim().slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
}

async function generatePostUnico(text, branding = {}, geminiApiKey = null) {
  const displayName = branding.display_name || 'Rapha Saru';
  const username = branding.username ? `@${branding.username.replace(/^@/, '')}` : '@raphasaru';
  const profilePicUrl = branding.profile_pic_url || null;

  text = await condenseTextForPost(text, geminiApiKey);
  logger.info('Generating post_unico image (canvas)');
  const S = 1.8;
  const W = Math.round(600 * S); // 1080
  const H = 1350;
  const PAD = Math.round(28 * S);
  const FONT = 'Inter, "DejaVu Sans", sans-serif, "Color Emoji"';
  const FONT_SIZE = Math.round(21 * S);
  const LH = Math.round(31 * S);
  const NAME_SIZE = Math.round(16 * S);
  const HANDLE_SIZE = Math.round(15 * S);
  const FOOTER_SIZE = Math.round(14 * S);

  // Profile pic
  const PR = Math.round(22 * S);
  const PCX = PAD + PR;
  const nameX = PCX + PR + Math.round(12 * S);

  // Measure text lines — then cap to what fits the fixed canvas height
  const tmp = createCanvas(W, 100);
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.font = `${FONT_SIZE}px ${FONT}`;
  const allLines = wrapTextCanvas(tmpCtx, text, W - PAD * 2);

  // static layout height (everything except text block)
  const _headerH = PR * 2;
  const _headerGap = Math.round(14 * S);
  const _textGap = Math.round(24 * S);
  const _sepToFooter = Math.round(20 * S);
  const _staticH = _headerH + _headerGap + _textGap + 1 + _sepToFooter + FOOTER_SIZE;
  const _availTextH = H - _staticH - PAD * 2;
  const _maxLines = Math.max(1, Math.floor((_availTextH - FONT_SIZE) / LH) + 1);

  const lines = allLines.length > _maxLines ? allLines.slice(0, _maxLines) : allLines;
  if (allLines.length > _maxLines) {
    const last = lines[_maxLines - 1];
    lines[_maxLines - 1] = last.length > 3 ? last.slice(0, -3) + '…' : last + '…';
  }

  // Layout
  const headerH = PR * 2;
  const headerGap = Math.round(14 * S);
  const textH = lines.length > 0 ? (lines.length - 1) * LH + FONT_SIZE : 0;
  const textGap = Math.round(24 * S);
  const sepToFooter = Math.round(20 * S);
  const totalH = headerH + headerGap + textH + textGap + 1 + sepToFooter + FOOTER_SIZE;
  const blockY = Math.round((H - totalH) / 2);

  const picCY = blockY + PR;
  const nameBaseY = blockY + Math.round(PR * 0.72);
  const handleBaseY = blockY + Math.round(PR * 1.52);
  const textBaseY = blockY + headerH + headerGap + FONT_SIZE;
  const sepLineY = blockY + headerH + headerGap + textH + textGap;
  const footerBaseY = sepLineY + sepToFooter + FOOTER_SIZE - Math.round(4 * S);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Profile pic — circular clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(PCX, picCY, PR, 0, Math.PI * 2);
  ctx.clip();
  const profileImg = await loadProfilePic(profilePicUrl);
  ctx.drawImage(profileImg, PCX - PR, picCY - PR, PR * 2, PR * 2);
  ctx.restore();

  // Display name
  ctx.font = `bold ${NAME_SIZE}px ${FONT}`;
  ctx.fillStyle = '#0F1419';
  const nameText = displayName;
  ctx.fillText(nameText, nameX, nameBaseY);
  const nameW = ctx.measureText(nameText).width;

  // Verified badge (blue circle + white checkmark)
  const badgeR = Math.round(8 * S);
  const badgeCX = nameX + nameW + Math.round(5 * S) + badgeR;
  const badgeCY = nameBaseY - Math.round(NAME_SIZE * 0.35);

  ctx.fillStyle = '#1D9BF0';
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(2, Math.round(1.8 * S));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeCX - badgeR * 0.45, badgeCY + badgeR * 0.05);
  ctx.lineTo(badgeCX - badgeR * 0.05, badgeCY + badgeR * 0.42);
  ctx.lineTo(badgeCX + badgeR * 0.48, badgeCY - badgeR * 0.35);
  ctx.stroke();

  // Handle + · Follow
  ctx.font = `${HANDLE_SIZE}px ${FONT}`;
  ctx.fillStyle = '#536471';
  const handlePart = `${username} · `;
  ctx.fillText(handlePart, nameX, handleBaseY);
  const handlePartW = ctx.measureText(handlePart).width;

  ctx.font = `bold ${HANDLE_SIZE}px ${FONT}`;
  ctx.fillStyle = '#1D9BF0';
  ctx.fillText('Follow', nameX + handlePartW, handleBaseY);

  // Post text
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  ctx.fillStyle = '#0F1419';
  lines.forEach((line, i) => ctx.fillText(line, PAD, textBaseY + i * LH));

  // Bottom separator
  ctx.strokeStyle = '#EFF3F4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, sepLineY);
  ctx.lineTo(W - PAD, sepLineY);
  ctx.stroke();

  // Timestamp
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${h12}:${m} ${ampm} · ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  ctx.font = `${FOOTER_SIZE}px ${FONT}`;
  ctx.fillStyle = '#536471';
  ctx.fillText(dateStr, PAD, footerBaseY);

  // Info icon (circle + i)
  const iconR = Math.round(9 * S);
  const iconCX = W - PAD - iconR;
  const iconCY = footerBaseY - Math.round(FOOTER_SIZE * 0.35);

  ctx.strokeStyle = '#536471';
  ctx.lineWidth = Math.round(1.5 * S);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `bold ${Math.round(11 * S)}px ${FONT}`;
  ctx.fillStyle = '#536471';
  ctx.textAlign = 'center';
  ctx.fillText('i', iconCX, iconCY + Math.round(4 * S));
  ctx.textAlign = 'left';

  return canvas.encode('png');
}

async function overlayCarouselText(bgBuffer, card) {
  const W = 1080;
  const H = 1350;
  const PAD = 96;
  const FONT = 'Inter, "DejaVu Sans", sans-serif, "Color Emoji"';

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Draw Recraft background, scaled to fill
  const bg = await loadImage(bgBuffer);
  const scale = Math.max(W / bg.width, H / bg.height);
  const sw = bg.width * scale;
  const sh = bg.height * scale;
  ctx.drawImage(bg, (W - sw) / 2, (H - sh) / 2, sw, sh);

  // Semi-transparent overlay for text readability
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);

  const badge = (card.badge || 'TECH').toUpperCase();
  const headline = card.headline || card.title || '';
  const body = card.body || '';

  // Start layout from vertical center offset upward
  // Pre-measure to vertically center the content block
  ctx.font = `bold 78px ${FONT}`;
  const headlineLines = wrapTextCanvas(ctx, headline, W - PAD * 2);
  ctx.font = `42px ${FONT}`;
  const bodyLines = wrapTextCanvas(ctx, body, W - PAD * 2).slice(0, 8);

  const badgeH = 48;
  const gap = 24;
  const headlineH = headlineLines.length * 90;
  const dividerH = 1;
  const bodyH = bodyLines.length * 56;
  const totalH = badgeH + gap + headlineH + gap + dividerH + gap + bodyH;
  let y = Math.max(PAD, Math.round((H - totalH) / 2));

  // Badge pill — purple gradient
  ctx.font = `bold 26px ${FONT}`;
  const badgeTextW = ctx.measureText(badge).width;
  const pillW = badgeTextW + 40;
  const pillH = badgeH;
  const pillR = pillH / 2;
  const grad = ctx.createLinearGradient(PAD, y, PAD + pillW, y);
  grad.addColorStop(0, '#7B2FFF');
  grad.addColorStop(1, '#5B1FCC');
  drawRoundedRect(ctx, PAD, y, pillW, pillH, pillR);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(badge, PAD + 20, y + 33);
  y += pillH + gap;

  // Headline — bold white
  ctx.font = `bold 78px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  for (const line of headlineLines) {
    ctx.fillText(line, PAD, y + 72);
    y += 90;
  }
  y += gap;

  // Gradient divider — purple → cyan → transparent
  const divGrad = ctx.createLinearGradient(PAD, y, W - PAD, y);
  divGrad.addColorStop(0, '#7B2FFF');
  divGrad.addColorStop(0.5, '#00FFFF');
  divGrad.addColorStop(1, 'rgba(0,255,255,0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += dividerH + gap;

  // Body text — lighter white, word-wrapped
  ctx.font = `42px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const line of bodyLines) {
    ctx.fillText(line, PAD, y + 38);
    y += 56;
  }

  return canvas.encode('png');
}

async function generateCarouselImages(cards, tenantIdv) {
  const idvBase = tenantIdv || null; // falls back to default .md inside buildCarouselCardPrompt
  logger.info('Generating carousel images (recraft)', { count: cards.length });
  const buffers = [];
  for (let i = 0; i < cards.length; i++) {
    const prompt = buildCarouselCardPrompt(cards[i], i, cards.length, idvBase);
    const bgBuf = await callRecraftImage(prompt);
    const buf = await overlayCarouselText(bgBuf, cards[i]);
    buffers.push({ buf, caption: '' });
  }
  return buffers;
}

function parseCarouselCards(finalContent) {
  // finalContent is the formatador JSON: { format, content: [...cards], publishing_notes }
  try {
    const parsed = JSON.parse(finalContent);
    const content = parsed.content;
    if (Array.isArray(content)) return content;
    if (typeof content === 'string') return JSON.parse(content);
  } catch {}

  // Fallback: try to find array directly
  const match = finalContent.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  throw new Error('Nao foi possivel extrair cards do conteudo do carrossel');
}

// --- News Carousel (carrossel_noticias) — canvas-based ---
const NEWS_W = 1080;
const NEWS_H = 1350;
const NEWS_PAD = 60;
const NEWS_FONT = 'Inter, "DejaVu Sans", sans-serif, "Color Emoji"';
const NEWS_BG_PATH = path.join(__dirname, '../../idv-noticias.png');

let _newsBgCache = null;
async function newsBaseBgImage(ctx) {
  if (!_newsBgCache) _newsBgCache = await loadImage(NEWS_BG_PATH);
  const img = _newsBgCache;
  const scale = Math.max(NEWS_W / img.width, NEWS_H / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img, (NEWS_W - sw) / 2, (NEWS_H - sh) / 2, sw, sh);
}

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


function newsSlideIndicator(ctx, slideNum, total, branding) {
  const label = `${slideNum + 1}/${total}`;
  ctx.font = `bold 22px ${NEWS_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText(label, NEWS_W / 2, NEWS_H - 30);
  ctx.textAlign = 'left';
}


async function renderNewsCapa(slide, branding, _ogImageBuf, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  await newsBaseBgImage(ctx);

  const accent = branding.primary_color || '#FF5722';
  const textColor = branding.text_color || '#FFFFFF';

  // Content block anchored at ~33% height
  let y = Math.round(NEWS_H * 0.33);

  // "NOTICIA" badge pill
  ctx.font = `bold 22px ${NEWS_FONT}`;
  const badgeText = 'NOTICIA';
  const badgeW = ctx.measureText(badgeText).width + 32;
  drawRoundedRect(ctx, NEWS_PAD, y, badgeW, 40, 8);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badgeText, NEWS_PAD + 16, y + 28);
  y += 60;

  // Headline — large, impactful
  ctx.font = `bold 66px ${NEWS_FONT}`;
  ctx.fillStyle = textColor;
  const headlineLines = wrapTextCanvas(ctx, slide.headline || '', NEWS_W - NEWS_PAD * 2);
  for (const line of headlineLines.slice(0, 4)) {
    ctx.fillText(line, NEWS_PAD, y + 66);
    y += 76;
  }

  // Accent rule
  y += 24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(NEWS_PAD, y);
  ctx.lineTo(NEWS_PAD + 100, y);
  ctx.stroke();
  y += 28;

  // Source
  if (slide.source) {
    ctx.font = `22px ${NEWS_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`via ${slide.source}`, NEWS_PAD, y + 22);
  }

  newsSlideIndicator(ctx, 0, total, branding);

  return canvas.encode('png');
}

async function renderNewsContentSlide(slide, branding, slideIdx, total, _thumbBuf) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  await newsBaseBgImage(ctx);

  const accent = branding.primary_color || '#FF5722';
  const textColor = branding.text_color || '#FFFFFF';
  const labels = { resumo: 'RESUMO', pontos: 'PONTOS-CHAVE', impacto: 'IMPACTO' };

  // Pre-measure for vertical centering
  // Label row: 16px text + 8px gap + 3px rule + 28px gap = 55px
  const labelBlockH = 55;
  ctx.font = `bold 52px ${NEWS_FONT}`;
  const titleLines = wrapTextCanvas(ctx, slide.title || '', NEWS_W - NEWS_PAD * 2).slice(0, 2);
  const titleH = titleLines.length * 64;
  const gapH = 36;

  let bodyH = 0;
  let bodyLines = [];
  let itemsData = [];

  if (slide.type === 'pontos' && Array.isArray(slide.items)) {
    ctx.font = `34px ${NEWS_FONT}`;
    for (const item of slide.items.slice(0, 6)) {
      const lines = wrapTextCanvas(ctx, item, NEWS_W - NEWS_PAD * 2 - 48).slice(0, 2);
      itemsData.push(lines);
      bodyH += lines.length * 48 + 22;
    }
  } else if (slide.body) {
    ctx.font = `34px ${NEWS_FONT}`;
    bodyLines = wrapTextCanvas(ctx, slide.body, NEWS_W - NEWS_PAD * 2).slice(0, 14);
    bodyH = bodyLines.length * 48;
  }

  const totalContentH = labelBlockH + titleH + gapH + bodyH;
  const reservedBottom = 80;
  const availH = NEWS_H - reservedBottom;
  let y = Math.max(NEWS_PAD * 2, (availH - totalContentH) / 2);

  // Type label — small caps style
  ctx.font = `bold 16px ${NEWS_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText((labels[slide.type] || slide.type?.toUpperCase() || '').toUpperCase(), NEWS_PAD, y + 16);
  y += 24;

  // Accent rule under label
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(NEWS_PAD, y);
  ctx.lineTo(NEWS_PAD + 60, y);
  ctx.stroke();
  y += 28;

  // Title — large
  ctx.font = `bold 52px ${NEWS_FONT}`;
  ctx.fillStyle = textColor;
  for (const line of titleLines) {
    ctx.fillText(line, NEWS_PAD, y + 52);
    y += 64;
  }

  y += gapH;

  // Body or items
  if (slide.type === 'pontos' && itemsData.length) {
    for (const lines of itemsData) {
      // Filled square bullet
      ctx.fillStyle = accent;
      ctx.fillRect(NEWS_PAD, y + 14, 10, 10);
      ctx.font = `34px ${NEWS_FONT}`;
      ctx.fillStyle = textColor;
      for (const line of lines) {
        ctx.fillText(line, NEWS_PAD + 26, y + 34);
        y += 48;
      }
      y += 22;
    }
  } else if (bodyLines.length) {
    ctx.font = `34px ${NEWS_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const line of bodyLines) {
      ctx.fillText(line, NEWS_PAD, y + 34);
      y += 48;
    }
  }

  newsSlideIndicator(ctx, slideIdx, total, branding);

  return canvas.encode('png');
}

async function renderNewsCta(slide, branding, slideIdx, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  await newsBaseBgImage(ctx);

  const accent = branding.primary_color || '#FF5722';
  const textColor = branding.text_color || '#FFFFFF';

  ctx.textAlign = 'center';

  // Accent rule top
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(NEWS_W / 2 - 50, NEWS_H * 0.30);
  ctx.lineTo(NEWS_W / 2 + 50, NEWS_H * 0.30);
  ctx.stroke();

  // Question — very large, centered
  ctx.font = `bold 58px ${NEWS_FONT}`;
  ctx.fillStyle = textColor;
  const qLines = wrapTextCanvas(ctx, slide.question || '', NEWS_W - NEWS_PAD * 2);
  let y = NEWS_H * 0.30 + 80;
  for (const line of qLines.slice(0, 4)) {
    ctx.fillText(line, NEWS_W / 2, y);
    y += 70;
  }

  if (slide.action) {
    y += 28;
    // Pill button style
    ctx.font = `bold 30px ${NEWS_FONT}`;
    const actionW = ctx.measureText(slide.action).width + 48;
    drawRoundedRect(ctx, (NEWS_W - actionW) / 2, y, actionW, 56, 28);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(slide.action, NEWS_W / 2, y + 38);
  }

  ctx.textAlign = 'left';
  newsSlideIndicator(ctx, slideIdx, total, branding);

  return canvas.encode('png');
}

async function generateNewsCarouselSlides(slides, branding = {}, _ogImages = null) {
  logger.info('Generating news carousel slides', { count: slides.length });
  const total = slides.length;
  const results = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    let buf;

    if (slide.type === 'capa') {
      buf = await renderNewsCapa(slide, branding, null, total);
    } else if (slide.type === 'cta') {
      buf = await renderNewsCta(slide, branding, i, total);
    } else {
      buf = await renderNewsContentSlide(slide, branding, i, total, null);
    }

    results.push({ buf, caption: `${i + 1}/${total}` });
  }

  return results;
}

function parseNewsCarouselSlides(finalContent) {
  try {
    const jsonStr = finalContent.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(jsonStr);
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

module.exports = {
  generatePostUnico,
  generateCarouselImages,
  parseCarouselCards,
  generateNewsCarouselSlides,
  parseNewsCarouselSlides,
};

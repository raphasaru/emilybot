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
  return Buffer.from(imgData);
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

// IDV1: carrossel — dark modern tech aesthetic
const IDV1_BASE =
  'Instagram carousel card, dark modern aesthetic, 3:4 rectangle format. ' +
  'Deep black background with subtle dark purple gradient (#000 to #1a0030). ' +
  'Bold white sans-serif typography. Purple and blue neon glow accents (#7B2FFF, #00BFFF, #00FFFF). ' +
  'Premium tech style, minimal, clean, no clutter. ';

function buildCarouselCardPrompt(card) {
  const base = IDV1_BASE;
  const slide = `Bottom left corner: slide number "${card.slide}". `;

  switch (card.type) {
    case 'capa':
      return base + `Large centered impact headline: "${card.title}". Purple glow behind text. ` + slide;

    case 'conceito':
      return (
        base +
        `Small badge label at top: "${card.label || 'CONCEITO'}". ` +
        `Large centered title: "${card.title}". ` +
        `Smaller subtitle below: "${card.body || ''}". ` +
        slide
      );

    case 'dados':
      return (
        base +
        `Small badge label at top: "${card.label || 'DADOS'}". ` +
        `Very large metric number with neon glow: "${card.metric}". ` +
        `Smaller context text below: "${card.context || ''}". ` +
        slide
      );

    case 'comparacao':
      return (
        base +
        'Two columns separated by a vertical purple glow divider. ' +
        `Left column text: "${card.left}". Right column text: "${card.right}". ` +
        slide
      );

    case 'cta':
      return (
        base +
        `Large question text centered: "${card.question}". ` +
        `Smaller action instruction below: "${card.action || ''}". Purple glow behind text. ` +
        slide
      );

    default: // conteudo, etc.
      return (
        base +
        `Title: "${card.title || ''}". ` +
        `Body text: "${card.body || ''}". ` +
        slide
      );
  }
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

async function generateCarouselImages(cards) {
  logger.info('Generating carousel images', { count: cards.length });
  const buffers = [];
  for (const card of cards) {
    const prompt = buildCarouselCardPrompt(card);
    const buf = await callRecraftImage(prompt);
    buffers.push({ buf, caption: card.slide });
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
  const handle = branding.username ? `@${branding.username.replace(/^@/, '')}` : (branding.display_name || 'EmilyBot');
  ctx.font = `bold 24px ${NEWS_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(handle, NEWS_W - NEWS_PAD, NEWS_H - 60);
  ctx.textAlign = 'left';
}

async function renderNewsCapa(slide, branding, ogImageBuf, total) {
  const canvas = createCanvas(NEWS_W, NEWS_H);
  const ctx = canvas.getContext('2d');

  if (ogImageBuf) {
    try {
      const img = await loadImage(ogImageBuf);
      const scale = Math.max(NEWS_W / img.width, NEWS_H * 0.65 / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (NEWS_W - sw) / 2, 0, sw, sh);
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

  const labels = { resumo: 'RESUMO', pontos: 'PONTOS-CHAVE', impacto: 'IMPACTO' };
  ctx.font = `bold 18px ${NEWS_FONT}`;
  ctx.fillStyle = branding.primary_color || '#FF5722';
  ctx.fillText(labels[slide.type] || slide.type?.toUpperCase() || '', NEWS_PAD, 80);

  ctx.font = `bold 42px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  const titleLines = wrapTextCanvas(ctx, slide.title || '', NEWS_W - NEWS_PAD * 2);
  let y = 140;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, NEWS_PAD, y);
    y += 52;
  }

  y += 30;

  if (slide.type === 'pontos' && Array.isArray(slide.items)) {
    ctx.font = `32px ${NEWS_FONT}`;
    for (const item of slide.items.slice(0, 6)) {
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

  ctx.font = `bold 46px ${NEWS_FONT}`;
  ctx.fillStyle = branding.text_color || '#FFFFFF';
  const qLines = wrapTextCanvas(ctx, slide.question || '', NEWS_W - NEWS_PAD * 2);
  let y = NEWS_H * 0.35;
  for (const line of qLines.slice(0, 3)) {
    ctx.textAlign = 'center';
    ctx.fillText(line, NEWS_W / 2, y);
    y += 58;
  }

  if (slide.action) {
    y += 30;
    ctx.font = `28px ${NEWS_FONT}`;
    ctx.fillStyle = branding.primary_color || '#FF5722';
    ctx.textAlign = 'center';
    ctx.fillText(slide.action, NEWS_W / 2, y);
  }

  ctx.textAlign = 'left';

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

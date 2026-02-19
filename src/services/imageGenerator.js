const axios = require('axios');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/Apple Color Emoji.ttc', 'Apple Color Emoji');
const path = require('path');
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

async function generatePostUnico(text, branding = {}) {
  const displayName = branding.display_name || 'Rapha Saru';
  const username = branding.username ? `@${branding.username.replace(/^@/, '')}` : '@raphasaru';
  const profilePicUrl = branding.profile_pic_url || null;

  logger.info('Generating post_unico image (canvas)');
  const S = 1.8;
  const W = Math.round(600 * S); // 1080
  const H = 1350;
  const PAD = Math.round(28 * S);
  const FONT = '"Helvetica Neue", Arial, "Apple Color Emoji", sans-serif';
  const FONT_SIZE = Math.round(21 * S);
  const LH = Math.round(31 * S);
  const NAME_SIZE = Math.round(16 * S);
  const HANDLE_SIZE = Math.round(15 * S);
  const FOOTER_SIZE = Math.round(14 * S);

  // Profile pic
  const PR = Math.round(22 * S);
  const PCX = PAD + PR;
  const nameX = PCX + PR + Math.round(12 * S);

  // Measure text lines
  const tmp = createCanvas(W, 100);
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.font = `${FONT_SIZE}px ${FONT}`;
  const lines = wrapTextCanvas(tmpCtx, text.slice(0, 500), W - PAD * 2);

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

module.exports = {
  generatePostUnico,
  generateCarouselImages,
  parseCarouselCards,
};

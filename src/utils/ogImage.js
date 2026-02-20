const axios = require('axios');
const { logger } = require('./logger');

async function fetchOgImage(url) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmilyBot/1.0)' },
      maxContentLength: 2 * 1024 * 1024,
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
      maxContentLength: 10 * 1024 * 1024,
    });

    return Buffer.from(imgData);
  } catch (err) {
    logger.warn('fetchOgImage failed', { url, error: err.message });
    return null;
  }
}

module.exports = { fetchOgImage };

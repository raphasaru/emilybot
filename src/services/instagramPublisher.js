'use strict';
const axios = require('axios');
const { logger } = require('../utils/logger');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function createMediaContainer(userId, token, imageUrl, caption = null, isCarouselItem = false) {
  const params = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = true;
  if (caption && !isCarouselItem) params.caption = caption;
  try {
    const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
    if (!data.id) throw new Error('IG: no container id returned');
    return data.id;
  } catch (err) {
    const body = err.response?.data;
    logger.error('IG createMediaContainer failed', { status: err.response?.status, body, imageUrl });
    throw new Error(`IG API ${err.response?.status}: ${JSON.stringify(body) || err.message}`);
  }
}

async function createCarouselContainer(userId, token, childrenIds, caption) {
  const params = {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    caption,
    access_token: token,
  };
  try {
    const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
    if (!data.id) throw new Error('IG: no carousel container id returned');
    return data.id;
  } catch (err) {
    const body = err.response?.data;
    logger.error('IG createCarouselContainer failed', { status: err.response?.status, body, childrenIds });
    throw new Error(`IG carousel ${err.response?.status}: ${JSON.stringify(body) || err.message}`);
  }
}

async function publishContainer(userId, token, creationId) {
  const params = { creation_id: creationId, access_token: token };
  try {
    const { data } = await axios.post(`${IG_BASE}/${userId}/media_publish`, null, { params, timeout: 30000 });
    if (!data.id) throw new Error('IG: publish returned no post id');
    return data.id;
  } catch (err) {
    const body = err.response?.data;
    logger.error('IG publishContainer failed', { status: err.response?.status, body, creationId });
    throw new Error(`IG publish ${err.response?.status}: ${JSON.stringify(body) || err.message}`);
  }
}

// Polls until container status is FINISHED (up to 60s)
async function waitForContainer(userId, token, containerId) {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`${IG_BASE}/${containerId}`, {
      params: { fields: 'status_code,status', access_token: token },
      timeout: 15000,
    });
    logger.debug('IG container poll', { containerId, status_code: data.status_code, status: data.status });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`IG: container processing failed — ${data.status || 'unknown reason'}`);
    }
  }
  throw new Error('IG: container processing timed out');
}

async function postSingleImage(userId, token, imageUrl, caption) {
  logger.info('IG: posting single image', { userId });
  const containerId = await createMediaContainer(userId, token, imageUrl, caption);
  await waitForContainer(userId, token, containerId);
  return publishContainer(userId, token, containerId);
}

async function postCarousel(userId, token, imageUrls, caption) {
  logger.info('IG: posting carousel', { userId, slides: imageUrls.length });
  const childIds = [];
  for (const url of imageUrls) {
    const id = await createMediaContainer(userId, token, url, null, true);
    await waitForContainer(userId, token, id);
    childIds.push(id);
  }
  const carouselId = await createCarouselContainer(userId, token, childIds, caption);
  await waitForContainer(userId, token, carouselId);
  return publishContainer(userId, token, carouselId);
}

module.exports = { postSingleImage, postCarousel };

'use strict';
const axios = require('axios');
const { logger } = require('../utils/logger');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function createMediaContainer(userId, token, imageUrl, caption = null, isCarouselItem = false) {
  const params = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = true;
  if (caption && !isCarouselItem) params.caption = caption;
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: no container id returned');
  return data.id;
}

async function createCarouselContainer(userId, token, childrenIds, caption) {
  const params = {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    caption,
    access_token: token,
  };
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: no carousel container id returned');
  return data.id;
}

async function publishContainer(userId, token, creationId) {
  const params = { creation_id: creationId, access_token: token };
  const { data } = await axios.post(`${IG_BASE}/${userId}/media_publish`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: publish returned no post id');
  return data.id;
}

// Polls until container status is FINISHED (up to 60s)
async function waitForContainer(userId, token, containerId) {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`${IG_BASE}/${containerId}`, {
      params: { fields: 'status_code', access_token: token },
      timeout: 15000,
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('IG: container processing failed');
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
  return publishContainer(userId, token, carouselId);
}

module.exports = { postSingleImage, postCarousel };

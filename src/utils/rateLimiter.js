'use strict';

const LIMIT = 6;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const buckets = new Map(); // tenantId -> [timestamps]

function checkRateLimit(tenantId) {
  const now = Date.now();
  const timestamps = buckets.get(tenantId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= LIMIT) {
    buckets.set(tenantId, recent);
    return false;
  }

  recent.push(now);
  buckets.set(tenantId, recent);
  return true;
}

function _reset() {
  buckets.clear();
}

module.exports = { checkRateLimit, _reset };

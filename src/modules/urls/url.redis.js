import { config } from '../../config/index.js';

const KEY_PREFIX = 'url:cache:';

export function getCacheKey(shortCode) {
  return `${KEY_PREFIX}${shortCode}`;
}

export async function cacheUrl(redis, shortCode, urlData, ttlSeconds = config.redis.cacheTtlSeconds) {
  try {
    const payload = JSON.stringify({
      id: urlData.id.toString(),
      originalUrl: urlData.originalUrl,
      shortCode: urlData.shortCode,
    });
    await redis.set(getCacheKey(shortCode), payload, {
      EX: ttlSeconds,
    });
  } catch (err) {
    // Non-fatal cache write failure; log but do not disrupt primary flow
    console.error('Redis cacheUrl error:', err.message);
  }
}

export async function getCachedUrl(redis, shortCode) {
  try {
    const cached = await redis.get(getCacheKey(shortCode));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.error('Redis getCachedUrl error:', err.message);
    return null;
  }
}

export async function invalidateUrlCache(redis, shortCode) {
  try {
    await redis.del(getCacheKey(shortCode));
  } catch (err) {
    console.error('Redis invalidateUrlCache error:', err.message);
  }
}

export async function publishUrlClickedEvent(redis, event) {
  try {
    await redis.lPush(config.redis.clickQueue, JSON.stringify(event));
  } catch (err) {
    console.error('Failed to publish url clicked event to Redis:', err.message);
  }
}

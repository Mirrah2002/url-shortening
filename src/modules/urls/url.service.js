import {
  createUrl,
  findUrlByShortCode,
  deleteUrlByShortCode,
  listUrls,
  getUrlAnalyticsData,
} from './url.repository.js';
import { generateBase62, isValidCustomCode } from '../../utils/encode.helper.js';
import { validateAndSanitizeUrl } from '../../utils/url.validator.js';
import { cacheUrl, getCachedUrl, invalidateUrlCache } from './url.redis.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../errors/app.error.js';
import { config } from '../../config/index.js';

function formatUrlDto(url) {
  return {
    id: url.id.toString(),
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    shortUrl: `${config.server.baseUrl}/${url.shortCode}`,
    createdAt: url.createdAt,
    updatedAt: url.updatedAt,
    ...(url._count ? { totalClicks: url._count.clicks } : {}),
  };
}

export async function createUrlService(prisma, redis, { originalUrl, customCode }) {
  const sanitizedUrl = validateAndSanitizeUrl(originalUrl);

  let shortCode;

  if (customCode) {
    const trimmedCustom = customCode.trim();
    if (!isValidCustomCode(trimmedCustom)) {
      throw new BadRequestError(
        'Custom code must be 3-30 characters long and contain only letters, numbers, hyphens, or underscores, and cannot be a reserved system keyword'
      );
    }

    const existing = await findUrlByShortCode(prisma, trimmedCustom);
    if (existing) {
      throw new ConflictError(`Short code '${trimmedCustom}' is already in use`);
    }

    shortCode = trimmedCustom;
  } else {
    const maxAttempts = 5;
    let created = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const generatedCode = generateBase62(7);
      try {
        created = await createUrl(prisma, {
          originalUrl: sanitizedUrl,
          shortCode: generatedCode,
        });
        shortCode = generatedCode;
        break;
      } catch (error) {
        if (error.code === 'P2002' && attempt < maxAttempts) {
          continue; // Collision on unique short_code, retry with a fresh code
        }
        throw error;
      }
    }

    if (!created) {
      throw new Error('Failed to generate a unique short code after multiple attempts');
    }

    // Warm cache immediately
    await cacheUrl(redis, shortCode, created);
    return formatUrlDto(created);
  }

  // Create custom URL record
  const created = await createUrl(prisma, {
    originalUrl: sanitizedUrl,
    shortCode,
  });

  // Warm cache
  await cacheUrl(redis, shortCode, created);
  return formatUrlDto(created);
}

export async function resolveShortUrlService(prisma, redis, shortCode) {
  // 1. Check Redis Cache
  const cached = await getCachedUrl(redis, shortCode);
  if (cached) {
    return cached;
  }

  // 2. Cache miss: Query Database
  const url = await findUrlByShortCode(prisma, shortCode);
  if (!url) {
    return null;
  }

  // 3. Populate Redis Cache
  await cacheUrl(redis, shortCode, url);

  return {
    id: url.id.toString(),
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
  };
}

export async function getUrlDetailsService(prisma, shortCode) {
  const url = await findUrlByShortCode(prisma, shortCode);
  if (!url) {
    throw new NotFoundError(`Short URL with code '${shortCode}' not found`);
  }
  return formatUrlDto(url);
}

export async function getUrlAnalyticsService(prisma, shortCode) {
  const url = await findUrlByShortCode(prisma, shortCode);
  if (!url) {
    throw new NotFoundError(`Short URL with code '${shortCode}' not found`);
  }

  const analytics = await getUrlAnalyticsData(prisma, url.id);

  return {
    url: formatUrlDto(url),
    analytics,
  };
}

export async function deleteUrlService(prisma, redis, shortCode) {
  const existing = await findUrlByShortCode(prisma, shortCode);
  if (!existing) {
    throw new NotFoundError(`Short URL with code '${shortCode}' not found`);
  }

  await deleteUrlByShortCode(prisma, shortCode);
  await invalidateUrlCache(redis, shortCode);

  return {
    success: true,
    message: `Short URL '${shortCode}' successfully deleted`,
  };
}

export async function listUrlsService(prisma, { page = 1, limit = 20 } = {}) {
  const validPage = Math.max(1, parseInt(page, 10) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (validPage - 1) * validLimit;

  const { items, total } = await listUrls(prisma, { skip, take: validLimit });

  return {
    items: items.map(formatUrlDto),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages: Math.ceil(total / validLimit),
    },
  };
}

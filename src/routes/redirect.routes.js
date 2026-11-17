import { resolveShortUrlService } from '../modules/urls/url.service.js';
import { createUrlClickedEvent } from '../modules/urls/url.events.js';
import { publishUrlClickedEvent } from '../modules/urls/url.redis.js';
import { RESERVED_SHORT_CODES } from '../utils/encode.helper.js';
import { NotFoundError } from '../errors/app.error.js';

export default async function redirectRoutes(fastify) {
  fastify.get('/:shortCode', {
    schema: {
      params: {
        type: 'object',
        required: ['shortCode'],
        properties: {
          shortCode: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
          },
        },
      },
    },
  }, async (request, reply) => {
    const { shortCode } = request.params;

    // Skip reserved root routes (like /health, /api, /favicon.ico)
    if (RESERVED_SHORT_CODES.has(shortCode.toLowerCase())) {
      throw new NotFoundError('Not found');
    }

    const url = await resolveShortUrlService(
      fastify.prisma,
      fastify.redis,
      shortCode
    );

    if (!url) {
      throw new NotFoundError(`Short URL '${shortCode}' does not exist or has expired`);
    }

    // Capture and publish click event asynchronously
    const event = createUrlClickedEvent(url, request);
    publishUrlClickedEvent(fastify.redis, event).catch((err) => {
      request.log.error(err, 'Failed to enqueue click tracking event');
    });

    // 302 Found redirect (preserves click tracking for subsequent visits)
    return reply.redirect(url.originalUrl, 302);
  });
}


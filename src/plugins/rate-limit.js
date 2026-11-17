import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config/index.js';

async function rateLimitPlugin(fastify) {
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    errorResponseBuilder: (request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Rate limit is ${context.max} requests per ${context.after}. Please try again later.`,
        details: {
          limit: context.max,
          after: context.after,
        },
      },
      timestamp: new Date().toISOString(),
    }),
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
});

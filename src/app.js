import './utils/bigint.js';
import Fastify from 'fastify';
import { config } from './config/index.js';

// Plugins
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import securityPlugin from './plugins/security.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import errorHandlerPlugin from './plugins/error-handler.js';

// Routes
import healthRoutes from './routes/health.routes.js';
import urlRoutes from './modules/urls/url.route.js';
import redirectRoutes from './routes/redirect.routes.js';

export function buildApp(options = {}) {
  const isDev = config.isDevelopment;

  const app = Fastify({
    logger: isDev
      ? {
          level: config.logger.level,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          level: config.logger.level,
        },
    trustProxy: true,
    ...options,
  });

  // 1. Core Infrastructure Plugins
  app.register(prismaPlugin);
  app.register(redisPlugin);

  // 2. Security & Protection Plugins
  app.register(securityPlugin);
  app.register(rateLimitPlugin);
  app.register(errorHandlerPlugin);

  // 3. Application Routes
  app.register(healthRoutes);
  app.register(urlRoutes, { prefix: '/api/v1/urls' });
  app.register(redirectRoutes); // Root level short URL redirects (e.g. GET /:shortCode)

  return app;
}

export default buildApp;

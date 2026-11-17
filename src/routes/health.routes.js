import { StatusCodes } from 'http-status-codes';
import { config } from '../config/index.js';

export default async function healthRoutes(fastify) {
  // Liveness probe (is process alive?)
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.env,
    };
  });

  // Readiness probe (can service handle database & redis traffic?)
  fastify.get('/health/ready', async (request, reply) => {
    const checks = {
      database: 'down',
      redis: 'down',
    };

    let isHealthy = true;

    // Check PostgreSQL
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch (err) {
      isHealthy = false;
      fastify.log.error(err, 'Readiness probe: Database check failed');
      checks.database = 'down';
    }

    // Check Redis
    try {
      const pong = await fastify.redis.ping();
      if (pong === 'PONG') {
        checks.redis = 'up';
      } else {
        isHealthy = false;
        checks.redis = 'down';
      }
    } catch (err) {
      isHealthy = false;
      fastify.log.error(err, 'Readiness probe: Redis check failed');
      checks.redis = 'down';
    }

    const memoryUsage = process.memoryUsage();

    const response = {
      status: isHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      },
    };

    if (!isHealthy) {
      return reply.status(StatusCodes.SERVICE_UNAVAILABLE).send(response);
    }

    return response;
  });
}

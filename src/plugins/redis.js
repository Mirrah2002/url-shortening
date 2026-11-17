import fp from 'fastify-plugin';
import { createClient } from 'redis';
import { config } from '../config/index.js';

async function redisPlugin(fastify) {
  const redis = createClient({
    url: config.redis.url,
  });

  redis.on('error', (error) => {
    fastify.log.error(error, 'Redis client connection error');
  });

  redis.on('reconnecting', () => {
    fastify.log.warn('Redis client reconnecting...');
  });

  await redis.connect();
  fastify.log.info('Redis connected successfully');

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('Closing Redis connection...');
    await instance.redis.quit();
    fastify.log.info('Redis connection closed');
  });
}

export default fp(redisPlugin, {
  name: 'redis',
});

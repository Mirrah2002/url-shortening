import fp from 'fastify-plugin';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config/index.js';

async function prismaPlugin(fastify) {
  const adapter = new PrismaPg({
    connectionString: config.db.url,
  });

  const prisma = new PrismaClient({
    adapter,
    log: config.isDevelopment ? ['warn', 'error'] : ['error'],
  });

  await prisma.$connect();
  fastify.log.info('PostgreSQL connected via Prisma');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('Disconnecting PostgreSQL client...');
    await instance.prisma.$disconnect();
    fastify.log.info('PostgreSQL client disconnected');
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});

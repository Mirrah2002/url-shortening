import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

async function securityPlugin(fastify) {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Allows flexible redirects & standard JSON API responses
    crossOriginEmbedderPolicy: false,
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
}

export default fp(securityPlugin, {
  name: 'security',
});


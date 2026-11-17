import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  REDIS_CLICK_QUEUE: z.string().default('url:clicks'),
  URL_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW: z.string().default('1 minute'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = Object.freeze({
  env: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  server: {
    port: parsed.data.PORT,
    host: parsed.data.HOST,
    baseUrl: parsed.data.BASE_URL.replace(/\/+$/, ''), // strip trailing slash
  },
  db: {
    url: parsed.data.DATABASE_URL,
  },
  redis: {
    url: parsed.data.REDIS_URL,
    clickQueue: parsed.data.REDIS_CLICK_QUEUE,
    cacheTtlSeconds: parsed.data.URL_CACHE_TTL_SECONDS,
  },
  rateLimit: {
    max: parsed.data.RATE_LIMIT_MAX,
    timeWindow: parsed.data.RATE_LIMIT_TIME_WINDOW,
  },
  logger: {
    level: parsed.data.LOG_LEVEL,
  },
});

export default config;


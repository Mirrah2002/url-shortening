import '../utils/bigint.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from 'redis';
import { config } from '../config/index.js';
import { createUrlClick, createUrlClicksBatch } from '../modules/urls/url.repository.js';

const BATCH_SIZE = 50;
const BATCH_TIMEOUT_MS = 1500;

class UrlClickWorker {
  constructor() {
    this.redis = null;
    this.prisma = null;
    this.isRunning = false;
    this.isShuttingDown = false;
    this.eventBuffer = [];
    this.flushTimer = null;
  }

  async initialize() {
    console.log('[Worker] Starting URL click consumer worker...');

    // 1. Setup Redis Client
    this.redis = createClient({
      url: config.redis.url,
    });

    this.redis.on('error', (err) => {
      console.error('[Worker] Redis error:', err.message);
    });

    await this.redis.connect();
    console.log('[Worker] Connected to Redis queue:', config.redis.clickQueue);

    // 2. Setup Prisma Client
    const adapter = new PrismaPg({
      connectionString: config.db.url,
    });

    this.prisma = new PrismaClient({
      adapter,
    });

    await this.prisma.$connect();
    console.log('[Worker] Connected to PostgreSQL database');

    this.isRunning = true;
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    const handleShutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`\n[Worker] Received ${signal}. Initiating graceful shutdown...`);

      // Clear timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }

      // Flush remaining events in buffer
      await this.flushBuffer();

      // Close connections
      try {
        if (this.redis) await this.redis.quit();
        if (this.prisma) await this.prisma.$disconnect();
        console.log('[Worker] All connections cleanly closed. Goodbye!');
        process.exit(0);
      } catch (err) {
        console.error('[Worker] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
      console.error('[Worker] Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', async (error) => {
      console.error('[Worker] Uncaught Exception:', error);
      await handleShutdown('uncaughtException');
    });
  }

  async flushBuffer() {
    if (this.eventBuffer.length === 0) return;

    const toProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await createUrlClicksBatch(this.prisma, toProcess);
      console.log(`[Worker] Successfully flushed batch of ${toProcess.length} click events to database`);
    } catch (err) {
      console.warn(`[Worker] Batch insert failed (${err.message}). Falling back to individual inserts...`);

      // Fallback: insert one by one so valid events still persist even if one record has foreign key mismatch
      for (const event of toProcess) {
        try {
          await createUrlClick(this.prisma, event);
        } catch (singleErr) {
          console.error(`[Worker] Dropping failed event for URL ID ${event.urlId}: ${singleErr.message}`);
        }
      }
    }
  }

  async start() {
    await this.initialize();

    // Periodic flush timer for pending events that haven't reached BATCH_SIZE
    this.flushTimer = setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, BATCH_TIMEOUT_MS);

    console.log('[Worker] Worker loop active. Waiting for events...');

    while (!this.isShuttingDown) {
      try {
        // Pop with a 2-second timeout to periodically allow graceful shutdown checks
        const result = await this.redis.brPop(config.redis.clickQueue, 2);

        if (!result) {
          continue;
        }

        let clickEvent;
        try {
          clickEvent = JSON.parse(result.element);
        } catch (parseErr) {
          console.error('[Worker] Discarding corrupt JSON event payload:', parseErr.message);
          continue;
        }

        if (!clickEvent.urlId) {
          console.warn('[Worker] Event missing urlId, skipping:', clickEvent);
          continue;
        }

        this.eventBuffer.push(clickEvent);

        // If buffer reached batch threshold, flush immediately
        if (this.eventBuffer.length >= BATCH_SIZE) {
          await this.flushBuffer();
        }
      } catch (err) {
        if (!this.isShuttingDown) {
          console.error('[Worker] Error in worker loop:', err.message);
          // Wait 1 second before retrying to prevent rapid tight looping on network errors
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
}

// Start worker process
const worker = new UrlClickWorker();
worker.start().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});

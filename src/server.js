import { buildApp } from './app.js';
import { config } from './config/index.js';

const app = buildApp();

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  app.log.info({ signal }, 'Graceful shutdown initiated...');

  try {
    // 10 second timeout for shutdown
    const forceExitTimer = setTimeout(() => {
      app.log.error('Forced shutdown timeout reached. Terminating process.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    await app.close();
    app.log.info('Server successfully closed. All connections drained.');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error occurred while closing server');
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  app.log.fatal({ reason }, 'Unhandled Promise Rejection');
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  app.log.fatal({ error }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});

// Start listening
try {
  await app.listen({
    port: config.server.port,
    host: config.server.host,
  });

  app.log.info(
    `🚀 URL Shortener Service running at http://${config.server.host}:${config.server.port} [${config.env}]`
  );
  app.log.info(`🔗 Public Base URL: ${config.server.baseUrl}`);
} catch (error) {
  app.log.fatal(error, 'Failed to start server');
  process.exit(1);
}

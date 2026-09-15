import { mediaStore } from './media/index.js';
import { createServer } from 'node:http';
import { app } from './app/index.js';
import { config } from './config/env.js';
import { pool } from './database/pool.js';
import { initializeSocket } from './socket/index.js';
import { localization } from './localization/index.js';

const server = createServer(app);
const io = initializeSocket(server);
let stopping = false;
let mediaCleanup: ReturnType<typeof setInterval> | undefined;

async function shutdown(exitCode: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(mediaCleanup);
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      io.close((error?: NodeJS.ErrnoException) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
      server.closeIdleConnections();
    });
    await pool.end();
    clearTimeout(timeout);
    process.exitCode = exitCode;
  } catch (error) {
    console.error('Shutdown failed:', error);
    process.exit(1);
  }
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
// Explicit local development refresh after applying translation migrations.
// No HTTP endpoint, polling, or database work in individual translation lookups.
if (config.app.mode === 'development') {
  process.on('SIGUSR2', () => {
    if (stopping) return;
    void localization.reload()
      .then(() => console.info('Localization cache reloaded from PostgreSQL.'))
      .catch((error: Error) => console.error('Localization reload failed; previous cache retained:', error.message));
  });
}
server.on('error', (error) => {
  console.error('HTTP server failed:', error.message);
  void shutdown(1);
});
try {
  await localization.load();
  await mediaStore.initialize();
  await mediaStore.cleanup();
  mediaCleanup = setInterval(() => { void mediaStore.cleanup().catch(() => console.error('Temporary media cleanup failed.')); }, 3600000);
  mediaCleanup.unref();
  if (!stopping) {
    server.listen(config.app.port, config.app.host, () => {
      console.info(`HORMAT-code-v4 (${config.app.mode}) listening on http://${config.app.host}:${config.app.port}`);
      console.info('Localization ready; database connectivity is available at GET /health.');
    });
  }
} catch (error) {
  console.error('Localization startup failed; HTTP server was not started:', error instanceof Error ? error.message : error);
  await shutdown(1);
}

export interface SyncOptions {
  enabled: boolean;
  batchSize: number;
  maxConcurrentBatches: number;
  longpollTimeoutMs: number;
  retryMinMs: number;
  retryMaxMs: number;
}
export function syncOptions(env: NodeJS.ProcessEnv): SyncOptions {
  const enabled = env.VENDOR_SYNC_ENABLED ?? 'false';
  if (!['true', 'false'].includes(enabled)) throw new Error('Configuration error: VENDOR_SYNC_ENABLED must be true or false.');
  function integer(name: string, fallback: number, min: number, max: number) {
    const value = env[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || +value < min || +value > max) {
      throw new Error(`Configuration error: ${name} must be an integer between ${min} and ${max}.`);
    }
    return +value;
  }
  const options = {
    enabled: enabled === 'true',
    batchSize: integer('VENDOR_SYNC_BATCH_SIZE', 100, 1, 10000),
    maxConcurrentBatches: integer('VENDOR_SYNC_MAX_CONCURRENT_BATCHES', 5, 1, 100),
    longpollTimeoutMs: integer('VENDOR_SYNC_LONGPOLL_TIMEOUT_MS', 25000, 1000, 120000),
    retryMinMs: integer('VENDOR_SYNC_RETRY_MIN_MS', 2000, 100, 300000),
    retryMaxMs: integer('VENDOR_SYNC_RETRY_MAX_MS', 30000, 100, 300000),
  };
  if (options.retryMaxMs < options.retryMinMs) throw new Error('Configuration error: VENDOR_SYNC_RETRY_MAX_MS must be >= VENDOR_SYNC_RETRY_MIN_MS.');
  return options;
}

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuration error: ${name} is required. See .env.example.`);
  return value;
}

function port(name: string, fallback?: string): number {
  const value = process.env[name] ?? fallback ?? required(name);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`Configuration error: ${name} must be an integer between 1 and 65535.`);
  }
  return Number(value);
}

const mode = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(mode)) {
  throw new Error('Configuration error: NODE_ENV must be development, test, or production.');
}
if (process.env.DB_PASSWORD === undefined) {
  throw new Error('Configuration error: DB_PASSWORD must be set (may be empty for local trust authentication).');
}

function nonnegative(name: string, fallback: number): number {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Configuration error: ${name} must be a nonnegative safe integer.`);
  return Number(value);
}
const mediaTtlHours = nonnegative('MEDIA_CACHE_TTL_HOURS', 24);
if (!mediaTtlHours) throw new Error('Configuration error: MEDIA_CACHE_TTL_HOURS must be positive.');
export const config = {
  media: { root: path.resolve(process.env.MEDIA_ROOT?.trim() || fileURLToPath(new URL('../../.media', import.meta.url))), ttlHours: mediaTtlHours, maxBytes: nonnegative('MEDIA_MAX_UPLOAD_BYTES', 0) },
  app: { mode, host: process.env.HOST?.trim() || '127.0.0.1', port: port('PORT', '3000') },
  database: {
    host: required('DB_HOST'), port: port('DB_PORT'), database: required('DB_NAME'),
    user: required('DB_USER'), password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, max: 10,
    query_timeout: 5000,
  },
};

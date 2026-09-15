import pg from 'pg';
import { config } from '../config/env.js';

export const pool = new pg.Pool(config.database);
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

export async function checkDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}

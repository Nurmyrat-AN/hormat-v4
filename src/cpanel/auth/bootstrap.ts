import type { Pool } from 'pg';
import { pool } from '../../database/pool.js';
import { hashPassword, normalizeEmail, validEmail } from './password.js';

export interface BootstrapInput { name: string; email: string; password: string; phone?: string; job?: string; avatarUrl?: string }
export async function bootstrapSuperuser(input: BootstrapInput, database: Pool = pool): Promise<{ id: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  if (!input.name.trim() || !validEmail(email)) throw new Error('Bootstrap requires a name and valid email.');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(724804, 2)');
    const existing = (await client.query(`SELECT a.user_id, p.value FROM cpanel_user_auth a
      LEFT JOIN cpanel_user_permissions p ON p.user_id=a.user_id AND p.key='superuser' WHERE a.email=$1`, [email])).rows[0];
    if (existing) {
      if (existing.value !== true) throw new Error('Bootstrap email belongs to an existing non-superuser; no changes made.');
      await client.query('COMMIT');
      return { id: existing.user_id, created: false };
    }
    const hash = await hashPassword(input.password);
    const { rows: [user] } = await client.query(`INSERT INTO cpanel_users(name,phone,job,avatar_url) VALUES($1,$2,$3,$4) RETURNING id`,
      [input.name.trim(), input.phone?.trim() || null, input.job?.trim() || null, input.avatarUrl?.trim() || null]);
    await client.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)', [user.id, email, hash]);
    await client.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'superuser','true'::jsonb)", [user.id]);
    await client.query('COMMIT');
    return { id: user.id, created: true };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

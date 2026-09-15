import type { Pool } from 'pg';
import { pool } from '../../database/pool.js';

export interface CpanelUser { id: string; name: string; phone: string | null; job: string | null; avatar_url: string | null }
export class AuthRepository {
  constructor(readonly database: Pool = pool) {}
  async credentials(email: string): Promise<{ user_id: string; password_hash: string; is_active: boolean } | undefined> {
    return (await this.database.query('SELECT user_id, password_hash, is_active FROM cpanel_user_auth WHERE email = $1', [email])).rows[0];
  }
  async user(id: string): Promise<CpanelUser | undefined> {
    return (await this.database.query('SELECT id, name, phone, job, avatar_url FROM cpanel_users WHERE id = $1', [id])).rows[0];
  }
  async email(id: string): Promise<string> {
    return (await this.database.query('SELECT email FROM cpanel_user_auth WHERE user_id = $1', [id])).rows[0]?.email ?? '';
  }
  async permissions(id: string): Promise<Map<string, unknown>> {
    const { rows } = await this.database.query('SELECT key, value FROM cpanel_user_permissions WHERE user_id = $1', [id]);
    return new Map(rows.map(row => [row.key, row.value]));
  }
}
export const authRepository = new AuthRepository();

import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { pool } from '../../database/pool.js';

export interface CpanelSession { token_hash: string; user_id: string | null; csrf_token: string; expires_at: Date }
export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');
export class SessionRepository {
  constructor(private readonly database: Pool = pool) {}
  async find(token: string): Promise<CpanelSession | undefined> {
    if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
    return (await this.database.query('SELECT s.token_hash,s.user_id,s.csrf_token,s.expires_at FROM cpanel_sessions s LEFT JOIN cpanel_user_auth a ON a.user_id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND (s.user_id IS NULL OR a.is_active=true)', [tokenHash(token)])).rows[0];
  }
  async create(userId: string | null = null, previousHash?: string, verifiedHash?: string): Promise<{ token: string; session: CpanelSession }> {
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      if (userId) {
        const auth = (await client.query('SELECT password_hash,is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
        if (!auth || !auth.is_active || (verifiedHash !== undefined && auth.password_hash !== verifiedHash)) throw new Error('Credentials changed; retry sign-in.');
      }
      await client.query('DELETE FROM cpanel_sessions WHERE expires_at <= now()');
      if (previousHash) {
        const deleted = await client.query('DELETE FROM cpanel_sessions WHERE token_hash=$1 RETURNING token_hash', [previousHash]);
        if (deleted.rowCount !== 1) throw new Error('Session expired or was invalidated; retry sign-in.');
      }
      const { rows: [session] } = await client.query(`INSERT INTO cpanel_sessions(token_hash,user_id,csrf_token,expires_at)
        VALUES($1,$2,$3,now()+$4::interval) RETURNING token_hash,user_id,csrf_token,expires_at`,
      [tokenHash(token), userId, csrf, userId ? '8 hours' : '20 minutes']);
      await client.query('COMMIT');
      return { token, session };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async destroy(hash: string): Promise<void> { await this.database.query('DELETE FROM cpanel_sessions WHERE token_hash=$1', [hash]); }
}
export const sessions = new SessionRepository();

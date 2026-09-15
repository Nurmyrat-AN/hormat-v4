import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool.js';

export class PasswordChangeRepository {
  constructor(private readonly database: Pool = pool) {}
  async change(userId: string, sessionHash: string, operation: (hash: string) => Promise<string | undefined>): Promise<boolean> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      // Same auth-row-first ordering as login session creation; serializes concurrent changes/logins.
      const auth = (await client.query('SELECT password_hash FROM cpanel_user_auth WHERE user_id=$1 AND is_active=true FOR UPDATE', [userId])).rows[0];
      const session = await client.query('SELECT token_hash FROM cpanel_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() FOR UPDATE', [sessionHash, userId]);
      if (!auth || !session.rowCount) throw new Error('Authentication context is no longer valid');
      const nextHash = await operation(auth.password_hash);
      if (!nextHash) { await client.query('ROLLBACK'); return false; }
      await this.replace(client, userId, sessionHash, nextHash);
      await client.query('COMMIT');
      return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async replace(client: PoolClient, userId: string, sessionHash: string, hash: string): Promise<void> {
    await client.query('UPDATE cpanel_user_auth SET password_hash=$1 WHERE user_id=$2', [hash, userId]);
    await client.query('DELETE FROM cpanel_sessions WHERE user_id=$1 AND token_hash<>$2', [userId, sessionHash]);
  }
}

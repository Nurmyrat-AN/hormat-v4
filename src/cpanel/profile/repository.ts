import type { Pool } from 'pg';
import { pool } from '../../database/pool.js';

/** A lost COMMIT acknowledgement must not trigger deletion of possibly committed media. */
export class ProfileTransactionError extends Error {
  constructor(readonly outcomeUnknown: boolean) { super('Profile transaction failed'); }
}
export class ProfileRepository {
  constructor(private readonly database: Pool = pool) {}
  async update(userId: string, sessionHash: string, name: string, phone: string | null,
    avatar: (oldUrl: string | null) => Promise<string | null>): Promise<void> {
    const client = await this.database.connect();
    let committing = false;
    try {
      await client.query('BEGIN');
      // Keep the authentication/session lock order used by password changes.
      const auth = await client.query('SELECT user_id FROM cpanel_user_auth WHERE user_id=$1 AND is_active=true FOR UPDATE', [userId]);
      const session = await client.query('SELECT token_hash FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE', [userId, sessionHash]);
      if (!auth.rowCount || !session.rowCount) throw new Error('Invalid authentication context');
      const user = (await client.query('SELECT avatar_url FROM cpanel_users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
      if (!user) throw new Error('Missing profile');
      const url = await avatar(user.avatar_url);
      await client.query('UPDATE cpanel_users SET name=$1,phone=$2,avatar_url=$3 WHERE id=$4', [name, phone, url, userId]);
      committing = true;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (committing) throw new ProfileTransactionError(true);
      throw error;
    } finally { client.release(); }
  }
}

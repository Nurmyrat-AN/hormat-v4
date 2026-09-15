import type { Pool } from 'pg';
import { pool } from '../../database/pool.js';
import { PermissionsError } from './errors.js';
export interface PermissionActor { id: string; sessionHash: string }

export class PermissionsRepository {
  constructor(readonly database: Pool = pool) {}
  async save(actor: PermissionActor, targetId: string, managed: string[], granted: string[]) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      // Shared lock order/protocol with Users, login and profile transactions.
      const accounts = await client.query('SELECT user_id,is_active FROM cpanel_user_auth WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE', [[actor.id,targetId]]);
      const session = await client.query('SELECT token_hash FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
      if (!accounts.rows.some(row => row.user_id === actor.id && row.is_active === true) || !session.rowCount) throw new PermissionsError('forbidden',403);
      const actorPermissions = await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id]);
      if (!actorPermissions.rows.some(row => ['superuser','permissions.update'].includes(row.key) && row.value === true)) throw new PermissionsError('forbidden',403);
      if (!accounts.rows.some(row => row.user_id === targetId)) throw new PermissionsError('notFound',404);
      const targetPermissions = await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR UPDATE',[targetId]);
      if (targetPermissions.rows.some(row => row.key === 'superuser' && row.value === true)) throw new PermissionsError('protected',403);
      if (actor.id === targetId) throw new PermissionsError('selfEdit',403);
      await client.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key=ANY($2::text[]) AND NOT(key=ANY($3::text[]))',[targetId,managed,granted]);
      await client.query(`INSERT INTO cpanel_user_permissions(user_id,key,value)
        SELECT $1,key,'true'::jsonb FROM unnest($2::text[]) AS key
        ON CONFLICT(user_id,key) DO UPDATE SET value='true'::jsonb
        WHERE cpanel_user_permissions.value IS DISTINCT FROM 'true'::jsonb`,[targetId,granted]);
      await client.query('COMMIT');
    } catch(error) {
      await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    } finally { client.release(); }
  }
}

import { pool } from '../../database/pool.js';
import { UsersRepository, type UserRow } from '../users/repository.js';
import { userView } from '../users/presentation.js';
import { booleanPermissionKeys } from './definitions.js';

// Only SELECTs: opening the preview never creates missing assignments.
export async function permissionUsers(query: string, status: 'active'|'inactive'|'all', page: number) {
  const client = await pool.connect();
  try {
    const result = await new UsersRepository().list(client, { query, status, page, field: 'all' });
    const counts = await client.query<{user_id:string; count:string}>(
      `SELECT user_id,count(*) FROM cpanel_user_permissions WHERE user_id=ANY($1::bigint[])
       AND key=ANY($2::text[]) AND value='true'::jsonb GROUP BY user_id`,
      [result.rows.map(row => row.id), booleanPermissionKeys]);
    return { ...result, rows: result.rows.map(row => ({ ...userView(row), count: Number(counts.rows.find(count => count.user_id === row.id)?.count ?? 0) })) };
  } finally { client.release(); }
}

export async function permissionUser(id: string) {
  const result = await pool.query<UserRow & { granted: string[] }>(
    `SELECT u.id,u.name,u.phone,u.job,u.avatar_url,a.email,a.is_active,
     EXISTS(SELECT 1 FROM cpanel_user_permissions p WHERE p.user_id=u.id AND p.key='superuser' AND p.value='true'::jsonb) AS protected,
     ARRAY(SELECT p.key FROM cpanel_user_permissions p WHERE p.user_id=u.id AND p.key=ANY($2::text[]) AND p.value='true'::jsonb) AS granted
     FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1`, [id, booleanPermissionKeys]);
  const row = result.rows[0];
  return row ? { user: userView(row), granted: row.granted } : undefined;
}

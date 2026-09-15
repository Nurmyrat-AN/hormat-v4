import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool.js';
import { UsersError, UsersCommitError } from './errors.js';
export interface Actor { id: string; sessionHash: string }
export interface UserRow { id: string; name: string; phone: string | null; job: string | null; avatar_url: string | null; email: string; is_active: boolean; protected: boolean }
export interface Search { query: string; field: 'name'|'email'|'phone'|'job'|'all'; status: 'active'|'inactive'|'all'; page: number }
const columns = { name:'u.name', email:'a.email', phone:'u.phone', job:'u.job' };
const select = `u.id,u.name,u.phone,u.job,u.avatar_url,a.email,a.is_active,
 EXISTS(SELECT 1 FROM cpanel_user_permissions p WHERE p.user_id=u.id AND p.key='superuser' AND p.value='true'::jsonb) AS protected`;
export class UsersRepository {
  constructor(readonly database: Pool = pool) {}
  /** All domain operations independently revalidate the session, actor permission and protected target. */
  async authorized<T>(actor: Actor, permission: string, targetId: string | undefined, operation: (client: PoolClient, target?: UserRow) => Promise<T>): Promise<T> {
    const client=await this.database.connect();let committing=false;
    try {
      await client.query('BEGIN');
      // Lock both accounts in ID order. Compatible with login/profile auth-before-session ordering.
      const ids=targetId?[actor.id,targetId]:[actor.id];
      const auth=await client.query('SELECT user_id,is_active FROM cpanel_user_auth WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[ids]);
      const actorAuth=auth.rows.find(row=>String(row.user_id)===actor.id);
      const session=await client.query('SELECT token_hash FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
      if(!actorAuth?.is_active||!session.rowCount)throw new UsersError('forbidden',403);
      const permissions=await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id]);
      if(!permissions.rows.some(row=>(row.key==='superuser'||row.key===permission)&&row.value===true))throw new UsersError('forbidden',403);
      let target: UserRow|undefined;
      if(targetId){
        target=(await client.query<UserRow>(`SELECT ${select} FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u`,[targetId])).rows[0];
        if(!target)throw new UsersError('notFound',404);
        // Lock existing permission rows so concurrent edits to their values cannot cross this operation.
        const targetPermissions=await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[targetId]);
        if(targetPermissions.rows.some(row=>row.key==='superuser'&&row.value===true))throw new UsersError('protected',403);
      }
      const result=await operation(client,target);
      committing=true;await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK').catch(()=>undefined);if(committing)throw new UsersCommitError('Commit outcome unknown');throw error;}
    finally{client.release();}
  }
  async list(client: PoolClient, search: Search) {
    const searchColumns=search.field==='all'?Object.values(columns):[columns[search.field]];
    const pattern='%'+search.query.replace(/[\\%_]/g,'\\$&')+'%';
    const where=`($1::boolean IS NULL OR a.is_active=$1) AND (${searchColumns.map(column=>`${column} ILIKE $2`).join(' OR ')})`;
    const values=[search.status==='all'?null:search.status==='active',pattern];
    const total=Number((await client.query(`SELECT count(*) FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE ${where}`,values)).rows[0].count);
    const page=Math.min(search.page,Math.max(1,Math.ceil(total/9)));
    const rows=(await client.query<UserRow>(`SELECT ${select} FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE ${where} ORDER BY u.id LIMIT 9 OFFSET $3`,[...values,(page-1)*9])).rows;
    return {rows,total,page,pageSize:9};
  }
  async create(client:PoolClient, fields:{name:string;phone:string|null;job:string|null;email:string;hash:string;active:boolean;avatar:string|null}) {
    const id=String((await client.query('INSERT INTO cpanel_users(name,phone,job,avatar_url) VALUES($1,$2,$3,$4) RETURNING id',[fields.name,fields.phone,fields.job,fields.avatar])).rows[0].id);
    await client.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash,is_active) VALUES($1,$2,$3,$4)',[id,fields.email,fields.hash,fields.active]);return id;
  }
  async update(client:PoolClient,id:string,fields:{name:string;phone:string|null;job:string|null;email:string;avatar:string|null}) {
    await client.query('UPDATE cpanel_users SET name=$1,phone=$2,job=$3,avatar_url=$4 WHERE id=$5',[fields.name,fields.phone,fields.job,fields.avatar,id]);
    await client.query('UPDATE cpanel_user_auth SET email=$1 WHERE user_id=$2',[fields.email,id]);
  }
  async status(client:PoolClient,id:string,active:boolean) {
    await client.query('UPDATE cpanel_user_auth SET is_active=$1 WHERE user_id=$2',[active,id]);
    if(!active)await client.query('DELETE FROM cpanel_sessions WHERE user_id=$1',[id]);
  }
  async password(client:PoolClient,id:string,hash:string) {
    await client.query('UPDATE cpanel_user_auth SET password_hash=$1 WHERE user_id=$2',[hash,id]);
    await client.query('DELETE FROM cpanel_sessions WHERE user_id=$1',[id]);
  }
}

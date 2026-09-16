import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
export class VendorError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export interface VendorActor {id:string;sessionHash:string}
export interface VendorRow {id:string;name:string;url:string;username:string;passwordConfigured:boolean;is_active:boolean;last_sequence:string|null;date_last_sync:Date|null;date_last_operation:Date|null;created_at:Date;updated_at:Date}
export interface VendorSearch {query:string;field:'name'|'url'|'username'|'all';status:'active'|'inactive'|'all';page:number}
const projection=`id,name,url,username,(password_encrypted IS NOT NULL AND password_encrypted <> '') AS "passwordConfigured",is_active,last_sequence,date_last_sync,date_last_operation,created_at,updated_at`;
const columns={name:'name',url:'url',username:'username'};
export class VendorsRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:VendorActor,permission:string,operation:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new VendorError('VENDOR_FORBIDDEN',403);
   const permissions=await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id]);
   if(!permissions.rows.some(p=>(p.key==='superuser'||p.key===permission)&&p.value===true))throw new VendorError('VENDOR_FORBIDDEN',403);
   const result=await operation(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async list(client:PoolClient,search:VendorSearch){
  const fields=search.field==='all'?Object.values(columns):[columns[search.field]];
  const where=`($1::boolean IS NULL OR is_active=$1) AND (${fields.map(f=>`${f} ILIKE $2`).join(' OR ')})`;
  const values=[search.status==='all'?null:search.status==='active','%'+search.query.replace(/[\\%_]/g,'\\$&')+'%'];
  const total=Number((await client.query(`SELECT count(*) FROM vendors WHERE ${where}`,values)).rows[0].count);
  const page=Math.min(search.page,Math.max(1,Math.ceil(total/9)));
  const rows=(await client.query<VendorRow>(`SELECT ${projection} FROM vendors WHERE ${where} ORDER BY id LIMIT 9 OFFSET $3`,[...values,(page-1)*9])).rows;
  return {rows,total,page,pageSize:9};
 }
 async get(client:PoolClient,id:string,lock=false){const row=(await client.query<VendorRow>(`SELECT ${projection} FROM vendors WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new VendorError('VENDOR_NOT_FOUND',404);return row;}
 async create(client:PoolClient,data:{name:string;url:string;username:string;encrypted:string;active:boolean}){
  return (await client.query<VendorRow>(`INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES($1,$2,$3,$4,$5) RETURNING ${projection}`,[data.name,data.url,data.username,data.encrypted,data.active])).rows[0];
 }
 async update(client:PoolClient,id:string,data:{name:string;url:string;username:string;encrypted:string|null}){
  await client.query('UPDATE vendors SET name=$1,url=$2,username=$3,password_encrypted=COALESCE($4,password_encrypted) WHERE id=$5',[data.name,data.url,data.username,data.encrypted,id]);return this.get(client,id);
 }
 async status(client:PoolClient,id:string,active:boolean){await client.query('UPDATE vendors SET is_active=$1 WHERE id=$2',[active,id]);return this.get(client,id);}
}

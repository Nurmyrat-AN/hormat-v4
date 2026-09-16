import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {LanguageError} from './validation.js';
export interface LanguageActor {id:string;sessionHash:string}
export interface LanguageRecord {code:string;display_name:string;sort_order:number;is_active:boolean;is_default:boolean;translation_count:number}
export class LanguagesRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:LanguageActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new LanguageError('LANGUAGE_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new LanguageError('LANGUAGE_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 } async lockRegistry(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(4840,2)');}
 async list(client:PoolClient,query:string,status:boolean|null){return (await client.query<LanguageRecord>(`
 SELECT l.code,l.display_name,l.sort_order,l.is_active,l.is_default,count(t.translation_key) FILTER (WHERE btrim(t.translation_value)<>'')::int AS translation_count
 FROM languages l LEFT JOIN interface_translations t ON t.language_code=l.code
 WHERE (l.code ILIKE $1 OR l.display_name ILIKE $1) AND ($2::boolean IS NULL OR l.is_active=$2)
 GROUP BY l.code ORDER BY l.sort_order,l.code`,['%'+query.replace(/[\\%_]/g,'\\$&')+'%',status])).rows;}
 async get(client:PoolClient,code:string){const row=(await client.query<LanguageRecord>('SELECT l.code,l.display_name,l.sort_order,l.is_active,l.is_default,(SELECT count(*)::int FROM interface_translations t WHERE t.language_code=l.code AND length(btrim(t.translation_value))>0) AS translation_count FROM languages l WHERE l.code=$1',[code])).rows[0];if(!row)throw new LanguageError('LANGUAGE_NOT_FOUND',404);return row;}
 async create(client:PoolClient,code:string,name:string,sort:number){await client.query('INSERT INTO languages(code,display_name,sort_order,is_active,is_default) VALUES($1,$2,$3,false,false)',[code,name,sort]);}
 async basic(client:PoolClient,row:LanguageRecord){await client.query('UPDATE languages SET display_name=$2,sort_order=$3 WHERE code=$1',[row.code,row.display_name,row.sort_order]);}
 async status(client:PoolClient,code:string,active:boolean){await client.query('UPDATE languages SET is_active=$2 WHERE code=$1',[code,active]);}
 async readyForDefault(client:PoolClient,code:string){
  const result=await client.query(`SELECT count(*)::int AS missing FROM interface_translations source
   JOIN languages current ON current.code=source.language_code AND current.is_default
   WHERE NOT EXISTS(SELECT 1 FROM interface_translations target WHERE target.language_code=$1 AND target.translation_key=source.translation_key
    AND btrim(target.translation_value)<>'' AND target.translation_value<>target.translation_key)`,[code]);
  if(result.rows[0].missing>0)throw new LanguageError('LANGUAGE_TRANSLATIONS_INCOMPLETE',409);
 }
 async setDefault(client:PoolClient,code:string){await client.query('UPDATE languages SET is_default=false WHERE is_default AND code<>$1',[code]);await client.query('UPDATE languages SET is_default=true,is_active=true WHERE code=$1',[code]);}
}

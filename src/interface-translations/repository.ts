import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {TranslationError} from './validation.js';
export interface TranslationActor {id:string;sessionHash:string}
export class TranslationRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:TranslationActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new TranslationError('TRANSLATION_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new TranslationError('TRANSLATION_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async catalog(client:PoolClient){
  const languages=(await client.query<{code:string;display_name:string;is_default:boolean}>('SELECT code,display_name,is_default FROM languages WHERE is_active ORDER BY sort_order,code')).rows;
  const rows=(await client.query<{key:string;values:Record<string,string|null>}>(`SELECT translation_key AS key,jsonb_object_agg(language_code,translation_value) AS values FROM interface_translations GROUP BY translation_key ORDER BY translation_key COLLATE "C"`)).rows;
  return {languages,rows};
 }
 async lock(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(4840,2)');}
 async save(client:PoolClient,key:string,values:Record<string,string|null>){
  for(const [language,value] of Object.entries(values))await client.query(`INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES($1,$2,$3) ON CONFLICT(language_code,translation_key) DO UPDATE SET translation_value=EXCLUDED.translation_value`,[language,key,value]);
 }
}

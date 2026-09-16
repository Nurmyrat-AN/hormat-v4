import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
export class DiscountError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export interface DiscountActor {id:string;sessionHash:string}
export interface DiscountRecord {id:string;name:string;priority:number;starts_at:Date|null;ends_at:Date|null;before_action:string;before_value:string|null;after_action:string;after_value:string|null;is_visible:boolean;is_visible_on_product:boolean}
export class DiscountsRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:DiscountActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new DiscountError('DISCOUNT_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new DiscountError('DISCOUNT_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }

 async get(client:PoolClient,id:string,lock=false){const row=(await client.query<DiscountRecord>(`SELECT * FROM discounts WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new DiscountError('DISCOUNT_NOT_FOUND',404);return row;}
 async languages(client:PoolClient){return (await client.query('SELECT code,display_name,is_default FROM languages WHERE is_active ORDER BY sort_order,code')).rows;}
 async translations(client:PoolClient,ids:string[]){return (await client.query('SELECT t.discount_id::text,t.language_code,t.name FROM discount_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE t.discount_id=ANY($1::bigint[])',[ids])).rows;}
 async counts(client:PoolClient,ids:string[]){return new Map((await client.query('SELECT discount_id::text,count(*)::int AS count FROM product_discounts WHERE discount_id=ANY($1::bigint[]) GROUP BY discount_id',[ids])).rows.map(row=>[row.discount_id,row.count as number]));}
 async create(client:PoolClient,name:string,priority:number,actor:string){return (await client.query<DiscountRecord>('INSERT INTO discounts(name,priority,created_by,updated_by) VALUES($1,$2,$3,$3) RETURNING *',[name,priority,actor])).rows[0];}
 async basic(client:PoolClient,row:DiscountRecord,actor:string){await client.query('UPDATE discounts SET name=$2,priority=$3,starts_at=$4,ends_at=$5,is_visible=$6,is_visible_on_product=$7,updated_by=$8 WHERE id=$1',[row.id,row.name,row.priority,row.starts_at,row.ends_at,row.is_visible,row.is_visible_on_product,actor]);}
 async rules(client:PoolClient,row:DiscountRecord,actor:string){await client.query('UPDATE discounts SET before_action=$2,before_value=$3,after_action=$4,after_value=$5,updated_by=$6 WHERE id=$1',[row.id,row.before_action,row.before_value,row.after_action,row.after_value,actor]);}
 async saveTranslations(client:PoolClient,id:string,values:string[][],actor:string){
  for(const [code,value] of values){if(value)await client.query('INSERT INTO discount_translations(discount_id,language_code,name) VALUES($1,$2,$3) ON CONFLICT(discount_id,language_code) DO UPDATE SET name=excluded.name',[id,code,value]);else await client.query('DELETE FROM discount_translations WHERE discount_id=$1 AND language_code=$2',[id,code]);}
  await client.query('UPDATE discounts SET updated_by=$2 WHERE id=$1',[id,actor]);
 }
 async list(client:PoolClient,query:string,visible:boolean|null,page:number){
  const values=['%'+query.replace(/[\\%_]/g,'\\$&')+'%',visible],where='name ILIKE $1 AND ($2::boolean IS NULL OR is_visible=$2)';
  const total=Number((await client.query(`SELECT count(*) FROM discounts WHERE ${where}`,values)).rows[0].count);page=Math.min(page,Math.max(1,Math.ceil(total/9)));
  const rows=(await client.query<DiscountRecord>(`SELECT * FROM discounts WHERE ${where} ORDER BY id DESC LIMIT 9 OFFSET $3`,[...values,(page-1)*9])).rows;
  return {rows,total,page,pageSize:9};
 }
}

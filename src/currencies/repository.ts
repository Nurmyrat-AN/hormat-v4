import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {CurrencyError} from './validation.js';
export interface CurrencyActor {id:string;sessionHash:string}
export interface FrontendCurrency {id:string;name:string;code:string;symbol:string;rate:string|null;is_visible:boolean;sort_order:number}
export interface VendorCurrency {id:string;vendor_id:string;vendor_name:string;source_id:string;name:string;rate:string|null}
const pattern=(query:string)=>'%'+query.replace(/[\\%_]/g,'\\$&')+'%';
export class CurrenciesRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:CurrencyActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new CurrencyError('CURRENCY_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new CurrencyError('CURRENCY_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async get(client:PoolClient,id:string,lock=false){const row=(await client.query<FrontendCurrency>(`SELECT id::text,name,code,symbol,rate,is_visible,sort_order FROM frontend_currencies WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new CurrencyError('CURRENCY_NOT_FOUND',404);return row;}
 async languages(client:PoolClient){return (await client.query('SELECT code FROM languages WHERE is_active')).rows.map(r=>r.code as string);}
 async translations(client:PoolClient,ids:string[]){return (await client.query<{frontend_currency_id:string;language_code:string;name:string}>('SELECT t.frontend_currency_id::text,t.language_code,t.name FROM frontend_currency_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE t.frontend_currency_id=ANY($1::bigint[])',[ids])).rows;}
 async list(client:PoolClient,query:string,visible:boolean|null,page:number){
  const values=[pattern(query),visible],where="(name ILIKE $1 OR code ILIKE $1 OR symbol ILIKE $1) AND ($2::boolean IS NULL OR is_visible=$2)";
  const total=Number((await client.query(`SELECT count(*) FROM frontend_currencies WHERE ${where}`,values)).rows[0].count);page=Math.min(page,Math.max(1,Math.ceil(total/50)));
  const rows=(await client.query<FrontendCurrency>(`SELECT id::text,name,code,symbol,rate,is_visible,sort_order FROM frontend_currencies WHERE ${where} ORDER BY sort_order,id LIMIT 50 OFFSET $3`,[...values,(page-1)*50])).rows;
  return {rows,total,page,pageSize:50};
 }
 async create(client:PoolClient,row:Omit<FrontendCurrency,'id'|'is_visible'>,actor:string){const id=(await client.query('INSERT INTO frontend_currencies(name,code,symbol,rate,sort_order,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id::text',[row.name,row.code,row.symbol,row.rate,row.sort_order,actor])).rows[0].id;return this.get(client,id);}
 async basic(client:PoolClient,row:FrontendCurrency,actor:string){await client.query('UPDATE frontend_currencies SET name=$2,code=$3,symbol=$4,rate=$5,sort_order=$6,is_visible=$7,updated_by=$8 WHERE id=$1',[row.id,row.name,row.code,row.symbol,row.rate,row.sort_order,row.is_visible,actor]);}
 async saveTranslations(client:PoolClient,id:string,values:string[][],actor:string){
  for(const [code,name] of values){if(name)await client.query('INSERT INTO frontend_currency_translations(frontend_currency_id,language_code,name) VALUES($1,$2,$3) ON CONFLICT(frontend_currency_id,language_code) DO UPDATE SET name=excluded.name',[id,code,name]);else await client.query('DELETE FROM frontend_currency_translations WHERE frontend_currency_id=$1 AND language_code=$2',[id,code]);}
  await client.query('UPDATE frontend_currencies SET updated_by=$2 WHERE id=$1',[id,actor]);
 }
 async vendorList(client:PoolClient,query:string,page:number){
  const where="(v.name||'.'||c.name) ILIKE $1",value=pattern(query);
  const total=Number((await client.query(`SELECT count(*) FROM currencies c JOIN vendors v ON v.id=c.vendor_id WHERE ${where}`,[value])).rows[0].count);page=Math.min(page,Math.max(1,Math.ceil(total/50)));
  const currencies=(await client.query<VendorCurrency>(`SELECT c.id::text,c.source_id,c.name,v.id::text AS vendor_id,v.name AS vendor_name,r.rate FROM currencies c JOIN vendors v ON v.id=c.vendor_id LEFT JOIN vendor_currency_rates r ON r.vendor_id=c.vendor_id AND r.currency_id=c.id WHERE ${where} ORDER BY v.name,c.name,c.id LIMIT 50 OFFSET $2`,[value,(page-1)*50])).rows;
  return {currencies,total,page,pageSize:50};
 }
 async vendorGet(client:PoolClient,vendor:string,currency:string,lock=false){
  if(lock){const result=await client.query('SELECT id FROM currencies WHERE vendor_id=$1 AND id=$2 FOR UPDATE',[vendor,currency]);if(!result.rowCount)throw new CurrencyError('CURRENCY_NOT_FOUND',404);}
  const row=(await client.query<VendorCurrency>('SELECT c.id::text,c.source_id,c.name,c.vendor_id::text,v.name AS vendor_name,r.rate FROM currencies c JOIN vendors v ON v.id=c.vendor_id LEFT JOIN vendor_currency_rates r ON r.vendor_id=c.vendor_id AND r.currency_id=c.id WHERE c.vendor_id=$1 AND c.id=$2',[vendor,currency])).rows[0];if(!row)throw new CurrencyError('CURRENCY_NOT_FOUND',404);return row;
 }
 async vendorRate(client:PoolClient,vendor:string,currency:string,rate:string|null,actor:string){
  if(rate===null)await client.query('DELETE FROM vendor_currency_rates WHERE vendor_id=$1 AND currency_id=$2',[vendor,currency]);
  else await client.query('INSERT INTO vendor_currency_rates(vendor_id,currency_id,rate,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(currency_id) DO UPDATE SET rate=excluded.rate,updated_by=excluded.updated_by',[vendor,currency,rate,actor]);
 }
}

import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
export class BrandError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export interface BrandActor {id:string;sessionHash:string}
export interface BrandRecord {id:string;name:string;slug:string;seo_title:string;seo_description:string;main_media_reference:string|null;is_visible:boolean;created_by:string|null;updated_by:string|null;created_at:Date;updated_at:Date}
export class BrandsRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:BrandActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new BrandError('BRAND_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new BrandError('BRAND_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async get(client:PoolClient,id:string,lock=false){const row=(await client.query<BrandRecord>(`SELECT * FROM brands WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new BrandError('BRAND_NOT_FOUND',404);return row;}
 async languages(client:PoolClient){return (await client.query('SELECT code,display_name,is_default FROM languages WHERE is_active ORDER BY sort_order,code')).rows;}
 async list(client:PoolClient,query:string,visibility:boolean|null,page:number){
  const values=[visibility,'%'+query.replace(/[\\%_]/g,'\\$&')+'%'];
  const where='($1::boolean IS NULL OR is_visible=$1) AND name ILIKE $2';
  const total=Number((await client.query(`SELECT count(*) FROM brands WHERE ${where}`,values)).rows[0].count);
  page=Math.min(page,Math.max(1,Math.ceil(total/9)));
  const rows=(await client.query<BrandRecord>(`SELECT * FROM brands WHERE ${where} ORDER BY id DESC LIMIT 9 OFFSET $3`,[...values,(page-1)*9])).rows;
  return {rows,total,page,pageSize:9};
 }
 async translations(client:PoolClient,id:string){return (await client.query('SELECT t.language_code,t.name,t.seo_title,t.seo_description FROM brand_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE t.brand_id=$1 ORDER BY t.language_code',[id])).rows;}
 async gallery(client:PoolClient,id:string):Promise<string[]>{return (await client.query('SELECT media_reference FROM brand_media WHERE brand_id=$1 ORDER BY sort_order,media_reference',[id])).rows.map(row=>row.media_reference);}
 async create(client:PoolClient,name:string,actor:string){return (await client.query<BrandRecord>('INSERT INTO brands(name,created_by,updated_by,slug) VALUES($1,$2,$2,$3) RETURNING *',[name,actor,'brand-'+randomUUID()])).rows[0];}
 async basic(client:PoolClient,id:string,name:string,main:string|null,visible:boolean,actor:string){await client.query('UPDATE brands SET name=$2,main_media_reference=$3,is_visible=$4,updated_by=$5 WHERE id=$1',[id,name,main,visible,actor]);}
 async seo(client:PoolClient,id:string,slug:string,title:string,description:string,actor:string){await client.query('UPDATE brands SET slug=$2,seo_title=$3,seo_description=$4,updated_by=$5 WHERE id=$1',[id,slug,title,description,actor]);}
 async productCount(client:PoolClient,id:string){return Number((await client.query('SELECT count(*) FROM products WHERE brand_id=$1',[id])).rows[0].count);}
 async saveTranslations(client:PoolClient,id:string,values:string[][],field:'name'|'seo_title'|'seo_description'='name'){
  // Field is service-allowlisted; identifiers never come directly from a request.
  for(const [code,value] of values){
   await client.query(`INSERT INTO brand_translations(brand_id,language_code,${field}) VALUES($1,$2,$3) ON CONFLICT(brand_id,language_code) DO UPDATE SET ${field}=excluded.${field}`,[id,code,value||null]);
   await client.query('DELETE FROM brand_translations WHERE brand_id=$1 AND language_code=$2 AND name IS NULL AND seo_title IS NULL AND seo_description IS NULL',[id,code]);
  }
 }
 async saveGallery(client:PoolClient,id:string,items:string[]){
  await client.query('DELETE FROM brand_media WHERE brand_id=$1 AND NOT(media_reference=ANY($2::text[]))',[id,items]);
  for(const [index,path] of items.entries())await client.query('INSERT INTO brand_media(brand_id,media_reference,sort_order) VALUES($1,$2,$3) ON CONFLICT(brand_id,media_reference) DO UPDATE SET sort_order=excluded.sort_order',[id,path,index]);
 }
 async touch(client:PoolClient,id:string,actor:string){await client.query('UPDATE brands SET updated_by=$2 WHERE id=$1',[id,actor]);}
}

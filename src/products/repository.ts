import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {ProductError,type ProductActor,type TranslationField} from './validation.js';
export class ProductsRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:ProductActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new ProductError('PRODUCT_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new ProductError('PRODUCT_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async get(db:PoolClient,id:string,lock=false){const row=(await db.query(`SELECT * FROM products WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new ProductError('PRODUCT_NOT_FOUND',404);return row;}
 async source(db:PoolClient,id:string){const row=(await db.query(`SELECT s.id::text,s.name,s.price::text,s.is_active AS active,v.name AS vendor,v.is_active AS "vendorActive",c.name AS currency,r.rate::text,
 COALESCE((SELECT sum(stock) FROM product_stocks WHERE product_id=s.id AND vendor_id=s.vendor_id),0)::text AS stock,
 (COALESCE((SELECT sum(stock) FROM product_stocks WHERE product_id=s.id AND vendor_id=s.vendor_id),0)>0) AS "inStock"
 FROM source_products s JOIN vendors v ON v.id=s.vendor_id LEFT JOIN currencies c ON c.id=s.currency_id AND c.vendor_id=s.vendor_id LEFT JOIN vendor_currency_rates r ON r.currency_id=c.id AND r.vendor_id=s.vendor_id WHERE s.id=$1`,[id])).rows[0];if(!row)throw new ProductError('PRODUCT_INVALID_SOURCE');return row;}
 async create(db:PoolClient,source:string,name:string,brand:string|null,category:string|null,actor:string){return (await db.query('INSERT INTO products(source_product_id,name,brand_id,category_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5) RETURNING *',[source,name,brand,category,actor])).rows[0];}
 async update(db:PoolClient,target:string,fields:Record<string,unknown>,actor:string){
  // Callers construct this map exclusively from operation-specific server allowlists.
  const entries=Object.entries(fields).filter(([key])=>key!=='updated_by');
  await db.query(`UPDATE products SET ${entries.map(([key],i)=>key+'=$'+(i+3)+',').join('')}updated_by=$2 WHERE id=$1`,[target,actor,...entries.map(([,value])=>value)]);
 }
 async languages(db:PoolClient){return (await db.query('SELECT code FROM languages WHERE is_active')).rows.map(r=>r.code as string);}
 async translations(db:PoolClient,id:string){return (await db.query('SELECT t.* FROM product_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE product_id=$1',[id])).rows;}
 async saveTranslations(db:PoolClient,id:string,field:TranslationField,values:Record<string,string|null>){for(const [code,value]of Object.entries(values)){await db.query(`INSERT INTO product_translations(product_id,language_code,${field}) VALUES($1,$2,$3) ON CONFLICT(product_id,language_code) DO UPDATE SET ${field}=excluded.${field}`,[id,code,value]);await db.query('DELETE FROM product_translations WHERE product_id=$1 AND language_code=$2 AND name IS NULL AND seo_title IS NULL AND seo_description IS NULL AND short_description IS NULL AND description_html IS NULL',[id,code]);}}
 async gallery(db:PoolClient,id:string){return (await db.query('SELECT media_reference AS path,is_primary AS primary FROM product_media WHERE product_id=$1 ORDER BY sort_order,media_reference',[id])).rows as {path:string;primary:boolean}[];}
 async saveGallery(db:PoolClient,id:string,items:{path:string;primary:boolean}[]){await db.query('UPDATE product_media SET is_primary=false WHERE product_id=$1 AND is_primary',[id]);await db.query('DELETE FROM product_media WHERE product_id=$1 AND NOT(media_reference=ANY($2::text[]))',[id,items.map(i=>i.path)]);for(const [order,item]of items.entries())await db.query('INSERT INTO product_media(product_id,media_reference,sort_order,is_primary) VALUES($1,$2,$3,$4) ON CONFLICT(product_id,media_reference) DO UPDATE SET sort_order=excluded.sort_order,is_primary=excluded.is_primary',[id,item.path,order,item.primary]);}
 async discounts(db:PoolClient,id:string){return (await db.query('SELECT d.id,d.name,d.priority,d.before_action,d.before_value,d.after_action,d.after_value,d.starts_at,d.ends_at,d.is_visible,d.is_visible_on_product FROM discounts d JOIN product_discounts p ON p.discount_id=d.id WHERE p.product_id=$1 ORDER BY d.priority DESC,d.id',[id])).rows;}
 async saveDiscounts(db:PoolClient,id:string,ids:string[]){await db.query('DELETE FROM product_discounts WHERE product_id=$1 AND NOT(discount_id=ANY($2::bigint[]))',[id,ids]);for(const discount of ids)await db.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,discount]);}
 async forSource(db:PoolClient,source:string,page:number){
  const total=(await db.query('SELECT count(*)::int AS n FROM products WHERE source_product_id=$1',[source])).rows[0].n;
  const rows=(await db.query(`SELECT p.id::text,p.name,p.is_visible,b.name AS brand,c.name AS category,
   (SELECT media_reference FROM product_media WHERE product_id=p.id AND is_primary LIMIT 1) AS image
   FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
   WHERE p.source_product_id=$1 ORDER BY p.name,p.id LIMIT 20 OFFSET $2`,[source,(page-1)*20])).rows;
  return {rows,total,page,hasMore:page*20<total,nextPage:page*20<total?page+1:null};
 }
 async list(db:PoolClient){return (await db.query('SELECT p.id::text,p.name,p.is_visible,s.name AS source_name,v.name AS vendor FROM products p JOIN source_products s ON s.id=p.source_product_id JOIN vendors v ON v.id=s.vendor_id ORDER BY p.id DESC')).rows;}
 async reference(db:PoolClient,kind:'brands'|'categories',id:string){const row=(await db.query(`SELECT id,is_visible FROM ${kind} WHERE id=$1 FOR SHARE`,[id])).rows[0];if(!row)throw new ProductError();return row;}
 async attachDiscount(db:PoolClient,product:string,discount:string){
  await db.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2)',[product,discount]);
 }
 async detachDiscount(db:PoolClient,product:string,discount:string){
  const result=await db.query('DELETE FROM product_discounts WHERE product_id=$1 AND discount_id=$2',[product,discount]);
  if(!result.rowCount)throw new ProductError('PRODUCT_NOT_FOUND',404);
 }
 async discountLookup(db:PoolClient,product:string,query:string,page:number,selected:string|null){
  const rows=(await db.query(`SELECT d.id,d.name,d.priority,d.is_visible FROM discounts d
   WHERE NOT EXISTS(SELECT 1 FROM product_discounts p WHERE p.product_id=$1 AND p.discount_id=d.id)
   AND (($4::bigint IS NOT NULL AND d.id=$4) OR ($4::bigint IS NULL AND d.name ILIKE $2))
   ORDER BY d.priority DESC,d.id LIMIT 21 OFFSET $3`,[product,'%'+query.replace(/[\\%_]/g,'\\$&')+'%',selected?0:(page-1)*20,selected])).rows;
  return {rows:rows.slice(0,20),hasMore:rows.length>20,nextPage:rows.length>20?page+1:null};
 }
}

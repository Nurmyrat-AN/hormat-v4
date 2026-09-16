import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
export class CategoryError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export interface CategoryActor {id:string;sessionHash:string}
export interface CategoryRecord {id:string;parent_id:string|null;name:string;slug:string;seo_title:string|null;seo_description:string|null;main_media_reference:string|null;is_visible:boolean;created_by:string|null;updated_by:string|null;created_at:Date;updated_at:Date}
export class CategoriesRepository {
 constructor(readonly database:Pool=pool){}
 async authorized<T>(actor:CategoryActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new CategoryError('CATEGORY_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new CategoryError('CATEGORY_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }
 async get(client:PoolClient,id:string,lock=false){const row=(await client.query<CategoryRecord>(`SELECT * FROM categories WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)throw new CategoryError('CATEGORY_NOT_FOUND',404);return row;}
 async languages(client:PoolClient){return (await client.query('SELECT code,display_name,is_default FROM languages WHERE is_active ORDER BY sort_order,code')).rows;}
 async translations(client:PoolClient,id:string){return (await client.query('SELECT t.language_code,t.name,t.seo_title,t.seo_description FROM category_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE t.category_id=$1 ORDER BY t.language_code',[id])).rows;}
 async gallery(client:PoolClient,id:string):Promise<string[]>{return (await client.query('SELECT media_reference FROM category_media WHERE category_id=$1 ORDER BY sort_order,media_reference',[id])).rows.map(row=>row.media_reference);}
 async create(client:PoolClient,name:string,parent:string|null,actor:string){return (await client.query<CategoryRecord>('INSERT INTO categories(name,parent_id,created_by,updated_by,slug) VALUES($1,$2,$3,$3,$4) RETURNING *',[name,parent,actor,'category-'+randomUUID()])).rows[0];}
 async basic(client:PoolClient,id:string,name:string,main:string|null,visible:boolean,parent:string|null,actor:string){await client.query('UPDATE categories SET name=$2,main_media_reference=$3,is_visible=$4,parent_id=$5,updated_by=$6 WHERE id=$1',[id,name,main,visible,parent,actor]);}
 async move(client:PoolClient,id:string,parent:string|null,actor:string){await client.query('UPDATE categories SET parent_id=$2,updated_by=$3 WHERE id=$1',[id,parent,actor]);}
 async seo(client:PoolClient,id:string,slug:string,title:string|null,description:string|null,actor:string){await client.query('UPDATE categories SET slug=$2,seo_title=$3,seo_description=$4,updated_by=$5 WHERE id=$1',[id,slug,title||null,description||null,actor]);}
 async saveTranslations(client:PoolClient,id:string,values:string[][],field:'name'|'seo_title'|'seo_description'='name'){
  // Field is service-allowlisted; identifiers never come directly from a request.
  for(const [code,value] of values){
   await client.query(`INSERT INTO category_translations(category_id,language_code,${field}) VALUES($1,$2,$3) ON CONFLICT(category_id,language_code) DO UPDATE SET ${field}=excluded.${field}`,[id,code,value||null]);
   await client.query('DELETE FROM category_translations WHERE category_id=$1 AND language_code=$2 AND name IS NULL AND seo_title IS NULL AND seo_description IS NULL',[id,code]);
  }
 }
 async saveGallery(client:PoolClient,id:string,items:string[]){
  await client.query('DELETE FROM category_media WHERE category_id=$1 AND NOT(media_reference=ANY($2::text[]))',[id,items]);
  for(const [index,path] of items.entries())await client.query('INSERT INTO category_media(category_id,media_reference,sort_order) VALUES($1,$2,$3) ON CONFLICT(category_id,media_reference) DO UPDATE SET sort_order=excluded.sort_order',[id,path,index]);
 }
 async touch(client:PoolClient,id:string,actor:string){await client.query('UPDATE categories SET updated_by=$2 WHERE id=$1',[id,actor]);}

 // All hierarchy writers take this transaction lock BEFORE reading/locking Category rows.
 // A fresh READ COMMITTED statement after the lock observes the preceding writer's commit.
 async lockHierarchy(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(4840,1)');}
 async validateParent(client:PoolClient,target:string|null,parent:string|null){
  if(parent===null)return;
  const paths=await this.paths(client,[parent]),chain=paths.get(parent);
  if(!chain)throw new CategoryError('CATEGORY_INVALID_PARENT');
  if(chain.some((item: {id:string})=>item.id===target))throw new CategoryError('CATEGORY_INVALID_PARENT');
 }
 async paths(client:PoolClient,ids:string[]):Promise<Map<string,{id:string;name:string}[]>>{
  const result=await client.query(`WITH RECURSIVE ancestors AS (
   SELECT id AS origin,id,parent_id,name,0 AS depth,ARRAY[id] AS visited FROM categories WHERE id=ANY($1::bigint[])
   UNION ALL SELECT a.origin,c.id,c.parent_id,c.name,a.depth+1,a.visited||c.id
   FROM ancestors a JOIN categories c ON c.id=a.parent_id WHERE NOT c.id=ANY(a.visited)
  ) SELECT origin::text,jsonb_agg(jsonb_build_object('id',id::text,'name',name) ORDER BY depth DESC) AS path,
    bool_or(parent_id=ANY(visited)) AS cyclic FROM ancestors GROUP BY origin`,[ids]);
  if(result.rows.some(row=>row.cyclic))throw new CategoryError('CATEGORY_INVALID_PARENT');
  return new Map(result.rows.map(row=>[row.origin,row.path]));
 }
 async counts(client:PoolClient,ids:string[]){
  const result=await client.query(`WITH RECURSIVE subtree(origin,id) AS (
   SELECT id,id FROM categories WHERE id=ANY($1::bigint[])
   UNION SELECT s.origin,c.id FROM subtree s JOIN categories c ON c.parent_id=s.id
  ), totals AS (SELECT s.origin,count(p.id)::int AS total FROM subtree s LEFT JOIN products p ON p.category_id=s.id GROUP BY s.origin),
  direct AS (SELECT category_id,count(*)::int AS direct FROM products WHERE category_id=ANY($1::bigint[]) GROUP BY category_id),
  children AS (SELECT parent_id,count(*)::int AS children FROM categories WHERE parent_id=ANY($1::bigint[]) GROUP BY parent_id)
  SELECT t.origin::text, t.total,coalesce(d.direct,0) AS direct,coalesce(c.children,0) AS children
  FROM totals t LEFT JOIN direct d ON d.category_id=t.origin LEFT JOIN children c ON c.parent_id=t.origin`,[ids]);
  return new Map(result.rows.map(row=>[row.origin,{totalProducts:row.total,directProducts:row.direct,childCount:row.children}]));
 }
 async list(client:PoolClient,parent:string|null,query:string,visibility:boolean|null,page:number,exclude:string|null){
  const values=[parent,query!=='',visibility,'%'+query.replace(/[\\%_]/g,'\\$&')+'%'];
  const where='($2::boolean OR parent_id IS NOT DISTINCT FROM $1::bigint) AND ($3::boolean IS NULL OR is_visible=$3) AND name ILIKE $4';
  const total=Number((await client.query(`SELECT count(*) FROM categories WHERE ${where}`,values)).rows[0].count);
  page=Math.min(page,Math.max(1,Math.ceil(total/50)));
  const rows=(await client.query<CategoryRecord>(`SELECT * FROM categories WHERE ${where} ORDER BY name,id LIMIT 50 OFFSET $5`,[...values,(page-1)*50])).rows;
  const ids=rows.map(row=>row.id),paths=await this.paths(client,parent?[...ids,parent]:ids),counts=await this.counts(client,ids);
  const translations=(await client.query('SELECT category_id::text,language_code,name FROM category_translations t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE category_id=ANY($1::bigint[]) AND name IS NOT NULL',[ids])).rows;
  const excluded=exclude?new Set((await client.query(`WITH RECURSIVE blocked(id) AS (SELECT id FROM categories WHERE id=$1 UNION SELECT c.id FROM categories c JOIN blocked b ON c.parent_id=b.id) SELECT id::text FROM blocked`,[exclude])).rows.map(row=>row.id)):new Set();
  return {rows,paths,counts,translations,excluded,total,page,pageSize:50};
 }
}

import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
export type TypeKind='payment'|'delivery'|'order-status';
export interface TypeActor {id:string;sessionHash:string}
export interface TypeRecord {id:string;name:string;description:string;icon_media_reference:string|null;sort_order:number;is_visible:boolean;is_default:boolean;is_free?:boolean;price?:string}
export class TypeError extends Error {constructor(readonly code:string,readonly status=400){super(code);}}
export class OptionTypesRepository {
 readonly table:string;readonly translationsTable:string;readonly foreignKey:string;
 constructor(readonly kind:TypeKind,readonly database:Pool=pool){this.table=kind==='order-status'?'order_statuses':kind==='payment'?'payment_types':'delivery_types';this.translationsTable=kind==='order-status'?'order_status_translations':kind==='payment'?'payment_type_translations':'delivery_type_translations';this.foreignKey=kind==='order-status'?'order_status_id':kind==='payment'?'payment_type_id':'delivery_type_id';}
 async authorized<T>(actor:TypeActor,required:string[],run:(client:PoolClient,has:(key:string)=>boolean)=>Promise<T>):Promise<T>{
  const client=await this.database.connect();try{
   await client.query('BEGIN');
   const auth=await client.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[actor.id]);
   const session=await client.query('SELECT 1 FROM cpanel_sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now() FOR UPDATE',[actor.id,actor.sessionHash]);
   if(!auth.rows[0]?.is_active||!session.rowCount)throw new TypeError('TYPE_FORBIDDEN',403);
   const permissions=(await client.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 FOR SHARE',[actor.id])).rows;
   const has=(key:string)=>permissions.some(p=>(p.key==='superuser'||p.key===key)&&p.value===true);
   if(!required.some(has))throw new TypeError('TYPE_FORBIDDEN',403);
   const result=await run(client,has);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
 }

 async lock(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(4840,$1)',[this.kind==='order-status'?6:this.kind==='payment'?3:4]);}
 columns(){return 'id::text,name,description,icon_media_reference,sort_order,is_visible,is_default'+(this.kind==='delivery'?',is_free,price':'');}
 async get(client:PoolClient,id:string){const row=(await client.query<TypeRecord>(`SELECT ${this.columns()} FROM ${this.table} WHERE id=$1`,[id])).rows[0];if(!row)throw new TypeError('TYPE_NOT_FOUND',404);return row;}
 async currentDefault(client:PoolClient){return (await client.query<TypeRecord>(`SELECT ${this.columns()} FROM ${this.table} WHERE is_default`)).rows[0];}
 async list(client:PoolClient,query:string,visible:boolean|null,page:number){
  const pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%',where='(name ILIKE $1 OR description ILIKE $1) AND ($2::boolean IS NULL OR is_visible=$2)';
  const total=Number((await client.query(`SELECT count(*) FROM ${this.table} WHERE ${where}`,[pattern,visible])).rows[0].count);page=Math.min(page,Math.max(1,Math.ceil(total/50)));
  const rows=(await client.query<TypeRecord>(`SELECT ${this.columns()} FROM ${this.table} WHERE ${where} ORDER BY sort_order,id LIMIT 50 OFFSET $3`,[pattern,visible,(page-1)*50])).rows;return {rows,total,page,pageSize:50};
 }
 async create(client:PoolClient,value:Omit<TypeRecord,'id'|'is_visible'|'is_default'|'icon_media_reference'>,actor:string){
  const fields=['name','description','sort_order','created_by','updated_by'],values:unknown[]=[value.name,value.description,value.sort_order,actor,actor];if(this.kind==='delivery'){fields.push('is_free','price');values.push(value.is_free,value.price);}
  const row=(await client.query(`INSERT INTO ${this.table}(${fields.join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id::text`,values)).rows[0];return this.get(client,row.id);
 }
 async update(client:PoolClient,value:TypeRecord,actor:string){
  const fields=['name','description','sort_order','icon_media_reference','is_visible','is_default'],values:unknown[]=[value.name,value.description,value.sort_order,value.icon_media_reference,value.is_visible,value.is_default];if(this.kind==='delivery'){fields.push('is_free','price');values.push(value.is_free,value.price);}fields.push('updated_by');values.push(actor);values.push(value.id);
  if(value.is_default)await client.query(`UPDATE ${this.table} SET is_default=false,updated_by=$2 WHERE is_default AND id<>$1`,[value.id,actor]);
  await client.query(`UPDATE ${this.table} SET ${fields.map((field,i)=>field+'=$'+(i+1)).join(',')} WHERE id=$${values.length}`,values);
 }
 async languages(client:PoolClient){return (await client.query('SELECT code FROM languages WHERE is_active')).rows.map(row=>row.code as string);}
 async translations(client:PoolClient,id:string){return (await client.query<{language_code:string;name:string|null;description:string|null}>(`SELECT t.language_code,t.name,t.description FROM ${this.translationsTable} t JOIN languages l ON l.code=t.language_code AND l.is_active WHERE ${this.foreignKey}=$1`,[id])).rows;}
 async saveTranslations(client:PoolClient,id:string,field:'name'|'description',values:Record<string,string|null>,actor:string){
  for(const [language,value] of Object.entries(values)){
   if(value!==null)await client.query(`INSERT INTO ${this.translationsTable}(${this.foreignKey},language_code,${field}) VALUES($1,$2,$3) ON CONFLICT(${this.foreignKey},language_code) DO UPDATE SET ${field}=EXCLUDED.${field}`,[id,language,value]);
   else {const other=field==='name'?'description':'name';await client.query(`DELETE FROM ${this.translationsTable} WHERE ${this.foreignKey}=$1 AND language_code=$2 AND ${other} IS NULL`,[id,language]);await client.query(`UPDATE ${this.translationsTable} SET ${field}=NULL WHERE ${this.foreignKey}=$1 AND language_code=$2`,[id,language]);}
  }
  await client.query(`UPDATE ${this.table} SET updated_by=$2 WHERE id=$1`,[id,actor]);
 }
}

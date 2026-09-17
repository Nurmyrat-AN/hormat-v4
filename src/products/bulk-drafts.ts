import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {productsService,type ProductsService} from './service.js';
import {ProductError,object,id,type ProductActor} from './validation.js';
import {sourceQuery} from '../source-products/query.js';
import {sourceWhere} from '../source-products/repository.js';
interface Selection {all:boolean;exceptions:string[];prefix:string}
interface Operation {actor:ProductActor;query:Record<string,string>;expires:number;state:'review'|'running'|'done';created:number;failed:number;total:number;errors:{source:string;code:string}[];signature?:string;selection?:Selection;uncertain:boolean}
/** Single-process, fail-closed operation tokens. Restart invalidates tokens; never re-execute an unknown token. */
export class BulkDraftsService {
 private operations=new Map<string,Operation>();
 constructor(readonly products:ProductsService=productsService){}
 private async authorize<T>(actor:ProductActor,run:(db:PoolClient)=>Promise<T>){return this.products.repository.authorized(actor,['products.create'],async(db,has)=>{if(!has('source_products.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);return run(db);});}
 private cleanup(){for(const [key,op]of this.operations)if(op.state!=='running'&&op.expires<Date.now())this.operations.delete(key);}
 private operation(actor:ProductActor,token:string){this.cleanup();const op=this.operations.get(token);if(!op||op.actor.id!==actor.id||op.actor.sessionHash!==actor.sessionHash)throw new ProductError('PRODUCT_NOT_FOUND',404);return op;}
 private result(op:Operation){return {state:op.state,created:op.created,failed:op.failed,total:op.total,errors:op.errors,uncertain:op.uncertain};}
 async review(actor:ProductActor,raw:unknown){const query=sourceQuery(object(raw));query.page='1';return this.authorize(actor,async db=>{
  this.cleanup();if(this.operations.size>=500||[...this.operations.values()].filter(o=>o.actor.id===actor.id).length>=20)throw new ProductError('PRODUCT_CONFLICT',409);
  const {values,where}=sourceWhere(query),total=Number((await db.query(`SELECT count(*) FROM source_products p WHERE ${where}`,values)).rows[0].count),token=randomUUID();
  this.operations.set(token,{actor,query,expires:Date.now()+15*60_000,state:'review',created:0,failed:0,total,errors:[],uncertain:false});return {token,total};
 });}
 async page(actor:ProductActor,token:string,raw:unknown){const op=this.operation(actor,token),f=object(raw,['page']);if(typeof(f.page??'1')!=='string'||! /^[1-9]\d{0,6}$/.test(String(f.page??'1')))throw new ProductError();const page=Number(f.page??1);
  return this.authorize(actor,async db=>{const {values,where}=sourceWhere(op.query);const total=Number((await db.query(`SELECT count(*) FROM source_products p WHERE ${where}`,values)).rows[0].count);
   const rows=(await db.query(`SELECT p.id::text,p.name,(SELECT count(*)::int FROM products x WHERE x.source_product_id=p.id) AS product_count FROM source_products p WHERE ${where} ORDER BY p.name ${op.query.sort==='name_desc'?'DESC':'ASC'},p.id LIMIT 20 OFFSET $${values.length+1}`,[...values,(page-1)*20])).rows;
   return {rows,total,page,hasMore:page*20<total};
  });
 }
 async status(actor:ProductActor,token:string){const op=this.operation(actor,token);return this.authorize(actor,async()=>this.result(op));}
 async start(actor:ProductActor,token:string,raw:unknown){const op=this.operation(actor,token),f=object(raw,['all','exceptions','prefix']);
  if(typeof f.all!=='boolean'||!Array.isArray(f.exceptions)||f.exceptions.length>20000||typeof f.prefix!=='string'||f.prefix.length>200||/[\x00-\x1f\x7f]/.test(f.prefix))throw new ProductError();
  const exceptions=f.exceptions.map(id);if(new Set(exceptions).size!==exceptions.length)throw new ProductError();const selection={all:f.all,exceptions:exceptions.sort(),prefix:f.prefix.trim()},signature=JSON.stringify(selection);
  await this.authorize(actor,async()=>{});
  // No await between the single-flight check and marking running.
  if(op.state!=='review'){if(op.signature!==signature)throw new ProductError('PRODUCT_CONFLICT',409);return this.result(op);}
  if([...this.operations.values()].filter(o=>o.state==='running').length>=2)throw new ProductError('PRODUCT_CONFLICT',409);
  op.state='running';op.signature=signature;op.selection=selection;op.total=0;
  void this.run(op);return this.result(op);
 }
 private async run(op:Operation){let reader:PoolClient|undefined;let remaining=0;
  try{
   reader=await this.products.repository.database.connect();await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const {values,where}=sourceWhere(op.query),selection=op.selection!,param='$'+(values.length+1);values.push(selection.exceptions);
   const valid=Number((await reader.query(`SELECT count(*) FROM source_products p WHERE ${where} AND p.id=ANY(${param}::bigint[])`,values)).rows[0].count);
   if(valid!==selection.exceptions.length)throw new ProductError();
   const selected=`${where} AND ${selection.all?'NOT ':''}(p.id=ANY(${param}::bigint[]))`;
   op.total=Number((await reader.query(`SELECT count(*) FROM source_products p WHERE ${selected}`,values)).rows[0].count);remaining=op.total;
   // WITH HOLD fixes the final query membership before our own INSERTs affect connection filters.
   await reader.query(`DECLARE product_drafts_cursor NO SCROLL CURSOR WITH HOLD FOR SELECT p.id::text FROM source_products p WHERE ${selected} ORDER BY p.id`,values);await reader.query('COMMIT');
   while(true){const batch=(await reader.query('FETCH FORWARD 100 FROM product_drafts_cursor')).rows;if(!batch.length)break;
    for(const source of batch){try{
     await this.authorize(op.actor,async db=>{
      const row=(await db.query('SELECT id,name FROM source_products WHERE id=$1 FOR SHARE',[source.id])).rows[0];if(!row)throw new ProductError('PRODUCT_NOT_FOUND',404);
      const name=selection.prefix?selection.prefix+' - '+row.name.trim():row.name.trim();
      await this.products.createBase(db,op.actor,{source_product_id:source.id,name});
     });op.created++;
    }catch(error){op.failed++;if(op.errors.length<20)op.errors.push({source:source.id,code:error instanceof ProductError?error.code:'PRODUCT_SAVE_FAILED'});
     if(!(error instanceof ProductError)){op.uncertain=true;throw error;}
     if(error.code==='PRODUCT_FORBIDDEN')throw error;
    }finally{remaining--;}}
   }
  }catch(error){op.failed+=Math.max(0,remaining);if(op.errors.length<20)op.errors.push({source:'',code:error instanceof ProductError?error.code:'PRODUCT_SAVE_FAILED'});if(!(error instanceof ProductError))op.uncertain=true;}
  finally{if(reader){await reader.query('ROLLBACK').catch(()=>{});await reader.query('CLOSE product_drafts_cursor').catch(()=>{});reader.release();}op.state='done';op.expires=Date.now()+60*60_000;}
 }
}
export const bulkDraftsService=new BulkDraftsService();

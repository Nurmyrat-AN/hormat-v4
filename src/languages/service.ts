import type {PoolClient} from 'pg';
import {LanguagesRepository,type LanguageActor} from './repository.js';
import {LanguageError,object,code,name,order,boolean} from './validation.js';
export type LanguageOperation='create'|'edit'|'status'|'default';
export class LanguagesService {
 constructor(readonly repository=new LanguagesRepository(),readonly refresh:()=>Promise<void>=async()=>{}){}
 /** Caller owns the transaction and authorization; used by centralized Defaults. */
 async applyDefault(client:PoolClient,target:string){await this.repository.lockRegistry(client);const key=code(target),row=await this.repository.get(client,key);if(!row.is_default)await this.repository.readyForDefault(client,key);await this.repository.setDefault(client,key);}
 async list(actor:LanguageActor,input:unknown){return this.repository.authorized(actor,['languages.view'],async client=>{const f=object(input,['query','status']),q=f.query??'',status=f.status??'all';if(typeof q!=='string'||q.length>200||!['all','active','inactive'].includes(status as string))throw new LanguageError('LANGUAGE_INVALID_REQUEST');return {rows:await this.repository.list(client,q.trim(),status==='all'?null:status==='active')};});}
 async details(actor:LanguageActor,target:string){return this.repository.authorized(actor,['languages.view'],async client=>({row:await this.repository.get(client,code(target))}));}
 async mutate(actor:LanguageActor,operation:LanguageOperation,target:string|undefined,input:unknown){
  let result;
  try{result=await this.repository.authorized(actor,operation==='create'?['languages.create']:operation==='status'?['languages.status']:operation==='default'?['languages.default']:['languages.update','languages.status','languages.default'],async(client,has)=>{
   // Serialize all registry writers, including switches by different administrators.
   await this.repository.lockRegistry(client);
   if(operation==='create'){const f=object(input,['code','name','sort_order']),key=code(f.code);await this.repository.create(client,key,name(f.name),order(f.sort_order??0));return {row:await this.repository.get(client,key)};}
   const key=code(target),row=await this.repository.get(client,key);
   const f=object(input,operation==='default'?[]:operation==='status'?['is_active']:['name','sort_order','is_active','is_default']);
   if(operation==='status'&&!Object.hasOwn(f,'is_active')||operation==='edit'&&!Object.keys(f).length)throw new LanguageError('LANGUAGE_INVALID_REQUEST');
   if(('name'in f||'sort_order'in f)&&!has('languages.update')||'is_active'in f&&!has('languages.status')||'is_default'in f&&!has('languages.default'))throw new LanguageError('LANGUAGE_FORBIDDEN',403);
   if('is_default'in f&&boolean(f.is_default)!==true)throw new LanguageError('LANGUAGE_DEFAULT_PROTECTED');
   const makeDefault=operation==='default'||f.is_default===true;
   const active='is_active'in f?boolean(f.is_active):undefined;
   if(active===false&&(row.is_default||makeDefault))throw new LanguageError('LANGUAGE_DEFAULT_PROTECTED');
   
   if('name'in f||'sort_order'in f)await this.repository.basic(client,{...row,display_name:'name'in f?name(f.name):row.display_name,sort_order:'sort_order'in f?order(f.sort_order):row.sort_order});
   if(makeDefault)await this.applyDefault(client,key);
   else if(active!==undefined)await this.repository.status(client,key,active);
   return {row:await this.repository.get(client,key)};
  });}catch(error){if(error instanceof LanguageError)throw error;if((error as {code?:string}).code==='23505')throw new LanguageError('LANGUAGE_DUPLICATE',409);throw new LanguageError('LANGUAGE_SAVE_FAILED',500);}
  // Persistence has committed. Never misreport a committed save as rolled back.
  try{await this.refresh();return {...result,cacheRefreshed:true};}catch{return {...result,cacheRefreshed:false};}
 }
}

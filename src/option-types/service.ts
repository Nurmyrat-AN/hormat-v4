import {sanitizeDescription} from '../content/html.js';
import type {PoolClient} from 'pg';
import {OptionTypesRepository,TypeError,type TypeActor,type TypeRecord} from './repository.js';
import {MediaBrowser} from '../cpanel/media/browser.js';
import {validateMediaPath} from '../media/paths.js';
function object(value:unknown,allowed?:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||allowed&&Object.keys(value).some(key=>!allowed.includes(key)))throw new TypeError('TYPE_INVALID');return value as Record<string,unknown>;}
function text(value:unknown,description=false,empty=false){if(typeof value!=='string'||[...value.trim()].length>(description?4000:200)||!empty&&!value.trim()||(description?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))throw new TypeError('TYPE_INVALID');return value.trim();}
function description(value:unknown){const cleaned=sanitizeDescription(text(value,true,true));if(cleaned.length>4000)throw new TypeError('TYPE_INVALID');return cleaned;}
function integer(value:unknown){if(typeof value!=='number'||!Number.isInteger(value)||value<-2147483648||value>2147483647)throw new TypeError('TYPE_INVALID');return value;}
function bool(value:unknown){if(typeof value!=='boolean')throw new TypeError('TYPE_INVALID');return value;}
function price(value:unknown){if(typeof value!=='string'||value.length>128||!/^\d+(?:\.\d+)?$/.test(value))throw new TypeError('TYPE_INVALID');return value;}
function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new TypeError('TYPE_NOT_FOUND',404);return value;}
export class OptionTypesService {
 constructor(readonly repository:OptionTypesRepository,readonly media=new MediaBrowser()){}
 /** Caller owns transaction/authorization. Reuses the ordinary default synchronization. */
 async applyDefault(client:PoolClient,target:string|null,actor:string,visibleOnly=false){
  await this.repository.lock(client);
  if(target===null){const current=await this.repository.currentDefault(client);if(current)await this.repository.update(client,{...current,is_default:false},actor);return;}
  const row=await this.repository.get(client,id(target));if(visibleOnly&&!row.is_visible)throw new TypeError('TYPE_DEFAULT_VISIBLE',409);
  await this.repository.update(client,{...row,is_default:true,is_visible:true},actor);
 }
 async icon(reference:string){try{const item=await this.media.entry(reference);return {path:reference,name:item.name,url:item.url,image:item.image,type:item.type};}catch{return {path:reference,name:reference.split('/').at(-1)??'',url:null,image:false,type:'file'};}}
 async present(client:PoolClient,row:TypeRecord){const overrides=await this.repository.translations(client,row.id);return {id:row.id,basic:{name:row.name,description:sanitizeDescription(row.description),sort:String(row.sort_order),visible:row.is_visible,default:row.is_default,icon:row.icon_media_reference?await this.icon(row.icon_media_reference):null,...(this.repository.kind==='delivery'?{free:row.is_free,price:row.price}:{})},translations:{name:Object.fromEntries(overrides.filter(t=>t.name).map(t=>[t.language_code,t.name])),description:Object.fromEntries(overrides.filter(t=>t.description).map(t=>[t.language_code,sanitizeDescription(t.description!)]))}};}
 async list(actor:TypeActor,input:unknown){return this.repository.authorized(actor,[this.repository.table+'.view'],async client=>{const f=object(input,['query','visibility','page']),query=f.query??'',visibility=f.visibility??'all',page=Number(f.page??1);if(typeof query!=='string'||query.length>200||!['all','visible','hidden'].includes(visibility as string)||!Number.isSafeInteger(page)||page<1)throw new TypeError('TYPE_INVALID');const result=await this.repository.list(client,query.trim(),visibility==='all'?null:visibility==='visible',page);const rows=[];for(const row of result.rows)rows.push(await this.present(client,row));return {...result,rows};});}
 async detail(actor:TypeActor,target:string){return this.repository.authorized(actor,[this.repository.table+'.view'],async client=>({row:await this.present(client,await this.repository.get(client,id(target)))}));}
 async mutate(actor:TypeActor,operation:'create'|'basic'|'translations',target:string|undefined,input:unknown){
 const module=this.repository.table;
 try{return await this.repository.authorized(actor,operation==='create'?[module+'.create']:operation==='translations'?[module+'.update']:[module+'.update',module+'.visibility'],async(client,has)=>{
  await this.repository.lock(client);
  const base=['name','description','sort_order',...(this.repository.kind==='delivery'?['is_free','price']:[])];
  if(operation==='create'){
   const f=object(input,base),free='is_free'in f?bool(f.is_free):true,p='price'in f?price(f.price):'0';
   const row=await this.repository.create(client,{name:text(f.name),description:description(f.description??''),sort_order:integer(f.sort_order??0),...(this.repository.kind==='delivery'?{is_free:free,price:free?'0':p}:{})},actor.id);return {row:await this.present(client,row)};
  }
  const row=await this.repository.get(client,id(target??''));
  if(operation==='translations'){
   const f=object(input,['field','translations']);if(f.field!=='name'&&f.field!=='description')throw new TypeError('TYPE_INVALID');
   const values=object(f.translations),languages=await this.repository.languages(client),normalized:Record<string,string|null>={};
   for(const [code,value] of Object.entries(values)){if(!languages.includes(code))throw new TypeError('TYPE_INVALID');normalized[code]=value===null?null:(f.field==='description'?description(value):text(value,false,true))||null;}
   await this.repository.saveTranslations(client,row.id,f.field,normalized,actor.id);return {row:await this.present(client,row)};
  }
  const f=object(input,[...base,'icon_media_reference','is_visible','is_default']);if(!Object.keys(f).length)throw new TypeError('TYPE_INVALID');
  if(Object.keys(f).some(key=>key!=='is_visible')&&!has(module+'.update')||'is_visible'in f&&!has(module+'.visibility'))throw new TypeError('TYPE_FORBIDDEN',403);
  const next={...row};if('name'in f)next.name=text(f.name);if('description'in f)next.description=description(f.description);if('sort_order'in f)next.sort_order=integer(f.sort_order);
  if('is_visible'in f)next.is_visible=bool(f.is_visible);if('is_default'in f){next.is_default=bool(f.is_default);if(next.is_default){if(f.is_visible===false)throw new TypeError('TYPE_DEFAULT_VISIBLE',409);next.is_visible=true;}}
  if(next.is_default&&!next.is_visible)throw new TypeError('TYPE_DEFAULT_VISIBLE',409);
  if('icon_media_reference'in f){const reference=f.icon_media_reference;if(reference!==null){if(typeof reference!=='string'||!reference||reference.split('/')[0]==='cache')throw new TypeError('TYPE_INVALID_MEDIA');try{validateMediaPath(reference);}catch{throw new TypeError('TYPE_INVALID_MEDIA');}if(reference!==row.icon_media_reference){if(!has('media.view'))throw new TypeError('TYPE_FORBIDDEN',403);try{const item=await this.media.inspect(reference);if(item.folder||item.temporary||!item.url||!item.image||item.type!=='image')throw Error();}catch{throw new TypeError('TYPE_INVALID_MEDIA');}}}next.icon_media_reference=reference as string|null;}
  if(this.repository.kind==='delivery'){if('is_free'in f)next.is_free=bool(f.is_free);if('price'in f)next.price=price(f.price);if(next.is_free)next.price='0';}
  await this.repository.update(client,next,actor.id);return {row:await this.present(client,await this.repository.get(client,row.id))};
 });}catch(error){if(error instanceof TypeError)throw error;throw new TypeError('TYPE_SAVE_FAILED',500);}
 }
}

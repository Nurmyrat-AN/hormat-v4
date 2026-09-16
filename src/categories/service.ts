import type {PoolClient} from 'pg';
import {CategoriesRepository,CategoryError,type CategoryActor,type CategoryRecord} from './repository.js';
import {MediaBrowser} from '../cpanel/media/browser.js';
import {validateMediaPath} from '../media/paths.js';
export type CategoryOperation='create'|'basic'|'seo'|'translations'|'gallery';
function object(value:unknown,allowed?:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||allowed&&Object.keys(value).some(k=>!allowed.includes(k)))throw new CategoryError('CATEGORY_INVALID_REQUEST');return value as Record<string,unknown>;}
function name(value:unknown,empty=false){if(typeof value!=='string'||[...value.trim()].length>200||/[\x00-\x1f\x7f]/.test(value)||!empty&&!value.trim())throw new CategoryError('CATEGORY_INVALID_NAME');return value.trim();}
function seo(value:unknown,limit:number){if(typeof value!=='string'||[...value.trim()].length>limit||(limit===2000?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))throw new CategoryError('CATEGORY_INVALID_SEO');return value.trim();}
function slug(value:unknown){if(typeof value!=='string')throw new CategoryError('CATEGORY_INVALID_SLUG');const normalized=value.trim().toLowerCase().replace(/\s+/g,'-');if(normalized.length>120||! /^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized))throw new CategoryError('CATEGORY_INVALID_SLUG');return normalized;}
function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new CategoryError('CATEGORY_NOT_FOUND',404);return value;}
function parentId(value:unknown):string|null{if(value===null||value==='')return null;if(typeof value!=='string')throw new CategoryError('CATEGORY_INVALID_PARENT');return id(value);}
function reference(value:unknown):string{if(typeof value!=='string'||!value||value.split('/')[0]==='cache')throw new CategoryError('CATEGORY_INVALID_MEDIA');try{validateMediaPath(value);}catch{throw new CategoryError('CATEGORY_INVALID_MEDIA');}return value;}
function references(value:unknown):string[]{if(!Array.isArray(value)||value.length>200)throw new CategoryError('CATEGORY_INVALID_REQUEST');const refs=value.map(reference);if(new Set(refs).size!==refs.length)throw new CategoryError('CATEGORY_DUPLICATE_MEDIA');return refs;}
export class CategoriesService {
 constructor(readonly repository=new CategoriesRepository(),readonly media=new MediaBrowser()){}
 async mediaView(path:string){try{const item=await this.media.entry(path);return {path,name:item.name,url:item.url,image:item.image,type:item.type};}catch{return {path,name:path.split('/').at(-1)??'',url:null,image:false,type:'file'};}}
 async selectedMedia(path:string,has:(key:string)=>boolean){if(!has('media.view'))throw new CategoryError('CATEGORY_FORBIDDEN',403);try{const item=await this.media.inspect(path);if(item.folder||item.temporary||!item.url||!item.image||item.type!=='image')throw Error();}catch{throw new CategoryError('CATEGORY_INVALID_MEDIA');}}
 async present(client:PoolClient,row:CategoryRecord){
  const records=await this.repository.translations(client,row.id);
  const overrides=(field:string)=>Object.fromEntries(records.filter(t=>t[field]).map(t=>[t.language_code,t[field]]));
  const translations=overrides('name'),seoTranslations={seo_title:overrides('seo_title'),seo_description:overrides('seo_description')};
  const gallery=await Promise.all((await this.repository.gallery(client,row.id)).map(path=>this.mediaView(path)));
  return {id:row.id,seo:{slug:row.slug,seo_title:row.seo_title??'',seo_description:row.seo_description??''},basic:{parentId:row.parent_id,name:row.name,is_visible:row.is_visible,mainMedia:row.main_media_reference?await this.mediaView(row.main_media_reference):null},translations,seoTranslations,gallery,ancestry:(await this.repository.paths(client,[row.id])).get(row.id)??[],...(await this.repository.counts(client,[row.id])).get(row.id)};
 }
 async list(actor:CategoryActor,input:unknown){return this.repository.authorized(actor,['categories.view'],async client=>{
  const f=object(input,['parent','query','visibility','page','exclude']),query=f.query??'',visibility=f.visibility??'all',page=f.page??'1';
  if(typeof query!=='string'||query.length>200||!['all','visible','hidden'].includes(visibility as string)||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1)throw new CategoryError('CATEGORY_INVALID_REQUEST');
  const parent=parentId(f.parent??null),exclude=parentId(f.exclude??null);
  if(parent)await this.repository.get(client,parent);if(exclude)await this.repository.get(client,exclude);
  const result=await this.repository.list(client,parent,query.trim(),visibility==='all'?null:visibility==='visible',Number(page),exclude);
  const rows=await Promise.all(result.rows.map(async row=>({id:row.id,basic:{parentId:row.parent_id,name:row.name,is_visible:row.is_visible,mainMedia:row.main_media_reference?await this.mediaView(row.main_media_reference):null},translations:Object.fromEntries(result.translations.filter(t=>t.category_id===row.id).map(t=>[t.language_code,t.name])),ancestry:result.paths.get(row.id)??[],...result.counts.get(row.id),parentDisabled:result.excluded.has(row.id)})));
  return {rows,parent,breadcrumbs:parent?result.paths.get(parent)??[]:[],total:result.total,page:result.page,pageSize:result.pageSize,languages:await this.repository.languages(client)};
 });}
 async details(actor:CategoryActor,target:string){return this.repository.authorized(actor,['categories.view'],async client=>({row:await this.present(client,await this.repository.get(client,id(target))),languages:await this.repository.languages(client)}));}
 async mutate(actor:CategoryActor,operation:CategoryOperation,target:string|undefined,input:unknown){
  try{return await this.repository.authorized(actor,operation==='create'?['categories.create']:operation==='basic'?['categories.update','categories.visibility']:['categories.update'],async(client,has)=>{
   if(operation==='create'||operation==='basic')await this.repository.lockHierarchy(client);
   if(operation==='create'){
    const f=object(input,['name','parent_id']),parent=parentId(f.parent_id??null);await this.repository.validateParent(client,null,parent);const row=await this.repository.create(client,name(f.name),parent,actor.id);return {row:await this.present(client,row),code:'CATEGORY_CREATED'};
   }
   const row=await this.repository.get(client,id(target??''),true);
   if(operation==='basic'){
    const f=object(input,['name','parent_id','main_media_reference','is_visible']);if(!Object.keys(f).length)throw new CategoryError('CATEGORY_INVALID_REQUEST');
    if((['name','parent_id','main_media_reference'].some(key=>key in f))&&!has('categories.update')||'is_visible'in f&&!has('categories.visibility'))throw new CategoryError('CATEGORY_FORBIDDEN',403);
    const nextName='name'in f?name(f.name):row.name;
    if('is_visible'in f&&typeof f.is_visible!=='boolean')throw new CategoryError('CATEGORY_INVALID_REQUEST');
    const main='main_media_reference'in f?(f.main_media_reference===null?null:reference(f.main_media_reference)):row.main_media_reference;
    if(main!==null&&main!==row.main_media_reference)await this.selectedMedia(main,has);
    const parent='parent_id'in f?parentId(f.parent_id):row.parent_id;await this.repository.validateParent(client,row.id,parent);
    if(Object.keys(f).length===1&&'parent_id'in f)await this.repository.move(client,row.id,parent,actor.id);
    else await this.repository.basic(client,row.id,nextName,main,(f.is_visible??row.is_visible) as boolean,parent,actor.id);
   }else if(operation==='seo'){
    const f=object(input,['slug','seo_title','seo_description']);if(!Object.keys(f).length)throw new CategoryError('CATEGORY_INVALID_REQUEST');
    await this.repository.seo(client,row.id,'slug'in f?slug(f.slug):row.slug,'seo_title'in f?seo(f.seo_title,200):row.seo_title,'seo_description'in f?seo(f.seo_description,2000):row.seo_description,actor.id);
   }else if(operation==='translations'){
    const f=object(input,['translations','field']),field=f.field??'name';
    if(field!=='name'&&field!=='seo_title'&&field!=='seo_description')throw new CategoryError('CATEGORY_INVALID_REQUEST');
    const values=object(f.translations),languages=await this.repository.languages(client);
    if(Object.keys(values).some(code=>!languages.some(language=>language.code===code)))throw new CategoryError('CATEGORY_INVALID_LANGUAGE');
    const normalized=Object.entries(values).map(([code,value])=>[code,field==='name'?name(value,true):seo(value,field==='seo_title'?200:2000)]);
    await this.repository.saveTranslations(client,row.id,normalized,field);
    await this.repository.touch(client,row.id,actor.id);
   }else{
    const f=object(input,['items','original']),items=references(f.items),original=references(f.original),current=await this.repository.gallery(client,row.id);
    if(JSON.stringify(original)!==JSON.stringify(current))throw new CategoryError('CATEGORY_GALLERY_CONFLICT',409);
    for(const path of items)if(!current.includes(path))await this.selectedMedia(path,has);
    await this.repository.saveGallery(client,row.id,items);
    await this.repository.touch(client,row.id,actor.id);
   }
   return {row:await this.present(client,await this.repository.get(client,row.id)),code:operation==='basic'||operation==='seo'?'CATEGORY_UPDATED':operation==='translations'?'CATEGORY_TRANSLATIONS_SAVED':'CATEGORY_GALLERY_SAVED'};
  });}catch(error){if(error instanceof CategoryError)throw error;if((error as {code?:string;constraint?:string}).code==='23505'&&(error as {constraint?:string}).constraint==='categories_slug_unique')throw new CategoryError('CATEGORY_SLUG_TAKEN',409);throw new CategoryError('CATEGORY_SAVE_FAILED',500);}
 }
}
export const categoriesService=new CategoriesService();

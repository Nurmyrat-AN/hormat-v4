import type {PoolClient} from 'pg';
import {BrandsRepository,BrandError,type BrandActor,type BrandRecord} from './repository.js';
import {MediaBrowser} from '../cpanel/media/browser.js';
import {validateMediaPath} from '../media/paths.js';
export type BrandOperation='create'|'basic'|'seo'|'translations'|'gallery';
function object(value:unknown,allowed?:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||allowed&&Object.keys(value).some(k=>!allowed.includes(k)))throw new BrandError('BRAND_INVALID_REQUEST');return value as Record<string,unknown>;}
function name(value:unknown,empty=false){if(typeof value!=='string'||[...value.trim()].length>200||/[\x00-\x1f\x7f]/.test(value)||!empty&&!value.trim())throw new BrandError('BRAND_INVALID_NAME');return value.trim();}
function seo(value:unknown,limit:number){if(typeof value!=='string'||[...value.trim()].length>limit||(limit===2000?/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:/[\x00-\x1f\x7f]/).test(value))throw new BrandError('BRAND_INVALID_SEO');return value.trim();}
function slug(value:unknown){if(typeof value!=='string')throw new BrandError('BRAND_INVALID_SLUG');const normalized=value.trim().toLowerCase().replace(/\s+/g,'-');if(normalized.length>120||! /^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized))throw new BrandError('BRAND_INVALID_SLUG');return normalized;}
function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new BrandError('BRAND_NOT_FOUND',404);return value;}
function reference(value:unknown):string{if(typeof value!=='string'||!value||value.split('/')[0]==='cache')throw new BrandError('BRAND_INVALID_MEDIA');try{validateMediaPath(value);}catch{throw new BrandError('BRAND_INVALID_MEDIA');}return value;}
function references(value:unknown):string[]{if(!Array.isArray(value)||value.length>200)throw new BrandError('BRAND_INVALID_REQUEST');const refs=value.map(reference);if(new Set(refs).size!==refs.length)throw new BrandError('BRAND_DUPLICATE_MEDIA');return refs;}
export class BrandsService {
 constructor(readonly repository=new BrandsRepository(),readonly media=new MediaBrowser()){}
 async mediaView(path:string){try{const item=await this.media.entry(path);return {path,name:item.name,url:item.url,image:item.image,type:item.type};}catch{return {path,name:path.split('/').at(-1)??'',url:null,image:false,type:'file'};}}
 async selectedMedia(path:string,has:(key:string)=>boolean){if(!has('media.view'))throw new BrandError('BRAND_FORBIDDEN',403);try{const item=await this.media.inspect(path);if(item.folder||item.temporary||!item.url||!item.image||item.type!=='image')throw Error();}catch{throw new BrandError('BRAND_INVALID_MEDIA');}}
 async present(client:PoolClient,row:BrandRecord){
  const records=await this.repository.translations(client,row.id);
  const overrides=(field:string)=>Object.fromEntries(records.filter(t=>t[field]).map(t=>[t.language_code,t[field]]));
  const translations=overrides('name'),seoTranslations={seo_title:overrides('seo_title'),seo_description:overrides('seo_description')};
  const gallery=await Promise.all((await this.repository.gallery(client,row.id)).map(path=>this.mediaView(path)));
  return {id:row.id,seo:{slug:row.slug,seo_title:row.seo_title,seo_description:row.seo_description},basic:{name:row.name,is_visible:row.is_visible,mainMedia:row.main_media_reference?await this.mediaView(row.main_media_reference):null},translations,seoTranslations,gallery,productCount:await this.repository.productCount(client,row.id)};
 }
 async list(actor:BrandActor,input:unknown){return this.repository.authorized(actor,['brands.view'],async client=>{
  const f=object(input,['query','visibility','page']),query=f.query??'',visibility=f.visibility??'all',page=f.page??'1';
  if(typeof query!=='string'||query.length>200||!['all','visible','hidden'].includes(visibility as string)||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1)throw new BrandError('BRAND_INVALID_REQUEST');
  const result=await this.repository.list(client,query.trim(),visibility==='all'?null:visibility==='visible',Number(page));
  const rows=[];for(const row of result.rows)rows.push(await this.present(client,row));return {...result,rows,languages:await this.repository.languages(client)};
 });}
 async details(actor:BrandActor,target:string){return this.repository.authorized(actor,['brands.view'],async client=>({row:await this.present(client,await this.repository.get(client,id(target))),languages:await this.repository.languages(client)}));}
 async mutate(actor:BrandActor,operation:BrandOperation,target:string|undefined,input:unknown){
  try{return await this.repository.authorized(actor,operation==='create'?['brands.create']:operation==='basic'?['brands.update','brands.visibility']:['brands.update'],async(client,has)=>{
   if(operation==='create'){
    const f=object(input,['name']);const row=await this.repository.create(client,name(f.name),actor.id);return {row:await this.present(client,row),code:'BRAND_CREATED'};
   }
   const row=await this.repository.get(client,id(target??''),true);
   if(operation==='basic'){
    const f=object(input,['name','main_media_reference','is_visible']);if(!Object.keys(f).length)throw new BrandError('BRAND_INVALID_REQUEST');
    if((['name','main_media_reference'].some(key=>key in f))&&!has('brands.update')||'is_visible'in f&&!has('brands.visibility'))throw new BrandError('BRAND_FORBIDDEN',403);
    const nextName='name'in f?name(f.name):row.name;
    if('is_visible'in f&&typeof f.is_visible!=='boolean')throw new BrandError('BRAND_INVALID_REQUEST');
    const main='main_media_reference'in f?(f.main_media_reference===null?null:reference(f.main_media_reference)):row.main_media_reference;
    if(main!==null&&main!==row.main_media_reference)await this.selectedMedia(main,has);
    await this.repository.basic(client,row.id,nextName,main,(f.is_visible??row.is_visible) as boolean,actor.id);
   }else if(operation==='seo'){
    const f=object(input,['slug','seo_title','seo_description']);if(!Object.keys(f).length)throw new BrandError('BRAND_INVALID_REQUEST');
    await this.repository.seo(client,row.id,'slug'in f?slug(f.slug):row.slug,'seo_title'in f?seo(f.seo_title,200):row.seo_title,'seo_description'in f?seo(f.seo_description,2000):row.seo_description,actor.id);
   }else if(operation==='translations'){
    const f=object(input,['translations','field']),field=f.field??'name';
    if(field!=='name'&&field!=='seo_title'&&field!=='seo_description')throw new BrandError('BRAND_INVALID_REQUEST');
    const values=object(f.translations),languages=await this.repository.languages(client);
    if(Object.keys(values).some(code=>!languages.some(language=>language.code===code)))throw new BrandError('BRAND_INVALID_LANGUAGE');
    const normalized=Object.entries(values).map(([code,value])=>[code,field==='name'?name(value,true):seo(value,field==='seo_title'?200:2000)]);
    await this.repository.saveTranslations(client,row.id,normalized,field);
    await this.repository.touch(client,row.id,actor.id);
   }else{
    const f=object(input,['items','original']),items=references(f.items),original=references(f.original),current=await this.repository.gallery(client,row.id);
    if(JSON.stringify(original)!==JSON.stringify(current))throw new BrandError('BRAND_GALLERY_CONFLICT',409);
    for(const path of items)if(!current.includes(path))await this.selectedMedia(path,has);
    await this.repository.saveGallery(client,row.id,items);
    await this.repository.touch(client,row.id,actor.id);
   }
   return {row:await this.present(client,await this.repository.get(client,row.id)),code:operation==='basic'||operation==='seo'?'BRAND_UPDATED':operation==='translations'?'BRAND_TRANSLATIONS_SAVED':'BRAND_GALLERY_SAVED'};
  });}catch(error){if(error instanceof BrandError)throw error;if((error as {code?:string;constraint?:string}).code==='23505'&&(error as {constraint?:string}).constraint==='brands_slug_unique')throw new BrandError('BRAND_SLUG_TAKEN',409);throw new BrandError('BRAND_SAVE_FAILED',500);}
 }
}
export const brandsService=new BrandsService();

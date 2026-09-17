import {visibilityDiagnostics} from './visibility.js';
import type {PoolClient} from 'pg';
import {ProductsRepository} from './repository.js';
import {ProductError,object,id,text,slug,boolean,priceRule,translationFields,type TranslationField,type ProductActor} from './validation.js';
import {MediaBrowser} from '../cpanel/media/browser.js';
import {validateMediaPath} from '../media/paths.js';
import {convertPrice} from '../currencies/conversion.js';
export type ProductOperation='create'|'basic'|'seo'|'description'|'visibility'|'priceRules'|'translations'|'gallery'|'discounts';
const permissions=(op:ProductOperation)=>op==='create'?['products.create']:op==='basic'?['products.update','products.visibility']:op==='visibility'?['products.visibility']:['products.update'];
function mediaItems(value:unknown){if(!Array.isArray(value)||value.length>200)throw new ProductError();const items=value.map(v=>{const f=object(v,['path','primary']);if(typeof f.path!=='string'||!f.path||f.path.split('/')[0]==='cache')throw new ProductError();try{validateMediaPath(f.path);}catch{throw new ProductError();}return {path:f.path,primary:boolean(f.primary)};});if(new Set(items.map(i=>i.path)).size!==items.length||items.filter(i=>i.primary).length>1)throw new ProductError();return items;}
function discountIds(value:unknown){if(!Array.isArray(value)||value.length>200)throw new ProductError();const ids=value.map(id);if(new Set(ids).size!==ids.length)throw new ProductError();return ids;}
export class ProductsService {
 constructor(readonly repository=new ProductsRepository(),readonly media=new MediaBrowser()){}
 async mediaView(path:string){try{const m=await this.media.entry(path);return {path,name:m.name,url:m.url,image:m.image,type:m.type};}catch{return {path,name:path.split('/').at(-1),url:null,image:false,type:'file'};}}
 async preview(db:PoolClient,source:Awaited<ReturnType<ProductsRepository['source']>>,rule:{action:string|null;value:string|null}){
  if(source.price===null)return {normalized:null,normal:null,rate:source.rate??'1'};
  const normalized=await convertPrice(source.price,source.rate,null,db);
  const normal=(await db.query(`SELECT (CASE $2::text WHEN 'addAmount' THEN $1::numeric+$3::numeric WHEN 'removeAmount' THEN $1::numeric-$3::numeric WHEN 'fixed' THEN $3::numeric WHEN 'addPercent' THEN $1::numeric*(1+$3::numeric/100) WHEN 'removePercent' THEN $1::numeric*(1-$3::numeric/100) ELSE $1::numeric END)::text AS value`,[normalized,rule.action,rule.value])).rows[0].value;
  return {normalized,normal,rate:source.rate??'1'};
 }
 async present(db:PoolClient,row:Record<string,any>){
  const source=await this.repository.source(db,row.source_product_id),translations:Record<string,Record<string,string>>={};
  for(const field of translationFields)translations[field==='description_html'?'description':field]={};
  for(const t of await this.repository.translations(db,row.id))for(const field of translationFields)if(t[field])translations[field==='description_html'?'description':field][t.language_code]=t[field];
  const brand=row.brand_id?await this.repository.reference(db,'brands',row.brand_id):null,category=row.category_id?await this.repository.reference(db,'categories',row.category_id):null;
  const diagnostics=visibilityDiagnostics({is_visible:row.is_visible,hide_when_out_of_stock:row.hide_when_out_of_stock},source,brand?.is_visible??true,category?.is_visible??true);
  return {id:row.id,source,basic:{name:row.name,source:row.source_product_id,brand:row.brand_id??'',category:row.category_id??'',visible:row.is_visible},seo:{slug:row.slug??'',title:row.seo_title??'',description:row.seo_description??''},description:{short:row.short_description??'',html:row.description_html??''},visibility:{placement:row.is_placement_product,showStock:row.show_as_in_stock,hideStock:row.hide_when_out_of_stock},priceRules:{action:row.price_action??'',value:row.price_value??''},translations,gallery:await Promise.all((await this.repository.gallery(db,row.id)).map(async m=>({...await this.mediaView(m.path),primary:m.primary}))),discounts:(await this.repository.discounts(db,row.id)).map(d=>d.id),discountDetails:await this.repository.discounts(db,row.id),diagnostics,preview:await this.preview(db,source,{action:row.price_action,value:row.price_value})};
 }
 async forSource(actor:ProductActor,target:string,input:unknown){
  const source=id(target),f=object(input,['page']);if(typeof(f.page??'1')!=='string'||! /^[1-9]\d{0,6}$/.test(String(f.page??'1')))throw new ProductError();
  return this.repository.authorized(actor,['products.view'],async(db,has)=>{
   if(!has('source_products.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
   await this.repository.source(db,source);const result=await this.repository.forSource(db,source,Number(f.page??1));
   return {...result,rows:await Promise.all(result.rows.map(async row=>({...row,image:row.image?await this.mediaView(row.image):null})))};
  });
 }
 async list(actor:ProductActor){return this.repository.authorized(actor,['products.view'],async db=>({rows:await this.repository.list(db)}));}
 async details(actor:ProductActor,target:string){return this.repository.authorized(actor,['products.view'],async db=>({row:await this.present(db,await this.repository.get(db,id(target)))}));}
 async source(actor:ProductActor,target:string){return this.repository.authorized(actor,['products.create'],async db=>({source:await this.repository.source(db,id(target))}));}
 async pricePreview(actor:ProductActor,target:string,input:unknown){return this.repository.authorized(actor,['products.view','products.update'],async db=>{const row=await this.repository.get(db,id(target));return {preview:await this.preview(db,await this.repository.source(db,row.source_product_id),priceRule(input))};});}
 async discounts(actor:ProductActor,input:unknown){return this.repository.authorized(actor,['products.update'],async(db,has)=>{
  if(!has('discounts.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
  const f=object(input,['product_id','query','page','selected']),product=id(f.product_id);
  if(typeof(f.query??'')!=='string'||String(f.query??'').length>200||typeof(f.page??'1')!=='string'||! /^[1-9]\d{0,6}$/.test(String(f.page??'1')))throw new ProductError();
  await this.repository.get(db,product);
  return this.repository.discountLookup(db,product,String(f.query??'').trim(),Number(f.page??1),f.selected===undefined?null:id(f.selected));
 });}
 async discountRelationship(actor:ProductActor,target:string,operation:'attach'|'detach',input:unknown){
  try{return await this.repository.authorized(actor,['products.update'],async(db,has)=>{
   const f=object(input,['discount_id']),discount=id(f.discount_id),product=await this.repository.get(db,id(target),true);
   if(operation==='attach'){
    if(!has('discounts.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
    if(!(await db.query('SELECT id FROM discounts WHERE id=$1 FOR SHARE',[discount])).rowCount)throw new ProductError('PRODUCT_NOT_FOUND',404);
    await this.repository.attachDiscount(db,product.id,discount);
   }else await this.repository.detachDiscount(db,product.id,discount);
   await this.repository.update(db,product.id,{},actor.id);
   return {discounts:await this.repository.discounts(db,product.id)};
  });}catch(error){if(error instanceof ProductError)throw error;if((error as {code?:string}).code==='23505')throw new ProductError('PRODUCT_CONFLICT',409);throw new ProductError('PRODUCT_SAVE_FAILED',500);}
 }
 async createBase(db:PoolClient,actor:ProductActor,input:unknown){
  const f=object(input,['source_product_id','name','brand_id','category_id']),source=id(f.source_product_id);
  await this.repository.source(db,source);
  const brand=f.brand_id===null||f.brand_id===undefined?null:id(f.brand_id),category=f.category_id===null||f.category_id===undefined?null:id(f.category_id);
  if(brand)await this.repository.reference(db,'brands',brand);if(category)await this.repository.reference(db,'categories',category);
  return this.repository.create(db,source,text(f.name,'name',true)!,brand,category,actor.id);
 }
 async mutate(actor:ProductActor,operation:ProductOperation,target:string|undefined,input:unknown){try{return await this.repository.authorized(actor,permissions(operation),async(db,has)=>{
  if(operation==='create'){
   return {row:await this.present(db,await this.createBase(db,actor,input))};
  }
  const row=await this.repository.get(db,id(target),true),fields:Record<string,unknown>={};
  if(operation==='basic'){
   const f=object(input,['name','brand_id','category_id','is_visible']);if(!Object.keys(f).length)throw new ProductError();
   for(const key of Object.keys(f)){if(!has(key==='is_visible'?'products.visibility':'products.update'))throw new ProductError('PRODUCT_FORBIDDEN',403);}
   if('name'in f)fields.name=text(f.name,'name',true);
   if('is_visible'in f)fields.is_visible=boolean(f.is_visible);
   for(const [key,kind]of [['brand_id','brands'],['category_id','categories']] as const)if(key in f){fields[key]=f[key]===null?null:id(f[key]);if(fields[key])await this.repository.reference(db,kind,fields[key] as string);}
  }else if(operation==='seo'){
   const f=object(input,['slug','seo_title','seo_description']);for(const key of Object.keys(f))fields[key]=key==='slug'?slug(f[key]):text(f[key],key as TranslationField);
  }else if(operation==='description'){
   const f=object(input,['short_description','description_html']);for(const key of Object.keys(f))fields[key]=text(f[key],key as TranslationField);
  }else if(operation==='visibility'){
   const f=object(input,['is_placement_product','show_as_in_stock','hide_when_out_of_stock']);for(const key of Object.keys(f))fields[key]=boolean(f[key]);
  }else if(operation==='priceRules'){
   const rule=priceRule(input);fields.price_action=rule.action;fields.price_value=rule.value;
  }else if(operation==='translations'){
   const f=object(input,['field','translations']);if(!translationFields.includes(f.field as TranslationField))throw new ProductError();const field=f.field as TranslationField,values=object(f.translations),languages=await this.repository.languages(db),normalized:Record<string,string|null>={};
   for(const [code,value]of Object.entries(values)){if(!languages.includes(code))throw new ProductError();normalized[code]=text(value,field);}
   await this.repository.saveTranslations(db,row.id,field,normalized);
  }else if(operation==='gallery'){
   const f=object(input,['items','original']),items=mediaItems(f.items),original=mediaItems(f.original),previous=await this.repository.gallery(db,row.id);
   if(JSON.stringify(original)!==JSON.stringify(previous))throw new ProductError('PRODUCT_CONFLICT',409);
   for(const item of items)if(!previous.some(p=>p.path===item.path)){
    if(!has('media.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
    try{const m=await this.media.inspect(item.path);if(m.folder||m.temporary||!m.image||m.type!=='image'||!m.url)throw Error();}catch{throw new ProductError('PRODUCT_INVALID_MEDIA');}
   }
   await this.repository.saveGallery(db,row.id,items);
  }else if(operation==='discounts'){
   const f=object(input,['items','original']),items=discountIds(f.items),original=discountIds(f.original),previous=(await this.repository.discounts(db,row.id)).map(d=>d.id).sort();
   if(JSON.stringify([...original].sort())!==JSON.stringify(previous))throw new ProductError('PRODUCT_CONFLICT',409);
   if(items.some(d=>!previous.includes(d))&&!has('discounts.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
   const found=await db.query('SELECT id FROM discounts WHERE id=ANY($1::bigint[]) FOR SHARE',[items]);if(found.rowCount!==items.length)throw new ProductError();
   await this.repository.saveDiscounts(db,row.id,items);
  }
  if(['gallery','discounts','translations'].includes(operation))fields.updated_by=actor.id;
  if(!Object.keys(fields).length)throw new ProductError();
  await this.repository.update(db,row.id,fields,actor.id);
  return {row:await this.present(db,await this.repository.get(db,row.id))};
 });}catch(error){if(error instanceof ProductError)throw error;if((error as {code?:string}).code==='23505')throw new ProductError('PRODUCT_CONFLICT',409);throw new ProductError('PRODUCT_SAVE_FAILED',500);}}
}
export const productsService=new ProductsService();

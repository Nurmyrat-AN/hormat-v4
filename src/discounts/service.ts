import type {PoolClient} from 'pg';
import {DiscountsRepository,DiscountError,type DiscountActor,type DiscountRecord} from './repository.js';
export type DiscountOperation='create'|'basic'|'rules'|'translations';
const actions=['addAmount','addPercent','fixed','removeAmount','removePercent'];
function object(value:unknown,allowed?:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||(allowed&&Object.keys(value).some(k=>!allowed.includes(k))))throw new DiscountError('DISCOUNT_INVALID_REQUEST');return value as Record<string,unknown>;}
function name(value:unknown,empty=false){if(typeof value!=='string'||[...value.trim()].length>200||/[\x00-\x1f\x7f]/.test(value)||(!empty&&!value.trim()))throw new DiscountError('DISCOUNT_INVALID_NAME');return value.trim();}
function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new DiscountError('DISCOUNT_NOT_FOUND',404);return value;}
function priority(value:unknown){if(typeof value!=='number'||!Number.isInteger(value)||value < -2147483648||value>2147483647)throw new DiscountError('DISCOUNT_INVALID_PRIORITY');return value;}
function bool(value:unknown){if(typeof value!=='boolean')throw new DiscountError('DISCOUNT_INVALID_REQUEST');return value;}
function timestamp(value:unknown):Date|null{
 if(value===null)return null;
 // Transport is an explicit instant. Browser local datetime controls convert to ISO UTC.
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))throw new DiscountError('DISCOUNT_INVALID_DATES');
 const date=new Date(value);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,19)!==value.slice(0,19))throw new DiscountError('DISCOUNT_INVALID_DATES');return date;
}
function action(value:unknown){if(typeof value!=='string'||!actions.includes(value))throw new DiscountError('DISCOUNT_INVALID_RULE');return value;}
function decimal(value:unknown,kind:string):string|null{
 if(value===null)return null;
 // Decimal strings avoid IEEE floating-point conversion. Bound input size, not stored precision.
 if(typeof value!=='string'||value.length>128||!/^\d+(?:\.\d+)?$/.test(value))throw new DiscountError('DISCOUNT_INVALID_RULE');
 const [whole,fraction='']=value.split('.'),integer=BigInt(whole);
 if(kind.endsWith('Percent')&&(integer>100n||(integer===100n&&/[1-9]/.test(fraction))))throw new DiscountError('DISCOUNT_INVALID_RULE');
 return integer.toString()+(fraction.replace(/0+$/,'')?'.'+fraction.replace(/0+$/,''):'');
}
export class DiscountsService {
 constructor(readonly repository=new DiscountsRepository()){}
 async present(client:PoolClient,rows:DiscountRecord[]){
  const ids=rows.map(row=>row.id),translations=await this.repository.translations(client,ids),counts=await this.repository.counts(client,ids);
  return rows.map(row=>({id:row.id,basic:{name:row.name,priority:String(row.priority),visible:row.is_visible,isVisibleOnProduct:row.is_visible_on_product,starts_at:row.starts_at?.toISOString()??null,ends_at:row.ends_at?.toISOString()??null},rules:{before:{action:row.before_action,value:row.before_value},after:{action:row.after_action,value:row.after_value}},translations:Object.fromEntries(translations.filter(t=>t.discount_id===row.id).map(t=>[t.language_code,t.name])),productCount:counts.get(row.id)??0}));
 }
 async list(actor:DiscountActor,input:unknown){return this.repository.authorized(actor,['discounts.view'],async client=>{
  const f=object(input,['query','visibility','page']),query=f.query??'',visibility=f.visibility??'all',page=f.page??'1';
  if(typeof query!=='string'||query.length>200||!['all','visible','hidden'].includes(visibility as string)||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1)throw new DiscountError('DISCOUNT_INVALID_REQUEST');
  const result=await this.repository.list(client,query.trim(),visibility==='all'?null:visibility==='visible',Number(page));return {...result,rows:await this.present(client,result.rows)};
 });}
 async details(actor:DiscountActor,target:string){return this.repository.authorized(actor,['discounts.view'],async client=>({row:(await this.present(client,[await this.repository.get(client,id(target))]))[0]}));}
 async mutate(actor:DiscountActor,operation:DiscountOperation,target:string|undefined,input:unknown){
  try{return await this.repository.authorized(actor,operation==='create'?['discounts.create']:operation==='basic'?['discounts.update','discounts.visibility']:['discounts.update'],async(client,has)=>{
   if(operation==='create'){
    const f=object(input,['name','priority']),row=await this.repository.create(client,name(f.name),priority(f.priority),actor.id);
    return {row:(await this.present(client,[row]))[0]};
   }
   const row=await this.repository.get(client,id(target??''),true);
   if(operation==='basic'){
    const f=object(input,['name','priority','starts_at','ends_at','is_visible','is_visible_on_product']);if(!Object.keys(f).length)throw new DiscountError('DISCOUNT_INVALID_REQUEST');
    if(Object.keys(f).some(key=>key!=='is_visible')&&!has('discounts.update')||'is_visible'in f&&!has('discounts.visibility'))throw new DiscountError('DISCOUNT_FORBIDDEN',403);
    const next={...row,name:'name'in f?name(f.name):row.name,priority:'priority'in f?priority(f.priority):row.priority,
     starts_at:'starts_at'in f?timestamp(f.starts_at):row.starts_at,ends_at:'ends_at'in f?timestamp(f.ends_at):row.ends_at,
     is_visible:'is_visible'in f?bool(f.is_visible):row.is_visible,is_visible_on_product:'is_visible_on_product'in f?bool(f.is_visible_on_product):row.is_visible_on_product};
    if(next.starts_at&&next.ends_at&&next.starts_at>next.ends_at)throw new DiscountError('DISCOUNT_INVALID_DATES');
    await this.repository.basic(client,next,actor.id);
   }else if(operation==='rules'){
    const f=object(input,['before_action','before_value','after_action','after_value']);if(Object.keys(f).length!==4)throw new DiscountError('DISCOUNT_INVALID_REQUEST');
    const before=action(f.before_action),after=action(f.after_action);
    await this.repository.rules(client,{...row,before_action:before,before_value:decimal(f.before_value,before),after_action:after,after_value:decimal(f.after_value,after)},actor.id);
   }else{
    const f=object(input,['translations']),values=object(f.translations),languages=await this.repository.languages(client);
    if(Object.keys(values).some(code=>!languages.some(language=>language.code===code)))throw new DiscountError('DISCOUNT_INVALID_LANGUAGE');
    await this.repository.saveTranslations(client,row.id,Object.entries(values).map(([code,value])=>[code,name(value,true)]),actor.id);
   }
   return {row:(await this.present(client,[await this.repository.get(client,row.id)]))[0]};
  });}catch(error){if(error instanceof DiscountError)throw error;throw new DiscountError('DISCOUNT_SAVE_FAILED',500);}
 }
}
export const discountsService=new DiscountsService();

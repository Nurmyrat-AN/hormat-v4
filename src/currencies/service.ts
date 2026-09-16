import {lockCurrencyDefault,isDefaultCurrency} from '../settings/repository.js';
import type {PoolClient} from 'pg';
import {CurrenciesRepository,type CurrencyActor,type FrontendCurrency} from './repository.js';
import {CurrencyError,object,text,id,rate,sortOrder,boolean,filters} from './validation.js';
export type CurrencyOperation='create'|'basic'|'translations';
export class CurrenciesService {
 constructor(readonly repository=new CurrenciesRepository()){}
 async present(client:PoolClient,rows:FrontendCurrency[]){const translations=await this.repository.translations(client,rows.map(r=>r.id));return rows.map(row=>({id:row.id,name:row.name,code:row.code,symbol:row.symbol,rate:row.rate,sort:String(row.sort_order),visible:row.is_visible,translations:Object.fromEntries(translations.filter(t=>t.frontend_currency_id===row.id).map(t=>[t.language_code,t.name]))}));}
 async list(actor:CurrencyActor,input:unknown){return this.repository.authorized(actor,['currencies.frontend.view'],async client=>{const f=filters(input,true),result=await this.repository.list(client,f.query,f.visible,f.page);return {...result,rows:await this.present(client,result.rows)};});}
 async details(actor:CurrencyActor,target:string){return this.repository.authorized(actor,['currencies.frontend.view'],async client=>({row:(await this.present(client,[await this.repository.get(client,id(target))]))[0]}));}
 async mutate(actor:CurrencyActor,operation:CurrencyOperation,target:string|undefined,input:unknown){
  try{return await this.repository.authorized(actor,operation==='create'?['currencies.frontend.create']:operation==='basic'?['currencies.frontend.update','currencies.frontend.visibility']:['currencies.frontend.update'],async(client,has)=>{
   if(operation==='create'){
    const f=object(input,['name','code','symbol','rate','sort_order']),row=await this.repository.create(client,{name:text(f.name),code:text(f.code),symbol:text(f.symbol),rate:rate(f.rate??null),sort_order:sortOrder(f.sort_order??0)},actor.id);
    return {row:(await this.present(client,[row]))[0]};
   }
   if(operation==='basic')await lockCurrencyDefault(client);
   const row=await this.repository.get(client,id(target??''),true);
   if(operation==='basic'){
    const f=object(input,['name','code','symbol','rate','sort_order','is_visible']);if(!Object.keys(f).length)throw new CurrencyError('CURRENCY_INVALID_REQUEST');
    if(Object.keys(f).some(key=>key!=='is_visible')&&!has('currencies.frontend.update')||'is_visible'in f&&!has('currencies.frontend.visibility'))throw new CurrencyError('CURRENCY_FORBIDDEN',403);
    if(f.is_visible===false&&await isDefaultCurrency(client,row.id))throw new CurrencyError('CURRENCY_DEFAULT_PROTECTED',409);
    await this.repository.basic(client,{...row,name:'name'in f?text(f.name):row.name,code:'code'in f?text(f.code):row.code,symbol:'symbol'in f?text(f.symbol):row.symbol,rate:'rate'in f?rate(f.rate):row.rate,sort_order:'sort_order'in f?sortOrder(f.sort_order):row.sort_order,is_visible:'is_visible'in f?boolean(f.is_visible):row.is_visible},actor.id);
   }else{
    const f=object(input,['translations']),values=object(f.translations),languages=await this.repository.languages(client);
    if(Object.keys(values).some(code=>!languages.includes(code)))throw new CurrencyError('CURRENCY_INVALID_LANGUAGE');
    await this.repository.saveTranslations(client,row.id,Object.entries(values).map(([code,value])=>[code,text(value,true)]),actor.id);
   }
   return {row:(await this.present(client,[await this.repository.get(client,row.id)]))[0]};
  });}catch(error){if(error instanceof CurrencyError)throw error;throw new CurrencyError('CURRENCY_SAVE_FAILED',500);}
 }
 async vendorList(actor:CurrencyActor,input:unknown){return this.repository.authorized(actor,['currencies.vendor_rates.view'],async client=>{const f=filters(input,false);return this.repository.vendorList(client,f.query,f.page);});}
 async vendorDetails(actor:CurrencyActor,vendor:string,currency:string){return this.repository.authorized(actor,['currencies.vendor_rates.view'],async client=>({row:await this.repository.vendorGet(client,id(vendor),id(currency))}));}
 async saveVendorRate(actor:CurrencyActor,vendor:string,currency:string,input:unknown){try{return await this.repository.authorized(actor,['currencies.vendor_rates.update'],async client=>{
  const f=object(input,['rate']);if(!Object.hasOwn(f,'rate'))throw new CurrencyError('CURRENCY_INVALID_REQUEST');const value=rate(f.rate);
  await this.repository.vendorGet(client,id(vendor),id(currency),true);await this.repository.vendorRate(client,vendor,currency,value,actor.id);return {row:await this.repository.vendorGet(client,vendor,currency)};
 });}catch(error){if(error instanceof CurrencyError)throw error;throw new CurrencyError('CURRENCY_SAVE_FAILED',500);}}
}
export const currenciesService=new CurrenciesService();

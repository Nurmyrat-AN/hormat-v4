import type {PoolClient} from 'pg';
import {SettingsRepository,SettingsError,defaultCurrencyKey,lockCurrencyDefault} from './repository.js';
import {SettingsService} from './typed.js';
import {LanguagesService} from '../languages/service.js';
import {LanguagesRepository,type LanguageActor} from '../languages/repository.js';
import {OptionTypesService} from '../option-types/service.js';
import {OptionTypesRepository} from '../option-types/repository.js';
export class MarketplaceDefaultsService {
 readonly settings:SettingsService;readonly languages:LanguagesService;readonly payment:OptionTypesService;readonly delivery:OptionTypesService;readonly orderStatus:OptionTypesService;
 constructor(readonly repository=new SettingsRepository(),readonly refresh:()=>Promise<void>=async()=>{}){
  this.settings=new SettingsService(repository);this.languages=new LanguagesService(new LanguagesRepository(repository.database));this.payment=new OptionTypesService(new OptionTypesRepository('payment',repository.database));this.delivery=new OptionTypesService(new OptionTypesRepository('delivery',repository.database));this.orderStatus=new OptionTypesService(new OptionTypesRepository('order-status',repository.database));
 }
 private async snapshot(client:PoolClient,language=''){const options=await this.repository.options(client,language),currency=await this.settings.get(defaultCurrencyKey,client);return {options,defaults:{language:options.languages.find(l=>l.is_default)!.code,currency:options.currencies.some(c=>c.id===currency)?currency:null,payment:options.payment.find(p=>p.is_default)?.id??null,delivery:options.delivery.find(d=>d.is_default)?.id??null,orderStatus:options.orderStatus.find(s=>s.is_default)?.id??null}};}
 async read(actor:LanguageActor,language=''){return this.repository.authorized(actor,['settings.view'],client=>this.snapshot(client,language));}
 async save(actor:LanguageActor,input:unknown,language=''){
  let result;
  try{result=await this.repository.authorized(actor,['settings.update'],async client=>{
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==5||Object.keys(input).some(k=>!['language','currency','payment','delivery','orderStatus'].includes(k)))throw new SettingsError('SETTINGS_INVALID');
   const f=input as Record<string,unknown>;
   if(typeof f.language!=='string'||[f.currency,f.payment,f.delivery,f.orderStatus].some(v=>v!==null&&(typeof v!=='string'||! /^[1-9]\d{0,18}$/.test(v))))throw new SettingsError('SETTINGS_INVALID');
   // Stable lock order across composite and domain writes; one commit for all defaults.
   await this.repository.lockRegistry(client);await lockCurrencyDefault(client);await this.payment.repository.lock(client);await this.delivery.repository.lock(client);await this.orderStatus.repository.lock(client);
   const selectedLanguage=await this.languages.repository.get(client,f.language);if(!selectedLanguage.is_active)throw new SettingsError('SETTINGS_INVALID');
   await this.languages.applyDefault(client,f.language);
   if(f.currency===null){if(await this.settings.get(defaultCurrencyKey,client)!==null)throw new SettingsError('SETTINGS_INVALID_CURRENCY');}
   else await this.settings.set(defaultCurrencyKey,f.currency,actor.id,client);
   await this.payment.applyDefault(client,f.payment as string|null,actor.id,true);
   await this.delivery.applyDefault(client,f.delivery as string|null,actor.id,true);
   await this.orderStatus.applyDefault(client,f.orderStatus as string|null,actor.id,true);
   return await this.snapshot(client,language);
  });}catch(error){if(error instanceof SettingsError)throw error;const e=error as {code?:string;status?:number};if(e.code==='LANGUAGE_FORBIDDEN')throw new SettingsError('SETTINGS_FORBIDDEN',403);if(e.code==='LANGUAGE_TRANSLATIONS_INCOMPLETE')throw new SettingsError('SETTINGS_LANGUAGE_INCOMPLETE',409);if(e.status&&e.status<500)throw new SettingsError('SETTINGS_INVALID',e.status);throw new SettingsError('SETTINGS_FAILED',500);}
  try{await this.refresh();return {...result,cacheRefreshed:true};}catch{return {...result,cacheRefreshed:false};}
 }
}

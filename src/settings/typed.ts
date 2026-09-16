import type {PoolClient} from 'pg';
import {SettingsRepository,SettingsError,defaultCurrencyKey,validateDefaultCurrency} from './repository.js';
export type SettingType='string'|'integer'|'decimal'|'boolean'|'json';
export const settingDefinitions:Readonly<Record<string,SettingType>>=Object.freeze({[defaultCurrencyKey]:'integer'});
/** Server-only API. Browser routes never accept arbitrary keys or types. No memory cache. */
export class SettingsService {
 constructor(readonly repository=new SettingsRepository(),readonly definitions=settingDefinitions){}
 private type(key:string){const type=Object.hasOwn(this.definitions,key)?this.definitions[key]:undefined;if(!type)throw new SettingsError('SETTINGS_INVALID');return type;}
 normalize(type:SettingType,value:unknown):unknown{
  if(type==='string'&&typeof value==='string')return value;
  if(type==='boolean'&&typeof value==='boolean')return value;
  if(type==='integer'){
   if(typeof value==='bigint')return value.toString();
   if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
   if(typeof value==='string'&&value.length<=128&&/^-?(0|[1-9]\d*)$/.test(value))return BigInt(value).toString();
  }
  if(type==='decimal'&&typeof value==='string'&&value.length<=128&&/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)){const [head,tail='']=value.split('.');const fractional=tail.replace(/0+$/,'');return (head==='-0'&&!fractional?'0':head)+(fractional?'.'+fractional:'');}
  if(type==='json'){
   const validate=(v:unknown):void=>{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;if(Array.isArray(v)){v.forEach(validate);return;}if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){Object.values(v).forEach(validate);return;}throw new SettingsError('SETTINGS_INVALID');};
   try{validate(value);return JSON.parse(JSON.stringify(value));}catch{throw new SettingsError('SETTINGS_INVALID');}
  }
  throw new SettingsError('SETTINGS_INVALID');
 }
 async get(key:string,client?:PoolClient):Promise<unknown>{const type=this.type(key),read=async(c:PoolClient)=>{const row=await this.repository.getSetting(c,key);if(!row)return null;if(row.type!==type)throw new SettingsError('SETTINGS_INVALID');return this.normalize(type,row.value);};if(client)return read(client);const c=await this.repository.database.connect();try{return await read(c);}finally{c.release();}}
 async set(key:string,value:unknown,actor:string,client?:PoolClient){const type=this.type(key),normalized=this.normalize(type,value);const write=async(c:PoolClient)=>{const previous=await this.repository.getSetting(c,key);if(previous&&previous.type!==type)throw new SettingsError('SETTINGS_INVALID');if(key===defaultCurrencyKey)await validateDefaultCurrency(c,normalized as string);await this.repository.setSetting(c,key,normalized,type,actor);};if(client)return write(client);const c=await this.repository.database.connect();try{await c.query('BEGIN');await write(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 private async typed(key:string,type:SettingType){if(this.type(key)!==type)throw new SettingsError('SETTINGS_INVALID');return this.get(key);}
 async getString(key:string){return await this.typed(key,'string') as string|null;}
 async getInteger(key:string){const v=await this.typed(key,'integer');return v===null?null:BigInt(v as string);}
 async getDecimal(key:string){return await this.typed(key,'decimal') as string|null;}
 async getBoolean(key:string){return await this.typed(key,'boolean') as boolean|null;}
 async getJson(key:string){return this.typed(key,'json');}
}

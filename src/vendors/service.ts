import {vendorEvents, VendorEvents, type VendorChangedField} from './events.js';
import {config} from '../config/env.js';
import {VendorCredentials} from './credentials.js';
import {VendorsRepository,VendorError,type VendorActor,type VendorSearch} from './repository.js';
export type VendorOperation='create'|'update'|'status';
function object(value:unknown,allowed:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new VendorError('VENDOR_INVALID_REQUEST');return value as Record<string,unknown>;}
function text(value:unknown,max:number,code:string){if(typeof value!=='string'||!value.trim()||Array.from(value).length>max||/[\x00-\x1f\x7f]/.test(value))throw new VendorError(code);return value.trim();}
export function normalizeVendorUrl(value:unknown):string {
 const input=text(value,2048,'VENDOR_INVALID_URL');
 try{
  if(!/^https?:\/\//i.test(input)||/[\\\s]/.test(input))throw new Error();
  const url=new URL(input);
  if(!url.hostname||url.username||url.password||url.search||url.hash)throw new Error();
  return url.href;
 }catch{throw new VendorError('VENDOR_INVALID_URL');}
}
function id(value:string){if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw new VendorError('VENDOR_NOT_FOUND',404);return value;}
function active(value:unknown){if(value!==undefined&&value!=='active'&&value!=='inactive')throw new VendorError('VENDOR_INVALID_REQUEST');return value!=='inactive';}
export class VendorsService {
 constructor(readonly repository=new VendorsRepository(),readonly credentials=new VendorCredentials(config.vendors.credentialsKey),readonly events:VendorEvents=vendorEvents){}
 async list(actor:VendorActor,input:unknown){return this.repository.authorized(actor,'vendors.view',async client=>{
  const f=object(input,['query','field','status','page']),query=f.query??'',field=f.field??'name',status=f.status??'active',page=f.page??'1';
  if(typeof query!=='string'||query.length>200||typeof field!=='string'||!['name','url','username','all'].includes(field)||typeof status!=='string'||!['active','inactive','all'].includes(status)||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1)throw new VendorError('VENDOR_INVALID_REQUEST');
  return this.repository.list(client,{query:query.trim(),field,status,page:Number(page)} as VendorSearch);
 });}
 async details(actor:VendorActor,target:string){return this.repository.authorized(actor,'vendors.view',client=>this.repository.get(client,id(target)));}
 async mutate(actor:VendorActor,operation:VendorOperation,target:string|undefined,input:unknown){
  let changedFields:VendorChangedField[]=[];
  try{const result=await this.repository.authorized(actor,`vendors.${operation}`,async client=>{
   const previous=operation!=='create'?await this.repository.get(client,id(target??''),true):undefined;
   const f=object(input,operation==='create'?['name','url','username','password','status']:operation==='update'?['name','url','username','password']:['status']);
   if(operation==='status'){if(f.status===undefined)throw new VendorError('VENDOR_INVALID_REQUEST');const enabled=active(f.status);changedFields=previous?.is_active===enabled?[]:['is_active'];return {row:await this.repository.status(client,target!,enabled),code:enabled?'VENDOR_ACTIVATED':'VENDOR_DEACTIVATED'};}
   const name=text(f.name,200,'VENDOR_INVALID_NAME'),url=normalizeVendorUrl(f.url),username=text(f.username,200,'VENDOR_INVALID_USERNAME');
   const password=f.password??'';
   if(typeof password!=='string'||Buffer.byteLength(password)>16384||password.includes('\0'))throw new VendorError('VENDOR_INVALID_PASSWORD');
   if(operation==='create'&&!password.length)throw new VendorError('VENDOR_PASSWORD_REQUIRED');
   changedFields=operation==='create'?['name','url','username','password','is_active']:([...(previous?.name!==name?['name' as const]:[]),...(previous?.url!==url?['url' as const]:[]),...(previous?.username!==username?['username' as const]:[]),...(password.length?['password' as const]:[])]);
   const encrypted=password.length?this.credentials.encryptSecret(password):null;
   if(operation==='create')return {row:await this.repository.create(client,{name,url,username,encrypted:encrypted!,active:active(f.status)}),code:'VENDOR_CREATED'};
   return {row:await this.repository.update(client,target!,{name,url,username,encrypted}),code:'VENDOR_UPDATED'};
  });
   this.events.publish({vendorId:result.row.id,changeType:operation,changedFields});
   return result;
  }catch(error){if(error instanceof VendorError)throw error;throw new VendorError(operation==='create'?'VENDOR_CREATE_FAILED':operation==='update'?'VENDOR_UPDATE_FAILED':'VENDOR_STATUS_FAILED',500);}
 }
}
export const vendorsService=new VendorsService();

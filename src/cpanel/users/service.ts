import { UsersRepository, type Actor, type Search } from './repository.js';
import { UsersError, UsersCommitError } from './errors.js';
import { hashPassword, meetsPasswordPolicy, normalizeEmail, validEmail } from '../auth/password.js';
import { mediaStore } from '../../media/index.js';
import { MediaError } from '../../media/errors.js';
import { avatarDestination } from '../profile/service.js';
export type Operation = 'create'|'update'|'status'|'change_password';
function object(input:unknown,allowed:string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw new UsersError('invalidRequest');
 return input as Record<string,unknown>;
}
function text(value:unknown,limit:number,code:'invalidName'|'invalidPhone'|'invalidJob',required=false){
 if(typeof value!=='string'||Array.from(value.trim()).length>limit||/[\u0000-\u001f\u007f]/.test(value)||(required&&!value.trim()))throw new UsersError(code);
 return value.trim();
}
function password(fields:Record<string,unknown>){if(!meetsPasswordPolicy(fields.password))throw new UsersError('policy');if(fields.password!==fields.confirm)throw new UsersError('mismatch');return fields.password;}
function active(value:unknown){if(value===undefined)return true;if(value!=='active'&&value!=='inactive')throw new UsersError('invalidRequest');return value==='active';}
export class UsersService {
 constructor(readonly repository=new UsersRepository(),readonly media=mediaStore){}
 async list(actor:Actor,input:unknown){
  return this.repository.authorized(actor,'users.view',undefined,async client=>{
   const f=object(input,['query','field','status','page']);
   const query=f.query??'',field=f.field??'name',status=f.status??'active',page=f.page??'1';
   if(typeof query!=='string'||query.length>200||!['name','email','phone','job','all'].includes(String(field))||typeof field!=='string'||!['active','inactive','all'].includes(String(status))||typeof status!=='string'||typeof page!=='string'||!/^\d{1,7}$/.test(page)||Number(page)<1)throw new UsersError('invalidRequest');
   return this.repository.list(client,{query:query.trim(),field,status,page:Number(page)} as Search);
  });
 }
 async mutate(actor:Actor,operation:Operation,targetId:string|undefined,input:unknown){
  if(targetId!==undefined&&(!/^[1-9]\d{0,18}$/.test(targetId)||BigInt(targetId)>9223372036854775807n))throw new UsersError('notFound',404);
  if(operation!=='create'&&!targetId)throw new UsersError('notFound',404);
  let newUrl:string|null=null,oldUrl:string|null=null;
  try{
   const result=await this.repository.authorized(actor,`users.${operation}`,targetId,async(client,target)=>{
    const allowed=operation==='create'?['name','phone','job','email','password','confirm','status','avatarCacheToken']:operation==='update'?['name','phone','job','email','avatarCacheToken']:operation==='status'?['status']:['password','confirm'];
    const fields=object(input,['_csrf',...allowed]);
    if(operation==='status'){
     if(fields.status===undefined)throw new UsersError('invalidRequest');
     const next=active(fields.status);if(!next&&actor.id===targetId)throw new UsersError('selfDeactivate',403);
     await this.repository.status(client,targetId!,next);return {id:targetId!,code:next?'activated':'deactivated'};
    }
    if(operation==='change_password'){
     await this.repository.password(client,targetId!,await hashPassword(password(fields)));return {id:targetId!,code:'passwordChanged'};
    }
    const name=text(fields.name,200,'invalidName',true),phone=text(fields.phone??'',50,'invalidPhone')||null,job=text(fields.job??'',200,'invalidJob')||null;
    if(typeof fields.email!=='string'||!validEmail(normalizeEmail(fields.email)))throw new UsersError('invalidEmail');
    const email=normalizeEmail(fields.email);
    const hash=operation==='create'?await hashPassword(password(fields)):'';
    const enabled=operation==='create'?active(fields.status):true;
    const token=fields.avatarCacheToken;
    if(token!=null&&(typeof token!=='string'||!token||token.length>100))throw new UsersError('avatarFailed');
    oldUrl=target?.avatar_url??null;
    if(typeof token==='string')newUrl=(await this.media.finalizeCachedMedia({cacheToken:token,destination:avatarDestination,ownerId:actor.id})).url;
    const data={name,phone,job,email,avatar:newUrl??oldUrl};
    if(operation==='create')return {id:await this.repository.create(client,{...data,hash,active:enabled}),code:'created'};
    await this.repository.update(client,targetId!,data);return {id:targetId!,code:'updated'};
   });
   if(newUrl&&oldUrl&&newUrl!==oldUrl)await this.media.deleteManagedFile(oldUrl,avatarDestination).catch(()=>console.error('Users old avatar cleanup failed; reconciliation required'));
   return result;
  }catch(error){
   if(newUrl&&!(error instanceof UsersCommitError))await this.media.deleteManagedFile(newUrl,avatarDestination).catch(()=>console.error('Users avatar compensation failed; reconciliation required'));
   if(newUrl&&error instanceof UsersCommitError)console.error('Users commit outcome unknown; media retained for reconciliation');
   if(error instanceof UsersError)throw error;
   if(error instanceof MediaError)throw new UsersError('avatarFailed');
   if((error as {code?:string}).code==='23505')throw new UsersError('duplicateEmail',409);
   throw new UsersError('failure',500);
  }
 }
}
export const usersService=new UsersService();

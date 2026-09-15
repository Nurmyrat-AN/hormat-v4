import type { RequestHandler,Response } from 'express';
import { usersService,type Operation } from '../../cpanel/users/service.js';
import { UsersError } from '../../cpanel/users/errors.js';
import { userView } from '../../cpanel/users/presentation.js';
export const usersActor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
function messages(response:Response){const t=response.locals.t;return {
 forbidden:t('cpanel.auth.forbidden'),invalidRequest:t('errors.invalidRequest'),invalidName:t('cpanel.profile.invalidName'),invalidPhone:t('cpanel.profile.invalidPhone'),
 invalidJob:t('cpanel.users.invalidJob'),invalidEmail:t('cpanel.users.invalidEmail'),policy:t('cpanel.password.policy'),mismatch:t('cpanel.password.mismatch'),
 duplicateEmail:t('cpanel.users.duplicateEmail'),notFound:t('cpanel.users.notFound'),protected:t('cpanel.users.protected'),selfDeactivate:t('cpanel.users.selfDeactivate'),
 avatarFailed:t('cpanel.profile.avatarFailed'),failure:t('cpanel.users.failure'),created:t('cpanel.users.created'),updated:t('cpanel.users.updated'),
 activated:t('cpanel.users.activated'),deactivated:t('cpanel.users.deactivated'),passwordChanged:t('cpanel.users.passwordChanged')};}
export function usersFailure(response:Response,error:unknown){const e=error instanceof UsersError?error:new UsersError('failure',500);response.status(e.status).json({success:false,code:e.code,message:messages(response)[e.code]});}
export const listUsers:RequestHandler=async(request,response)=>{try{
 const result=await usersService.list(usersActor(response),request.query);response.json({success:true,...result,rows:result.rows.map(userView)});
}catch(error){usersFailure(response,error);}};
export const mutateUser=(operation:Operation):RequestHandler=>async(request,response)=>{
 const input=request.body;request.body=undefined;
 try{
  if(Object.keys(request.query).length)throw new UsersError('invalidRequest');
  const result=await usersService.mutate(usersActor(response),operation,request.params.id as string|undefined,input);
  response.status(operation==='create'?201:200).json({success:true,...result,message:messages(response)[result.code as keyof ReturnType<typeof messages>]});
 }catch(error){usersFailure(response,error);}
};

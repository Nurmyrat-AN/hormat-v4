import type { RequestHandler } from 'express';
import { usersService } from '../../cpanel/users/service.js';
import { userView } from '../../cpanel/users/presentation.js';
import { usersActor,usersFailure } from './users-api.js';
export const users: RequestHandler = async (_request,response) => {
 try {
 const t=response.locals.t;
 const result=await usersService.list(usersActor(response),{});
 const rows=result.rows.map(userView);
 const capabilities={create:await response.locals.permissions.hasPermission('users.create'),update:await response.locals.permissions.hasPermission('users.update'),status:await response.locals.permissions.hasPermission('users.status'),password:await response.locals.permissions.hasPermission('users.change_password')};
 const fields=[{key:'name',label:t('cpanel.profile.fields.name'),type:'text'},{key:'phone',label:t('cpanel.profile.fields.phone'),type:'tel'},{key:'job',label:t('cpanel.profile.fields.job'),type:'text'},{key:'email',label:t('cpanel.profile.fields.email'),type:'email'}];
 const dialogs=[{kind:'add',title:t('cpanel.users.add'),action:t('cpanel.users.add'),avatar:true,fields,password:true},
  {kind:'edit',title:t('cpanel.users.edit'),action:t('cpanel.profile.actions.save'),avatar:true,fields,password:false},
  {kind:'status',title:t('cpanel.users.changeStatus'),action:t('cpanel.users.deactivate'),avatar:false,fields:[],password:false},
  {kind:'password',title:t('cpanel.profile.tabs.password'),action:t('cpanel.profile.tabs.password'),avatar:false,fields:[],password:true}];
 response.render('cpanel/pages/users',{rows,fields,dialogs,capabilities,total:result.total,actorId:response.locals.cpanelUser!.id,
  pageActions:[]});
 }catch(error){usersFailure(response,error);}
};

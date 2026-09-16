import type {RequestHandler} from 'express';
import {categoriesService} from '../../categories/service.js';
import {categoryActor,categoryFailure} from './categories-api.js';
export const categories:RequestHandler=async(_request,response)=>{
 try{const permissions=response.locals.permissions,result=await categoriesService.list(categoryActor(response),{});
 response.render('cpanel/pages/categories',{...result,capabilities:{
  create:await permissions.hasPermission('categories.create'),update:await permissions.hasPermission('categories.update'),visibility:await permissions.hasPermission('categories.visibility'),
  mediaView:await permissions.hasPermission('media.view'),mediaUpload:await permissions.hasPermission('media.upload'),
 }});}catch(error){categoryFailure(response,error);}
};

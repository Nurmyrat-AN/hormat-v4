import type {RequestHandler} from 'express';
import {brandsService} from '../../brands/service.js';
import {brandActor,brandFailure} from './brands-api.js';
export const brands:RequestHandler=async(_request,response)=>{
 try{const permissions=response.locals.permissions,result=await brandsService.list(brandActor(response),{});
 response.render('cpanel/pages/brands',{
  ...result,
  capabilities:{productView:await permissions.hasPermission('products.view'),mediaView:await permissions.hasPermission('media.view'),mediaUpload:await permissions.hasPermission('media.upload'),create:await permissions.hasPermission('brands.create'),update:await permissions.hasPermission('brands.update'),visibility:await permissions.hasPermission('brands.visibility')},
 });}catch(error){brandFailure(response,error);}
};

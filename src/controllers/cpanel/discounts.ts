import type {RequestHandler} from 'express';
import {discountsService} from '../../discounts/service.js';
import {discountActor,discountFailure} from './discounts-api.js';
export const discounts:RequestHandler=async(_request,response)=>{
 try{const permissions=response.locals.permissions;
 const result=await discountsService.list(discountActor(response),{});
 response.render('cpanel/pages/discounts',{...result,capabilities:{productView:await permissions.hasPermission('products.view'),
  create:await permissions.hasPermission('discounts.create'),
  update:await permissions.hasPermission('discounts.update'),
  visibility:await permissions.hasPermission('discounts.visibility'),
 }});}catch(error){discountFailure(response,error);}
};

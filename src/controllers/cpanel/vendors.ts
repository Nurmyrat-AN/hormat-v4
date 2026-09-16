import type {RequestHandler} from 'express';
import {vendorsService} from '../../vendors/service.js';
import {vendorActor,vendorView,vendorFailure} from './vendors-api.js';
export const vendors:RequestHandler=async(_request,response)=>{
 try { const permissions=response.locals.permissions,result=await vendorsService.list(vendorActor(response),{});
 response.render('cpanel/pages/vendors',{
  rows:result.rows.map(row=>vendorView(response,row)),total:result.total,
  capabilities:{reset_sync:await permissions.hasPermission('vendors.reset_sync'),create:await permissions.hasPermission('vendors.create'),update:await permissions.hasPermission('vendors.update'),status:await permissions.hasPermission('vendors.status')},
 }); } catch(error){vendorFailure(response,error);}
};

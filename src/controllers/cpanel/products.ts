import type {RequestHandler} from 'express';
/** Persistent Product editor shell; the temporary list loads through its read API. */
export const productsPage:RequestHandler=async(_request,response)=>{
 const permissions=response.locals.permissions;
 response.render('cpanel/pages/products',{capabilities:{
 create:await permissions.hasPermission('products.create'),
 update:await permissions.hasPermission('products.update'),
 visibility:await permissions.hasPermission('products.visibility'),
 discountView:await permissions.hasPermission('discounts.view'),mediaView:await permissions.hasPermission('media.view'),
 mediaUpload:await permissions.hasPermission('media.upload'),
 }});
};

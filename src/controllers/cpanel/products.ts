import type {RequestHandler} from 'express';
/** UI review only: no Product persistence or source synchronization. */
export const productsPage:RequestHandler=async(_request,response)=>{
 const permissions=response.locals.permissions;
 response.render('cpanel/pages/products',{capabilities:{
 create:await permissions.hasPermission('products.create'),
 update:await permissions.hasPermission('products.update'),
 visibility:await permissions.hasPermission('products.visibility'),
 mediaView:await permissions.hasPermission('media.view'),
 mediaUpload:await permissions.hasPermission('media.upload'),
 }});
};

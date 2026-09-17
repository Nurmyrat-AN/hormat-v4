import type {RequestHandler} from 'express';
/** Read-only browser shell; query endpoints read synchronized PostgreSQL data. */
export const sourceProductsPage:RequestHandler=async(_request,response)=>{
 const permissions=response.locals.permissions;
 const capabilities={view:await permissions.hasPermission('products.view'),create:await permissions.hasPermission('products.create'),update:await permissions.hasPermission('products.update'),visibility:await permissions.hasPermission('products.visibility'),discountView:await permissions.hasPermission('discounts.view'),mediaView:await permissions.hasPermission('media.view'),mediaUpload:await permissions.hasPermission('media.upload')};
 response.render('cpanel/pages/source-products',{canCreateProduct:capabilities.create,capabilities});
};

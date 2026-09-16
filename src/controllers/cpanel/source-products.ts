import type {RequestHandler} from 'express';
/** Read-only browser shell; query endpoints read synchronized PostgreSQL data. */
export const sourceProductsPage:RequestHandler=(_request,response)=>{
 response.render('cpanel/pages/source-products');
};

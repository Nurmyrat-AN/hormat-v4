import type {RequestHandler} from 'express';
export const frontendCurrencies:RequestHandler=async(_request,response)=>{
 const permissions=response.locals.permissions;
 response.render('cpanel/pages/currencies',{mode:'frontend',capabilities:{create:await permissions.hasPermission('currencies.frontend.create'),update:await permissions.hasPermission('currencies.frontend.update'),visibility:await permissions.hasPermission('currencies.frontend.visibility')}});
};
export const vendorCurrencies:RequestHandler=async(_request,response)=>{
 response.render('cpanel/pages/currencies',{mode:'vendors',capabilities:{update:await response.locals.permissions.hasPermission('currencies.vendor_rates.update')}});
};

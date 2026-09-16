import type {RequestHandler} from 'express';
export const optionTypes=(mode:'payment'|'delivery'|'order-status'):RequestHandler=>async(_request,response)=>{
 const permissions=response.locals.permissions;
 const capabilities=mode==='order-status'?{create:await permissions.hasPermission('order_statuses.create'),update:await permissions.hasPermission('order_statuses.update'),visibility:await permissions.hasPermission('order_statuses.visibility')}:mode==='payment'?{
  create:await permissions.hasPermission('payment_types.create'),update:await permissions.hasPermission('payment_types.update'),visibility:await permissions.hasPermission('payment_types.visibility'),
 }:{create:await permissions.hasPermission('delivery_types.create'),update:await permissions.hasPermission('delivery_types.update'),visibility:await permissions.hasPermission('delivery_types.visibility')};
 response.render('cpanel/pages/option-types',{mode,capabilities:{...capabilities,mediaView:await permissions.hasPermission('media.view'),mediaUpload:await permissions.hasPermission('media.upload')}});
};

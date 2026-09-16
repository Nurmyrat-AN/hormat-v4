import {Router,json,type ErrorRequestHandler} from 'express';
import {requireCpanelAuth,requirePermission,requireCsrf} from '../../cpanel/auth/http.js';
import {listDiscounts,detailDiscount,mutateDiscount} from '../../controllers/cpanel/discounts-api.js';
export const discountsApi=Router();
discountsApi.use(requireCpanelAuth);
discountsApi.get('/',requirePermission('discounts.view'),listDiscounts);
discountsApi.get('/:id',requirePermission('discounts.view'),detailDiscount);
discountsApi.use(requireCsrf,json({limit:'32kb'}));
discountsApi.post('/',requirePermission('discounts.create'),mutateDiscount('create'));
// Basic has two independent permissions; the service checks each submitted field.
discountsApi.patch('/:id',mutateDiscount('basic'));
discountsApi.patch('/:id/rules',requirePermission('discounts.update'),mutateDiscount('rules'));
discountsApi.put('/:id/translations',requirePermission('discounts.update'),mutateDiscount('translations'));
const invalid:ErrorRequestHandler=(error,_request,response,next)=>{if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large'){response.status(400).json({success:false,code:'DISCOUNT_INVALID_REQUEST'});return;}next(error);};
discountsApi.use(invalid);

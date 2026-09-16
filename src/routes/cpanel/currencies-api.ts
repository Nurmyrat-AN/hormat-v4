import {Router,json,type ErrorRequestHandler} from 'express';
import {requireCpanelAuth,requirePermission,requireCsrf} from '../../cpanel/auth/http.js';
import {listFrontend,detailFrontend,mutateFrontend,listVendor,detailVendor,saveVendor} from '../../controllers/cpanel/currencies-api.js';
export const currenciesApi=Router();
currenciesApi.use(requireCpanelAuth);
currenciesApi.get('/frontend',requirePermission('currencies.frontend.view'),listFrontend);
currenciesApi.get('/frontend/:id',requirePermission('currencies.frontend.view'),detailFrontend);
currenciesApi.get('/vendors',requirePermission('currencies.vendor_rates.view'),listVendor);
currenciesApi.get('/vendors/:vendor/:id',requirePermission('currencies.vendor_rates.view'),detailVendor);
currenciesApi.use(requireCsrf,json({limit:'32kb'}));
currenciesApi.post('/frontend',requirePermission('currencies.frontend.create'),mutateFrontend('create'));
// Field-level update/visibility authority is independently rechecked in the transaction.
currenciesApi.patch('/frontend/:id',mutateFrontend('basic'));
currenciesApi.put('/frontend/:id/translations',requirePermission('currencies.frontend.update'),mutateFrontend('translations'));
currenciesApi.put('/vendors/:vendor/:id',requirePermission('currencies.vendor_rates.update'),saveVendor);
const invalid:ErrorRequestHandler=(error,_request,response,next)=>{if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large'){response.status(400).json({success:false,code:'CURRENCY_INVALID_REQUEST'});return;}next(error);};
currenciesApi.use(invalid);

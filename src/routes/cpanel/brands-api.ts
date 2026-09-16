import {Router,json,type ErrorRequestHandler} from 'express';
import {requireCpanelAuth,requirePermission,requireCsrf} from '../../cpanel/auth/http.js';
import {listBrands,detailBrand,mutateBrand} from '../../controllers/cpanel/brands-api.js';
export const brandsApi=Router();
brandsApi.use(requireCpanelAuth);
brandsApi.get('/',requirePermission('brands.view'),listBrands);
brandsApi.get('/:id',requirePermission('brands.view'),detailBrand);
brandsApi.use(requireCsrf,json({limit:'512kb'}));
brandsApi.post('/',requirePermission('brands.create'),mutateBrand('create'));
// Basic has two independent permissions; the service checks each submitted field.
brandsApi.patch('/:id',mutateBrand('basic'));
brandsApi.patch('/:id/seo',requirePermission('brands.update'),mutateBrand('seo'));
brandsApi.put('/:id/translations',requirePermission('brands.update'),mutateBrand('translations'));
brandsApi.put('/:id/gallery',requirePermission('brands.update'),mutateBrand('gallery'));
const invalid:ErrorRequestHandler=(error,_request,response,next)=>{if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large'){response.status(400).json({success:false,code:'BRAND_INVALID_REQUEST'});return;}next(error);};
brandsApi.use(invalid);

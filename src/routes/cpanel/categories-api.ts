import {Router,json,type ErrorRequestHandler} from 'express';
import {requireCpanelAuth,requirePermission,requireCsrf} from '../../cpanel/auth/http.js';
import {listCategories,detailCategory,mutateCategory} from '../../controllers/cpanel/categories-api.js';
export const categoriesApi=Router();
categoriesApi.use(requireCpanelAuth);
categoriesApi.get('/',requirePermission('categories.view'),listCategories);
categoriesApi.get('/:id',requirePermission('categories.view'),detailCategory);
categoriesApi.use(requireCsrf,json({limit:'512kb'}));
categoriesApi.post('/',requirePermission('categories.create'),mutateCategory('create'));
// Basic has two independent permissions; the service checks each submitted field.
categoriesApi.patch('/:id',mutateCategory('basic'));
categoriesApi.patch('/:id/seo',requirePermission('categories.update'),mutateCategory('seo'));
categoriesApi.put('/:id/translations',requirePermission('categories.update'),mutateCategory('translations'));
categoriesApi.put('/:id/gallery',requirePermission('categories.update'),mutateCategory('gallery'));
const invalid:ErrorRequestHandler=(error,_request,response,next)=>{if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large'){response.status(400).json({success:false,code:'CATEGORY_INVALID_REQUEST'});return;}next(error);};
categoriesApi.use(invalid);

import { Router, json, type ErrorRequestHandler } from 'express';
import { requireCpanelAuth, requireCsrf, requirePermission } from '../../cpanel/auth/http.js';
import { mediaMutation, mediaDeleteInfo, mediaMoveFolders } from '../../controllers/cpanel/media-mutations.js';
export const mediaApi = Router();
mediaApi.use(requireCpanelAuth);
mediaApi.get('/move-folders',requirePermission('media.move'),mediaMoveFolders);
mediaApi.post('/move',requirePermission('media.move'),requireCsrf,json({limit:'8kb'}),mediaMutation('move'));
mediaApi.get('/delete-info',requirePermission('media.view'),requirePermission('media.delete'),mediaDeleteInfo);
// CSRF and permission are checked before streaming multipart or parsing mutation JSON.
mediaApi.post('/files',requirePermission('media.upload'),requireCsrf,mediaMutation('files'));
mediaApi.post('/folders',requirePermission('media.create_folder'),requireCsrf,json({limit:'8kb'}),mediaMutation('folders'));
mediaApi.post('/rename',requirePermission('media.rename'),requireCsrf,json({limit:'8kb'}),mediaMutation('rename'));
mediaApi.post('/delete',requirePermission('media.delete'),requireCsrf,json({limit:'8kb'}),mediaMutation('delete'));
const invalid: ErrorRequestHandler = (error,_request,response,next) => {
 if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large') {response.status(400).json({success:false,error:{code:'MEDIA_INVALID_PATH'}});return;}
 next(error);
};
mediaApi.use(invalid);

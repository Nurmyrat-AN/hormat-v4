import {Router,json,type ErrorRequestHandler} from 'express';
import {requireCpanelAuth,requirePermission,requireCsrf} from '../../cpanel/auth/http.js';
import {settingsSave} from '../../controllers/cpanel/settings.js';
export const settingsApi=Router();
settingsApi.use(requireCpanelAuth,requireCsrf,json({limit:'8kb'}));
settingsApi.put('/defaults',requirePermission('settings.update'),settingsSave);
const invalid:ErrorRequestHandler=(error,_request,response,next)=>{if(['entity.parse.failed','entity.too.large'].includes(error?.type)){response.status(400).json({success:false,code:'SETTINGS_INVALID'});return;}next(error);};settingsApi.use(invalid);

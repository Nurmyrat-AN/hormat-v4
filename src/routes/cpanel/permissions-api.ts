import { Router, json, type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireCpanelAuth,requireCsrf,requirePermission } from '../../cpanel/auth/http.js';
import { savePermissions } from '../../controllers/cpanel/permissions-api.js';
import { rejectDuplicateJsonKeys } from '../../cpanel/permissions/json.js';
export const permissionsApi=Router();
const saveLimit=rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:'draft-8',legacyHeaders:false,
  keyGenerator:(_request,response)=>response.locals.cpanelUser!.id,
  handler:(_request,response)=>{response.status(429).json({success:false,message:response.locals.t('cpanel.auth.tooManyAttempts')});},
});
permissionsApi.post('/:userId',requireCpanelAuth,requirePermission('permissions.update'),requireCsrf,saveLimit,json({limit:'16kb',verify:(_request,_response,buffer,encoding)=>{if(encoding!=='utf-8')throw new Error('Expected UTF-8 JSON');rejectDuplicateJsonKeys(buffer.toString('utf8'));}}),savePermissions);
const invalidJson: ErrorRequestHandler=(error,_request,response,next)=>{
  if(['entity.parse.failed','entity.verify.failed','entity.too.large','charset.unsupported','encoding.unsupported'].includes(error?.type)){
    response.status(error.type==='entity.too.large'?413:400).json({success:false,message:response.locals.t('errors.invalidRequest')});return;
  }
  next(error);
};
permissionsApi.use(invalidJson);

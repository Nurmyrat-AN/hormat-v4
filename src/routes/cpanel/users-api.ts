import { Router,json,type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireCpanelAuth,requireCsrf,requirePermission } from '../../cpanel/auth/http.js';
import { listUsers,mutateUser } from '../../controllers/cpanel/users-api.js';
export const usersApi=Router();
usersApi.use(requireCpanelAuth);
usersApi.get('/',requirePermission('users.view'),listUsers);
const mutationLimit=rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:'draft-8',legacyHeaders:false,
 keyGenerator:(_request,response)=>response.locals.cpanelUser!.id,
 handler:(_request,response)=>{response.status(429).json({success:false,code:'limited',message:response.locals.t('cpanel.auth.tooManyAttempts')});}});
usersApi.use(json({limit:'16kb'}),requireCsrf);
usersApi.post('/',requirePermission('users.create'),mutationLimit,mutateUser('create'));
usersApi.patch('/:id',requirePermission('users.update'),mutationLimit,mutateUser('update'));
usersApi.post('/:id/status',requirePermission('users.status'),mutationLimit,mutateUser('status'));
usersApi.post('/:id/password',requirePermission('users.change_password'),mutationLimit,mutateUser('change_password'));

const invalidJson:ErrorRequestHandler=(error,_request,response,next)=>{
 if(error?.type==='entity.parse.failed'||error?.type==='entity.too.large'){
  response.status(error.type==='entity.too.large'?413:400).json({success:false,code:'invalidRequest',message:response.locals.t('errors.invalidRequest')});return;
 }
 next(error);
};
usersApi.use(invalidJson);

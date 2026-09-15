import type { RequestHandler, Response } from 'express';
import { PermissionsError } from '../../cpanel/permissions/errors.js';
import { permissionsService } from '../../cpanel/permissions/service.js';

export function permissionsFailure(response: Response,error: unknown) {
  const failure = error instanceof PermissionsError ? error : new PermissionsError('failure',500);
  const t = response.locals.t;
  const messages = { forbidden:t('cpanel.auth.forbidden'), protected:t('cpanel.permissions.protected'), selfEdit:t('cpanel.permissions.selfEdit'),
    notFound:t('cpanel.users.notFound'), invalidRequest:t('errors.invalidRequest'), failure:t('cpanel.permissions.saveFailed') };
  response.status(failure.status).json({success:false,code:failure.code,message:messages[failure.code]});
}
export const savePermissions: RequestHandler = async(request,response) => {
  const input = request.body; request.body = undefined;
  try {
    if(Object.keys(request.query).length)throw new PermissionsError('invalidRequest');
    const result = await permissionsService.save({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash},request.params.userId,input);
    response.json({success:true,...result,message:response.locals.t('cpanel.permissions.saved')});
  } catch(error) { permissionsFailure(response,error); }
};

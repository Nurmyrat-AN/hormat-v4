import type { RequestHandler } from 'express';
import { MediaManager, ManagerError, managerError } from '../../cpanel/media/mutations.js';
import { pool } from '../../database/pool.js';
import { PermissionContext } from '../../cpanel/auth/permissions.js';
const manager = new MediaManager();
type Action = 'files' | 'folders' | 'rename' | 'delete';
const permissions = {files:'media.upload',folders:'media.create_folder',rename:'media.rename',delete:'media.delete'};
const failures = {files:'MEDIA_UPLOAD_FAILED',folders:'MEDIA_CREATE_FOLDER_FAILED',rename:'MEDIA_RENAME_FAILED',delete:'MEDIA_DELETE_FAILED'};
export const mediaMutation = (action: Action): RequestHandler => async (request,response) => {
 const authorize = async () => {
  const user = response.locals.cpanelUser!, session = response.locals.cpanelSession!;
  const active = await pool.query(`SELECT 1 FROM cpanel_sessions s JOIN cpanel_user_auth a ON a.user_id=s.user_id
   WHERE s.token_hash=$1 AND s.user_id=$2 AND s.expires_at>now() AND a.is_active=true`,[session.token_hash,user.id]);
  if(!active.rowCount || !await new PermissionContext(user.id).hasPermission(permissions[action])) throw new ManagerError('MEDIA_PERMISSION_DENIED',403);
 };
 try {
  await authorize();
  let item;
  if(action === 'files') {
   if(Object.keys(request.query).some(k=>k!=='path') || typeof request.query.path !== 'string') throw new ManagerError('MEDIA_INVALID_PATH');
   item = await manager.uploadToFolder(request,request.query.path,authorize);
  } else {
   const allowed = action === 'folders' ? ['parent','name'] : action === 'rename' ? ['path','name'] : ['path','recursive'];
   const body = request.body;
   if(Object.keys(request.query).length || !body || Array.isArray(body) || Object.keys(body).length !== allowed.length || Object.keys(body).some(k=>!allowed.includes(k)) || allowed.some(k=>typeof body[k] !== (k==='recursive'?'boolean':'string'))) throw new ManagerError('MEDIA_INVALID_PATH');
   item = action === 'folders' ? await manager.createFolder(body.parent,body.name) : action === 'rename' ? await manager.renameItem(body.path,body.name) : await manager.deleteItem(body.path,body.recursive);
  }
  response.status(action==='files'||action==='folders'?201:200).json({success:true,item});
 } catch(error) {
  request.resume(); const failure = managerError(error,failures[action]);
  if(!response.headersSent && !response.destroyed) response.status(failure.status).json({success:false,error:{code:failure.code}});
 }
};
export const mediaDeleteInfo: RequestHandler = async(request,response) => {
 try {
  if(Object.keys(request.query).length!==1 || typeof request.query.path!=='string') throw new ManagerError('MEDIA_INVALID_PATH');
  response.json({success:true,item:await manager.deleteInfo(request.query.path)});
 } catch(error) {const failure=managerError(error,'MEDIA_DELETE_FAILED');response.status(failure.status).json({success:false,error:{code:failure.code}});}
};

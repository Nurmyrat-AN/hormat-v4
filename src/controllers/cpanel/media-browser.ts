import type {RequestHandler} from 'express';
import {mediaBrowser,BrowseError} from '../../cpanel/media/browser.js';
export const browseMedia:RequestHandler=async(request,response)=>{
 const values={path:request.query.path??'',query:request.query.query??'',scope:request.query.scope??'all',sort:request.query.sort??'name',select:request.query.select??''};
 if(Object.keys(request.query).some(k=>!['path','query','scope','sort','select','partial'].includes(k))||Object.values(values).some(v=>typeof v!=='string')||String(values.query).length>200||!['all','current'].includes(String(values.scope))||!['name','modified','size','type'].includes(String(values.sort))){response.status(400).send(response.locals.t('errors.invalidRequest'));return;}
 const {path,query,scope,sort,select}=values as Record<keyof typeof values,string>;
 const abort=new AbortController();response.on('close',()=>abort.abort());
 try{
  if(select){await mediaBrowser.resolve(select);if(select.split('/').slice(0,-1).join('/')!==path)throw new BrowseError(400);}
  const result=await mediaBrowser.list(path,query.trim(),scope,sort,abort.signal);
  if(abort.signal.aborted)return;
  const href=(location:string,selection='')=>'/cpanel/media?'+new URLSearchParams({path:location,...(selection?{select:selection}:{})});
  const breadcrumbs=[{name:response.locals.t('cpanel.navigation.media'),href:href('')}];let location='';
  for(const name of path.split('/').filter(Boolean)){location=[location,name].filter(Boolean).join('/');breadcrumbs.push({name,href:href(location)});}
  const capabilities={upload:await response.locals.permissions.hasPermission('media.upload'),new:await response.locals.permissions.hasPermission('media.create_folder'),rename:await response.locals.permissions.hasPermission('media.rename'),delete:await response.locals.permissions.hasPermission('media.delete')};
  response.render(request.query.partial==='1'?'cpanel/pages/media-results':'cpanel/pages/media',{...result,query,searchScope:scope,sort,href,breadcrumbs,capabilities,selectedPath:select});
 }catch(error){const status=readStatus(error);response.status(status).render(request.query.partial==='1'?'cpanel/pages/media-error-content':'cpanel/pages/media-error',{notFound:status===404});}
};

function readStatus(error:unknown){
 if(error instanceof BrowseError)return error.status;
 const code=(error as NodeJS.ErrnoException).code;
 return code==='ENOENT'||code==='ENOTDIR'?404:code==='EACCES'||code==='EPERM'?403:500;
}
export const inspectMedia:RequestHandler=async(request,response)=>{
 if(typeof request.query.path!=='string'||Object.keys(request.query).some(key=>key!=='path')){response.status(400).json({success:false,message:response.locals.t('errors.invalidRequest')});return;}
 try{response.json({success:true,item:await mediaBrowser.inspect(request.query.path)});}
 catch(error){const status=readStatus(error);response.status(status).json({success:false,message:status===404?response.locals.t('cpanel.media.notFound'):response.locals.t('cpanel.media.failed')});}
};

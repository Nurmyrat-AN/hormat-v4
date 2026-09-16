import type {RequestHandler,Response} from 'express';
import {marketplaceDefaults} from '../../settings/index.js';
import {SettingsError} from '../../settings/repository.js';
const actor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
export const settingsPage:RequestHandler=async(_request,response)=>{response.render('cpanel/pages/settings',{data:await marketplaceDefaults.read(actor(response),response.locals.language),canUpdate:await response.locals.permissions.hasPermission('settings.update')});};
export const settingsSave:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new SettingsError('SETTINGS_INVALID');response.json({success:true,...await marketplaceDefaults.save(actor(response),request.body,response.locals.language)});}catch(error){const e=error instanceof SettingsError?error:new SettingsError('SETTINGS_FAILED',500);response.status(e.status).json({success:false,code:e.code});}};

import type {RequestHandler,Response} from 'express';
import {translationService} from '../../interface-translations/index.js';
import {TranslationError} from '../../interface-translations/validation.js';
const actor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
const failure=(response:Response,error:unknown)=>{const e=error instanceof TranslationError?error:new TranslationError('TRANSLATION_FAILED',500);response.status(e.status).json({success:false,code:e.code});};
export const interfaceTranslationsPage:RequestHandler=async(_request,response)=>{
 response.render('cpanel/pages/interface-translations',{canUpdate:await response.locals.permissions.hasPermission('interface_translations.update')});
};
export const listTranslations:RequestHandler=async(request,response)=>{try{response.json({success:true,...await translationService.list(actor(response),request.query)});}catch(e){failure(response,e);}};
export const detailTranslation:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new TranslationError('TRANSLATION_INVALID');response.json({success:true,...await translationService.detail(actor(response),request.params.key as string)});}catch(e){failure(response,e);}};
export const saveTranslation:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new TranslationError('TRANSLATION_INVALID');response.json({success:true,...await translationService.save(actor(response),request.params.key as string,request.body)});}catch(e){failure(response,e);}};

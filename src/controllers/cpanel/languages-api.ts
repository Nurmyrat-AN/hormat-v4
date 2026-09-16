import {localization} from '../../localization/index.js';
import {readLanguageCookie} from '../../localization/http.js';
import type {RequestHandler,Response} from 'express';
import {languagesService} from '../../languages/index.js';
import type {LanguageOperation} from '../../languages/service.js';
import {LanguageError} from '../../languages/validation.js';
export const languageActor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
export function languageFailure(response:Response,error:unknown){const e=error instanceof LanguageError?error:new LanguageError('LANGUAGE_READ_FAILED',500);response.status(e.status).json({success:false,code:e.code});}
export const listLanguages:RequestHandler=async(request,response)=>{try{response.json({success:true,...await languagesService.list(languageActor(response),request.query)});}catch(error){languageFailure(response,error);}};
export const detailLanguage:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new LanguageError('LANGUAGE_INVALID_REQUEST');response.json({success:true,...await languagesService.details(languageActor(response),request.params.code as string)});}catch(error){languageFailure(response,error);}};
export const mutateLanguage=(operation:LanguageOperation):RequestHandler=>async(request,response)=>{const input=request.body;request.body=undefined;try{if(Object.keys(request.query).length)throw new LanguageError('LANGUAGE_INVALID_REQUEST');const result=await languagesService.mutate(languageActor(response),operation,request.params.code as string|undefined,input);const registry=localization.forLanguage(readLanguageCookie(request.headers.cookie));response.status(operation==='create'?201:200).json({success:true,...result,...(result.cacheRefreshed?{registry:{languages:registry.languages,language:registry.language}}:{})});}catch(error){languageFailure(response,error);}};

import type {RequestHandler} from 'express';
import {languagesService} from '../../languages/index.js';
import {languageActor} from './languages-api.js';
export const languagesPage:RequestHandler=async(_request,response)=>{
 const {rows}=await languagesService.list(languageActor(response),{}),permissions=response.locals.permissions;
 response.render('cpanel/pages/languages',{rows,capabilities:{
  create:await permissions.hasPermission('languages.create'),update:await permissions.hasPermission('languages.update'),
  status:await permissions.hasPermission('languages.status'),default:await permissions.hasPermission('languages.default'),
 }});
};

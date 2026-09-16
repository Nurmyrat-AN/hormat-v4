import type {RequestHandler} from 'express';
import {sourceProductsService,SourceQueryError} from '../../source-products/service.js';
export const sourceProductsQuery=(operation:'list'|'details'|'options'):RequestHandler=>async(request,response)=>{
 try{if(operation==='details'&&Object.keys(request.query).length)throw new SourceQueryError();const access=response.locals.permissions;const result=operation==='list'?await sourceProductsService.list(access,request.query):operation==='options'?await sourceProductsService.options(access,request.query):await sourceProductsService.details(access,request.params.id as string);response.json({success:true,...result});}
 catch(error){response.status(error instanceof SourceQueryError?error.status:500).json({success:false,code:'SOURCE_QUERY_FAILED'});}
};

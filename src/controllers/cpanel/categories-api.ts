import type {RequestHandler,Response} from 'express';
import {categoriesService,type CategoryOperation} from '../../categories/service.js';
import {CategoryError} from '../../categories/repository.js';
export const categoryActor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
export function categoryFailure(response:Response,error:unknown){const failure=error instanceof CategoryError?error:new CategoryError('CATEGORY_READ_FAILED',500);response.status(failure.status).json({success:false,code:failure.code});}
export const listCategories:RequestHandler=async(request,response)=>{try{response.json({success:true,...await categoriesService.list(categoryActor(response),request.query)});}catch(error){categoryFailure(response,error);}};
export const detailCategory:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new CategoryError('CATEGORY_INVALID_REQUEST');response.json({success:true,...await categoriesService.details(categoryActor(response),request.params.id as string)});}catch(error){categoryFailure(response,error);}};
export const mutateCategory=(operation:CategoryOperation):RequestHandler=>async(request,response)=>{
 const input=request.body;request.body=undefined;
 try{if(Object.keys(request.query).length)throw new CategoryError('CATEGORY_INVALID_REQUEST');response.status(operation==='create'?201:200).json({success:true,...await categoriesService.mutate(categoryActor(response),operation,request.params.id as string|undefined,input)});}catch(error){categoryFailure(response,error);}
};

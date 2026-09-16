import type {RequestHandler,Response} from 'express';
import {brandsService,type BrandOperation} from '../../brands/service.js';
import {BrandError} from '../../brands/repository.js';
export const brandActor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
export function brandFailure(response:Response,error:unknown){const failure=error instanceof BrandError?error:new BrandError('BRAND_READ_FAILED',500);response.status(failure.status).json({success:false,code:failure.code});}
export const listBrands:RequestHandler=async(request,response)=>{try{response.json({success:true,...await brandsService.list(brandActor(response),request.query)});}catch(error){brandFailure(response,error);}};
export const detailBrand:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new BrandError('BRAND_INVALID_REQUEST');response.json({success:true,...await brandsService.details(brandActor(response),request.params.id as string)});}catch(error){brandFailure(response,error);}};
export const mutateBrand=(operation:BrandOperation):RequestHandler=>async(request,response)=>{
 const input=request.body;request.body=undefined;
 try{if(Object.keys(request.query).length)throw new BrandError('BRAND_INVALID_REQUEST');response.status(operation==='create'?201:200).json({success:true,...await brandsService.mutate(brandActor(response),operation,request.params.id as string|undefined,input)});}catch(error){brandFailure(response,error);}
};

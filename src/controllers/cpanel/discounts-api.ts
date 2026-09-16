import type {RequestHandler,Response} from 'express';
import {discountsService,type DiscountOperation} from '../../discounts/service.js';
import {DiscountError} from '../../discounts/repository.js';
export const discountActor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
export function discountFailure(response:Response,error:unknown){const failure=error instanceof DiscountError?error:new DiscountError('DISCOUNT_READ_FAILED',500);response.status(failure.status).json({success:false,code:failure.code});}
export const listDiscounts:RequestHandler=async(request,response)=>{try{response.json({success:true,...await discountsService.list(discountActor(response),request.query)});}catch(error){discountFailure(response,error);}};
export const detailDiscount:RequestHandler=async(request,response)=>{try{if(Object.keys(request.query).length)throw new DiscountError('DISCOUNT_INVALID_REQUEST');response.json({success:true,...await discountsService.details(discountActor(response),request.params.id as string)});}catch(error){discountFailure(response,error);}};
export const mutateDiscount=(operation:DiscountOperation):RequestHandler=>async(request,response)=>{
 const input=request.body;request.body=undefined;
 try{if(Object.keys(request.query).length)throw new DiscountError('DISCOUNT_INVALID_REQUEST');response.status(operation==='create'?201:200).json({success:true,...await discountsService.mutate(discountActor(response),operation,request.params.id as string|undefined,input)});}catch(error){discountFailure(response,error);}
};

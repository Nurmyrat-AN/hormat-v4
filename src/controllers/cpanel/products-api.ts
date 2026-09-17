import {browseProducts,browserLookup} from '../../products/browser.js';
import type {RequestHandler,Response} from 'express';
import {productsService,type ProductOperation} from '../../products/service.js';
import {ProductError} from '../../products/validation.js';
const actor=(response:Response)=>({id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash});
function failure(response:Response,error:unknown){response.status(error instanceof ProductError?error.status:500).json({success:false,code:error instanceof ProductError?error.code:'PRODUCT_READ_FAILED'});}
export const productRead=(kind:'list'|'details'|'source'|'discounts'):RequestHandler=>async(req,res)=>{try{if(!['discounts','list'].includes(kind)&&Object.keys(req.query).length)throw new ProductError();res.json({success:true,...await(kind==='list'?browseProducts(actor(res),req.query,res.locals.language):kind==='details'?productsService.details(actor(res),req.params.id as string):kind==='source'?productsService.source(actor(res),req.params.id as string):productsService.discounts(actor(res),req.query))});}catch(e){failure(res,e);}};
export const productMutate=(operation:ProductOperation|'preview'):RequestHandler=>async(req,res)=>{const body=req.body;req.body=undefined;try{if(Object.keys(req.query).length)throw new ProductError();res.status(operation==='create'?201:200).json({success:true,...await(operation==='preview'?productsService.pricePreview(actor(res),req.params.id as string,body):productsService.mutate(actor(res),operation,req.params.id as string,body))});}catch(e){failure(res,e);}};

export const productDiscountRelationship=(operation:'attach'|'detach'):RequestHandler=>async(req,res)=>{
 const body=req.body;req.body=undefined;
 try{if(Object.keys(req.query).length)throw new ProductError();res.json({success:true,...await productsService.discountRelationship(actor(res),req.params.id as string,operation,body)});}catch(error){failure(res,error);}
};

export const productsForSource:RequestHandler=async(req,res)=>{try{res.json({success:true,...await productsService.forSource(actor(res),String(req.params.id),req.query)});}catch(error){failure(res,error);}};

export const productBrowserLookup:RequestHandler=async(req,res)=>{try{res.json({success:true,...await browserLookup(actor(res),String(req.params.kind),req.query)});}catch(error){failure(res,error);}};

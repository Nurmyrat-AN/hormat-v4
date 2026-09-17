import type {RequestHandler} from 'express';
import {BrandsRepository,BrandError} from '../../brands/repository.js';
import {CategoriesRepository,CategoryError} from '../../categories/repository.js';
const repositories={brands:new BrandsRepository(),categories:new CategoriesRepository()};
/** Safe identity-only lookups authorized for Product viewing/authoring; no mutation. */
export const productReferenceLookup=(kind:keyof typeof repositories):RequestHandler=>async(request,response)=>{
 try{
  const raw=request.query;
  if(Object.keys(raw).some(key=>!['query','page','selected'].includes(key))||Object.values(raw).some(value=>typeof value!=='string'||value.length>200||/[\x00-\x1f]/.test(value)))throw new BrandError('LOOKUP_FAILED');
  const query=String(raw.query??'').trim(),page=String(raw.page??'1'),selected=raw.selected===undefined?null:String(raw.selected);
  if(!/^[1-9]\d{0,6}$/.test(page)||selected!==null&&(!/^[1-9]\d{0,18}$/.test(selected)||BigInt(selected)>9223372036854775807n))throw new BrandError('LOOKUP_FAILED');
  const repo=repositories[kind],actor={id:response.locals.cpanelUser!.id,sessionHash:response.locals.cpanelSession!.token_hash};
  const result=await repo.authorized(actor,['products.view','products.create','products.update'],db=>repo.lookup(db,query,Number(page),selected));
  response.json({success:true,...result});
 }catch(error){response.status(error instanceof BrandError||error instanceof CategoryError?error.status:500).json({success:false,code:'LOOKUP_FAILED'});}
};

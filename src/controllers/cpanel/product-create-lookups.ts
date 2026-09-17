import type {RequestHandler} from 'express';
import {sourceProductsService,SourceQueryError} from '../../source-products/service.js';
import {sourceId,type SourceAccess} from '../../source-products/query.js';

/** Read-only adapter for the explicitly authorized products.create selection workflow.
 * It reuses source queries; it neither grants access to the source browser nor writes Products.
 */
export const productCreateLookup=(kind:'vendors'|'sources'):RequestHandler=>async(request,response)=>{
 try{
  const permissions:SourceAccess=response.locals.permissions;
  if(!await permissions.hasPermission('products.create'))throw new SourceQueryError(403);
  const access:SourceAccess={hasPermission:key=>key==='source_products.view'?permissions.hasPermission('products.create'):Promise.resolve(false)};
  const raw=request.query;
  if(Object.keys(raw).some(key=>!['query','page','selected',...(kind==='sources'?['vendor']:[])].includes(key)))throw new SourceQueryError();
  let result;
  if(kind==='vendors')result=await sourceProductsService.options(access,{...raw,kind:'vendor'});
  else{
   const vendor=sourceId(raw.vendor);
   // Projection deliberately omits barcodes/properties and unrelated source detail data.
   const option=(row:Record<string,any>)=>({value:row.id,label:row.name,metadata:{id:row.id,name:row.name,source_id:row.source_id,vendor:row.vendor,currency:row.currency,price:row.price,stock:row.stock,is_active:row.is_active,product_count:row.product_count}});
   if(raw.selected!==undefined){
    if(Object.keys(raw).some(key=>!['vendor','selected'].includes(key)))throw new SourceQueryError();
    const {row}=await sourceProductsService.details(access,sourceId(raw.selected));
    if(row.vendor.id!==vendor)throw new SourceQueryError(404);
    result={options:[option(row)],hasMore:false,nextPage:null};
   }else{
    const data=await sourceProductsService.list(access,{vendor,query:raw.query??'',page:raw.page??'1',field:'all'});
    const hasMore=data.page*data.pageSize<data.total;
    result={options:data.rows.map(option),hasMore,nextPage:hasMore?data.page+1:null};
   }
  }
  response.json({success:true,...result});
 }catch(error){response.status(error instanceof SourceQueryError?error.status:500).json({success:false,code:'SOURCE_QUERY_FAILED'});}
};

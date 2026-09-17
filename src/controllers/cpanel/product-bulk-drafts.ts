import type {RequestHandler} from 'express';
import {bulkDraftsService} from '../../products/bulk-drafts.js';
import {ProductError} from '../../products/validation.js';
import {SourceQueryError} from '../../source-products/query.js';
export const bulkDrafts=(operation:'review'|'page'|'start'|'status'):RequestHandler=>async(req,res)=>{
 try{const actor={id:res.locals.cpanelUser!.id,sessionHash:res.locals.cpanelSession!.token_hash},token=String(req.params.token);
  if((operation==='start'||operation==='status')&&Object.keys(req.query).length)throw new ProductError();
  const result=operation==='review'?await bulkDraftsService.review(actor,req.query):operation==='page'?await bulkDraftsService.page(actor,token,req.query):operation==='status'?await bulkDraftsService.status(actor,token):await bulkDraftsService.start(actor,token,req.body);
  res.status(operation==='start'?202:200).json({success:true,...result});
 }catch(error){res.status(error instanceof ProductError||error instanceof SourceQueryError?error.status:500).json({success:false,code:error instanceof ProductError?error.code:'PRODUCT_INVALID_REQUEST'});}
};

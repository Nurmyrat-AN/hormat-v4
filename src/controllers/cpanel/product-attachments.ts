import type {RequestHandler} from 'express';
import {attachmentsService,ProductMoveRequired} from '../../products/attachments-service.js';
import {ProductError} from '../../products/validation.js';
export const productAttachments=(operation?:'attach'|'detach'):RequestHandler=>async(req,res)=>{
 try{const actor={id:res.locals.cpanelUser!.id,sessionHash:res.locals.cpanelSession!.token_hash};
  if(operation&&Object.keys(req.query).length)throw new ProductError();
  const result=operation?await attachmentsService.mutate(actor,String(req.params.kind),String(req.params.parent),operation,req.body):await attachmentsService.read(actor,String(req.params.kind),String(req.params.parent),req.query);
  res.json({success:true,...result});
 }catch(error){res.status(error instanceof ProductError?error.status:500).json({success:false,code:error instanceof ProductError?error.code:'PRODUCT_READ_FAILED',...(error instanceof ProductMoveRequired?{move:error.move}:{})});}
};

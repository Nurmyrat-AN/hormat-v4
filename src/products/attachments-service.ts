import {AttachmentsRepository,attachmentKinds,type AttachmentKind} from './attachments-repository.js';
import {productsService,type ProductsService} from './service.js';
import {ProductError,id,object,type ProductActor} from './validation.js';
export class ProductMoveRequired extends ProductError {
 constructor(readonly move:{currentId:string;currentName:string;targetName:string;productName:string}){super('PRODUCT_MOVE_REQUIRED',409);}
}
function kind(value:string):AttachmentKind{if(!attachmentKinds.includes(value as AttachmentKind))throw new ProductError();return value as AttachmentKind;}
export class AttachmentsService {
 constructor(readonly products:ProductsService=productsService,readonly repository=new AttachmentsRepository()){}
 async read(actor:ProductActor,domain:string,target:string,input:unknown){
  const type=kind(domain),parent=id(target),f=object(input,['query','page','selected','lookup']);
  if(typeof(f.query??'')!=='string'||String(f.query??'').length>200||typeof(f.page??'1')!=='string'||! /^[1-9]\d{0,6}$/.test(String(f.page??'1'))||f.lookup!==undefined&&f.lookup!=='1')throw new ProductError();
  return this.products.repository.authorized(actor,[type+'.view'],async(db,has)=>{
   if(!has('products.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
   await this.repository.parent(db,type,parent);
   const result=await this.repository.page(db,type,parent,f.lookup==='1',String(f.query??'').trim(),Number(f.page??1),f.selected===undefined?null:id(f.selected));
   return {...result,rows:await Promise.all(result.rows.map(async row=>({...row,image:row.image?await this.products.mediaView(row.image):null}))),counts:await this.repository.counts(db,type,parent)};
  });
 }
 async mutate(actor:ProductActor,domain:string,target:string,operation:'attach'|'detach',input:unknown){
  const type=kind(domain),parent=id(target),f=object(input,operation==='attach'?['product_id','expected_parent_id']:['product_id']),product=id(f.product_id);
  const expected=f.expected_parent_id===undefined?undefined:f.expected_parent_id===null?null:id(f.expected_parent_id);
  try{return await this.products.repository.authorized(actor,[type+'.update'],async(db,has)=>{
   if(!has('products.view'))throw new ProductError('PRODUCT_FORBIDDEN',403);
   const row=await this.products.repository.get(db,product,true),destination=await this.repository.parent(db,type,parent);
   if(type==='discounts'){
    if(expected!==undefined)throw new ProductError();
    if(operation==='attach')await this.products.repository.attachDiscount(db,product,parent);
    else await this.products.repository.detachDiscount(db,product,parent);
   }else{
    const previous=row[type==='brands'?'brand_id':'category_id'] as string|null;
    if(operation==='detach'){
     if(previous!==parent)throw new ProductError('PRODUCT_CONFLICT',409);
     await this.repository.set(db,type,product,null);
    }else{
     if(previous===parent)throw new ProductError('PRODUCT_CONFLICT',409);
     // Confirmation is tied to the authoritative previous identity; stale confirmations cannot move a newly reassigned Product.
     if(previous!==null&&expected!==previous){const origin=await this.repository.parent(db,type,previous);throw new ProductMoveRequired({currentId:previous,currentName:origin.name,targetName:destination.name,productName:row.name});}
     if(expected!==undefined&&expected!==previous)throw new ProductError('PRODUCT_CONFLICT',409);
     await this.repository.set(db,type,product,parent);
    }
   }
   return {counts:await this.repository.counts(db,type,parent)};
  });}catch(error){if(error instanceof ProductError)throw error;if((error as {code?:string}).code==='23505')throw new ProductError('PRODUCT_CONFLICT',409);throw new ProductError('PRODUCT_SAVE_FAILED',500);}
 }
}
export const attachmentsService=new AttachmentsService();

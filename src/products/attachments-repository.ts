import type {PoolClient} from 'pg';
import {ProductError} from './validation.js';
export const attachmentKinds=['brands','categories','discounts'] as const;
export type AttachmentKind=typeof attachmentKinds[number];
const column=(kind:AttachmentKind)=>kind==='brands'?'brand_id':'category_id';
export class AttachmentsRepository {
 async parent(db:PoolClient,kind:AttachmentKind,target:string){const row=(await db.query(`SELECT id,name FROM ${kind} WHERE id=$1`,[target])).rows[0];if(!row)throw new ProductError('PRODUCT_NOT_FOUND',404);return row;}
 async counts(db:PoolClient,kind:AttachmentKind,target:string){
  const direct=(await db.query(kind==='discounts'?'SELECT count(*)::int AS n FROM product_discounts WHERE discount_id=$1':`SELECT count(*)::int AS n FROM products WHERE ${column(kind)}=$1`,[target])).rows[0].n;
  const total=kind==='categories'?(await db.query('WITH RECURSIVE tree AS (SELECT id FROM categories WHERE id=$1 UNION SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT count(*)::int AS n FROM products WHERE category_id IN(SELECT id FROM tree)',[target])).rows[0].n:direct;
  return {direct,total};
 }
 async page(db:PoolClient,kind:AttachmentKind,target:string,lookup:boolean,query:string,page:number,selected:string|null){
  const relationship=kind==='discounts'?'EXISTS(SELECT 1 FROM product_discounts pd WHERE pd.product_id=p.id AND pd.discount_id=$1)':`p.${column(kind)} IS NOT DISTINCT FROM $1::bigint`;
  const rows=(await db.query(`SELECT p.id::text,p.name,p.is_visible,s.name AS source,v.name AS vendor,p.brand_id::text,p.category_id::text,b.name AS brand,c.name AS category,
   (SELECT media_reference FROM product_media WHERE product_id=p.id AND is_primary LIMIT 1) AS image
   FROM products p JOIN source_products s ON s.id=p.source_product_id JOIN vendors v ON v.id=s.vendor_id LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
   WHERE ${lookup?'NOT ':''}(${relationship}) AND (($4::bigint IS NOT NULL AND p.id=$4) OR ($4::bigint IS NULL AND p.name ILIKE $2))
   ORDER BY p.name,p.id LIMIT 21 OFFSET $3`,[target,'%'+query.replace(/[\\%_]/g,'\\$&')+'%',selected?0:(page-1)*20,selected])).rows;
  return {rows:rows.slice(0,20),hasMore:rows.length>20,nextPage:rows.length>20?page+1:null};
 }
 async set(db:PoolClient,kind:AttachmentKind,product:string,parent:string|null){await db.query(`UPDATE products SET ${column(kind)}=$2 WHERE id=$1`,[product,parent]);}
}

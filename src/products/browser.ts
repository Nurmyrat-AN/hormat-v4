import type {PoolClient} from 'pg';
import {ProductError,id,object,type ProductActor} from './validation.js';
import {productsService} from './service.js';
import {visibilitySql} from './visibility.js';
import {convertPrice} from '../currencies/conversion.js';
import {CategoriesRepository} from '../categories/repository.js';
export const browserFilters=['vendor','brand','category','visibility','storefront','stock','showStock','hideStock','placement','discount'] as const;
export function browserQuery(input:unknown){
 const f=object(input,['query','field','page',...browserFilters]),q:Record<string,string>={};
 for(const [key,value]of Object.entries(f)){if(typeof value!=='string'||value.length>200||/[\x00-\x1f\x7f]/.test(value))throw new ProductError();q[key]=value.trim();}
 q.query??='';q.field||='name';q.page||='1';
 if(!['name','source','source_id','all'].includes(q.field)||! /^[1-9]\d{0,6}$/.test(q.page))throw new ProductError();
 for(const key of ['vendor','brand','category','discount'])if(q[key]&&!(['brand','category'].includes(key)&&q[key]==='none')&&!(key==='discount'&&['has','none'].includes(q[key])))id(q[key]);
 const enums:Record<string,string[]>={visibility:['visible','hidden'],storefront:['visible','hidden'],stock:['in','out'],showStock:['true','false'],hideStock:['true','false'],placement:['true','false']};
 for(const [key,values]of Object.entries(enums))if(q[key]&&!values.includes(q[key]))throw new ProductError();return q;
}
const stock='COALESCE((SELECT sum(ps.stock) FROM product_stocks ps WHERE ps.product_id=s.id AND ps.vendor_id=s.vendor_id),0)';
const effective=visibilitySql({visible:'p.is_visible',sourceActive:'s.is_active',vendorActive:'v.is_active',hideStock:'p.hide_when_out_of_stock',inStock:`${stock}>0`,brandVisible:'COALESCE(b.is_visible,true)',categoryVisible:'COALESCE(c.is_visible,true)'});
const joins='FROM products p JOIN source_products s ON s.id=p.source_product_id JOIN vendors v ON v.id=s.vendor_id LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id';
export async function browserRows(db:PoolClient,q:Record<string,string>,language:string){
 const values:unknown[]=[language],where:string[]=[];const bind=(v:unknown)=>{values.push(v);return '$'+values.length;};
 if(q.query){const param=bind('%'+q.query.replace(/[\\%_]/g,'\\$&')+'%'),columns=q.field==='all'?['p.name','s.name','s.source_id']:[{name:'p.name',source:'s.name',source_id:'s.source_id'}[q.field]!];where.push('('+columns.map(col=>col+' ILIKE '+param).join(' OR ')+')');}
 if(q.vendor)where.push('s.vendor_id='+bind(q.vendor));
 for(const key of ['brand','category'])if(q[key])where.push(q[key]==='none'?`p.${key}_id IS NULL`:`p.${key}_id=${bind(q[key])}`);
 if(q.visibility)where.push('p.is_visible='+bind(q.visibility==='visible'));
 if(q.storefront)where.push(`(${effective})=${bind(q.storefront==='visible')}`);
 if(q.stock)where.push(`${stock}${q.stock==='in'?'>0':'<=0'}`);
 for(const [key,column]of [['showStock','show_as_in_stock'],['hideStock','hide_when_out_of_stock'],['placement','is_placement_product']])if(q[key])where.push(`p.${column}=${bind(q[key]==='true')}`);
 if(q.discount)where.push((q.discount==='none'?'NOT ':'')+'EXISTS(SELECT 1 FROM product_discounts pd WHERE pd.product_id=p.id'+(!['none','has'].includes(q.discount)?' AND pd.discount_id='+bind(q.discount):'')+')');
 const condition=where.length?' WHERE '+where.join(' AND '):'';
 // The single aggregate query keeps total and page in one statement snapshot, including empty pages.
 const result=(await db.query(`WITH filtered AS (SELECT p.id,p.name,p.is_visible,p.source_product_id,p.show_as_in_stock,p.hide_when_out_of_stock,p.is_placement_product,p.price_action,p.price_value,s.name AS source_name,s.source_id,v.name AS vendor,v.is_active AS vendor_active,s.is_active AS source_active,COALESCE(b.is_visible,true) AS brand_visible,COALESCE(c.is_visible,true) AS category_visible, b.name AS brand,c.name AS category,${stock}::text AS stock,(${effective}) AS effective_visible,
 COALESCE(NULLIF((SELECT t.name FROM product_translations t WHERE t.product_id=p.id AND t.language_code=$1),''),p.name) AS effective_name
 ${joins}${condition}), page_rows AS (SELECT * FROM filtered ORDER BY name,id LIMIT 20 OFFSET ${bind((Number(q.page)-1)*20)})
 SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.name,r.id::bigint) FROM (SELECT id::text,name,effective_name,is_visible,source_product_id::text,source_name,source_id,vendor,vendor_active,source_active,brand_visible,category_visible,brand,category,stock,effective_visible,show_as_in_stock,hide_when_out_of_stock,is_placement_product,price_action,price_value::text,
 (SELECT media_reference FROM product_media WHERE product_id=page_rows.id AND is_primary) AS image,
 (SELECT count(*)::int FROM product_discounts WHERE product_id=page_rows.id) AS discount_count
 FROM page_rows) r),'[]'::jsonb) AS rows`,values)).rows[0];
 return {...result,page:Number(q.page),hasMore:Number(q.page)*20<result.total};
}
export async function browseProducts(actor:ProductActor,input:unknown,language:string){const q=browserQuery(input);return productsService.repository.authorized(actor,['products.view'],async db=>{
 const result=await browserRows(db,q,language);
 const currency=(await db.query("SELECT f.code,f.symbol,f.rate::text FROM frontend_currencies f JOIN settings st ON st.key='marketplace.default_frontend_currency_id' AND st.value=to_jsonb(f.id::text) WHERE f.is_visible")).rows[0];
 for(const row of result.rows){const source=await productsService.repository.source(db,row.source_product_id);const preview=await productsService.preview(db,source,{action:row.price_action,value:row.price_value});row.price=preview.normal===null?null:await convertPrice(preview.normal,null,currency?.rate,db);row.image=row.image?await productsService.mediaView(row.image):null;delete row.price_action;delete row.price_value;}
 return {...result,currency:currency?{code:currency.code,symbol:currency.symbol}:null};
 });}
export async function browserLookup(actor:ProductActor,kind:string,input:unknown){
 if(!['vendors','brands','categories','discounts'].includes(kind))throw new ProductError();const f=object(input,['query','page','selected']);
 const q=browserQuery({query:f.query??'',page:f.page??'1'}),selected=f.selected===undefined?null:id(f.selected);
 return productsService.repository.authorized(actor,['products.view'],async db=>{
  if(kind==='categories')return new CategoriesRepository().lookup(db,q.query,Number(q.page),selected);
  // kind is a fixed server allowlist; lookups expose only identity for the Product browsing workflow.
  const rows=(await db.query(`SELECT id::text AS value,name AS label FROM ${kind} WHERE ($1::bigint IS NOT NULL AND id=$1) OR ($1::bigint IS NULL AND name ILIKE $2) ORDER BY name,id LIMIT 21 OFFSET $3`,[selected,'%'+q.query.replace(/[\\%_]/g,'\\$&')+'%',selected?0:(Number(q.page)-1)*20])).rows;
  return {options:rows.slice(0,20),hasMore:rows.length>20,nextPage:rows.length>20?Number(q.page)+1:null};
 });
}

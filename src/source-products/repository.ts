import type {Pool,PoolClient} from 'pg';
import {pool} from '../database/pool.js';
import {SourceQueryError,sourceQuery,sourceId,type SourceAccess} from './query.js';
const fields=['all','name','source_id','barcode','property_1','property_2','property_3','property_4','property_5'];
const pattern=(value:string)=>'%'+value.trim().replace(/[\\%_]/g,'\\$&')+'%';
const stock="COALESCE((SELECT sum(s.stock) FROM product_stocks s WHERE s.product_id=p.id AND s.vendor_id=p.vendor_id),0)";
const projection=`p.id::text,p.name,p.source_id,p.price::text,p.is_active,p.property_1,p.property_2,p.property_3,p.property_4,p.property_5,
 json_build_object('id',v.id::text,'name',v.name) AS vendor,
 CASE WHEN c.id IS NOT NULL THEN json_build_object('id',c.id::text,'name',c.name) END AS currency,
 CASE WHEN m.id IS NOT NULL THEN json_build_object('id',m.id::text,'name',m.name) END AS measure,
 (${stock})::text AS stock,(SELECT count(*)::int FROM products x WHERE x.source_product_id=p.id) AS product_count,
 (SELECT count(*)::int FROM product_barcodes b WHERE b.product_id=p.id AND b.vendor_id=p.vendor_id) AS barcode_count,
 (SELECT b.barcode FROM product_barcodes b WHERE b.product_id=p.id AND b.vendor_id=p.vendor_id ORDER BY b.id LIMIT 1) AS barcode_preview`;
const joins='JOIN vendors v ON v.id=p.vendor_id LEFT JOIN currencies c ON c.id=p.currency_id AND c.vendor_id=p.vendor_id LEFT JOIN measures m ON m.id=p.measure_id AND m.vendor_id=p.vendor_id';
/** One authoritative filter compiler for browser reads and bulk review/creation. */
export function sourceWhere(q:Record<string,string>){
  const values:unknown[]=[],clauses:string[]=[];const bind=(v:unknown)=>{values.push(v);return '$'+values.length;};
  const barcode=(param:string)=>`EXISTS(SELECT 1 FROM product_barcodes b WHERE b.product_id=p.id AND b.vendor_id=p.vendor_id AND b.barcode ILIKE ${param})`;
  if(q.query.trim()){const param=bind(pattern(q.query));const expressions=fields.filter(f=>!['all','barcode'].includes(f)).map(f=>`p.${f} ILIKE ${param}`);clauses.push(q.field==='all'?'('+[...expressions,barcode(param)].join(' OR ')+')':q.field==='barcode'?barcode(param):`p.${q.field} ILIKE ${param}`);}
  for(const [key,column]of Object.entries({vendor:'vendor_id',currency:'currency_id',measure:'measure_id'}))if(q[key])clauses.push(`p.${column}=${bind(q[key])}::bigint`);
  if(q.active)clauses.push('p.is_active='+bind(q.active==='active'));
  if(q.stock)clauses.push(stock+(q.stock==='in'?'>0':'<=0'));
  if(q.connection)clauses.push((q.connection==='none'?'NOT ':'')+'EXISTS(SELECT 1 FROM products x WHERE x.source_product_id=p.id)');
  for(let n=1;n<=5;n++)if(q['property_'+n]?.trim())clauses.push(`p.property_${n} ILIKE ${bind(pattern(q['property_'+n]))}`);
  const where=clauses.length?clauses.join(' AND '):'TRUE';
  return {values,where};
}
/** Read-only query service shared by the browser and future picker adapters. */
export class SourceProductsRepository {
 constructor(readonly database:Pool=pool){}
 async read<T>(access:SourceAccess,run:(db:PoolClient)=>Promise<T>){if(!await access.hasPermission('source_products.view'))throw new SourceQueryError(403);const db=await this.database.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const result=await run(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async list(access:SourceAccess,raw:Record<string,unknown>){const q=sourceQuery(raw);return this.read(access,async db=>{
  const {values,where}=sourceWhere(q);
  const total=Number((await db.query(`SELECT count(*) FROM source_products p WHERE ${where}`,values)).rows[0].count);
  const page=Math.min(Number(q.page),Math.max(1,Math.ceil(total/12)));
  const rows=(await db.query(`SELECT ${projection} FROM source_products p ${joins} WHERE ${where} ORDER BY p.name ${q.sort==='name_desc'?'DESC':'ASC'},p.id LIMIT 12 OFFSET $${values.length+1}`,[...values,(page-1)*12])).rows;
  return {rows,total,page,pageSize:12};
 });}
 async details(access:SourceAccess,id:string){sourceId(id);return this.read(access,async db=>{
  const row=(await db.query(`SELECT ${projection} FROM source_products p ${joins} WHERE p.id=$1`,[id])).rows[0];if(!row)throw new SourceQueryError(404);
  row.barcodes=(await db.query('SELECT barcode FROM product_barcodes WHERE product_id=$1 ORDER BY id',[id])).rows.map(r=>r.barcode);
  row.stocks=(await db.query('SELECT w.name AS warehouse,s.stock::text FROM product_stocks s JOIN warehouses w ON w.id=s.warehouse_id AND w.vendor_id=s.vendor_id WHERE s.product_id=$1 ORDER BY w.name,w.id',[id])).rows;
  return {row};
 });}
 async options(access:SourceAccess,raw:Record<string,unknown>){
  if(Object.keys(raw).some(k=>!['kind','query','vendor','selected','page'].includes(k))||typeof raw.kind!=='string'||!['vendor','currency','measure'].includes(raw.kind))throw new SourceQueryError();
  for(const [key,value] of Object.entries(raw))if(typeof value!=='string'||value.length>200||/[\x00-\x1f]/.test(value))throw new SourceQueryError();
  const page=raw.page??'1';if(typeof page!=='string'||! /^[1-9]\d{0,6}$/.test(page))throw new SourceQueryError();
  const vendor=raw.vendor?sourceId(raw.vendor):null,selected=raw.selected?sourceId(raw.selected):null;
  const table={vendor:'vendors',currency:'currencies',measure:'measures'}[raw.kind as 'vendor'|'currency'|'measure'];
  return this.read(access,async db=>{
   const source=raw.kind==='vendor';
   const result=await db.query(`SELECT r.id::text AS value,r.name AS label,${source?'NULL::text':'v.name'} AS "secondaryText" FROM ${table} r ${source?'':'JOIN vendors v ON v.id=r.vendor_id'}
    WHERE (${source?'$2::bigint IS NULL':'($2::bigint IS NULL OR r.vendor_id=$2)'})
    AND (($3::bigint IS NOT NULL AND r.id=$3) OR ($3::bigint IS NULL AND r.name ILIKE $1))
    ORDER BY r.name,r.id LIMIT 21 OFFSET $4`,[pattern(String(raw.query??'')),source?null:vendor,selected,selected?0:(Number(page)-1)*20]);
   return {options:result.rows.slice(0,20),hasMore:result.rows.length>20,nextPage:result.rows.length>20?Number(page)+1:null};
  });
 }
}

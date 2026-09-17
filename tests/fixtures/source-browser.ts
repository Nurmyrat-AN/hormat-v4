import type {Pool} from 'pg';
import {VendorCredentials} from '../../src/vendors/credentials.js';
import {config} from '../../src/config/env.js';
import {randomUUID} from 'node:crypto';
export async function sourceBrowserFixture(db:Pool){
 const prefix='SourceBrowser-'+randomUUID(),vendors:string[]=[],ids:string[]=[];let currency='',measure='';
 for(let v=0;v<2;v++){
  const vendor=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES($1,'http://example.invalid/db','test',$2,false) RETURNING id",[prefix+'-'+v,new VendorCredentials(config.vendors.credentialsKey).encryptSecret('test-only')])).rows[0].id;vendors.push(vendor);
  const c=(await db.query("INSERT INTO currencies(vendor_id,source_id,name) VALUES($1,'USD','USD') RETURNING id",[vendor])).rows[0].id;
  const m=(await db.query("INSERT INTO measures(vendor_id,source_id,name) VALUES($1,'pc','pc') RETURNING id",[vendor])).rows[0].id;
  const warehouses=[];for(let n=0;n<2;n++)warehouses.push((await db.query('INSERT INTO warehouses(vendor_id,source_id,name) VALUES($1,$2,$2) RETURNING id',[vendor,'W'+n])).rows[0].id);
  if(v===0){currency=c;measure=m;}
  for(let n=0;n<(v?1:15);n++){
   const id=(await db.query(`INSERT INTO source_products(vendor_id,source_id,name,price,currency_id,measure_id,is_active,property_1,property_2,property_3,property_4,property_5) VALUES($1,$2,$3,12.345678,$4,$5,$6,'P1','P2','P3','P4','P5') RETURNING id`,[vendor,'00X-'+n,prefix+' '+String(n).padStart(2,'0'),c,m,n!==1])).rows[0].id;ids.push(id);
   for(const barcode of ['000123','000124'])await db.query('INSERT INTO product_barcodes(vendor_id,product_id,barcode) VALUES($1,$2,$3)',[vendor,id,barcode]);
   for(let w=0;w<2;w++)await db.query('INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock) VALUES($1,$2,$3,$4)',[vendor,id,warehouses[w],n===1?-2:w?3:2]);
   if(n===0)for(let x=0;x<2;x++)await db.query("INSERT INTO products(source_product_id,name) VALUES($1,'Fixture Product')",[id]);
  }
 }
 return {prefix,vendors,ids,currency,measure,async cleanup(){for(const child of ['product_media','product_translations','product_discounts'])await db.query(`DELETE FROM ${child} WHERE product_id IN(SELECT id FROM products WHERE source_product_id=ANY($1::bigint[]))`,[ids]);await db.query('DELETE FROM products WHERE source_product_id=ANY($1::bigint[])',[ids]);for(const table of ['product_barcodes','product_stocks','source_products','warehouses','currencies','measures','vendors'])await db.query(`DELETE FROM ${table} WHERE ${table==='vendors'?'id':'vendor_id'}=ANY($1::bigint[])`,[vendors]);}};
}

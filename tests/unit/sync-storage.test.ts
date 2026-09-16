import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {VendorCredentials} from '../../src/vendors/credentials.js';
const schema='sync_storage_'+randomUUID().replaceAll('-','');
const db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const tables=['warehouses','currencies','measures','source_products','product_barcodes','product_stocks','products'];
let first:string,second:string;
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);
 const encrypted=new VendorCredentials(config.vendors.credentialsKey).encryptSecret('synthetic fixture');
 for(const name of ['one','two']){const row=(await db.query('INSERT INTO vendors(name,url,username,password_encrypted) VALUES($1,$2,$3,$4) RETURNING id',[name,'https://example.invalid/db','test',encrypted])).rows[0];if(name==='one')first=row.id;else second=row.id;}
});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
async function entity(table:string,vendor:string,source:string){return (await db.query(`INSERT INTO ${table}(vendor_id,source_id,name) VALUES($1,$2,$3) RETURNING id`,[vendor,source,'Fixture'])).rows[0].id as string;}
test('seven empty storage tables, minimal Products, identity keys, exact numeric and no automatic seeds',async()=>{
 for(const table of tables){assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
 const columns=(await db.query('SELECT column_name,data_type,is_identity FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',[schema,table])).rows;
 assert.equal(columns[0].column_name,'id');assert.equal(columns[0].is_identity,'YES');assert.equal(columns[0].data_type,'bigint');
 if(table==='products')assert.deepEqual(columns.map(c=>c.column_name),['id','source_product_id','created_at','updated_at','brand_id']);}
 await migrate(db);assert.equal((await db.query("SELECT count(*)::int n FROM schema_migrations WHERE name='027_sync_storage.sql'")).rows[0].n,1);
});
test('source IDs retain zero padding and case; uniqueness is Vendor-scoped',async()=>{
 for(const table of ['warehouses','currencies','measures','source_products']){
 for(const source of ['123','000123','ABC-123','abc-123','00123'])await entity(table,first,source);
 await entity(table,second,'00123');
 assert.deepEqual((await db.query(`SELECT source_id FROM ${table} WHERE vendor_id=$1 ORDER BY id`,[first])).rows.map(r=>r.source_id),['123','000123','ABC-123','abc-123','00123']);
 await assert.rejects(entity(table,first,'00123'),{code:'23505'});}
});
test('cross-Vendor relationships and destructive parent deletes are rejected; internal FKs and counts work',async()=>{
 const product=await entity('source_products',first,'product'),measure=await entity('measures',first,'measure'),currency=await entity('currencies',first,'currency'),warehouse=await entity('warehouses',first,'warehouse');
 const foreignMeasure=await entity('measures',second,'other'),foreignCurrency=await entity('currencies',second,'other'),foreignWarehouse=await entity('warehouses',second,'other');
 for(const [column,value] of [['measure_id',foreignMeasure],['currency_id',foreignCurrency]])await assert.rejects(db.query(`UPDATE source_products SET ${column}=$1 WHERE id=$2`,[value,product]),{code:'23503'});
 await db.query('UPDATE source_products SET measure_id=$1,currency_id=$2,price=$3 WHERE id=$4',[measure,currency,'12345678901234567890.123456789',product]);
 const row=(await db.query('SELECT price,is_active FROM source_products WHERE id=$1',[product])).rows[0];assert.equal(row.price,'12345678901234567890.123456789');assert.equal(row.is_active,true);
 await assert.rejects(db.query('INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock) VALUES($1,$2,$3,1)',[first,product,foreignWarehouse]),{code:'23503'});
 await assert.rejects(db.query('INSERT INTO product_barcodes(vendor_id,product_id,barcode) VALUES($1,$2,$3)',[second,product,'00123']),{code:'23503'});
 await db.query('INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock) VALUES($1,$2,$3,$4)',[first,product,warehouse,'-0.000000123']);
 assert.equal((await db.query('SELECT stock FROM product_stocks WHERE product_id=$1',[product])).rows[0].stock,'-0.000000123');
 await assert.rejects(db.query('INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock) VALUES($1,$2,$3,2)',[first,product,warehouse]),{code:'23505'});
 await db.query('INSERT INTO product_barcodes(vendor_id,product_id,barcode) VALUES($1,$2,$3)',[first,product,'00123']);
 await assert.rejects(db.query('INSERT INTO product_barcodes(vendor_id,product_id,barcode) VALUES($1,$2,$3)',[first,product,'00123']),{code:'23505'});
 await db.query('INSERT INTO products(source_product_id) VALUES($1),($1)',[product]);assert.equal((await db.query('SELECT count(*)::int n FROM products WHERE source_product_id=$1',[product])).rows[0].n,2);
 for(const [table,id] of [['vendors',first],['measures',measure],['currencies',currency],['warehouses',warehouse],['source_products',product]])await assert.rejects(db.query(`DELETE FROM ${table} WHERE id=$1`,[id]),(error: {code?:string})=>['23001','23503'].includes(error.code??''));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../../src/database/pool.js';
import {sourceBrowserFixture} from '../fixtures/source-browser.js';
import {browserRows,browserQuery} from '../../src/products/browser.js';
import {effectiveVisibility,visibilityDiagnostics} from '../../src/products/visibility.js';
test('browser effective visibility follows the editor diagnostics and real negative stock',async()=>{
 const f=await sourceBrowserFixture(pool),db=await pool.connect();try{await db.query('BEGIN');await db.query('UPDATE vendors SET is_active=true WHERE id=$1',[f.vendors[0]]);await db.query('UPDATE products SET is_visible=true WHERE source_product_id=$1',[f.ids[0]]);
 let rows=await browserRows(db,browserQuery({vendor:f.vendors[0],storefront:'visible'}),'en');assert.equal(rows.total,2);
 assert.equal(effectiveVisibility(visibilityDiagnostics({is_visible:true,hide_when_out_of_stock:false},{active:true,vendorActive:true,inStock:true})),true);
 await db.query('UPDATE source_products SET is_active=false WHERE id=$1',[f.ids[0]]);rows=await browserRows(db,browserQuery({vendor:f.vendors[0],storefront:'visible'}),'en');assert.equal(rows.total,0);
 assert.equal(effectiveVisibility(visibilityDiagnostics({is_visible:true,hide_when_out_of_stock:false},{active:false,vendorActive:true,inStock:true})),false);
 await db.query('UPDATE source_products SET is_active=true WHERE id=$1',[f.ids[0]]);await db.query('UPDATE product_stocks SET stock=-2 WHERE product_id=$1',[f.ids[0]]);await db.query('UPDATE products SET hide_when_out_of_stock=true WHERE source_product_id=$1',[f.ids[0]]);assert.equal((await browserRows(db,browserQuery({vendor:f.vendors[0],storefront:'visible'}),'en')).total,0);
 await db.query('UPDATE products SET show_as_in_stock=true WHERE source_product_id=$1',[f.ids[0]]);assert.equal((await browserRows(db,browserQuery({vendor:f.vendors[0],storefront:'visible'}),'en')).total,0);
 }finally{await db.query('ROLLBACK');db.release();await f.cleanup();await pool.end();}
});

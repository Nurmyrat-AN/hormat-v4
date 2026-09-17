import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
async function setup(context:BrowserContext,base:string){const f=await sourceBrowserFixture(pool),user=await bootstrapSuperuser({name:'Bulk drafts',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(base).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:base}]);return {...f,user,async cleanup(){await f.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}};}
async function call(page:Page,path:string,body?:unknown,csrf=true){return page.evaluate(async({path,body,csrf})=>{const r=await fetch('/cpanel/api/products/bulk-drafts'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':document.querySelector<HTMLElement>('#bulk-drafts-dialog')!.dataset.csrf!}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};},{path,body,csrf});}
async function finish(page:Page,token:string){await expect.poll(async()=>(await call(page,'/'+token+'/status')).data.state).toBe('done');return (await call(page,'/'+token+'/status')).data;}
test('bulk review represents all pages, preserves exclusions, previews prefix and creates only hidden base rows',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(let i=0;i<10;i++){const id=(await pool.query('INSERT INTO source_products(vendor_id,source_id,name,is_active) VALUES($1,$2,$3,true) RETURNING id',[f.vendors[0],'extra'+i,i===9?f.prefix+' '+ 'x'.repeat(201):f.prefix+' extra '+i])).rows[0].id;f.ids.push(id);}
  await page.goto('/cpanel/source-products?vendor='+f.vendors[0]);const before=(await pool.query('SELECT count(*)::int n FROM products WHERE source_product_id=ANY($1::bigint[])',[f.ids])).rows[0].n;
  await page.locator('#source-bulk-drafts').click();const dialog=page.locator('#bulk-drafts-dialog');await expect(dialog.locator('[data-bulk-counts]')).toHaveText('Matching Source Products: 25 · Selected: 25');await expect(dialog.locator('[data-source-selection]')).toHaveCount(20);
  await dialog.locator('[data-source-selection="'+f.ids[0]+'"]').uncheck();await dialog.locator('[data-bulk-next]').click();await expect(dialog.locator('[data-source-selection]')).toHaveCount(5);await expect(dialog.locator('[data-bulk-create]')).toHaveText('Create 24 Products');await dialog.locator('[data-bulk-prev]').click();await expect(dialog.locator('[data-source-selection="'+f.ids[0]+'"]').isChecked()).resolves.toBe(false);
  await dialog.locator('[data-bulk-clear]').click();await expect(dialog.locator('[data-bulk-create]')).toBeDisabled();await dialog.locator('[data-bulk-all]').click();await expect(dialog.locator('[data-bulk-create]')).toHaveText('Create 25 Products');await dialog.locator('[data-source-selection="'+f.ids[1]+'"]').uncheck();
  await dialog.locator('#bulk-drafts-prefix').fill('  Regenerate  ');await expect(dialog.locator('[data-name-preview="'+f.ids[0]+'"]')).toHaveText('Regenerate - '+f.prefix+' 00');expect((await pool.query('SELECT count(*)::int n FROM products WHERE source_product_id=ANY($1::bigint[])',[f.ids])).rows[0].n).toBe(before);
  await dialog.locator('[data-bulk-create]').click();await expect(dialog.locator('[data-bulk-create]')).toBeDisabled();await expect(dialog.locator('[data-bulk-status]')).toContainText('Created: 23 · Failed: 1');await expect(page.locator('[data-source-details="'+f.ids[0]+'"]').locator('..').locator('..')).toContainText('3');
  await expect(dialog.locator('[data-bulk-errors] li')).toHaveCount(1);
  const rows=(await pool.query('SELECT * FROM products WHERE created_by=$1',[f.user.id])).rows;expect(rows).toHaveLength(23);expect(new Set(rows.map(r=>r.source_product_id)).size).toBe(23);expect(rows.every(r=>!r.is_visible&&r.brand_id===null&&r.category_id===null&&r.slug===null&&r.seo_title===null&&r.description_html===null)).toBe(true);expect(rows.some(r=>r.source_product_id===f.ids[0])).toBe(true);expect(rows.some(r=>r.source_product_id===f.ids[1])).toBe(false);
  for(const table of ['product_translations','product_media','product_discounts'])expect((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE product_id=ANY($1::bigint[])`,[rows.map(r=>r.id)])).rows[0].n).toBe(0);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await f.cleanup();}
});
test('bulk exact query, no-filter review, clear-selection inclusion, CSRF and independent permissions',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!);
 try{
  await page.goto('/cpanel/source-products');const all=await call(page,'/review');expect(all.data.total).toBe(Number((await pool.query('SELECT count(*) FROM source_products')).rows[0].count));
  const query=new URLSearchParams({vendor:f.vendors[0],field:'name',query:f.prefix,active:'active',stock:'in',currency:f.currency,measure:f.measure,property_1:'P1',property_5:'P5',connection:'none'});
  const normal=await page.evaluate(async query=>(await(await fetch('/cpanel/api/source-products?'+query)).json()),query.toString());const review=await call(page,'/review?'+query);expect(review.data.total).toBe(normal.total);expect(review.data.total).toBe(13);const token=review.data.token;
  expect((await call(page,'/'+token,{all:false,exceptions:[f.ids[2]],prefix:''},false)).status).toBe(403);
  expect((await call(page,'/'+token,{all:false,exceptions:[f.ids[2]],prefix:'',vendor_id:'1'})).status).toBe(400);
  expect((await call(page,'/'+token,{all:false,exceptions:[f.ids[2]],prefix:''})).status).toBe(202);expect((await finish(page,token)).created).toBe(1);
  const row=(await pool.query('SELECT name,source_product_id,is_visible FROM products WHERE created_by=$1',[f.user.id])).rows[0];expect(row).toEqual({name:f.prefix+' 02',source_product_id:f.ids[2],is_visible:false});
  const invalid=(await call(page,'/review?'+query)).data.token;await call(page,'/'+invalid,{all:true,exceptions:[f.ids[15]],prefix:''});const failed=await finish(page,invalid);expect(failed.created).toBe(0);expect(failed.errors.length).toBeGreaterThan(0);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[f.user.id]);expect((await call(page,'/review')).status).toBe(403);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.create','true')",[f.user.id]);expect((await call(page,'/review')).status).toBe(403);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'source_products.view','true')",[f.user.id]);expect((await call(page,'/review')).status).toBe(200);await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='products.create'",[f.user.id]);expect((await call(page,'/'+token+'/status')).status).toBe(403);
 }finally{await page.goto('about:blank');await f.cleanup();}
});
test('bulk server batches, connection-filter snapshot, partial failure and same-token duplicate suppression',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!);
 try{
  for(let i=0;i<110;i++)f.ids.push((await pool.query('INSERT INTO source_products(vendor_id,source_id,name,is_active) VALUES($1,$2,$3,true) RETURNING id',[f.vendors[0],'large'+i,i===109?'x'.repeat(201):f.prefix+' batch '+i])).rows[0].id);
  await page.goto('/cpanel/source-products');const token=(await call(page,'/review?'+new URLSearchParams({vendor:f.vendors[0],connection:'none'}))).data.token,body={all:true,exceptions:[],prefix:''};
  const replies=await Promise.all([call(page,'/'+token,body),call(page,'/'+token,body)]);expect(replies.every(r=>r.status===202)).toBe(true);const summary=await finish(page,token);expect(summary.total).toBe(124);expect(summary.created).toBe(123);expect(summary.failed).toBe(1);expect(summary.uncertain).toBe(false);
  expect((await call(page,'/'+token,body)).data.created).toBe(123);expect((await call(page,'/'+token,{...body,prefix:'different'})).status).toBe(409);expect((await call(page,'/'+randomUUID(),body)).status).toBe(404);
  const created=(await pool.query('SELECT source_product_id,count(*)::int n FROM products WHERE created_by=$1 GROUP BY source_product_id',[f.user.id])).rows;expect(created).toHaveLength(123);expect(created.every(r=>r.n===1)).toBe(true);
 }finally{await page.goto('about:blank');await f.cleanup();}
});

import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
async function setup(context:BrowserContext,baseURL:string){
 const fixture=await sourceBrowserFixture(pool),user=await bootstrapSuperuser({name:'Discount autocomplete',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);
 const product=(await pool.query('SELECT id FROM products WHERE source_product_id=$1 ORDER BY id',[fixture.ids[0]])).rows[0].id;
 const prefix='DiscountAC-'+randomUUID(),discounts:string[]=[];
 for(let i=0;i<24;i++)discounts.push((await pool.query('INSERT INTO discounts(name,priority,is_visible) VALUES($1,$2,$3) RETURNING id',[prefix+' '+String(i).padStart(2,'0'),100-Math.floor(i/2),i%2===0])).rows[0].id);
 await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL}]);
 return {fixture,user,product,prefix,discounts,async cleanup(){await fixture.cleanup();await pool.query('DELETE FROM discounts WHERE id=ANY($1::bigint[])',[discounts]);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}};
}
async function request(page:Page,url:string,body?:unknown,csrf=true){return page.evaluate(async({url,body,csrf})=>{const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':document.querySelector<HTMLElement>('[data-csrf]')!.dataset.csrf!}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};},{url,body,csrf});}
test('Discount autocomplete: bounded search, exclusion, immediate attach/clear, failure/retry, order and immediate detach',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const discount of f.discounts.slice(5,7))await pool.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2)',[f.product,discount]);
  await page.goto('/cpanel/products');await page.locator('[data-product-edit="'+f.product+'"]').click();const dialog=page.locator('#product-dialog');
  await dialog.locator('#product-name').fill('Unrelated unsaved Basic');await dialog.locator('[data-tab=discounts]').click();
  await expect(dialog.locator('#product-save')).toBeHidden();await expect(page.locator('#product-choice,#product-attach')).toHaveCount(0);
  const control=dialog.locator('#product-discount-control'),input=control.locator('input'),options=control.locator('[role=option]');
  await input.click();await input.fill(f.prefix);await expect(options).toHaveCount(20);await expect(options.first()).toContainText('Priority 100 · Visible');await expect(options.nth(1)).toContainText('Priority 100 · Hidden');
  await control.locator('[data-ac-more]').click();await expect(options).toHaveCount(22);for(const n of ['05','06'])await expect(options.filter({hasText:f.prefix+' '+n})).toHaveCount(0);
  await options.filter({hasText:f.prefix+' 00'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(dialog.locator('#product-discounts article')).toHaveCount(3);await expect(dialog.locator('#product-status')).toHaveText('Discount attached.');
  expect((await pool.query('SELECT count(*)::int n FROM product_discounts WHERE product_id=$1 AND discount_id=$2',[f.product,f.discounts[0]])).rows[0].n).toBe(1);
  const endpoint='/cpanel/api/products/'+f.product+'/discounts/attach';await page.route('**'+endpoint,route=>route.fulfill({status:500,json:{success:false,code:'PRODUCT_SAVE_FAILED'}}));
  await input.click();await input.fill(f.prefix);await expect(options).toHaveCount(20);await expect(options.filter({hasText:f.prefix+' 00'})).toHaveCount(0);await options.filter({hasText:f.prefix+' 01'}).click();
  await expect(dialog.locator('#product-status')).toHaveText('Failed to attach Discount. Please try again.');await expect(input).toHaveValue(f.prefix+' 01');await expect(dialog.locator('#product-discounts article')).toHaveCount(3);expect((await pool.query('SELECT count(*)::int n FROM product_discounts WHERE product_id=$1 AND discount_id=$2',[f.product,f.discounts[1]])).rows[0].n).toBe(0);
  await page.unroute('**'+endpoint);await input.click();await input.fill(f.prefix);await expect(options).toHaveCount(20);await options.filter({hasText:f.prefix+' 01'}).click();await expect(input).toHaveValue('');await expect(dialog.locator('#product-discounts article')).toHaveCount(4);
  await expect(dialog.locator('#product-discounts article h3')).toHaveText(['00','01','05','06'].map(n=>f.prefix+' '+n));
  expect((await request(page,endpoint,{discount_id:f.discounts[1]})).status).toBe(409);
  const first=dialog.locator('#product-discounts article').first();await first.locator('[data-bs-toggle]').click();await first.getByRole('button',{name:'Detach Discount',exact:true}).click();await expect(dialog.locator('#product-discounts article')).toHaveCount(3);await expect(dialog.locator('#product-status')).toHaveText('Discount detached.');
  await input.click();await input.fill(f.prefix+' 00');await expect(options).toHaveCount(1);await input.fill('no-match-'+f.prefix);await expect(control.locator('[data-ac-status]')).toHaveText('No available Discounts.');
  await dialog.locator('[data-tab=basic]').click();await expect(dialog.locator('#product-name')).toHaveValue('Unrelated unsaved Basic');await expect(dialog.locator('#product-save')).toBeEnabled();expect((await pool.query('SELECT name FROM products WHERE id=$1',[f.product])).rows[0].name).toBe('Fixture Product');
  expect((await pool.query('SELECT count(*)::int n FROM discounts WHERE id=ANY($1::bigint[])',[f.discounts])).rows[0].n).toBe(24);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await f.cleanup();}
});
test('Discount relationship HTTP contract: permissions, CSRF, product scope, server exclusion and duplicate rejection',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!);
 try{
  await page.goto('/cpanel/products');const base='/cpanel/api/products/'+f.product+'/discounts/',query='/cpanel/api/products/discounts?'+new URLSearchParams({product_id:f.product,query:f.prefix});
  expect((await request(page,query)).data.rows).toHaveLength(20);expect((await request(page,query+'&page=2')).data.rows).toHaveLength(4);
  expect((await request(page,base+'attach',{discount_id:f.discounts[0]},false)).status).toBe(403);
  expect((await request(page,base+'attach',{discount_id:f.discounts[0],product_id:'1'})).status).toBe(400);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[f.user.id]);
  expect((await request(page,base+'attach',{discount_id:f.discounts[0]})).status).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.update','true')",[f.user.id]);
  expect((await request(page,query)).status).toBe(403);expect((await request(page,base+'attach',{discount_id:f.discounts[0]})).status).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'discounts.view','true')",[f.user.id]);
  expect((await request(page,base+'attach',{discount_id:f.discounts[0]})).status).toBe(200);expect((await request(page,base+'attach',{discount_id:f.discounts[0]})).status).toBe(409);expect((await request(page,query+'&selected='+f.discounts[0])).data.rows).toEqual([]);
  const before=(await pool.query('SELECT count(*)::int n FROM product_discounts WHERE product_id=$1',[f.product])).rows[0].n;
  expect((await request(page,base+'detach',{discount_id:f.discounts[0]},false)).status).toBe(403);expect((await pool.query('SELECT count(*)::int n FROM product_discounts WHERE product_id=$1',[f.product])).rows[0].n).toBe(before);
  await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='discounts.view'",[f.user.id]);expect((await request(page,base+'detach',{discount_id:f.discounts[0]})).status).toBe(200);
  expect((await pool.query('SELECT count(*)::int n FROM product_discounts WHERE product_id=$1',[f.product])).rows[0].n).toBe(0);
 }finally{await page.goto('about:blank').catch(()=>{});await f.cleanup();}
});

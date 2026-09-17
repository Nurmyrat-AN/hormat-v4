import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
async function login(context:BrowserContext,baseURL:string){
 const user=await bootstrapSuperuser({name:'Create dialog test',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);
 await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL}]);return user;
}
async function get(page:Page,url:string){return page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};},url);}
async function expectCreate(page:Page,sourceId:string,name:string){
 const dialog=page.locator('#product-dialog');await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('data-mode','create');await expect(dialog).toHaveAttribute('data-source-product-id',sourceId);
 await expect(dialog.locator('[data-tab]')).toHaveCount(7);await expect(dialog.locator('[data-tab=basic]')).toBeEnabled();await expect(dialog.locator('[data-tab=basic]')).toHaveAttribute('aria-selected','true');
 for(const tab of ['seo','description','visibility','priceRules','discounts','gallery'])await expect(dialog.locator('[data-tab='+tab+']')).toBeDisabled();
 await expect(dialog.locator('#product-name')).toHaveValue(name);await expect(dialog.locator('#product-name')).toBeEditable();await expect(dialog.locator('#product-source-name')).toContainText(name);await expect(dialog.locator('#product-select-source')).toHaveCount(0);
 await expect(page.locator('[data-create-result],#product-create-form')).toHaveCount(0);
 return dialog;
}
test('Entry A: source selector transfers state into the full existing Product Create dialog without writes',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool),user=await login(context,baseURL!);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const before=(await pool.query('SELECT * FROM products WHERE source_product_id=ANY($1::bigint[]) ORDER BY id',[fixture.ids])).rows;
  await page.goto('/cpanel/products');await page.locator('#product-add').click();const selector=page.locator('#product-source-selector');
  await expect(selector.locator('input:visible,select:visible')).toHaveCount(2);await expect(selector.locator('#product-create-source')).toBeDisabled();await expect(selector.locator('[data-create-proceed]')).toBeDisabled();
  await selector.locator('#product-create-vendor').click();await selector.locator('#product-create-vendor').fill(fixture.prefix);await expect(selector.locator('#product-create-vendor-options [role=option]')).toHaveCount(2);await selector.locator('#product-create-vendor-options [role=option]').first().click();
  await selector.locator('#product-create-source').click();await expect(selector.locator('#product-create-source-options [role=option]')).toHaveCount(12);await selector.locator('#product-create-source-options [role=option]').first().click();
  await expect(selector).toBeVisible();await expect(page.locator('#product-dialog')).toBeHidden();
  await selector.locator('#product-create-vendor').click();await selector.locator('#product-create-vendor').fill(fixture.prefix);await expect(selector.locator('#product-create-vendor-options [role=option]')).toHaveCount(2);await selector.locator('#product-create-vendor-options [role=option]').last().click();await expect(selector.locator('#product-create-source')).toHaveValue('');await expect(selector.locator('[data-create-proceed]')).toBeDisabled();
  await selector.locator('#product-create-source').click();await expect(selector.locator('#product-create-source-options [role=option]')).toHaveCount(1);await selector.locator('#product-create-source-options [role=option]').click();await selector.locator('[data-create-proceed]').click();
  const dialog=await expectCreate(page,fixture.ids[15],fixture.prefix+' 00');await expect(selector).toBeHidden();await expect(page.locator('.modal.show')).toHaveCount(1);
  expect((await pool.query('SELECT * FROM products WHERE source_product_id=ANY($1::bigint[]) ORDER BY id',[fixture.ids])).rows).toEqual(before);
  await dialog.locator('#product-name').fill('Independent storefront name');await dialog.locator('#product-save').click();await expect(dialog).toHaveAttribute('data-mode','edit');await expect(dialog.locator('[data-tab=seo]')).toBeEnabled();await expect(dialog.locator('#product-source-name')).toHaveText(fixture.prefix+' 00');
  const created=(await pool.query('SELECT * FROM products WHERE source_product_id=$1 AND name=$2',[fixture.ids[15],'Independent storefront name'])).rows;expect(created).toHaveLength(1);expect(created[0].is_visible).toBe(false);
  await page.screenshot({path:'artifacts/product-full-create.png',animations:'disabled'});expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});
test('Entry B: same full Product dialog directly, fixed Source and no writes on open',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool),user=await login(context,baseURL!);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const before=(await pool.query('SELECT * FROM products WHERE source_product_id=ANY($1::bigint[]) ORDER BY id',[fixture.ids])).rows;
  await page.goto('/cpanel/source-products?vendor='+fixture.vendors[1]);const card=page.locator('.source-card');await expect(card).toHaveCount(1);await card.locator('[data-bs-toggle=dropdown]').click();await card.locator('[data-source-create]').click();
  const dialog=await expectCreate(page,fixture.ids[15],fixture.prefix+' 00');await expect(page.locator('#product-source-selector')).toHaveCount(0);await expect(page.locator('.modal.show')).toHaveCount(1);
  await dialog.locator('#product-name').fill('Name independent of Source');await expect(dialog.locator('#product-source-name')).toContainText(fixture.prefix+' 00');
  expect((await pool.query('SELECT * FROM products WHERE source_product_id=ANY($1::bigint[]) ORDER BY id',[fixture.ids])).rows).toEqual(before);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});
test('existing Product Edit structure remains intact after extracting the shared dialog',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool),user=await login(context,baseURL!);
 try{
  await page.goto('/cpanel/products');await page.locator('[data-product-edit]').first().click();const dialog=page.locator('#product-dialog');await expect(dialog).toHaveAttribute('data-mode','edit');await expect(dialog.locator('[data-tab]')).toHaveCount(7);const header=await dialog.locator('#product-source-name').textContent();
  for(const tab of ['basic','seo','description','visibility','priceRules','discounts','gallery']){await expect(dialog.locator('[data-tab='+tab+']')).toBeEnabled();await dialog.locator('[data-tab='+tab+']').click();await expect(dialog.locator('[data-pane='+tab+']')).toBeVisible();await expect(dialog.locator('#product-source-name')).toBeVisible();await expect(dialog.locator('#product-source-name')).toHaveText(header!);}
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});
test('lookups: workflow permission, Vendor constraint, hydration and no Product mutation',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool),user=await login(context,baseURL!);
 try{
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.view','true'),($1,'source_products.view','true')",[user.id]);
  await page.goto('/cpanel/products');await expect(page.locator('#product-add')).toBeDisabled();expect((await get(page,'/cpanel/api/product-create/vendors')).status).toBe(403);
  await page.goto('/cpanel/source-products?vendor='+fixture.vendors[1]);await expect(page.locator('[data-source-details]')).toHaveCount(1);await expect(page.locator('[data-source-create]')).toHaveCount(0);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.create','true')",[user.id]);await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='source_products.view'",[user.id]);await page.goto('/cpanel/products');await expect(page.locator('#product-add')).toBeEnabled();
  expect((await get(page,'/cpanel/api/source-products')).status).toBe(403);
  const vendor=await get(page,'/cpanel/api/product-create/vendors?selected='+fixture.vendors[1]);expect(vendor.data.options[0].label).toBe(fixture.prefix+'-1');
  const source=await get(page,'/cpanel/api/product-create/sources?vendor='+fixture.vendors[1]);expect(source.data.options).toHaveLength(1);expect(source.data.options[0].metadata.vendor.id).toBe(fixture.vendors[1]);expect(source.data.options[0].metadata.product_count).toBe(2);expect(source.data.options[0].metadata).not.toHaveProperty('barcodes');
  const hydrated=await get(page,'/cpanel/api/product-create/sources?vendor='+fixture.vendors[1]+'&selected='+fixture.ids[15]);expect(hydrated.data.options[0].value).toBe(fixture.ids[15]);
  expect((await get(page,'/cpanel/api/product-create/sources?vendor='+fixture.vendors[0]+'&selected='+fixture.ids[15])).status).toBe(404);
  for(const query of ['','vendor=x','vendor='+fixture.vendors[0]+'&connection=has','vendor='+fixture.vendors[0]+'&table=users'])expect((await get(page,'/cpanel/api/product-create/sources?'+query)).status).toBe(400);
  expect((await get(page,'/cpanel/api/product-create/sources?vendor='+fixture.vendors[0]+'&query=00X-14')).data.options[0].value).toBe(fixture.ids[14]);
  await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='products.create'",[user.id]);expect((await get(page,'/cpanel/api/product-create/vendors')).status).toBe(403);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});

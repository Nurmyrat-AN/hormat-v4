import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
async function setup(context:BrowserContext,base:string){const f=await sourceBrowserFixture(pool),user=await bootstrapSuperuser({name:'Source Products tab',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(base).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:base}]);return {...f,user,async cleanup(){await f.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}};}
async function open(page:Page,id:string){await page.goto('/cpanel/source-products?vendor='+id);}
async function get(page:Page,url:string){return page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,data:await r.json()};},url);}
test('Source Products tab uses real paginated one-to-many data and shared Create/Edit with return refresh',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(let i=0;i<20;i++)await pool.query('INSERT INTO products(source_product_id,name,is_visible) VALUES($1,$2,$3)',[f.ids[0],'Tab Product '+String(i).padStart(2,'0'),i%2===0]);
  await open(page,f.vendors[0]);await page.locator('[data-source-details="'+f.ids[0]+'"]').click();await page.locator('#source-tab-products').click();const pane=page.locator('#source-pane-products');await expect(pane.locator('[data-storefront-product]')).toHaveCount(20);await expect(pane.locator('[data-source-product-count]')).toContainText('22');await pane.locator('[data-products-more]').click();await expect(pane.locator('[data-storefront-product]')).toHaveCount(22);
  await expect(pane.getByRole('button',{name:/Attach|Detach|Move|Delete/})).toHaveCount(0);await expect(pane.locator('.async-autocomplete')).toHaveCount(0);
  const before=(await pool.query('SELECT count(*)::int n FROM products WHERE source_product_id=$1',[f.ids[0]])).rows[0].n;
  await pane.locator('[data-source-product-create]').click();const editor=page.locator('#product-dialog');await expect(editor).toBeVisible();await expect(page.locator('#source-dialog')).toBeHidden();await expect(page.locator('#product-source-selector')).toHaveCount(0);
  await expect(editor.locator('#product-name')).toHaveValue(f.prefix+' 00');await expect(editor.locator('[data-tab=basic]')).toHaveClass(/active/);for(const tab of ['seo','description','visibility','priceRules','discounts','gallery'])await expect(editor.locator('[data-tab='+tab+']')).toBeDisabled();
  expect((await pool.query('SELECT count(*)::int n FROM products WHERE source_product_id=$1',[f.ids[0]])).rows[0].n).toBe(before);
  const name='Created source tab '+randomUUID();await editor.locator('#product-name').fill(name);await editor.locator('#product-save').click();await expect(editor.locator('[data-tab=seo]')).toBeEnabled();const created=(await pool.query('SELECT id,source_product_id FROM products WHERE name=$1',[name])).rows[0];expect(created.source_product_id).toBe(f.ids[0]);await expect(editor).toBeVisible();
  await editor.locator('.modal-footer [data-bs-dismiss]').click();await expect(page.locator('#source-dialog')).toBeVisible();await expect(pane).toBeVisible();await expect(pane.locator('[data-source-product-count]')).toContainText('23');const row=pane.locator('[data-storefront-product="'+created.id+'"]');await expect(row).toContainText(name);
  await row.locator('[data-source-product-edit]').click();await expect(editor.locator('#product-name')).toHaveValue(name);await editor.locator('#product-name').fill(name+' edited');await editor.locator('#product-save').click();await expect(editor.locator('#product-save')).toBeDisabled();await editor.locator('.modal-footer [data-bs-dismiss]').click();await expect(pane.locator('[data-storefront-product="'+created.id+'"]')).toContainText(name+' edited');
  const all=await get(page,'/cpanel/api/products');expect(all.data.rows.some((r:any)=>r.id===created.id)).toBe(true);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await f.cleanup();}
});
test('Source Products list authorization, source scope and create/update UI permissions',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!);
 try{
  await open(page,f.vendors[0]);const url='/cpanel/api/products/source/'+f.ids[0]+'/products';const result=await get(page,url);expect(result.data.total).toBe(2);expect(result.data.rows).toHaveLength(2);expect((await get(page,url+'?page=0')).status).toBe(400);expect((await get(page,url+'?source_product_id='+f.ids[1])).status).toBe(400);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[f.user.id]);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'source_products.view','true')",[f.user.id]);expect((await get(page,url)).status).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.view','true')",[f.user.id]);expect((await get(page,url)).status).toBe(200);await page.reload();await page.locator('[data-source-details="'+f.ids[0]+'"]').click();await page.locator('#source-tab-products').click();await expect(page.locator('[data-storefront-product]')).toHaveCount(2);await expect(page.locator('[data-source-product-create],[data-source-product-edit]')).toHaveCount(0);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.update','true')",[f.user.id]);await page.reload();await page.locator('[data-source-details="'+f.ids[0]+'"]').click();await page.locator('#source-tab-products').click();await expect(page.locator('[data-source-product-edit]')).toHaveCount(2);await expect(page.locator('[data-source-product-create],[data-source-create]')).toHaveCount(0);await page.locator('[data-source-product-edit]').first().click();await expect(page.locator('#product-dialog')).toBeVisible();
  await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='source_products.view'",[f.user.id]);expect((await get(page,url)).status).toBe(403);
 }finally{await page.goto('about:blank');await f.cleanup();}
});

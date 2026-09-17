import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
test('Product Brand/Category async pagination, paths, hydration, clear and form-only changes',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool);
 const ancestor='Ancestor '+randomUUID(),prefix='ProductLookup-'+randomUUID(),brandIds:string[]=[],categoryIds:string[]=[];
 const user=await bootstrapSuperuser({name:'Product reference UI',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);
 let parent:string|undefined;
 await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
 try{
  parent=(await pool.query('INSERT INTO categories(name,slug) VALUES($1,$2) RETURNING id',[ancestor,randomUUID()])).rows[0].id;
  for(let i=0;i<22;i++){
   brandIds.push((await pool.query('INSERT INTO brands(name,slug) VALUES($1,$2) RETURNING id',[prefix+' '+String(i).padStart(2,'0'),randomUUID()])).rows[0].id);
   categoryIds.push((await pool.query('INSERT INTO categories(name,slug,parent_id) VALUES($1,$2,$3) RETURNING id',[prefix+' '+String(i).padStart(2,'0'),randomUUID(),parent])).rows[0].id);
  }
  const before=(await pool.query('SELECT id,brand_id,category_id,updated_at FROM products ORDER BY id')).rows;
  const lookups:string[]=[];page.on('request',r=>{if(r.url().includes('/api/product-references/'))lookups.push(r.url());});
  await page.goto('/cpanel/products');expect(lookups).toEqual([]);await page.locator('[data-product-edit="'+(await pool.query('SELECT id FROM products WHERE source_product_id=$1 ORDER BY id',[fixture.ids[0]])).rows[0].id+'"]').click();
  const dialog=page.locator('#product-dialog');await expect(dialog.locator('#product-pane-basic #product-source')).toHaveCount(0);await expect(dialog.locator('.modal-header #product-source-name')).toBeVisible();expect(lookups).toEqual([]);
  for(const key of ['brand','category']){
   const control=dialog.locator('#product-'+key+'-control'),input=dialog.locator('#product-'+key);
   await expect(input).toHaveAttribute('role','combobox');await input.click();await input.fill(prefix+' ');await expect(control.locator('[role=option]')).toHaveCount(20);
   await control.locator('[data-ac-more]').click();await expect(control.locator('[role=option]')).toHaveCount(22);
   if(key==='category')await expect(control.locator('[role=option]').first().locator('small')).toHaveText(ancestor);
   await control.locator('[role=option]').first().click();await expect(input).toHaveValue(prefix+' 00');await expect(dialog.locator('#product-save')).toBeEnabled();
  }
  expect((await pool.query('SELECT id,brand_id,category_id,updated_at FROM products ORDER BY id')).rows).toEqual(before);
  // Only explicit Basic Save persists; reopen proves selected-ID hydration.
  await dialog.locator('#product-save').click();await expect(dialog.locator('#product-save')).toBeDisabled();await dialog.locator('.modal-footer [data-bs-dismiss]').click();
  await page.locator('[data-product-edit="'+(await pool.query('SELECT id FROM products WHERE source_product_id=$1 ORDER BY id',[fixture.ids[0]])).rows[0].id+'"]').click();
  for(const key of ['brand','category']){await expect(dialog.locator('#product-'+key)).toHaveValue(prefix+' 00');await dialog.locator('#product-'+key+'-control [data-ac-clear]').click();await expect(dialog.locator('#product-'+key)).toHaveValue('');}
  expect(lookups.some(url=>url.includes('selected='+brandIds[0]))).toBe(true);expect(lookups.some(url=>url.includes('selected='+categoryIds[0]))).toBe(true);
  expect((await pool.query('SELECT count(*)::int AS n FROM products WHERE brand_id=$1 AND category_id=$2',[brandIds[0],categoryIds[0]])).rows[0].n).toBe(1);
  // Lookup authorization is scoped to Product workflows and rechecked on each request.
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);
  for(const kind of ['brands','categories'])expect(await page.evaluate(async kind=>(await fetch('/cpanel/api/product-references/'+kind)).status,kind)).toBe(403);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('UPDATE products SET brand_id=NULL,category_id=NULL WHERE brand_id=ANY($1::bigint[]) OR category_id=ANY($2::bigint[])',[brandIds,categoryIds]);await pool.query('DELETE FROM categories WHERE id=ANY($1::bigint[])',[categoryIds]);if(parent)await pool.query('DELETE FROM categories WHERE id=$1',[parent]);await pool.query('DELETE FROM brands WHERE id=ANY($1::bigint[])',[brandIds]);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});
test('long real Source header remains outside Basic with close button and tabs usable',async({page,context,baseURL})=>{
 const fixture=await sourceBrowserFixture(pool),user=await bootstrapSuperuser({name:'Product header UI',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id);
 const name='BT Deep Freezer SUPERMAX BD-140 / 54*80*48 '+('Long Source Product name '.repeat(6));
 try{
  await pool.query('UPDATE source_products SET name=$2 WHERE id=$1',[fixture.ids[15],name]);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  await page.goto('/cpanel/source-products?vendor='+fixture.vendors[1]);await page.locator('.source-card [data-bs-toggle=dropdown]').click();await page.locator('[data-source-create]').click();const dialog=page.locator('#product-dialog');
  await expect(dialog.locator('.modal-header #product-source-name')).toHaveText(name.trim());await expect(dialog.locator('#product-source-name')).toHaveAttribute('title',name);await expect(dialog.locator('#product-source-meta')).toContainText('12.345678 USD');await expect(dialog.locator('#product-pane-basic #product-source-name,#product-pane-basic #product-source')).toHaveCount(0);
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);await expect(dialog.locator('.modal-header .btn-close').first()).toBeInViewport();await page.screenshot({path:'artifacts/product-header-'+theme+'.png',animations:'disabled'});}
  await page.setViewportSize({width:390,height:844});await expect(dialog.locator('.modal-header .btn-close').first()).toBeInViewport();await expect(dialog.locator('[data-tab=basic]')).toBeInViewport();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 }finally{await page.goto('about:blank').catch(()=>{});await fixture.cleanup();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});

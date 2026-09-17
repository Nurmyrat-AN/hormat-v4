import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from './fixtures/source-browser.js';
async function setup(context:BrowserContext,base:string){
 const source=await sourceBrowserFixture(pool),user=await bootstrapSuperuser({name:'Attachments test',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id),prefix='Attach-'+randomUUID();
 const entities:Record<string,string[]>={brands:[],categories:[],discounts:[]};
 for(const kind of Object.keys(entities))for(let i=0;i<2;i++){entities[kind].push((await pool.query(kind==='discounts'?'INSERT INTO discounts(name) VALUES($1) RETURNING id':`INSERT INTO ${kind}(name,slug) VALUES($1,$2) RETURNING id`,kind==='discounts'?[prefix+' '+i]:[prefix+' '+i,randomUUID()])).rows[0].id);}
 const products:string[]=[];for(let i=0;i<24;i++)products.push((await pool.query('INSERT INTO products(source_product_id,name) VALUES($1,$2) RETURNING id',[source.ids[0],prefix+' '+String(i).padStart(2,'0')])).rows[0].id);
 await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(base).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:base}]);
 return {source,user,prefix,entities,products,async cleanup(){await source.cleanup();await pool.query('UPDATE categories SET parent_id=NULL WHERE id=ANY($1::bigint[])',[entities.categories]);for(const kind of Object.keys(entities))await pool.query(`DELETE FROM ${kind} WHERE id=ANY($1::bigint[])`,[entities[kind]]);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}};
}
async function call(page:Page,url:string,body?:unknown,csrf=true){return page.evaluate(async({url,body,csrf})=>{const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':document.querySelector<HTMLElement>('[data-csrf]')!.dataset.csrf!}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};},{url,body,csrf});}
for(const kind of ['brands','categories','discounts'])test(kind+' Products: search pages, immediate attach, clear, move/cancel, detach and counts',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!),[a,b]=f.entities[kind],p=f.products[0],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  if(kind!=='discounts')await pool.query(`UPDATE products SET ${kind==='brands'?'brand_id':'category_id'}=$2 WHERE id=$1`,[f.products[1],b]);
  else await pool.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2)',[f.products[0],b]);
  await page.goto('/cpanel/'+kind);const search=page.locator(kind==='discounts'?'#discount-search':'#'+kind+'-search');await search.fill(f.prefix);
  const card=page.locator('[data-'+(kind==='categories'?'category':kind==='brands'?'brand':'discount')+'-id="'+a+'"]');await expect(card).toBeVisible();await card.locator('[data-bs-toggle]').click();await card.locator(kind==='discounts'?'[data-action=edit]':'[data-'+(kind==='brands'?'brand':'category')+'-action=edit]').click();
  const dialog=page.locator(kind==='discounts'?'#discount-dialog':'#brand-dialog');await dialog.locator('[data-tab=products]').click();const area=dialog.locator('[data-attached-products]'),input=area.locator('[data-ac-input]'),options=area.locator('[role=option]');
  await input.click();await input.fill(f.prefix);await expect(options).toHaveCount(20);await area.locator('[data-ac-more]').click();await expect(options).toHaveCount(24);
  if(kind==='brands'){
   const endpoint='**/cpanel/api/products/attachments/brands/'+a+'/attach';await page.route(endpoint,route=>route.fulfill({status:500,json:{success:false,code:'PRODUCT_SAVE_FAILED'}}));
   await options.filter({hasText:f.prefix+' 00'}).click();await expect(input).toHaveValue(f.prefix+' 00');await expect(area.locator('[data-attached-product]')).toHaveCount(0);await expect(input).toBeEnabled();
   await page.unroute(endpoint);await input.click();await input.fill(f.prefix);await expect(options).toHaveCount(20);
  }
  await options.filter({hasText:f.prefix+' 00'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(area.locator('[data-attached-product]')).toHaveCount(1);await expect(area.locator('[data-attached-status]')).toHaveText('Product attached.');
  await input.click();await input.fill(f.prefix+' 00');await expect(area.locator('[data-ac-status]')).toHaveText('No results');
  if(kind!=='discounts'){
   await input.fill(f.prefix+' 01');await options.click();await expect(area.locator('[data-move-confirm]')).toBeVisible();await area.locator('[data-move-cancel]').click();expect((await pool.query(`SELECT ${kind==='brands'?'brand_id':'category_id'} AS parent FROM products WHERE id=$1`,[f.products[1]])).rows[0].parent).toBe(b);
   await input.click();await input.fill(f.prefix+' 01');await options.click();await area.locator('[data-move-accept]').click();await expect(input).toHaveValue('');await expect(area.locator('[data-attached-product]')).toHaveCount(2);
   const detail=await call(page,'/cpanel/api/products/'+f.products[1]);expect(detail.data.row.basic[kind==='brands'?'brand':'category']).toBe(a);
  }
  const row=area.locator('[data-attached-product="'+p+'"]');await row.locator('[data-bs-toggle]').click();await row.locator('[data-detach-product]').click();await expect(row).toHaveCount(0);await expect(area.locator('[data-attached-status]')).toHaveText('Product detached.');
  await input.click();await input.fill(f.prefix+' 00');await expect(options).toHaveCount(1);
  const count=await call(page,'/cpanel/api/products/attachments/'+kind+'/'+a);expect(count.data.counts.direct).toBe(kind==='discounts'?0:1);
  if(kind==='discounts')expect((await pool.query('SELECT discount_id FROM product_discounts WHERE product_id=$1',[p])).rows.map(r=>r.discount_id)).toEqual([b]);
  await expect(dialog.locator('.modal-footer [data-save]:visible,.modal-footer button[id^=discount-save]:visible')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');await f.cleanup();}
});
test('Attachment API: direct/subtree distinction, persistence isolation, conflicts, pagination, independent permissions and CSRF',async({page,context,baseURL})=>{
 const f=await setup(context,baseURL!);
 try{
  await page.goto('/cpanel/brands');const p=f.products[0],q=f.products[1],[root,child]=f.entities.categories;
  await pool.query('UPDATE categories SET parent_id=$1 WHERE id=$2',[root,child]);
  const before=(await pool.query('SELECT * FROM products WHERE id=$1',[p])).rows[0];
  for(const kind of ['brands','categories','discounts']){
   const [a,b]=f.entities[kind],url='/cpanel/api/products/attachments/'+kind+'/'+a;
   const lookup=url+'?lookup=1&query='+encodeURIComponent(f.prefix);expect((await call(page,lookup)).data.rows).toHaveLength(20);expect((await call(page,lookup+'&page=2')).data.rows).toHaveLength(4);
   expect((await call(page,url+'/attach',{product_id:p},false)).status).toBe(403);expect((await call(page,url+'/attach',{product_id:p,name:'bad'})).status).toBe(400);
   expect((await call(page,url+'/attach',{product_id:p})).status).toBe(200);expect((await call(page,url+'/attach',{product_id:p})).status).toBe(409);expect((await call(page,lookup+'&selected='+p)).data.rows).toEqual([]);
   if(kind!=='discounts'){
    const move='/cpanel/api/products/attachments/'+kind+'/'+b+'/attach';expect((await call(page,move,{product_id:p})).data.code).toBe('PRODUCT_MOVE_REQUIRED');
    expect((await call(page,move,{product_id:p,expected_parent_id:a})).status).toBe(200);expect((await call(page,url+'/detach',{product_id:p})).status).toBe(409);
    expect((await call(page,'/cpanel/api/products/attachments/'+kind+'/'+b+'/detach',{product_id:p})).status).toBe(200);
   }else expect((await call(page,url+'/detach',{product_id:p})).status).toBe(200);
   await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[f.user.id]);
   await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,'true')",[f.user.id,kind+'.update']);expect((await call(page,url+'/attach',{product_id:p})).status).toBe(403);
   await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'products.view','true')",[f.user.id]);expect((await call(page,url+'/attach',{product_id:p})).status).toBe(200);
   expect((await call(page,url)).status).toBe(403);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,'true')",[f.user.id,kind+'.view']);expect((await call(page,url)).status).toBe(200);
   await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key=$2",[f.user.id,kind+'.update']);expect((await call(page,url+'/detach',{product_id:p})).status).toBe(403);
   await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'superuser','true')",[f.user.id]);expect((await call(page,url+'/detach',{product_id:p})).status).toBe(200);
  }
  const after=(await pool.query('SELECT * FROM products WHERE id=$1',[p])).rows[0];delete before.updated_at;delete after.updated_at;expect(after).toEqual(before);
  await pool.query('UPDATE products SET category_id=$1 WHERE id=$2',[child,q]);
  const base='/cpanel/api/products/attachments/categories/'+root;const state=await call(page,base);expect(state.data.counts).toEqual({direct:0,total:1});expect(state.data.rows).toEqual([]);
  expect((await call(page,base+'/attach',{product_id:q,expected_parent_id:child})).status).toBe(200);expect((await call(page,base)).data.counts).toEqual({direct:1,total:1});
  // Child reassignment cannot be overwritten by a stale confirmed move.
  expect((await call(page,'/cpanel/api/products/attachments/categories/'+child+'/attach',{product_id:q,expected_parent_id:child})).status).toBe(409);
  for(const product of f.products)await pool.query('UPDATE products SET brand_id=$1 WHERE id=$2',[f.entities.brands[0],product]);
  const attached='/cpanel/api/products/attachments/brands/'+f.entities.brands[0];expect((await call(page,attached)).data.rows).toHaveLength(20);expect((await call(page,attached+'?page=2')).data.rows).toHaveLength(4);
 }finally{await page.goto('about:blank');await f.cleanup();}
});

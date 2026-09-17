import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {VendorCredentials} from '../src/vendors/credentials.js';
import {config} from '../src/config/env.js';
async function fixture(){
 const name='reset-ui-'+randomUUID();
 const id=(await pool.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active,last_sequence,date_last_sync,date_last_operation) VALUES($1,'http://example.invalid/db','test',$2,false,'ABC123',now(),now()) RETURNING id",[name,new VendorCredentials(config.vendors.credentialsKey).encryptSecret('test')])).rows[0].id;
 await pool.query('INSERT INTO vendor_sync_sources(vendor_id,source_url) SELECT id,url FROM vendors WHERE id=$1',[id]);
 const w=(await pool.query("INSERT INTO warehouses(vendor_id,source_id,name) VALUES($1,'w','Warehouse') RETURNING id",[id])).rows[0].id;
 const p=(await pool.query("INSERT INTO source_products(vendor_id,source_id,name) VALUES($1,'p','Product') RETURNING id",[id])).rows[0].id;
 await pool.query("INSERT INTO product_barcodes(vendor_id,product_id,barcode) VALUES($1,$2,'00123')",[id,p]);await pool.query('INSERT INTO products(source_product_id,name) VALUES($1,\'Fixture Product\')',[p]);
 await pool.query('INSERT INTO product_stocks(vendor_id,product_id,warehouse_id,stock) VALUES($1,$2,$3,-10)',[id,p,w]);await pool.query("INSERT INTO source_stock_movements(vendor_id,source_document_id,product_id,warehouse_id,stock_delta) VALUES($1,'sale',$2,$3,-10)",[id,p,w]);
 return {id,name,p,w};
}
async function clean(id:string){await pool.query('DELETE FROM products WHERE source_product_id IN(SELECT id FROM source_products WHERE vendor_id=$1)',[id]);for(const t of ['product_stocks','source_stock_movements','product_barcodes','source_products','warehouses','vendor_sync_sources'])await pool.query(`DELETE FROM ${t} WHERE vendor_id=$1`,[id]);await pool.query('DELETE FROM vendors WHERE id=$1',[id]);}
for(const language of ['tm','ru','en'])test(`Reset Sync ${language}: confirmation, themes/mobile, retry, busy button and real selected-Vendor persistence`,async({page,context,baseURL})=>{
 test.setTimeout(60000);const v=await fixture();let user='';
 try{
  user=(await bootstrapSuperuser({name:'Reset reviewer',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:language,url:baseURL!}]);
  const translations=(await pool.query('SELECT * FROM interface_translations WHERE language_code=$1',[language])).rows,t=(key:string)=>translations.find(r=>r.translation_key===key).translation_value;
  await page.goto('/cpanel/vendors');await page.locator('#vendors-status').selectOption('inactive');await page.locator('#vendors-search').fill(v.name);await expect(page.locator('.vendor-item [data-value=name]')).toHaveText(v.name);
  const open=async()=>{await page.locator('.vendor-item[data-vendor-id="'+v.id+'"] [data-bs-toggle=dropdown]').click();await page.locator('.vendor-item[data-vendor-id="'+v.id+'"] [data-vendor-action=reset]').click();await expect(page.locator('#vendor-reset-name')).toHaveText(v.name);await expect(page.locator('#vendor-save')).toBeEnabled();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#vendor-dialog')!).opacity==='1');};
  for(const theme of ['light','dark'])for(const width of [1440,375]){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);await page.locator('[data-vendors-view='+ (width===1440?'grid':'list')+']').click();await open();
   await expect(page.locator('#vendor-dialog-title')).toHaveText(t('cpanel.vendors.resetTitle'));await expect(page.locator('#vendor-cancel')).toHaveText(t('cpanel.users.cancel'));await expect(page.locator('#vendor-save')).toHaveText(t('cpanel.vendors.resetSync'));
   const text=await page.locator('#vendor-dialog').innerText();for(const key of ['resetPause','resetStock','resetMovements','resetCheckpoint','resetDates','resetReplay','resetKeep'])expect(text).toContain(t('cpanel.vendors.'+key));expect(text).not.toMatch(/cpanel\./);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
   await page.screenshot({path:`artifacts/vendor-reset-${language}-${theme}-${width}.png`,animations:'disabled'});await page.locator('#vendor-cancel').click();await expect(page.locator('#vendor-dialog')).not.toBeVisible();
  }
  expect((await pool.query('SELECT last_sequence FROM vendors WHERE id=$1',[v.id])).rows[0].last_sequence).toBe('ABC123');
  await open();let requests=0;await page.route('**/cpanel/api/vendors/'+v.id+'/reset-sync',async route=>{requests++;await new Promise(r=>setTimeout(r,250));await route.fulfill({status:500,json:{success:false,code:'VENDOR_RESET_FAILED'}});});
  await page.locator('#vendor-save').click();await expect(page.locator('#vendor-save')).toBeDisabled();await expect(page.locator('#vendor-cancel')).toBeDisabled();await expect(page.locator('#vendor-notice')).toHaveText(t('cpanel.vendors.resetFailed'));await expect(page.locator('#vendor-save')).toBeEnabled();expect(requests).toBe(1);expect((await pool.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock).toBe('-10');await page.unroute('**/cpanel/api/vendors/'+v.id+'/reset-sync');
  await page.locator('#vendor-save').click();await expect(page.locator('#vendor-dialog')).not.toBeVisible();await expect(page.locator('#vendors-feedback')).toHaveText(t('cpanel.vendors.resetCompleted'));await expect(page.locator('[data-value=lastSequence]')).toHaveText('0');await expect(page.locator('[data-value=lastSync]')).toHaveText('—');await expect(page.locator('[data-value=lastOperation]')).toHaveText('—');await expect(page.locator('[data-value=healthLabel]')).toHaveText(t('cpanel.vendors.notSynced'));
  for(const table of ['product_stocks','source_stock_movements'])expect((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE vendor_id=$1`,[v.id])).rows[0].n).toBe(0);
  expect((await pool.query('SELECT source_product_id FROM products WHERE source_product_id=$1',[v.p])).rows[0].source_product_id).toBe(v.p);expect((await pool.query('SELECT id FROM warehouses WHERE vendor_id=$1',[v.id])).rows[0].id).toBe(v.w);expect((await pool.query('SELECT barcode FROM product_barcodes WHERE vendor_id=$1',[v.id])).rows[0].barcode).toBe('00123');
 }finally{await page.goto('about:blank');await clean(v.id);if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);}
});
test('Reset HTTP strict independent permission, UI capability, revocation, CSRF, malformed payload and no target override',async({page,context,baseURL})=>{
 const v=await fixture();let user='';
 try{user=(await bootstrapSuperuser({name:'Reset HTTP',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user),cookie=process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',headers={Cookie:cookie+'='+session.token,'X-CSRF-Token':session.session.csrf_token};const url='/cpanel/api/vendors/'+v.id+'/reset-sync';
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user]);
  const before=(await pool.query('SELECT * FROM vendors WHERE id=$1',[v.id])).rows;
  for(const key of ['vendors.view','vendors.update','vendors.status','vendors.reset_sync'])for(const value of [false,'true',1,true]){await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user]);await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[user,key,JSON.stringify(value)]);if(key==='vendors.reset_sync'&&value===true)continue;expect((await context.request.post(url,{headers,data:{}})).status()).toBe(403);}
  expect((await pool.query('SELECT * FROM vendors WHERE id=$1',[v.id])).rows).toEqual(before);
  for(const csrf of ['', 'wrong'])expect((await context.request.post(url,{headers:{...headers,'X-CSRF-Token':csrf},data:{}})).status()).toBe(403);
  for(const data of [{id:v.id},{vendor_id:v.id},{last_sequence:'0'},[],null,true])expect((await context.request.post(url,{headers:{...headers,'Content-Type':'application/json'},data:JSON.stringify(data)})).status()).toBe(400);
  expect((await context.request.post(url+'?id=97',{headers,data:{}})).status()).toBe(400);expect((await pool.query('SELECT * FROM vendors WHERE id=$1',[v.id])).rows).toEqual(before);
  expect((await context.request.get('/cpanel/vendors',{headers})).status()).toBe(403);expect((await context.request.post(url,{headers,data:{}})).status()).toBe(200);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'vendors.view','true')",[user]);await context.addCookies([{name:cookie,value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);await page.goto('/cpanel/vendors');await page.locator('#vendors-status').selectOption('inactive');await page.locator('#vendors-search').fill(v.name);await expect(page.locator('[data-vendor-action=reset]')).toHaveCount(1);
  await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='vendors.reset_sync'",[user]);await page.reload();await expect(page.locator('[data-vendor-action=reset]')).toHaveCount(0);expect((await context.request.post(url,{headers,data:{}})).status()).toBe(403);
 }finally{await clean(v.id);if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);}
});

import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import pg from 'pg';
import {pool} from '../src/database/pool.js';
import {config} from '../src/config/env.js';
import {migrate} from '../src/database/migrate.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../src/cpanel/auth/sessions.js';

test('Settings production UI: atomic persistence, valid options, localization, themes, permissions and CSRF',async({page,context})=>{
 test.setTimeout(60000);
 const schema='settings_browser_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),base='http://127.0.0.1:3107';let server:ReturnType<typeof spawn>|undefined;
 await pool.query(`CREATE SCHEMA ${schema}`);
 try{
  await migrate(db);const user=await bootstrapSuperuser({name:'Settings review',email:randomUUID()+'@example.invalid',password:randomUUID()},db),session=await new SessionRepository(db).create(user.id);
  const currency=(await db.query("INSERT INTO frontend_currencies(name,code,symbol,rate,is_visible) VALUES('Manat','TMT','m','1',true) RETURNING id::text")).rows[0].id;
  await db.query("INSERT INTO frontend_currencies(name,code,symbol,is_visible) VALUES('Hidden currency','H','?',false)");
  const payment=(await db.query("INSERT INTO payment_types(name,is_visible) VALUES('Cash',true) RETURNING id::text")).rows[0].id;
  const delivery=(await db.query("INSERT INTO delivery_types(name,is_visible) VALUES('Courier',true) RETURNING id::text")).rows[0].id;
  const orderStatus=(await db.query("INSERT INTO order_statuses(name,is_visible) VALUES('New Order',true) RETURNING id::text")).rows[0].id;
  server=spawn(process.execPath,['dist/server.js'],{env:{...process.env,PGOPTIONS:`-c search_path=${schema}`,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3107',VENDOR_SYNC_ENABLED:'false'},stdio:'ignore'});
  await expect.poll(async()=>{try{return(await fetch(base+'/health')).status;}catch{return 0;}},{timeout:15000}).toBe(200);
  await page.goto(base+'/cpanel/settings');await expect(page).toHaveURL(/\/cpanel\/login/);
  await context.addCookies([{name:'__Secure-hormat_cpanel',value:session.token,domain:'127.0.0.1',path:'/cpanel',httpOnly:true,secure:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:base}]);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  expect((await page.goto(base+'/cpanel/settings'))!.status()).toBe(200);await expect(page.locator('aside a[href="/cpanel/settings"]')).toHaveCount(1);
  await expect(page.locator('#settings-language')).toHaveValue('tm');await expect(page.locator('#settings-currency')).toHaveValue('');await expect(page.locator('#settings-currency option')).toHaveCount(2);await expect(page.locator('#settings-payment')).toHaveValue('');await expect(page.locator('#settings-save')).toBeDisabled();
  const call=async(body:unknown,csrf=true)=>page.evaluate(async({body,token})=>{const r=await fetch('/cpanel/api/settings/defaults',{method:'PUT',headers:{'Content-Type':'application/json',...(token?{'X-CSRF-Token':token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json().catch(()=>null)};},{body,token:csrf?session.session.csrf_token:''});
  const desired={orderStatus,language:'ru',currency,payment,delivery};expect((await call(desired,false)).status).toBe(403);expect((await db.query('SELECT * FROM settings')).rowCount).toBe(0);
  await page.locator('#settings-language').selectOption('ru');await page.locator('#settings-currency').selectOption(currency);await page.locator('#settings-payment').selectOption(payment);await page.locator('#settings-delivery').selectOption(delivery);await page.locator('#settings-orderStatus').selectOption(orderStatus);await page.locator('#settings-save').click();await expect(page.locator('#settings-status')).toHaveText('Defaults saved.');await expect(page.locator('#settings-save')).toBeDisabled();await page.reload();
  for(const [key,value]of Object.entries(desired))await expect(page.locator('#settings-'+key)).toHaveValue(value??'');
  await page.locator('#settings-payment').selectOption('');await page.locator('#settings-delivery').selectOption('');await page.locator('#settings-orderStatus').selectOption('');await page.locator('#settings-save').click();await expect(page.locator('#settings-status')).toHaveText('Defaults saved.');await page.reload();await expect(page.locator('#settings-payment')).toHaveValue('');await expect(page.locator('#settings-delivery')).toHaveValue('');
  const bad=await call({...desired,currency:'9223372036854775807'});expect(bad.status).toBe(400);expect((await db.query('SELECT id FROM payment_types WHERE is_default')).rowCount).toBe(0);
  const hidden=await page.evaluate(async({currency,csrf})=>{const r=await fetch('/cpanel/api/currencies/frontend/'+currency,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({is_visible:false})});return {status:r.status,body:await r.json()};},{currency,csrf:session.session.csrf_token});expect(hidden.status).toBe(409);expect(hidden.body.code).toBe('CURRENCY_DEFAULT_PROTECTED');
  for(const language of ['tm','ru','en']){await page.locator('#shell-language').selectOption(language);await expect(page).toHaveURL(base+'/cpanel/settings');await expect(page.locator('html')).toHaveAttribute('lang',language);expect(await page.locator('main').innerText()).not.toMatch(/cpanel\./);}
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.setAttribute('data-bs-theme',theme),theme);await page.screenshot({path:'artifacts/settings-'+theme+'.png'});}
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // No domain permissions: Settings view/update are sufficient; revoked update retains draft for retry.
  await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'settings.view','true')",[user.id]);await page.reload();await expect(page.locator('#settings-save')).toHaveCount(0);await expect(page.locator('#settings-language')).toBeDisabled();expect((await call(desired)).status).toBe(403);
  await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'settings.update','true')",[user.id]);await page.reload();await page.locator('#settings-payment').selectOption(payment);await db.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='settings.update'",[user.id]);await page.locator('#settings-save').click();await expect(page.locator('#settings-status')).toHaveText('Could not save defaults. Please try again.');await expect(page.locator('#settings-payment')).toHaveValue(payment);await expect(page.locator('#settings-save')).toBeEnabled();await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'settings.update','true')",[user.id]);await page.locator('#settings-save').click();await expect(page.locator('#settings-status')).toHaveText('Defaults saved.');
  await db.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='settings.view'",[user.id]);expect((await page.goto(base+'/cpanel/settings'))!.status()).toBe(403);expect((await call(desired)).status).toBe(200);expect(errors).toEqual([]);
 }finally{await page.goto('about:blank');if(server&&server.exitCode===null){const done=once(server,'exit');server.kill('SIGTERM');await done;}await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);}
});

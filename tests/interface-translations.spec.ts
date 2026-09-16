import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
test('Interface translations: real filtering/edit/clear, immutable keys, permissions/CSRF, cache and themes',async({page,context,baseURL})=>{
 const user=await bootstrapSuperuser({name:'Translation browser',email:randomUUID()+'@example.invalid',password:randomUUID()}),session=await sessions.create(user.id),key='test.interface'+randomUUID().replaceAll('-','');
 const original=(await pool.query("SELECT translation_value FROM interface_translations WHERE language_code='en' AND translation_key='frontend.title'")).rows[0].translation_value;
 await pool.query('INSERT INTO interface_translations VALUES($1,$2,$3),($4,$2,$5),($6,$2,NULL)',['tm',key,'Fixture TM','en','Fixture EN','ru']);
 await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
 const call=async(method:string,path:string,body?:unknown,csrf=true)=>page.evaluate(async({method,path,body,token})=>{const response=await fetch('/cpanel/api/interface-translations'+path,{method,headers:{'Content-Type':'application/json',...(token?{'X-CSRF-Token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json().catch(()=>null)};},{method,path,body,token:csrf?session.session.csrf_token:''});
 const close=async()=>{await page.waitForFunction(()=>!(window as any).bootstrap.Modal.getInstance(document.getElementById('translation-dialog'))._isTransitioning);await page.locator('#translation-dialog .modal-footer [data-bs-dismiss]').click();await expect(page.locator('#translation-dialog')).toBeHidden();};
 const grants=async(keys:string[])=>{await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);for(const permission of keys)await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,to_jsonb(true))',[user.id,permission]);};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  expect((await page.goto('/cpanel/interface-translations'))!.status()).toBe(200);await expect(page.locator('.shell-sidebar a[href="/cpanel/interface-translations"]')).toHaveCount(1);
  await page.locator('#translations-search').fill(key);await expect(page.locator('#translations-table tbody tr')).toHaveCount(1);await expect(page.locator('#translations-table')).toContainText('Missing translations: RU');
  await page.locator('#translations-completion').selectOption('missing');await page.locator('#translations-language').selectOption('ru');await expect(page.locator('#translations-table')).toContainText(key);
  await page.locator('#translations-table button').filter({hasText:key}).click();await expect(page.locator('#translation-key')).toHaveAttribute('readonly','');await expect(page.locator('#translation-fields textarea')).toHaveCount(3);await expect(page.locator('#translation-fields')).toContainText('Default Language');
  await page.locator('#translation-value-ru').fill('Проверенный перевод');await page.locator('#translation-save').click();await expect(page.locator('#translation-feedback')).toHaveText('Translations saved.');await close();await expect(page.locator('#translations-table')).not.toContainText(key);
  await page.locator('#translations-completion').selectOption('complete');await page.locator('#translations-search').fill('Проверенный перевод');await expect(page.locator('#translations-table')).toContainText(key);
  await page.locator('#translations-table button').filter({hasText:key}).click();await page.locator('#translation-value-ru').fill('   ');await page.locator('#translation-save').click();await expect(page.locator('#translation-feedback')).toHaveText('Translations saved.');await close();
  expect((await pool.query('SELECT translation_value FROM interface_translations WHERE language_code=$1 AND translation_key=$2',['ru',key])).rows[0].translation_value).toBeNull();
  await page.locator('#translations-completion').selectOption('all');await page.locator('#translations-search').fill(key);await expect(page.locator('#translations-table')).toContainText(key);await page.reload();await page.locator('#translations-search').fill(key);await expect(page.locator('#translations-table')).toContainText('Missing translations: RU');
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.setAttribute('data-bs-theme',theme),theme);await page.screenshot({path:'artifacts/interface-translations-'+theme+'.png'});}
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:720});
  expect((await call('PUT','/'+key,{values:{ru:'No'}},false)).status).toBe(403);
  expect((await call('PUT','/'+key,{key:'other.key',values:{ru:'No'}})).status).toBe(400);expect((await call('PUT','/unknown.key',{values:{en:'No'}})).status).toBe(404);expect((await call('POST','',{key:'new.key'})).status).toBe(404);expect((await call('DELETE','/'+key)).status).toBe(404);
  await grants(['interface_translations.view']);await page.reload();await page.locator('#translations-search').fill(key);await page.locator('#translations-table button').filter({hasText:key}).click();await expect(page.locator('#translation-fields textarea').first()).toBeDisabled();await expect(page.locator('#translation-save')).toHaveCount(0);await close();expect((await call('PUT','/'+key,{values:{ru:'No'}})).status).toBe(403);
  await grants(['interface_translations.update']);expect((await call('GET','')).status).toBe(403);expect((await call('PUT','/'+key,{values:{ru:'Allowed'}})).status).toBe(200);
  // A committed edit is visible to normal runtime rendering without restart.
  expect((await call('PUT','/frontend.title',{values:{en:'Translation cache verified'}})).status).toBe(200);await page.goto('/');await expect(page.locator('h1')).toHaveText('Translation cache verified');
  await call('PUT','/frontend.title',{values:{en:original}});expect(errors).toEqual([]);
 }finally{await pool.query("UPDATE interface_translations SET translation_value=$1 WHERE language_code='en' AND translation_key='frontend.title'",[original]);await pool.query('DELETE FROM interface_translations WHERE translation_key=$1',[key]);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]);}
});

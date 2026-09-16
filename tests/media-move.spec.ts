import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';

test('Move HTTP: independent authority, CSRF, fresh revocation, Super User, URL and database-reference preservation',async({context,browser,baseURL})=>{
 const folder='move-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(path.join(root,'A'),{recursive:true});await mkdir(path.join(root,'B'));await writeFile(path.join(root,'A/file.txt'),'bytes');
  id=(await bootstrapSuperuser({name:'Move actor',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(id);
  const headers={Cookie:(process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel')+'='+session.token,'X-CSRF-Token':session.session.csrf_token};
  const data={path:folder+'/A/file.txt',destination:folder+'/B'},post=(body:unknown=data,h=headers)=>context.request.post('/cpanel/api/media/move',{headers:h,data:body});
  const anonymous=await browser.newContext({baseURL});try{expect((await anonymous.request.post('/cpanel/api/media/move',{data,maxRedirects:0})).status()).toBe(303);}finally{await anonymous.close();}
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);
  for(const value of [undefined,false,'true',1,null,{}]){
   if(value!==undefined)await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'media.move',$2::jsonb) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value",[id,JSON.stringify(value)]);
   expect((await post()).status()).toBe(403);expect((await context.request.get('/cpanel/api/media/move-folders?path=',{headers})).status()).toBe(403);
  }
  await pool.query("UPDATE cpanel_user_permissions SET value='true' WHERE user_id=$1 AND key='media.move'",[id]);
  expect((await context.request.get('/cpanel/media',{headers})).status()).toBe(403);
  expect((await context.request.get('/cpanel/api/media/move-folders?path='+folder,{headers})).status()).toBe(200);
  for(const token of ['', 'bad'])expect((await post(data,{...headers,'X-CSRF-Token':token})).status()).toBe(403);
  for(const body of [{...data,user_id:id},{...data,destination:['B']},{...data,destination:'/tmp'},{...data,destination:'../'}, {...data,path:''}])expect([400,403]).toContain((await post(body)).status());
  const avatar='/media/'+folder+'/A/file.txt';await pool.query('UPDATE cpanel_users SET avatar_url=$2 WHERE id=$1',[id,avatar]);
  const before=(await pool.query('SELECT * FROM cpanel_users WHERE id=$1',[id])).rows[0];
  const result=await post();expect(result.status()).toBe(200);const moved=(await result.json()).item;expect(moved.url).toBe('/media/'+folder+'/B/file.txt');expect((await context.request.get(avatar)).status()).toBe(404);expect(await (await context.request.get(moved.url)).text()).toBe('bytes');
  expect((await pool.query('SELECT * FROM cpanel_users WHERE id=$1',[id])).rows[0]).toEqual(before);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);expect((await post({path:moved.path,destination:folder+'/A'})).status()).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'superuser','true')",[id]);
  expect((await post({path:moved.path,destination:folder+'/A'})).status()).toBe(200);
  expect((await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[id])).rows).toEqual([{key:'superuser',value:true}]);
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

test('Move picker UI: real folders, file/folder moves, search/URL refresh, localized errors, themes and mobile',async({page,context,baseURL})=>{
 test.setTimeout(120000);const folder='move-ui-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(root,{recursive:true});id=(await bootstrapSuperuser({name:'Move UI',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);
  const rows=(await pool.query('SELECT * FROM interface_translations')).rows;
  for(const language of ['tm','ru','en']){
   const t=(key:string)=>rows.find(r=>r.language_code===language&&r.translation_key==='cpanel.media.'+key).translation_value;
   await mkdir(path.join(root,language+'/target'),{recursive:true});await mkdir(path.join(root,language+'/source/nested'),{recursive:true});await writeFile(path.join(root,language+'/source/match-file.txt'),'bytes');
   await context.addCookies([{name:'hormat_lang',value:language,url:baseURL!}]);
   await page.goto('/cpanel/media?'+new URLSearchParams({path:folder+'/'+language,query:'match-file',scope:'all'}));await page.locator('[data-media-view=list]').click();
   let item=page.locator('.media-item').filter({hasText:'match-file.txt'});await item.locator('[data-bs-toggle=dropdown]').click();await item.locator('[data-media-action=move]').click();
   await expect(page.locator('#media-dialog-title')).toHaveText(t('move'));await expect(page.locator('#media-move-notice')).toHaveText(t('sameFolder'));await expect(page.locator('#media-dialog-confirm')).toBeDisabled();
   await page.locator('#media-move-breadcrumb [data-destination="'+folder+'/'+language+'"]').click();await page.locator('#media-move-folders [data-destination="'+folder+'/'+language+'/target"]').click();
   await expect(page.locator('#media-move-destination')).toHaveText(folder+'/'+language+'/target');await expect(page.locator('#media-dialog-confirm')).toHaveText(t('moveHere'));
   for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);for(const width of [1440,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:`artifacts/media-move-${language}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}}
   await page.setViewportSize({width:1440,height:900});
   // Network error preserves chosen destination and allows retry.
   await page.route('**/cpanel/api/media/move',route=>route.abort());await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-dialog-feedback')).toHaveText(t('failed'));await page.unroute('**/cpanel/api/media/move');
   await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toHaveText(t('moved'));await expect(page.locator('#media-dialog')).not.toBeVisible();
   await expect(page.locator('#media-manager')).toHaveAttribute('data-view','list');item=page.locator('.media-item').filter({hasText:'match-file.txt'});expect(JSON.parse((await item.getAttribute('data-entry'))!).path).toBe(folder+'/'+language+'/target/match-file.txt');
   await item.locator('[data-bs-toggle=dropdown]').click();await item.locator('[data-media-action=details]').click();await expect(page.locator('#media-public-url')).toHaveValue('/media/'+folder+'/'+language+'/target/match-file.txt');await page.locator('#media-dialog .btn-close').click();
   await page.goto('/cpanel/media?'+new URLSearchParams({path:folder+'/'+language}));item=page.locator('.media-item').filter({hasText:'source'});await item.locator('[data-bs-toggle=dropdown]').click();await item.locator('[data-media-action=move]').click();
   await expect(page.locator('#media-move-folders [data-destination="'+folder+'/'+language+'/source"]')).toBeDisabled();
   await page.locator('#media-move-folders [data-destination="'+folder+'/'+language+'/target"]').click();await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toHaveText(t('moved'));await expect(page.locator('.media-item')).toHaveCount(1);
   expect(await readFile(path.join(root,language+'/target/match-file.txt'),'utf8')).toBe('bytes');
   expect(await page.locator('body').innerText()).not.toMatch(/cpanel\.(media|navigation)\./);
   await rm(path.join(root,language),{recursive:true,force:true});
  }
  await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1",[id]);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'media.view','true')",[id]);await writeFile(path.join(root,'denied.txt'),'visible');await page.goto('/cpanel/media?'+new URLSearchParams({path:folder}));await expect(page.locator('.media-item')).toHaveCount(1);await expect(page.locator('[data-media-action=move]')).toHaveCount(0);
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

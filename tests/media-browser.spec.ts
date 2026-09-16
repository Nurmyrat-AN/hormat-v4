import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
for(const language of ['tm','ru','en'])test(`Media manager ${language}: real browsing, activated actions, selection, themes and mobile`,async({page,context,baseURL})=>{
 test.setTimeout(60000);const folder='review-'+randomUUID(),root=path.resolve('.test-media',folder),imageName=randomUUID()+'.png',searchName='find-'+randomUUID()+'.txt';let id='';
 try{
  await mkdir(path.join(root,'Nested'),{recursive:true});await writeFile(path.join(root,'Привет Türkmen.txt'),'unchanged');await writeFile(path.join(root,'Nested',searchName),'nested');
  await writeFile(path.join(root,imageName),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64'));
  id=(await bootstrapSuperuser({name:'Media reviewer',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;
  const session=await sessions.create(id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:language,url:baseURL!}]);
  expect((await page.goto('/cpanel/media?path='+folder))?.status()).toBe(200);await expect(page.locator('.media-item')).toHaveCount(3);await expect(page.locator('[data-navigation-id=media] a')).toHaveAttribute('href','/cpanel/media');
  expect(await page.locator('body').innerText()).not.toMatch(/cpanel\.(media|navigation)\./);expect(await page.content()).not.toContain(root);
  await page.locator('.media-item').filter({hasText:'Привет'}).click();await expect(page.locator('.media-item.is-selected')).toHaveCount(1);
  await page.locator('.media-item').filter({hasText:'Привет'}).locator('.media-name').click();await expect(page.locator('#media-dialog')).toBeVisible();await expect(page.locator('[data-detail=path]')).toContainText('Привет Türkmen.txt');await page.locator('#media-dialog .btn-close').click();
  const imageItem=page.locator('.media-item').filter({hasText:imageName});
  await expect(imageItem.locator('img')).toBeVisible();await expect.poll(()=>imageItem.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await context.grantPermissions(['clipboard-read','clipboard-write']);await imageItem.locator('[data-bs-toggle=dropdown]').click();await imageItem.locator('[data-media-action=copy]').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('/media/'+folder+'/'+imageName);
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.waitForTimeout(400);await page.screenshot({path:`artifacts/media-${language}-overview.png`,fullPage:true,animations:'disabled'});
  await page.locator('[data-media-action=new]').click();await page.locator('#media-name').fill('Created folder');await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toBeVisible();await expect(page.locator('.media-item').filter({hasText:'Created folder'})).toHaveCount(1);
  await page.locator('[data-media-action=upload]').click();await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-queue-error')).toBeVisible();await page.locator('#media-files').setInputFiles({name:'preview.txt',mimeType:'text/plain',buffer:Buffer.from('preview')});await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-queue .text-success')).toHaveCount(1);await page.locator('#media-dialog .btn-close').click();
  let filename='Привет Türkmen.txt';for(const action of ['rename','delete']){const item=page.locator('.media-item').filter({hasText:filename});await item.locator('[data-bs-toggle=dropdown]').click();await item.locator(`[data-media-action=${action}]`).click();if(action==='rename')await page.locator('#media-name').fill('changed.txt');await expect(page.locator('#media-dialog-confirm')).toBeEnabled();await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-dialog')).toBeHidden();filename='changed.txt';}
  expect((await readdir(root)).sort()).toEqual(['Nested','Created folder','preview.txt',imageName].sort());expect(await readFile(path.join(root,'preview.txt'),'utf8')).toBe('preview');
  await page.locator('#media-search').fill(searchName);await expect(page.locator('.media-item')).toHaveCount(1);await expect(page.locator('.media-context')).toContainText(folder+'/Nested');await page.locator('.media-context').click();await expect(page.locator('.media-breadcrumb')).toContainText('Nested');
  for(const theme of ['light','dark'])for(const view of ['grid','list']){
   await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);await page.locator(`[data-media-view=${view}]`).click();
   for(const width of [1440,768,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:`artifacts/media-${language}-${theme}-${view}-${width}.png`,fullPage:true});}
  }
  await page.reload();await expect(page.locator('#media-manager')).toHaveAttribute('data-view','list');
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});
test('Media read authorization, strict grants, protected manager mutation endpoints and bounded path validation',async({page,context,baseURL,browser})=>{
 const id=(await bootstrapSuperuser({name:'Media normal',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;
 try{
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);const session=await sessions.create(id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);
  expect((await page.goto('/cpanel/media'))?.status()).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'media.view','true')",[id]);expect((await page.goto('/cpanel/media'))?.status()).toBe(200);
  const cookie=(await context.cookies()).map(c=>c.name+'='+c.value).join('; ');
  for(const name of ['../','/tmp','cache/../users','.incoming'])expect((await context.request.get('/cpanel/media?path='+encodeURIComponent(name),{headers:{Cookie:cookie}})).status()).toBe(400);
  for(const action of ['rename','delete','folders'])expect((await context.request.post('/cpanel/api/media/'+action,{headers:{Cookie:cookie,'X-CSRF-Token':session.session.csrf_token},data:{}})).status()).toBe(403);
  await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='media.view'",[id]);expect((await page.goto('/cpanel/media'))?.status()).toBe(403);
  const anonymous=await browser.newContext({baseURL});try{expect((await anonymous.request.get('/cpanel/media',{maxRedirects:0})).status()).toBe(303);}finally{await anonymous.close();}
 }finally{await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);}
});

test('Media live search ignores stale results, keeps failures retryable and shows empty/current-folder states',async({page,context,baseURL})=>{
 const folder='search-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(path.join(root,'empty'),{recursive:true});await writeFile(path.join(root,'older.txt'),'');await writeFile(path.join(root,'newest.txt'),'');
  id=(await bootstrapSuperuser({name:'Media search',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  await page.goto('/cpanel/media?path='+folder);await page.locator('[name=scope]').selectOption('current');
  await page.route('**/cpanel/media?**',async route=>{if(new URL(route.request().url()).searchParams.get('query')==='older'){await new Promise(resolve=>setTimeout(resolve,650));await route.fulfill({status:500,body:'Failure'}).catch(()=>{});}else await route.continue();});
  await page.locator('#media-search').fill('older');await page.waitForTimeout(350);await page.locator('#media-search').fill('newest');await expect(page.locator('.media-item')).toHaveCount(1);await expect(page.locator('.media-name')).toHaveText('newest.txt');await page.waitForTimeout(700);await expect(page.locator('#media-feedback')).toBeHidden();
  await page.unrouteAll({behavior:'wait'});await page.route('**/cpanel/media?**',route=>route.fulfill({status:500,body:'Failure'}));await page.locator('#media-search').fill('failure');await expect(page.locator('#media-feedback')).toBeVisible();await expect(page.locator('.media-name')).toHaveText('newest.txt');
  await page.unrouteAll({behavior:'wait'});await page.locator('#media-search').fill('no-results');await expect(page.locator('.media-empty')).toContainText('No files or folders found');await page.goto('/cpanel/media?path='+folder+'/empty');await expect(page.locator('.media-empty')).toContainText('This folder is empty');
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

test('Media continuation: history, refresh, selected search results, details and missing-folder recovery',async({page,context,baseURL})=>{
 const folder='continuation-'+randomUUID(),root=path.resolve('.test-media',folder),name=randomUUID()+'.png';let id='';
 try{
  await mkdir(path.join(root,'nested/level-one/level-two'),{recursive:true});await mkdir(path.join(root,'empty'));
  await writeFile(path.join(root,name),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64'));
  id=(await bootstrapSuperuser({name:'Media continuation',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  await page.goto('/cpanel/media?path='+folder);await page.locator('.media-name').filter({hasText:/^nested$/}).click();await page.locator('.media-name').filter({hasText:/^level-one$/}).click();await page.locator('.media-name').filter({hasText:/^level-two$/}).click();await expect(page.locator('.media-breadcrumb')).toHaveText(new RegExp('nested.*level-one.*level-two'));await page.goBack();await expect(page.locator('.media-name')).toHaveText('level-two');await page.goForward();await expect(page.locator('.media-empty')).toBeVisible();
  await page.goto('/cpanel/media?path='+folder);await page.locator('[data-media-view=list]').click();await writeFile(path.join(root,'external.txt'),'new');await page.locator('#media-refresh').click();await expect(page.locator('.media-item').filter({hasText:'external.txt'})).toHaveCount(1);await expect(page.locator('#media-manager')).toHaveAttribute('data-view','list');
  await page.locator('#media-search').fill(name);await expect(page.locator('.media-item')).toHaveCount(1);await page.locator('.media-name').click();await expect(page.locator('.media-item.is-selected')).toContainText(name);
  await page.locator('.media-item.is-selected .media-name').click();await expect(page.locator('[data-detail=mime]')).toHaveText('image/png');await expect(page.locator('[data-detail=dimensions]')).toHaveText('1 × 1');await expect(page.locator('#media-detail-preview')).toBeVisible();
  for(const theme of ['light','dark'])for(const width of [1440,375]){await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:`artifacts/media-details-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}
  await page.setViewportSize({width:1440,height:900});await page.locator('#media-dialog [data-media-action=rename]').click();await expect(page.locator('#media-name')).toHaveValue(name);await page.locator('#media-dialog .btn-close').click();
  await page.goto('/cpanel/media?path='+folder+'/empty');await rm(path.join(root,'empty'),{recursive:true});await page.locator('#media-refresh').click();await expect(page.locator('[data-media-read-error]')).toContainText('no longer available');await page.locator('[data-media-read-error] a').click();await expect(page).toHaveURL(/\/cpanel\/media$/);
  expect((await page.goto('/cpanel/media?path='+folder+'/empty'))?.status()).toBe(404);await expect(page.locator('[data-media-read-error] a')).toBeVisible();
  const cookie=(await context.cookies()).map(c=>c.name+'='+c.value).join('; ');
  for(const value of ['../','../../','users/../../../','%2e%2e/','%252e%252e/','/etc','C:\\Windows']){const result=await context.request.get('/cpanel/api/media/details?path='+encodeURIComponent(value),{headers:{Cookie:cookie}});expect([400,404]).toContain(result.status());expect(await result.text()).not.toContain(root);}
  const snapshot=(await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[id])).rows;expect(snapshot).toEqual([{key:'superuser',value:true}]);
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

test('Media individual capabilities and auto-registry integration; false view cannot read details',async({page,context,baseURL})=>{
 const folder='capability-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(root,{recursive:true});await writeFile(path.join(root,'file.txt'),'fixture');id=(await bootstrapSuperuser({name:'Media capabilities',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'media.view','true'),($1,'permissions.view','true')",[id]);const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  for(const [permission,action] of [['media.upload','upload'],['media.create_folder','new'],['media.rename','rename'],['media.delete','delete']]){
   await page.goto('/cpanel/media?path='+folder);const button=page.locator('#media-manager [data-media-action='+action+']').first();await expect(button).toBeDisabled();
   await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,\'true\')',[id,permission]);await page.reload();await expect(button).toBeEnabled();await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key=$2',[id,permission]);
  }
  await page.goto('/cpanel/permissions/'+id);for(const key of ['media.view','media.upload','media.create_folder','media.rename','media.move','media.delete'])await expect(page.locator('[data-permission-key="'+key+'"]')).toBeVisible();
  await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='media.view'",[id]);expect((await page.goto('/cpanel/media'))?.status()).toBe(403);
  const cookie=(await context.cookies()).map(c=>c.name+'='+c.value).join('; ');expect((await context.request.get('/cpanel/api/media/details?path='+folder+'/file.txt',{headers:{Cookie:cookie}})).status()).toBe(403);
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

test('Media limited results and clear-search cancellation use isolated files; cache warning is explicit',async({page,context,baseURL})=>{
 const folder='bounded-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(root,{recursive:true});await Promise.all(Array.from({length:503},(_,i)=>writeFile(path.join(root,'item-'+i),'')));
  id=(await bootstrapSuperuser({name:'Media bounds',email:`${randomUUID()}@example.invalid`,password:randomUUID()})).id;const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  await page.goto('/cpanel/media?path='+folder);await expect(page.locator('.media-item')).toHaveCount(500);await expect(page.locator('#media-results .alert')).toContainText('Results are limited');
  await page.route('**/cpanel/media?**',async route=>{if(new URL(route.request().url()).searchParams.get('query')==='delayed'){await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({status:200,body:'stale response'}).catch(()=>{});}else await route.continue();});
  await page.locator('#media-search').fill('delayed');await page.waitForTimeout(350);await page.locator('#media-search').fill('');await expect(page.locator('.media-item')).toHaveCount(500);await page.waitForTimeout(900);await expect(page.locator('#media-results')).not.toContainText('stale response');
  await page.unrouteAll({behavior:'wait'});await page.goto('/cpanel/media?path=cache');await expect(page.locator('#media-results')).toContainText('Automatic cleanup may remove files');
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

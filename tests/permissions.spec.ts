import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/database/pool.js';
import { bootstrapSuperuser } from '../src/cpanel/auth/bootstrap.js';
import { sessions } from '../src/cpanel/auth/sessions.js';
import { booleanPermissionKeys } from '../src/cpanel/permissions/definitions.js';

for (const language of ['tm','ru','en']) test(`Permissions UI ${language}: real assignments, protected targets, search, real saves, themes and mobile`, async ({page,context,baseURL}) => {
 test.setTimeout(90000);
 const ids:string[]=[];
 const create=async(name:string) => {const user=await bootstrapSuperuser({name,email:`${randomUUID()}@example.invalid`,password:randomUUID()});ids.push(user.id);return user.id;};
 try {
  const actor=await create('Permissions reviewer');
  const target=await create('Permission target '+randomUUID().slice(0,8));
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[target]);
  await pool.query("UPDATE cpanel_users SET job='Permission manager',phone='000719253',avatar_url='/public/missing-avatar.png' WHERE id=$1",[target]);
  for(const [key,value] of [['users.view',true],['users.create',false],['users.update','true'],['users.status',1]]) await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[target,key,JSON.stringify(value)]);
  const inactive=await create('Inactive permission target');
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[inactive]);
  await pool.query('UPDATE cpanel_user_auth SET is_active=false WHERE user_id=$1',[inactive]);
  const session=await sessions.create(actor);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:language,url:baseURL!}]);
  const translations=(await pool.query('SELECT translation_key,translation_value FROM interface_translations WHERE language_code=$1',[language])).rows;
  const t=(key:string)=>translations.find(row=>row.translation_key===key).translation_value;
  const snapshot=async()=> (await pool.query('SELECT user_id,key,value FROM cpanel_user_permissions WHERE user_id=ANY($1::bigint[]) ORDER BY user_id,key',[ids])).rows;
  const before=await snapshot();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  expect((await page.goto('/cpanel/permissions'))?.status()).toBe(200);
  await expect(page.locator('#permissions-status')).toHaveValue('active');
  await expect(page.locator('[data-navigation-id="permissions"]')).toHaveAttribute('data-availability','enabled');
  const own=page.locator(`[data-user-id="${actor}"]`),normal=page.locator(`[data-user-id="${target}"]`);
  await expect(page.locator('[data-navigation-id="permissions"] a')).toHaveAttribute('aria-current','page');
  await expect(own).toContainText(t('cpanel.permissions.fullAccess'));await expect(own.locator('a')).toHaveCount(0);
  await expect(normal.locator('.permissions-summary')).toContainText(`${t('cpanel.permissions.grantedCount')}: 1`);
  await expect(page.locator(`[data-user-id="${inactive}"]`)).toHaveCount(0);
  const targetRow=(await pool.query('SELECT u.name,a.email FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1',[target])).rows[0];
  for(const query of [targetRow.name,targetRow.email,'719253','Permission manager']) {
   await page.locator('#permissions-search').fill(query);await expect(normal).toBeVisible();
   await expect(page).toHaveURL(new RegExp('query='+encodeURIComponent(query).replace(/%20/g,'\\+')));
   await expect(page.locator('#permissions-results')).toHaveAttribute('aria-busy','false');
  }
  await expect(normal.locator('.shell-avatar img')).toBeHidden();
  await page.locator('#permissions-clear').click();
  await page.locator('#permissions-status').selectOption('inactive');await expect(page.locator(`[data-user-id="${inactive}"].is-inactive`)).toBeVisible();await expect(normal).toHaveCount(0);
  await page.locator('#permissions-status').selectOption('all');await expect(normal).toBeVisible();
  for(const theme of ['light','dark']) {
   if(await page.locator('html').getAttribute('data-bs-theme')!==theme)await page.locator('#theme-toggle').click();
   await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:`artifacts/permissions-${language}-${theme}.png`,fullPage:true,animations:'disabled'});
  }
  await normal.locator('a').click();await expect(page).toHaveURL(new RegExp(`/cpanel/permissions/${target}$`));
  const switches=page.getByRole('switch');await expect(switches).toHaveCount(booleanPermissionKeys.length);
  await expect(switches.nth(0)).toBeChecked();for(let i=1;i<booleanPermissionKeys.length;i++)await expect(switches.nth(i)).not.toBeChecked();
  await expect(page.locator('#permission-save')).toBeDisabled();
  await switches.nth(1).check();await expect(page.locator('#permission-unsaved')).toHaveText(t('cpanel.permissions.unsaved'));
  let mutationRequests=0;page.on('request',request=>{if(request.method()!=='GET')mutationRequests++;});
  await page.locator('#permission-save').click();await expect(page.locator('#permission-feedback')).toHaveText(t('cpanel.permissions.saved'));
  await expect(page.locator('#permission-save')).toBeDisabled();
  expect(mutationRequests).toBe(1);
  const saved=await snapshot();expect(saved).not.toEqual(before);
  expect(saved.filter(row=>row.user_id===target).map(row=>[row.key,row.value])).toEqual([['users.create',true],['users.view',true]]);
  await switches.nth(1).uncheck();await expect(page.locator('#permission-save')).toBeEnabled();await switches.nth(1).check();await expect(page.locator('#permission-save')).toBeDisabled();await expect(page.locator('#permission-unsaved')).toBeHidden();
  for(const theme of ['light','dark']) {
   if(await page.locator('html').getAttribute('data-bs-theme')!==theme)await page.locator('#theme-toggle').click();
   for(const width of [1440,768,375]) {
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:`artifacts/permission-detail-${language}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
   }
  }
  const body=await page.locator('body').innerText();for(const key of booleanPermissionKeys)expect(body).not.toContain(key);
  for(const row of translations.filter(row=>row.translation_key.startsWith('cpanel.permissions.users.')))expect(body).toContain(row.translation_value);
  expect(body).not.toMatch(/cpanel\.permissions\./);
  await switches.nth(1).uncheck();await page.locator('.permission-actions a').click();await normal.locator('a').click();await expect(switches.nth(1)).toBeChecked();
  for(const selected of ['en','ru','tm']){await page.locator('#shell-language').selectOption(selected);await expect(page.locator('html')).toHaveAttribute('lang',selected);await expect(page).toHaveURL(new RegExp(`/cpanel/permissions/${target}$`));}
  expect(await snapshot()).toEqual(saved);
  expect((await page.goto(`/cpanel/permissions/${actor}`))?.status()).toBe(403);
  expect((await page.goto('/cpanel/permissions/9223372036854775807'))?.status()).toBe(404);
  expect((await page.goto('/cpanel/permissions/not-an-id'))?.status()).toBe(404);
  expect((await page.goto('/cpanel/permissions?status=invalid'))?.status()).toBe(400);
  await page.goto(`/cpanel/permissions/${inactive}`);await expect(page.locator('.permission-person.is-inactive')).toBeVisible();
  // EJS page routes remain GET-only; writes use the separate API.
  expect(await page.evaluate(async()=> (await fetch(location.pathname,{method:'POST'})).status)).toBe(404);
  expect(await snapshot()).toEqual(saved);
  await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='superuser'",[actor]);
  expect((await page.goto('/cpanel/permissions'))?.status()).toBe(403);expect((await page.goto(`/cpanel/permissions/${target}`))?.status()).toBe(403);
  await pool.query("UPDATE cpanel_user_permissions SET value='\"true\"' WHERE user_id=$1 AND key='superuser'",[actor]);
  expect((await page.goto('/cpanel/permissions'))?.status()).toBe(403);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'users.view','true')",[actor]);
  expect((await page.goto('/cpanel/permissions'))?.status()).toBe(403);
  await context.clearCookies();await page.goto('/cpanel/permissions');await expect(page).toHaveURL(/\/cpanel\/login$/);
  expect(errors).toEqual([]);
 }finally {await pool.query('DELETE FROM cpanel_users WHERE id=ANY($1::bigint[])',[ids]);}
});

test('Permissions search: bounded pagination, literal queries, stale responses and recovery',async({page,context,baseURL})=>{
 const ids:string[]=[];
 try {
  const actor=await bootstrapSuperuser({name:'Permissions search reviewer',email:`${randomUUID()}@example.invalid`,password:randomUUID()});ids.push(actor.id);
  const hash=(await pool.query('SELECT password_hash FROM cpanel_user_auth WHERE user_id=$1',[actor.id])).rows[0].password_hash;
  const prefix='Permission '+randomUUID();
  for(let i=0;i<11;i++) {
   const id=(await pool.query('INSERT INTO cpanel_users(name,job) VALUES($1,$2) RETURNING id',[`${prefix} ${i}`,i===10?'Special search job':'Test'])).rows[0].id;ids.push(id);
   await pool.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)',[id,`${randomUUID()}@example.invalid`,hash]);
  }
  const session=await sessions.create(actor.id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  await page.goto('/cpanel/permissions?query='+encodeURIComponent(prefix));
  await expect(page.locator('#permissions-results .users-item')).toHaveCount(9);
  await page.locator('.users-pagination a').last().click();await expect(page.locator('#permissions-results .users-item')).toHaveCount(2);
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:`artifacts/permissions-list-${width}.png`,fullPage:true,animations:'disabled'});}
  await page.locator('#permissions-search').fill('%_');await expect(page.locator('.users-empty')).toBeVisible();
  let first=true;
  await page.route('**/cpanel/permissions?**',async route=>{if(first){first=false;await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({status:500,body:'Test failure'}).catch(()=>{});}else await route.continue();});
  await page.locator('#permissions-search').fill('stale');await page.waitForTimeout(350);await page.locator('#permissions-search').fill('Special search job');
  await expect(page.locator('#permissions-results .users-item')).toHaveCount(1);await page.waitForTimeout(750);await expect(page.locator('#permissions-error')).toBeHidden();
  await page.unroute('**/cpanel/permissions?**');
  await page.route('**/cpanel/permissions?**',route=>route.fulfill({status:500,body:'Test failure'}));
  await page.locator('#permissions-search').fill('failure');await expect(page.locator('#permissions-error')).toHaveText('Could not load users. Please search again.');
  await page.unroute('**/cpanel/permissions?**');
  await page.locator('#permissions-search').fill(prefix);await expect(page.locator('#permissions-results .users-item')).toHaveCount(9);await expect(page.locator('#permissions-error')).toBeHidden();
 }finally {await pool.query('DELETE FROM cpanel_users WHERE id=ANY($1::bigint[])',[ids]);}
});

test('Permissions activation: independent routes, read-only/self protection, injections, revocation and UI retry',async({page,context,browser,baseURL})=>{
 test.setTimeout(90000);const ids:string[]=[];
 const create=async()=>{const user=await bootstrapSuperuser({name:'Permission administrator '+randomUUID().slice(0,6),email:`${randomUUID()}@example.invalid`,password:randomUUID()});ids.push(user.id);return user.id;};
 const state=(on:string[]=[])=>({permissions:Object.fromEntries(booleanPermissionKeys.map(key=>[key,on.includes(key)]))});
 const data=async(id:string)=>(await pool.query('SELECT * FROM cpanel_user_permissions WHERE user_id=$1 ORDER BY key',[id])).rows;
 const account=async(id:string)=>(await pool.query('SELECT to_jsonb(u) profile,to_jsonb(a) auth FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1',[id])).rows[0];
 const cookie=async(ctx:typeof context,id:string)=>{const session=await sessions.create(id);await ctx.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);return session;};
 const targetContext=await browser.newContext({baseURL});
 try{
  const root=await create(),actor=await create(),target=await create();await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=ANY($1::bigint[])',[[actor,target]]);
  const rootSession=await cookie(context,root),actorSession=await cookie(targetContext,actor);const other=await targetContext.newPage();
  const send=async(ctx:typeof context,csrf:string,id:string,input:unknown)=>ctx.request.post(`/cpanel/api/permissions/${id}`,{headers:{'X-CSRF-Token':csrf,Cookie:(await ctx.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')},data:input,maxRedirects:0});
  const rootSave=(id:string,on:string[])=>send(context,rootSession.session.csrf_token,id,state(on));
  const rootBefore=await data(root),targetAccount=await account(target);
  expect((await rootSave(actor,['permissions.view'])).status()).toBe(200);
  expect((await other.goto('/cpanel/permissions'))?.status()).toBe(200);await expect(other.locator('[data-navigation-id="permissions"] a')).toHaveAttribute('aria-current','page');
  await other.goto(`/cpanel/permissions/${target}`);for(const input of await other.getByRole('switch').all())await expect(input).toBeDisabled();await expect(other.locator('#permission-save')).toBeDisabled();await expect(other.locator('.permission-readonly')).toContainText('Read only');
  expect((await send(targetContext,actorSession.session.csrf_token,target,state())).status()).toBe(403);
  // No implicit view permission when update alone is granted.
  expect((await rootSave(actor,['permissions.update'])).status()).toBe(200);expect((await other.goto('/cpanel/permissions'))?.status()).toBe(403);expect((await other.goto(`/cpanel/permissions/${target}`))?.status()).toBe(403);
  expect((await send(targetContext,actorSession.session.csrf_token,target,state(['users.view']))).status()).toBe(200);
  expect((await rootSave(actor,['permissions.view','permissions.update','users.view'])).status()).toBe(200);
  await other.goto(`/cpanel/permissions/${actor}`);await expect(other.locator('.permission-readonly')).toContainText('own permissions');for(const input of await other.getByRole('switch').all())await expect(input).toBeDisabled();
  const actorBefore=await data(actor);expect((await send(targetContext,actorSession.session.csrf_token,actor,state())).status()).toBe(403);expect(await data(actor)).toEqual(actorBefore);
  for(const [ctx,csrf] of [[context,rootSession.session.csrf_token],[targetContext,actorSession.session.csrf_token]] as const)expect((await send(ctx,csrf,root,state())).status()).toBe(403);
  expect(await data(root)).toEqual(rootBefore);
  for(const input of [{permissions:{...state().permissions,superuser:true}},{permissions:{...state().permissions,superuser:false}},{permissions:{...state().permissions,'unknown.permission':true}},{...state(),user_id:root},{permissions:[]},{permissions:{...state().permissions,'users.view':'true'}},{permissions:{}}]){
   const before=await data(target);expect((await send(context,rootSession.session.csrf_token,target,input)).status()).toBe(400);expect(await data(target)).toEqual(before);
  }
  expect((await send(context,'0'.repeat(64),target,state())).status()).toBe(403);
  // The same logged-in target session gains/loses access without a login cycle.
  await other.goto('/cpanel/users');await expect(other.locator('#users-page')).toBeVisible();
  expect((await rootSave(actor,['permissions.update'])).status()).toBe(200);
  expect((await other.goto('/cpanel/users'))?.status()).toBe(403);expect((await other.goto('/cpanel/permissions'))?.status()).toBe(403);
  await other.goto('/cpanel');await expect(other.locator('[data-navigation-id="users"] a')).toHaveCount(0);await expect(other.locator('[data-navigation-id="permissions"] a')).toHaveCount(0);await expect(other.locator('[data-navigation-id="access"]')).toHaveCount(0);
  expect((await rootSave(actor,['users.view','permissions.view','permissions.update'])).status()).toBe(200);
  expect((await other.goto('/cpanel/users'))?.status()).toBe(200);expect((await other.goto('/cpanel/permissions'))?.status()).toBe(200);await expect(other.locator('[data-navigation-id="permissions"] a')).toHaveAttribute('aria-current','page');
  // Failure preserves selections; saving blocks duplicate clicks and restores dirty state only after success.
  await page.goto(`/cpanel/permissions/${target}`);await page.getByRole('switch').nth(0).uncheck();await page.getByRole('switch').nth(1).check();
  // Temporary fault injection is scoped to this disposable target, and always removed.
  const fault='permission_test_'+randomUUID().replaceAll('-','');
  await pool.query(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id=${target} AND NEW.key='users.create' THEN RAISE EXCEPTION 'test-only permission fault'; END IF; RETURN NEW; END $$`);
  try {
   await pool.query(`CREATE TRIGGER ${fault} BEFORE INSERT ON cpanel_user_permissions FOR EACH ROW EXECUTE FUNCTION ${fault}()`);
   const beforeFailure=await data(target);
   await page.locator('#permission-save').click();await expect(page.locator('#permission-feedback')).toHaveText('Could not save permissions. Please try again.');await expect(page.getByRole('switch').nth(1)).toBeChecked();await expect(page.locator('#permission-save')).toBeEnabled();
   expect(await data(target)).toEqual(beforeFailure);
  }finally{await pool.query(`DROP TRIGGER IF EXISTS ${fault} ON cpanel_user_permissions`);await pool.query(`DROP FUNCTION ${fault}()`);}
  let saves=0;await page.route(`**/cpanel/api/permissions/${target}`,async route=>{saves++;await new Promise(resolve=>setTimeout(resolve,500));await route.continue();});
  await page.locator('#permission-save').click();await expect(page.locator('#permission-save')).toHaveText('Saving…');await page.locator('#permission-save').evaluate((button:HTMLButtonElement)=>button.click());
  await expect(page.locator('#permission-feedback')).toHaveText('Permissions updated successfully.');expect(saves).toBe(1);await expect(page.locator('#permission-unsaved')).toBeHidden();
  await page.unroute(`**/cpanel/api/permissions/${target}`);
  // Stale editor loses update permission after the page was opened.
  await other.goto(`/cpanel/permissions/${target}`);await other.getByRole('switch').nth(2).check();await rootSave(actor,['permissions.view']);
  const beforeDenied=await data(target);await other.locator('#permission-save').click();await expect(other.locator('#permission-feedback')).toBeVisible();await expect(other.locator('#permission-save')).toBeDisabled();expect(await data(target)).toEqual(beforeDenied);
  expect(await account(target)).toEqual(targetAccount);expect(await data(root)).toEqual(rootBefore);
 }finally{await targetContext.close();await pool.query('DELETE FROM cpanel_users WHERE id=ANY($1::bigint[])',[ids]);}
});

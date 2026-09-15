import {test,expect,type BrowserContext,type Page,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {MediaStore} from '../src/media/store.js';
const mediaStore=new MediaStore('.test-media',24);
import {verifyPassword} from '../src/cpanel/auth/password.js';
const apiCookies=new WeakMap<APIRequestContext,string>();
const get=(request:APIRequestContext,url:string)=>request.get(url,{headers:{Cookie:apiCookies.get(request)||''},maxRedirects:0});
const password='Users activation password 123';
const profile=(extra={})=>({name:`User ${randomUUID().slice(0,8)}`,phone:'000123456',job:'Catalog editor',email:`${randomUUID()}@example.invalid`,password,confirm:password,...extra});
async function setup(context:BrowserContext,baseURL:string,superuser=true,language='en'){
 const values=profile();const account=await bootstrapSuperuser(values);if(!superuser)await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[account.id]);
 const {token,session}=await sessions.create(account.id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:token,domain:new URL(baseURL).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:language,url:baseURL}]);
 apiCookies.set(context.request,(await context.cookies()).map(cookie=>`${cookie.name}=${cookie.value}`).join('; '));
 return {...values,id:account.id,csrf:session.csrf_token};
}
async function clean(ids:string[]){for(const id of ids){const row=(await pool.query('SELECT avatar_url FROM cpanel_users WHERE id=$1',[id])).rows[0];if(row?.avatar_url)await mediaStore.deleteManagedFile(row.avatar_url,'users/avatars');await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);}}
async function dbUser(id:string){return (await pool.query('SELECT to_jsonb(u) profile,to_jsonb(a) auth FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1',[id])).rows[0];}
async function fill(page:Page,kind:string,fields:Record<string,string>){for(const [key,value] of Object.entries(fields))await page.locator(`#users-${kind} [name="${key}"]`).fill(value);}
async function openAction(page:Page,id:string,kind:string){const row=page.locator(`[data-user-id="${id}"]`);await row.locator('[data-bs-toggle="dropdown"]').click();await row.locator(`[data-user-action="${kind}"]`).click();await expect(page.locator(`#users-${kind}`)).toBeVisible();}
const send=(request:APIRequestContext,csrf:string,operation:string,id:string|undefined,data:unknown)=>request.fetch(`/cpanel/api/users${id?'/'+id:''}${operation==='status'?'/status':operation==='password'?'/password':''}`,{method:operation==='update'?'PATCH':'POST',headers:{'X-CSRF-Token':csrf,Cookie:apiCookies.get(request)||''},maxRedirects:0,data});
for(const language of ['tm','ru','en'])test(`Users ${language}: real CRUD, avatars, search, sessions, protected target, themes and responsive`,async({page,context,browser,baseURL})=>{
 test.setTimeout(90000);const actor=await setup(context,baseURL!,true,language);const ids=[actor.id];
 try{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const translations=(await pool.query('SELECT translation_key,translation_value FROM interface_translations WHERE language_code=$1',[language])).rows;
  const t=(key:string)=>translations.find(row=>row.translation_key===key).translation_value;
  expect((await page.goto('/cpanel/users'))?.status()).toBe(200);await expect(page.locator('#users-field')).toHaveValue('name');await expect(page.locator('#users-status-filter')).toHaveValue('active');await expect(page.locator('#users-page')).toHaveAttribute('data-view','grid');
  await expect(page.locator('[data-navigation-id="users"] > a')).toHaveAttribute('aria-current','page');await expect(page.locator('[data-navigation-id="permissions"]')).toHaveAttribute('data-availability','enabled');await expect(page.locator('#users-samples')).toHaveCount(0);
  await page.locator('#users-search').fill(actor.name);const own=page.locator(`[data-user-id="${actor.id}"]`);await expect(own.locator('[data-protected-label]')).toBeVisible();
  for(const operation of ['update','status','password']){const before=await dbUser(actor.id);const res=await send(page.request,actor.csrf,operation,actor.id,operation==='status'?{status:'inactive'}:{});expect(res.status()).toBe(403);expect((await res.json()).message).toBe(t('cpanel.users.protected'));expect(await dbUser(actor.id)).toEqual(before);}
  await page.locator('[data-bs-target="#users-add"]').click();await page.locator('#users-add [data-operation-submit]').click();await expect(page.locator('#users-add [data-operation-notice]')).toHaveText(t('cpanel.profile.invalidName'));
  const values=profile({name:`Ali ${randomUUID().slice(0,8)}`});await fill(page,'add',values); // status is not included in values
  await page.locator('#users-add [data-upload-input]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64')});
  const createResponse=page.waitForResponse(r=>r.url().endsWith('/cpanel/api/users')&&r.request().method()==='POST');await page.locator('#users-add [data-operation-submit]').click();const created=await(await createResponse).json();expect(created.success).toBe(true);ids.push(created.id);await expect(page.locator('#users-add')).toBeHidden();await expect(page.locator('#users-feedback')).toHaveText(t('cpanel.users.created'));
  // Every backend validation response uses the current language's real DB text.
  const cases:[string,unknown,string][]=[
   ['create',profile({email:values.email}),'cpanel.users.duplicateEmail'],
   ['update',{name:'',phone:'',job:'',email:values.email},'cpanel.profile.invalidName'],
   ['update',{name:'Valid',phone:'0'.repeat(51),job:'',email:values.email},'cpanel.profile.invalidPhone'],
   ['update',{name:'Valid',phone:'',job:'x'.repeat(201),email:values.email},'cpanel.users.invalidJob'],
   ['update',{name:'Valid',phone:'',job:'',email:'invalid'},'cpanel.users.invalidEmail'],
   ['update',{name:'Valid',phone:'',job:'',email:values.email,avatarCacheToken:'forged'},'cpanel.profile.avatarFailed'],
   ['password',{password:'short',confirm:'short'},'cpanel.password.policy'],
   ['password',{password,confirm:'different'},'cpanel.password.mismatch']
  ];
  for(const [operation,data,key] of cases){const response=await send(page.request,actor.csrf,operation,operation==='create'?undefined:created.id,data);expect(response.ok()).toBe(false);expect((await response.json()).message).toBe(t(key));}
  const absent=await send(page.request,actor.csrf,'update','9223372036854775807',{});expect(absent.status()).toBe(404);expect((await absent.json()).message).toBe(t('cpanel.users.notFound'));
  const original=await dbUser(created.id);expect(original.auth.is_active).toBe(true);expect(original.profile.avatar_url).toMatch(/^\/media\/users\/avatars\//);expect(await verifyPassword(original.auth.password_hash,password)).toBe(true);expect((await pool.query('SELECT * FROM cpanel_user_permissions WHERE user_id=$1',[created.id])).rowCount).toBe(0);
  await page.locator('#users-search').fill(values.name);await expect(page.locator(`[data-user-id="${created.id}"]`)).toBeVisible();
  for(const [field,query] of [['email',values.email.toUpperCase()],['phone','1234'],['job','EDITOR'],['all',values.name],['name',values.name]]){await page.locator('#users-field').selectOption(field);await page.locator('#users-search').fill(query);await expect(page.locator(`[data-user-id="${created.id}"]`)).toBeVisible();}
  await page.locator('[data-users-view="list"]').click();await expect(page.locator('#users-search')).toHaveValue(values.name);await page.reload();await expect(page.locator('#users-page')).toHaveAttribute('data-view','list');await page.locator('#users-search').fill(values.name);
  await openAction(page,created.id,'edit');await fill(page,'edit',{name:values.name+' Edited',job:'Sales manager',phone:'000999',email:values.email});await page.locator('#users-edit [data-upload-input]').setInputFiles({name:'next.txt',mimeType:'text/plain',buffer:Buffer.from('New avatar bytes')});
  await page.locator('#users-edit [data-operation-submit]').click();await expect(page.locator('#users-edit')).toBeHidden();await expect(page.locator('#users-feedback')).toHaveText(t('cpanel.users.updated'));const edited=await dbUser(created.id);expect(edited.auth.password_hash).toBe(original.auth.password_hash);expect((await page.request.get(original.profile.avatar_url)).status()).toBe(404);expect(edited.profile.avatar_url).not.toBe(original.profile.avatar_url);
  const targetSession=await sessions.create(created.id);await openAction(page,created.id,'status');await page.locator('#users-status [data-operation-submit]').click();await expect(page.locator('#users-status')).toBeHidden();await expect(page.locator('#users-feedback')).toHaveText(t('cpanel.users.deactivated'));expect(await sessions.find(targetSession.token)).toBeUndefined();expect((await dbUser(created.id)).auth.is_active).toBe(false);
  const loginContext=await browser.newContext({baseURL});const login=await loginContext.newPage();
  async function attempt(pw:string,success:boolean){await login.goto('/cpanel/login');await login.locator('#login-email').fill(values.email);await login.locator('#login-password').fill(pw);const submitted=login.waitForResponse(r=>r.url().endsWith('/cpanel/login')&&r.request().method()==='POST');await login.locator('#login-submit').click();expect((await submitted).status()).toBe(success?303:401);if(success)await expect(login).toHaveURL(/\/cpanel$/);else await expect(login).toHaveURL(/\/cpanel\/login$/);}
  try{
   await attempt(password,false);
   await page.locator('#users-status-filter').selectOption('inactive');await expect(page.locator(`[data-user-id="${created.id}"].is-inactive`)).toBeVisible();
   for(const theme of ['light','dark']){if(await page.locator('html').getAttribute('data-bs-theme')!==theme)await page.locator('#theme-toggle').click();for(const view of ['grid','list']){await page.locator(`[data-users-view="${view}"]`).click();await page.screenshot({path:`artifacts/users-live-${language}-${theme}-${view}.png`,animations:'disabled',fullPage:true});}}
   await openAction(page,created.id,'status');await page.locator('#users-status [data-operation-submit]').click();await expect(page.locator('#users-status')).toBeHidden();await expect(page.locator('#users-feedback')).toHaveText(t('cpanel.users.activated'));expect(await sessions.find(targetSession.token)).toBeUndefined();await attempt(password,true);
   await page.locator('#users-status-filter').selectOption('all');await openAction(page,created.id,'password');await fill(page,'password',{password:'Replacement password 123',confirm:'Replacement password 123'});await page.locator('#users-password [data-password-toggle]').first().click();await expect(page.locator('#users-password [name=password]')).toHaveAttribute('type','text');await page.locator('#users-password [data-operation-submit]').click();await expect(page.locator('#users-password')).toBeHidden();await expect(page.locator('#users-feedback')).toHaveText(t('cpanel.users.passwordChanged'));
   expect((await login.request.get('/cpanel',{maxRedirects:0,headers:{Cookie:(await loginContext.cookies()).map(cookie=>`${cookie.name}=${cookie.value}`).join('; ')}})).status()).toBe(303);await attempt(password,false);await attempt('Replacement password 123',true);
  }finally{await loginContext.close();}
  for(const width of [768,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.locator('[data-bs-target="#users-add"]').click();await expect(page.locator('#users-add')).toBeVisible();await page.screenshot({path:`artifacts/users-live-${language}-${width}.png`,animations:'disabled'});await page.locator('#users-add .btn-close').click();await expect(page.locator('#users-add')).toBeHidden();}
  expect(errors).toEqual([]);
 }finally{await clean(ids);}
});

test('Users HTTP permissions: independent operations, exact booleans, live revocation, malicious payloads and protected targets',async({page,context,baseURL})=>{
 test.setTimeout(90000);const actor=await setup(context,baseURL!,false);const root=await bootstrapSuperuser(profile());const target=await bootstrapSuperuser(profile());await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[target.id]);const ids=[actor.id,root.id,target.id];
 const session=await sessions.create(target.id);
 const permission=async(key:string,value:unknown)=>{await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[actor.id]);if(value!==undefined)await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[actor.id,key,JSON.stringify(value)]);};
 const operations=['view','create','update','status','change_password'];
 const request=async(operation:string)=>operation==='view'?get(page.request,'/cpanel/api/users'):send(page.request,actor.csrf,operation==='change_password'?'password':operation,operation==='create'?undefined:target.id,operation==='status'?{status:'active'}:operation==='change_password'?{password,confirm:password}:operation==='update'?{name:'Normal target',phone:'1',job:'Job',email:'normal-'+target.id+'@example.invalid'}:profile());
 try{
  for(const operation of operations){
   for(const value of [undefined,false,'true',1,{},null]){await permission('users.'+operation,value);const before=await dbUser(target.id);const response=await request(operation);expect(response.status()).toBe(403);expect(await dbUser(target.id)).toEqual(before);expect(await sessions.find(session.token)).toBeDefined();}
   await permission('users.'+operation,true);const response=await request(operation);expect(response.ok()).toBe(true);if(operation==='create')ids.push((await response.json()).id);
   for(const other of operations.filter(other=>other!==operation))expect((await request(other)).status()).toBe(403);
   // View is not implicitly granted by mutation permissions; direct page is protected too.
   expect((await get(page.request,'/cpanel/users')).status()).toBe(operation==='view'?200:403);
   if(operation!=='view')await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'users.view','true')",[actor.id]);
   await page.goto('/cpanel/users');await expect(page.locator('.users-add')).toHaveCount(operation==='create'?1:0);
   const targetName=(await dbUser(target.id)).profile.name;await page.locator('#users-search').fill(targetName);
   const visibleTarget=page.locator(`[data-user-id="${target.id}"]`);await expect(visibleTarget).toBeVisible();
   for(const [action,key] of [['edit','update'],['status','status'],['password','change_password']]){if(operation===key)await expect(visibleTarget.locator(`[data-user-action="${action}"]`)).toBeEnabled();else await expect(visibleTarget.locator(`[data-user-action="${action}"]`)).toBeDisabled();}

  }
  await permission('superuser',true);
  for(const operation of operations){const response=await request(operation);expect(response.ok()).toBe(true);if(operation==='create')ids.push((await response.json()).id);}
  for(const protectedId of [root.id,actor.id])for(const operation of ['update','status','password']){const before=await dbUser(protectedId);expect((await send(page.request,actor.csrf,operation,protectedId,{status:'inactive'})).status()).toBe(403);expect(await dbUser(protectedId)).toEqual(before);}
  for(const operation of ['create','update','status','password'])for(const key of ['permissions','superuser','users.create','users.update','users.status','users.change_password'])expect((await send(page.request,actor.csrf,operation,operation==='create'?undefined:target.id,{[key]:true})).status()).toBe(400);
  expect((await page.request.post('/cpanel/api/users',{data:profile(),headers:{Cookie:apiCookies.get(page.request)||''},maxRedirects:0})).status()).toBe(403);
  await permission('users.update',true);
  for(const key of ['users.view','users.create','users.status','users.change_password'])await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,'true')",[actor.id,key]);
  for(const operation of ['update','status','password'])expect((await send(page.request,actor.csrf,operation,root.id,{})).status()).toBe(403);
  await permission('users.status',true);expect((await send(page.request,actor.csrf,'status',actor.id,{status:'inactive'})).status()).toBe(403);
  await permission('users.view',true);await page.goto('/cpanel/users');await expect(page.locator('.users-add')).toHaveCount(0);await page.locator('#users-search').fill('Normal target');const row=page.locator(`[data-user-id="${target.id}"]`);await expect(row).toBeVisible();for(const action of ['status','edit','password'])await expect(row.locator(`[data-user-action="${action}"]`)).toBeDisabled();
  await permission('users.view',false);expect((await get(page.request,'/cpanel/api/users')).status()).toBe(403);await page.goto('/cpanel');await expect(page.locator('[data-navigation-id="users"] a')).toHaveCount(0);
 }finally{await clean(ids);}
});

test('Users asynchronous search ignores stale responses, handles failure/retry, pagination and invalid query safely',async({page,context,baseURL})=>{
 const actor=await setup(context,baseURL!);try{
  await page.goto('/cpanel/users');
  expect((await get(page.request,'/cpanel/api/users?field=name%3BDROP%20TABLE%20cpanel_users')).status()).toBe(400);
  let first=true;
  await page.route('**/cpanel/api/users?**',async route=>{if(first){first=false;await new Promise(resolve=>setTimeout(resolve,600));await route.fulfill({status:500,json:{success:false,message:'Test failure'}}).catch(()=>{});}else await route.continue();});
  await page.locator('#users-search').fill('stale');await page.waitForTimeout(350);await page.locator('#users-search').fill(actor.name);await expect(page.locator(`[data-user-id="${actor.id}"]`)).toBeVisible();await page.waitForTimeout(700);await expect(page.locator('#users-feedback')).toBeHidden();
  await page.unroute('**/cpanel/api/users?**');await page.route('**/cpanel/api/users?**',route=>route.fulfill({status:500,json:{success:false,message:'Test failure'}}));await page.locator('#users-search').fill('fail');await expect(page.locator('#users-feedback')).toHaveText('Test failure');
  await page.unroute('**/cpanel/api/users?**');await page.locator('#users-clear').click();await expect(page.locator('#users-results')).toHaveAttribute('aria-busy','false');await expect(page.locator('#users-status-filter')).toHaveValue('active');await expect(page.locator('#users-field')).toHaveValue('name');
 }finally{await clean([actor.id]);}
});

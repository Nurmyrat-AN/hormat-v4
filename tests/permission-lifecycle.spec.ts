import {test,expect,type BrowserContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {booleanPermissionKeys} from '../src/cpanel/permissions/definitions.js';

test('complete administrator lifecycle: UI grants, real Users operations, read-only, escalation denial and same-session revocation',async({page,context,browser,baseURL})=>{
 test.setTimeout(90000);const ids:string[]=[];const normalContext=await browser.newContext({baseURL});
 const cookies=async(ctx:BrowserContext)=>(await ctx.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
 const login=async(ctx:BrowserContext,id:string)=>{const session=await sessions.create(id);await ctx.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);return session.session.csrf_token;};
 const userData=()=>({name:'Access lifecycle '+randomUUID(),phone:'00123',job:'Administrator',email:`${randomUUID()}@example.invalid`,password:'Lifecycle password 123',confirm:'Lifecycle password 123'});
 const assignments=async(id:string)=>(await pool.query('SELECT * FROM cpanel_user_permissions WHERE user_id=$1 ORDER BY key',[id])).rows;
 const full=(on:string[]=[])=>({permissions:Object.fromEntries(booleanPermissionKeys.map(key=>[key,on.includes(key)]))});
 try{
  const root=await bootstrapSuperuser(userData());ids.push(root.id);const csrf=await login(context,root.id);
  const request=async(ctx:BrowserContext,token:string,url:string,method:string,data:unknown)=>ctx.request.fetch(url,{method,headers:{Cookie:await cookies(ctx),'X-CSRF-Token':token},data,maxRedirects:0});
  const created=await request(context,csrf,'/cpanel/api/users','POST',userData());expect(created.status()).toBe(201);const admin=(await created.json()).id;ids.push(admin);
  const adminCsrf=await login(normalContext,admin),normal=await normalContext.newPage();
  expect(await assignments(admin)).toEqual([]);
  expect((await normal.goto('/cpanel/users'))?.status()).toBe(403);expect((await normal.goto('/cpanel/permissions'))?.status()).toBe(403);
  const grant=async(on:string[])=>{
   await page.goto(`/cpanel/permissions/${admin}`);
   for(const key of booleanPermissionKeys)await page.locator(`[data-permission-key="${key}"]`).setChecked(on.includes(key));
   await page.locator('#permission-save').click();await expect(page.locator('#permission-feedback')).toHaveText('Permissions updated successfully.');
  };
  await grant(['users.view','users.create']);
  await normal.goto('/cpanel/users');await expect(normal.locator('[data-navigation-id="users"] a')).toBeVisible();await expect(normal.locator('[data-navigation-id="permissions"]')).toHaveCount(0);
  const found=await request(normalContext,adminCsrf,'/cpanel/api/users?field=job&query=Administrator','GET',undefined);expect(found.status()).toBe(200);expect((await found.json()).rows.some((row:any)=>row.id===admin)).toBe(true);
  const second=await request(normalContext,adminCsrf,'/cpanel/api/users','POST',userData());expect(second.status()).toBe(201);const target=(await second.json()).id;ids.push(target);
  for(const [url,method] of [[`/cpanel/api/users/${target}`,'PATCH'],[`/cpanel/api/users/${target}/status`,'POST'],[`/cpanel/api/users/${target}/password`,'POST']])expect((await request(normalContext,adminCsrf,url,method,{})).status()).toBe(403);
  await grant(['users.view','users.create','permissions.view']);
  await normal.goto(`/cpanel/permissions/${target}`);await expect(normal.locator('.permission-readonly')).toContainText('Read only');for(const control of await normal.getByRole('switch').all())await expect(control).toBeDisabled();
  expect((await request(normalContext,adminCsrf,`/cpanel/api/permissions/${target}`,'POST',full())).status()).toBe(403);
  await grant(['users.view','users.create','permissions.view','permissions.update']);
  await normal.goto(`/cpanel/permissions/${target}`);await normal.locator('[data-permission-key="users.view"]').check();await normal.locator('#permission-save').click();await expect(normal.locator('#permission-feedback')).toHaveText('Permissions updated successfully.');
  expect((await assignments(target)).map(row=>[row.key,row.value])).toEqual([['users.view',true]]);
  const attack=async(id:string,data:unknown,status:number)=>{const before=await assignments(id);expect((await request(normalContext,adminCsrf,`/cpanel/api/permissions/${id}`,'POST',data)).status()).toBe(status);expect(await assignments(id)).toEqual(before);};
  await attack(admin,{permissions:{...full().permissions,superuser:true}},400);
  await attack(admin,full(['users.status']),403);await attack(root.id,full(),403);
  await attack(target,{permissions:{...full().permissions,'unknown.permission':true}},400);
  await attack(target,{permissions:{...full().permissions,'users.view':{allow:true}}},400);
  await attack(target,{...full(),user_id:root.id},400);
  await grant(['users.create','permissions.view','permissions.update']);
  expect((await normal.goto('/cpanel/users'))?.status()).toBe(403);await normal.goto('/cpanel');await expect(normal.locator('[data-navigation-id="users"]')).toHaveCount(0);
  await grant(['users.create','permissions.update']);expect((await normal.goto('/cpanel/permissions'))?.status()).toBe(403);await normal.goto('/cpanel');await expect(normal.locator('[data-navigation-id="permissions"]')).toHaveCount(0);
  // HTTP parser contract, including duplicate decoded key names, malformed and oversized JSON.
  const raw=async(text:string,token=csrf)=>context.request.post(`/cpanel/api/permissions/${target}`,{headers:{Cookie:await cookies(context),'X-CSRF-Token':token,'Content-Type':'application/json'},data:text,maxRedirects:0});
  const before=await assignments(target),valid=JSON.stringify(full());
  for(const text of ['{}','[]','{"permissions":[]}','{"permissions":{}}','{',valid.replace('"users.view":false','"users.view":true,"users.view":false'),valid.replace('"users.view":false','"users.view":true,"users\\u002eview":false'),'{"permissions":{},"permissions":{}}',JSON.stringify({...full(),unexpected:{nested:true}})])expect((await raw(text)).status()).toBe(400);
  expect((await raw(JSON.stringify({...full(),oversized:'x'.repeat(20000)}))).status()).toBe(413);
  expect((await raw(valid,'bad')).status()).toBe(403);
  expect((await context.request.post(`/cpanel/api/permissions/${target}`,{headers:{Cookie:await cookies(context)},data:full(),maxRedirects:0})).status()).toBe(403);expect(await assignments(target)).toEqual(before);
  // An already-open editor for a deleted target returns safe 404, never creates rows.
  await page.goto(`/cpanel/permissions/${target}`);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[target]);
  const gone=await request(context,csrf,`/cpanel/api/permissions/${target}`,'POST',full(['users.view']));expect(gone.status()).toBe(404);expect((await gone.json()).message).toBe('User not found.');expect(await assignments(target)).toEqual([]);expect((await page.goto(`/cpanel/permissions/${target}`))?.status()).toBe(404);
  const anonymous=await browser.newContext({baseURL});try{
   for(const url of ['/cpanel/permissions',`/cpanel/permissions/${admin}`])expect((await anonymous.request.get(url,{maxRedirects:0})).status()).toBe(303);
   expect((await anonymous.request.post(`/cpanel/api/permissions/${admin}`,{data:full(),maxRedirects:0})).status()).toBe(303);
  }finally{await anonymous.close();}
 }finally{await normalContext.close();await pool.query('DELETE FROM cpanel_users WHERE id=ANY($1::bigint[])',[ids]);}
});

test('counts exclude invalid/unmanaged values; active/inactive changes preserve assignments and inspection',async({page,context,baseURL})=>{
 const ids:string[]=[];
 try{
  const root=await bootstrapSuperuser({name:'Count root '+randomUUID(),email:`${randomUUID()}@example.invalid`,password:randomUUID()});ids.push(root.id);
  const name='Count target '+randomUUID();const target=await bootstrapSuperuser({name,email:`${randomUUID()}@example.invalid`,password:randomUUID()});ids.push(target.id);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[target.id]);
  const values=[true,false,null,'true',1,{},[]];
  for(let i=0;i<values.length;i++)await pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[target.id,booleanPermissionKeys[i],JSON.stringify(values[i])]);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'unknown.count','true'),($1,'superuser','false')",[target.id]);
  const session=await sessions.create(root.id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:'en',url:baseURL!}]);
  const url='/cpanel/permissions?query='+encodeURIComponent(name);
  await page.goto(url);const row=page.locator(`[data-user-id="${target.id}"]`);await expect(row.locator('.permissions-summary')).toContainText('Permissions granted: 1');
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key=$2',[target.id,booleanPermissionKeys.at(-1)]);await page.reload();await expect(row.locator('.permissions-summary')).toContainText('Permissions granted: 1');
  const snapshot=async()=>(await pool.query('SELECT * FROM cpanel_user_permissions WHERE user_id=$1 ORDER BY key',[target.id])).rows;const before=await snapshot();
  const status=async(value:string)=>context.request.post(`/cpanel/api/users/${target.id}/status`,{headers:{Cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; '),'X-CSRF-Token':session.session.csrf_token},data:{status:value},maxRedirects:0});
  expect((await status('inactive')).status()).toBe(200);expect(await snapshot()).toEqual(before);
  await page.reload();await expect(row).toHaveCount(0);
  for(const filter of ['all','inactive']){await page.locator('#permissions-status').selectOption(filter);await expect(row).toHaveClass(/is-inactive/);await expect(row.locator('.permissions-summary')).toContainText('Permissions granted: 1');}
  await row.locator('a').click();await expect(page.locator('.permission-person')).toHaveClass(/is-inactive/);await expect(page.getByRole('switch').first()).toBeChecked();expect(await snapshot()).toEqual(before);
  expect((await status('active')).status()).toBe(200);expect(await snapshot()).toEqual(before);await page.goto(url);await expect(row).not.toHaveClass(/is-inactive/);
  await page.goto('/cpanel/permissions?query='+encodeURIComponent('Count root'));await expect(page.locator(`[data-user-id="${root.id}"] .permissions-summary`)).toContainText('Full access');await expect(page.locator(`[data-user-id="${root.id}"] .permissions-summary`)).not.toContainText('Permissions granted');
 }finally{await pool.query('DELETE FROM cpanel_users WHERE id=ANY($1::bigint[])',[ids]);}
});

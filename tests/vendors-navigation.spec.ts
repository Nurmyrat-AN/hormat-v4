import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
test('enabled Vendors navigation follows Super User, normal view grant and same-session revocation',async({page,context,baseURL})=>{
 const id=(await bootstrapSuperuser({name:'Vendors navigation',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;
 try{
  const session=await sessions.create(id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);
  await page.goto('/cpanel');const link=page.locator('[data-navigation-id=vendors] > a');await expect(link).toHaveAttribute('href','/cpanel/vendors');await link.click();await expect(page).toHaveURL(/\/cpanel\/vendors$/);await expect(link).toHaveAttribute('aria-current','page');
  expect((await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[id])).rows).toEqual([{key:'superuser',value:true}]);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);await page.goto('/cpanel');await expect(link).toHaveCount(0);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'vendors.view','true')",[id]);await page.reload();await expect(link).toHaveAttribute('href','/cpanel/vendors');await link.click();await expect(page.locator('#vendors-page')).toBeVisible();
  await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='vendors.view'",[id]);await page.goto('/cpanel');await expect(link).toHaveCount(0);expect((await page.goto('/cpanel/vendors'))?.status()).toBe(403);
 }finally{await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);}
});

test('Permissions Management grants independent Vendor actions and revokes a live normal user',async({page,context,browser,baseURL})=>{
 const {booleanPermissionKeys}=await import('../src/cpanel/permissions/definitions.js');
 const {VendorCredentials}=await import('../src/vendors/credentials.js');const {config}=await import('../src/config/env.js');
 const accounts:string[]=[];const name='vendor-permission-review-'+randomUUID();const targetContext=await browser.newContext();
 try{
  for(let i=0;i<2;i++)accounts.push((await bootstrapSuperuser({name:'Vendor permission review',email:randomUUID()+'@example.invalid',password:randomUUID()})).id);
  const [root,target]=accounts;await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[target]);
  const rootSession=await sessions.create(root),targetSession=await sessions.create(target),cookieName=process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel';
  const cookie=(token:string)=>({name:cookieName,value:token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax' as const});
  await context.addCookies([cookie(rootSession.token)]);await targetContext.addCookies([cookie(targetSession.token)]);const targetPage=await targetContext.newPage();
  await pool.query('INSERT INTO vendors(name,url,username,password_encrypted) VALUES($1,$2,$3,$4)',[name,'https://example.invalid/database','reader',new VendorCredentials(config.vendors.credentialsKey).encryptSecret(randomUUID())]);
  const grant=async(extra?:string)=>{const permissions=Object.fromEntries(booleanPermissionKeys.map(key=>[key,key==='vendors.view'||key===extra]));const result=await context.request.post('/cpanel/api/permissions/'+target,{headers:{Cookie:cookieName+'='+rootSession.token,'X-CSRF-Token':rootSession.session.csrf_token},data:{permissions}});expect(result.status()).toBe(200);};
  for(const extra of [undefined,'vendors.create','vendors.update','vendors.status']){
   await grant(extra);expect((await targetPage.goto(baseURL+'/cpanel/vendors'))?.status()).toBe(200);await targetPage.locator('#vendors-search').fill(name);await expect(targetPage.locator('.vendor-item')).toHaveCount(1);
   await targetPage.locator('#vendors-status').selectOption('all');await expect(targetPage.locator('.vendor-item')).toHaveCount(1);
   for(const [action,key] of [['add','vendors.create'],['edit','vendors.update'],['status','vendors.status']])await expect(targetPage.locator('[data-vendor-action='+action+']')).toHaveCount(extra===key?1:0);
   await targetPage.locator('.vendor-item [data-bs-toggle=dropdown]').click();await targetPage.locator('[data-vendor-action=details]').click();await expect(targetPage.locator('[data-detail=name]')).toHaveText(name);await targetPage.locator('#vendor-dialog .btn-close').click();
  }
  await page.goto('/cpanel/permissions/'+target);await page.locator('[data-permission-key="vendors.view"]').uncheck();await page.locator('#permission-save').click();await expect(page.locator('#permission-feedback')).not.toBeEmpty();
  await expect.poll(async()=>(await pool.query("SELECT 1 FROM cpanel_user_permissions WHERE user_id=$1 AND key='vendors.view'",[target])).rowCount).toBe(0);
  await targetPage.goto(baseURL+'/cpanel');await expect(targetPage.locator('[data-navigation-id=vendors]')).toHaveCount(0);expect((await targetPage.goto(baseURL+'/cpanel/vendors'))?.status()).toBe(403);
 }finally{await targetContext.close();await pool.query('DELETE FROM vendors WHERE name=$1',[name]);for(const id of accounts)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);}
});

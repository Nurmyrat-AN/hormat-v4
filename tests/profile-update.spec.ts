import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/database/pool.js';
import { bootstrapSuperuser } from '../src/cpanel/auth/bootstrap.js';
import { sessions } from '../src/cpanel/auth/sessions.js';
import { MediaStore } from '../src/media/store.js';
const media = new MediaStore(path.resolve('.test-media'),24);
const snapshot = async (id:string) => (await pool.query('SELECT to_jsonb(u) profile,to_jsonb(a) auth,(SELECT jsonb_agg(p) FROM cpanel_user_permissions p WHERE p.user_id=u.id) permissions FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1',[id])).rows[0];
for (const language of ['tm','ru','en']) test(`Basic Information ${language}: full upload/save/replacement, wait, protected fields and fresh topbar`,async({page,context,baseURL})=>{
 test.setTimeout(90000);
 const user=await bootstrapSuperuser({name:'Before profile',email:`${randomUUID()}@example.invalid`,password:'Profile browser password 123'});
 const finalUrls:string[]=[];
 try {
  expect((await page.request.post('/cpanel/profile',{maxRedirects:0})).status()).toBe(303);
  const {token}=await sessions.create(user.id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:token,domain:new URL(baseURL!).hostname,path:'/cpanel',httpOnly:true,secure:process.env.TEST_PRODUCTION==='1',sameSite:'Lax'},{name:'hormat_lang',value:language,url:baseURL!}]);
  await pool.query("UPDATE cpanel_users SET job='Administrator-managed title' WHERE id=$1",[user.id]);
  const before=await snapshot(user.id);
  await page.goto('/cpanel/profile');
  const csrf=await page.locator('#profile-form [name="_csrf"]').inputValue();
  const cookie=(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
  const post=(fields:Record<string,string>)=>page.request.post('/cpanel/profile',{headers:{Cookie:cookie},form:{_csrf:csrf,...fields},maxRedirects:0});
  expect((await page.request.post('/cpanel/profile',{headers:{Cookie:cookie},form:{name:'unsafe',phone:''}})).status()).toBe(403);
  const rows=(await pool.query("SELECT translation_key,translation_value FROM interface_translations WHERE language_code=$1",[language])).rows;
  const value=(key:string)=>rows.find(r=>r.translation_key===key).translation_value;
  for (const [fields,key] of [[{name:' ',phone:''},'invalidName'],[{name:'a'.repeat(201),phone:''},'invalidName'],[{name:'Valid',phone:'x'.repeat(51)},'invalidPhone'],[{name:'Valid',phone:'',avatarCacheToken:'../../forged'},'avatarFailed']] as const) {
   const response=await post(fields); expect(response.status()).toBe(400); expect((await response.json()).message).toBe(value('cpanel.profile.'+key));
  }
  for (const field of ['id','userId','targetUser','user_id','email','job','password_hash','superuser','permissions','avatar_url','avatarUrl','destination','filename','filesystemPath']) {
   const response=await post({name:'Malicious',phone:'',[field]:'other'}); expect(response.status()).toBe(400);
  }
  expect(await snapshot(user.id)).toEqual(before);
  await expect(page.locator('#profile-job')).not.toBeEditable(); await expect(page.locator('#profile-email')).not.toBeEditable();
  await page.locator('#profile-name').fill(' '); await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#profile-status')).toHaveText(value('cpanel.profile.invalidName'));
  await page.locator('#profile-name').fill('Valid');
  await page.locator('#profile-phone').evaluate((input:HTMLInputElement)=>{input.value='x'.repeat(51);});
  await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#profile-status')).toHaveText(value('cpanel.profile.invalidPhone'));
  await page.locator('#profile-name').fill('  Updated name  '); await page.locator('#profile-phone').fill('  +993 61 123456  ');
  const png=await sharp({create:{width:10,height:8,channels:3,background:'#198754'}}).png().toBuffer();
  let release!:()=>void; const gate=new Promise<void>(r=>release=r); let uploadToken='';
  await page.route('**/cpanel/media/upload',async route=>{const response=await route.fetch(); uploadToken=(await response.json()).media.cacheToken; await gate; await route.fulfill({response});});
  let saves=0; page.on('request',r=>{if(new URL(r.url()).pathname==='/cpanel/profile'&&r.method()==='POST')saves++;});
  await page.locator('[data-upload-input]').setInputFiles({name:'original.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state','uploading');
  await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#basic [data-preview-action]')).toBeDisabled();
  await page.locator('#profile-form').evaluate((f:HTMLFormElement)=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(saves).toBe(0); release();
  await expect(page.locator('#profile-status')).toHaveText(value('cpanel.profile.saved'));
  expect(saves).toBe(1);
  await page.unroute('**/cpanel/media/upload');
  const saved=await snapshot(user.id); const first=saved.profile.avatar_url; finalUrls.push(first);
  expect(first).toMatch(/^\/media\/users\/avatars\/[a-f0-9-]+\.png$/); expect(first).not.toContain('/cache/'); expect(first).not.toContain(media.root);
  expect(await readFile(path.join(media.root,first.slice('/media/'.length)))).toEqual(png);
  await expect(access(path.join(media.root,'cache',uploadToken))).rejects.toThrow();
  expect((await page.request.get(first)).status()).toBe(200);
  await expect(page.locator('.topbar-user-name')).toHaveText('Updated name');
  await expect(page.locator('#user-menu .shell-avatar img')).toHaveAttribute('src',first);
  await expect(page.locator('.profile-avatar img')).toHaveAttribute('src',first);
  await expect(page.locator('#profile-phone')).toHaveValue('+993 61 123456');
  expect(saved.auth).toEqual(before.auth); expect(saved.permissions).toEqual(before.permissions); expect(saved.profile.job).toBe(before.profile.job);
  expect((await post({name:'Reuse',phone:'',avatarCacheToken:uploadToken})).status()).toBe(400);
  // Removal means no new avatar; the existing permanent file must survive a real Save.
  await page.locator('[data-upload-input]').setInputFiles({name:'cancel.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state','uploaded'); await page.locator('[data-upload-remove]').click();
  await page.locator('#profile-name').fill('No new avatar'); await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('.topbar-user-name')).toHaveText('No new avatar');
  expect((await snapshot(user.id)).profile.avatar_url).toBe(first); expect(await readFile(path.join(media.root,first.slice(7)))).toEqual(png);
  await page.locator('[data-upload-input]').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state','uploaded');
  await page.locator('#basic [data-preview-action]').click();
  await expect.poll(async()=>(await snapshot(user.id)).profile.avatar_url).not.toBe(first);
  const second=(await snapshot(user.id)).profile.avatar_url; finalUrls.push(second);
  await expect(page.locator('.profile-avatar img')).toHaveAttribute('src',second);
  expect((await page.request.get(first)).status()).toBe(404); expect((await page.request.get(second)).status()).toBe(200);
  for(const theme of ['light','dark']) {
   if(await page.locator('html').getAttribute('data-bs-theme')!==theme) await page.locator('#theme-toggle').click();
   await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:`artifacts/profile-saved-${language}-${theme}.png`,fullPage:true,animations:'disabled'});
  }
  await page.setViewportSize({width:375,height:812}); expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({path:`artifacts/profile-saved-${language}-mobile.png`,fullPage:true,animations:'disabled'});
  await expect(page.locator('[data-navigation-id="users"]')).toHaveAttribute('data-availability','enabled');
  expect(await page.locator('body').textContent()).not.toMatch(/cpanel\.(profile|media)\./);
 } finally { for(const url of finalUrls) await media.deleteManagedFile(url,'users/avatars'); await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user.id]); }
});

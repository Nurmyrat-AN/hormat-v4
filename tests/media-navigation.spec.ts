import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
test('enabled Media navigation follows Super User, normal view grant and same-session revocation',async({page,context,baseURL})=>{
 const id=(await bootstrapSuperuser({name:'Media navigation',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;
 try{
  const session=await sessions.create(id);await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);
  await page.goto('/cpanel');const link=page.locator('[data-navigation-id=media] > a');await expect(link).toHaveAttribute('href','/cpanel/media');await link.click();await expect(page).toHaveURL(/\/cpanel\/media$/);await expect(link).toHaveAttribute('aria-current','page');
  expect((await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[id])).rows).toEqual([{key:'superuser',value:true}]);
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);await page.goto('/cpanel');await expect(link).toHaveCount(0);
  await pool.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'media.view','true')",[id]);await page.reload();await expect(link).toHaveAttribute('href','/cpanel/media');await link.click();await expect(page.locator('#media-manager')).toBeVisible();
  await pool.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='media.view'",[id]);await page.goto('/cpanel');await expect(link).toHaveCount(0);expect((await page.goto('/cpanel/media'))?.status()).toBe(403);
 }finally{await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);}
});

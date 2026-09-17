import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from '../tests/fixtures/source-browser.js';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
let fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>|undefined,user:string|undefined;
try{
 fixture=await sourceBrowserFixture(pool);user=(await bootstrapSuperuser({name:'Bulk localization',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user),context=await browser.newContext();await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();const values=(await pool.query("SELECT * FROM interface_translations WHERE translation_key LIKE 'cpanel.bulkDrafts.%'")).rows;
 for(const language of ['tm','ru','en']){
  await page.goto(base+'/cpanel/source-products');await page.locator('#shell-language').selectOption(language);await page.waitForFunction(lang=>document.documentElement.lang===lang,language);await page.goto(base+'/cpanel/source-products?vendor='+fixture.vendors[0]);
  const t=(key:string)=>values.find(v=>v.language_code===language&&v.translation_key==='cpanel.bulkDrafts.'+key).translation_value;
  await expect(page.locator('#source-bulk-drafts')).toHaveText(t('title'));await page.locator('#source-bulk-drafts').click();const dialog=page.locator('#bulk-drafts-dialog');await expect(dialog.locator('[data-bulk-create]')).toHaveText(t('create').replace('{count}','15'));await dialog.locator('[data-bulk-clear]').click();await expect(dialog.locator('[data-bulk-create]')).toBeDisabled();await dialog.locator('[data-source-selection]').first().check();await dialog.locator('#bulk-drafts-prefix').fill('Localization '+language);await expect(dialog.locator('[data-name-preview]').first()).toContainText('Localization '+language+' - ');await dialog.locator('[data-bulk-create]').click();await expect(dialog.locator('[data-bulk-status]')).toContainText(t('created')+': 1 · '+t('failed')+': 0');await expect(dialog).not.toContainText('cpanel.bulkDrafts.');console.info('PASS bulk drafts live '+language);
 }
}finally{await browser.close();await fixture?.cleanup();if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await pool.end();}

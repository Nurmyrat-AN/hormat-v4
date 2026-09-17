import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from '../tests/fixtures/source-browser.js';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
let fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>|undefined,user:string|undefined;
try{
 fixture=await sourceBrowserFixture(pool);user=(await bootstrapSuperuser({name:'Source tab localization',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user);const context=await browser.newContext();await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();
 const values=(await pool.query("SELECT * FROM interface_translations WHERE translation_key IN('cpanel.sourceProducts.createNew','cpanel.products.edit','cpanel.sourceProducts.noProduct')")).rows;
 for(const language of ['tm','ru','en']){
  await page.goto(base+'/cpanel/source-products?vendor='+fixture.vendors[0]);await page.locator('#shell-language').selectOption(language);await page.waitForFunction(lang=>document.documentElement.lang===lang,language);await page.goto(base+'/cpanel/source-products?vendor='+fixture.vendors[0]);const t=(key:string)=>values.find(v=>v.language_code===language&&v.translation_key===key).translation_value;
  await page.locator('[data-source-details="'+fixture.ids[0]+'"]').click();await page.locator('#source-tab-products').click();const pane=page.locator('#source-pane-products');await expect(pane.locator('[data-source-product-create]')).toHaveText(t('cpanel.sourceProducts.createNew'));await expect(pane.locator('[data-source-product-edit]').first()).toHaveText(t('cpanel.products.edit'));await expect(pane.locator('[data-storefront-product]')).toHaveCount(2);
  await pane.locator('[data-source-product-create]').click();await expect(page.locator('#product-source-name')).toContainText(fixture.prefix+' 00');await expect(page.locator('#product-name')).toHaveValue(fixture.prefix+' 00');await page.locator('#product-dialog .modal-footer [data-bs-dismiss]').click();await expect(pane).toBeVisible();
  await page.locator('#source-dialog .modal-footer [data-bs-dismiss]').click();await page.locator('[data-source-details="'+fixture.ids[1]+'"]').click();await page.locator('#source-tab-products').click();await expect(pane.locator('[data-products-status]')).toHaveText(t('cpanel.sourceProducts.noProduct'));await expect(pane).not.toContainText('cpanel.');console.info('PASS live Source Products tab '+language);
 }
}finally{await browser.close();await fixture?.cleanup();if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await pool.end();}

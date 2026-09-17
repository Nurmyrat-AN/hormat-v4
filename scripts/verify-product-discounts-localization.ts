/** Focused live verification; only disposable Product/Discount fixtures are changed. */
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from '../tests/fixtures/source-browser.js';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
let fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>|undefined,user:string|undefined,discount:string|undefined;
try{
 fixture=await sourceBrowserFixture(pool);user=(await bootstrapSuperuser({name:'Discount localization check',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user);
 const name='Discount-i18n-'+randomUUID();discount=(await pool.query('INSERT INTO discounts(name) VALUES($1) RETURNING id',[name])).rows[0].id;
 const product=(await pool.query('SELECT id FROM products WHERE source_product_id=$1 ORDER BY id',[fixture.ids[0]])).rows[0].id;
 const values=(await pool.query("SELECT language_code,translation_key,translation_value FROM interface_translations WHERE translation_key LIKE 'cpanel.products.%'")).rows;
 const context=await browser.newContext();await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();
 for(const language of ['tm','ru','en']){
  const t=(key:string)=>values.find(v=>v.language_code===language&&v.translation_key==='cpanel.products.'+key)!.translation_value;
  await page.goto(base+'/cpanel/products');await page.locator('#shell-language').selectOption(language);await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
  await page.locator('[data-product-edit="'+product+'"]').click();await page.locator('[data-tab=discounts]').click();const input=page.locator('#product-discount');await expect(input).toHaveAttribute('placeholder',t('searchDiscount'));await input.click();await input.fill(name);await page.locator('#product-discount-options [role=option]').click();await expect(input).toHaveValue('');await expect(page.locator('#product-status')).toHaveText(t('discountAttached'));
  const row=page.locator('#product-discounts article');await row.locator('[data-bs-toggle]').click();await row.getByRole('button',{name:t('detach'),exact:true}).click();await expect(row).toHaveCount(0);await expect(page.locator('#product-status')).toHaveText(t('discountDetached'));
  await input.click();await input.fill('absent-'+name);await expect(page.locator('#product-discount-control [data-ac-status]')).toHaveText(t('noAvailableDiscounts'));await expect(page.locator('#product-dialog')).not.toContainText('cpanel.products.');
  console.info('PASS Product Discounts live '+language+': translations, immediate attach/detach and clear');
 }
}finally{await browser.close();await fixture?.cleanup();if(discount)await pool.query('DELETE FROM discounts WHERE id=$1',[discount]);if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await pool.end();}

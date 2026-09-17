import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:process.env.CHROME_PATH});let user:string|undefined;
try{user=(await bootstrapSuperuser({name:'Browser localization',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user),context=await browser.newContext();await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();const values=(await pool.query("SELECT * FROM interface_translations WHERE translation_key LIKE 'cpanel.productBrowser.%'")).rows;
 for(const language of ['tm','ru','en']){await page.goto(base+'/cpanel/products');await page.locator('#shell-language').selectOption(language);await page.waitForFunction(lang=>document.documentElement.lang===lang,language);await page.locator('#products-filters-toggle').click();for(const key of ['storefront','effectiveHidden','noBrand','noCategory','hasDiscount','noDiscount','quantity','yes','no','count']){const value=values.find(v=>v.language_code===language&&v.translation_key==='cpanel.productBrowser.'+key)?.translation_value;await expect(page.locator('[data-browser-label="'+key+'"]')).toHaveText(value);}await expect(page.locator('#products-browser')).not.toContainText('cpanel.');console.info('PASS Products browser live '+language);}
}finally{await browser.close();if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await pool.end();}

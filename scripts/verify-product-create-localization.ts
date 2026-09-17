/** Focused live check of source selection -> shared full Product Create dialog. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from '../tests/fixtures/source-browser.js';
import {keysInSource,translationIssues} from './localization-integrity.mjs';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
let actor:string|undefined,fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>|undefined;
try{
 actor=(await bootstrapSuperuser({name:'Product Create localization check',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;
 fixture=await sourceBrowserFixture(pool);
 const session=await sessions.create(actor),context=await browser.newContext();
 await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();
 const keys=[...new Set((await Promise.all(['src/views/cpanel/partials/content/product-editor.ejs','src/views/cpanel/partials/content/product-source-selector.ejs','src/views/cpanel/partials/content/async-autocomplete.ejs'].map(file=>readFile(file,'utf8')))).flatMap(keysInSource))];
 const {rows}=await pool.query('SELECT language_code,translation_key,translation_value FROM interface_translations');assert.deepEqual(translationIssues(keys,rows),[]);
 for(const language of ['tm','ru','en']){
  await page.goto(base+'/cpanel/products');await page.locator('#shell-language').selectOption(language);await page.waitForFunction(language=>document.documentElement.lang===language,language);
  await page.locator('#product-add').click();await expect(page.locator('#product-source-selector')).toBeVisible();
  const corpus=await page.locator('body').evaluate(body=>[body.textContent,...Array.from(body.querySelectorAll('*')).flatMap(el=>Array.from(el.attributes).filter(attr=>['placeholder','aria-label','title'].includes(attr.name)).map(attr=>attr.value))].join('\n'));
  for(const key of keys){assert.ok(!corpus.includes(key),'Exposed key '+key);const value=rows.find(row=>row.language_code===language&&row.translation_key===key)?.translation_value;assert.ok(corpus.includes(value),language+': missing DB value '+key);}
  await page.goto(base+'/cpanel/source-products?vendor='+fixture.vendors[1]);await expect(page.locator('.source-card')).toHaveCount(1);await page.locator('.source-card [data-bs-toggle=dropdown]').click();await page.locator('[data-source-create]').click();
  const dialog=page.locator('#product-dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('#product-name')).toHaveValue(fixture.prefix+' 00');await expect(dialog.locator('[data-tab]')).toHaveCount(7);await expect(dialog.locator('[data-tab=seo]')).toBeDisabled();await dialog.locator('#product-save').click();await expect(dialog).toHaveAttribute('data-mode','edit');await expect(dialog.locator('[data-tab=seo]')).toBeEnabled();await expect(dialog.locator('#product-status')).toHaveText(rows.find(row=>row.language_code===language&&row.translation_key==='cpanel.products.saved').translation_value);
  console.info('PASS Product Create live '+language+': shared full dialog, DB translations and language switching');
 }
}finally{await browser.close();await fixture?.cleanup();if(actor)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[actor]);await pool.end();}

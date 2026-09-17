import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {sourceBrowserFixture} from '../tests/fixtures/source-browser.js';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
const entities:Record<string,string>={};let user:string|undefined,fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>|undefined;
try{
 fixture=await sourceBrowserFixture(pool);user=(await bootstrapSuperuser({name:'Attachment localization',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(user),prefix='Attach-i18n-'+randomUUID();
 for(const kind of ['brands','categories','discounts'])entities[kind]=(await pool.query(kind==='discounts'?'INSERT INTO discounts(name) VALUES($1) RETURNING id':`INSERT INTO ${kind}(name,slug) VALUES($1,$2) RETURNING id`,kind==='discounts'?[prefix]:[prefix,randomUUID()])).rows[0].id;
 const product=(await pool.query('SELECT id FROM products WHERE source_product_id=$1 ORDER BY id LIMIT 1',[fixture.ids[0]])).rows[0].id;await pool.query('UPDATE products SET name=$1 WHERE id=$2',[prefix,product]);
 const values=(await pool.query("SELECT * FROM interface_translations WHERE translation_key LIKE 'cpanel.attachments.%'")).rows;
 const context=await browser.newContext();await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const language of ['tm','ru','en'])for(const kind of ['brands','categories','discounts']){
  await page.goto(base+'/cpanel/'+kind);await page.locator('#shell-language').selectOption(language);await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
  const t=(key:string)=>values.find(v=>v.language_code===language&&v.translation_key==='cpanel.attachments.'+key).translation_value;
  await page.locator(kind==='discounts'?'#discount-search':'#'+kind+'-search').fill(prefix);const singular=kind==='categories'?'category':kind==='brands'?'brand':'discount',card=page.locator('[data-'+singular+'-id="'+entities[kind]+'"]');await card.locator('[data-bs-toggle]').click();await card.locator(kind==='discounts'?'[data-action=edit]':'[data-'+singular+'-action=edit]').click();
  const dialog=page.locator(kind==='discounts'?'#discount-dialog':'#brand-dialog');await dialog.locator('[data-tab=products]').click();const area=dialog.locator('[data-attached-products]'),input=area.locator('input');await expect(input).toHaveAttribute('placeholder',t('search'));
  await input.click();await input.fill(prefix);await area.locator('[role=option]').click();await expect(input).toHaveValue('');await expect(area.locator('[data-attached-status]')).toHaveText(t('attached'));
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);await expect(area.locator('[data-attached-product]')).toBeVisible();const image=await area.locator('.media-reference-preview').boundingBox();expect(image?.height).toBe(48);}
  await area.locator('[data-attached-product] [data-bs-toggle]').click();await area.getByRole('button',{name:t('detach'),exact:true}).click();await expect(area.locator('[data-attached-status]')).toHaveText(t('detached'));await expect(area.locator('[data-attached-product]')).toHaveCount(0);await expect(dialog).not.toContainText('cpanel.attachments.');
  console.info('PASS live '+kind+' '+language+' translations, attach/detach, light/dark');
 }
 expect(errors).toEqual([]);
}finally{await browser.close();await fixture?.cleanup();for(const [kind,id]of Object.entries(entities))await pool.query(`DELETE FROM ${kind} WHERE id=$1`,[id]);if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await pool.end();}

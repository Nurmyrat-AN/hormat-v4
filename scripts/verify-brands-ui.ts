import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {config} from '../src/config/env.js';
import {keysInSource} from './localization-integrity.mjs';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});let actor:string|undefined;
try{
 actor=(await bootstrapSuperuser({name:'Brands localization verification',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;
 const session=await sessions.create(actor),values=(await pool.query('SELECT * FROM interface_translations')).rows;
 const keys=[...new Set((await Promise.all(['src/views/cpanel/pages/brands-content.ejs','src/views/cpanel/partials/content/translatable-field.ejs','src/views/cpanel/partials/media/picker.ejs'].map(file=>readFile(file,'utf8')))).flatMap(keysInSource))];
 for(const language of ['tm','ru','en']){
  const context=await browser.newContext();try{
   await context.addCookies([{name:config.app.mode==='production'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(base).hostname,path:'/cpanel',secure:config.app.mode==='production',httpOnly:true,sameSite:'Lax'},{name:'hormat_lang',value:language,url:base}]);
   const page=await context.newPage();assert.equal((await page.goto(base+'/cpanel/brands'))?.status(),200);
   const corpus=await page.locator('body').evaluate(body=>body.textContent+'\n'+[...body.querySelectorAll('template')].map(t=>t.content.textContent).join('\n')+'\n'+[...body.querySelectorAll('*')].flatMap(el=>[...el.attributes].map(a=>a.value)).join('\n'));
   for(const key of keys){const value=values.find(v=>v.language_code===language&&v.translation_key===key)?.translation_value;assert.ok(value&&value!==key);assert.ok(corpus.includes(value),language+': missing '+key);assert.ok(!corpus.includes(key),language+': exposed key');}
   await page.locator('#brands-add').click();await page.locator('#brand-name').fill('');await page.locator('[data-save=basic]').click();await expect(page.locator('#brand-name-error')).toBeVisible();
   const name='Live verification '+randomUUID();await page.locator('#brand-name').fill(name);await page.locator('[data-save=basic]').click();await expect(page.locator('#brand-dialog')).toHaveAttribute('data-mode','edit');const id=await page.locator('#brand-dialog').getAttribute('data-entity-id');assert.match(id!,/^\d+$/);await expect(page.locator('#brand-dialog')).toBeVisible();await expect(page.locator('#brand-visibility')).toHaveValue('hidden');
   await page.locator('[data-translatable-field="brand-name"] [data-translation-toggle]').click();await page.locator('[data-translatable-field="brand-name"] [data-translation-input=ru]').fill('Проверка');await page.locator('[data-translatable-field="brand-name"] [data-save-field]').click();await expect(page.locator('[data-translatable-field="brand-name"] [data-translation-status]')).toHaveText(values.find(v=>v.language_code===language&&v.translation_key==='cpanel.brands.persistedSaved').translation_value);
   await page.locator('#brand-main-select').click();await expect(page.locator('[data-media-picker]')).toBeVisible();await page.locator('[data-picker-cancel]').last().click();await page.locator('#brand-dialog .btn-close[data-bs-dismiss]').click();await expect(page.locator('#brand-dialog')).toBeHidden();await page.reload();await page.locator('#brands-search').fill(name);await expect(page.locator('.brand-item')).toHaveCount(1);await page.locator('[data-brand-id="'+id+'"] .brand-actions > button').click();await page.locator('[data-brand-id="'+id+'"] [data-brand-action=edit]').click();await expect(page.locator('#brand-dialog')).toBeVisible();await expect(page.locator('#brand-name')).toHaveValue(name);await page.locator('[data-translatable-field="brand-name"] [data-translation-toggle]').click();await expect(page.locator('[data-translatable-field="brand-name"] [data-translation-input=ru]')).toHaveValue('Проверка');await page.locator('#brand-dialog .btn-close[data-bs-dismiss]').click();await expect(page.locator('#brand-dialog')).toBeHidden();
   const next=language==='en'?'ru':'en';await page.locator('#shell-language').selectOption(next);await expect(page.locator('html')).toHaveAttribute('lang',next);
   console.info(`PASS live Brands ${language}: real DB translations, Create/Edit, independent translation save, persisted reload and language switching`);
  }finally{await context.close();}
 }
}finally{await browser.close();if(actor){await pool.query('DELETE FROM brand_media WHERE brand_id IN(SELECT id FROM brands WHERE created_by=$1)',[actor]);await pool.query('DELETE FROM brand_translations WHERE brand_id IN(SELECT id FROM brands WHERE created_by=$1)',[actor]);await pool.query('DELETE FROM brands WHERE created_by=$1',[actor]);await pool.query('DELETE FROM cpanel_users WHERE id=$1',[actor]);}await pool.end();}

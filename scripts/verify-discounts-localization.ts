/** Targeted live-cache verification; avoids unrelated historical mutation workflows. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {keysInSource,translationIssues} from './localization-integrity.mjs';
const base=process.env.LOCALIZATION_URL??'http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
let actor:string|undefined;
try{
 actor=(await bootstrapSuperuser({name:'Discount localization verification',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;
 const session=await sessions.create(actor),context=await browser.newContext();
 await context.addCookies([{name:'hormat_cpanel',value:session.token,url:base+'/cpanel',httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();
 const keys=[...new Set((await Promise.all(['src/views/cpanel/pages/discounts.ejs','src/views/cpanel/pages/discounts-content.ejs','src/views/cpanel/partials/content/translatable-field.ejs','src/views/cpanel/partials/content/visibility.ejs'].map(file=>readFile(file,'utf8')))).flatMap(keysInSource))];
 const {rows}=await pool.query('SELECT language_code,translation_key,translation_value FROM interface_translations');assert.deepEqual(translationIssues(keys,rows),[]);
 await page.goto(base+'/cpanel/discounts');
 for(const language of ['tm','ru','en']){
  await page.locator('#shell-language').selectOption(language);
  await page.waitForFunction(language=>document.documentElement.lang===language,language);
  assert.equal(new URL(page.url()).pathname,'/cpanel/discounts');
  const corpus=await page.locator('body').evaluate(body=>[body.textContent,...Array.from(body.querySelectorAll('template')).map(el=>el.content.textContent),...[...Array.from(body.querySelectorAll('*')),...Array.from(body.querySelectorAll('template')).flatMap(el=>Array.from(el.content.querySelectorAll('*')))].flatMap(el=>Array.from(el.attributes).filter(attr=>['placeholder','aria-label','title'].includes(attr.name)).map(attr=>attr.value))].join('\n'));
  // Discounts supplies baseHelp explicitly instead of the optional Brand-specific overrideHelp.
  for(const key of keys.filter(key=>!['cpanel.content.overrideHelp','cpanel.content.saved'].includes(key))){assert.ok(!corpus.includes(key),'Exposed key '+key);const value=rows.find(row=>row.language_code===language&&row.translation_key===key)?.translation_value;assert.ok(corpus.includes(value),language+': missing DB value '+key);}
  console.info('PASS Discounts live '+language+': actual database labels, no exposed keys, topbar language return route');
 }
}finally{await browser.close();if(actor)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[actor]);await pool.end();}

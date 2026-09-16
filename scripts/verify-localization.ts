import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { sessions } from '../src/cpanel/auth/sessions.js';
import { mediaStore } from '../src/media/index.js';
import { bootstrapSuperuser } from '../src/cpanel/auth/bootstrap.js';
import { chromium } from '@playwright/test';
import { pool } from '../src/database/pool.js';
import { collectUiKeys, keysInSource, translationIssues } from './localization-integrity.mjs';

if (process.argv.includes('--scope=source-products')) { await import('./verify-source-products-localization.js'); process.exit(0); }
if (process.argv.includes('--scope=products')) { await import('./verify-products-localization.js'); process.exit(0); }

// A focused UI task can verify its live translations without historical domain mutations.
if (process.argv.includes('--scope=settings')) {
  await import('./verify-settings-localization.js');
  process.exit(0);
}
if (process.argv.includes('--scope=option-types')) {
  await import('./verify-option-types-localization.js');
  process.exit(0);
}
if (process.argv.includes('--scope=interface-translations')) {
  await import('./verify-interface-translations-localization.js');
  process.exit(0);
}
if (process.argv.includes('--scope=languages')) {
  await import('./verify-languages-localization.js');
  process.exit(0);
}
if (process.argv.includes('--scope=currencies')) {
  await import('./verify-currencies-localization.js');
  process.exit(0);
}
if (process.argv.includes('--scope=discounts')) {
  await import('./verify-discounts-localization.js');
  process.exit(0);
}

const baseURL = process.env.LOCALIZATION_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
let testUserId: string | undefined;
const testCredentials = { name: 'Localization verification', email: `verify-${randomBytes(12).toString('hex')}@example.invalid`, password: randomBytes(24).toString('hex') };
try {
  testUserId = (await bootstrapSuperuser(testCredentials)).id;
  const keys = await collectUiKeys();
  const uploaderKeys=keysInSource(await readFile('src/views/cpanel/partials/media/uploader.ejs','utf8'));
  const { rows } = await pool.query('SELECT language_code, translation_key, translation_value FROM interface_translations');
  assert.deepEqual(translationIssues(keys, rows), []);
  const value = (language: string, key: string): string => rows.find(row => row.language_code === language && row.translation_key === key).translation_value;
  for (const language of ['tm', 'ru', 'en']) {
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: 'hormat_lang', value: language, url: baseURL }]);
      const page = await context.newPage();
      for (const route of ['/', '/cpanel', '/cpanel/login']) {
        const response = await page.goto(new URL(route, baseURL).href);
        assert.equal(response?.status(), 200);
        const corpus = await page.locator('body').evaluate(body => [body.textContent, ...Array.from(body.querySelectorAll('*')).flatMap(element => Array.from(element.attributes).filter(attr => ['placeholder', 'aria-label'].includes(attr.name) || attr.name.startsWith('data-')).map(attr => attr.value))].join('\n'));
        for (const key of keys) assert.ok(!corpus.includes(key), `${route} ${language}: exposed key ${key}`);
        const expectedKeys = route === '/' ? ['frontend.title'] : route === '/cpanel' ? ['cpanel.login.title'] : keys.filter(key => key.startsWith('cpanel.login.') || key.startsWith('brand.'));
        for (const key of expectedKeys) assert.ok(corpus.includes(value(language, key)), `${route} ${language}: missing actual database value for ${key}`);
        console.info(`PASS live ${baseURL}${route} ${language}: actual database values, no exposed keys`);
      }
      for (const selected of ['ru', 'en', 'tm']) {
        await page.locator('#login-language').selectOption(selected);
        await page.waitForFunction(expected => document.querySelector('h1')?.textContent === expected, value(selected, 'cpanel.login.title'));
        assert.equal((await context.cookies()).find(cookie => cookie.name === 'hormat_lang')?.value, selected);
      }
      console.info(`PASS live selector from ${language}: cookie and rendered values changed`);
      await page.locator('#login-language').selectOption(language);
      await page.waitForFunction(expected => document.querySelector('h1')?.textContent === expected, value(language, 'cpanel.login.title'));
      await page.locator('#login-email').fill(testCredentials.email);
      await page.locator('#login-password').fill('invalid');
      await page.locator('#login-submit').click();
      await page.getByRole('status').waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('status').innerText(), value(language, 'cpanel.auth.invalidCredentials'));
      await page.locator('#login-email').fill(testCredentials.email);
      await page.locator('#login-password').fill(testCredentials.password);
      await page.locator('#login-submit').click();
      await page.waitForURL('**/cpanel');
      await page.locator('#user-menu').click();
      const authenticated = await page.locator('body').evaluate(body => [body.textContent, ...Array.from(body.querySelectorAll('*')).flatMap(element => Array.from(element.attributes).filter(attr => ['placeholder', 'aria-label', 'title'].includes(attr.name) || attr.name.startsWith('data-')).map(attr => attr.value))].join('\n'));
      for (const key of keys.filter(key => key.startsWith('cpanel.shell.') || key.startsWith('cpanel.navigation.'))) assert.ok(authenticated.includes(value(language, key)), `shell ${language}: missing value ${key}`);
      for (const key of keys) assert.ok(!authenticated.includes(key), `shell ${language}: exposed key ${key}`); 
      for (const key of ['cpanel.title', 'cpanel.auth.signedInAs', 'cpanel.auth.logout']) assert.ok(authenticated.includes(value(language, key)));
      const csrfError = await page.evaluate(async () => (await fetch('/cpanel/logout', { method: 'POST' })).text());
      assert.equal(csrfError, value(language, 'cpanel.auth.invalidRequest'));
      await page.goto(new URL('/cpanel/profile', baseURL).href);
      const profileCorpus = await page.locator('body').evaluate(body => [body.textContent, ...Array.from(body.querySelectorAll('*')).flatMap(element => Array.from(element.attributes).filter(attr => ['placeholder', 'aria-label', 'title'].includes(attr.name) || attr.name.startsWith('data-')).map(attr => attr.value))].join('\n'));
      for (const key of keys.filter(key => (key.startsWith('cpanel.profile.') && !['cpanel.profile.saved','cpanel.profile.previewNotice'].includes(key)) || uploaderKeys.includes(key) || key === 'cpanel.userMenu.profile')) assert.ok(profileCorpus.includes(value(language, key)), `profile ${language}: missing value ${key}`);
      for (const key of keys) assert.ok(!profileCorpus.includes(key), `profile ${language}: exposed key ${key}`);
      assert.equal(await page.locator('#profile-email').inputValue(), testCredentials.email);
      console.info(`PASS live profile ${language}: actual database translations and authenticated email`);
      const beforeMedia = (await pool.query('SELECT to_jsonb(a) auth FROM cpanel_user_auth a WHERE user_id=$1', [testUserId])).rows[0];
      await page.locator('[data-upload-input]').setInputFiles({ name: 'localization-check.txt', mimeType: 'text/plain', buffer: Buffer.from('Disposable upload verification') });
      await page.waitForFunction(() => document.querySelector('[data-media-uploader]')?.getAttribute('data-upload-state') === 'uploaded');
      assert.equal(await page.locator('[data-upload-status]').textContent(), value(language, 'cpanel.media.uploaded'));
      await page.locator('#basic [data-preview-action]').click();
      await page.locator('#basic > [role="status"]').waitFor({ state: 'visible' });
      await page.waitForFunction(expected => document.querySelector('#profile-status')?.textContent === expected, value(language, 'cpanel.profile.saved'));
      assert.deepEqual((await pool.query('SELECT to_jsonb(a) auth FROM cpanel_user_auth a WHERE user_id=$1', [testUserId])).rows[0], beforeMedia);
      const finalUrl = (await pool.query('SELECT avatar_url FROM cpanel_users WHERE id=$1', [testUserId])).rows[0].avatar_url;
      assert.match(finalUrl, /^\/media\/users\/avatars\//);
      for (const [fields, key] of [[{ name: ' ', phone: '' }, 'invalidName'], [{ name: 'Valid', phone: 'x'.repeat(51) }, 'invalidPhone'], [{ name: 'Valid', phone: '', avatarCacheToken: 'forged' }, 'avatarFailed']] as const) {
        const message = await page.evaluate(async fields => {
          const body = new URLSearchParams(fields); body.set('_csrf', (document.querySelector('#profile-form [name="_csrf"]') as HTMLInputElement).value);
          return (await (await fetch('/cpanel/profile', {method:'POST', body})).json()).message;
        }, fields);
        assert.equal(message, value(language, 'cpanel.profile.' + key));
      }
      console.info(`PASS live profile save ${language}: final media URL, translated success/validation and unchanged authentication`);

      await page.locator('#password-tab').click();
      await page.locator('#profile-password-current').fill('incorrect');
      await page.locator('#profile-password-new').fill(testCredentials.password + 'x');
      await page.locator('#profile-password-confirm').fill(testCredentials.password + 'x');
      await page.locator('#password-submit').click();
      await page.waitForFunction(expected => document.querySelector('#password-status')?.textContent === expected, value(language, 'cpanel.password.incorrect'));
      await page.locator('#profile-password-current').fill(testCredentials.password);
      await page.locator('#profile-password-new').fill(testCredentials.password + 'x');
      await page.locator('#profile-password-confirm').fill(testCredentials.password + 'x');
      await page.locator('#password-submit').click();
      await page.waitForFunction(expected => document.querySelector('#password-status')?.textContent === expected, value(language, 'cpanel.password.success'));
      await page.waitForLoadState('load');
      testCredentials.password += 'x';
      assert.equal(await page.locator('#profile-password-current').inputValue(), '');
      console.info(`PASS live password ${language}: translated error/success, cleared fields and retained current session`);
      await page.goto(new URL('/cpanel/users', baseURL).href);
      const usersCorpus = await page.locator('body').innerHTML();
      const backendKeys=['invalidJob','invalidEmail','duplicateEmail','notFound','created','updated','activated','deactivated','passwordChanged'];
      for (const key of keys.filter(key => key.startsWith('cpanel.users.')&&!backendKeys.includes(key.split('.').pop()!))) {
        assert.ok(usersCorpus.includes(value(language,key)), `users ${language}: missing ${key}`);
        assert.ok(!usersCorpus.includes(key), `users ${language}: exposed ${key}`);
      }
      assert.equal(await page.locator('#users-field').inputValue(),'name');
      assert.equal(await page.locator('#users-status-filter').inputValue(),'active');
      await page.locator('[data-bs-target="#users-add"]').click();
      await page.locator('#users-add [data-operation-submit]').click();
      await page.waitForFunction(expected=>document.querySelector('#users-add [data-operation-notice]')?.textContent===expected,value(language,'cpanel.profile.invalidName'));
      const fixtureEmail=`users-live-${randomUUID()}@example.invalid`;
      try {
        for(const [field,text] of Object.entries({name:'Localization test user',email:fixtureEmail,phone:'000',job:'Test',password:testCredentials.password,confirm:testCredentials.password}))await page.locator(`#users-add [name="${field}"]`).fill(text);
        await page.locator('#users-add [data-operation-submit]').click();
        await page.waitForFunction(expected=>document.querySelector('#users-feedback')?.textContent===expected,value(language,'cpanel.users.created'));
        await page.locator('#users-search').fill('Localization test user');
        await page.waitForFunction(()=>document.querySelector('.users-item [data-name]')?.textContent==='Localization test user');
        const fixtureId=(await pool.query('SELECT user_id FROM cpanel_user_auth WHERE email=$1',[fixtureEmail])).rows[0].user_id;
        const assignments=async()=> (await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1 ORDER BY key',[fixtureId])).rows;
        await page.goto(new URL('/cpanel/permissions',baseURL).href);
        const permissionList=await page.locator('body').innerHTML();
        await page.goto(new URL(`/cpanel/permissions/${fixtureId}`,baseURL).href);
        await page.getByRole('switch').first().check();await page.locator('[data-permission-key="permissions.view"]').check();await page.locator('#permission-save').click();
        await page.waitForFunction(expected=>document.querySelector('#permission-feedback')?.textContent===expected,value(language,'cpanel.permissions.saved'));
        let permissionCorpus=permissionList+await page.locator('body').innerHTML();
        const readTarget=await bootstrapSuperuser({name:'Read-only localization target',email:`${randomUUID()}@example.invalid`,password:randomUUID()});
        const readContext=await browser.newContext();
        try {
          await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[readTarget.id]);
          const session=await sessions.create(fixtureId);
          const rootCookie=(await context.cookies()).find(cookie=>cookie.name.endsWith('hormat_cpanel'))!;
          await readContext.addCookies([{...rootCookie,value:session.token},{name:'hormat_lang',value:language,url:baseURL}]);
          const readPage=await readContext.newPage();
          await readPage.goto(new URL(`/cpanel/permissions/${fixtureId}`,baseURL).href);
          assert.equal(await readPage.locator('.permission-readonly').innerText(),value(language,'cpanel.permissions.selfEdit'));
          permissionCorpus+=await readPage.locator('body').innerHTML();
          await readPage.goto(new URL(`/cpanel/permissions/${readTarget.id}`,baseURL).href);
          assert.equal(await readPage.locator('.permission-readonly').innerText(),value(language,'cpanel.permissions.readOnly'));
          permissionCorpus+=await readPage.locator('body').innerHTML();
        } finally {await readContext.close();await pool.query('DELETE FROM cpanel_users WHERE id=$1',[readTarget.id]);}
        for(const key of keys.filter(key=>key.startsWith('cpanel.permissions.'))) {
          assert.ok(permissionCorpus.includes(value(language,key)),`permissions ${language}: missing ${key}`);
          assert.ok(!permissionCorpus.includes(key),`permissions ${language}: exposed ${key}`);
        }
        assert.deepEqual(await assignments(),[{key:'permissions.view',value:true},{key:'users.view',value:true}]);
        console.info(`PASS live Permissions ${language}: actual DB translations, persisted grants and localized read-only/self-edit states`);
        // Real server check is read-only. Synthetic trees and limit/empty fixtures belong to isolated tests.
        // Picker-only Media labels belong to the Brands host, not the standalone File Manager.
        await page.goto(new URL('/cpanel/brands',baseURL).href);
        let mediaCorpus=permissionCorpus+await page.locator('body').innerHTML();
        for(const location of ['/cpanel/media','/cpanel/media?path=cache','/cpanel/media?query=no-match-'+randomUUID(),'/cpanel/media?path=missing-'+randomUUID()]){
          await page.goto(new URL(location,baseURL).href);mediaCorpus+=await page.locator('body').innerHTML();
        }
        const conditionalMediaKeys=new Set(['cpanel.media.empty','cpanel.media.limited','cpanel.media.location']);
        for(const key of keys.filter(key=>key.startsWith('cpanel.media.')&&!uploaderKeys.includes(key))){
          if(!conditionalMediaKeys.has(key))assert.ok(mediaCorpus.includes(value(language,key)),`media ${language}: missing ${key}`);
          assert.ok(!mediaCorpus.includes(key),`media ${language}: exposed ${key}`);
        }
        console.info(`PASS live Media ${language}: read-only real DB labels, dialogs, cache and missing-folder recovery; conditional fixture states checked in isolated browser tests`);
        const vendorName='localization-vendor-'+randomUUID();
        try {
          await page.goto(new URL('/cpanel/vendors',baseURL).href);
          await page.locator('#vendors-search').fill(vendorName);
          await page.locator('[data-vendor-action=add]').click();
          await page.locator('#vendor-name').fill(vendorName);
          await page.locator('#vendor-url').fill('https://unreachable.example.invalid/database');
          await page.locator('#vendor-username').fill('localization-reader');
          await page.locator('#vendor-password').fill(randomUUID());
          // Keep live verification fixtures out of the enabled production SyncManager.
          await page.locator('#vendor-active').selectOption('inactive');
          await page.locator('#vendor-save').click();
          await page.waitForFunction(expected=>document.querySelector('#vendors-feedback')?.textContent===expected,value(language,'cpanel.vendors.created'));
          await page.locator('#vendor-dialog').waitFor({state:'hidden'});
          await page.locator('#vendors-status').selectOption('inactive');
          await page.locator('.vendor-item').waitFor();
          const vendorCorpus=permissionCorpus+await page.locator('body').innerHTML();
          const conditional=new Set(['cpanel.vendors.hours','cpanel.vendors.minutes','cpanel.vendors.seconds','cpanel.vendors.healthPending']);
          for(const key of keys.filter(key=>key.startsWith('cpanel.vendors.'))){
            if(!conditional.has(key))assert.ok(vendorCorpus.includes(value(language,key)),`vendors ${language}: missing ${key}`);
            assert.ok(!vendorCorpus.includes(key),`vendors ${language}: exposed ${key}`);
          }
          assert.equal(await page.locator('[data-value=healthLabel]').innerText(),value(language,'cpanel.vendors.notSynced'));
          console.info(`PASS live Vendors ${language}: real create, PostgreSQL translations, neutral runtime state; disposable vendor removed`);
        } finally {await pool.query('DELETE FROM vendors WHERE name=$1',[vendorName]);}



      } finally {
        await pool.query('DELETE FROM cpanel_users WHERE id IN (SELECT user_id FROM cpanel_user_auth WHERE email=$1)',[fixtureEmail]);
      }
      console.info(`PASS live Users ${language}: database labels, validation, real create/search and fixture cleanup`);

      await page.locator('#user-menu').click();
      await page.locator('form[action="/cpanel/logout"] button').click();
      await page.waitForURL('**/cpanel/login');
      console.info(`PASS live authentication ${language}: generic error, authenticated page, CSRF rejection, logout`);

    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  if (testUserId) {
    const user = (await pool.query('SELECT avatar_url FROM cpanel_users WHERE id=$1', [testUserId])).rows[0];
    if (user?.avatar_url) await mediaStore.deleteManagedFile(user.avatar_url, 'users/avatars');
    await pool.query('DELETE FROM cpanel_users WHERE id=$1', [testUserId]);
  }
  await pool.end();
}

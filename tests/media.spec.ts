import {readFile} from 'node:fs/promises';
import {keysInSource} from '../scripts/localization-integrity.mjs';
import { test, expect } from './auth-fixture.js';
import { pool } from '../src/database/pool.js';
import sharp from 'sharp';
import { sessions } from '../src/cpanel/auth/sessions.js';
async function authenticate(context: import('@playwright/test').BrowserContext, userId: string, baseURL: string) {
  const { token } = await sessions.create(userId);
  await context.addCookies([{ name: process.env.TEST_PRODUCTION === '1' ? '__Secure-hormat_cpanel' : 'hormat_cpanel', value: token, domain: new URL(baseURL).hostname, path: '/cpanel', httpOnly: true, secure: process.env.TEST_PRODUCTION === '1', sameSite: 'Lax' }]);
}


const bytes = Buffer.from('Universal file: <script>this must never execute</script>');
const uploadPath = '/cpanel/media/upload';

test('upload protocol: auth/CSRF, arbitrary files, metadata, safe public serving and exact error envelope', async ({ page, context, authUser, baseURL }) => {
  expect((await page.request.post(uploadPath, { multipart: { file: { name: 'test.bin', mimeType: 'application/octet-stream', buffer: bytes } }, maxRedirects: 0 })).status()).toBe(303);
  await authenticate(context, authUser.id, baseURL!); await page.goto('/cpanel/profile');
  const token = await page.locator('[data-media-uploader]').getAttribute('data-csrf');
  const cookie = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
  const headers = { Cookie: cookie, 'X-CSRF-Token': token! };
  expect((await page.request.post(uploadPath, { headers: { Cookie: cookie }, multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: bytes } }, maxRedirects: 0 })).status()).toBe(403);
  const png = await sharp({ create: { width: 7, height: 5, channels: 3, background: '#13845a' } }).png().toBuffer();
  for (const [name, buffer, type] of [['evil.html', bytes, 'application/octet-stream'], ['empty', Buffer.alloc(0), 'application/octet-stream'], ['picture.png', png, 'image/png']] as const) {
    const response = await page.request.post(uploadPath, { headers, multipart: { file: { name, mimeType: 'application/octet-stream', buffer } } });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true); expect(Object.keys(body.media).sort()).toEqual(['cacheToken', 'height', 'mimeType', 'originalName', 'size', 'url', 'width']);
    expect(body.media.mimeType).toBe(type); expect(body.media.originalName).toBe(name); expect(body.media.size).toBe(buffer.length);
    expect(body.media.url).toMatch(/^\/media\/cache\/[a-f0-9-]+\.[a-z0-9]+$/);
    const download = await page.request.get(body.media.url);
    expect(download.status()).toBe(200); expect(await download.body()).toEqual(buffer);
    expect(download.headers()['x-content-type-options']).toBe('nosniff');
    expect(download.headers()['content-disposition']).toBe(type === 'image/png' ? 'inline' : 'attachment');
    expect(body.media.width).toBe(type === 'image/png' ? 7 : null);
    expect((await page.request.get(`/media/cache/${body.media.cacheToken}/record.json`)).status()).toBe(404);
  }
  for (const form of [ { file: { name: 'x.txt', mimeType: 'text/plain', buffer: bytes }, destination: '../users/avatar' }, { wrong: { name: 'x.txt', mimeType: 'text/plain', buffer: bytes } } ]) {
    const response = await page.request.post(uploadPath, { headers, multipart: form });
    expect(response.status()).toBe(400); expect(await response.json()).toEqual({ success: false, error: { code: 'MEDIA_FILE_INVALID' } });
  }
  const form = new FormData(); form.append('file', new Blob(['a']), 'a.txt'); form.append('file', new Blob(['b']), 'b.txt');
  const multipart = new Request('http://localhost', { method: 'POST', body: form });
  const multiple = await page.request.post(uploadPath, { headers: { ...headers, 'Content-Type': multipart.headers.get('content-type')! }, data: Buffer.from(await multipart.arrayBuffer()) });
  expect(multiple.status()).toBe(400); expect((await multiple.json()).error.code).toBe('MEDIA_FILE_INVALID');
  const empty = await page.request.post(uploadPath, { headers: { ...headers, 'Content-Type': 'multipart/form-data; boundary=empty' }, data: '--empty--\r\n' });
  expect(empty.status()).toBe(400); expect((await empty.json()).error.code).toBe('MEDIA_FILE_REQUIRED');
  expect((await page.request.post('/cpanel/media/finalize', { headers })).status()).toBe(404);
});

test('uploader real progress, wait-on-save, reselection/remove/error retry, translations and unchanged profile', async ({ page, context, authUser, baseURL }) => {
  test.setTimeout(90000);
  await pool.query("UPDATE cpanel_users SET avatar_url='/public/cpanel/images/login/ashgabat.jpg' WHERE id=$1", [authUser.id]);
  await page.addInitScript(() => {
    (window as any).mediaProgress = [];
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      this.upload.addEventListener('progress', e => { if (e.lengthComputable) (window as any).mediaProgress.push(Math.floor(e.loaded / e.total * 100)); });
      originalSend.call(this, body);
    };
  });
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('profile-form');
    if (!form) return;
    const uploader = (document.querySelector('[data-media-uploader]') as any).mediaUploader;
    const callback = (window as any).HormatMediaUploader.createSaveHandler([uploader], () => { const status = document.querySelector('#profile-status') as HTMLElement; status.textContent = 'Test callback completed'; status.hidden = false; }, document.querySelector('#basic [data-preview-action]'));
    form.addEventListener('submit', event => { event.stopImmediatePropagation(); void callback(event); }, true);
  }));
  await authenticate(context, authUser.id, baseURL!); await page.goto('/cpanel/profile');
  const before = (await pool.query('SELECT to_jsonb(u) profile, to_jsonb(a) auth FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1', [authUser.id])).rows[0];
  const uploaderKeys=keysInSource(await readFile('src/views/cpanel/partials/media/uploader.ejs','utf8'));
  const { rows } = await pool.query("SELECT * FROM interface_translations WHERE translation_key=ANY($1::text[])",[uploaderKeys]);
  for (const language of ['tm', 'ru', 'en']) {
    await Promise.all([page.waitForEvent('load'), page.locator('#shell-language').selectOption(language)]);
    const root = page.locator('[data-media-uploader]');
    const corpus = await root.evaluate(e => [e.textContent, ...Array.from(e.attributes).map(a => a.value)].join('\n'));
    for (const row of rows.filter(r => r.language_code === language)) { expect(corpus).toContain(row.translation_value); expect(corpus).not.toContain(row.translation_key); }
  }
  // Fetch the actual response, then delay its delivery to exercise pending Save and real XHR upload events.
  let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
  await page.route('**/cpanel/media/upload', async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.locator('[data-upload-input]').setInputFiles({ name: 'first.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'uploading');
  await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#basic [data-preview-action]')).toBeDisabled();
  await expect(page.locator('#basic > [role="status"]')).toBeHidden();
  release();
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'uploaded');
  await expect(page.locator('#basic > [role="status"]')).toBeVisible();
  await expect(page.locator('#basic [data-preview-action]')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).mediaProgress.length)).toBeGreaterThan(0);
  const first = await page.locator('[data-media-uploader]').evaluate(e => (e as any).mediaUploader.cacheToken);
  await page.unroute('**/cpanel/media/upload');
  const image = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#147954' } }).png().toBuffer();
  await page.locator('[data-upload-input]').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: image });
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'uploaded');
  expect(await page.locator('[data-media-uploader]').evaluate(e => (e as any).mediaUploader.cacheToken)).not.toBe(first);
  await expect(page.locator('[data-media-preview]')).toHaveAttribute('src', /^\/media\/cache\/.+\.png$/);
  await page.locator('[data-upload-remove]').click();
  await expect(page.locator('[data-media-preview]')).toHaveAttribute('src', '/public/cpanel/images/login/ashgabat.jpg');
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'idle');
  expect(await page.locator('[data-media-uploader]').evaluate(e => (e as any).mediaUploader.cacheToken)).toBeNull();
  await page.reload();
  await page.route('**/cpanel/media/upload', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'MEDIA_UPLOAD_FAILED' } }) }));
  await page.locator('[data-upload-input]').setInputFiles({ name: 'retry.dat', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'error');
  await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#basic > [role="status"]')).toBeHidden();
  await page.unroute('**/cpanel/media/upload'); await page.locator('[data-upload-retry]').click();
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'uploaded');
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-bs-theme') !== theme) await page.locator('#theme-toggle').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/media-${theme}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/media-mobile.png', fullPage: true, animations: 'disabled' });
  const after = (await pool.query('SELECT to_jsonb(u) profile, to_jsonb(a) auth FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1', [authUser.id])).rows[0];
  expect(after).toEqual(before);
  await expect(page.locator('[data-navigation-id="media"]')).toHaveAttribute('data-availability', 'enabled');
});

test('reselection during pending Save uses only the latest token; cancellation clears in-flight selection', async ({ page, context, authUser, baseURL }) => {
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('profile-form');
    if (!form) return;
    const uploader = (document.querySelector('[data-media-uploader]') as any).mediaUploader;
    const callback = (window as any).HormatMediaUploader.createSaveHandler([uploader], () => { const status = document.querySelector('#profile-status') as HTMLElement; status.textContent = 'Test callback completed'; status.hidden = false; }, document.querySelector('#basic [data-preview-action]'));
    form.addEventListener('submit', event => { event.stopImmediatePropagation(); void callback(event); }, true);
  }));
  await authenticate(context, authUser.id, baseURL!); await page.goto('/cpanel/profile');
  let releaseFirst!: () => void, firstStarted!: () => void, firstDone!: () => void;
  const gate = new Promise<void>(r => releaseFirst = r), started = new Promise<void>(r => firstStarted = r), done = new Promise<void>(r => firstDone = r);
  let count = 0;
  await page.route('**/cpanel/media/upload', async route => {
    const index = ++count;
    if (index === 1) { firstStarted(); await gate; }
    const token = index === 1 ? 'old-token' : 'new-token';
    try { await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, media: { cacheToken: token, url: `/media/cache/${token}.bin`, originalName: `${token}.bin`, mimeType: 'application/octet-stream', size: 1, width: null, height: null } }) }); }
    catch { /* The old request is deliberately aborted when a new selection supersedes it. */ }
    finally { if (index === 1) firstDone(); }
  });
  await page.locator('[data-upload-input]').setInputFiles({ name: 'slow.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('a') });
  await started;
  // Use the public reusable Save API, with a harmless callback recording tokens rather than a model route.
  await page.evaluate(() => {
    const uploader = (document.querySelector('[data-media-uploader]') as any).mediaUploader;
    (window as any).savedMedia = [];
    const save = (window as any).HormatMediaUploader.createSaveHandler([uploader], (tokens: unknown) => (window as any).savedMedia.push(tokens));
    void save(); void save();
  });
  await page.locator('[data-upload-input]').setInputFiles({ name: 'latest.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('b') });
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'uploaded');
  releaseFirst(); await done;
  expect(await page.evaluate(() => (window as any).savedMedia)).toEqual([['new-token']]);
  expect(await page.locator('[data-media-uploader]').evaluate(e => (e as any).mediaUploader.cacheToken)).toBe('new-token');
  await page.unroute('**/cpanel/media/upload');
  let releaseCancel!: () => void, cancelStarted!: () => void;
  const cancelGate = new Promise<void>(r => releaseCancel = r), cancelReady = new Promise<void>(r => cancelStarted = r);
  await page.route('**/cpanel/media/upload', async route => {
    cancelStarted(); await cancelGate; try { await route.abort(); } catch { /* already aborted by Remove */ }
  });
  await page.locator('[data-upload-input]').setInputFiles({ name: 'cancel.bin', mimeType: 'application/octet-stream', buffer: bytes }); await cancelReady;
  await page.locator('[data-upload-remove]').click(); releaseCancel();
  await expect(page.locator('[data-media-uploader]')).toHaveAttribute('data-upload-state', 'idle');
  expect(await page.locator('[data-media-uploader]').evaluate(e => ({ token: (e as any).mediaUploader.cacheToken, promise: (e as any).mediaUploader.uploadPromise }))).toEqual({ token: null, promise: null });
  await page.locator('#basic [data-preview-action]').click();
  await expect(page.locator('#basic > [role="status"]')).toBeVisible();
});

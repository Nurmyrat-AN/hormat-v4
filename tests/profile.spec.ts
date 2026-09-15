import { test, expect, signIn } from './auth-fixture.js';
import { pool } from '../src/database/pool.js';
import { mkdir } from 'node:fs/promises';

const snapshot = async (id: string) => (await pool.query('SELECT to_jsonb(u) AS profile, to_jsonb(a) AS auth FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1', [id])).rows[0];

test('profile: real current data, two tabs, translations, themes, mobile and Basic Information persistence', async ({ page, context, browser, authUser }) => {
  test.setTimeout(90000);
  expect((await page.request.get('/cpanel/profile', { maxRedirects: 0 })).status()).toBe(303);
  await pool.query("UPDATE cpanel_users SET phone='+993 61 123456', job='Profile reviewer' WHERE id=$1", [authUser.id]);
  const before = await snapshot(authUser.id);
  await signIn(page, authUser);
  await page.locator('#user-menu').click();
  await page.locator('.shell-user-dropdown a[href="/cpanel/profile"]').click();
  await expect(page).toHaveURL(/\/cpanel\/profile$/);
  await expect(page.locator('.profile-avatar')).toHaveText('AT');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const mutations: string[] = [];
  page.on('request', r => { if (r.url().includes('/cpanel/profile') && r.method() !== 'GET') mutations.push(r.method()); });
  const { rows } = await pool.query('SELECT language_code,translation_key,translation_value FROM interface_translations');
  await mkdir('artifacts', { recursive: true });
  for (const language of ['tm', 'ru', 'en']) {
    await Promise.all([page.waitForEvent('load'), page.locator('#shell-language').selectOption(language)]);
    await expect(page).toHaveURL(/\/cpanel\/profile$/);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    const corpus = await page.locator('body').textContent();
    for (const row of rows.filter(r => r.language_code === language && ((r.translation_key.startsWith('cpanel.profile.') && !['cpanel.profile.avatar.change','cpanel.profile.previewNotice','cpanel.profile.saved','cpanel.profile.invalidName','cpanel.profile.invalidPhone','cpanel.profile.avatarFailed','cpanel.profile.failure'].includes(r.translation_key)) || r.translation_key === 'cpanel.userMenu.profile'))) {
      expect(corpus).toContain(row.translation_value);
      expect(corpus).not.toContain(row.translation_key);
    }
    await expect(page.locator('[role="tab"]')).toHaveCount(2);
    await expect(page.locator('#basic-tab')).toHaveAttribute('aria-selected', 'true');
    for (const [field, value] of Object.entries({ name: authUser.name, phone: '+993 61 123456', job: 'Profile reviewer', email: authUser.email })) await expect(page.locator(`#profile-${field}`)).toHaveValue(value);
    await expect(page.locator('#profile-job')).not.toBeEditable();
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-bs-theme') !== theme) await page.locator('#theme-toggle').click();
      await page.locator('#basic-tab').click();
      await page.screenshot({ path: `artifacts/profile-${language}-${theme}-basic.png` });
      await page.locator('#password-tab').click();
      for (const field of ['current', 'new', 'confirm']) {
        const input = page.locator(`#profile-password-${field}`);
        await expect(input).toHaveAttribute('type', 'password');
        await input.fill('preview-only');
        const toggle = page.locator(`[aria-controls="profile-password-${field}"]`);
        await toggle.click(); await expect(input).toHaveAttribute('type', 'text');
        await toggle.click(); await expect(input).toHaveAttribute('type', 'password');
      }

      await page.screenshot({ path: `artifacts/profile-${language}-${theme}-password.png` });
    }
  }
  await page.reload();
  await expect(page.locator('#password-tab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#basic-tab').click();
  await page.goBack();
  await expect(page.locator('#password-tab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#basic-tab').click();
  await expect(page.locator('#profile-email')).not.toBeEditable();
  for (const field of ['name', 'phone']) await page.locator(`#profile-${field}`).fill('edited-preview');
  await page.locator('#basic .profile-action').click();
  await expect(page.locator('#basic > [role="status"]')).toBeVisible();

  expect(mutations).toEqual(['POST']);
  const saved = await snapshot(authUser.id);
  expect(saved.auth).toEqual(before.auth);
  expect(saved.profile.job).toBe(before.profile.job);
  await page.reload();
  await expect(page.locator('#profile-name')).toHaveValue('edited-preview');
  await expect(page.locator('#profile-email')).toHaveValue(authUser.email);
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `artifacts/profile-mobile-${width}.png`, fullPage: true });
    await page.locator('#password-tab').click();
    await expect(page.locator('#profile-password-confirm')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.locator('#basic-tab').click();
  }
  expect((await page.request.patch('/cpanel/profile')).status()).toBe(404);
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() });
  try {
    const noJsPage = await noJs.newPage(); await noJsPage.goto(page.url());
    await expect(noJsPage.locator('#basic .profile-action')).toBeDisabled();
    await expect(noJsPage.locator('#basic form')).toHaveCount(1);
  } finally { await noJs.close(); }
  expect(await snapshot(authUser.id)).toEqual(saved);
  await pool.query('UPDATE cpanel_users SET name=$1 WHERE id=$2', [authUser.name, authUser.id]);
  expect(errors).toEqual([]);
});

test('profile: ordinary authenticated user, avatar image and broken image fallback, logout', async ({ page, authUser }) => {
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1', [authUser.id]);
  await pool.query("UPDATE cpanel_users SET avatar_url='/public/cpanel/images/login/ashgabat.jpg' WHERE id=$1", [authUser.id]);
  await signIn(page, authUser);
  expect((await page.goto('/cpanel/profile'))?.status()).toBe(200);
  await expect(page.locator('.profile-avatar img')).toBeVisible();
  await expect.poll(() => page.locator('.profile-avatar img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await pool.query("UPDATE cpanel_users SET avatar_url='/public/missing-profile-avatar.jpg' WHERE id=$1", [authUser.id]);
  await page.reload();
  await expect(page.locator('.profile-avatar img')).toBeHidden();
  await expect(page.locator('.profile-avatar')).toHaveText('AT');
  await expect(page.locator('[data-navigation-id="users"]')).toHaveCount(0);
  expect(await page.evaluate(async()=> (await fetch('/cpanel/users')).status)).toBe(403);
  await page.locator('#user-menu').click();
  await page.locator('form[action="/cpanel/logout"] button').click();
  await expect(page).toHaveURL(/\/cpanel\/login$/);
});

import { test, expect, signIn } from './auth-fixture.js';
import { pool } from '../src/database/pool.js';
import { tokenHash } from '../src/cpanel/auth/sessions.js';

const cookieName = process.env.TEST_PRODUCTION === '1' ? '__Secure-hormat_cpanel' : 'hormat_cpanel';
test('protected CPanel, real normalized login, session rotation, logout and replay rejection', async ({ page, context, authUser }) => {
  await page.goto('/cpanel');
  await expect(page).toHaveURL(/\/cpanel\/login$/);
  const anonymous = (await context.cookies()).find(c => c.name === cookieName)!;
  await signIn(page, { ...authUser, email: authUser.email.toUpperCase() });
  await expect(page.locator('main')).toContainText(authUser.name);
  const session = (await context.cookies()).find(c => c.name === cookieName)!;
  expect(session.value).not.toBe(anonymous.value);
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe('Lax');
  expect(session.path).toBe('/cpanel');
  expect(session.secure).toBe(process.env.TEST_PRODUCTION === '1');
  expect(session.expires).toBeGreaterThan(Date.now() / 1000 + 7 * 3600);
  expect((await pool.query('SELECT user_id FROM cpanel_sessions WHERE token_hash=$1', [tokenHash(session.value)])).rows[0].user_id).toBe(authUser.id);
  expect(await page.locator('body').innerText()).not.toContain('$argon2');
  expect(await page.evaluate(() => document.cookie)).not.toContain(session.value);
  await page.goto('/cpanel/login');
  await expect(page).toHaveURL(/\/cpanel$/);
  await page.locator('#user-menu').click();
  await page.locator('form[action="/cpanel/logout"] button').click();
  await expect(page).toHaveURL(/\/cpanel\/login$/);
  expect((await pool.query('SELECT 1 FROM cpanel_sessions WHERE token_hash=$1', [tokenHash(session.value)])).rowCount).toBe(0);
  await context.addCookies([{ ...session, expires: Date.now() / 1000 + 1000 }]);
  await page.goto('/cpanel');
  await expect(page).toHaveURL(/\/cpanel\/login$/);
});

for (const [lang, message] of Object.entries({ tm: 'E-poçta ýa-da parol nädogry.', ru: 'Неверный email или пароль.', en: 'Invalid email or password.' })) {
  test(`generic invalid email/password errors in ${lang}`, async ({ page, context, baseURL, authUser }) => {
    await context.addCookies([{ name: 'hormat_lang', value: lang, url: baseURL! }]);
    for (const email of ['missing@example.invalid', authUser.email]) {
      await page.goto('/cpanel/login');
      await page.locator('#login-email').fill(email);
      await page.locator('#login-password').fill('invalid');
      const response = page.waitForResponse(r => r.url().endsWith('/cpanel/login') && r.request().method() === 'POST');
      await page.locator('#login-submit').click();
      expect((await response).status()).toBe(401);
      await expect(page.getByRole('status')).toHaveText(message);
      await expect(page.locator('#login-password')).toHaveValue('');
      expect(await page.locator('body').innerText()).not.toMatch(/cpanel\.auth\.|\$argon2/);
    }
  });
}

test('CSRF rejects missing, invalid and multibyte tokens; logout needs a valid token', async ({ page, authUser }) => {
  await page.goto('/cpanel/login');
  for (const token of ['', 'x'.repeat(64), 'я'.repeat(64)]) {
    const result = await page.evaluate(async token => (await fetch('/cpanel/login', { method: 'POST', body: new URLSearchParams({ _csrf: token, email: 'ignored', password: 'ignored' }) })).status, token);
    expect(result).toBe(403);
  }
  await signIn(page, authUser);
  expect(await page.evaluate(async () => (await fetch('/cpanel/logout', { method: 'POST' })).status)).toBe(403);
  await page.goto('/cpanel');
  await expect(page).toHaveURL(/\/cpanel$/);
});

test('expired sessions cannot access CPanel', async ({ page, context, authUser }) => {
  await signIn(page, authUser);
  const token = (await context.cookies()).find(c => c.name === cookieName)!.value;
  await pool.query("UPDATE cpanel_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash(token)]);
  await page.goto('/cpanel');
  await expect(page).toHaveURL(/\/cpanel\/login$/);
});

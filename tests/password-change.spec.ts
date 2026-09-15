import { test, expect, signIn } from './auth-fixture.js';
import { pool } from '../src/database/pool.js';
import { bootstrapSuperuser } from '../src/cpanel/auth/bootstrap.js';
import { randomUUID } from 'node:crypto';

for (const language of ['tm', 'ru', 'en']) test(`password change ${language}: server validation, CSRF, cleared fields, success and basic profile saves independently`, async ({ page, context, baseURL }) => {
  const account = { name: 'Password browser', email: `${randomUUID()}@example.invalid`, password: 'Original browser password 123' };
  const { id } = await bootstrapSuperuser(account);
  try {
    await context.addCookies([{ name: 'hormat_lang', value: language, url: baseURL! }]);
    const target = '/cpanel/profile/password';
    expect((await page.request.post(target, { maxRedirects: 0 })).status()).toBe(303);
    await signIn(page, { ...account, id }); await page.goto('/cpanel/profile#password');
    const csrf = await page.locator('#password-form [name="_csrf"]').inputValue();
    // APIRequestContext does not apply Chromium's trusted-loopback Secure-cookie exception.
    const cookie = (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
    const post = (options: Parameters<typeof page.request.post>[1]) => page.request.post(target, { ...options, headers: { Cookie: cookie }, maxRedirects: 0 });

    expect((await post({ form: { currentPassword: account.password } })).status()).toBe(403);
    const { rows } = await pool.query("SELECT translation_key,translation_value FROM interface_translations WHERE language_code=$1 AND translation_key LIKE 'cpanel.password.%'", [language]);
    const value = (key: string) => rows.find(r => r.translation_key === 'cpanel.password.'+key).translation_value;
    const form = { _csrf: csrf, currentPassword: account.password, newPassword: 'New browser password 456', confirmPassword: 'New browser password 456' };
    for (const [override, key] of [[{ currentPassword: '' }, 'required'], [{ currentPassword: 'incorrect' }, 'incorrect'], [{ newPassword: 'short', confirmPassword: 'short' }, 'policy'], [{ confirmPassword: 'different' }, 'mismatch'], [{ newPassword: account.password, confirmPassword: account.password }, 'same']] as const) {
      const response = await post({ form: { ...form, ...override } });
      expect(response.status()).toBe(400);
      const html = await response.text(); expect(html).toContain(value(key));
      expect(html).not.toContain(account.password); expect(html).not.toContain(form.newPassword); expect(html).not.toContain('$argon2');
    }
    expect((await post({ form: { ...form, user_id: '1' } })).status()).toBe(400);
    await page.locator('#profile-password-current').fill('incorrect');
    await page.locator('#profile-password-new').fill(form.newPassword);
    await page.locator('#profile-password-confirm').fill(form.confirmPassword);
    await page.locator('#password-submit').click();
    await expect(page.locator('#password-status')).toHaveText(value('incorrect'));
    await expect(page.locator('#password-tab')).toHaveAttribute('aria-selected', 'true');
    for (const field of ['current', 'new', 'confirm']) await expect(page.locator(`#profile-password-${field}`)).toHaveValue('');
    await page.locator('#profile-password-current').fill(account.password);
    await page.locator('#profile-password-new').fill(form.newPassword);
    await page.locator('#profile-password-confirm').fill(form.confirmPassword);
    await page.locator('#password-submit').click();
    await expect(page.locator('#password-status')).toHaveText(value('success'));
    await expect(page).toHaveURL(/\/cpanel\/profile#password$/);
    for (const field of ['current', 'new', 'confirm']) await expect(page.locator(`#profile-password-${field}`)).toHaveValue('');
    expect((await page.request.get('/cpanel', { maxRedirects: 0, headers: { Cookie: cookie } })).status()).toBe(200);
    await page.locator('#basic-tab').click(); await page.locator('#profile-name').fill('Updated profile'); await page.locator('#basic .profile-action').click();
    await expect(page.locator('#profile-name')).toHaveValue('Updated profile');
    await expect.poll(async () => (await pool.query('SELECT name FROM cpanel_users WHERE id=$1', [id])).rows[0].name).toBe('Updated profile');
    // Ten account-scoped attempts per 15 minutes, even if a new browser session is used.
    await post({ form: { ...form, currentPassword: 'incorrect' } });
    await post({ form: { ...form, currentPassword: 'incorrect' } });
    const limited = await post({ form });
    expect(limited.status()).toBe(429); expect(await limited.text()).toContain(value('limited'));
  } finally { await pool.query('DELETE FROM cpanel_users WHERE id=$1', [id]); }
});

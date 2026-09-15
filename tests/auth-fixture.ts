import { test as base, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { bootstrapSuperuser } from '../src/cpanel/auth/bootstrap.js';
import { pool } from '../src/database/pool.js';

export interface TestUser { id: string; name: string; email: string; password: string }
export const test = base.extend<{}, { authUser: TestUser }>({
  authUser: [async ({}, use) => {
    const user = { name: 'Authentication test', email: `test-${randomBytes(12).toString('hex')}@example.invalid`, password: randomBytes(24).toString('hex') };
    const { id } = await bootstrapSuperuser(user);
    try { await use({ ...user, id }); }
    finally { await pool.query('DELETE FROM cpanel_users WHERE id=$1', [id]); await pool.end(); }
  }, { scope: 'worker' }],
});
export { expect };
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto('/cpanel/login');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.password);
  await page.locator('#login-submit').click();
  await expect(page).toHaveURL(/\/cpanel$/);
}

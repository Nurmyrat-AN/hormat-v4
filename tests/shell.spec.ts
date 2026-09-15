import { test, expect, signIn } from './auth-fixture.js';
import { mkdir } from 'node:fs/promises';
import { pool } from '../src/database/pool.js';

async function shot(page: import('@playwright/test').Page, name: string) {
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: `artifacts/shell-${name}.png`, fullPage: true });
}

test('desktop shell: real profile, active nested navigation, collapse, pin, preview and persistence', async ({ page, authUser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, authUser);
  await expect(page.locator('.topbar-user-name')).toHaveText(authUser.name);
  await expect(page.locator('.shell-avatar')).toHaveText('AT');
  await expect(page.locator('a[aria-current="page"]')).toHaveAttribute('href', '/cpanel');
  await expect(page.locator('[aria-controls="nav-shopping"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.shell-sidebar')).toHaveCSS('width', '264px');
  await expect(page.locator('.shell-workspace')).toHaveCSS('margin-left', '264px');
  await shot(page, 'desktop-light');
  await page.locator('[aria-controls="nav-shopping"]').click();
  await expect(page.locator('#nav-shopping')).toHaveClass(/(?:^|\s)show(?:\s|$)/);
  await page.locator('[aria-controls="nav-shopping"]').click();
  await expect(page.locator('#nav-shopping')).not.toBeVisible();
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('.shell-workspace')).toHaveCSS('margin-left', '80px');
  await expect(page.locator('.shell-sidebar')).toHaveCSS('width', '80px');
  await expect(page.locator('[aria-controls="nav-shopping"]')).toHaveAttribute('title', /.+/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
  await page.locator('[aria-controls="nav-shopping"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'expanded');
  await expect(page.locator('#nav-shopping')).toHaveClass(/(?:^|\s)show(?:\s|$)/);
  await page.locator('#sidebar-pin').click();
  await expect(page.locator('#sidebar-pin')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#sidebar-toggle').click();
  await page.locator('.shell-main').hover();
  await page.locator('.shell-brand').hover();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-preview', 'true');
  await expect(page.locator('.shell-workspace')).toHaveCSS('margin-left', '80px');
  await page.locator('.shell-main').hover();
  await expect(page.locator('.shell-sidebar')).toHaveCSS('width', '80px');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-pinned', 'false');
  await page.locator('.shell-brand').focus();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-preview', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar-toggle')).toBeFocused();
  await page.locator('#sidebar-pin').click();
  await expect(page.locator('html')).toHaveAttribute('data-pinned', 'true');
});

test('themes persist before styles load, user menu job/fallback, localized shell and secure logout', async ({ page, context, baseURL, authUser }) => {
  await pool.query('UPDATE cpanel_users SET job=$2,avatar_url=$3 WHERE id=$1', [authUser.id, 'Layout reviewer', null]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, authUser);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 23, 31)');
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('link[rel="stylesheet"]') && !(window as any).themeAtStyles) (window as any).themeAtStyles = document.documentElement.dataset.bsTheme;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as any).themeAtStyles)).toBe('dark');
  await page.locator('#user-menu').click();
  await expect(page.locator('.user-summary')).toContainText('Layout reviewer');
  await shot(page, 'desktop-dark-user');
  await page.locator('#user-menu').click();
  for (const [lang, heading] of Object.entries({ tm: 'Dolandyryş paneli', ru: 'Панель управления', en: 'CPanel' })) {
    await Promise.all([page.waitForEvent('load'), page.locator('#shell-language').selectOption(lang)]);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    expect((await context.cookies()).find(c => c.name === 'hormat_lang')?.value).toBe(lang);
    expect(await page.locator('body').textContent()).not.toMatch(/cpanel\.shell\.|cpanel\.auth\./);
    await shot(page, `${lang}-dark`);
  }
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await page.locator('#user-menu').click();
  await page.locator('form[action="/cpanel/logout"] button').click();
  await expect(page).toHaveURL(`${baseURL}/cpanel/login`);
  await expect(page.locator('.shell-topbar')).toHaveCount(0);
  await expect(page.locator('link[href="/public/cpanel/css/shell.css"]')).toHaveCount(0);
});

for (const width of [375, 768]) {
  test(`responsive shell ${width}: offcanvas, backdrop, keyboard and full content width`, async ({ page, authUser }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, authUser);
    await expect(page.locator('.shell-workspace')).toHaveCSS('margin-left', '0px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator('#shell-language')).toBeVisible();
    await expect(page.locator('#theme-toggle')).toBeVisible();
    await page.locator('#sidebar-toggle').click();
    await expect(page.locator('#cpanel-sidebar')).toHaveClass(/(?:^|\s)show(?:\s|$)/);
    await expect(page.locator('.offcanvas-backdrop')).toBeVisible();
    await shot(page, `${width}-menu`);
    await page.keyboard.press('Escape');
    await expect(page.locator('#cpanel-sidebar')).not.toHaveClass(/(?:^|\s)show(?:\s|$)/);
    await page.locator('#sidebar-toggle').click();
    await page.locator('.offcanvas-backdrop').click({ position: { x: width - 10, y: 400 } });
    await expect(page.locator('#cpanel-sidebar')).not.toHaveClass(/(?:^|\s)show(?:\s|$)/);
    await page.locator('#sidebar-toggle').click();
    await page.locator('.shell-brand').click();
    await expect(page.locator('#cpanel-sidebar')).not.toHaveClass(/(?:^|\s)show(?:\s|$)/);
    await shot(page, `${width}-content`);
  });
}

test('blocked browser storage and invalid avatar do not break the shell', async ({ page, authUser }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Blocked'); };
    Storage.prototype.setItem = () => { throw new Error('Blocked'); };
  });
  await pool.query('UPDATE cpanel_users SET avatar_url=$2 WHERE id=$1', [authUser.id, 'javascript:alert(1)']);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await signIn(page, authUser);
    await expect(page.locator('.shell-avatar img')).toHaveCount(0);
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
    await page.locator('#sidebar-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    expect(errors).toEqual([]);
  } finally { await pool.query('UPDATE cpanel_users SET avatar_url=NULL WHERE id=$1', [authUser.id]); }
});

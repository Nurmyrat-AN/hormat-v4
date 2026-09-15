import { test, expect, signIn } from './auth-fixture.js';
import { pool } from '../src/database/pool.js';
import { mkdir } from 'node:fs/promises';
import { navigationRoadmap, type NavigationItem } from '../src/cpanel/shell/navigation.js';

test('full roadmap: all languages, themes, disabled behavior, icons, collapsed rail and mobile scroll', async ({ page, authUser }) => {
  test.setTimeout(90000);
  await signIn(page, authUser);
  const items: NavigationItem[] = [];
  const visit = (i: NavigationItem) => { items.push(i); if (i.kind === 'submenu') i.children.forEach(visit); };
  navigationRoadmap.forEach(g => g.items.forEach(visit));
  const { rows } = await pool.query('SELECT language_code,translation_key,translation_value FROM interface_translations');
  await mkdir('artifacts', { recursive: true });
  for (const lang of ['tm','ru','en']) {
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('#shell-language').selectOption(lang),
    ]);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const value = (key: string) => rows.find(r => r.language_code === lang && r.translation_key === key).translation_value;
    for (const group of navigationRoadmap) await expect(page.locator('.sidebar-group-label').filter({ hasText: value(group.translationKey) })).toHaveCount(1);
    for (const item of items) {
      const entry = page.locator(`[data-navigation-id="${item.id}"]`).locator(':scope > .shell-nav-link');
      await expect(entry.locator(':scope > .sidebar-label').first()).toHaveText(value(item.translationKey));
      if (item.kind === 'page' && item.status === 'disabled') {
        await expect(entry).toHaveAttribute('aria-disabled', 'true');
        await expect(entry).not.toHaveAttribute('href');
        await expect(entry).toHaveAttribute('title', `${value(item.translationKey)} — ${value('cpanel.navigation.notAvailable')}`);
      }
    }
    for (const id of ['shopping','access','localization']) {
      await page.locator(`[aria-controls="nav-${id}"]`).click();
      await expect(page.locator(`#nav-${id}`)).toHaveClass(/(?:^|\s)show(?:\s|$)/);
    }
    for (const theme of ['light','dark']) {
      if (await page.locator('html').getAttribute('data-bs-theme') !== theme) await page.locator('#theme-toggle').click();
      const before = page.url();
      for (const id of ['dashboard','products','carts','interfaceTranslations','systemEvents']) {
        const entry = page.locator(`[data-navigation-id="${id}"] > .shell-nav-link`);
        await entry.scrollIntoViewIfNeeded();
        await expect(entry).toBeVisible();
        await entry.click({ force: true }); await entry.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
        expect(page.url()).toBe(before);
      }
      await page.locator('.sidebar-navigation').evaluate(e => e.scrollTop = 0);
      await page.screenshot({ path: `artifacts/roadmap-${lang}-${theme}.png`, fullPage: true });
    }
    await page.locator('#sidebar-toggle').click();
    await expect(page.locator('.shell-workspace')).toHaveCSS('margin-left', '80px');
    await expect(page.locator('[data-navigation-id="products"] > span')).toHaveAttribute('title', `${value('cpanel.navigation.products')} — ${value('cpanel.navigation.notAvailable')}`);
    await page.locator('[aria-controls="nav-access"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'expanded');
    await expect(page.locator('#nav-access')).toBeVisible();
    expect(await page.locator('.sidebar-navigation').textContent()).not.toContain('cpanel.navigation.');
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#sidebar-toggle').click();
  await expect(page.locator('#cpanel-sidebar')).toHaveClass(/(?:^|\s)show(?:\s|$)/);
  await page.locator('[data-navigation-id="systemEvents"] > span').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-navigation-id="systemEvents"] > span')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: 'artifacts/roadmap-mobile-system.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#cpanel-sidebar')).not.toHaveClass(/(?:^|\s)show(?:\s|$)/);
  // Unimplemented roadmap entries do not create endpoints. Permissions now has an explicitly authorized UI route, but remains disabled in navigation.
  for (const route of ['/cpanel/products','/cpanel/orders']) expect((await page.request.get(route)).status()).toBe(404);
});

import { test, expect, signIn } from './auth-fixture.js';

// Preserve the original English foundation assertions while the default is now tm.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'hormat_lang', value: 'en', url: baseURL! }]);
});

for (const [route, title, area] of [['/', 'Frontend', 'frontend'], ['/cpanel', 'CPanel', 'cpanel']]) {
  test(`${title}: EJS, assets, Bootstrap, jQuery and Socket.IO`, async ({ page, request, authUser }) => {
    if (route === '/cpanel') await signIn(page, authUser);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => errors.push(`Failed request: ${request.url()}`));
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    for (const asset of [
      '/public/vendor/bootstrap.min.css', '/public/vendor/bootstrap.bundle.min.js',
      '/public/vendor/jquery.min.js', '/socket.io/socket.io.js',
      `/public/${area}/css/app.css`, `/public/${area}/js/app.js`,
    ]) {
      expect((await request.get(asset)).status(), asset).toBe(200);
      expect(await page.locator(`[src="${asset}"], [href="${asset}"]`).count()).toBe(1);
    }
    await expect(page.locator('main')).toHaveCSS('padding-top', '24px');
    expect(await page.evaluate(() => (window as any).jQuery('h1').text())).toBe(title);
    // Exercise Bootstrap's actual behavior without adding foundation UI.
    expect(await page.evaluate(async () => {
      const element = document.createElement('div');
      element.className = 'collapse';
      document.body.append(element);
      const collapse = new (window as any).bootstrap.Collapse(element, { toggle: false });
      const shown = new Promise<void>(resolve => element.addEventListener('shown.bs.collapse', () => resolve(), { once: true }));
      collapse.show();
      const started = element.classList.contains('collapsing');
      await shown;
      collapse.dispose();
      element.remove();
      return started;
    })).toBe(true);
    await expect.poll(() => page.evaluate((area) => Boolean((window as any)[`${area}Socket`]?.connected), area)).toBe(true);
    await page.evaluate((area) => (window as any)[`${area}Socket`].disconnect(), area);
    await expect.poll(() => page.evaluate((area) => Boolean((window as any)[`${area}Socket`]?.connected), area)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('technical health verifies PostgreSQL', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', database: 'connected' });
});

test('unknown routes return 404', async ({ request }) => {
  for (const route of ['/missing', '/cpanel/missing']) {
    const response = await request.get(route, { headers: { Cookie: 'hormat_lang=en' } });
    expect(response.status()).toBe(404);
    expect(await response.text()).toBe('Not Found');
  }
});

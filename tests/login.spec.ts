import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const titles = { tm: 'Dolandyryş paneline giriş', ru: 'Вход в панель управления', en: 'Sign in to the control panel' };
for (const [language, title] of Object.entries(titles)) {
  test(`login desktop ${language}: localized layout, assets and socket connection`, async ({ page, context, baseURL, request }) => {
    await page.setViewportSize({ width: 1536, height: 1024 });
    await context.addCookies([{ name: 'hormat_lang', value: language, url: baseURL! }]);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => errors.push(request.url()));
    const response = await page.goto('/cpanel/login');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('h1')).toHaveText(title);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    expect(await page.locator('body').innerText()).not.toMatch(/cpanel\.login\.|brand\./);
    const left = (await page.locator('.login-promo').boundingBox())!;
    const right = (await page.locator('.login-panel').boundingBox())!;
    // Preserve the current fixed-width form panel, independently of localization.
    expect(right.width).toBe(450);
    expect(left.width).toBe(1536 - 450);
    expect(left.height).toBe(1024);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1536);
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#login-submit')).toBeEnabled();
    expect(await page.evaluate(() => typeof (window as any).jQuery)).toBe('function');
    expect(await page.evaluate(() => typeof (window as any).bootstrap.Collapse)).toBe('function');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).cpanelSocket?.connected))).toBe(true);
    for (const asset of ['css/login.css', 'js/login.js', 'images/login/ashgabat.jpg', 'images/login/icons.svg']) {
      expect((await request.get(`/public/cpanel/${asset}`)).status()).toBe(200);
    }
    await page.evaluate(async () => {
      const image = new Image(); image.src = '/public/cpanel/images/login/ashgabat.jpg'; await image.decode();
    });
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: `artifacts/login-${language}-desktop.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('login: language selector, password toggle, localized validation and real invalid submission', async ({ page, context }) => {
  const submissions: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/cpanel/login') && request.method() === 'POST') submissions.push(request.url()); });
  await page.goto('/cpanel/login');
  for (const language of ['ru', 'en', 'tm', 'en'] as const) {
    await Promise.all([page.waitForURL('**/cpanel/login', { waitUntil: 'load' }), page.locator('#login-language').selectOption(language)]);
    await expect(page.locator('h1')).toHaveText(titles[language]);
    expect((await context.cookies()).find((cookie) => cookie.name === 'hormat_lang')?.value).toBe(language);
  }
  await page.locator('#login-submit').click();
  await expect(page.locator('#email-error')).toHaveText('Enter your email address.');
  await expect(page.locator('#password-error')).toHaveText('Enter your password.');
  await page.locator('#login-email').fill('not-an-email');
  await page.locator('#login-submit').click();
  await expect(page.locator('#email-error')).toHaveText('Enter a valid email address.');
  await page.locator('#login-email').fill('ui-test@example.invalid');
  await page.locator('#login-password').fill('test-only-value');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  await expect(page.locator('#password-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  await page.locator('#login-submit').click();
  await expect(page.getByRole('status')).toHaveText('Invalid email or password.');
  await expect(page.locator('#login-password')).toHaveValue('');
  expect(submissions).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(await page.locator('#login-form input[name]').count()).toBe(3);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 320, height: 568 }, { width: 1366, height: 768 }]) {
  test(`login responsive ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/cpanel/login');
    await expect(page.locator('#login-language')).toBeVisible();
    await expect(page.locator('#login-submit')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    if (viewport.width <= 900) await expect(page.locator('.login-promo')).toBeHidden();
    const field = (await page.locator('#login-email').boundingBox())!;
    expect(field.width).toBeGreaterThanOrEqual(280);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: `artifacts/login-${viewport.width}.png`, fullPage: true });
  });
}

test('login without JavaScript: language form still works, credential submission works', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/cpanel/login`);
  await expect(page.locator('#login-submit')).toBeEnabled();
  await page.locator('#login-language').selectOption('en');
  await page.locator('.language-apply').click();
  await expect(page.locator('h1')).toHaveText(titles.en);
  await page.locator('#login-email').fill('missing@example.invalid');
  await page.locator('#login-password').fill('invalid');
  await page.locator('#login-submit').click();
  await expect(page.getByRole('status')).toHaveText('Invalid email or password.');
  await context.close();
});

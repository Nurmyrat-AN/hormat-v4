import { test, expect, signIn } from './auth-fixture.js';

const titles = {
  tm: ['Baş sahypa', 'Dolandyryş paneli'],
  ru: ['Главная страница', 'Панель управления'],
  en: ['Frontend', 'CPanel'],
};
for (const [language, values] of Object.entries(titles)) {
  test(`${language} cookie localizes both pages and keeps sockets connected`, async ({ page, context, baseURL, authUser }) => {
    await signIn(page, authUser);
    await context.addCookies([{ name: 'hormat_lang', value: language, url: baseURL! }]);
    for (const [index, route] of ['/', '/cpanel'].entries()) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-language']).toBe(language);
      expect(response?.headers().vary).toContain('Cookie');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page).toHaveTitle(values[index]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(values[index]);
      await expect.poll(() => page.evaluate((area) => Boolean((window as any)[`${area}Socket`]?.connected), index ? 'cpanel' : 'frontend')).toBe(true);
    }
  });
}

test('missing, unknown and malformed cookies select the default language', async ({ request }) => {
  for (const cookie of ['', 'hormat_lang=unknown', 'hormat_lang=%XX', 'hormat_lang=__proto__']) {
    for (const route of ['/', '/cpanel']) {
      const response = await request.get(route, { headers: { Cookie: cookie } });
      expect(response.status()).toBe(200);
      expect(response.headers()['content-language']).toBe('tm');
      expect(await response.text()).toContain(route === '/' ? titles.tm[0] : 'Dolandyryş paneline giriş');
    }
  }
});

test('switch route sets a shared persistent cookie and browser follows it across areas', async ({ page, context, authUser }) => {
  await signIn(page, authUser);
  await page.goto('/');
  const switched = await page.evaluate(async () => {
    const response = await fetch('/language', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ language: 'ru', returnTo: '/cpanel' }),
    });
    return { status: response.status, url: response.url };
  });
  expect(switched.status).toBe(200);
  expect(switched.url).toMatch(/\/cpanel$/);
  const cookie = (await context.cookies()).find((cookie) => cookie.name === 'hormat_lang')!;
  expect(cookie.path).toBe('/');
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.secure).toBe(process.env.TEST_PRODUCTION === '1');
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
  for (const [index, route] of ['/', '/cpanel'].entries()) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titles.ru[index]);
  }
});

test('switch route validates input and limits redirects to current local pages', async ({ request }) => {
  for (const language of ['unknown', '', '__proto__']) {
    const response = await request.post('/language', { form: { language }, maxRedirects: 0 });
    expect(response.status()).toBe(400);
    expect(response.headers()['set-cookie']).toBeUndefined();
  }
  for (const destination of ['https://evil.example', '//evil.example', '/\\evil.example', '/missing', '/cpanel']) {
    const response = await request.post('/language', { form: { language: 'en', returnTo: destination }, maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(destination === '/cpanel' ? '/cpanel' : '/');
    expect(response.headers()['set-cookie']).toContain('hormat_lang=en');
  }
  const bad = await request.post('/language', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'hormat_lang=en' },
    data: 'language=ru&language=en', maxRedirects: 0,
  });
  expect(bad.status()).toBe(400);
  expect(await bad.text()).toBe('Selected language is unavailable');
  const oversized = await request.post('/language', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'hormat_lang=en' },
    data: `language=en&returnTo=${'x'.repeat(3000)}`, maxRedirects: 0,
  });
  expect(oversized.status()).toBe(413);
  expect(await oversized.text()).toBe('Invalid request');
});

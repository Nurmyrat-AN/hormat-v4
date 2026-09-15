import { test, expect } from '@playwright/test';

test('login attempts are bounded before password work and return a localized retry response', async ({ request }) => {
  let limited = false;
  for (let attempt = 0; attempt < 31; attempt++) {
    const response = await request.post('/cpanel/login', { headers: { Cookie: 'hormat_lang=en' }, form: {} });
    if (response.status() === 429) {
      expect(await response.text()).toBe('Too many sign-in attempts. Try again later.');
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
      limited = true;
      break;
    }
    expect(response.status()).toBe(403);
  }
  expect(limited).toBe(true);
});

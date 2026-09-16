import { Router, urlencoded, type RequestHandler } from 'express';
import { config } from '../config/env.js';
import { localization } from './index.js';

export const languageCookie = 'hormat_lang';

export function readLanguageCookie(header?: string): string | undefined {
  const entry = header?.split(';').find((part) => part.trim().startsWith(`${languageCookie}=`));
  if (!entry) return undefined;
  try { return decodeURIComponent(entry.trim().slice(languageCookie.length + 1)); }
  catch { return undefined; }
}

export const localizationMiddleware: RequestHandler = async (request, response, next) => {
  // Retain translated error handling if a required reload fails; do not serve stale registry pages.
  Object.assign(response.locals, localization.forLanguage(readLanguageCookie(request.headers.cookie)));
  await localization.ensureFresh();
  Object.assign(response.locals, localization.forLanguage(readLanguageCookie(request.headers.cookie)));
  response.vary('Cookie');
  response.set('Content-Language', response.locals.language);
  next();
};

export const languageRouter = Router();
languageRouter.post('/', urlencoded({ extended: false, limit: '2kb' }), (request, response) => {
  const language: unknown = request.body?.language;
  if (typeof language !== 'string' || !localization.isActive(language)) {
    response.status(400).type('text').send(response.locals.t('errors.invalidLanguage'));
    return;
  }
  response.cookie(languageCookie, language, {
    path: '/', sameSite: 'lax', httpOnly: true,
    secure: config.app.mode === 'production', maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  // Explicit local destinations only; never trust arbitrary URLs or Referer.
  const returnTo: unknown = request.body?.returnTo;
  const destination = returnTo === '/cpanel/order-statuses' || returnTo === '/cpanel/settings' || returnTo === '/cpanel/payment-types' || returnTo === '/cpanel/delivery-types' || returnTo === '/cpanel/interface-translations' || returnTo === '/cpanel/languages' || returnTo === '/cpanel/currencies/frontend' || returnTo === '/cpanel/currencies/vendors' || returnTo === '/cpanel/discounts' || returnTo === '/cpanel' || returnTo === '/cpanel/login' || returnTo === '/cpanel/profile' || returnTo === '/cpanel/categories' || returnTo === '/cpanel/source-products' || returnTo === '/cpanel/products' || returnTo === '/cpanel/brands' || returnTo === '/cpanel/vendors' || returnTo === '/cpanel/media' || returnTo === '/cpanel/users' || (typeof returnTo === 'string' && /^\/cpanel\/permissions(?:\/[1-9]\d{0,18})?$/.test(returnTo)) ? returnTo : '/';
  response.set('Cache-Control', 'no-store');
  response.redirect(303, destination);
});

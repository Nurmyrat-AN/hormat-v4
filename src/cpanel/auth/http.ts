import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response, CookieOptions } from 'express';
import { config } from '../../config/env.js';
import { authRepository, type CpanelUser } from './repository.js';
import { sessions, type CpanelSession } from './sessions.js';
import { PermissionContext } from './permissions.js';

declare global {
  namespace Express {
    interface Locals {
      cpanelUser?: CpanelUser;
      cpanelSession?: CpanelSession;
      permissions: PermissionContext;
    }
  }
}
export const sessionCookie = config.app.mode === 'production' ? '__Secure-hormat_cpanel' : 'hormat_cpanel';
const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.app.mode === 'production', path: '/cpanel' };
export function setSessionCookie(response: Response, token: string, session: CpanelSession): void {
  response.cookie(sessionCookie, token, { ...cookieOptions, expires: session.expires_at });
}
export function clearSessionCookie(response: Response): void { response.clearCookie(sessionCookie, cookieOptions); }
export const loadCpanelAuth: RequestHandler = async (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  // CPanel pages must not be framed; no shared/public response caching.
  response.set('X-Frame-Options', 'DENY');
  const cookies = (request.headers.cookie ?? '').split(';').map(part => part.trim());
  const candidates = cookies.filter(part => part.startsWith(`${sessionCookie}=`));
  const token = candidates.length === 1 ? candidates[0].slice(sessionCookie.length + 1) : '';
  const session = await sessions.find(token);
  if (session) {
    response.locals.cpanelSession = session;
    if (session.user_id) response.locals.cpanelUser = await authRepository.user(session.user_id);
  }
  response.locals.permissions = new PermissionContext(response.locals.cpanelUser?.id);
  next();
};
export const requireCpanelAuth: RequestHandler = (_request, response, next) => {
  if (!response.locals.cpanelUser) { response.redirect(303, '/cpanel/login'); return; }
  next();
};
export const requireCsrf: RequestHandler = (request, response, next) => {
  const expected = response.locals.cpanelSession?.csrf_token;
  const submitted = request.get('X-CSRF-Token') ?? request.body?._csrf;
  if (typeof submitted !== 'string' || !/^[a-f0-9]{64}$/.test(submitted) || !expected || submitted.length !== expected.length ||
      !timingSafeEqual(Buffer.from(submitted), Buffer.from(expected))) {
    response.status(403).type('text').send(response.locals.t('cpanel.auth.invalidRequest')); return;
  }
  next();
};
export function requirePermission(key: string): RequestHandler {
  return async (_request, response, next) => {
    if (!await response.locals.permissions.hasPermission(key)) {
      response.status(403).type('text').send(response.locals.t('cpanel.auth.forbidden')); return;
    }
    next();
  };
}

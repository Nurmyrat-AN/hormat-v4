import type { RequestHandler } from 'express';
import { sessions } from '../../cpanel/auth/sessions.js';
import { setSessionCookie, clearSessionCookie } from '../../cpanel/auth/http.js';
import { authenticate } from '../../cpanel/auth/service.js';

export const login: RequestHandler = async (_request, response) => {
  if (response.locals.cpanelUser) { response.redirect(303, '/cpanel'); return; }
  if (!response.locals.cpanelSession) {
    const { token, session } = await sessions.create();
    setSessionCookie(response, token, session);
    response.locals.cpanelSession = session;
  }
  response.render('cpanel/pages/login', { year: new Date().getUTCFullYear(), loginError: false });
};
export const submitLogin: RequestHandler = async (request, response) => {
  if (response.locals.cpanelUser) { response.redirect(303, '/cpanel'); return; }
  const credentials = await authenticate(request.body?.email, request.body?.password);
  // Never pass credentials or request bodies to a template or logger.
  delete request.body.password;
  if (!credentials) {
    response.status(401).render('cpanel/pages/login', { year: new Date().getUTCFullYear(), loginError: true }); return;
  }
  try {
    const { token, session } = await sessions.create(credentials.user_id, response.locals.cpanelSession!.token_hash, credentials.password_hash);
    setSessionCookie(response, token, session);
  } catch {
    response.status(401).render('cpanel/pages/login', { year: new Date().getUTCFullYear(), loginError: true }); return;
  }
  response.redirect(303, '/cpanel');
};
export const logout: RequestHandler = async (_request, response) => {
  if (response.locals.cpanelSession) await sessions.destroy(response.locals.cpanelSession.token_hash);
  clearSessionCookie(response);
  response.redirect(303, '/cpanel/login');
};

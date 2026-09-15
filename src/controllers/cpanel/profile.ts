import { updateProfile } from '../../cpanel/profile/service.js';
import { changePassword } from '../../cpanel/auth/password-change.js';
import type { RequestHandler, Response } from 'express';
import { authRepository } from '../../cpanel/auth/repository.js';

async function renderProfile(response: Response, passwordResult: string | null = null, passwordMessage = '', profileSaved = false) {
  const user = response.locals.cpanelUser!;
  response.render('cpanel/pages/profile', { passwordResult, passwordMessage, profileSaved, profile: { name: user.name, phone: user.phone ?? '', job: user.job ?? '', email: await authRepository.email(user.id) } });
}
export const profile: RequestHandler = async (request, response) => { await renderProfile(response, null, '', request.query.updated === '1'); };
export const passwordLimited: RequestHandler = async (_request, response) => {
  response.status(429); await renderProfile(response, 'error', response.locals.t('cpanel.password.limited'));
};
export const submitPassword: RequestHandler = async (request, response) => {
  const input = request.body;
  request.body = undefined; // No submitted password is ever passed to rendering or logging.
  const t = response.locals.t;
  try {
    if (!input || Object.keys(input).some(key => !['_csrf', 'currentPassword', 'newPassword', 'confirmPassword'].includes(key))) {
      response.status(400); await renderProfile(response, 'error', t('errors.invalidRequest')); return;
    }
    const result = await changePassword(response.locals.cpanelUser!.id, response.locals.cpanelSession!.token_hash, input);
    const messages = { required: t('cpanel.password.required'), policy: t('cpanel.password.policy'), mismatch: t('cpanel.password.mismatch'), same: t('cpanel.password.same'), incorrect: t('cpanel.password.incorrect'), success: t('cpanel.password.success') };
    response.status(result === 'success' ? 200 : 400);
    await renderProfile(response, result === 'success' ? 'success' : 'error', messages[result]);
  } catch {
    response.status(500); await renderProfile(response, 'error', t('cpanel.password.failure'));
  }
};

export const submitProfile: RequestHandler = async (request, response) => {
  const result = Object.keys(request.query).length ? 'invalidRequest' : await updateProfile(response.locals.cpanelUser!.id, response.locals.cpanelSession!.token_hash, request.body);
  const t = response.locals.t;
  const messages = { success: t('cpanel.profile.saved'), invalidRequest: t('errors.invalidRequest'), invalidName: t('cpanel.profile.invalidName'), invalidPhone: t('cpanel.profile.invalidPhone'), avatarFailed: t('cpanel.profile.avatarFailed'), failure: t('cpanel.profile.failure') };
  response.status(result === 'success' ? 200 : result === 'failure' ? 500 : 400).json({ success: result === 'success', message: messages[result], code: result });
};

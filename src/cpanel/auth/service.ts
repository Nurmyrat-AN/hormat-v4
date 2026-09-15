import { authRepository } from './repository.js';
import { dummyHash, normalizeEmail, validEmail, validPassword, verifyPassword } from './password.js';

export async function authenticate(emailInput: unknown, password: unknown): Promise<{ user_id: string; password_hash: string } | undefined> {
  if (typeof emailInput !== 'string' || !validPassword(password)) return undefined;
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) return undefined;
  const credentials = await authRepository.credentials(email);
  const matches = await verifyPassword(credentials?.password_hash ?? await dummyHash(), password);
  return credentials && credentials.is_active && matches ? credentials : undefined;
}

import { PasswordChangeRepository } from './password-change-repository.js';
import { hashPassword, verifyPassword, validPassword, meetsPasswordPolicy } from './password.js';

export type PasswordResult = 'required' | 'policy' | 'mismatch' | 'same' | 'incorrect' | 'success';
export async function changePassword(userId: string, sessionHash: string, input: { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown }, repository = new PasswordChangeRepository()): Promise<PasswordResult> {
  const { currentPassword, newPassword, confirmPassword } = input;
  if (![currentPassword, newPassword, confirmPassword].every(v => typeof v === 'string' && v.length > 0)) return 'required';
  if (!validPassword(currentPassword)) return 'incorrect';
  if (!meetsPasswordPolicy(newPassword)) return 'policy';
  if (newPassword !== confirmPassword) return 'mismatch';
  let result: PasswordResult = 'incorrect';
  await repository.change(userId, sessionHash, async hash => {
    if (!await verifyPassword(hash, currentPassword)) return undefined;
    if (currentPassword === newPassword) { result = 'same'; return undefined; }
    const nextHash = await hashPassword(newPassword);
    result = 'success';
    return nextHash;
  });
  return result;
}

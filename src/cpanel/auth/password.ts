import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const validEmail = (email: string): boolean => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validPassword = (password: unknown): password is string => typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 1024;
export const meetsPasswordPolicy = (password: unknown): password is string => validPassword(password) && password.length >= 12;
export function hashPassword(password: string): Promise<string> {
  if (!meetsPasswordPolicy(password)) throw new Error('Password must contain at least 12 characters and at most 1024 bytes.');
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!validPassword(password)) return false;
  return argon2.verify(hash, password);
}
// Unknown accounts perform the same expensive verification as known accounts.
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  return dummy ??= hashPassword(randomBytes(32).toString('hex'));
}

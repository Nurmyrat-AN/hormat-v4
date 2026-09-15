import { MediaError } from '../../media/errors.js';
import { mediaStore } from '../../media/index.js';
import { ProfileRepository, ProfileTransactionError } from './repository.js';

export const avatarDestination = 'users/avatars';
export type ProfileResult = 'success' | 'invalidRequest' | 'invalidName' | 'invalidPhone' | 'avatarFailed' | 'failure';
export async function updateProfile(userId: string, sessionHash: string, input: unknown,
  repository = new ProfileRepository(), media = mediaStore): Promise<ProfileResult> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'invalidRequest';
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some(key => !['_csrf', 'name', 'phone', 'avatarCacheToken'].includes(key))) return 'invalidRequest';
  const { name, phone, avatarCacheToken } = fields;
  if (typeof name !== 'string' || !name.trim() || Array.from(name.trim()).length > 200 || /[\u0000-\u001f\u007f]/.test(name)) return 'invalidName';
  if (typeof phone !== 'string' || Array.from(phone.trim()).length > 50 || /[\u0000-\u001f\u007f]/.test(phone)) return 'invalidPhone';
  if (avatarCacheToken != null && (typeof avatarCacheToken !== 'string' || !avatarCacheToken || avatarCacheToken.length > 100)) return 'avatarFailed';
  let oldUrl: string | null = null, newUrl: string | null = null;
  try {
    await repository.update(userId, sessionHash, name.trim(), phone.trim() || null, async currentUrl => {
      oldUrl = currentUrl;
      if (typeof avatarCacheToken !== 'string') return currentUrl;
      newUrl = (await media.finalizeCachedMedia({ cacheToken: avatarCacheToken, destination: avatarDestination, ownerId: userId })).url;
      return newUrl;
    });
  } catch (error) {
    if (newUrl && !(error instanceof ProfileTransactionError && error.outcomeUnknown)) {
      await media.deleteManagedFile(newUrl, avatarDestination).catch(() => console.error('Profile media compensation failed; manual reconciliation required'));
    } else if (newUrl) console.error('Profile commit outcome unknown; media retained for reconciliation');
    return error instanceof MediaError ? 'avatarFailed' : 'failure';
  }
  if (newUrl && oldUrl && oldUrl !== newUrl) {
    // A cleanup failure cannot turn a committed update into a failed Save.
    await media.deleteManagedFile(oldUrl, avatarDestination).catch(() => console.error('Old profile media cleanup failed; manual reconciliation required'));
  }
  return 'success';
}

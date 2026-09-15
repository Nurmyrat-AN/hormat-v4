import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';

export class BrowseError extends Error {
 constructor(readonly status = 404) { super('Media path unavailable'); }
}
export const hiddenMediaName = (name: string) => name.startsWith('.') || ['thumbs.db', 'desktop.ini'].includes(name.toLowerCase());
export function validateMediaPath(relative: string): void {
 if (typeof relative !== 'string' || relative.length > 2048 || /^[a-zA-Z]:/.test(relative) || /[\\%\x00-\x1f\x7f]/.test(relative) || relative.startsWith('/') ||
   (relative !== '' && relative.split('/').some(s => !s || s === '.' || s === '..' || hiddenMediaName(s)))) throw new BrowseError(400);
 if (relative.split('/')[0] === 'cache' && relative.split('/').slice(1).includes('record.json')) throw new BrowseError(404);
}
/** Existing paths only. Every component must be a real directory/file, never a symlink. */
export async function resolveMediaPath(root: string, relative: string): Promise<string> {
 validateMediaPath(relative);
 let current = await realpath(root);
 for (const segment of relative.split('/').filter(Boolean)) {
  current = path.join(current, segment);
  if ((await lstat(current)).isSymbolicLink()) throw new BrowseError(404);
 }
 return current;
}

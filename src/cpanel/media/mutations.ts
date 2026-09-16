import path from 'node:path';
import { moveNoReplace } from './move-filesystem.js';
import { mkdir, lstat, link, unlink, rmdir, rm, opendir, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Request } from 'express';
import { MediaBrowser } from './browser.js';
import { BrowseError, validateMediaPath, hiddenMediaName } from '../../media/paths.js';
import { receiveFile } from '../../media/multipart.js';
import { MediaError } from '../../media/errors.js';
import { tokenPattern, MediaStore } from '../../media/store.js';
import {mediaStore} from '../../media/index.js';

const execute = promisify(execFile);
export const directUploadMaxBytes = 10 * 1024 * 1024;
export class ManagerError extends Error {
 constructor(readonly code: string, readonly status = 400) { super(code); }
}
export function managerError(error: unknown, fallback: string): ManagerError {
 if (error instanceof ManagerError) return error;
 if (error instanceof MediaError) return new ManagerError(error.code, error.code === 'MEDIA_FILE_TOO_LARGE' ? 413 : error.code === 'MEDIA_UPLOAD_FAILED' ? 500 : 400);
 if (error instanceof BrowseError) return new ManagerError(error.status === 400 ? 'MEDIA_INVALID_PATH' : 'MEDIA_NOT_FOUND', error.status);
 const code = (error as NodeJS.ErrnoException)?.code;
 if(code==='MEDIA_MOVE_INCOMPLETE') return new ManagerError(code,500);
 return code === 'EEXIST' ? new ManagerError('MEDIA_ALREADY_EXISTS', 409) : code === 'ENOENT' || code === 'ENOTDIR' ? new ManagerError('MEDIA_NOT_FOUND', 404) : code === 'ENOTEMPTY' ? new ManagerError('MEDIA_FOLDER_NOT_EMPTY',409) : code === 'EACCES' || code === 'EPERM' ? new ManagerError('MEDIA_PERMISSION_DENIED',403) : new ManagerError(fallback,500);
}
export function validateName(name: string): void {
 if (typeof name !== 'string' || !name.trim() || Buffer.byteLength(name) > 255 || /[/:\\%\x00-\x1f\x7f]/.test(name) || name.endsWith('.') || name.endsWith(' ') || name.startsWith('.')) throw new ManagerError('MEDIA_INVALID_NAME');
 try { validateMediaPath(name); } catch { throw new ManagerError('MEDIA_INVALID_NAME'); }
}
// Serializes this application's tree mutations; no-clobber filesystem primitives also protect collisions.
const queues = new Map<string, Promise<unknown>>();
export class MediaManager extends MediaBrowser {
 private async serialized<T>(operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(this.root), previous = queues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(operation); queues.set(key,pending);
  try { return await pending; } finally { if(queues.get(key) === pending) queues.delete(key); }
 }
 private async directory(relative: string) {
  const resolved = await this.resolve(relative);
  if (!(await lstat(resolved)).isDirectory()) throw new ManagerError('MEDIA_NOT_FOUND',404);
  return resolved;
 }
 private targetPath(parent: string, name: string) {
  validateName(name);
  const relative = [parent,name].filter(Boolean).join('/'); validateMediaPath(relative);
  // These are private token infrastructure, not a way to manufacture domain uploads.
  const parts = relative.split('/');
  if(parts[0] === 'cache' && parts.length > 2 && tokenPattern.test(parts[1])) throw new ManagerError('MEDIA_CACHE_PROTECTED',403);
  return relative;
 }
 private async rejectCacheAliasCollision(parent: string, name: string) {
  if(parent !== 'cache') return;
  const match=name.match(/^(.+)\.([a-z0-9]+)$/);if(!match||!tokenPattern.test(match[1]))return;
  try {await new MediaStore(this.root,mediaStore.ttlHours).preview(match[1],match[2]);}
  catch(error){if(error instanceof MediaError&&error.code==='MEDIA_CACHE_NOT_FOUND')return;throw error;}
  throw new ManagerError('MEDIA_ALREADY_EXISTS',409);
 }
 async createFolder(parent: string, name: string) {
  return this.serialized(async () => {
   const relative = this.targetPath(parent,name), directory = await this.directory(parent);
   await mkdir(path.join(directory,name),{mode:0o700}); return this.entry(relative);
  });
 }
 async renameItem(source: string, name: string) {
  return this.serialized(async () => {
   if(source === '') throw new ManagerError('MEDIA_ROOT_PROTECTED',403);
   const item = await this.entry(source), relative = this.targetPath(item.parent,name);
   await this.rejectCacheAliasCollision(item.parent,name);
   const oldPath = await this.resolve(source), directory = await this.directory(item.parent), newPath = path.join(directory,name);
   // GNU coreutils uses renameat2(RENAME_NOREPLACE) on supported Linux filesystems.
   // --no-copy forbids a cross-filesystem copy/delete fallback; --none-fail reports collisions.
   try { await execute('mv',['--no-copy','--update=none-fail','--no-target-directory','--',oldPath,newPath]); }
   catch(error) {
    try { await lstat(newPath); throw new ManagerError('MEDIA_ALREADY_EXISTS',409); }
    catch(probe) { if(probe instanceof ManagerError) throw probe; }
    try { await lstat(oldPath); } catch(missing) { throw missing; }
    throw new ManagerError('MEDIA_RENAME_FAILED',500);
   }
   return this.entry(relative);
  });
 }
 async destinationFolders(relative: string) {
  const directory = await this.directory(relative), folders: {name:string;path:string}[] = [];
  let limited = false, scanned = 0;
  for await (const child of await opendir(directory)) {
   if (++scanned > 10000 || folders.length >= 500) { limited = true; break; }
   if (!child.isDirectory() || hiddenMediaName(child.name)) continue;
   const location = [relative,child.name].filter(Boolean).join('/');
   try { this.targetPath(location,'probe'); await this.directory(location); folders.push({name:child.name,path:location}); } catch { /* Private or unavailable folder. */ }
  }
  folders.sort((a,b)=>a.name.localeCompare(b.name));
  return {path:relative,folders,limited};
 }
 async moveItem(source: string, destination: string, authorize: () => Promise<void> = async()=>{}) {
  return this.serialized(async () => {
   await authorize();
   if(source === '') throw new ManagerError('MEDIA_ROOT_PROTECTED',403);
   const item = await this.entry(source);
   validateMediaPath(destination);
   if(destination === item.parent) throw new ManagerError('MEDIA_SAME_FOLDER');
   if(item.folder && (destination === source || destination.startsWith(source+'/'))) throw new ManagerError('MEDIA_MOVE_SELF');
   const relative = this.targetPath(destination,item.name);
   const oldPath = await this.resolve(source), directory = await this.directory(destination);
   await this.rejectCacheAliasCollision(destination,item.name);
   await moveNoReplace(oldPath,path.join(directory,item.name),authorize);
   return this.entry(relative);
  });
 }
 async deleteInfo(relative: string) {
  if(relative === '') throw new ManagerError('MEDIA_ROOT_PROTECTED',403);
  const item = await this.entry(relative); let nonEmpty = false;
  if(item.folder) {
   // Includes private records and hidden children: never confuse visible count with empty.
   for await(const child of await opendir(await this.resolve(relative))) { nonEmpty = true; break; }
  }
  return {...item,nonEmpty};
 }
 async deleteItem(relative: string, recursive: boolean) {
  return this.serialized(async () => {
   const item = await this.deleteInfo(relative), file = await this.resolve(relative);
   if(item.folder) {
    if(!recursive) await rmdir(file);
    else await rm(file,{recursive:true,force:false}); // Node removes descendant symlinks, never follows them.
   } else await unlink(file);
   return {path:relative};
  });
 }
 async uploadToFolder(request: Request, parent: string, authorize: () => Promise<void>) {
  await this.directory(parent);
  // Private staging is separate from Universal Media token publication/finalization.
  const stagingRoot = path.join(await this.directory(''),'.manager-incoming');
  await mkdir(stagingRoot,{recursive:true,mode:0o700});
  if(!(await lstat(stagingRoot)).isDirectory()) throw new ManagerError('MEDIA_INVALID_PATH');
  const stage = await mkdtemp(path.join(stagingRoot,'upload-')), file = path.join(stage,'file');
  try {
   const name = await receiveFile(request,file,directUploadMaxBytes,{preserveName:true});
   return await this.serialized(async () => {
    await authorize();
    const relative = this.targetPath(parent,name), directory = await this.directory(parent);
    await this.rejectCacheAliasCollision(parent,name);
    // Atomic exclusive publication of complete bytes. Existing files are never overwritten.
    await link(file,path.join(directory,name));
    return this.entry(relative);
   });
  } finally { await rm(stage,{recursive:true,force:true}); }
 }
}

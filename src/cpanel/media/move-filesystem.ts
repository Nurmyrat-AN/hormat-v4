import path from 'node:path';
import { cp, lstat, readdir, mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const failure = (code: string) => Object.assign(new Error(code), {code});
/** Exclusive publication for files AND directories. Never merges/replaces an existing target. */
async function renameExclusive(source:string,destination:string) {
 try { await execute('mv',['--no-copy','--update=none-fail','--no-target-directory','--',source,destination]); }
 catch(error) {
  try { await lstat(destination); throw failure('EEXIST'); }
  catch(probe) { if((probe as NodeJS.ErrnoException).code !== 'ENOENT') throw probe; }
  throw error;
 }
}
/** Reject special files/symlinks; hash original bytes, including hidden descendants. */
async function snapshot(root:string):Promise<string> {
 const hash=createHash('sha256');
 async function visit(relative:string):Promise<void> {
  const file=path.join(root,relative),info=await lstat(file);
  hash.update(JSON.stringify([relative,info.isDirectory()?'directory':'file',info.mode]));
  if(info.isSymbolicLink() || (!info.isDirectory()&&!info.isFile())) throw failure('EINVAL');
  if(info.isDirectory()) { for(const name of (await readdir(file)).sort()) await visit(path.join(relative,name)); }
  else { hash.update(String(info.size));for await(const chunk of createReadStream(file)) hash.update(chunk); }
 }
 await visit('');return hash.digest('hex');
}
// Optional primitive parameter allows deterministic EXDEV/copy-failure tests without extra mounts.
export async function moveNoReplace(source:string,destination:string,authorize:()=>Promise<void>, primitives={rename:renameExclusive,copy:cp,remove:rm}) {
 try { await lstat(destination); throw failure('EEXIST'); }
 catch(error) { if((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
 const before=await snapshot(source);
 const crossDevice=(await lstat(source)).dev !== (await lstat(path.dirname(destination))).dev;
 if(!crossDevice) {
  try { await authorize(); await primitives.rename(source,destination); return; }
  catch(error) {
   // Native injected primitives expose EXDEV; coreutils reports it in stderr.
   if((error as NodeJS.ErrnoException).code!=='EXDEV' && !/cross-device/i.test(String((error as {stderr?:string}).stderr??''))) throw error;
  }
 }
 const stage=await mkdtemp(path.join(path.dirname(destination),'.manager-move-'));
 const copy=path.join(stage,'item');let published=false;
 try {
  await primitives.copy(source,copy,{recursive:true,dereference:false,errorOnExist:true,force:false,preserveTimestamps:true});
  if(await snapshot(copy)!==before || await snapshot(source)!==before) throw failure('EIO');
  await authorize(); // Revocation during a long copy must not remove the original.
  await primitives.rename(copy,destination);published=true;
  // Keep the complete destination if source removal fails partway; report failure, never delete the only remaining bytes.
  await primitives.remove(source,{recursive:true,force:false});
 } catch(error) {
  if(published) throw failure('MEDIA_MOVE_INCOMPLETE');
  throw error;
 } finally {
  await rm(stage,{recursive:true,force:true});
 }
}

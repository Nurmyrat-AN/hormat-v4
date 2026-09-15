import {validateMediaPath} from './paths.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rename, rm, readdir, stat, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MediaError } from './errors.js';

export interface StoredMetadata { extension: string; mimeType: string; size: number; width: number | null; height: number | null }
export interface MediaReference { cacheToken: string; url: string; originalName: string; mimeType: string; size: number; width: number | null; height: number | null }
interface CacheRecord { ownerId: string; expiresAt: number; media: MediaReference; extension: string }
export const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** File-backed temporary infrastructure; no model/domain persistence. Root is server configuration. */
export class MediaStore {
  readonly root: string;
  constructor(root: string, readonly ttlHours: number) { this.root = path.resolve(root); }
  async initialize(): Promise<void> {
    for (const dir of ['cache', '.incoming', '.claims', '.trash']) await mkdir(path.join(this.root, dir), { recursive: true, mode: 0o700 });
  }
  async staging(): Promise<{ token: string; directory: string; file: string }> {
    await this.initialize();
    const token = randomUUID(); const directory = path.join(this.root, '.incoming', token);
    await mkdir(directory, { mode: 0o700 });
    return { token, directory, file: path.join(directory, 'upload') };
  }
  async publish(stage: { token: string; directory: string; file: string }, ownerId: string, originalName: string, metadata: StoredMetadata): Promise<MediaReference> {
    const { extension, ...info } = metadata;
    if (!/^[a-z0-9]+$/.test(extension)) throw new MediaError('MEDIA_FILE_INVALID');
    const media = { cacheToken: stage.token, url: `/media/cache/${stage.token}.${extension}`, originalName, ...info };
    await rename(stage.file, path.join(stage.directory, `asset.${extension}`));
    const record: CacheRecord = { ownerId, expiresAt: Date.now() + this.ttlHours * 3600000, media, extension };
    await writeFile(path.join(stage.directory, 'record.json'), JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    // Only complete, validated files become available through the public cache namespace.
    await rename(stage.directory, path.join(this.root, 'cache', stage.token));
    return media;
  }
  private async record(token: string): Promise<CacheRecord> {
    if (!tokenPattern.test(token)) throw new MediaError('MEDIA_CACHE_NOT_FOUND');
    try {
      const record: CacheRecord = JSON.parse(await readFile(path.join(this.root, 'cache', token, 'record.json'), 'utf8'));
      if (record.expiresAt <= Date.now() || record.media.cacheToken !== token || !/^[a-z0-9]+$/.test(record.extension)) throw new Error();
      return record;
    } catch { throw new MediaError('MEDIA_CACHE_NOT_FOUND'); }
  }
  async preview(token: string, extension: string): Promise<{ file: string; mimeType: string }> {
    const record = await this.record(token);
    if (extension !== record.extension) throw new MediaError('MEDIA_CACHE_NOT_FOUND');
    return { file: path.join(this.root, 'cache', token, `asset.${extension}`), mimeType: record.media.mimeType };
  }
  /** Map safe human-managed paths, preserving canonical domain cache token URLs. */
  async publicReferenceForRelativePath(relative: string): Promise<{url:string;mimeType:string|null} | null> {
    const parts = relative.split('/'), name = parts.at(-1) ?? '', match = name.match(/^(.+)\.([a-z0-9]+)$/);
    try { validateMediaPath(relative); } catch { return null; }
    if (parts.length === 3 && parts[0] === 'cache' && tokenPattern.test(parts[1]) && match && match[1] === 'asset') {
      try { const preview=await this.preview(parts[1], match[2]); return {url:`/media/cache/${parts[1]}.${match[2]}`,mimeType:preview.mimeType}; } catch { return null; }
    }
    try { validateMediaPath(relative); } catch { return null; }
    if(parts[0]==='cache' && parts.length>2 && tokenPattern.test(parts[1])) return null;
    return {url:'/media/' + parts.map(encodeURIComponent).join('/'),mimeType:null};
  }
  async publicUrlForRelativePath(relative:string):Promise<string|null>{return (await this.publicReferenceForRelativePath(relative))?.url??null;}
  /** Called only by a future trusted domain service; ownerId comes from its server-side auth context. */
  async finalizeCachedMedia({ cacheToken, destination, ownerId }: { cacheToken: string; destination: string; ownerId: string }): Promise<{ url: string }> {
    if (!/^[a-z][a-z0-9_-]*(\/[a-z][a-z0-9_-]*)*$/.test(destination) || destination.split('/').includes('cache')) throw new MediaError('MEDIA_UPLOAD_FAILED');
    const record = await this.record(cacheToken);
    if (record.ownerId !== ownerId) throw new MediaError('MEDIA_CACHE_NOT_FOUND');
    // Atomic directory claim prevents reuse across processes and races with TTL cleanup.
    const source = path.join(this.root, 'cache', cacheToken), claimed = path.join(this.root, '.claims', cacheToken);
    try { await rename(source, claimed); } catch { throw new MediaError('MEDIA_CACHE_NOT_FOUND'); }
    try {
      let targetDir = this.root;
      for (const segment of destination.split('/')) {
        targetDir = path.join(targetDir, segment);
        await mkdir(targetDir, { recursive: true, mode: 0o700 });
        if (!(await lstat(targetDir)).isDirectory()) throw new Error('Unsafe media directory');
      }
      const filename = `${randomUUID()}.${record.extension}`;
      await rename(path.join(claimed, `asset.${record.extension}`), path.join(targetDir, filename));
      // Cleanup failure after promotion cannot turn a consumed token into a reusable one.
      await rm(claimed, { recursive: true, force: true }).catch(() => undefined);
      return { url: `/media/${destination}/${filename}` };
    } catch (error) {
      await rename(claimed, source).catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new MediaError('MEDIA_CACHE_NOT_FOUND');
      throw new MediaError('MEDIA_UPLOAD_FAILED');
    }
  }
  /** Only exact generated files in a trusted destination; never arbitrary URLs or symlinks. */
  async deleteManagedFile(url: string, destination: string): Promise<boolean> {
    if (!/^[a-z][a-z0-9_-]*(\/[a-z][a-z0-9_-]*)*$/.test(destination) || destination.split('/').includes('cache')) return false;
    const prefix = `/media/${destination}/`;
    if (!url.startsWith(prefix)) return false;
    const filename = url.slice(prefix.length), match = filename.match(/^(.+)\.([a-z0-9]+)$/);
    if (!match || !tokenPattern.test(match[1])) return false;
    try {
      let directory = this.root;
      for (const segment of destination.split('/')) {
        directory = path.join(directory, segment);
        if (!(await lstat(directory)).isDirectory()) return false;
      }
      const file = path.join(directory, filename);
      if (!(await lstat(file)).isFile()) return false;
      await unlink(file);
      return true;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  async cleanup(now = Date.now()): Promise<void> {
    await this.initialize();
    for (const entry of await readdir(path.join(this.root, 'cache'))) {
      if (!tokenPattern.test(entry)) continue;
      if (!(await lstat(path.join(this.root, 'cache', entry))).isDirectory()) continue;
      const source = path.join(this.root, 'cache', entry);
      try {
        const record: CacheRecord = JSON.parse(await readFile(path.join(source, 'record.json'), 'utf8'));
        if (record.expiresAt > now) continue;
        const trash = path.join(this.root, '.trash', randomUUID());
        await rename(source, trash); await rm(trash, { recursive: true, force: true });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    // Aborted uploads/crash leftovers; no active request may last this long (upload timeout is shorter).
    for (const area of ['.incoming', '.claims', '.trash']) {
      for (const entry of await readdir(path.join(this.root, area))) {
        if (!tokenPattern.test(entry)) continue;
        const file = path.join(this.root, area, entry);
        try { if ((await stat(file)).mtimeMs < now - Math.max(this.ttlHours * 3600000, 3600000)) await rm(file, { recursive: true, force: true }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
    }
  }
}

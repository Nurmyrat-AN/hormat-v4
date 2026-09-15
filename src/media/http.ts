import { Router } from 'express';
import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { mediaStore } from './index.js';
import { tokenPattern } from './store.js';
import { describeFile, inlineMimeTypes } from './metadata.js';

export const mediaRouter = Router();
mediaRouter.use(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.sendStatus(405); return; }
  try {
    const segments = decodeURIComponent(request.path).split('/').filter(Boolean);
    if (segments.length < 2 || segments.some(s => !/^[a-z0-9._-]+$/.test(s))) throw new Error();
    const match = segments.pop()!.match(/^(.+)\.([a-z0-9]+)$/);
    if (!match || !tokenPattern.test(match[1])) throw new Error();
    let file: string, mimeType: string;
    if (segments.length === 1 && segments[0] === 'cache') {
      ({ file, mimeType } = await mediaStore.preview(match[1], match[2]));
      response.set('Cache-Control', 'no-store');
    } else {
      if (segments.some(s => !/^[a-z][a-z0-9_-]*$/.test(s) || s === 'cache')) throw new Error();
      let dir = mediaStore.root;
      for (const segment of segments) { dir = path.join(dir, segment); if (!(await lstat(dir)).isDirectory()) throw new Error(); }
      file = path.join(dir, `${match[1]}.${match[2]}`);
      if (!(await lstat(file)).isFile()) throw new Error();
      mimeType = (await describeFile(file)).mimeType;
      response.set('Cache-Control', 'public, max-age=3600');
    }
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Content-Security-Policy', "default-src 'none'; sandbox");
    response.set('Content-Type', inlineMimeTypes.has(mimeType) ? mimeType : 'application/octet-stream');
    response.set('Content-Disposition', inlineMimeTypes.has(mimeType) ? 'inline' : 'attachment');
    response.sendFile(file, { dotfiles: 'allow' }, error => { if (error && !response.headersSent) response.status(404).end(); });
  } catch { response.status(404).end(); }
});

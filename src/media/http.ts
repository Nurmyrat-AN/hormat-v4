import { Router } from 'express';
import { lstat } from 'node:fs/promises';
import { mediaStore } from './index.js';
import { tokenPattern } from './store.js';
import { describeFile, inlineMimeTypes } from './metadata.js';
import { resolveMediaPath, validateMediaPath } from './paths.js';

export const mediaRouter = Router();
mediaRouter.use(async (request, response) => {
 if (!['GET','HEAD'].includes(request.method)) { response.sendStatus(405); return; }
 try {
  const relative = decodeURIComponent(request.path).slice(1); validateMediaPath(relative);
  if(!relative) throw new Error();
  const parts = relative.split('/'), match = parts.length===2 && parts[0]==='cache' ? parts[1].match(/^(.+)\.([a-z0-9]+)$/) : null;
  let file: string, mimeType: string;
  if(match && tokenPattern.test(match[1])) {
   // Domain bearer URLs retain their existing expiry/metadata behavior. No fallback for expired tokens.
   try {
    ({file,mimeType} = await mediaStore.preview(match[1],match[2]));
    await resolveMediaPath(mediaStore.root,'cache/'+match[1]+'/asset.'+match[2]);
   } catch {
    // A direct cache file may resemble a token, but does not gain ownership/finalization metadata.
    file=await resolveMediaPath(mediaStore.root,relative);if(!(await lstat(file)).isFile())throw new Error();mimeType=(await describeFile(file)).mimeType;
   }
  } else {
   // Private physical token assets have exactly one public alias, never an expiry-bypassing path.
   if(parts[0]==='cache' && parts.length>2 && tokenPattern.test(parts[1])) throw new Error();
   file = await resolveMediaPath(mediaStore.root,relative);
   if(!(await lstat(file)).isFile()) throw new Error();
   mimeType = (await describeFile(file)).mimeType;
  }
  response.set('Cache-Control','no-store'); // Mutable names must not retain an old image after rename/delete.
  response.set('X-Content-Type-Options','nosniff');
  response.set('Content-Security-Policy',"default-src 'none'; sandbox");
  response.set('Content-Type',inlineMimeTypes.has(mimeType)?mimeType:'application/octet-stream');
  response.set('Content-Disposition',inlineMimeTypes.has(mimeType)?'inline':'attachment');
  response.sendFile(file,{dotfiles:'allow'},error=>{if(error&&!response.headersSent)response.status(404).end();});
 } catch { response.status(404).end(); }
});

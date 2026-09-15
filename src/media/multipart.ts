import busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Request } from 'express';
import { MediaError } from './errors.js';

export async function receiveFile(request: Request, destination: string, maxBytes: number): Promise<string> {
  if (!request.is('multipart/form-data')) throw new MediaError('MEDIA_FILE_INVALID');
  if (maxBytes > 0 && Number(request.headers['content-length']) > maxBytes + 65536) throw new MediaError('MEDIA_FILE_TOO_LARGE');
  let parser: ReturnType<typeof busboy>;
  try { parser = busboy({ headers: request.headers, defParamCharset: 'utf8', limits: { files: 1, fields: 0, parts: 2, fileSize: maxBytes || Infinity, headerPairs: 50 } }); }
  catch { throw new MediaError('MEDIA_FILE_INVALID'); }
  let write: Promise<void> | undefined, originalName = '', received = 0, fileSeen = false;
  let failure: MediaError | undefined;
  let stopped = false;
  const abort = new AbortController();
  const invalidate = (code: MediaError['code']) => { failure ??= new MediaError(code); };
  let stop: (code: MediaError['code']) => void = () => undefined;
  const onAborted = () => stop('MEDIA_UPLOAD_FAILED');
  const onData = (chunk: Buffer) => { received += chunk.length; if (maxBytes > 0 && received > maxBytes + 65536) stop('MEDIA_FILE_TOO_LARGE'); };
  const timeout = setTimeout(() => stop('MEDIA_UPLOAD_FAILED'), 300000); timeout.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      stop = code => {
        if (stopped) return;
        stopped = true;
        invalidate(code); request.unpipe(parser); reject(failure);
        // Do not tear down busboy in the middle of its own multipart callback.
        queueMicrotask(() => { abort.abort(); parser.destroy(); request.resume(); });
      };
      parser.on('file', (name, stream, info) => {
        if (name !== 'file' || !info.filename) { invalidate('MEDIA_FILE_INVALID'); stream.resume(); return; }
        fileSeen = true;
        originalName = info.filename.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255);
        stream.on('limit', () => invalidate('MEDIA_FILE_TOO_LARGE'));
        write = pipeline(stream, createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal: abort.signal }).catch(() => { stop('MEDIA_UPLOAD_FAILED'); });
      });
      // Drain malformed/extra fields without publishing; the writer must settle before cleanup.
      for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => invalidate('MEDIA_FILE_INVALID'));
      parser.on('error', () => stop('MEDIA_FILE_INVALID'));
      parser.on('close', resolve);
      request.on('aborted', onAborted); request.on('data', onData); request.pipe(parser);
    });
    await write;
    if (failure) throw failure;
    if (!fileSeen) throw new MediaError('MEDIA_FILE_REQUIRED');
    return originalName;
  } finally {
    clearTimeout(timeout); request.off('aborted', onAborted); request.off('data', onData);
    await write;
  }
}

import type { RequestHandler } from 'express';
import { rm } from 'node:fs/promises';
import { config } from '../../config/env.js';
import { mediaStore } from '../../media/index.js';
import { receiveFile } from '../../media/multipart.js';
import { describeFile } from '../../media/metadata.js';
import { MediaError } from '../../media/errors.js';

export const uploadMedia: RequestHandler = async (request, response) => {
  let stage: Awaited<ReturnType<typeof mediaStore.staging>> | undefined;
  try {
    if (Object.keys(request.query).length) throw new MediaError('MEDIA_FILE_INVALID');
    stage = await mediaStore.staging();
    const originalName = await receiveFile(request, stage.file, config.media.maxBytes);
    const metadata = await describeFile(stage.file);
    const media = await mediaStore.publish(stage, response.locals.cpanelUser!.id, originalName, metadata);
    response.status(201).json({ success: true, media });
  } catch (error) {
    request.resume();
    const code = error instanceof MediaError ? error.code : 'MEDIA_UPLOAD_FAILED';
    const status = code === 'MEDIA_FILE_TOO_LARGE' ? 413 : code === 'MEDIA_TYPE_NOT_ALLOWED' ? 415 : code === 'MEDIA_UPLOAD_FAILED' ? 500 : 400;
    if (!response.destroyed && !response.headersSent) response.status(status).json({ success: false, error: { code } });
  } finally {
    if (stage) await rm(stage.directory, { recursive: true, force: true }).catch(() => undefined);
  }
};

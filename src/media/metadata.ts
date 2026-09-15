import { stat, open } from 'node:fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import type { StoredMetadata } from './store.js';

// Metadata discovery only: an unknown/malformed type is NEVER grounds for rejecting a file.
export async function describeFile(file: string): Promise<StoredMetadata> {
  const handle = await open(file, 'r');
  let sample: Buffer;
  try {
    const buffer = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    sample = buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }
  const type = await fileTypeFromBuffer(sample).catch(() => undefined);
  let width: number | null = null, height: number | null = null;
  if (type?.mime.startsWith('image/')) {
    try {
      const image = await sharp(file, { limitInputPixels: 40000000 }).metadata();
      width = image.width ?? null; height = image.pageHeight ?? image.height ?? null;
    } catch { /* Keep original bytes and nullable dimensions, including unsupported image encodings. */ }
  }
  return { extension: type?.ext && /^[a-z0-9]+$/.test(type.ext) ? type.ext : 'bin', mimeType: type?.mime ?? 'application/octet-stream', size: (await stat(file)).size, width, height };
}
export const inlineMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);

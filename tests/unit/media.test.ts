import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { MediaStore } from '../../src/media/store.js';
import { describeFile } from '../../src/media/metadata.js';

async function fixture(run: (store: MediaStore) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hormat-media-'));
  try { await run(new MediaStore(root, 24)); } finally { await rm(root, { recursive: true, force: true }); }
}
async function upload(store: MediaStore, bytes: Buffer, ownerId = 'owner') {
  const stage = await store.staging(); await writeFile(stage.file, bytes);
  return store.publish(stage, ownerId, 'original.file', await describeFile(stage.file));
}
test('media accepts arbitrary/empty bytes and preserves image bytes without conversion', async () => fixture(async store => {
  for (const bytes of [Buffer.from('<script>alert(1)</script>'), Buffer.alloc(0), Buffer.from([0, 1, 2, 255])]) {
    const media = await upload(store, bytes);
    assert.equal(media.mimeType, 'application/octet-stream'); assert.equal(media.size, bytes.length);
    assert.equal(media.width, null); assert.equal(media.height, null);
    assert.deepEqual(await readFile((await store.preview(media.cacheToken, 'bin')).file), bytes);
  }
  const png = await sharp({ create: { width: 12, height: 9, channels: 3, background: '#198754' } }).png().toBuffer();
  const media = await upload(store, png);
  assert.equal(media.mimeType, 'image/png'); assert.equal(media.width, 12); assert.equal(media.height, 9);
  assert.deepEqual(await readFile((await store.preview(media.cacheToken, 'png')).file), png);
}));
test('cache ownership survives restart; finalize is one-time across concurrent service instances', async () => fixture(async store => {
  const media = await upload(store, Buffer.from('universal file'));
  const restarted = new MediaStore(store.root, 24);
  await assert.rejects(restarted.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'other', destination: 'test-final' }), { code: 'MEDIA_CACHE_NOT_FOUND' });
  const results = await Promise.allSettled([store, restarted].map(s => s.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'owner', destination: 'test-final' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const success = results.find(r => r.status === 'fulfilled')!;
  assert.ok(!success.value.url.includes('/cache/'));
  assert.deepEqual(await readFile(path.join(store.root, success.value.url.slice('/media/'.length))), Buffer.from('universal file'));
  await assert.rejects(store.preview(media.cacheToken, 'bin'), { code: 'MEDIA_CACHE_NOT_FOUND' });
  await assert.rejects(store.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'owner', destination: 'test-final' }), { code: 'MEDIA_CACHE_NOT_FOUND' });
}));
test('invalid/expired tokens and unsafe destinations fail; failed promotion keeps the token usable', async () => fixture(async store => {
  const media = await upload(store, Buffer.from('safe'));
  await assert.rejects(store.finalizeCachedMedia({ cacheToken: '../../outside', ownerId: 'owner', destination: 'test-final' }), { code: 'MEDIA_CACHE_NOT_FOUND' });
  await assert.rejects(store.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'owner', destination: '../outside' }), { code: 'MEDIA_UPLOAD_FAILED' });
  await symlink(os.tmpdir(), path.join(store.root, 'unsafe'));
  await assert.rejects(store.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'owner', destination: 'unsafe' }), { code: 'MEDIA_UPLOAD_FAILED' });
  assert.ok(await store.preview(media.cacheToken, 'bin'));
  const recordPath = path.join(store.root, 'cache', media.cacheToken, 'record.json');
  const record = JSON.parse(await readFile(recordPath, 'utf8')); record.expiresAt = Date.now() - 1; await writeFile(recordPath, JSON.stringify(record));
  await assert.rejects(store.preview(media.cacheToken, 'bin'), { code: 'MEDIA_CACHE_NOT_FOUND' });
  await assert.rejects(store.finalizeCachedMedia({ cacheToken: media.cacheToken, ownerId: 'owner', destination: 'test-final' }), { code: 'MEDIA_CACHE_NOT_FOUND' });
  await store.cleanup(); assert.deepEqual(await readdir(path.join(store.root, 'cache')), []);
}));

test('multipart parser settles for extra fields, malformed streams and optional size cap', async () => fixture(async store => {
  const { PassThrough } = await import('node:stream');
  const { receiveFile } = await import('../../src/media/multipart.js');
  async function receive(body: string, max: number) {
    const stage = await store.staging();
    const stream = new PassThrough();
    Object.assign(stream, { headers: { 'content-type': 'multipart/form-data; boundary=test' }, is: () => true });
    const result = receiveFile(stream as unknown as import('express').Request, stage.file, max);
    stream.end(body);
    return result;
  }
  const one = '--test\r\nContent-Disposition: form-data; name="file"; filename="x.bin"\r\nContent-Type: application/octet-stream\r\n\r\n1234567890\r\n';
  assert.equal(await receive(one + '--test--\r\n', 0), 'x.bin');
  await assert.rejects(receive(one + '--test--\r\n', 4), { code: 'MEDIA_FILE_TOO_LARGE' });
  await assert.rejects(receive(one + '--test\r\nContent-Disposition: form-data; name="destination"\r\n\r\nunsafe\r\n--test--\r\n', 0), { code: 'MEDIA_FILE_INVALID' });
  await assert.rejects(receive(one, 0), { code: 'MEDIA_FILE_INVALID' });
}));

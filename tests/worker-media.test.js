import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { serveMedia, sniffImageType, storeMenuPhoto } from '../worker/src/media.js';

// Minimal in-memory stand-in for an R2 bucket binding.
function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, bytes, { httpMetadata }) {
      objects.set(key, { bytes: new Uint8Array(bytes), httpMetadata, etag: `"${key}"` });
    },
    async get(key, { onlyIf } = {}) {
      const stored = objects.get(key);
      if (!stored) return null;
      const base = { httpEtag: stored.etag, writeHttpMetadata: (headers) => { headers.set('Content-Type', stored.httpMetadata.contentType); headers.set('Cache-Control', stored.httpMetadata.cacheControl); } };
      if (onlyIf?.get?.('If-None-Match') === stored.etag) return base;
      return { ...base, body: stored.bytes };
    },
  };
}

const photo = await readFile(new URL('../public/images/menu/meat-pie.webp', import.meta.url));
const thumb = await readFile(new URL('../public/images/menu/meat-pie-320.webp', import.meta.url));
const form = (image, thumbnail) => {
  const data = new FormData();
  if (image) data.append('image', new Blob([image]), 'photo');
  if (thumbnail) data.append('thumbnail', new Blob([thumbnail]), 'photo-320');
  return data;
};

describe('Menu photo uploads', () => {
  it('recognises real image bytes only', () => {
    assert.equal(sniffImageType(photo.buffer.slice(photo.byteOffset)), 'image/webp');
    assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer), 'image/jpeg');
    assert.equal(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>').buffer), null);
  });

  it('stores the photo and its thumbnail, then serves both with long caching', async () => {
    const env = { MEDIA: fakeBucket() };
    const result = await storeMenuPhoto(env, form(photo, thumb));
    assert.match(result.url, /^\/media\/menu\/[0-9a-f-]{36}\.webp$/);
    const key = result.url.slice('/media/'.length);
    assert.deepEqual([...env.MEDIA.objects.keys()].sort(), [key, key.replace('.webp', '-320.webp')].sort());

    const response = await serveMedia(env, key, new Request('https://api.example/'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/webp');
    assert.match(response.headers.get('Cache-Control'), /immutable/);
    assert.equal((await response.arrayBuffer()).byteLength, photo.byteLength);

    const cached = await serveMedia(env, key, new Request('https://api.example/', { headers: { 'If-None-Match': response.headers.get('ETag') } }));
    assert.equal(cached.status, 304);
  });

  it('rejects non-images, oversized files and missing parts', async () => {
    const env = { MEDIA: fakeBucket() };
    assert.equal((await storeMenuPhoto(env, form(new TextEncoder().encode('<html>'), thumb))).status, 400);
    assert.equal((await storeMenuPhoto(env, form(photo, null))).status, 400);
    assert.equal((await storeMenuPhoto(env, form(new Uint8Array(3 * 1024 * 1024), thumb))).status, 400);
    assert.equal((await storeMenuPhoto({}, form(photo, thumb))).status, 503);
    assert.equal(env.MEDIA.objects.size, 0);
  });

  it('only serves keys the upload code could have created', async () => {
    const env = { MEDIA: fakeBucket() };
    for (const key of ['../secrets', 'menu/anything.webp', 'other/0b7c1d3e-1111-4111-8111-111111111111.webp']) {
      assert.equal((await serveMedia(env, key, new Request('https://x/'))).status, 404);
    }
  });
});

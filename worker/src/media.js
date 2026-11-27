// Menu photo uploads, stored in R2 and served by the Worker.
// The admin resizes photos in the browser, then sends a full-size image and a 320px thumbnail.
// They are stored as menu/<id>.webp and menu/<id>-320.webp, matching the site's existing
// "<name>-320.webp" thumbnail convention.

const MAX_FULL_BYTES = 2 * 1024 * 1024;
const MAX_THUMB_BYTES = 512 * 1024;
const MEDIA_KEY = /^menu\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(-320)?\.webp$/;

// Detects the real image type from the file's first bytes, ignoring what the browser claims.
export function sniffImageType(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  const ascii = (start, end) => String.fromCharCode(...b.slice(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  return null;
}

async function readImage(file, maxBytes) {
  if (!file || typeof file.arrayBuffer !== 'function') return { error: 'No photo was received.' };
  if (file.size > maxBytes) return { error: 'That photo is too large. Try a smaller one.' };
  const bytes = await file.arrayBuffer();
  const type = sniffImageType(bytes);
  if (!type) return { error: 'That file is not a JPG, PNG or WebP photo.' };
  return { bytes, type };
}

// Returns { url } or { error, status }.
export async function storeMenuPhoto(env, formData) {
  if (!env.MEDIA) return { error: 'Photo storage is not set up yet.', status: 503 };
  const full = await readImage(formData.get('image'), MAX_FULL_BYTES);
  if (full.error) return { ...full, status: 400 };
  const thumb = await readImage(formData.get('thumbnail'), MAX_THUMB_BYTES);
  if (thumb.error) return { ...thumb, status: 400 };

  const id = crypto.randomUUID();
  const cacheControl = 'public, max-age=31536000, immutable';
  await Promise.all([
    env.MEDIA.put(`menu/${id}.webp`, full.bytes, { httpMetadata: { contentType: full.type, cacheControl } }),
    env.MEDIA.put(`menu/${id}-320.webp`, thumb.bytes, { httpMetadata: { contentType: thumb.type, cacheControl } }),
  ]);
  // A path, not a full URL: the admin loads it from this Worker, and the public site prefixes its API address.
  return { url: `/media/menu/${id}.webp` };
}

// Serves GET /media/<key>. Keys are random, so the files never change and can be cached forever.
export async function serveMedia(env, key, request) {
  if (!MEDIA_KEY.test(key) || !env.MEDIA) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  // onlyIf: a matching If-None-Match returns the object without a body.
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}

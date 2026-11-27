// Centre-crops a photo to a square and encodes it at the given size.
// Uses WebP where the browser can encode it, and falls back to JPEG (older Safari).
async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to <img> decoding, which handles more formats in some browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob?.type === 'image/webp') return resolve(blob);
        canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality);
      },
      'image/webp',
      quality,
    );
  });
}

function squareCanvas(source, size) {
  const width = source.width;
  const height = source.height;
  const side = Math.min(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(size, side);
  canvas.height = canvas.width;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Returns { full, thumbnail } blobs: a 960px square and a 320px square.
export async function prepareMenuPhoto(file) {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('Please choose a photo file.');
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error('Could not read that photo. Try a JPG or PNG.');
  }
  if (bitmap.width < 200 || bitmap.height < 200) throw new Error('That photo is too small. Use one at least 200 pixels wide.');
  const [full, thumbnail] = await Promise.all([encode(squareCanvas(bitmap, 960), 0.82), encode(squareCanvas(bitmap, 320), 0.8)]);
  bitmap.close?.();
  return { full, thumbnail };
}

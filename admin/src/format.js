// Menu images are hosted with the public site on Vercel.
export const IMAGE_ORIGIN = 'https://cleos-munchies.vercel.app';

export function imageUrl(path) {
  if (!path) return '';
  // Uploaded photos (/media/...) are served by this Worker; the original photos live on the Vercel site.
  if (path.startsWith('https://') || path.startsWith('/media/')) return path;
  return `${IMAGE_ORIGIN}${path}`;
}

export function formatGBP(pence) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format((pence ?? 0) / 100);
}

// "12.5" -> 1250. Returns NaN for anything that is not a sensible amount.
export function poundsToPence(value) {
  const text = String(value ?? '').replace(/[£,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

export function penceToPounds(pence) {
  return pence === null || pence === undefined ? '' : (pence / 100).toFixed(2);
}

export function formatDateTime(iso) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(iso));
}

// Where the Cloudflare Worker API lives. Override at build time with VITE_API_BASE.
const PRODUCTION_API = 'https://cleos-munchies-api.rextechng.workers.dev';
const LOCAL_API = 'http://localhost:8788';

export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? LOCAL_API : PRODUCTION_API);

// Photos uploaded in the admin are stored as /media/... paths on the Worker.
export function assetUrl(path) {
  return path?.startsWith('/media/') ? `${API_BASE}${path}` : path;
}

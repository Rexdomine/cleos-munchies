// Verifies the Cloudflare Access JWT on admin requests.
// Access already blocks unauthenticated visitors at the edge; this check makes sure a request
// really came through Access and that the email is on the admin list (defence in depth).

const CERT_CACHE_MS = 60 * 60 * 1000;
let certCache = { url: '', keys: null, fetchedAt: 0 };

function base64UrlDecode(input) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonPart(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
}

async function getSigningKeys(teamDomain, fetchImpl) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (certCache.url === url && certCache.keys && Date.now() - certCache.fetchedAt < CERT_CACHE_MS) return certCache.keys;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Could not load Access signing keys (${response.status}).`);
  const { keys } = await response.json();
  certCache = { url, keys, fetchedAt: Date.now() };
  return keys;
}

export function resetCertCache() {
  certCache = { url: '', keys: null, fetchedAt: 0 };
}

function parseList(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

// Returns the verified JWT payload, or throws.
export async function verifyAccessJwt(token, { teamDomain, audience, fetchImpl = fetch, now = Date.now() }) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJsonPart(headerPart);
  const payload = decodeJsonPart(payloadPart);
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');

  const keys = await getSigningKeys(teamDomain, fetchImpl);
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key.');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlDecode(signaturePart), signedData);
  if (!valid) throw new Error('Bad signature.');

  const seconds = Math.floor(now / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw new Error('Wrong audience.');
  if (payload.iss !== teamDomain) throw new Error('Wrong issuer.');
  if (typeof payload.exp !== 'number' || payload.exp <= seconds) throw new Error('Token expired.');
  if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) throw new Error('Token not yet valid.');
  return payload;
}

// Resolves the signed-in admin's email, or returns null.
// Local development may set DEV_ADMIN_EMAIL in worker/.dev.vars; that file is never deployed.
export async function getAdminEmail(request, env, fetchImpl = fetch) {
  const admins = parseList(env.ADMIN_EMAILS);

  if (env.DEV_ADMIN_EMAIL && !env.ACCESS_AUD) {
    const devEmail = String(env.DEV_ADMIN_EMAIL).toLowerCase();
    return admins.includes(devEmail) ? devEmail : null;
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const cookieToken = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('Cookie') ?? '')?.[1];
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookieToken;
  if (!token) return null;

  try {
    const payload = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD, fetchImpl });
    const email = String(payload.email ?? '').toLowerCase();
    return admins.includes(email) ? email : null;
  } catch {
    return null;
  }
}

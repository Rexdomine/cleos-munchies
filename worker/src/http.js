export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(status, message, headers) {
  return json({ error: message }, status, headers);
}

// CORS for the public endpoints, limited to the site origins in ALLOWED_ORIGINS.
export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const MAX_BODY_BYTES = 32 * 1024;

// Reads a JSON body, refusing oversized or malformed payloads.
export async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return { error: 'too_large' };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: 'too_large' };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: 'invalid_json' };
  }
}

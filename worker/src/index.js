import { ADMIN_HTML, ADMIN_SCRIPT_HASHES } from './generated/adminPage.js';
import LOGIN_LOGO from './assets/login-logo.png';
import { getAdminEmail } from './auth.js';
import { corsHeaders, errorResponse, json, readJson } from './http.js';
import { serveMedia, storeMenuPhoto } from './media.js';
import { createMenuItem, deleteMenuItem, loadMenu, setMenuItemAvailability, updateMenuItem } from './menu.js';
import { countOrders, listOrders, submitOrder, updateOrder } from './orders.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function adminPage() {
  const scriptSources = ADMIN_SCRIPT_HASHES.map((hash) => `'${hash}'`).join(' ');
  return new Response(ADMIN_HTML, {
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src ${scriptSources}; style-src 'unsafe-inline'; img-src 'self' https://cleos-munchies.vercel.app data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    },
  });
}

function notAdminPage() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Cleo’s Munchies admin</title><body style="font-family:system-ui;padding:40px;background:#f7f1e8;color:#1d1b18"><h1>Admin sign-in needed</h1><p>This page is only for the Cleo’s Munchies team. If you should have access, ask for your email to be added to the admin list.</p></body>',
    { status: 403, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

function signedOutPage() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Signed out · Cleo’s Munchies admin</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f1e8;color:#1d1b18;font-family:'Avenir Next',Avenir,'Segoe UI',system-ui,sans-serif">
<main style="width:min(420px,calc(100% - 32px));padding:32px;background:#fffaf4;border:1px solid #ded3c6;border-radius:16px;text-align:center">
<img src="/brand/login-logo.png" alt="Cleo’s Munchies" width="150" style="display:block;margin:0 auto 24px;height:auto">
<h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px">You’re signed out</h1>
<p style="margin:0 0 24px;color:#6f675e;line-height:1.5">You’ve logged out of the Cleo’s Munchies admin on this device.</p>
<a href="/admin" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#bd392e;color:#fff;font-weight:600;text-decoration:none">Sign in again</a>
</main></body></html>`,
    {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}

function fromResult(result, okStatus = 200) {
  if (result.error) return errorResponse(result.status ?? 400, result.error);
  return json(result, okStatus);
}

async function handleAdminApi(request, env, path) {
  const db = env.DB;
  const method = request.method;

  if (path === '/api/admin/orders' && method === 'GET') {
    const url = new URL(request.url);
    const page = await listOrders(db, {
      status: url.searchParams.get('status') ?? '',
      query: url.searchParams.get('q') ?? '',
      before: url.searchParams.get('before') ?? '',
    });
    return json({ ...page, counts: await countOrders(db) });
  }

  const orderMatch = /^\/api\/admin\/orders\/(CLEO-\d{6}-[0-9A-F]{6})$/.exec(path);
  if (orderMatch && method === 'PATCH') {
    const { body, error } = await readJson(request);
    if (error) return errorResponse(400, 'Could not read the update.');
    return fromResult(await updateOrder(db, orderMatch[1], body));
  }

  if (path === '/api/admin/menu' && method === 'GET') return json(await loadMenu(db));

  if (path === '/api/admin/uploads' && method === 'POST') {
    let form;
    try {
      form = await request.formData();
    } catch {
      return errorResponse(400, 'Could not read the photo upload.');
    }
    return fromResult(await storeMenuPhoto(env, form), 201);
  }

  if (path === '/api/admin/menu/items' && method === 'POST') {
    const { body, error } = await readJson(request);
    if (error) return errorResponse(400, 'Could not read the dish details.');
    return fromResult(await createMenuItem(db, body), 201);
  }

  const itemMatch = /^\/api\/admin\/menu\/items\/([a-z0-9-]{1,100})(\/availability)?$/.exec(path);
  if (itemMatch) {
    const [, id, availability] = itemMatch;
    if (availability && method === 'PUT') {
      const { body, error } = await readJson(request);
      if (error) return errorResponse(400, 'Could not read the update.');
      return fromResult(await setMenuItemAvailability(db, id, Boolean(body?.available)));
    }
    if (!availability && method === 'PUT') {
      const { body, error } = await readJson(request);
      if (error) return errorResponse(400, 'Could not read the dish details.');
      return fromResult(await updateMenuItem(db, id, body));
    }
    if (!availability && method === 'DELETE') return fromResult(await deleteMenuItem(db, id));
  }

  return errorResponse(404, 'Not found.');
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  // Public API, called cross-origin by the Vercel site.
  if (path === '/api/menu' || path === '/api/orders') {
    const cors = corsHeaders(request, env);
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (path === '/api/menu' && method === 'GET') {
      return json(await loadMenu(env.DB), 200, { ...cors, 'Cache-Control': 'public, max-age=30' });
    }
    if (path === '/api/orders' && method === 'POST') {
      const { body, error } = await readJson(request);
      if (error) return errorResponse(400, 'Please check the order details and try again.', cors);
      const result = await submitOrder(env, body);
      return json(result.body, result.status, cors);
    }
    return errorResponse(405, 'Method not allowed.', { ...cors, Allow: path === '/api/menu' ? 'GET' : 'POST' });
  }

  if (path === '/api/health') return json({ ok: true });
  // Logo shown on the Cloudflare Access login page (set as the organization's login_design.logo_path).
  if (path === '/brand/login-logo.png' && method === 'GET') {
    return new Response(LOGIN_LOGO, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } });
  }
  if (path === '/') return Response.redirect(`${url.origin}/admin`, 302);
  if (path === '/signed-out' && method === 'GET') return signedOutPage();
  if (path.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) return serveMedia(env, path.slice('/media/'.length), request);

  // Everything below is admin-only.
  if (path === '/admin' || path.startsWith('/api/admin')) {
    const email = await getAdminEmail(request, env);
    if (!email) return path === '/admin' ? notAdminPage() : errorResponse(403, 'Admin sign-in needed.');
    if (path === '/admin') return method === 'GET' ? adminPage() : errorResponse(405, 'Method not allowed.');
    if (path === '/api/admin/session') {
      // Cloudflare Access ends the session at this path on the app's own host. Locally there is no Access, so no logout.
      const returnTo = encodeURIComponent(`${url.origin}/signed-out`);
      return json({ email, logoutUrl: env.ACCESS_AUD ? `/cdn-cgi/access/logout?returnTo=${returnTo}` : null });
    }
    return handleAdminApi(request, env, path);
  }

  return errorResponse(404, 'Not found.');
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error('Unhandled worker error', { message: error?.message });
      return errorResponse(500, 'Something went wrong. Please try again.');
    }
  },
};

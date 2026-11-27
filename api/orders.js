import { findMenuItem } from '../src/data/menu.js';
import { buildOrderEmailPayload } from '../shared/orderEmails.js';

const MAX_ITEMS = 100;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getCanonicalLines(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return null;
  const lines = [];
  for (const item of items) {
    const source = findMenuItem(clean(item?.id, 100));
    const quantity = Number(item?.quantity);
    if (!source || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
    let price = source.price;
    let variantLabel = '';
    if (source.variants) {
      const variant = source.variants.find((entry) => entry.id === clean(item?.variantId, 50));
      if (!variant) return null;
      price = variant.price;
      variantLabel = variant.label;
    }
    lines.push({ name: source.name, quantity, price, variantLabel });
  }
  return lines;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'Order notifications are temporarily unavailable.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const reference = clean(body.reference, 40);
  const idempotencyKey = clean(body.idempotencyKey, 100);
  const details = body.customer && typeof body.customer === 'object' ? {
    name: clean(body.customer.name, 120), phone: clean(body.customer.phone, 40), email: clean(body.customer.email, 254).toLowerCase(),
    address: clean(body.customer.address, 300), city: clean(body.customer.city, 120), postcode: clean(body.customer.postcode, 30), notes: clean(body.customer.notes, 500),
  } : null;
  const lines = getCanonicalLines(body.items);

  if (!/^CLEO-\d{6}-[0-9A-F]{6}$/.test(reference) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotencyKey) || !details || !validEmail(details.email) || !details.name || !details.phone || !details.address || !details.city || !details.postcode || !lines) {
    return json(res, 400, { error: 'Please check the order details and try again.' });
  }

  const payload = buildOrderEmailPayload({ reference, idempotencyKey, details, lines });

  let brevoResponse;
  try {
    brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: AbortSignal.timeout(15000), headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Brevo order notification transport failed', { name: error?.name || 'Error' });
    return json(res, 503, { error: 'The order service was interrupted. Please try again. Your order was not confirmed.' });
  }

  if (!brevoResponse.ok) {
    let errorCode = 'provider_error';
    try { errorCode = (await brevoResponse.json()).code || errorCode; } catch {}
    console.error('Brevo order notification failed', { status: brevoResponse.status, code: errorCode });
    return json(res, brevoResponse.status === 429 ? 503 : 502, { error: 'We could not send the order notification. Please try again.' });
  }

  const result = await brevoResponse.json();
  return json(res, 200, { status: 'submitted', reference, messageIds: result.messageIds || [result.messageId].filter(Boolean) });
}

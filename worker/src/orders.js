import { buildOrderEmailPayload } from '../../shared/orderEmails.js';
import { ORDER_STATUS_IDS } from '../../shared/orderStatus.js';
import { loadMenu } from './menu.js';
import { clean, orderTotal, parseOrderRequest, priceOrderLines } from './validation.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendOrderEmails(apiKey, payload, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Brevo order notification transport failed', { name: error?.name || 'Error' });
    return { ok: false, status: 503, error: 'The order service was interrupted. Please try again. Your order was not confirmed.' };
  }
  if (!response.ok) {
    let code = 'provider_error';
    try {
      code = (await response.json()).code || code;
    } catch {}
    console.error('Brevo order notification failed', { status: response.status, code });
    return { ok: false, status: response.status === 429 ? 503 : 502, error: 'We could not send the order notification. Please try again.' };
  }
  const result = await response.json().catch(() => ({}));
  return { ok: true, messageIds: result.messageIds || [result.messageId].filter(Boolean) };
}

// Saves (or updates) the order, then sends the Brevo emails.
// Returns { status, body } for the HTTP response.
export async function submitOrder(env, body, fetchImpl = fetch) {
  if (!env.BREVO_API_KEY) return { status: 503, body: { error: 'Order notifications are temporarily unavailable.' } };

  const request = parseOrderRequest(body);
  if (!request) return { status: 400, body: { error: 'Please check the order details and try again.' } };
  const { reference, idempotencyKey, details } = request;

  const menu = await loadMenu(env.DB);
  const priced = priceOrderLines(request.items, new Map(menu.items.map((item) => [item.id, item])));
  if (priced.error === 'unavailable') {
    return { status: 409, body: { error: `Sorry, ${priced.itemName} is sold out right now. Please remove it from your basket and try again.` } };
  }
  if (priced.error) return { status: 400, body: { error: 'Please check the order details and try again.' } };
  const { lines } = priced;

  const db = env.DB;
  const existing = await db.prepare('SELECT idempotency_key, status, notification_status FROM orders WHERE reference = ?').bind(reference).first();
  if (existing?.idempotency_key === idempotencyKey && existing.notification_status === 'sent') {
    // A retry of a submission that already went through: answer the same way, send nothing.
    return { status: 200, body: { status: 'submitted', reference, messageIds: [] } };
  }
  if (existing && existing.status !== 'pending_payment') {
    return { status: 409, body: { error: 'This order is already being prepared. Please contact Cleo’s Munchies to change it.' } };
  }

  const total = orderTotal(lines);
  await db.batch([
    db.prepare(
      `INSERT INTO orders (reference, idempotency_key, customer_name, customer_phone, customer_email, address, city, postcode, notes, total, notification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
       ON CONFLICT(reference) DO UPDATE SET
         idempotency_key = excluded.idempotency_key, customer_name = excluded.customer_name, customer_phone = excluded.customer_phone,
         customer_email = excluded.customer_email, address = excluded.address, city = excluded.city, postcode = excluded.postcode,
         notes = excluded.notes, total = excluded.total, notification_status = 'pending',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).bind(reference, idempotencyKey, details.name, details.phone, details.email, details.address, details.city, details.postcode, details.notes, total),
    db.prepare('DELETE FROM order_items WHERE order_reference = ?').bind(reference),
    ...lines.map((line, index) =>
      db.prepare('INSERT INTO order_items (order_reference, line_no, item_id, variant_id, name, variant_label, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(reference, index + 1, line.itemId, line.variantId, line.name, line.variantLabel, line.price, line.quantity),
    ),
  ]);

  const sent = await sendOrderEmails(env.BREVO_API_KEY, buildOrderEmailPayload({ reference, idempotencyKey, details, lines }), fetchImpl);
  await db.prepare(`UPDATE orders SET notification_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE reference = ?`)
    .bind(sent.ok ? 'sent' : 'failed', reference)
    .run();

  if (!sent.ok) return { status: sent.status, body: { error: sent.error } };
  return { status: 200, body: { status: 'submitted', reference, messageIds: sent.messageIds } };
}

function toOrder(row, items) {
  return {
    reference: row.reference,
    status: row.status,
    notificationStatus: row.notification_status,
    total: row.total,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      address: row.address,
      city: row.city,
      postcode: row.postcode,
      notes: row.notes,
    },
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

export async function listOrders(db, { status = '', query = '', limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const search = clean(query, 80);
  if (search) {
    conditions.push('(reference LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ? OR postcode LIKE ?)');
    const like = `%${search.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results: rows } = await db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params, Math.min(limit, 500)).all();
  if (!rows.length) return [];

  const placeholders = rows.map(() => '?').join(', ');
  const { results: itemRows } = await db
    .prepare(`SELECT * FROM order_items WHERE order_reference IN (${placeholders}) ORDER BY order_reference, line_no`)
    .bind(...rows.map((row) => row.reference))
    .all();
  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.order_reference) ?? [];
    list.push({ itemId: item.item_id, variantId: item.variant_id, name: item.name, variantLabel: item.variant_label, price: item.price, quantity: item.quantity });
    itemsByOrder.set(item.order_reference, list);
  }
  return rows.map((row) => toOrder(row, itemsByOrder.get(row.reference) ?? []));
}

export async function updateOrder(db, reference, body) {
  const sets = [];
  const params = [];
  if (body?.status !== undefined) {
    if (!ORDER_STATUS_IDS.includes(body.status)) return { error: 'Unknown order status.' };
    sets.push('status = ?');
    params.push(body.status);
  }
  if (body?.adminNote !== undefined) {
    sets.push('admin_note = ?');
    params.push(clean(body.adminNote, 1000));
  }
  if (!sets.length) return { error: 'Nothing to update.' };
  const result = await db
    .prepare(`UPDATE orders SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE reference = ?`)
    .bind(...params, reference)
    .run();
  return result.meta.changes ? { reference } : { error: 'That order could not be found.', status: 404 };
}

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
    return {
      ok: false,
      // Brevo answers a reused idempotency key this way without sending again: the earlier request was accepted.
      duplicate: code === 'duplicate_parameter',
      status: response.status === 429 ? 503 : 502,
      error: 'We could not send the order notification. Please try again.',
    };
  }
  const result = await response.json().catch(() => ({}));
  return { ok: true, messageIds: result.messageIds || [result.messageId].filter(Boolean) };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toResponseItems(lines) {
  return lines.map((line) => ({
    key: line.variantId ? `${line.itemId}:${line.variantId}` : line.itemId,
    id: line.itemId,
    variantId: line.variantId,
    name: line.name,
    variantLabel: line.variantLabel,
    price: line.price,
    quantity: line.quantity,
  }));
}

async function storedLines(db, reference) {
  const { results } = await db.prepare('SELECT * FROM order_items WHERE order_reference = ? ORDER BY line_no').bind(reference).all();
  return results.map((row) => ({ itemId: row.item_id, variantId: row.variant_id, name: row.name, variantLabel: row.variant_label, price: row.price, quantity: row.quantity }));
}

const NOT_EDITABLE = { status: 409, body: { error: 'This order is already being prepared. Please contact Cleo’s Munchies to change it.' } };

// Saves (or updates) the order, then sends the Brevo emails.
// Returns { status, body } for the HTTP response. A successful body carries the order exactly as
// saved and emailed (server prices), so the customer's payment screen shows the same amounts.
export async function submitOrder(env, body, fetchImpl = fetch) {
  if (!env.BREVO_API_KEY) return { status: 503, body: { error: 'Order notifications are temporarily unavailable.' } };

  const request = parseOrderRequest(body);
  if (!request) return { status: 400, body: { error: 'Please check the order details and try again.' } };
  const { reference, idempotencyKey, details } = request;
  const tokenHash = await sha256Hex(request.editToken);
  const db = env.DB;

  const existing = await db.prepare('SELECT idempotency_key, status, notification_status, edit_token_hash, total FROM orders WHERE reference = ?').bind(reference).first();
  if (existing && existing.edit_token_hash !== tokenHash) {
    // Only the browser that created an order can change it.
    return { status: 409, body: { error: 'This order can’t be changed online. Please contact Cleo’s Munchies.' } };
  }
  if (existing?.idempotency_key === idempotencyKey && existing.notification_status === 'sent') {
    // A retry of a submission that already went through: answer with what was saved, send nothing,
    // and skip today's menu checks so a dish selling out since then cannot block it.
    const lines = await storedLines(db, reference);
    return { status: 200, body: { status: 'submitted', reference, total: existing.total, items: toResponseItems(lines), messageIds: [] } };
  }
  if (existing && existing.status !== 'pending_payment') return NOT_EDITABLE;

  const menu = await loadMenu(db);
  const priced = priceOrderLines(request.items, new Map(menu.items.map((item) => [item.id, item])));
  if (priced.error === 'unavailable') {
    return { status: 409, body: { error: `Sorry, ${priced.itemName} is sold out right now. Please remove it from your basket and try again.` } };
  }
  if (priced.error) return { status: 400, body: { error: 'Please check the order details and try again.' } };
  const { lines } = priced;
  const total = orderTotal(lines);

  // One transaction. The order row only changes while it is still awaiting payment and owned by this
  // edit token; the item statements check the same condition, so a paid order is never rewritten.
  const editable = `EXISTS (SELECT 1 FROM orders WHERE reference = ? AND idempotency_key = ? AND status = 'pending_payment')`;
  const [upsert] = await db.batch([
    db.prepare(
      `INSERT INTO orders (reference, idempotency_key, edit_token_hash, customer_name, customer_phone, customer_email, address, city, postcode, notes, total, notification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
       ON CONFLICT(reference) DO UPDATE SET
         idempotency_key = excluded.idempotency_key, customer_name = excluded.customer_name, customer_phone = excluded.customer_phone,
         customer_email = excluded.customer_email, address = excluded.address, city = excluded.city, postcode = excluded.postcode,
         notes = excluded.notes, total = excluded.total, notification_status = 'pending',
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE orders.status = 'pending_payment' AND orders.edit_token_hash = excluded.edit_token_hash`,
    ).bind(reference, idempotencyKey, tokenHash, details.name, details.phone, details.email, details.address, details.city, details.postcode, details.notes, total),
    db.prepare(`DELETE FROM order_items WHERE order_reference = ? AND ${editable}`).bind(reference, reference, idempotencyKey),
    ...lines.map((line, index) =>
      db.prepare(
        `INSERT INTO order_items (order_reference, line_no, item_id, variant_id, name, variant_label, price, quantity)
         SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${editable}`,
      ).bind(reference, index + 1, line.itemId, line.variantId, line.name, line.variantLabel, line.price, line.quantity, reference, idempotencyKey),
    ),
  ]);
  if (!upsert.meta.changes) return NOT_EDITABLE;

  let sent = await sendOrderEmails(env.BREVO_API_KEY, buildOrderEmailPayload({ reference, idempotencyKey, details, lines }), fetchImpl);
  if (!sent.ok && sent.duplicate && existing?.idempotency_key === idempotencyKey) {
    // An earlier attempt with this same key reached Brevo even though we recorded a failure.
    sent = { ok: true, messageIds: [] };
  }
  // Only record the result against this submission; a newer edit of the same order may have replaced it.
  await db.prepare(`UPDATE orders SET notification_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE reference = ? AND idempotency_key = ?`)
    .bind(sent.ok ? 'sent' : 'failed', reference, idempotencyKey)
    .run();

  if (!sent.ok) return { status: sent.status, body: { error: sent.error } };
  return { status: 200, body: { status: 'submitted', reference, total, items: toResponseItems(lines), messageIds: sent.messageIds } };
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

const D1_MAX_BOUND_PARAMETERS = 100;
export const ORDERS_PAGE_SIZE = 50;

// Newest first. `before` is the cursor from the previous page ("createdAt|reference").
// Returns { orders, nextCursor }.
export async function listOrders(db, { status = '', query = '', before = '', limit = ORDERS_PAGE_SIZE } = {}) {
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
  const [cursorTime, cursorReference] = String(before).split('|');
  if (cursorTime && cursorReference) {
    conditions.push('(created_at < ? OR (created_at = ? AND reference < ?))');
    params.push(cursorTime, cursorTime, cursorReference);
  }
  const pageSize = Math.max(1, Math.min(Number(limit) || ORDERS_PAGE_SIZE, D1_MAX_BOUND_PARAMETERS));
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results: rows } = await db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC, reference DESC LIMIT ?`)
    .bind(...params, pageSize)
    .all();
  if (!rows.length) return { orders: [], nextCursor: null };

  // D1 allows at most 100 bound parameters per query, so fetch items in chunks.
  const itemsByOrder = new Map();
  for (let start = 0; start < rows.length; start += D1_MAX_BOUND_PARAMETERS) {
    const references = rows.slice(start, start + D1_MAX_BOUND_PARAMETERS).map((row) => row.reference);
    const { results: itemRows } = await db
      .prepare(`SELECT * FROM order_items WHERE order_reference IN (${references.map(() => '?').join(', ')}) ORDER BY order_reference, line_no`)
      .bind(...references)
      .all();
    for (const item of itemRows) {
      const list = itemsByOrder.get(item.order_reference) ?? [];
      list.push({ itemId: item.item_id, variantId: item.variant_id, name: item.name, variantLabel: item.variant_label, price: item.price, quantity: item.quantity });
      itemsByOrder.set(item.order_reference, list);
    }
  }
  const last = rows[rows.length - 1];
  return {
    orders: rows.map((row) => toOrder(row, itemsByOrder.get(row.reference) ?? [])),
    nextCursor: rows.length === pageSize ? `${last.created_at}|${last.reference}` : null,
  };
}

// How many orders are in each status, for the filter chips.
export async function countOrders(db) {
  const { results } = await db.prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status').all();
  return Object.fromEntries(results.map((row) => [row.status, row.count]));
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

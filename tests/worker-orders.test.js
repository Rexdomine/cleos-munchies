import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { listOrders, submitOrder, updateOrder } from '../worker/src/orders.js';
import { createTestD1 } from './helpers/d1.js';

const KEY_A = '11111111-1111-4111-8111-111111111111';
const KEY_B = '22222222-2222-4222-8222-222222222222';
const TOKEN = '33333333-3333-4333-8333-333333333333';
const OTHER_TOKEN = '44444444-4444-4444-8444-444444444444';

function orderBody(overrides = {}) {
  return {
    reference: 'CLEO-261127-C0FFEE',
    idempotencyKey: KEY_A,
    editToken: TOKEN,
    items: [
      { id: 'grilled-chicken', quantity: 2, price: 1 }, // client price must be ignored
      { id: 'jollof-rice', variantId: 'full', quantity: 1 },
    ],
    customer: { name: 'Ada', phone: '07939 427752', email: 'Ada@Example.com', address: '10 Market Road', city: 'Chichester', postcode: 'PO19 1AA', notes: 'Ring bell' },
    ...overrides,
  };
}

function fakeBrevo({ ok = true, status = 200, throws = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, payload: JSON.parse(options.body) });
    if (throws) throw new TypeError('fetch failed');
    return { ok, status, async json() { return ok ? { messageIds: ['op', 'cust'] } : { code: 'bad' }; } };
  };
  return { calls, fetchImpl };
}

describe('Worker order submission', () => {
  let env;
  beforeEach(() => {
    env = { DB: createTestD1(), BREVO_API_KEY: 'test-only' };
  });

  it('saves the order with server-side prices and sends both emails', async () => {
    const brevo = fakeBrevo();
    const result = await submitOrder(env, orderBody(), brevo.fetchImpl);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.messageIds, ['op', 'cust']);

    const [order] = (await listOrders(env.DB)).orders;
    assert.equal(order.reference, 'CLEO-261127-C0FFEE');
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.notificationStatus, 'sent');
    assert.equal(order.customer.email, 'ada@example.com');
    assert.equal(order.total, 2 * 2500 + 14000); // grilled chicken £25 x2 + full jollof tray £140
    assert.deepEqual(order.items.map((item) => [item.name, item.variantLabel, item.price, item.quantity]), [
      ['Grilled Chicken', '', 2500, 2],
      ['Jollof Rice', 'Full tray · serves 20–25', 14000, 1],
    ]);

    assert.equal(brevo.calls.length, 1);
    assert.equal(brevo.calls[0].payload.headers.idempotencyKey, KEY_A);
    assert.equal(brevo.calls[0].payload.messageVersions[1].to[0].email, 'ada@example.com');
  });

  it('answers a repeated submission without emailing twice', async () => {
    const brevo = fakeBrevo();
    await submitOrder(env, orderBody(), brevo.fetchImpl);
    const retry = await submitOrder(env, orderBody(), brevo.fetchImpl);
    assert.equal(retry.status, 200);
    assert.equal(brevo.calls.length, 1);
    assert.equal(((await listOrders(env.DB)).orders).length, 1);
  });

  it('keeps a failed-email order flagged and resends on retry', async () => {
    const failed = await submitOrder(env, orderBody(), fakeBrevo({ ok: false, status: 400 }).fetchImpl);
    assert.equal(failed.status, 502);
    assert.equal(((await listOrders(env.DB)).orders)[0].notificationStatus, 'failed');

    const down = await submitOrder(env, orderBody(), fakeBrevo({ throws: true }).fetchImpl);
    assert.equal(down.status, 503);
    assert.match(down.body.error, /not confirmed/);

    const brevo = fakeBrevo();
    const retry = await submitOrder(env, orderBody(), brevo.fetchImpl);
    assert.equal(retry.status, 200);
    assert.equal(brevo.calls.length, 1);
    assert.equal(((await listOrders(env.DB)).orders)[0].notificationStatus, 'sent');
  });

  it('updates the same order when the customer edits their details', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    const edited = orderBody({ idempotencyKey: KEY_B, customer: { ...orderBody().customer, address: '22 New Street' }, items: [{ id: 'meat-pie', quantity: 3 }] });
    const brevo = fakeBrevo();
    assert.equal((await submitOrder(env, edited, brevo.fetchImpl)).status, 200);
    const orders = (await listOrders(env.DB)).orders;
    assert.equal(orders.length, 1);
    assert.equal(orders[0].customer.address, '22 New Street');
    assert.deepEqual(orders[0].items.map((item) => item.name), ['Meat Pie']);
    assert.equal(brevo.calls.length, 1);
  });

  it('refuses to change an order that Cleo has already moved on', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    await updateOrder(env.DB, 'CLEO-261127-C0FFEE', { status: 'paid' });
    const result = await submitOrder(env, orderBody({ idempotencyKey: KEY_B }), fakeBrevo().fetchImpl);
    assert.equal(result.status, 409);
  });

  it('rejects sold-out dishes, unknown dishes and bad sizes', async () => {
    env.DB.raw.exec("UPDATE menu_items SET available = 0 WHERE id = 'meat-pie'");
    const soldOut = await submitOrder(env, orderBody({ items: [{ id: 'meat-pie', quantity: 1 }] }), fakeBrevo().fetchImpl);
    assert.equal(soldOut.status, 409);
    assert.match(soldOut.body.error, /Meat Pie is sold out/);

    for (const items of [[{ id: 'not-a-dish', quantity: 1 }], [{ id: 'jollof-rice', variantId: 'huge', quantity: 1 }], [{ id: 'meat-pie', quantity: 0 }], []]) {
      assert.equal((await submitOrder(env, orderBody({ items }), fakeBrevo().fetchImpl)).status, 400);
    }
    assert.equal(((await listOrders(env.DB)).orders).length, 0);
  });

  it('rejects malformed customer details and a missing Brevo key', async () => {
    assert.equal((await submitOrder(env, orderBody({ reference: 'nope' }), fakeBrevo().fetchImpl)).status, 400);
    assert.equal((await submitOrder(env, orderBody({ customer: { ...orderBody().customer, phone: '123' } }), fakeBrevo().fetchImpl)).status, 400);
    assert.equal((await submitOrder(env, orderBody({ customer: { ...orderBody().customer, email: 'x' } }), fakeBrevo().fetchImpl)).status, 400);
    assert.equal((await submitOrder({ DB: env.DB }, orderBody(), fakeBrevo().fetchImpl)).status, 503);
  });
});

describe('Worker order admin', () => {
  it('filters, searches and updates orders', async () => {
    const env = { DB: createTestD1(), BREVO_API_KEY: 'test-only' };
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    await submitOrder(env, orderBody({ reference: 'CLEO-261127-BEEF01', customer: { ...orderBody().customer, name: 'Bola' } }), fakeBrevo().fetchImpl);

    assert.equal(((await listOrders(env.DB, { query: 'bola' }))).orders.length, 1);
    assert.equal(((await listOrders(env.DB, { query: 'PO19' }))).orders.length, 2);

    assert.deepEqual(await updateOrder(env.DB, 'CLEO-261127-BEEF01', { status: 'paid', adminNote: 'Paid by Monzo' }), { reference: 'CLEO-261127-BEEF01' });
    const [paid] = (await listOrders(env.DB, { status: 'paid' })).orders;
    assert.equal(paid.reference, 'CLEO-261127-BEEF01');
    assert.equal(paid.adminNote, 'Paid by Monzo');

    assert.match((await updateOrder(env.DB, 'CLEO-261127-BEEF01', { status: 'eaten' })).error, /Unknown/);
    assert.equal((await updateOrder(env.DB, 'CLEO-000000-000000', { status: 'paid' })).status, 404);
  });
});

describe('Worker order submission edge cases', () => {
  let env;
  beforeEach(() => {
    env = { DB: createTestD1(), BREVO_API_KEY: 'test-only' };
  });

  it('returns the order as saved and emailed, with server prices', async () => {
    const result = await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    assert.equal(result.body.total, 2 * 2500 + 14000);
    assert.deepEqual(result.body.items.map((item) => [item.key, item.price, item.quantity]), [
      ['grilled-chicken', 2500, 2],
      ['jollof-rice:full', 14000, 1],
    ]);
  });

  it('only lets the original browser change an order', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    const hijack = orderBody({ idempotencyKey: KEY_B, editToken: OTHER_TOKEN, customer: { ...orderBody().customer, address: 'Somewhere else' } });
    const result = await submitOrder(env, hijack, fakeBrevo().fetchImpl);
    assert.equal(result.status, 409);
    assert.equal((await listOrders(env.DB)).orders[0].customer.address, '10 Market Road');
    assert.equal((await submitOrder(env, orderBody({ editToken: undefined }), fakeBrevo().fetchImpl)).status, 400);
  });

  it('answers a retry of a completed order even if a dish sold out since', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    env.DB.raw.exec("UPDATE menu_items SET available = 0 WHERE id = 'grilled-chicken'");
    const brevo = fakeBrevo();
    const retry = await submitOrder(env, orderBody(), brevo.fetchImpl);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.total, 19000);
    assert.equal(brevo.calls.length, 0);
  });

  it('does not rewrite an order that was marked paid while the edit was in progress', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    const batch = env.DB.batch.bind(env.DB);
    env.DB.batch = async (statements) => {
      env.DB.raw.exec("UPDATE orders SET status = 'paid'");
      return batch(statements);
    };
    const edited = orderBody({ idempotencyKey: KEY_B, items: [{ id: 'meat-pie', quantity: 9 }] });
    const result = await submitOrder(env, edited, fakeBrevo().fetchImpl);
    assert.equal(result.status, 409);
    const [order] = (await listOrders(env.DB)).orders;
    assert.equal(order.status, 'paid');
    assert.deepEqual(order.items.map((item) => item.name), ['Grilled Chicken', 'Jollof Rice']);
  });

  it('treats Brevo duplicate-key replies on a retry as already sent', async () => {
    await submitOrder(env, orderBody(), fakeBrevo({ throws: true }).fetchImpl); // response lost, recorded as failed
    const duplicate = async () => ({ ok: false, status: 400, async json() { return { code: 'duplicate_parameter' }; } });
    const retry = await submitOrder(env, orderBody(), duplicate);
    assert.equal(retry.status, 200);
    assert.equal((await listOrders(env.DB)).orders[0].notificationStatus, 'sent');
  });

  it('records each email result against its own submission only', async () => {
    let edit;
    // While the first submission waits on Brevo, an edit replaces the order and its email fails.
    const slowFirst = async (url, options) => {
      edit = await submitOrder(env, orderBody({ idempotencyKey: KEY_B, customer: { ...orderBody().customer, notes: 'Changed' } }), fakeBrevo({ ok: false, status: 400 }).fetchImpl);
      return fakeBrevo().fetchImpl(url, options);
    };
    const first = await submitOrder(env, orderBody(), slowFirst);
    assert.equal(first.status, 200);
    assert.equal(edit.status, 502);
    const [order] = (await listOrders(env.DB)).orders;
    assert.equal(order.customer.notes, 'Changed');
    assert.equal(order.notificationStatus, 'failed'); // not overwritten by the older submission's success
  });
});

describe('Worker order listing', () => {
  it('pages through more orders than D1 allows in one IN query', async () => {
    const env = { DB: createTestD1() };
    const insertOrder = env.DB.raw.prepare(
      "INSERT INTO orders (reference, idempotency_key, customer_name, customer_phone, customer_email, address, city, postcode, total, created_at) VALUES (?, 'k', 'N', '07939427752', 'a@b.co', 'A', 'C', 'P', 100, ?)",
    );
    const insertItem = env.DB.raw.prepare("INSERT INTO order_items VALUES (?, 1, 'meat-pie', '', 'Meat Pie', '', 100, 1)");
    for (let i = 0; i < 130; i += 1) {
      const reference = `CLEO-261127-${String(i).padStart(6, '0')}`;
      insertOrder.run(reference, `2026-11-27T10:00:00.${String(i % 3).padStart(3, '0')}Z`); // deliberate timestamp ties
      insertItem.run(reference);
    }
    const seen = new Set();
    let cursor = '';
    for (let page = 0; page < 10; page += 1) {
      const result = await listOrders(env.DB, { before: cursor, limit: 100 });
      result.orders.forEach((order) => {
        assert.equal(order.items.length, 1);
        seen.add(order.reference);
      });
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    assert.equal(seen.size, 130);
  });
});

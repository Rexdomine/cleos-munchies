import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { listOrders, submitOrder, updateOrder } from '../worker/src/orders.js';
import { createTestD1 } from './helpers/d1.js';

const KEY_A = '11111111-1111-4111-8111-111111111111';
const KEY_B = '22222222-2222-4222-8222-222222222222';

function orderBody(overrides = {}) {
  return {
    reference: 'CLEO-261127-C0FFEE',
    idempotencyKey: KEY_A,
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

    const [order] = await listOrders(env.DB);
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
    assert.equal((await listOrders(env.DB)).length, 1);
  });

  it('keeps a failed-email order flagged and resends on retry', async () => {
    const failed = await submitOrder(env, orderBody(), fakeBrevo({ ok: false, status: 400 }).fetchImpl);
    assert.equal(failed.status, 502);
    assert.equal((await listOrders(env.DB))[0].notificationStatus, 'failed');

    const down = await submitOrder(env, orderBody(), fakeBrevo({ throws: true }).fetchImpl);
    assert.equal(down.status, 503);
    assert.match(down.body.error, /not confirmed/);

    const brevo = fakeBrevo();
    const retry = await submitOrder(env, orderBody(), brevo.fetchImpl);
    assert.equal(retry.status, 200);
    assert.equal(brevo.calls.length, 1);
    assert.equal((await listOrders(env.DB))[0].notificationStatus, 'sent');
  });

  it('updates the same order when the customer edits their details', async () => {
    await submitOrder(env, orderBody(), fakeBrevo().fetchImpl);
    const edited = orderBody({ idempotencyKey: KEY_B, customer: { ...orderBody().customer, address: '22 New Street' }, items: [{ id: 'meat-pie', quantity: 3 }] });
    const brevo = fakeBrevo();
    assert.equal((await submitOrder(env, edited, brevo.fetchImpl)).status, 200);
    const orders = await listOrders(env.DB);
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
    assert.equal((await listOrders(env.DB)).length, 0);
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

    assert.equal((await listOrders(env.DB, { query: 'bola' })).length, 1);
    assert.equal((await listOrders(env.DB, { query: 'PO19' })).length, 2);

    assert.deepEqual(await updateOrder(env.DB, 'CLEO-261127-BEEF01', { status: 'paid', adminNote: 'Paid by Monzo' }), { reference: 'CLEO-261127-BEEF01' });
    const [paid] = await listOrders(env.DB, { status: 'paid' });
    assert.equal(paid.reference, 'CLEO-261127-BEEF01');
    assert.equal(paid.adminNote, 'Paid by Monzo');

    assert.match((await updateOrder(env.DB, 'CLEO-261127-BEEF01', { status: 'eaten' })).error, /Unknown/);
    assert.equal((await updateOrder(env.DB, 'CLEO-000000-000000', { status: 'paid' })).status, 404);
  });
});

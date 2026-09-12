import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/orders.js';

function responseCapture() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    send(body) { this.body = JSON.parse(body); return this; },
  };
}

function requestBody() {
  return {
    method: 'POST',
    body: {
      reference: 'CLEO-260912-C0FFEE',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      items: [{ id: 'grilled-chicken', quantity: 2 }],
      customer: {
        name: '<Ada>', phone: '07939 427752', email: 'ada@example.com', address: '10 Market Road',
        city: 'Chichester', postcode: 'PO19 1AA', notes: 'Ring bell',
      },
    },
  };
}

test('Brevo email templates preserve Cleo branding and recipient intent', async () => {
  const previousKey = process.env.BREVO_API_KEY;
  const previousFetch = global.fetch;
  process.env.BREVO_API_KEY = 'test-only';
  let providerPayload;
  global.fetch = async (_url, options) => {
    providerPayload = JSON.parse(options.body);
    return { ok: true, async json() { return { messageIds: ['operator-id', 'customer-id'] }; } };
  };

  try {
    const res = responseCapture();
    await handler(requestBody(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.messageIds, ['operator-id', 'customer-id']);
    assert.equal(providerPayload.sender.email, 'yummy@cleosmunchies.co.uk');
    assert.equal(providerPayload.messageVersions.length, 2);
    const [operator, customer] = providerPayload.messageVersions;
    assert.match(customer.htmlContent, /cleos-munchies\.vercel\.app\/images\/cleos-logo\.png/);
    assert.match(customer.htmlContent, /#f7f1e8/);
    assert.match(customer.htmlContent, /#bd392e/);
    assert.match(customer.htmlContent, /Important — payment step/);
    assert.match(customer.htmlContent, /1 · Copy this order code/);
    assert.match(customer.htmlContent, /2 · Paste it into Monzo payment Notes/);
    assert.match(customer.htmlContent, /user-select:all/);
    assert.match(customer.htmlContent, /Open Monzo securely/);
    assert.match(customer.textContent, /1\. COPY this exact order code/);
    assert.match(customer.textContent, /2\. PASTE it into Monzo payment Notes/);
    assert.match(customer.htmlContent, /Payment is not confirmed until we manually match/);
    assert.match(customer.htmlContent, /&lt;Ada&gt;/);
    assert.match(customer.textContent, /CLEO-260912-C0FFEE/);
    assert.match(operator.htmlContent, /Kitchen notification/);
    assert.doesNotMatch(operator.htmlContent, /Continue to Monzo/);
    assert.match(operator.textContent, /Ring bell/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = previousKey;
  }
});

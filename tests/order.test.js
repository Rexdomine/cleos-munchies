import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MONZO_PAYMENT_URL,
  PREORDER_READY_WITHIN_HOURS,
  createOrderReference,
  createReviewOrder,
  applyConfirmedOrder,
  prepareOrderForSubmission,
  refreshOrderForSubmission,
  validateDeliveryDetails,
} from '../src/domain/order.js';

const validDetails = {
  name: 'Ada Ejiogu',
  phone: '07939 427752',
  email: 'ada@example.com',
  address: '10 Market Road',
  city: 'Chichester',
  postcode: 'PO19 1AA',
  notes: '',
};

const cart = [
  { id: 'grilled-chicken', key: 'grilled-chicken', name: 'Grilled Chicken', price: 2500, quantity: 1 },
];

describe('order domain', () => {
  it('uses the exact approved Monzo hosted-payment link', () => {
    assert.equal(
      MONZO_PAYMENT_URL,
      'https://monzo.me/cleopatraejiogu?h=EltkP8&account_type=personal',
    );
  });

  it('validates the required delivery fields without discarding customer values', () => {
    const result = validateDeliveryDetails({ ...validDetails, name: '', phone: '123' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.name, 'Please enter your name.');
    assert.equal(result.errors.phone, 'Enter a valid UK phone number.');
    assert.equal(result.values.city, 'Chichester');
  });

  it('accepts complete delivery details', () => {
    assert.deepEqual(validateDeliveryDetails(validDetails).errors, {});
  });

  it('does not accept or retain a customer-selected delivery date', () => {
    const result = validateDeliveryDetails({ ...validDetails, deliveryDate: '2026-09-18' });
    assert.deepEqual(result.errors, {});
    assert.equal('deliveryDate' in result.values, false);
  });

  it('creates a readable stable-format reference from injected time and entropy', () => {
    const reference = createOrderReference({
      now: new Date('2026-09-10T12:00:00Z'),
      randomBytes: new Uint8Array([10, 11, 12]),
    });
    assert.equal(reference, 'CLEO-260910-0A0B0C');
  });

  it('creates a truthful review-only order while Brevo is deferred', () => {
    const order = createReviewOrder({
      cart,
      details: validDetails,
      reference: 'CLEO-260910-0A0B0C',
    });
    assert.equal(order.status, 'review_only');
    assert.equal(order.notification.status, 'not_configured');
    assert.equal(order.notification.sent, false);
    assert.equal(order.payment.url, MONZO_PAYMENT_URL);
    assert.equal(order.total, 2500);
    assert.equal(order.preorder.readyWithinHours, PREORDER_READY_WITHIN_HOURS);
    assert.equal(order.preorder.standard, 'ready_within_48_hours');
    assert.notEqual(order.status, 'pending_payment');
  });

  it('refreshes a corrected resubmission without changing the order reference', () => {
    const order = createReviewOrder({ cart, details: validDetails, reference: 'CLEO-260910-0A0B0C' });
    const corrected = refreshOrderForSubmission(order, { ...validDetails, name: 'Ada Updated', notes: 'Leave at door' });
    assert.equal(corrected.reference, order.reference);
    assert.deepEqual(corrected.items, order.items);
    assert.notEqual(corrected.idempotencyKey, order.idempotencyKey);
    assert.equal(corrected.customer.name, 'Ada Updated');
    assert.equal(corrected.customer.notes, 'Leave at door');
  });

  it('reuses the idempotency key when retrying unchanged details after an ambiguous failure', () => {
    const order = createReviewOrder({ cart, details: validDetails, reference: 'CLEO-260910-0A0B0C' });
    const retry = prepareOrderForSubmission(order, { ...validDetails });
    assert.equal(retry.idempotencyKey, order.idempotencyKey);
    const edited = prepareOrderForSubmission(order, { ...validDetails, notes: 'Leave at door' });
    assert.notEqual(edited.idempotencyKey, order.idempotencyKey);
  });

  it('rejects order creation with an empty cart', () => {
    assert.throws(
      () => createReviewOrder({ cart: [], details: validDetails, reference: 'CLEO-260910-0A0B0C' }),
      /cart is empty/i,
    );
  });

  it('rebuilds a pending order when the basket changes, keeping its reference and edit token', () => {
    const order = createReviewOrder({ cart, details: validDetails, reference: 'CLEO-260910-0A0B0C' });
    assert.match(order.editToken, /^[0-9a-f-]{36}$/);
    const changed = [{ ...cart[0], quantity: 3 }];
    const rebuilt = prepareOrderForSubmission(order, { ...validDetails }, changed);
    assert.equal(rebuilt.reference, order.reference);
    assert.equal(rebuilt.editToken, order.editToken);
    assert.notEqual(rebuilt.idempotencyKey, order.idempotencyKey);
    assert.deepEqual(rebuilt.items.map((line) => line.quantity), [3]);
    assert.equal(rebuilt.total, 7500);
    // Same basket and details: same submission, so a retry cannot duplicate it.
    assert.equal(prepareOrderForSubmission(order, { ...validDetails }, cart), order);
    // Empty basket (cleared after a successful order): keep the saved items.
    assert.deepEqual(prepareOrderForSubmission(order, { ...validDetails, notes: 'Gate 2' }, []).items, order.items);
  });

  it('shows the confirmed server prices when the order API returns them', () => {
    const order = createReviewOrder({ cart, details: validDetails, reference: 'CLEO-260910-0A0B0C' });
    const confirmed = applyConfirmedOrder(order, { total: 999, items: [{ key: 'x', name: 'X', price: 999, quantity: 1 }] });
    assert.equal(confirmed.total, 999);
    assert.equal(confirmed.reference, order.reference);
    assert.equal(applyConfirmedOrder(order, { status: 'submitted' }), order);
  });
});


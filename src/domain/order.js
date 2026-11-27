import { cartSubtotal } from './cart.js';

export const MONZO_PAYMENT_URL =
  'https://monzo.me/cleopatraejiogu?h=EltkP8&account_type=personal';

export const PREORDER_READY_WITHIN_HOURS = 48;

const requiredMessages = {
  name: 'Please enter your name.',
  phone: 'Please enter your phone number.',
  email: 'Please enter your email address.',
  address: 'Please enter the delivery address.',
  city: 'Please enter the town or city.',
  postcode: 'Please enter the postcode.',
};

export function validateDeliveryDetails(input) {
  const normalizedValues = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
  // Delivery timing is a Cleo’s Munchies standard, not a customer-selected field.
  const { deliveryDate: _legacyDeliveryDate, ...values } = normalizedValues;
  const errors = {};

  for (const [field, message] of Object.entries(requiredMessages)) {
    if (!values[field]) errors[field] = message;
  }

  const normalizedPhone = String(values.phone ?? '').replace(/[\s()-]/g, '');
  if (values.phone && !/^(?:\+44|0)\d{9,10}$/.test(normalizedPhone)) {
    errors.phone = 'Enter a valid UK phone number.';
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address or leave it blank.';
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
}

export function createOrderReference({ now = new Date(), randomBytes } = {}) {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(3));
  const date = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('');
  const entropy = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `CLEO-${date}-${entropy}`;
}

export function createOrderIdempotencyKey() {
  return crypto.randomUUID();
}

export function createReviewOrder({ cart, details, reference }) {
  if (!cart.length) throw new Error('Cannot create an order because the cart is empty.');
  const validation = validateDeliveryDetails(details);
  if (!validation.valid) throw new Error('Cannot create an order with invalid delivery details.');
  if (!reference) throw new Error('Cannot create an order without a reference.');

  return {
    reference,
    idempotencyKey: createOrderIdempotencyKey(),
    // Private to this browser. The order API only lets the same token change this order later.
    editToken: createOrderIdempotencyKey(),
    createdAt: new Date().toISOString(),
    status: 'review_only',
    items: cart.map((line) => ({ ...line })),
    customer: validation.values,
    preorder: {
      standard: 'ready_within_48_hours',
      readyWithinHours: PREORDER_READY_WITHIN_HOURS,
    },
    total: cartSubtotal(cart),
    notification: {
      provider: 'brevo',
      status: 'not_configured',
      sent: false,
    },
    payment: {
      provider: 'monzo',
      url: MONZO_PAYMENT_URL,
      status: 'not_verified',
    },
  };
}

// A changed order gets a new idempotency key (the reference and edit token stay the same).
// Pass `cart` to replace the items and total as well.
export function refreshOrderForSubmission(order, details, cart) {
  if (!order) throw new Error('Cannot refresh an order that does not exist.');
  return {
    ...order,
    idempotencyKey: createOrderIdempotencyKey(),
    customer: { ...details },
    ...(cart ? { items: cart.map((line) => ({ ...line })), total: cartSubtotal(cart) } : {}),
  };
}

function sameLines(items, cart) {
  const summary = (lines) => lines.map((line) => `${line.key}:${line.quantity}:${line.price}`).join('|');
  return summary(items) === summary(cart);
}

// Decides what to send when an order is submitted again.
// - Same details and basket: resend the same order (same key), so a retry never duplicates it.
// - Details or basket changed: same reference, new key, current items.
// An empty basket (it is cleared after a successful order) keeps the order's saved items,
// so "Edit details" after submitting still works.
export function prepareOrderForSubmission(order, details, cart = []) {
  if (!order) throw new Error('Cannot prepare an order that does not exist.');
  const fields = ['name', 'phone', 'email', 'address', 'city', 'postcode', 'notes'];
  const detailsUnchanged = fields.every((field) => order.customer?.[field] === details[field]);
  const basketChanged = cart.length > 0 && !sameLines(order.items, cart);
  if (detailsUnchanged && !basketChanged) return order;
  return refreshOrderForSubmission(order, details, basketChanged ? cart : undefined);
}

// Uses the items and total the order API saved and emailed (server prices), when it returns them.
export function applyConfirmedOrder(order, response) {
  if (!Array.isArray(response?.items) || !Number.isInteger(response?.total)) return order;
  return { ...order, items: response.items, total: response.total };
}

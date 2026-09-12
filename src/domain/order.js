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
  // Delivery timing is a Close Munchies standard, not a customer-selected field.
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

export function refreshOrderForSubmission(order, details) {
  if (!order) throw new Error('Cannot refresh an order that does not exist.');
  return {
    ...order,
    idempotencyKey: createOrderIdempotencyKey(),
    customer: { ...details },
  };
}

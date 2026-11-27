// Pure request validation and pricing. No D1, fetch or Worker globals, so node --test can cover it.

export const MAX_ORDER_LINES = 100;
const REFERENCE_PATTERN = /^CLEO-\d{6}-[0-9A-F]{6}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_PHONE_PATTERN = /^(?:\+44|0)\d{9,10}$/;

export function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validEmail(value) {
  return EMAIL_PATTERN.test(value);
}

// Returns { reference, idempotencyKey, details, items } or null when the request is malformed.
export function parseOrderRequest(body) {
  if (!body || typeof body !== 'object') return null;
  const reference = clean(body.reference, 40);
  const idempotencyKey = clean(body.idempotencyKey, 100);
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : null;
  if (!customer || !Array.isArray(body.items)) return null;

  const details = {
    name: clean(customer.name, 120),
    phone: clean(customer.phone, 40),
    email: clean(customer.email, 254).toLowerCase(),
    address: clean(customer.address, 300),
    city: clean(customer.city, 120),
    postcode: clean(customer.postcode, 30),
    notes: clean(customer.notes, 500),
  };

  const phoneDigits = details.phone.replace(/[\s()-]/g, '');
  const valid =
    REFERENCE_PATTERN.test(reference) &&
    UUID_V4_PATTERN.test(idempotencyKey) &&
    details.name && details.address && details.city && details.postcode &&
    UK_PHONE_PATTERN.test(phoneDigits) &&
    validEmail(details.email) &&
    body.items.length > 0 && body.items.length <= MAX_ORDER_LINES;

  return valid ? { reference, idempotencyKey, details, items: body.items } : null;
}

// Prices order lines from the canonical menu (a Map of id -> item with optional variants).
// Returns { lines } on success or { error: 'invalid' | 'unavailable', itemName? }.
export function priceOrderLines(items, menuById) {
  const lines = [];
  for (const raw of items) {
    const item = menuById.get(clean(raw?.id, 100));
    const quantity = Number(raw?.quantity);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: 'invalid' };
    if (!item.available) return { error: 'unavailable', itemName: item.name };

    let price = item.price;
    let variantId = '';
    let variantLabel = '';
    if (item.variants?.length) {
      const variant = item.variants.find((entry) => entry.id === clean(raw?.variantId, 50));
      if (!variant) return { error: 'invalid' };
      price = variant.price;
      variantId = variant.id;
      variantLabel = variant.label;
    }
    if (!Number.isInteger(price) || price < 0) return { error: 'invalid' };
    lines.push({ itemId: item.id, variantId, name: item.name, variantLabel, price, quantity });
  }
  return { lines };
}

export function orderTotal(lines) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const MAX_PRICE = 1_000_000; // £10,000 in pence

function validPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PRICE;
}

// Validates an admin menu-item payload. Returns { item } or { error } with a readable message.
export function parseMenuItemInput(body, categories) {
  if (!body || typeof body !== 'object') return { error: 'Missing item details.' };
  const name = clean(body.name, 120);
  const category = clean(body.category, 60);
  const note = clean(body.note, 200);
  const image = clean(body.image, 200);
  const available = body.available === undefined ? true : Boolean(body.available);

  if (!name) return { error: 'Give the dish a name.' };
  if (!categories.includes(category)) return { error: 'Choose a menu category.' };
  if (image && !/^(\/images\/[\w./-]+|\/media\/menu\/[\w-]+\.webp|https:\/\/[^\s"'<>]+)$/.test(image)) {
    return { error: 'That photo link is not valid. Please upload the photo again.' };
  }

  let price = null;
  let variants = [];
  if (Array.isArray(body.variants) && body.variants.length > 0) {
    if (body.variants.length > 6) return { error: 'An item can have at most 6 sizes.' };
    const seen = new Set();
    for (const raw of body.variants) {
      const label = clean(raw?.label, 80);
      const variantPrice = Number(raw?.price);
      const id = clean(raw?.id, 40) || slugify(label);
      if (!label || !id) return { error: 'Every size needs a label.' };
      if (!validPrice(variantPrice)) return { error: `Check the price for “${label}”.` };
      if (seen.has(id)) return { error: 'Each size needs a different label.' };
      seen.add(id);
      variants.push({ id, label, price: variantPrice });
    }
  } else {
    price = Number(body.price);
    if (!validPrice(price)) return { error: 'Enter a price.' };
  }

  return { item: { name, category, note, image, available, price, variants } };
}

import { API_BASE } from './api.js';

const DEFAULT_ERROR = 'We could not send the order notification. Please try again.';
const CONNECTION_ERROR = 'The connection was interrupted. Your order was not confirmed. Please try again.';

// Sends the order to the Cloudflare Worker, which saves it and emails Cleo and the customer. Resolves with the relay payload or throws an Error
// whose message is safe to show the customer.
export async function submitOrder(order) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: order.reference,
        idempotencyKey: order.idempotencyKey,
        items: order.items,
        customer: order.customer,
      }),
    });
  } catch (error) {
    throw new Error(error instanceof TypeError ? CONNECTION_ERROR : error?.message || DEFAULT_ERROR);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || DEFAULT_ERROR);
  return payload;
}

// Order lifecycle used by the Worker API and the admin UI.
// "paid" is only ever set by an admin after matching the Monzo payment by hand.
export const ORDER_STATUSES = [
  { id: 'pending_payment', label: 'Awaiting payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready / out for delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const ORDER_STATUS_IDS = ORDER_STATUSES.map((status) => status.id);

export function orderStatusLabel(id) {
  return ORDER_STATUSES.find((status) => status.id === id)?.label ?? id;
}

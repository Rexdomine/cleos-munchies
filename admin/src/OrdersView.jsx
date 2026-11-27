import { useCallback, useEffect, useMemo, useState } from 'react';
import { ORDER_STATUSES, orderStatusLabel } from '../../shared/orderStatus.js';
import { api } from './api.js';
import { formatDateTime, formatGBP } from './format.js';

function matches(order, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { customer } = order;
  return [order.reference, customer.name, customer.email, customer.phone, customer.postcode].some((value) => value.toLowerCase().includes(needle));
}

function OrderCard({ order, onChange }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(order.adminNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setNote(order.adminNote), [order.adminNote]);

  const save = async (changes) => {
    setSaving(true);
    setError('');
    try {
      await api.updateOrder(order.reference, changes);
      onChange({ ...order, ...changes });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const { customer } = order;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className={`order-card status-${order.status}`}>
      <div className="order-summary">
        <button className="order-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span className="order-ref">{order.reference}</span>
          <span className="order-name">{customer.name}</span>
          <span className="muted">
            {formatDateTime(order.createdAt)} · {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
        </button>
        <strong className="order-total">{formatGBP(order.total)}</strong>
        <label className="status-select">
          <span className="sr-only">Status for {order.reference}</span>
          <select value={order.status} disabled={saving} onChange={(e) => save({ status: e.target.value })}>
            {ORDER_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        </label>
      </div>
      {order.notificationStatus !== 'sent' && (
        <p className="warning">
          {order.notificationStatus === 'failed'
            ? 'The order emails failed to send, so the customer was told their order was not confirmed. Contact them before preparing it.'
            : 'The order emails were still sending when this was saved.'}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {open && (
        <div className="order-details">
          <div>
            <h3>Items</h3>
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={`${item.itemId}:${item.variantId}`}>
                  <span>
                    {item.quantity} × {item.name}
                    {item.variantLabel && <small> · {item.variantLabel}</small>}
                  </span>
                  <b>{formatGBP(item.price * item.quantity)}</b>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Customer</h3>
            <p>
              {customer.name}
              <br />
              <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
              <br />
              <a href={`mailto:${customer.email}`}>{customer.email}</a>
            </p>
            <p>
              {customer.address}
              <br />
              {customer.city} {customer.postcode}
            </p>
            {customer.notes && <p className="customer-notes">“{customer.notes}”</p>}
          </div>
          <div className="admin-note">
            <label>
              Private note
              <textarea value={note} maxLength={1000} placeholder="e.g. Paid £45 on 12 Nov, delivering Saturday" onChange={(e) => setNote(e.target.value)} />
            </label>
            <button className="secondary" disabled={saving || note === order.adminNote} onClick={() => save({ adminNote: note })}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function OrdersView() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders((await api.orders()).orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const result = {};
    for (const order of orders ?? []) result[order.status] = (result[order.status] ?? 0) + 1;
    return result;
  }, [orders]);

  const visible = (orders ?? []).filter((order) => (!status || order.status === status) && matches(order, query));
  const replaceOrder = (updated) => setOrders((current) => current.map((order) => (order.reference === updated.reference ? updated : order)));

  return (
    <section>
      <div className="view-head">
        <h1>Orders</h1>
        <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <div className="filters">
        <input type="search" aria-label="Search orders" placeholder="Search reference, name, email, phone or postcode" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by status">
          <button className={status === '' ? 'selected' : ''} onClick={() => setStatus('')}>All <span>{orders?.length ?? 0}</span></button>
          {ORDER_STATUSES.map((entry) => (
            <button key={entry.id} className={status === entry.id ? 'selected' : ''} onClick={() => setStatus(entry.id)}>
              {entry.label} <span>{counts[entry.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {orders === null && !error && <p className="muted">Loading orders…</p>}
      {orders && visible.length === 0 && (
        <p className="empty">{orders.length === 0 ? 'No orders yet. New orders appear here as soon as customers submit them.' : `No ${status ? orderStatusLabel(status).toLowerCase() : ''} orders match.`}</p>
      )}
      <div className="order-list">
        {visible.map((order) => (
          <OrderCard key={order.reference} order={order} onChange={replaceOrder} />
        ))}
      </div>
    </section>
  );
}

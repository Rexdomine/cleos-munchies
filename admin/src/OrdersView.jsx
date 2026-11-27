import { useCallback, useEffect, useRef, useState } from 'react';
import { ORDER_STATUSES, orderStatusLabel } from '../../shared/orderStatus.js';
import { api } from './api.js';
import { formatDateTime, formatGBP } from './format.js';

function OrderCard({ order, onChange }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(order.adminNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { tone: 'ok' | 'warning', text }

  // Follow outside changes to the saved note, but never while a save is in flight (the textarea is locked then).
  useEffect(() => {
    if (!saving) setNote(order.adminNote);
  }, [order.adminNote, saving]);

  const save = async (changes) => {
    setSaving(true);
    setError('');
    setNotice(null);
    try {
      const result = await api.updateOrder(order.reference, changes);
      onChange({ ...order, ...changes });
      if (changes.status) {
        const label = orderStatusLabel(changes.status);
        if (result.customerEmail === 'sent') setNotice({ tone: 'ok', text: `Marked “${label}”. ${order.customer.name} has been emailed.` });
        else if (result.customerEmail === 'failed') setNotice({ tone: 'warning', text: `Marked “${label}”, but the email to ${order.customer.email} failed to send. You may want to contact them directly.` });
        else setNotice({ tone: 'ok', text: `Marked “${label}”.` });
      }
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
          <span className="sr-only">Status for {order.reference}. Changing it emails the customer.</span>
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
      {notice && (
        <p className={notice.tone === 'warning' ? 'warning' : 'notice'} role="status">
          {notice.text}
        </p>
      )}
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
              <textarea value={note} maxLength={1000} disabled={saving} placeholder="e.g. Paid £45 on 12 Nov, delivering Saturday" onChange={(e) => setNote(e.target.value)} />
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
  const [nextCursor, setNextCursor] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Filters and search run on the server, so older orders are always reachable; "Show more" pages back.
  const load = useCallback(
    async ({ append = false, cursor = '' } = {}) => {
      const id = ++requestId.current;
      setLoading(true);
      setError('');
      try {
        const page = await api.orders({ status, query: debouncedQuery, before: cursor });
        if (id !== requestId.current) return; // A newer filter or search replaced this request.
        setOrders((current) => (append && current ? [...current, ...page.orders] : page.orders));
        setNextCursor(page.nextCursor);
        setCounts(page.counts ?? {});
      } catch (err) {
        if (id === requestId.current) setError(err.message);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [status, debouncedQuery],
  );

  useEffect(() => {
    load();
  }, [load]);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const replaceOrder = (updated) => setOrders((current) => current.map((order) => (order.reference === updated.reference ? updated : order)));
  const filtered = Boolean(status || debouncedQuery);

  return (
    <section>
      <div className="view-head">
        <h1>Orders</h1>
        <button className="secondary" onClick={() => load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <p className="muted">Changing an order’s status emails the customer to let them know.</p>
      <div className="filters">
        <input type="search" aria-label="Search orders" placeholder="Search reference, name, email, phone or postcode" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by status">
          <button className={status === '' ? 'selected' : ''} onClick={() => setStatus('')}>All <span>{total}</span></button>
          {ORDER_STATUSES.map((entry) => (
            <button key={entry.id} className={status === entry.id ? 'selected' : ''} onClick={() => setStatus(entry.id)}>
              {entry.label} <span>{counts[entry.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {orders === null && !error && <p className="muted">Loading orders…</p>}
      {orders && orders.length === 0 && (
        <p className="empty">{!filtered ? 'No orders yet. New orders appear here as soon as customers submit them.' : `No ${status ? orderStatusLabel(status).toLowerCase() : ''} orders match.`}</p>
      )}
      <div className="order-list">
        {orders?.map((order) => (
          <OrderCard key={order.reference} order={order} onChange={replaceOrder} />
        ))}
      </div>
      {nextCursor && (
        <div className="load-more">
          <button className="secondary" disabled={loading} onClick={() => load({ append: true, cursor: nextCursor })}>
            {loading ? 'Loading…' : 'Show older orders'}
          </button>
        </div>
      )}
    </section>
  );
}

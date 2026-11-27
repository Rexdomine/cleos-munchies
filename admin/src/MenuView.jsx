import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { formatGBP, imageUrl } from './format.js';
import { ItemEditor } from './ItemEditor.jsx';

function priceSummary(item) {
  if (!item.variants?.length) return formatGBP(item.price);
  const prices = item.variants.map((variant) => variant.price);
  return `${formatGBP(Math.min(...prices))} – ${formatGBP(Math.max(...prices))}`;
}

function MenuRow({ item, onToggle, onEdit }) {
  // While a sold-out toggle is saving, editing waits so the two changes can't cross.
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    await onToggle(item);
    setBusy(false);
  };
  return (
    <li className={`menu-row ${item.available ? '' : 'sold-out'}`}>
      {item.image ? <img src={imageUrl(item.image.replace('.webp', '-320.webp'))} alt="" loading="lazy" /> : <span className="no-image" aria-hidden="true" />}
      <div className="menu-row-copy">
        <b>{item.name}</b>
        <small className="muted">{item.note}</small>
      </div>
      <span className="menu-row-price">{priceSummary(item)}</span>
      <label className="switch">
        <input type="checkbox" checked={item.available} disabled={busy} onChange={toggle} />
        <span>{item.available ? 'Available' : 'Sold out'}</span>
      </label>
      <button className="secondary" disabled={busy} onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>Edit</button>
    </li>
  );
}

export function MenuView() {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  // null, or one editor session: { item: dish or null for a new dish, key }.
  // Each opening is a new object, so async results can tell whether their editor is still open.
  const [editing, setEditing] = useState(null);
  const sessionCount = useRef(0);
  const openEditor = (item) => setEditing({ item, key: ++sessionCount.current });
  const closeIfCurrent = (session) => setEditing((current) => (current === session ? null : current));

  const load = useCallback(async () => {
    try {
      setMenu(await api.menu());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item) => {
    try {
      await api.setAvailability(item.id, !item.available);
      setMenu((current) => ({ ...current, items: current.items.map((entry) => (entry.id === item.id ? { ...entry, available: !item.available } : entry)) }));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (payload) => {
    const session = editing;
    if (session.item) await api.updateItem(session.item.id, payload);
    else await api.createItem(payload);
    closeIfCurrent(session);
    await load();
  };

  const remove = async () => {
    const session = editing;
    await api.deleteItem(session.item.id);
    closeIfCurrent(session);
    await load();
  };

  return (
    <section>
      <div className="view-head">
        <h1>Menu</h1>
        <button className="primary" onClick={() => openEditor(null)} disabled={!menu}>+ Add a dish</button>
      </div>
      <p className="muted">Changes show on the website within about a minute. Mark dishes sold out to stop new orders without deleting them.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {!menu && !error && <p className="muted">Loading menu…</p>}
      {menu?.categories.map((category) => {
        const items = menu.items.filter((item) => item.category === category.name);
        return (
          <section key={category.name} className="menu-category">
            <h2>
              {category.name} <small className="muted">{items.length}</small>
            </h2>
            {items.length ? (
              <ul>
                {items.map((item) => (
                  <MenuRow key={item.id} item={item} onToggle={toggle} onEdit={openEditor} />
                ))}
              </ul>
            ) : (
              <p className="muted">No dishes in this category.</p>
            )}
          </section>
        );
      })}
      {editing && (
        <ItemEditor key={editing.key} item={editing.item} categories={menu.categories} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

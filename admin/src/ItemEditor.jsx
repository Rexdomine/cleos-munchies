import { useEffect, useRef, useState } from 'react';
import { penceToPounds, poundsToPence } from './format.js';
import { ImagePicker } from './ImagePicker.jsx';

const TRAY_SIZES = [
  { label: 'Half tray · serves 10–15', price: '' },
  { label: 'Full tray · serves 20–25', price: '' },
  { label: 'XL tray · serves 30–40', price: '' },
];

function initialForm(item, categories) {
  if (!item) {
    return { name: '', category: categories[0]?.name ?? '', note: '', image: '', available: true, pricing: 'single', price: '', variants: TRAY_SIZES };
  }
  const hasVariants = Boolean(item.variants?.length);
  return {
    name: item.name,
    category: item.category,
    note: item.note,
    image: item.image,
    available: item.available,
    pricing: hasVariants ? 'sizes' : 'single',
    price: penceToPounds(item.price),
    variants: hasVariants ? item.variants.map((variant) => ({ id: variant.id, label: variant.label, price: penceToPounds(variant.price) })) : TRAY_SIZES,
  };
}

// Turns the form into the API payload, or returns a readable error.
function toPayload(form) {
  const payload = { name: form.name.trim(), category: form.category, note: form.note.trim(), image: form.image.trim(), available: form.available };
  if (!payload.name) return { error: 'Give the dish a name.' };
  if (form.pricing === 'single') {
    const price = poundsToPence(form.price);
    if (Number.isNaN(price)) return { error: 'Enter a price, like 12.50.' };
    return { payload: { ...payload, price } };
  }
  const variants = [];
  for (const variant of form.variants) {
    if (!variant.label.trim() && !String(variant.price).trim()) continue;
    const price = poundsToPence(variant.price);
    if (!variant.label.trim()) return { error: 'Every size needs a label.' };
    if (Number.isNaN(price)) return { error: `Enter a price for “${variant.label}”.` };
    variants.push({ ...(variant.id ? { id: variant.id } : {}), label: variant.label.trim(), price });
  }
  if (!variants.length) return { error: 'Add at least one size with a price.' };
  return { payload: { ...payload, variants } };
}

export function ItemEditor({ item, categories, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => initialForm(item, categories));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dialogRef = useRef(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    dialogRef.current?.querySelector('input')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => event.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };
  const setVariant = (index, field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, variants: current.variants.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const { payload, error: formError } = toPayload(form);
    if (formError) return setError(formError);
    setBusy(true);
    setError('');
    try {
      await onSave(payload);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${item.name}” from the menu? Past orders keep their copy of it.`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const categoryNote = categories.find((category) => category.name === form.category)?.note ?? '';

  return (
    <div className="scrim" onClick={onClose}>
      <form ref={dialogRef} className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="view-head">
          <h2 id="editor-title">{item ? 'Edit dish' : 'Add a dish'}</h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <label>
          Name
          <input value={form.name} maxLength={120} onChange={set('name')} required />
        </label>
        <label>
          Category
          <select value={form.category} onChange={set('category')}>
            {categories.map((category) => (
              <option key={category.name} value={category.name}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Description
          <input value={form.note} maxLength={200} placeholder={categoryNote} onChange={set('note')} />
        </label>
        <fieldset className="pricing">
          <legend>Price</legend>
          <label className="inline">
            <input type="radio" name="pricing" value="single" checked={form.pricing === 'single'} onChange={set('pricing')} /> One price
          </label>
          <label className="inline">
            <input type="radio" name="pricing" value="sizes" checked={form.pricing === 'sizes'} onChange={set('pricing')} /> Different sizes
          </label>
          {form.pricing === 'single' ? (
            <label className="money">
              <span>£</span>
              <input inputMode="decimal" aria-label="Price in pounds" value={form.price} placeholder="12.50" onChange={set('price')} />
            </label>
          ) : (
            <div className="variants">
              {form.variants.map((variant, index) => (
                <div className="variant" key={index}>
                  <input aria-label={`Size ${index + 1} label`} value={variant.label} placeholder="Size label" onChange={setVariant(index, 'label')} />
                  <label className="money">
                    <span>£</span>
                    <input inputMode="decimal" aria-label={`Size ${index + 1} price in pounds`} value={variant.price} placeholder="80.00" onChange={setVariant(index, 'price')} />
                  </label>
                </div>
              ))}
              {form.variants.length < 6 && (
                <button type="button" className="link" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, { label: '', price: '' }] }))}>
                  + Add a size
                </button>
              )}
            </div>
          )}
        </fieldset>
        <ImagePicker value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} onBusyChange={setUploading} />
        <label className="inline">
          <input type="checkbox" checked={form.available} onChange={set('available')} /> Available to order
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="editor-actions">
          {item && (
            <button type="button" className="danger" disabled={busy} onClick={remove}>Delete</button>
          )}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy || uploading}>{busy ? 'Saving…' : uploading ? 'Uploading photo…' : 'Save dish'}</button>
        </div>
      </form>
    </div>
  );
}

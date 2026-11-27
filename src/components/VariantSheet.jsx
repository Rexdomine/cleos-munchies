import { useRef } from 'react';
import { formatGBP } from '../domain/cart.js';
import { useOverlayLifecycle } from '../hooks/useOverlayLifecycle.js';

export function VariantSheet({ item, onAdd, onClose }) {
  const dialogRef = useRef(null);
  useOverlayLifecycle(onClose, dialogRef);
  return (
    <div className="scrim" onClick={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="variant-title" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close options">×</button>
        <p className="eyebrow">Choose your tray</p>
        <h2 id="variant-title">{item.name}</h2>
        {item.variants.map((variant) => (
          <button
            className="variant-row"
            key={variant.id}
            onClick={() => onAdd({ ...item, variantId: variant.id, price: variant.price, variantLabel: variant.label })}
          >
            <span>{variant.label}</span>
            <b>{formatGBP(variant.price)}</b>
          </button>
        ))}
      </section>
    </div>
  );
}

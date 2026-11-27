import { cartCount, cartSubtotal, formatGBP } from '../domain/cart.js';

export function BasketBar({ cart, onOpen }) {
  return (
    <button className="basket-bar" aria-live="polite" onClick={onOpen}>
      <span>
        View basket <b>{cartCount(cart)}</b>
      </span>
      <strong>{formatGBP(cartSubtotal(cart))}</strong>
    </button>
  );
}

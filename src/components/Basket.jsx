import { cartSubtotal, formatGBP, removeCartItem, setCartQuantity } from '../domain/cart.js';
import { useOverlayLifecycle } from '../hooks/useOverlayLifecycle.js';

function BasketLine({ line, setCart }) {
  const changeQuantity = (quantity) => setCart((cart) => setCartQuantity(cart, line.key, quantity));
  return (
    <div className={`basket-line${line.unavailable ? ' is-sold-out' : ''}`}>
      <div>
        <b>{line.name}</b>
        <small>{line.variantLabel || line.note}</small>
        {line.unavailable && <small className="error">Sold out right now. Please remove it to continue.</small>}
      </div>
      <div className="quantity">
        <button aria-label={`Decrease ${line.name}`} onClick={() => changeQuantity(line.quantity - 1)}>−</button>
        <span>{line.quantity}</span>
        <button aria-label={`Increase ${line.name}`} onClick={() => changeQuantity(line.quantity + 1)}>+</button>
      </div>
      <strong>{formatGBP(line.price * line.quantity)}</strong>
      <button className="remove" onClick={() => setCart((cart) => removeCartItem(cart, line.key))}>Remove</button>
    </div>
  );
}

export function Basket({ cart, setCart, onBack, onCheckout }) {
  useOverlayLifecycle(onBack);
  const hasSoldOut = cart.some((line) => line.unavailable);
  return (
    <div className="scrim" onClick={onBack}>
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onBack} aria-label="Close basket">×</button>
        <p className="eyebrow">Your order</p>
        <h2 id="basket-title">The basket</h2>
        {cart.map((line) => (
          <BasketLine key={line.key} line={line} setCart={setCart} />
        ))}
        <div className="total">
          <span>Food subtotal</span>
          <b>{formatGBP(cartSubtotal(cart))}</b>
        </div>
        <p className="fee-note">Delivery arrangements and any delivery charge will be confirmed separately.</p>
        <button className="primary" disabled={!cart.length || hasSoldOut} onClick={onCheckout}>
          Continue to details <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  );
}

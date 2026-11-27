import { cartCount } from '../domain/cart.js';

export function Header({ cart, onHome, onOpenBasket }) {
  return (
    <header className="topbar">
      <a className="brand" href="#menu" onClick={onHome}>
        CLEO<span>’</span>S<br />
        <i>MUNCHIES</i>
      </a>
      <div className="preorder">
        <span className="live-dot" /> PREORDER<br />
        <b>READY WITHIN 48 HOURS</b>
      </div>
      <button className="bag-icon" aria-label="Open basket" onClick={onOpenBasket}>
        Bag <strong>{cartCount(cart)}</strong>
      </button>
    </header>
  );
}

import { useState } from 'react';
import { formatGBP } from '../domain/cart.js';
import { MONZO_PAYMENT_URL } from '../domain/order.js';
import { copyText } from '../lib/copyText.js';

export function Review({ order, onBack }) {
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed
  const copyReference = async () => {
    const copied = await copyText(order.reference);
    setCopyState(copied ? 'copied' : 'failed');
    if (copied) window.setTimeout(() => setCopyState('idle'), 2200);
  };

  return (
    <div className="page-shell review">
      <button className="back" onClick={onBack}>← Edit details</button>
      <div className="review-flag">Order submitted</div>
      <p className="eyebrow">Your reference</p>
      <button type="button" className="reference-copy" onClick={copyReference} aria-label={`Copy order reference ${order.reference}`}>
        <strong>{order.reference}</strong>
        <span className={copyState === 'failed' ? 'copy-failed' : undefined}>{copyState === 'copied' ? 'Copied ✓' : copyState === 'failed' ? 'Couldn’t copy. Press and hold the code to copy it.' : 'Tap to copy'}</span>
      </button>
      <p className="lede">
        Order notification sent to you and Cleo’s Munchies. Payment is not confirmed until Monzo payment is manually matched to this reference.
      </p>
      <div className="review-card">
        <h2>Ready when you are</h2>
        {order.items.map((item) => (
          <p key={item.key}>
            <span>{item.quantity} × {item.name}</span>
            <b>{formatGBP(item.price * item.quantity)}</b>
          </p>
        ))}
        <div className="total">
          <span>Food subtotal</span>
          <b>{formatGBP(order.total)}</b>
        </div>
        <p className="preorder-note">Preorder standard: your food will be ready within {order.preorder.readyWithinHours} hours.</p>
        <p className="fee-note">Delivery arrangements and any delivery charge will be confirmed separately.</p>
      </div>
      <div className="payment-instruction">
        <span className="payment-kicker">Important — payment step</span>
        <h2>Copy your code into Monzo</h2>
        <p>Tap the reference above to copy it, then paste it into Monzo’s payment Notes. This is how we match your payment to your order.</p>
      </div>
      <a className="primary link-button" href={MONZO_PAYMENT_URL} target="_blank" rel="noreferrer">
        Continue to Monzo{' '}
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path d="M5 12h13m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </a>
      <p className="payment-footnote">Your order is not marked paid until we manually match the Monzo payment.</p>
    </div>
  );
}

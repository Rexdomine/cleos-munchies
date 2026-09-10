import { useEffect, useMemo, useRef, useState } from 'react';
import { MENU, MENU_CATEGORIES, searchMenu } from './data/menu.js';
import { addCartItem, cartCount, cartSubtotal, formatGBP, removeCartItem, setCartQuantity } from './domain/cart.js';
import { createOrderReference, createReviewOrder, MONZO_PAYMENT_URL, validateDeliveryDetails } from './domain/order.js';

const emptyDetails = { name:'', phone:'', email:'', address:'', city:'', postcode:'', deliveryDate:'', notes:'' };

function useOverlayLifecycle(onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeRef.current();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

function App() {
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('cleos-cart')) || []; } catch { return []; } });
  const [category, setCategory] = useState('All'); const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null); const [screen, setScreen] = useState('menu');
  const [details, setDetails] = useState(emptyDetails); const [errors, setErrors] = useState({}); const [review, setReview] = useState(null);
  useEffect(() => localStorage.setItem('cleos-cart', JSON.stringify(cart)), [cart]);
  const visible = useMemo(() => searchMenu(MENU.filter(x => category === 'All' || x.category === category), query), [category, query]);
  const add = item => setCart(c => addCartItem(c, item));
  const submitDetails = e => { e.preventDefault(); const result = validateDeliveryDetails(details); setDetails(result.values); setErrors(result.errors); if (!result.valid) { requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus()); return; } const order = createReviewOrder({ cart, details: result.values, reference: review?.reference ?? createOrderReference() }); setReview(order); setScreen('review'); };
  if (screen === 'review') return <Review order={review} onBack={() => setScreen('checkout')} />;
  if (screen === 'checkout') return <Checkout details={details} setDetails={setDetails} errors={errors} onSubmit={submitDetails} cart={cart} onBack={() => setScreen('basket')} />;
  return <><header className="topbar"><a className="brand" href="#menu" onClick={() => setScreen('menu')}>CLEO<span>’</span>S<br/><i>MUNCHIES</i></a><div className="preorder"><span className="live-dot" /> PREORDER<br/><b>ORDER AHEAD</b></div><button className="bag-icon" aria-label="Open basket" onClick={() => setScreen('basket')}>Bag <strong>{cartCount(cart)}</strong></button></header>
    <main id="menu"><section className="hero"><p className="eyebrow">Nigerian comfort · made for sharing</p><h1>Big flavour.<br/><em>Zero fuss.</em></h1><p className="lede">Home-cooked West African favourites, ready for your table. Order ahead and let us do the delicious bit.</p><div className="hero-art"><img src="/images/grills.webp" alt="Smoky grilled chicken" /><span>Cooked with<br/>good energy <b>✳</b></span></div></section>
      <section className="menu-head"><div><p className="eyebrow">The good stuff</p><h2>Explore the full menu</h2></div><label className="search"><span>⌕</span><input aria-label="Search the menu" placeholder="Search the menu" value={query} onChange={e => setQuery(e.target.value)} /></label></section>
      <nav className="categories" aria-label="Menu categories">{['All', ...MENU_CATEGORIES].map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</nav>
      <section className="menu-grid">{visible.map(item => <article className="food-card" key={item.id}><div className="food-image"><img src={item.image} alt="" /><span className="category-tag">{item.category}</span></div><div className="food-copy"><div><h3>{item.name}</h3><p>{item.note}</p></div>{item.variants ? <button className="add-button variant" aria-label={`Choose a size for ${item.name}`} onClick={() => setSheet(item)}>Choose size <span aria-hidden="true">＋</span></button> : <button className="add-button" aria-label={`Add ${item.name}`} onClick={() => add(item)}>{formatGBP(item.price)} <span aria-hidden="true">＋</span></button>}</div></article>)}</section>
      {visible.length === 0 && <p className="empty">No dishes found. Try another flavour.</p>}
    </main>{cart.length > 0 && <button className="basket-bar" aria-live="polite" onClick={() => setScreen('basket')}><span>View basket <b>{cartCount(cart)}</b></span><strong>{formatGBP(cartSubtotal(cart))}</strong></button>}{sheet && <VariantSheet item={sheet} onAdd={item => { add(item); setSheet(null); }} onClose={() => setSheet(null)} />}{screen === 'basket' && <Basket cart={cart} setCart={setCart} onBack={() => setScreen('menu')} onCheckout={() => setScreen('checkout')} />}</>;
}

function VariantSheet({ item, onAdd, onClose }) { useOverlayLifecycle(onClose); return <div className="scrim" onClick={onClose}><section className="sheet" role="dialog" aria-modal="true" aria-labelledby="variant-title" onClick={e => e.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close options">×</button><p className="eyebrow">Choose your tray</p><h2 id="variant-title">{item.name}</h2>{item.variants.map(v => <button className="variant-row" key={v.id} onClick={() => onAdd({...item, variantId:v.id, price:v.price, variantLabel:v.label})}><span>{v.label}</span><b>{formatGBP(v.price)}</b></button>)}</section></div> }
function Basket({cart,setCart,onBack,onCheckout}) { useOverlayLifecycle(onBack); return <div className="scrim" onClick={onBack}><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title" onClick={e => e.stopPropagation()}><button className="close" onClick={onBack} aria-label="Close basket">×</button><p className="eyebrow">Your order</p><h2 id="basket-title">The basket</h2>{cart.map(line => <div className="basket-line" key={line.key}><div><b>{line.name}</b><small>{line.variantLabel || line.note}</small></div><div className="quantity"><button aria-label={`Decrease ${line.name}`} onClick={() => setCart(c => setCartQuantity(c,line.key,line.quantity-1))}>−</button><span>{line.quantity}</span><button aria-label={`Increase ${line.name}`} onClick={() => setCart(c => setCartQuantity(c,line.key,line.quantity+1))}>+</button></div><strong>{formatGBP(line.price*line.quantity)}</strong><button className="remove" onClick={() => setCart(c => removeCartItem(c,line.key))}>Remove</button></div>)}<div className="total"><span>Food subtotal</span><b>{formatGBP(cartSubtotal(cart))}</b></div><p className="fee-note">Delivery arrangements and any delivery charge will be confirmed separately.</p><button className="primary" disabled={!cart.length} onClick={onCheckout}>Continue to details <span aria-hidden="true">→</span></button></section></div> }
function Checkout({details,setDetails,errors,onSubmit,cart,onBack}) { const update = e => setDetails(d => ({...d,[e.target.name]:e.target.value})); return <div className="page-shell"><button className="back" onClick={onBack}>← Back to basket</button><p className="eyebrow">Almost there</p><h1>Delivery details</h1><p className="lede">Tell us where to send the good stuff. Cleo will confirm delivery timing with you.</p><form onSubmit={onSubmit} noValidate><div className="form-grid">{[['name','Name'],['phone','Phone'],['email','Email (optional)'],['address','Address'],['city','Town or city'],['postcode','Postcode'],['deliveryDate','Preferred delivery date']].map(([name,label]) => <label key={name}>{label}<input name={name} type={name==='deliveryDate'?'date':name==='email'?'email':'text'} inputMode={name === 'phone' ? 'tel' : undefined} autoComplete={name === 'name' ? 'name' : name === 'phone' ? 'tel' : name === 'email' ? 'email' : name === 'postcode' ? 'postal-code' : name === 'address' ? 'street-address' : name === 'city' ? 'address-level2' : undefined} value={details[name]} onChange={update} required={name !== 'email'} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name]&&<small className="error" id={`${name}-error`}>{errors[name]}</small>}</label>)}<label className="full">Notes (optional)<textarea name="notes" value={details.notes} onChange={update} placeholder="Allergies, gate codes or delivery notes" /></label></div><button className="primary" type="submit">Review order <span aria-hidden="true">→</span></button></form></div> }
function Review({order,onBack}) { return <div className="page-shell review"><button className="back" onClick={onBack}>← Edit details</button><div className="review-flag">Review mode</div><p className="eyebrow">Your reference</p><h1>{order.reference}</h1><p className="lede">No order email has been sent. Payment is not confirmed. <strong>Do not send payment during review.</strong></p><div className="review-card"><h2>Ready when you are</h2>{order.items.map(i => <p key={i.key}><span>{i.quantity} × {i.name}</span><b>{formatGBP(i.price*i.quantity)}</b></p>)}<div className="total"><span>Food subtotal</span><b>{formatGBP(order.total)}</b></div><p className="fee-note">Delivery arrangements and any delivery charge will be confirmed separately.</p></div><p className="instruction">When ordering is live, open Monzo and put <strong>{order.reference}</strong> in the payment Notes so we can match your order.</p><a className="primary link-button is-disabled" href={MONZO_PAYMENT_URL} target="_blank" rel="noreferrer" aria-disabled="true" onClick={event => event.preventDefault()}>Continue to Monzo · locked in review <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 14 14 6M8 6h6v6" /></svg></a></div> }
export default App;

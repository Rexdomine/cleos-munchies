import { useEffect, useState } from 'react';
import { addCartItem, syncCartWithMenu } from './domain/cart.js';
import { applyConfirmedOrder, createOrderReference, createReviewOrder, prepareOrderForSubmission, validateDeliveryDetails } from './domain/order.js';
import { useMenu } from './hooks/useMenu.js';
import { usePersistentCart } from './hooks/usePersistentCart.js';
import { submitOrder } from './lib/submitOrder.js';
import { Basket } from './components/Basket.jsx';
import { BasketBar } from './components/BasketBar.jsx';
import { Checkout } from './components/Checkout.jsx';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';
import { ALL_CATEGORIES, MenuSection } from './components/MenuSection.jsx';
import { Review } from './components/Review.jsx';
import { VariantSheet } from './components/VariantSheet.jsx';

const emptyDetails = { name: '', phone: '', email: '', address: '', city: '', postcode: '', notes: '' };

function App() {
  const [cart, setCart] = usePersistentCart();
  const menu = useMenu();
  const [screen, setScreen] = useState('menu'); // 'menu' | 'basket' | 'checkout' | 'review'
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);

  const [details, setDetails] = useState(emptyDetails);
  const [errors, setErrors] = useState({});
  const [pendingOrder, setPendingOrder] = useState(null);
  const [review, setReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const add = (item) => setCart((current) => addCartItem(current, item));

  // Once the live menu arrives, refresh saved basket prices and flag sold-out dishes.
  useEffect(() => {
    if (menu.live) setCart((current) => syncCartWithMenu(current, menu.items));
  }, [menu, setCart]);

  const submitDetails = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const result = validateDeliveryDetails(details);
    setDetails(result.values);
    setErrors(result.errors);
    setSubmitError('');
    if (!result.valid) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    // Reuse the pending order (and its idempotency key) on retry unless the details or basket changed.
    const order = pendingOrder
      ? prepareOrderForSubmission(pendingOrder, result.values, cart)
      : createReviewOrder({ cart, details: result.values, reference: createOrderReference() });
    setPendingOrder(order);
    setSubmitting(true);
    try {
      const payload = await submitOrder(order);
      // Show the prices the server saved and emailed, which can differ if the menu changed meanwhile.
      setReview({
        ...applyConfirmedOrder(order, payload),
        status: 'pending_payment',
        notification: { provider: 'brevo', status: 'accepted', sent: true, messageIds: payload.messageIds || [] },
      });
      setCart([]);
      setScreen('review');
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (screen === 'review') {
    return <Review order={review} onBack={() => setScreen('checkout')} />;
  }

  if (screen === 'checkout') {
    return (
      <Checkout
        details={details}
        setDetails={setDetails}
        errors={errors}
        onSubmit={submitDetails}
        onBack={() => setScreen('basket')}
        submitting={submitting}
        submitError={submitError}
      />
    );
  }

  return (
    <>
      <Header cart={cart} onHome={() => setScreen('menu')} onOpenBasket={() => setScreen('basket')} />
      <main id="menu">
        <Hero />
        <MenuSection menu={menu} category={category} setCategory={setCategory} query={query} setQuery={setQuery} onAdd={add} onChooseSize={setSheet} />
      </main>
      {cart.length > 0 && <BasketBar cart={cart} onOpen={() => setScreen('basket')} />}
      {sheet && (
        <VariantSheet
          item={sheet}
          onAdd={(item) => {
            add(item);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {screen === 'basket' && (
        <Basket cart={cart} setCart={setCart} onBack={() => setScreen('menu')} onCheckout={() => setScreen('checkout')} />
      )}
    </>
  );
}

export default App;

function lineKey(item) {
  return item.variantId ? `${item.id}:${item.variantId}` : item.id;
}

export function addCartItem(cart, item) {
  const key = lineKey(item);
  const existing = cart.find((line) => line.key === key);
  if (existing) {
    return cart.map((line) =>
      line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
    );
  }
  return [...cart, { ...item, key, quantity: 1 }];
}

export function setCartQuantity(cart, key, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError('Quantity must be a non-negative integer.');
  }
  if (quantity === 0) return cart.filter((line) => line.key !== key);
  return cart.map((line) => (line.key === key ? { ...line, quantity } : line));
}

export function removeCartItem(cart, key) {
  return cart.filter((line) => line.key !== key);
}

export function cartSubtotal(cart) {
  return cart.reduce((total, line) => total + line.price * line.quantity, 0);
}

export function cartCount(cart) {
  return cart.reduce((total, line) => total + line.quantity, 0);
}

export function formatGBP(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

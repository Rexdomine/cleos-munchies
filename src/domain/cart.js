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

// Brings saved basket lines in line with the live menu: current names and prices,
// dishes that were removed dropped, sold-out dishes flagged.
export function syncCartWithMenu(cart, menuItems) {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  let changed = false;
  const next = [];
  for (const line of cart) {
    const item = byId.get(line.id);
    const variant = line.variantId ? item?.variants?.find((entry) => entry.id === line.variantId) : null;
    // Drop lines for removed dishes, removed sizes, or dishes that now need a size to be chosen.
    if (!item || (line.variantId && !variant) || (!line.variantId && item.variants?.length)) {
      changed = true;
      continue;
    }
    const price = variant ? variant.price : item.price;
    const updated = {
      ...line,
      name: item.name,
      note: item.note,
      price,
      ...(variant ? { variantLabel: variant.label } : {}),
      unavailable: item.available === false,
    };
    if (updated.name !== line.name || updated.price !== line.price || updated.variantLabel !== line.variantLabel || updated.unavailable !== Boolean(line.unavailable) || updated.note !== line.note) {
      changed = true;
    }
    next.push(updated);
  }
  return changed ? next : cart;
}

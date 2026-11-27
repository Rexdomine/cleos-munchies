import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cleos-cart';

function readStoredCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Cart state that survives reloads via localStorage.
export function usePersistentCart() {
  const [cart, setCart] = useState(readStoredCart);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)), [cart]);
  return [cart, setCart];
}

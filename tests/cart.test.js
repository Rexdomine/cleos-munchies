import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addCartItem,
  cartCount,
  cartSubtotal,
  removeCartItem,
  setCartQuantity,
} from '../src/domain/cart.js';

const chicken = { id: 'grilled-chicken', name: 'Grilled Chicken', price: 2500 };
const riceHalf = {
  id: 'jollof-rice',
  name: 'Jollof Rice',
  price: 8000,
  variantId: 'half',
  variantLabel: 'Half tray',
};
const riceFull = {
  id: 'jollof-rice',
  name: 'Jollof Rice',
  price: 14000,
  variantId: 'full',
  variantLabel: 'Full tray',
};

describe('cart domain', () => {
  it('adds identical items by increasing quantity', () => {
    const once = addCartItem([], chicken);
    const twice = addCartItem(once, chicken);
    assert.deepEqual(twice, [{ ...chicken, key: 'grilled-chicken', quantity: 2 }]);
  });

  it('keeps differently priced variants as separate cart lines', () => {
    const cart = addCartItem(addCartItem([], riceHalf), riceFull);
    assert.equal(cart.length, 2);
    assert.deepEqual(cart.map((line) => line.key), ['jollof-rice:half', 'jollof-rice:full']);
  });

  it('calculates subtotal in integer pence and total item quantity', () => {
    const cart = [
      { ...chicken, key: chicken.id, quantity: 2 },
      { ...riceHalf, key: 'jollof-rice:half', quantity: 1 },
    ];
    assert.equal(cartSubtotal(cart), 13000);
    assert.equal(cartCount(cart), 3);
  });

  it('removes a line when its quantity is set to zero', () => {
    const cart = addCartItem([], chicken);
    assert.deepEqual(setCartQuantity(cart, chicken.id, 0), []);
    assert.deepEqual(removeCartItem(cart, chicken.id), []);
  });
});

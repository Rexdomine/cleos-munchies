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

it('syncCartWithMenu refreshes prices, flags sold-out dishes and drops removed ones', async () => {
  const { syncCartWithMenu } = await import('../src/domain/cart.js');
  const cart = [
    { id: 'meat-pie', key: 'meat-pie', name: 'Meat Pie', note: 'Baked to order', price: 500, quantity: 2 },
    { id: 'jollof-rice', key: 'jollof-rice:full', variantId: 'full', variantLabel: 'Full tray', name: 'Jollof Rice', price: 14000, quantity: 1 },
    { id: 'gone-dish', key: 'gone-dish', name: 'Gone', price: 100, quantity: 1 },
  ];
  const menu = [
    { id: 'meat-pie', name: 'Meat Pie', note: 'Baked to order', price: 550, available: true },
    { id: 'jollof-rice', name: 'Jollof Rice', note: 'Party', price: null, available: false, variants: [{ id: 'full', label: 'Full tray · serves 20–25', price: 15000 }] },
  ];
  const synced = syncCartWithMenu(cart, menu);
  assert.deepEqual(synced.map((line) => [line.key, line.price, line.unavailable, line.quantity]), [
    ['meat-pie', 550, false, 2],
    ['jollof-rice:full', 15000, true, 1],
  ]);
  assert.equal(synced[1].variantLabel, 'Full tray · serves 20–25');
  // Nothing changes when the basket already matches, so React state stays stable.
  assert.equal(syncCartWithMenu(synced, menu), synced);
});

it('syncCartWithMenu drops a saved line when its dish now needs a size', async () => {
  const { syncCartWithMenu } = await import('../src/domain/cart.js');
  const cart = [{ id: 'meat-pie', key: 'meat-pie', name: 'Meat Pie', price: 500, quantity: 1 }];
  const menu = [{ id: 'meat-pie', name: 'Meat Pie', price: null, available: true, variants: [{ id: 'box', label: 'Box of 6', price: 2800 }] }];
  assert.deepEqual(syncCartWithMenu(cart, menu), []);
});


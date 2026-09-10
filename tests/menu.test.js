import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { MENU, MENU_CATEGORIES, findMenuItem, searchMenu } from '../src/data/menu.js';

describe('menu data contract', () => {
  it('contains every source-menu category in display order', () => {
    assert.deepEqual(MENU_CATEGORIES, [
      'Breakfast',
      'Indomie',
      'Puff Puff',
      'Appetisers',
      'Soups',
      'Pies',
      'Shawarma',
      'Moi Moi',
      'Clean Grills',
      'Rice Trays',
    ]);
  });

  it('stores all money as integer pence', () => {
    for (const item of MENU) {
      if (item.price != null) assert.equal(Number.isInteger(item.price), true);
      for (const variant of item.variants ?? []) assert.equal(Number.isInteger(variant.price), true);
    }
  });

  it('preserves the three Jollof Rice tray prices', () => {
    const jollof = findMenuItem('jollof-rice');
    assert.deepEqual(jollof.variants.map(({ id, price }) => ({ id, price })), [
      { id: 'half', price: 8000 },
      { id: 'full', price: 14000 },
      { id: 'xl', price: 20000 },
    ]);
  });

  it('searches names, descriptions, and categories case-insensitively', () => {
    assert.equal(searchMenu(MENU, 'plantain').some((item) => item.id === 'grilled-chicken-plantain'), true);
    assert.equal(searchMenu(MENU, 'SOUP').every((item) => item.category === 'Soups'), true);
  });

  it('assigns one deterministic dish-specific image to every menu item', () => {
    assert.equal(new Set(MENU.map((item) => item.image)).size, MENU.length);
    for (const item of MENU) {
      assert.equal(item.image, `/images/menu/${item.id}.webp`);
      assert.equal(
        existsSync(new URL(`../public${item.image}`, import.meta.url)),
        true,
        `Missing dish image for ${item.name}: ${item.image}`,
      );
    }
  });
});

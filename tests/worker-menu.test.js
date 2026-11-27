import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MENU } from '../src/data/menu.js';
import { createMenuItem, deleteMenuItem, loadMenu, setMenuItemAvailability, updateMenuItem } from '../worker/src/menu.js';
import { parseMenuItemInput } from '../worker/src/validation.js';
import { createTestD1 } from './helpers/d1.js';

describe('Worker menu', () => {
  it('seeds D1 with exactly the menu the site ships with', async () => {
    const { items, categories } = await loadMenu(createTestD1());
    assert.equal(categories.length, 10);
    assert.deepEqual(
      items.map(({ id, category, name, note, price, image, variants }) => ({ id, category, name, note, price, image, ...(variants ? { variants } : {}) })),
      MENU.map(({ id, category, name, note, price, image, variants }) => ({ id, category, name, note, price, image, ...(variants ? { variants } : {}) })),
    );
    assert.ok(items.every((item) => item.available));
  });

  it('adds, edits, sells out and deletes dishes', async () => {
    const db = createTestD1();
    const created = await createMenuItem(db, { name: 'Jollof Rice', category: 'Rice Trays', note: 'Party size', variants: [{ label: 'Small tray', price: 5000 }] });
    assert.equal(created.id, 'jollof-rice-2'); // never collides with an existing id

    const dish = await createMenuItem(db, { name: 'Zobo Drink', category: 'Appetisers', price: 350 });
    assert.equal(dish.id, 'zobo-drink');
    await updateMenuItem(db, 'zobo-drink', { name: 'Zobo (500ml)', category: 'Appetisers', price: 400, available: true });
    await setMenuItemAvailability(db, 'zobo-drink', false);

    let menu = await loadMenu(db);
    const zobo = menu.items.find((item) => item.id === 'zobo-drink');
    assert.deepEqual([zobo.name, zobo.price, zobo.available], ['Zobo (500ml)', 400, false]);
    assert.deepEqual(menu.items.find((item) => item.id === 'jollof-rice-2').variants, [{ id: 'small-tray', label: 'Small tray', price: 5000 }]);

    // Switching a sized dish to one price drops its sizes.
    await updateMenuItem(db, 'jollof-rice-2', { name: 'Jollof Rice', category: 'Rice Trays', price: 4500 });
    menu = await loadMenu(db);
    const jollof = menu.items.find((item) => item.id === 'jollof-rice-2');
    assert.equal(jollof.price, 4500);
    assert.equal(jollof.variants, undefined);

    assert.deepEqual(await deleteMenuItem(db, 'zobo-drink'), { id: 'zobo-drink' });
    assert.equal((await deleteMenuItem(db, 'zobo-drink')).status, 404);
    assert.equal((await updateMenuItem(db, 'zobo-drink', { name: 'x', category: 'Pies', price: 1 })).status, 404);
  });

  it('explains invalid dish details', () => {
    const categories = ['Pies'];
    assert.match(parseMenuItemInput({ category: 'Pies', price: 100 }, categories).error, /name/);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Cakes', price: 100 }, categories).error, /category/);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: -1 }, categories).error, /price/);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: 1.5 }, categories).error, /price/);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: 100, image: 'javascript:alert(1)' }, categories).error, /photo/);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Pies', variants: [{ label: 'A', price: 1 }, { label: 'A', price: 2 }] }, categories).error, /different/);
    assert.ok(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: 600, image: '/images/menu/meat-pie.webp' }, categories).item);
    assert.ok(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: 600, image: '/media/menu/0b7c1d3e-1111-4111-8111-111111111111.webp' }, categories).item);
    assert.match(parseMenuItemInput({ name: 'Pie', category: 'Pies', price: 600, image: '/media/../secret' }, categories).error, /photo/);
  });
});

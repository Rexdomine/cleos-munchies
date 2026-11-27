import { MAX_ITEM_ID_LENGTH, parseMenuItemInput, slugify } from './validation.js';

function toItem(row, variantsByItem) {
  const variants = variantsByItem.get(row.id) ?? [];
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    note: row.note,
    price: variants.length ? null : row.price,
    image: row.image,
    available: Boolean(row.available),
    ...(variants.length ? { variants } : {}),
  };
}

// Loads the full menu in display order. Two queries: items and variants.
export async function loadMenu(db) {
  const [categories, items, variants] = await db.batch([
    db.prepare('SELECT name, note FROM categories ORDER BY sort_order, name'),
    db.prepare('SELECT * FROM menu_items ORDER BY sort_order, name'),
    db.prepare('SELECT item_id, id, label, price FROM menu_variants ORDER BY item_id, sort_order'),
  ]);

  const variantsByItem = new Map();
  for (const variant of variants.results) {
    const list = variantsByItem.get(variant.item_id) ?? [];
    list.push({ id: variant.id, label: variant.label, price: variant.price });
    variantsByItem.set(variant.item_id, list);
  }

  // Keep items grouped in category order, then by their own order.
  const categoryOrder = new Map(categories.results.map((category, index) => [category.name, index]));
  const sortedItems = items.results
    .map((row) => toItem(row, variantsByItem))
    .sort((a, b) => (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99));

  return { categories: categories.results, items: sortedItems };
}

async function categoryNames(db) {
  const { results } = await db.prepare('SELECT name FROM categories').all();
  return results.map((row) => row.name);
}

function variantStatements(db, itemId, variants) {
  return variants.map((variant, index) =>
    db.prepare('INSERT INTO menu_variants (item_id, id, label, price, sort_order) VALUES (?, ?, ?, ?, ?)').bind(itemId, variant.id, variant.label, variant.price, index),
  );
}

async function uniqueItemId(db, name) {
  // Leave room for a "-NN" suffix so the final id never exceeds the checkout limit.
  const base = slugify(name).slice(0, MAX_ITEM_ID_LENGTH - 4).replace(/-$/, '') || 'item';
  let candidate = base;
  for (let suffix = 2; ; suffix += 1) {
    const existing = await db.prepare('SELECT 1 FROM menu_items WHERE id = ?').bind(candidate).first();
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
}

export async function createMenuItem(db, body) {
  const parsed = parseMenuItemInput(body, await categoryNames(db));
  if (parsed.error) return parsed;
  const { item } = parsed;
  const id = await uniqueItemId(db, item.name);
  const last = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max FROM menu_items').first();
  await db.batch([
    db.prepare('INSERT INTO menu_items (id, category, name, note, price, image, available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, item.category, item.name, item.note, item.variants.length ? null : item.price, item.image, item.available === false ? 0 : 1, last.max + 1),
    ...variantStatements(db, id, item.variants),
  ]);
  return { id };
}

export async function updateMenuItem(db, id, body) {
  const existing = await db.prepare('SELECT id FROM menu_items WHERE id = ?').bind(id).first();
  if (!existing) return { error: 'That dish no longer exists.', status: 404 };
  const parsed = parseMenuItemInput(body, await categoryNames(db));
  if (parsed.error) return parsed;
  const { item } = parsed;
  await db.batch([
    // COALESCE keeps the stored availability when the edit didn't include it.
    db.prepare(`UPDATE menu_items SET category = ?, name = ?, note = ?, price = ?, image = ?, available = COALESCE(?, available), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
      .bind(item.category, item.name, item.note, item.variants.length ? null : item.price, item.image, item.available === undefined ? null : item.available ? 1 : 0, id),
    db.prepare('DELETE FROM menu_variants WHERE item_id = ?').bind(id),
    ...variantStatements(db, id, item.variants),
  ]);
  return { id };
}

export async function setMenuItemAvailability(db, id, available) {
  const result = await db.prepare(`UPDATE menu_items SET available = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).bind(available ? 1 : 0, id).run();
  return result.meta.changes ? { id } : { error: 'That dish no longer exists.', status: 404 };
}

export async function deleteMenuItem(db, id) {
  const [, result] = await db.batch([
    db.prepare('DELETE FROM menu_variants WHERE item_id = ?').bind(id),
    db.prepare('DELETE FROM menu_items WHERE id = ?').bind(id),
  ]);
  return result.meta.changes ? { id } : { error: 'That dish no longer exists.', status: 404 };
}

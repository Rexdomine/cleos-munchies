-- Menu: categories keep the display order; items belong to a category.
CREATE TABLE categories (
  name TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL REFERENCES categories(name) ON UPDATE CASCADE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  price INTEGER,                      -- pence; NULL when the item is sold by tray size (variants)
  image TEXT NOT NULL DEFAULT '',
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX menu_items_category ON menu_items(category, sort_order);

CREATE TABLE menu_variants (
  item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  price INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, id)
);

-- Orders: the reference is the customer-facing identity; prices are copied at order time.
CREATE TABLE orders (
  reference TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX orders_created ON orders(created_at DESC);
CREATE INDEX orders_status ON orders(status, created_at DESC);

CREATE TABLE order_items (
  order_reference TEXT NOT NULL REFERENCES orders(reference) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  variant_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (order_reference, line_no)
);

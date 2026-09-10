const CATEGORY_NOTES = {
  Breakfast: 'Served per small takeaway bowl',
  Indomie: 'Served per small takeaway bowl',
  'Puff Puff': 'Five pieces',
  Appetisers: 'Served per small takeaway bowl',
  Soups: '4.5 litre portion',
  Pies: 'Baked to order',
  Shawarma: 'One wrap',
  'Moi Moi': 'One wrap',
  'Clean Grills': 'Served with our signature sauce',
  'Rice Trays': 'For parties, events and gatherings',
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeItem(category, name, price, extra = {}) {
  const id = extra.id ?? slugify(name);
  return {
    id,
    category,
    name,
    price,
    note: extra.note ?? CATEGORY_NOTES[category],
    image: `/images/menu/${id}.webp`,
    ...extra,
  };
}

const singlePriceGroups = [
  ['Breakfast', [
    ['Platerie (Akara & Pap)', 700],
    ['Yam & Egg Sauce', 700],
    ['Beans with Yam', 700],
    ['Boiled Plantain with Egg Sauce', 700],
    ['Mixed Plantain Fritters with Pap & Bread', 900],
    ['Boiled Plantain Fritters with Pap & Bread', 900],
  ]],
  ['Indomie', [
    ['Seafood Stir Fry', 900],
    ['Chicken Stir Fry', 800],
    ['Beef Stir Fry', 900],
    ['Sausage & Egg Stir Fry', 800],
    ['Catfish & Veg Stir Fry', 900],
  ]],
  ['Puff Puff', [
    ['Choco Puff', 600],
    ['A Little Spice', 600],
    ['Sugar Puff', 600],
    ['Berry & Cream', 700],
  ]],
  ['Appetisers', [
    ['Peppered Gizzard', 800],
    ['Peppered Snail', 1100],
    ['Peppered Beef', 900],
    ['Peppered Goat', 900],
    ['Peppered Chicken', 800],
    ['Peppered Prawns', 1400],
  ]],
  ['Soups', [
    ['Seafood Okra Soup', 14000],
    ['Egusi Soup (Goat Meat)', 7500],
    ['Egusi Soup (Assorted)', 7000],
    ['Ogbono Soup', 7000],
    ['Oha Soup (Assorted)', 8500],
    ['Afang Soup (Assorted)', 8000],
    ['Efo Riro Soup', 7000],
    ['Banga Soup (Assorted)', 8500],
    ['Okra Soup', 7000],
  ]],
  ['Pies', [
    ['Meat Pie', 500],
    ['Chicken Pie', 500],
    ['Fish Pie', 600],
  ]],
  ['Shawarma', [
    ['Chicken Shawarma', 1200],
    ['Beef Shawarma', 1300],
    ['Mixed Shawarma', 1400],
    ['Fish Shawarma', 1300],
    ['Chicken Shawarma with Chips', 1400],
    ['Beef Shawarma with Sausage', 1500],
  ]],
  ['Moi Moi', [
    ['Moi Moi with Egg', 500],
    ['Moi Moi with Fish', 600],
    ['Moi Moi with Chicken', 600],
    ['Moi Moi with Prawns', 700],
    ['Moi Moi with Boiled Egg & Prawns', 750],
  ]],
  ['Clean Grills', [
    ['Grilled Catfish', 2500],
    ['Grilled Croaker', 2800],
    ['Grilled Tilapia', 2500],
    ['Grilled Hake', 2500],
    ['Grilled Mackerel', 2500],
    ['Grilled Salmon', 3000],
    ['Grilled Chicken', 2500, { featured: true }],
    ['Grilled Chicken & Potato', 2600],
    ['Grilled Chicken & Plantain', 2600, { id: 'grilled-chicken-plantain' }],
  ]],
];

export const MENU_CATEGORIES = [
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
];

export const MENU = singlePriceGroups.flatMap(([category, rows]) =>
  rows.map(([name, price, extra]) => makeItem(category, name, price, extra)),
);

const ricePrices = [
  ['Jollof Rice', [8000, 14000, 20000], { featured: true }],
  ['Fried Rice (Special)', [8000, 14000, 20000]],
  ['Coconut Rice', [8000, 14000, 20000]],
  ['White Rice', [6000, 10000, 15000]],
  ['Ofada Rice', [8000, 14000, 20000]],
  ['Native Rice', [8500, 15000, 21000]],
  ['Coconut Fried Rice', [8500, 15000, 21000]],
  ['Party Jollof (Smokey)', [8500, 15000, 21000]],
];

for (const [name, prices, extra = {}] of ricePrices) {
  MENU.push(
    makeItem('Rice Trays', name, null, {
      ...extra,
      variants: [
        { id: 'half', label: 'Half tray · serves 10–15', price: prices[0] },
        { id: 'full', label: 'Full tray · serves 20–25', price: prices[1] },
        { id: 'xl', label: 'XL tray · serves 30–40', price: prices[2] },
      ],
    }),
  );
}

export function findMenuItem(id) {
  return MENU.find((item) => item.id === id);
}

export function searchMenu(menu, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return menu;
  return menu.filter((item) =>
    [item.name, item.note, item.category].some((value) => value.toLowerCase().includes(needle)),
  );
}

import { useEffect, useState } from 'react';
import { MENU, MENU_CATEGORIES } from '../data/menu.js';
import { API_BASE } from '../lib/api.js';

// The menu bundled with the site, shown straight away and kept if the API is unreachable.
const BUNDLED_MENU = {
  categories: MENU_CATEGORIES,
  items: MENU.map((item) => ({ ...item, available: true })),
  live: false,
};

function isMenuPayload(payload) {
  return Array.isArray(payload?.categories) && Array.isArray(payload?.items) && payload.items.length > 0;
}

// Loads the live menu (prices, sold-out dishes, new dishes) from the Worker.
export function useMenu() {
  const [menu, setMenu] = useState(BUNDLED_MENU);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/menu`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!isMenuPayload(payload)) return;
        setMenu({ categories: payload.categories.map((category) => category.name), items: payload.items, live: true });
      })
      .catch(() => {
        // Keep the bundled menu; the order API still checks prices and availability.
      });
    return () => controller.abort();
  }, []);

  return menu;
}

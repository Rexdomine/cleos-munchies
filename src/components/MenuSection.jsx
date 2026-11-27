import { useMemo } from 'react';
import { searchMenu } from '../data/menu.js';
import { FoodCard } from './FoodCard.jsx';

export const ALL_CATEGORIES = 'All';
const ALL = ALL_CATEGORIES;

// Controlled by App so the filters survive a trip to checkout and back.
export function MenuSection({ menu, category, setCategory, query, setQuery, onAdd, onChooseSize }) {
  const visible = useMemo(
    () => searchMenu(menu.items.filter((item) => category === ALL || item.category === category), query),
    [menu, category, query],
  );

  return (
    <>
      <section className="menu-head">
        <div>
          <p className="eyebrow">The good stuff</p>
          <h2>Explore the full menu</h2>
        </div>
        <label className="search">
          <span>⌕</span>
          <input aria-label="Search the menu" placeholder="Search the menu" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </section>
      <nav className="categories" aria-label="Menu categories">
        {[ALL, ...menu.categories].map((name) => (
          <button key={name} className={category === name ? 'selected' : ''} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </nav>
      <section className="menu-grid">
        {visible.map((item) => (
          <FoodCard key={item.id} item={item} onAdd={onAdd} onChooseSize={onChooseSize} />
        ))}
      </section>
      {visible.length === 0 && <p className="empty">No dishes found. Try another flavour.</p>}
    </>
  );
}

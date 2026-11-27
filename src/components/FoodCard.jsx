import { formatGBP } from '../domain/cart.js';
import { assetUrl } from '../lib/api.js';

const IMAGE_SIZES = '(max-width: 640px) calc(100vw - 48px), (max-width: 900px) calc(50vw - 28px), 480px';

export function FoodCard({ item, onAdd, onChooseSize }) {
  const image = assetUrl(item.image);
  return (
    <article className={`food-card${item.available === false ? ' is-sold-out' : ''}`}>
      <div className="food-image">
        <img src={image} srcSet={`${image.replace('.webp', '-320.webp')} 320w, ${image} 480w`} sizes={IMAGE_SIZES} alt="" loading="lazy" decoding="async" fetchPriority="low" />
        <span className="category-tag">{item.category}</span>
      </div>
      <div className="food-copy">
        <div>
          <h3>{item.name}</h3>
          <p>{item.note}</p>
        </div>
        {item.available === false ? (
          <button className="add-button sold-out" disabled aria-label={`${item.name} is sold out`}>
            Sold out
          </button>
        ) : item.variants ? (
          <button className="add-button variant" aria-label={`Choose a size for ${item.name}`} onClick={() => onChooseSize(item)}>
            Choose size <span aria-hidden="true">＋</span>
          </button>
        ) : (
          <button className="add-button" aria-label={`Add ${item.name}`} onClick={() => onAdd(item)}>
            {formatGBP(item.price)} <span aria-hidden="true">＋</span>
          </button>
        )}
      </div>
    </article>
  );
}

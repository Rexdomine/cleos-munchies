export function Hero() {
  return (
    <section className="hero">
      <p className="eyebrow">Nigerian comfort · made for sharing</p>
      <h1>
        Big flavour.<br />
        <em>Zero fuss.</em>
      </h1>
      <p className="lede">
        Home-cooked West African favourites, ready for your table. Order ahead and let us do the delicious bit.
      </p>
      <div className="hero-art">
        <img src="/images/grills.webp" alt="Smoky grilled chicken" />
        <span>
          Cooked with<br />
          good energy{' '}
          <svg className="energy-burst" aria-hidden="true" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="3" />
            <path d="M16 2v8m0 12v8M2 16h8m12 0h8M6.1 6.1l5.7 5.7m8.4 8.4 5.7 5.7m0-19.8-5.7 5.7m-8.4 8.4-5.7 5.7" />
          </svg>
        </span>
      </div>
    </section>
  );
}

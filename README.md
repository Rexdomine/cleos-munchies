# Cleo's Munchies

A lightweight, mobile-first preorder experience for Cleo's Munchies, an Afro-fusion takeaway.

## Current review build

The review build includes:

- 61 menu items across 10 categories
- Menu search and category filtering
- Quick-add items and rice-tray size selection
- A persistent localStorage basket
- Delivery-details validation
- A stable customer-facing order reference
- A safe Monzo handoff screen
- Responsive layouts for mobile, tablet, laptop, and desktop

## Transactional order notifications

Brevo is connected through the Vercel serverless endpoint at `/api/orders`. A valid order submission sends separate personalized notifications to the verified Cleo sender, the customer email, and `cleopatraejiogu@gmail.com`. The Brevo API key is production-only and server-side.

Payment remains manual: the site never marks an order paid from email acceptance or a browser return. The Monzo handoff remains locked until the payment launch boundary is separately approved.

## Admin backend (Cloudflare)

The menu and orders live in a Cloudflare Worker with a D1 (SQLite) database. The public site stays on Vercel and calls the Worker. Everything runs on Cloudflare's free plan.

- **Worker:** `worker/`. The admin is at **https://admin.cleosmunchies.co.uk**; the public API stays on `https://cleos-munchies-api.rextechng.workers.dev`.
  - `GET /api/menu`: the live menu, including sold-out flags. The site shows its bundled menu first, then switches to this.
  - `POST /api/orders`: re-prices the order from D1, saves it, then sends the Brevo emails (templates in `shared/orderEmails.js`). Retries with the same idempotency key never send twice.
  - `/admin`: the admin UI (`admin/`), plus `/api/admin/*`. It's protected by Cloudflare Access (an emailed one-time code), and the Worker re-checks the Access token and the `ADMIN_EMAILS` list.
- **Menu photos:** uploaded from the dish editor. The admin centre-crops each photo to a square in the browser and resizes it (up to 960px, plus a 320px thumbnail) before uploading. The Worker stores them in the R2 bucket `cleos-munchies-media` and serves them at `/media/menu/<id>.webp`, cached for a year. The database stores the `/media/...` path; the public site puts the Worker's address in front.
- **Domain:** `cleosmunchies.co.uk` DNS is on Cloudflare (moved from Namecheap on 2026-11-27). The website records point to Vercel with the proxy off; Brevo DKIM, verification and DMARC records are unchanged. Email Routing forwards every `@cleosmunchies.co.uk` address to Cleo's Gmail.
- **Login page:** branded through the Zero Trust organization's `login_design` setting in Cloudflare, not in code: cream background, ink text, a header and a help-line footer. Its logo is `worker/src/assets/login-logo.png`, served publicly by the Worker at `/brand/login-logo.png`. The Cloudflare Access title and the blue button can't be changed on the free plan.
- **Database:** `worker/migrations/`. The first menu is generated from `src/data/menu.js` with `npm run menu:seed`. After launch, D1 is the source of truth and `menu.js` is only a fallback.

### Local development

```bash
cp worker/.dev.vars.example worker/.dev.vars   # signs you in to /admin locally
npm run worker:migrate:local
npm run worker:dev        # Worker + admin on http://localhost:8788 (admin at /admin)
npm run dev               # public site on http://localhost:5173, using the local Worker
npm run admin:dev         # optional: admin with hot reload on http://localhost:5174
```

### Deploying the Worker

```bash
npx wrangler login                     # once
npm run worker:migrate:remote          # applies any new migrations
npm run worker:deploy
npx wrangler secret put BREVO_API_KEY --config worker/wrangler.jsonc   # once, before orders go through the Worker
```

## Run locally

```bash
npm install
npm run dev
```

Build and preview the production output:

```bash
npm run build
npm run preview
```

## Verification

```bash
npm test
npx playwright install chromium-headless-shell
npm run test:e2e
npm audit --audit-level=high
```

The browser suite rebuilds the app and uses a unique local preview port before running.

## Menu imagery

The initial menu uses ten coherent generated category images, optimized to 900×900 WebP. They are representative visuals rather than guarantees of exact portions or presentation. See [`docs/image-provenance.md`](./docs/image-provenance.md).

## Durable project context

- [`task_plan.md`](./task_plan.md) — roadmap, current phase, decisions, and next step
- [`findings.md`](./findings.md) — requirements, preflight decisions, and visual/browser findings
- [`progress.md`](./progress.md) — execution, failures, recoveries, and verification evidence

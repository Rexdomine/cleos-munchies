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

## Important review-mode boundary

Brevo is intentionally **not connected yet**. The current flow creates a local review reference but does not submit an order, send an email, or confirm payment.

The approved Monzo URL is present for contract verification, but its action is locked in review mode. The live handoff must only be enabled after the trusted order/Brevo boundary durably accepts the order and preserves one idempotent reference.

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

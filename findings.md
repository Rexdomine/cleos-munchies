# Findings & Decisions

## Requirements

- Project name: **Cleo's Munchies**.
- Product type: very small, lightweight frontend-heavy food-ordering project.
- UX direction: simplistic and easy to use.
- Durable execution context must live in `task_plan.md`, `findings.md`, and `progress.md` throughout the project.
- No custom backend ordering system, payment gateway integration, or payment API has been requested.
- Brevo will be used for transactional order email notifications through a trusted server-side/serverless relay; Brevo credentials must never ship to the browser.
- Monzo hosted-payment iframe support is not a hard requirement. The preferred fallback is a dedicated payment handoff screen with a clear “Continue to Monzo” action that opens the hosted link in a new tab, preserving the order/reference context in the original tab.
- Payment confirmation remains manual: the sister compares the Monzo Notes reference with the order email reference.

## Repo Findings

- New project workspace created at `/opt/data/projects/cleos-munchies`.
- The workspace did not exist before setup.
- No implementation stack or source files have been selected yet.
- Public GitHub repository: `https://github.com/Rexdomine/cleos-munchies`.
- GitHub visibility verified as public; default branch verified as `master`.
- Vercel project created and linked: project ID `prj_RO3nMRxmRHwJ1IC9Ikq3LBL04yHz`.
- Vercel Git link verified for `Rexdomine/cleos-munchies`, production branch `master`, in the default authenticated team scope.
- No deployment has been started because the app has not been scaffolded yet.

## Research / External Findings

- None yet; discovery is intentionally limited to the request and local workspace setup.

## Menu and brand content inventory

Source: supplied promotional menu image, inspected 2026-09-10 UTC. Treat this as source content pending owner confirmation before publication.

- Brand: **Cleo’s Munchies**, Afro-Fusion.
- Brand lines: “Flavours Made with Love” and “Delicious. Fresh. Made for You.”
- Breakfast — small takeaway bowl: Platerie (Akara & Pap) £7; Yam & Egg Sauce £7; Beans with Yam £7; Boiled Plantain with Egg Sauce £7; Mixed Plantain Fritters with Pap & Bread £9; Boiled Plantain Fritters with Pap & Bread £9.
- Stir Fry Indomie Noodles — small takeaway bowl: Seafood Stir Fry £9; Chicken Stir Fry £8; Beef Stir Fry £9; Sausage & Egg Stir Fry £8; Catfish & Veg Stir Fry £9.
- Puff Puff Edition — 5 pieces: Choco Puff £6; A Little Spice £6; Sugar Puff £6; Berry & Cream £7.
- Appetisers — small takeaway bowl: Peppered Gizzard £8; Peppered Snail £11; Peppered Beef £9; Peppered Goat £9; Peppered Chicken £8; Peppered Prawns £14.
- Soups — 4.5L: Seafood Okra Soup £140; Egusi Soup (Goat Meat) £75; Egusi Soup (Assorted) £70; Ogbono Soup £70; Oha Soup (Assorted) £85; Afang Soup (Assorted) £80; Efo Riro Soup £70; Banga Soup (Assorted) £85; Okra Soup £70.
- Pies: Meat Pie £5; Chicken Pie £5; Fish Pie £6.
- Shawarma — per wrap: Chicken £12; Beef £13; Mixed £14; Fish £13; Chicken with Chips £14; Beef with Sausage £15.
- Moi Moi Palace — per wrap: Moi Moi with Egg £5; with Fish £6; with Chicken £6; with Prawns £7; with Boiled Egg & Prawns £7.50.
- Clean Grills — served with signature sauce: Grilled Catfish £25; Croaker £28; Tilapia £25; Hake £25; Mackerel £25; Salmon £30; Chicken £25; Chicken & Potato £26; Chicken & Plantain £26.
- Rice Trays — party/event portions: Half Tray serves 10–15; Full Tray serves 20–25; XL Tray serves 30–40. Jollof, Special Fried, Coconut, Ofada: £80/£140/£200. White Rice: £60/£100/£150. Native, Coconut Fried, Party Jollof (Smokey): £85/£150/£210.
- Services: weekly/monthly meal prep; parties, weddings, birthdays, corporate events, meal prep, and custom orders.
- Delivery areas: Chichester, Portsmouth, Southampton, Brighton, London and surrounding areas.
- Contact: Call/WhatsApp **07939 427752**; social handle shown as **@cleosmunchies**.

### Content caveats to confirm

- “Platerie” is preserved exactly as read from the image but may need owner confirmation.
- The menu does not specify delivery charges, minimum order, lead/cut-off times, opening hours, allergy/ingredient information, dietary labels, meal-prep plans/prices, or catering packages/prices.
- Food photography for the website may use AI-generated images (GPT Image 2 when available), but generated visuals must be clearly treated as representative imagery and not evidence of exact portion appearance.

## Stateful Integration Preflight

### Boundary map

- Browser → frontend: customer selects menu items, enters delivery details, receives an order reference, and sees payment instructions. Browser state is not authoritative for order delivery or email delivery.
- Browser → email relay/API → Brevo: the checkout submission crosses a trusted boundary to send the order email. The relay must validate and constrain payloads, protect the Brevo API key, and make notification submission retry-safe.
- Browser → Monzo hosted payment page: the browser may load the hosted URL in an iframe only if permitted. The primary guaranteed UX is an in-site payment handoff screen with a new-tab/external fallback. Monzo is authoritative for payment acceptance.
- Sister's Monzo notification → manual reconciliation: no machine-readable callback is assumed. The Monzo note/reference is evidence used by the sister to update her operational view manually.
- Durable storage: the initial architecture must decide whether order details live only in the email relay/provider, or in a minimal datastore. Email alone is not a reliable application database.

### Durable state machine

- `Cart`: `empty` → `active` → `submitted`; can be abandoned locally. No fulfilment decision is based on cart state.
- `Order`: `draft` → `pending_payment` → `paid_reconciled` or `payment_unmatched`; operational terminal outcomes may also be `cancelled` or `expired`. `pending_payment` begins only after the order payload is durably accepted by the email/order boundary.
- `Payment reference`: `generated` → `shown_to_customer` → `manually_reconciled` or `expired`; generation must happen once per submitted order and must not be regenerated on refresh.
- No automated `paid` transition is allowed because the system has no Monzo callback/API evidence. The sister is the reconciliation actor.

### Identity and idempotency ledger

- Order identity: an opaque internal order ID, distinct from the customer-facing reference.
- Customer-facing payment reference: unique per order and included in the email and payment instructions.
- Payment identity: Monzo hosted-link/payment identity is provider-owned and not assumed to equal the order ID.
- Email submission identity: one idempotency key per order submission to prevent duplicate Brevo order emails on retries; the relay must define how it records/looks up that key.
- Brevo provider identity: message/request identifiers are provider evidence for notification delivery, not payment evidence.
- Customer/session identity: guest checkout session only; never treated as proof of payment or staff authority.

### Crash-window matrix

- Failure before email boundary: order remains local `draft`/unsent; customer must see a bounded failure and retry using the same order/reference, not silently create duplicates.
- Email accepted but browser response is lost: retry must converge through the same submission idempotency key.
- Email sent but local acknowledgement fails: the system must not claim the order was not submitted; recovery needs a submission lookup or operator-visible evidence.
- Payment page opens but customer abandons it: order remains `pending_payment`; no paid claim is inferred.
- Monzo payment succeeds but the website is closed: manual reconciliation from Monzo notification and the emailed reference still works.
- Duplicate refresh/click: must not create multiple orders or references unintentionally.
- Iframe blocked or unavailable: keep the dedicated payment handoff screen visible, explain the reference/Notes requirement, and open the hosted Monzo page in a new tab. Never pretend payment completed.

### Time and expiry ledger

- Order/reference expiry is a business policy to confirm; until then, pending orders remain pending.
- Reference uniqueness must be durable across the chosen storage boundary, not only in browser memory.
- Any retry window and email-provider retention window must be documented when the relay is selected.
- Exact before/equal/after expiry behavior must be defined before implementation.

### Parity surfaces

- Frontend order-total calculation vs email/relay validation: one canonical price/menu source or an explicit integrity check.
- Frontend reference generation vs durable order record: reference must be created and stored at the submission boundary.
- Checkout success UI vs actual email acceptance: UI must distinguish “submitted for payment” from “payment complete.”
- Iframe payment path vs external fallback path: both must preserve the same order/reference and must not create a second submission.
- Any datastore schema vs deployment/configuration path: fresh setup and upgrades must preserve uniqueness and status semantics.

### First critical regressions before broad implementation

- [ ] Duplicate submit/refresh converges to one order email and one payment reference.
- [ ] Email relay failure is visible and retryable without duplicate orders.
- [ ] Client-submitted total cannot override the canonical server/relay total.
- [ ] Iframe denial (or deliberate non-embedding) produces a safe, explicit new-tab fallback.
- [ ] Brevo failure is visible to the operator path and retryable without duplicate order notifications.
- [ ] Payment abandonment and payment success-without-site-return remain distinguishable; no false paid state.
- [ ] Reference uniqueness and pending-order lookup survive reloads and concurrent submissions.


- Decision: Treat `Cleo's Munchies` as the canonical spelling.
  - Rationale: It is the final name stated by Rex.
- Decision: Start with a minimal frontend MVP and defer durable backend/order processing decisions.
  - Rationale: The request explicitly prioritizes lightweight and frontend-heavy.
- Decision: Keep planning artifacts at the project root.
  - Rationale: Makes the project resumable and easy to hand off.

## Issues Encountered

- Issue: The documented `hermes-plan-bootstrap` helper is not installed or available on PATH.
  - Resolution: Used the skill templates directly and created all three required files.

## Resources

- Path: `/opt/data/projects/cleos-munchies/task_plan.md`
  - Why it matters: Durable roadmap, active phase, decisions, and next step.
- Path: `/opt/data/projects/cleos-munchies/findings.md`
  - Why it matters: Durable requirements and discovery record.
- Path: `/opt/data/projects/cleos-munchies/progress.md`
  - Why it matters: Chronological execution and verification log.

## Visual / Browser Findings

- None yet.

# Task Plan: Build Cleo's Munchies

## Goal

Create a lightweight, frontend-heavy food-ordering project for Cleo's Munchies with a simple, approachable ordering experience.

## Next Step

Define the Brevo relay contract, payment handoff UX, and menu data model using the supplied menu inventory before implementation.

- Current state: Public GitHub repository is created and pushed; Vercel linkage is pending because the read-only account lookup was blocked before any Vercel change.
- Next action: Define the Brevo relay contract, payment handoff UX, and menu data model using the supplied menu inventory before implementation.

## Current Phase

Phase 2 — Plan

## Phases

### Phase 1: Discovery
- [x] Capture the project name and high-level intent
- [x] Create the project workspace
- [x] Establish durable planning files
- [x] Confirm the customer, payment, and manual reconciliation workflow
- [x] Identify iframe and automatic-email feasibility boundaries
- [x] Capture the source menu content and service offering
- [x] Confirm Monzo embed policy and email/order-submission approach
- **Status:** complete

### Phase 2: Plan
- [ ] Choose frontend stack and project structure
- [ ] Define the minimal ordering flow and screens
- [ ] Record content, brand, and responsive UX decisions
- **Status:** pending

### Phase 3: Implement
- [ ] Build the frontend shell and menu experience
- [ ] Add cart and lightweight checkout interaction
- [ ] Keep project state and decisions current in planning files
- **Status:** pending

### Phase 4: Verify
- [ ] Run lint/build/tests where applicable
- [ ] Exercise the ordering flow in a browser
- [ ] Check responsive layout and empty/error states
- **Status:** pending

### Phase 5: Deliver
- [ ] Leave a clean local handoff
- [ ] Summarize changed files and verification evidence
- [ ] Record follow-up opportunities separately from the MVP scope
- **Status:** pending

## Key Questions

1. Should we attempt iframe embedding, or use the safer new-tab Monzo handoff as the default?
2. Which smallest serverless/trusted boundary will validate orders, persist the reference, and call Brevo?
3. What menu items, pricing, images, delivery area, and customer-facing details should the MVP contain?
4. What expiry/retry policy should apply to pending orders and references?
5. Which menu spellings, ingredients/allergens, delivery charges, cut-off times, meal-prep plans, and catering prices need confirmation from Cleo before publishing?

## Decisions Made

- Decision: The canonical project name is **Cleo's Munchies**.
  - Rationale: This is the final spelling provided in the request; the earlier “Cloe's” appears to be a typo.
- Decision: Use file-based planning for the entire project.
  - Rationale: Rex requested durable context across planning, implementation, progress, and handoff.
- Decision: Keep the first release frontend-heavy and simplistic.
  - Rationale: This is the stated project constraint; backend/payment scope remains uncommitted until confirmed.

## Errors Encountered

- Error: `hermes-plan-bootstrap` was not available on PATH.
  - Attempt: 1
  - Resolution/next change: Created the required planning files manually from the loaded skill templates.

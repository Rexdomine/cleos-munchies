# Task Plan: Build Cleo's Munchies

## Goal

Create a lightweight, frontend-heavy food-ordering project for Cleo's Munchies with a simple, approachable ordering experience.

## Next Step

Create the verified local review commit and hand the candidate to Rex without pushing or deploying.

## Current Phase

Phase 5 — Deliver

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
- [x] Choose Vite + React and a pure-module test architecture
- [x] Define the minimal ordering flow and screens
- [x] Record the mobile-first menu interaction direction
- [x] Finalize the initial brand and responsive design direction
- [x] Define an inert notification adapter boundary for deferred Brevo work
- **Status:** complete

### Phase 3: Implement
- [x] Build the frontend shell and menu experience
- [x] Add cart and lightweight checkout interaction
- [x] Generate and optimize the category image family
- [x] Keep project state and decisions current in planning files
- **Status:** complete

### Phase 4: Verify
- [x] Run unit/source-contract tests and production build
- [x] Exercise the ordering flow in a browser
- [x] Check responsive layout and empty/error states
- **Status:** complete

### Phase 5: Deliver
- [ ] Create the local review commit
- [x] Leave a clean local handoff
- [x] Summarize changed files and verification evidence
- [x] Record follow-up opportunities separately from the MVP scope
- **Status:** in_progress

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

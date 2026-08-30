# Audit implementation checklist

Updated: 2026-08-30

## P0 — Booking integrity

- [x] Scope service lookup to `business_id` in single-day availability.
- [x] Scope service lookup to `business_id` in range availability.
- [x] Reject inactive services in availability and booking creation.
- [x] Add a composite database foreign key preventing cross-tenant service bookings.
- [ ] Define the intended staff/resource selection experience.
- [ ] Add a service-to-qualified-staff mapping (required before safe automatic assignment).
- [ ] Implement staff-aware availability, booking assignment, and overlap protection.

## P1 — Public API hardening

- [x] Add shared validation primitives for public request bodies and query parameters.
- [x] Validate booking and availability identifiers, dates, contact fields, lengths, and business relationships.
- [x] Validate and bound anonymous web-chat and product-search payloads/history.
- [x] Validate signup slugs, names, emails, and password bounds.
- [x] Validate staff invite tokens/passwords and roll back partial invite acceptance.
- [x] Validate cancellation/reschedule booking identifiers and malformed JSON.
- [x] Require rescheduled appointments to match real opening-hours availability.
- [ ] Apply the shared validation layer to the remaining public integration and account endpoints.
- [x] Replace process-local rate limits with an atomic Supabase-backed limiter.
- [ ] Add abuse limits by IP, tenant, customer session, and authenticated user as appropriate.

## P1 — Automated confidence

- [ ] Add route-level tests for cross-tenant and inactive-service rejection (database protection is implemented).
- [ ] Test booking creation and race/conflict responses.
- [ ] Test staff/owner authorization and tenant isolation.
- [ ] Test payments, webhooks, cancellations, rescheduling, and subscriptions.
- [ ] Test AI tool authorization and customer identity boundaries.

## P1 — Launch readiness

- [ ] Replace legal contact, entity, address, and jurisdiction placeholders.
- [x] Refresh the README to match the current product and deployment requirements.
- [ ] Document required database migrations and operational services.
- [ ] Add centralized error monitoring and request correlation.

## P2 — UX and visual refinement

- [x] Relabel the scripted hero conversation honestly.
- [x] Standardize primary acquisition and exploration CTA language.
- [x] Make the deterministic booking form primary and demote the hero chat entry to a preference link.
- [x] Simplify the admin navigation by consolidating five configuration links under Settings.
- [x] Clarify the admin Assistant with separate “Ask” and “Change something” examples plus change-confirmation guidance.
- [x] Audit meaningful text below 14px and raise the practical typography floor.
  - [x] Raise shared labels, captions, form labels, hints, errors, and Assistant controls/messages.
  - [x] Review dense tables, calendars, status pills, and public-page secondary actions.
- [x] Add truthful product proof without inventing customer counts or testimonials.
- [x] Align the tenant-branding claim with the actual customization depth.
- [x] Develop a distinctive dark message-to-booking journey motif.

## Verification log

- 2026-08-30: Baseline test suite passed (17 tests across 2 files).
- 2026-08-30: Cross-tenant service fix passed all 17 tests.
- 2026-08-30: Production build passed after the cross-tenant service fix.
- 2026-08-30: Added booking/availability validation and six validation tests (23 tests total).
- 2026-08-30: Corrected demo language, standardized core CTAs, refreshed README, and simplified admin navigation.
- 2026-08-30: Hardened web chat, product search, signup, invitations, cancellation, and rescheduling; 25 tests pass and the production build succeeds.
- 2026-08-30: Added an accessible in-page Settings switcher and raised core form/Assistant typography.
- 2026-08-30: Replaced per-instance limits across 22 routes with an atomic Postgres limiter and a logged local-development fallback.
- 2026-08-30: Completed the marketing/public/admin visual pass: product-proof journey, stronger hierarchy, honest branding language, one primary booking path, and targeted typography improvements across forms, chat, calendar, tables, status pills, and mobile controls.
- 2026-08-30: Verified the landing, demo tenant, signup, owner login, and customer login routes at 320px and 390px. No horizontal overflow remained; enlarged the tenant booking/menu controls and password visibility control to 44px touch targets.

# Vanova Redesign — "Signal" direction

Replaces the warm editorial/boutique-magazine system (documented in `UI_UX_AUDIT.md`, now superseded — that direction is retired, not preserved). New direction: clean, modern, premium, bright and confident, subtly futuristic — cool graphite ink, crisp white/cool-gray surfaces, one vivid indigo-blue primary accent (`#4453FF`), one warm amber secondary for human-warmth moments, tighter radius scale, shadow-based elevation instead of border-heavy flat cards, dashed-border and tiny-uppercase-label patterns retired wherever touched.

## Done and verified this pass

**Foundation (cascades to all 29 routes / 59 components automatically — no per-file edit needed for color):**
- `app/globals.css` — full token rewrite: ink/surface/accent/semantic colors. Variable *names* kept stable (`--paper`, `--warm-surface`, `--cream`, `bg-accent`, etc.) since ~90 files already reference them via Tailwind's `colors` extend; only what they point to changed.
- `tailwind.config.js` — `borderRadius` scale tightened (xl 12→10px, 2xl 16→14px, 3xl 24→20px), `boxShadow` refined (cooler-toned, added `shadow-lift` for interactive rows), removed the `.landing`-scoped radius overrides (now global via the config instead).

**Shared primitives (used across dozens of files each):**
- `Button.tsx` — rectangular (rounded-xl) not the previous fully-pill treatment for every button regardless of context; added `secondary` variant and `lg` size; primary now lifts on hover (shadow + rise) instead of just dimming opacity.
- `PillTabs.tsx` — segmented-control pattern: light track, active option reads as an elevated white chip (shadow) instead of a solid accent fill.
- `formStyles.ts` — the file behind ~40 form controls (Services/Products/Staff/Field.tsx): borders 2px→1px, labels dropped the tiny-mono-uppercase treatment for small medium-weight sentence case, radius tightened.
- `EmptyState.tsx` — dropped the dashed-border-everywhere treatment for a solid border + filled surface.
- `PageHeader.tsx` — eyebrow label changed from tiny-mono-uppercase to a colored sentence-case kicker.
- `Toast.tsx` — radius tightened.

**Structural redesign (not just token swaps):**
- Marketing homepage (`app/page.tsx`) — nav links de-mono-uppercased; **hero headline concept rewritten** (the old magazine-quote treatment — "Do you have an opening tomorrow?" / "Already booked." — is gone; replaced with a direct product statement, since the demo panel beside it already shows the actual conversation); pricing card for the featured plan gained a "Most popular" badge (a real hierarchy fix, not decoration); channel strip, plan labels, and business-type tags de-mono-uppercased.
- Admin shell (`AdminSidebar.tsx`, `AdminMobileNav.tsx`) — nav group labels de-mono-uppercased; active nav item gained a left accent indicator bar on top of the soft fill (modern-dashboard-app pattern).
- `AdminDashboardBody.tsx` — date label and stat labels de-mono-uppercased, date label now a colored kicker matching PageHeader's convention.

## Verified

- `npx tsc --noEmit` — clean
- `npx next build` — clean, all 29 routes compile
- `npm test` — 17/17 passing
- Route sweep against a live dev server (isolated after discovering and killing a stale zombie process from earlier in the session that was falsely returning 500s on port 3000): `/`, `/signup`, `/login`, `/account/login`, `/glow-salon`, `/glow-salon/about`, `/glow-salon/gallery`, `/glow-salon/contact`, `/glow-salon/login` all 200; `/glow-salon/admin`, `/glow-salon/book` correctly 307 (auth-gated)
- Confirmed actual new hero copy present in served HTML (not stale/cached)
- **Not done:** literal screenshots. This environment has no browser/screenshot tool — verification here is build/typecheck/tests/HTTP status/HTML content, plus reasoning through the Tailwind classes directly, not visual inspection of rendered pixels.

## Signature element

Applied the `frontend-design` skill's rigor here: cool-graphite-and-indigo-blue-on-white, while correctly avoiding the three named AI-slop defaults (warm cream/serif/terracotta, near-black/acid-accent, broadsheet/hairline), was itself drifting toward *another* generic default — generic modern-SaaS blue (Stripe/Linear territory). Added `components/SlotGrid.tsx`: a grid of time slots, mostly empty, a fixed hand-picked set filling in with the accent color over ~2s on page load — grounded in the actual product mechanic (a calendar filling up over a day), not an invented decoration. Ambient background texture behind the homepage hero only (`lg:` and up, `-z-10`, `aria-hidden`), paced to land alongside `SelfBookingDemo`'s own reveal so the whole hero reads as one moment. Respects `prefers-reduced-motion` (fills instantly, no animation).

**Note for future passes:** running `next build` while `npm run dev` is live corrupts the dev server's `.next` cache (confirmed twice this session — same "Jest worker exceptions" failure). Going forward, verify with `tsc --noEmit` while dev is running; only run a full `build` with dev stopped, or expect to restart dev after.

## NOT yet touched — tracked for the next pass, in priority order

The token/primitive foundation already changes the *feel* of every one of these (new colors, new radius, new shadows all cascade automatically) — what's listed below is the remaining **structural/hierarchy** work: dashed borders, mono-uppercase labels, and heavy `border-2` treatments hardcoded per-file rather than inherited from a primitive, plus any genuine layout/composition rework.

- [ ] Rest of the marketing homepage (dashboard preview section, before/after, "how it works" step numbers, features grid icon circles, footer)
- [ ] `SelfBookingDemo.tsx`, `DashboardPreview.tsx`, `BeforeAfterCompare.tsx` — the three homepage illustration components
- [ ] Signup, Login, Account login (`app/signup`, `app/login`, `app/account/login`, `app/[slug]/login`) — `LoginForm.tsx`, `PlatformLoginForm.tsx`, `CustomerLoginForm.tsx`, `AuthMark.tsx`
- [ ] Public business pages: `SiteHeader.tsx`, `SiteFooter.tsx`, `app/[slug]/page.tsx` hero, `BookingForm.tsx`, `CalendarPicker.tsx`, about/gallery/contact pages, `ManageBooking.tsx`
- [ ] Customer account (`app/account/page.tsx`, `AccountBookingCard.tsx`)
- [ ] Rest of the admin dashboard body (`NextAppointmentCard.tsx`/`BookingDetail.tsx`, `SetupChecklist.tsx`, `AskAssistantBar.tsx`, `BookingsList.tsx`)
- [ ] `CalendarView.tsx`, `CustomersManager.tsx`/`CustomerDetailModal.tsx`, `ServicesManager.tsx`, `HoursManager.tsx`, `StaffManager.tsx`
- [ ] `BotIntegrationsSettings.tsx` (Channels), `AssistantChat.tsx` (Ask/Schedule), `BillingManager.tsx`, all of Settings (`BusinessProfileManager.tsx`, `SiteContentManager.tsx`, `BookingRulesManager.tsx`, `PaymentsManager.tsx`, `CustomDomainManager.tsx`)
- [ ] `ProductsManager.tsx` / products admin page
- [ ] Modals: `NewAppointmentModal.tsx`, `ConversationPanel.tsx`, `BookingDetailModal.tsx`, `CustomerDetailModal.tsx`, `GalleryGrid.tsx` lightbox, `WebChatWidget.tsx`
- [ ] `Skeleton.tsx` / loading states, `Toggle.tsx`

Working the same way the earlier UI/UX pass did: one item at a time, verified with `tsc`/`build`/`tests` after each batch, reported honestly.

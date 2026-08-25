# Vanova UI/UX Audit

## Scope and Important Distinction

The first review was primarily a UX, information-architecture, and product-structure analysis, with some visual observations. It was not a full visual UI critique because the rendered screens had not yet been inspected at real viewport sizes.

The later review was based on rendered desktop/mobile screens and the implementation. The authenticated dashboard was initially not available because `/glow-salon/admin` redirected to `/glow-salon/login`. After the owner logged in, the authenticated dashboard became available for direct inspection.

The dashboard findings below use both the live authenticated dashboard and the actual admin UI implementation. The other admin tabs were inspected through their rendered implementation and live route navigation where available.

The repository test suite passed during the audit: **2 test files, 17 tests**.

## Executive Verdict

The interface is visually coherent and more considered than a typical MVP: custom typography, a warm neutral palette, global focus treatment, reduced-motion handling, responsive navigation, loading/error states, and accessibility work are all present.

The biggest problems are structural and visual:

1. The product’s mental model is unclear. Marketing, public booking, customer accounts, owner admin, AI assistant, and commerce are all present, but the relationships between them are not obvious.
2. The owner dashboard is not onboarding-led. A new business can arrive with no services, hours, branding, payment setup, or channel connection, yet the product does not guide them through a clear “get ready to accept bookings” sequence.
3. Navigation reflects implementation categories, not user jobs. “Manage / Connect / Account” is tidy, but “Assistant,” “Channels,” “Billing,” and “Settings” do not clearly communicate the actions an owner needs to take.
4. The public booking site feels more like a template than a trustworthy business website.
5. Several promised product areas are incomplete or inconsistent. The clearest example is `/shop`, which openly displays “design pending,” while the product specification presents products as a supported public-site feature.
6. The interface is too quiet, too similar, and not decisive enough.

The product is not ugly. The problem is that it is too quiet, too similar, and not prioritizing the work that matters most.

## Critical Visual Issue: Homepage First Paint

The homepage initially renders as almost entirely blank because [components/Reveal.tsx](components/Reveal.tsx) begins content at `opacity-0` and only makes it visible after `IntersectionObserver` runs.

That creates a serious perceived-performance failure:

- Users may think the page failed to load.
- The first viewport appears empty.
- Search crawlers and screenshots may capture incomplete content.
- The visual experience depends on JavaScript executing correctly.
- Animation is being used as a rendering dependency instead of an enhancement.

**Recommendation:** render above-the-fold content visible by default. Use animation only after the content is already painted, or disable reveal behavior for the hero and initial viewport.

## Highest-Priority Problems

### 1. No First-Run Setup Journey

A newly created account is sent directly to the admin dashboard from [app/signup/page.tsx](app/signup/page.tsx). There is no setup checklist, progress state, sample data, preview, or guided route through:

- Business profile
- Services
- Opening hours
- Booking rules
- Payment connection
- Public page content
- Chat/channel activation

The empty dashboard only suggests “Add a service” and “Set your hours” in [components/AdminDashboardBody.tsx](components/AdminDashboardBody.tsx). That is not enough. It does not explain why those steps matter, what remains, or when the page is ready to share.

**Impact:** high. The most important moment in the product, the first five minutes after signup, is currently the least guided.

**Recommendation:** introduce a setup checklist directly on the dashboard:

`Profile → Services → Hours → Booking rules → Preview → Share`

Each step should show completion, a direct action, and a live preview of what customers will see.

### 2. Navigation Is Organized by System Structure, Not Business Tasks

The sidebar in [components/AdminSidebar.tsx](components/AdminSidebar.tsx) separates destinations into “Manage,” “Connect,” and “Account.” This is clean internally, but not necessarily meaningful to owners.

Examples:

- “Assistant” is under “Account,” despite being a primary operational workflow.
- “Channels” is under “Connect,” but website chat is not explained alongside Telegram, WhatsApp, and Messenger.
- “Booking rules and payments” are hidden under Settings.
- “Staff” and “Hours” are equally weighted with “Dashboard,” despite being setup tasks rather than daily destinations.
- Products are implemented but deliberately hidden from the primary nav.

**Impact:** high. Owners must remember where features live instead of navigating by intent.

**Recommendation:** use task-oriented grouping:

- **Today:** Dashboard, Calendar, Bookings, Customers
- **Set up:** Services, Hours, Staff, Booking page
- **Automate:** AI assistant, Channels
- **Business:** Insights, Billing, Settings

On mobile, the current menu becomes a long accordion-like list. It needs a stronger distinction between daily work and configuration.

### 3. Dashboard Is Informative, but Not Operational Enough

The dashboard in [components/AdminDashboardBody.tsx](components/AdminDashboardBody.tsx) has useful metrics, but the primary question should be:

> “What do I need to do next?”

Instead, it presents:

- Next appointment
- Today’s count
- Revenue
- Weekly totals
- Assistant prompt
- Booking list

The “next appointment” stat is visually emphasized, but it is not clearly actionable. There is no obvious action for:

- Confirming or completing an appointment
- Contacting the customer
- Opening booking details
- Marking no-show
- Rescheduling
- Viewing the full appointment record

The dashboard also uses “Today’s revenue” and “This week” metrics before establishing whether the business has completed bookings, deposits, or merely scheduled appointments. That can create ambiguity around what “revenue” means.

**Recommendation:** make the dashboard action-led:

- “Next appointment” as a real appointment card with customer, service, time, contact, and actions.
- “Today” as a queue of appointments, not just a count.
- Setup state above analytics for new businesses.
- Separate scheduled value, collected payments, and completed revenue.

### 4. Public Booking Page Lacks Trust and Business Context

The main public page in [app/[slug]/page.tsx](app/[slug]/page.tsx) is visually polished, but the hero prioritizes “Book with [business]” and a cover image over the information customers need to decide:

- Exact location
- Address or service area
- Cancellation policy
- Price range
- Staff identity
- Duration
- What happens after booking
- Whether payment is required
- Whether the business is currently available

The fallback hero is an accent-colored gradient. That maintains visual consistency, but can make businesses without uploaded assets feel unfinished. The public page also uses a generic platform structure for every business, which weakens the promise of “your brand, your page.”

**Recommendation:** make business identity more prominent and practical. Add:

- Location/service area
- Clear open/closed status
- Starting prices
- Cancellation/payment expectations
- Real photography or a more intentional empty-brand state
- A compact service preview before the booking form

### 5. Booking Flow Requires Too Much Interpretation

The booking flow is technically thoughtful in [components/BookingForm.tsx](components/BookingForm.tsx), but the customer still moves through three abstract steps:

- What you want
- When
- Your details

The interface does not clearly show the final appointment summary early enough. Customers should always see a persistent summary containing:

`Service · Date · Time · Duration · Price · Deposit`

The payment path is especially high-risk. Payment happens before the booking is created, and the code correctly handles the failure case, but the user experience still depends on a difficult support message if payment succeeds and booking creation fails.

**Recommendation:**

- Show a sticky summary on desktop and a collapsible summary on mobile.
- State clearly whether the customer is paying a deposit or the full amount.
- Explain refund/contact behavior before payment.
- Add a final “Review appointment” stage before payment.
- Use business timezone explicitly where the customer may be traveling.

## Live Authenticated Dashboard Analysis

The authenticated dashboard was directly inspected after login.

The live viewport used for the first dashboard screenshot was 766px wide, which means the application had already switched to the mobile/tablet navigation rather than showing the desktop sidebar.

The dashboard showed:

- Glow Salon identity
- Dashboard dropdown navigation
- Saturday, August 22
- “Good afternoon, Glow Salon”
- “Nothing booked today. A good day to get ahead of things.”
- Next up at 2:00 PM
- Today: 0 appointments
- Today’s revenue: ₦0
- This week: 3 appointments, ₦16,000, -6%
- Ask your assistant input and suggestions
- Upcoming bookings
- All / Confirmed / Past controls
- A booking for Lois Desire Fajuyigbe, Kids Cut, Aug 25 at 2:00 PM

### 1. “Next Up” Is Misleading

The dashboard says:

- “Nothing booked today”
- “Next up: 2:00 PM”
- Customer: Lois Desire Fajuyigbe
- Appointment date: August 25

The problem is that “Next up” only shows the time, not the date. A user can easily assume the appointment is today, especially directly below a “Today” heading.

It should say:

> Next appointment · Tue, Aug 25 at 2:00 PM

This is a content hierarchy problem expressed visually.

### 2. Mobile Dashboard Wastes the First Viewport

At 390px, the page shows:

- Header
- Greeting
- Description
- Two icon-only actions
- New appointment button
- Large summary card

The actual upcoming booking is pushed below the fold. For an appointment product, the next booking should be visible immediately.

The mobile order should be:

1. Header
2. Next appointment
3. Today’s schedule
4. Quick actions
5. Performance summary
6. Assistant

### 3. Icon-Only Actions Are Too Ambiguous

The link-copy and export actions are represented only by small icons. They are technically labelled for accessibility, but visually they are not obvious to normal users.

The screenshot makes them look like decorative utility icons rather than important actions.

Use:

- A visible “Copy link” label on larger screens
- An overflow menu on mobile
- Tooltips at minimum
- A clear success state after copying

### 4. Summary Card Is Too Tall on Mobile

The metrics stack vertically inside a large white card. The result is a lot of vertical space spent showing low-density information.

“Today’s revenue: ₦0” is also visually oversized relative to its importance when there are no appointments today.

On mobile, the summary should be a compact horizontal or two-column layout, with “Next appointment” separated as the main card.

### 5. No Clear Action on the Appointment

The live booking row shows a customer, service, contact number, and status, but the primary appointment action is not visually prominent.

The user should be able to immediately:

- Open appointment details
- Contact the customer
- Reschedule
- Cancel
- Mark completed
- Mark no-show

The current dashboard reads the appointment as a record, not as a work item.

## Dashboard Header

Sources: [components/AdminDashboardBody.tsx](components/AdminDashboardBody.tsx) and [components/DashboardHeaderActions.tsx](components/DashboardHeaderActions.tsx)

### Desktop/tablet issue

At a viewport width of 766px, the desktop sidebar is already hidden and the mobile navigation is active. This breakpoint is awkward. A tablet-sized screen receives the mobile experience even though it has enough width for a compact sidebar or persistent navigation rail.

Consider:

- Sidebar from `900px` upward
- Compact navigation rail between `768px` and `900px`
- Mobile menu below `768px`

### Header identity

The business identity is clear, but the page header gives too much prominence to the greeting and not enough to the current work queue.

“Good afternoon, Glow Salon” is pleasant, but it consumes valuable vertical space. The dashboard should emphasize the current operational state before the greeting.

## Dashboard Navigation and Tabs

Sources: [components/AdminSidebar.tsx](components/AdminSidebar.tsx) and [components/AdminMobileNav.tsx](components/AdminMobileNav.tsx)

### Desktop sidebar

The sidebar is visually restrained and clean. However, the grouping is not naturally task-oriented:

- Dashboard and Calendar are operational.
- Customers, Services, Hours, and Staff are management.
- Channels is an integration area.
- Assistant is a major workflow but appears under Account.
- Billing and Settings are account/configuration.

“Manage / Connect / Account” is internally tidy but not how most owners think about the product.

The sidebar also has too little emphasis on the current business state. It identifies the business, but does not show:

- Setup completion
- Booking page status
- Channel status
- Trial status
- Notifications or pending actions

### Mobile navigation

The mobile navigation menu contains:

- Dashboard
- Calendar
- Customers
- Services
- Hours
- Staff
- Channels
- Assistant
- Billing
- Settings
- Four settings subsections
- Sign out

That is too much for one expandable mobile menu.

The labels are clear individually, but the overall structure asks the user to remember the product architecture. It should instead reflect user intent:

### Today

- Dashboard
- Calendar
- Customers

### Set up

- Services
- Hours
- Staff
- Booking page

### Automate

- Assistant
- Channels

### Business

- Insights
- Billing
- Settings

The menu should also show status indicators:

- Setup incomplete
- Channel disconnected
- Trial ending
- Pending schedule changes

### Dashboard tabs

Sources: [components/BookingsList.tsx](components/BookingsList.tsx)

The live dashboard tabs are:

- All
- Confirmed
- Past

These are visually understated and conceptually inconsistent.

“All” is a scope. “Confirmed” is a status. “Past” is a time category. These should not be presented as equivalent tabs.

A clearer model would be:

- Upcoming
- Today
- Past

Then use status filters separately:

- Confirmed
- Cancelled
- Completed
- No-show

On mobile, the tabs compete with the booking list title. A horizontally scrollable filter bar or segmented control would be clearer.

### Current table

The desktop booking table is clean but too light visually. Thin dividers and muted headers make it feel more like an exported report than a live work queue.

The customer name and appointment time should carry more weight. Status should be visually stronger. The booking row itself should be clickable.

### Mobile booking row

At 390px, the booking row collapses into a dense stack. The date and time become visually concatenated, and important context is spread vertically.

The mobile card should have this structure:

- Date and time at top
- Customer name prominently
- Service and duration underneath
- Status badge
- Primary action row

The current responsive table is technically adapted but not redesigned for mobile.

## Page-by-Page Review

### Marketing homepage `/`

Source: [app/page.tsx](app/page.tsx)

The homepage has a polished editorial tone, but it lacks enough product presence.

#### Strengths

- Strong type pairing
- Clear terracotta brand accent
- Good use of horizontal section dividers
- The before/after section is visually understandable
- Pricing cards are easy to compare
- The page avoids generic SaaS purple gradients

#### Problems

The hero is mostly large typography and a simulated chat panel. The headline is expressive, but the first impression does not immediately show what Vanova is.

The phrase:

> “Do you have an opening tomorrow?”  
> “Already booked.”

is memorable, but the product category is secondary. The UI needs to communicate “AI appointment booking” faster.

The page repeats the same promise across hero, dashboard preview, before/after, feature list, and CTA. This makes the page feel long without creating enough new visual information.

The product previews are too much like illustrations. They need to feel like actual product evidence.

Other concerns:

- “Website chat,” “Telegram,” “WhatsApp,” and “Messenger” are presented together even though only some are live. The “soon” labels are honest but dilute confidence.
- Pricing appears before the user sees a clear setup or product workflow.
- The live demo link points to a hardcoded `glow-salon`, which may look like a fake or unfinished tenant.
- There is no proof: no customer result, testimonial, real booking example, or business story.
- The product preview is illustrative, not demonstrably interactive.
- The page uses many warm-surface sections, creating a flat visual rhythm.

#### Recommended visual improvements

- Make “AI receptionist for appointment businesses” more prominent in the hero.
- Use one real-looking end-to-end workflow instead of several similar demonstrations.
- Add a real product screenshot or more convincing interactive preview.
- Add customer proof, business outcomes, or a real business example.
- Give the premium plan a stronger visual distinction.
- Reduce the number of repeated warm-surface sections.
- Reduce repeated marketing copy.

### `/signup`

Source: [app/signup/page.tsx](app/signup/page.tsx)

The signup page is clean and restrained, but too sparse and technical.

Problems:

- No password visibility toggle.
- No explicit password requirements beyond “8 characters.”
- No explanation of what happens after account creation.
- The slug field is technically important but presented as a low-level URL choice.
- No availability check or feedback for the chosen slug before submit.
- No terms/privacy reassurance.
- Mobile loses the strongest product explanation because the left panel disappears.
- The form begins too low on the viewport.
- The page has no brand mark or clear Vanova identity in the form area.
- The URL field visually resembles a technical implementation detail.
- The primary action appears below the visible mobile screenshot, which weakens conversion.
- The form lacks a visual progress or readiness cue.

#### Recommendation

Make signup a guided “Create your booking page” flow and keep a compact value summary visible on mobile.

The “Choose your link” field should visually show the outcome:

> Your customers will visit `yourdomain.com/your-business`

The user should feel that they are building something, not filling out an internal database form.

### `/login` and `/[slug]/login`

Sources: [app/login/page.tsx](app/login/page.tsx) and [app/[slug]/login/page.tsx](app/[slug]/login/page.tsx)

The two owner login experiences duplicate each other and create an unnecessary question:

> Which login should I use?

The business-scoped login also lacks a clear link back to the public booking page or generic login.

Problems:

- Weak Vanova branding
- The desktop left panel is hidden on mobile, leaving only a floating form on a blank background.
- The form has no card, logo, contextual illustration, or business identity.
- There are multiple login routes with nearly identical visual treatments.
- The owner and customer login experiences are not visually distinct enough.
- The scoped login does not strongly show the business identity.
- No visible route back to the public booking site.

#### Recommendation

Use one canonical owner login route, preserve scoped links through redirects, and make the business identity clear when relevant.

Authentication screens need a shared identity system:

- Logo
- Product or business name
- Clear role label
- Consistent secondary navigation
- More intentional empty space

### `/account/login`

Source: [app/account/login/page.tsx](app/account/login/page.tsx)

The page communicates the passwordless model well, but the separation between customer account login and owner login is not strongly branded.

A customer arriving from a booking confirmation may not understand whether “My bookings” belongs to the business or Vanova.

#### Recommendation

Use clearer language such as “View all your Vanova bookings” and include a route back to the booking page they came from when possible.

### `/account`

Sources: [app/account/page.tsx](app/account/page.tsx) and [components/AccountBookingCard.tsx](components/AccountBookingCard.tsx)

The account area is clean but underpowered. It feels like a list rather than a useful personal booking space.

Problems:

- The empty state does not offer “Book again” or a discovery path.
- Booking cards expose “Manage” and messaging, but the hierarchy between those actions is weak.
- Multiple businesses are represented in one list without stronger grouping or filtering.
- No calendar export, add-to-calendar action, address, payment information, or cancellation deadline is visible at account level.
- The account is email-based, while booking itself does not require an account. That distinction needs clearer explanation.
- The header is plain and lacks a strong account identity.
- Booking cards have limited visual differentiation between upcoming, past, cancelled, and completed states.
- “Manage” is visually subtle despite being a key action.
- Message and conversation controls are easy to overlook.
- There is no calendar-oriented visual language.

The account page should feel like a useful personal booking hub, not a list of database records.

### `/[slug]`

Source: [app/[slug]/page.tsx](app/[slug]/page.tsx)

This is the most important customer-facing page. Its biggest issue is not layout; it is decision clarity.

“Book an appointment” and “Not sure? Just ask” are both presented as major CTAs. That is reasonable, but the interface does not explain the difference:

- Use booking when you know the service.
- Use chat when you need recommendations, availability help, or business information.

The booking form is below a large hero, so customers may need to scroll before seeing the actual service choices.

#### Rendered visual findings

The public page is currently the strongest visual area, especially on desktop.

Strengths:

- Business identity is clear
- Hero image creates immediate atmosphere
- CTAs are visible and understandable
- Service choices are clean
- Desktop navigation is understandable
- Mobile navigation is present
- Booking flow feels more business-facing than platform-facing

Problems:

- The hero image is extremely dark and visually muddy.
- The image treatment suppresses business personality.
- The mobile hero contains description, large title, opening hours, two buttons, floating chat button, sticky header, and booking content immediately below.
- The mobile header is cramped.
- Business names truncate too easily.
- The hero presents two major choices without explaining the difference.
- The public page feels like a generic platform structure for every business.

#### Recommendation

Show a compact “Choose how to book” section immediately below the hero, with service cards and chat as clearly differentiated paths.

Also add:

- Better image selection
- Less aggressive darkening
- Deliberate focal crop
- More contrast between image and content
- A sticky bottom booking action on mobile
- Price, duration, location, and policy context before commitment

### Booking Form

Source: [components/BookingForm.tsx](components/BookingForm.tsx)

The component is functionally thoughtful, but visually it needs stronger confirmation and context.

The customer should see a persistent appointment summary:

`Service · Date · Time · Duration · Price · Deposit`

The progress line is elegant, but visually understated for a process involving money.

Payment needs stronger communication:

- Deposit versus full payment
- Amount due now
- Refund or cancellation implications
- What happens after payment
- Whether the booking is fully confirmed

#### Recommendation

- Show a sticky summary on desktop and a collapsible summary on mobile.
- Add a final “Review appointment” stage before payment.
- Explain payment failure and support behavior plainly.
- Make the business timezone explicit where relevant.

### `/[slug]/about`

Source: [app/[slug]/about/page.tsx](app/[slug]/about/page.tsx)

The page is too minimal. It is mostly a heading, image, and paragraph. It feels like a text page added to satisfy a route rather than a meaningful business page.

It needs supporting trust content such as:

- Location
- Team
- Specialties
- Hours
- Booking CTA
- Social proof

### `/[slug]/gallery`

Source: [app/[slug]/gallery/page.tsx](app/[slug]/gallery/page.tsx)

The page depends entirely on images. A business with one image should not receive a large gallery page that feels vacant.

#### Recommendation

Support:

- Captions
- Categories
- A hero image
- A clear booking CTA
- An intentional sparse/empty gallery state

### `/[slug]/contact`

Source: [app/[slug]/contact/page.tsx](app/[slug]/contact/page.tsx)

The contact cards are attractive, but the page lacks:

- Address/map
- Opening hours
- Expected response time
- Booking CTA
- Context for social channels
- A meaningful empty state when no contact details exist

The “no contact details” state tells users to book or use chat, but does not provide a prominent button for either.

### `/[slug]/manage/[bookingId]`

Source: [app/[slug]/manage/[bookingId]/page.tsx](app/[slug]/manage/[bookingId]/page.tsx)

The booking card is visually consistent with the booking confirmation, which is good.

Problems:

- The booking code is not the most useful primary identifier.
- Cancellation/rescheduling actions are visually separated from the booking details.
- The page does not show price/payment state.
- It does not prominently explain deadlines or consequences.
- A cancelled booking still occupies the same visual structure without a next-best action.

This page should be designed around one question:

> “What can I do with this booking now?”

### `/[slug]/forgot-password`, `/[slug]/reset-password`, `/[slug]/accept-invite`

Sources: [app/[slug]/forgot-password/page.tsx](app/[slug]/forgot-password/page.tsx), [app/[slug]/reset-password/page.tsx](app/[slug]/reset-password/page.tsx), and [app/[slug]/accept-invite/page.tsx](app/[slug]/accept-invite/page.tsx)

These flows are functional but visually disconnected from the rest of the product.

The invite page gives no business name, inviter identity, or email context. “Missing invite token” is technically accurate but not helpful.

#### Recommendation

Show:

- Business identity
- Invited email
- Expiry state
- Recovery action for invalid or expired links
- Clear route back to login

## Admin Tabs

### Admin Calendar

Source: [components/CalendarView.tsx](components/CalendarView.tsx)

The live Calendar tab displays seven columns with “Free” states and booking chips.

#### What works

- Week/day modes
- Previous/next navigation
- Today button
- Visible free states
- Cancelled bookings remain visible
- Good use of status indicators

#### Problems

The Calendar tab is not a true scheduling calendar. It displays bookings as chips, not time-positioned events.

It lacks:

- Time-axis structure
- Duration visualization
- Relative time positioning
- Overlap visibility
- Strong distinction between available time and occupied time

A booking at 10:40 AM and another at 1:30 PM appear as two stacked chips, but the spacing between them does not represent the time gap.

The owner cannot quickly see:

- How long each appointment lasts
- How much free time remains
- Whether bookings overlap
- Whether there is enough buffer between appointments

Day view should use a vertical time-grid calendar. Week view can remain compact as an overview.

On mobile, horizontal scrolling is defensible for a week view, but it needs stronger affordance so users know more days exist.

### Admin Customers

Source: [app/[slug]/admin/customers/page.tsx](app/[slug]/admin/customers/page.tsx)

The customers page derives people from booking rows. That is useful for an MVP but creates a weak customer model.

Likely problems:

- No customer profile or notes.
- No total spend or lifetime booking value.
- No last/next appointment summary.
- No merge or duplicate handling.
- No clear action hierarchy for contacting, booking, or viewing history.

Each customer should visually show:

- Name
- Number of appointments
- Last appointment
- Next appointment
- Total spend
- Preferred contact method
- Conversation availability
- Notes

### Admin Services

Source: [components/ServicesManager.tsx](components/ServicesManager.tsx)

This is one of the densest areas.

The page combines:

- Active count
- Hidden count
- Add service
- Search
- Categories
- Export
- Edit
- Delete
- Revenue
- Booking counts
- Pagination

The result is dense and control-heavy.

The primary visual question should be:

> What can customers book right now?

The current interface instead feels like a database management screen.

Recommended row hierarchy:

`Service name → duration → price → visible/bookable state → edit`

Move revenue and booking performance into a secondary panel or insights view.

The add-service form expands inline, causing layout movement. A side panel or modal would create a more stable layout.

Additional issues:

- Category filters, search, export, add, edit, active/hidden status, booking counts, and pagination compete visually.
- “Hidden,” “inactive,” and “bookable” are not necessarily explained in customer terms.
- Price input lacks currency context.

### Admin Opening Hours

Source: [components/HoursManager.tsx](components/HoursManager.tsx)

The weekly selector is attractive but too subtle.

The open/closed state relies heavily on:

- Tiny day labels
- Small dots
- Background color
- A compact status pill

That is visually elegant but not immediately scannable.

The “one window per day” concept also makes the UI look simpler than real businesses are. It is a major product limitation for businesses with lunch breaks, split shifts, or multiple schedules.

The page needs:

- Copy weekdays action
- Apply Monday-Friday action
- Multiple opening intervals
- Holiday overrides
- Staff-specific hours
- Preview of customer-visible slots

Saving only one day at a time creates unnecessary friction.

### Admin Staff

Source: [app/[slug]/admin/staff/page.tsx](app/[slug]/admin/staff/page.tsx)

The Staff route delegates most of its visual experience to the manager component, but the page should communicate more than invitations.

Staff needs clear concepts for:

- Role
- Availability
- Appointment ownership
- Permissions
- Active/inactive state
- Pending invitations

If staff scheduling is supported, availability should be visible here rather than hidden elsewhere.

### Admin Channels

Source: [app/[slug]/admin/channels/page.tsx](app/[slug]/admin/channels/page.tsx)

The page concept is correct, but the visual model should be more explicit.

Each channel should show:

- Connection state
- What customers can do through it
- Last tested/active status
- Setup action
- Test conversation action
- Example customer experience

“Connected” is not enough visual feedback for an integration page.

### Admin Assistant

Sources: [app/[slug]/admin/assistant/page.tsx](app/[slug]/admin/assistant/page.tsx) and [components/AssistantChat.tsx](components/AssistantChat.tsx)

The assistant screen is visually simple and approachable, but the large chat box dominates too much of the page.

It combines two different product jobs:

- Business intelligence questions
- Schedule changes

Those should not feel like the same tool.

The assistant needs a stronger surrounding frame:

- Suggested tasks grouped by type
- Pending actions
- Confirmation state
- Recent requests
- Clear distinction between “answer” and “change something”

The “nothing changes until you say yes” message is important and should be treated as a trust feature, not a small informational banner.

### Admin Billing

Billing needs a stronger visual account summary.

It should make these immediately visible:

- Current plan
- Trial or renewal date
- Payment method
- Billing status
- Upgrade action
- Feature comparison
- Payment history
- Consequences of expiration

Billing should feel trustworthy and explicit, not like another settings form.

The homepage pricing also does not clearly connect plan differences to the actual admin experience.

### Admin Settings

Sources: [app/[slug]/admin/settings/page.tsx](app/[slug]/admin/settings/page.tsx) and [components/SettingsSections.tsx](components/SettingsSections.tsx)

Settings is the largest information architecture problem. It contains:

- Business profile
- Website content
- Booking rules
- Payments
- Webhooks
- Custom domain

These are not one conceptual category. The sidebar workaround hides the complexity rather than resolving it.

Recommended top-level destinations:

- Booking page
- Availability and policies
- Payments
- Integrations
- Domain
- Business profile

Also add unsaved-change protection and clearer destructive-action warnings.

### `/shop`

Source: [app/shop/page.tsx](app/shop/page.tsx)

The page literally renders:

> “Shop product - scaffolding in place, design pending.”

This should not be visible in a production interface. Either complete it, hide the route, or create a polished coming-soon state consistent with the system.

### Missing `/[slug]/book`

The product specification says `/[slug]/book` exists, but the route inventory does not show it. This creates a mismatch between documented product and actual navigation/linking model.

This should be resolved before further visual refinement.

## Global Visual System

### Typography

The custom typography is one of the strongest parts of the product. Outfit gives the interface personality and Plus Jakarta Sans is readable.

The problem is hierarchy:

- Too many headings use similar weights and sizes.
- Mono uppercase labels are used everywhere, so they stop feeling special.
- Secondary text is often too faint.
- Operational screens sometimes feel editorial instead of utilitarian.
- Important information can look like metadata because it uses the same muted treatment.

Use the display font for identity and primary statements, but use a stronger, more practical hierarchy for admin information.

### Color

The terracotta accent is attractive and appropriate for the brand, but it is doing too many jobs:

- Primary buttons
- Links
- Active navigation
- Chat button
- Progress bar
- Status emphasis
- Brand mark
- Selected states

Reserve it more carefully for:

- Primary action
- Current location
- Brand identity
- High-priority emphasis

Use neutral selected states and semantic colors for secondary interaction.

### Borders and radius

Rounded corners are overused across the product. Almost every input, card, button, avatar, and section uses a rounded treatment.

The repeated combination of rounded surface, thin border, soft accent background, and tiny label makes screens feel visually repetitive.

Assign radius by role:

- Small radius for controls
- Medium radius for cards
- Minimal radius for tables and operational sections
- Full radius only for pills, avatars, and floating actions

Dashed borders should primarily indicate:

- Empty drop zones
- Separators within a confirmation object
- Temporary or inactive states

### Spacing

There is generous whitespace across public and auth pages. On marketing pages this creates calm. In admin screens it can make the product feel less capable and less information-rich than it is.

The admin area should use:

- Tighter table spacing
- More visible grouping
- Stronger section headers
- Better use of horizontal space
- More obvious primary actions

### Muted text

The palette uses many low-contrast text colors:

- `--ink-soft`
- `--ink-faint`
- muted mono labels
- subdued status metadata

This creates a quiet aesthetic, but some screens have too little contrast between primary, secondary, and tertiary information.

### Accent color

Terracotta works well, but it is currently used for action, identity, selected states, and status emphasis. The product would feel more sophisticated if the accent were reserved for action and identity, while selected states and informational emphasis used additional neutral or semantic treatments.

## Mobile UI Audit

The mobile interface is functional, but it is not optimized around mobile priorities.

Main issues:

- Public header has too many competing controls.
- Business name truncates.
- Hero content becomes crowded.
- Floating chat button competes with booking content.
- Homepage loses the explanatory side panel entirely.
- Auth screens become blank, unbranded form pages.
- Admin navigation requires a large hidden menu.
- Services and hours controls become dense quickly.
- Long rounded buttons and pills consume too much horizontal space.
- Important secondary information is often too faint.
- The current page state is not always obvious after navigation.

Mobile needs a stronger priority model, not just smaller versions of desktop layouts.

## Interaction, Accessibility, and State Coverage

A truly exhaustive audit also needs to cover:

- Every page at desktop, tablet, and phone widths
- Every dashboard tab and nested Settings section
- Loading, empty, error, success, disabled, and confirmation states
- Modal, dropdown, tooltip, toast, and chat interactions
- Typography scale, line height, spacing, and component consistency
- Color contrast and status semantics
- Focus states, keyboard navigation, screen-reader labels
- Touch-target sizes and mobile scrolling behavior
- Form validation and error-message placement
- Responsive breakpoints and layout transitions
- Animation timing and reduced-motion behavior
- Date, time, currency, and timezone presentation
- Button hierarchy and icon clarity
- Customer booking, payment, cancellation, and rescheduling states
- Admin permissions and role-specific UI
- Public business branding and customization limits
- Data density, pagination, filtering, and search behavior
- Cross-browser rendering and perceived loading performance

## Visual Consistency Issues

Across the app, the following patterns are overused:

- Rounded cards
- Rounded full-width buttons
- Soft accent backgrounds
- Dashed borders
- Tiny uppercase labels
- Muted metadata
- Centered empty states

These are not individually bad. The issue is repetition. Almost every screen speaks in the same visual voice, so users receive too few cues about whether they are:

- Booking
- Managing operations
- Editing settings
- Reviewing analytics
- Configuring integrations

## Product and Route Gaps

The documentation and actual route structure need alignment.

The product specification includes:

- Public product listings
- `/[slug]/book`
- Product management
- Channel integrations
- Customer account information

But the UI includes at least one visibly unfinished route and a route mismatch.

Resolve incomplete or undocumented routes before further visual refinement, especially `/shop` and `/[slug]/book`.

## Recommended Redesign Order

### Fix immediately

1. Remove the homepage blank first paint caused by `Reveal`.
2. Fix the public mobile hero/header crowding.
3. Add a first-run setup state to the dashboard.
4. Make the dashboard’s next appointment and today’s queue visually dominant.
5. Show the date in “Next up.”
6. Replace or redesign the visible Shop placeholder.

### Fix next

7. Rework admin navigation around daily work, setup, automation, and business.
8. Turn Calendar day view into a true time grid.
9. Add persistent booking summary and stronger payment context.
10. Clarify customer versus owner authentication visually.
11. Split Assistant analytics from schedule management.
12. Replace mobile booking-table compression with appointment cards.
13. Simplify Services controls.
14. Add bulk editing and multiple intervals to Hours.
15. Split Settings into clearer product areas.

### Refine after that

16. Reduce repeated rounded cards and dashed borders.
17. Increase secondary text contrast where needed.
18. Make empty states task-specific.
19. Add stronger business identity to public pages.
20. Standardize buttons, icons, status pills, radius, spacing, and component hierarchy in a formal design system.
21. Add real product proof and reduce repetitive marketing copy.

## Final Professional Assessment

The UI has a good foundation, but it currently looks more like a refined overview screen than a serious appointment operations tool.

The current UI is polished, restrained, and technically thoughtful, but it is not yet visually distinctive or fully product-mature.

The interface does not need a completely different visual identity. It needs a stronger, more deliberate version of the identity it already has.

Keep the warm editorial foundation, but introduce:

- Stronger hierarchy
- More decisive operational layouts
- More authentic product imagery
- Clearer differentiation between public pages, daily operations, configuration, AI interaction, and billing
- More useful mobile priorities
- More visible business context

The most important design change is to make every screen visually answer:

> What is this page for, what matters most here, and what should I do next?

That is where the current interface is losing you.

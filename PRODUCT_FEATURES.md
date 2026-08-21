# LD Solutions / Product Feature Specification

## 1. Product Summary

LD Solutions is a multi-tenant appointment management platform for small service businesses. Each business gets its own branded booking website, customer-facing booking flow, conversational AI assistant, and private operations dashboard.

The product is designed for businesses that earn revenue by taking appointments, including:

- Salons and barbershops
- Beauty, wellness, and massage businesses
- Clinics and therapists
- Tutors and coaches
- Consultants and advisors
- Photographers and studios
- Personal trainers
- Other appointment-based service providers

The core promise is:

> A customer asks for an appointment in natural language. The system checks the business's real availability, confirms a suitable time, creates the booking, and places it on the owner's dashboard.

LD Solutions is not only a calendar or a website builder. It combines a branded booking site, real scheduling logic, customer communication, AI-assisted booking, and business operations in one product.

## 2. Main Product Areas

### Public business website

Every business has a public URL based on its unique slug, for example:

`yourdomain.com/your-business`

The public site can include:

- Business name
- Logo
- Cover image
- Accent color
- Short business description
- Services and prices
- Appointment booking
- Business hours
- About page
- Gallery page
- Contact page
- Phone and email links
- Instagram and Facebook links
- Website chat assistant
- Product listings where products are configured

### Conversational booking assistant

Customers can ask for an appointment conversationally rather than navigating a rigid form. The assistant can:

- Understand a request for an appointment
- Ask what service the customer wants
- Check the business's real availability
- Respect service duration
- Respect business hours
- Respect existing bookings
- Respect buffer time
- Offer available times
- Collect customer details
- Create a booking
- Confirm the booking conversationally
- Route the booking into the business dashboard

The assistant is available through website chat and has channel integrations for Telegram, WhatsApp, and Facebook Messenger.

### Appointment scheduling engine

Availability is calculated from actual scheduling data rather than from a static list of times. The system considers:

- Weekly opening hours
- Selected service duration
- Existing non-cancelled bookings
- Booking buffer time
- Maximum advance booking window
- Business timezone
- Cancellation rules
- Current time

The database also contains a PostgreSQL exclusion constraint to prevent overlapping bookings from being inserted during race conditions.

### Business operations dashboard

Owners and staff can manage daily operations from a private dashboard. It includes:

- Today's booking count
- Next upcoming booking
- Today's revenue
- This week's booking count and revenue
- Upcoming bookings
- Past bookings
- Booking status
- Customer search
- Customer records
- Calendar views
- Services
- Products
- Opening hours
- Staff
- Connected communication channels
- Settings
- Billing and subscription status
- Insights and analytics
- Schedule assistant

## 3. Public Pages

### `/`

## Marketing homepage

The homepage explains the product to prospective business owners.

It includes:

- Product navigation
- AI receptionist positioning
- Hero booking conversation demo
- Website chat, Telegram, WhatsApp, and Messenger channel strip
- Dashboard preview showing appointments and summary metrics
- Before-and-after comparison of manual booking versus automated booking
- How-it-works trail
- Feature overview
- Supported business types
- Pricing section
- Signup calls to action
- Live demo link

The homepage currently positions the product around:

- Customers asking naturally
- Real-time availability
- Automatic confirmations
- One dashboard for all bookings
- Branded booking pages
- Team management

### `/signup`

## Business signup

The signup page creates a new business account and owner account.

The user provides:

- Business name
- Business URL slug
- Owner email
- Password

The signup process creates or initializes:

- Authentication account
- Business tenant record
- Owner staff record
- Business slug
- Initial subscription/trial state where configured

After signup, the owner is signed in and taken to the business admin area.

### `/login`

## Platform login

General login entry point for account access.

### `/account/login`

## Customer account login

Customer-facing account login for customers who have an account or booking history associated with the platform.

### `/account`

## Customer account area

The customer account area is intended to show a customer's bookings and account-level booking information.

### `/[slug]`

## Public business booking page

This is the main customer-facing page for an individual business.

It includes:

- Business header and branding
- Cover image or accent-colored hero
- Business logo
- Business description
- Business hours summary
- Book now action
- Chat with the AI assistant action
- Service selection
- Date selection
- Available time selection
- Customer information form
- Payment flow when the business requires payment and Paystack is connected
- Footer with business contact details and navigation
- Website chat widget

The page generates business-specific metadata and JSON-LD structured data using the business name, URL, logo, and available services.

### `/[slug]/book`

## Business booking route

A dedicated booking route for the business booking experience. It supports the same business-scoped booking context and is intended for direct booking links.

### `/[slug]/about`

## Business About page

Displays the longer business story or description when the owner has enabled the About section and supplied content.

### `/[slug]/gallery`

## Business Gallery page

Displays uploaded business images when the owner has enabled the Gallery section and supplied gallery content.

### `/[slug]/contact`

## Business Contact page

Displays the business's configured contact details, including available phone, email, Instagram, and Facebook links.

### `/[slug]/manage/[bookingId]`

## Customer booking management page

A customer-facing page for managing an individual booking. It is intended to support booking actions such as viewing, cancelling, or rescheduling according to the booking's rules and available route behavior.

### `/[slug]/login`

## Business-scoped login

Login entry point tied to a specific business slug.

### `/[slug]/forgot-password`

## Business password recovery request

Allows a business user to begin password recovery for a business-scoped account.

### `/[slug]/reset-password`

## Password reset completion

Allows a user to set a new password after following the recovery flow.

### `/[slug]/accept-invite`

## Staff invite acceptance

Allows an invited staff member to accept an invitation and connect their account to a business team.

## 4. Admin Pages

All admin pages are under:

`/[slug]/admin`

The admin area uses a shared shell with:

- Business identity
- Business type and slug
- Desktop sidebar navigation
- Mobile navigation
- Manage navigation group
- Account navigation group
- Staff role display
- Sign out action
- Toast notifications
- Business-scoped route protection

### `/[slug]/admin`

## Dashboard

The main business operations view.

The dashboard includes:

- Search for clients or bookings
- Export and header actions
- Dashboard heading
- Today's appointment count
- Next upcoming appointment
- Today's revenue
- This week's appointment count
- This week's revenue and comparison information
- Upcoming and past booking lists
- Booking filtering by status
- Customer contact access
- Conversation panel for supported customer contacts
- Booking status visibility

Bookings are shown with information such as:

- Time
- Customer
- Service
- Staff member
- Contact information
- Status

### `/[slug]/admin/calendar`

## Calendar

Calendar view of the business's bookings and schedule. It is intended for visual day and date planning rather than only reading the booking list.

### `/[slug]/admin/customers`

## Customer management

Customer management area for viewing and organizing people who have booked with the business.

Expected customer information includes:

- Name
- Phone
- Email
- Booking history
- Contact origin where available
- Related appointments

### `/[slug]/admin/services`

## Services management

The services area manages what customers can book.

A service can include:

- Name
- Category
- Duration in minutes
- Price
- Active/inactive state

Services are business-scoped. Only active services are shown on public booking pages and made available to customers.

Categories are flexible text labels rather than a fixed platform-wide category list.

### `/[slug]/admin/products`

## Product management

Products are optional business inventory or catalog items.

A product can include:

- Name
- Description
- Price
- Stock quantity
- Image
- Active/inactive state

The product system is currently primarily a catalog and AI-discovery foundation. Full checkout, payment, and inventory decrement behavior are a later phase compared with appointment booking.

### `/[slug]/admin/hours`

## Opening hours

The hours page configures business-wide availability by day of week.

The current interface uses a weekly rhythm selector:

- Seven compact day markers
- Open/closed status dots
- Selected-day editor
- Opening time
- Closing time
- Save day action
- One availability window per day

The underlying availability model supports business-wide hours and staff-specific records, although the current main hours UI focuses on business-wide hours.

### `/[slug]/admin/staff`

## Staff management

The staff area supports managing people who work for the business.

Staff records include:

- Name
- Email
- Authentication connection
- Role
- Business membership

The platform distinguishes between owner and staff roles and uses business membership for access control.

### `/[slug]/admin/settings`

## Settings

Settings are organized into two major groups.

### Your booking page

Controls how the public booking experience looks and what information it exposes.

#### Business profile

- Business name
- Logo
- Business description
- Cover photo
- Accent color
- Preset accent colors
- Custom color picker

#### Website content

- About text
- About page visibility
- Gallery photos
- Gallery page visibility
- Contact phone
- Contact email
- Instagram URL
- Facebook URL
- Contact page visibility

### Bookings & connections

Controls scheduling rules, automation, and communication channels.

#### Booking rules

- Buffer time between bookings
- Maximum advance booking period
- Cancellation notice window
- Webhook URL for Zapier, Make, or another CRM
- Payment requirement where configured
- Deposit percentage where configured

#### AI booking assistant / connected channels

- Telegram bot connection
- Facebook Messenger page connection
- WhatsApp Business connection through Meta Embedded Signup
- Connected identity display
- Disconnect actions
- Channel-specific connection instructions

### `/[slug]/admin/channels`

## Communication channels

Channel management view for connected messaging channels and their business-specific routing.

Supported channel concepts include:

- Website chat
- Telegram
- WhatsApp
- Facebook Messenger

### `/[slug]/admin/insights`

## Insights and analytics

Business performance and operational insight area. This is intended for understanding booking patterns and business activity beyond the immediate dashboard.

### `/[slug]/admin/schedule-assistant`

## Schedule assistant

Admin-facing schedule assistance area intended to help the owner reason about upcoming availability, appointments, and schedule changes.

### `/[slug]/admin/billing`

## Billing and subscription

Business subscription management for paying to use the platform.

The subscription system supports:

- Trial period
- Active subscription
- Cancellation state while paid time remains
- Past-due state
- Expired state
- Monthly billing
- Flutterwave checkout
- Payment history
- Subscription period end
- Access gating based on subscription state

This is separate from customer payments for appointments.

## 5. Customer Booking Flow

The standard booking flow is:

1. Customer opens a business URL.
2. Public business information and available services are loaded.
3. Customer chooses a service.
4. Customer chooses a date.
5. The availability API calculates open slots.
6. Existing bookings and business rules are checked.
7. Customer selects a time.
8. Customer enters contact details.
9. The booking endpoint creates the appointment.
10. If payment is required, Paystack payment is verified before confirmation.
11. The booking is stored with a confirmed, cancelled, completed, or no-show status.
12. A confirmation email is sent.
13. The business owner sees the booking in the dashboard.

## 6. AI Conversation Flow

The AI booking flow is designed for customers who prefer messaging to forms.

A typical conversation is:

1. Customer says they want an appointment.
2. Assistant asks what service or appointment they need.
3. Assistant checks the business's services and availability.
4. Assistant offers relevant available times.
5. Customer chooses one.
6. Assistant asks for customer name and contact details if needed.
7. Assistant calls the booking tool.
8. The booking tool rechecks availability before inserting.
9. The customer receives confirmation.
10. The booking becomes visible in the business dashboard.

Conversation history is stored per business and customer contact for supported messaging channels so the assistant can understand follow-up messages such as “book that one” or “what about tomorrow?”

## 7. Messaging Integrations

### Website chat

The embedded website chat widget allows customers to ask questions and book from the business's public site.

### Telegram

Each business can connect its own Telegram bot.

The setup flow includes:

- BotFather token entry
- Bot webhook registration
- Business-specific routing
- Bot username display
- Disconnect capability
- Conversation history

### WhatsApp

WhatsApp uses Meta's WhatsApp Cloud API and Embedded Signup.

The integration supports:

- Meta Embedded Signup
- Business-specific WhatsApp number connection
- WABA identification
- Phone number identification
- Access token storage
- Inbound webhook routing
- Outbound AI replies
- Disconnect capability

### Facebook Messenger

Messenger connects through a Facebook Page access token.

The integration supports:

- Page access token connection
- Page identification
- Page name display
- Inbound webhook routing
- Outbound replies
- Disconnect capability

## 8. Payment Systems

### Customer appointment payments

Businesses can connect their own Paystack account for customer-facing payments.

Possible payment behavior includes:

- No payment required
- Full payment required
- Percentage deposit required
- Payment verification before booking confirmation
- Payment reference storage
- Payment status storage
- Amount paid storage

Customer payments are separate from the platform subscription.

### Platform subscription billing

Businesses pay LD Solutions through Flutterwave.

Subscription records support:

- Trialing
- Active
- Past due
- Cancelled
- Expired
- Current period end
- Flutterwave transaction reference
- Flutterwave subscription reference
- Payment history

## 9. Notifications and Automation

The platform supports or is designed to support:

- Booking confirmation email
- Appointment reminder email
- Webhook delivery to Zapier, Make, or custom CRM systems
- Staff invitation notifications
- Customer messaging through connected channels
- Payment result handling
- Subscription billing webhooks

Reminder delivery is tracked per booking using a reminder timestamp so a booking is not reminded multiple times.

## 10. API and Backend Capabilities

### Signup API

Creates the business and initial owner account.

### Availability API

Returns open appointment slots for a service and date.

### Bookings API

Creates customer bookings, validates booking data, handles payment requirements, and sends confirmation email.

### Booking reschedule API

Handles rescheduling of an existing booking where permitted.

### Booking cancellation behavior

Supports booking status changes and cancellation-window rules where implemented.

### Web chat API

Receives website chat messages and returns AI responses.

### Telegram webhook

Receives inbound Telegram messages, identifies the business by bot token, processes the AI conversation, and sends replies.

### WhatsApp webhook

Receives inbound WhatsApp Cloud API events and routes them to the correct business by Meta phone number ID.

### Messenger webhook

Receives inbound Facebook Messenger events and routes them to the correct business by page ID.

### Upload API

Handles business image uploads for logos, cover images, and gallery content.

### Billing APIs

Support subscription checkout, cancellation, and Flutterwave webhook processing.

### Staff APIs

Support invite information, invite acceptance, and staff notification flows.

### Admin messaging API

Allows staff to send messages to customers from supported conversations.

### Cron reminder API

Sends scheduled appointment reminders and prevents duplicate reminder sends.

## 11. Data Model

The main data entities are:

- `businesses`: tenant identity, branding, public information, channels, payment keys, and business configuration
- `staff`: users connected to a business and their roles
- `services`: bookable appointment types, durations, prices, categories, and active state
- `availability`: weekly working windows by business or staff member
- `booking_rules`: buffers, advance booking, cancellation, deposits, and payment requirements
- `bookings`: customer appointment records and statuses
- `whatsapp_conversations`: rolling conversation history for supported messaging contacts
- `products`: optional product catalog entries
- `subscriptions`: platform subscription status
- `payment_history`: platform billing history

## 12. Security and Tenant Isolation

The application is multi-tenant. Every business record is isolated by `business_id`.

Security mechanisms include:

- Supabase authentication
- Staff membership checks
- Business-scoped authorization
- Row Level Security policies
- Service-role access for controlled server-side operations
- Public read access only for intentionally public business information
- Private access for bookings, staff, billing, and booking rules
- Webhook verification and routing
- Payment verification against Paystack rather than trusting browser input
- Database-level booking overlap prevention

## 13. SEO and Discoverability

The platform includes:

- Root site metadata
- Page titles and descriptions
- Canonical URLs
- Open Graph metadata
- Twitter metadata
- Homepage SoftwareApplication structured data
- Public business-page LocalBusiness structured data
- Service offers in structured data where available
- Sitemap generation
- Business URLs in the sitemap
- Optional About, Gallery, and Contact URLs in the sitemap
- Robots rules excluding admin, login, account, API, and password pages

## 14. Brand and Customization

The product supports business-specific public branding while keeping the admin platform consistent.

Customizable customer-facing elements include:

- Business name
- Logo
- Cover photo
- Accent color
- Description
- About content
- Gallery
- Contact details
- Social links
- Public URL slug

The admin side uses a shared neutral interface with business identity and accent highlights.

## 15. Important Product Boundaries

The platform subscription is not the same as customer appointment payment.

- Flutterwave handles businesses paying LD Solutions.
- Paystack handles customers paying a business for an appointment.

The product currently supports one main business-wide availability window per day in the primary hours interface. The underlying availability table has staff support, but split shifts and advanced recurring exceptions are not the central current workflow.

Products exist as a catalog foundation, but the strongest and most complete product loop is appointment booking rather than full e-commerce.

WhatsApp and Messenger require external platform setup, tokens, permissions, and webhook configuration. They are not simply turned on by the application alone.

## 16. Current Core Value Proposition

The clearest product description is:

> LD Solutions gives appointment-based businesses a branded booking website and an AI receptionist that answers customer questions, checks real availability, confirms appointments, and keeps the entire schedule organized in one dashboard.

Short version:

> A conversational booking system for businesses that run on appointments.

Operational version:

> Customer message → AI understands the request → real availability check → confirmed booking → email reminder → owner dashboard.

## 17. Product Positioning

LD Solutions should be positioned as:

- A digital front desk
- A conversational booking system
- An appointment operating system
- A booking assistant with real scheduling logic
- A branded booking experience for independent businesses

It should not be positioned only as:

- A generic calendar
- A static booking form
- A marketplace
- A broad inventory platform
- A generic AI chatbot

The strongest differentiation is that the assistant is connected to the actual appointment system rather than merely answering questions.

## 18. Potential Future Expansion

Logical future capabilities include:

- WhatsApp and Messenger maturity
- Automated SMS reminders
- Customer self-service cancellation and rescheduling
- Deposits and payments in every booking channel
- Split shifts and multiple availability windows
- Holiday and exception dates
- Staff-specific calendars and assignment rules
- Customer notes and preferences
- Conversation review and human takeover
- Better insights and analytics
- Product checkout and inventory decrement
- Custom domains
- Deeper CRM workflows
- Review requests
- Multi-location businesses
- AI-powered schedule optimization

## 19. One-Sentence Export Summary

LD Solutions is a multi-tenant SaaS platform for appointment-based businesses that combines a branded booking website, real-time scheduling, AI-powered customer conversations, multi-channel messaging, customer and staff management, payments, reminders, and a centralized business dashboard.

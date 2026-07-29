-- ============================================
-- Multi-tenant booking platform schema
-- Every business is isolated by business_id via Row Level Security
-- ============================================

-- Businesses (the tenants)
create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- used in URL: yourplatform.com/slug
  name text not null,
  business_type text,                     -- e.g. 'salon', 'clinic', 'tutor' (label only, not logic-branching)
  logo_url text,
  accent_color text default '#0B1E33',
  timezone text default 'Africa/Lagos',
  owner_auth_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- Staff (business team members, tied to Supabase auth)
create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  auth_id uuid references auth.users(id),
  name text not null,
  email text not null,
  role text default 'staff',              -- 'owner' | 'staff'
  created_at timestamptz default now()
);

-- Services (what can be booked)
create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  duration_minutes int not null default 30,
  price numeric(10,2),
  active boolean default true,
  created_at timestamptz default now()
);

-- Optional grouping label ("Hair", "Nails", ...) — free text the owner
-- sets themselves, not a fixed enum, since categories vary wildly by
-- business type. Filter tabs on the services page only appear once real
-- categories exist, never a fixed placeholder set.
alter table services add column if not exists category text;

-- Availability (working hours, per staff or business-wide if staff_id is null)
create table availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  staff_id uuid references staff(id) on delete cascade,
  day_of_week int not null,               -- 0 = Sunday ... 6 = Saturday
  start_time time not null,
  end_time time not null
);

-- Booking rules (config knobs, no code changes needed per business)
create table booking_rules (
  business_id uuid primary key references businesses(id) on delete cascade,
  buffer_minutes int default 0,
  max_advance_days int default 30,
  cancellation_window_hours int default 24
);

-- Bookings (the actual appointments)
create table bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  service_id uuid references services(id) not null,
  staff_id uuid references staff(id),
  customer_name text not null,
  customer_phone text,
  customer_email text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'confirmed',        -- 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security: this is what makes multi-tenant isolation real,
-- not just "we filter in app code"
-- ============================================

alter table businesses enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table availability enable row level security;
alter table booking_rules enable row level security;
alter table bookings enable row level security;

-- Customer-facing booking pages read business data while signed out
-- (name, logo, services shown to anyone), so this has to allow anonymous
-- reads — it's not sensitive data, unlike the tables below.
create policy "anyone can view businesses"
  on businesses for select
  using (true);

-- Staff (any role, not just the owner) can update their own business's
-- profile — settings/branding fields, matching the same staff-membership
-- check used for services/availability/booking_rules below. Missing this
-- was a real bug: BusinessProfileManager's save always failed silently
-- with no policy permitting the update at all.
create policy "staff can update own business"
  on businesses for update
  using (
    id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "staff can view own business staff"
  on staff for select
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "staff can manage own services"
  on services for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "staff can manage own availability"
  on availability for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "staff can manage own booking_rules"
  on booking_rules for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "staff can view own bookings"
  on bookings for select
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

-- Public (anonymous) customers can READ services/availability for booking pages,
-- and INSERT a booking, but cannot read other businesses' bookings
create policy "anyone can view active services"
  on services for select
  using (active = true);

create policy "anyone can view availability"
  on availability for select
  using (true);

create policy "anyone can create a booking"
  on bookings for insert
  with check (true);

-- ============================================
-- WhatsApp AI agent
-- ============================================

-- The WhatsApp number Twilio routes inbound messages to for this business.
-- Superseded by Meta's Cloud API below (whatsapp_phone_number_id) — kept
-- for now rather than dropped, in case of rollback.
alter table businesses add column if not exists whatsapp_number text unique;

-- Meta's own WhatsApp Cloud API, replacing Twilio as the WhatsApp
-- middleman. Unlike whatsapp_number (a human-readable phone string), this
-- is the numeric phone_number_id Meta assigns when a number is registered
-- to a WhatsApp Business Account — required for both the outbound Graph
-- API send call and for routing inbound webhook payloads to the right
-- business (see lib/whatsappTools.ts getBusinessByMetaPhoneNumberId).
alter table businesses add column if not exists whatsapp_phone_number_id text unique;

-- The WhatsApp Business Account this phone number lives under — not used
-- for routing (phone_number_id already does that) but required to fetch
-- phone number details and subscribe the app to that WABA's webhooks
-- during Embedded Signup.
alter table businesses add column if not exists whatsapp_business_account_id text;

-- Human-readable number (e.g. +234...) for showing in the settings UI —
-- whatsapp_phone_number_id is an opaque numeric id, not something an
-- owner would recognize as "their number".
alter table businesses add column if not exists whatsapp_display_number text;

-- Each business connects its own WhatsApp Business Account via Embedded
-- Signup, so each needs its own access token scoped to their number — a
-- single shared env-var token (the pre-Embedded-Signup approach, used only
-- for the one hardcoded test business) doesn't work once multiple real
-- businesses are connected.
alter table businesses add column if not exists whatsapp_access_token text;

-- Wide banner shown across the top of the public booking page. Separate
-- from logo_url (a small square mark) — this is what gives the booking
-- page visual presence instead of reading as a bare form.
alter table businesses add column if not exists cover_image_url text;

-- One or two lines shown on the public booking page so a customer lands
-- on something that reads as a real place, not just a name and a list.
alter table businesses add column if not exists description text;

-- Longer-form "About" section body for the public booking page — separate
-- from `description` (a short tagline shown in the hero), this is the
-- fuller story shown in its own section, only rendered if set.
alter table businesses add column if not exists about_text text;

-- Photo gallery for the public booking page. Stored as one URL per line
-- rather than a separate table/upload flow — same "paste a URL" pattern
-- already used for logo_url/cover_image_url, just multiple lines.
alter table businesses add column if not exists gallery_urls text;

-- Real contact details for the public booking page's Contact section —
-- all optional, all independent (a business might have a phone but no
-- Instagram, etc.), each only rendered if actually set.
alter table businesses add column if not exists contact_phone text;
alter table businesses add column if not exists contact_email text;
alter table businesses add column if not exists instagram_url text;
alter table businesses add column if not exists facebook_url text;

-- Explicit per-section on/off switches, independent of whether content is
-- filled in — a business might have gallery photos ready but not want the
-- tab live yet. Default true so existing businesses' nav behavior doesn't
-- change (a section still only ever shows when it also has real content).
alter table businesses add column if not exists show_about boolean not null default true;
alter table businesses add column if not exists show_gallery boolean not null default true;
alter table businesses add column if not exists show_contact boolean not null default true;

-- Rolling chat history per (business, customer phone), so the agent has
-- context across turns ("book that one" referring to a slot offered two
-- messages ago). Only ever touched by the webhook route via the service
-- role key, so no public policies are defined here — RLS-enabled with zero
-- policies means everyone but the service role is denied by default.
create table if not exists whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  customer_phone text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique (business_id, customer_phone)
);

alter table whatsapp_conversations enable row level security;

-- Telegram bots are free and instant to create (no business verification,
-- unlike WhatsApp), so unlike whatsapp_number, every business can realistically
-- get its own bot token. The webhook URL itself is per-bot
-- (/api/telegram/webhook/[token]), so this column is how that path segment
-- resolves back to a business. whatsapp_conversations is reused as-is for
-- Telegram history too (customer_phone holds 'telegram:<chatId>' there).
alter table businesses add column if not exists telegram_bot_token text unique;

-- Facebook Messenger, connected via a Page rather than a phone number —
-- no OTP, no business-verification wait, and connecting it never logs the
-- owner out of anything (unlike WhatsApp's Cloud API). Like whatsapp_phone_
-- number_id, page id is how a shared webhook routes an inbound message
-- back to the right business; the access token is Page-scoped, not shared.
alter table businesses add column if not exists messenger_page_id text unique;
alter table businesses add column if not exists messenger_access_token text;
alter table businesses add column if not exists messenger_page_name text;
-- Cosmetic only (shown in Settings as "Connected as @x") — never used for
-- auth/routing, telegram_bot_token is the only thing that matters for that.
alter table businesses add column if not exists telegram_bot_username text;

-- ============================================
-- Appointment reminders
-- ============================================

-- Null until a reminder email has actually been sent for this booking.
-- The cron job (app/api/cron/send-reminders) uses this to send each
-- reminder exactly once, regardless of how often the job runs — a booking
-- becomes eligible once it's within the reminder window and stays eligible
-- until this gets set, so an infrequent cron schedule (e.g. hourly, or
-- daily on cheaper Vercel plans) still catches every booking correctly.
alter table bookings add column if not exists reminder_sent_at timestamptz;

-- Telegram-only, only set when the customer has a public username. It's
-- the one thing that makes a Telegram-originated booking's contact actually
-- useful to the business owner — customer_phone stores 'telegram:<chatId>'
-- for these, which has no clickable/callable meaning on its own.
alter table bookings add column if not exists customer_telegram_username text;

-- ============================================
-- Products (AI-assisted product discovery, web only for now — no
-- checkout/payment/inventory-decrement yet, that's a deliberately deferred
-- later phase). Mirrors the services table shape/RLS exactly.
-- ============================================

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2),
  stock_quantity int,
  image_url text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table products enable row level security;

create policy "staff can manage own products"
  on products for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

create policy "anyone can view active products"
  on products for select
  using (active = true);

-- ============================================
-- Subscriptions — the platform's OWN monthly billing (businesses paying
-- YOU to use this), via Flutterwave. Not customer-facing payments.
-- One row per business; status changes only ever come from the checkout
-- route or the Flutterwave webhook (both service-role), never directly
-- from the client, so staff can read their own status but not edit it —
-- editing it themselves would mean anyone could just mark their own
-- account "active" for free.
-- ============================================

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null unique,
  status text not null default 'trialing', -- 'trialing' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  flw_tx_ref text,
  flw_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "staff can view own subscription"
  on subscriptions for select
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

-- One row per webhook event, so the billing page can show real payment
-- history — the subscriptions table only ever holds current status, it
-- has no memory of past charges once overwritten.
create table if not exists payment_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  amount numeric(10,2),
  status text not null, -- 'successful' | 'failed'
  flw_tx_ref text,
  created_at timestamptz default now()
);

alter table payment_history enable row level security;

create policy "staff can view own payment history"
  on payment_history for select
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

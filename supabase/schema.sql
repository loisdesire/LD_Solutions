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
  accent_color text default '#C4512D', -- platform terracotta; the signup route also sets this explicitly, this is just the column-level fallback
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

-- Optional grouping label ("Hair", "Nails", ...) - free text the owner
-- sets themselves, not a fixed enum, since categories vary wildly by
-- business type. Filter tabs on the services page only appear once real
-- categories exist, never a fixed placeholder set.
alter table services add column if not exists category text;

-- A written description and a photo per service - added for the "manage
-- your business by chat" assistant tools (lib/manageTools.ts): telling it
-- "create a service, here's a description, here's a photo" needed
-- somewhere on the row to actually put that description and photo. The
-- manual Services form in the dashboard doesn't expose these yet; that's
-- a real, deliberate gap - the AI path and the manual path should
-- eventually offer the same fields, but the chat tools were the ask that
-- needed these columns to exist at all, so they're not blocked on the
-- form catching up.
alter table services add column if not exists description text;
alter table services add column if not exists image_url text;

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

-- A service UUID is globally unique, but a pair-level foreign key is still
-- needed to guarantee that bookings.business_id and the selected service's
-- business_id describe the same tenant. Application queries enforce this
-- too; this constraint is the final backstop if a future route forgets.
-- Wrapped so re-running this file is always safe regardless of whether
-- these two already exist on a given database - a plain `alter table add
-- constraint` errors outright on a name that's already taken, and
-- Postgres has no `add constraint if not exists`.
do $$ begin
  alter table services add constraint services_id_business_id_key unique (id, business_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table bookings add constraint bookings_service_business_fk
    foreign key (service_id, business_id)
    references services (id, business_id);
exception when duplicate_object then null;
end $$;

-- The actual backstop against double-booking - not just app-level
-- availability checks (those are the fast path / good UX), this is what
-- closes the race condition where two customers hit "book" on the same
-- slot within the same second. Whichever insert lands first wins; the
-- second gets Postgres error 23P01, which app/api/bookings/route.ts and
-- the AI agent's create_booking tool both already catch and turn into
-- "that time is no longer available."
-- Needed for the "=" comparison on a non-range column (staff_id) inside
-- a GIST exclusion constraint.
create extension if not exists btree_gist;

-- Was scoped to (business_id, time_range) only, not staff_id - since
-- bookings.staff_id was never actually set by any live booking-creation
-- path, that was the only option at the time, but it meant a business
-- with three staff could only ever have ONE appointment at a time across
-- its whole team: any second booking anywhere in the business at an
-- overlapping time got rejected as a conflict, staff-blind. Now that
-- lib/assignStaff.ts assigns a real staff_id to every new booking, this
-- is scoped per staff member instead - different staff can be booked
-- concurrently, the same staff member still can't be double-booked.
-- Restricted to staff_id is not null so it only ever applies to rows that
-- actually have one (every new booking, going forward) - see the backfill
-- below for what happens to existing rows that don't yet.
do $$ begin
  alter table bookings drop constraint if exists no_overlapping_bookings;
exception when undefined_object then null;
end $$;

-- Existing upcoming bookings all predate staff_id being set at all, so
-- they're not covered by the new staff-scoped constraint below until
-- they have one. Backfilling every business's staff to whichever of its
-- staff rows is oldest (arbitrary but deterministic - there's no way to
-- know in hindsight who actually served a given historical booking, and
-- it doesn't matter for conflict-prevention purposes: the OLD business-
-- wide constraint already guarantees none of these ever overlapped each
-- other in the first place, regardless of which staff member ends up
-- attached). Only touches bookings that are still upcoming and not
-- cancelled - a past booking has no future conflict to protect against,
-- so it's left alone rather than rewriting history for no operational
-- benefit.
update bookings b
set staff_id = (
  select s.id from staff s where s.business_id = b.business_id order by s.created_at asc limit 1
)
where b.staff_id is null
  and b.status <> 'cancelled'
  and b.end_time > now();

-- A GIST exclusion constraint is backed by its own index under the hood,
-- so a name collision here raises 42P07 (duplicate_table), not 42710
-- (duplicate_object) like the two plain constraints above - catching only
-- duplicate_object let this one escape uncaught, which aborted the whole
-- transaction (and everything else in the same pasted script) the first
-- time this ran against a database where the constraint already existed.
do $$ begin
  alter table bookings add constraint no_overlapping_bookings_per_staff
    exclude using gist (
      staff_id with =,
      tstzrange(start_time, end_time) with &&
    ) where (status <> 'cancelled' and staff_id is not null);
exception when duplicate_object or duplicate_table then null;
end $$;

-- Atomic, deployment-wide fixed-window rate limiting. API routes call this
-- with the service role so every serverless instance shares one counter.
create table if not exists rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_buckets_window_start_idx
  on rate_limit_buckets (window_start);

alter table rate_limit_buckets enable row level security;

create or replace function check_rate_limit(p_key text, p_limit integer, p_window_ms bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  updated_count integer;
begin
  if p_limit < 1 or p_window_ms < 1000 or length(p_key) > 300 then
    return false;
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) * 1000 / p_window_ms) * p_window_ms / 1000.0
  );

  insert into rate_limit_buckets (bucket_key, window_start, request_count)
  values (p_key, current_window, 1)
  on conflict (bucket_key, window_start)
  do update set request_count = rate_limit_buckets.request_count + 1
  returning request_count into updated_count;

  delete from rate_limit_buckets where window_start < clock_timestamp() - interval '1 day';
  return updated_count <= p_limit;
end;
$$;

revoke all on function check_rate_limit(text, integer, bigint) from public, anon, authenticated;
grant execute on function check_rate_limit(text, integer, bigint) to service_role;

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
-- reads - it's not sensitive data, unlike the tables below.
create policy "anyone can view businesses"
  on businesses for select
  using (true);

-- Staff (any role, not just the owner) can update their own business's
-- profile - settings/branding fields, matching the same staff-membership
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
-- Superseded by Meta's Cloud API below (whatsapp_phone_number_id) - kept
-- for now rather than dropped, in case of rollback.
alter table businesses add column if not exists whatsapp_number text unique;

-- Meta's own WhatsApp Cloud API, replacing Twilio as the WhatsApp
-- middleman. Unlike whatsapp_number (a human-readable phone string), this
-- is the numeric phone_number_id Meta assigns when a number is registered
-- to a WhatsApp Business Account - required for both the outbound Graph
-- API send call and for routing inbound webhook payloads to the right
-- business (see lib/whatsappTools.ts getBusinessByMetaPhoneNumberId).
alter table businesses add column if not exists whatsapp_phone_number_id text unique;

-- The WhatsApp Business Account this phone number lives under - not used
-- for routing (phone_number_id already does that) but required to fetch
-- phone number details and subscribe the app to that WABA's webhooks
-- during Embedded Signup.
alter table businesses add column if not exists whatsapp_business_account_id text;

-- Human-readable number (e.g. +234...) for showing in the settings UI -
-- whatsapp_phone_number_id is an opaque numeric id, not something an
-- owner would recognize as "their number".
alter table businesses add column if not exists whatsapp_display_number text;

-- Each business connects its own WhatsApp Business Account via Embedded
-- Signup, so each needs its own access token scoped to their number - a
-- single shared env-var token (the pre-Embedded-Signup approach, used only
-- for the one hardcoded test business) doesn't work once multiple real
-- businesses are connected.
alter table businesses add column if not exists whatsapp_access_token text;

-- Wide banner shown across the top of the public booking page. Separate
-- from logo_url (a small square mark) - this is what gives the booking
-- page visual presence instead of reading as a bare form.
alter table businesses add column if not exists cover_image_url text;

-- One or two lines shown on the public booking page so a customer lands
-- on something that reads as a real place, not just a name and a list.
alter table businesses add column if not exists description text;

-- Longer-form "About" section body for the public booking page - separate
-- from `description` (a short tagline shown in the hero), this is the
-- fuller story shown in its own section, only rendered if set.
alter table businesses add column if not exists about_text text;

-- Photo gallery for the public booking page. Stored as one URL per line
-- rather than a separate table/upload flow - same "paste a URL" pattern
-- already used for logo_url/cover_image_url, just multiple lines.
alter table businesses add column if not exists gallery_urls text;

-- Real contact details for the public booking page's Contact section -
-- all optional, all independent (a business might have a phone but no
-- Instagram, etc.), each only rendered if actually set.
alter table businesses add column if not exists contact_phone text;
alter table businesses add column if not exists contact_email text;
alter table businesses add column if not exists instagram_url text;
alter table businesses add column if not exists facebook_url text;

-- Explicit per-section on/off switches, independent of whether content is
-- filled in - a business might have gallery photos ready but not want the
-- tab live yet. Default true so existing businesses' nav behavior doesn't
-- change (a section still only ever shows when it also has real content).
alter table businesses add column if not exists show_about boolean not null default true;
alter table businesses add column if not exists show_gallery boolean not null default true;
alter table businesses add column if not exists show_contact boolean not null default true;

-- Rolling chat history per (business, customer phone), so the agent has
-- context across turns ("book that one" referring to a slot offered two
-- messages ago). Only ever touched by the webhook route via the service
-- role key, so no public policies are defined here - RLS-enabled with zero
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

-- Facebook Messenger, connected via a Page rather than a phone number -
-- no OTP, no business-verification wait, and connecting it never logs the
-- owner out of anything (unlike WhatsApp's Cloud API). Like whatsapp_phone_
-- number_id, page id is how a shared webhook routes an inbound message
-- back to the right business; the access token is Page-scoped, not shared.
alter table businesses add column if not exists messenger_page_id text unique;
alter table businesses add column if not exists messenger_access_token text;
alter table businesses add column if not exists messenger_page_name text;
-- Cosmetic only (shown in Settings as "Connected as @x") - never used for
-- auth/routing, telegram_bot_token is the only thing that matters for that.
alter table businesses add column if not exists telegram_bot_username text;

-- "Connected" alone never said whether a channel was actually being used -
-- set (best-effort, fire-and-forget) by the corresponding webhook route on
-- every real inbound customer message, and shown on the Channels page.
-- Absence isn't fatal to anything: markChannelActive() in
-- lib/whatsappTools.ts silently no-ops if this migration hasn't run yet,
-- same as every other optional-column read/write in this codebase.
alter table businesses add column if not exists telegram_last_active_at timestamptz;
alter table businesses add column if not exists whatsapp_last_active_at timestamptz;
alter table businesses add column if not exists messenger_last_active_at timestamptz;

-- ============================================
-- Appointment reminders
-- ============================================

-- Null until a reminder email has actually been sent for this booking.
-- The cron job (app/api/cron/send-reminders) uses this to send each
-- reminder exactly once, regardless of how often the job runs - a booking
-- becomes eligible once it's within the reminder window and stays eligible
-- until this gets set, so an infrequent cron schedule (e.g. hourly, or
-- daily on cheaper Vercel plans) still catches every booking correctly.
alter table bookings add column if not exists reminder_sent_at timestamptz;

-- Telegram-only, only set when the customer has a public username. It's
-- the one thing that makes a Telegram-originated booking's contact actually
-- useful to the business owner - customer_phone stores 'telegram:<chatId>'
-- for these, which has no clickable/callable meaning on its own.
alter table bookings add column if not exists customer_telegram_username text;

-- ============================================
-- Payments (Paystack) - each business connects its own Paystack account
-- (same self-serve pattern as Telegram/WhatsApp: they paste their own
-- keys in Settings), so a customer's payment settles straight to that
-- business's own account. The platform never touches or splits the money.
-- ============================================

-- Toggle + how much of the service price is due upfront. null/100 means
-- the full price; 1-99 is treated as a percentage deposit, with the rest
-- collected by the business separately (in person, bank transfer, etc).
alter table booking_rules add column if not exists require_payment boolean not null default false;
alter table booking_rules add column if not exists deposit_percentage integer;

alter table businesses add column if not exists paystack_public_key text;
alter table businesses add column if not exists paystack_secret_key text;

-- Set only after the booking route has independently verified the
-- payment_reference against Paystack's own API (never trusted from the
-- client) - payment_status is null for every booking where payment
-- wasn't required, not just the unpaid ones.
alter table bookings add column if not exists payment_status text;
alter table bookings add column if not exists payment_reference text;
alter table bookings add column if not exists amount_paid numeric;

-- ============================================
-- Products (AI-assisted product discovery, web only for now - no
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
-- Subscriptions - the platform's OWN monthly billing (businesses paying
-- YOU to use this), via Flutterwave. Not customer-facing payments.
-- One row per business; status changes only ever come from the checkout
-- route or the Flutterwave webhook (both service-role), never directly
-- from the client, so staff can read their own status but not edit it -
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
-- history - the subscriptions table only ever holds current status, it
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

-- ============================================
-- Tiered plans + custom domains
-- ============================================

-- 'core' | 'business_intelligence' - see lib/subscription.ts. Set
-- optimistically by the checkout route when a business starts a checkout
-- for a given plan; never itself grants access, that's still entirely
-- `status`/`current_period_end` as before, this only decides which
-- features unlock once access is already granted.
alter table subscriptions add column if not exists plan text not null default 'core';

-- Tracks whether the trial-ending / payment-failed warning email (see
-- app/api/cron/billing-warnings) has already gone out - without these,
-- a daily cron re-checking "trial ends within 3 days" would re-send the
-- same warning on each of those 3 days. past_due_warning_sent_at is reset
-- to null whenever a payment succeeds again (see both payment webhooks'
-- own status: 'active' update), so a FUTURE payment failure gets warned
-- about too, not just the first one this subscription ever has.
alter table subscriptions add column if not exists trial_warning_sent_at timestamptz;
alter table subscriptions add column if not exists past_due_warning_sent_at timestamptz;

-- A business's own domain, pointed at this deployment via CNAME. Unique so
-- middleware.ts's hostname lookup is always unambiguous. Actually serving
-- traffic on it also requires the domain be added to the Vercel project by
-- hand (no Vercel API token in this project) - see the Settings page's
-- Custom domain section for the customer-facing instructions.
alter table businesses add column if not exists custom_domain text unique;

-- ============================================
-- Reschedule assistant - an owner tells the bot to block out a window
-- (e.g. "I'm out Tuesday 2-5pm"), it proposes new times for every booking
-- that falls inside it, and only actually moves anything + messages
-- customers once the owner explicitly confirms. `moves` is a snapshot
-- (customer contact info included) taken at propose time - not
-- re-derived from bookings at apply time - so what the owner approved is
-- exactly what executes, even if something else about the booking
-- changed in between.
-- ============================================
create table if not exists reschedule_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  reason text,
  moves jsonb not null,
  status text not null default 'pending', -- 'pending' | 'applied' | 'expired'
  created_at timestamptz default now()
);

alter table reschedule_plans enable row level security;

-- ============================================
-- Owner-only enforcement
-- ============================================
-- "role text default 'staff' -- 'owner' | 'staff'" has existed on the
-- `staff` table since the start, but nothing ever actually checked it.
-- Every policy below used to read "any staff at this business", with no
-- role distinction at all - "staff can update own business" let a
-- non-owner staff member rewrite the Paystack secret key, the
-- Telegram/WhatsApp/Messenger tokens, and the custom domain from their
-- own authenticated session, entirely bypassing the app's own UI (RLS is
-- the real boundary here; the Next.js page/route gating around it is
-- defense-in-depth, not the actual enforcement, and this migration is
-- what the rest of that gating now actually relies on).
--
-- The `staff` table also had no UPDATE or DELETE policy at all, for any
-- role - meaning renaming or removing a team member has been silently
-- broken by RLS default-deny for the owner too, this whole time. This
-- fixes both problems in the same pass: it's now enforced AND it works.

-- Every create below is now preceded by a matching drop-if-exists for
-- ITS OWN name too, not just the old policy it replaces - this migration
-- got run partway (at least "owner can update own business" landed)
-- before something after it failed, and the original version had no way
-- to safely re-run past a statement that had already succeeded. This
-- version can be pasted and run as many times as needed.
drop policy if exists "staff can update own business" on businesses;
drop policy if exists "owner can update own business" on businesses;
create policy "owner can update own business"
  on businesses for update
  using (
    id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "staff can manage own booking_rules" on booking_rules;
drop policy if exists "owner can manage own booking_rules" on booking_rules;
create policy "owner can manage own booking_rules"
  on booking_rules for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "owner can update own staff" on staff;
create policy "owner can update own staff"
  on staff for update
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "owner can remove own staff" on staff;
create policy "owner can remove own staff"
  on staff for delete
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

-- staff_invites isn't declared anywhere else in this file - it was
-- added directly against the live database at some point, outside this
-- reference, so its exact current policy names aren't known here.
-- `create table if not exists` makes this safe to run whether or not it
-- already exists; the DO block drops every existing policy on it by
-- its ACTUAL name (whatever that is) before the owner-only ones below
-- are created, so no old unrestricted policy can silently survive under
-- a name this migration doesn't know to target directly - the risk
-- otherwise being that an old permissive "any staff" policy stays active
-- alongside a new restrictive one, and Postgres OR's permissive RLS
-- policies together, so the old one would still win.
create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  email text not null,
  token uuid not null default gen_random_uuid(),
  accepted boolean not null default false,
  created_at timestamptz default now()
);
alter table staff_invites enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'staff_invites'
  loop
    execute format('drop policy if exists %I on staff_invites', pol.policyname);
  end loop;
end $$;

create policy "owner can view own business invites"
  on staff_invites for select
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

create policy "owner can create invites"
  on staff_invites for insert
  with check (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

create policy "owner can delete invites"
  on staff_invites for delete
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid() and role = 'owner'
    )
  );

-- No unique constraint on (business_id, email) meant nothing stopped a
-- second invite to the same address while the first was still pending -
-- StaffManager.tsx checks this client-side against what's already
-- loaded first (so the common case shows a clear message instantly,
-- no round trip), but that alone doesn't cover two invites landing at
-- the same moment from two tabs/sessions. Partial (accepted = false
-- only) so re-inviting someone whose earlier invite already got
-- accepted, or was deleted, is still allowed - this only blocks a
-- second PENDING invite for the same address.
create unique index if not exists staff_invites_pending_email_unique
  on staff_invites (business_id, lower(email))
  where not accepted;

-- ============================================
-- Currency (prep for international payments)
-- ============================================
-- Every business has been assumed to be Naira-priced everywhere in the
-- app - 18 files hand-format `₦${amount.toLocaleString()}` directly
-- rather than reading a currency from anywhere. Defaults to NGN so every
-- existing business's behavior is completely unchanged; this column
-- just gives a business a real place to say otherwise once a second
-- payment rail (Stripe, for businesses Paystack can't onboard) actually
-- exists. lib/formatMoney.ts reads this - see that file for the plan on
-- retrofitting the 18 hardcoded call sites incrementally.
alter table businesses add column if not exists currency text not null default 'NGN';

-- ============================================
-- Demo viewer: block writes at the database itself
-- ============================================
-- "See the dashboard" on the marketing homepage drops a visitor into a
-- real, logged-in admin session (see lib/demo.ts) - the actual app, not a
-- mockup, so it stays honest about what the product looks like. Most
-- writes that session could attempt are already caught server-side
-- (lib/requireStaffApiSession.ts auto-rejects any non-GET request from
-- this account), but several admin screens (Business profile, Hours,
-- Services, Products, Staff, Booking rules, Custom domain) write straight
-- from the browser to Supabase with no API route in between - the only
-- place left to stop those is here.
--
-- One trigger function, reused across every table one of those screens
-- writes to, rather than a policy rewrite per table - additive, doesn't
-- touch any existing RLS policy's logic. The exception message is a real
-- sentence on purpose: it surfaces as-is through error-handling code every
-- one of those forms already has (see lib/friendlyError.ts), so nothing
-- in the UI needed to change for this to show up correctly.
create or replace function reject_demo_viewer_writes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = '8b3df1a8-a927-47b1-bc33-f948ca9afd9c' then
    raise exception 'This is a live demo account - changes are not saved. Explore freely, nothing here is permanent.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reject_demo_writes on businesses;
create trigger reject_demo_writes before insert or update or delete on businesses
  for each row execute function reject_demo_viewer_writes();

drop trigger if exists reject_demo_writes on booking_rules;
create trigger reject_demo_writes before insert or update or delete on booking_rules
  for each row execute function reject_demo_viewer_writes();

drop trigger if exists reject_demo_writes on availability;
create trigger reject_demo_writes before insert or update or delete on availability
  for each row execute function reject_demo_viewer_writes();

drop trigger if exists reject_demo_writes on products;
create trigger reject_demo_writes before insert or update or delete on products
  for each row execute function reject_demo_viewer_writes();

drop trigger if exists reject_demo_writes on services;
create trigger reject_demo_writes before insert or update or delete on services
  for each row execute function reject_demo_viewer_writes();

-- staff needs care: this demo account's OWN row lives in this table (it's
-- how it gets owner-level admin access at all) - blocking every write
-- would also block the normal login flow reading it. Triggers only fire
-- on insert/update/delete, never on select, so reading it to log in is
-- unaffected; this only stops the demo account from *changing* the staff
-- list (inviting/removing/renaming someone).
drop trigger if exists reject_demo_writes on staff;
create trigger reject_demo_writes before insert or update or delete on staff
  for each row execute function reject_demo_viewer_writes();

drop trigger if exists reject_demo_writes on staff_invites;
create trigger reject_demo_writes before insert or update or delete on staff_invites
  for each row execute function reject_demo_viewer_writes();

-- ============================================
-- PWA push notifications: one row per device/browser a staff member has
-- enabled notifications on (components/NotificationBell.tsx). Deliberately
-- keyed to staff_id, not just business_id - "who can turn this device's
-- subscription off" needs to be that one staff member, not anyone at the
-- business. lib/pushNotify.ts reads these to notify staff the moment a
-- booking is CONFIRMED (web checkout, chat-channel booking, or a chat
-- booking's payment webhook - see the three call sites, never on a
-- pending_payment hold).
-- ============================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  staff_id uuid references staff(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists push_subscriptions_business_id_idx on push_subscriptions(business_id);

alter table push_subscriptions enable row level security;

create policy "staff can manage own push subscriptions"
  on push_subscriptions for all
  using (
    staff_id in (select id from staff where auth_id = auth.uid())
  );

drop trigger if exists reject_demo_writes on push_subscriptions;
create trigger reject_demo_writes before insert or update or delete on push_subscriptions
  for each row execute function reject_demo_viewer_writes();

-- ============================================
-- Assistant/onboarding chat history - one row per message, so leaving the
-- page (e.g. clicking to Services mid-conversation) and coming back
-- restores it instead of dropping the thread. `kind` keeps the regular
-- assistant and the first-time onboarding chat as separate threads even
-- though both reuse the same AssistantChat.tsx component. Scoped to
-- staff_id, not just business_id - two staff members each get their own
-- conversation, not one shared thread. lib/assistantHistory.ts is the only
-- thing that reads/writes this.
-- ============================================
create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  staff_id uuid references staff(id) on delete cascade not null,
  kind text not null default 'assistant',
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_lookup_idx
  on assistant_messages (business_id, staff_id, kind, created_at);

alter table assistant_messages enable row level security;

create policy "staff can manage own assistant messages"
  on assistant_messages for all
  using (
    staff_id in (select id from staff where auth_id = auth.uid())
  );

drop trigger if exists reject_demo_writes on assistant_messages;
create trigger reject_demo_writes before insert or update or delete on assistant_messages
  for each row execute function reject_demo_viewer_writes();

-- ============================================
-- Business context for the customer-facing AI - free text the owner
-- writes in Settings (backstory, specialties, house rules, anything that
-- helps the AI answer real customer questions better than the short
-- public "description" alone). Private: fed only to the AI's own system
-- prompt (see lib/whatsappAgent.ts, shared by WhatsApp/Telegram AND the
-- website chat widget), never rendered anywhere on the public booking
-- page the way `description` is.
-- ============================================
alter table businesses add column if not exists ai_context text;

-- ============================================
-- Owner reminders - "remind me to call the supplier tomorrow at 2pm",
-- asked of the assistant in plain language (lib/manageAgent.ts's
-- propose/apply_create_reminder). A cron job (app/api/cron/send-owner-
-- reminders, every 15 minutes - see vercel.json) delivers each one as a
-- push notification once remind_at has passed, then marks it sent so it
-- never fires twice. staff_id is who ASKED for it, not necessarily who
-- gets notified - delivery goes to the whole business (same "every
-- device any staff member has notifications on" reach
-- notifyStaffOfNewBooking already uses), since a reminder set by one
-- person is often meant for whoever's actually around to act on it.
-- ============================================
create table if not exists owner_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  staff_id uuid references staff(id) on delete set null,
  message text not null,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists owner_reminders_due_idx on owner_reminders (remind_at) where sent_at is null;

alter table owner_reminders enable row level security;

create policy "staff can manage own business reminders"
  on owner_reminders for all
  using (
    business_id in (
      select business_id from staff where auth_id = auth.uid()
    )
  );

drop trigger if exists reject_demo_writes on owner_reminders;
create trigger reject_demo_writes before insert or update or delete on owner_reminders
  for each row execute function reject_demo_viewer_writes();

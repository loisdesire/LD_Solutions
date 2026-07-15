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

-- Business owners/staff can only see their own business's data
create policy "staff can view own business"
  on businesses for select
  using (owner_auth_id = auth.uid());

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
-- In production each business gets its own Twilio WhatsApp number; during
-- sandbox testing, one test business is pointed at Twilio's shared sandbox
-- number so a real end-to-end flow can be tested before going live.
alter table businesses add column if not exists whatsapp_number text unique;

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

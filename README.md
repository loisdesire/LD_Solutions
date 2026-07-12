# Booking Platform — Phase 1 (Complete Core Flow)

Multi-tenant appointment booking system. One codebase, every business identified
by a URL slug (`yourplatform.com/business-slug`), isolated by Supabase Row Level
Security, not by separate deployments.

## What's included

- `supabase/schema.sql` — full database schema + RLS policies
- `lib/supabase.ts` — Supabase client setup
- `lib/getBusinessBySlug.ts` — core lookup: one file serves every business
- `lib/getAvailableSlots.ts` — real availability logic (reads working hours +
  existing bookings, returns actually-open time slots, no double-booking)
- `app/signup/page.tsx` + `app/api/signup/route.ts` — business signup flow:
  creates the owner's auth account, the business row, and the staff row together
- `app/[slug]/page.tsx` + `components/BookingForm.tsx` — public booking page
  with real slot picking (date → service → available times, not free text)
- `app/api/availability/route.ts` — returns open slots for a service/date
- `app/api/bookings/route.ts` — creates a booking, fires a confirmation email
- `app/[slug]/admin/page.tsx` — admin dashboard listing all bookings for a business

## Setup steps

1. Create a Supabase project
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. Copy `.env.example` to `.env.local`, fill in:
   - Supabase URL + anon key (from Project Settings → API)
   - Supabase service role key (same page — needed for the signup route only,
     never expose this key to the browser)
   - Resend API key (resend.com — free tier is enough to start) for confirmation emails
4. `npm install`
5. `npm run dev`
6. Visit `localhost:3000/signup`, create a test business
7. In Supabase, manually add a service and some availability hours for that
   business (a "add service/hours" admin UI is the next thing to build):
   ```sql
   insert into services (business_id, name, duration_minutes, price)
   values ((select id from businesses where slug = 'your-slug'), 'Haircut', 45, 5000);

   insert into availability (business_id, day_of_week, start_time, end_time)
   values ((select id from businesses where slug = 'your-slug'), 1, '09:00', '17:00');
   -- day_of_week: 0 = Sunday ... 6 = Saturday. Repeat for each open day.
   ```
8. Visit `localhost:3000/your-slug` — pick a service, pick a date, see real
   open time slots, book, and get a confirmation email

## What's still deliberately NOT built (next real steps, in order)

1. **Auth check on the admin dashboard** — right now `/slug/admin` doesn't
   verify the visitor is actually staff for that business. Needs: read the
   logged-in session, check it against the `staff` table, redirect if not.
2. **Services/hours management UI** — currently set via SQL directly. Needs:
   simple admin forms to add/edit services and working hours.
3. **Staff invite flow** — invite additional staff members by email/token.
4. **SMS/WhatsApp confirmation** — email is wired up (Resend); SMS would be
   the same pattern via Twilio, added in `app/api/bookings/route.ts`.
5. **Cancellation/rescheduling** — customer-facing self-serve links.
6. **Webhooks** — so businesses can connect bookings to their own tools
   (Zapier, Make, their CRM) without custom integration work per client.

## Deploying

Works on Hostinger (Business plan, Node.js app) and on Vercel. Path-based
routing throughout, no wildcard DNS/SSL needed.

# Vanova

Vanova is a multi-tenant AI booking receptionist for appointment businesses. Customers can book through a business's public page or conversationally through web chat and connected messaging channels. Owners manage every booking from one authenticated dashboard.

Each tenant is identified by a URL slug (`/[slug]`) and can also connect a custom domain. Tenant data is isolated by `business_id`, Supabase Row Level Security, server-side staff authorization, and database constraints.

## Current product

- Branded public business pages with services, about, gallery, and contact content
- Traditional service/date/time booking flow with real-time availability
- AI receptionist shared across website chat, Telegram, WhatsApp, and Messenger integrations
- Timezone-aware hours, buffer rules, advance limits, and database-backed overlap protection, per staff member (automatic assignment to whichever staff is free - no "pick your stylist" step)
- Paystack customer deposits and payment verification
- Email confirmations and reminders
- Customer accounts with cancellation and rescheduling
- Owner/staff dashboard, calendar, customers, services, hours, and invitations
- AI scheduling assistant and optional business-intelligence plan
- Flutterwave subscription billing
- Custom-domain routing

## Stack

- Next.js 15 App Router and React 19
- TypeScript and Tailwind CSS
- Supabase Auth, Postgres, Storage, and Row Level Security
- OpenAI for conversational agents
- Paystack for booking payments
- Flutterwave for platform subscriptions
- Vitest for automated tests

## Local setup

1. Install dependencies with `npm install`.
2. Create a Supabase project.
3. Apply `supabase/schema.sql` to a new database. For an existing deployment, review and apply only migrations not already present.
4. Copy `.env.example` to `.env.local` and provide the required credentials.
5. Start the development server with `npm run dev`.
6. Visit `http://localhost:3000/signup` to create a business.

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, provider secrets, webhook secrets, or private payment keys to browser code. Variables beginning with `NEXT_PUBLIC_` are bundled for the client and must contain public values only.

## Commands

```text
npm run dev     Start the development server
npm test        Run the Vitest suite
npm run build   Type-check and create a production build
npm start       Serve the production build
```

## Deployment

The app supports Vercel and other Node.js hosts. Configure `NEXT_PUBLIC_SITE_URL` with the canonical production URL, apply all database migrations, set provider webhook URLs and secrets, and use a shared rate-limit store before scaling beyond a single process.
